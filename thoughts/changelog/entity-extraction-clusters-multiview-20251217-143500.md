---
title: 'Entity Extraction, Observation Clusters, Multi-View Embeddings'
slug: 0-3-lightfast-neural-memory
publishedAt: '2025-12-11'
excerpt: >-
  Neural Memory now automatically extracts entities from your development
  activity, groups related observations into topic clusters, and generates
  specialized embeddings for better search relevance. These features work
  together to make your team's knowledge more discoverable.
tldr: >-
  This release introduces three foundational Neural Memory capabilities. Entity
  Extraction automatically identifies engineers, projects, endpoints, and
  services mentioned in your development activity using both pattern matching
  and LLM-powered semantic extraction. Observation Clusters groups related
  events by topic using embedding similarity, entity overlap, and actor
  involvement. Multi-View Embeddings generates three specialized vectors per
  observation (title, content, summary) optimized for different query types,
  improving search relevance across broad and specific searches.
infrastructure:
  - >-
    Hybrid entity extraction pipeline combining regex patterns (0.70-0.95
    confidence) with GPT-powered semantic extraction for complex references
  - >-
    Four-signal cluster affinity scoring: embedding similarity (40pts), entity
    overlap (30pts), actor overlap (20pts), temporal proximity (10pts)
  - >-
    Pinecone-database hybrid storage with cluster centroids as searchable
    vectors and rich metadata in PostgreSQL
seo:
  metaDescription: >-
    Neural Memory - Entity extraction identifies @mentions and API endpoints.
    Observation clusters group events by topic. Multi-view embeddings improve
    search relevance. (155 chars)
  focusKeyword: neural memory entity extraction
  secondaryKeyword: observation clustering
  faq:
    - question: What is entity extraction in Neural Memory?
      answer: >-
        Entity extraction automatically identifies meaningful references in your
        development activity—@mentions of engineers, #issue references, API
        endpoints like POST /api/users, environment variables, file paths, and
        external services. Entities are tracked with occurrence counts and
        confidence scores.
    - question: How do observation clusters work?
      answer: >-
        Observation clusters automatically group related development events by
        topic. The system calculates affinity scores based on embedding
        similarity, shared entities, actor involvement, and timing. Events
        scoring 60+ points join existing clusters; others create new topic
        groups.
    - question: What are multi-view embeddings?
      answer: >-
        Multi-view embeddings generate three specialized vectors for each
        observation: title (broad discovery), content (detailed search), and
        summary (balanced retrieval). During search, all views are queried and
        deduplicated using max-score aggregation for optimal relevance.
_internal:
  status: published
  source_prs:
    - >-
      Manual input: Entity Extraction, Observation Clusters, Multi-View
      Embeddings
  generated: '2025-12-17T14:35:00Z'
  fact_checked_files:
    - 'api/console/src/inngest/workflow/neural/observation-capture.ts:711-986'
    - >-
      api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:18-120
    - 'api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:68-139'
    - 'api/console/src/inngest/workflow/neural/cluster-assignment.ts:48-312'
    - 'api/console/src/inngest/workflow/neural/cluster-summary.ts:51-318'
    - 'apps/console/src/lib/neural/cluster-search.ts:19-94'
    - 'apps/console/src/lib/neural/four-path-search.ts:72-210'
    - 'db/console/src/schema/tables/workspace-neural-entities.ts:26-165'
    - 'db/console/src/schema/tables/workspace-observation-clusters.ts:19-150'
    - 'db/console/src/schema/tables/workspace-neural-observations.ts:174-190'
    - 'packages/console-validation/src/schemas/entities.ts:9-17'
    - 'packages/console-validation/src/constants/embedding.ts:32-39'
    - 'packages/console-config/src/neural.ts:16-31'
  publishedAt: '2025-12-17T07:34:30.787Z'
---

**Entity Extraction, Observation Clusters, Multi-View Embeddings**

---

### Entity Extraction

Neural Memory now automatically identifies and tracks meaningful references in your development activity. The hybrid extraction pipeline combines fast regex patterns with LLM-powered semantic extraction to capture entities that would otherwise be missed.

**What's included:**

- **Seven entity categories**: engineers (@mentions), projects (#issues, ENG-123), API endpoints, environment variables, file paths, external services, and generic references
- **Dual extraction paths**: Regex patterns run inline during capture (0.70-0.95 confidence); LLM extraction runs async for content >200 characters
- **Automatic deduplication**: Entities are tracked by workspace with occurrence counts and "last seen" timestamps
- **Search integration**: Entity mentions boost search results via the four-path retrieval system

**Example entities extracted:**

```
@sarah-dev        → engineer (0.90 confidence)
#authentication   → project (0.95 confidence)
POST /api/users   → endpoint (0.95 confidence)
DATABASE_URL      → config (0.85 confidence)
src/lib/auth.ts   → definition (0.80 confidence)
```

**Limitations:**

- LLM extraction requires content >200 characters
- Confidence threshold of 0.65 filters low-confidence extractions
- Patterns optimized for English text
- API endpoint detection requires HTTP verb prefix (GET, POST, etc.)

---

### Observation Clusters

Related development events are now automatically grouped into topic clusters. Each observation is assigned to the most semantically similar cluster—or creates a new topic group if no good match exists.

**What's included:**

- **Four-signal affinity scoring**: Embedding similarity (40pts), entity overlap (30pts), actor overlap (20pts), temporal proximity (10pts)
- **60-point threshold**: Observations scoring 60+ join existing clusters; below that creates new clusters
- **Cluster context in search**: Topic labels and keywords are returned as context in search results
- **Automatic tracking**: Primary entities, actors, observation counts, and temporal bounds

**Affinity calculation:**

```typescript
// Maximum score: 100 points
embeddingSimilarity * 40    // Semantic relatedness
+ entityOverlap * 30        // Shared @mentions, #issues
+ actorMatch * 20           // Same contributor
+ temporalProximity * 10    // Recent activity (decays over 10 hours)
```

**Current status:**

Observation Clusters is in beta. Cluster assignment and search context are fully operational. LLM-generated cluster summaries are not yet available—observations are grouped but the summary generation pipeline requires a schema migration (Phase 5) to link observations to their assigned clusters.

**Why we built it this way:** We chose a multi-signal approach over pure embedding similarity because development context matters. A PR from the same author about the same feature should cluster together even if the semantic content differs slightly.

---

### Multi-View Embeddings

Every observation now generates three specialized embedding vectors, each optimized for different query types. This improves search relevance by matching the right content perspective to your search intent.

**The three views:**

| View | Text | Purpose |
|------|------|---------|
| Title | Event headline (≤120 chars) | Broad topic discovery |
| Content | Full body text | Detailed, specific queries |
| Summary | Title + first 1000 chars | Balanced retrieval |

**What's included:**

- **Cohere embed-english-v3.0**: 1024-dimensional vectors with input type optimization
- **Batch generation**: All three embeddings generated in a single API call
- **Smart deduplication**: Search queries all views; results deduplicated by max score
- **Cluster assignment**: Uses content embedding for best semantic matching

**Search behavior:**

```typescript
// All views are queried in parallel
const results = await pinecone.query({
  vector: queryEmbedding,
  filter: { layer: "observations" },
  topK: 50
});

// Deduplicate by observation, keeping max score
// If title matches at 0.85 and content at 0.72,
// the observation appears once with score 0.85
```

**Limitations:**

- Cohere provider only (no OpenAI or custom models)
- English language only
- Fixed 1024 dimensions (no dimension reduction for cost optimization)
- 3x vector storage per observation

---

### Resources

- [Search Documentation](/docs/features/search)
- [Neural Memory Overview](/docs/features/neural-memory)
- [API Reference](/docs/api-reference)
- [Configuration Guide](/docs/config)
