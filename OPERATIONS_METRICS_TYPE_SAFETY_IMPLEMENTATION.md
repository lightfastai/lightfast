# Operations Metrics Type Safety Implementation Plan

## Overview

Fix type safety issues in the `tags` field of `workspace-operations-metrics` table by removing the escape hatch and creating proper discriminated union types that align with the application layer implementation.

---

## Current State

### Database Schema
**File**: `db/console/src/schema/tables/workspace-operations-metrics.ts`

**Lines 95-96, 142-150**:
```typescript
tags: jsonb("tags").$type<OperationMetricTags>()

export interface OperationMetricTags {
  jobType?: string;           // Inngest function ID
  trigger?: string;           // Job trigger type
  errorType?: string;         // Error classification
  sourceType?: string;        // Source provider type
  syncMode?: string;          // Sync mode
  filesProcessed?: number;    // Number of files processed
  [key: string]: unknown;     // ❌ ESCAPE HATCH - never used
}
```

**Problems**:
- All fields are optional (should have type-specific required fields)
- Generic string types instead of literal unions
- `[key: string]: unknown` escape hatch (never used in codebase)
- No discrimination by metric type

### Application Layer (Well-Designed)
**File**: `api/console/src/lib/jobs.ts` (lines 220-260)

Already has a proper discriminated union:
```typescript
export async function recordJobMetric(
  params: (
    | {
        type: "job_duration";
        value: number;
        unit: "ms";
        tags: {
          jobType: string;
          trigger: JobTrigger;
          syncMode?: "full" | "incremental";
          sourceType?: string;
        };
      }
    | {
        type: "documents_indexed";
        value: number;
        unit: "count";
        tags: {
          jobType: string;
          sourceType: string;  // Required
          syncMode?: "full" | "incremental";
          filesProcessed?: number;
        };
      }
    | {
        type: "errors";
        value: 1;
        unit: "count";
        tags: {
          jobType: string;
          errorType: string;  // Required
          trigger?: JobTrigger;
          sourceType?: string;
        };
      }
  ) & {
    clerkOrgId: string;
    workspaceId: string;
    repositoryId?: string;
  }
): Promise<void>
```

---

## Implementation Plan

### 1. Create Validation Schemas

**File**: `packages/console-validation/src/schemas/metrics.ts`

Update existing schemas (lines 40-110) to export tag types:

```typescript
import { z } from "zod";
import { jobTriggerSchema } from "./job";

// Job duration metric tags
export const jobDurationTagsSchema = z.object({
  jobType: z.string(),
  trigger: jobTriggerSchema,
  syncMode: z.enum(["full", "incremental"]).optional(),
  sourceType: z.string().optional(),
});

// Documents indexed metric tags
export const documentsIndexedTagsSchema = z.object({
  jobType: z.string(),
  sourceType: z.string(),
  syncMode: z.enum(["full", "incremental"]).optional(),
  filesProcessed: z.number().int().nonnegative().optional(),
});

// Error metric tags
export const errorTagsSchema = z.object({
  jobType: z.string(),
  errorType: z.string(),
  trigger: jobTriggerSchema.optional(),
  sourceType: z.string().optional(),
});

// Type exports
export type JobDurationTags = z.infer<typeof jobDurationTagsSchema>;
export type DocumentsIndexedTags = z.infer<typeof documentsIndexedTagsSchema>;
export type ErrorTags = z.infer<typeof errorTagsSchema>;
```

**File**: `packages/console-validation/src/index.ts`

Line ~60: Add exports
```typescript
export type { JobDurationTags, DocumentsIndexedTags, ErrorTags } from "./schemas/metrics";
```

---

### 2. Update Database Schema

**File**: `db/console/src/schema/tables/workspace-operations-metrics.ts`

**Line 1-11**: Add import
```typescript
import type { JobDurationTags, DocumentsIndexedTags, ErrorTags } from "@repo/console-validation";
```

**Line 96**: Update type annotation
```typescript
tags: jsonb("tags").$type<OperationMetricTags>(),
```

**Lines 142-151**: Replace loose interface with discriminated union
```typescript
// Type re-exports from validation schemas
export type { JobDurationTags, DocumentsIndexedTags, ErrorTags } from "@repo/console-validation";

// Discriminated union based on metric type (type column)
// Note: Cannot discriminate at schema level since type is separate column
// This is a union of possible tag structures
export type OperationMetricTags = JobDurationTags | DocumentsIndexedTags | ErrorTags;
```

---

### 3. Update Job Library Function

**File**: `api/console/src/lib/jobs.ts`

**Line 10**: Add import
```typescript
import type { JobDurationTags, DocumentsIndexedTags, ErrorTags } from "@repo/console-validation";
```

**Lines 220-260**: Update parameter types to use imported types
```typescript
export async function recordJobMetric(
  params: (
    | {
        type: "job_duration";
        value: number;
        unit: "ms";
        tags: JobDurationTags;
      }
    | {
        type: "documents_indexed";
        value: number;
        unit: "count";
        tags: DocumentsIndexedTags;
      }
    | {
        type: "errors";
        value: 1;
        unit: "count";
        tags: ErrorTags;
      }
  ) & {
    clerkOrgId: string;
    workspaceId: string;
    repositoryId?: string;
  }
): Promise<void>
```

---

### 4. Update tRPC M2M Router

**File**: `api/console/src/router/m2m/jobs.ts`

**Line 4**: Add import
```typescript
import { jobDurationTagsSchema, documentsIndexedTagsSchema, errorTagsSchema } from "@repo/console-validation";
```

**Lines 100-153**: Update Zod schemas to use imported schemas
```typescript
recordMetric: inngestM2MProcedure
  .input(
    z.discriminatedUnion("type", [
      // job_duration metric
      z.object({
        clerkOrgId: z.string(),
        workspaceId: z.string(),
        repositoryId: z.string().optional(),
        type: z.literal("job_duration"),
        value: z.number().int().positive(),
        unit: z.literal("ms"),
        tags: jobDurationTagsSchema,
      }),
      // documents_indexed metric
      z.object({
        clerkOrgId: z.string(),
        workspaceId: z.string(),
        repositoryId: z.string().optional(),
        type: z.literal("documents_indexed"),
        value: z.number().int().nonnegative(),
        unit: z.literal("count"),
        tags: documentsIndexedTagsSchema,
      }),
      // errors metric
      z.object({
        clerkOrgId: z.string(),
        workspaceId: z.string(),
        repositoryId: z.string().optional(),
        type: z.literal("errors"),
        value: z.literal(1),
        unit: z.literal("count"),
        tags: errorTagsSchema,
      }),
    ])
  )
  .mutation(async ({ input }) => {
    await recordJobMetric(input);
    return { success: true };
  }),
```

---

## Verification

### All Calls to `recordJobMetric`

**1. `completeJob` - job_duration** (`api/console/src/lib/jobs.ts`, lines 173-184):
```typescript
await recordJobMetric({
  clerkOrgId: job.clerkOrgId,
  workspaceId: job.workspaceId,
  repositoryId: job.repositoryId ?? undefined,
  type: "job_duration",
  value: Number.parseInt(durationMs, 10),
  unit: "ms",
  tags: {
    jobType: job.inngestFunctionId,
    trigger: job.trigger,  // Already typed as JobTrigger
  },
});
```
✅ Already matches `JobDurationTags` schema

**2. `completeJob` - errors** (`api/console/src/lib/jobs.ts`, lines 189-200):
```typescript
await recordJobMetric({
  clerkOrgId: job.clerkOrgId,
  workspaceId: job.workspaceId,
  repositoryId: job.repositoryId ?? undefined,
  type: "errors",
  value: 1,
  unit: "count",
  tags: {
    jobType: job.inngestFunctionId,
    errorType: "job_failure",
  },
});
```
✅ Already matches `ErrorTags` schema

**3. tRPC M2M router** (`api/console/src/router/m2m/jobs.ts`, line 151):
```typescript
await recordJobMetric(input);  // Validated by Zod schema
```
✅ Will be validated by new schemas

---

## Build and Test

```bash
# Build validation package
pnpm --filter @repo/console-validation build

# Build database package
pnpm --filter @db/console build

# Type check API
pnpm --filter @api/console typecheck

# Build everything
pnpm build:console
```

---

## Summary

**Files Modified**: 4
**New Files**: 0
**Breaking Changes**: No (union type is compatible with existing data)

**Changes**:
1. ✅ Remove `[key: string]: unknown` escape hatch
2. ✅ Create proper discriminated union types
3. ✅ Align database schema with application layer
4. ✅ Use shared validation schemas
5. ✅ Type-specific required fields enforced

**Type Safety Improvements**:
- `errorType` required for errors metrics (was optional)
- `sourceType` required for documents_indexed metrics (was optional)
- `trigger` typed as `JobTrigger` enum (was generic string)
- `syncMode` typed as `"full" | "incremental"` (was generic string)
- No escape hatch allowing arbitrary fields

**Note**: The `documents_indexed` metric type is defined but not yet used in the codebase. When implementing document indexing metrics in the future, the types will be ready.
