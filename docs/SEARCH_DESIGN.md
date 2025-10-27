# Search & Retrieval Design (2025 Refresh)

> Target: <90 ms p95 for identifier queries, <150 ms p95 for semantic queries while maintaining high recall across chunked knowledge documents.

Terminology: The chunked retrieval layer is the Knowledge Store. The Memory Graph (entities/relationships/beliefs) can bias retrieval and support graph-first queries; see `docs/MEMORY_GRAPH_DESIGN.md`.

---

## Pipeline Overview

```
User Query → Query Processor → Hybrid Retrieval → Rerank (conditional) → Hydrate & Compose
```

1. **Query processor** parses syntax (`#123`, `type:issue`, `from:github`), builds lexical + vector intents, and selects embedding model.
2. **Hybrid retrieval** executes lexical search (Postgres full-text or Meilisearch) and Pinecone dense+sparse search over chunks.
3. **Rerank** uses Cohere Rerank (`rerank-v3.5` primary, `rerank-3-nimble` fallback) when semantic mode is enabled and candidate count exceeds threshold.
4. **Hydration** fetches chunk + document details from Redis (fallback to PlanetScale) and prepares highlights/snippets.

---

## Query Processing

```typescript
interface RetrievalQuery {
  workspaceId: string;
  text: string;
  filters?: RetrievalFilters;
  mode?: 'auto' | 'semantic' | 'identifier';
  limit?: number;    // default 20
}

interface RetrievalFilters {
  sources?: MemorySource[];
  types?: MemoryType[];
  authors?: string[];
  states?: string[];
  after?: Date;
  before?: Date;
  labels?: string[];
}

interface ProcessedQuery {
  cleanText: string;
  lexicalTerms: LexicalRequest;
  embeddingRequest?: EmbeddingRequest;
  metadataFilter: PineconeFilter;
  rerank: boolean;
}
```

Rules:
- If the query is a short identifier (`#123`, `LINEAR-ABC-12`, `notion:xyz`), switch to `identifier` mode → direct SQL lookup, no embedding.
- Otherwise generate embeddings with the current workspace-specific model (Voyage large or Cohere embed-v3) and optionally produce sparse vectors.
- Always set Cohere `inputType` correctly: `search_query` for queries, `search_document` for chunks.
- Parse and remove syntax tokens before sending to the embedder.

```typescript
export async function embedQuery(text: string, model: string) {
  return cohere.embed({
    texts: [text],
    model,
    inputType: 'search_query',
  });
}

export async function embedChunk(text: string, model: string) {
  return cohere.embed({
    texts: [text],
    model,
    inputType: 'search_document',
  });
}
```

---

## Lexical Layer

Implementation options:
- PostgreSQL full-text search on `knowledge_chunks.text` (GIN index) filtered by workspace.
- Or dedicated Meilisearch/OpenSearch index for large-scale deployments.

```typescript
async function lexicalSearch(request: LexicalRequest): Promise<LexicalCandidate[]> {
  return await db.$queryRaw`SELECT chunk_id, ts_rank_cd(search_vector, plainto_tsquery(${request.tsQuery})) AS score
                             FROM chunk_fts
                             WHERE workspace_id = ${request.workspaceId}
                               AND search_vector @@ plainto_tsquery(${request.tsQuery})
                             ORDER BY score DESC
                             LIMIT ${request.topK}`;
}
```

Lexical results seed candidate list and provide high-precision hits for keyword heavy queries.

---

## Dense + Sparse Retrieval (Pinecone)

```typescript
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

async function vectorSearch(request: EmbeddingRequest): Promise<VectorCandidate[]> {
  const namespace = `${request.workspaceId}-${request.embeddingVersion}`;

  return await pinecone.index('lightfast-chunks').namespace(namespace).query({
    vector: request.values,
    sparseVector: request.sparse,
    filter: request.metadataFilter,
    topK: request.topK ?? 50, // default to 50 for Cohere rerank stage
    includeMetadata: true,
  });
}
```

Metadata filter contains workspace ID, optional sources/types/states, and time bounds (`createdAt` range). Pinecone metadata stays under 1 KB.

---

## Candidate Fusion & Rerank

```typescript
function fuseCandidates(lexical: LexicalCandidate[], vector: VectorCandidate[]): Candidate[] {
  const merged = new Map<string, Candidate>();

  const boost = (id: string, score: number, reason: 'lexical' | 'vector', payload: CandidatePayload) => {
    const existing = merged.get(id) ?? { ...payload, score: 0, contributions: [] };
    merged.set(id, {
      ...existing,
      score: existing.score + score,
      contributions: [...existing.contributions, { reason, score }],
    });
  };

  lexical.forEach((hit) => boost(hit.chunkId, hit.score * LEXICAL_WEIGHT, 'lexical', hit.payload));
  vector.forEach((hit) => boost(hit.id, hit.score * VECTOR_WEIGHT, 'vector', hit.payload));

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, FUSED_TOP_K);
}
```

If `rerank === true` and candidate count > `RERANK_MIN_K` (default 20), call Cohere Rerank with the top 50 fused candidates and request `topN = 5` for UI display or `topN = 10` when composing LLM prompts. Stick to `rerank-v3.5` for multilingual coverage and fall back to `rerank-3-nimble` when the latency budget is tight. Maintain a per-workspace relevance threshold calibrated via Braintrust regression suites (sample 30–50 borderline query/document pairs and average their scores) to drop low-score results.

---

## Hydration & Highlighting

```typescript
async function hydrateCandidates(candidates: Candidate[]): Promise<RankedResult[]> {
  const chunkIds = candidates.map((c) => c.chunkId);
  const chunks = await getChunksWithCache(chunkIds);
  const documents = await getDocumentsWithCache(chunks.map((c) => c.documentId));

  return candidates.map((candidate) => {
    const chunk = chunksById[candidate.chunkId];
    const doc = documentsById[chunk.documentId];
    const highlight = buildHighlight(candidate, chunk, doc);

    return {
      documentId: doc.id,
      chunkId: chunk.id,
      score: candidate.score,
      title: doc.title,
      type: doc.type,
      source: doc.source,
      occurredAt: doc.occurredAt,
      author: doc.author,
      sectionLabel: chunk.sectionLabel,
      highlight,
    };
  });
}
```

`getChunksWithCache` attempts Redis (`chunks:{documentId}:v{version}`) before PlanetScale. Cache misses log metrics for observability.

Highlights are generated via keyword matches or windowing around the matched tokens (for lexical hits) and via Cohere highlight API for semantic matches.

---

## Response Assembly

- Return `RankedResult[]` to the UI, grouped by document with top chunks collapsed.
- For answer generation, the orchestrator fetches the full chunk texts in the requested order and builds the LLM prompt.

```typescript
interface SearchResponse {
  results: RankedResult[];
  totalCandidates: number;
  latency: {
    totalMs: number;
    lexicalMs: number;
    vectorMs: number;
    rerankMs: number;
    hydrationMs: number;
  };
}
```

Latency metrics feed `retrieval_logs` for dashboards and SLO monitoring.

---

## Monitoring & Offline Evaluation

- Log every query to `retrieval_logs` (query text, filters, candidate IDs, latencies, rerank flag, rerank threshold used).
- Braintrust suites run weekly/regression triggers to evaluate recall@k, hit rate of known answers, rerank score calibration, and snippet quality (playbook in `docs/EVALUATION_PLAYBOOK.md`).
- Drift detection compares score distributions and embedding similarity between model versions; alerts when deltas exceed thresholds.

---

## Future Enhancements

- Add personalized re-ranking based on user interaction data (clicks, thumbs up/down).
- Integrate conversation-aware retrieval to bias towards recent conversational context.
- Explore hierarchical graph retrieval (GraphRAG) for complex multi-hop queries.

---

_Last reviewed: 2025-02-10_
