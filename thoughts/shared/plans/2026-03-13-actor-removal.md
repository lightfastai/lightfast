---
date: 2026-03-13T00:00:00+00:00
author: claude
git_commit: a077752af0bd9bdf0d98a756c665e4c0523d8ce5
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Complete actor removal from codebase"
tags: [plan, actor, removal, db-schema, console-providers, inngest, validation, ui]
status: ready
last_updated: 2026-03-13
---

# Complete Actor Removal — Implementation Plan

## Overview

Remove all actor-related code, DB columns, types, and UI rendering from the codebase. The standalone actor reconciliation tables were dropped in past migrations; this plan removes the remaining actor-as-metadata that flows through the pipeline from provider webhooks to DB storage to vector embeddings to UI display.

## Current State Analysis

Actor data flows through this path:
```
Provider webhook → console-providers transformer (sets actor on PostTransformEvent)
  → Inngest event schema (actor object in event.capture payload)
  → event-store.ts (writes actor JSONB to workspace_events)
  → record-activity.ts (writes actorType/actorUserId/actorEmail to workspace_user_activities)
  → event-interpret.ts (reads actor.name for Pinecone vector metadata)
  → UI events table (renders actor name/avatar/email)
```

### Key Discoveries:
- Two distinct actor concepts exist: event author metadata (JSONB on workspace_events) and activity audit trail (flat columns on workspace_user_activities) — both being removed
- `actorId` bigint on `workspace_events` has no FK constraint — dangling reference to dropped table
- `actorType` on `workspace_user_activities` is `notNull()` — migration must drop the constraint
- `relevantActors` in `search-results-list.tsx` is already commented out
- `linearActorSchema` and `sentryActorSchema` are module-private (not exported) — only `SentryActor` and `LinearActor` types + `postTransformActorSchema` are exported from the barrel
- None of the Linear transformers read from `payload.actor` — they all use entity-embedded user objects, so the `linearActorSchema` on the webhook envelope schema is purely for parsing/validation of the incoming payload shape, not for populating the output actor

## Desired End State

Zero references to actor (as identity/profile metadata) in the codebase. The word "actor" should only appear in:
- Fixture files (external webhook payload shapes — `sentry-issue.json`, `linear-issue-create.json`)
- Pre-transform webhook schemas (Sentry/Linear payloads have `actor` as part of their API contract — we parse it but don't use it)
- Git history / migration SQL files

### Verification:
```bash
# Should return only fixtures, pre-transform schemas, and migration .sql files
rg "actor" --type ts -l | grep -v node_modules | grep -v '.sql'
# Remaining matches should be:
#   - sentry/schemas.ts (pre-transform input — actor on webhook envelope)
#   - linear/schemas.ts (pre-transform input — actor on webhook envelope)
#   - fixture .json files
```

## What We're NOT Doing

- **Not touching pre-transform webhook schemas** — `sentryActorSchema` and `linearActorSchema` parse incoming webhook payloads. These reflect external API contracts (Sentry/Linear send `actor` in their webhooks). We keep parsing them; we just stop propagating actor to our output.
- **Not modifying existing Pinecone vectors** — old vectors retain their `actorName` metadata field. We stop writing it to new vectors.
- **Not touching search schema `actorNames` filters** — handled by the search-system-reset plan which deletes/rewrites those files entirely.
- **Not touching fixture JSON files** — these represent external payloads and should reflect the real API shape.

## Implementation Approach

Bottom-up removal: providers (origin) → Inngest (transport) → DB (storage) → validation/AI/UI (consumption). Three phases, each independently committable.

---

## Phase 1: Provider Transformer Layer

### Overview
Remove actor from the canonical output schema (`PostTransformEvent`) and all provider transformers. This stops actor from being produced at the source. Pre-transform input schemas (Sentry/Linear webhook envelope parsing) are preserved since they reflect external API contracts.

### Changes Required:

#### 1. Remove actor from PostTransformEvent schema
**File**: `packages/console-providers/src/post-transform-event.ts`

Delete `postTransformActorSchema` (lines 11–16), the `actor` field on `postTransformEventSchema` (line 50), and the `PostTransformActor` type export (line 57).

#### 2. Remove actor validation
**File**: `packages/console-providers/src/validation.ts`

Remove the `avatarUrl` sanitization block (lines 57–65) from `sanitizePostTransformEvent` that checks `event.actor.avatarUrl`.

#### 3. Remove actor from GitHub transformers
**File**: `packages/console-providers/src/providers/github/transformers.ts`

Remove `actor` assignment from all 5 transform functions:
- `transformGitHubPush` (lines 58–63)
- `transformGitHubPullRequest` (lines 179–186)
- `transformGitHubIssue` (lines 266–273)
- `transformGitHubRelease` (lines 328–333)
- `transformGitHubDiscussion` (lines 389–394)

#### 4. Remove actor from Linear transformers
**File**: `packages/console-providers/src/providers/linear/transformers.ts`

Remove `actor` assignment from all 5 transform functions:
- `transformLinearIssue` (lines 136–143)
- `transformLinearComment` (lines 221–226)
- `transformLinearProject` (lines 305–312)
- `transformLinearCycle` (line 393)
- `transformLinearProjectUpdate` (lines 464–469)

#### 5. Remove actor from Sentry transformers
**File**: `packages/console-providers/src/providers/sentry/transformers.ts`

Remove `actor` assignment from all 4 transform functions:
- `transformSentryIssue` (lines 95–100)
- `transformSentryError` (lines 178–186)
- `transformSentryEventAlert` (line 248)
- `transformSentryMetricAlert` (line 309)

#### 6. Remove actor from Vercel transformers
**File**: `packages/console-providers/src/providers/vercel/transformers.ts`

Remove `actor` assignment from `transformVercelDeployment` (lines 117–124).

#### 7. Remove actor from Sentry backfill adapter
**File**: `packages/console-providers/src/providers/sentry/backfill.ts`

Remove `actor` field from `adaptSentryIssueForTransformer` (line 93–97).

#### 8. Remove SentryActor type export
**File**: `packages/console-providers/src/providers/sentry/schemas.ts`

Remove `SentryActor` type export (line 225). Keep `sentryActorSchema` — it parses the incoming Sentry webhook payload.

#### 9. Remove LinearActor type export
**File**: `packages/console-providers/src/providers/linear/schemas.ts`

Remove `LinearActor` type export (line 265). Keep `linearActorSchema` — it parses the incoming Linear webhook payload.

#### 10. Update barrel exports
**File**: `packages/console-providers/src/index.ts`

Remove exports: `PostTransformActor` (line ~35), `postTransformActorSchema` (line ~41), `LinearActor` (line ~86), `SentryActor` (line ~127).

#### 11. Update test assertions
Remove actor assertions from:
- `packages/console-providers/src/providers/github/backfill-round-trip.test.ts` — lines 171–174, 235–238, 271–274 (3 test blocks)
- `packages/console-providers/src/providers/linear/backfill.test.ts` — lines 452–455 (1 test block)
- `packages/console-providers/src/providers/sentry/backfill.test.ts` — lines 336–339 (1 test block), lines 455–456 (2 assertion lines inside a larger test)

### Success Criteria:

#### Automated Verification:
- [x] Provider tests pass: `pnpm --filter @repo/console-providers test`
- [x] Provider types pass: `pnpm --filter @repo/console-providers typecheck`
- [x] No `PostTransformActor` or `actor` field on `PostTransformEvent`: `rg "PostTransformActor|postTransformActorSchema" packages/console-providers/`

#### Manual Verification:
- [ ] Confirm transformer output objects no longer include `actor` key

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Inngest Workflows + DB Schema

### Overview
Remove actor from Inngest event schemas and workflow steps, drop actor columns from both DB tables, and generate the migration. These go together because Inngest writes to the DB — both sides must change atomically.

### Changes Required:

#### 1. Remove actor from `activity.record` event schema
**File**: `api/console/src/inngest/client/client.ts`

Remove three fields from the `apps-console/activity.record` schema (lines 46–50):
- `actorType: z.enum(["user", "system", "webhook", "api"])`
- `actorUserId: z.string().optional()`
- `actorEmail: z.string().optional()`

#### 2. Remove actor from `event.capture` event schema
**File**: `api/console/src/inngest/client/client.ts`

Remove the `actor` object field from the `sourceEvent` sub-schema (lines 145–152):
```ts
actor: z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
}).nullable(),
```

#### 3. Remove actor from record-activity workflow
**File**: `api/console/src/inngest/workflow/infrastructure/record-activity.ts`

Remove actor field mappings from the DB insert step (lines 78–80):
```ts
actorType: data.actorType,
actorUserId: data.actorUserId ?? null,
actorEmail: data.actorEmail ?? null,
```

#### 4. Remove actor from event-store workflow
**File**: `api/console/src/inngest/workflow/neural/event-store.ts`

Remove actor field from the DB insert (line 404):
```ts
actor: sourceEvent.actor ?? null,
```

#### 5. Remove actor from event-interpret workflow
**File**: `api/console/src/inngest/workflow/neural/event-interpret.ts`

Two changes:
- Remove `actor: true` from the Drizzle select columns (line 140)
- Remove `actorName: obs.actor?.name ?? "unknown"` from `baseMetadata` (line 307) — stop writing `actorName` to new Pinecone vectors

#### 6. Drop actor columns from workspace_events schema
**File**: `db/console/src/schema/tables/workspace-events.ts`

- Delete `ObservationActor` interface (lines 39–44)
- Delete `actor` column (line 106): `actor: jsonb("actor").$type<ObservationActor | null>()`
- Delete `actorId` column (line 111): `actorId: bigint("actor_id", { mode: "number" })`

#### 7. Drop actor columns from workspace_user_activities schema
**File**: `db/console/src/schema/tables/workspace-user-activities.ts`

- Remove `ActorType` import from `@repo/console-validation` (lines 17–21)
- Delete `actorType` column (lines 59–61)
- Delete `actorUserId` column (line 67)
- Delete `actorEmail` column (line 74)
- Delete `actorIp` column (line 81)
- Delete `actorIdx` index (line 182): `actorIdx: index("activity_actor_idx").on(table.actorUserId)`

#### 8. Remove ObservationActor re-exports
Three files in the re-export chain:
- `db/console/src/schema/tables/index.ts` — remove `ObservationActor` from type export block (line ~56)
- `db/console/src/schema/index.ts` — remove `ObservationActor` from type export block (line ~22)
- `db/console/src/index.ts` — remove `ObservationActor` from type export block (line ~9)

#### 9. Generate migration
```bash
cd db/console && pnpm db:generate
```
This will generate a migration that drops 2 columns from `workspace_events`, 4 columns + 1 index from `workspace_user_activities`.

### Success Criteria:

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] DB package typechecks: `pnpm --filter @db/console typecheck`
- [x] Inngest code typechecks: `pnpm --filter @api/console typecheck`
- [x] No `ObservationActor` exports: `rg "ObservationActor" db/console/src/`

#### Manual Verification:
- [ ] Review generated migration SQL to confirm it only drops the expected columns/indexes
- [ ] Run migration against dev database: `cd db/console && pnpm db:migrate`
- [ ] Verify workspace_events and workspace_user_activities tables have correct columns in DB studio

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the migration ran correctly before proceeding to the next phase.

---

## Phase 3: Validation, AI Tools, and Client UI

### Overview
Remove actor types from validation schemas, actor filter from AI tool inputs, and actor rendering from UI components.

### Changes Required:

#### 1. Remove actor types from activities validation
**File**: `packages/console-validation/src/schemas/activities.ts`

- Delete `actorTypeSchema` enum (line 20): `z.enum(["user", "system", "webhook", "api"])`
- Delete `ActorType` type (line 22)
- Remove 4 actor fields from `insertActivitySchema` (lines 634–637):
  - `actorType: actorTypeSchema`
  - `actorUserId: z.string().optional()`
  - `actorEmail: z.string().email().optional()`
  - `actorIp: z.ipv4().or(z.ipv6()).optional()`

#### 2. Remove actor types from neural validation
**File**: `packages/console-validation/src/schemas/neural.ts`

- Remove `PostTransformActor` import from `@repo/console-providers` (line 1)
- Delete `resolvedActorSchema` (lines 15–18)
- Delete `ResolvedActor` type (line 20)
- Remove `actorName: z.string()` from `observationVectorMetadataSchema` (line 27)

#### 3. Remove actorNames from AI search types
**File**: `packages/console-ai-types/src/index.ts`

Remove `actorNames?: string[]` from the `filters` object on `SearchToolInput` (line 16).

#### 4. Remove actorNames from AI search tool
**File**: `packages/console-ai/src/workspace-search.ts`

Remove `actorNames` field from the `filters` sub-object in the tool's input schema (lines 27–30).

#### 5. Remove actorNames from V1 search schema
**File**: `packages/console-validation/src/schemas/api/v1/search.ts`

Remove `actorNames` filter (line 27), `relevantActors` from context (lines 164–171), `actorSearch` from latency (line 197), and `actor` from `paths` (line 230).

Note: This file will be deleted entirely by the search-system-reset plan. We remove actor fields here so this plan is self-contained.

#### 6. Remove actorNames from V2 common schema
**File**: `packages/console-validation/src/schemas/api/v2/common.ts`

Remove `actorNames` from `SearchFiltersSchema` (line 20).

Note: This file will be promoted to canonical by the search-system-reset plan. Removing `actorNames` here so it's gone regardless of execution order.

#### 7. Remove ActorType export from app types
**File**: `apps/console/src/types/index.ts`

Delete `ActorType` export (line 99): `export type ActorType = WorkspaceActivity["actorType"]`

#### 8. Remove Actor column from events table
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx`

Remove `<TableHead>Actor</TableHead>` (line 282). Table goes from 6 to 5 columns.

#### 9. Remove actor rendering from event detail
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-detail.tsx`

Delete the entire actor section (lines 37–61): avatar image, name, email rendering.

#### 10. Remove actor cell from event row
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-row.tsx`

Delete the actor `<TableCell>` (lines 82–84). Update `colSpan={6}` → `colSpan={5}` on the expanded detail row (line 94).

#### 11. Clean up search results list (already commented out)
**File**: `apps/console/src/components/search-results-list.tsx`

Delete the commented-out `relevantActors` block (lines 42–72). No functional change.

#### 12. Remove actor-related re-exports from validation index
**File**: `packages/console-validation/src/index.ts`

Remove any re-exports of `actorTypeSchema`, `ActorType`, `resolvedActorSchema`, `ResolvedActor` if they exist as named exports (they're currently star-exported via `export * from "./schemas/activities"` and `export * from "./schemas/neural"`).

### Success Criteria:

#### Automated Verification:
- [x] Validation typechecks: `pnpm --filter @repo/console-validation typecheck`
- [x] AI types typecheck: `pnpm --filter @repo/console-ai-types typecheck`
- [x] AI package typechecks: `pnpm --filter @repo/console-ai typecheck`
- [x] Console typechecks: `pnpm --filter @lightfast/console typecheck`
- [x] Full typecheck passes: `pnpm typecheck` (only pre-existing @repo/console-openapi failure)
- [x] Full lint passes: `pnpm check` (Phase 3 files are clean; remaining 12 errors are pre-existing or from Phase 1/2)

#### Manual Verification:
- [ ] Events table renders correctly without actor column
- [ ] Event detail view renders correctly without actor section
- [ ] Search results display correctly (no actor-related rendering)

**Implementation Note**: After completing this phase, run full `pnpm typecheck` and `pnpm check` to confirm zero actor-related type errors across the monorepo.

---

## Testing Strategy

### Unit Tests:
- Provider transformer tests: verify output no longer includes `actor` field
- Existing tests with actor assertions updated to remove those assertions

### Integration Tests:
- Inngest event schema validation: events without actor fields should pass
- DB inserts: workspace_events and workspace_user_activities inserts should work without actor fields

### Manual Testing Steps:
1. Trigger a webhook (GitHub/Linear/Sentry) and verify the event is stored without actor data
2. Check events table in UI — no Actor column, rows render correctly
3. Expand an event detail — no actor section
4. Run a search query — results render without actor information

## Migration Notes

- The migration drops columns from two live tables. Existing rows lose their actor data permanently.
- `actorType` on `workspace_user_activities` is `NOT NULL` — the migration will `ALTER TABLE ... DROP COLUMN` which removes both the column and its constraint.
- `actorId` on `workspace_events` has no FK constraint (the referenced table was already dropped) — clean drop.
- Existing Pinecone vectors retain their `actorName` metadata field. New vectors will not include it. The `observationVectorMetadataSchema` is updated to remove `actorName`, but Pinecone doesn't enforce schemas so old vectors are unaffected.

## References

- Research: `thoughts/shared/research/2026-03-13-actor-removal-complete-map.md`
- Related plan: `thoughts/shared/plans/2026-03-13-search-system-reset.md` (handles search schema deletion, overlaps on `actorNames` removal)
- Past migrations: 0024 (dropped `workspace_actor_identities`), 0041 (dropped `org_actor_identities`, `workspace_actor_profiles`)
