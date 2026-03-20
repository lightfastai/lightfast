---
date: 2026-03-17T00:00:00+11:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "HubSpot integration into @repo/app-providers"
tags: [research, codebase, console-providers, hubspot, providers, oauth, webhooks, backfill]
status: complete
last_updated: 2026-03-17
last_updated_note: "Added design decisions: verifySignature URL (Option B), batch webhook expansion (expandBatch on WebhookDef)"
---

# Research: HubSpot Integration into `@repo/app-providers`

**Date**: 2026-03-17
**Git Commit**: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
**Branch**: main

## Research Question

What does it take to add HubSpot as a new provider in `packages/console-providers/`, and what are the HubSpot-specific design constraints that differ from existing providers?

---

## Summary

The `@repo/app-providers` package has a well-defined provider framework: each provider is a directory of 6 files (`auth.ts`, `api.ts`, `schemas.ts`, `transformers.ts`, `backfill.ts`, `index.ts`) that implement a `ProviderDefinition` interface. Adding HubSpot requires creating those files plus touching 5 existing files in the monorepo. The registry, dispatch, and event normalization layers are all data-driven and need no structural changes.

HubSpot's integration is largely standard OAuth 2.0 and CRM v3 REST, with **three significant architectural differences** from existing providers:

1. **Batch webhook payload** — HubSpot sends a JSON array of up to 100 events per request (all existing providers send one event per request). The relay must explode the batch before dispatching.
2. **URL-inclusive HMAC signature** — HubSpot's v3 signature algorithm covers `METHOD + FULL_URL + BODY + TIMESTAMP`. The current `WebhookDef.verifySignature(rawBody, headers, secret)` interface does not pass the request URL; it would need accommodation.
3. **Per-property change events** — HubSpot fires one webhook event per changed property (e.g., `contact.propertyChange` for `lifecyclestage`). All other providers report entity-level events. Normalization to a `contact.updated` category is required.

---

## Detailed Findings

### 1. Provider Framework Anatomy (Linear as Reference)

The Linear provider (`packages/console-providers/src/providers/linear/`) is the closest analog to HubSpot (pure OAuth, CRM-adjacent). Its 6-file structure is the implementation template.

#### `auth.ts` — Config, AccountInfo, ProviderConfig

Three schemas:

| Schema | Contents |
|---|---|
| `LinearConfig` | Runtime config: `clientId`, `clientSecret`, `webhookSigningSecret`, `callbackBaseUrl` |
| `LinearAccountInfo` | Stored post-OAuth: `version: 1`, `sourceType: "linear"`, `events[]`, `installedAt`, `lastValidatedAt`, `raw: LinearOAuthRaw` (non-secret fields only — `token_type`, `scope`, `expires_in`) |
| `LinearProviderConfig` | Per-connection sync settings stored in `workspace_integrations.provider_config` JSONB: `provider: "linear"`, `type: "team"`, `sync: { events[], autoSync }` |

Env vars declared in `index.ts` envSchema: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET`. All marked `.optional()` because `optional: true` is set on the provider (`packages/console-providers/src/providers/linear/auth.ts:1-63`, `packages/console-providers/src/providers/linear/index.ts:150`).

#### `api.ts` — ProviderApi

```
packages/console-providers/src/providers/linear/api.ts
```

`linearApi` shape:
- `baseUrl: "https://api.linear.app"`
- `defaultHeaders: { "Content-Type": "application/json" }`
- `parseRateLimit`: reads `x-ratelimit-requests-remaining`, `x-ratelimit-requests-reset`, `x-ratelimit-requests-limit`
- `endpoints: { graphql: { method: "POST", path: "/graphql", responseSchema: graphqlResponseSchema } }`

Linear uses a single GraphQL endpoint. HubSpot uses distinct REST paths per object type.

#### `schemas.ts` — PreTransform webhook payloads

Two levels of schema per event type:
1. **Relay-level loose schema** — `z.passthrough()` extracting only routing fields (`type`, `action`, `organizationId`). Used in `webhook.parsePayload` for early routing.
2. **PreTransform typed schemas** — Full Zod objects with all fields. Used by `eventDef.schema.parse(payload)` in `dispatch.ts:30`.

Each typed schema extends `linearWebhookBaseSchema` (`packages/console-providers/src/providers/linear/schemas.ts:206-214`) which holds: `action`, `createdAt`, `organizationId`, `webhookId`, `webhookTimestamp`, optionally `url` and `actor`.

#### `transformers.ts` — PreTransform* → PostTransformEvent

Each transformer function takes `(payload: PreTransform*, ctx: TransformContext, eventType: string)` and produces a `PostTransformEvent`.

`PostTransformEvent` shape (`packages/console-providers/src/post-transform-event.ts:29-43`):

| Field | Notes |
|---|---|
| `deliveryId` | From `ctx.deliveryId` |
| `sourceId` | Provider-specific stable ID: `"linear:issue:<identifier>:issue.created"` |
| `provider` | `"linear"` |
| `eventType` | `"issue.created"` / `"issue.updated"` / `"issue.deleted"` |
| `title` | Short human-readable string, sanitized |
| `body` | Multi-line human-readable content, sanitized |
| `occurredAt` | ISO timestamp |
| `entity` | `{ entityType, entityId, title?, url?, state? }` |
| `attributes` | Record of provider-specific key-value metadata |
| `relations` | Array of `EntityRelation` linking to other entities |

#### `backfill.ts` — BackfillDef

```
packages/console-providers/src/providers/linear/backfill.ts
```

`BackfillDef` structure:
```
supportedEntityTypes: ["Issue", "Comment", "Project"]
defaultEntityTypes:   ["Issue", "Comment", "Project"]
entityTypes: {
  Issue:   { endpointId: "graphql", buildRequest(), processResponse() }
  Comment: { endpointId: "graphql", buildRequest(), processResponse() }
  Project: { endpointId: "graphql", buildRequest(), processResponse() }
}
```

`buildRequest(ctx, cursor)` returns `{ pathParams?, queryParams?, body? }` — for Linear this is `{ body: { query, variables } }`.

`processResponse(data, ctx, cursor, responseHeaders?)` returns `{ events: BackfillWebhookEvent[], nextCursor, rawCount }`. Each `BackfillWebhookEvent` has a `deliveryId: "backfill-<installationId>-<resourceId>-<entityType>-<itemId>"`.

Key pattern: **adapter functions** bridge API response shapes into `PreTransform*` webhook envelope shapes, allowing the same transformer functions used for live webhooks to handle backfill without duplication (`packages/console-providers/src/providers/linear/backfill.ts:246-377`).

#### `index.ts` — defineProvider()

```
packages/console-providers/src/providers/linear/index.ts:149
```

The full call declares:
- `categories` — 6 entries (`Issue`, `Comment`, `IssueLabel`, `Project`, `Cycle`, `ProjectUpdate`), all `type: "observation"`
- `events` — 5 `actionEvent()` entries (each has `actions: { created, updated, deleted }`)
- `defaultSyncEvents: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"]`
- `resolveCategory: (et) => et.split(":")[0] ?? et`
- `getBaseEventType`: converts `"project-update.created"` → `"ProjectUpdate"` by stripping action suffix then converting kebab-case to TitleCase
- `deriveObservationType: (st) => st` — identity
- `buildProviderConfig`: returns `{ provider: "linear", type: "team", sync: { events: [...defaultSyncEvents], autoSync: true } }`
- `resourcePicker: { installationMode: "merged", resourceLabel: "teams", enrichInstallation(), listResources() }`
- `webhook: { headersSchema, extractSecret, verifySignature, extractEventType, extractDeliveryId, extractResourceId, parsePayload }`
- `edgeRules`: 1 rule — Linear issues referencing any provider's issues → `relationshipType: "references"`, `confidence: 0.8`
- `oauth: { buildAuthUrl, exchangeCode, refreshToken, revokeToken, processCallback, getActiveToken, usesStoredToken: true }`
- `optional: true`

---

### 2. Registry and Integration Points Checklist

All changes when adding a new provider (`packages/console-providers/src/registry.ts`):

| Location | Change |
|---|---|
| `registry.ts:2-14` (imports) | Add `import type { HubSpotConfig }` and `import { hubspot }` |
| `registry.ts:20-25` (`ProviderConfigMap`) | Add `readonly hubspot: HubSpotConfig` |
| `registry.ts:27-36` (`PROVIDERS`) | Add `hubspot` key |
| `registry.ts:132-137` (`providerAccountInfoSchema`) | Add `PROVIDERS.hubspot.accountInfoSchema` to discriminated union |
| `registry.ts:144-149` (`providerConfigSchema`) | Add `PROVIDERS.hubspot.providerConfigSchema` to discriminated union |
| `display.ts:18-58` (`PROVIDER_DISPLAY`) | Add entry with `name`, `displayName`, `description`, `icon: { viewBox, d }`, `comingSoon: true` (initially) |
| `index.ts` (barrel) | Add 5 export blocks: API utils, pre-transform schemas/types, transformer functions, auth schemas/types, provider definition |
| `apps/relay/src/middleware/webhook.ts:64-78` | Add `hubspot: "HUBSPOT_CLIENT_SECRET"` to `webhookSecretEnvKey` |
| `apps/relay/src/env.ts` | Declare `HUBSPOT_CLIENT_SECRET` env var |

Data-driven — **no changes needed**:
- `dispatch.ts` — routing is `PROVIDERS[provider].resolveCategory(eventType)` then `events[category].schema.parse()` + `.transform()`
- `event-normalization.ts` — both functions delegate to `provider.getBaseEventType()` / `provider.deriveObservationType()`
- `cache.ts` — `SourceType` typed but no per-provider branching

---

### 3. DB and Console Surface

No database schema changes are required. The `provider` column on `gateway_installations`, `workspace_integrations`, and `gateway_webhook_deliveries` is `varchar(50)` with a TypeScript-only `.$type<SourceType>()` brand — no Postgres enum exists. Adding `"hubspot"` to `PROVIDERS` automatically expands `SourceType`.

`comingSoon` gate: `display.ts:70-72` derives `ACTIVE_PROVIDER_SLUGS` by filtering out entries with `comingSoon: true`. The `sources/new` flow (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx:17`) iterates `ACTIVE_PROVIDER_SLUGS`. The settings/sources list iterates all of `PROVIDER_SLUGS`. Setting `comingSoon: true` in the PROVIDER_DISPLAY entry will gate HubSpot out of the new-source flow until it's ready.

~14 console UI components iterate `PROVIDER_SLUGS` or key into `PROVIDER_DISPLAY` — they will all pick up HubSpot automatically once the display entry exists.

---

### 4. HubSpot OAuth

**Flow**: Standard OAuth 2.0 Authorization Code grant.

**Authorization URL**:
```
https://app.hubspot.com/oauth/authorize
  ?client_id=<UUID>
  &scope=oauth%20crm.objects.contacts.read%20crm.objects.deals.read%20crm.objects.tickets.read%20crm.objects.companies.read
  &redirect_uri=<callbackBaseUrl>/gateway/hubspot/callback
  &state=<csrf_state>
```

**Token exchange** (v3 endpoint):
```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<code>&redirect_uri=<uri>&client_id=<id>&client_secret=<secret>
```

**Token response fields**:
```json
{
  "access_token": "...",
  "refresh_token": "na1-xxxx-yyyy-...",
  "expires_in": 1800,
  "token_type": "bearer",
  "hub_id": 145106154
}
```

Key facts:
- `expires_in`: **1800 seconds (30 min)** — significantly shorter than most providers
- `hub_id`: the portal (account) ID — this is the `externalId` to store in `gateway_installations`
- Refresh tokens **do not expire** until app uninstall
- `scope` is often absent from the response in newer apps
- Tokens can be up to **300 characters**

**Refresh**:
```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=<token>&client_id=<id>&client_secret=<secret>
```

**Revoke**: No standard revoke endpoint documented for OAuth apps (private app tokens have `/oauth/v1/access-tokens/revoke`). Uninstalling the app invalidates tokens.

**Required OAuth scopes for typical CRM integration**:
```
oauth
crm.objects.contacts.read
crm.objects.deals.read
crm.objects.tickets.read
crm.objects.companies.read
conversations.read        (optional, for conversation events)
```

**Env vars**:
```
HUBSPOT_CLIENT_ID      UUID format
HUBSPOT_CLIENT_SECRET  UUID format (also used as webhook HMAC key — same value)
```

---

### 5. HubSpot Webhooks

#### Delivery format (key difference from existing providers)

HubSpot sends a `POST` containing a **JSON array** of up to 100 event objects. All other providers in Lightfast send a single event object per request.

Example payload:
```json
[
  {
    "eventId": 100,
    "subscriptionId": 2963051,
    "portalId": 145106154,
    "appId": 4708013,
    "occurredAt": 1732715551737,
    "subscriptionType": "contact.propertyChange",
    "attemptNumber": 0,
    "objectId": 123456,
    "changeSource": "CRM",
    "objectTypeId": "0-1",
    "propertyName": "lifecyclestage",
    "propertyValue": "customer",
    "isSensitive": false
  },
  { ... }
]
```

**Implication**: The relay's current webhook ingestion model processes one `(provider, eventType, payload)` tuple per webhook request. HubSpot requires exploding the batch into N tuples before dispatching. This is a relay-side concern, not a `console-providers` concern.

#### Subscription types

CRM object events follow the pattern `{objectType}.{action}`:

| Subscription Type | Description |
|---|---|
| `contact.creation` | New contact created |
| `contact.deletion` | Contact deleted |
| `contact.propertyChange` | One property changed (payload has `propertyName`, `propertyValue`) |
| `contact.merge` | Two contacts merged (payload has `mergedObjectIds`, `primaryObjectId`) |
| `contact.associationChange` | Association added/removed |
| `deal.creation` / `deal.deletion` / `deal.propertyChange` | Same pattern for deals |
| `ticket.creation` / `ticket.deletion` / `ticket.propertyChange` | Same for tickets |
| `company.creation` / `company.deletion` / `company.propertyChange` | Same for companies |
| `conversation.creation` / `conversation.deletion` / `conversation.propertyChange` | Conversation threads |
| `contact.privacyDeletion` | GDPR deletion |

**Property change granularity**: Each changed property fires a separate event. A single form submission might produce 5+ `contact.propertyChange` events in one batch. This maps poorly to the entity-level event model. The canonical Lightfast category would be `Contact` with events grouped under `created`, `updated`, `deleted`.

#### Signature verification (key difference from existing providers)

HubSpot uses **v3 HMAC** (recommended for all new apps):

```
raw_string = HTTP_METHOD + full_target_url + raw_request_body + timestamp_header_value
signature   = base64(HMAC-SHA256(key=client_secret, message=raw_string))
```

Headers on every webhook request:
- `x-hubspot-signature-v3` — base64-encoded HMAC-SHA256 (the value to verify)
- `x-hubspot-request-timestamp` — Unix timestamp in **milliseconds** (string)

Critical implementation details:
1. `HTTP_METHOD` = `POST` (uppercase)
2. `full_target_url` = the **complete URL including `https://`** — not just the path
3. `raw_request_body` = raw bytes before JSON parsing
4. Concatenate all four parts with **no separator**
5. Signature is **base64** (not hex) — all existing providers use hex
6. **Reject requests older than 5 minutes** (timestamp difference > 300,000 ms)

**Problem with current interface**: `WebhookDef.verifySignature(rawBody, headers, secret)` does not include the request URL. HubSpot's v3 algorithm requires it. Two options:
- Pass the full URL as a synthetic header (e.g., `x-request-url`) added by the relay middleware before calling `verifySignature`
- Extend `WebhookDef.verifySignature` to accept a fourth `url?: string` parameter

**Signing key**: The `client_secret` OAuth credential doubles as the webhook HMAC key. There is no separate webhook signing secret. The `extractSecret` function would return `config.clientSecret`.

**No delivery ID header**: HubSpot does not send a delivery ID header. Each event object in the array has an `eventId` (not guaranteed unique — duplicate delivery possible). `extractDeliveryId` for the envelope would need to use the `stableFingerprint` fallback pattern (already exists in the Linear provider at `packages/console-providers/src/providers/linear/index.ts:92-108`).

#### `extractResourceId`

Returns `portalId` from the first event in the array (all events in a batch share the same `portalId`).

---

### 6. HubSpot CRM v3 REST API (Backfill)

**Base URL**: `https://api.hubapi.com`

**Auth header**: `Authorization: Bearer <access_token>`

#### Endpoints for backfill

All CRM objects follow the same pattern:

```
GET /crm/v3/objects/{contacts|deals|tickets|companies}
  ?limit=100
  &after=<cursor>
  &properties=<comma-separated property names>
  &archived=false
```

Default properties returned without `properties` param:
- Contacts: `createdate`, `email`, `firstname`, `hs_object_id`, `lastmodifieddate`, `lastname`
- Deals: `dealname`, `amount`, `closedate`, `pipeline`, `dealstage`, `createdate`, `hs_lastmodifieddate`, `hs_object_id`
- Tickets: `subject`, `hs_pipeline_stage`, `hs_pipeline`, `hs_ticket_priority`
- Companies: `name`, `domain`, `createdate`, `hs_lastmodifieddate`, `hs_object_id`

Pagination:
```json
{
  "results": [ { "id": "123", "properties": {...}, "createdAt": "...", "updatedAt": "...", "archived": false } ],
  "paging": { "next": { "after": "789", "link": "..." } }
}
```
- `paging.next.after` is the cursor value (opaque integer string)
- When `paging.next` is absent, last page reached

**Backfill `since` filtering**: The list endpoint has no `since` filter. For time-bounded backfill (matching the `BackfillContext.since` pattern), use the **Search API**:

```
POST /crm/v3/objects/{object}/search
{
  "filterGroups": [{ "filters": [{ "propertyName": "lastmodifieddate", "operator": "GTE", "value": "<since_epoch_ms>" }] }],
  "sorts": [{ "propertyName": "lastmodifieddate", "direction": "ASCENDING" }],
  "properties": [...],
  "limit": 100,
  "after": "<cursor>"
}
```

Search API hard limits:
- Max **100 results per page** (not 200 as sometimes documented)
- Hard cap of **10,000 records** per cursor-paginated search — cannot navigate past the 10,000th record
- **Eventually consistent** — paginate a few minutes behind real-time

For installations with >10,000 records per entity type, a time-window segmentation strategy is needed (segment by `createdate` range).

#### Rate limits

Headers on every API response:

| Header | Meaning |
|---|---|
| `X-HubSpot-RateLimit-Remaining` | Requests left in current rolling window |
| `X-HubSpot-RateLimit-Max` | Max requests in the window |
| `X-HubSpot-RateLimit-Interval-Milliseconds` | Window size (10,000 ms) |
| `X-HubSpot-RateLimit-Daily-Remaining` | Daily requests remaining |
| `X-HubSpot-RateLimit-Daily` | Total daily allowance |

The rolling window is 10 seconds (~100-190 requests per 10s depending on tier). The Search API has a lower effective burst rate (~5 req/s).

**`parseRateLimit`** implementation would map:
- `remaining` ← `X-HubSpot-RateLimit-Remaining`
- `limit` ← `X-HubSpot-RateLimit-Max`
- `resetAt` ← current time + `X-HubSpot-RateLimit-Interval-Milliseconds` (the window size, not an absolute reset timestamp)

---

### 7. Proposed Categories and Events

Based on HubSpot's subscription types and the Lightfast event model:

```typescript
categories: {
  Contact:      { label: "Contacts",      type: "sync+observation" },
  Deal:         { label: "Deals",         type: "sync+observation" },
  Ticket:       { label: "Tickets",       type: "sync+observation" },
  Company:      { label: "Companies",     type: "sync+observation" },
  Conversation: { label: "Conversations", type: "observation" },
}

events: {
  Contact: actionEvent({ actions: { created, updated, deleted } }),
  Deal:    actionEvent({ actions: { created, updated, deleted } }),
  Ticket:  actionEvent({ actions: { created, updated, deleted } }),
  Company: actionEvent({ actions: { created, updated, deleted } }),
  Conversation: actionEvent({ actions: { created, updated, deleted } }),
}
```

**`resolveCategory` mapping** from HubSpot `subscriptionType`:
- `contact.creation` → `Contact`
- `contact.deletion` → `Contact`
- `contact.propertyChange` → `Contact`
- `contact.merge` → `Contact`
- `deal.*` → `Deal`
- `ticket.*` → `Ticket`
- `company.*` → `Company`
- `conversation.*` → `Conversation`

The `action` derivation from `subscriptionType`:
- `*.creation` → `created`
- `*.deletion` → `deleted`
- `*.propertyChange` → `updated`
- `*.merge` → `updated` (represents a mutation to the primary record)

---

### 8. ResourcePicker

HubSpot's portal (account) is a single installation — no sub-resources to pick like Linear's "teams" or Sentry's "organizations/projects". The model is:

- `installationMode: "single"` — one installation per portal, no resource picker needed
- `resourceLabel: "portals"` or similar

Alternatively, `installationMode: "merged"` with a single synthetic resource (the portal itself) would work if downstream needs a `providerResourceId` in the backfill context.

---

## Code References

| File | Notes |
|---|---|
| `packages/console-providers/src/define.ts:346-475` | `ProviderDefinition` interface + `defineProvider()` factory |
| `packages/console-providers/src/define.ts:79-96` | `WebhookDef` interface (verifySignature lacks URL param) |
| `packages/console-providers/src/registry.ts:20-36` | `ProviderConfigMap` + `PROVIDERS` — 4 edits needed for new provider |
| `packages/console-providers/src/display.ts:18-58` | `PROVIDER_DISPLAY` — 1 edit needed |
| `packages/console-providers/src/providers/linear/index.ts:149` | `defineProvider()` reference implementation |
| `packages/console-providers/src/providers/linear/auth.ts:1-63` | Auth schema reference |
| `packages/console-providers/src/providers/linear/api.ts:41-53` | ProviderApi reference |
| `packages/console-providers/src/providers/linear/backfill.ts:381-491` | BackfillDef reference |
| `packages/console-providers/src/providers/linear/index.ts:92-108` | `stableFingerprint` — delivery ID fallback when no header |
| `packages/console-providers/src/dispatch.ts:15-32` | `transformWebhookPayload` — data-driven, no per-provider branching |
| `apps/relay/src/middleware/webhook.ts:64-78` | `webhookSecretEnvKey` — only explicit per-provider map in relay |

## Architecture Notes

### The verifySignature URL problem — **Decision: Option B (optional 4th param)**

Current interface (`define.ts:95`):
```typescript
verifySignature: (rawBody: string, headers: Headers, secret: string) => boolean;
```

HubSpot v3 requires the full URL in the HMAC input.

**Chosen approach**: Add an optional `requestUrl?: string` 4th parameter to `WebhookDef.verifySignature`:

```typescript
// packages/console-providers/src/define.ts — WebhookDef
verifySignature: (
  rawBody: string,
  headers: Headers,
  secret: string,
  requestUrl?: string  // new, optional
) => boolean;
```

Relay call site (`apps/relay/src/middleware/webhook.ts:226-230`) becomes:
```typescript
const valid = providerDef.webhook.verifySignature(
  rawBody,
  c.req.raw.headers,
  secret,
  c.req.url   // new: passed to all providers; HubSpot uses it, others ignore
);
```

Existing provider implementations are unaffected — TypeScript allows functions with fewer parameters to be assigned to types with additional optional parameters.

HubSpot's `verifySignature` also needs to handle the base64 encoding mismatch (`computeHmac` returns hex, HubSpot signature is base64):

```typescript
verifySignature: (rawBody, headers, secret, requestUrl) => {
  const url = requestUrl ?? "";
  const timestamp = headers.get("x-hubspot-request-timestamp") ?? "";

  // Reject requests older than 5 minutes
  if (Date.now() - Number(timestamp) > 300_000) return false;

  const message = `POST${url}${rawBody}${timestamp}`;
  const expectedHex = computeHmac(message, secret, "SHA-256");

  // Decode received base64 → hex for timingSafeEqual
  const b64Received = headers.get("x-hubspot-signature-v3") ?? "";
  let hexReceived: string;
  try {
    hexReceived = Array.from(atob(b64Received))
      .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return false;
  }

  return timingSafeEqual(expectedHex, hexReceived);
},
```

### The batch webhook problem — **Decision: `expandBatch` on `WebhookDef`**

HubSpot delivers a JSON array of up to 100 events per request. All existing providers send one event per request.

**Chosen approach**: Add optional `expandBatch?: (payload: unknown) => unknown[]` to `WebhookDef`:

```typescript
// packages/console-providers/src/define.ts — WebhookDef
readonly expandBatch?: (payload: unknown) => unknown[];
```

`payloadParseAndExtract` middleware detects the field and stores `batchEvents` in context (`WebhookVariables.batchEvents?: unknown[]`). Delivery ID, event type, and resource ID are extracted from the first element for logging context.

The relay handler (`webhooks.ts`) replaces the single `workflowClient.trigger` with `Promise.all` over the expanded events — one workflow trigger per event:

```typescript
const batchEvents = c.get("batchEvents");
if (batchEvents && batchEvents.length > 0) {
  await Promise.all(
    batchEvents.map((event) => {
      const eid       = providerDef.webhook.extractDeliveryId(headers, event);
      const etype     = providerDef.webhook.extractEventType(headers, event);
      const eresource = providerDef.webhook.extractResourceId(event);
      return workflowClient.trigger({ body: JSON.stringify({
        provider: providerName, deliveryId: eid, eventType: etype,
        resourceId: eresource, payload: event, receivedAt: Date.now(),
        correlationId: c.get("correlationId"),
      } satisfies WebhookReceiptPayload), ... });
    })
  );
}
```

Deduplication is preserved end-to-end:
- `gateway_webhook_deliveries.deliveryId` = HubSpot's `eventId` (per event), with `onConflictDoNothing()` in workflow step 1
- QStash `deduplicationId = "hubspot_<eventId>"` handles at-least-once delivery

HubSpot's `expandBatch`:
```typescript
expandBatch: (payload) => Array.isArray(payload) ? payload : [payload],
```

### The propertyChange normalization problem

HubSpot sends one webhook event per changed property (e.g., 5 separate `contact.propertyChange` events if 5 properties were updated in one action). There's no built-in aggregation window.

In the Lightfast model, each `contact.propertyChange` event would become a `contact.updated` `PostTransformEvent`. The `sourceId` would be `"hubspot:contact:<objectId>:contact.updated"`. Because `deliveryId` is unique per webhook event (per `eventId`), duplicate filtering handles replays. Multiple `contact.updated` events per second for the same `objectId` is expected behavior.

## Open Questions

1. **verifySignature interface** — Synthetic header injection vs. extending the `WebhookDef` interface with an optional `url` parameter?
2. **Batch expansion** — Relay-side expansion loop vs. a new `isBatch` / `expandBatch` contract on `WebhookDef`?
3. **Backfill resourceId** — `installationMode: "single"` means `BackfillContext.resource.providerResourceId` would be the portal ID. Is that the right resource granularity for filtering Search API results?
4. **`propertyChange` deduplication** — Multiple `contact.propertyChange` events for the same `objectId` within seconds. Should the observation layer deduplicate by `objectId + propertyName + propertyValue` or just accept all as distinct events?
5. **App scopes** — Which HubSpot OAuth scopes are required at minimum for the initial launch (contacts only vs. full CRM)?
6. **Webhook subscriptions** — HubSpot subscriptions are configured at the app level (not per-portal). The relay's HMAC verification uses the same `client_secret` for all portals. How are per-installation webhook configurations tracked in the DB?
