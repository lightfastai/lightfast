# Neural Workflow Metrics Enhancement Implementation Plan

## Overview

Add full job lifecycle tracking to neural observation workflows, matching the existing pattern used by the sync orchestrator for GitHub docs ingestion. This enables job history queries, debugging failed runs, and structured input/output storage for all neural workflows.

## Current State Analysis

### Sync Orchestrator (Reference Implementation)

The sync orchestrator (`sync-orchestrator.ts`) has full job tracking:
- Creates job record at start via `createJob()`
- Updates status to "running" via `updateJobStatus()`
- Completes with structured output via `completeJob()`
- Stores input/output with validated schemas in `workflow-io.ts`
- Job duration metric auto-recorded on completion

### Neural Workflows (Current Gap)

All 4 neural workflows have **no job tracking**:
- `observation-capture.ts` - Main workflow
- `profile-update.ts` - Actor profile updates
- `cluster-summary.ts` - LLM summary generation
- `llm-entity-extraction-workflow.ts` - Async entity extraction

They only record fire-and-forget metrics with no:
- Job history in `workspaceWorkflowRuns` table
- Queryable workflow execution state
- Structured input/output storage
- Debuggable failure records

## Desired End State

After implementation:

1. **All neural workflows create job records** in `workspaceWorkflowRuns`
2. **Full lifecycle tracking**: queued → running → completed/failed
3. **Structured I/O**: Input parameters and output results stored with validated schemas
4. **Job history queries**: "Show all observation captures from yesterday"
5. **Failure debugging**: Query failed jobs with error messages and inputs

### Key Queries Enabled

```sql
-- All failed neural workflows in last 24 hours
SELECT id, inngest_function_id, name, error_message, created_at
FROM lightfast_workspace_workflow_runs
WHERE status = 'failed'
AND inngest_function_id LIKE 'neural.%'
AND created_at > NOW() - INTERVAL '24 hours';

-- Observation capture job history for a workspace
SELECT id, status, duration_ms, created_at, output
FROM lightfast_workspace_workflow_runs
WHERE workspace_id = 'ws_xxx'
AND inngest_function_id = 'neural.observation.capture'
ORDER BY created_at DESC
LIMIT 50;

-- Average duration by workflow type
SELECT inngest_function_id, AVG(duration_ms::int) as avg_duration
FROM lightfast_workspace_workflow_runs
WHERE inngest_function_id LIKE 'neural.%'
AND status = 'completed'
GROUP BY inngest_function_id;
```

## What We're NOT Doing

- **LLM token/cost tracking**: Braintrust middleware handles this (already implemented)
- **Step-level job records**: One job per workflow execution, not per step
- **Retry count in local DB**: Inngest platform tracks retries

## Implementation Approach

1. Define input/output schemas for each neural workflow in `workflow-io.ts`
2. Add job creation, status updates, and completion to each workflow
3. Add analytics metrics for operational insights (actor resolution, cluster affinity)

---

## Phase 1: Define Neural Workflow I/O Schemas

### Overview
Add input and output schemas for all 4 neural workflows to the discriminated union in `workflow-io.ts`.

### Changes Required:

#### 1. Neural Workflow Input/Output Schemas
**File**: `packages/console-validation/src/schemas/workflow-io.ts`
**Changes**: Add neural workflow schemas

```typescript
// =============================================================================
// NEURAL OBSERVATION CAPTURE - INPUT
// =============================================================================

const neuralObservationCaptureInputSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  sourceId: z.string(),
  source: z.string(), // github, vercel
  sourceType: z.string(), // push, pull_request, deployment.succeeded
  title: z.string(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (SUCCESS)
// =============================================================================

const neuralObservationCaptureOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("success"),
  observationId: z.string(), // externalId (nanoid)
  observationType: z.string(),
  significanceScore: z.number(),
  entitiesExtracted: z.number().int().nonnegative(),
  clusterId: z.string(),
  clusterIsNew: z.boolean(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (FILTERED/SKIPPED)
// =============================================================================

const neuralObservationCaptureOutputFilteredSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("filtered"),
  reason: z.enum(["duplicate", "event_not_allowed", "below_threshold"]),
  sourceId: z.string(),
  significanceScore: z.number().optional(),
});

// =============================================================================
// NEURAL OBSERVATION CAPTURE - OUTPUT (FAILURE)
// =============================================================================

const neuralObservationCaptureOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.observation.capture"),
  status: z.literal("failure"),
  sourceId: z.string(),
  error: z.string(),
  step: z.string().optional(), // Which step failed
});

// =============================================================================
// NEURAL PROFILE UPDATE - INPUT
// =============================================================================

const neuralProfileUpdateInputSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  actorId: z.string(),
  observationId: z.string(),
});

// =============================================================================
// NEURAL PROFILE UPDATE - OUTPUT (SUCCESS)
// =============================================================================

const neuralProfileUpdateOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  status: z.literal("success"),
  actorId: z.string(),
  observationCount: z.number().int().nonnegative(),
  isNewProfile: z.boolean(),
});

// =============================================================================
// NEURAL PROFILE UPDATE - OUTPUT (FAILURE)
// =============================================================================

const neuralProfileUpdateOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.profile.update"),
  status: z.literal("failure"),
  actorId: z.string(),
  error: z.string(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - INPUT
// =============================================================================

const neuralClusterSummaryInputSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  clusterId: z.string(),
  observationCount: z.number().int().nonnegative(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (SUCCESS)
// =============================================================================

const neuralClusterSummaryOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("success"),
  clusterId: z.string(),
  summaryGenerated: z.boolean(),
  keyTopics: z.array(z.string()).optional(),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (SKIPPED)
// =============================================================================

const neuralClusterSummaryOutputSkippedSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("skipped"),
  clusterId: z.string(),
  reason: z.enum(["below_threshold", "summary_recent", "cluster_not_found", "no_observations"]),
});

// =============================================================================
// NEURAL CLUSTER SUMMARY - OUTPUT (FAILURE)
// =============================================================================

const neuralClusterSummaryOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.cluster.summary"),
  status: z.literal("failure"),
  clusterId: z.string(),
  error: z.string(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - INPUT
// =============================================================================

const neuralLLMEntityExtractionInputSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  observationId: z.string(),
  contentLength: z.number().int().nonnegative(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (SUCCESS)
// =============================================================================

const neuralLLMEntityExtractionOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("success"),
  observationId: z.string(),
  entitiesExtracted: z.number().int().nonnegative(),
  entitiesStored: z.number().int().nonnegative(),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (SKIPPED)
// =============================================================================

const neuralLLMEntityExtractionOutputSkippedSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("skipped"),
  observationId: z.string().optional(),
  reason: z.enum(["observation_not_found", "content_too_short"]),
});

// =============================================================================
// NEURAL LLM ENTITY EXTRACTION - OUTPUT (FAILURE)
// =============================================================================

const neuralLLMEntityExtractionOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("neural.llm-entity-extraction"),
  status: z.literal("failure"),
  observationId: z.string(),
  error: z.string(),
});
```

#### 2. Update Discriminated Unions
**File**: `packages/console-validation/src/schemas/workflow-io.ts`
**Changes**: Add neural schemas to unions

```typescript
// Update workflowInputSchema (around line 50)
export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  syncOrchestratorInputSchema,
  // Neural workflows
  neuralObservationCaptureInputSchema,
  neuralProfileUpdateInputSchema,
  neuralClusterSummaryInputSchema,
  neuralLLMEntityExtractionInputSchema,
]);

// Update workflowOutputSchema (around line 176)
export const workflowOutputSchema = z.union([
  // Existing schemas...
  sourceConnectedGitHubOutputSuccessSchema,
  sourceConnectedGitHubOutputFailureSchema,
  sourceSyncGitHubOutputSuccessSchema,
  sourceSyncGitHubOutputFailureSchema,
  syncOrchestratorOutputSuccessSchema,
  syncOrchestratorOutputFailureSchema,
  // Neural workflows
  neuralObservationCaptureOutputSuccessSchema,
  neuralObservationCaptureOutputFilteredSchema,
  neuralObservationCaptureOutputFailureSchema,
  neuralProfileUpdateOutputSuccessSchema,
  neuralProfileUpdateOutputFailureSchema,
  neuralClusterSummaryOutputSuccessSchema,
  neuralClusterSummaryOutputSkippedSchema,
  neuralClusterSummaryOutputFailureSchema,
  neuralLLMEntityExtractionOutputSuccessSchema,
  neuralLLMEntityExtractionOutputSkippedSchema,
  neuralLLMEntityExtractionOutputFailureSchema,
]);
```

#### 3. Export Types
**File**: `packages/console-validation/src/schemas/workflow-io.ts`
**Changes**: Add type exports

```typescript
// Neural workflow type exports
export type NeuralObservationCaptureInput = z.infer<typeof neuralObservationCaptureInputSchema>;
export type NeuralObservationCaptureOutputSuccess = z.infer<typeof neuralObservationCaptureOutputSuccessSchema>;
export type NeuralObservationCaptureOutputFiltered = z.infer<typeof neuralObservationCaptureOutputFilteredSchema>;
export type NeuralObservationCaptureOutputFailure = z.infer<typeof neuralObservationCaptureOutputFailureSchema>;

export type NeuralProfileUpdateInput = z.infer<typeof neuralProfileUpdateInputSchema>;
export type NeuralProfileUpdateOutputSuccess = z.infer<typeof neuralProfileUpdateOutputSuccessSchema>;
export type NeuralProfileUpdateOutputFailure = z.infer<typeof neuralProfileUpdateOutputFailureSchema>;

export type NeuralClusterSummaryInput = z.infer<typeof neuralClusterSummaryInputSchema>;
export type NeuralClusterSummaryOutputSuccess = z.infer<typeof neuralClusterSummaryOutputSuccessSchema>;
export type NeuralClusterSummaryOutputSkipped = z.infer<typeof neuralClusterSummaryOutputSkippedSchema>;
export type NeuralClusterSummaryOutputFailure = z.infer<typeof neuralClusterSummaryOutputFailureSchema>;

export type NeuralLLMEntityExtractionInput = z.infer<typeof neuralLLMEntityExtractionInputSchema>;
export type NeuralLLMEntityExtractionOutputSuccess = z.infer<typeof neuralLLMEntityExtractionOutputSuccessSchema>;
export type NeuralLLMEntityExtractionOutputSkipped = z.infer<typeof neuralLLMEntityExtractionOutputSkippedSchema>;
export type NeuralLLMEntityExtractionOutputFailure = z.infer<typeof neuralLLMEntityExtractionOutputFailureSchema>;
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @repo/console-validation typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-validation build`

#### Manual Verification:
- [ ] New types are exported and accessible from `@repo/console-validation`

---

## Phase 2: Add Job Tracking to Observation Capture

### Overview
Update the main observation-capture workflow to create and manage job records.

### Changes Required:

#### 1. Update Observation Capture Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Add job lifecycle management

```typescript
// Add imports
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import type {
  NeuralObservationCaptureInput,
  NeuralObservationCaptureOutputSuccess,
  NeuralObservationCaptureOutputFiltered,
  NeuralObservationCaptureOutputFailure,
} from "@repo/console-validation";
```

```typescript
// After clerkOrgId resolution (around line 365), add job creation:
const jobId = await step.run("create-job", async () => {
  return createJob({
    clerkOrgId,
    workspaceId,
    inngestRunId: event.id, // Inngest event ID
    inngestFunctionId: "neural.observation.capture",
    name: `Capture ${sourceEvent.source}/${sourceEvent.sourceType}`,
    trigger: "webhook",
    input: {
      inngestFunctionId: "neural.observation.capture",
      sourceId: sourceEvent.sourceId,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      title: sourceEvent.title,
    } satisfies NeuralObservationCaptureInput,
  });
});

// Update status to running
await step.run("update-job-running", async () => {
  await updateJobStatus(jobId, "running");
});
```

```typescript
// Update duplicate return (around line 410)
if (existing) {
  await step.run("complete-job-duplicate", async () => {
    await completeJob({
      jobId,
      status: "completed", // Not failed - expected behavior
      output: {
        inngestFunctionId: "neural.observation.capture",
        status: "filtered",
        reason: "duplicate",
        sourceId: sourceEvent.sourceId,
      } satisfies NeuralObservationCaptureOutputFiltered,
    });
  });

  // Keep existing metric recording...
  return { status: "duplicate", ... };
}
```

```typescript
// Update filtered return (around line 480)
if (!eventAllowed) {
  await step.run("complete-job-filtered", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "neural.observation.capture",
        status: "filtered",
        reason: "event_not_allowed",
        sourceId: sourceEvent.sourceId,
      } satisfies NeuralObservationCaptureOutputFiltered,
    });
  });

  return { status: "filtered", ... };
}
```

```typescript
// Update below threshold return (around line 517)
if (significance.score < SIGNIFICANCE_THRESHOLD) {
  await step.run("complete-job-below-threshold", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "neural.observation.capture",
        status: "filtered",
        reason: "below_threshold",
        sourceId: sourceEvent.sourceId,
        significanceScore: significance.score,
      } satisfies NeuralObservationCaptureOutputFiltered,
    });
  });

  return { status: "below_threshold", ... };
}
```

```typescript
// Update success return (around line 993)
await step.run("complete-job-success", async () => {
  await completeJob({
    jobId,
    status: "completed",
    output: {
      inngestFunctionId: "neural.observation.capture",
      status: "success",
      observationId: observation.externalId,
      observationType: observation.observationType,
      significanceScore: significance.score,
      entitiesExtracted: entitiesStored,
      clusterId: String(clusterResult.clusterId),
      clusterIsNew: clusterResult.isNew,
    } satisfies NeuralObservationCaptureOutputSuccess,
  });
});

return { status: "captured", ... };
```

```typescript
// Add error handling wrapper around entire workflow
// Wrap the main workflow logic in try-catch to handle failures
try {
  // ... existing workflow logic ...
} catch (error) {
  await step.run("complete-job-error", async () => {
    await completeJob({
      jobId,
      status: "failed",
      output: {
        inngestFunctionId: "neural.observation.capture",
        status: "failure",
        sourceId: sourceEvent.sourceId,
        error: error instanceof Error ? error.message : String(error),
      } satisfies NeuralObservationCaptureOutputFailure,
    });
  });
  throw error; // Re-throw for Inngest retry handling
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Trigger a GitHub webhook
- [ ] Verify job record created in `lightfast_workspace_workflow_runs`
- [ ] Query: `SELECT * FROM lightfast_workspace_workflow_runs WHERE inngest_function_id = 'neural.observation.capture' ORDER BY created_at DESC LIMIT 5;`
- [ ] Verify status transitions: queued → running → completed
- [ ] Verify input/output JSON stored correctly

---

## Phase 3: Add Job Tracking to Child Workflows

### Overview
Add job tracking to profile-update, cluster-summary, and llm-entity-extraction workflows.

### Changes Required:

#### 1. Profile Update Workflow
**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`
**Changes**: Add job lifecycle

```typescript
// Add imports
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";

// After clerkOrgId resolution, create job
const jobId = await step.run("create-job", async () => {
  return createJob({
    clerkOrgId,
    workspaceId,
    inngestRunId: event.id,
    inngestFunctionId: "neural.profile.update",
    name: `Update profile: ${actorId}`,
    trigger: "webhook",
    input: {
      inngestFunctionId: "neural.profile.update",
      actorId,
      observationId,
    },
  });
});

await step.run("update-job-running", async () => {
  await updateJobStatus(jobId, "running");
});

// Complete job on success (before final return)
await step.run("complete-job-success", async () => {
  await completeJob({
    jobId,
    status: "completed",
    output: {
      inngestFunctionId: "neural.profile.update",
      status: "success",
      actorId,
      observationCount: profile.observationCount,
      isNewProfile: !existingProfile,
    },
  });
});
```

#### 2. Cluster Summary Workflow
**File**: `api/console/src/inngest/workflow/neural/cluster-summary.ts`
**Changes**: Add job lifecycle

```typescript
// Add imports
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";

// After clerkOrgId resolution, create job
const jobId = await step.run("create-job", async () => {
  return createJob({
    clerkOrgId,
    workspaceId,
    inngestRunId: event.id,
    inngestFunctionId: "neural.cluster.summary",
    name: `Cluster summary: ${clusterId}`,
    trigger: "webhook",
    input: {
      inngestFunctionId: "neural.cluster.summary",
      clusterId,
      observationCount,
    },
  });
});

await step.run("update-job-running", async () => {
  await updateJobStatus(jobId, "running");
});

// Complete job on skip
if (!cluster) {
  await step.run("complete-job-skipped", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "neural.cluster.summary",
        status: "skipped",
        clusterId,
        reason: "below_threshold", // or appropriate reason
      },
    });
  });
  return { status: "skipped", ... };
}

// Complete job on success
await step.run("complete-job-success", async () => {
  await completeJob({
    jobId,
    status: "completed",
    output: {
      inngestFunctionId: "neural.cluster.summary",
      status: "success",
      clusterId,
      summaryGenerated: true,
      keyTopics: summary.keyTopics,
    },
  });
});
```

#### 3. LLM Entity Extraction Workflow
**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts`
**Changes**: Add job lifecycle and clerkOrgId resolution

```typescript
// Add imports
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { orgWorkspaces } from "@db/console/schema";

// Add clerkOrgId resolution (currently missing)
const clerkOrgId = event.data.clerkOrgId ?? await (async () => {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });
  return workspace?.clerkOrgId ?? "";
})();

// Create job
const jobId = await step.run("create-job", async () => {
  return createJob({
    clerkOrgId,
    workspaceId,
    inngestRunId: event.id,
    inngestFunctionId: "neural.llm-entity-extraction",
    name: `LLM entities: ${observationId}`,
    trigger: "webhook",
    input: {
      inngestFunctionId: "neural.llm-entity-extraction",
      observationId,
      contentLength: 0, // Will be updated after fetch
    },
  });
});

await step.run("update-job-running", async () => {
  await updateJobStatus(jobId, "running");
});

// Complete on skip (observation not found)
if (!observation) {
  await step.run("complete-job-skipped", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "neural.llm-entity-extraction",
        status: "skipped",
        reason: "observation_not_found",
      },
    });
  });
  return { status: "skipped", ... };
}

// Complete on skip (content too short)
if (contentLength < config.minContentLength) {
  await step.run("complete-job-skipped-short", async () => {
    await completeJob({
      jobId,
      status: "completed",
      output: {
        inngestFunctionId: "neural.llm-entity-extraction",
        status: "skipped",
        observationId,
        reason: "content_too_short",
      },
    });
  });
  return { status: "skipped", ... };
}

// Complete on success
await step.run("complete-job-success", async () => {
  await completeJob({
    jobId,
    status: "completed",
    output: {
      inngestFunctionId: "neural.llm-entity-extraction",
      status: "success",
      observationId,
      entitiesExtracted: entities.length,
      entitiesStored: storedCount,
    },
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Trigger cascading events (observation → profile → cluster → entity extraction)
- [ ] Verify all 4 workflow types have job records
- [ ] Query: `SELECT inngest_function_id, status, COUNT(*) FROM lightfast_workspace_workflow_runs WHERE inngest_function_id LIKE 'neural.%' GROUP BY inngest_function_id, status;`

---

## Phase 4: Add Analytics Metrics

### Overview
Add new metric types for operational analytics (actor resolution rates, cluster affinity scores).

### Changes Required:

#### 1. Add New Metric Types
**File**: `packages/console-validation/src/schemas/metrics.ts`
**Changes**: Add analytics metric types

```typescript
// Add to operationMetricTypeSchema enum
export const operationMetricTypeSchema = z.enum([
  // ... existing types ...
  // Analytics metrics
  "actor_resolution",    // Actor resolution attempts
  "cluster_affinity",    // Cluster affinity scores
]);

// Add tag schemas
export const actorResolutionTagsSchema = z.object({
  resolved: z.boolean(),
  source: z.string(),
  method: z.enum(["email", "username", "github_id", "none"]).optional(),
});

export const clusterAffinityTagsSchema = z.object({
  affinityScore: z.number(),
  joined: z.boolean(),
  clusterId: z.string().optional(),
});

// Add metric schemas
export const actorResolutionMetricSchema = z.object({
  type: z.literal("actor_resolution"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: actorResolutionTagsSchema,
});

export const clusterAffinityMetricSchema = z.object({
  type: z.literal("cluster_affinity"),
  value: z.literal(1),
  unit: z.literal("count"),
  tags: clusterAffinityTagsSchema,
});
```

#### 2. Update recordJobMetric
**File**: `api/console/src/lib/jobs.ts`
**Changes**: Add new metric types to union

```typescript
// Add to discriminated union
| {
    type: "actor_resolution";
    value: 1;
    unit: "count";
    tags: ActorResolutionTags;
  }
| {
    type: "cluster_affinity";
    value: 1;
    unit: "count";
    tags: ClusterAffinityTags;
  }
```

#### 3. Record Analytics in Observation Capture
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Add analytics metric recording

```typescript
// After resolve-actor step
void recordJobMetric({
  clerkOrgId,
  workspaceId,
  type: "actor_resolution",
  value: 1,
  unit: "count",
  tags: {
    resolved: !!resolvedActor.actorId,
    source: sourceEvent.source,
    method: resolvedActor.method ?? "none",
  },
});

// After assign-cluster step
void recordJobMetric({
  clerkOrgId,
  workspaceId,
  type: "cluster_affinity",
  value: 1,
  unit: "count",
  tags: {
    affinityScore: clusterResult.affinityScore ?? 0,
    joined: !clusterResult.isNew,
    clusterId: String(clusterResult.clusterId),
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Verify analytics metrics recorded
- [ ] Query actor resolution success rate:
  ```sql
  SELECT
    tags->>'source' as source,
    SUM(CASE WHEN tags->>'resolved' = 'true' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
  FROM lightfast_workspace_operations_metrics
  WHERE type = 'actor_resolution'
  GROUP BY tags->>'source';
  ```

---

## Testing Strategy

### Unit Tests:
- Test workflow I/O schema validation
- Test job status transitions

### Integration Tests:
- Trigger observation capture via mock webhook
- Verify job record lifecycle
- Verify cascading child workflow jobs

### Manual Testing Steps:
1. Send GitHub webhook payload
2. Verify job created with status "queued"
3. Verify status updates to "running"
4. Verify completion with structured output
5. Force an error and verify failure recording
6. Query job history table for all neural workflows

## Performance Considerations

- Job creation adds 1 DB write per workflow start
- Status update adds 1 DB write per state change
- Completion adds 1 DB write + potential metric writes
- Total: ~3-4 DB writes per workflow execution
- Acceptable given workflows already do 5-10+ DB operations

## Migration Notes

No database migrations required. The `workspaceWorkflowRuns` table already exists and supports new `inngestFunctionId` values without schema changes.

## References

- Research: `thoughts/shared/research/2025-12-16-neural-observation-workflow-tracking-analysis.md`
- Sync orchestrator: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`
- Job utilities: `api/console/src/lib/jobs.ts`
- Workflow I/O schemas: `packages/console-validation/src/schemas/workflow-io.ts`
