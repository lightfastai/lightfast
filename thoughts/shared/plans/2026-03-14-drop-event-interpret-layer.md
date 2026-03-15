# Drop eventInterpret Layer Implementation Plan

## Overview

Remove the entire interpretation slow path from the neural pipeline. This means deleting `eventInterpret`, `notificationDispatch`, the `workspaceInterpretations` table, all observation vector schemas, classification schemas, and every piece of infrastructure that exists only to support LLM-derived "fake" values. What remains is the pure event ingestion layer: `eventStore → entityGraph → entityEmbed`.

## Current State Analysis

The pipeline has two parallel tracks after `event.capture` arrives:

**Track A (keep)**: `eventStore` → `entity.upserted` → `entityGraph` → `entity.graphed` → `entityEmbed`
- Pure raw fact storage, rule-based entity extraction, deterministic narrative, single entity embedding
- Drives the search layer via `layer="entities"` Pinecone vectors

**Track B (remove)**: `eventStore` → `event.stored` → `eventInterpret` → `event.interpreted` → `notificationDispatch`
- LLM classification via Claude Haiku
- 3 observation Pinecone vectors per event (`layer="observations"`) — never queried at search
- `workspaceInterpretations` DB row — never read at search
- Knock notification for high-significance events — broken cascade since source is LLM-derived

### Key Discoveries

- `event-store.ts:548` — `event.stored` is emitted in the same `step.sendEvent` batch as `entity.upserted`. After removal, only `entity.upserted` is emitted.
- `client.ts:141` — `apps-console/event.stored` schema must be removed from `eventsMap`
- `client.ts:206` — `apps-console/event.interpreted` schema must be removed from `eventsMap`
- `client.ts:229` — `apps-console/notification.dispatch` schema is defined but never emitted — dead code, remove
- `classification.ts` in neural/ is exclusively consumed by `event-interpret.ts`
- `packages/console-validation/src/schemas/classification.ts` is exclusively consumed by `classification.ts` → `event-interpret.ts`
- `ObservationVectorMetadata` and `MultiViewEmbeddingResult` in `neural.ts` are exclusively consumed by `event-interpret.ts`
- `ClassificationInput` in `console-providers` is exclusively consumed by `classification.ts` → `event-interpret.ts`
- `reconcile-pinecone-external-ids.ts` exists solely to fix observation vector IDs — remove entirely
- `reset-demo.ts:86-90` has an observation layer Pinecone delete block — remove
- `notificationDispatch` has no other trigger path after `event.interpreted` is removed

## Desired End State

After this plan:
- 3 Inngest functions registered: `eventStore`, `entityGraph`, `entityEmbed` (+ `processDocuments`, `deleteDocuments`, `recordActivity`)
- 0 LLM calls in the event ingestion pipeline
- `workspaceInterpretations` table dropped from the database
- `layer="observations"` Pinecone vectors: no longer produced (existing ones orphaned in the index, cleared by next reset-demo run)
- No `event.stored` or `event.interpreted` or `notification.dispatch` in the Inngest event type map
- Search continues to work unchanged (already only queries `layer="entities"`)

### Verification
- `pnpm typecheck` passes — no references to removed types
- `pnpm check` passes — no lint errors
- `pnpm db:generate` produces a migration with `DROP TABLE lightfast_workspace_interpretations`
- `pnpm db:migrate` applies cleanly

## What We're NOT Doing

- Not changing the significance scoring in `event-store.ts` (rule-based, not LLM — this is not "fake")
- Not changing the entity narrative in `narrative-builder.ts` (deterministic string formatting of raw DB facts — not interpretation)
- Not changing the entity embedding in `entity-embed.ts` (embeds raw facts, not LLM-generated text)
- Not changing the search API in any way
- Not changing `processDocuments` or `deleteDocuments` pipelines
- Not removing the Knock client or notifications infrastructure (may be used for future notification patterns)
- Not changing the `notification.dispatch` event in the Inngest route handler — it simply won't be registered

---

## Phase 1: Remove Inngest Functions and Event Wiring

### Overview
Delete the `eventInterpret` and `notificationDispatch` Inngest functions. Update `event-store.ts` to stop emitting `event.stored`. Clean up all registrations, exports, and the event type map.

### Changes Required

#### 1. Delete function files

**Delete**: `api/console/src/inngest/workflow/neural/event-interpret.ts`

**Delete**: `api/console/src/inngest/workflow/neural/classification.ts`

**Delete**: `api/console/src/inngest/workflow/notifications/dispatch.ts`

**Delete**: `api/console/src/inngest/workflow/notifications/index.ts`

#### 2. Update neural barrel export

**File**: `api/console/src/inngest/workflow/neural/index.ts`

Remove `eventInterpret` export and simplify the docstring:

```typescript
/**
 * Neural Memory Workflows
 *
 * Event pipeline (three-function fast path):
 * 1. eventStore  - Fast path: store facts + entities + junctions (<2s)
 *                  Emits: entity.upserted → entityGraph
 * 2. entityGraph - Fast path: resolve entity↔entity edges via co-occurrence (<500ms)
 *                  Emits: entity.graphed → entityEmbed
 * 3. entityEmbed - Fast path: build narrative + embed to Pinecone layer="entities" (~2s, debounced 30s)
 */

export { entityEmbed } from "./entity-embed";
export { entityGraph } from "./entity-graph";
export { eventStore } from "./event-store";
```

#### 3. Update main Inngest index

**File**: `api/console/src/inngest/index.ts`

Remove `eventInterpret` and `notificationDispatch` from imports, exports, and the function registry. Update the JSDoc:

```typescript
/**
 * Inngest exports for console application
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { recordActivity } from "./workflow/infrastructure/record-activity";
import {
  entityEmbed,
  entityGraph,
  eventStore,
} from "./workflow/neural";
import { deleteDocuments } from "./workflow/processing/delete-documents";
import { processDocuments } from "./workflow/processing/process-documents";

export { inngest };
export { processDocuments, deleteDocuments };
export { recordActivity };
export { entityEmbed, entityGraph, eventStore };

/**
 * Create the route context for Next.js API routes
 *
 * Registered functions:
 * 1. processDocuments - Generic document processor (all sources)
 * 2. deleteDocuments - Generic document deleter (all sources)
 * 3. recordActivity - Activity logging
 * 4. eventStore - Event pipeline fast path (store facts + entities)
 * 5. entityGraph - Entity edge resolution via co-occurrence
 * 6. entityEmbed - Entity narrative embed to Pinecone layer="entities"
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      processDocuments,
      deleteDocuments,
      recordActivity,
      eventStore,
      entityGraph,
      entityEmbed,
    ],
    servePath: "/api/inngest",
  });
}
```

#### 4. Remove event.stored emission from event-store.ts

**File**: `api/console/src/inngest/workflow/neural/event-store.ts`

Update the `emit-downstream-events` step. The current code at line 531-580 emits both `event.stored` and conditionally `entity.upserted`. After the change, only emit `entity.upserted` (when a primary entity was upserted):

```typescript
// Build entity refs for entity-graph downstream step.
const entityRefs = [
  {
    type: sourceEvent.entity.entityType,
    key: sourceEvent.entity.entityId,
    label: null,
  },
  ...sourceEvent.relations.map((rel) => ({
    type: rel.entityType,
    key: rel.entityId,
    label: rel.relationshipType,
  })),
];

// Step 7: Emit entity.upserted (triggers entity-graph → entity-embed chain)
if (entityUpsertResult.primaryEntityExternalId) {
  await step.sendEvent("emit-downstream-events", {
    name: "apps-console/entity.upserted" as const,
    data: {
      workspaceId,
      entityExternalId: entityUpsertResult.primaryEntityExternalId,
      entityType: sourceEvent.entity.entityType,
      provider: sourceEvent.provider,
      internalEventId: observation.id,
      entityRefs,
      occurredAt: sourceEvent.occurredAt,
    },
  });
}
```

#### 5. Remove event schemas from Inngest client

**File**: `api/console/src/inngest/client/client.ts`

Remove three event definitions from `eventsMap`:
- `"apps-console/event.stored"` (lines 141–164) — was the trigger for eventInterpret
- `"apps-console/event.interpreted"` (lines 206–223) — was the output of eventInterpret
- `"apps-console/notification.dispatch"` (lines 229–242) — never emitted, dead code

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck --filter @api/console` passes — no references to removed event types
- [x] `pnpm check` passes — no lint errors (pre-existing formatting issues in unrelated files)
- [x] `pnpm build:console` passes (or equivalent type check)

#### Manual Verification
- [ ] Inngest dev dashboard no longer shows `apps-console/event.interpret` or `apps-console/notification.dispatch` functions
- [ ] Event ingestion still works — a webhook fires, event is stored, entity is upserted and embedded

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Drop Database Table and Relations

### Overview
Remove the `workspaceInterpretations` Drizzle schema, its relations, all exports throughout the DB package, and generate a DROP TABLE migration.

### Changes Required

#### 1. Delete schema file

**Delete**: `db/console/src/schema/tables/workspace-interpretations.ts`

#### 2. Update tables barrel

**File**: `db/console/src/schema/tables/index.ts`

Remove lines 71–76:
```typescript
// DELETE this block:
// Interpretations table
export {
  type InsertWorkspaceInterpretation,
  type WorkspaceInterpretation,
  workspaceInterpretations,
} from "./workspace-interpretations";
```

#### 3. Update relations file

**File**: `db/console/src/schema/relations.ts`

- Remove `import { workspaceInterpretations } from "./tables/workspace-interpretations";` (line 11)
- Remove `interpretations: many(workspaceInterpretations),` from `workspaceEventsRelations` (line 113)
- Remove the entire `workspaceInterpretationsRelations` export block (lines 119–131)

The `workspaceEventsRelations` after edit:
```typescript
export const workspaceEventsRelations = relations(
  workspaceEvents,
  ({ one, many }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceEvents.workspaceId],
      references: [orgWorkspaces.id],
    }),
    entityEvents: many(workspaceEntityEvents),
  })
);
```

#### 4. Update schema barrel

**File**: `db/console/src/schema/index.ts`

- Remove `workspaceInterpretationsRelations` from the relations export (line 13)
- Remove `type InsertWorkspaceInterpretation`, `type WorkspaceInterpretation`, `workspaceInterpretations` from the tables export (lines 50, 66, 83)
- Remove the comment `// Interpretations table` (line 82)

#### 5. Update package root export

**File**: `db/console/src/index.ts`

Remove:
- `type InsertWorkspaceInterpretation` (line 41)
- `type WorkspaceInterpretation` (line 58)
- `workspaceInterpretations` (line 79)
- `workspaceInterpretationsRelations` (line 80)
- The comment `// Interpretations table` (line 78)

#### 6. Generate migration

```bash
cd db/console && pnpm db:generate
```

Drizzle will detect the dropped table and generate a migration containing `DROP TABLE "lightfast_workspace_interpretations"`. Review the generated SQL to confirm it only drops this table.

### Success Criteria

#### Automated Verification
- [x] `pnpm db:generate` (from `db/console/`) generates a migration with `DROP TABLE lightfast_workspace_interpretations`
- [ ] `pnpm db:migrate` applies cleanly against the dev database (blocked by pre-existing migration 0039 failure — unrelated to these changes)
- [x] `pnpm typecheck --filter @db/console` passes — no references to removed exports
- [x] `pnpm typecheck` (workspace-wide) passes — no consumers of removed types

#### Manual Verification
- [ ] `pnpm db:studio` — confirm `lightfast_workspace_interpretations` table no longer exists

---

## Phase 3: Remove Validation Schemas and Types

### Overview
Remove classification schemas, observation vector metadata types, and the `ClassificationInput` type from packages. These are all exclusively consumed by the code deleted in Phase 1.

### Changes Required

#### 1. Delete classification schema file

**Delete**: `packages/console-validation/src/schemas/classification.ts`

#### 2. Update console-validation schema barrel

**File**: `packages/console-validation/src/schemas/index.ts`

Remove line 9:
```typescript
// DELETE:
export * from "./classification";
```

#### 3. Update console-validation root export

**File**: `packages/console-validation/src/index.ts`

Remove line 166:
```typescript
// DELETE:
export * from "./schemas/classification";
```

#### 4. Remove observation schemas from neural.ts

**File**: `packages/console-validation/src/schemas/neural.ts`

Remove lines 12–51 (the observation vector metadata schema and multi-view embedding result schema). Keep `significanceResultSchema`, `entityVectorMetadataSchema`, and `neuralFailureOutputSchema`.

Result after edit:
```typescript
import { z } from "zod";

// ── Significance Scoring ──────────────────────────────────────────────────────

export const significanceResultSchema = z.object({
  factors: z.array(z.string()),
  score: z.number(),
});

export type SignificanceResult = z.infer<typeof significanceResultSchema>;

// ── Entity Vector Metadata ────────────────────────────────────────────────────

/**
 * Pinecone vector metadata for entity narrative embeddings (layer="entities").
 *
 * occurredAt and createdAt are Unix timestamps in milliseconds — use numbers
 * for reliable Pinecone range filter operators ($gte / $lte). ISO strings sort
 * incorrectly for non-UTC timezone variants.
 */
export const entityVectorMetadataSchema = z
  .object({
    layer: z.literal("entities"),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    /** Last known action derived from latest event's sourceType, e.g. "merged" */
    latestAction: z.string(),
    title: z.string(),
    snippet: z.string(),
    /** Unix timestamp in milliseconds of latest event for this entity */
    occurredAt: z.number(),
    /** Unix timestamp in milliseconds of entity.extractedAt (first seen) */
    createdAt: z.number(),
    /** SHA-256 prefix of narrative text for content-dedup */
    narrativeHash: z.string(),
    /** Total number of events seen for this entity (entity.occurrenceCount) */
    totalEvents: z.number(),
  })
  .catchall(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
  );

export type EntityVectorMetadata = z.infer<typeof entityVectorMetadataSchema>;

// ── Neural Failure Output ─────────────────────────────────────────────────────

export const neuralFailureOutputSchema = z
  .object({
    error: z.string(),
    inngestFunctionId: z.string(),
    status: z.literal("failure"),
  })
  .catchall(z.unknown());

export type NeuralFailureOutput = z.infer<typeof neuralFailureOutputSchema>;
```

#### 5. Remove ClassificationInput from console-providers

**File**: `packages/console-providers/src/post-transform-event.ts`

Remove lines 49–57 (the `ClassificationInput` export):
```typescript
// DELETE this block:
/**
 * Narrow input type for classification functions.
 * These functions only need provider, eventType, title, body — not the full event.
 * Eliminates the `as unknown as PostTransformEvent` double cast in event-interpret.ts.
 */
export type ClassificationInput = Pick<
  PostTransformEvent,
  "provider" | "eventType" | "title" | "body"
>;
```

**File**: `packages/console-providers/src/index.ts`

Remove `ClassificationInput` from the type export (line 35):
```typescript
// BEFORE:
export type {
  ClassificationInput,
  EntityRef,
  EntityRelation,
  PostTransformEvent,
} from "./post-transform-event";

// AFTER:
export type {
  EntityRef,
  EntityRelation,
  PostTransformEvent,
} from "./post-transform-event";
```

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` (workspace-wide) passes
- [x] `pnpm check` passes — no lint errors (pre-existing formatting issues unrelated)
- [x] `pnpm build:console` (or `pnpm --filter @api/console build`) passes

---

## Phase 4: Clean Up CLI Tools and Reset Scripts

### Overview
Remove the `reconcile-pinecone-external-ids.ts` CLI tool (only purpose was reconciling observation vector metadata) and remove the observation layer Pinecone delete from `reset-demo.ts`.

### Changes Required

#### 1. Delete reconcile CLI

**Delete**: `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts`

Check if this file is referenced in a CLI entrypoint or `package.json` script and remove the reference:

```bash
grep -r "reconcile-pinecone" packages/console-test-data/
```

#### 2. Update reset-demo.ts

**File**: `packages/console-test-data/src/cli/reset-demo.ts`

Remove the observation layer Pinecone delete block (lines 82–97):
```typescript
// DELETE this block:
if (settings?.embedding) {
  console.log("\n🗑️  Clearing Pinecone vectors...");
  const { indexName, namespaceName } = settings.embedding;
  try {
    await pineconeClient.deleteByMetadata(
      indexName,
      { layer: { $eq: "observations" } },
      namespaceName
    );
    console.log(`   ✓ Cleared vectors from ${indexName}/${namespaceName}`);
  } catch (error) {
    console.log(
      `   ⚠ Could not clear Pinecone: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

Note: Existing observation vectors in Pinecone are not worth actively purging — they will eventually be evicted or can be cleared via Pinecone dashboard. The reset script no longer produces new ones so no cleanup is needed going forward.

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck --filter @repo/console-test-data` passes
- [x] `pnpm check` passes

#### Manual Verification
- [ ] `reset-demo` script runs without errors against dev environment

---

## Testing Strategy

### Automated
- `pnpm typecheck` — confirms all removed types have no remaining consumers
- `pnpm check` — no lint errors from missing imports
- `pnpm db:generate` + `pnpm db:migrate` — confirms schema change is clean
- `pnpm build:console` — full Next.js build confirms no runtime import errors

### Manual
1. Fire a test webhook through the relay — confirm the event is captured, stored, entity is upserted, entity is embedded (check Inngest dashboard)
2. Confirm `apps-console/event.interpret` and `apps-console/notification.dispatch` no longer appear in Inngest function list
3. Confirm search still returns entity results for existing data
4. Confirm `workspaceInterpretations` table no longer exists in DB Studio

## References

- Research doc: `thoughts/shared/research/2026-03-14-inngest-pipeline-search-architecture-audit.md`
- `api/console/src/inngest/workflow/neural/event-store.ts:546` — current event.stored emission
- `api/console/src/inngest/workflow/neural/event-interpret.ts:89` — function being removed
- `api/console/src/inngest/workflow/notifications/dispatch.ts:23` — function being removed
- `api/console/src/inngest/client/client.ts:141` — event schemas being removed
- `db/console/src/schema/tables/workspace-interpretations.ts` — table being dropped
- `packages/console-validation/src/schemas/classification.ts` — schema being removed
- `packages/console-validation/src/schemas/neural.ts:14` — observation schemas being removed
- `packages/console-providers/src/post-transform-event.ts:54` — ClassificationInput being removed
