---
date: 2026-03-10T09:35:16+10:00
researcher: claude
git_commit: 81c1780546900cf265d16c1dadcb13ae7be93e09
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Backfill Architecture & Provider Unification Gap Analysis"
tags: [research, codebase, backfill, console-providers, console-backfill, provider-unification, gateway, relay]
status: complete
last_updated: 2026-03-10
---

# Research: Backfill Architecture & Provider Unification Gap Analysis

**Date**: 2026-03-10T09:35:16+10:00
**Git Commit**: 81c1780546900cf265d16c1dadcb13ae7be93e09
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

The gateway and relay apps are now fully general-purpose via `@repo/console-providers`. How does the backfill app currently work, and what is the architectural gap between backfill's approach (using `@repo/console-backfill`) vs the unified `ProviderDefinition` pattern used by the other two services?

## Summary

Gateway and relay are fully provider-agnostic: they consume `ProviderDefinition.oauth` and `ProviderDefinition.webhook` respectively from `@repo/console-providers`, using `getProvider(name)` as the single runtime dispatch mechanism. Backfill is provider-agnostic at the app level (`apps/backfill/` has zero provider-specific code), but it delegates to a **completely separate package** (`@repo/console-backfill`) with its own `BackfillConnector` interface, its own `Map<SourceType, BackfillConnector>` registry, and its own provider-specific connectors and adapters. This means there are two parallel provider registries: `PROVIDERS` in console-providers and the imperative `Map` in console-backfill.

---

## Detailed Findings

### 1. How Gateway Uses Console-Providers (Fully Unified)

**Pattern**: `getProvider(name)` + `providerDef.oauth.*`

Gateway is a Hono edge service handling OAuth flows, token storage, and connection lifecycle. Every route is parameterized on `:provider` — no provider-specific routes exist.

**Key integration points:**

- **Env validation** (`env.ts:20`): Spreads `...PROVIDER_ENVS()` into `extends` array — all provider env vars are validated at startup automatically when a new provider is added to the registry.
- **Config factory** (`routes/connections.ts:31-39`): Single `Object.entries(PROVIDERS).map(...)` loop builds typed configs for all providers at module load time.
- **OAuth flow** (`routes/connections.ts:52-430`): `buildAuthUrl`, `processCallback`, `refreshToken`, `revokeToken`, `getActiveToken` — all called through `providerDef.oauth.*`. Post-callback branching is on `CallbackResult.status` (discriminated union), not provider identity.
- **Token retrieval** (`routes/connections.ts:502-602`): `providerDef.oauth.getActiveToken()` handles both stored-token (Linear, Vercel, Sentry) and on-demand JWT (GitHub) patterns transparently.
- **Teardown workflow** (`workflows/connection-teardown.ts`): Uses `getProvider(providerName)` to call `oauth.revokeToken`. One hardcoded check: `if (providerName === "github") return` (GitHub uses JWTs, nothing to revoke).

**Provider-specific code in gateway**: Effectively zero. One edge case for GitHub reinstall recovery (`connections.ts:187`).

---

### 2. How Relay Uses Console-Providers (Fully Unified)

**Pattern**: `getProvider(name)` + `providerDef.webhook.*`

Relay is a Hono edge service that receives inbound webhooks and dispatches them to Console ingress via QStash. Single `POST /:provider` route handles all providers.

**Key integration points:**

- **Provider guard** (`middleware/webhook.ts:81-97`): `getProvider(rawProvider)` returns the `ProviderDefinition` or 400 for unknown providers.
- **Header validation** (`middleware/webhook.ts:150-169`): `providerDef.webhook.headersSchema.safeParse(headers)` — required headers defined per-provider in their definitions.
- **HMAC verification** (`middleware/webhook.ts:191-220`): `providerDef.webhook.verifySignature(rawBody, headers, secret)` — algorithm (SHA-256 vs SHA-1) encapsulated per-provider.
- **Payload extraction** (`middleware/webhook.ts:226-286`): `parsePayload`, `extractDeliveryId`, `extractEventType`, `extractResourceId` — all from `providerDef.webhook.*`.
- **Service-auth path** (`middleware/webhook.ts:226-286`): Internal services (backfill) submit pre-resolved payloads via `ServiceAuthWebhookBody`, bypassing HMAC/dedup/connection resolution.

**Provider-specific code in relay**: Only the `webhookSecretEnvKey` map (`middleware/webhook.ts:62-76`) enumerates provider names to map to env var keys. All actual webhook logic is delegated to provider definitions.

---

### 3. How Backfill Currently Works

**Pattern**: `getConnector(name)` from `@repo/console-backfill` — a separate package with its own interface and registry.

The backfill app (`apps/backfill/`) is itself provider-agnostic. It orchestrates historical data import via Inngest workflows that page through provider APIs, convert results into webhook-shaped events, and dispatch them through the relay service.

#### App Architecture (`apps/backfill/src/`)

**Routes:**
- `POST /api/trigger/` (`routes/trigger.ts:29`): Receives trigger from relay, sends `"apps-backfill/run.requested"` Inngest event
- `POST /api/trigger/cancel` (`routes/trigger.ts:81`): Receives cancel from gateway, sends `"apps-backfill/run.cancelled"` Inngest event
- `POST /api/estimate/` (`routes/estimate.ts:22`): Probes page 1 per (resource x entityType) to estimate backfill scope
- `GET|POST|PUT /api/inngest/` (`routes/inngest.ts`): Inngest serve handler for two functions

**Inngest Functions:**
- **`backfillOrchestrator`** (`workflows/backfill-orchestrator.ts`): Triggered by `run.requested`. Fetches connection from gateway, resolves connector from `@repo/console-backfill`, computes work units (resources x entityTypes), applies gap-aware filtering against prior runs, invokes `backfillEntityWorker` per work unit via `step.invoke`, persists run records to gateway.
- **`backfillEntityWorker`** (`workflows/entity-worker.ts`): Triggered by `entity.requested`. Pages through provider API via `connector.fetchPage()`, dispatches events to relay via `relay.dispatchWebhook()`. Handles token refresh on 401, rate-limit sleep, and `holdForReplay` mode.

**Key data flow:**
1. Relay triggers backfill → Inngest orchestrator
2. Orchestrator resolves connector, fans out to entity workers
3. Entity worker calls `connector.fetchPage(config, entityType, cursor)` in a loop
4. Each page produces `BackfillWebhookEvent[]` — dispatched to relay as `ServiceAuthWebhookBody`
5. Relay forwards to Console ingress via QStash
6. Console runs `transformWebhookPayload()` from `@repo/console-providers` to normalize

#### What Backfill Uses from Console-Providers (Minimal)

- `timingSafeStringEqual` — API key auth in `trigger.ts` and `estimate.ts`
- `sourceTypeSchema` — transitively via `@repo/console-validation` for provider field validation
- `SourceType` — type alias used in `lib/constants.ts`

#### What Backfill Uses from Console-Backfill (Everything Else)

- `BackfillConnector<TCursor>` interface: `fetchPage(config, entityType, cursor)`, `defaultEntityTypes`, `supportedEntityTypes`, `validateScopes`
- `getConnector(provider)` / `hasConnector(provider)` — imperative `Map` registry
- `BackfillConfig`: `{ accessToken, installationId, provider, resource, since }`
- `BackfillPage<TCursor>`: `{ events, nextCursor, rateLimit?, rawCount }`
- `BackfillWebhookEvent`: `{ deliveryId, eventType, payload }`
- Provider-specific connectors: `connectors/github.ts`, `connectors/vercel.ts`
- Provider-specific adapters: `adapters/github.ts`, `adapters/vercel.ts`

---

### 4. Console-Providers Package Structure

`@repo/console-providers` (`packages/console-providers/src/`) is the single source of truth for all provider definitions. It exports:

**Core contract** (`define.ts`):
- `ProviderDefinition<TConfig>` — the master interface with fields:
  - `name`, `displayName`, `description`
  - `oauth: OAuthDef<TConfig>` — consumed by gateway
  - `webhook: WebhookDef<TConfig>` — consumed by relay
  - `events: Record<string, EventDefinition>` — event definitions with schemas and transformers
  - `categories: Record<string, CategoryDef>` — event categories
  - `envSchema`, `configSchema`, `createConfig`
  - `resolveCategory`, `getBaseEventType`, `deriveObservationType`
  - `buildProviderConfig`, `providerConfigSchema`, `accountInfoSchema`
  - `defaultSyncEvents`
  - **No `backfill` field exists**

**Registry** (`registry.ts`):
- `PROVIDERS = { github, vercel, linear, sentry }` — frozen `const` object
- `getProvider(name)` — overloaded lookup with typed/untyped signatures
- `EVENT_REGISTRY` — derived event key → metadata map
- `PROVIDER_ENVS()` — lazy env preset array for `createEnv` extends

**Dispatch** (`dispatch.ts`):
- `transformWebhookPayload(provider, eventType, payload, context)` — resolves category, parses schema, calls transformer, returns `PostTransformEvent`

**Wire schemas** (`gateway.ts`):
- `serviceAuthWebhookBodySchema` — format for internal services submitting pre-resolved webhooks
- `webhookEnvelopeSchema` — relay → console format
- `webhookReceiptPayloadSchema` — post-verification receipt format
- `gatewayConnectionSchema`, `gatewayTokenResultSchema`

**Provider implementations** (`providers/{github,linear,sentry,vercel}/`):
- Each has: `auth.ts` (config/account schemas), `schemas.ts` (pre-transform Zod schemas), `transformers.ts` (payload → PostTransformEvent), `index.ts` (defineProvider call)

---

### 5. Console-Backfill Package Structure

`@repo/console-backfill` (`packages/console-backfill/src/`) is the backfill-specific package:

**Types** (`types.ts`):
```typescript
interface BackfillConnector<TCursor = unknown> {
  provider: SourceType;
  supportedEntityTypes: string[];
  defaultEntityTypes: string[];
  fetchPage(config: BackfillConfig, entityType: string, cursor: TCursor | null): Promise<BackfillPage<TCursor>>;
  validateScopes?(config: BackfillConfig): Promise<{ valid: boolean; missing: string[] }>;
  estimateTotal?(config: BackfillConfig, entityType: string): Promise<number>;
}

interface BackfillConfig {
  accessToken: string;
  installationId: string;
  provider: SourceType;
  resource: { providerResourceId: string; resourceName: string | null };
  since: string;
}

interface BackfillPage<TCursor> {
  events: BackfillWebhookEvent[];
  nextCursor: TCursor | null;
  rateLimit?: { remaining: number; resetAt: Date; limit: number };
  rawCount: number;
}

interface BackfillWebhookEvent {
  deliveryId: string;
  eventType: string;
  payload: unknown;
}
```

**Registry** (`registry.ts`):
- Imperative `Map<SourceType, BackfillConnector>` — `registerConnector` / `getConnector` / `hasConnector` / `clearRegistry`
- Auto-registration: `index.ts` imports and registers GitHub and Vercel connectors on module load

**Connectors** (`connectors/`):
- `github.ts`: `defaultEntityTypes: ["pull_request", "issue", "release"]`. `fetchPage` switches on `entityType`, calls GitHub REST API with pagination, constructs `BackfillWebhookEvent[]` with synthetic delivery IDs
- `vercel.ts`: `defaultEntityTypes: ["deployment"]`. `fetchPage` calls Vercel REST API with cursor-based pagination

**Adapters** (`adapters/`):
- `github.ts`: Shapes raw GitHub API responses into webhook-compatible payloads (e.g., wraps a PR API response to look like a `pull_request` webhook event)
- `vercel.ts`: Shapes raw Vercel API responses into webhook-compatible payloads

---

## Architecture Comparison

### The Three Services Side-by-Side

| Aspect | Gateway | Relay | Backfill |
|---|---|---|---|
| **Provider package** | `@repo/console-providers` | `@repo/console-providers` | `@repo/console-backfill` |
| **Interface consumed** | `ProviderDefinition.oauth` | `ProviderDefinition.webhook` | `BackfillConnector` |
| **Registry** | `PROVIDERS` (frozen const) | `PROVIDERS` (frozen const) | `Map<SourceType, BackfillConnector>` |
| **Lookup function** | `getProvider(name)` | `getProvider(name)` | `getConnector(name)` |
| **Env validation** | `PROVIDER_ENVS()` spread | N/A (uses own env vars) | N/A |
| **Config** | `providerDef.createConfig(env, runtime)` | N/A (webhook ops are config-free from relay's perspective) | `BackfillConfig` (constructed manually in entity-worker) |
| **Provider-specific code in app** | ~0 (one GitHub edge case) | ~0 (one env key map) | 0 (all in console-backfill) |
| **Adding a new provider** | Add to `PROVIDERS` | Add to `PROVIDERS` | Add connector + adapter + register in console-backfill |

### Two Registries, Two Interfaces

```
@repo/console-providers                     @repo/console-backfill
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ PROVIDERS = {                │            │ Map<SourceType, Connector> = │
│   github: ProviderDefinition │            │   github → GitHubConnector   │
│   linear: ProviderDefinition │            │   vercel → VercelConnector   │
│   sentry: ProviderDefinition │            │                              │
│   vercel: ProviderDefinition │            │ (no linear)                  │
│ }                            │            │ (no sentry)                  │
│                              │            │                              │
│ ProviderDefinition {         │            │ BackfillConnector {          │
│   oauth: OAuthDef       ←── gateway      │   fetchPage()                │
│   webhook: WebhookDef   ←── relay        │   defaultEntityTypes         │
│   events: EventDefs          │            │   supportedEntityTypes       │
│   categories: CategoryDefs   │            │   validateScopes?            │
│   (no backfill field)        │            │   estimateTotal?             │
│ }                            │            │ }                            │
└──────────────────────────────┘            └──────────────────────────────┘
         ↑ used by gateway & relay                   ↑ used by backfill only
```

### What Console-Backfill Connectors Actually Do

Each connector in `@repo/console-backfill` does three things:

1. **API fetching** — Calls the provider's REST API with authentication, pagination, timeouts, rate-limit header parsing
2. **Payload adaptation** — Converts API response shapes into webhook-compatible payload shapes (via adapters) so they can be processed by the same `transformWebhookPayload()` pipeline downstream
3. **Metadata construction** — Generates synthetic `deliveryId`, `eventType`, and wraps into `BackfillWebhookEvent`

The adapters ensure that a backfill-fetched PR from the GitHub REST API (`GET /repos/:owner/:repo/pulls`) gets shaped to look like a `pull_request` webhook event payload, so Console's `transformGitHubPullRequest()` transformer can process it identically to a live webhook.

### Event Dispatch Path Comparison

**Live webhook (relay path):**
```
Provider webhook → Relay → HMAC verify → parse → QStash → Console ingress
                                                             ↓
                                              transformWebhookPayload()
                                              (from @repo/console-providers)
```

**Backfill path:**
```
Inngest worker → connector.fetchPage() → adapter shapes payload
                                             ↓
              relay.dispatchWebhook() → Relay (service-auth path) → QStash → Console ingress
                                                                                ↓
                                                                 transformWebhookPayload()
                                                                 (from @repo/console-providers)
```

Both paths converge at `transformWebhookPayload()` — the backfill adapters exist specifically to ensure payloads match the pre-transform schemas that the transformers expect.

---

## Code References

### Apps
- `apps/backfill/src/app.ts:46-51` — Route mounting
- `apps/backfill/src/routes/trigger.ts:29-63` — Trigger endpoint
- `apps/backfill/src/routes/estimate.ts:22-174` — Estimate endpoint
- `apps/backfill/src/workflows/backfill-orchestrator.ts:35-260` — Orchestrator workflow
- `apps/backfill/src/workflows/entity-worker.ts:15-216` — Entity worker workflow
- `apps/backfill/src/inngest/client.ts:6-55` — Inngest client and events
- `apps/gateway/src/routes/connections.ts:31-39` — Provider config factory
- `apps/gateway/src/env.ts:20` — PROVIDER_ENVS spread
- `apps/relay/src/routes/webhooks.ts:45` — Single POST /:provider handler
- `apps/relay/src/middleware/webhook.ts:62-76` — Webhook secret env key map
- `apps/relay/src/middleware/webhook.ts:81-97` — Provider guard middleware

### Packages
- `packages/console-providers/src/define.ts:133-181` — ProviderDefinition (no backfill field)
- `packages/console-providers/src/define.ts:73-90` — WebhookDef
- `packages/console-providers/src/define.ts:93-126` — OAuthDef
- `packages/console-providers/src/registry.ts:27-36` — PROVIDERS registry
- `packages/console-providers/src/registry.ts:120-126` — getProvider()
- `packages/console-providers/src/dispatch.ts:15-32` — transformWebhookPayload()
- `packages/console-providers/src/gateway.ts:15-23` — serviceAuthWebhookBodySchema
- `packages/console-backfill/src/types.ts` — BackfillConnector, BackfillConfig, BackfillPage
- `packages/console-backfill/src/registry.ts` — Map-based connector registry
- `packages/console-backfill/src/connectors/github.ts` — GitHub connector
- `packages/console-backfill/src/connectors/vercel.ts` — Vercel connector

---

## Architecture Documentation

### Current Conventions

1. **Gateway pattern**: `ProviderDefinition.oauth.*` via `getProvider()` — one generic route, zero provider switch statements
2. **Relay pattern**: `ProviderDefinition.webhook.*` via `getProvider()` — one generic route, zero provider switch statements
3. **Backfill pattern**: `BackfillConnector.*` via `getConnector()` — provider-agnostic app, but separate interface and registry
4. **Convergence point**: All paths produce payloads that pass through `transformWebhookPayload()` in console-providers
5. **Service-auth bypass**: Backfill dispatches to relay using `ServiceAuthWebhookBody` schema, which skips HMAC/dedup/connection resolution

### What Exists on ProviderDefinition That Backfill Could Consume

- `events` — Defines `supportedEntityTypes` equivalent (event keys map to backfill entity types)
- `categories` — Defines `defaultSyncEvents` equivalent (observation/sync categorization)
- `defaultSyncEvents` — Already exists on the definition
- `createConfig(env, runtime)` — Config factory (currently backfill constructs `BackfillConfig` manually)
- `oauth.getActiveToken()` — Token retrieval (currently backfill calls gateway HTTP API)
- Per-provider schemas in `providers/*/schemas.ts` — Pre-transform schemas that adapters must match

### What Does NOT Exist on ProviderDefinition

- `fetchPage(config, entityType, cursor)` — The core pagination function
- `supportedEntityTypes` / `defaultEntityTypes` — Explicit backfill entity type lists
- Provider-specific API URL construction and response parsing
- Rate-limit header parsing
- Payload adaptation (API response → webhook-compatible shape)

---

## Historical Context (from thoughts/)

Two prior research documents exist on this branch, both focused on graph-linker architecture:

- `thoughts/shared/research/2026-03-10-graph-linker-architecture-deep-dive.md` — Covers the full relay → console → Inngest pipeline, PostTransformEvent patterns, and touches on all three Hono services. Documents separation boundaries.
- `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md` — Covers cross-source linking keys, relationship types, eventual consistency. Does not address backfill unification.

No prior research specifically on backfill architecture or provider unification exists.

---

## Related Research

- `thoughts/shared/research/2026-03-10-graph-linker-architecture-deep-dive.md` — Documents the full event pipeline that backfill events flow through
- `thoughts/shared/research/2026-03-10-graph-linker-deep-dive.md` — Documents cross-source relationships relevant to backfill ordering

---

## Open Questions

1. Should `ProviderDefinition` gain a `backfill?: BackfillDef<TConfig>` field (parallel to `oauth` and `webhook`), or should the backfill connector interface be merged differently?
2. How should entity types map between the backfill connector's `supportedEntityTypes` and the provider definition's `events` keys? They're currently different (e.g., connector uses `"pull_request"` while events map uses `"pull_request"` but categories use `"pull_request"` too — these happen to align for GitHub but the mapping is implicit).
3. The backfill connectors currently construct `BackfillConfig` with `accessToken` from the gateway HTTP API. In a unified model, would `ProviderDefinition.oauth.getActiveToken()` be called directly, or would the gateway HTTP API remain the token source?
4. The adapters (`console-backfill/adapters/`) are the glue between REST API responses and webhook-shaped payloads. In a unified model, would these live alongside the transformers in `console-providers/providers/*/`, or remain separate?
5. Linear and Sentry have no backfill connectors today. Would adding `backfill` to `ProviderDefinition` make it optional (not all providers support historical import)?
