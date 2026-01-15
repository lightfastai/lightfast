---
date: 2026-01-15T00:00:00+11:00
researcher: Claude Code (Opus 4.5)
git_commit: 69fae218c2ac204bacadcc5c25bbb9abd8b0a5da
branch: feat/docs-seo-frontmatter
repository: lightfast
topic: "Agent Memory Research Pitch - Architecture Extraction for MPhil/Master by Research"
tags: [research, agent-memory, rag, hybrid-retrieval, multi-view-embeddings, knowledge-graph]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude Code (Opus 4.5)
---

# Research: Agent Memory Architecture Extraction for MPhil/Master by Research

**Date**: 2026-01-15T00:00:00+11:00
**Researcher**: Claude Code (Opus 4.5)
**Git Commit**: 69fae218c2ac204bacadcc5c25bbb9abd8b0a5da
**Branch**: feat/docs-seo-frontmatter
**Repository**: lightfast

## Research Question

Extract core architectural ideas from the Lightfast codebase to create a 6-10 line research sketch for an MPhil/Master by Research proposal on "agent memory" (advanced RAG + LLM techniques), suitable for outreach to:
- UniMelb AgentLab + NLP (agent-first, then RAG)
- Monash RAG/IR + neuro-symbolic (retrieval-first, then reasoning)

---

## Summary

Lightfast is a production system implementing **agent memory for software teams** - a multi-source knowledge retrieval layer that enables engineers and AI agents to search across engineering artifacts (code, PRs, docs, incidents) with source-cited answers. The architecture implements several research-relevant techniques:

1. **Multi-view embeddings** (separate title/content/summary vectors per observation)
2. **Four-path hybrid retrieval** (dense vector + lexical entity + cluster context + actor profile search)
3. **Hierarchical memory abstraction** (chunks → observations → clusters → profiles)
4. **Implicit knowledge graph** via typed references and short-hop reasoning (1-2 hops)
5. **Cross-platform identity resolution** for ownership attribution
6. **Mode-based reranking** (passthrough → Cohere → LLM semantic scoring)

Key gap: No systematic evaluation framework has been implemented - retrieval quality, faithfulness, and user utility remain unmeasured.

---

## 6-10 Line Research Sketch (High-Level)

> **Agent Memory for Software Engineering Knowledge**
>
> We investigate how to build reliable memory systems for AI coding agents that operate over private engineering corpora (code, pull requests, incidents, decisions). Our work addresses three challenges: (1) **multi-source ingestion** - how to normalize and structure heterogeneous engineering events into a unified memory representation; (2) **multi-view retrieval** - how to combine dense semantic search with entity-grounded and actor-aware retrieval to serve diverse query intents; and (3) **grounded answer generation** - how to synthesize answers that cite their sources while avoiding hallucination.
>
> We ground our research in a production system that ingests GitHub, Vercel, and Linear events, generates multi-view embeddings, extracts entities via pattern and LLM methods, and serves hybrid search via a four-path parallel architecture. Open questions include: (a) evaluation methodology for retrieval over private knowledge bases, (b) balancing recall vs. precision across heterogeneous sources, and (c) extending short-hop graph reasoning to deeper causal chains.

---

## Detailed Findings

### 1. Core Architecture: The Memory Layer

**Product Vision** (from SPEC.md):
> "Lightfast is the memory layer for software teams. We help engineers and AI agents search everything your engineering org knows—code, PRs, docs, decisions—with answers that cite their sources."

**Key Principles**:
- Search by meaning, not keywords
- Always cite sources (no black-box answers)
- Privacy by default (complete tenant isolation)
- Continuously improve via feedback loops

**API Surface** (4 routes):
- `POST /v1/search` - Semantic search with reranking
- `POST /v1/contents` - Fetch full documents by ID
- `POST /v1/findsimilar` - Find semantically similar content
- `POST /v1/answer` - **Not yet implemented** (gap)

### 2. Memory System: Four-Layer Hierarchy

| Layer | Description | Storage | Purpose |
|-------|-------------|---------|---------|
| **Chunks** | Durable document slices | `workspace-knowledge-documents` + `vector-chunks` | High-recall retrieval over long documents |
| **Observations** | Atomic engineering events | `workspace-neural-observations` | Temporal, actor-attributed moments (PR merged, deployment succeeded, incident resolved) |
| **Clusters** | Topic-grouped rollups | `workspace-observation-clusters` | LLM-generated summaries by theme |
| **Profiles** | Per-entity centroids | `workspace-actor-profiles` + `org-actor-identities` | Ownership attribution and expertise tracking |

**Multi-View Embedding Strategy**:
- Three vectors per observation: `obs_title_*`, `obs_content_*`, `obs_summary_*`
- Allows retrieval to match query intent (title for navigation, content for detail, summary for overview)
- Implemented in `api/console/src/inngest/workflow/neural/observation-capture.ts`

### 3. Hybrid Retrieval: Four-Path Parallel Search

**Architecture** (`apps/console/src/lib/neural/four-path-search.ts`):

```
Query → Parallel Execution:
  ├─ Path 1: Dense Vector (Pinecone multi-view) ─────────────────┐
  ├─ Path 2: Lexical Entity (@mentions, #refs, API endpoints) ───┤
  ├─ Path 3: Cluster Centroids (topic similarity) ───────────────┤ → Fusion → Rerank → Top-K
  └─ Path 4: Actor Profiles (contributor expertise) ─────────────┘
```

**Path Details**:
1. **Dense Vector**: Queries all three embedding views in Pinecone, normalizes to observation IDs
2. **Entity Search**: Regex extraction (`@alice`, `#123`, `GET /api/users`) → database lookup
3. **Cluster Search**: Pinecone filter `layer: "clusters"` → fetch observations in matching clusters
4. **Actor Search**: Extract @mentions → search org-level identities → retrieve actor's recent work

**Reranking Pipeline** (`packages/console-rerank/`):
- **Fast**: Passthrough (~50ms) - vector scores only
- **Balanced**: Cohere Rerank API (~130ms) - production default
- **Thorough**: LLM semantic scoring (~600ms) - highest quality

### 4. Entity Extraction & Implicit Graph

**Extraction Methods**:
- **Pattern-based**: Regex for structured entities (`entity-extraction-patterns.ts`)
- **LLM-based**: Claude/GPT for contextual extraction (`llm-entity-extraction.ts`)
- **Reference-based**: Pre-structured from GitHub/Vercel webhooks

**Entity Categories**:
```typescript
type EntityCategory =
  | "engineer"   // @mentions, team members
  | "project"    // #123, ENG-456
  | "endpoint"   // GET /api/users
  | "config"     // DATABASE_URL
  | "definition" // src/lib/auth.ts
  | "service"    // External services
  | "reference"  // Git commits, branches
```

**Graph Structure** (Implicit, not explicit graph DB):
- Relationships via foreign keys + JSONB arrays
- `observation.sourceReferences[]` contains typed refs (commit, PR, issue, deployment)
- `entity.sourceObservationId` links back to first occurrence
- Short-hop reasoning (1-2 hops) via JOIN operations

### 5. Ingestion Pipeline

**Webhook Sources**:
- GitHub: push, pull_request, issues, release, discussion, installation
- Vercel: deployment events
- (Planned: Linear, Sentry, Notion, Zendesk)

**Processing Flow**:
```
Webhook → Signature Verification → SourceEvent Transform → Inngest Workflow:
  ├─ Significance Scoring (gate: ≥60/100)
  ├─ PARALLEL:
  │  ├─ Classification (topics, type)
  │  ├─ Multi-view Embedding (title, content, summary)
  │  └─ Entity Extraction (patterns + LLM)
  ├─ Pinecone Upsert (3 vectors)
  ├─ Database Insert
  └─ Emit Events → profile.update, cluster.check-summary
```

### 6. Actor Identity & Ownership

**Two-Tier Architecture**:
- **Org-Level** (`org-actor-identities`): Canonical identity across platforms (e.g., `github:12345678`)
- **Workspace-Level** (`workspace-actor-profiles`): Activity metrics per workspace

**Ownership Signals**:
- Observation count by domain
- Last active timestamp
- Profile confidence score
- Cross-platform linking (GitHub ↔ Vercel ↔ Clerk user)

---

## What Exists vs. What's Missing

### Implemented
- Multi-source webhook ingestion (GitHub, Vercel)
- Multi-view embedding generation (title/content/summary)
- Four-path hybrid retrieval with reranking
- Entity extraction (pattern + LLM)
- Cluster assignment and summary generation
- Actor identity resolution across platforms
- API routes: `/v1/search`, `/v1/contents`, `/v1/findsimilar`

### Not Yet Implemented
- **Answer Generation** (`/v1/answer`): Search returns results, but no RAG synthesis endpoint
- **Evaluation Framework**: Research doc exists (`2025-12-14-neural-memory-scientific-evaluation-framework.md`) but not implemented
- **Benchmarking**: No comparison against RAG baselines (ColBERT, DPR, etc.)
- **User Studies**: No systematic measurement of retrieval utility
- **Graph Traversal >2 hops**: Explicitly out of scope per SPEC.md

---

## Research Themes & Open Questions

### For UniMelb AgentLab + NLP (Agent-First)

**Theme**: *Agent memory as a capability for collaboration, explainability, and reliable behavior*

1. How do multi-view embeddings improve agent task completion over single-view?
2. What memory management policies help agents decide what to remember vs. forget?
3. How can source citations increase user trust in agent responses?
4. What role does actor identity play in collaborative agent settings?

### For Monash RAG/IR + Neuro-Symbolic (Retrieval-First)

**Theme**: *Advanced RAG over private + relational knowledge with faithfulness constraints*

1. How to evaluate retrieval quality over private engineering corpora (no public benchmark)?
2. Can entity-grounded retrieval reduce hallucination in answer generation?
3. How to extend short-hop graph reasoning to deeper causal chains?
4. What is the optimal fusion strategy for heterogeneous retrieval paths?

---

## Code References

### Core Search
- `apps/console/src/lib/neural/four-path-search.ts` - Four-path parallel search (609 lines)
- `apps/console/src/lib/neural/entity-search.ts` - Entity-based retrieval
- `apps/console/src/lib/neural/cluster-search.ts` - Cluster centroid search
- `apps/console/src/lib/neural/actor-search.ts` - Actor profile search

### Memory System
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Observation schema
- `db/console/src/schema/tables/workspace-observation-clusters.ts` - Cluster schema
- `db/console/src/schema/tables/workspace-actor-profiles.ts` - Actor profiles
- `db/console/src/schema/tables/workspace-neural-entities.ts` - Entity storage

### Embedding & Processing
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Main workflow (40k+ lines)
- `api/console/src/inngest/workflow/neural/entity-extraction.ts` - Entity extraction
- `packages/console-rerank/src/` - Reranking providers

### API Routes
- `apps/console/src/app/(api)/v1/search/route.ts` - Search endpoint
- `apps/console/src/app/(api)/v1/findsimilar/route.ts` - Similarity search
- `apps/console/src/app/(api)/v1/contents/route.ts` - Content retrieval

---

## Historical Context (from thoughts/)

### Neural Memory Design
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Database architecture
- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Evaluation framework (not implemented)
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - Cross-source linking gaps

### Actor System
- `thoughts/shared/research/2025-12-15-actor-implementation-end-to-end-design.md` - Actor architecture
- `thoughts/shared/research/2025-12-16-actor-identity-scope-analysis.md` - Identity scoping

### Search & Retrieval
- `thoughts/changelog/search-api-hybrid-retrieval-cross-encoder-20251217-143022.md` - Hybrid retrieval announcement
- `thoughts/changelog/entity-extraction-clusters-multiview-20251217-143500.md` - Multi-view feature

---

## Positioning for Supervisor Outreach

### Option A: UniMelb AgentLab + NLP

**Pitch**: "I've built a production memory system for AI coding agents - multi-view embeddings, four-path hybrid retrieval, entity-grounded search. I want to research how memory architecture affects agent reliability, collaboration, and explainability. My system provides a real-world testbed for evaluation."

**Relevant Supervisors**:
- Tim Miller / Liz Sonenberg (AgentLab - agent collaboration, explainability)
- Tim Baldwin / Trevor Cohn / Jey Han Lau (NLP - retrieval, grounding)

### Option B: Monash RAG/IR + Neuro-Symbolic

**Pitch**: "I've built a hybrid retrieval system combining dense vectors, entity search, topic clusters, and actor profiles - all over private engineering knowledge. I want to research evaluation methodology for private-corpus RAG, entity-grounded answer generation, and extending implicit graphs to deeper reasoning."

**Relevant Supervisors**:
- Teresa Wang (RAG/IR, personalization, relational knowledge)
- Lizhen Qu (neuro-symbolic, reasoning, verification)

### Option C: Monash Software Engineering + LLMs

**Pitch**: "I've built a memory layer for software teams - ingesting code, PRs, incidents, decisions. I want to research how LLMs can learn and retrieve software knowledge, with evaluation grounded in developer workflows."

**Relevant Supervisors**:
- Aldeida Aleti (LLMs for software knowledge)
- Chong Chun Yong (co-supervisor)

---

## Next Steps

1. **Refine research sketch** based on supervisor interest
2. **Prepare demo** showing hybrid retrieval in action
3. **Document evaluation gaps** as research motivation
4. **Draft first-contact emails** tailored to each supervisor profile
