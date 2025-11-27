---
title: Retrieval & Ranking — Neural Design
description: Query processing, candidate generation, fusion, rerank, and rationale
status: working
owner: platform-search
audience: engineering
last_updated: 2025-11-27
tags: [retrieval, neural-memory]
---

# Retrieval & Ranking — Neural Design

Target: <90 ms p95 for identifier queries; <150 ms p95 for semantic queries; <200 ms p95 for neural queries, while maintaining high recall across knowledge and neural memory. See also: `./router-diagram.md` for internal flow diagrams and `./neural-memory-design.md` for detailed neural architecture.

Terminology:
- **Knowledge**: Chunked documents from sources (GitHub, Linear, Notion, etc.)
- **Neural Memory**: Observations (atomic moments), summaries (clustered insights), and profiles (actor models)
- **Temporal States**: How entities evolve over time
- **Graph**: Entity/relationship signals for explainability and bounded bias

---

## Pipeline Overview

```
User Query → Query Processor → Router → Candidate Generation → Fusion & Scoring → Rerank → Hydrate & Compose
     ↓            ↓               ↓              ↓                    ↓              ↓           ↓
  Intent      Classify &      Choose      Knowledge +          Graph Bias +    Cross-      Fetch &
  Parse       Embed Views      Mode        Neural              Actor Sim      Encoder     Format
```

**Parallel Candidate Sources:**
- Knowledge: Documents + Chunks (lexical + dense)
- Neural: Observations + Summaries + Profiles
- Temporal: Current states + Evolution history
- Graph: Entity relationships (bounded 1-2 hops)

---

## Router Modes (Internal)

- **knowledge**: Hybrid over chunks (lexical + dense) with optional graph bias
- **neural**: Dense over observations + summaries + profiles with temporal awareness
- **hybrid**: Run knowledge and neural in parallel; fuse with calibrated weights
- **temporal**: Time-aware search with state tracking and evolution
- **actor**: Actor-centric search using profiles and contribution patterns

**Classification Hints:**
- Identifiers (`#123`, `LINEAR-ABC-12`, `repo:path`) → `knowledge`
- Temporal markers (`yesterday`, `this week`, `recently`) → `neural`
- Actor queries (`@john`, `who worked on`, `owned by`) → `actor`
- State queries (`status`, `progress`, `current`) → `temporal`
- Decision/context (`why`, `rationale`, `discussion`) → `neural` or `hybrid`
- Technical search (code, API, implementation) → `knowledge` or `hybrid`

Router choice is logged as `retrieval_logs.routerMode` with confidence score.

---

## Query Processing

**Steps:**
1. Parse syntax (identifiers, sources, types, time bounds, labels, actors)
2. Extract temporal context (absolute dates, relative times, periods)
3. Resolve entities via alias tables (emails, handles, URLs, @mentions)
4. Classify query intent and select router mode
5. Build multi-view embeddings: title, body, summary, context
6. Fast-paths:
   - Identifier queries → Direct PlanetScale lookup
   - Actor queries → Profile index lookup
   - Current state → Temporal state cache

**Types:**
```typescript
interface RetrievalQuery {
  workspaceId: string;
  text: string;
  filters: RetrievalFilters;
  mode?: RouterMode;
  limit: number;
  temporalContext?: TemporalContext;
  actorContext?: ActorContext;
}

interface RetrievalFilters {
  sources?: string[];
  types?: string[];
  authors?: string[];
  labels?: string[];
  after?: Date;
  before?: Date;
  includeNeural?: boolean;
}

interface TemporalContext {
  referenceTime: Date;
  period?: 'day' | 'week' | 'month' | 'sprint';
  includeHistory?: boolean;
}

interface ActorContext {
  actorId?: string;
  includeCollaborators?: boolean;
  expertiseRequired?: string[];
}
```

---

## Candidate Generation

### Knowledge Layer (Documents/Chunks)
- **Lexical**: Postgres FTS over chunk text (≤30ms)
- **Dense**: Pinecone query in `{workspaceId}-knowledge` namespace (≤40ms)
- **Metadata filters**: Source type, date range, labels

### Neural Memory Layer

**Observations (Atomic Moments):**
- **Dense**: Pinecone multi-view query in `{workspaceId}-observations` namespace (≤40ms)
- **Temporal filter**: occurred_at within time window
- **Actor filter**: actor_id matches or in collaborator network
- **Type filter**: observation_type (decision, incident, highlight, change)

**Summaries (Clustered Insights):**
- **Dense**: Pinecone query in `{workspaceId}-summaries` namespace (≤30ms)
- **Scope filter**: summary_type and period alignment
- **Entity filter**: primary_entities overlap

**Profiles (Actor Models):**
- **Centroid similarity**: Compare query embedding to actor expertise vectors (≤10ms)
- **Expertise match**: Filter by required skill domains
- **Activity recency**: Boost recently active actors

### Temporal States
- **Current state lookup**: Redis cache for is_current=true states (≤5ms)
- **State evolution**: PlanetScale query for historical states (≤20ms)
- **Change tracking**: Related observations for state transitions

### Graph Seeds
- Resolved entities from query parsing
- Top candidates' linked entities
- Actor collaboration networks
- Project/team associations

---

## Fusion & Scoring

**Enhanced Scoring Formula:**
```
score = wk*knowledge + wn*neural + wt*temporal + wa*actor + wg*graph + wr*recency + wi*importance
```

**Component Scores:**

- **knowledge**: Weighted combination of vector and lexical scores from chunks
- **neural**: Multi-view similarity from observations/summaries
- **temporal**: Boost for time-relevant results based on query context
- **actor**: Profile similarity and expertise alignment
- **graph**: Hop/confidence-weighted boost (bounded 1-2 hops)
- **recency**: Exponential decay with configurable half-life
- **importance**: Source/type priority (incidents > decisions > discussions)

**Weight Calibration:**
```typescript
interface FusionWeights {
  knowledge: 0.30,    // Document relevance
  neural: 0.25,       // Observation/summary match
  temporal: 0.15,     // Time relevance
  actor: 0.10,        // Actor similarity
  graph: 0.10,        // Relationship boost
  recency: 0.07,      // Freshness
  importance: 0.03    // Source importance
}
```

**Dynamic Adjustment:**
- Weights adjust based on router mode
- Neural-heavy for temporal queries
- Knowledge-heavy for technical searches
- Actor-heavy for ownership queries
- Calibrated per workspace using feedback signals

---

## Graph Bias and Rationale

**Enhanced Graph Integration:**

**Entity Types:**
- **Actors**: Users, teams, services (from profiles)
- **Projects**: Features, initiatives, goals (from temporal states)
- **Artifacts**: Documents, PRs, issues (from knowledge)
- **Events**: Decisions, incidents, changes (from observations)

**Relationship Types:**
- **Ownership**: OWNED_BY, MEMBER_OF, MAINTAINS
- **Dependencies**: DEPENDS_ON, BLOCKED_BY, RESOLVES, REQUIRES
- **Collaboration**: WORKS_WITH, REVIEWED_BY, DISCUSSED_WITH
- **Evolution**: PRECEDED_BY, EVOLVED_TO, DERIVED_FROM
- **Expertise**: EXPERT_IN, CONTRIBUTED_TO, AUTHORED

**Traversal Strategy:**
- Redis adjacency caches for fast lookups (≤15ms)
- Hop limit: 1-2 based on confidence and query type
- Allowlists by intent and router mode
- Actor graphs from profile relationships

**Boost Calculation:**
```typescript
graphBoost = GRAPH_WEIGHT * confidence * hopFactor * relationshipStrength

where:
- hopFactor: 1.0 (1 hop), 0.6 (2 hops)
- relationshipStrength: Based on interaction frequency
- confidence: Edge confidence score
```

**Rationale Generation:**
Include entities, edges, observations, and temporal context when:
- Graph significantly influenced ranking (boost > threshold)
- Router mode is actor or temporal
- Query explicitly asks for rationale

---

## Rerank

- Apply cross-encoder rerank on fused top-K when `rerank=true` and K ≥ threshold.
- Workspace-calibrated relevance threshold trims tails.

---

## Hydration & Highlighting

- Fetch chunks, documents, and observations from Redis caches; PlanetScale fallback.
- Build highlights via lexical windows or model-assisted snippets.
- Attach URLs and section labels for auditability.

---

## Response Assembly

**Unified Result Format:**
```typescript
interface SearchResult {
  id: string;
  type: 'chunk' | 'observation' | 'summary' | 'state';
  score: number;

  // Content
  title: string;
  content: string;
  highlights: string[];

  // Source
  source: {
    type: string;
    id: string;
    url?: string;
  };

  // Temporal
  occurredAt?: Date;
  capturedAt?: Date;

  // Actor
  actor?: {
    id: string;
    name: string;
    type: string;
  };

  // Rationale
  rationale?: {
    graphPath?: GraphEdge[];
    temporalContext?: string;
    actorExpertise?: string[];
  };
}
```

**Answer Generation (`/v1/answer`):**
- Assemble evidence from all sources (knowledge + neural)
- Include temporal context and actor information
- Generate citations with observation IDs and timestamps
- Support streaming with incremental evidence assembly
- Provide confidence scores and source distribution

---

## Monitoring & Evaluation

**Logging:**
```typescript
interface RetrievalLog {
  queryId: string;
  query: string;
  routerMode: RouterMode;
  routerConfidence: number;

  // Latency breakdown
  latency: {
    total: number;
    queryProcessing: number;
    candidateGeneration: {
      knowledge: number;
      neural: number;
      temporal: number;
      graph: number;
    };
    fusion: number;
    rerank: number;
    hydration: number;
  };

  // Result composition
  contributionShares: {
    chunks: number;
    observations: number;
    summaries: number;
    states: number;
    profiles: number;
  };

  // Features used
  features: {
    rerankUsed: boolean;
    graphInfluence: boolean;
    temporalFilter: boolean;
    actorFilter: boolean;
  };
}
```

**Quality Metrics:**
- **Recall@k**: Coverage across knowledge and neural sources
- **Precision**: Relevance of top results
- **Neural Coverage**: % queries with neural results
- **Temporal Accuracy**: Correctness of time-aware results
- **Actor Relevance**: Expertise match accuracy
- **Rationale Quality**: Explainability and faithfulness

**Performance Segmentation:**
- By router mode (knowledge vs neural vs hybrid)
- By source type (documents vs observations)
- By query complexity (simple vs multi-hop)
- By temporal range (current vs historical)

---

## Latency Targets (p95)

**Query Types:**
- **Identifier queries**: <90 ms (direct lookup)
- **Semantic search**: <150 ms (knowledge only)
- **Neural search**: <200 ms (observations + summaries)
- **Hybrid search**: <250 ms (knowledge + neural)
- **Actor queries**: <180 ms (profile-based)
- **Temporal queries**: <200 ms (state + observations)
- **Contents hydration** (10 items): <120 ms
- **Answer generation**: 1.5-2.5s (model-dependent)

**Component Budgets:**
- Query processing: <20 ms
- Candidate generation (parallel): <50 ms
- Fusion scoring: <10 ms
- Graph traversal: <15 ms
- Rerank (optional): <30 ms
- Hydration: <30 ms

## Future Enhancements

- **Continuous Learning**: Profile evolution from implicit feedback
- **Predictive Retrieval**: Anticipate information needs based on patterns
- **Collaborative Filtering**: Leverage team behavior for relevance
- **Causal Analysis**: Trace decision chains through observations
- **Temporal Reasoning**: Complex time-based queries with state evolution
- **Multi-modal Memory**: Support for images, diagrams, and structured data

---

_Last reviewed: 2025-11-27_
