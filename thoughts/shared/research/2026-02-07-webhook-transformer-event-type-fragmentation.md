---
date: 2026-02-07T17:30:00+08:00
researcher: claude
git_commit: bb3803000e97c565a3c4a86f6196fefe380f8d3a
branch: feat/realistic-sandbox-test-data
repository: lightfastai/lightfast
topic: "Webhook transformer and event type code fragmentation across three packages"
tags: [research, codebase, console-webhooks, console-test-data, console-types, console-validation, transformers, event-mapping, SourceEvent, InternalEventType]
status: complete
last_updated: 2026-02-07
last_updated_by: claude
---

# Research: Webhook Transformer and Event Type Fragmentation

**Date**: 2026-02-07T17:30:00+08:00
**Researcher**: claude
**Git Commit**: bb3803000e97c565a3c4a86f6196fefe380f8d3a
**Branch**: feat/realistic-sandbox-test-data
**Repository**: lightfastai/lightfast

## Research Question

Map the current fragmentation of webhook transformer and event type code across three packages (`console-webhooks`, `console-test-data`, `console-types`) and document the dependency graph, transformer contracts, event type coverage, event-mapping gaps, downstream impacts, and the SourceType registry to inform a single-source-of-truth consolidation.

## Summary

The webhook transformer system spans 4 packages with different levels of maturity. A prior plan ("Definitive Links", `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md`) already described promoting Linear/Sentry transformers to `console-webhooks` — and **Phase 1 of that plan has been executed**: `console-webhooks/src/transformers/` now contains production-quality `linear.ts` and `sentry.ts` with validation and sanitization. However, the original mock transformers in `console-test-data` still exist and are still imported by the test-data loader (`transform.ts`). The `INTERNAL_EVENT_TYPES` registry in `console-types` only covers GitHub and Vercel event types — Sentry and Linear event types are unregistered, causing `getEventWeight()` to return the default weight (35) and `isInternalEventType()` to return false for all Sentry/Linear events. The `event-mapping.ts` module has no Sentry or Linear mappings, and the test-data loader bypasses it entirely.

## Detailed Findings

### 1. Current Architecture: Where Each Concern Lives

```
┌───────────────────────────────────────────────────────────────────────────┐
│ @repo/console-validation (foundation layer)                               │
│                                                                           │
│  schemas/sources.ts:23-28                                                 │
│  ├── sourceTypeSchema = z.enum(["github","vercel","linear","sentry"])     │
│  └── SourceType = "github" | "vercel" | "linear" | "sentry"              │
│                                                                           │
│  schemas/source-event.ts:52-62                                            │
│  └── sourceEventSchema (Zod runtime validation)                           │
└───────────────────────────────────────────────────────────────────────────┘
         ↑ imported by
┌───────────────────────────────────────────────────────────────────────────┐
│ @repo/console-types (type layer)                                          │
│                                                                           │
│  neural/source-event.ts:7-76                                              │
│  ├── SourceEvent interface                                                │
│  ├── SourceActor interface                                                │
│  ├── SourceReference interface (11 ref types)                             │
│  └── TransformContext { deliveryId, receivedAt }                          │
│                                                                           │
│  integrations/event-types.ts:25-87                                        │
│  ├── INTERNAL_EVENT_TYPES (GitHub: 13 types + Vercel: 5 types = 18 total) │
│  ├── InternalEventType (union of 18 keys)                                 │
│  ├── getEventWeight() → falls back to 35 for unknown types               │
│  ├── isInternalEventType() → false for Sentry/Linear types               │
│  └── getEventConfig() → only works for registered types                   │
│                                                                           │
│  integrations/events.ts                                                   │
│  ├── GITHUB_EVENTS (push, pull_request, issues, release, discussion)      │
│  └── VERCEL_EVENTS (5 deployment events)                                  │
└───────────────────────────────────────────────────────────────────────────┘
         ↑ imported by
┌───────────────────────────────────────────────────────────────────────────┐
│ @repo/console-webhooks (transformer + verification layer)                 │
│                                                                           │
│  transformers/github.ts    — 5 transformers (push, PR, issue, release,    │
│  │                           discussion) with validation + sanitization    │
│  transformers/vercel.ts    — 1 transformer (deployment) with validation   │
│  transformers/sentry.ts    — 4 transformers (issue, error, event_alert,   │
│  │                           metric_alert) ✅ PROMOTED with validation     │
│  transformers/linear.ts    — 5 transformers (issue, comment, project,     │
│  │                           cycle, project-update) ✅ PROMOTED            │
│  transformers/index.ts     — Re-exports all 4 source transformers         │
│                                                                           │
│  event-mapping.ts          — GITHUB_TO_INTERNAL (13 mappings)             │
│  │                           VERCEL_TO_INTERNAL (5 mappings)              │
│  │                           toInternalGitHubEvent()                       │
│  │                           toInternalVercelEvent()                       │
│  │                           ❌ No SENTRY_TO_INTERNAL                      │
│  │                           ❌ No LINEAR_TO_INTERNAL                      │
│                                                                           │
│  validation.ts             — validateSourceEvent() using Zod schema       │
│  sanitize.ts               — sanitizeTitle(), sanitizeBody()              │
│  storage.ts                — storeIngestionPayload() for raw payloads     │
│  github.ts / vercel.ts     — Signature verification                       │
│  linear.ts / sentry.ts     — Webhook type exports                         │
└───────────────────────────────────────────────────────────────────────────┘
         ↑ imported by
┌───────────────────────────────────────────────────────────────────────────┐
│ @repo/console-test-data (test data layer)                                 │
│                                                                           │
│  transformers/sentry.ts    — ❌ DUPLICATE of console-webhooks version      │
│  │                           (lacks validateSourceEvent + sanitize calls)  │
│  transformers/linear.ts    — ❌ DUPLICATE of console-webhooks version      │
│  │                           (lacks validateSourceEvent + sanitize calls)  │
│  transformers/index.ts     — Re-exports sentry/linear transformers        │
│                                                                           │
│  loader/transform.ts       — Routes webhooks to transformers              │
│  │  ├── GitHub/Vercel: imports from @repo/console-webhooks/transformers   │
│  │  └── Sentry/Linear: imports from ../transformers (local duplicates)    │
│  │  ❌ Does NOT use event-mapping.ts                                       │
│  │  ❌ Has its own routing logic via switch statements                     │
│  └── Adds :test: suffix to sourceId + testData metadata flag              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 2. Dependency Graph — All Import Chains

#### Who imports from `@repo/console-webhooks/transformers`
| Consumer | What's Imported |
|----------|----------------|
| `packages/console-test-data/src/loader/transform.ts:8-15` | `transformGitHubPush`, `transformGitHubPullRequest`, `transformGitHubIssue`, `transformGitHubRelease`, `transformGitHubDiscussion`, `transformVercelDeployment` |
| `packages/console-backfill/src/connectors/vercel.ts:8` | `transformVercelDeployment` |
| `packages/console-backfill/src/connectors/github.ts:12-16` | `transformGitHubPullRequest`, `transformGitHubIssue`, `transformGitHubRelease` |

#### Who imports from `@repo/console-webhooks` (main package)
| Consumer | What's Imported |
|----------|----------------|
| `apps/console/src/app/(github)/api/github/webhooks/route.ts` | Verification functions, all 5 GitHub transformers, storage utilities |
| `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` | Verification, `transformVercelDeployment`, `VercelWebhookPayload`, storage |
| `packages/console-test-data/src/loader/transform.ts:16-26` | `VercelWebhookPayload`, `VercelDeploymentEvent` types |
| `packages/console-backfill/src/adapters/vercel.ts:7-10` | `VercelWebhookPayload`, `VercelDeploymentEvent` types |

#### Who imports from `@repo/console-types` event types
| Consumer | What's Imported |
|----------|----------------|
| `packages/console-webhooks/src/event-mapping.ts:5` | `InternalEventType` (used in all mapping records) |
| `api/console/src/inngest/workflow/neural/scoring.ts:2,83` | `getEventWeight` (used in significance scoring) |

#### Who imports from `console-test-data/transformers` (local only)
| Consumer | What's Imported |
|----------|----------------|
| `packages/console-test-data/src/loader/transform.ts:27-29` | `sentryTransformers`, `linearTransformers`, `SentryEventType`, `LinearWebhookType` |

#### Who imports `SourceType` from `@repo/console-validation`
28 total import locations across: db schema (column types), `console-types` (SourceEvent interface, EventTypeConfig), `console-webhooks` (storage), `console-backfill` (registry), API workflows (sync orchestrator, document processing), and Inngest client event schemas.

### 3. Transformer Contract Comparison

#### Production Transformers (console-webhooks)
Signature pattern:
```typescript
function transformGitHubPush(
  payload: PushEvent,         // Typed webhook payload
  context: TransformContext   // { deliveryId, receivedAt }
): SourceEvent
```

Production transformers use:
- `toInternalGitHubEvent()` / `toInternalVercelEvent()` from `event-mapping.ts` to map `sourceType`
- `validateSourceEvent()` from `validation.ts` (logs errors but doesn't block)
- `sanitizeTitle()` / `sanitizeBody()` from `sanitize.ts`
- All produce the same `SourceEvent` shape

#### Promoted Sentry/Linear Transformers (console-webhooks)
The promoted versions in `console-webhooks/src/transformers/sentry.ts` and `linear.ts` follow the **exact same pattern** as GitHub/Vercel:
- Import and call `validateSourceEvent()` (sentry.ts:15, linear.ts:16)
- Import and call `sanitizeTitle()` / `sanitizeBody()` (sentry.ts:16, linear.ts:16)
- Include `logValidationErrors()` helper
- Same `(payload, context) → SourceEvent` signature

#### Duplicate Sentry/Linear Transformers (console-test-data)
The duplicate versions in `console-test-data/src/transformers/` **lack**:
- No `validateSourceEvent()` calls
- No `sanitizeTitle()` / `sanitizeBody()` calls
- No import from `../validation.js` or `../sanitize.js`
- Same core transformation logic and type interfaces (duplicated)

Both produce the same `SourceEvent` shape. The transformer map signatures are identical:
```typescript
// Both packages export the same map structure
export const sentryTransformers = {
  "issue.created": (payload: unknown, ctx: TransformContext) =>
    transformSentryIssue(payload as SentryIssueWebhook, ctx),
  // ...
};
```

#### How `TransformContext` is Used
`TransformContext` carries `{ deliveryId: string, receivedAt: Date }`. In production webhooks, `deliveryId` comes from the HTTP header (`x-github-delivery`, `x-vercel-id`). In test data, it's generated as `test-{timestamp}-{random}`. The `deliveryId` is stored in the event's `metadata.deliveryId` field and used for idempotency.

### 4. Event Type Coverage Audit

#### INTERNAL_EVENT_TYPES Registry (console-types/integrations/event-types.ts:25-87)
Currently **18 event types** registered:

| Event Type | Source | Weight |
|-----------|--------|--------|
| `push` | github | 30 |
| `pull-request.opened` | github | 50 |
| `pull-request.closed` | github | 45 |
| `pull-request.merged` | github | 60 |
| `pull-request.reopened` | github | 40 |
| `pull-request.ready-for-review` | github | 45 |
| `issue.opened` | github | 45 |
| `issue.closed` | github | 40 |
| `issue.reopened` | github | 40 |
| `release.published` | github | 75 |
| `release.created` | github | 70 |
| `discussion.created` | github | 35 |
| `discussion.answered` | github | 40 |
| `deployment.created` | vercel | 30 |
| `deployment.succeeded` | vercel | 40 |
| `deployment.ready` | vercel | 40 |
| `deployment.error` | vercel | 70 |
| `deployment.canceled` | vercel | 65 |

#### Sentry Event Types (NOT registered)
Sentry transformers produce these `sourceType` values:
| sourceType | Produced By |
|-----------|-------------|
| `issue.created` | `transformSentryIssue()` (action=created) |
| `issue.resolved` | `transformSentryIssue()` (action=resolved) |
| `issue.assigned` | `transformSentryIssue()` (action=assigned) |
| `issue.ignored` | `transformSentryIssue()` (action=ignored) |
| `error` | `transformSentryError()` |
| `event_alert` | `transformSentryEventAlert()` |
| `metric_alert` | `transformSentryMetricAlert()` |

**Collision**: `issue.created` and `issue.closed`/`issue.reopened` overlap with GitHub event types in `INTERNAL_EVENT_TYPES`. The GitHub versions have `source: "github"` while Sentry events would have `source: "sentry"` — but `InternalEventType` is keyed only by the event type string without source qualification. `issue.resolved`, `issue.assigned`, `issue.ignored`, `error`, `event_alert`, and `metric_alert` have no entry at all.

#### Linear Event Types (NOT registered)
Linear transformers produce these `sourceType` values:
| sourceType | Produced By |
|-----------|-------------|
| `issue.created` | `transformLinearIssue()` (action=create) |
| `issue.updated` | `transformLinearIssue()` (action=update) |
| `issue.deleted` | `transformLinearIssue()` (action=remove) |
| `comment.created` | `transformLinearComment()` (action=create) |
| `comment.updated` | `transformLinearComment()` (action=update) |
| `comment.deleted` | `transformLinearComment()` (action=remove) |
| `project.created` | `transformLinearProject()` (action=create) |
| `project.updated` | `transformLinearProject()` (action=update) |
| `project.deleted` | `transformLinearProject()` (action=remove) |
| `cycle.created` | `transformLinearCycle()` (action=create) |
| `cycle.updated` | `transformLinearCycle()` (action=update) |
| `cycle.deleted` | `transformLinearCycle()` (action=remove) |
| `project-update.created` | `transformLinearProjectUpdate()` (action=create) |
| `project-update.updated` | `transformLinearProjectUpdate()` (action=update) |
| `project-update.deleted` | `transformLinearProjectUpdate()` (action=remove) |

**Collision**: `issue.created` overlaps with both GitHub and Sentry. `issue.updated` and `issue.deleted` have no entry. None of the `comment.*`, `project.*`, `cycle.*`, or `project-update.*` types have entries.

#### InternalEventType Validation
- `isInternalEventType()` at `event-types.ts:121-123` checks `value in INTERNAL_EVENT_TYPES`
- All Sentry and Linear event types return `false` from this check
- `getEventWeight()` at `event-types.ts:111-116` returns the default weight of 35 for any unregistered type
- The `sourceType` field on `SourceEvent` is typed as `string` (not `InternalEventType`), so unregistered types don't cause compile-time errors
- The Zod `sourceEventSchema` validates `sourceType` as `z.string().min(1)` — no enum constraint

### 5. Event-Mapping Gap Analysis

#### How event-mapping.ts Works in Production
- `event-mapping.ts` defines `GITHUB_TO_INTERNAL` (13 entries) and `VERCEL_TO_INTERNAL` (5 entries)
- `toInternalGitHubEvent(event, action?)` constructs `{event}_{action}` key and looks up the internal type
- GitHub transformers call it: e.g., `toInternalGitHubEvent("pull_request", effectiveAction)` at `github.ts:207`
- Vercel transformer calls `toInternalVercelEvent(eventType)` at `vercel.ts:112`
- These functions return `InternalEventType | undefined`; when undefined, transformers fall back to constructing their own string (e.g., `pull-request.${effectiveAction}`)

#### Why test-data's transform.ts Doesn't Use It
`transform.ts` in console-test-data routes by `webhook.source` and `webhook.eventType`, then delegates directly to the transformer functions. For GitHub/Vercel, it calls the production transformers from `@repo/console-webhooks/transformers` which internally use `event-mapping.ts`. For Sentry/Linear, it calls the local duplicate transformers which hardcode their own `sourceType` strings.

The promoted Sentry/Linear transformers in `console-webhooks` also don't use `event-mapping.ts` — they hardcode `sourceType` strings like `issue.${payload.action}` directly. This is because there are no `SENTRY_TO_INTERNAL` or `LINEAR_TO_INTERNAL` mapping objects.

#### Missing Mappings
No `SENTRY_TO_INTERNAL` or `LINEAR_TO_INTERNAL` mappings exist in `event-mapping.ts`. Sentry event types use a different naming convention (`issue.created` vs `error` vs `event_alert` vs `metric_alert`) and Linear event types use PascalCase webhook types (`Issue`, `Comment`, `Project`) that get mapped to `{entity}.{action}` in the transformer itself.

### 6. Downstream Impact Assessment

#### Significance Scoring (`getEventWeight`)
- **File**: `api/console/src/inngest/workflow/neural/scoring.ts:83`
- Imports `getEventWeight` from `@repo/console-types`
- `getEventWeight()` returns `35` (default) for all Sentry and Linear events because they're not in `INTERNAL_EVENT_TYPES`
- This means all Sentry/Linear events receive the same base score regardless of importance (e.g., a Sentry `metric_alert` gets the same base weight as a `comment.created`)

#### Observation Capture Workflow
- **File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- The workflow validates `source` against `sourceTypeSchema` (which includes `"linear"` and `"sentry"`)
- The `sourceType` field is validated as `z.string().min(1)` — no enum constraint against `InternalEventType`
- Adding Sentry/Linear to `INTERNAL_EVENT_TYPES` would not break any existing validation or type exhaustiveness checks because `sourceType` is typed as `string` everywhere except in `event-mapping.ts` record value types

#### Type Exhaustiveness
- `InternalEventType` is a union derived from `keyof typeof INTERNAL_EVENT_TYPES`
- Adding new keys to `INTERNAL_EVENT_TYPES` would **expand** the union, not narrow it
- No `switch` statements or exhaustiveness checks on `InternalEventType` were found that would break
- The only code consuming `InternalEventType` as a value type is `event-mapping.ts` Record declarations — these would need updating if new event types are added

### 7. SourceType Registry Assessment

#### Definition
`SourceType` is defined at `packages/console-validation/src/schemas/sources.ts:23-28`:
```typescript
export const sourceTypeSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
  "linear",      // ✅ Transformer ready
  "sentry",      // ✅ Transformer ready
]);
```

`"linear"` and `"sentry"` are already included. This was done as part of the "Definitive Links" Phase 1 implementation.

#### What Validates Source Types at the Boundary
- `sourceEventSchema` (Zod) uses `sourceTypeSchema` for the `source` field — validates at runtime during `validateSourceEvent()`
- The `observation-capture.ts` Inngest event schema uses `sourceTypeSchema` for event data validation
- Database columns (`user_sources.sourceType`, `workspace_knowledge_documents.sourceType`) are typed as `SourceType`
- The backfill connector registry (`console-backfill/src/registry.ts`) maps `SourceType` to connectors

#### Current State
`SourceType` is fully inclusive of all 4 sources. No changes needed here.

### 8. Duplication Between console-webhooks and console-test-data

The following type interfaces are **fully duplicated** between both packages:

**Sentry types** (identical in both):
- `SentryIssueWebhook`, `SentryErrorWebhook`, `SentryEventAlertWebhook`, `SentryMetricAlertWebhook`
- `SentryIssue`, `SentryErrorEvent`, `SentryActor`
- `SentryEventType`

**Linear types** (identical in both):
- `LinearWebhookBase`, `LinearWebhookType`
- `LinearIssueWebhook`, `LinearCommentWebhook`, `LinearProjectWebhook`, `LinearCycleWebhook`, `LinearProjectUpdateWebhook`
- `LinearIssue`, `LinearComment`, `LinearProject`, `LinearCycle`, `LinearProjectUpdate`
- `LinearUser`, `LinearLabel`, `LinearAttachment`

**Transformer functions** (nearly identical — promoted versions add validation/sanitization):
- `transformSentryIssue`, `transformSentryError`, `transformSentryEventAlert`, `transformSentryMetricAlert`
- `transformLinearIssue`, `transformLinearComment`, `transformLinearProject`, `transformLinearCycle`, `transformLinearProjectUpdate`
- `sentryTransformers` map, `linearTransformers` map

The `console-webhooks` versions are strictly superior: they call `validateSourceEvent()` and `sanitizeTitle()`/`sanitizeBody()` which the `console-test-data` versions lack.

## Code References

### Core Type Definitions
- `packages/console-types/src/neural/source-event.ts:7-76` — SourceEvent, SourceActor, SourceReference, TransformContext interfaces
- `packages/console-types/src/integrations/event-types.ts:25-87` — INTERNAL_EVENT_TYPES constant (18 event types, GitHub + Vercel only)
- `packages/console-types/src/integrations/event-types.ts:92` — InternalEventType union type
- `packages/console-types/src/integrations/event-types.ts:111-116` — getEventWeight() with default 35
- `packages/console-types/src/integrations/events.ts:3-63` — GITHUB_EVENTS and VERCEL_EVENTS display metadata

### Validation Schemas
- `packages/console-validation/src/schemas/sources.ts:23-28` — sourceTypeSchema (4 sources)
- `packages/console-validation/src/schemas/source-event.ts:52-62` — sourceEventSchema (Zod)

### Production Transformers (console-webhooks)
- `packages/console-webhooks/src/transformers/github.ts:36-517` — 5 GitHub transformers + extractLinkedIssues()
- `packages/console-webhooks/src/transformers/vercel.ts:17-165` — Vercel deployment transformer
- `packages/console-webhooks/src/transformers/sentry.ts:1-585` — 4 Sentry transformers (promoted)
- `packages/console-webhooks/src/transformers/linear.ts:1-844` — 5 Linear transformers (promoted)
- `packages/console-webhooks/src/transformers/index.ts:1-4` — Re-exports all 4 sources

### Event Mapping
- `packages/console-webhooks/src/event-mapping.ts:12-35` — GITHUB_TO_INTERNAL (13 mappings)
- `packages/console-webhooks/src/event-mapping.ts:41-47` — VERCEL_TO_INTERNAL (5 mappings)
- `packages/console-webhooks/src/event-mapping.ts:60-66` — toInternalGitHubEvent()
- `packages/console-webhooks/src/event-mapping.ts:75-79` — toInternalVercelEvent()

### Duplicate Transformers (console-test-data)
- `packages/console-test-data/src/transformers/sentry.ts:1-544` — Duplicate (no validation/sanitization)
- `packages/console-test-data/src/transformers/linear.ts:1-797` — Duplicate (no validation/sanitization)
- `packages/console-test-data/src/transformers/index.ts:1-38` — Re-exports duplicates

### Test Data Loader
- `packages/console-test-data/src/loader/transform.ts:8-15` — Imports GitHub/Vercel from console-webhooks
- `packages/console-test-data/src/loader/transform.ts:27-29` — Imports Sentry/Linear from local duplicates
- `packages/console-test-data/src/loader/transform.ts:86-121` — transformWebhook() routing switch

### Production Webhook Handlers
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` — GitHub webhook ingestion
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` — Vercel webhook ingestion

### Observation Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts` — Main observation processing
- `api/console/src/inngest/workflow/neural/scoring.ts:83` — Uses getEventWeight()
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` — Cross-source linking

### Backfill
- `packages/console-backfill/src/connectors/github.ts:12-16` — Uses GitHub transformers
- `packages/console-backfill/src/connectors/vercel.ts:8` — Uses Vercel transformer

## Architecture Documentation

### Data Flow: Webhook → SourceEvent → Observation

1. **HTTP webhook** arrives at Next.js route handler (`apps/console/`)
2. **Signature verification** via `console-webhooks` (HMAC SHA-256 for GitHub, custom for Vercel)
3. **Timestamp validation** to prevent replay attacks (max 300 seconds)
4. **Raw payload storage** via `storeIngestionPayload()` in `console-webhooks/storage.ts`
5. **Transformation** via source-specific transformer → produces `SourceEvent`
6. **Inngest event emission** `apps-console/neural/observation.capture`
7. **Observation capture workflow** processes: duplicate check → event filtering → significance scoring → classification → embedding → entity extraction → vector storage → database storage → relationship detection

### Package Responsibility Map

| Package | Responsibility |
|---------|---------------|
| `console-validation` | Zod schemas for runtime validation; SourceType enum |
| `console-types` | TypeScript interfaces (SourceEvent, TransformContext); InternalEventType registry with weights |
| `console-webhooks` | Signature verification, payload transformers, event mapping, validation, sanitization, storage |
| `console-test-data` | Test dataset definitions + loader; currently duplicates Sentry/Linear transformers |
| `console-backfill` | Historical data fetching; consumes transformers from console-webhooks |

### Transformer Function Signatures

All production transformers follow this contract:
```typescript
function transform<Source>Event(
  payload: <SourcePayload>,   // Typed webhook payload
  context: TransformContext    // { deliveryId: string, receivedAt: Date }
): SourceEvent                 // Normalized event
```

Vercel transformer has a 3-arg variant:
```typescript
function transformVercelDeployment(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
  context: TransformContext
): SourceEvent
```

All transformers produce the same `SourceEvent` shape with:
- `source`: SourceType string
- `sourceType`: Internal event format string
- `sourceId`: Unique identifier
- `title`: Sanitized headline (max 200 chars)
- `body`: Sanitized semantic content (max 50,000 chars)
- `actor`: Optional SourceActor
- `occurredAt`: ISO 8601 timestamp
- `references`: Array of SourceReference (commits, branches, PRs, issues, etc.)
- `metadata`: Record of source-specific structured data

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md` — "Definitive Links" plan that described 3 phases: (1) promote Linear/Sentry transformers to console-webhooks + add SourceType entries, (2) add Vercel PR extraction, (3) strict relationship detection. Phase 1 was executed (transformers now exist in both packages, SourceType includes all 4 sources).
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` — Original Sentry integration research including webhook processing and event transformation design.
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` — Original Linear integration research including webhook processing and Inngest workflow hierarchy.
- `thoughts/shared/research/2026-02-07-realistic-sandbox-test-data-design.md` — Recent test data design document; the console-test-data package was built for sandbox demo scenarios.
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` — Cross-source linking gaps including event mapping and entity references.
- `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md` — Actor implementation fixes referencing transformer code in console-webhooks.

## Related Research

- `thoughts/shared/research/2025-12-15-webhook-actor-shape-verification.md`
- `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md`
- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md`

## Gap Analysis

### 1. Duplicate Transformers
`console-test-data` still imports Sentry/Linear transformers from its own `../transformers/` path despite identical promoted versions existing in `console-webhooks`. The local duplicates lack validation and sanitization.

### 2. Missing INTERNAL_EVENT_TYPES Entries
`INTERNAL_EVENT_TYPES` only covers 18 event types (13 GitHub + 5 Vercel). The following are unregistered:
- **Sentry** (7 types): `issue.created`, `issue.resolved`, `issue.assigned`, `issue.ignored`, `error`, `event_alert`, `metric_alert`
- **Linear** (15 types): `issue.created`, `issue.updated`, `issue.deleted`, `comment.created/updated/deleted`, `project.created/updated/deleted`, `cycle.created/updated/deleted`, `project-update.created/updated/deleted`

This causes `getEventWeight()` to return 35 for all Sentry/Linear events and `isInternalEventType()` to return false.

### 3. Event Type Namespace Collisions
`issue.created` is used by GitHub (`issue.opened` maps to it), Sentry, and Linear. The current `INTERNAL_EVENT_TYPES` keying doesn't include source qualification, so adding Sentry/Linear entries would require either: (a) source-qualified keys like `sentry.issue.created`, or (b) keeping the current structure and accepting that `issue.created` can mean different things depending on `source`.

### 4. Missing Event Mappings
No `SENTRY_TO_INTERNAL` or `LINEAR_TO_INTERNAL` mapping objects exist. The Sentry/Linear transformers hardcode their `sourceType` strings rather than going through a mapping layer.

### 5. console-test-data loader routing
`transform.ts` has its own routing logic via switch statements rather than using a unified transformer registry. It imports GitHub/Vercel from `console-webhooks` but Sentry/Linear from local duplicates.

## Proposed Target Architecture for Consolidation

### Phase 1: Delete Duplicate Transformers
- Delete `packages/console-test-data/src/transformers/sentry.ts`
- Delete `packages/console-test-data/src/transformers/linear.ts`
- Delete `packages/console-test-data/src/transformers/index.ts`
- Update `packages/console-test-data/src/loader/transform.ts` to import Sentry/Linear transformers from `@repo/console-webhooks/transformers` instead of `../transformers`
- This is zero-risk since the promoted versions are functionally identical (plus validation/sanitization)

### Phase 2: Register Sentry/Linear Event Types
- Add Sentry event types to `INTERNAL_EVENT_TYPES` in `console-types/src/integrations/event-types.ts` with appropriate weights
- Add Linear event types to `INTERNAL_EVENT_TYPES` with appropriate weights
- Decision needed on namespace collision: source-prefix keys vs. current flat keys
- Add `SENTRY_EVENTS` and `LINEAR_EVENTS` display metadata to `events.ts` (following GITHUB_EVENTS/VERCEL_EVENTS pattern)

### Phase 3: Add Event Mappings (Optional)
- Add `SENTRY_TO_INTERNAL` mapping to `event-mapping.ts` (maps Sentry webhook types to internal types)
- Add `LINEAR_TO_INTERNAL` mapping (maps Linear webhook types to internal types)
- Update Sentry/Linear transformers to use mapping functions instead of hardcoding `sourceType`
- This is optional since the transformers currently work without it; the mapping adds validation but isn't strictly needed

## Risk Assessment

### Low Risk
- **Deleting test-data duplicates** (Phase 1): The console-webhooks versions are strictly superior. Test data loader already imports GitHub/Vercel from console-webhooks, so this is consistent.
- **Adding to SourceType**: Already done — `"linear"` and `"sentry"` are in `sourceTypeSchema`.

### Medium Risk
- **Adding to INTERNAL_EVENT_TYPES** (Phase 2): Expands the `InternalEventType` union. No exhaustiveness switches found, but `event-mapping.ts` Record types are keyed on `InternalEventType` and would need to be updated or the Records would need `Partial` wrapping.
- **Namespace collisions**: `issue.created` appears in GitHub (via `issue.opened` → not exactly `issue.created`), Sentry, and Linear. Need a naming strategy.

### Low-Medium Risk
- **getEventWeight() changes**: Currently returns 35 for all unknown types. After registration, Sentry/Linear events would get specific weights. This changes significance scoring behavior for any existing Sentry/Linear test data already in the system.

## Recommended Phase Ordering

1. **Phase 1** (Immediate, zero-risk): Delete `console-test-data` transformer duplicates, update imports to use `@repo/console-webhooks/transformers`
2. **Phase 2** (Requires design decision): Register Sentry/Linear event types in `INTERNAL_EVENT_TYPES` with source-qualified or flat keys, assign appropriate weights
3. **Phase 3** (Optional, additive): Create event mapping objects for Sentry/Linear in `event-mapping.ts`

## Open Questions

1. **Namespace strategy**: Should `INTERNAL_EVENT_TYPES` keys be source-qualified (e.g., `sentry:issue.created`) or remain flat with the `source` field providing disambiguation? The current GitHub events don't have a source prefix.
2. **Weight assignments**: What weights should Sentry/Linear event types have? Sentry `metric_alert` is arguably higher-impact than a Sentry `issue.assigned`. Linear `issue.created` may differ in importance from GitHub `issue.opened`.
3. **Backfill connector for Linear/Sentry**: The backfill package only has GitHub and Vercel connectors. Should Linear/Sentry backfill connectors be planned alongside this consolidation?
4. **Production webhook routes for Linear/Sentry**: The "Definitive Links" plan explicitly scoped out production webhook route handlers for Linear/Sentry. When are those needed?
