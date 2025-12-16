# clerkOrgId Propagation Architecture

## Overview

This plan re-architects the neural memory workflows to ensure `clerkOrgId` is **always available** by passing it through event data from parent workflows. Currently, workflows fetch `clerkOrgId` via database lookups, which causes:

1. **Redundant database queries** - Each child workflow queries `orgWorkspaces` to get `clerkOrgId`
2. **Inconsistent metrics** - Early-exit metrics use empty string `""` for `clerkOrgId`
3. **Wasted compute** - Same data fetched multiple times across workflow chain

## Current State Analysis

### The Problem: clerkOrgId Retrieval Pattern

**Current flow (observation-capture.ts):**
```
Step 1: Check duplicate → metric with clerkOrgId: "" (workspace not fetched yet)
Step 2: Check event allowed → metric with clerkOrgId: ""
Step 3: Evaluate significance → metric with clerkOrgId: ""
Step 4: Fetch workspace context ← First time we have clerkOrgId!
Step 5+: Can use workspace.clerkOrgId
```

**Child workflows (profile-update.ts, cluster-summary.ts):**
```typescript
// Each child does its own lookup
const workspace = await db.query.orgWorkspaces.findFirst({
  where: eq(orgWorkspaces.id, workspaceId),
  columns: { clerkOrgId: true },
});
```

### Key Files Affected

| File | Current Behavior | Problem |
|------|------------------|---------|
| `observation-capture.ts:249,321,357` | Uses `clerkOrgId: ""` for early-exit metrics | Invalid metric data |
| `profile-update.ts:139-143` | DB query for clerkOrgId | Redundant lookup |
| `cluster-summary.ts:187-190` | DB query for clerkOrgId | Redundant lookup |
| `client/client.ts:588-695` | Event schemas lack clerkOrgId | Missing propagation |

### Entry Points Analysis

Neural observation events originate from webhook handlers:

| Entry Point | Location | Current Behavior |
|-------------|----------|------------------|
| GitHub webhooks | `apps/console/src/app/(github)/api/github/webhooks/route.ts` | Resolves workspace via `WorkspacesService.resolveFromGithubOrgSlug()` |
| Vercel webhooks | `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` | Similar workspace resolution |

The `WorkspacesService` returns `{ workspaceId, workspaceKey }` but **not** `clerkOrgId`. This is the first opportunity to include it.

## Desired End State

After implementation:

1. **All neural event schemas include optional `clerkOrgId`** field
2. **Webhook handlers resolve `clerkOrgId`** at entry point and include it in initial event
3. **Parent workflows pass `clerkOrgId`** to child workflow events
4. **Child workflows receive `clerkOrgId`** from event data (no DB lookup needed)
5. **Fallback exists** for events without `clerkOrgId` (backwards compatibility)
6. **All metrics have valid `clerkOrgId`** (no empty strings)

### Data Flow After Implementation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GitHub Webhook Handler:                                                │
│    1. resolveFromGithubOrgSlug(ownerLogin)                             │
│    2. NEW: Also fetch clerkOrgId from workspace                         │
│    3. Send event with { workspaceId, clerkOrgId, sourceEvent }         │
│                                                                         │
│  observation.capture:                                                   │
│    - clerkOrgId available from event.data                               │
│    - Early-exit metrics use valid clerkOrgId                           │
│    - Pass clerkOrgId to child events                                    │
│                                                                         │
│  profile.update / cluster.check-summary:                                │
│    - Receive clerkOrgId from event.data                                 │
│    - Fallback: fetch from DB if missing (backwards compat)              │
│    - No redundant queries when clerkOrgId is provided                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Verification Criteria

```sql
-- No empty clerkOrgId in new metrics
SELECT COUNT(*) FROM lightfast_workspace_operations_metrics
WHERE clerk_org_id = '' AND created_at > NOW() - INTERVAL 1 DAY;
-- Expected: 0 (after deployment)

-- Verify clerkOrgId populated in recent metrics
SELECT clerk_org_id, COUNT(*)
FROM lightfast_workspace_operations_metrics
WHERE created_at > NOW() - INTERVAL 1 DAY
GROUP BY clerk_org_id;
-- Expected: All non-empty clerkOrgId values
```

## What We're NOT Doing

1. **Not changing sync workflow events** - Only neural memory workflows affected
2. **Not making clerkOrgId required** - Optional with fallback for backwards compatibility
3. **Not creating new event versions** - Using schema extension with optional field
4. **Not modifying database schema** - Pure event/workflow changes

## Implementation Approach

The fix follows these principles:

1. **Resolve early** - Get clerkOrgId at webhook handler entry point
2. **Propagate always** - Include clerkOrgId in all neural event emissions
3. **Fallback gracefully** - Child workflows fallback to DB lookup if clerkOrgId missing
4. **Measure improvement** - Log when fallback is used to track migration progress

---

## Phase 1: Update Event Schemas with Optional clerkOrgId

### Overview

Add optional `clerkOrgId` field to all neural memory event schemas. This enables propagation while maintaining backwards compatibility with in-flight events.

### Changes Required

#### 1. Update Neural Event Schemas

**File**: `api/console/src/inngest/client/client.ts`

Add `clerkOrgId` as optional field to neural events:

```typescript
// Line ~588: apps-console/neural/observation.capture
"apps-console/neural/observation.capture": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (optional for backwards compat, resolved at webhook handler) */
    clerkOrgId: z.string().optional(),
    /** Standardized source event */
    sourceEvent: z.object({
      // ... existing fields
    }),
  }),
},

// Line ~624: apps-console/neural/observation.captured
"apps-console/neural/observation.captured": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID */
    clerkOrgId: z.string().optional(),
    /** Observation DB UUID */
    observationId: z.string(),
    // ... existing fields
  }),
},

// Line ~651: apps-console/neural/profile.update
"apps-console/neural/profile.update": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Canonical actor ID (source:id format) */
    actorId: z.string(),
    /** Observation that triggered update */
    observationId: z.string(),
    /** Source actor data for profile enrichment */
    sourceActor: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional(),
      avatarUrl: z.string().optional(),
    }).optional(),
  }),
},

// Line ~673: apps-console/neural/cluster.check-summary
"apps-console/neural/cluster.check-summary": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Cluster to check */
    clusterId: z.string(),
    /** Current observation count */
    observationCount: z.number(),
  }),
},

// Line ~688: apps-console/neural/llm-entity-extraction.requested
"apps-console/neural/llm-entity-extraction.requested": {
  data: z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Observation to extract entities from */
    observationId: z.string(),
  }),
},
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] API builds successfully: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Existing workflows still function (clerkOrgId is optional)

**Implementation Note**: This phase only updates schemas. No behavior changes yet.

---

## Phase 2: Update Webhook Handlers to Include clerkOrgId

### Overview

Modify webhook handlers to resolve `clerkOrgId` at entry point and include it in the initial event payload.

### Changes Required

#### 1. Extend WorkspacesService Return Type

**File**: `packages/console-api-services/src/workspaces.ts` (or wherever WorkspacesService is defined)

Extend the `resolveFromGithubOrgSlug` method to return `clerkOrgId`:

```typescript
// Find the method and update return type
async resolveFromGithubOrgSlug(ownerLogin: string): Promise<{
  workspaceId: string;
  workspaceKey: string;
  clerkOrgId: string;  // ADD THIS
}> {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.githubOrgSlug, ownerLogin),
    columns: {
      id: true,
      key: true,
      clerkOrgId: true,  // ADD THIS
    },
  });

  if (!workspace) {
    throw new Error(`Workspace not found for GitHub org: ${ownerLogin}`);
  }

  return {
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
  };
}
```

#### 2. Update GitHub Webhook Handler

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

Update all handlers that send neural events to include `clerkOrgId`:

```typescript
// Line ~209-218: handlePushObservation
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformGitHubPush(payload, {
      deliveryId,
      receivedAt,
    }),
  },
});

// Line ~266-275: handlePullRequestEvent
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformGitHubPullRequest(payload, {
      deliveryId,
      receivedAt,
    }),
  },
});

// Line ~323-332: handleIssuesEvent
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformGitHubIssue(payload, {
      deliveryId,
      receivedAt,
    }),
  },
});

// Line ~379-388: handleReleaseEvent
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformGitHubRelease(payload, {
      deliveryId,
      receivedAt,
    }),
  },
});

// Line ~435-444: handleDiscussionEvent
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformGitHubDiscussion(payload, {
      deliveryId,
      receivedAt,
    }),
  },
});
```

#### 3. Update Vercel Webhook Handler

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

Update to include `clerkOrgId` (similar pattern as GitHub):

```typescript
// Find the inngest.send call for neural/observation.capture
await inngest.send({
  name: "apps-console/neural/observation.capture",
  data: {
    workspaceId: workspace.workspaceId,
    clerkOrgId: workspace.clerkOrgId,  // ADD THIS
    sourceEvent: transformVercelDeployment(payload, { /* ... */ }),
  },
});
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Console app builds: `pnpm build:console`

#### Manual Verification:
- [ ] Send test webhook, verify `clerkOrgId` appears in Inngest dashboard event payload
- [ ] Verify no regressions in existing webhook handling

**Implementation Note**: After this phase, new events have `clerkOrgId`. In-flight events without it still work via fallback (Phase 3).

---

## Phase 3: Update Parent Workflow to Use clerkOrgId from Event

### Overview

Modify `observation-capture.ts` to:
1. Extract `clerkOrgId` from event data (with fallback to DB lookup)
2. Use it for early-exit metrics
3. Pass it to all child workflow events

### Changes Required

#### 1. Create Helper Function for clerkOrgId Resolution

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Add helper at top of file:

```typescript
/**
 * Resolve clerkOrgId from event data or database.
 *
 * New events include clerkOrgId from webhook handler.
 * Legacy events (or edge cases) fallback to database lookup.
 *
 * @returns clerkOrgId or empty string if workspace not found
 */
async function resolveClerkOrgId(
  eventClerkOrgId: string | undefined,
  workspaceId: string,
): Promise<string> {
  // Prefer event data (new flow)
  if (eventClerkOrgId) {
    return eventClerkOrgId;
  }

  // Fallback to database lookup (backwards compat)
  log.debug("clerkOrgId not in event, falling back to DB lookup", { workspaceId });

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });

  return workspace?.clerkOrgId ?? "";
}
```

#### 2. Extract clerkOrgId at Workflow Start

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Update workflow to extract `clerkOrgId` early:

```typescript
async ({ event, step }) => {
  const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent } = event.data;
  const startTime = Date.now();

  // Pre-generate externalId at workflow start (Phase 3 optimization)
  const externalId = nanoid();

  // Resolve clerkOrgId EARLY (before any metrics or processing)
  // This ensures all metrics have valid clerkOrgId
  const clerkOrgId = await step.run("resolve-clerk-org-id", async () => {
    return resolveClerkOrgId(eventClerkOrgId, workspaceId);
  });

  log.info("Capturing neural observation", {
    workspaceId,
    clerkOrgId,
    externalId,
    source: sourceEvent.source,
    sourceType: sourceEvent.sourceType,
    sourceId: sourceEvent.sourceId,
  });

  // ... rest of workflow
```

#### 3. Update Early-Exit Metrics to Use clerkOrgId

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Update all early-exit metrics (lines ~248, ~320, ~356):

```typescript
// Line ~248: Duplicate check metric
if (existing) {
  void recordJobMetric({
    clerkOrgId,  // Now valid! (was: "")
    workspaceId,
    type: "observation_duplicate",
    value: 1,
    unit: "count",
    tags: {
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      durationMs: Date.now() - startTime,
    },
  });
  return { /* ... */ };
}

// Line ~320: Event filtered metric
if (!eventAllowed) {
  void recordJobMetric({
    clerkOrgId,  // Now valid! (was: "")
    workspaceId,
    type: "observation_filtered",
    value: 1,
    unit: "count",
    tags: {
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      durationMs: Date.now() - startTime,
    },
  });
  return { /* ... */ };
}

// Line ~356: Below threshold metric
if (significance.score < SIGNIFICANCE_THRESHOLD) {
  void recordJobMetric({
    clerkOrgId,  // Now valid! (was: "")
    workspaceId,
    type: "observation_below_threshold",
    value: 1,
    unit: "count",
    tags: {
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      significanceScore: significance.score,
      durationMs: Date.now() - startTime,
    },
  });
  return { /* ... */ };
}
```

#### 4. Pass clerkOrgId to Child Workflow Events

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

Update all child event emissions (in `step.sendEvent` block):

```typescript
// Line ~663: Fire-and-forget events
await step.sendEvent("emit-events", [
  // Completion event
  {
    name: "apps-console/neural/observation.captured" as const,
    data: {
      workspaceId,
      clerkOrgId,  // ADD THIS
      observationId: observation.externalId,
      sourceId: sourceEvent.sourceId,
      observationType: observation.observationType,
      significanceScore: significance.score,
      topics,
      entitiesExtracted: extractedEntities.length,
      clusterId: String(clusterResult.clusterId),
      clusterIsNew: clusterResult.isNew,
    },
  },
  // Profile update
  ...(resolvedActor.actorId
    ? [
        {
          name: "apps-console/neural/profile.update" as const,
          data: {
            workspaceId,
            clerkOrgId,  // ADD THIS
            actorId: resolvedActor.actorId,
            observationId: observation.externalId,
            sourceActor: resolvedActor.sourceActor ?? undefined,
          },
        },
      ]
    : []),
  // Cluster summary check
  {
    name: "apps-console/neural/cluster.check-summary" as const,
    data: {
      workspaceId,
      clerkOrgId,  // ADD THIS
      clusterId: String(clusterResult.clusterId),
      observationCount: clusterResult.isNew ? 1 : 0,
    },
  },
  // LLM entity extraction
  ...((sourceEvent.body?.length ?? 0) > 200
    ? [
        {
          name: "apps-console/neural/llm-entity-extraction.requested" as const,
          data: {
            workspaceId,
            clerkOrgId,  // ADD THIS
            observationId: observation.externalId,
          },
        },
      ]
    : []),
]);
```

#### 5. Remove Redundant Workspace Fetch for clerkOrgId

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

The workspace is still fetched in step 4 for settings validation, but we no longer need it for `clerkOrgId`. No changes needed to the fetch step, but success metrics now use the pre-resolved `clerkOrgId`:

```typescript
// Line ~720-760: Success metrics already use workspace.clerkOrgId
// Update to use pre-resolved clerkOrgId instead:
recordJobMetric({
  clerkOrgId,  // Use pre-resolved value (was: workspace.clerkOrgId)
  workspaceId,
  type: "observation_captured",
  // ...
}),
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] API builds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Send webhook, verify early-exit metrics have valid clerkOrgId
- [ ] Verify child workflow events include clerkOrgId in Inngest dashboard
- [ ] Test backwards compat: simulate event without clerkOrgId, verify fallback works

**Implementation Note**: After this phase, parent workflow is fully updated. Proceed to Phase 4 for child workflows.

---

## Phase 4: Update Child Workflows to Use clerkOrgId from Event

### Overview

Update `profile-update.ts` and `cluster-summary.ts` to:
1. Extract `clerkOrgId` from event data
2. Fallback to DB lookup if missing (backwards compat)
3. Remove standalone DB queries when clerkOrgId provided

### Changes Required

#### 1. Update Profile Update Workflow

**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`

```typescript
export const profileUpdate = inngest.createFunction(
  { /* config */ },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, actorId, sourceActor } = event.data;

    // Resolve clerkOrgId (prefer event, fallback to DB)
    const clerkOrgId = eventClerkOrgId ?? await (async () => {
      log.debug("clerkOrgId not in event, falling back to DB lookup", { workspaceId });
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { clerkOrgId: true },
      });
      return workspace?.clerkOrgId ?? "";
    })();

    // ... existing workflow steps ...

    // Step 3: Upsert profile (unchanged)
    await step.run("upsert-profile", async () => {
      // ... existing upsert logic ...
    });

    // Record profile_updated metric (SIMPLIFIED - no longer needs DB query)
    if (clerkOrgId) {
      void recordJobMetric({
        clerkOrgId,  // Now from event or pre-resolved fallback
        workspaceId,
        type: "profile_updated",
        value: 1,
        unit: "count",
        tags: { actorId },
      });
    }

    return { actorId, observationCount: recentActivity.count };
  },
);
```

**Key Changes:**
- Extract `clerkOrgId` from event at start
- Inline fallback DB lookup (no separate step needed)
- Remove standalone DB query at end of workflow (lines 139-143)

#### 2. Update Cluster Summary Workflow

**File**: `api/console/src/inngest/workflow/neural/cluster-summary.ts`

```typescript
export const clusterSummaryCheck = inngest.createFunction(
  { /* config */ },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, clusterId, observationCount } = event.data;

    // Resolve clerkOrgId (prefer event, fallback to DB)
    const clerkOrgId = eventClerkOrgId ?? await (async () => {
      log.debug("clerkOrgId not in event, falling back to DB lookup", { workspaceId });
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { clerkOrgId: true },
      });
      return workspace?.clerkOrgId ?? "";
    })();

    // ... existing workflow steps ...

    // Step 4: Update cluster (unchanged)
    await step.run("update-cluster", async () => {
      // ... existing update logic ...
    });

    // Record cluster_summary_generated metric (SIMPLIFIED - no longer needs DB query)
    if (clerkOrgId) {
      void recordJobMetric({
        clerkOrgId,  // Now from event or pre-resolved fallback
        workspaceId,
        type: "cluster_summary_generated",
        value: 1,
        unit: "count",
        tags: {
          clusterId,
          observationCount: observations.length,
        },
      });
    }

    return {
      status: "generated",
      summary: summary.summary,
      keyTopics: summary.keyTopics,
    };
  },
);
```

**Key Changes:**
- Extract `clerkOrgId` from event at start
- Inline fallback DB lookup
- Remove standalone DB query at end of workflow (lines 187-190)

#### 3. Update LLM Entity Extraction Workflow (if exists)

**File**: `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts` (if this file exists)

Apply same pattern: extract `clerkOrgId` from event, fallback to DB lookup.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] API builds: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Trigger profile update via webhook, verify no extra DB query for clerkOrgId (check logs)
- [ ] Trigger cluster summary, verify no extra DB query for clerkOrgId
- [ ] Verify metrics recorded with valid clerkOrgId

**Implementation Note**: After this phase, child workflows use clerkOrgId from events. Fallback ensures backwards compatibility.

---

## Phase 5: Add Monitoring and Cleanup

### Overview

Add logging to track migration progress and identify any remaining fallback usage.

### Changes Required

#### 1. Add Migration Tracking Counter

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

In the `resolveClerkOrgId` helper, add metric for fallback usage:

```typescript
async function resolveClerkOrgId(
  eventClerkOrgId: string | undefined,
  workspaceId: string,
): Promise<string> {
  if (eventClerkOrgId) {
    return eventClerkOrgId;
  }

  // Track fallback usage to monitor migration progress
  log.warn("clerkOrgId fallback to DB lookup", {
    workspaceId,
    reason: "event_missing_clerkOrgId",
  });

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });

  return workspace?.clerkOrgId ?? "";
}
```

#### 2. Update observability dashboards (manual)

Create alerts for:
- `clerkOrgId fallback to DB lookup` log entries should trend toward zero
- Metrics with empty `clerkOrgId` should be zero after full deployment

### Success Criteria

#### Automated Verification:
- [x] Logs include fallback tracking
- [x] No errors in log output

#### Manual Verification:
- [ ] After deployment, monitor fallback logs - should decrease over time
- [ ] After 24h, verify fallback usage is near zero (only edge cases)

---

## Testing Strategy

### Unit Tests

1. **Event schema tests** - Verify clerkOrgId is optional and properly typed
2. **resolveClerkOrgId helper** - Test both event-provided and fallback paths
3. **Workflow tests** - Verify clerkOrgId propagation through event chain

### Integration Tests

1. **Full flow test** - Send webhook → capture → profile update → verify clerkOrgId flows through
2. **Backwards compat test** - Send event without clerkOrgId, verify fallback works
3. **Metrics test** - Verify all metrics have valid clerkOrgId

### Manual Testing Steps

1. Send GitHub push webhook
2. Check Inngest dashboard - verify event includes `clerkOrgId`
3. Check child workflow events - verify `clerkOrgId` propagated
4. Query metrics table - verify no empty `clerkOrgId` values

---

## Rollback Plan

If issues occur:

1. **Phase 1-2 rollback**: Remove `clerkOrgId` from event schemas (optional field, no breaking change)
2. **Phase 3-4 rollback**: Revert workflow changes (fallback ensures backwards compat)
3. **Emergency rollback**: Revert all changes, system continues to work with DB lookups

---

## Performance Impact

### Before (per observation + 2 child workflows)
- Parent workflow: 1 DB query for workspace context
- Profile update: 1 DB query for clerkOrgId
- Cluster summary: 1 DB query for clerkOrgId
- **Total: 3 DB queries** (workspace data queried 3 times)

### After (per observation + 2 child workflows)
- Parent workflow: 1 DB query for workspace context (or 0 if clerkOrgId from event)
- Profile update: 0 DB queries (clerkOrgId from event)
- Cluster summary: 0 DB queries (clerkOrgId from event)
- **Total: 0-1 DB queries** (workspace data queried at most once)

**Savings**: 66-100% reduction in clerkOrgId-related DB queries.

---

## Files Modified Summary

| Phase | File | Changes |
|-------|------|---------|
| 1 | `api/console/src/inngest/client/client.ts` | Add optional `clerkOrgId` to 5 neural event schemas |
| 2 | `packages/console-api-services/src/workspaces.ts` | Extend `resolveFromGithubOrgSlug` to return `clerkOrgId` |
| 2 | `apps/console/src/app/(github)/api/github/webhooks/route.ts` | Include `clerkOrgId` in 5 neural event emissions |
| 2 | `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` | Include `clerkOrgId` in neural event emission |
| 3 | `api/console/src/inngest/workflow/neural/observation-capture.ts` | Add `resolveClerkOrgId` helper, use clerkOrgId for early-exit metrics, pass to child events |
| 4 | `api/console/src/inngest/workflow/neural/profile-update.ts` | Extract clerkOrgId from event, remove standalone DB query |
| 4 | `api/console/src/inngest/workflow/neural/cluster-summary.ts` | Extract clerkOrgId from event, remove standalone DB query |

---

## References

- Existing actor bugfix plan: `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md`
- Inngest client config: `api/console/src/inngest/client/client.ts`
- Neural workflows: `api/console/src/inngest/workflow/neural/`
- Investigation: `thoughts/shared/research/2025-12-16-operation-metrics-clerkorgid-investigation.md`
