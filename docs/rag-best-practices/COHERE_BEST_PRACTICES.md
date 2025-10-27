# Cohere Best Practices for Lightfast

**Last Updated:** 2025-01-27

This document provides comprehensive best practices for implementing Cohere's embeddings and reranking capabilities within Lightfast's memory infrastructure, based on official documentation, case studies, and production benchmarks.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Reranking Best Practices](#reranking-best-practices)
3. [Embedding Strategies](#embedding-strategies)
4. [Hybrid Search Patterns](#hybrid-search-patterns)
5. [Production Optimization](#production-optimization)
6. [RAG-Specific Insights](#rag-specific-insights)
7. [Cost Optimization](#cost-optimization)
8. [Lightfast Implementation Recommendations](#lightfast-implementation-recommendations)
9. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Executive Summary

### Key Findings

**Reranking is Essential:** Adding Cohere Rerank to retrieval pipelines improves accuracy by 20-35% with only 200-500ms additional latency. For Lightfast's memory search use case, this accuracy gain is worth the latency cost.

**Model Selection:**
- **Embeddings:** Use Cohere Embed v3 for text-only content. Consider v4 only if multimodal support (images, PDFs) is required.
- **Reranking:** Use `rerank-v3.5` (multilingual) for production. It combines best performance with broad language support.

**Cost-Performance Sweet Spot:**
- Retrieve 50-75 candidates initially
- Rerank down to 5-10 documents for final results
- This maximizes recall while controlling costs

**Critical Architecture Pattern:**
1. First stage: Vector search (Pinecone) retrieves 50 candidates
2. Second stage: Cohere Rerank reorders to top 5-10
3. Third stage: Present top results or pass to LLM for synthesis

---

## Reranking Best Practices

### Model Selection

**Recommended:** `rerank-v3.5`
- Multilingual support (100+ languages) in single model
- 2-3x lower latency than Rerank 2
- Enhanced reasoning for complex queries
- Handles structured data (JSON, tables, code)

**Alternative:** `rerank-english-v3.0`
- English-only optimization
- Slightly better English performance
- Use only if exclusively English content

**For Speed:** `rerank-3-nimble`
- Faster inference with maintained accuracy
- Production-optimized for low-latency scenarios

### Optimal Candidate Count

**Research Findings:**
- **Retrieve 50-75 documents** for reranking to maximize NDCG@10
- Beyond 100 candidates, quality plateaus while costs increase linearly
- Minimum 20 candidates to ensure relevant items are captured

**Lightfast Recommendation:**
```typescript
// First stage retrieval
const vectorResults = await pinecone.query({
  topK: 50, // Retrieve 50 candidates
  includeMetadata: true,
});

// Second stage reranking
const reranked = await cohere.rerank({
  model: 'rerank-v3.5',
  query: userQuery,
  documents: vectorResults,
  topN: 5, // Return top 5 for display or LLM
});
```

### Relevance Score Thresholds

Cohere recommends this process for determining score thresholds:

1. Select 30-50 representative queries from your domain
2. For each query, provide a borderline relevant document
3. Create pairs: `[(query_1, doc_1), ..., (query_n, doc_n)]`
4. Pass all pairs through rerank endpoint
5. Average the scores to establish threshold

**Example for Lightfast:**
```typescript
// Sample queries for company memory search
const sampleQueries = [
  { query: "auth refactor discussion", borderlineDoc: "PR mentioning auth in passing" },
  { query: "mobile redesign feedback", borderlineDoc: "Discord message about mobile but off-topic" },
  // ... 30-50 more pairs
];

const scores = await Promise.all(
  sampleQueries.map(async ({ query, borderlineDoc }) => {
    const result = await cohere.rerank({
      query,
      documents: [borderlineDoc],
      model: 'rerank-v3.5',
    });
    return result.results[0].relevanceScore;
  })
);

const threshold = scores.reduce((a, b) => a + b) / scores.length;
// Use this threshold to filter out low-relevance results
```

### Token and Context Limits

**Context Length:** 4096 tokens total
- Query: Up to 2048 tokens
- Document: Up to 2048 tokens
- Query + document combined cannot exceed 4096 tokens

**Automatic Chunking:**
- Rerank automatically chunks documents >4096 tokens
- Chunks are 4093 tokens each
- Final score is the highest score among chunks

**Recommendation:**
```typescript
// Pre-chunk documents for better control
function chunkDocument(doc: string, maxTokens = 2000): string[] {
  // Leave buffer for query tokens
  // Chunk on semantic boundaries (paragraphs, sentences)
  // Return array of chunks
}

// Rerank each chunk separately
const allChunks = documents.flatMap(doc =>
  chunkDocument(doc.content).map(chunk => ({
    ...doc,
    content: chunk,
  }))
);

const reranked = await cohere.rerank({
  query: userQuery,
  documents: allChunks,
  topN: 10,
});
```

### Structured Data Support

Rerank v3.5 supports JSON, YAML, tables, code, and emails.

**Use `rank_fields` parameter:**
```typescript
// For GitHub issues
const issues = [
  { title: "Auth bug", body: "Users can't log in...", labels: ["bug", "auth"] },
  // ... more issues
];

const reranked = await cohere.rerank({
  query: "login problems",
  documents: issues,
  rankFields: ["title", "body"], // Ignore labels in ranking
  topN: 5,
});
```

**For Discord/Slack messages:**
```typescript
const messages = [
  { author: "alice", content: "We should refactor auth...", channel: "engineering" },
  // ... more messages
];

const reranked = await cohere.rerank({
  query: "auth refactor discussion",
  documents: messages,
  rankFields: ["content"], // Focus on message content
  topN: 5,
});
```

### Performance Characteristics

**Latency:**
- Rerank v3: 2x lower latency than Rerank 2 for short docs
- Rerank v3: 3x lower latency for long context (>2K tokens)
- Typical range: 200-500ms for 50 documents

**Accuracy Impact:**
- 20-35% improvement over pure vector search
- 8-11% improvement when reranking BM25 or ColBERT results
- 90%+ accuracy with hybrid search + reranking

**Production Benchmark (Oracle):**
- Tested: 1, 2, 4, 8, 24, 48, 96 documents
- Token lengths: 512, 1024, 2048, 4096
- Linear scaling for document count

---

## Embedding Strategies

### Model Selection

**For Lightfast (Text-only):** `embed-english-v3.0`
- 1024 dimensions
- Optimized for English text
- Best cost-performance ratio for text search
- No re-embedding needed if upgrading from v3 to v3 with images

**If Multilingual Needed:** `embed-multilingual-v3.0`
- 1024 dimensions
- 100+ languages supported
- Slightly lower English performance vs English-only model

**Future (Multimodal):** `embed-v4.0`
- 1536 dimensions (default), supports 256/512/1024 via Matryoshka
- Supports text + images in single embedding
- Best overall accuracy
- Use when indexing PDFs, screenshots, diagrams

### Input Type Optimization

**Critical:** Always specify `input_type` for optimal embeddings.

```typescript
// When indexing documents
const docEmbeddings = await cohere.embed({
  texts: documents,
  model: 'embed-english-v3.0',
  inputType: 'search_document', // For corpus documents
});

// When embedding search queries
const queryEmbedding = await cohere.embed({
  texts: [userQuery],
  model: 'embed-english-v3.0',
  inputType: 'search_query', // For search queries
});

// For classification tasks
const classificationEmbeddings = await cohere.embed({
  texts: texts,
  model: 'embed-english-v3.0',
  inputType: 'classification',
});
```

### Embedding Compression

**Storage Cost Reduction:** Compress embeddings by up to 96% without significant quality loss.

```typescript
// Option 1: int8 compression (balanced)
const embeddings = await cohere.embed({
  texts: documents,
  model: 'embed-english-v3.0',
  inputType: 'search_document',
  embeddingTypes: ['int8'], // 8x compression
});

// Option 2: binary compression (maximum compression)
const embeddings = await cohere.embed({
  texts: documents,
  model: 'embed-english-v3.0',
  inputType: 'search_document',
  embeddingTypes: ['ubinary'], // 32x compression
});

// Option 3: Matryoshka embeddings (embed-v4.0 only)
const embeddings = await cohere.embed({
  texts: documents,
  model: 'embed-v4.0',
  inputType: 'search_document',
  outputDimension: 512, // Instead of default 1536
});
```

**Lightfast Recommendation:**
- Use float embeddings for production initially
- Evaluate int8 for cost optimization once at scale (>10M embeddings)
- Test accuracy degradation on representative queries before switching

### Batch Processing

**For Large Corpora:** Use Embed Jobs API for 100K+ documents.

```typescript
// Small batches (<100K docs): Regular Embed API
const embeddings = await cohere.embed({
  texts: documents,
  model: 'embed-english-v3.0',
  inputType: 'search_document',
  // Max 96 texts per batch
});

// Large batches (>100K docs): Embed Jobs API
const job = await cohere.embedJobs.create({
  datasetId: 'dataset_id', // Upload via Datasets API first
  model: 'embed-english-v3.0',
  inputType: 'search_document',
});

// Poll for completion
const result = await cohere.embedJobs.get(job.id);
// Results stored in hosted Dataset
```

**Benefits of Embed Jobs:**
- Validates data format automatically
- Optimizes batching internally
- Stores results in hosted Dataset (no local storage needed)
- Better suited for periodic full re-indexing

**Lightfast Strategy:**
- **Real-time sync:** Regular Embed API for new documents (webhooks)
- **Historical backfill:** Embed Jobs API for initial GitHub/Discord history
- **Periodic re-indexing:** Embed Jobs API for full corpus refresh

---

## Hybrid Search Patterns

### Pinecone + Cohere Integration

**Architecture:**
```
User Query
    ↓
1. Embed query with Cohere (input_type='search_query')
    ↓
2. Vector search in Pinecone (dense + sparse)
    ↓
3. Rerank results with Cohere
    ↓
4. Return top N results
```

**Implementation:**
```typescript
async function hybridSearch(query: string) {
  // Step 1: Generate dense embedding
  const denseEmbedding = await cohere.embed({
    texts: [query],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  // Step 2: Generate sparse embedding (BM25)
  const sparseEmbedding = generateBM25Embedding(query);

  // Step 3: Hybrid search in Pinecone
  const results = await pinecone.query({
    vector: denseEmbedding.embeddings[0],
    sparseVector: sparseEmbedding,
    topK: 50,
    includeMetadata: true,
  });

  // Step 4: Rerank with Cohere
  const reranked = await cohere.rerank({
    query: query,
    documents: results.matches.map(m => m.metadata.text),
    model: 'rerank-v3.5',
    topN: 5,
  });

  return reranked.results;
}
```

### Pinecone Index Configuration

**For Hybrid Search:**
```typescript
await pinecone.createIndex({
  name: 'lightfast-memory',
  dimension: 1024, // embed-english-v3.0
  metric: 'dotproduct', // Required for sparse vectors
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1',
    },
  },
});
```

**Important:**
- Use `dotproduct` metric (required for sparse vector support)
- Dimension must match Cohere model (1024 for v3, 1536 for v4)

### Alpha Parameter Tuning

**Alpha controls dense vs sparse weighting:**
- `alpha = 1.0`: Pure dense (semantic) search
- `alpha = 0.5`: Balanced hybrid search (default)
- `alpha = 0.0`: Pure sparse (keyword) search

**Recommendation for Lightfast:**
```typescript
// For semantic queries ("show me discussions about auth")
const alpha = 0.7; // Favor semantic understanding

// For exact matches ("find PR #127")
const alpha = 0.3; // Favor keyword matching

// For general search
const alpha = 0.5; // Balanced
```

### Sparse Vector Generation

**BM25 for Out-of-Domain Tasks:**

Research shows BM25 outperforms SPLADE for out-of-domain queries. For Lightfast (company-specific memory), BM25 is recommended.

```typescript
import { BM25 } from 'bm25';

// Initialize BM25 with corpus
const bm25 = new BM25(documents);

// Generate sparse vector for query
function generateBM25Embedding(query: string) {
  const scores = bm25.score(query);
  // Convert to sparse format
  return {
    indices: scores.map((_, i) => i).filter(i => scores[i] > 0),
    values: scores.filter(s => s > 0),
  };
}
```

---

## Production Optimization

### API Rate Limits

**Trial Keys:**
- Chat: 20/min
- Embed: 100/min
- Rerank: 10/min
- **Total:** 1,000 calls/month

**Production Keys:**
- Chat: 500/min
- Embed: 2,000/min
- Embed (Images): 400/min
- Rerank: 1,000/min
- **Total:** Unlimited monthly

**Lightfast Needs:**
- Launch with production key immediately
- Expected load: 100-500 embed calls/day, 50-200 rerank calls/day
- Well within production limits

### Retry Strategy

**Exponential Backoff with Jitter:**
```typescript
async function callCohereWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (400-499)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage
const embeddings = await callCohereWithRetry(() =>
  cohere.embed({
    texts: documents,
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  })
);
```

### Caching Strategies

**1. Embedding Cache:**
```typescript
// Cache embeddings to avoid re-embedding same content
interface EmbeddingCache {
  get(text: string): Promise<number[] | null>;
  set(text: string, embedding: number[]): Promise<void>;
}

async function getOrCreateEmbedding(
  text: string,
  cache: EmbeddingCache
): Promise<number[]> {
  // Check cache first
  const cached = await cache.get(text);
  if (cached) return cached;

  // Generate and cache
  const result = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });

  const embedding = result.embeddings[0];
  await cache.set(text, embedding);
  return embedding;
}
```

**2. Semantic Query Cache:**
```typescript
// Cache rerank results for similar queries
interface QueryCache {
  findSimilar(query: string): Promise<CachedResult | null>;
  set(query: string, results: any[]): Promise<void>;
}

async function searchWithCache(
  query: string,
  cache: QueryCache
): Promise<any[]> {
  // Check for semantically similar cached query
  const cached = await cache.findSimilar(query);
  if (cached && cached.similarity > 0.95) {
    return cached.results;
  }

  // Perform search and cache
  const results = await performSearch(query);
  await cache.set(query, results);
  return results;
}
```

**Lightfast Recommendation:**
- **Embedding Cache:** Redis with text hash as key
- **TTL:** Indefinite (embeddings don't change)
- **Eviction:** LRU when memory constrained
- **Query Cache:** Not recommended initially (queries are unique to user context)

### Monitoring and Observability

**Metrics to Track:**
```typescript
interface CohereMetrics {
  // Latency
  embedLatencyP50: number;
  embedLatencyP95: number;
  embedLatencyP99: number;
  rerankLatencyP50: number;
  rerankLatencyP95: number;
  rerankLatencyP99: number;

  // Volume
  embedCallsPerMinute: number;
  rerankCallsPerMinute: number;
  tokensProcessed: number;

  // Errors
  embedErrorRate: number;
  rerankErrorRate: number;
  rateLimitHits: number;

  // Quality
  averageRelevanceScore: number;
  lowScoreQueryCount: number; // Queries with all results < threshold
}
```

**Alert Thresholds:**
- Latency p95 > 1000ms: Investigate slow queries
- Error rate > 1%: Check API status or credentials
- Rate limit hits > 0: Upgrade plan or optimize batching
- Low score queries > 10%: Review query understanding

---

## RAG-Specific Insights

### Chunking Strategies

**Core Principle:** Balance context preservation with retrieval precision.

**Recommendations:**
- **Small chunks:** More precise retrieval, less context
- **Large chunks:** More context, less precise
- **Optimal:** 400-600 tokens per chunk with 50-100 token overlap

**For Lightfast Content Types:**

**GitHub Issues/PRs:**
```typescript
// Don't chunk - index as whole documents
// They're naturally scoped and self-contained
const documents = issues.map(issue => ({
  id: issue.id,
  text: `${issue.title}\n\n${issue.body}`,
  metadata: {
    type: 'github_issue',
    repo: issue.repo,
    author: issue.author,
    created: issue.created_at,
  },
}));
```

**Discord/Slack Messages:**
```typescript
// Chunk by conversation thread
// Preserve message context within thread
function chunkThread(messages: Message[]): Document[] {
  const chunks: Document[] = [];
  let currentChunk: Message[] = [];
  let currentTokens = 0;

  for (const msg of messages) {
    const tokens = estimateTokens(msg.content);

    if (currentTokens + tokens > 500) {
      // Start new chunk
      chunks.push(createDocument(currentChunk));
      currentChunk = [msg];
      currentTokens = tokens;
    } else {
      currentChunk.push(msg);
      currentTokens += tokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(createDocument(currentChunk));
  }

  return chunks;
}
```

**Notion Pages:**
```typescript
// Chunk by section/heading
// Use semantic boundaries
function chunkNotionPage(page: NotionPage): Document[] {
  const sections = extractSections(page); // Split on headings

  return sections.map(section => ({
    id: `${page.id}-${section.heading}`,
    text: `${section.heading}\n\n${section.content}`,
    metadata: {
      type: 'notion_page',
      pageTitle: page.title,
      section: section.heading,
      url: page.url,
    },
  }));
}
```

### Multi-Stage Retrieval

**For Large Document Stores:**

```typescript
async function multiStageRetrieval(query: string) {
  // Stage 1: Retrieve 100 sentence-level chunks
  const sentenceResults = await pinecone.query({
    vector: await embedQuery(query),
    topK: 100,
    filter: { chunkType: 'sentence' },
  });

  // Stage 2: Get parent documents (paragraphs/sections)
  const parentDocs = await fetchParentDocuments(sentenceResults);

  // Stage 3: Rerank parent documents
  const reranked = await cohere.rerank({
    query: query,
    documents: parentDocs,
    topN: 5,
  });

  return reranked.results;
}
```

**Benefits:**
- Specificity from sentence-level retrieval
- Context from paragraph-level reranking
- Balance between precision and recall

### Citation Support

Cohere models (Command-R) generate fine-grained citations automatically when used for RAG answer generation.

**Integration Pattern:**
```typescript
async function answerQuestion(query: string) {
  // Retrieve and rerank documents
  const docs = await searchAndRerank(query);

  // Generate answer with citations
  const response = await cohere.chat({
    model: 'command-r',
    message: query,
    documents: docs.map(d => ({
      id: d.id,
      text: d.text,
    })),
  });

  // response.citations contains specific spans
  return {
    answer: response.text,
    citations: response.citations, // [{ start, end, documentIds }]
    sources: docs,
  };
}
```

### Evaluation Metrics

**Track These Metrics:**

**Retrieval Metrics:**
- **Precision@K:** % of retrieved docs that are relevant
- **Recall@K:** % of relevant docs that are retrieved
- **NDCG@10:** Ranking quality (accounts for position)
- **MRR:** Position of first relevant result

**Answer Quality (if using RAG for answers):**
- **Faithfulness:** Answer supported by retrieved docs
- **Relevance:** Answer addresses the query
- **Citation Accuracy:** Citations point to correct sources

**Implementation:**
```typescript
interface SearchMetrics {
  // Per query
  precision: number; // relevant_retrieved / total_retrieved
  recall: number;    // relevant_retrieved / total_relevant
  ndcg: number;      // Normalized DCG score
  mrr: number;       // 1 / rank_of_first_relevant

  // Aggregated
  avgPrecision: number;
  avgRecall: number;
  avgNDCG: number;
  avgMRR: number;
}

// Evaluate on golden dataset
async function evaluateSearch(testCases: TestCase[]) {
  const metrics: SearchMetrics[] = [];

  for (const test of testCases) {
    const results = await search(test.query);
    const relevant = new Set(test.relevantDocs);

    const precision = results.filter(r => relevant.has(r.id)).length / results.length;
    const recall = results.filter(r => relevant.has(r.id)).length / relevant.size;
    // ... calculate NDCG, MRR

    metrics.push({ precision, recall, ndcg, mrr });
  }

  return aggregateMetrics(metrics);
}
```

---

## Cost Optimization

### Pricing Overview

**Embeddings:**
- Embed v3: $0.10 per 1M tokens
- Embed v4: Higher cost (exact pricing varies by platform)

**Reranking:**
- Rerank v3.5: Based on number of documents and tokens
- Typical: $1-2 per 1,000 rerank requests (50 docs each)

### Cost Reduction Strategies

**1. Optimize Retrieval Count**

**Problem:** Reranking 100 docs when only 5 are needed wastes money.

**Solution:**
```typescript
// Bad: Retrieve and rerank 100 docs
const results = await pinecone.query({ topK: 100 });
const reranked = await cohere.rerank({ documents: results, topN: 5 });

// Good: Retrieve 50, rerank to 5
const results = await pinecone.query({ topK: 50 });
const reranked = await cohere.rerank({ documents: results, topN: 5 });

// Cost reduction: 50% fewer docs to rerank
```

**2. Cache Embeddings Aggressively**

```typescript
// Never re-embed the same content
// Use content hash as cache key
import { createHash } from 'crypto';

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function embedWithCache(text: string) {
  const hash = contentHash(text);
  const cached = await redis.get(`embed:${hash}`);

  if (cached) {
    return JSON.parse(cached);
  }

  const embedding = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });

  await redis.set(`embed:${hash}`, JSON.stringify(embedding.embeddings[0]));
  return embedding.embeddings[0];
}
```

**3. Batch API Calls**

```typescript
// Bad: 100 individual embed calls
for (const doc of documents) {
  await cohere.embed({ texts: [doc.text] });
}

// Good: 2 batched calls (max 96 per batch)
const batches = chunk(documents, 96);
for (const batch of batches) {
  await cohere.embed({ texts: batch.map(d => d.text) });
}

// Cost reduction: API overhead eliminated
```

**4. Use Compression for Storage**

```typescript
// int8 compression: 8x storage reduction
// Minimal accuracy loss for most use cases
const embeddings = await cohere.embed({
  texts: documents,
  model: 'embed-english-v3.0',
  inputType: 'search_document',
  embeddingTypes: ['int8'],
});

// Storage cost: 1024 floats (4KB) → 1024 int8s (1KB)
```

### Cost Estimation for Lightfast

**Assumptions:**
- 10,000 documents indexed (GitHub + Discord + Linear)
- 1,000 searches/month
- Average 50 documents per rerank

**Monthly Costs:**
```
Embeddings:
  - Initial indexing: 10,000 docs × 500 tokens = 5M tokens
  - Cost: $0.50 (one-time)
  - Incremental: 100 docs/month × 500 tokens = 50K tokens
  - Cost: $0.005/month

Reranking:
  - 1,000 searches × 50 docs = 50,000 rerank operations
  - Estimated cost: $1-2/month

Total: ~$2-3/month for typical early-stage usage
```

**At Scale (1M documents, 100K searches/month):**
```
Embeddings:
  - Initial: 1M × 500 tokens = 500M tokens = $50 (one-time)
  - Incremental: 10K docs/month × 500 tokens = 5M tokens = $0.50/month

Reranking:
  - 100K searches × 50 docs = 5M rerank operations
  - Estimated cost: $100-200/month

Total: ~$100-200/month at scale
```

---

## Lightfast Implementation Recommendations

### Phase 1: MVP (Months 1-3)

**Approach:** Semantic search with reranking, no hybrid initially.

**Stack:**
- Embeddings: Cohere `embed-english-v3.0`
- Storage: Pinecone (pure dense vectors)
- Reranking: Cohere `rerank-v3.5`

**Implementation:**
```typescript
// 1. Index documents
async function indexDocuments(docs: Document[]) {
  const embeddings = await cohere.embed({
    texts: docs.map(d => d.text),
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });

  await pinecone.upsert(
    docs.map((doc, i) => ({
      id: doc.id,
      values: embeddings.embeddings[i],
      metadata: {
        text: doc.text,
        source: doc.source,
        createdAt: doc.createdAt,
      },
    }))
  );
}

// 2. Search
async function search(query: string, topN = 5) {
  // Embed query
  const queryEmbedding = await cohere.embed({
    texts: [query],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  // Vector search
  const results = await pinecone.query({
    vector: queryEmbedding.embeddings[0],
    topK: 50,
    includeMetadata: true,
  });

  // Rerank
  const reranked = await cohere.rerank({
    query: query,
    documents: results.matches.map(m => m.metadata.text),
    model: 'rerank-v3.5',
    topN: topN,
  });

  return reranked.results;
}
```

**Metrics to Track:**
- Search latency p95
- Relevance score distribution
- User feedback (thumbs up/down on results)

### Phase 2: Optimization (Months 4-6)

**Additions:**
- Hybrid search (add BM25)
- Embedding cache (Redis)
- Query understanding improvements

**Hybrid Search:**
```typescript
async function hybridSearch(query: string, topN = 5) {
  // Dense embedding
  const dense = await cohere.embed({
    texts: [query],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });

  // Sparse embedding (BM25)
  const sparse = generateBM25(query);

  // Hybrid query
  const results = await pinecone.query({
    vector: dense.embeddings[0],
    sparseVector: sparse,
    topK: 50,
    alpha: 0.5, // Tune based on query type
  });

  // Rerank
  const reranked = await cohere.rerank({
    query: query,
    documents: results.matches.map(m => m.metadata.text),
    model: 'rerank-v3.5',
    topN: topN,
  });

  return reranked.results;
}
```

**Cache Layer:**
```typescript
class EmbeddingCache {
  constructor(private redis: Redis) {}

  async getOrCreate(text: string): Promise<number[]> {
    const hash = contentHash(text);
    const key = `embed:v3:${hash}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await cohere.embed({
      texts: [text],
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });

    const embedding = result.embeddings[0];
    await this.redis.set(key, JSON.stringify(embedding));
    return embedding;
  }
}
```

### Phase 3: Scale (Months 7-12)

**Additions:**
- Multi-stage retrieval for large corpora
- Advanced chunking strategies
- Evaluation framework with golden dataset

**Multi-Stage Retrieval:**
```typescript
async function multiStageSearch(query: string) {
  // Stage 1: Fast filtering (100 results)
  const dense = await embedCache.getOrCreate(query);
  const candidates = await pinecone.query({
    vector: dense,
    topK: 100,
  });

  // Stage 2: Rerank to 20
  const reranked1 = await cohere.rerank({
    query: query,
    documents: candidates.matches.map(m => m.metadata.text),
    model: 'rerank-v3.5',
    topN: 20,
  });

  // Stage 3: Fetch full context for top 20
  const fullDocs = await fetchFullDocuments(
    reranked1.results.map(r => r.index)
  );

  // Stage 4: Final rerank with full context
  const reranked2 = await cohere.rerank({
    query: query,
    documents: fullDocs,
    model: 'rerank-v3.5',
    topN: 5,
  });

  return reranked2.results;
}
```

### Integration with MCP

**MCP Tool Implementation:**
```typescript
// MCP tool: lightfast_search
server.addTool({
  name: 'lightfast_search',
  description: 'Search company memory across GitHub, Discord, Slack, Linear, Notion',
  parameters: {
    query: {
      type: 'string',
      description: 'Semantic search query',
      required: true,
    },
    sources: {
      type: 'array',
      description: 'Filter by data sources',
      items: { type: 'string' },
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum results to return',
      default: 5,
      required: false,
    },
  },
  handler: async ({ query, sources, limit = 5 }) => {
    const results = await search(query, limit);

    // Filter by sources if specified
    const filtered = sources
      ? results.filter(r => sources.includes(r.source))
      : results;

    return {
      results: filtered.map(r => ({
        text: r.text,
        source: r.source,
        relevanceScore: r.relevanceScore,
        metadata: r.metadata,
      })),
    };
  },
});
```

### Pinecone Configuration

**Recommended Setup:**
```typescript
// Development
await pinecone.createIndex({
  name: 'lightfast-dev',
  dimension: 1024, // embed-english-v3.0
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1',
    },
  },
});

// Production (with hybrid search)
await pinecone.createIndex({
  name: 'lightfast-prod',
  dimension: 1024,
  metric: 'dotproduct', // Required for hybrid
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1',
    },
  },
});
```

---

## Common Pitfalls to Avoid

### 1. Mismatched Input Types

**Problem:** Using `search_query` input type for documents, or vice versa.

**Impact:** 10-20% accuracy degradation.

**Solution:**
```typescript
// Always specify correct input type
await cohere.embed({
  texts: documents,
  inputType: 'search_document', // For indexing
});

await cohere.embed({
  texts: [query],
  inputType: 'search_query', // For querying
});
```

### 2. Ignoring Token Limits

**Problem:** Sending 10K token documents to rerank without chunking.

**Impact:** Truncation and lost context.

**Solution:**
```typescript
// Check and chunk before reranking
function prepareForRerank(docs: string[], maxTokens = 2000) {
  return docs.flatMap(doc => {
    const tokens = estimateTokens(doc);
    if (tokens <= maxTokens) return [doc];
    return chunkDocument(doc, maxTokens);
  });
}
```

### 3. Over-Retrieval Without Reranking

**Problem:** Retrieving 100 results but only using top 10 based on vector scores.

**Impact:** Missing relevant results buried at position 50-100.

**Solution:**
```typescript
// Always rerank if retrieving more than final result count
const candidates = await pinecone.query({ topK: 50 });
const reranked = await cohere.rerank({
  documents: candidates,
  topN: 10, // Much smaller than retrieval count
});
```

### 4. Not Handling Structured Data Properly

**Problem:** Reranking JSON documents without specifying `rankFields`.

**Impact:** Irrelevant fields (IDs, timestamps) affecting ranking.

**Solution:**
```typescript
// Specify which fields to rank on
await cohere.rerank({
  query: query,
  documents: jsonDocs,
  rankFields: ['title', 'content'], // Ignore id, createdAt, etc.
});
```

### 5. Missing Error Handling

**Problem:** No retry logic for transient API failures.

**Impact:** Failed searches during temporary outages.

**Solution:** Use retry logic with exponential backoff (see [Production Optimization](#retry-strategy)).

### 6. Incorrect Similarity Metric

**Problem:** Using `cosine` metric in Pinecone for hybrid search.

**Impact:** Sparse vectors not supported.

**Solution:**
```typescript
// For hybrid search, use dotproduct
await pinecone.createIndex({
  metric: 'dotproduct', // Required for sparse vectors
});
```

### 7. Not Validating Relevance Scores

**Problem:** Returning all reranked results regardless of score.

**Impact:** Low-quality results shown to users.

**Solution:**
```typescript
// Filter by threshold
const threshold = 0.3; // Determined via calibration
const filtered = reranked.results.filter(r => r.relevanceScore >= threshold);

if (filtered.length === 0) {
  return { message: 'No relevant results found' };
}
```

### 8. Embedding Version Mismatch

**Problem:** Searching with v3 embeddings in index built with v2.

**Impact:** Degraded search quality.

**Solution:**
```typescript
// Include model version in index name
const indexName = `lightfast-embed-v3-${env}`;

// Track version in metadata
await pinecone.upsert({
  metadata: {
    embeddingModel: 'embed-english-v3.0',
    embeddingVersion: 3,
  },
});
```

### 9. Ignoring Chunking Boundaries

**Problem:** Fixed-size chunking that splits sentences mid-word.

**Impact:** Meaningless chunks and poor retrieval.

**Solution:**
```typescript
// Chunk on semantic boundaries
function semanticChunk(text: string, maxTokens = 500) {
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let current: string[] = [];
  let tokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (tokens + sentenceTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(' '));
      current = [sentence];
      tokens = sentenceTokens;
    } else {
      current.push(sentence);
      tokens += sentenceTokens;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return chunks;
}
```

### 10. No Monitoring or Alerts

**Problem:** Not tracking search performance and errors.

**Impact:** Silent degradation and poor user experience.

**Solution:**
```typescript
// Instrument all Cohere calls
async function instrumentedEmbed(texts: string[]) {
  const start = Date.now();

  try {
    const result = await cohere.embed({ texts });

    metrics.recordEmbedLatency(Date.now() - start);
    metrics.incrementEmbedSuccess();

    return result;
  } catch (error) {
    metrics.incrementEmbedError();
    throw error;
  }
}

// Set up alerts
if (metrics.embedErrorRate > 0.01) {
  alert.send('Embed error rate exceeded 1%');
}
```

---

## Summary

### Key Takeaways for Lightfast

1. **Start Simple:** Dense vectors + rerank (no hybrid initially)
2. **Use Cohere v3 Models:** Best balance of cost, performance, and maturity
3. **Always Rerank:** 20-35% accuracy gain for 200-500ms latency
4. **Retrieve 50, Rerank to 5:** Optimal cost-performance sweet spot
5. **Cache Embeddings:** Never re-embed the same content
6. **Monitor Everything:** Track latency, errors, and relevance scores
7. **Specify Input Types:** Critical for embedding quality
8. **Chunk Semantically:** Preserve meaning across boundaries
9. **Use Production Keys:** Don't launch with trial limits
10. **Iterate Based on Metrics:** Build evaluation framework early

### Next Steps

1. **Week 1:** Implement basic semantic search (dense vectors + rerank)
2. **Week 2:** Add embedding cache and monitoring
3. **Week 3:** Build evaluation dataset and track metrics
4. **Week 4:** Optimize based on real query patterns
5. **Month 2:** Add hybrid search if keyword matching is weak
6. **Month 3:** Implement multi-stage retrieval for scale

### Resources

- [Cohere Documentation](https://docs.cohere.com)
- [Reranking Best Practices](https://docs.cohere.com/docs/reranking-best-practices)
- [Embedding Guide](https://docs.cohere.com/docs/embeddings)
- [RAG with Cohere](https://docs.cohere.com/docs/rag-with-cohere)
- [Pinecone + Cohere Integration](https://docs.pinecone.io/integrations/cohere)
