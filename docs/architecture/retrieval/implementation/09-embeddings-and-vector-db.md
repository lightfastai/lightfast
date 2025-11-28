---
title: Embeddings & Vector DB Integration
description: How neural memory uses Postgres, Pinecone, and LLMs together
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, embeddings, vector-db]
---

# Embeddings & Vector DB Integration

## The Complete Picture

Neural memory uses **three storage layers** working together:

```
┌─────────────────────────────────────────────────────┐
│ 1. Postgres (Metadata + Relationships)              │
│    - Observation metadata (title, type, actor)      │
│    - Temporal states                                │
│    - Actor identities                               │
│    - NO vectors (too slow for similarity search)    │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ 2. Pinecone (Vector Search)                         │
│    - 3 embedding views per observation              │
│    - Namespace per workspace + view                 │
│    - Fast similarity search (sub-100ms)             │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ 3. LLM (Processing)                                 │
│    - Significance evaluation                        │
│    - Classification                                 │
│    - Summary generation                             │
│    - Reranking at retrieval time                    │
└─────────────────────────────────────────────────────┘
```

## Ingestion Flow (Complete)

### Step-by-Step with All Systems

```typescript
export const observationCapture = inngest.createFunction(
  { id: "neural.observation.capture" },
  { event: "neural/observation.capture" },
  async ({ event, step }) => {
    const { sourceEvent, workspaceId } = event.data;

    // ┌─────────────────────────────────────┐
    // │ STEP 1: Significance (LLM)          │
    // └─────────────────────────────────────┘
    const significance = await step.run("evaluate-significance", async () => {
      // Use LLM to evaluate if event is significant
      const prompt = `Evaluate if this event is significant (0-100):

Event: ${sourceEvent.title}
${sourceEvent.body}

Consider:
- Impact on team/project
- Decision-making significance
- Technical complexity
- User impact

Return JSON: { "score": 75, "reasoning": "..." }`;

      const response = await llm.generate({
        model: 'claude-3-haiku',  // Cheap model for classification
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 200
      });

      return JSON.parse(response.content);
    });

    if (significance.score < 60) {
      return { skipped: true, reason: "Below threshold" };
    }

    // ┌─────────────────────────────────────┐
    // │ STEP 2: Classify (LLM)              │
    // └─────────────────────────────────────┘
    const classification = await step.run("classify-type", async () => {
      const prompt = `Classify this observation:

${sourceEvent.title}
${sourceEvent.body}

Types:
- decision: Major decision was made
- change: Code/system changed
- incident: Problem occurred
- highlight: Notable achievement

Return JSON: { "type": "decision", "confidence": 0.85 }`;

      const response = await llm.generate({
        model: 'claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 100
      });

      return JSON.parse(response.content);
    });

    // ┌─────────────────────────────────────┐
    // │ STEP 3: Generate Summary (LLM)      │
    // └─────────────────────────────────────┘
    const summary = await step.run("generate-summary", async () => {
      if (sourceEvent.body.length < 500) {
        return sourceEvent.body;  // Short enough, use as-is
      }

      const prompt = `Summarize in 2-3 sentences:

${sourceEvent.body}`;

      const response = await llm.generate({
        model: 'claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 150
      });

      return response.content;
    });

    // ┌─────────────────────────────────────┐
    // │ STEP 4: Create 3 Embeddings         │
    // └─────────────────────────────────────┘
    const embeddings = await step.run("generate-embeddings", async () => {
      // Generate all 3 views in parallel
      const [titleEmbed, contentEmbed, summaryEmbed] = await Promise.all([
        // View 1: Title (512 dim) - for high-level matching
        generateEmbedding(sourceEvent.title, {
          model: 'text-embedding-3-small',
          dimensions: 512
        }),

        // View 2: Content (1536 dim) - for detailed similarity
        generateEmbedding(sourceEvent.body, {
          model: 'text-embedding-3-large',
          dimensions: 1536
        }),

        // View 3: Summary (768 dim) - for conceptual matching
        generateEmbedding(summary, {
          model: 'text-embedding-3-small',
          dimensions: 768
        })
      ]);

      return { titleEmbed, contentEmbed, summaryEmbed };
    });

    // ┌─────────────────────────────────────┐
    // │ STEP 5: Store in Pinecone           │
    // └─────────────────────────────────────┘
    const observationId = generateObservationId();

    await step.run("store-embeddings-pinecone", async () => {
      await Promise.all([
        // Store title embedding
        pinecone.upsert({
          namespace: `${workspaceId}/neural/observations/title`,
          vectors: [{
            id: observationId,
            values: embeddings.titleEmbed.vector,
            metadata: {
              type: classification.type,
              actorId: sourceEvent.actor?.id,
              occurredAt: sourceEvent.occurredAt.toISOString(),
              significance: significance.score
            }
          }]
        }),

        // Store content embedding
        pinecone.upsert({
          namespace: `${workspaceId}/neural/observations/content`,
          vectors: [{
            id: observationId,
            values: embeddings.contentEmbed.vector,
            metadata: {
              type: classification.type,
              actorId: sourceEvent.actor?.id,
              occurredAt: sourceEvent.occurredAt.toISOString(),
              significance: significance.score
            }
          }]
        }),

        // Store summary embedding
        pinecone.upsert({
          namespace: `${workspaceId}/neural/observations/summary`,
          vectors: [{
            id: observationId,
            values: embeddings.summaryEmbed.vector,
            metadata: {
              type: classification.type,
              actorId: sourceEvent.actor?.id,
              occurredAt: sourceEvent.occurredAt.toISOString(),
              significance: significance.score
            }
          }]
        })
      ]);
    });

    // ┌─────────────────────────────────────┐
    // │ STEP 6: Store Metadata in Postgres  │
    // └─────────────────────────────────────┘
    const stored = await step.run("store-metadata-postgres", async () => {
      return await db.insert(workspaceNeuralObservations).values({
        id: observationId,
        workspaceId,

        // Content (stored in Postgres for display)
        title: sourceEvent.title,
        content: sourceEvent.body,
        summary: summary,

        // Classification
        type: classification.type,
        confidence: classification.confidence,
        significance: significance.score,

        // Actor
        actorType: sourceEvent.actor?.type ?? 'system',
        actorId: sourceEvent.actor?.id ?? null,
        actorName: sourceEvent.actor?.name ?? null,

        // Source
        sourceReferences: sourceEvent.references,

        // Embedding IDs (pointers to Pinecone)
        embeddingTitleId: `${workspaceId}/neural/observations/title/${observationId}`,
        embeddingContentId: `${workspaceId}/neural/observations/content/${observationId}`,
        embeddingSummaryId: `${workspaceId}/neural/observations/summary/${observationId}`,

        // Timestamps
        occurredAt: sourceEvent.occurredAt,
        createdAt: new Date(),
      }).returning();
    });

    return { success: true, observationId: stored.id };
  }
);
```

## Retrieval Flow (Complete)

### Neural Search with All Systems

```typescript
async function neuralSearch(req: SearchRequest): Promise<SearchResult[]> {
  const { query, workspace_id, limit = 20 } = req;

  // ┌─────────────────────────────────────┐
  // │ STEP 1: Generate Query Embedding    │
  // └─────────────────────────────────────┘
  const queryEmbedding = await generateEmbedding(query, {
    model: 'text-embedding-3-large',  // Use content model for query
    dimensions: 1536
  });

  // ┌─────────────────────────────────────┐
  // │ STEP 2: Vector Search in Pinecone   │
  // └─────────────────────────────────────┘
  const vectorResults = await pinecone.query({
    namespace: `${workspace_id}/neural/observations/content`,
    vector: queryEmbedding.vector,
    topK: 100,  // Over-fetch for reranking
    includeMetadata: true,
    filter: buildPineconeFilter(req.filters)  // e.g., date range
  });

  // ┌─────────────────────────────────────┐
  // │ STEP 3: Fetch Metadata from Postgres│
  // └─────────────────────────────────────┘
  const observationIds = vectorResults.matches.map(m => m.id);

  const observations = await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspace_id),
        inArray(workspaceNeuralObservations.id, observationIds)
      )
    );

  // Create map for easy lookup
  const obsMap = new Map(observations.map(o => [o.id, o]));

  // ┌─────────────────────────────────────┐
  // │ STEP 4: Combine Vector + Metadata   │
  // └─────────────────────────────────────┘
  const candidates = vectorResults.matches.map(match => {
    const obs = obsMap.get(match.id);
    if (!obs) return null;

    return {
      id: obs.id,
      type: 'observation' as const,
      title: obs.title,
      snippet: obs.content.slice(0, 200),
      source: 'neural_memory',
      timestamp: obs.occurredAt,
      actor: obs.actorName ? {
        name: obs.actorName,
        type: obs.actorType
      } : undefined,
      vectorScore: match.score,  // Pinecone similarity
      significance: obs.significance,
      content: obs.content  // Full content for reranking
    };
  }).filter(Boolean);

  // ┌─────────────────────────────────────┐
  // │ STEP 5: Rerank with Cross-Encoder   │
  // └─────────────────────────────────────┘
  const reranked = await rerankWithCrossEncoder(query, candidates);

  // ┌─────────────────────────────────────┐
  // │ STEP 6: Apply Fusion Scoring        │
  // └─────────────────────────────────────┘
  const scored = reranked.map(candidate => ({
    ...candidate,
    finalScore:
      0.4 * candidate.rerankScore +      // Reranker score (primary)
      0.3 * candidate.vectorScore +      // Vector similarity
      0.2 * calculateRecency(candidate.timestamp) +
      0.1 * (candidate.significance / 100)
  }));

  // Sort by final score and return top K
  return scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      snippet: r.snippet,
      source: r.source,
      timestamp: r.timestamp,
      actor: r.actor,
      score: r.finalScore
    }));
}
```

### Reranking with Cross-Encoder

```typescript
async function rerankWithCrossEncoder(
  query: string,
  candidates: SearchCandidate[]
): Promise<SearchCandidate[]> {
  // Use cross-encoder model for query-document relevance
  const pairs = candidates.map(c => ({
    query,
    document: `${c.title}\n\n${c.content}`
  }));

  const scores = await crossEncoder.predict(pairs);

  return candidates.map((c, i) => ({
    ...c,
    rerankScore: scores[i]
  }));
}

// Alternative: Use LLM as reranker
async function rerankWithLLM(
  query: string,
  candidates: SearchCandidate[]
): Promise<SearchCandidate[]> {
  const prompt = `Rank these observations by relevance to the query.

Query: "${query}"

Observations:
${candidates.map((c, i) => `${i + 1}. ${c.title}\n${c.content.slice(0, 300)}`).join('\n\n')}

Return JSON array of ranks: [3, 1, 5, 2, 4] (most relevant first)`;

  const response = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 200
  });

  const ranks = JSON.parse(response.content);

  return candidates.map((c, i) => ({
    ...c,
    rerankScore: 1 - (ranks[i] / candidates.length)  // Normalize to 0-1
  }));
}
```

## Pinecone Namespace Strategy

### Namespace Organization

```
{workspace_id}/neural/observations/title      # 512-dim embeddings
{workspace_id}/neural/observations/content    # 1536-dim embeddings
{workspace_id}/neural/observations/summary    # 768-dim embeddings
{workspace_id}/neural/summaries               # 768-dim embeddings
{workspace_id}/neural/profiles                # 1536-dim profile centroids
```

**Why separate namespaces?**
- Different dimensionality per view
- Allows searching specific views
- Better for debugging/monitoring
- Can upgrade models per namespace

### Metadata Stored in Pinecone

```typescript
interface PineconeMetadata {
  type: 'decision' | 'change' | 'incident' | 'highlight';
  actorId?: string;
  occurredAt: string;  // ISO timestamp
  significance: number;
  // Keep minimal - full data in Postgres
}
```

**Why minimal metadata?**
- Pinecone charges by metadata size
- Postgres is better for complex queries
- Only need filters for vector search

## LLM Usage Points

### 1. Significance Evaluation (Haiku - $0.0001)

```typescript
const significance = await llm.generate({
  model: 'claude-3-haiku',
  messages: [{
    role: 'user',
    content: `Evaluate significance (0-100): ${event.title}`
  }],
  maxTokens: 100
});
```

**Cost:** ~$0.0001 per observation

### 2. Classification (Haiku - $0.0001)

```typescript
const classification = await llm.generate({
  model: 'claude-3-haiku',
  messages: [{
    role: 'user',
    content: `Classify as decision/change/incident/highlight: ${event.title}`
  }],
  maxTokens: 50
});
```

**Cost:** ~$0.0001 per observation

### 3. Summary Generation (Haiku - $0.0002)

```typescript
const summary = await llm.generate({
  model: 'claude-3-haiku',
  messages: [{
    role: 'user',
    content: `Summarize in 2-3 sentences: ${event.body}`
  }],
  maxTokens: 150
});
```

**Cost:** ~$0.0002 per observation

### 4. Summary Synthesis (Sonnet - $0.01)

```typescript
const masterSummary = await llm.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{
    role: 'user',
    content: `Generate daily summary from ${observations.length} observations...`
  }],
  maxTokens: 500
});
```

**Cost:** ~$0.01 per daily summary

### 5. Reranking (Optional - Sonnet - $0.005)

```typescript
const reranked = await llm.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{
    role: 'user',
    content: `Rank these 10 results by relevance to query...`
  }],
  maxTokens: 100
});
```

**Cost:** ~$0.005 per search (only for complex queries)

## Total Cost Breakdown

### Per Observation Captured

```
Significance eval:  $0.0001
Classification:     $0.0001
Summary:            $0.0002
Embeddings (3):     $0.0009  (3 × $0.0003)
────────────────────────────
Total:              $0.0013 per observation
```

### Per 1000 Observations/Month

```
Capture cost:       $1.30
Daily summaries:    $0.30  (30 × $0.01)
────────────────────────────
Total:              $1.60/month for 1k observations
```

### Per Search Query

```
Query embedding:    $0.0003
Pinecone query:     $0.00001  (negligible)
Reranking (opt):    $0.005    (if using LLM)
────────────────────────────
Total:              $0.0003-$0.0053 per search
```

## Storage Breakdown

### Postgres (Metadata)

```typescript
interface ObservationRow {
  id: string;              // 36 bytes (UUID)
  title: string;           // ~100 bytes avg
  content: string;         // ~2000 bytes avg
  summary: string;         // ~200 bytes avg
  metadata: json;          // ~500 bytes avg
  // ... other fields      // ~200 bytes

  // Total: ~3KB per observation
}
```

**Cost:** ~$0.023/GB/month (PlanetScale)
- 1000 observations = 3MB = $0.0001/month

### Pinecone (Vectors)

```typescript
// 3 embeddings per observation
Title:   512 dims × 4 bytes = 2KB
Content: 1536 dims × 4 bytes = 6KB
Summary: 768 dims × 4 bytes = 3KB

Total: 11KB per observation
```

**Cost:** ~$0.096/GB/month (Pinecone serverless)
- 1000 observations = 11MB = $0.001/month

## Hybrid Search Example

### Combining Knowledge + Neural

```typescript
async function hybridSearch(req: SearchRequest): Promise<SearchResult[]> {
  // Run both searches in parallel
  const [knowledgeResults, neuralResults] = await Promise.all([
    knowledgeSearch(req),  // Documents + chunks
    neuralSearch(req)      // Observations + summaries
  ]);

  // Fusion rank
  return fusionRank(knowledgeResults, neuralResults, {
    weights: {
      knowledge: 0.35,
      neural: 0.25,
      temporal: 0.15,
      actor: 0.15,
      importance: 0.10
    }
  });
}
```

## Complete Architecture Diagram

```
┌──────────────┐
│ Source Event │
└──────┬───────┘
       │
       ↓
┌──────────────────────────┐
│ Significance (LLM)       │  ← Haiku ($0.0001)
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│ Classification (LLM)     │  ← Haiku ($0.0001)
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│ Summary (LLM)            │  ← Haiku ($0.0002)
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│ Generate 3 Embeddings    │  ← OpenAI ($0.0009)
└──────┬───────────────────┘
       │
       ├─────────────────────────┐
       ↓                         ↓
┌──────────────┐        ┌──────────────┐
│  Pinecone    │        │  Postgres    │
│  (vectors)   │        │  (metadata)  │
└──────────────┘        └──────────────┘
       │                         │
       └────────┬────────────────┘
                │
                ↓
        ┌───────────────┐
        │ Search Query  │
        └───────┬───────┘
                │
                ↓
        ┌───────────────────────┐
        │ Query Embedding       │  ← OpenAI ($0.0003)
        └───────┬───────────────┘
                │
                ↓
        ┌───────────────────────┐
        │ Vector Search         │  ← Pinecone ($0.00001)
        │ (top 100)             │
        └───────┬───────────────┘
                │
                ↓
        ┌───────────────────────┐
        │ Fetch from Postgres   │
        └───────┬───────────────┘
                │
                ↓
        ┌───────────────────────┐
        │ Rerank (Cross-Encoder)│  ← Optional LLM ($0.005)
        └───────┬───────────────┘
                │
                ↓
        ┌───────────────────────┐
        │ Fusion with Knowledge │
        └───────┬───────────────┘
                │
                ↓
        ┌───────────────────────┐
        │ Return Results        │
        └───────────────────────┘
```

---

_Last updated: 2025-11-27_
