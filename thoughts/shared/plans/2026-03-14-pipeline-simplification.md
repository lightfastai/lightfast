# Pipeline Simplification Implementation Plan

## Overview

Streamline the ingestion pipeline by removing the orphaned observation layer (eventInterpret), removing the dead document pipeline (processDocuments/deleteDocuments), converting significance from a lossy gate to a metadata flag, and exposing existing Pinecone metadata as search filters. End state: a lean pipeline (eventStore → entityGraph → entityEmbed) with non-lossy ingestion and filtered search.

## Current State Analysis

The pipeline has 8 registered Inngest functions. Of these:
- `eventInterpret` runs Claude Haiku classification + 3 Pinecone vector upserts per event, but search only queries `layer="entities"` — the observation vectors are never read
- `processDocuments` / `deleteDocuments` process code files, but no code emits their trigger events in the main branch — dead code
- `notificationDispatch` source files are already deleted but stale imports remain in `index.ts`
- Significance scoring gates events at score < 40, permanently dropping them before DB storage

### Key Discoveries:
- `ai-helpers.ts`, `classification.ts`: only consumed by `event-interpret.ts` — safe to delete (`agent research`)
- `workspaceInterpretations` table: only written by eventInterpret, only read by CLI script `reconcile-pinecone-external-ids.ts` — safe to drop
- `event.stored` event: only consumed by `eventInterpret` as a trigger — can be removed or repurposed
- `event.interpreted` event: consumed by `notificationDispatch` (already deleted) — safe to remove
- `ObservationVectorMetadata`, `MultiViewEmbeddingResult`, `classificationResponseSchema`: only used by `event-interpret.ts` — safe to delete
- `processDocuments` trigger event `documents.process`: no emitter exists in main branch — dead
- `relationships.extract` event: emitted by processDocuments but no handler registered — dead
- Document pipeline downstream (`contentsRouter`, workspace stats): `contentsLogic` throws "not implemented" — dead end-to-end
- `@repo/console-chunking` package: only consumer is `process-documents.ts`
- `VectorMetadata` type in `@repo/console-pinecone`: only consumer is `process-documents.ts`
- Search filters `sourceTypes`, `observationTypes`, `dateRange.end` are parsed by Zod but never applied to Pinecone query
- `searchLogic` (apps/console) handles `dateRange.end`; `searchRouter` (api/console) does not — divergence
- Significance score is never written to DB or Pinecone metadata — ephemeral within workflow

## Desired End State

After completion:
- **3 event pipeline functions**: `eventStore` → `entityGraph` → `entityEmbed`
- **1 notification function**: `notificationDispatch` (triggered by `entity.upserted` or `event.stored`)
- **1 infrastructure function**: `recordActivity`
- **0 document processing functions** (removed)
- **Non-lossy ingestion**: all events stored regardless of significance score; score stored as metadata
- **Filtered search**: `source`, `entityType`, `dateRange.start`, `dateRange.end` exposed as Pinecone filters
- **No orphaned code**: no dead event schemas, no unused tables, no stale imports

### Verification:
- `pnpm typecheck` passes
- `pnpm check` passes
- DB migration applies cleanly
- Search API accepts and applies new filter fields
- Events previously below significance threshold are now stored with score metadata

## What We're NOT Doing

- Actor identity resolution (deferred — separate plan)
- New entity categories for future providers (deferred)
- Federated multi-layer search (deferred — single entity layer for now)
- Removing `@repo/console-chunking` package (low risk, can stay as unused dep)
- Removing contents API surface (SDK, MCP, OpenAPI — separate concern)

---

## Phase 1: Remove eventInterpret + Dead Code

### Overview
Delete the observation layer: eventInterpret function, its exclusive dependencies (ai-helpers, classification), the workspaceInterpretations table, observation vector types, and all dead event schemas. Re-create a minimal notificationDispatch triggered by `event.stored`.

### Changes Required:

#### 1. Delete eventInterpret and exclusive dependencies
**Delete files**:
- `api/console/src/inngest/workflow/neural/event-interpret.ts`
- `api/console/src/inngest/workflow/neural/ai-helpers.ts`
- `api/console/src/inngest/workflow/neural/classification.ts`

#### 2. Update neural index exports
**File**: `api/console/src/inngest/workflow/neural/index.ts`
**Changes**: Remove eventInterpret export

```typescript
// BEFORE
export { entityEmbed } from "./entity-embed";
export { entityGraph } from "./entity-graph";
export { eventInterpret } from "./event-interpret";
export { eventStore } from "./event-store";

// AFTER
export { entityEmbed } from "./entity-embed";
export { entityGraph } from "./entity-graph";
export { eventStore } from "./event-store";
```

Update the module doc comment to remove the eventInterpret description (line 4: "4. eventInterpret - Slow path...").

#### 3. Update Inngest index — remove eventInterpret, processDocuments, deleteDocuments
**File**: `api/console/src/inngest/index.ts`
**Changes**: Remove imports + exports + registration for eventInterpret, processDocuments, deleteDocuments, notificationDispatch (stale). Re-create notificationDispatch import.

```typescript
// BEFORE
import {
  entityEmbed,
  entityGraph,
  eventInterpret,
  eventStore,
} from "./workflow/neural";
import { notificationDispatch } from "./workflow/notifications";
import { deleteDocuments } from "./workflow/processing/delete-documents";
import { processDocuments } from "./workflow/processing/process-documents";

// AFTER
import {
  entityEmbed,
  entityGraph,
  eventStore,
} from "./workflow/neural";
import { notificationDispatch } from "./workflow/notifications";
```

Update the `functions` array:
```typescript
// BEFORE
functions: [
  processDocuments,
  deleteDocuments,
  recordActivity,
  eventStore,
  entityGraph,
  entityEmbed,
  eventInterpret,
  notificationDispatch,
],

// AFTER
functions: [
  recordActivity,
  eventStore,
  entityGraph,
  entityEmbed,
  notificationDispatch,
],
```

Remove re-exports of `processDocuments`, `deleteDocuments`, `eventInterpret`. Update JSDoc to reflect remaining functions.

#### 4. Remove dead event schemas from Inngest client
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Remove these event schemas from `eventsMap`:

- `"apps-console/event.stored"` (lines 141-164) — only consumed by deleted eventInterpret. **Keep if repurposing for notificationDispatch, otherwise remove.**
- `"apps-console/event.interpreted"` (lines 206-223) — only consumed by deleted notificationDispatch
- `"apps-console/documents.process"` (lines 79-102)
- `"apps-console/documents.delete"` (lines 104-113)
- `"apps-console/relationships.extract"` (lines 115-124)

**Decision**: Keep `event.stored` — repurpose it as the trigger for notificationDispatch.

#### 5. Update eventStore — stop emitting event.stored (or keep for notifications)
**File**: `api/console/src/inngest/workflow/neural/event-store.ts`
**Changes**: Keep the `event.stored` emission at line 548-561 since notificationDispatch will consume it. No change needed here.

#### 6. Re-create notificationDispatch
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts` (new file)
**Changes**: Minimal notification function triggered by `event.stored` instead of `event.interpreted`.

```typescript
import { notifications } from "@vendor/knock";
import { log } from "@vendor/observability/log";
import { inngest } from "../../client/client";

const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const notificationDispatch = inngest.createFunction(
  {
    id: "apps-console/notification.dispatch",
    name: "Notification Dispatch",
    description: "Dispatches high-significance event notifications via Knock",
    retries: 2,
    timeouts: { finish: "1m" },
  },
  { event: "apps-console/event.stored" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
    } = event.data;

    if (!clerkOrgId) {
      return { status: "skipped", reason: "no_clerk_org_id" };
    }

    if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
      };
    }

    if (!notifications) {
      return { status: "skipped", reason: "knock_not_configured" };
    }

    await step.run("trigger-knock-workflow", async () => {
      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: [{ id: clerkOrgId }],
        tenant: clerkOrgId,
        data: {
          eventExternalId,
          eventType: sourceType,
          significanceScore,
          workspaceId,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        eventExternalId,
        significanceScore,
      });
    });

    return { status: "sent", eventExternalId };
  }
);
```

**File**: `api/console/src/inngest/workflow/notifications/index.ts` (new file)
```typescript
export { notificationDispatch } from "./dispatch";
```

#### 7. Remove workspaceInterpretations table
**File**: `db/console/src/schema/tables/workspace-interpretations.ts`
**Action**: Delete file entirely.

**File**: `db/console/src/schema/relations.ts`
**Changes**: Remove `workspaceInterpretationsRelations` definition and the `interpretations: many(workspaceInterpretations)` from `workspaceEventsRelations`.

**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Remove exports for `workspaceInterpretations`, `WorkspaceInterpretation`, `InsertWorkspaceInterpretation`.

**File**: `db/console/src/schema/index.ts`
**Changes**: Remove re-export of `workspaceInterpretationsRelations` and table re-exports.

**File**: `db/console/src/index.ts`
**Changes**: Remove re-exports.

**Migration**: Run `cd db/console && pnpm db:generate` to generate DROP TABLE migration.

#### 8. Remove observation vector types from console-validation
**File**: `packages/console-validation/src/schemas/neural.ts`
**Changes**: Remove `observationVectorMetadataSchema`, `ObservationVectorMetadata`, `multiViewEmbeddingResultSchema`, `MultiViewEmbeddingResult`. Keep `SignificanceResult`, `EntityVectorMetadata`, `NeuralFailureOutput` (used by other consumers).

**File**: `packages/console-validation/src/schemas/classification.ts`
**Changes**: Delete file entirely (all exports — `classificationResponseSchema`, `primaryCategorySchema`, `PrimaryCategory`, `PRIMARY_CATEGORIES`, `ClassificationResponse` — have zero consumers outside event-interpret.ts).

**File**: `packages/console-validation/src/index.ts` and `packages/console-validation/src/schemas/index.ts`
**Changes**: Remove `export * from "./schemas/classification"` line. Update neural re-exports if needed.

#### 9. Update CLI script
**File**: `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts`
**Changes**: Remove `workspaceInterpretations` import and the join/query that reads `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (no dangling imports)
- [x] `pnpm check` passes (pre-existing lint errors in unrelated files, Phase 1 files are clean)
- [x] DB migration already generated: `db/console/src/migrations/0051_short_mimic.sql` (DROP workspace_interpretations)
- [ ] DB migration applies cleanly: `cd db/console && pnpm db:migrate`

#### Manual Verification:
- [ ] Inngest dashboard shows only 5 functions: eventStore, entityGraph, entityEmbed, notificationDispatch, recordActivity
- [ ] Processing a webhook event does NOT trigger eventInterpret (no LLM calls, no observation vectors)
- [ ] High-significance events (score >= 70) still trigger Knock notifications via notificationDispatch

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Remove Document Pipeline

### Overview
Delete processDocuments, deleteDocuments, their event schemas, and the knowledge document tables. Remove the stale contentsRouter and workspace document stats.

### Changes Required:

#### 1. Delete document processing files
**Delete files**:
- `api/console/src/inngest/workflow/processing/process-documents.ts`
- `api/console/src/inngest/workflow/processing/delete-documents.ts`

(The `processing/` directory can be removed entirely if empty after deletion.)

#### 2. Remove document event schemas (already done in Phase 1 step 4)
Verify `documents.process`, `documents.delete`, `relationships.extract` schemas are removed from `client.ts`.

#### 3. Remove contentsRouter
**File**: `api/console/src/router/org/contents.ts`
**Action**: Delete file entirely.

**File**: `api/console/src/root.ts`
**Changes**: Remove `contentsRouter` import and its mounting in the router tree.

#### 4. Remove workspace document stats
**File**: `api/console/src/router/org/workspace.ts`
**Changes**:
- Remove `workspaceKnowledgeDocuments` import (line 7)
- Remove the `leftJoin` on `workspaceKnowledgeDocuments` in `workspace.statistics` (lines 605-619)
- Remove `workspace.documents.stats` sub-procedure (lines 650-678)
- Remove `documentCount` from the statistics response

#### 5. Remove knowledge document tables
**File**: `db/console/src/schema/tables/workspace-knowledge-documents.ts`
**Action**: Delete file.

**File**: `db/console/src/schema/tables/workspace-knowledge-vector-chunks.ts`
**Action**: Delete file.

**File**: `db/console/src/schema/relations.ts`
**Changes**: Remove `workspaceKnowledgeDocumentsRelations` and `workspaceKnowledgeVectorChunksRelations` blocks. Remove `documents: many(workspaceKnowledgeDocuments)` and `vectorChunks: many(workspaceKnowledgeVectorChunks)` from `orgWorkspacesRelations`.

**File**: `db/console/src/schema/tables/index.ts`
**Changes**: Remove all exports for both tables.

**File**: `db/console/src/schema/index.ts` and `db/console/src/index.ts`
**Changes**: Remove all re-exports for both tables and their relations.

**Migration**: Run `cd db/console && pnpm db:generate` to generate DROP TABLE migration.

#### 6. Remove document validation schemas
**File**: `packages/console-validation/src/schemas/documents.ts`
**Changes**: Delete file (only consumer was process-documents.ts).

**File**: `packages/console-validation/src/index.ts`
**Changes**: Remove `export * from "./schemas/documents"`.

#### 7. Remove VectorMetadata type from console-pinecone
**File**: `packages/console-pinecone/src/types.ts`
**Changes**: Remove `VectorMetadata` type (only consumer was process-documents.ts).

**File**: `packages/console-pinecone/src/index.ts`
**Changes**: Remove `VectorMetadata` re-export.

#### 8. Update test mocks
**File**: `api/console/src/router/org/__tests__/notify-backfill.test.ts`
**Changes**: Remove `workspaceKnowledgeDocuments: {}` from the `@db/console/schema` mock (line 23).

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (8 pre-existing errors in untracked gateway test files, unrelated to Phase 2)
- [x] DB migration generates cleanly: `db/console/src/migrations/0052_past_harry_osborn.sql` (DROP workspace_knowledge_documents + workspace_knowledge_vector_chunks)
- [ ] DB migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Tests pass: `pnpm --filter @api/console test` (5 tests pass)

#### Manual Verification:
- [x] No references to `workspaceKnowledgeDocuments` or `workspaceKnowledgeVectorChunks` in codebase
- [ ] Inngest dashboard shows no document processing functions

**Note**: The contents API surface (SDK `client.ts:107`, MCP `server.ts:46`, OpenAPI `registry.ts:57`) references `ContentsRequestSchema`/`ContentsResponseSchema` from `@repo/console-validation`. These schemas are separate from the document pipeline and should be cleaned up in a follow-up if the contents endpoint is being permanently removed. Not in scope for this plan.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Significance as Flag, Not Gate

### Overview
Change significance scoring from a hard threshold that drops events before storage to a soft metadata annotation. All events are stored regardless of score. The score is persisted on the event row for downstream use (search ranking, filtering, notifications).

### Changes Required:

#### 1. Add significanceScore column to workspaceEvents
**File**: `db/console/src/schema/tables/workspace-events.ts`
**Changes**: Add a new column after `ingestionSource`:

```typescript
/**
 * Significance score (0-100) computed at ingestion time.
 * Used for search ranking and notification thresholds.
 * Null for events ingested before this column was added.
 */
significanceScore: integer("significance_score"),
```

**Migration**: Run `cd db/console && pnpm db:generate`.

#### 2. Remove the significance gate from eventStore
**File**: `api/console/src/inngest/workflow/neural/event-store.ts`
**Changes**:

Remove the gate block (lines 341-370):
```typescript
// REMOVE THIS ENTIRE BLOCK:
if (significance.score < SIGNIFICANCE_THRESHOLD) {
  // ... logs, completes job, returns early
}
```

Keep the `evaluate-significance` step (line 337-339) — we still compute the score, just don't gate on it.

#### 3. Store significance score on the event row
**File**: `api/console/src/inngest/workflow/neural/event-store.ts`
**Changes**: In the `store-observation` step (line 411), add `significanceScore` to the INSERT:

```typescript
const [obs] = await db
  .insert(workspaceEvents)
  .values({
    externalId,
    workspaceId,
    occurredAt: sourceEvent.occurredAt,
    observationType,
    title: sourceEvent.title,
    content: sourceEvent.body,
    source: sourceEvent.provider,
    sourceType: sourceEvent.eventType,
    sourceId: sourceEvent.sourceId,
    sourceReferences: sourceEvent.relations,
    metadata: sourceEvent.attributes,
    ingestionSource: event.data.ingestionSource ?? "webhook",
    significanceScore: significance.score, // NEW
  })
  .returning();
```

#### 4. Remove SIGNIFICANCE_THRESHOLD export (optional)
**File**: `api/console/src/inngest/workflow/neural/scoring.ts`
**Changes**: `SIGNIFICANCE_THRESHOLD` is no longer used as a gate. It can be removed or kept as documentation. The notification dispatch has its own threshold (70). Remove it to avoid confusion:

```typescript
// REMOVE:
export const SIGNIFICANCE_THRESHOLD = 40;
```

Remove the import in `event-store.ts`:
```typescript
// REMOVE from imports:
import { SIGNIFICANCE_THRESHOLD, scoreSignificance } from "./scoring";
// KEEP:
import { scoreSignificance } from "./scoring";
```

#### 5. Add significanceScore to EntityVectorMetadata
**File**: `packages/console-validation/src/schemas/neural.ts`
**Changes**: Add to `entityVectorMetadataSchema`:

```typescript
/** Significance score (0-100) from ingestion-time scoring */
significanceScore: z.number(),
```

**File**: `api/console/src/inngest/workflow/neural/entity-embed.ts`
**Changes**: In `upsert-entity-vector` step, add `significanceScore` to the metadata object. This requires passing the score through — the entity embed function would need to read the latest event's significance score. Simplest approach: add it to the Pinecone metadata from the latest event fetched in `fetch-narrative-inputs`.

Actually — entity-embed currently doesn't have access to the event's significance score. The cleanest approach: fetch the max significance score from the entity's recent events in the `fetch-narrative-inputs` step, and include it in metadata.

```typescript
// In fetch-narrative-inputs, add a 4th parallel query:
const maxSignificance = await db
  .select({ max: sql<number>`MAX(${workspaceEvents.significanceScore})` })
  .from(workspaceEntityEvents)
  .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
  .where(eq(workspaceEntityEvents.entityId, entity.id));
```

Then include `significanceScore: maxSignificance ?? 0` in the metadata object.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (10 pre-existing errors in untracked gateway test files, unrelated to Phase 3)
- [x] DB migration generates cleanly: `db/console/src/migrations/0053_demonic_miek.sql` (ADD COLUMN significance_score)
- [ ] DB migration applies cleanly: `cd db/console && pnpm db:migrate`

#### Manual Verification:
- [ ] Events with significance score < 40 are now stored in `workspaceEvents` (previously dropped)
- [ ] The `significanceScore` column is populated on new event rows
- [ ] Entity vectors in Pinecone include `significanceScore` in metadata
- [ ] Notifications still only fire for score >= 70 (notificationDispatch has its own threshold)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Expose Search Filters

### Overview
Wire up the Pinecone metadata fields that are already stored on entity vectors as search API filter options. Fix the router/searchLogic divergence.

### Changes Required:

#### 1. Add filter fields to SearchFiltersSchema
**File**: `packages/console-validation/src/schemas/api/common.ts`
**Changes**: Extend `SearchFiltersSchema`:

```typescript
export const SearchFiltersSchema = z.object({
  sourceTypes: z.array(z.string()).optional(),        // existing, unused
  observationTypes: z.array(z.string()).optional(),   // existing, unused
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),            // existing, unused in router
  }).optional(),
  // NEW filters:
  sources: z.array(z.string()).optional(),            // provider: github, vercel, sentry, linear
  entityTypes: z.array(z.string()).optional(),        // entityType: pr, commit, issue, etc.
}).optional();
```

Note: `sourceTypes` (existing) maps to event source types (e.g., "pull_request_merged"), while `sources` (new) maps to providers (e.g., "github"). Keep both for clarity.

#### 2. Apply filters in search router
**File**: `api/console/src/router/org/search.ts`
**Changes**: Build the Pinecone filter object using all available fields:

```typescript
// Build Pinecone filter
const filter: Record<string, unknown> = {
  layer: "entities",
};

// Date range (both start AND end)
if (input.filters?.dateRange?.start) {
  filter.occurredAt = {
    ...((filter.occurredAt as Record<string, unknown>) ?? {}),
    $gte: new Date(input.filters.dateRange.start).getTime(),
  };
}
if (input.filters?.dateRange?.end) {
  filter.occurredAt = {
    ...((filter.occurredAt as Record<string, unknown>) ?? {}),
    $lte: new Date(input.filters.dateRange.end).getTime(),
  };
}

// Provider filter
if (input.filters?.sources?.length) {
  filter.provider = { $in: input.filters.sources };
}

// Entity type filter
if (input.filters?.entityTypes?.length) {
  filter.entityType = { $in: input.filters.entityTypes };
}
```

#### 3. Align searchLogic with router
**File**: `apps/console/src/lib/search.ts`
**Changes**: Apply the same filter construction as the router (sources, entityTypes, full dateRange). Eliminate the divergence where searchLogic handles `dateRange.end` but the router doesn't.

#### 4. Update SearchResultSchema for significance
**File**: `packages/console-validation/src/schemas/api/search.ts`
**Changes**: Add optional `significanceScore` to `SearchResultSchema`:

```typescript
export const SearchResultSchema = EventBaseSchema.extend({
  snippet: z.string(),
  score: z.number(),
  latestAction: z.string().optional(),
  totalEvents: z.number().optional(),
  significanceScore: z.number().optional(),  // NEW
  entities: z.array(z.object({ key: z.string(), category: z.string() })).optional(),
  references: z.array(SourceReferenceSchema).optional(),
});
```

#### 5. Map significanceScore in search response
**File**: `api/console/src/router/org/search.ts`
**Changes**: In the result mapping (lines 160-179), add:

```typescript
significanceScore: match.metadata?.significanceScore != null
  ? Number(match.metadata.significanceScore)
  : undefined,
```

Same change in `apps/console/src/lib/search.ts`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [ ] Search API accepts `sources: ["github"]` filter and returns only GitHub entities
- [ ] Search API accepts `entityTypes: ["pr"]` filter and returns only PR entities
- [ ] Search API accepts `dateRange: { start, end }` and both bounds are applied
- [ ] Search results include `significanceScore` when available
- [ ] `searchLogic` and `searchRouter` produce identical filter behavior

**Implementation Note**: After completing this phase, all automated and manual verification should be done before considering the plan complete.

---

## Testing Strategy

### Integration Tests:
- Send a low-significance event (score < 40) and verify it IS stored in `workspaceEvents` (was previously dropped)
- Send a high-significance event (score >= 70) and verify Knock notification fires
- Search with `sources: ["github"]` filter and verify only GitHub entities returned
- Search with `dateRange: { start, end }` and verify both bounds applied

### Manual Testing Steps:
1. Trigger a webhook event and confirm only eventStore → entityGraph → entityEmbed runs (no eventInterpret)
2. Check Inngest dashboard for exactly 5 registered functions
3. Run a search query and verify entity results include `significanceScore`
4. Verify no `layer="observations"` vectors are being written to Pinecone

## Migration Notes

Two DB migrations required:
1. Phase 1+2: DROP `lightfast_workspace_interpretations`, DROP `lightfast_workspace_knowledge_documents`, DROP `lightfast_workspace_knowledge_vector_chunks`
2. Phase 3: ADD COLUMN `significance_score INTEGER` to `lightfast_workspace_events`

These can be combined into a single migration run. Use `cd db/console && pnpm db:generate` to auto-generate. **Never write manual .sql files.**

Existing data in the dropped tables will be lost. This is acceptable because:
- `workspaceInterpretations` data was never read at query time
- `workspaceKnowledgeDocuments` pipeline has no active emitters
- No user-facing feature depends on either table

## References

- Research document: `thoughts/shared/research/2026-03-14-inngest-pipeline-search-architecture-audit.md`
- `api/console/src/inngest/index.ts:65` — Function registry
- `api/console/src/inngest/workflow/neural/event-store.ts:341` — Significance gate to remove
- `api/console/src/inngest/workflow/neural/scoring.ts:23` — SIGNIFICANCE_THRESHOLD
- `api/console/src/router/org/search.ts:134` — Current Pinecone filter (entity layer only)
- `packages/console-validation/src/schemas/api/common.ts:17` — SearchFiltersSchema
- `packages/console-validation/src/schemas/neural.ts:62` — EntityVectorMetadata
