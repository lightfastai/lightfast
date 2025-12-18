---
date: 2025-12-16T11:50:18Z
researcher: claude
git_commit: 5d5918d74798e0fd4dc18b718e5ebdbb7d2ea950
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "Neural Observation Pipeline Workflow Tracking Architecture"
tags: [research, codebase, neural-memory, workflow-tracking, inngest, observation-capture, metrics]
status: complete
last_updated: 2025-12-16
last_updated_by: claude
---

# Research: Neural Observation Pipeline Workflow Tracking Architecture

**Date**: 2025-12-16T11:50:18Z
**Researcher**: claude
**Git Commit**: 5d5918d74798e0fd4dc18b718e5ebdbb7d2ea950
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

How does the neural observation capture pipeline (`observation-capture.ts`) track its execution compared to the sync orchestrator's job tracking in `workspace-workflow-runs.ts`? Document the current architecture and tracking mechanisms.

## Summary

The codebase has **two distinct tracking paradigms**:

1. **Job Tracking** (`workspace-workflow-runs`): Used exclusively by the sync orchestrator for document ingestion workflows. Creates one row per workflow execution with full lifecycle tracking (queued → running → completed/failed).

2. **Metrics Tracking** (`workspace-operations-metrics`): Used by neural observation workflows. Creates multiple time-series rows per workflow for specific decision points (duplicate, filtered, captured, etc.).

The neural observation pipeline does NOT use the job tracking table. Instead, it relies on:
- Fire-and-forget metrics via `recordJobMetric()`
- Structured logging via `log.info()` / `log.warn()`
- Event emission for downstream systems

## Detailed Findings

### 1. Job Tracking System (Sync Orchestrator Only)

**Database Table:** `lightfast_workspace_workflow_runs`
**Schema Location:** `db/console/src/schema/tables/workspace-workflow-runs.ts:18-176`

**Single Entry Point:**
Only the **Unified Sync Orchestrator** (`apps-console/sync.orchestrator`) creates job records:
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:133-151`

**Job Lifecycle Functions:**
- `createJob()` - `api/console/src/lib/jobs.ts:36-109`
- `updateJobStatus()` - `api/console/src/lib/jobs.ts:117-138`
- `completeJob()` - `api/console/src/lib/jobs.ts:148-253`

**Tracked Data:**
- `inngestRunId` - Inngest execution identifier
- `inngestFunctionId` - Function name (always "sync.orchestrator")
- `status` - Lifecycle state (queued → running → completed/failed/cancelled)
- `trigger` - What initiated the job (manual, webhook, config-change, automatic)
- `input` - Typed workflow parameters
- `output` - Result data on completion
- `startedAt`, `completedAt`, `durationMs` - Timing information

**Workflows That DO NOT Use Job Tracking:**
- Neural observation capture
- Profile update
- Cluster summary
- LLM entity extraction
- All neural pipeline workflows

### 2. Neural Observation Pipeline Tracking

**Primary Workflow:** `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Function ID:** `apps-console/neural.observation.capture`

**Tracking Mechanisms Used:**

#### A. Operations Metrics (Time-Series)

**Database Table:** `lightfast_workspace_operations_metrics`
**Schema Location:** `db/console/src/schema/tables/workspace-operations-metrics.ts:44-148`

**Metric Types for Neural Workflows:**

| Metric Type | Triggered When | Tags |
|-------------|----------------|------|
| `observation_duplicate` | Existing observation with same sourceId (line 387) | source, sourceType, durationMs |
| `observation_filtered` | Event type not in source config (line 459) | source, sourceType, durationMs |
| `observation_below_threshold` | Significance score < 40 (line 495) | source, sourceType, significanceScore, durationMs |
| `observation_captured` | Successfully stored (line 894) | source, sourceType, observationType, significanceScore, durationMs |
| `entities_extracted` | Entities stored in transaction (line 910) | observationId, entityCount, source |
| `cluster_assigned` | Observation assigned to cluster (line 924) | clusterId, isNew |
| `cluster_summary_generated` | LLM summary generated (cluster-summary.ts:200) | clusterId, observationCount |
| `profile_updated` | Actor profile upserted (profile-update.ts:179) | actorId |

**Recording Function:** `recordJobMetric()` at `api/console/src/lib/jobs.ts:263-362`
- Non-fatal error handling (errors logged but not thrown)
- Fire-and-forget pattern via `void recordJobMetric(...)`

#### B. Structured Logging

**Key Log Points in observation-capture.ts:**
- Start: line 357-364 (workspaceId, clerkOrgId, externalId, source, sourceType, sourceId)
- Duplicate skip: line 376-379
- Filter skip: line 445-451
- Below threshold skip: line 486-492
- Vector upsert: line 710-716
- Transaction complete: line 788-794

#### C. Event Emission

**Completion Event:** `apps-console/neural/observation.captured` (line 836-849)
```typescript
{
  workspaceId,
  clerkOrgId,
  observationId,  // Public nanoid
  sourceId,
  observationType,
  significanceScore,
  topics,
  entitiesExtracted,
  clusterId,
  clusterIsNew
}
```

### 3. Architectural Comparison

| Aspect | Job Tracking (Sync) | Metrics Tracking (Neural) |
|--------|---------------------|--------------------------|
| **Granularity** | One row per workflow execution | Multiple rows per workflow |
| **Data Structure** | Structured columns (status, input, output) | Generic value/unit/tags columns |
| **Lifecycle** | Create → Update → Complete | Insert-only (no updates) |
| **Query Patterns** | Find by inngestRunId for status | Aggregate by type/workspace/timestamp |
| **Use Cases** | Job status UI, debugging runs | Time-series analytics, dashboards |
| **Error Recovery** | Job record shows failure state | Metric shows error count |

### 4. Neural Pipeline Workflow Registry

**Active Workflows (4):**

| Workflow | File | Event | Tracking |
|----------|------|-------|----------|
| Observation Capture | `observation-capture.ts:319` | `neural/observation.capture` | 6 metrics + logging |
| Profile Update | `profile-update.ts:23` | `neural/profile.update` | 1 metric + logging |
| Cluster Summary | `cluster-summary.ts:40` | `neural/cluster.check-summary` | 1 metric + logging |
| LLM Entity Extraction | `llm-entity-extraction-workflow.ts:29` | `neural/llm-entity-extraction.requested` | Logging only |

**Supporting Utilities (7):**
- `actor-resolution.ts` - Actor ID resolution
- `classification.ts` - Semantic classification
- `cluster-assignment.ts` - Cluster affinity scoring
- `entity-extraction-patterns.ts` - Regex entity extraction
- `llm-entity-extraction.ts` - LLM extraction logic
- `scoring.ts` - Significance scoring
- `index.ts` - Export manifest

### 5. Event Flow Graph

```
WEBHOOK (GitHub/Vercel)
       │
       ▼ emits: apps-console/neural/observation.capture
┌─────────────────────────────────────────────────────────────┐
│  OBSERVATION CAPTURE (Synchronous Main Workflow)            │
│                                                             │
│  Metrics: observation_duplicate, observation_filtered,      │
│           observation_below_threshold, observation_captured,│
│           entities_extracted, cluster_assigned              │
│                                                             │
│  Steps: resolve_org → check_dup → filter → significance →  │
│         classify → embed → extract → cluster → store        │
└─────────────────────────────────────────────────────────────┘
       │
       │ emits (fire-and-forget):
       ├─ observation.captured
       ├─ profile.update ───────────► Profile Update Workflow
       │                              Metric: profile_updated
       ├─ cluster.check-summary ────► Cluster Summary Workflow
       │                              Metric: cluster_summary_generated
       └─ llm-entity-extraction ────► LLM Extraction Workflow
                                      (logging only)
```

### 6. What IS Tracked in Neural Pipeline

**Observation Capture:**
- Duplicate events (metric + log)
- Filtered events (metric + log)
- Below threshold events (metric + log)
- Successfully captured observations (metric + log)
- Entity extraction counts (metric)
- Cluster assignments (metric)
- Vector upserts (log)
- Transaction completion (log)

**Child Workflows:**
- Profile updates (metric + log)
- Cluster summary generation (metric + log)
- LLM entity extraction completion (log only)

### 7. What IS NOT Tracked in Neural Pipeline

**Missing Workflow-Level Tracking:**
- No job record in `workspaceWorkflowRuns` table
- No centralized duration tracking for entire workflow execution
- No step-level duration metrics
- No retry count tracking
- No failure reason categorization
- No workflow execution history for debugging

**Missing LLM Tracking:**
- No token usage metrics
- No LLM latency metrics (logged but not recorded)
- No LLM model version tracking
- No LLM cost estimation

**Missing Analytics:**
- No affinity score distribution metrics
- No cluster creation rate tracking
- No actor resolution success rate
- No entity pattern match distribution

## Code References

### Job Tracking System
- `db/console/src/schema/tables/workspace-workflow-runs.ts:18` - Table definition
- `api/console/src/lib/jobs.ts:36` - createJob function
- `api/console/src/lib/jobs.ts:148` - completeJob function
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:133` - Job creation in sync workflow

### Metrics System
- `db/console/src/schema/tables/workspace-operations-metrics.ts:44` - Table definition
- `api/console/src/lib/jobs.ts:263` - recordJobMetric function
- `packages/console-validation/src/schemas/metrics.ts:36` - Metric type definitions

### Neural Observation Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts:319` - Main workflow
- `api/console/src/inngest/workflow/neural/observation-capture.ts:387` - observation_duplicate metric
- `api/console/src/inngest/workflow/neural/observation-capture.ts:459` - observation_filtered metric
- `api/console/src/inngest/workflow/neural/observation-capture.ts:495` - observation_below_threshold metric
- `api/console/src/inngest/workflow/neural/observation-capture.ts:894` - observation_captured metric
- `api/console/src/inngest/workflow/neural/profile-update.ts:179` - profile_updated metric
- `api/console/src/inngest/workflow/neural/cluster-summary.ts:200` - cluster_summary_generated metric

### Event Definitions
- `api/console/src/inngest/client/client.ts:588` - observation.capture event
- `api/console/src/inngest/client/client.ts:626` - observation.captured event
- `api/console/src/inngest/client/client.ts:655` - profile.update event
- `api/console/src/inngest/client/client.ts:679` - cluster.check-summary event

## Architecture Documentation

### Current Tracking Architecture

The codebase implements a **dual-track approach**:

1. **Sync Operations**: Full job lifecycle tracking via `workspaceWorkflowRuns`
   - Single workflow (sync orchestrator) creates all job records
   - Comprehensive status/input/output tracking
   - Supports job restart via tRPC

2. **Neural Operations**: Event-based metrics via `workspaceOperationsMetrics`
   - Multiple metrics per workflow execution
   - Time-series optimized (BIGINT id, composite indexes)
   - Fire-and-forget recording (non-fatal)

### Key Design Decisions

1. **Idempotency**: Observation capture uses `sourceId` for idempotency (line 327)
2. **Concurrency**: 10 observations per workspace concurrently (line 330-333)
3. **Timeouts**: 1m start, 5m finish (line 335-338)
4. **Debouncing**: Profile updates (5m), cluster summaries (10m), LLM extraction (1m)

### Configuration Constants

| Constant | Value | Location |
|----------|-------|----------|
| SIGNIFICANCE_THRESHOLD | 40 | scoring.ts:16 |
| CLUSTER_AFFINITY_THRESHOLD | 60 | cluster-assignment.ts:22 |
| CLUSTER_LOOKBACK_DAYS | 7 | cluster-assignment.ts:24 |
| SUMMARY_THRESHOLD | 5 obs | cluster-summary.ts:22 |
| SUMMARY_AGE_HOURS | 24 | cluster-summary.ts:23 |
| MAX_ENTITIES_PER_OBSERVATION | 50 | observation-capture.ts:616 |

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md` - Documents 7 core workflows complete, identifies backfill gap
- `thoughts/shared/research/2025-12-15-web-analysis-postgresql-operations-metrics-design.md` - Recommends BRIN indexes and partitioning for metrics table
- `thoughts/shared/plans/2025-12-16-clerkorgid-propagation-architecture.md` - Documents clerkOrgId propagation through neural workflows

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Evaluation metrics targeting <500ms p95 capture latency
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - 10 architectural gaps including missing backfill

## Open Questions

1. **Should neural workflows use job tracking?** The metrics approach provides analytics but not debugging/history capabilities.

2. **What workflow-level duration tracking is needed?** Currently only `durationMs` tag on some metrics, no aggregated workflow timing.

3. **Should LLM operations track token usage?** Currently logged but not recorded as metrics.

4. **Is the metrics table ready for scale?** Consider BRIN indexes and partitioning per web analysis research.
