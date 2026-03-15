# Observation Pipeline Redesign — 4-Layer Entity Architecture

## Overview

Full redesign of the observation pipeline from an event-centric model (every webhook = one `workspaceEvents` row) to an entity-centric model (every domain object = one `workspaceSourceEntities` row with optional lifecycle state). The redesign decouples the pipeline into 4 independent layers: Entity Store, Graph, Vector, and Observation — each running as a separate Inngest function with no sequential dependencies.

**Unified entity model**: ALL entities live in one table — domain objects (PRs, issues, deployments) AND semantic entities (@sarah, POST /api/users, DATABASE_URL). Domain objects have lifecycle (`currentState` tracks open→merged etc). Semantic entities have `currentState = null`. ALL relationships are edges — "PR #123 fixes Issue #7" and "PR #123 mentions @sarah" are both edges in `workspaceEntityEdges` with different `relationshipType` values.

## Current State Analysis

The pipeline today runs as two sequential Inngest functions:

1. **Fast path** (`event-store.ts`): dedup → filter → significance → entity extraction → store `workspaceEvents` row → emit `event.stored`
2. **Slow path** (`event-interpret.ts`): fetch → LLM classification → embedding → Pinecone upsert → interpretation store → edge resolution → emit `event.interpreted`

Key problems:
- **No entity lifecycle**: A PR that was opened then merged produces 2 `workspaceEvents` rows but no `currentState` on the entity. Cannot query "all open PRs."
- **Graph blocked by AI**: Edge resolution runs after LLM classification + embedding (10-30s delay for a pure SQL operation).
- **Stale vectors**: 3 Pinecone vectors per event occurrence — a merged PR has 6 vectors (3 from "opened", 3 from "merged") with no canonical current-state representation.
- **Vercel idempotency bug**: Idempotency key is `workspaceId + sourceId`. Vercel sourceId has no action suffix (`deployment:dpl_abc123`), so only the first lifecycle event is processed — all subsequent state transitions are silently dropped.
- **Search unimplemented**: The 4 App Router search stubs (`/search`, `/contents`, `/findsimilar`, `/related`) all throw "not implemented."

### Key Discoveries:
- `workspaceIngestLog` stores full `PostTransformEvent` JSONB — serves as the immutable raw log (`workspace-ingest-log.ts:65`)
- `workspaceEntities` deduplicates by `(workspaceId, category, key)` with `occurrenceCount` + `lastSeenAt` — already entity-like but no state (`workspace-entities.ts:128-155`)
- `workspaceEdges` adjacency list with `(workspaceId, sourceEntityId)` and `(workspaceId, targetEntityId)` indexes is already well-designed for graph traversal (`workspace-edges.ts:65-82`)
- Provider sourceId formats are inconsistent — GitHub PR has action suffix (`pr:org/repo#123:merged`), Vercel has none (`deployment:dpl_abc123`), Linear uses raw action (`linear-issue:ENG:ENG-42:create`)
- Pinecone vectors use `layer: "observations"` metadata, vector IDs like `obs_title_{baseId}` (`event-interpret.ts:296-356`)
- `workspaceInterpretations` stores embedding vector IDs (`embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`) + AI classification (`primaryCategory`, `topics`) (`workspace-interpretations.ts:49-51`)
- `EVENT_REGISTRY` derives event weights from provider definitions at `registry.ts:90-117`
- Significance scorer uses threshold of 40 with 8 regex signal patterns (`scoring.ts:17, 48-86`)

## Desired End State

```
Ingress → workspaceIngestLog (unchanged)
       → entity.ingest (Inngest)
            UPSERT workspaceSourceEntities (lifecycle + semantic entities, unified)
            INSERT workspaceEntityTransitions (state history, lifecycle entities only)
            Create "mentions" edges for semantic entities (@sarah, endpoints, configs)
            → entity.stored fans out to 3 independent functions:

  ┌─────────────────────┬──────────────────────┬──────────────────────────┐
  │ entity.graph        │ entity.embed         │ entity.observe           │
  │ (Layer 1)           │ (Layer 2)            │ (Layer 3)               │
  │                     │                      │                         │
  │ Edge resolution     │ UPSERT 2 entity      │ Scheduled / triggered   │
  │ Pure SQL, no AI     │ vectors in Pinecone  │ AI-synthesized insights │
  │ <1s                 │ No LLM needed        │ workspaceObservations   │
  │                     │ Overwrites stale     │                         │
  │ workspaceEntityEdges│ state automatically  │ Pinecone layer=obs      │
  └─────────────────────┴──────────────────────┴──────────────────────────┘
```

**Search architecture**:
- **Pinecone** = semantic relevance only ("what is this about?"). No metadata filters for state.
- **Postgres** = structured attributes (entity type, current state, time ranges, graph traversal).
- **Hybrid queries** = Pinecone for semantic matching → Postgres post-filter for structured constraints.

**Verification**: After implementation, these queries must work:
1. "Show all open PRs" → Postgres `WHERE entityType='pr' AND currentState='open'`
6. "Who is working on auth?" → Postgres: find "engineer" entities connected to entities matching "auth" via edges
2. "What happened with auth?" → Pinecone semantic search → entity results with current state
3. "Open PRs related to auth" → Pinecone for "auth" → Postgres post-filter by type+state
4. "History of PR #123" → `workspaceEntityTransitions WHERE entityId=X ORDER BY occurredAt`
5. "What entities are connected to this deployment?" → BFS graph traversal on `workspaceEntityEdges`

## What We're NOT Doing

- Migrating existing data from old tables (drop and start fresh)
- Keeping backwards compatibility with old Pinecone vector IDs (`obs_*`)
- Implementing LLM-powered query intent parsing for search (post-filter is sufficient)
- Adding new provider integrations (only mapping existing 4 providers)
- Building a UI for entity lifecycle visualization (backend only)
- Implementing real-time SSE for entity state changes (existing `workspaceIngestLog` SSE is unchanged)

## Implementation Approach

Build the 4 layers bottom-up: schema first, then entity store, then graph + vector in parallel, then search, then observation. Each phase is independently deployable and testable. Old tables are dropped in the final cleanup phase after all new code is live.

---

## Phase 1: Database Schema + Domain Entity Extraction

### Overview
Create all new database tables, rename existing tables, define the `extractDomainEntity()` function per provider, and define entity state machines.

### Changes Required:

#### 1. New Table: `workspaceSourceEntities`
**File**: `db/console/src/schema/tables/workspace-source-entities.ts` (new)

```typescript
import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, real, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/id";
import { consoleSchema } from "../console-schema";
import { orgWorkspaces } from "./org-workspaces";

export const workspaceSourceEntities = consoleSchema.table(
  "lightfast_workspace_source_entities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    externalId: varchar("external_id", { length: 21 }).notNull().$defaultFn(nanoid),
    workspaceId: varchar("workspace_id", { length: 191 }).notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ── ENTITY IDENTITY ──
    source: varchar("source", { length: 50 }).notNull(),          // "github" | "vercel" | "linear" | "sentry" | "extracted"
    entityType: varchar("entity_type", { length: 50 }).notNull(), // "pr" | "issue" | "deployment" | "engineer" | "endpoint" | etc.
    domainEntityId: varchar("domain_entity_id", { length: 500 }).notNull(), // stable ID: "org/repo#123" or "@sarah" or "POST /api/users"

    // ── LIFECYCLE (nullable — null for non-lifecycle entities like engineers, endpoints) ──
    currentState: varchar("current_state", { length: 50 }),       // "open" | "merged" | null (for semantic entities)
    stateChangedAt: timestamp("state_changed_at", { withTimezone: true, mode: "string" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "string" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "string" }).notNull(),

    // ── CONTENT ──
    title: text("title").notNull(),
    url: text("url"),
    actor: jsonb("actor").$type<{ avatarUrl?: string; email?: string; id?: string; name?: string } | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // ── SIGNIFICANCE ──
    significanceScore: real("significance_score"),

    // ── COUNTS ──
    eventCount: integer("event_count").notNull().default(1),

    // ── TIMESTAMPS ──
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("source_entity_external_id_idx").on(t.externalId),
    uniqueIndex("source_entity_dedup_idx").on(t.workspaceId, t.source, t.entityType, t.domainEntityId),
    index("source_entity_type_state_idx").on(t.workspaceId, t.entityType, t.currentState),
    index("source_entity_source_last_seen_idx").on(t.workspaceId, t.source, t.lastSeenAt),
    index("source_entity_state_changed_idx").on(t.workspaceId, t.stateChangedAt),
    index("source_entity_workspace_idx").on(t.workspaceId),
  ]
);
```

#### 2. New Table: `workspaceEntityTransitions`
**File**: `db/console/src/schema/tables/workspace-entity-transitions.ts` (new)

```typescript
export const workspaceEntityTransitions = consoleSchema.table(
  "lightfast_workspace_entity_transitions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    entityId: bigint("entity_id", { mode: "number" }).notNull()
      .references(() => workspaceSourceEntities.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 191 }).notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
    ingestLogId: bigint("ingest_log_id", { mode: "number" })
      .references(() => workspaceIngestLog.id, { onDelete: "set null" }),

    fromState: varchar("from_state", { length: 50 }),        // null for initial creation
    toState: varchar("to_state", { length: 50 }).notNull(),
    actor: jsonb("actor").$type<{ avatarUrl?: string; email?: string; id?: string; name?: string } | null>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
    sourceType: varchar("source_type", { length: 100 }).notNull(), // original sourceType for provenance
    title: text("title").notNull(),                           // snapshot of event title at transition time
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    index("transition_entity_occurred_idx").on(t.entityId, t.occurredAt),
    index("transition_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("transition_ingest_log_idx").on(t.ingestLogId),
  ]
);
```

#### 3. New Table: `workspaceObservations`
**File**: `db/console/src/schema/tables/workspace-observations.ts` (new)

```typescript
export const workspaceObservations = consoleSchema.table(
  "lightfast_workspace_observations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    externalId: varchar("external_id", { length: 21 }).notNull().$defaultFn(nanoid),
    workspaceId: varchar("workspace_id", { length: 191 }).notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    observationType: varchar("observation_type", { length: 100 }).notNull(), // "pattern" | "anomaly" | "milestone" | "risk"
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    timeWindowStart: timestamp("time_window_start", { withTimezone: true, mode: "string" }).notNull(),
    timeWindowEnd: timestamp("time_window_end", { withTimezone: true, mode: "string" }).notNull(),

    entityIds: jsonb("entity_ids").$type<string[]>().notNull(),  // array of source entity externalIds
    topics: jsonb("topics").$type<string[]>(),

    confidence: real("confidence"),
    modelVersion: varchar("model_version", { length: 100 }),
    embeddingId: varchar("embedding_id", { length: 191 }),       // Pinecone vector ID
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("observation_external_id_idx").on(t.externalId),
    index("observation_workspace_time_idx").on(t.workspaceId, t.timeWindowEnd),
    index("observation_workspace_type_idx").on(t.workspaceId, t.observationType),
  ]
);
```

#### 4. Update `workspaceEdges` → `workspaceEntityEdges`
**File**: `db/console/src/schema/tables/workspace-edges.ts`

Rename table and update FKs to point at `workspaceSourceEntities` (the unified entity table):
- `sourceEntityId` FK → `workspaceSourceEntities.id` (was `workspaceEntities.id`)
- `targetEntityId` FK → `workspaceSourceEntities.id` (was `workspaceEntities.id`)
- Drop `sourceEventId` column (provenance now tracked via `workspaceEntityTransitions.ingestLogId`)
- Add new relationship types: `"mentions"`, `"uses"`, `"authored_by"` (for semantic entity edges)

All relationships are now edges in this single table:
- `PR #123 → Issue #7`: relationshipType = `"fixes"`, confidence = 1.0
- `PR #123 → @sarah`: relationshipType = `"mentions"`, confidence = 0.9
- `Commit abc → Deployment dpl_123`: relationshipType = `"deploys"`, confidence = 1.0
- `PR #123 → POST /api/users`: relationshipType = `"references"`, confidence = 0.85

#### 5. Drop Old Tables
Drop in the same migration (user confirmed no data migration needed):
- `workspaceEvents` (`lightfast_workspace_events`)
- `workspaceInterpretations` (`lightfast_workspace_interpretations`)
- `workspaceEntities` (`lightfast_workspace_entities`) — replaced by unified `workspaceSourceEntities`
- `workspaceEntityEvents` (`lightfast_workspace_entity_events`) — replaced by edges with `"mentions"` relationship type

#### 6. Update Relations
**File**: `db/console/src/schema/relations.ts`

Remove relations for dropped tables (`workspaceEvents`, `workspaceInterpretations`, `workspaceEntities`, `workspaceEntityEvents`). Add relations for new tables:
- `workspaceSourceEntities` → many `workspaceEntityTransitions`, many `workspaceEntityEdges` (as source), many `workspaceEntityEdges` (as target)
- `workspaceEntityTransitions` → one `workspaceSourceEntities`, one `workspaceIngestLog`
- Update `orgWorkspacesRelations` to reference new table names

#### 7. Schema Barrel Export
**File**: `db/console/src/schema/index.ts`

Update exports: remove `workspaceEvents`, `workspaceInterpretations`, `workspaceEntities`, `workspaceEntityEvents`. Add `workspaceSourceEntities`, `workspaceEntityTransitions`, `workspaceObservations`. Rename `workspaceEdges` → `workspaceEntityEdges`.

#### 8. Domain Entity Extraction
**File**: `api/console/src/inngest/workflow/neural/entity-lifecycle.ts` (new)

```typescript
export interface DomainEntity {
  entityType: string;
  domainEntityId: string;
  currentState: string | null;  // null for non-lifecycle entities (engineer, endpoint, config)
}

/**
 * Extract domain entity identity from a PostTransformEvent.
 * Strips the action suffix from sourceId to produce a stable domainEntityId.
 */
export function extractDomainEntity(
  source: string,
  sourceType: string,
  sourceId: string,
): DomainEntity {
  switch (source) {
    case "github":
      return extractGitHubDomainEntity(sourceType, sourceId);
    case "vercel":
      return extractVercelDomainEntity(sourceType, sourceId);
    case "linear":
      return extractLinearDomainEntity(sourceType, sourceId);
    case "sentry":
      return extractSentryDomainEntity(sourceType, sourceId);
    default:
      return { entityType: "unknown", domainEntityId: sourceId, currentState: "unknown" };
  }
}
```

**GitHub extraction** (strips action suffix from PR/issue sourceIds):
```typescript
function extractGitHubDomainEntity(sourceType: string, sourceId: string): DomainEntity {
  // sourceType: "pull-request.merged", "issue.closed", "push", "release.published", "discussion.created"
  const baseType = sourceType.split(".")[0]; // "pull-request" | "issue" | "push" | "release" | "discussion"

  switch (baseType) {
    case "pull-request": {
      // sourceId: "pr:org/repo#123:merged" → domainEntityId: "org/repo#123"
      const parts = sourceId.split(":");
      const action = parts.pop()!;                    // "merged" | "opened" | "closed" | "edited" | ...
      const domainEntityId = parts.slice(1).join(":"); // "org/repo#123"
      return { entityType: "pr", domainEntityId, currentState: mapGitHubPrState(action) };
    }
    case "issue": {
      // sourceId: "issue:org/repo#7:closed" → domainEntityId: "org/repo#7"
      const parts = sourceId.split(":");
      const action = parts.pop()!;
      const domainEntityId = parts.slice(1).join(":");
      return { entityType: "issue", domainEntityId, currentState: mapGitHubIssueState(action) };
    }
    case "push": {
      // sourceId: "push:org/repo:abc1234" → domainEntityId: "org/repo:abc1234"
      const domainEntityId = sourceId.replace(/^push:/, "");
      return { entityType: "commit", domainEntityId, currentState: "pushed" };
    }
    case "release": {
      // sourceId: "release:org/repo:v1.2.0" → domainEntityId: "org/repo:v1.2.0"
      const domainEntityId = sourceId.replace(/^release:/, "");
      return { entityType: "release", domainEntityId, currentState: "published" };
    }
    case "discussion": {
      // sourceId: "discussion:org/repo#5" → domainEntityId: "org/repo#5"
      const domainEntityId = sourceId.replace(/^discussion:/, "");
      const action = sourceType.split(".")[1] ?? "created";
      return { entityType: "discussion", domainEntityId, currentState: action === "answered" ? "answered" : "open" };
    }
    default:
      return { entityType: baseType, domainEntityId: sourceId, currentState: "unknown" };
  }
}

function mapGitHubPrState(action: string): string {
  switch (action) {
    case "opened": case "reopened": case "ready_for_review": return "open";
    case "merged": return "merged";
    case "closed": return "closed";
    case "converted_to_draft": return "draft";
    default: return "open"; // edited, review_requested, etc. don't change state
  }
}

function mapGitHubIssueState(action: string): string {
  switch (action) {
    case "opened": case "reopened": return "open";
    case "closed": return "closed";
    default: return "open";
  }
}
```

**Vercel extraction** (state from sourceType, not sourceId):
```typescript
function extractVercelDomainEntity(sourceType: string, sourceId: string): DomainEntity {
  // sourceId: "deployment:dpl_abc123" (no action suffix)
  // sourceType: "deployment.created" | "deployment.succeeded" | "deployment.error" | etc.
  const domainEntityId = sourceId.replace(/^deployment:/, "");
  const action = sourceType.split(".")[1] ?? "created";

  const stateMap: Record<string, string> = {
    created: "building", succeeded: "succeeded", ready: "ready",
    error: "failed", canceled: "canceled", promoted: "promoted",
    "check-rerequested": "building", rollback: "rolled_back", cleanup: "cleaned_up",
  };

  return { entityType: "deployment", domainEntityId, currentState: stateMap[action] ?? action };
}
```

**Linear extraction** (action suffix is raw webhook action):
```typescript
function extractLinearDomainEntity(sourceType: string, sourceId: string): DomainEntity {
  // sourceType: "issue.created" | "comment.updated" | "project.created" | "cycle.created" | "project-update.created"
  const baseType = sourceType.split(".")[0]; // "issue" | "comment" | "project" | "cycle" | "project-update"
  const action = sourceType.split(".")[1] ?? "created";

  switch (baseType) {
    case "issue": {
      // sourceId: "linear-issue:ENG:ENG-42:create" → domainEntityId: "ENG-42"
      const parts = sourceId.split(":");
      // parts = ["linear-issue", "ENG", "ENG-42", "create"]
      const domainEntityId = parts[2]!;
      return { entityType: "issue", domainEntityId, currentState: mapLinearIssueState(action) };
    }
    case "comment": {
      // sourceId: "linear-comment:ENG-42:uuid:create" → domainEntityId: "ENG-42:uuid"
      const parts = sourceId.split(":");
      const domainEntityId = `${parts[1]}:${parts[2]}`;
      return { entityType: "comment", domainEntityId, currentState: action };
    }
    case "project": {
      // sourceId: "linear-project:slug:update" → domainEntityId: "slug"
      const parts = sourceId.split(":");
      const domainEntityId = parts[1]!;
      return { entityType: "project", domainEntityId, currentState: action };
    }
    case "cycle": {
      // sourceId: "linear-cycle:ENG:5:create" → domainEntityId: "ENG:5"
      const parts = sourceId.split(":");
      const domainEntityId = `${parts[1]}:${parts[2]}`;
      return { entityType: "cycle", domainEntityId, currentState: action };
    }
    case "project-update": {
      // sourceId: "linear-project-update:projId:updateId:create" → domainEntityId: "projId:updateId"
      const parts = sourceId.split(":");
      const domainEntityId = `${parts[1]}:${parts[2]}`;
      return { entityType: "project-update", domainEntityId, currentState: action };
    }
    default:
      return { entityType: baseType, domainEntityId: sourceId, currentState: action };
  }
}

function mapLinearIssueState(action: string): string {
  switch (action) {
    case "created": return "created";
    case "updated": return "in_progress"; // simplified — real state from payload.state
    case "deleted": return "deleted";
    default: return action;
  }
}
```

**Sentry extraction**:
```typescript
function extractSentryDomainEntity(sourceType: string, sourceId: string): DomainEntity {
  switch (sourceType.split(".")[0]) {
    case "issue": {
      // sourceId: "sentry-issue:project:PROJ-123:created" → domainEntityId: "project:PROJ-123"
      const parts = sourceId.split(":");
      const action = parts.pop()!;
      const domainEntityId = parts.slice(1).join(":");
      const stateMap: Record<string, string> = {
        created: "unresolved", resolved: "resolved", unresolved: "unresolved",
        assigned: "unresolved", ignored: "ignored", archived: "archived",
      };
      return { entityType: "issue", domainEntityId, currentState: stateMap[action] ?? "unresolved" };
    }
    case "error": {
      // sourceId: "sentry-error:12345:uuid" → terminal
      const domainEntityId = sourceId.replace(/^sentry-error:/, "");
      return { entityType: "error", domainEntityId, currentState: "captured" };
    }
    case "event-alert": {
      const domainEntityId = sourceId.replace(/^sentry-alert:/, "");
      return { entityType: "alert", domainEntityId, currentState: "triggered" };
    }
    case "metric-alert": {
      const parts = sourceId.split(":");
      const action = parts.pop()!;
      const domainEntityId = parts.slice(1).join(":");
      return { entityType: "metric-alert", domainEntityId, currentState: action };
    }
    default:
      return { entityType: "unknown", domainEntityId: sourceId, currentState: "unknown" };
  }
}
```

#### 9. EntityType Schema
**File**: `packages/console-validation/src/schemas/entities.ts`

Replace the existing `entityCategorySchema` with a unified `entityTypeSchema` covering both lifecycle and semantic entity types:

```typescript
export const entityTypeSchema = z.enum([
  // Lifecycle entities (from webhooks — have currentState)
  "pr", "issue", "deployment", "release", "commit", "branch", "discussion",
  "comment", "project", "cycle", "project-update",
  "error", "alert", "metric-alert",
  // Semantic entities (from text extraction — currentState is null)
  "engineer",    // @sarah, reviewer mentions
  "endpoint",    // POST /api/users
  "config",      // DATABASE_URL
  "definition",  // file paths, technical terms
  "service",     // external services
  "reference",   // generic references
]);
export type EntityType = z.infer<typeof entityTypeSchema>;

// Which entity types have lifecycle (currentState is not null)
export const LIFECYCLE_ENTITY_TYPES = [
  "pr", "issue", "deployment", "release", "commit", "branch", "discussion",
  "comment", "project", "cycle", "project-update",
  "error", "alert", "metric-alert",
] as const;
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Unit tests for `extractDomainEntity()` cover all 4 providers with edge cases

#### Manual Verification:
- [ ] DB studio shows new tables with correct columns and indexes: `cd db/console && pnpm db:studio`
- [ ] Old tables (`workspaceEvents`, `workspaceInterpretations`, `workspaceEntities`, `workspaceEntityEvents`) are dropped
- [ ] `workspaceEdges` renamed to `workspaceEntityEdges` with updated FKs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Entity Store (Layer 0) — Inngest Function

### Overview
Replace `event-store.ts` with a new `entity-ingest.ts` function. This function receives the same `PostTransformEvent` from ingress, extracts domain entity identity via `extractDomainEntity()`, UPSERTS the source entity (lifecycle), records a state transition, extracts semantic entities (engineer mentions, endpoints, configs) as entities in the SAME table with `currentState=null`, creates "mentions" edges between the lifecycle entity and semantic entities, and emits `entity.stored` to fan out to 3 independent downstream functions.

### Changes Required:

#### 1. New Inngest Event Schemas
**File**: `api/console/src/inngest/client/client.ts`

Replace the 3 existing event pipeline events with 4 new ones:

```typescript
// Replace "apps-console/event.capture" with:
"apps-console/entity.ingest": z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  sourceEvent: z.object({
    source: z.string(),
    sourceType: z.string(),
    sourceId: z.string(),
    title: z.string(),
    body: z.string(),
    occurredAt: z.string(),
    references: z.array(z.object({
      type: z.enum(["commit", "branch", "pr", "issue", "deployment", "project", "cycle", "assignee", "reviewer", "team", "label"]),
      id: z.string(),
      url: z.string().nullable(),
      label: z.string().nullable(),
    })),
    metadata: z.record(z.string(), z.unknown()),
  }),
  ingestionSource: ingestionSourceSchema.optional(),
  ingestLogId: z.number().optional(),  // NEW: provenance link to ingest log
}),

// Replace "apps-console/event.stored" with:
"apps-console/entity.stored": z.object({
  entityExternalId: z.string(),
  entityId: z.number(),              // internal DB PK
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  source: z.string(),
  sourceType: z.string(),
  entityType: z.string(),
  domainEntityId: z.string(),
  currentState: z.string(),
  isNewEntity: z.boolean(),          // true if just created, false if state updated
  significanceScore: z.number(),
  entityRefs: z.array(z.object({
    type: z.string(),
    key: z.string(),
    label: z.string().nullable(),
  })),
  title: z.string(),                 // for vector embedding
  content: z.string(),               // for vector embedding
}),

// Replace "apps-console/event.interpreted" with:
"apps-console/entity.observed": z.object({
  workspaceId: z.string(),
  clerkOrgId: z.string().optional(),
  observationExternalId: z.string(),
  observationType: z.string(),
  entityCount: z.number(),
}),

// Remove: "apps-console/event.capture", "apps-console/event.stored", "apps-console/event.interpreted"
```

#### 2. New Inngest Function: `entity-ingest.ts`
**File**: `api/console/src/inngest/workflow/neural/entity-ingest.ts` (new)

Replaces `event-store.ts`. Key differences:
- **Idempotency key**: `workspaceId + '-' + sourceEvent.sourceId + '-' + sourceEvent.sourceType` — fixes Vercel bug
- **No significance gate for entity creation**: All events create/update entities. Significance score is computed and forwarded but does not block entity storage.
- **UPSERT semantics**: Uses `ON CONFLICT (workspace_id, source, entity_type, domain_entity_id) DO UPDATE` to update lifecycle state
- **Emits `entity.stored`** instead of `event.stored`

```typescript
export const entityIngest = inngest.createFunction(
  {
    id: "apps-console/entity.ingest",
    retries: 3,
    idempotency: "event.data.workspaceId + '-' + event.data.sourceEvent.sourceId + '-' + event.data.sourceEvent.sourceType",
    concurrency: [{ limit: 10, key: "event.data.workspaceId" }],
    timeouts: { start: "1m", finish: "2m" },
    onFailure: createNeuralOnFailureHandler("apps-console/entity.ingest", { /* ... */ }),
  },
  { event: "apps-console/entity.ingest" },
  async ({ event, step, logger }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent, ingestLogId } = event.data;

    // Pre-step: memoized IDs
    const { externalId, startTime } = await step.run("generate-replay-safe-ids", () => ({
      externalId: nanoid(), startTime: Date.now(),
    }));

    // Pre-step: resolve clerkOrgId
    const clerkOrgId = await step.run("resolve-clerk-org-id", () =>
      resolveClerkOrgId(eventClerkOrgId, workspaceId)
    );

    // Pre-step: create job
    const jobId = await step.run("create-job", () => createJob({ /* ... */ }));
    await step.run("update-job-running", () => updateJobStatus(jobId, "running"));

    // Step 1: check-event-allowed (same as current)
    const allowed = await step.run("check-event-allowed", () => { /* same logic */ });
    if (!allowed) { /* complete job filtered, return */ }

    // Step 2: extract-domain-entity
    const domainEntity = await step.run("extract-domain-entity", () =>
      extractDomainEntity(sourceEvent.source, sourceEvent.sourceType, sourceEvent.sourceId)
    );

    // Step 3: evaluate-significance (same as current, but does NOT gate)
    const significance = await step.run("evaluate-significance", () =>
      scoreSignificance(sourceEvent)
    );

    // Step 4: upsert-source-entity
    const { entity, isNew, previousState } = await step.run("upsert-source-entity", async () => {
      const [upserted] = await db
        .insert(workspaceSourceEntities)
        .values({
          externalId,
          workspaceId,
          source: sourceEvent.source,
          entityType: domainEntity.entityType,
          domainEntityId: domainEntity.domainEntityId,
          currentState: domainEntity.currentState,
          stateChangedAt: sourceEvent.occurredAt,
          firstSeenAt: sourceEvent.occurredAt,
          lastSeenAt: sourceEvent.occurredAt,
          title: sourceEvent.title,
          url: sourceEvent.references.find(r => r.type === domainEntity.entityType)?.url ?? null,
          actor: sourceEvent.metadata.actor ?? null,
          metadata: sourceEvent.metadata,
          significanceScore: significance.score,
        })
        .onConflictDoUpdate({
          target: [
            workspaceSourceEntities.workspaceId,
            workspaceSourceEntities.source,
            workspaceSourceEntities.entityType,
            workspaceSourceEntities.domainEntityId,
          ],
          set: {
            currentState: domainEntity.currentState,
            stateChangedAt: sourceEvent.occurredAt,
            lastSeenAt: sourceEvent.occurredAt,
            title: sourceEvent.title,
            actor: sourceEvent.metadata.actor ?? null,
            metadata: sourceEvent.metadata,
            significanceScore: significance.score,
            eventCount: sql`${workspaceSourceEntities.eventCount} + 1`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning({
          id: workspaceSourceEntities.id,
          externalId: workspaceSourceEntities.externalId,
          eventCount: workspaceSourceEntities.eventCount,
          currentState: workspaceSourceEntities.currentState,
        });

      const isNew = upserted.eventCount === 1;
      return { entity: upserted, isNew, previousState: isNew ? null : "unknown" };
    });

    // Step 5: record-entity-transition
    await step.run("record-entity-transition", async () => {
      await db.insert(workspaceEntityTransitions).values({
        entityId: entity.id,
        workspaceId,
        ingestLogId: ingestLogId ?? null,
        fromState: isNew ? null : previousState,
        toState: domainEntity.currentState,
        actor: sourceEvent.metadata.actor ?? null,
        occurredAt: sourceEvent.occurredAt,
        sourceType: sourceEvent.sourceType,
        title: sourceEvent.title,
        metadata: sourceEvent.metadata,
      });
    });

    // Step 6: extract semantic entities from text
    const semanticEntities = await step.run("extract-semantic-entities", () => {
      const textEntities = extractEntities(sourceEvent.title, sourceEvent.body);
      const refEntities = extractFromReferences(sourceEvent.references);
      // Filter to SEMANTIC types only — lifecycle types are the primary source entity
      const semanticOnly = [...textEntities, ...refEntities].filter(
        e => !LIFECYCLE_ENTITY_TYPES.includes(e.category)
      );
      return deduplicateEntities(semanticOnly).slice(0, MAX_ENTITIES_PER_OBSERVATION);
    });

    // Step 7: upsert semantic entities + create "mentions" edges
    // ALL entities (lifecycle + semantic) live in workspaceSourceEntities.
    // Semantic entities have source="extracted", currentState=null.
    // Relationships are edges with relationshipType="mentions"/"references"/"authored_by".
    await step.run("upsert-semantic-entities-and-edges", async () => {
      if (semanticEntities.length === 0) return 0;

      const semanticEntityIds = await Promise.all(semanticEntities.map(async (e) => {
        const [row] = await db.insert(workspaceSourceEntities).values({
          workspaceId,
          source: "extracted",              // semantic entities come from text extraction
          entityType: e.category,           // "engineer" | "endpoint" | "config" | etc.
          domainEntityId: e.key,            // "@sarah" | "POST /api/users" | "DATABASE_URL"
          currentState: null,               // no lifecycle for semantic entities
          stateChangedAt: null,
          firstSeenAt: sourceEvent.occurredAt,
          lastSeenAt: sourceEvent.occurredAt,
          title: e.value ?? e.key,
          significanceScore: null,
          metadata: { evidence: e.evidence, confidence: e.confidence },
        }).onConflictDoUpdate({
          target: [workspaceSourceEntities.workspaceId, workspaceSourceEntities.source,
                   workspaceSourceEntities.entityType, workspaceSourceEntities.domainEntityId],
          set: {
            lastSeenAt: sourceEvent.occurredAt,
            eventCount: sql`${workspaceSourceEntities.eventCount} + 1`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        }).returning({ id: workspaceSourceEntities.id });
        return { id: row.id, category: e.category };
      }));

      // Create "mentions" edges: source entity → semantic entity
      const edgeInserts = semanticEntityIds.map((se) => ({
        externalId: nanoid(),
        workspaceId,
        sourceEntityId: entity.id,        // the PR/issue/deployment
        targetEntityId: se.id,            // @sarah, POST /api/users
        relationshipType: se.category === "engineer" ? "authored_by" : "mentions",
        confidence: 0.9,
        metadata: { detectionMethod: "text_extraction" },
      }));
      await db.insert(workspaceEntityEdges).values(edgeInserts).onConflictDoNothing();
      return edgeInserts.length;
    });

    // Step 8: build entityRefs for downstream (structural references)
    const entityRefs = sourceEvent.references
      .filter(r => ["commit", "branch", "pr", "issue", "deployment"].includes(r.type))
      .map(r => ({ type: r.type, key: r.id, label: r.label }));

    // Step 9: emit entity.stored
    await step.sendEvent("emit-entity-stored", {
      name: "apps-console/entity.stored",
      data: {
        entityExternalId: entity.externalId,
        entityId: entity.id,
        workspaceId,
        clerkOrgId,
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        entityType: domainEntity.entityType,
        domainEntityId: domainEntity.domainEntityId,
        currentState: domainEntity.currentState,
        isNewEntity: isNew,
        significanceScore: significance.score,
        entityRefs,
        title: sourceEvent.title,
        content: sourceEvent.body,
      },
    });

    // Step 10: complete job
    await step.run("complete-job-success", () => completeJob({ /* ... */ }));

    return { status: "stored", entityExternalId: entity.externalId, entityType: domainEntity.entityType, duration: Date.now() - startTime };
  }
);
```

#### 3. Update Ingress
**File**: `apps/console/src/app/api/gateway/ingress/_lib/notify.ts`

Change `publishInngestNotification` to emit `"apps-console/entity.ingest"` instead of `"apps-console/event.capture"`. Add `ingestLogId` to the payload (from the ingest log insert in `route.ts`).

**File**: `apps/console/src/app/api/gateway/ingress/route.ts`

Pass the ingest log `record.id` to `publishInngestNotification()` as `ingestLogId`.

#### 4. Register New Function
**File**: `api/console/src/inngest/index.ts`

Replace `eventStore` and `eventInterpret` registrations with `entityIngest` (and later `entityGraph`, `entityEmbed`).

#### 5. Remove Old Functions
Delete:
- `api/console/src/inngest/workflow/neural/event-store.ts`
- `api/console/src/inngest/workflow/neural/event-interpret.ts`

Keep (still used):
- `edge-resolver.ts` (used by Phase 3)
- `entity-extraction-patterns.ts` (used by entity-ingest.ts step 6 — extracts semantic entities)
- `scoring.ts` (used by entity-ingest.ts step 3)
- `on-failure-handler.ts` (used by entity-ingest.ts onFailure)
- `classification.ts` (used by Phase 6 observation layer)
- `ai-helpers.ts` (used by Phase 6)

Note: `entity-extraction-patterns.ts` still extracts the same text patterns, but the results now create `workspaceSourceEntities` rows (with `source="extracted"`, `currentState=null`) instead of `workspaceExtractedEntities` rows.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Unit tests for `entityIngest` cover: new entity creation, state update (UPSERT), event-not-allowed filtering, semantic entity extraction (creates entities with `currentState=null`), "mentions" edge creation, entity transition recording

#### Manual Verification:
- [ ] Send a test webhook through relay → verify source entity appears in `workspaceSourceEntities`
- [ ] Send a second webhook for same entity (e.g., PR merged after opened) → verify `currentState` updated, `eventCount` incremented, transition recorded
- [ ] Send a Vercel `deployment.created` then `deployment.succeeded` → verify BOTH events process (idempotency bug fixed)
- [ ] Inngest dashboard shows `entity.ingest` function running, `entity.stored` events emitted
- [ ] `workspaceEntityTransitions` has correct `fromState` → `toState` history

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Graph Layer (Layer 1) — Independent Inngest Function

### Overview
Extract edge resolution from the slow path into an independent function triggered by `entity.stored`. Runs in <1s with no AI dependency.

### Changes Required:

#### 1. New Inngest Function: `entity-graph.ts`
**File**: `api/console/src/inngest/workflow/neural/entity-graph.ts` (new)

```typescript
export const entityGraph = inngest.createFunction(
  {
    id: "apps-console/entity.graph",
    retries: 3,
    timeouts: { start: "1m", finish: "2m" },
  },
  { event: "apps-console/entity.stored" },
  async ({ event, step, logger }) => {
    const { entityId, workspaceId, source, entityRefs } = event.data;

    const edgesCreated = await step.run("resolve-edges", () =>
      resolveEdges(workspaceId, entityId, source, entityRefs)
    );

    return { status: "completed", edgesCreated };
  }
);
```

#### 2. Update Edge Resolver
**File**: `api/console/src/inngest/workflow/neural/edge-resolver.ts`

Update `resolveEdges()` to query `workspaceSourceEntities` (was `workspaceEntities`). Update `workspaceEdges` references to `workspaceEntityEdges`. Co-occurrence detection now uses `workspaceEntityEdges` itself — entities that share "mentions" edges to the same semantic entity (e.g., two PRs that both mention `@sarah`) are co-occurring.

The core algorithm adapts: instead of joining through a junction table, find co-occurring lifecycle entities via shared "mentions" edges to semantic entities, then evaluate provider edge rules to create structural edges (`"fixes"`, `"deploys"`, `"references"`).

#### 3. Register Function
**File**: `api/console/src/inngest/index.ts`

Add `entityGraph` to the function list.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Send a GitHub PR webhook that references a commit → `entity.graph` creates an edge between the PR and commit source entities
- [ ] Edge creation happens in <2s after `entity.stored` (not blocked by embedding)
- [ ] Inngest dashboard shows `entity.graph` completing independently

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Vector Layer (Layer 2) — Independent Inngest Function

### Overview
Embed entity content into Pinecone with deterministic vector IDs that overwrite on state change. No LLM classification — raw embedding only. Gated on significance (entities below threshold are not vectorized).

### Changes Required:

#### 1. New Inngest Function: `entity-embed.ts`
**File**: `api/console/src/inngest/workflow/neural/entity-embed.ts` (new)

```typescript
const EMBED_SIGNIFICANCE_THRESHOLD = 30; // lower than the old 40 gate

export const entityEmbed = inngest.createFunction(
  {
    id: "apps-console/entity.embed",
    retries: 3,
    timeouts: { start: "2m", finish: "5m" },
  },
  { event: "apps-console/entity.stored" },
  async ({ event, step, logger }) => {
    const { entityExternalId, entityId, workspaceId, entityType, currentState,
            source, significanceScore, title, content } = event.data;

    // Gate: skip embedding for low-significance entities
    if (significanceScore < EMBED_SIGNIFICANCE_THRESHOLD) {
      return { status: "skipped", reason: "below_threshold" };
    }

    // Step 1: fetch workspace settings (embedding config)
    const workspace = await step.run("fetch-workspace", async () => {
      const ws = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });
      if (!ws || ws.settings?.version !== 1) throw new NonRetriableError("Workspace not found or invalid settings");
      return ws;
    });

    // Step 2: generate embeddings
    const embeddings = await step.run("generate-embeddings", async () => {
      const provider = createEmbeddingProviderForWorkspace(workspace, { inputType: "search_document" });
      const contentText = `${title}\n\n${content.slice(0, 2000)}`;
      return provider.embed([title, contentText]);
    });

    // Step 3: upsert to Pinecone (deterministic IDs → overwrites stale state)
    await step.run("upsert-entity-vectors", async () => {
      const { indexName, namespaceName } = workspace.settings.embedding;
      const baseMetadata = {
        layer: "entities",
        entityType,
        source,
        currentState,       // informational — NOT used for filtering
        domainEntityId: event.data.domainEntityId,
        title,
        entityExternalId,
      };

      await consolePineconeClient.upsertVectors(indexName, {
        ids: [
          `entity_${entityExternalId}_title`,
          `entity_${entityExternalId}_content`,
        ],
        vectors: [embeddings[0], embeddings[1]],
        metadata: [
          { ...baseMetadata, view: "title", snippet: title },
          { ...baseMetadata, view: "content", snippet: content.slice(0, 500) },
        ],
      }, namespaceName);
    });

    return { status: "embedded", vectorCount: 2 };
  }
);
```

**Key design**: Vector IDs `entity_{externalId}_title` and `entity_{externalId}_content` are deterministic per entity. When a PR transitions from "open" to "merged", the same vector IDs are UPSERTED — the old "open" content is overwritten. No stale vectors, no cleanup needed.

**Metadata includes `currentState`** for informational purposes (returned with results for display) but search queries do NOT filter on it — Postgres handles structured filtering.

#### 2. Register Function
**File**: `api/console/src/inngest/index.ts`

Add `entityEmbed` to the function list.

#### 3. Clean Old Pinecone Vectors
Old `obs_*` vectors from the previous pipeline are orphaned. These should be cleaned up:
- Query Pinecone for all vectors with `layer: "observations"` metadata
- Delete them in batches
- This can be a one-time script or an Inngest function

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Send a PR opened webhook → verify 2 vectors created in Pinecone with `entity_*` IDs
- [ ] Send a PR merged webhook for same PR → verify same vector IDs are updated (not new vectors)
- [ ] Verify vector metadata includes `entityType`, `currentState`, `source`
- [ ] Verify low-significance events (score < 30) are NOT vectorized
- [ ] Inngest dashboard shows `entity.embed` completing independently of `entity.graph`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Search System

### Overview
Implement the 4 search logic stubs (`searchLogic`, `contentsLogic`, `findSimilarLogic`, `relatedLogic`) using the new entity model. Search uses Pinecone for semantic relevance and Postgres for structured filtering — never Pinecone metadata filters for state.

### Changes Required:

#### 1. Update Validation Schemas

**File**: `packages/console-validation/src/schemas/api/common.ts`

Update `EventBaseSchema` to `EntityBaseSchema`:

```typescript
export const EntityBaseSchema = z.object({
  id: z.string(),                    // externalId
  title: z.string(),
  source: z.string(),                // provider
  entityType: z.string(),            // "pr" | "issue" | "deployment" | etc.
  currentState: z.string().nullable(),
  url: z.string().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
});
```

**File**: `packages/console-validation/src/schemas/api/search.ts`

Update `SearchResultSchema` to extend `EntityBaseSchema`:

```typescript
export const SearchResultSchema = EntityBaseSchema.extend({
  snippet: z.string().nullable(),
  score: z.number(),
  // Structured entity info from DB enrichment
  eventCount: z.number().optional(),
  firstSeenAt: z.string().datetime().optional(),
});

export const SearchFiltersSchema = z.object({
  entityTypes: z.array(z.string()).optional(),
  currentStates: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
}).optional();

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
  filters: SearchFiltersSchema,
  mode: z.enum(["semantic", "structured", "hybrid"]).default("hybrid"),
});
```

**File**: `packages/console-validation/src/schemas/api/contents.ts`

Update `ContentItemSchema`:

```typescript
export const ContentItemSchema = EntityBaseSchema.extend({
  content: z.string().optional(),
  transitions: z.array(z.object({
    fromState: z.string().nullable(),
    toState: z.string(),
    occurredAt: z.string().datetime(),
    title: z.string(),
  })).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

**File**: `packages/console-validation/src/schemas/api/related.ts`

Update `RelatedNodeSchema`:

```typescript
export const RelatedNodeSchema = EntityBaseSchema.extend({
  isRoot: z.boolean().optional(),
});

export const RelatedEdgeSchema = z.object({
  source: z.string(),  // externalId
  target: z.string(),  // externalId
  type: z.string(),    // relationship type
  confidence: z.number(),
});
```

#### 2. Implement `searchLogic`
**File**: `apps/console/src/lib/search.ts`

Three modes:

**Semantic mode**: Embed query → Pinecone top-K (no filters) → enrich from DB
**Structured mode**: Direct Postgres query with filters (entityType, currentState, source, dateRange)
**Hybrid mode** (default): Pinecone semantic search → Postgres post-filter + enrichment

```typescript
export async function searchLogic(auth: AuthContext, input: SearchRequest, requestId: string): Promise<SearchResponse> {
  const workspace = await getWorkspace(auth.workspaceId);

  if (input.mode === "structured") {
    return structuredSearch(workspace, input, requestId);
  }

  // Semantic or hybrid: embed query → Pinecone
  const provider = createEmbeddingProviderForWorkspace(workspace, { inputType: "search_query" });
  const [queryVector] = await provider.embed([input.query]);

  const matches = await pineconeClient.query<EntityVectorMetadata>(workspace.settings.embedding.indexName, {
    vector: queryVector,
    topK: input.limit * 3,  // over-fetch for post-filtering
    includeMetadata: true,
  }, workspace.settings.embedding.namespaceName);

  // Extract unique entity externalIds from matches
  const entityExternalIds = [...new Set(matches.map(m => m.metadata?.entityExternalId).filter(Boolean))];

  // Enrich from DB
  const entities = await db.query.workspaceSourceEntities.findMany({
    where: and(
      eq(workspaceSourceEntities.workspaceId, auth.workspaceId),
      inArray(workspaceSourceEntities.externalId, entityExternalIds),
    ),
  });

  // Post-filter (hybrid mode) by structured criteria
  let filtered = entities;
  if (input.mode === "hybrid" && input.filters) {
    if (input.filters.entityTypes?.length) filtered = filtered.filter(e => input.filters!.entityTypes!.includes(e.entityType));
    if (input.filters.currentStates?.length) filtered = filtered.filter(e => e.currentState != null && input.filters!.currentStates!.includes(e.currentState));
    if (input.filters.sources?.length) filtered = filtered.filter(e => input.filters!.sources!.includes(e.source));
    if (input.filters.dateRange?.start) filtered = filtered.filter(e => e.lastSeenAt >= input.filters!.dateRange!.start!);
    if (input.filters.dateRange?.end) filtered = filtered.filter(e => e.lastSeenAt <= input.filters!.dateRange!.end!);
  }

  // Merge Pinecone scores with entity data
  const scoreMap = new Map(matches.map(m => [m.metadata?.entityExternalId, m.score]));
  const results = filtered.slice(input.offset, input.offset + input.limit).map(e => ({
    id: e.externalId,
    title: e.title,
    source: e.source,
    entityType: e.entityType,
    currentState: e.currentState,
    url: e.url,
    lastSeenAt: e.lastSeenAt,
    snippet: matches.find(m => m.metadata?.entityExternalId === e.externalId)?.metadata?.snippet ?? null,
    score: scoreMap.get(e.externalId) ?? 0,
    eventCount: e.eventCount,
    firstSeenAt: e.firstSeenAt,
  }));

  return { data: results, meta: { total: filtered.length, limit: input.limit, offset: input.offset, mode: input.mode }, requestId };
}

async function structuredSearch(workspace, input, requestId) {
  // Pure DB query with filters — no Pinecone
  const conditions = [eq(workspaceSourceEntities.workspaceId, workspace.id)];
  if (input.filters?.entityTypes?.length) conditions.push(inArray(workspaceSourceEntities.entityType, input.filters.entityTypes));
  if (input.filters?.currentStates?.length) conditions.push(inArray(workspaceSourceEntities.currentState, input.filters.currentStates));
  if (input.filters?.sources?.length) conditions.push(inArray(workspaceSourceEntities.source, input.filters.sources));
  // ... dateRange conditions

  const entities = await db.query.workspaceSourceEntities.findMany({
    where: and(...conditions),
    orderBy: desc(workspaceSourceEntities.lastSeenAt),
    limit: input.limit,
    offset: input.offset,
  });

  // ... map to results
}
```

#### 3. Implement `contentsLogic`
**File**: `apps/console/src/lib/contents.ts`

```typescript
export async function contentsLogic(auth: AuthContext, input: ContentsRequest, requestId: string): Promise<ContentsResponse> {
  const entities = await db.query.workspaceSourceEntities.findMany({
    where: and(
      eq(workspaceSourceEntities.workspaceId, auth.workspaceId),
      inArray(workspaceSourceEntities.externalId, input.ids),
    ),
  });

  // Optionally fetch transitions for each entity
  const transitions = await db.query.workspaceEntityTransitions.findMany({
    where: and(
      eq(workspaceEntityTransitions.workspaceId, auth.workspaceId),
      inArray(workspaceEntityTransitions.entityId, entities.map(e => e.id)),
    ),
    orderBy: asc(workspaceEntityTransitions.occurredAt),
  });

  const transitionMap = groupBy(transitions, t => t.entityId);

  const items = entities.map(e => ({
    id: e.externalId,
    title: e.title,
    source: e.source,
    entityType: e.entityType,
    currentState: e.currentState,
    url: e.url,
    lastSeenAt: e.lastSeenAt,
    transitions: (transitionMap[e.id] ?? []).map(t => ({
      fromState: t.fromState, toState: t.toState, occurredAt: t.occurredAt, title: t.title,
    })),
    metadata: e.metadata,
  }));

  const missing = input.ids.filter(id => !entities.some(e => e.externalId === id));

  return { data: { items, missing }, meta: { total: items.length }, requestId };
}
```

#### 4. Implement `findSimilarLogic`
**File**: `apps/console/src/lib/findsimilar.ts`

```typescript
export async function findSimilarLogic(auth: AuthContext, input: FindSimilarRequest, requestId: string) {
  // Look up the source entity
  const entity = await db.query.workspaceSourceEntities.findFirst({
    where: and(eq(workspaceSourceEntities.workspaceId, auth.workspaceId), eq(workspaceSourceEntities.externalId, input.entityId)),
  });
  if (!entity) throw new Error("Entity not found");

  const workspace = await getWorkspace(auth.workspaceId);

  // Query Pinecone by the entity's existing vector
  const vectorId = `entity_${entity.externalId}_content`;
  // Fetch the vector, then query for similar
  const provider = createEmbeddingProviderForWorkspace(workspace, { inputType: "search_document" });
  const [queryVector] = await provider.embed([`${entity.title}\n\n${entity.metadata?.body ?? ""}`]);

  const matches = await pineconeClient.query(workspace.settings.embedding.indexName, {
    vector: queryVector,
    topK: input.limit + 1,  // +1 to exclude self
    includeMetadata: true,
  }, workspace.settings.embedding.namespaceName);

  // Filter out self, enrich from DB
  const otherMatches = matches.filter(m => m.metadata?.entityExternalId !== input.entityId);
  // ... enrich + return
}
```

#### 5. Implement `relatedLogic`
**File**: `apps/console/src/lib/related.ts`

```typescript
export async function relatedLogic(auth: AuthContext, input: RelatedRequest, requestId: string) {
  const rootEntity = await db.query.workspaceSourceEntities.findFirst({
    where: and(eq(workspaceSourceEntities.workspaceId, auth.workspaceId), eq(workspaceSourceEntities.externalId, input.entityId)),
  });
  if (!rootEntity) throw new Error("Entity not found");

  // BFS graph traversal via workspaceEntityEdges
  const maxDepth = input.depth ?? 2;
  const visited = new Set<number>([rootEntity.id]);
  const edges: Array<{ sourceId: number; targetId: number; type: string; confidence: number }> = [];
  let frontier = [rootEntity.id];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const nextEdges = await db.query.workspaceEntityEdges.findMany({
      where: and(
        eq(workspaceEntityEdges.workspaceId, auth.workspaceId),
        or(
          inArray(workspaceEntityEdges.sourceEntityId, frontier),
          inArray(workspaceEntityEdges.targetEntityId, frontier),
        ),
      ),
    });

    const nextFrontier: number[] = [];
    for (const edge of nextEdges) {
      edges.push({ sourceId: edge.sourceEntityId, targetId: edge.targetEntityId, type: edge.relationshipType, confidence: edge.confidence });
      for (const nodeId of [edge.sourceEntityId, edge.targetEntityId]) {
        if (!visited.has(nodeId)) { visited.add(nodeId); nextFrontier.push(nodeId); }
      }
    }
    frontier = nextFrontier;
  }

  // Fetch all visited entities
  const allEntities = await db.query.workspaceSourceEntities.findMany({
    where: inArray(workspaceSourceEntities.id, [...visited]),
  });

  const entityMap = new Map(allEntities.map(e => [e.id, e]));

  return {
    data: {
      root: mapToEntityBase(rootEntity, true),
      nodes: allEntities.map(e => mapToEntityBase(e, e.id === rootEntity.id)),
      edges: edges.map(e => ({
        source: entityMap.get(e.sourceId)?.externalId ?? "",
        target: entityMap.get(e.targetId)?.externalId ?? "",
        type: e.type,
        confidence: e.confidence,
      })),
    },
    meta: { total: allEntities.length },
    requestId,
  };
}
```

#### 6. Update tRPC Routers
**File**: `api/console/src/router/org/search.ts`

Update `searchRouter.query` to query `workspaceSourceEntities` and entity-level Pinecone vectors (same approach as `searchLogic`).

**File**: `api/console/src/router/org/contents.ts`

Update `contentsRouter.fetch` to query `workspaceSourceEntities` + `workspaceEntityTransitions`.

#### 7. Update AI Tool Schemas
**File**: `packages/console-ai/src/workspace-search.ts`

Update the inline `inputSchema` to match new `SearchRequestSchema` (add `mode` field, update filter names).

**Files**: `workspace-contents.ts`, `workspace-find-similar.ts`, `workspace-related.ts`

Update input/output schemas to match new entity-based response shapes.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Validation schemas compile and export correctly

#### Manual Verification:
- [ ] After ingesting several webhook events, semantic search ("what happened with auth") returns entity results with current state
- [ ] Structured search (mode="structured", filters={entityTypes: ["pr"]}) returns PRs from DB
- [ ] Hybrid search (mode="hybrid", query="auth", filters={currentStates: ["open"]}) returns only open entities semantically related to "auth"
- [ ] Contents endpoint returns entity details with transition history
- [ ] FindSimilar returns semantically similar entities
- [ ] Related returns graph neighborhood with edges
- [ ] AI agent answer route (`/v1/answer`) can use all 4 tools successfully

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Observation Layer (Layer 3)

### Overview
Scheduled AI synthesis that analyzes entity patterns over time windows and creates derived insights. This is the only layer that uses LLM classification. Runs on a schedule, not per-event.

### Changes Required:

#### 1. Add Inngest Event
**File**: `api/console/src/inngest/client/client.ts`

```typescript
"apps-console/entity.observe": z.object({
  workspaceId: z.string(),
  timeWindowStart: z.string().datetime(),
  timeWindowEnd: z.string().datetime(),
}),
```

#### 2. New Inngest Function: `entity-observe.ts`
**File**: `api/console/src/inngest/workflow/neural/entity-observe.ts` (new)

Triggered on a 15-minute schedule per workspace, or manually. Analyzes recent entity transitions and creates synthesized observations.

```typescript
export const entityObserve = inngest.createFunction(
  {
    id: "apps-console/entity.observe",
    retries: 2,
    timeouts: { start: "2m", finish: "10m" },
  },
  { event: "apps-console/entity.observe" },
  async ({ event, step }) => {
    const { workspaceId, timeWindowStart, timeWindowEnd } = event.data;

    // Step 1: fetch recent transitions in time window
    const transitions = await step.run("fetch-transitions", () =>
      db.query.workspaceEntityTransitions.findMany({
        where: and(
          eq(workspaceEntityTransitions.workspaceId, workspaceId),
          gte(workspaceEntityTransitions.occurredAt, timeWindowStart),
          lte(workspaceEntityTransitions.occurredAt, timeWindowEnd),
        ),
        with: { entity: true },
      })
    );

    if (transitions.length < 3) return { status: "skipped", reason: "insufficient_activity" };

    // Step 2: classify with LLM — "what patterns do you see?"
    const observations = await step.ai.wrap("synthesize-observations", async () => {
      return generateObject({
        model: createTracedModel("anthropic/claude-3-5-haiku-latest"),
        schema: observationResponseSchema,
        prompt: buildObservationPrompt(transitions),
        temperature: 0.3,
      });
    });

    // Step 3: store observations + embed
    for (const obs of observations.object.insights) {
      await step.run(`store-observation-${obs.type}`, async () => {
        const [row] = await db.insert(workspaceObservations).values({
          workspaceId,
          observationType: obs.type,
          title: obs.title,
          summary: obs.summary,
          timeWindowStart,
          timeWindowEnd,
          entityIds: obs.entityIds,
          topics: obs.topics,
          confidence: obs.confidence,
          modelVersion: "claude-3-5-haiku",
          processedAt: new Date().toISOString(),
        }).returning({ id: workspaceObservations.id, externalId: workspaceObservations.externalId });

        // Embed observation for semantic search
        // ... similar to entity-embed but with layer: "observations"
      });
    }

    return { status: "observed", observationCount: observations.object.insights.length };
  }
);
```

#### 3. Observation Scheduler
A separate Inngest cron function that emits `entity.observe` events for each active workspace every 15 minutes.

#### 4. Register Functions
**File**: `api/console/src/inngest/index.ts`

Add `entityObserve` and the scheduler to the function list.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] After accumulating entity activity, manually trigger `entity.observe` → verify observations created in DB
- [ ] Observations reference correct entity externalIds
- [ ] Observation vectors appear in Pinecone with `layer: "observations"` metadata
- [ ] Semantic search can find observations alongside entities

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Final Cleanup

### Overview
Remove all vestiges of the old pipeline.

### Changes Required:

1. **Delete old files**:
   - `api/console/src/inngest/workflow/neural/event-store.ts` (if not already deleted in Phase 2)
   - `api/console/src/inngest/workflow/neural/event-interpret.ts` (if not already deleted in Phase 2)
   - `api/console/src/inngest/workflow/neural/classification.ts` (if observation layer doesn't reuse it)
   - Old table definition files if fully replaced (not renamed)

2. **Clean old Pinecone vectors**: Run a one-time script to delete all vectors with `layer: "observations"` from the old pipeline (vector IDs matching `obs_*` pattern).

3. **Remove old Inngest event schemas**: Remove `apps-console/event.capture`, `apps-console/event.stored`, `apps-console/event.interpreted` from `client.ts` if not already done.

4. **Update validation package exports**: Remove any re-exports of old schemas (`ObservationVectorMetadata`, etc.)

5. **Verify no dead code**: Run `pnpm check` and `pnpm typecheck` to ensure nothing references deleted tables or functions.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm check` passes with no errors
- [ ] `pnpm build:console` succeeds
- [ ] No references to `workspaceEvents` or `workspaceInterpretations` in codebase

#### Manual Verification:
- [ ] Full end-to-end test: webhook → entity created → graph edges → Pinecone vectors → search returns results
- [ ] Inngest dashboard shows only new functions (`entity.ingest`, `entity.graph`, `entity.embed`, `entity.observe`)
- [ ] No old `obs_*` vectors remain in Pinecone

---

## Testing Strategy

### Unit Tests:
- `extractDomainEntity()` — all 4 providers × all entity types × edge cases (missing action suffix, unknown event types)
- `mapGitHubPrState()`, `mapGitHubIssueState()` — all valid state transitions
- Entity UPSERT logic — new entity vs state update
- Search post-filtering logic — all filter combinations
- Graph BFS traversal — cycle detection, depth limits

### Integration Tests:
- Full pipeline: ingest → entity.stored → entity.graph + entity.embed (parallel) → verify DB + Pinecone state
- Idempotency: send same event twice → verify only 1 entity, 1 transition
- Vercel lifecycle: send deployment.created then deployment.succeeded → verify state progression
- Search roundtrip: ingest events → semantic search → verify results match

### Manual Testing Steps:
1. Send GitHub PR opened webhook → verify entity + transition + vector + edge
2. Send GitHub PR merged webhook for same PR → verify state updated, vector overwritten, new transition
3. Search "what PRs are open" → verify only non-merged PRs returned
4. Search "auth" semantically → verify relevant entities regardless of state
5. Get related entities for a deployment → verify graph shows connected commits/PRs

## Performance Considerations

- **Entity UPSERT**: Single atomic operation per event. No SELECT-then-INSERT race condition.
- **Pinecone UPSERT**: 2 vectors per entity (down from 3 per event). Total vector count is proportional to entities, not events.
- **Graph independence**: Edge resolution completes in <1s, no longer blocked by 10-30s AI pipeline.
- **Significance gating**: Entity store creates all entities (complete data). Vector layer gates on significance ≥30 (reduces Pinecone writes for noise). Observation layer gates on activity volume (reduces LLM calls).
- **Concurrency**: Entity ingest maintains limit of 10 per workspace. Graph and embed functions run without concurrency limits (they're fast).

## Migration Notes

- No data migration needed — user confirmed starting fresh
- Old tables are dropped in the schema migration
- Old Pinecone vectors (`obs_*` IDs) are cleaned up in Phase 7
- Old Inngest functions are unregistered when new ones are deployed

## References

- Research document: `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md`
- Search system reset research: `thoughts/shared/research/2026-03-13-search-system-reset.md`
- Current fast path: `api/console/src/inngest/workflow/neural/event-store.ts:107-551`
- Current slow path: `api/console/src/inngest/workflow/neural/event-interpret.ts:102-414`
- Edge resolver: `api/console/src/inngest/workflow/neural/edge-resolver.ts:26-310`
- Provider registry: `packages/console-providers/src/registry.ts:27-36`
- DB schema tables: `db/console/src/schema/tables/`
- Ingress route: `apps/console/src/app/api/gateway/ingress/route.ts:28-98`
- Inngest client: `api/console/src/inngest/client/client.ts:20-244`
