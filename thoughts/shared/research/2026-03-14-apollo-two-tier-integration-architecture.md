---
date: 2026-03-14T06:20:45+11:00
researcher: claude-sonnet-4-6
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Apollo integration and two-tier provider architecture (webhook+execute vs pure execute)"
tags: [research, codebase, apollo, providers, gateway, relay, backfill, two-tier, polling]
status: complete
last_updated: 2026-03-14
---

# Research: Apollo Integration and Two-Tier Provider Architecture

**Date**: 2026-03-14T06:20:45+11:00
**Git Commit**: 4ec3c541776200e318c670c5064af752d9e142f0
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Investigate everything needed to allow a two-tier-based system where some integrations are webhook + execute (GitHub, Linear, Vercel, Sentry) and some are pure API/execute only (Apollo, which has no outbound webhooks). The proxy/execute gateway endpoints already exist; the question is what must change in `ProviderDefinition`, relay middleware, and the polling trigger to support Apollo as a first-class pure-execute provider.

---

## Summary

The codebase currently handles one provider archetype: **webhook + execute**. Every provider has an inbound webhook channel (relay) plus a gateway proxy for backfill. Apollo has no outbound webhooks, so it requires a second archetype: **execute-only** (polling). The good news: the gateway proxy/execute machinery is already the backbone for backfill and is 100% reusable. The work is primarily about:

1. Making `webhook` and `oauth` on `ProviderDefinition` accommodate non-webhook providers (stub implementations or optional fields)
2. Adding a polling-based trigger mechanism (Inngest cron) to replace the webhook ingestion path
3. Registering Apollo in all the right places across the provider system

---

## Detailed Findings

### Current ProviderDefinition Requirements

**File**: `packages/console-providers/src/define.ts:275-327`

`ProviderDefinition<TConfig>` is a frozen object with these **required** fields most relevant to two-tier:

| Field | Type | Current Requirement |
|---|---|---|
| `webhook` | `WebhookDef<TConfig>` | **Required** — HMAC verify, payload parse, header schema |
| `oauth` | `OAuthDef<TConfig>` | **Required** — buildAuthUrl, exchangeCode, getActiveToken, refreshToken, revokeToken |
| `api` | `ProviderApi` | **Required** — baseUrl, endpoints, parseRateLimit |
| `backfill` | `BackfillDef` | **Required** — entityTypes, defaultEntityTypes, supportedEntityTypes |
| `events` | `Record<string, EventDefinition>` | **Required** — event schemas + transform functions |

`WebhookDef<TConfig>` requires:
- `headersSchema: z.ZodObject` — validated by relay on external webhook arrival
- `extractSecret`, `verifySignature` — HMAC verification
- `extractEventType`, `extractDeliveryId`, `extractResourceId`
- `parsePayload: (raw: unknown) => unknown`

`OAuthDef<TConfig>` requires:
- `buildAuthUrl`, `exchangeCode`, `processCallback` — full OAuth2 flow
- `getActiveToken` — returns bearer token for API calls
- `refreshToken`, `revokeToken`
- `usesStoredToken: boolean`

### How the Webhook Path Works (Tier 1)

**File**: `apps/relay/src/routes/webhooks.ts:45-166`

All inbound webhooks arrive at `POST /webhooks/:provider`. The middleware chain:

1. `providerGuard` — validates `:provider` via `getProvider()`, attaches `providerDef`
2. `serviceAuthDetect` — checks `X-API-Key`; sets `isServiceAuth` flag
3. `serviceAuthBodyValidator` — (service auth only) validates JSON body
4. `webhookHeaderGuard` — (standard only) calls `providerDef.webhook.headersSchema.safeParse()`
5. `rawBodyCapture` — (standard only) reads raw body for HMAC
6. `signatureVerify` — (standard only) calls `providerDef.webhook.verifySignature()`
7. `payloadParseAndExtract` — **both paths** call `providerDef.webhook.parsePayload()`

**Critical**: `payloadParseAndExtract` runs on **both** standard and service auth paths, calling `providerDef.webhook.parsePayload()`. This means even when backfill injects events via service auth, the provider's webhook parser runs on the payload.

### How the Service Auth Path Works (Used by Backfill)

**File**: `apps/relay/src/routes/webhooks.ts:63-141`

When backfill workers detect state transitions and need to emit events, they POST to the relay with `X-API-Key`. The relay:
- Deduplicates via Redis (`webhookSeenKey`)
- Persists to `gwWebhookDeliveries`
- Publishes directly to Console ingress via QStash (skips connection resolution since `connectionId/orgId` are pre-resolved in the body)

This is the exact same path a polling provider (Apollo) would use to emit its state transition events.

### How the Gateway Proxy Works (The Execute Side)

**File**: `apps/gateway/src/routes/connections.ts:696-880`

Two endpoints:
- `GET /:id/proxy/endpoints` — returns provider's API catalog (strips Zod schemas, not JSON-serializable)
- `POST /:id/proxy/execute` — pure proxy, handles: endpoint lookup, auth injection (via `getActiveTokenForInstallation`), 401 retry with `forceRefreshToken`, path template substitution, query params, returns raw `{ status, data, headers }`

The gateway's token handling:
- `getActiveTokenForInstallation` reads from `gwTokens` table, handles expiry + refresh
- For providers with `usesStoredToken: false` (GitHub), calls `providerDef.oauth.getActiveToken()` to generate a fresh token
- For providers with `usesStoredToken: true` (Linear, Sentry, Vercel), decrypts stored token + passes to `getActiveToken()`

**Apollo would use `usesStoredToken: true`** — the API key is stored encrypted in `gwTokens.accessToken`, and `getActiveToken` returns it directly.

### How the Backfill Entity Worker Uses Proxy/Execute

**File**: `apps/backfill/src/workflows/entity-worker.ts:88-192`

The entity worker is an Inngest function triggered by `apps-backfill/entity.requested`. It:
1. Resolves `providerDef.backfill.entityTypes[entityType]` — the `BackfillEntityHandler`
2. Loops pages: calls `entityHandler.buildRequest(ctx, cursor)` → `gw.executeApi(installationId, { endpointId, ... })`
3. `processResponse(data, ctx, cursor, responseHeaders)` → `{ events, nextCursor, rawCount }`
4. Dispatches events via `relay.dispatchWebhook(provider, { connectionId, orgId, deliveryId, eventType, payload, receivedAt }, holdForReplay)`
5. Parses rate limits from response headers client-side: `providerDef.api.parseRateLimit(new Headers(raw.headers))`

**This entire loop is already generic enough for Apollo.** Apollo's backfill would use the same `BackfillEntityHandler` interface with page-number pagination instead of cursor-based.

### The `webhookSecretEnvKey` Map in Relay

**File**: `apps/relay/src/middleware/webhook.ts:62-76`

```ts
const webhookSecretEnvKey: Record<ProviderName, keyof Pick<typeof env,
  | "GITHUB_WEBHOOK_SECRET"
  | "VERCEL_CLIENT_INTEGRATION_SECRET"
  | "LINEAR_WEBHOOK_SIGNING_SECRET"
  | "SENTRY_CLIENT_SECRET"
>> = { github: ..., vercel: ..., linear: ..., sentry: ... };
```

This is a **fully typed** `Record<ProviderName, keyof env>`. If `ProviderName` gains `"apollo"`, this map must include `"apollo"`. But `signatureVerify` only runs on the **standard webhook path** (non-service auth). Apollo would never receive external webhooks, so `signatureVerify` would never run for Apollo requests. The type system still requires the map to be complete, however.

### The Registry — All Touch Points

**File**: `packages/console-providers/src/registry.ts:20-36`

Adding a provider requires updating **4 locations** in registry.ts:

1. **`ProviderConfigMap` interface** — `apollo: ApolloConfig`
2. **`PROVIDERS` const** — `apollo: apolloProvider`
3. **`providerAccountInfoSchema`** — add `PROVIDERS.apollo.accountInfoSchema` to discriminated union
4. **`providerConfigSchema`** — add `PROVIDERS.apollo.providerConfigSchema` to discriminated union

The `sourceTypeSchema` (`z.enum(Object.keys(PROVIDERS))`) and `ProviderName` type are automatically derived.

### Display Registry

**File**: `packages/console-providers/src/display.ts:16-53`

A separate `PROVIDER_DISPLAY` const (client-safe, no Zod schemas) with icon SVG paths. Must add Apollo entry independently from `PROVIDERS` in registry.ts.

---

## What Apollo Needs as a Provider

### Apollo's Authentication Model

From the prior web research (`thoughts/shared/research/2026-03-14-web-analysis-apollo-hubspot-providers.md`):
- **API key auth** via `x-api-key` header
- OAuth2 available only to registered partners (not initially viable)
- API key stored in `gwTokens.accessToken` (encrypted)

The gateway's `buildAuthHeader` on `ProviderApi` handles the `x-api-key` pattern:

```ts
// providers/apollo/api.ts
api: {
  baseUrl: "https://api.apollo.io/api/v1",
  buildAuthHeader: (token) => token,  // Apollo uses x-api-key header, not Bearer
  defaultHeaders: { "x-api-key": "..." }, // Actually needs different approach
  ...
}
```

Wait — the gateway builds the Authorization header using `buildAuthHeader`. But Apollo uses `x-api-key`, not `Authorization`. The `ProviderApi.buildAuthHeader` produces the **value** for the `Authorization` header. For Apollo, the header name is different.

**This requires a `ProviderApi` extension**: either add `authHeaderName?: string` (defaulting to `"Authorization"`) or expand `buildAuthHeader` to return `{ headerName, headerValue }`. Currently it only returns a string value used as `Authorization: ${authHeader}` (`connections.ts:827-830`).

### Webhook Stub for Apollo

Apollo would need a minimal no-op `WebhookDef` since the interface requires it:

```ts
webhook: {
  headersSchema: z.object({}),  // No required headers
  extractSecret: () => "",
  verifySignature: () => false,  // Never called for service-auth-only providers
  extractEventType: (_headers, payload) => (payload as {eventType: string}).eventType,
  extractDeliveryId: (_headers, payload) => (payload as {deliveryId: string}).deliveryId,
  extractResourceId: () => null,
  parsePayload: (raw) => raw,  // Passthrough — backfill sends pre-shaped events
},
```

**Alternative approach**: Make `webhook` optional on `ProviderDefinition` and guard all relay webhook middleware accesses behind a null check.

### OAuth Stub for Apollo (API Key Auth)

Apollo uses API key, not OAuth. The gateway's OAuth flow (authorize, callback) would not apply. But `getActiveToken` IS called by the gateway proxy to get the auth token:

```ts
oauth: {
  usesStoredToken: true,
  getActiveToken: (_config, _externalId, storedAccessToken) => {
    if (!storedAccessToken) throw new Error("no_api_key_stored");
    return Promise.resolve(storedAccessToken);
  },
  // All OAuth methods throw — Apollo doesn't use OAuth flow
  buildAuthUrl: () => { throw new Error("Apollo does not support OAuth flow") },
  exchangeCode: () => Promise.reject(new Error("Apollo does not support OAuth flow")),
  processCallback: () => Promise.reject(new Error("Apollo does not support OAuth flow")),
  refreshToken: () => Promise.reject(new Error("Apollo API keys do not refresh")),
  revokeToken: () => Promise.resolve(),  // No-op: deleting installation is sufficient
},
```

**Implication**: The gateway routes `/connections/:provider/authorize` and `/:provider/callback` would return errors for Apollo. The console UI would need a different connection flow: a form to enter the API key directly.

### Polling Trigger: The New Mechanism

Apollo has no inbound webhooks. Live data requires scheduled polling. This is architecturally different from backfill (one-time historical import):

- **Backfill**: Triggered once per installation (or manually). Imports N days of history.
- **Polling**: Runs every N minutes forever. Detects state changes since last poll.

Current backfill trigger path: `Console tRPC → Relay → Backfill service → Upstash Workflow → Inngest`

Polling would need:
- An **Inngest cron function** (e.g., every 5-15 minutes)
- For each active Apollo installation → fetch contacts/accounts/deals updated since last poll timestamp
- Diff against stored entity `currentState` in `workspaceSourceEntities`
- For detected transitions → POST to relay service auth path

The polling trigger does NOT need the backfill service. It can live in `apps/backfill/` or as a new Inngest function registered in `api/console/`.

---

## Architecture Map: Two-Tier Provider System

### Tier 1: Webhook + Execute (GitHub, Linear, Vercel, Sentry)

```
External Provider
       │ POST /webhooks/:provider (HMAC-signed)
       ▼
  Relay Service
  ┌─────────────────────────────────────────┐
  │ providerGuard → signatureVerify         │
  │ payloadParseAndExtract                  │
  │ → Upstash Workflow trigger              │
  └─────────────────────────────────────────┘
       │ Webhook delivery workflow
       ▼
  Console Ingress (QStash)
       │
       ▼
  Neural Pipeline (Inngest)

  BACKFILL (historical):
  Console tRPC → Relay → Backfill → entity-worker → gw.executeApi()
  → relay.dispatchWebhook() (service auth path)
```

### Tier 2: Execute-Only (Apollo, Salesforce, etc.)

```
  No inbound webhooks from provider.

  POLLING (live data, scheduled):
  Inngest cron (every 5-15min)
       │
       ▼
  Polling Worker (Inngest function)
  ┌─────────────────────────────────────────┐
  │ gw.executeApi(installationId, ...)      │  ← Same proxy/execute path
  │ diff(polledState, storedState)          │
  │ → relay.dispatchWebhook() (service auth)│  ← Same relay path backfill uses
  └─────────────────────────────────────────┘
       │ POST /webhooks/apollo (X-API-Key)
       ▼
  Relay Service (service auth path only)
  ┌─────────────────────────────────────────┐
  │ serviceAuthDetect → skip sig verify     │
  │ payloadParseAndExtract (parsePayload)   │
  │ → QStash to Console ingress             │
  └─────────────────────────────────────────┘
       │
       ▼
  Neural Pipeline (Inngest) — same as Tier 1

  BACKFILL (historical) — identical to Tier 1:
  entity-worker → gw.executeApi() → relay.dispatchWebhook()
```

---

## Complete Change Inventory for Apollo

### `packages/console-providers/src/`

| File | Change |
|---|---|
| `define.ts:191-204` | Add `authHeaderName?: string` to `ProviderApi` interface (Apollo uses `x-api-key` not `Authorization`) |
| `define.ts:275-327` | Make `webhook?: WebhookDef<TConfig>` optional (or add `supportsWebhooks: boolean`) |
| `providers/apollo/auth.ts` | `apolloConfigSchema`, `apolloAccountInfoSchema`, `apolloProviderConfigSchema` |
| `providers/apollo/api.ts` | `apolloApi: ProviderApi` — endpoints for contacts/search, accounts/search, emailer_messages/search, opportunities/search |
| `providers/apollo/backfill.ts` | `apolloBackfill: BackfillDef` — same `BackfillEntityHandler` interface, page-number pagination |
| `providers/apollo/index.ts` | `defineProvider({ ..., webhook: apolloWebhookStub, oauth: apolloApiKeyAuth, ... })` |
| `registry.ts:20-36` | Add `apollo: ApolloConfig` to `ProviderConfigMap`; add to `PROVIDERS`, account info schema, provider config schema |
| `display.ts:16-53` | Add Apollo display entry with icon SVG |
| `index.ts` | Re-export Apollo types and schemas |

### `apps/relay/src/`

| File | Change |
|---|---|
| `middleware/webhook.ts:62-76` | Add `apollo` to `webhookSecretEnvKey` map (can map to a no-op env key or make the Record partial) |
| `middleware/webhook.ts:226-286` | Guard `payloadParseAndExtract` against null webhook def if `webhook` is made optional |

### `apps/gateway/src/`

| File | Change |
|---|---|
| `routes/connections.ts:827-830` | Support `authHeaderName` from `ProviderApi` — use it instead of hardcoded `"Authorization"` |
| `env.ts` | Add `APOLLO_API_KEY` env var (if gateway-level config needed) |

### `apps/backfill/src/` (or new Inngest cron in `api/console/`)

| File | Change |
|---|---|
| New file: `workflows/polling-worker.ts` | Inngest cron function for scheduled polling of execute-only providers |
| New file: `inngest/polling-cron.ts` | Cron definition: `"0 */15 * * * *"` → trigger polling for all active Apollo installations |

### DB (no changes required)

`gwInstallations` and `gwTokens` are already provider-agnostic. API key stored as `accessToken` in `gwTokens` (encrypted). `gwBackfillRuns` tracks entity-level progress (same schema works for polling checkpoints with `entityType` + `since`).

---

## Code References

- `packages/console-providers/src/define.ts:191-204` — `ProviderApi` interface (add `authHeaderName?`)
- `packages/console-providers/src/define.ts:275-327` — `ProviderDefinition` interface (make `webhook` optional)
- `packages/console-providers/src/define.ts:77-95` — `WebhookDef<TConfig>` interface (full shape)
- `packages/console-providers/src/define.ts:97-131` — `OAuthDef<TConfig>` interface (full shape)
- `packages/console-providers/src/registry.ts:20-36` — `ProviderConfigMap` + `PROVIDERS` (add apollo)
- `packages/console-providers/src/registry.ts:132-152` — discriminated union schemas (add apollo)
- `packages/console-providers/src/display.ts:16-53` — `PROVIDER_DISPLAY` (add apollo)
- `packages/console-providers/src/gateway.ts:162-179` — `proxyExecuteRequestSchema` (unchanged — works for apollo)
- `apps/relay/src/middleware/webhook.ts:62-76` — `webhookSecretEnvKey` map (add apollo)
- `apps/relay/src/middleware/webhook.ts:226-286` — `payloadParseAndExtract` — calls `webhook.parsePayload` on both paths
- `apps/relay/src/routes/webhooks.ts:63-141` — service auth path — this is Apollo's live event channel
- `apps/gateway/src/routes/connections.ts:514-567` — `getActiveTokenForInstallation` (works for API key with `usesStoredToken: true`)
- `apps/gateway/src/routes/connections.ts:827-830` — `Authorization` header construction (needs `authHeaderName` support)
- `apps/backfill/src/workflows/entity-worker.ts:88-192` — pagination loop (fully generic, works for Apollo backfill)

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-03-14-web-analysis-apollo-hubspot-providers.md` — Full API research: Apollo has no native webhooks, uses page-number pagination (not cursor), API key auth, `x-api-key` header. Contact/account/deal search endpoints are credit-free. Enrichment endpoints cost credits.
- `thoughts/shared/plans/2026-03-10-backfill-provider-unification-v3r1.md` — The gateway proxy/execute design was specifically built to be provider-agnostic. Apollo can use it directly with no gateway changes except `authHeaderName` support.

---

## Key Blockers / Tight Couplings

1. **`x-api-key` auth header**: The gateway proxy currently hardcodes `Authorization: ${authHeader}`. Apollo uses `x-api-key` header. `ProviderApi` needs `authHeaderName?: string` to override the header name. (`connections.ts:827-830`)

2. **`webhookSecretEnvKey` type**: Fully typed `Record<ProviderName, keyof env>` — must include Apollo even though it has no webhook secret. Simplest fix: map Apollo to a dummy env key or make the record `Partial`. (`relay/middleware/webhook.ts:62-76`)

3. **`payloadParseAndExtract` on service auth path**: Even internal events from the polling worker go through `webhook.parsePayload`. Apollo needs a passthrough: `parsePayload: (raw) => raw`. (`relay/middleware/webhook.ts:238-250`)

4. **Console connection UI**: Apollo has no OAuth flow. The `/:provider/authorize` and `/:provider/callback` gateway routes aren't used. The console needs a separate "enter API key" UI flow for Apollo installation.

5. **Polling trigger — no existing pattern**: Currently there is no scheduled Inngest cron for live data. Backfill is one-time; polling is forever. This is new infrastructure.

---

## Open Questions

1. Should `webhook` be made **optional** on `ProviderDefinition`, or should execute-only providers provide a **noop stub**? Making it optional is cleaner but requires null guards in relay middleware. Stub is simpler but more boilerplate.

2. Should the polling worker live in `apps/backfill/` (reusing entity-worker infrastructure) or in `api/console/` with the other neural Inngest functions?

3. For state transition detection, where does the diff happen? Options: (a) polling worker compares against `workspaceSourceEntities.currentState` from DB, or (b) polling worker sends raw polled state and the neural pipeline does the diff. The research doc suggests the entity store already holds `currentState` — this is the right comparison point.

4. How to handle Apollo's installation flow in the console UI? Options: (a) a separate "API key" connection modal, (b) a pseudo-OAuth flow where the "authorization URL" is just the console's own API key entry form.
