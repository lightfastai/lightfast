---
title: Neural Memory Implementation Research Prompt
description: Research prompt for /research-codebase command to map existing infrastructure for neural memory build
date: 2025-12-11
updated: 2025-12-13
status: active
tags: [neural-memory, research, implementation]
---

# Neural Memory Implementation Research Prompt

Use this prompt with `/research-codebase` to generate a comprehensive map of existing infrastructure for the neural memory implementation.

---

## Progress Tracking

| Day | Status | Plan Document |
|-----|--------|---------------|
| 1 | ✅ COMPLETE | `thoughts/shared/plans/2025-12-11-neural-memory-day1-observations-in.md` |
| 2 | ✅ COMPLETE | `thoughts/shared/plans/2025-12-12-neural-memory-day2-retrieval-infrastructure.md` |
| 3 | ✅ COMPLETE | `thoughts/shared/plans/2025-12-12-neural-memory-day3-entity-system.md` |
| 3.5 | ✅ COMPLETE | `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md` |
| 4 | 🔄 NEXT | Clusters + Actor Resolution + Profiles |
| 5 | ⏳ PENDING | Multi-view Embeddings + Temporal + Polish |

---

## Prompt

```
## Neural Memory Full Architecture Implementation

Research the codebase to document everything needed for the neural memory implementation. Focus on existing patterns, infrastructure, and integration points.

### Reference Documents
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full architecture spec
- `thoughts/shared/research/2025-12-11-github-vercel-neural-observations-research.md` - Existing transformer research

### Day 1: Observations In (Pipeline Completion) ✅ COMPLETE

**Implemented:**
- Rule-based significance scoring (`scoring.ts`)
- Regex-based semantic classification (`classification.ts`)
- Actor resolution placeholder (`actor-resolution.ts`)
- Single-view embedding generation
- Observation storage with topics

**Plan:** `thoughts/shared/plans/2025-12-11-neural-memory-day1-observations-in.md`

### Day 2: Basic Retrieval (Observations Out) ✅ COMPLETE

**Implemented:**
- Search endpoint with metadata filters (`sourceTypes`, `observationTypes`, `dateRange`)
- LLM relevance gating (GPT-5.1 Instant)
- Latency tracking (`retrieval`, `llmFilter`)
- Filter UI in WorkspaceSearch component

**Plan:** `thoughts/shared/plans/2025-12-12-neural-memory-day2-retrieval-infrastructure.md`

### Day 3: Entity System ✅ COMPLETE

**Implemented:**
- Entity schema (`workspace_neural_entities` table)
- Regex-based entity extraction patterns
- Entity extraction workflow (fire-and-forget after observation capture)
- Entity search integration in search route

**Plan:** `thoughts/shared/plans/2025-12-12-neural-memory-day3-entity-system.md`

### Day 3.5: Write Path Rework ✅ COMPLETE

**Implemented:** Refactored observation capture pipeline to match target architecture.

**Research needed:**
1. **Current pipeline structure** - Audit `observation-capture.ts` for:
   - Sequential vs parallel step execution
   - Where significance gating should occur
   - How to inline entity extraction (remove fire-and-forget)

2. **Parallel step patterns** - Document Inngest `Promise.all` patterns:
   - How other workflows parallelize independent steps
   - Error handling in parallel execution
   - Step naming conventions for parallel work

3. **Transactional storage patterns** - Document `db.transaction` usage:
   - How to store observation + entities atomically
   - Rollback patterns on failure

**Key Changes:**
- Add significance gating (early return for low-value events)
- Parallelize: classification + embedding + entity extraction
- Inline entity extraction (same transaction as observation)
- Remove separate entity extraction workflow
- Prepare structure for Day 4 additions (cluster assignment slot)

**Plan:** `thoughts/shared/plans/2025-12-13-neural-memory-day3.5-write-path-rework.md`

### Day 4: Clusters + Actor Resolution + Profiles

**Research needed:**
1. **Cluster schema** - Document or create `workspace_observation_clusters`
   - Topic label, centroid embedding, keywords
   - Status (open/closed), observation count
   - Summary and summary generation timestamp

2. **Cluster assignment algorithm** - Design based on e2e spec:
   - Embedding similarity to cluster centroids
   - Entity overlap scoring
   - Actor overlap scoring
   - Temporal proximity scoring
   - Threshold for creating new cluster vs joining existing

3. **Actor resolution** - Implement three-tier resolution:
   - Tier 1: OAuth connection match (confidence 1.0)
   - Tier 2: Email matching via Clerk (confidence 0.85)
   - Tier 3: Heuristic matching (confidence 0.60)

4. **Actor profile schema** - Document or create `workspace_actor_profiles`
   - Expertise domains, contribution types
   - Active hours, frequent collaborators
   - Profile embedding (centroid of actor's observations)

5. **Fire-and-forget patterns** - Document `step.sendEvent` for:
   - `neural/profile.update` - Async profile recalculation
   - `neural/cluster.check-summary` - Async summary generation

6. **LLM summary generation** - Patterns for cluster summaries:
   - Model choice (Sonnet for quality, Haiku for speed)
   - Structured output with generateObject
   - Summary update frequency/debouncing

**Key Deliverables:**
- Cluster assignment step in observation capture
- Actor resolution in parallel processing
- Profile update workflow (fire-and-forget)
- Cluster summary workflow (fire-and-forget)

### Day 5: Multi-view Embeddings + Temporal + Polish

**Research needed:**
1. **Multi-view embedding schema** - Schema changes for:
   - `embedding_title_id` - Title-only embedding
   - `embedding_content_id` - Body-only embedding
   - `embedding_summary_id` - Summary embedding (optional)

2. **Multi-view embedding generation** - Update pipeline:
   - Generate 3 embeddings in parallel
   - Upsert 3 vectors to Pinecone
   - Update retrieval to query appropriate view

3. **Temporal state tracking** - Design bi-temporal tables:
   - `workspace_temporal_states` schema
   - `valid_from` / `valid_to` patterns
   - Point-in-time query functions

4. **Enhanced retrieval governor** - Full 2-key implementation:
   - Parallel search paths (vector, entity, cluster, actor)
   - LLM relevance filtering improvements
   - Fusion scoring across all paths

5. **Retrieval quality polish**:
   - Braintrust evaluation setup
   - Latency optimization
   - Caching strategies

**Key Deliverables:**
- Multi-view embeddings (3 vectors per observation)
- Temporal state tracking for entities
- Full retrieval governor with all parallel paths
- Quality metrics and evaluation

### Cross-Cutting Research

1. **Inngest workflow patterns** - Document concurrency, retries, step patterns in existing workflows
2. **tRPC router patterns** - How to add new observation/retrieval endpoints
3. **Error handling** - Existing patterns for pipeline failures
4. **Testing patterns** - How existing Inngest workflows are tested

### Output Format

For each area, document:
- **What exists**: File paths, line numbers, current implementation
- **What's missing**: Gaps between current state and e2e design spec
- **Integration points**: Where new code connects to existing infrastructure
- **Patterns to follow**: Existing code to use as templates
```

---

## Usage

1. Run `/research-codebase`
2. When prompted, paste the prompt above
3. Research output will be saved to `thoughts/shared/research/2025-12-XX-neural-memory-implementation-map.md`

---

## Implementation Plan Summary

| Day | Focus | Key Deliverables | Status |
|-----|-------|------------------|--------|
| 1 | Observations In | Significance scoring, Classification, Actor placeholder | ✅ |
| 2 | Basic Retrieval | Metadata filters, LLM gating, Latency tracking | ✅ |
| 3 | Entity System | Entity schema, Extraction patterns, Search integration | ✅ |
| 3.5 | Write Path Rework | Significance gating, Parallelization, Inline entities | ✅ |
| 4 | Clusters + Profiles | Cluster assignment, Actor resolution, Profile updates | 🔄 |
| 5 | Multi-view + Temporal | 3 embeddings per obs, Temporal states, Retrieval polish | ⏳ |

## Reference Architecture

### Current State (Days 1-3)

```
SourceEvent
    ↓
Check Duplicate → Check Event Allowed → Fetch Context
    ↓
Generate Embedding (single view, sequential)
    ↓
Upsert to Pinecone
    ↓
Store Observation (significance + classification computed inline)
    ↓
Emit Event → Entity Extraction (fire-and-forget)
```

**Issues:**
- Significance computed but not used as gate
- Sequential steps (no parallelization)
- Entity extraction is fire-and-forget (can't use for cluster assignment)

### After Day 3.5 (Write Path Rework)

```
SourceEvent
    ↓
Check Duplicate + Event Allowed (combined)
    ↓
Fetch Context + Evaluate Significance
    ↓
GATE ──→ discard if significance < 40
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Embeddings (single view)           │
│  • Entity Extraction (inline)         │
└───────────────────────────────────────┘
    ↓
Upsert to Pinecone
    ↓
Store Observation + Entities (transactional)
    ↓
Emit Event (enriched payload for Day 4)
```

### Target State (Days 4-5 Complete)

```
SourceEvent
    ↓
Significance (gate) ──→ discard if < threshold
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Actor Resolution (3-tier)          │
│  • Embeddings (multi-view: 3 vectors) │
│  • Entity Extraction                  │
└───────────────────────────────────────┘
    ↓
Cluster Assignment ←── needs embeddings + classification
    ↓
Store Observation + Entities (transactional)
    ↓
┌───────────────────────────────────────┐
│ ASYNC (fire-and-forget)               │
│  • Profile Update                     │
│  • Cluster Summary Check              │
└───────────────────────────────────────┘
```

## Gap Analysis

| Component | Day 1-3 | Day 3.5 | Day 4 | Day 5 |
|-----------|---------|---------|-------|-------|
| Significance | Computed, stored | **GATE** | Gate | Gate |
| Classification | Sequential | **Parallel** | Parallel | Parallel |
| Actor Resolution | Placeholder | Placeholder | **3-tier** | 3-tier |
| Embeddings | Single view | Single view | Single view | **Multi-view (3)** |
| Entity Extraction | Fire-and-forget | **Inline** | Inline | Inline |
| Cluster Assignment | None | Slot prepared | **Implemented** | Implemented |
| Profile Update | None | None | **Fire-and-forget** | Fire-and-forget |
| Cluster Summary | None | None | **Fire-and-forget** | Fire-and-forget |
| Temporal States | None | None | None | **Implemented** |
