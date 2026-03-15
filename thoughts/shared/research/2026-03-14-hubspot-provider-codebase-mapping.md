---
date: 2026-03-14T16:00:00+11:00
researcher: claude-sonnet-4-6
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "HubSpot Provider Integration — Codebase Mapping"
tags: [research, codebase, hubspot, providers, webhook, relay, entity-store, backfill, oauth, gateway]
status: complete
last_updated: 2026-03-14
last_updated_note: "Added follow-up research: HubSpot edge rules, STRUCTURAL_TYPES requirement, cross-provider domain-key strategy"
---

# Research: HubSpot Provider Integration — Codebase Mapping

**Date**: 2026-03-14
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

How does the HubSpot API research (`2026-03-14-web-analysis-apollo-hubspot-providers.md`) map onto the existing Lightfast codebase? What does an integration look like across each layer: provider definition, relay webhook pipeline, entity store, Inngest backfill, gateway OAuth, and validation schemas?

---

## Summary

HubSpot maps cleanly onto the existing provider architecture with one significant structural gap: the relay pipeline assumes **one HTTP POST = one logical event**. HubSpot sends **batched JSON arrays of up to 100 events per POST**, requiring fan-out logic that does not exist today. All other integration points — the `ProviderDefinition` interface, `PostTransformEvent`, entity store tables, Inngest pipeline, gateway OAuth, and validation schemas — accommodate HubSpot with additive extensions only.

---

## Detailed Findings

### 1. Provider Architecture — Where HubSpot Would Live

**Files to create:**
- `packages/console-providers/src/providers/hubspot/transformers.ts`
- `packages/console-providers/src/providers/hubspot/index.ts`
- `packages/console-providers/src/providers/hubspot/api.ts`
- `packages/console-providers/src/providers/hubspot/auth.ts`
- `packages/console-providers/src/providers/hubspot/backfill.ts`
- `packages/console-providers/src/providers/hubspot/schemas.ts`

**How existing providers are structured** (`packages/console-providers/src/providers/`): each provider has exactly this layout, wired into `ProviderDefinition` via `defineProvider()` at `packages/console-providers/src/define.ts:337`.

**The `PostTransformEvent` shape** (`packages/console-providers/src/post-transform-event.ts:29-47`):

```ts
{
  deliveryId:  string (min 1)
  sourceId:    string (min 1)       // e.g. "hubspot:deal:{portalId}/{objectId}:dealstage.changed"
  provider:    string (min 1)       // "hubspot"
  eventType:   string (min 1)       // "deal.propertyChange"
  occurredAt:  ISO 8601 datetime
  entity: {
    provider:   string,
    entityType: string,             // "deal", "contact", "ticket", "company"
    entityId:   string,             // "{portalId}/{objectId}"
    title:      string,
    url:        string | null,
    state:      string | null,      // dealstage ID or lifecycle stage name
  },
  relations:   EntityRelation[],
  title:       string (max 200),
  body:        string (max 50,000),
  attributes:  Record<string, string | number | boolean | null>
}
```

**The `entityType` field is an open string** — no enum enforced in the schema. The `entityCategorySchema` in `packages/console-validation/src/schemas/entities.ts:9-24` (the _entity extraction_ layer) uses an enum: structural (`commit`, `branch`, `pr`, `issue`, `deployment`) and semantic types. HubSpot CRM types (`contact`, `deal`, `ticket`, `company`) are **not in this enum** — they would need to be added to the structural types set if they are to participate in graph edge resolution.

**`sourceId` pattern for HubSpot transformers** (following existing conventions):

| HubSpot Object | `entityType` | `sourceId` pattern |
|---|---|---|
| Contact | `"contact"` | `hubspot:contact:{portalId}/{objectId}:{propertyName}.changed` |
| Company | `"company"` | `hubspot:company:{portalId}/{objectId}:{propertyName}.changed` |
| Deal | `"deal"` | `hubspot:deal:{portalId}/{objectId}:dealstage.changed` |
| Ticket | `"ticket"` | `hubspot:ticket:{portalId}/{objectId}:pipeline_stage.changed` |
| Contact (created) | `"contact"` | `hubspot:contact:{portalId}/{objectId}:created` |
| Deal (created) | `"deal"` | `hubspot:deal:{portalId}/{objectId}:created` |

**`ProviderDefinition` required fields** (`packages/console-providers/src/define.ts:275-327`):

```ts
{
  name, displayName, description,
  configSchema, accountInfoSchema, providerConfigSchema,
  envSchema, createConfig, env,
  categories, events, defaultSyncEvents,
  buildProviderConfig,
  resolveCategory, getBaseEventType, deriveObservationType,
  webhook: WebhookDef,
  oauth: OAuthDef,
  api: ProviderApi,
  backfill: BackfillDef,
  edgeRules?: EdgeRule[],
}
```

**Adding HubSpot to the registry** (`packages/console-providers/src/registry.ts:27-48`):

`sourceTypeSchema` is derived dynamically from `Object.keys(PROVIDERS)`. Adding HubSpot to `PROVIDERS` (line 27) and `ProviderConfigMap` (line 20) is all that is needed — the enum updates automatically.

---

### 2. Relay Webhook Pipeline — The Batch Fan-Out Gap

This is the most significant structural difference between HubSpot and existing providers.

**Current architecture: one POST = one event**

The relay pipeline enforces 1:1 relationship at 8 structural points:

| Location | File:Line | Assumption |
|---|---|---|
| `WebhookDef.parsePayload` return type | `define.ts:89` | `(raw: unknown) => unknown` — single object |
| `WebhookDef.extractDeliveryId` return type | `define.ts:79` | `(headers, payload) => string` — single string |
| `WebhookVariables` context fields | `middleware/webhook.ts:25-42` | `deliveryId: string`, `eventType: string`, `parsedPayload: unknown` |
| `payloadParseAndExtract` logic | `middleware/webhook.ts:226-286` | Assigns all four scalars once, no loop |
| `WebhookReceiptPayload` schema | `gateway.ts:32-41` | All scalar fields, no array variants |
| Redis dedup key | `cache.ts:16-17` | `gw:webhook:seen:{provider}:{deliveryId}` — no position index |
| `gwWebhookDeliveries` unique index | `gw-webhook-deliveries.ts:35-38` | Unique on `(provider, delivery_id)` |
| QStash `deduplicationId` | `workflows.ts:200` | `"${provider}:${deliveryId}"` — one string |

**HubSpot's wire format**: HubSpot sends a JSON array per POST:

```json
[
  { "eventId": 930654971, "subscriptionId": 210178, "portalId": 6205670,
    "subscriptionType": "deal.propertyChange", "objectId": 1148387968, ... },
  { "eventId": 930654972, ... },
  ...
]
```

Up to 100 events per request. Each event has its own `eventId` (the natural delivery ID).

**How the existing backfill service handles its own array events**: The `BackfillEntityHandler.processResponse()` at `define.ts:225-234` returns `{ events: BackfillWebhookEvent[], nextCursor, rawCount }`. The entity worker dispatch loop in `apps/backfill/src/workflows/entity-worker.ts` iterates that array externally, firing one relay `dispatchWebhook` POST per element. The fan-out is in the _caller_, not in the relay.

**HMAC verification on batched payloads**: HubSpot sends `X-HubSpot-Signature-v3` covering the entire batch body. Signature verification runs once on the raw body string at `middleware/webhook.ts:191-220` — this works correctly for batched bodies without change. The issue is downstream: after signature verification, `payloadParseAndExtract` expects to produce one `deliveryId` and one `parsedPayload`.

**HubSpot webhook HMAC verification spec** (from API research):
- Header: `X-HubSpot-Signature-v3` + `X-HubSpot-Request-Timestamp`
- Algorithm: `HMAC-SHA256` over `{METHOD}{URI}{BODY}{TIMESTAMP}`
- Base64-encoded (not hex), constant-time compare
- Reject if timestamp is >5 minutes old
- Legacy: `X-HubSpot-Signature` (v1: `SHA256(clientSecret + body)`, hex)

This differs from existing providers which use hex-encoded HMAC-SHA256 directly — the `computeHmac` function at `packages/console-providers/src/crypto.ts:14-21` returns hex. Base64 output would require an additional encoding step or a new utility.

---

### 3. Entity Store Schema — CRM Types

**Existing tables** (from `db/console/src/schema/tables/`):

| Table | Purpose | HubSpot Relevance |
|---|---|---|
| `workspaceIngestLog` | Raw `PostTransformEvent` JSONB | HubSpot events write here unchanged |
| `workspaceEvents` | Canonical fact events | HubSpot events write here unchanged |
| `workspaceEntities` | Deduplicated extracted entities, `(workspaceId, category, key)` unique | HubSpot CRM types need new `entityCategorySchema` members |
| `workspaceEntityEvents` | Entity-event junction | No changes needed |
| `workspaceEdges` | Directed entity-entity graph | No changes needed; edge rules defined in `ProviderDefinition.edgeRules` |
| `workspaceInterpretations` | Versioned AI outputs (Pinecone vector IDs) | No changes needed |

**Tables from research/plans that don't exist in live code**: `workspaceSourceEntities`, `workspaceEntityTransitions`, `workspaceObservations` — these exist only in `thoughts/shared/plans/` and `thoughts/shared/research/` documents. Not implemented.

**The `entityCategorySchema` gap** (`packages/console-validation/src/schemas/entities.ts:9-24`):

```ts
// Current structural types (used for graph edge resolution):
"commit" | "branch" | "pr" | "issue" | "deployment"

// HubSpot CRM types would need to be added:
"contact" | "deal" | "ticket" | "company"
```

The `STRUCTURAL_TYPES` set in `api/console/src/inngest/workflow/neural/event-store.ts:52-58` is derived from this schema. Adding CRM types to the structural set means HubSpot entity-event junctions would get `refLabel` values and participate in the `resolveEdges()` co-occurrence graph algorithm.

**Entity dedup key** — HubSpot entities would use `key = "{portalId}/{objectId}"` and `category = "deal"` (etc.), matching the unique index `(workspaceId, category, key)` at `workspace-entities.ts:134`.

**`observationVectorMetadataSchema`** (`packages/console-validation/src/schemas/neural.ts:14-29`): stores `source`, `sourceType`, `observationType` as open strings. HubSpot values like `source: "hubspot"` and `observationType: "deal_stage_changed"` fit without schema changes.

**`entityVectorMetadataSchema`** (`packages/console-validation/src/schemas/neural.ts:62-79`): stores `provider`, `entityType` as open strings. HubSpot values fit without schema changes.

---

### 4. Inngest Backfill Workflows

**For HubSpot's webhook-native path**: No changes to the Inngest neural pipeline. HubSpot events enter at `apps/console/src/app/api/gateway/ingress/route.ts:28` (same as all other providers) after QStash delivery. The 4-function chain (`eventStore → entityGraph → entityEmbed`, `eventStore → eventInterpret`) runs unchanged.

**For HubSpot backfill** (cursor-based pagination via HubSpot's `after` token):

The backfill entity worker at `apps/backfill/src/workflows/entity-worker.ts` drives pagination via `gw.executeApi()` calls. HubSpot's cursor-based pagination (`after` token, no `next.paging` = end) maps naturally to the existing page loop. The entity worker reads `nextCursor` from `BackfillEntityHandler.processResponse()` and continues until `nextCursor` is null.

**Rate limit handling**: The entity worker reads rate limits from response headers via `providerDef.api.parseRateLimit(new Headers(raw.headers))` and sleeps when `remaining < limit * 0.1`. HubSpot's rate limit headers for public OAuth apps:
- `X-HubSpot-RateLimit-Remaining` (10-second window)
- `X-HubSpot-RateLimit-Daily-Remaining`
- `X-HubSpot-RateLimit-Interval-Milliseconds`

HubSpot's `parseRateLimit` implementation in `api.ts` would parse these and return `{ remaining, limit, resetAt }`.

**Significance scoring**: The significance threshold is 40 (`api/console/src/inngest/workflow/neural/scoring.ts:23`). HubSpot deal stage transitions are high-signal events — `EVENT_REGISTRY[key].weight` would need appropriate weights in the provider definition to avoid being filtered.

**Backfill entity types** for HubSpot:
- `contacts` — `/crm/v3/objects/contacts` with `after` cursor
- `companies` — `/crm/v3/objects/companies` with `after` cursor
- `deals` — `/crm/v3/objects/deals` with `after` cursor
- `tickets` — `/crm/v3/objects/tickets` with `after` cursor

Search endpoint for time-windowed backfill: `POST /crm/v3/objects/{type}/search` with `lastmodifieddate` filter (10,000 record cap — requires time-window segmentation).

---

### 5. Gateway OAuth Layer

HubSpot uses **full public OAuth2** (Authorization Code flow) — the strongest match with the existing gateway OAuth architecture.

**Token exchange flow** (how it maps to `connections.ts`):

| Step | Gateway Code | HubSpot |
|---|---|---|
| Auth URL construction | `connections.ts:61-116` → `providerDef.oauth.buildAuthUrl()` | `https://app.hubspot.com/oauth/authorize?client_id=...&scope=...&redirect_uri=...` |
| State storage | Redis hash `gw:oauth:state:{state}`, TTL 600s | Standard — no changes needed |
| Callback processing | `connections.ts:182-444` → `providerDef.oauth.processCallback()` | Token URL: `https://api.hubapi.com/oauth/v1/token` (POST with code, grant_type, redirect_uri) |
| Token storage | `writeTokenRecord()` → `gwTokens`, AES-256-GCM | Access token (short-lived, ~6h) + refresh token (long-lived) |
| Token refresh | `updateTokenRecord()` in `getActiveTokenForInstallation()` | Standard `refresh_token` grant to `https://api.hubapi.com/oauth/v1/token` |

**Required OAuth scopes:**
```
crm.objects.contacts.read
crm.objects.companies.read
crm.objects.deals.read
crm.objects.deals.write
tickets
crm.objects.owners.read
crm.pipelines.orders.read
sales-email-read
oauth
```

**Token TTL behavior**: HubSpot access token `expires_in` field should be used for `expiresAt` computation. `writeTokenRecord()` at `apps/gateway/src/lib/token-store.ts:12-48` already handles `expiresIn` → `expiresAt` conversion. Gateway auto-refreshes when `expiresAt < now`.

**Proxy execute for API callback after minimal webhook**: HubSpot webhooks carry only `objectId` + changed property — the consumer must call back to `GET /crm/v3/objects/{type}/{objectId}` to get full record state. The proxy endpoint at `connections.ts:741-880` (`POST /connections/:id/proxy/execute`) handles this: the Console ingress workflow calls `gw.executeApi(installationId, { endpointId: "getContact", pathParams: { objectId } })`.

**`buildAuthHeader` for HubSpot**: Standard `Bearer ${token}` — no custom implementation needed. The proxy execute falls back to `Bearer ${token}` when `providerDef.api.buildAuthHeader` is undefined (`connections.ts:827-829`).

**Webhook subscription management**: HubSpot webhooks are configured at the **app level** via the developer API key, not per-installation OAuth token. This is different from existing providers where webhooks are set up on the provider's side during app registration. The `gwResources` table and resource registration flow (`POST /connections/:id/resources`) would handle per-installation resource tracking, but the webhook subscription itself is configured once at the HubSpot app level.

---

### 6. Validation Schemas — What Needs to Change

| Schema | File | Status for HubSpot |
|---|---|---|
| `sourceTypeSchema` | `registry.ts:46-48` | Auto-updated when `"hubspot"` is added to `PROVIDERS` |
| `PostTransformEvent` | `post-transform-event.ts:29-47` | No changes — `entityType` and `provider` are open strings |
| `entityCategorySchema` | `entities.ts:9-24` | Needs new members: `"contact"`, `"deal"`, `"ticket"`, `"company"` |
| `observationVectorMetadataSchema` | `neural.ts:14-29` | No changes — `source`, `observationType` are open strings |
| `entityVectorMetadataSchema` | `neural.ts:62-79` | No changes — `provider`, `entityType` are open strings |
| `classificationResponseSchema` | `classification.ts:33-55` | No changes — HubSpot events classify into existing 14-category enum |
| `SearchRequestSchema` / `SearchResponseSchema` | `api/search.ts:9-37` | No changes — source filtering uses open strings |
| `WorkflowIO` schemas | `workflow-io.ts:32-121` | No changes for webhook path; backfill orchestrator schema accepts `"hubspot"` once added to `sourceTypeSchema` |

**The `entityCategorySchema` change is the only required schema extension.** Adding CRM types to the structural set (or as a new third set) determines whether HubSpot entities participate in graph edge co-occurrence resolution.

---

## Architecture: How HubSpot Fits

```
HubSpot App Webhook → POST /webhooks/hubspot
    ↓
[Current relay middleware chain — HMAC verification (SHA-256, base64) + timestamp check]
    ↓
[GAP: parsePayload returns array → fan-out needed]
    ↓ (after fan-out resolution)
N × Upstash Workflow instances → N × QStash messages → N × console ingress calls
    ↓
Console ingress: transformHubSpotEvent() → PostTransformEvent
    ↓
workspaceIngestLog → Inngest event.capture
    ↓
eventStore: dedup (sourceId) → significance (weight) → entityExtract → workspaceEvents
    ↓  (needs API callback to get full record — HubSpot payload is minimal)
entityGraph → workspaceEdges
entityEmbed → Pinecone layer="entities"
eventInterpret → Pinecone layer="observations"
```

```
HubSpot Backfill → GET /crm/v3/objects/{type} (cursor-based)
    ↓
Gateway proxy execute (OAuth token auto-refreshed)
    ↓
BackfillEntityHandler.processResponse() → events[]
    ↓
relay dispatchWebhook (one POST per event) → same ingress path above
```

---

## Open Questions

1. **Batch fan-out approach**: Does HubSpot's `parsePayload` return an array that the relay handler loops over (requiring changes to `WebhookDef` interface and middleware), or does the relay handler stay as-is and fan-out happens by having the HubSpot provider iterate the batch in a custom handler? The backfill service precedent (fan-out in the caller) suggests the latter is the existing pattern.

2. **HMAC base64 vs hex**: HubSpot v3 signature is base64-encoded, while `computeHmac` at `crypto.ts:14-21` returns hex. A utility wrapper or new function is needed.

3. **CRM entity types in `entityCategorySchema`**: Should `contact`, `deal`, `ticket`, `company` be structural types (participating in graph edge resolution) or a new third category? The co-occurrence algorithm in `resolveEdges()` at `entity-graph.ts` only runs on structural types.

4. **Webhook subscription management**: HubSpot webhooks are app-level, not per-installation. The gateway connection lifecycle doesn't currently have a hook to configure webhook subscriptions on installation. GitHub App webhooks work differently (they're configured at the GitHub App level during registration), so this is analogous.

5. **`portalId` as the resource identifier**: HubSpot's `portalId` maps to `resourceId` in the relay. The `gwResources` table would hold one row per HubSpot portal. The `extractResourceId(payload)` function in `WebhookDef` reads `portalId` from the first event in the batch array.

---

## Code References

- `packages/console-providers/src/post-transform-event.ts:29-47` — `PostTransformEvent` schema
- `packages/console-providers/src/define.ts:78-95` — `WebhookDef` interface (single-event assumptions)
- `packages/console-providers/src/define.ts:275-327` — `ProviderDefinition` interface
- `packages/console-providers/src/define.ts:337` — `defineProvider()` factory
- `packages/console-providers/src/registry.ts:27-48` — `PROVIDERS` map and `sourceTypeSchema`
- `packages/console-providers/src/crypto.ts:14-21` — `computeHmac` (returns hex)
- `packages/console-providers/src/gateway.ts:32-41` — `WebhookReceiptPayload` schema
- `packages/console-providers/src/gateway.ts:48-65` — `WebhookEnvelope` schema
- `packages/console-validation/src/schemas/entities.ts:9-24` — `entityCategorySchema`
- `packages/console-validation/src/schemas/neural.ts:14-79` — Pinecone metadata schemas
- `apps/relay/src/routes/webhooks.ts:45-165` — relay handler (standard + service auth paths)
- `apps/relay/src/routes/workflows.ts:39-228` — Upstash Workflow (dedup, persist, QStash)
- `apps/relay/src/middleware/webhook.ts:25-286` — middleware chain + `payloadParseAndExtract`
- `apps/relay/src/lib/cache.ts:16-17` — `webhookSeenKey` pattern
- `apps/gateway/src/routes/connections.ts:61-116` — OAuth authorization URL construction
- `apps/gateway/src/routes/connections.ts:182-444` — OAuth callback + token exchange
- `apps/gateway/src/routes/connections.ts:741-880` — proxy execute (API callback for full record)
- `apps/gateway/src/lib/token-store.ts:12-48` — `writeTokenRecord` (encrypted token vault)
- `apps/gateway/src/workflows/connection-teardown.ts:34-139` — durable teardown workflow
- `db/console/src/schema/tables/workspace-events.ts` — canonical event store schema
- `db/console/src/schema/tables/workspace-entities.ts` — entity dedup schema
- `db/console/src/schema/tables/gw-tokens.ts` — AES-256-GCM token storage
- `db/console/src/schema/tables/gw-webhook-deliveries.ts:35-38` — unique index `(provider, delivery_id)`
- `api/console/src/inngest/workflow/neural/event-store.ts:52-58` — `STRUCTURAL_TYPES` set
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — `resolveEdges()` algorithm
- `api/console/src/inngest/workflow/neural/scoring.ts:23` — significance threshold (40)
- `api/console/src/router/org/search.ts:129-148` — search router (queries `layer="entities"`)

---

## Follow-up Research: HubSpot Edge Rules

### How EdgeRule Works (Existing Pattern)

`EdgeRule` is defined at `packages/console-providers/src/types.ts:59-72`:

```ts
interface EdgeRule {
  confidence:       number;   // 0.0–1.0, written to workspaceEdges.confidence
  matchProvider:    string;   // provider of the OTHER event, or "*" for any provider
  matchRefType:     string;   // entity category on the OTHER event
  refType:          string;   // entity category on THIS event
  relationshipType: string;   // stored in workspaceEdges.relationship_type
  selfLabel?:       string;   // optional: only match when THIS entity's refLabel === this value
}
```

**The co-occurrence algorithm** (`entity-graph.ts`, `edge-resolver.ts:26`):
1. Filters entity refs to `STRUCTURAL_TYPES = ["commit", "branch", "pr", "issue", "deployment"]` — entities outside this set are excluded from graph resolution entirely
2. Finds events that previously touched the same entities (up to 100 co-events)
3. For every `(ourEntity, theirEntity)` pair across those events, calls `findBestRule()` against both providers' `edgeRules` arrays
4. Priority: selfLabel+exact provider > selfLabel+wildcard > no-label+exact provider > no-label+wildcard
5. Inserts winning candidates into `workspaceEdges` with `onConflictDoNothing` (unique on `(workspaceId, sourceEntityId, targetEntityId, relationshipType)`)

**Critical constraint**: `resolveEdges()` only runs on structural entity types. HubSpot CRM types (`contact`, `deal`, `ticket`, `company`) would need to be added to `STRUCTURAL_TYPES` in `event-store.ts:52-58` (derived from `entityCategorySchema`) for HubSpot entities to participate in graph resolution at all.

**Existing `relationshipType` values in use**: `"deploys"` (GitHub↔Vercel), `"fixes"` (GitHub issue→issue with `selfLabel`), `"references"` (GitHub and Linear issue→issue generic).

### HubSpot Intra-CRM Edge Rules

Within HubSpot itself, the CRM natively expresses associations: Contact↔Company, Contact↔Deal, Company↔Deal, Contact↔Ticket. The co-occurrence algorithm can detect these IF the HubSpot transformer emits related entities in `relations[]` with the right `entityId` format.

For a deal `propertyChange` webhook, the transformer would emit:
- Primary entity: `{ entityType: "deal", entityId: "{portalId}/{objectId}" }`
- Relations: `[ { entityType: "company", entityId: "{portalId}/{companyId}", relationshipType: "owned_by" } ]`

These relations get upserted into `workspaceEntities` and linked via `workspaceEntityEvents`. When a company event later arrives (also touching `{portalId}/{companyId}`), the co-occurrence algorithm fires and evaluates HubSpot's edge rules.

**Proposed HubSpot `edgeRules`** (intra-CRM):

| `refType` | `selfLabel` | `matchProvider` | `matchRefType` | `relationshipType` | `confidence` |
|---|---|---|---|---|---|
| `deal` | `"owned_by"` | `hubspot` | `company` | `deal_owned_by_company` | 1.0 |
| `deal` | `"associated_contact"` | `hubspot` | `contact` | `deal_has_contact` | 1.0 |
| `ticket` | `"owned_by"` | `hubspot` | `company` | `ticket_owned_by_company` | 1.0 |
| `ticket` | `"associated_contact"` | `hubspot` | `contact` | `ticket_has_contact` | 1.0 |
| `contact` | (none) | `hubspot` | `company` | `contact_works_at` | 0.9 |

The `selfLabel` values come from the `refLabel` written to `workspaceEntityEvents` by `event-store.ts`. For HubSpot, the transformer would set `relation.relationshipType` to `"owned_by"` / `"associated_contact"`, and `event-store.ts:449` would write that as `refLabel` on the junction row for structural entity types.

### Cross-Provider Edge Rules

The API research identifies these high-value cross-provider links:

| Link | From | To | Signal |
|---|---|---|---|
| Customer↔Error | `hubspot:company` (by domain) | `sentry:issue` | Customer experiencing errors → churn risk |
| Deal↔Ticket | `hubspot:deal` | `hubspot:ticket` | Support issues during deal → deal risk |
| Customer↔PR | `hubspot:company` (by domain) | `github:pr` (by contributor email domain) | Customer contributing → expansion signal |

**Critical limitation of the current algorithm**: Cross-provider edges only form when two events share the **same entity key** (same `(category, key)` in `workspaceEntities`). Domain-based matching (hubspot company domain ↔ sentry org) is **not supported** by `resolveEdges()` — it uses `WHERE category = $1 AND key = $2` equality, not substring or domain join.

For the `hubspot:company ↔ sentry:issue` cross-provider link to work via the existing algorithm, both providers' transformers would need to emit an entity with the same `key` value — e.g., both using the company's internet domain as the entity key for a `"company"` category entity. If GitHub emits `{ category: "company", key: "acme.com" }` in its relations and HubSpot emits `{ category: "company", key: "acme.com" }` (from the company's domain field), the co-occurrence algorithm would fire.

**Proposed cross-provider edge rules for HubSpot** (domain-key strategy):

```ts
// In hubspot/index.ts edgeRules
{ refType: "company", selfLabel: undefined, matchProvider: "sentry",  matchRefType: "company", relationshipType: "customer_has_errors",  confidence: 0.85 },
{ refType: "company", selfLabel: undefined, matchProvider: "github",  matchRefType: "company", relationshipType: "customer_contributes", confidence: 0.85 },
{ refType: "deal",    selfLabel: undefined, matchProvider: "hubspot", matchRefType: "ticket",  relationshipType: "deal_at_risk",        confidence: 0.95 },
```

```ts
// In sentry/index.ts edgeRules (mirror side)
{ refType: "company", selfLabel: undefined, matchProvider: "hubspot", matchRefType: "company", relationshipType: "customer_has_errors",  confidence: 0.85 },
```

**This requires**: both providers' transformers emit a `company` entity in `relations[]` keyed on the internet domain (e.g., `key: "acme.com"`), and `"company"` is added to `STRUCTURAL_TYPES` in `event-store.ts:52-58`.

### What `STRUCTURAL_TYPES` Would Need to Include

Current set at `event-store.ts:52-58`:
```ts
const STRUCTURAL_TYPES = new Set(["commit", "branch", "pr", "issue", "deployment"]);
```

For HubSpot CRM edges to form, the following additions are needed:

```ts
const STRUCTURAL_TYPES = new Set([
  // Existing engineering types
  "commit", "branch", "pr", "issue", "deployment",
  // HubSpot CRM types
  "contact", "deal", "ticket", "company",
]);
```

This is also a change to `entityCategorySchema` in `packages/console-validation/src/schemas/entities.ts:9-24`, which the `STRUCTURAL_TYPES` set is derived from.

### Summary Table: All HubSpot Edges

| Source Entity | Label | Co-event Provider | Target Entity | `relationshipType` | Confidence |
|---|---|---|---|---|---|
| `deal` | `owned_by` | `hubspot` | `company` | `deal_owned_by_company` | 1.0 |
| `deal` | `associated_contact` | `hubspot` | `contact` | `deal_has_contact` | 1.0 |
| `ticket` | `owned_by` | `hubspot` | `company` | `ticket_owned_by_company` | 1.0 |
| `ticket` | `associated_contact` | `hubspot` | `contact` | `ticket_has_contact` | 1.0 |
| `contact` | (any) | `hubspot` | `company` | `contact_works_at` | 0.9 |
| `company` | (any) | `sentry` | `company` | `customer_has_errors` | 0.85 |
| `company` | (any) | `github` | `company` | `customer_contributes` | 0.85 |
| `deal` | (any) | `hubspot` | `ticket` | `deal_at_risk` | 0.95 |

### Key File References for Edge Rules

- `packages/console-providers/src/types.ts:59-72` — `EdgeRule` interface
- `packages/console-providers/src/define.ts:311` — `edgeRules` on `ProviderDefinition`
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — `resolveEdges()` algorithm
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:249-291` — `findBestRule()` priority logic
- `api/console/src/inngest/workflow/neural/entity-graph.ts:15` — `entityGraph` Inngest function
- `api/console/src/inngest/workflow/neural/event-store.ts:52-58` — `STRUCTURAL_TYPES` set (gating entity types for graph resolution)
- `packages/console-providers/src/providers/github/index.ts:343-369` — GitHub edge rules (3 rules: deploys, fixes, references)
- `packages/console-providers/src/providers/linear/index.ts:293-302` — Linear edge rules (1 rule: references)
- `packages/console-providers/src/providers/vercel/index.ts:173-182` — Vercel edge rules (1 rule: deploys)
- `packages/console-providers/src/providers/sentry/index.ts:193` — Sentry edge rules (empty array)
- `packages/console-validation/src/schemas/entities.ts:9-24` — `entityCategorySchema` (needs CRM types added)
- `db/console/src/schema/tables/workspace-edges.ts:75-80` — unique constraint on `(workspaceId, sourceEntityId, targetEntityId, relationshipType)`

---

## Related Research

- `thoughts/shared/research/2026-03-14-web-analysis-apollo-hubspot-providers.md` — HubSpot API documentation (auth, webhooks, rate limits, resource schemas)
- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — pipeline architecture design
