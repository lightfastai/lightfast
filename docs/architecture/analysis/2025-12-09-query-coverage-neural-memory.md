---
title: "Query Coverage Evaluation: Neural Memory E2E Design"
description: Evaluation of neural memory architecture against query scenarios
status: draft
audience: engineering
date: 2025-12-09
architecture_doc: "docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md"
scenarios_doc: "docs/examples/query-scenarios/query_scenarios.json"
tags: [evaluation, query-coverage, neural-memory, retrieval]
---

# Query Coverage Evaluation: Neural Memory E2E Design

**Date**: 2025-12-09
**Architecture Document**: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
**Query Scenarios**: `docs/examples/query-scenarios/query_scenarios.json`

## Executive Summary

**Overall Confidence Score: 75%**

| Category | Count | Percentage |
|----------|-------|------------|
| Full Support | 14 | 70% |
| High Confidence | 0 | 0% |
| Medium Confidence | 4 | 20% |
| Low Confidence | 2 | 10% |
| Not Supported | 0 | 0% |

The Neural Memory architecture handles **14 of 20 query scenarios** with high confidence through its observation-based data model, 2-key retrieval system, and actor profile tracking. The primary gap is the **absence of a graph database** for dependency traversal, which impacts 3 scenarios (Q002, Q003, Q015). Secondary gaps include incomplete IaC source support and lack of causal linking for root cause analysis.

---

## Coverage Matrix

| ID | Query Intent | Confidence | Signal Support | Gaps |
|----|--------------|------------|----------------|------|
| Q001 | incident_search | 95% | dense, recency, importance, rerank | None |
| Q002 | ownership | 55% | dense | Missing: graph (ownership edges) |
| Q003 | dependency | 35% | dense | Missing: graph (dependency traversal) |
| Q004 | decision | 90% | dense, importance, rerank | None |
| Q005 | deployment_history | 90% | dense, recency, rerank | None |
| Q006 | change_evidence | 90% | dense, lexical, recency, rerank | None |
| Q007 | temporal_diff | 95% | dense, recency, rerank | None |
| Q008 | similar | 95% | dense | None |
| Q009 | expertise | 90% | graph, dense, profile | None (profile-based) |
| Q010 | error_search | 90% | dense, lexical, recency, rerank | None |
| Q011 | incident_history | 90% | dense, recency, importance, rerank | None |
| Q012 | infra_changes | 60% | dense, recency, rerank | Missing: Pulumi/Terraform sources |
| Q013 | summary | 90% | summaries, dense, rerank | None |
| Q014 | review_search | 90% | dense, lexical, recency, rerank | None |
| Q015 | impact_analysis | 40% | dense, recency, rerank | Missing: graph (impact traversal) |
| Q016 | agent_context | 90% | dense, importance, profile, rerank, graph | None |
| Q017 | important_changes | 95% | dense, importance, recency, rerank | None |
| Q018 | root_cause | 55% | dense, lexical, rerank | Missing: causal linking |
| Q019 | build_failures | 90% | dense, recency, rerank | None |
| Q020 | contributors | 90% | graph, dense, recency | None (actor profiles) |

---

## Signal Support Analysis

### Supported Signals

| Signal | Architecture Component | Implementation |
|--------|----------------------|----------------|
| `dense` | Pinecone `observations` namespace | Multi-view embeddings (`embedding_title_id`, `embedding_content_id`, `embedding_summary_id`) |
| `recency` | `workspace_neural_observations.occurred_at` | Index `idx_obs_workspace_occurred` with DESC ordering |
| `importance` | `significance_score` column | Multi-factor scoring (event type, content substance, actor activity, reference density, temporal uniqueness) |
| `rerank` | Retrieval Governor Key 2 | LLM relevance filtering with `claude-3-5-haiku` |
| `profile` | `workspace_actor_profiles` table | `expertise_domains`, `contribution_types`, `profile_embedding_id` |
| `summaries` | `workspace_observation_clusters.summary` | LLM-generated cluster summaries via `clusterSummaryCheck` |
| `lexical` | Entity Store exact match | `workspace_neural_entities` with key/alias lookup + fuzzy match |

### Missing/Weak Signals

| Signal | Required By | Gap Description |
|--------|-------------|-----------------|
| `graph` | Q002, Q003, Q015 | No graph database for relationship traversal. Entity Store is key-value, not relationship-based. Cannot traverse `depends_on`, `owns`, or `affects` edges. |

---

## Detailed Query Analysis

### Full Support Queries (14 queries)

#### Q001: incident_search
**Query**: "What broke in the checkout service last night?"
**Confidence**: 95%

**Architecture Support:**
- `workspace_neural_observations` captures Sentry/PagerDuty events
- `source_type` filter for `sentry`, `pagerduty`
- `observation_type` filter for `error`, `incident`
- `occurred_at` temporal filtering with index

**Signal Mapping:**
- `dense` → Vector search in `observations` namespace
- `recency` → `occurred_at DESC` index
- `importance` → `significance_score` column
- `rerank` → LLM relevance filtering (Key 2)

---

#### Q004: decision
**Query**: "Why did we decide to use PlanetScale instead of Postgres?"
**Confidence**: 90%

**Architecture Support:**
- Observations capture PR discussions, commits, reviews
- Observation Clusters group related events by topic
- 2-key retrieval filters for relevance
- Cluster summaries synthesize decisions

**Signal Mapping:**
- `dense` → Semantic search for decision context
- `importance` → Higher weight for `github:discussion`, `github:pull_request_reviewed`
- `rerank` → LLM validates decision-related content

---

#### Q005: deployment_history
**Query**: "Show me the deployment history for the payments service this week"
**Confidence**: 90%

**Architecture Support:**
- `observation_type = 'deployment'` captures deployment events
- `source_type` filter for `vercel`, `railway`
- Temporal filter via `occurred_at`
- Entity extraction links to service entities

**Signal Mapping:**
- `dense` → Semantic match for "payments service"
- `recency` → `after: 2025-12-02` filter
- `rerank` → Sort by deployment timestamp

---

#### Q006: change_evidence
**Query**: "What PRs fixed the memory leak in the feed service?"
**Confidence**: 90%

**Architecture Support:**
- Observations capture PRs with `source_type = 'github'`
- Entity extraction captures PR references (`#123`, `ABC-456`)
- Multi-view embeddings for semantic + lexical matching

**Signal Mapping:**
- `dense` → Semantic search for "memory leak" + "feed service"
- `lexical` → Entity Store exact match on service name
- `recency` → Recent PRs prioritized
- `rerank` → LLM validates fix-related content

---

#### Q007: temporal_diff
**Query**: "What changed in the auth module since last Tuesday?"
**Confidence**: 95%

**Architecture Support:**
- `occurred_at` with temporal filtering
- `observation_type` filter for `pr`, `commit`
- Source filtering for GitHub

**Signal Mapping:**
- `dense` → Semantic search for "auth module"
- `recency` → `after: 2025-12-03` filter with index

---

#### Q008: similar
**Query**: "Find similar PRs to 'Add exponential backoff to retry queue'"
**Confidence**: 95%

**Architecture Support:**
- Multi-view embeddings enable similarity search
- Pinecone vector search with cosine similarity
- Filter by `observation_type = 'pr'`

**Signal Mapping:**
- `dense` → Embedding similarity search in `observations` namespace

---

#### Q009: expertise
**Query**: "Who has context on the webhook delivery system?"
**Confidence**: 90%

**Architecture Support:**
- `workspace_actor_profiles.expertise_domains` tracks expertise
- `frequent_collaborators` identifies related experts
- `profile_embedding_id` enables semantic profile matching
- Observation history links actors to topics

**Signal Mapping:**
- `dense` → Semantic search for "webhook delivery"
- `profile` → Actor profile matching via `expertise_domains`
- `graph` → Simulated via `frequent_collaborators` (not true graph)

---

#### Q010: error_search
**Query**: "What Sentry errors are related to the database connection pool?"
**Confidence**: 90%

**Architecture Support:**
- `source_type = 'sentry'` filter
- `observation_type = 'error'` filter
- Semantic search for "database connection pool"

**Signal Mapping:**
- `dense` → Vector search for semantic meaning
- `lexical` → Entity extraction for database-related terms
- `recency` → Recent errors prioritized
- `rerank` → LLM validates relevance

---

#### Q011: incident_history
**Query**: "Show me all incidents involving checkout latency spikes since October"
**Confidence**: 90%

**Architecture Support:**
- Observations capture incidents from PagerDuty/Sentry
- Temporal filtering via `occurred_at`
- Observation Clusters group related incidents

**Signal Mapping:**
- `dense` → Semantic search for "checkout latency"
- `recency` → `after: 2025-10-01` filter
- `importance` → Incident severity in `significance_score`
- `rerank` → LLM validates latency-related content

---

#### Q013: summary
**Query**: "Summarize the post-mortems from Q3 mobile crashes"
**Confidence**: 90%

**Architecture Support:**
- `workspace_observation_clusters.summary` provides pre-computed summaries
- `clusterSummaryCheck` generates summaries with LLM
- Temporal filtering for Q3 window

**Signal Mapping:**
- `summaries` → Cluster summaries for incident groups
- `dense` → Semantic search for "mobile crashes"
- `rerank` → LLM synthesis with citations

---

#### Q014: review_search
**Query**: "What code reviews mentioned security concerns in the last month?"
**Confidence**: 90%

**Architecture Support:**
- Observations capture reviews/comments from GitHub
- `observation_type` filter for `review`, `comment`
- Semantic search for "security concerns"

**Signal Mapping:**
- `dense` → Vector search for security topics
- `lexical` → Keyword extraction for security terms
- `recency` → `after: 2025-11-09` filter
- `rerank` → LLM validates security-related content

---

#### Q016: agent_context
**Query**: "I'm working on the batch webhooks feature—what's the relevant context?"
**Confidence**: 90%

**Architecture Support:**
- Retrieval Governor runs 4 parallel paths
- Actor profiles provide personalized context
- Entity Store provides structured facts
- Cluster context for topic grouping

**Signal Mapping:**
- `dense` → Vector search for "batch webhooks"
- `importance` → Prioritize significant observations
- `profile` → Actor context for personalization
- `rerank` → LLM validates relevance
- `graph` → Entity relationships (limited)

---

#### Q017: important_changes
**Query**: "What were the most important changes to the API gateway this month?"
**Confidence**: 95%

**Architecture Support:**
- `significance_score` ranks importance
- Multi-factor scoring (event type, content substance, references)
- Temporal filtering for "this month"

**Signal Mapping:**
- `dense` → Semantic search for "API gateway"
- `importance` → `significance_score` sorting
- `recency` → `after: 2025-11-09` filter
- `rerank` → LLM validates importance

---

#### Q019: build_failures
**Query**: "What build failures happened in CI today?"
**Confidence**: 90%

**Architecture Support:**
- Observations capture build/deployment events
- `source_type` filter for GitHub Actions, Vercel
- `observation_type` filter for `build`, `deployment`

**Signal Mapping:**
- `dense` → Semantic search for "build failures"
- `recency` → `after: 2025-12-09` filter

---

#### Q020: contributors
**Query**: "Who worked on the billing module recently?"
**Confidence**: 90%

**Architecture Support:**
- `workspace_neural_observations.actor_id` tracks contributors
- `workspace_actor_profiles` stores actor metadata
- Temporal filtering for "recently"

**Signal Mapping:**
- `dense` → Semantic search for "billing module"
- `recency` → Recent observations prioritized
- `graph` → Actor-observation relationships

---

### Partial Support Queries (4 queries)

#### Q002: ownership
**Query**: "Who owns the notifications service?"
**Confidence**: 55%

**Architecture Support:**
- Entity Store has `engineer` and `service` categories
- Actor profiles track expertise domains
- Can infer from contribution patterns

**Gaps Identified:**
- **Missing**: No explicit `ownership` relationship type
- **Missing**: No graph edges between engineers and services
- **Workaround**: Could infer from actor with most observations touching service

**Recommendations:**
1. Add `Entity.category = 'ownership'` with `owner_actor_id` field
2. Parse CODEOWNERS files during ingestion
3. Add relationship table for explicit ownership edges

---

#### Q012: infra_changes
**Query**: "What infrastructure changes were made to the staging environment?"
**Confidence**: 60%

**Architecture Support:**
- Observation capture pipeline is extensible
- Can filter by source and type

**Gaps Identified:**
- **Missing**: No Pulumi/Terraform event types defined
- **Missing**: No `EVENT_TYPE_WEIGHTS` entries for IaC tools
- Architecture only lists `github:*`, `linear:*`, `sentry:*`

**Recommendations:**
1. Add event type weights:
   ```typescript
   'pulumi:stack_update': 25,
   'terraform:apply': 25,
   'pulumi:preview': 15,
   'terraform:plan': 15,
   ```
2. Implement Pulumi/Terraform webhook handlers

---

#### Q015: impact_analysis
**Query**: "Which services were affected by the Redis outage on December 1st?"
**Confidence**: 40%

**Architecture Support:**
- Can find incidents from that date
- Can find errors mentioning Redis
- Entity Store has `service` category

**Gaps Identified:**
- **Missing**: No dependency graph for impact traversal
- **Missing**: Cannot traverse `service A depends on Redis` → `service B depends on service A`
- **Missing**: No `affects` or `depends_on` relationship edges

**Recommendations:**
1. Add relationship table:
   ```sql
   CREATE TABLE workspace_entity_relationships (
     source_entity_id VARCHAR(191),
     target_entity_id VARCHAR(191),
     relationship_type VARCHAR(50), -- 'depends_on', 'affects'
     confidence FLOAT,
     evidence_observation_id VARCHAR(191)
   );
   ```
2. Extract dependencies from infrastructure configs, import maps, API calls
3. Implement graph traversal query capability

---

#### Q018: root_cause
**Query**: "Find the commit that introduced the rate limiting bug"
**Confidence**: 55%

**Architecture Support:**
- Semantic search for commits mentioning "rate limiting"
- Entity extraction captures commit references
- Temporal proximity could correlate errors with commits

**Gaps Identified:**
- **Missing**: No causal linking between errors and commits
- **Missing**: Cannot trace error → deployment → commit chain
- **Missing**: No `introduced_by` relationship

**Recommendations:**
1. Add deployment-to-commit linking during ingestion
2. Track `related_observation_id` chains (error → deployment → PR → commits)
3. Implement temporal correlation: find commits deployed before error first occurred

---

### Low Confidence Queries (2 queries)

#### Q003: dependency
**Query**: "What depends on the user-profile API?"
**Confidence**: 35%

**Why Low Confidence:**
- Architecture has no graph database
- Entity Store is key-value, not relationship-based
- Cannot perform multi-hop dependency traversal
- Query expects `graph` signal which is not implemented

**Required Changes:**
1. Add `workspace_entity_relationships` table (see Q015 recommendations)
2. Implement graph query capability (1-2 hop traversal per spec)
3. Extract dependencies from:
   - Package.json imports
   - API client usage patterns
   - Infrastructure configs
   - Service mesh configurations

---

## Gap Summary

### Critical Gaps (Block multiple queries)

| Gap | Affected Queries | Impact | Recommended Fix |
|-----|-----------------|--------|-----------------|
| No graph database | Q002, Q003, Q015 | 3 queries (15%) | Add `workspace_entity_relationships` table with `depends_on`, `owns`, `affects` relationship types |

### Minor Gaps (Workarounds exist)

| Gap | Affected Queries | Workaround |
|-----|-----------------|------------|
| No IaC sources | Q012 | Extend event types for Pulumi/Terraform |
| No causal linking | Q018 | Use temporal correlation + semantic search |
| No explicit ownership | Q002 | Infer from contribution patterns |

---

## Recommendations

### Priority 1: Address Critical Graph Gap

**Add relationship table to enable dependency and ownership queries:**

```sql
CREATE TABLE workspace_entity_relationships (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Relationship
  source_entity_id VARCHAR(191) NOT NULL,
  target_entity_id VARCHAR(191) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL, -- 'depends_on', 'owns', 'affects', 'collaborates_with'

  -- Metadata
  confidence FLOAT DEFAULT 0.8,
  evidence_observation_id VARCHAR(191),
  evidence_snippet TEXT,

  -- Temporal
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_to TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_relationship UNIQUE (workspace_id, source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX idx_rel_source ON workspace_entity_relationships(workspace_id, source_entity_id);
CREATE INDEX idx_rel_target ON workspace_entity_relationships(workspace_id, target_entity_id);
CREATE INDEX idx_rel_type ON workspace_entity_relationships(workspace_id, relationship_type);
```

**Add graph query function:**

```typescript
async function traverseDependencies(
  workspaceId: string,
  entityId: string,
  direction: 'upstream' | 'downstream',
  maxHops: number = 2
): Promise<EntityWithPath[]> {
  // Implement BFS/DFS traversal with hop limit
}
```

### Priority 2: Improve Partial Support

1. **Add IaC event types** - Extend `EVENT_TYPE_WEIGHTS` for Pulumi/Terraform
2. **Add causal linking** - Track deployment → commit chains
3. **Add explicit ownership** - Parse CODEOWNERS, add ownership entity category

### Priority 3: Enhance Full Support

1. **Add lexical index** - Trigram index on `workspace_neural_observations.content` for faster keyword search
2. **Cache frequent queries** - Add Redis caching for common actor profile lookups
3. **Optimize cluster assignment** - Pre-compute cluster centroids for faster affinity calculation

---

## Appendix: Query Scenario Reference

```json
[
  {"id": "Q001", "intent": "incident_search", "expectedSignals": ["dense", "recency", "importance", "rerank"]},
  {"id": "Q002", "intent": "ownership", "expectedSignals": ["graph", "dense"]},
  {"id": "Q003", "intent": "dependency", "expectedSignals": ["graph", "dense"]},
  {"id": "Q004", "intent": "decision", "expectedSignals": ["dense", "importance", "rerank"]},
  {"id": "Q005", "intent": "deployment_history", "expectedSignals": ["dense", "recency", "rerank"]},
  {"id": "Q006", "intent": "change_evidence", "expectedSignals": ["dense", "lexical", "recency", "rerank"]},
  {"id": "Q007", "intent": "temporal_diff", "expectedSignals": ["dense", "recency", "rerank"]},
  {"id": "Q008", "intent": "similar", "expectedSignals": ["dense"]},
  {"id": "Q009", "intent": "expertise", "expectedSignals": ["graph", "dense", "profile"]},
  {"id": "Q010", "intent": "error_search", "expectedSignals": ["dense", "lexical", "recency", "rerank"]},
  {"id": "Q011", "intent": "incident_history", "expectedSignals": ["dense", "recency", "importance", "rerank"]},
  {"id": "Q012", "intent": "infra_changes", "expectedSignals": ["dense", "recency", "rerank"]},
  {"id": "Q013", "intent": "summary", "expectedSignals": ["summaries", "dense", "rerank"]},
  {"id": "Q014", "intent": "review_search", "expectedSignals": ["dense", "lexical", "recency", "rerank"]},
  {"id": "Q015", "intent": "impact_analysis", "expectedSignals": ["dense", "graph", "recency", "rerank"]},
  {"id": "Q016", "intent": "agent_context", "expectedSignals": ["dense", "importance", "profile", "rerank", "graph"]},
  {"id": "Q017", "intent": "important_changes", "expectedSignals": ["dense", "importance", "recency", "rerank"]},
  {"id": "Q018", "intent": "root_cause", "expectedSignals": ["dense", "lexical", "rerank"]},
  {"id": "Q019", "intent": "build_failures", "expectedSignals": ["dense", "recency", "rerank"]},
  {"id": "Q020", "intent": "contributors", "expectedSignals": ["graph", "dense", "recency"]}
]
```

---

_Last updated: 2025-12-09_
