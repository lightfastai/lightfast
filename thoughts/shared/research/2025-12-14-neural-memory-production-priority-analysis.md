---
date: 2025-12-14T05:00:45Z
researcher: Claude
git_commit: 3cb91cda19151c3031b480c08438cf4df70d1905
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Production Priority Analysis"
tags: [research, neural-memory, production, priority, architecture, roadmap]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Neural Memory Production Priority Analysis

**Date**: 2025-12-14T05:00:45Z
**Researcher**: Claude
**Git Commit**: 3cb91cda19151c3031b480c08438cf4df70d1905
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

With neural memory core pipeline implemented (observations, entities, clusters, actor profiles), what are the production priorities for the next phase? Analyze cross-source linkage, evaluation pipeline, source integrations, API routes, and backfill - then design a priority list based on what's needed to go to production.

## Executive Summary

The neural memory **write path is complete**. The **read path is implemented internally** but **not exposed publicly**. Five critical areas need attention before production:

| Area | Current State | Production Blocker? | Priority |
|------|---------------|---------------------|----------|
| **Public API + Rerank** | Designed, not implemented | **YES** - No external access | P0 |
| **Backfill Pipeline** | Schema exists, no workflows | **YES** - Empty first experience | P0 |
| **Evaluation Pipeline** | Test data exists, no evals | **NO** - But can't iterate blindly | P1 |
| **Cross-Source Linkage** | Data captured, not queried | **NO** - High-value feature | P1 |
| **Sentry Integration** | Not implemented | **NO** - Additive value | P2 |

**Critical Path to Production**: Public API + Rerank → Backfill → Ship → Iterate with Evals

---

## Current Implementation Status

### What's DONE (Write Path)

| Component | Status | Location |
|-----------|--------|----------|
| Observation Capture Pipeline | ✅ Complete | `api/console/src/inngest/workflow/neural/observation-capture.ts` |
| Significance Scoring | ✅ Complete | `api/console/src/inngest/workflow/neural/scoring.ts` |
| Classification | ✅ Complete | `api/console/src/inngest/workflow/neural/classification.ts` |
| Entity Extraction (Rule + LLM) | ✅ Complete | `entity-extraction-patterns.ts`, `llm-entity-extraction.ts` |
| Cluster Assignment | ✅ Complete | `api/console/src/inngest/workflow/neural/cluster-assignment.ts` |
| Cluster Summary | ✅ Complete | `api/console/src/inngest/workflow/neural/cluster-summary.ts` |
| Actor Resolution | ✅ Complete | `api/console/src/inngest/workflow/neural/actor-resolution.ts` |
| Profile Update | ✅ Complete | `api/console/src/inngest/workflow/neural/profile-update.ts` |
| Multi-View Embeddings | ✅ Complete | Title, content, summary views |
| GitHub Transformers | ✅ Complete | Push, PR, Issue, Release, Discussion |
| Vercel Transformer | ✅ Complete | Deployment events |
| Database Schema | ✅ Complete | Observations, entities, clusters, actors |
| Test Data Package | ✅ Complete | `packages/console-test-data/` |
| Security Hardening | ✅ Complete | Webhook validation, sanitization |

### What's DONE (Read Path - Internal Only)

| Component | Status | Location |
|-----------|--------|----------|
| 4-Path Retrieval | ✅ Complete | `apps/console/.../api/search/route.ts` |
| Vector Search | ✅ Complete | Pinecone with layer filtering |
| Entity Search | ✅ Complete | `apps/console/src/lib/neural/entity-search.ts` |
| Cluster Context | ✅ Complete | `apps/console/src/lib/neural/cluster-search.ts` |
| Actor Profiles | ✅ Complete | `apps/console/src/lib/neural/actor-search.ts` |
| LLM Relevance Filter | ✅ Complete | `apps/console/src/lib/neural/llm-filter.ts` |
| tRPC Search (API Key) | ✅ Complete | `api/console/src/router/org/search.ts` |
| tRPC Contents (API Key) | ✅ Complete | `api/console/src/router/org/contents.ts` |

### What's NOT DONE

| Component | Status | Blocker? |
|-----------|--------|----------|
| Public API `/v1/search` | Designed | **Production** |
| Public API `/v1/contents` | Designed | **Production** |
| Public API `/v1/findsimilar` | Designed | **Production** |
| Public API `/v1/answer` | Designed | Post-MVP |
| Backfill Workflows | Not started | **Production** |
| Cross-Source Correlation | Data exists, queries don't | Feature |
| Evaluation Pipeline | Patterns exist, no neural evals | Quality |
| Sentry Integration | Not started | Feature |
| Linear Integration | Stub only | Feature |
| MCP Server | Not started | Feature |

---

## Detailed Analysis by Area

### 1. Public API Routes

**Current State**: Fully designed in research docs, NOT implemented.

**What Exists**:
- Internal search route with 4-path retrieval (`apps/console/.../api/search/route.ts`)
- tRPC endpoints with API key auth (`api/console/src/router/org/search.ts`)
- Complete design docs (`thoughts/shared/research/2025-12-14-public-api-v1-route-design.md`)

**What's Missing**:
- Route group: `apps/console/src/app/(api)/v1/`
- Three endpoints: `/v1/search`, `/v1/contents`, `/v1/findsimilar`
- `/v1/answer` deferred to post-MVP (streaming + LLM synthesis complexity)
- Public API key middleware wrapper

**Implementation Effort**: ~2-3 days
- Reuses existing 4-path search logic
- Auth middleware pattern exists in tRPC procedures
- Type schemas partially exist

**References**:
- Design: `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md`
- Internal route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
- API key auth: `api/console/src/trpc.ts:530-576`

---

### 2. Backfill Pipeline

**Current State**: Schema support exists, ZERO implementation.

**What Exists**:
- `ingestionSourceSchema` includes `"backfill"` as valid source type
- Webhook storage table for payload reprocessing
- Test data package demonstrates injection pattern
- Partial GitHub API wrappers (open PRs only)

**What's Missing**:
- Backfill workflows for GitHub (closed PRs, issues, commits, releases)
- Backfill workflows for Vercel (deployment history)
- GitHub API functions for historical data
- Trigger on source connection
- User-facing controls

**Gap Impact**: Users connect GitHub → get zero observations. Terrible first experience.

**Implementation Approach**:
```
1. Add GitHub API functions:
   - listMergedPullRequests(last 100)
   - listClosedIssues(last 100)
   - listReleases(last 20)
   - listCommits(default branch, last 100)

2. Create backfill Inngest workflow:
   - Event: apps-console/source.backfill.requested
   - Steps: Fetch historical items → Transform to SourceEvents → Send to observation.capture
   - Batch to avoid rate limits

3. Trigger on source connection:
   - bulkLinkGitHubRepositories → emit backfill event
```

**Implementation Effort**: ~3-4 days

**References**:
- Gap analysis: `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md:69-96`
- Pattern: `packages/console-test-data/src/trigger/trigger.ts`
- GitHub API: `packages/console-octokit-github/src/index.ts`

---

### 3. Evaluation Pipeline

**Current State**: Infrastructure exists, NO neural memory evaluations.

**What Exists**:
- Braintrust integration (11 eval files in chat app)
- Test data package with datasets
- Verifier with health checks
- Significance scoring implementation
- Entity extraction implementation

**What's Missing**:
- `*.eval.ts` files for neural memory components
- Ground truth datasets with expected outputs
- Quantitative metrics (precision, recall, F1)
- Retrieval quality metrics (NDCG@K, MRR)
- RAG triad evaluations (faithfulness, relevance)

**Why P1 Not P0**: Can ship without evals, but can't iterate blindly. Need feedback loop to tune thresholds, weights, and prompts.

**Implementation Approach**:
```
packages/console-test-data/src/eval/
├── significance-scoring.eval.ts   # Test scoring accuracy
├── entity-extraction.eval.ts      # Test entity F1 scores
├── retrieval-ranking.eval.ts      # Test Recall@K, NDCG@K
└── classification.eval.ts         # Test type/topic assignment
```

**Implementation Effort**: ~4-5 days (including ground truth creation)

**References**:
- Framework design: `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md`
- Environment architecture: `thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md`
- Chat evals pattern: `apps/chat/src/eval/*.eval.ts`

---

### 4. Cross-Source Linkage

**Current State**: Data captured, NOT queried.

**What Exists**:
- GitHub commits store SHA in `sourceReferences`
- Vercel deployments store `gitCommitSha` in metadata AND references
- Both create "reference" category entities with 7-char SHA keys
- Entity deduplication means same commit → single entity with `occurrenceCount ≥ 2`
- All reference data persisted in JSONB columns

**What's Missing**:
- Queries to find observations sharing references
- Workflow to link GitHub commits ↔ Vercel deployments
- API endpoint for related observations
- Database indices on `sourceReferences` JSONB
- UI to visualize cross-source relationships

**Linkage Key**: `gitCommitSha` field connects Vercel deployments to GitHub pushes

**Implementation Approach**:
```typescript
// Option A: Query-time correlation (simpler)
async function getRelatedObservations(observationId: string) {
  const obs = await getObservation(observationId);
  const refs = obs.sourceReferences.filter(r => r.type === 'commit');

  return db.select()
    .from(workspaceNeuralObservations)
    .where(sql`
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(source_references) AS ref
        WHERE ref->>'type' = 'commit'
        AND ref->>'id' IN (${refs.map(r => r.id)})
      )
    `);
}

// Option B: Entity-based correlation (uses existing dedup)
async function getRelatedViaEntities(observationId: string) {
  const entities = await db.select()
    .from(workspaceNeuralEntities)
    .where(eq(sourceObservationId, observationId));

  // Find other observations that reference same entities
  // Already works via entity occurrenceCount > 1
}
```

**Implementation Effort**: ~2-3 days

**References**:
- Architecture: `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md`
- Gap analysis: `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md`
- Reference extraction: `packages/console-webhooks/src/transformers/github.ts:40-175`
- Vercel metadata: `packages/console-webhooks/src/transformers/vercel.ts:119-136`

---

### 5. Sentry Integration

**Current State**: NOT implemented.

**What Exists**:
- Research document: `thoughts/shared/research/2025-12-10-sentry-integration-research.md`
- Webhook handler patterns from GitHub/Vercel

**What's Missing**:
- Webhook route handler
- Transformer for Sentry events
- Event type definitions
- Source type in schemas

**Why P2**: Adds value (error correlation with deployments/PRs) but doesn't block production. Can ship without error tracking integration.

**Implementation Effort**: ~3-4 days

**References**:
- Research: `thoughts/shared/research/2025-12-10-sentry-integration-research.md`
- Pattern: `packages/console-webhooks/src/transformers/github.ts`

---

## Priority Recommendations

### P0: Production Blockers (Must Have)

#### 1. Public API Routes + Rerank (3-4 days)
**Why Critical**: No external access without this. Lightfast's value is providing memory to AI agents - they need API access with production-quality ranking.

**Deliverables**:
- `packages/console-rerank/` - Rerank provider abstraction
  - Cohere provider (`rerank-v3.5`)
  - LLM provider (refactored from current filter)
  - Mode-based factory (`fast` → none, `balanced` → Cohere, `thorough` → Cohere + LLM)
- `apps/console/src/app/(api)/v1/search/route.ts` - With mode parameter
- `apps/console/src/app/(api)/v1/contents/route.ts`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts`
- API key middleware wrapper
- Workspace config: `rerankProvider`, `rerankModel`, `rerankThreshold`

**Success Criteria**:
- External client can search neural memory with API key
- Full 4-path retrieval exposed via REST
- Mode support: `fast` (50ms), `balanced` (130ms), `thorough` (600ms)
- Cohere rerank improves ranking precision over vector-only
- LLM refinement available for complex queries

#### 2. Basic Backfill (3-4 days)
**Why Critical**: Users connect source → see nothing. Destroys first impression and perceived value.

**Deliverables**:
- GitHub API: `listMergedPullRequests`, `listClosedIssues`, `listCommits`
- Inngest workflow: `source.backfill.requested`
- Auto-trigger on source connection
- Progress tracking (optional first pass)

**Success Criteria**:
- User connects GitHub repo → sees last 100 merged PRs, 50 issues
- User connects Vercel project → sees last 50 deployments
- Events flow through normal observation pipeline

---

### P1: High Value (Should Have)

#### 3. Evaluation Pipeline (4-5 days)
**Why Important**: Can't improve what you can't measure. Significance thresholds, LLM prompts, and ranking weights need tuning.

**Deliverables**:
- `significance-scoring.eval.ts` with golden test cases
- `entity-extraction.eval.ts` with F1 metrics
- Ground truth dataset (20-30 annotated examples)
- CI integration for regression detection

**Success Criteria**:
- Significance scoring accuracy ≥85% on test set
- Entity extraction F1 ≥0.8
- Baseline metrics established for future iteration

#### 4. Cross-Source Linkage API (2-3 days)
**Why Important**: Differentiator. "Show me all activity related to this deployment" is powerful.

**Deliverables**:
- `/v1/related` endpoint or enhancement to `/v1/contents`
- JSONB index on `sourceReferences`
- Entity-based correlation queries

**Success Criteria**:
- Given Vercel deployment → find linked GitHub commits
- Given GitHub PR → find triggered deployments
- Sub-100ms query latency

---

### P2: Future Enhancement (Nice to Have)

#### 5. Sentry Integration (3-4 days)
**Why Later**: Adds value but not blocking. Error correlation is useful, not essential for v1.

#### 6. MCP Server (2 days, depends on P0-1)
**Why Later**: Thin wrapper around public API. Blocked until API routes exist.

#### 7. Linear Integration (3-4 days)
**Why Later**: Lower priority source. GitHub covers most engineering teams' primary workflow.

---

## Recommended Execution Order

```
Week 1: Public API Routes + Rerank (P0-1)
├── Day 1: packages/console-rerank/ (Cohere + LLM providers, mode factory)
├── Day 2: /v1/search with mode param (fast/balanced/thorough)
├── Day 3: /v1/contents + /v1/findsimilar
└── Day 4: API key middleware, workspace config, testing

Week 2: Backfill Pipeline (P0-2)
├── Day 1: GitHub API functions for historical data
├── Day 2-3: Backfill Inngest workflow
├── Day 4: Auto-trigger on source connection
└── Day 5: Buffer for testing/fixes

Week 3: Evaluation Pipeline (P1-1)
├── Day 1-2: Ground truth dataset creation
├── Day 3-4: Significance + entity eval files
└── Day 5: CI integration, baseline metrics

Week 4: Cross-Source Linkage (P1-2)
├── Day 1: JSONB index, correlation queries
├── Day 2: API endpoint integration
└── Day 3: Testing, documentation

Post-MVP:
- /v1/answer endpoint (streaming + LLM synthesis)
- Sentry integration
- Linear integration
- MCP server
- Advanced eval (RAG triad metrics)
```

---

## Architectural Gaps Identified

Beyond the 5 areas analyzed, these gaps need attention post-MVP:

### 1. Temporal Queries
**Gap**: Schema supports `validFrom`/`validTo` but no query API.
**Impact**: Can't answer "what was status last week?"
**Effort**: 2 days

### 2. Actor-Centric Queries
**Gap**: Actor profiles exist but no dedicated search.
**Impact**: Can't easily answer "what has Sarah worked on?"
**Effort**: 1-2 days

### 3. Rate Limiting
**Gap**: No API rate limits implemented.
**Impact**: Potential abuse, cost overruns.
**Effort**: 1 day (use Upstash ratelimit)

### 4. Usage Tracking
**Gap**: No metrics on API usage per workspace.
**Impact**: Can't bill, can't identify power users.
**Effort**: 1-2 days

### 5. Webhook Replay
**Gap**: Payloads stored but no replay mechanism.
**Impact**: Can't reprocess after transformer updates.
**Effort**: 2-3 days

---

## Code References

### Write Path
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:193`
- Scoring: `api/console/src/inngest/workflow/neural/scoring.ts:24`
- Entity extraction: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:170`
- Cluster assignment: `api/console/src/inngest/workflow/neural/cluster-assignment.ts:45`

### Read Path
- Internal search: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts:186`
- Entity search: `apps/console/src/lib/neural/entity-search.ts:71`
- Cluster search: `apps/console/src/lib/neural/cluster-search.ts:19`
- LLM filter: `apps/console/src/lib/neural/llm-filter.ts:66`

### Database Schema
- Observations: `db/console/src/schema/tables/workspace-neural-observations.ts:52`
- Entities: `db/console/src/schema/tables/workspace-neural-entities.ts:48`
- Clusters: `db/console/src/schema/tables/workspace-observation-clusters.ts:40`
- Actors: `db/console/src/schema/tables/workspace-actor-profiles.ts:32`

### API Layer
- tRPC search: `api/console/src/router/org/search.ts:42`
- API key auth: `api/console/src/trpc.ts:530`
- Public API design: `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md`

### Source Integrations
- GitHub transformers: `packages/console-webhooks/src/transformers/github.ts:36-458`
- Vercel transformer: `packages/console-webhooks/src/transformers/vercel.ts:17-150`
- GitHub API: `packages/console-octokit-github/src/index.ts`

---

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-api-search-mcp-integration.md` - API/Search/MCP deep dive
- `thoughts/shared/research/2025-12-14-public-api-v1-route-design.md` - Complete API design
- `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md` - Cross-source architecture
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - Gap analysis
- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Eval framework
- `thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md` - Eval environment

---

## Open Questions

1. **Backfill Depth**: How much historical data to import? Last 90 days? Last 100 items per type?

2. **Rate Limiting Strategy**: Per-endpoint limits? Per-workspace? Tiered by plan?

3. **Eval Gate Integration**: Should evals run in CI? Block PRs on regression?

4. **Cross-Source UI**: How to visualize linked observations? Graph view? Timeline?

5. **MCP Timing**: Build MCP server immediately after API routes, or wait for customer demand?
