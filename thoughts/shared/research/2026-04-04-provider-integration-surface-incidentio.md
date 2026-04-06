---
date: "2026-04-04T18:00:00+08:00"
researcher: claude
git_commit: fa1b286aa7e05f9dafbcd8081e720eecf4f1b7cd
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Provider Integration Surface for incident.io"
tags: [research, codebase, providers, incident-io, app-providers, integration]
status: complete
last_updated: "2026-04-04"
---

# Research: Provider Integration Surface for incident.io

**Date**: 2026-04-04T18:00:00+08:00
**Git Commit**: fa1b286aa
**Branch**: refactor/drop-workspace-abstraction

## Research Question

Document the full provider integration surface in `@repo/app-providers` to understand how providers are structured, registered, and consumed — as a foundation for adding incident.io as a new provider.

## Summary

Lightfast's provider system is a 3-tier architecture (`WebhookProvider`, `ManagedProvider`, `ApiProvider`) with a factory pattern, compile-time completeness checks, and 14 distinct runtime consumer surfaces. Each provider is a self-contained directory of 6 files following a strict convention. Adding a new provider requires changes to ~12 files in `app-providers` plus a post-connect page in the app. The platform service consumes providers generically via the `PROVIDERS` registry — no platform code changes are needed for a new provider.

---

## Detailed Findings

### 1. Provider Type Architecture

Three provider tiers exist, discriminated by `kind`:

| Tier | Kind | Auth | Webhooks | Examples |
|------|------|------|----------|----------|
| **WebhookProvider** | `"webhook"` | OAuth, App-token | Native signed POST | GitHub, Linear, Sentry, Vercel |
| **ManagedProvider** | `"managed"` | OAuth, API-key | Programmatic register/unregister | (Future: HubSpot, Stripe) |
| **ApiProvider** | `"api"` | OAuth, API-key | None (optional inbound) | Apollo |

All three extend `BaseProviderFields` (`provider/shape.ts:18`) which mandates:

```
accountInfoSchema    — Zod schema, discriminated by sourceType literal
api                  — ProviderApi (baseUrl, endpoints record, parseRateLimit)
buildProviderConfig  — builds JSONB blob for orgIntegrations
categories           — Record<string, CategoryDef> (label, description, type)
configSchema         — Zod schema for runtime config (TConfig)
createConfig         — (env, runtime) => TConfig | null
defaultSyncEvents    — subset of category keys
deriveObservationType — maps sourceType to observation type
edgeRules?           — declarative entity relationship rules
env / envSchema      — environment variable schemas
events               — Record<string, EventDefinition>
getBaseEventType     — maps detailed event type to category key
healthCheck?         — optional connection health probe
providerConfigSchema — Zod schema discriminated by provider literal
resolveCategory      — maps wire eventType to events key
resourcePicker       — UI resource picker (enrichInstallation, listResources)
```

**Factories**: `defineWebhookProvider()`, `defineManagedProvider()`, `defineApiProvider()` — each injects the `kind` discriminant and a lazy `env` getter, then freezes the result.

### 2. Auth Strategies

Three auth interfaces in `provider/auth.ts`, discriminated by `kind`:

**OAuthDef** (`kind: "oauth"`) — used by Linear, Sentry, Vercel:
- `buildAuthUrl(config, state)` — constructs provider's OAuth authorize URL
- `exchangeCode(config, code, redirectUri)` — token exchange
- `refreshToken(config, refreshToken)` — token refresh
- `revokeToken(config, accessToken)` — token revocation
- `getActiveToken(config, storedExternalId, storedAccessToken)` — returns stored token
- `processCallback(config, query)` — handles OAuth callback, returns `CallbackResult`
- `usesStoredToken: true`

**ApiKeyDef** (`kind: "api-key"`) — used by Apollo:
- `processSetup(config, { apiKey })` — validates and stores API key
- `buildAuthHeader(apiKey)` — constructs Authorization header
- `getActiveToken(config, storedExternalId, storedAccessToken)` — returns stored key
- `usesStoredToken: true`

**AppTokenDef** (`kind: "app-token"`) — used by GitHub:
- `buildInstallUrl(config, state)` — GitHub App install URL
- `getActiveToken(config, storedExternalId, null)` — generates per-installation token on demand
- `processCallback(config, query)` — handles installation callback
- `usesStoredToken: false`

### 3. Per-Provider File Anatomy (Linear as exemplar)

Each provider lives in `packages/app-providers/src/providers/<name>/` with this structure:

#### `auth.ts` — Config and Account Info Schemas
- `linearConfigSchema` — runtime config shape (clientId, clientSecret, webhookSigningSecret, callbackBaseUrl)
- `linearAccountInfoSchema` — per-installation metadata stored in DB (version, sourceType literal, events, timestamps, raw OAuth metadata). Display data (org name) is NOT stored here — resolved live.
- `linearProviderConfigSchema` — per-resource JSONB blob (provider literal, type, sync settings)
- `linearOAuthResponseSchema` — raw token exchange response shape

#### `api.ts` — API Endpoint Catalog
- `linearApi` satisfies `ProviderApi`: `baseUrl: "https://api.linear.app"`, one `graphql` POST endpoint
- `parseLinearRateLimit(headers)` — extracts rate limit from response headers
- Response schemas for different GraphQL query shapes (viewer org, teams)

#### `schemas.ts` — Webhook Payload Schemas
- Entity schemas (Issue with 31 fields, Comment, Project, Cycle, ProjectUpdate)
- `linearWebhookBaseSchema` — common webhook envelope (action, createdAt, organizationId, webhookId)
- Five `preTransform*` schemas — extend base with specific `type` literal + typed `data` field
- `linearWebhookPayloadSchema` — loose passthrough schema for ingestion-level routing

#### `transformers.ts` — Transform to PostTransformEvent
- Five transform functions, one per entity type
- Shared pattern: builds `relations[]`, `bodyParts[]`, `attributes{}`, then validates via `validatePostTransformEvent`
- `ACTION_SUFFIX` map: `create→created`, `update→updated`, `remove→deleted`
- `sourceId` format: `"linear:{entityType}:{entityId}:{eventType}"`

#### `backfill.ts` — Historical Data Import
- `linearBackfill` satisfies `BackfillDef`
- `resolveResourceMeta` — live GraphQL call to get current team name
- Three entity handlers (Issue, Comment, Project), each using `typedEntityHandler<string>` (cursor = endCursor string)
- GraphQL queries paginate 50 items per page, filtered by teamId + updatedAt > since
- Adapter functions fill placeholder values for fields not present in GraphQL responses, producing `PreTransform*`-shaped objects reusable by the same transformers

#### `index.ts` — Assembled Provider Definition
- Calls `defineWebhookProvider({...})` with all fields assembled
- OAuth auth block with `buildAuthUrl`, `exchangeCode`, `refreshToken`, `revokeToken`, `processCallback`
- Webhook block with HMAC sha256 signature verification, event type extraction (`"Issue:create"`), delivery ID from header or stable fingerprint
- Resource picker: `installationMode: "merged"`, lists Linear teams
- Categories: Issue, Comment, IssueLabel, Project, Cycle, ProjectUpdate
- Events: Issue, Comment, Project, Cycle, ProjectUpdate (each with created/updated/deleted actions)
- Edge rules: issue→issue references with confidence 0.8
- Health check: viewer query, returns "healthy" or "revoked"

### 4. Registration Touchpoints (in order of dependency)

Adding a new provider requires changes to these files in `app-providers`:

| # | File | Change |
|---|------|--------|
| 1 | `client/display.ts:15` | Add slug to `providerSlugSchema` enum |
| 2 | `client/display.ts:41` | Add entry to `PROVIDER_DISPLAY` (name, displayName, description, icon, comingSoon?) |
| 3 | `client/categories.ts` | Add provider's categories to `PROVIDER_CATEGORIES` |
| 4 | `client/event-labels.ts` | Add event labels to `EVENT_LABELS` (enforced by sync test) |
| 5 | `providers/<name>/auth.ts` | Create config, account info, provider config schemas |
| 6 | `providers/<name>/api.ts` | Create API endpoint catalog + rate limit parser |
| 7 | `providers/<name>/schemas.ts` | Create webhook payload Zod schemas |
| 8 | `providers/<name>/transformers.ts` | Create transform functions → PostTransformEvent |
| 9 | `providers/<name>/backfill.ts` | Create backfill entity handlers |
| 10 | `providers/<name>/index.ts` | Assemble via factory function |
| 11 | `registry.ts:10-14` | Import provider |
| 12 | `registry.ts:20-26` | Add to `PROVIDERS` map |
| 13 | `registry.ts:209-215` | Add to `ProviderApiCatalog` interface |
| 14 | `index.ts` | Add re-exports |

**Compile-time enforcement**: `registry.ts:40-57` — type `_AssertDisplayComplete` errors if a live (non-comingSoon) display entry has no `PROVIDERS` implementation.

### 5. Platform Consumer Surfaces (No Changes Needed)

The platform consumes providers generically via `getProvider(slug)` and the `PROVIDERS` registry. All 14 surfaces are provider-agnostic:

1. **Webhook ingestion** (`apps/platform/src/app/api/ingest/[provider]/route.ts`) — validates headers → verifies signature → extracts event → dispatches to Inngest
2. **Event transformation** (`api/platform/src/lib/transform.ts` → `runtime/dispatch.ts`) — `resolveCategory` → `schema.parse` → `transform()`
3. **Backfill orchestrator** (`api/platform/src/inngest/functions/memory-backfill-orchestrator.ts`) — reads `backfill.defaultEntityTypes`, calls `resolveResourceMeta`, fans out entity workers
4. **Entity worker** (`api/platform/src/inngest/functions/memory-entity-worker.ts`) — calls `entityHandler.buildRequest` → fetch → `processResponse` → dispatches synthetic webhook events
5. **Proxy execution** (`api/platform/src/router/memory/proxy.ts`) — resolves endpoint from `api.endpoints`, handles auth, 401 retry
6. **OAuth authorize** (`api/platform/src/lib/oauth/authorize.ts`) — branches on `auth.kind` → `buildAuthUrl` or `buildInstallUrl`
7. **OAuth callback** (`api/platform/src/lib/oauth/callback.ts`) — `auth.processCallback` → upsert installation → write tokens
8. **Token resolution** (`api/platform/src/lib/token-helpers.ts`) — `auth.getActiveToken` or `auth.refreshToken`
9. **Health check cron** — `healthCheck.check()` every 5 minutes
10. **Connection lifecycle** — `auth.revokeToken` on teardown
11. **Resource picker** (in `api/app`) — `resourcePicker.enrichInstallation` + `listResources`
12. **Bulk link** — `buildProviderConfig` + `getDefaultSyncEvents`
13. **Proxy search** (`apps/app/src/lib/proxy.ts`) — enumerates `api.endpoints` for AI tool
14. **Backfill estimate** — probes page 1 of each entity type via entity handlers

### 6. Contract and Validation Layer

**Cross-service contracts** (`packages/app-providers/src/contracts/`):
- `wire.ts` — `webhookReceiptPayloadSchema` (ingest route → Inngest), `webhookEnvelopeSchema` (internal)
- `event.ts` — `postTransformEventSchema` (canonical output: deliveryId, sourceId, provider, eventType, entity, relations, title, body, attributes)
- `backfill.ts` — `backfillTriggerPayload`, `backfillEstimatePayload`
- `gateway.ts` — response shapes for connection/backfill APIs

**Validation** (`packages/app-validation/`) — imports `providerSlugSchema` from `@repo/app-providers/client` for workflow I/O schemas. Does not own provider-specific logic.

**API contract** (`packages/app-api-contract/`) — 3 oRPC routes (`/v1/search`, `/v1/proxy/search`, `/v1/proxy/execute`). Provider identity flows through `installationId` — no slug-gated routes.

### 7. External Touchpoints

Beyond the `app-providers` package, these need updating for a fully integrated provider:

| Area | Files | What |
|------|-------|------|
| **App post-connect page** | `apps/app/src/app/(providers)/provider/<name>/connected/page.tsx` | Static callback landing page |
| **Docs** | `apps/www/src/content/docs/connectors/<name>.mdx` | Connector documentation |
| **Docs meta** | `apps/www/src/content/docs/connectors/meta.json` | Add to connector index |
| **Env vars** | `apps/platform/.vercel/.env.development.local` | Provider credentials |
| **Marketing** (optional) | `apps/www/src/app/(app)/_components/integration-showcase.tsx` | Landing page showcase |

**No DB schema changes needed** — provider slugs are stored as freeform strings in all tables (`org_integrations`, `gateway_installations`, `gateway_backfill_runs`, `gateway_webhook_deliveries`, `org_events`, `org_ingest_logs`).

### 8. Signature Verification

Two schemes available via `provider/webhook.ts`:

- **HMAC** (`hmac()` factory) — `sha256` or `sha1`, reads signature from specified header, optional prefix strip. Used by Linear, GitHub, Sentry.
- **Ed25519** (`ed25519()` factory) — reads signature from specified header, optional `timestampHeader` for message prepend, optional `multiSignature` for Svix-style space-separated base64 sigs. Used by Vercel.

The platform auto-derives the `verifySignature` function from `signatureScheme` via `deriveVerifySignature()` — providers only need to declare the scheme, not implement verification.

### 9. Event System

Two event definition factories in `provider/events.ts`:
- `simpleEvent({label, weight, schema, transform})` — no sub-actions (e.g., Vercel deployments)
- `actionEvent({label, weight, schema, transform, actions})` — with sub-actions like `created/updated/deleted` (e.g., Linear issues)

Event keys are derived at the type level as `"provider:eventCategory"` or `"provider:eventCategory.action"`. The runtime `EVENT_REGISTRY` is auto-built from provider definitions — no separate registration needed.

`EVENT_LABELS` in `client/event-labels.ts` must stay in sync — enforced by `client/event-labels-sync.test.ts`.

---

## Code References

### Type System
- `packages/app-providers/src/provider/shape.ts:18` — BaseProviderFields interface
- `packages/app-providers/src/provider/shape.ts:76` — WebhookProvider interface
- `packages/app-providers/src/provider/shape.ts:117` — ManagedProvider interface
- `packages/app-providers/src/provider/shape.ts:152` — ApiProvider interface
- `packages/app-providers/src/provider/auth.ts:8` — OAuthDef interface
- `packages/app-providers/src/provider/auth.ts:43` — ApiKeyDef interface
- `packages/app-providers/src/provider/auth.ts:79` — AppTokenDef interface
- `packages/app-providers/src/provider/backfill.ts:94` — BackfillDef interface
- `packages/app-providers/src/provider/webhook.ts:56` — WebhookDef interface
- `packages/app-providers/src/provider/events.ts:7` — SimpleEventDef interface
- `packages/app-providers/src/provider/events.ts:20` — ActionEventDef interface
- `packages/app-providers/src/provider/api.ts:62` — ApiEndpoint interface
- `packages/app-providers/src/provider/api.ts:86` — ProviderApi interface
- `packages/app-providers/src/provider/resource-picker.ts:33` — ResourcePickerDef interface

### Registration
- `packages/app-providers/src/client/display.ts:15` — providerSlugSchema (canonical slug enum)
- `packages/app-providers/src/client/display.ts:41` — PROVIDER_DISPLAY metadata
- `packages/app-providers/src/registry.ts:20-26` — PROVIDERS map
- `packages/app-providers/src/registry.ts:40-57` — compile-time display completeness check
- `packages/app-providers/src/registry.ts:99-126` — EVENT_REGISTRY auto-derivation
- `packages/app-providers/src/registry.ts:209-215` — ProviderApiCatalog (manual, must update)

### Factories
- `packages/app-providers/src/factory/webhook.ts:17` — defineWebhookProvider
- `packages/app-providers/src/factory/managed.ts` — defineManagedProvider
- `packages/app-providers/src/factory/api.ts` — defineApiProvider

### Runtime
- `packages/app-providers/src/runtime/dispatch.ts:15` — transformWebhookPayload
- `packages/app-providers/src/runtime/verify/index.ts:7` — deriveVerifySignature
- `packages/app-providers/src/runtime/validation.ts:25` — validatePostTransformEvent
- `packages/app-providers/src/runtime/event-norm.ts:21` — getBaseEventType

### Linear Provider (reference implementation)
- `packages/app-providers/src/providers/linear/index.ts:154` — provider definition
- `packages/app-providers/src/providers/linear/auth.ts` — OAuth config schemas
- `packages/app-providers/src/providers/linear/api.ts:82` — linearApi endpoint catalog
- `packages/app-providers/src/providers/linear/schemas.ts` — webhook payload schemas
- `packages/app-providers/src/providers/linear/transformers.ts:26` — transformLinearIssue (and 4 others)
- `packages/app-providers/src/providers/linear/backfill.ts:381` — linearBackfill definition

### Platform Consumers
- `apps/platform/src/app/api/ingest/[provider]/route.ts` — webhook ingestion
- `api/platform/src/lib/provider-configs.ts:14` — provider config initialization
- `api/platform/src/lib/oauth/authorize.ts:59` — OAuth authorize flow
- `api/platform/src/lib/oauth/callback.ts:157` — OAuth callback flow
- `api/platform/src/lib/token-helpers.ts:13` — token resolution
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts` — backfill orchestration
- `api/platform/src/inngest/functions/memory-entity-worker.ts` — entity worker
- `api/platform/src/router/memory/proxy.ts` — proxy execution
- `api/app/src/router/org/connections.ts:631` — resource picker consumption

---

## Architecture Documentation

### Provider Registration Flow
```
1. Add slug to providerSlugSchema (client/display.ts)
2. Add display entry to PROVIDER_DISPLAY (client/display.ts)
3. Create provider directory with 6 files (providers/<name>/)
4. Import and add to PROVIDERS map (registry.ts)
5. Add to ProviderApiCatalog interface (registry.ts)
6. Add re-exports (index.ts)
7. Add categories (client/categories.ts)
8. Add event labels (client/event-labels.ts) — enforced by test

Compile-time checks catch:
- Missing PROVIDERS entry for live display slug
- Missing ProviderApiCatalog entry (type error on EndpointKey)
- Missing EVENT_LABELS entries (test failure)
```

### Data Flow: Webhook → Storage
```
POST /api/ingest/:provider
  → getProvider(slug) → hasInboundWebhooks()
  → webhookDef.headersSchema.safeParse(headers)
  → deriveVerifySignature(scheme)(rawBody, headers, secret)
  → webhookDef.parsePayload(raw) → extractDeliveryId/EventType/ResourceId
  → DB insert (gatewayWebhookDeliveries)
  → Inngest: memory/webhook.received
    → transformWebhookPayload(provider, eventType, payload, context)
      → PROVIDERS[provider].resolveCategory(eventType) → category
      → events[category].schema.parse(payload)
      → events[category].transform(parsed, context, eventType)
    → sanitizePostTransformEvent(event)
    → DB insert (orgIngestLogs)
    → Inngest: memory/event.capture
```

### Data Flow: Backfill
```
backfill.trigger tRPC → Inngest: memory/backfill.run.requested
  → backfill.resolveResourceMeta({ providerResourceId, token })
  → For each (resource x entityType):
    → step.invoke(memoryEntityWorker)
      → entityHandler.buildRequest(ctx, cursor) → proxy request
      → fetch via api.endpoints[entityHandler.endpointId]
      → entityHandler.processResponse(data, ctx, cursor, headers)
      → Adapter → PreTransform* shape → same transform pipeline
      → Inngest: memory/webhook.received (batch)
```

### Data Flow: OAuth
```
UI → connections.getAuthorizeUrl tRPC
  → auth.buildAuthUrl(config, state) [or buildInstallUrl for app-token]
  → Redirect to provider

Provider callback → GET /api/connect/:provider/callback
  → auth.processCallback(config, query) → CallbackResult
  → gatewayInstallations UPSERT
  → writeTokenRecord(installation.id, tokens)
  → Redirect to post-connect page
```

---

## Open Questions

1. **Which provider tier fits incident.io?** — If incident.io supports OAuth + signed webhooks, `WebhookProvider` (like Linear). If it uses API keys + manual webhook setup, `ApiProvider` with optional `inbound` (like a Clerk-style setup).

2. **What entities does incident.io expose?** — Incidents, alerts, follow-ups, status pages? Each becomes a category + event definition + backfill entity handler.

3. **What is incident.io's webhook signature scheme?** — HMAC-SHA256 (most common) or Ed25519/Svix-style? This determines the `signatureScheme` declaration.

4. **Resource picker model** — What is the "resource" for incident.io? Linear uses teams, GitHub uses repositories, Sentry uses projects. For incident.io it might be organizations or specific incident feeds.
