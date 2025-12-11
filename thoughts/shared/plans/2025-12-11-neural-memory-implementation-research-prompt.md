---
title: Neural Memory Implementation Research Prompt
description: Research prompt for /research-codebase command to map existing infrastructure for 5-day neural memory build
date: 2025-12-11
status: active
tags: [neural-memory, research, implementation]
---

# Neural Memory Implementation Research Prompt

Use this prompt with `/research-codebase` to generate a comprehensive map of existing infrastructure for the neural memory implementation.

---

## Prompt

```
## Neural Memory Full Architecture Implementation

Research the codebase to document everything needed for a 5-day neural memory implementation. Focus on existing patterns, infrastructure, and integration points.

### Reference Documents
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Full architecture spec
- `thoughts/shared/research/2025-12-11-github-vercel-neural-observations-research.md` - Existing transformer research

### Day 1: Observations In (Pipeline Completion)

**Research needed:**
1. **Current observation pipeline** - Document `api/console/src/inngest/workflow/neural/observation-capture.ts`
   - What steps exist vs what's stubbed?
   - Where do significance, classification, actor resolution need to be implemented?

2. **Existing embedding infrastructure** - Document `packages/console-embed/`
   - How does embedding generation work today?
   - What's the Pinecone upsert pattern?
   - How to add multi-view embeddings (title, content, summary)?

3. **Transformer patterns** - Document `packages/console-webhooks/src/transformers/`
   - GitHub transformer structure
   - Vercel transformer structure
   - SourceEvent interface and flow

4. **Database schema** - Document `db/console/src/schema/tables/workspace-neural-observations.ts`
   - Current observation schema
   - What fields exist for significance, classification, actor?

### Day 2: Basic Retrieval (Observations Out)

**Research needed:**
1. **Existing search infrastructure** - Document `api/console/src/router/org/search.ts`
   - Current vector search implementation
   - Pinecone query patterns
   - Hydration from Postgres pattern

2. **Knowledge store retrieval** - Document existing retrieval for knowledge documents
   - How does the current search endpoint work?
   - What can be reused for observation retrieval?

3. **Pinecone namespace strategy** - Document current namespace usage
   - How are namespaces structured today?
   - Where does the `layer` metadata filter fit?

### Day 3: Entity System

**Research needed:**
1. **Entity schema** - Document `db/console/src/schema/tables/workspace-neural-entities.ts` (if exists)
   - Or document where it needs to be created

2. **Entity extraction patterns** - Find any existing extraction logic
   - Regex patterns in codebase
   - LLM structured output examples

3. **Exact-match query patterns** - Document Drizzle query patterns for
   - Text search / ilike
   - Array containment (for aliases)

### Day 4: Clusters + Profiles

**Research needed:**
1. **Cluster schema** - Document `db/console/src/schema/tables/workspace-observation-clusters.ts`
   - Current schema
   - Relationship to observations

2. **Actor/profile infrastructure** - Document any existing actor tables
   - `workspace_actor_profiles` if exists
   - `workspace_actor_identities` if exists
   - Or document where workspace actors are stored today

3. **Inngest fire-and-forget patterns** - Document `step.sendEvent` usage
   - How to trigger async profile updates
   - How to trigger cluster summary generation

4. **LLM summary generation** - Find existing LLM call patterns
   - Model usage (Sonnet vs Haiku)
   - Structured output patterns

### Day 5: 2-Key Retrieval + Temporal

**Research needed:**
1. **LLM gating patterns** - Find any existing relevance filtering
   - Or document how to add LLM post-filter to search results

2. **Temporal state patterns** - Document any bi-temporal tables
   - `valid_from` / `valid_to` patterns in codebase
   - Or document where temporal tracking needs to be added

3. **Fusion/scoring patterns** - Document how search results are ranked today
   - Vector score usage
   - Any existing re-ranking logic

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

| Day | Focus | Key Deliverables |
|-----|-------|------------------|
| 1 | Observations In | Significance, Classification, Actor Resolution, Embeddings, Store |
| 2 | Basic Retrieval | Vector search endpoint, Postgres hydration |
| 3 | Entity System | Extraction, Store, Lookup |
| 4 | Clusters + Profiles | Assignment, Summaries, Profile updates |
| 5 | 2-Key Retrieval + Temporal | LLM gating, Temporal states, Polish |

## Reference Architecture

```
SourceEvent
    ↓
Significance (gate) ──→ discard if < threshold
    ↓
┌───────────────────────────────────────┐
│ PARALLEL (no interdependencies)       │
│  • Classification                     │
│  • Actor Resolution                   │
│  • Embeddings                         │
│  • Entity Extraction                  │
└───────────────────────────────────────┘
    ↓
Cluster Assignment ←── needs embeddings + classification
    ↓
Store Observation
    ↓
┌───────────────────────────────────────┐
│ ASYNC (fire-and-forget)               │
│  • Profile Update                     │
│  • Cluster Summary                    │
└───────────────────────────────────────┘
```
