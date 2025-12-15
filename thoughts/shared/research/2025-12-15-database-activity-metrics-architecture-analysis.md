---
date: 2025-12-15T16:47:44+08:00
researcher: Claude (Opus 4.5)
git_commit: b6cc18daffa893e5b11b97699fd7dab459f0878b
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Database Activity, Metrics, and Index Architecture Analysis"
tags: [research, postgresql, database, brin, gin, indexes, activities, metrics, webhooks, architecture]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude (Opus 4.5)
---

# Research: Database Activity, Metrics, and Index Architecture Analysis

**Date**: 2025-12-15T16:47:44+08:00
**Researcher**: Claude (Opus 4.5)
**Git Commit**: b6cc18daffa893e5b11b97699fd7dab459f0878b
**Branch**: feat/memory-layer-foundation

## Research Questions

1. Would BRIN and GIN indexes benefit our architecture?
2. Are `workspace_operations_metrics`, `workspace_user_activities`, and `workspace_webhook_payloads` implemented and needed?
3. Would a unified `workspace_activities` table be simpler than separate tables?
4. How should operations metrics tracking be designed - one table with types or separate tables?
5. What tracking gaps exist in the observation capture pipeline and v1 API routes?

## Executive Summary

**BRIN/GIN Indexes**: Yes, benefit is significant. All time-series tables are append-only and time-ordered. Add post-PlanetScale migration via custom SQL.

**Table Implementation Status**: All three tables exist and are actively used. However, the **observation capture pipeline** and **v1 API routes** have **no tracking** - they only use logging.

**Unified vs Separate Tables**: Keep separate tables. `workspace_user_activities` already supports multiple actor types (`user | system | webhook | api`). Don't add a new table - extend existing tracking to cover gaps.

**Operations Metrics Design**: Current single-table with type discrimination is correct. Extend with new types for observation pipeline metrics.

---

## 1. BRIN and GIN Index Applicability

**Decision**: Add post-PlanetScale migration via custom SQL.

### Tables for BRIN (append-only, time-ordered)

| Table | Column | Benefit |
|-------|--------|---------|
| `workspace_operations_metrics` | `timestamp` | High |
| `workspace_user_activities` | `timestamp` | High |
| `workspace_webhook_payloads` | `received_at` | High |
| `workspace_neural_observations` | `occurred_at` | High |

### Tables for GIN (JSONB columns)

| Table | Column |
|-------|--------|
| `workspace_neural_observations` | `topics`, `metadata` |
| `workspace_neural_entities` | `aliases` |
| `workspace_observation_clusters` | `keywords`, `primary_entities` |
| `workspace_user_activities` | `metadata` |
| `workspace_operations_metrics` | `tags` |

### Implementation

Drizzle ORM only generates B-tree indexes. Use post-migration script:

```sql
CREATE INDEX CONCURRENTLY ops_metric_timestamp_brin
  ON lightfast_workspace_operations_metrics USING BRIN (timestamp);

CREATE INDEX CONCURRENTLY obs_topics_gin
  ON workspace_neural_observations USING GIN (topics);
```

---

## 2. Current Tracking Coverage

### What IS Tracked

**recordJobMetric (3 usages)** - `api/console/src/lib/jobs.ts`:
- Job completion duration (`completeJob()`)
- Job failure errors (`completeJob()`)
- M2M custom metrics (tRPC endpoint)

**recordActivity (6 usages)** - Tier 2 queue-based:
- Workspace creation (user and org scoped)
- Workspace name updates
- GitHub repo connection during workspace creation
- Job cancellation/restart

**recordSystemActivity (5 usages)** - Tier 3 fire-and-forget:
- GitHub sync status updates
- GitHub config file detection
- GitHub installation disconnection
- GitHub repository deletion/metadata changes

**recordCriticalActivity (0 usages)** - Not used anywhere.

### What is NOT Tracked (29 mutations)

#### API Keys (4 mutations) - CRITICAL SECURITY GAP
`api/console/src/router/user/user-api-keys.ts`:
- `:76` - API key creation
- `:136` - API key revocation
- `:171` - API key deletion
- `:218` - API key rotation

**Should use**: `recordCriticalActivity` (security-critical)

#### User Sources / OAuth (8 mutations)
`api/console/src/router/user/user-sources.ts`:
- `:102` - GitHub disconnect
- `:243` - GitHub installation validation update
- `:329` - GitHub OAuth token update
- `:351` - GitHub OAuth token insert
- `:744` - Vercel OAuth token update
- `:765` - Vercel OAuth token insert
- `:850` - Vercel token expiration (auto-disable)
- `:902` - Vercel disconnect

**Should use**: `recordActivity` (user-initiated integration changes)

#### Workspace Integrations (11 mutations)
`api/console/src/router/org/workspace.ts`:
- `:894` - Integration disconnect
- `:967` - Vercel project reactivate
- `:978` - Vercel project link
- `:1036` - Vercel project unlink
- `:1084` - Event subscription update
- `:1201` - Bulk GitHub repos reactivate
- `:1235` - Bulk GitHub repos link
- `:1339` - Bulk Vercel projects reactivate
- `:1375` - Bulk Vercel projects link

`api/console/src/router/user/workspace.ts`:
- `:231` - GitHub repo connection update
- `:247` - GitHub repo connection insert

**Should use**: `recordActivity` (integration changes)

#### Document Processing (6 mutations)
`api/console/src/inngest/workflow/processing/process-documents.ts`:
- `:540` - Document update
- `:554` - Document insert
- `:574` - Vector chunks delete (refresh)
- `:592` - Vector chunks insert

`api/console/src/inngest/workflow/processing/delete-documents.ts`:
- `:196` - Vector chunks delete
- `:220` - Document delete

**Should use**: `recordJobMetric` with type `documents_processed`

#### Neural Workflows (5 workflows - 0 tracking)
`api/console/src/inngest/workflow/neural/`:
- `observation-capture.ts` - No metrics
- `entity-extraction.ts` - No metrics
- `llm-entity-extraction-workflow.ts` - No metrics
- `cluster-summary.ts` - No metrics
- `profile-update.ts` - No metrics

**Should use**: `recordJobMetric` with new types

#### v1 API Routes (3 routes - 0 tracking)
`apps/console/src/app/(api)/v1/`:
- `search/route.ts` - No activity recording
- `findsimilar/route.ts` - No activity recording
- `contents/route.ts` - No activity recording

**Should use**: `recordSystemActivity` (actorType: "api")

---

## 3. Table Architecture Decision

### Decision: Keep Separate Tables, Extend Tracking

The current architecture is correct:

```
workspace_operations_metrics  → System performance metrics (aggregation)
workspace_user_activities     → Audit trail (timeline)
workspace_webhook_payloads    → Raw webhook storage (replay)
workspace_neural_observations → Semantic memory (vector search)
```

**Don't add a new table.** `workspace_user_activities` already supports:
```typescript
actorType: "user" | "system" | "webhook" | "api"
```

### Tracking Extensions Needed

#### Priority 1: Security (use `recordCriticalActivity`)
| Location | What to Track |
|----------|---------------|
| `user-api-keys.ts:76` | API key created |
| `user-api-keys.ts:136` | API key revoked |
| `user-api-keys.ts:171` | API key deleted |
| `user-api-keys.ts:218` | API key rotated |

#### Priority 2: User Actions (use `recordActivity`)
| Location | What to Track |
|----------|---------------|
| `user-sources.ts:102` | GitHub disconnected |
| `user-sources.ts:351` | GitHub connected |
| `user-sources.ts:765` | Vercel connected |
| `user-sources.ts:902` | Vercel disconnected |
| `workspace.ts:894` | Integration disconnected |
| `workspace.ts:978` | Vercel project linked |
| `workspace.ts:1036` | Vercel project unlinked |
| `workspace.ts:1084` | Event subscription updated |
| `workspace.ts:1235` | Bulk repos connected |
| `workspace.ts:1375` | Bulk projects connected |

#### Priority 3: API Audit (use `recordSystemActivity`)
| Location | What to Track | Actor Type |
|----------|---------------|------------|
| `/v1/search/route.ts:240` | Search query | api/user |
| `/v1/findsimilar/route.ts:390` | FindSimilar query | api/user |
| `/v1/contents/route.ts:175` | Contents fetch | api/user |

#### Priority 4: System Metrics (use `recordJobMetric`)
| Location | What to Track | Type |
|----------|---------------|------|
| `observation-capture.ts:630` | Observation captured | `observation_captured` |
| `observation-capture.ts:335` | Observation filtered | `observation_filtered` |
| `process-documents.ts:554` | Document processed | `documents_processed` |
| `delete-documents.ts:220` | Document deleted | `documents_deleted` |

### New Metric Types for operations_metrics

Current: `job_duration | documents_indexed | errors`

Add:
- `observation_captured` - Observation pipeline success
- `observation_filtered` - Events below significance threshold
- `documents_processed` - Document ingestion count
- `documents_deleted` - Document deletion count

---

## 4. Why Separate Tables (Documented Rationale)

From `thoughts/shared/research/2025-12-11-raw-webhook-payload-storage-design.md`:

1. **Size**: Raw payloads 100KB+ vs metrics ~100 bytes
2. **Query Patterns**: Aggregation vs Timeline vs Point lookup vs Vector search
3. **1:N Relationship**: One webhook → multiple observations
4. **Independent Lifecycle**: Payloads stored before processing
5. **Indexing**: Different strategies per table (BRIN vs GIN vs B-tree)

**Merging would create**: Index conflicts, query degradation, storage inefficiency, type safety complexity.

---

## Code References

### Schema
- `db/console/src/schema/tables/workspace-operations-metrics.ts:46-144`
- `db/console/src/schema/tables/workspace-user-activities.ts:40-211`
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:29-106`

### Recording Functions
- `api/console/src/lib/jobs.ts:259-309` - `recordJobMetric()`
- `api/console/src/lib/activity.ts:120-177` - `recordCriticalActivity()` (unused)
- `api/console/src/lib/activity.ts:216-276` - `recordActivity()`
- `api/console/src/lib/activity.ts:313-359` - `recordSystemActivity()`

### Gaps (no tracking)
- `api/console/src/inngest/workflow/neural/observation-capture.ts`
- `apps/console/src/app/(api)/v1/search/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- `apps/console/src/app/(api)/v1/contents/route.ts`

### Related Research
- `thoughts/shared/research/2025-12-15-web-analysis-postgresql-operations-metrics-design.md` - **IMPORTANT**: BRIN/GIN benchmarks, partitioning strategies, BIGINT vs UUID performance
- `thoughts/shared/research/2025-12-11-raw-webhook-payload-storage-design.md` - Separate tables rationale
- `thoughts/shared/research/2025-12-15-planetscale-serverless-day1-config.md` - PgBouncer `prepare: false` requirement

---

## Decisions Made

| Question | Decision |
|----------|----------|
| BRIN/GIN indexes? | Yes, add post-PlanetScale migration |
| Add FK constraints? | Yes, for schema consistency |
| Retention policy? | Forever (no archival) |
| Dashboard features? | Not now |
| New unified table? | No - extend existing tables |

---

**Last Updated**: 2025-12-15
**Confidence Level**: High
