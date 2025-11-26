# Workflow Type Safety Implementation Plan

## Overview
Make the entire workflow system type-safe end-to-end:
1. Inngest event schemas (discriminated unions)
2. Job input/output schemas (discriminated unions by status)
3. Database types
4. Workflow functions

---

## 1. Create Shared Metadata Schemas

**File:** `packages/console-validation/src/schemas/source-metadata.ts` (NEW)

```typescript
import { z } from "zod";

// GitHub source metadata
export const githubSourceMetadataSchema = z.object({
  repoId: z.string(),
  repoFullName: z.string(),
  defaultBranch: z.string(),
  installationId: z.string(),
  isPrivate: z.boolean(),
});

// Linear source metadata (future)
export const linearSourceMetadataSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
});

export type GitHubSourceMetadata = z.infer<typeof githubSourceMetadataSchema>;
export type LinearSourceMetadata = z.infer<typeof linearSourceMetadataSchema>;
```

**File:** `packages/console-validation/src/index.ts`

Line ~50: Add export
```typescript
export * from "./schemas/source-metadata";
```

---

## 2. Update Inngest Event Schemas

**File:** `api/console/src/inngest/client/client.ts`

Line 4: Add import
```typescript
import { syncTriggerSchema, githubSourceMetadataSchema } from "@repo/console-validation";
```

Lines 29-44: Replace source.connected event with discriminated union
```typescript
/**
 * GitHub source connected
 */
"apps-console/source.connected.github": {
  data: z.object({
    workspaceId: z.string(),
    workspaceKey: z.string(),
    sourceId: z.string(),
    sourceType: z.literal("github"),
    sourceMetadata: githubSourceMetadataSchema,
    trigger: z.enum(["user", "api", "automation"]),
  }),
},

/**
 * Linear source connected (future)
 */
"apps-console/source.connected.linear": {
  data: z.object({
    workspaceId: z.string(),
    workspaceKey: z.string(),
    sourceId: z.string(),
    sourceType: z.literal("linear"),
    sourceMetadata: linearSourceMetadataSchema,
    trigger: z.enum(["user", "api", "automation"]),
  }),
},
```

Lines 69-88: Replace source.sync event with discriminated union
```typescript
/**
 * GitHub source sync
 */
"apps-console/source.sync.github": {
  data: z.object({
    workspaceId: z.string(),
    workspaceKey: z.string(),
    sourceId: z.string(),
    storeId: z.string(),
    sourceType: z.literal("github"),
    syncMode: z.enum(["full", "incremental"]),
    trigger: syncTriggerSchema,
    syncParams: z.record(z.unknown()),
  }),
},

/**
 * Linear source sync (future)
 */
"apps-console/source.sync.linear": {
  data: z.object({
    workspaceId: z.string(),
    workspaceKey: z.string(),
    sourceId: z.string(),
    storeId: z.string(),
    sourceType: z.literal("linear"),
    syncMode: z.enum(["full", "incremental"]),
    trigger: syncTriggerSchema,
    syncParams: z.record(z.unknown()),
  }),
},
```

---

## 3. Create Workflow I/O Schemas

**File:** `packages/console-validation/src/schemas/workflow-io.ts` (NEW)

```typescript
import { z } from "zod";
import { githubSourceMetadataSchema, linearSourceMetadataSchema } from "./source-metadata";

// =============================================================================
// SOURCE CONNECTED - INPUT
// =============================================================================

const sourceConnectedGitHubInputSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  sourceMetadata: githubSourceMetadataSchema,
});

const sourceConnectedLinearInputSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  sourceMetadata: linearSourceMetadataSchema,
});

// =============================================================================
// SOURCE SYNC - INPUT
// =============================================================================

const sourceSyncGitHubInputSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  sourceMetadata: githubSourceMetadataSchema,
  syncMode: z.enum(["full", "incremental"]),
  trigger: z.string(),
  syncParams: z.record(z.unknown()),
});

const sourceSyncLinearInputSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  sourceMetadata: linearSourceMetadataSchema,
  syncMode: z.enum(["full", "incremental"]),
  trigger: z.string(),
  syncParams: z.record(z.unknown()),
});

// =============================================================================
// DISCRIMINATED UNION - ALL INPUTS
// =============================================================================

export const workflowInputSchema = z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  // Future:
  // sourceConnectedLinearInputSchema,
  // sourceSyncLinearInputSchema,
]);

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type SourceConnectedGitHubInput = z.infer<typeof sourceConnectedGitHubInputSchema>;
export type SourceSyncGitHubInput = z.infer<typeof sourceSyncGitHubInputSchema>;

// =============================================================================
// SOURCE CONNECTED - OUTPUT (SUCCESS)
// =============================================================================

const sourceConnectedGitHubOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncTriggered: z.boolean(),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  storeSlug: z.string(),
});

const sourceConnectedLinearOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncTriggered: z.boolean(),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
});

// =============================================================================
// SOURCE CONNECTED - OUTPUT (FAILURE)
// =============================================================================

const sourceConnectedGitHubOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncTriggered: z.boolean(),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  storeSlug: z.string(),
  error: z.string(),
});

const sourceConnectedLinearOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-connected"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncTriggered: z.boolean(),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  error: z.string(),
});

// =============================================================================
// SOURCE SYNC - OUTPUT (SUCCESS)
// =============================================================================

const sourceSyncGitHubOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncMode: z.enum(["full", "incremental"]),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
});

const sourceSyncLinearOutputSuccessSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("success"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncMode: z.enum(["full", "incremental"]),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
});

// =============================================================================
// SOURCE SYNC - OUTPUT (FAILURE)
// =============================================================================

const sourceSyncGitHubOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("github"),
  repoFullName: z.string(),
  syncMode: z.enum(["full", "incremental"]),
  filesProcessed: z.number().int().nonnegative(),
  filesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  error: z.string(),
});

const sourceSyncLinearOutputFailureSchema = z.object({
  inngestFunctionId: z.literal("source-sync"),
  status: z.literal("failure"),
  sourceId: z.string(),
  sourceType: z.literal("linear"),
  syncMode: z.enum(["full", "incremental"]),
  issuesProcessed: z.number().int().nonnegative(),
  issuesFailed: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  error: z.string(),
});

// =============================================================================
// DISCRIMINATED UNION - ALL OUTPUTS
// =============================================================================

export const workflowOutputSchema = z.discriminatedUnion("status", [
  sourceConnectedGitHubOutputSuccessSchema,
  sourceConnectedGitHubOutputFailureSchema,
  sourceSyncGitHubOutputSuccessSchema,
  sourceSyncGitHubOutputFailureSchema,
  // Future:
  // sourceConnectedLinearOutputSuccessSchema,
  // sourceConnectedLinearOutputFailureSchema,
  // sourceSyncLinearOutputSuccessSchema,
  // sourceSyncLinearOutputFailureSchema,
]);

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
export type SourceConnectedGitHubOutputSuccess = z.infer<typeof sourceConnectedGitHubOutputSuccessSchema>;
export type SourceConnectedGitHubOutputFailure = z.infer<typeof sourceConnectedGitHubOutputFailureSchema>;
export type SourceSyncGitHubOutputSuccess = z.infer<typeof sourceSyncGitHubOutputSuccessSchema>;
export type SourceSyncGitHubOutputFailure = z.infer<typeof sourceSyncGitHubOutputFailureSchema>;
```

**File:** `packages/console-validation/src/index.ts`

Line ~51: Add export
```typescript
export * from "./schemas/workflow-io";
```

---

## 4. Update Database Schema

**File:** `db/console/src/schema/tables/workspace-workflow-runs.ts`

Line 1-5: Add import
```typescript
import type { WorkflowInput, WorkflowOutput } from "@repo/console-validation";
```

Line 107: Replace type annotation
```typescript
input: jsonb("input").$type<WorkflowInput>(),
```

Line 119: Replace type annotation
```typescript
output: jsonb("output").$type<WorkflowOutput>(),
```

Lines 188-219: Delete old interfaces, replace with re-exports
```typescript
// Type re-exports from validation schemas
export type {
  WorkflowInput,
  WorkflowOutput,
  SourceConnectedGitHubInput,
  SourceConnectedGitHubOutputSuccess,
  SourceConnectedGitHubOutputFailure,
  SourceSyncGitHubInput,
  SourceSyncGitHubOutputSuccess,
  SourceSyncGitHubOutputFailure,
  GitHubSourceMetadata,
} from "@repo/console-validation";

// Legacy aliases
export type JobInput = WorkflowInput;
export type JobOutput = WorkflowOutput;
```

---

## 5. Update Job Creation Function

**File:** `api/console/src/lib/jobs.ts`

Line 10: Update import
```typescript
import type { WorkspaceWorkflowRun, WorkflowInput, WorkflowOutput, InsertWorkspaceWorkflowRun } from "@db/console/schema";
import { workflowInputSchema, workflowOutputSchema } from "@repo/console-validation";
```

Line 34: Update parameter type
```typescript
input?: WorkflowInput;
```

Lines 36-48: Add validation
```typescript
): Promise<string> {
  try {
    // Validate input
    if (params.input) {
      const validated = workflowInputSchema.safeParse(params.input);
      if (!validated.success) {
        log.error("Invalid workflow input", {
          error: validated.error.format(),
          input: params.input,
        });
        throw new Error(`Invalid workflow input: ${validated.error.message}`);
      }
    }

    // Check for existing job with same inngestRunId (idempotency)
```

Line 129: Update parameter type
```typescript
output?: WorkflowOutput;
```

Lines 131-141: Add validation
```typescript
): Promise<void> {
  try {
    // Validate output
    if (params.output) {
      const validated = workflowOutputSchema.safeParse(params.output);
      if (!validated.success) {
        log.error("Invalid workflow output", {
          error: validated.error.format(),
          output: params.output,
        });
        throw new Error(`Invalid workflow output: ${validated.error.message}`);
      }
    }

    // Fetch job to calculate duration
```

---

## 6. Update Source Connected Workflow

**File:** `api/console/src/inngest/workflow/orchestration/source-connected.ts`

Line 10: Add import
```typescript
import type { SourceConnectedGitHubInput, SourceConnectedGitHubOutputSuccess, SourceConnectedGitHubOutputFailure } from "@db/console/schema";
```

Line 51: Update event subscription
```typescript
{ event: "apps-console/source.connected.github" },
```

Lines 112-132: Replace with typed input (NO type assertions)
```typescript
// Step 2: Create job record
const jobId = await step.run("job.create", async () => {
  const jobName = `GitHub Sync: ${sourceMetadata.repoFullName}`;

  const input: SourceConnectedGitHubInput = {
    inngestFunctionId: "source-connected",
    sourceId,
    sourceType: "github",
    sourceMetadata,
  };

  return await createJob({
    clerkOrgId: metadata.clerkOrgId,
    workspaceId,
    storeId: metadata.storeId,
    repositoryId: null,
    inngestRunId: runId,
    inngestFunctionId: "source-connected",
    name: jobName,
    trigger: "automatic",
    input,
  });
});
```

Lines 172-200: Replace with typed outputs (NO type assertions, NO optionals)
```typescript
// Step 6: Complete job with actual results
await step.run("job.complete", async () => {
  if (syncCompletion === null) {
    const output: SourceConnectedGitHubOutputFailure = {
      inngestFunctionId: "source-connected",
      status: "failure",
      sourceId,
      sourceType: "github",
      repoFullName: sourceMetadata.repoFullName,
      syncTriggered: true,
      filesProcessed: 0,
      filesFailed: 0,
      storeSlug: "default",
      error: "Sync timed out after 45 minutes",
    };

    await completeJob({
      jobId,
      status: "failed",
      output,
    });
  } else {
    const output: SourceConnectedGitHubOutputSuccess = {
      inngestFunctionId: "source-connected",
      status: "success",
      sourceId,
      sourceType: "github",
      repoFullName: sourceMetadata.repoFullName,
      syncTriggered: true,
      filesProcessed: syncCompletion.filesProcessed,
      filesFailed: syncCompletion.filesFailed,
      storeSlug: syncCompletion.storeSlug,
    };

    await completeJob({
      jobId,
      status: "completed",
      output,
    });
  }
});
```

Line 152: Update event emission
```typescript
await step.sendEvent("sync.trigger-provider", {
  name: "apps-console/source.sync.github",
  data: {
    workspaceId,
    workspaceKey,
    sourceId,
    storeId: metadata.storeId,
    sourceType: "github",
    syncMode: "full",
    trigger: "config-change",
    syncParams: {},
  },
});
```

---

## 7. Update Source Sync Workflow

**File:** `api/console/src/inngest/workflow/orchestration/source-sync.ts`

Line 10: Add import
```typescript
import type { SourceSyncGitHubInput, SourceSyncGitHubOutputSuccess, SourceSyncGitHubOutputFailure, GitHubSourceMetadata } from "@db/console/schema";
```

Line 56: Update event subscription
```typescript
{ event: "apps-console/source.sync.github" },
```

Lines 114-139: Replace with typed input
```typescript
// Step 2: Create job record
const jobId = await step.run("job.create", async () => {
  const jobName = `GitHub Sync (${syncMode}): ${sourceData.source.sourceConfig.repoFullName}`;

  const sourceMetadata: GitHubSourceMetadata = {
    repoId: sourceData.source.providerResourceId,
    repoFullName: sourceData.source.sourceConfig.repoFullName,
    defaultBranch: sourceData.source.sourceConfig.defaultBranch,
    installationId: sourceData.source.sourceConfig.installationId,
    isPrivate: sourceData.source.sourceConfig.isPrivate,
  };

  const input: SourceSyncGitHubInput = {
    inngestFunctionId: "source-sync",
    sourceId,
    sourceType: "github",
    sourceMetadata,
    syncMode,
    trigger,
    syncParams: syncParams || {},
  };

  return await createJob({
    clerkOrgId: sourceData.workspace.clerkOrgId,
    workspaceId,
    storeId,
    repositoryId: null,
    inngestRunId: runId,
    inngestFunctionId: "source-sync",
    name: jobName,
    trigger: trigger === "manual" ? "manual" : "automatic",
    input,
  });
});
```

Lines 202-266: Replace with typed outputs (discriminated by status)
```typescript
// Step 6: Handle completion or timeout
const finalStatus = await step.run("sync.finalize", async () => {
  if (syncResult === null) {
    log.error("Provider sync timed out", {
      sourceId,
      sourceType,
      syncMode,
      jobId,
    });

    const output: SourceSyncGitHubOutputFailure = {
      inngestFunctionId: "source-sync",
      status: "failure",
      sourceId,
      sourceType: "github",
      repoFullName: sourceData.source.sourceConfig.repoFullName,
      syncMode,
      filesProcessed: 0,
      filesFailed: 0,
      timedOut: true,
      error: "Sync timed out after 40 minutes",
    };

    await completeJob({
      jobId,
      status: "failed",
      output,
    });

    return {
      success: false,
      timedOut: true,
      filesProcessed: 0,
      filesFailed: 0,
    };
  }

  log.info("Provider sync completed", {
    sourceId,
    sourceType,
    filesProcessed: syncResult.filesProcessed,
    filesFailed: syncResult.filesFailed,
  });

  return {
    success: true,
    timedOut: false,
    filesProcessed: syncResult.filesProcessed,
    filesFailed: syncResult.filesFailed,
  };
});

// Step 7: Complete the source-sync job
await step.run("job.complete-source-sync", async () => {
  if (finalStatus.timedOut) {
    // Already completed with failure output above
    return;
  }

  const output: SourceSyncGitHubOutputSuccess = {
    inngestFunctionId: "source-sync",
    status: "success",
    sourceId,
    sourceType: "github",
    repoFullName: sourceData.source.sourceConfig.repoFullName,
    syncMode,
    filesProcessed: finalStatus.filesProcessed,
    filesFailed: finalStatus.filesFailed,
    timedOut: false,
  };

  await completeJob({
    jobId,
    status: "completed",
    output,
  });
});
```

---

## 8. Update Event Emissions

**File:** `api/console/src/router/user/workspace.ts` (or wherever source.connected is emitted)

Find all `inngest.send({ name: "apps-console/source.connected" })` calls and update to:
```typescript
await inngest.send({
  name: "apps-console/source.connected.github",
  data: {
    workspaceId,
    workspaceKey,
    sourceId,
    sourceType: "github",
    sourceMetadata: {
      repoId: installation.repoId,
      repoFullName: installation.repoFullName,
      defaultBranch: installation.defaultBranch,
      installationId: installation.installationId,
      isPrivate: installation.isPrivate,
    },
    trigger: "user",
  },
});
```

**File:** `api/console/src/router/org/jobs.ts`

Lines 444-456: Update event emission in restart handler
```typescript
await inngest.send({
  name: "apps-console/source.sync.github",
  data: {
    workspaceId,
    workspaceKey,
    sourceId,
    storeId: store.id,
    sourceType: "github",
    syncMode: "full",
    trigger: "manual",
    syncParams: {},
  },
});
```

Lines 486-502: Update event emission in restart handler
```typescript
await inngest.send({
  name: "apps-console/source.sync.github",
  data: {
    workspaceId,
    workspaceKey,
    sourceId,
    storeId: store.id,
    sourceType: "github",
    syncMode: "full",
    trigger: "manual",
    syncParams: {},
  },
});
```

---

## 9. Update GitHub Push Handler

**File:** `api/console/src/inngest/workflow/providers/github/push-handler.ts`

Find where it emits `source.sync` and update to:
```typescript
await inngest.send({
  name: "apps-console/source.sync.github",
  data: {
    workspaceId,
    workspaceKey,
    sourceId,
    storeId,
    sourceType: "github",
    syncMode: "incremental",
    trigger: "webhook",
    syncParams: {
      changedFiles,
      afterSha,
      commitMessage,
    },
  },
});
```

---

## 10. Update tRPC M2M Router

**File:** `api/console/src/router/m2m/jobs.ts`

Line 4: Add import
```typescript
import { workflowInputSchema, workflowOutputSchema } from "@repo/console-validation";
```

Line 40: Replace input schema
```typescript
input: workflowInputSchema.nullable().optional(),
```

Line 80: Replace output schema
```typescript
output: workflowOutputSchema.nullable().optional(),
```

---

## 11. Update tRPC Org Router

**File:** `api/console/src/router/org/jobs.ts`

Line 3: Add import
```typescript
import type { WorkflowInput } from "@db/console/schema";
```

Line 383: Update type
```typescript
const jobInput = job.input;
```

Lines 404-410: Add type-safe access
```typescript
if (!jobInput?.sourceId) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Job input missing sourceId - cannot restart",
  });
}

const sourceId = jobInput.sourceId;
```

Lines 454-456: Update syncParams construction
```typescript
syncParams: jobInput.inngestFunctionId === "source-sync" && jobInput.sourceType === "github"
  ? { ...jobInput.syncParams }
  : {},
```

---

## 12. Build and Validate

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

**Files Modified:** 10+
**New Files:** 2
**Breaking Changes:** Yes (event names changed, all data must be typed)

**Type Safety:**
- Inngest events: Discriminated by event name (source.connected.github vs source.connected.linear)
- Job input: Discriminated by inngestFunctionId AND sourceType
- Job output: Discriminated by status (success vs failure) - zero optional fields
- Zero type assertions (no `as any` anywhere)
- Full end-to-end type safety from event → job → database → tRPC

**Output Schema Pattern:**
- Success outputs have NO error field
- Failure outputs have REQUIRED error field
- Discriminated by `status: "success" | "failure"`
- TypeScript enforces correct fields based on status
