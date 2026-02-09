---
date: 2026-02-09T06:48:16+0000
researcher: Claude (Sonnet 4.5)
git_commit: dbfbd53dde010dd6d1edee6f0f51cd744bea6468
branch: feat/type-system-standardization
repository: lightfast
topic: "Location of deleted TypeScript types from apps/console/src/types"
tags: [research, codebase, typescript, types, tRPC, console]
status: complete
last_updated: 2026-02-09
last_updated_by: Claude (Sonnet 4.5)
---

# Research: Location of Deleted TypeScript Types from apps/console/src/types

**Date**: 2026-02-09T06:48:16+0000
**Researcher**: Claude (Sonnet 4.5)
**Git Commit**: dbfbd53dde010dd6d1edee6f0f51cd744bea6468
**Branch**: feat/type-system-standardization
**Repository**: lightfast

## Research Question

Find where types like `Job`, `JobStatus`, `WorkspaceActivity`, `ActivityCategory`, `ActorType`, `Store`, `EnrichedConnection`, `Source`, `WorkspaceMetricsSummary`, `JobPercentiles`, and `PerformanceTimeSeries` are defined in the codebase. These were previously imported from `~/types` (apps/console/src/types/index.ts) which has been deleted. Need to know their proper source location to fix broken imports in apps/console/src/components files.

## Summary

The file `apps/console/src/types/index.ts` has been deleted, causing 7 component files to have broken imports. All of these types are available from three primary sources:

1. **tRPC Router Outputs** - Inferred types from `@repo/console-trpc/types` (recommended for frontend)
2. **Validation Schemas** - Zod schema types from `@repo/console-validation`
3. **Database Schemas** - Drizzle ORM types from `@db/console`

The deleted types file was serving as a convenient re-export layer that extracted specific types from these packages.

## Detailed Findings

### Job and JobStatus Types

**Primary Sources:**

1. **Database Schema (Source of Truth)**
   - File: `db/console/src/schema/tables/workspace-workflow-runs.ts`
   - Exports: `WorkspaceWorkflowRun`, `InsertWorkspaceWorkflowRun`
   - Available as: `import type { WorkspaceWorkflowRun } from "@db/console"`

2. **Validation Schema**
   - File: `packages/console-validation/src/schemas/job.ts`
   - Exports: `JobStatus`, `JobTrigger`, `JobCreateInput`, etc.
   - `JobStatus` enum: `"queued" | "running" | "completed" | "failed" | "cancelled"`
   - Available as: `import { JobStatus } from "@repo/console-validation"`

3. **tRPC Router (Recommended for Frontend)**
   - File: `api/console/src/router/org/jobs.ts`
   - Router: `jobsRouter` with procedures (`list`, `get`, etc.)
   - Type derivation:
     ```typescript
     import type { RouterOutputs } from "@repo/console-trpc/types";
     type JobsListResponse = RouterOutputs["jobs"]["list"];
     type Job = JobsListResponse["items"][number];
     ```

**Broken Imports:**
- `apps/console/src/components/jobs-table.tsx:38`
- `apps/console/src/lib/performance-utils.ts:5`

### WorkspaceActivity, ActivityCategory, ActorType Types

**Primary Sources:**

1. **Validation Schemas (Source of Truth)**
   - File: `packages/console-validation/src/schemas/activities.ts`
   - Exports:
     - `ActorType` - Zod enum: `["user", "system", "webhook", "api"]`
     - `ActivityCategory` - Zod enum with 10 categories
     - `ActivityAction` - Generic string schema
   - Available as: `import type { ActivityCategory, ActorType } from "@repo/console-validation"`

2. **Database Schema**
   - File: `db/console/src/schema/tables/workspace-user-activities.ts`
   - Exports: `WorkspaceUserActivity`, `InsertWorkspaceUserActivity`
   - Imports validation types from `@repo/console-validation`
   - Available as: `import type { WorkspaceUserActivity } from "@db/console"`

3. **tRPC Router**
   - File: `api/console/src/router/org/activities.ts`
   - Router: `activitiesRouter` with procedures (`list`, `stats`)
   - Type derivation:
     ```typescript
     import type { RouterOutputs } from "@repo/console-trpc/types";
     type WorkspaceActivity = RouterOutputs["activities"]["list"]["activities"][number];
     ```

**Broken Imports:**
- `apps/console/src/components/activity-timeline.tsx:40`

### Store, EnrichedConnection, Source Types

**Primary Sources:**

1. **Database Schemas**
   - File: `db/console/src/schema/tables/user-sources.ts`
     - Exports: `UserSource`, `GitHubUserSource`, `VercelUserSource`
   - File: `db/console/src/schema/tables/workspace-integrations.ts`
     - Exports: `WorkspaceIntegration`
   - File: `db/console/src/schema/tables/org-workspaces.ts`
     - Exports: `OrgWorkspace` (contains store config in settings)

2. **Validation Schemas**
   - File: `packages/console-validation/src/schemas/store.ts`
     - Exports: `StoreGetOrCreateInput`, `StoreConfiguration`
   - File: `packages/console-validation/src/schemas/sources.ts`
     - Exports: `SourceType`, `ConfigStatus`, `SyncStatus`

3. **tRPC Routers**
   - File: `api/console/src/router/user/user-sources.ts`
     - Procedures: `list`, `github.get`, `github.repositories`, etc.
   - File: `api/console/src/router/org/workspace.ts`
     - Procedure: `sources.list` (returns source objects)

**Note:** These types appear to be **composite/enriched types** that were manually defined in the deleted types file by combining multiple database schemas.

**Broken Imports:**
- `apps/console/src/components/connected-sources-overview.tsx:7`
- `apps/console/src/components/stores-overview.tsx:14`

### WorkspaceMetricsSummary, JobPercentiles, PerformanceTimeSeries Types

**Primary Sources:**

1. **tRPC Router Implementation**
   - File: `api/console/src/router/org/workspace.ts`
   - Procedures:
     - `jobPercentiles` (lines 319-387) - Returns: `{ hasData, p50, p95, p99, max, sampleSize }`
     - `performanceTimeSeries` (lines 393-490) - Returns array of `{ timestamp, hour, jobCount, avgDuration, successRate }`

2. **Validation Schemas**
   - File: `packages/console-validation/src/schemas/workspace.ts`
   - Input schemas:
     - `workspaceJobPercentilesInputSchema`
     - `workspacePerformanceTimeSeriesInputSchema`
     - `workspaceStatisticsInputSchema`

3. **Type Inference**
   - File: `packages/console-trpc/src/types.ts`
   - Exports: `RouterOutputs` inferred from console routers
   - Type derivation:
     ```typescript
     import type { RouterOutputs } from "@repo/console-trpc/types";
     type JobPercentiles = RouterOutputs["workspace"]["jobPercentiles"];
     type PerformanceTimeSeries = RouterOutputs["workspace"]["performanceTimeSeries"];
     ```

**Note:** `WorkspaceMetricsSummary` appears to be a custom interface combining multiple router outputs.

**Broken Imports:**
- `apps/console/src/components/metrics-sidebar.tsx:13`
- `apps/console/src/components/performance-metrics.tsx:9`

## Code References

### Deleted Types File
- `apps/console/src/types/index.ts` - **DELETED** (exists in worktree: `worktrees/console-db-deploy/apps/console/src/types/index.ts`)

### Components with Broken Imports (7 files)
1. `apps/console/src/components/activity-timeline.tsx:40` - Imports `WorkspaceActivity`, `ActivityCategory`, `ActorType`
2. `apps/console/src/components/connected-sources-overview.tsx:7` - Imports `EnrichedConnection`, `Source`
3. `apps/console/src/components/jobs-table.tsx:38` - Imports `Job`, `JobStatus`
4. `apps/console/src/components/metrics-sidebar.tsx:13` - Imports `WorkspaceMetricsSummary`
5. `apps/console/src/components/performance-metrics.tsx:9` - Imports `JobPercentiles`, `PerformanceTimeSeries`
6. `apps/console/src/components/stores-overview.tsx:14` - Imports `Store`
7. `apps/console/src/lib/performance-utils.ts:5` - Imports `Job`

### Type Source Packages
- `packages/console-validation/` - Zod validation schemas and inferred types
- `packages/console-trpc/src/types.ts` - tRPC router output types
- `db/console/src/schema/` - Drizzle ORM database schemas
- `api/console/src/router/` - tRPC router implementations

## Architecture Documentation

### Type Hierarchy

```
Database Schema (Drizzle ORM)
    ↓
Used in tRPC router procedures
    ↓
RouterOutputs type inference
    ↓
apps/console/src/types/index.ts (DELETED)
    ↓
Component imports via ~/types
```

### Export Patterns by Type Category

| Type | Validation Layer | Database Layer | tRPC Layer | Deleted Frontend Layer |
|------|-----------------|----------------|------------|----------------------|
| **Job** | N/A | `WorkspaceWorkflowRun` | `RouterOutputs["jobs"]["list"]["items"][0]` | `~/types` |
| **JobStatus** | `@repo/console-validation` | Imported from validation | Query field | `~/types` |
| **WorkspaceActivity** | N/A | `WorkspaceUserActivity` | `RouterOutputs["activities"]["list"]["activities"][0]` | `~/types` |
| **ActivityCategory** | `@repo/console-validation` | Imported from validation | Query field | `~/types` |
| **ActorType** | `@repo/console-validation` | Imported from validation | Query field | `~/types` |
| **Store** | `StoreConfiguration` | Embedded in `OrgWorkspace.settings` | N/A | `~/types` (custom) |
| **Source** | `SourceType` | `UserSource` | `RouterOutputs["workspace"]["sources"]["list"]` | `~/types` |
| **EnrichedConnection** | N/A | N/A | N/A | `~/types` (composite) |
| **JobPercentiles** | Input schema only | N/A | `RouterOutputs["workspace"]["jobPercentiles"]` | `~/types` |
| **PerformanceTimeSeries** | Input schema only | N/A | `RouterOutputs["workspace"]["performanceTimeSeries"]` | `~/types` |
| **WorkspaceMetricsSummary** | N/A | N/A | N/A | `~/types` (custom interface) |

### Three-Layer Type System

The console app uses a three-layer type architecture:

1. **Source Layer** (packages + db + api)
   - Validation: Zod schemas → inferred types
   - Database: Drizzle tables → `$inferSelect` types
   - API: tRPC procedures → inferred outputs

2. **Re-export Layer** (deleted: `apps/console/src/types/index.ts`)
   - Convenience imports for components
   - Type extraction from `RouterOutputs`
   - Custom composite types

3. **Consumer Layer** (components)
   - Import via `~/types` alias
   - Use in React components
   - Pass to utility functions

## Related Research

- See `thoughts/shared/plans/2026-02-09-type-system-standardization.md` for the plan to standardize type imports

## Recommendations for Fixing Broken Imports

### Option 1: Restore the Deleted Types File (Recommended)
Re-create `apps/console/src/types/index.ts` with proper type re-exports:

```typescript
import type { RouterOutputs } from "@repo/console-trpc/types";
import type {
  JobStatus,
  ActivityCategory,
  ActorType
} from "@repo/console-validation";

// Job types from tRPC
export type JobsListResponse = RouterOutputs["jobs"]["list"];
export type Job = JobsListResponse["items"][number];
export { JobStatus };

// Activity types
export type WorkspaceActivity = RouterOutputs["activities"]["list"]["activities"][number];
export { ActivityCategory, ActorType };

// Metrics types
export type JobPercentiles = RouterOutputs["workspace"]["jobPercentiles"];
export type PerformanceTimeSeries = RouterOutputs["workspace"]["performanceTimeSeries"];

// Custom composite types
export interface WorkspaceMetricsSummary {
  // Define based on actual usage
}

export interface EnrichedConnection {
  // Define based on actual usage
}

// ... etc
```

### Option 2: Direct Package Imports
Update each component to import directly from source packages:

```typescript
// Instead of: import type { Job } from "~/types";
import type { RouterOutputs } from "@repo/console-trpc/types";
type Job = RouterOutputs["jobs"]["list"]["items"][number];

// Instead of: import type { JobStatus } from "~/types";
import type { JobStatus } from "@repo/console-validation";
```

### Option 3: Per-Feature Type Files
Create feature-specific type files:
- `apps/console/src/types/jobs.ts`
- `apps/console/src/types/activities.ts`
- `apps/console/src/types/metrics.ts`
- etc.

## Open Questions

1. What was the original structure of the deleted `apps/console/src/types/index.ts`?
2. Should composite types like `EnrichedConnection` and `WorkspaceMetricsSummary` be defined in the frontend or derived from new tRPC procedures?
3. Should we maintain the convenience re-export layer or migrate to direct package imports?
