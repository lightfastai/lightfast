# Pipeline Restructure v2: Entity↔Entity Edges, Table Renames, and Naming Migration

## Overview

Replace observation↔observation edges with entity↔entity edges, rename all five pipeline tables to the new `events/entities/edges/entity_events/interpretations` names, and migrate all consumers. This is a clean break — pre-production, no user data, no aliases needed.

Based on research: `thoughts/shared/research/2026-03-12-pipeline-restructure-v2.md`
Supersedes: `thoughts/shared/plans/2026-03-12-pipeline-restructure.md` (v1 — fully implemented)

## Current State Analysis

The v1 plan is fully implemented on `feat/backfill-depth-entitytypes-run-tracking`. The codebase has:
- `observation-store.ts` + `observation-interpret.ts` (split pipeline)
- `workspace_observation_interpretations` table (versioned AI outputs)
- `workspace_entity_observations` junction table (entity↔observation links)
- `edge-resolver.ts` with entity-mediated co-occurrence discovery
- Edge rules on all 4 providers (GitHub, Vercel, Sentry, Linear)

### Key Discoveries:
- **Edge direction is wrong**: `edge-resolver.ts:178-191` writes to `workspaceObservationRelationships` (obs↔obs). Must become entity↔entity edges in `workspace_edges`.
- **Naming collision**: `workspace_events` already exists as raw webhook ingress log (`workspace-events.ts:25`). Must rename it before `workspace_neural_observations` can take the name.
- **Edge rules need cross-type matching**: Current rules match `commit→commit` across providers, creating self-edges under entity↔entity. Must update to `commit→deployment`, `commit→issue`, etc.
- **35 files need changes** (not ~25 as research estimated). Additional files found:
  - `apps/console/src/lib/neural/url-resolver.ts:10,124,127-128,130`
  - `packages/console-validation/src/schemas/workflow-io.ts:9,49,62,74`
  - `packages/console-test-data/src/cli/reset-demo.ts:17-19,43-54,104-117`
  - `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts:15-16,103-119`
  - `packages/console-test-data/src/trigger/trigger.ts:67`
  - `api/console/src/inngest/workflow/neural/on-failure-handler.ts:15,20,44`

## Desired End State

Five cleanly-named tables:

| New pgTable name | New TS export | Replaces |
|---|---|---|
| `lightfast_workspace_events` | `workspaceEvents` | `lightfast_workspace_neural_observations` |
| `lightfast_workspace_entities` | `workspaceEntities` | `lightfast_workspace_neural_entities` |
| `lightfast_workspace_edges` | `workspaceEdges` | `lightfast_workspace_observation_relationships` (NEW schema) |
| `lightfast_workspace_entity_events` | `workspaceEntityEvents` | `lightfast_workspace_entity_observations` |
| `lightfast_workspace_interpretations` | `workspaceInterpretations` | `lightfast_workspace_observation_interpretations` |

Plus `lightfast_workspace_ingest_log` (renamed from current `lightfast_workspace_events`).

Entity↔entity edges with provenance. Inngest events: `event.capture` → `event.stored` → `event.interpreted`.

### Verification
```bash
pnpm check && pnpm typecheck
pnpm build:console
```
- Send test webhooks → verify entity↔entity edges in `workspace_edges`
- Verify `/v1/graph` returns correct entity-mediated graph
- Verify `/v1/related`, `/v1/search`, `/v1/findsimilar` work
- Grep for old identifiers (`workspaceNeuralObservations`, `observation.capture`, etc.) — zero matches outside migration files

## What We're NOT Doing

- L1 semantic entities (Change, Incident, Release)
- AI-discovered edges (confidence-gated)
- Graph query API redesign (response shape unchanged)
- Actor profile/resolution layer
- `EntityCategory` Zod schema change (keep `z.enum`, consider `z.string()` later)
- Bidirectional edge storage (BFS query handles direction with `OR`)
- Updating `workspace.events.list` tRPC to query processed events (separate scope)

## Implementation Approach

7 phases, ordered by dependency. Each is independently deployable and verifiable. Phases 0-4 are structural changes. Phases 5-6 are mechanical renames.

---

## Phase 0: Rename `workspace_events` → `workspace_ingest_log`

### Overview
Resolve the naming collision. The existing `workspace_events` table (raw webhook ingress log) must be renamed before `workspace_neural_observations` can take the `workspace_events` name.

### Changes Required

#### 1. Rename schema file and exports
**File**: `db/console/src/schema/tables/workspace-events.ts` → rename to `workspace-ingest-log.ts`

Changes inside the file:
- `pgTable("lightfast_workspace_events", ...)` → `pgTable("lightfast_workspace_ingest_log", ...)`
- `export const workspaceEvents` → `export const workspaceIngestLog`
- `WorkspaceEvent` → `WorkspaceIngestLogEntry`
- `InsertWorkspaceEvent` → `InsertWorkspaceIngestLogEntry`

#### 2. Update barrel exports
**File**: `db/console/src/schema/tables/index.ts:47`
```typescript
// Old
export { ... } from "./workspace-events";
// New
export {
  type InsertWorkspaceIngestLogEntry,
  type WorkspaceIngestLogEntry,
  workspaceIngestLog,
} from "./workspace-ingest-log";
```

**File**: `db/console/src/schema/index.ts:79`
- Update re-export: `workspaceEvents` → `workspaceIngestLog`

**File**: `db/console/src/index.ts:62`
- Update re-export: `workspaceEvents` → `workspaceIngestLog`

#### 3. Update consumers (4 files)

**File**: `apps/console/src/app/api/gateway/ingress/route.ts:2,72,82`
- Import `workspaceIngestLog` instead of `workspaceEvents`
- Update all references: `workspaceEvents.` → `workspaceIngestLog.`

**File**: `apps/console/src/app/api/gateway/stream/route.ts:2,95-106`
- Import `workspaceIngestLog` instead of `workspaceEvents`
- Update all references

**File**: `api/console/src/router/org/workspace.ts:5,1254-1286`
- Import `workspaceIngestLog` instead of `workspaceEvents`
- Update all references in the `events.list` procedure

**File**: `api/console/src/router/org/__tests__/notify-backfill.test.ts:27`
- Update mock key: `workspaceEvents: {}` → `workspaceIngestLog: {}`

#### 4. Update relations
**File**: `db/console/src/schema/relations.ts`
- If there are any relation definitions referencing `workspaceEvents`, update to `workspaceIngestLog`

#### 5. Generate migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`
- [x] Grep confirms zero remaining `workspaceEvents` references in non-migration files (except the schema file that will later take this name)

#### Manual Verification:
- [ ] SSE stream endpoint still works (stream/route.ts)
- [ ] `workspace.events.list` tRPC still returns data
- [ ] Webhook ingress writes to renamed table

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 1: Create `workspace_edges` Table

### Overview
Create the new entity↔entity edges table without dropping the old one. Purely additive — no consumers yet.

### Changes Required

#### 1. Create new schema file
**File**: `db/console/src/schema/tables/workspace-edges.ts` (NEW)

```typescript
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralEntities } from "./workspace-neural-entities";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Entity↔entity directed edges.
 *
 * Replaces observation↔observation edges. Relationships exist between
 * entities (e.g., commit deploys deployment), not between events.
 * The sourceEventId provides provenance — which event caused this edge.
 */
export const workspaceEdges = pgTable(
  "lightfast_workspace_edges",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    sourceEntityId: bigint("source_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralEntities.id, { onDelete: "cascade" }),

    targetEntityId: bigint("target_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralEntities.id, { onDelete: "cascade" }),

    relationshipType: varchar("relationship_type", { length: 50 }).notNull(),

    sourceEventId: bigint("source_event_id", { mode: "number" })
      .references(() => workspaceNeuralObservations.id, { onDelete: "set null" }),

    confidence: real().default(1.0).notNull(),

    metadata: jsonb().$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("edge_external_id_idx").on(table.externalId),
    sourceIdx: index("edge_source_idx").on(
      table.workspaceId,
      table.sourceEntityId
    ),
    targetIdx: index("edge_target_idx").on(
      table.workspaceId,
      table.targetEntityId
    ),
    uniqueEdgeIdx: uniqueIndex("edge_unique_idx").on(
      table.workspaceId,
      table.sourceEntityId,
      table.targetEntityId,
      table.relationshipType
    ),
    sourceEventIdx: index("edge_source_event_idx").on(table.sourceEventId),
  })
);

export type WorkspaceEdge = typeof workspaceEdges.$inferSelect;
export type InsertWorkspaceEdge = typeof workspaceEdges.$inferInsert;
```

**Note**: FKs reference current table names (`workspaceNeuralEntities`, `workspaceNeuralObservations`). These will be renamed in Phase 5 but Drizzle FK references are by variable, not by string — so renaming the variable later automatically updates the FK target.

#### 2. Update barrel exports
**File**: `db/console/src/schema/tables/index.ts` — add:
```typescript
export {
  type InsertWorkspaceEdge,
  type WorkspaceEdge,
  workspaceEdges,
} from "./workspace-edges";
```

**File**: `db/console/src/schema/index.ts` — add re-export for `workspaceEdges` and `workspaceEdgesRelations`

**File**: `db/console/src/index.ts` — add re-export for `workspaceEdges`, `WorkspaceEdge`, `InsertWorkspaceEdge`

#### 3. Add relations
**File**: `db/console/src/schema/relations.ts` — add:
```typescript
import { workspaceEdges } from "./tables/workspace-edges";

export const workspaceEdgesRelations = relations(
  workspaceEdges,
  ({ one }) => ({
    workspace: one(orgWorkspaces, {
      fields: [workspaceEdges.workspaceId],
      references: [orgWorkspaces.id],
    }),
    sourceEntity: one(workspaceNeuralEntities, {
      fields: [workspaceEdges.sourceEntityId],
      references: [workspaceNeuralEntities.id],
    }),
    targetEntity: one(workspaceNeuralEntities, {
      fields: [workspaceEdges.targetEntityId],
      references: [workspaceNeuralEntities.id],
    }),
    sourceEvent: one(workspaceNeuralObservations, {
      fields: [workspaceEdges.sourceEventId],
      references: [workspaceNeuralObservations.id],
    }),
  })
);
```

#### 4. Generate migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Drizzle Studio shows new empty `lightfast_workspace_edges` table

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Update Edge Rules + Edge Resolver for Entity↔Entity

### Overview
Update provider edge rules for cross-entity-type matching and rewrite `edge-resolver.ts` to find entity IDs for both events' refs, evaluate cross-entity-type rules, and write to `workspaceEdges`.

This is the highest-complexity phase. The old `workspaceObservationRelationships` table continues to exist but is no longer written to.

### Changes Required

#### 1. Update edge rules on all 4 providers

The current rules match same-category pairs (e.g., `commit→commit`), which creates self-edges under entity↔entity since both events reference the same entity. Rules must match cross-category pairs.

**File**: `packages/console-providers/src/providers/github/index.ts:343-395`

Replace `edgeRules` array:
```typescript
edgeRules: [
  // GitHub commit deploys to Vercel deployment
  { refType: "commit", matchProvider: "vercel", matchRefType: "deployment", relationshipType: "deploys", confidence: 1.0 },
  // GitHub commit resolves Sentry issue (when commit has "resolved_by" label)
  { refType: "commit", selfLabel: "resolved_by", matchProvider: "sentry", matchRefType: "issue", relationshipType: "resolves", confidence: 1.0 },
  // GitHub PR tracked in Linear issue
  { refType: "pr", matchProvider: "linear", matchRefType: "issue", relationshipType: "tracked_in", confidence: 1.0 },
  // GitHub issue fixes another issue (cross-tool, when labeled "fixes")
  { refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue", relationshipType: "fixes", confidence: 1.0 },
  // GitHub issue references another issue (cross-tool)
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
],
```

**Removed rules**: `same_commit` and `same_branch` — under entity↔entity, co-occurrence on the same entity is implicit in the junction table.

**File**: `packages/console-providers/src/providers/vercel/index.ts:173-195`

Replace `edgeRules` array:
```typescript
edgeRules: [
  // Vercel deployment deploys GitHub commit
  { refType: "deployment", matchProvider: "github", matchRefType: "commit", relationshipType: "deploys", confidence: 1.0 },
],
```

**Removed rules**: `same_commit` (self-edge), `deployment→deployment` (rarely useful).

**File**: `packages/console-providers/src/providers/sentry/index.ts:193-209`

Replace `edgeRules` array:
```typescript
edgeRules: [
  // Sentry issue resolved by commit (when commit has "resolved_by" label)
  { refType: "issue", matchProvider: "*", matchRefType: "commit", relationshipType: "resolves", confidence: 1.0 },
  // Sentry issue triggers Linear issue
  { refType: "issue", matchProvider: "linear", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
],
```

**Changed**: First rule now matches `issue→commit` instead of `commit→commit`. The `selfLabel` moves to a different evaluation — see algorithm changes below.

**File**: `packages/console-providers/src/providers/linear/index.ts:293-323`

Replace `edgeRules` array:
```typescript
edgeRules: [
  // Linear issue linked to Sentry issue
  { refType: "issue", selfLabel: "linked", matchProvider: "sentry", matchRefType: "issue", relationshipType: "triggers", confidence: 0.8 },
  // Linear issue tracked in GitHub PR
  { refType: "issue", matchProvider: "github", matchRefType: "pr", relationshipType: "tracked_in", confidence: 1.0 },
  // Linear issue references another issue (cross-tool)
  { refType: "issue", matchProvider: "*", matchRefType: "issue", relationshipType: "references", confidence: 0.8 },
],
```

**Removed**: `same_branch` (self-edge under entity↔entity). Changed `pr→pr` to `issue→pr`.

#### 2. Rewrite `edge-resolver.ts`

**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

The core algorithm change:

**Current flow** (obs↔obs):
1. Find entities for our observation
2. Find co-occurring observations via shared entities in junction table
3. For shared entity, match rules where `refType == matchRefType == shared entity category`
4. Write obs↔obs edges

**New flow** (entity↔entity):
1. Find entities for our event (same)
2. Find co-occurring events via shared entities (same)
3. For each co-occurring event, load ALL its entity refs from junction table
4. For each pair of (our entity, their entity), if different entities, evaluate rules
5. Write entity↔entity edges with `sourceEventId` provenance

```typescript
import { db } from "@db/console/client";
import {
  workspaceEdges,
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { PROVIDERS } from "@repo/console-providers";
import type { EdgeRule } from "@repo/console-providers";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const STRUCTURAL_TYPES = ["commit", "branch", "pr", "issue", "deployment"];

/**
 * Resolve entity↔entity edges for a newly processed event.
 *
 * Algorithm:
 * 1. Find entities for our event's structural refs
 * 2. Find co-occurring events via shared entities in junction table
 * 3. For each co-occurring event, load ALL its entity refs
 * 4. Enumerate cross-entity-type pairs, evaluate rules
 * 5. Insert entity↔entity edges
 */
export async function resolveEdges(
  workspaceId: string,
  eventId: number,
  source: string,
  entityRefs: Array<{ type: string; key: string; label: string | null }>
): Promise<number> {
  // 1. Filter to structural refs only
  const structuralRefs = entityRefs.filter((r) =>
    STRUCTURAL_TYPES.includes(r.type)
  );
  if (structuralRefs.length === 0) return 0;

  // 2. Find entity IDs for our refs
  const entityConditions = structuralRefs.map(
    (ref) =>
      sql`(${workspaceNeuralEntities.category} = ${ref.type} AND ${workspaceNeuralEntities.key} = ${ref.key})`
  );

  const ourEntities = await db
    .select({
      id: workspaceNeuralEntities.id,
      category: workspaceNeuralEntities.category,
      key: workspaceNeuralEntities.key,
    })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (ourEntities.length === 0) return 0;

  const ourEntityIds = ourEntities.map((e) => e.id);
  const ourEntityMap = new Map(ourEntities.map((e) => [e.id, e]));

  // Build ref label map: (category, key) → label
  const refLabelMap = new Map(
    structuralRefs
      .filter((r) => r.label)
      .map((r) => [`${r.type}:${r.key}`, r.label])
  );

  // 3. Find co-occurring events via junction table
  const coOccurring = await db
    .select({
      observationId: workspaceEntityObservations.observationId,
      entityId: workspaceEntityObservations.entityId,
    })
    .from(workspaceEntityObservations)
    .where(
      and(
        inArray(workspaceEntityObservations.entityId, ourEntityIds),
        ne(workspaceEntityObservations.observationId, eventId)
      )
    )
    .limit(100);

  if (coOccurring.length === 0) return 0;

  // 4. Get unique co-occurring event IDs and their sources
  const coEventIds = [...new Set(coOccurring.map((c) => c.observationId))];

  const coEvents = await db
    .select({
      id: workspaceNeuralObservations.id,
      source: workspaceNeuralObservations.source,
    })
    .from(workspaceNeuralObservations)
    .where(inArray(workspaceNeuralObservations.id, coEventIds));

  const coEventSourceMap = new Map(coEvents.map((e) => [e.id, e.source]));

  // 5. Load ALL entity refs for co-occurring events
  const coEventEntityJunctions = await db
    .select({
      observationId: workspaceEntityObservations.observationId,
      entityId: workspaceEntityObservations.entityId,
      refLabel: workspaceEntityObservations.refLabel,
    })
    .from(workspaceEntityObservations)
    .where(inArray(workspaceEntityObservations.observationId, coEventIds));

  // Load entity details for co-occurring events' entities
  const coEntityIds = [
    ...new Set(coEventEntityJunctions.map((j) => j.entityId)),
  ];
  const allCoEntities = await db
    .select({
      id: workspaceNeuralEntities.id,
      category: workspaceNeuralEntities.category,
      key: workspaceNeuralEntities.key,
    })
    .from(workspaceNeuralEntities)
    .where(inArray(workspaceNeuralEntities.id, coEntityIds));

  const coEntityMap = new Map(allCoEntities.map((e) => [e.id, e]));

  // Group co-event junctions by event ID
  const coEventEntitiesMap = new Map<
    number,
    Array<{ entityId: number; category: string; key: string; refLabel: string | null }>
  >();
  for (const j of coEventEntityJunctions) {
    const entity = coEntityMap.get(j.entityId);
    if (!entity) continue;
    const arr = coEventEntitiesMap.get(j.observationId) ?? [];
    arr.push({
      entityId: j.entityId,
      category: entity.category,
      key: entity.key,
      refLabel: j.refLabel,
    });
    coEventEntitiesMap.set(j.observationId, arr);
  }

  // 6. Evaluate cross-entity-type rules
  const myRules = getEdgeRules(source);

  interface EdgeCandidate {
    sourceEntityId: number;
    targetEntityId: number;
    relationshipType: string;
    confidence: number;
  }

  const candidates: EdgeCandidate[] = [];

  for (const coEventId of coEventIds) {
    const otherSource = coEventSourceMap.get(coEventId);
    if (!otherSource) continue;

    const otherEntities = coEventEntitiesMap.get(coEventId) ?? [];
    const otherRules = getEdgeRules(otherSource);

    // Enumerate all pairs: (our entity, their entity)
    for (const ourEntity of ourEntities) {
      const ourLabel =
        refLabelMap.get(`${ourEntity.category}:${ourEntity.key}`) ?? null;

      for (const theirEntity of otherEntities) {
        // Skip self-edges (same entity)
        if (ourEntity.id === theirEntity.entityId) continue;

        // Try our rules first, then their rules
        const rule =
          findBestRule(
            myRules,
            ourEntity.category,
            ourLabel,
            otherSource,
            theirEntity.category
          ) ??
          findBestRule(
            otherRules,
            theirEntity.category,
            theirEntity.refLabel,
            source,
            ourEntity.category
          );

        if (rule) {
          candidates.push({
            sourceEntityId: ourEntity.id,
            targetEntityId: theirEntity.entityId,
            relationshipType: rule.relationshipType,
            confidence: rule.confidence,
          });
        }
      }
    }
  }

  // 7. Deduplicate: keep highest confidence per (source, target, type)
  const deduped = deduplicateEdgeCandidates(candidates);
  if (deduped.length === 0) return 0;

  // 8. Insert entity↔entity edges
  const inserts = deduped.map((edge) => ({
    externalId: nanoid(),
    workspaceId,
    sourceEntityId: edge.sourceEntityId,
    targetEntityId: edge.targetEntityId,
    relationshipType: edge.relationshipType,
    sourceEventId: eventId,
    confidence: edge.confidence,
    metadata: { detectionMethod: "entity_cooccurrence" },
  }));

  try {
    await db.insert(workspaceEdges).values(inserts).onConflictDoNothing();
    log.info("Entity edges created", {
      eventId,
      count: inserts.length,
    });
    return inserts.length;
  } catch (error) {
    log.error("Failed to create entity edges", { error, workspaceId });
    return 0;
  }
}

function getEdgeRules(source: string): EdgeRule[] {
  const provider = Object.values(PROVIDERS).find((p) => p.name === source);
  return provider?.edgeRules ?? [];
}

function findBestRule(
  rules: EdgeRule[],
  refType: string,
  selfLabel: string | null,
  matchProvider: string,
  matchRefType: string
): EdgeRule | null {
  const candidates = rules.filter(
    (r) => r.refType === refType && r.matchRefType === matchRefType
  );

  // 1. selfLabel + specific provider
  if (selfLabel) {
    const labelSpecific = candidates.find(
      (r) => r.selfLabel === selfLabel && r.matchProvider === matchProvider
    );
    if (labelSpecific) return labelSpecific;

    // 2. selfLabel + wildcard provider
    const labelWild = candidates.find(
      (r) => r.selfLabel === selfLabel && r.matchProvider === "*"
    );
    if (labelWild) return labelWild;
  }

  // 3. No selfLabel + specific provider
  const noLabelSpecific = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === matchProvider
  );
  if (noLabelSpecific) return noLabelSpecific;

  // 4. No selfLabel + wildcard
  const noLabelWild = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === "*"
  );
  return noLabelWild ?? null;
}

function deduplicateEdgeCandidates(
  candidates: EdgeCandidate[]
): EdgeCandidate[] {
  const byKey = new Map<string, EdgeCandidate>();
  for (const c of candidates) {
    const key = `${c.sourceEntityId}-${c.targetEntityId}-${c.relationshipType}`;
    const existing = byKey.get(key);
    if (!existing || c.confidence > existing.confidence) {
      byKey.set(key, c);
    }
  }
  return Array.from(byKey.values());
}
```

#### 3. Update `observation-interpret.ts` resolve-edges step

**File**: `api/console/src/inngest/workflow/neural/observation-interpret.ts:384`

The `resolveEdges` call signature is unchanged (`workspaceId, internalObservationId, obs.source, entityRefs`). The import already points to `edge-resolver.ts`. No changes needed in this file — the edge-resolver internally switches to writing `workspaceEdges`.

#### 4. Update `detectedRelationshipSchema` (if used)

**File**: `packages/console-validation/src/schemas/neural.ts:66-75`

The `detectedRelationshipSchema` has `targetObservationId`. This type is used internally by `edge-resolver.ts` for the intermediate detection result. Since we're rewriting the resolver, this type is no longer needed — the resolver uses its own `EdgeCandidate` interface. Check if anything else uses `DetectedRelationship` and update/remove accordingly.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Send GitHub push + Vercel deployment with same commit → verify `deploys` edge in `workspace_edges` (entity:commit → entity:deployment)
- [ ] Send Sentry issue with `resolved_by` commit + GitHub push → verify `resolves` edge
- [ ] Verify out-of-order: send Vercel deployment first, then GitHub push → edge still created
- [ ] Old `workspace_observation_relationships` table is no longer written to (new edges go to `workspace_edges` only)

**Implementation Note**: At this point, `workspace_observation_relationships` still exists and `graph.ts`/`related.ts` still read from it. New edges are written to `workspace_edges` but not yet consumed. This is the coexistence period. After manual confirmation, proceed to Phase 3.

---

## Phase 3: Update Graph Traversal

### Overview
Switch `graph.ts` and `related.ts` from `workspaceObservationRelationships` (obs↔obs BFS) to `workspaceEdges` (entity-mediated BFS). API response shape unchanged.

### Changes Required

#### 1. Rewrite `graph.ts` BFS

**File**: `apps/console/src/lib/v1/graph.ts:63-183`

**Current**: BFS over `workspaceObservationRelationships` with obs ID frontier.

**New**: Entity-mediated BFS:
1. Find root event by externalId
2. Get entities for root event via `workspaceEntityObservations`
3. BFS over `workspaceEdges` with entity ID frontier
4. For each edge, resolve entities back to events via `workspaceEntityObservations`
5. Fetch event details for response nodes

```typescript
// New imports
import {
  workspaceEdges,
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";

// BFS pseudocode:
// 1. Root event lookup (unchanged)
const rootEvent = await db.query.workspaceNeuralObservations.findFirst({
  where: and(
    eq(workspaceNeuralObservations.workspaceId, workspaceId),
    eq(workspaceNeuralObservations.externalId, id)
  ),
});

// 2. Get root event's entities
const rootJunctions = await db
  .select({ entityId: workspaceEntityObservations.entityId })
  .from(workspaceEntityObservations)
  .where(eq(workspaceEntityObservations.observationId, rootEvent.id));
const rootEntityIds = rootJunctions.map((j) => j.entityId);

// 3. BFS over entity edges
let entityFrontier = rootEntityIds;
const visitedEntityIds = new Set(rootEntityIds);
const allEdges: WorkspaceEdge[] = [];
const allEventIds = new Set([rootEvent.id]);

for (let depth = 0; depth < maxDepth; depth++) {
  if (entityFrontier.length === 0) break;

  const edges = await db
    .select()
    .from(workspaceEdges)
    .where(
      and(
        eq(workspaceEdges.workspaceId, workspaceId),
        or(
          inArray(workspaceEdges.sourceEntityId, entityFrontier),
          inArray(workspaceEdges.targetEntityId, entityFrontier)
        )
      )
    );

  allEdges.push(...edges);

  // Collect new entity IDs
  const newEntityIds = new Set<number>();
  for (const edge of edges) {
    if (!visitedEntityIds.has(edge.sourceEntityId))
      newEntityIds.add(edge.sourceEntityId);
    if (!visitedEntityIds.has(edge.targetEntityId))
      newEntityIds.add(edge.targetEntityId);
  }

  entityFrontier = [...newEntityIds];
  for (const id of newEntityIds) visitedEntityIds.add(id);

  // Resolve entities back to events via junction
  if (newEntityIds.size > 0) {
    const junctions = await db
      .select({ eventId: workspaceEntityObservations.observationId })
      .from(workspaceEntityObservations)
      .where(inArray(workspaceEntityObservations.entityId, [...newEntityIds]));
    for (const j of junctions) allEventIds.add(j.eventId);
  }
}

// 4. Fetch all event details
const events = await db
  .select({ /* id, externalId, title, source, observationType, occurredAt, metadata */ })
  .from(workspaceNeuralObservations)
  .where(inArray(workspaceNeuralObservations.id, [...allEventIds]));

// 5. Map edges to response format (entity edge → event edge for API)
// For each edge, find the events associated with source and target entities
```

**API response shape unchanged**: `GraphNode`, `GraphEdge`, `GraphResponse` types stay the same. The edge mapping resolves entity edges back to event pairs for the API.

#### 2. Rewrite `related.ts` edge fetch

**File**: `apps/console/src/lib/v1/related.ts:55-153`

Same structural change as `graph.ts` but single-depth only (no BFS loop):
1. Get entities for source event via junction
2. Fetch all edges where `sourceEntityId IN entityIds OR targetEntityId IN entityIds`
3. Find events for neighbor entities via junction
4. Fetch event details

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/v1/graph` returns correct entity-mediated graph with test data
- [ ] `/v1/related` returns correct related events
- [ ] Graph traversal handles multiple entity types correctly
- [ ] API response shape matches existing format (no client-side changes needed)

**Implementation Note**: After confirming graph traversal works correctly, proceed to Phase 4 to remove the old table.

---

## Phase 4: Drop `workspace_observation_relationships`

### Overview
Remove the old obs-to-obs edge table. All consumers now use `workspaceEdges`.

### Changes Required

#### 1. Delete schema file
**File**: `db/console/src/schema/tables/workspace-observation-relationships.ts` — DELETE

#### 2. Remove exports
**File**: `db/console/src/schema/tables/index.ts:89-93` — remove:
```typescript
export {
  type InsertWorkspaceObservationRelationship,
  type WorkspaceObservationRelationship,
  workspaceObservationRelationships,
  type RelationshipType,
  type RelationshipMetadata,
} from "./workspace-observation-relationships";
```

**File**: `db/console/src/schema/index.ts:15,90` — remove `workspaceObservationRelationships`, `workspaceObservationRelationshipsRelations` exports

**File**: `db/console/src/index.ts:75-76` — remove `workspaceObservationRelationships`, `workspaceObservationRelationshipsRelations` exports, and type exports

#### 3. Remove relations
**File**: `db/console/src/schema/relations.ts:153-169` — remove `workspaceObservationRelationshipsRelations` block and its import

#### 4. Update validation schema
**File**: `packages/console-validation/src/schemas/neural.ts:66-75` — remove or update `detectedRelationshipSchema` if it references `targetObservationId`. If nothing else uses it after the edge-resolver rewrite, remove it.

#### 5. Update test data
**File**: `packages/console-test-data/src/cli/reset-demo.ts:19,53-54,104-105`
- Remove import of `workspaceObservationRelationships`
- Remove the count query and delete operation for relationships
- Add: count and delete for `workspaceEdges` instead

#### 6. Generate migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`
- [x] Grep returns zero matches: `grep -r "workspaceObservationRelationships\|workspace_observation_relationships" --include="*.ts" apps/ api/ packages/ db/src/` (excluding migration files)

#### Manual Verification:
- [ ] Graph and related endpoints still work after table drop

**Implementation Note**: After completing this phase, the structural changes are done. Phases 5-6 are mechanical renames.

---

## Phase 5: Table Renames + Consumer Import Renames

### Overview
Rename the 4 remaining pipeline tables and update all consumer imports. This is a large-surface-area mechanical change.

**Ordering within this phase is critical**: The naming collision was already resolved in Phase 0 (the old `workspace_events` is now `workspace_ingest_log`). So `workspace_neural_observations` can safely take the name `workspace_events`.

### Changes Required

#### 1. Rename schema files (4 files)

| Old file | New file | pgTable | TS export | Types |
|---|---|---|---|---|
| `workspace-neural-observations.ts` | `workspace-events.ts` | `lightfast_workspace_events` | `workspaceEvents` | `WorkspaceEvent`, `InsertWorkspaceEvent` |
| `workspace-neural-entities.ts` | `workspace-entities.ts` | `lightfast_workspace_entities` | `workspaceEntities` | `WorkspaceEntity`, `InsertWorkspaceEntity` |
| `workspace-entity-observations.ts` | `workspace-entity-events.ts` | `lightfast_workspace_entity_events` | `workspaceEntityEvents` | `WorkspaceEntityEvent`, `InsertWorkspaceEntityEvent` |
| `workspace-observation-interpretations.ts` | `workspace-interpretations.ts` | `lightfast_workspace_interpretations` | `workspaceInterpretations` | `WorkspaceInterpretation`, `InsertWorkspaceInterpretation` |

**Column renames** (inside renamed files):
- `workspace-entity-events.ts`: `observation_id` → `event_id`, TS field `observationId` → `eventId`
- `workspace-interpretations.ts`: `observation_id` → `event_id`, TS field `observationId` → `eventId`

**Index renames** (inside renamed files):
- `workspace-events.ts`: `obs_*` prefix → `event_*` prefix
- `workspace-entity-events.ts`: `eo_*` prefix → `ee_*` prefix
- `workspace-interpretations.ts`: `interp_obs_*` → `interp_event_*`

**Supporting type renames** in `workspace-events.ts`:
- `ObservationReference` → keep as-is (it describes the reference structure, not tied to the table name)
- `ObservationActor` → keep as-is (same reasoning)
- `ObservationMetadata` → keep as-is

#### 2. Update `workspace-edges.ts` FK imports
**File**: `db/console/src/schema/tables/workspace-edges.ts`
- `workspaceNeuralEntities` → `workspaceEntities`
- `workspaceNeuralObservations` → `workspaceEvents`
- Import paths update to new file names

#### 3. Update barrel exports (3 files)

**File**: `db/console/src/schema/tables/index.ts`
- Update all export paths and names for the 4 renamed files
- Update re-exported type names

**File**: `db/console/src/schema/index.ts`
- Update all re-exports and relation names

**File**: `db/console/src/index.ts`
- Update all re-exports

#### 4. Update relations
**File**: `db/console/src/schema/relations.ts`
- Rename all table variable references:
  - `workspaceNeuralObservations` → `workspaceEvents` (lines 11,50,106-107,110,122-124,141-143,160-166)
  - `workspaceNeuralEntities` → `workspaceEntities` (lines 10,137,139)
  - `workspaceEntityObservations` → `workspaceEntityEvents` (lines 6,114,134-135,138,142,146)
  - `workspaceObservationInterpretations` → `workspaceInterpretations` (lines 12,113,119-120,123,127)
- Rename relation exports:
  - `workspaceNeuralObservationsRelations` → `workspaceEventsRelations`
  - `workspaceEntityObservationsRelations` → `workspaceEntityEventsRelations`
  - `workspaceObservationInterpretationsRelations` → `workspaceInterpretationsRelations`
- Update field names in junction/interpretation relations: `.observationId` → `.eventId`

#### 5. Update Inngest workflow files (3 files)

**File**: `api/console/src/inngest/workflow/neural/observation-store.ts`
- All imports: `workspaceNeuralObservations` → `workspaceEvents`, `workspaceNeuralEntities` → `workspaceEntities`, `workspaceEntityObservations` → `workspaceEntityEvents`
- All table references in queries
- Junction inserts: `.observationId` → `.eventId`

**File**: `api/console/src/inngest/workflow/neural/observation-interpret.ts`
- Import: `workspaceNeuralObservations` → `workspaceEvents`
- Import: `workspaceObservationInterpretations` → `workspaceInterpretations`
- Query references: `.observationId` → `.eventId` on interpretation insert

**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`
- All imports: `workspaceNeuralEntities` → `workspaceEntities`, `workspaceNeuralObservations` → `workspaceEvents`, `workspaceEntityObservations` → `workspaceEntityEvents`
- All table references in queries
- Junction column: `.observationId` → `.eventId`

#### 6. Update consumer lib files (7 files)

**File**: `apps/console/src/lib/v1/graph.ts:1-6,63-183`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceEdges` already correct (from Phase 3)
- `workspaceEntityObservations` → `workspaceEntityEvents` (column `.observationId` → `.eventId`)

**File**: `apps/console/src/lib/v1/related.ts:1-6,55-153`
- Same renames as `graph.ts`

**File**: `apps/console/src/lib/v1/findsimilar.ts:1-7`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceObservationInterpretations` → `workspaceInterpretations` (column `.observationId` → `.eventId`)

**File**: `apps/console/src/lib/neural/four-path-search.ts:12-18`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceObservationInterpretations` → `workspaceInterpretations` (column `.observationId` → `.eventId`)
- `workspaceEntityObservations` → `workspaceEntityEvents` (column `.observationId` → `.eventId`)
- `workspaceNeuralEntities` → `workspaceEntities`

**File**: `apps/console/src/lib/neural/entity-search.ts:1-6`
- `workspaceNeuralEntities` → `workspaceEntities`
- `workspaceEntityObservations` → `workspaceEntityEvents` (column `.observationId` → `.eventId`)
- `workspaceNeuralObservations` → `workspaceEvents`

**File**: `apps/console/src/lib/neural/id-resolver.ts:13-17`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceObservationInterpretations` → `workspaceInterpretations` (column `.observationId` → `.eventId`)

**File**: `apps/console/src/lib/neural/url-resolver.ts:10`
- `workspaceNeuralObservations` → `workspaceEvents`

#### 7. Update test data files (2 files)

**File**: `packages/console-test-data/src/cli/reset-demo.ts:17-18`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceNeuralEntities` → `workspaceEntities`

**File**: `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts:15-16`
- `workspaceNeuralObservations` → `workspaceEvents`
- `workspaceObservationInterpretations` → `workspaceInterpretations` (column `.observationId` → `.eventId`)

#### 8. Generate migration
```bash
cd db/console && pnpm db:generate
```

This generates one migration covering 4 table renames + 2 column renames.

### Success Criteria

#### Automated Verification:
- [x] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:console`
- [x] Grep returns zero matches for old names: `grep -r "workspaceNeuralObservations\|workspaceNeuralEntities\|workspaceEntityObservations\|workspaceObservationInterpretations" --include="*.ts" apps/ api/ packages/ db/src/` (excluding migration files)

#### Manual Verification:
- [ ] All API endpoints work with renamed tables
- [ ] Search, graph, related, findsimilar all return correct data

**Implementation Note**: After completing this phase, proceed to Phase 6 for Inngest renames.

---

## Phase 6: Inngest Event/Function ID Renames + File Renames

### Overview
Rename Inngest event names, function IDs, file names, and exported identifiers. No DB migration needed.

### Changes Required

#### 1. Update Inngest event schemas
**File**: `api/console/src/inngest/client/client.ts:133-222`

Replace event schema keys:
```typescript
// Old → New
"apps-console/neural/observation.capture"  → "apps-console/event.capture"
"apps-console/neural/observation.stored"   → "apps-console/event.stored"
"apps-console/neural/observation.captured" → "apps-console/event.interpreted"
```

Update field names in schemas:
- `observation.stored` schema: `observationId` → `eventId`, `internalObservationId` → `internalEventId`
- `observation.captured` schema: `observationId` → `eventId`

#### 2. Rename Inngest function files

**File**: `api/console/src/inngest/workflow/neural/observation-store.ts` → rename to `event-store.ts`
- Function id: `"apps-console/neural.observation.store"` → `"apps-console/event.store"`
- Trigger: `"apps-console/neural/observation.capture"` → `"apps-console/event.capture"`
- Export: `observationStore` → `eventStore`
- Update `onFailure` event name reference
- Update all `event.data.internalObservationId` → `event.data.internalEventId`
- Update `step.sendEvent` name: `"apps-console/neural/observation.stored"` → `"apps-console/event.stored"`
- Update payload fields: `observationId` → `eventId`, `internalObservationId` → `internalEventId`

**File**: `api/console/src/inngest/workflow/neural/observation-interpret.ts` → rename to `event-interpret.ts`
- Function id: `"apps-console/neural.observation.interpret"` → `"apps-console/event.interpret"`
- Trigger: `"apps-console/neural/observation.stored"` → `"apps-console/event.stored"`
- Export: `observationInterpret` → `eventInterpret`
- Update `event.data.internalObservationId` → `event.data.internalEventId`
- Update `step.sendEvent` name: `"apps-console/neural/observation.captured"` → `"apps-console/event.interpreted"`
- Update payload fields: `observationId` → `eventId`

#### 3. Update neural workflow exports
**File**: `api/console/src/inngest/workflow/neural/index.ts`
```typescript
// Old
export { observationInterpret } from "./observation-interpret";
export { observationStore } from "./observation-store";
// New
export { eventInterpret } from "./event-interpret";
export { eventStore } from "./event-store";
```

#### 4. Update Inngest serve registry
**File**: `api/console/src/inngest/index.ts:13,30,45-46,72-73`
- Import: `observationStore, observationInterpret` → `eventStore, eventInterpret`
- Update array registration and comments

#### 5. Update ingress notify
**File**: `apps/console/src/app/api/gateway/ingress/_lib/notify.ts:20`
- Event name: `"apps-console/neural/observation.capture"` → `"apps-console/event.capture"`

#### 6. Update notification dispatch trigger
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts:34`
- Trigger event: `"apps-console/neural/observation.captured"` → `"apps-console/event.interpreted"`
- Update destructured field: `observationId` → `eventId` (if used)

#### 7. Update on-failure handler
**File**: `api/console/src/inngest/workflow/neural/on-failure-handler.ts:15,20`
- Update event name in comments: `"apps-console/neural/observation.capture"` → `"apps-console/event.capture"`
- The generic type inference via `_eventName` will automatically update when callers change

#### 8. Update validation schemas
**File**: `packages/console-validation/src/schemas/workflow-io.ts:9,49,62,74`
- `"neural.observation.capture"` → `"event.capture"` (literal string in Zod schemas)
- Update type names: `NeuralObservationCaptureInput` → `EventCaptureInput`, etc.

#### 9. Update test data trigger
**File**: `packages/console-test-data/src/trigger/trigger.ts:67`
- Event name: `"apps-console/neural/observation.capture"` → `"apps-console/event.capture"`
- Function name: `triggerObservationCapture` → `triggerEventCapture` (and update callers in `reset-demo.ts:128`)

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:console`
- [ ] Grep returns zero matches for old event names: `grep -r "observation\.capture\|observation\.stored\|observation\.captured\|observationStore\|observationInterpret" --include="*.ts" apps/ api/ packages/` (excluding migration files and comments)

#### Manual Verification:
- [ ] Send test webhook → verify both Inngest functions fire under new event names in Inngest dashboard
- [ ] Notification dispatch triggers on `event.interpreted`
- [ ] Full end-to-end flow works: webhook → event-store → event-interpret → notification dispatch

---

## Testing Strategy

### Integration Tests (manual — no automated test suite for pipeline)
1. Send GitHub push webhook → verify event stored + interpretation created + entities upserted
2. Send Vercel deployment with same commit SHA → verify `deploys` edge in `workspace_edges` (commit entity → deployment entity)
3. Send Sentry issue with `resolved_by` commit + GitHub push → verify `resolves` edge
4. Out-of-order: send Vercel deployment first, then GitHub push → edge still created on second event
5. Verify `/v1/graph` returns entity-mediated graph
6. Verify `/v1/related` returns correct related events
7. Verify `/v1/search` and `/v1/findsimilar` return correct results
8. Verify notification dispatch fires for high-significance events

### Verification Commands
```bash
pnpm check && pnpm typecheck
pnpm build:console

# Verify no old identifiers remain
grep -r "workspaceNeuralObservations\|workspaceNeuralEntities\|workspaceObservationRelationships\|workspaceEntityObservations\|workspaceObservationInterpretations" --include="*.ts" apps/ api/ packages/ db/console/src/ | grep -v "node_modules\|drizzle/"
grep -r "observation\.capture\|observation\.stored\|observation\.captured" --include="*.ts" apps/ api/ packages/ | grep -v "node_modules"
```

## Performance Considerations

- **Entity edge resolution**: Phase 2 adds one extra query (load ALL entity refs for co-occurring events). This is bounded by the `LIMIT 100` on co-occurring events and typically 5-15 entities per event. Total: ~100-1500 entity lookups, batched into one `IN` query. Should be <100ms.
- **Graph BFS**: Phase 3 adds junction table queries per BFS level (entity→event resolution). One extra query per level, bounded by `maxDepth=3`. Acceptable tradeoff for correct entity-mediated traversal.
- **Migration zero-downtime**: All phases are additive-then-remove. No data loss risk.

## Migration Notes

- **No data migration needed**: Pre-production, no user data. All tables start empty after migration.
- **Migration ordering**: Phase 0 must complete before Phase 5 (naming collision). Phase 1 must complete before Phase 2. Phase 3 must complete before Phase 4 (consumers must use new table before old is dropped).
- **Drizzle migration generation**: Each phase generates its own migration. Run `cd db/console && pnpm db:generate` after each phase's schema changes.
- **Inngest function ID change** (Phase 6): Inngest tracks functions by ID. Changing the ID means the old function stops receiving events and the new function starts fresh. No migration needed — just deploy and the new functions register.

## Complete File Change List

### New Files (1)
| File | Phase |
|---|---|
| `db/console/src/schema/tables/workspace-edges.ts` | Phase 1 |

### Deleted Files (1)
| File | Phase |
|---|---|
| `db/console/src/schema/tables/workspace-observation-relationships.ts` | Phase 4 |

### Renamed Files (8)
| Old File | New File | Phase |
|---|---|---|
| `db/.../workspace-events.ts` | `workspace-ingest-log.ts` | Phase 0 |
| `db/.../workspace-neural-observations.ts` | `workspace-events.ts` | Phase 5 |
| `db/.../workspace-neural-entities.ts` | `workspace-entities.ts` | Phase 5 |
| `db/.../workspace-entity-observations.ts` | `workspace-entity-events.ts` | Phase 5 |
| `db/.../workspace-observation-interpretations.ts` | `workspace-interpretations.ts` | Phase 5 |
| `api/.../observation-store.ts` | `event-store.ts` | Phase 6 |
| `api/.../observation-interpret.ts` | `event-interpret.ts` | Phase 6 |
| `api/.../edge-resolver.ts` | `edge-resolver.ts` (same name, rewritten) | Phase 2 |

### Modified Files by Phase

| Phase | Files | Nature |
|---|---|---|
| Phase 0 | 8 | Rename ingress log table + consumer updates |
| Phase 1 | 4 | New table + exports + relations |
| Phase 2 | 6 | Edge rules (4 providers) + edge-resolver + validation |
| Phase 3 | 2 | graph.ts + related.ts BFS rewrite |
| Phase 4 | 6 | Drop old table + exports + relations + test data |
| Phase 5 | 20 | Table renames + all consumer imports |
| Phase 6 | 10 | Inngest events + function IDs + file renames |
| **Total** | **~35** | (some files touched in multiple phases) |

## References

- Research document (v2): `thoughts/shared/research/2026-03-12-pipeline-restructure-v2.md`
- Previous plan (v1, completed): `thoughts/shared/plans/2026-03-12-pipeline-restructure.md`
- Previous research (superseded): `thoughts/shared/research/2026-03-12-pipeline-restructure-architecture.md`
