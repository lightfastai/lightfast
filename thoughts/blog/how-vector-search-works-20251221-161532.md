---
title: 'How Vector Search Works: A Developer''s Guide to Semantic Retrieval'
slug: how-vector-search-works
publishedAt: '2025-01-06'
category: technology
contentType: deep-dive
excerpt: >-
  Vector search finds semantically similar data by comparing mathematical
  representations called embeddings. Learn how HNSW and IVF algorithms enable
  sub-millisecond retrieval across millions of vectors.
tldr: >-
  Vector search transforms data into high-dimensional embeddings and uses
  approximate nearest neighbor (ANN) algorithms to find semantically similar
  items. Unlike keyword search that matches exact tokens, vector search
  understands meaning—'best pizza restaurant' matches 'top-rated pizzeria.' HNSW
  graphs deliver 98%+ recall with sub-10ms latency, while IVF indexes offer
  better memory efficiency for filtered queries. Choose Pinecone for managed
  simplicity, Qdrant for advanced filtering, or pgvector to leverage existing
  Postgres infrastructure.
seo:
  metaDescription: >-
    Learn how vector search works: embeddings, HNSW algorithms, and similarity
    metrics. A technical deep-dive for developers building semantic search and
    RAG systems.
  focusKeyword: how vector search works
  secondaryKeywords:
    - vector embeddings
    - HNSW algorithm
    - approximate nearest neighbor
    - semantic search
  faq:
    - question: How is vector search different from traditional keyword search?
      answer: >-
        Keyword search matches exact tokens using inverted indexes and TF-IDF
        scoring. Vector search converts data into numerical embeddings that
        capture semantic meaning, then finds similar items by measuring
        mathematical distance. This means 'best pizza restaurant' can match
        'top-rated pizzeria' even without shared words.
    - question: What embedding model should I use for vector search?
      answer: >-
        For general text, OpenAI's text-embedding-3-small (1536 dimensions) or
        Cohere's embed-v3 offer strong performance. For code, use specialized
        models like CodeBERT. Match your embedding dimensions to your vector
        database limits—pgvector supports up to 2,000 dimensions while Weaviate
        handles 65,535.
    - question: When should I use HNSW vs IVF indexing?
      answer: >-
        Use HNSW for highest recall (98%+) and fastest queries when memory isn't
        constrained. Choose IVF when you need heavy metadata filtering (IVF
        maintains stable performance even with 90%+ filter ratios), have memory
        constraints, or need faster index build times.
    - question: Should I use pgvector or a dedicated vector database?
      answer: >-
        Use pgvector for under 100k vectors when you need ACID transactions and
        already run Postgres. Choose dedicated vector databases like Pinecone,
        Qdrant, or Milvus for larger datasets, higher throughput requirements,
        or when vector search is your primary access pattern.
author: jeevanpillay
_internal:
  status: published
  generated: '2025-12-21T16:15:32Z'
  publishedAt: '2025-12-21T03:27:25.999Z'
  sources:
    - 'https://zilliz.com/learn/learn-hnswlib-graph-based-library-for-fast-anns'
    - >-
      https://www.pingcap.com/article/approximate-nearest-neighbor-ann-search-explained-ivf-vs-hnsw-vs-pq/
    - 'https://algolia.com/blog/ai/vector-vs-keyword-search-why-you-should-care'
    - 'https://qdrant.tech/benchmarks/'
    - 'https://www.firecrawl.dev/blog/best-vector-databases-2025'
    - >-
      https://neon.com/blog/understanding-vector-search-and-hnsw-index-with-pgvector
    - >-
      https://milvus.io/blog/understanding-ivf-vector-index-how-It-works-and-when-to-choose-it-over-hnsw.md
  word_count: 1180
  reading_time: 6 min
---

## TL;DR

Vector search transforms data into high-dimensional embeddings and uses approximate nearest neighbor (ANN) algorithms to find semantically similar items. Unlike keyword search that matches exact tokens, vector search understands meaning—"best pizza restaurant" matches "top-rated pizzeria." HNSW graphs deliver 98%+ recall with sub-10ms latency, while IVF indexes offer better memory efficiency for filtered queries. Choose Pinecone for managed simplicity, Qdrant for advanced filtering, or pgvector to leverage existing Postgres infrastructure.

---

## The Semantic Search Revolution

Search for "best pizza restaurant" in a traditional keyword system, and you'll miss every result that says "top-rated pizzeria." That's the fundamental limitation of token matching—it finds words, not meaning.

Vector search solves this by operating in semantic space. Instead of indexing words, it indexes *meaning* as points in high-dimensional space. Similar concepts cluster together regardless of vocabulary. This isn't just an improvement; it's a different paradigm.

**The numbers tell the story:**
- Modern embedding models encode text into 768-1536 dimensional vectors
- HNSW indexes achieve 98%+ recall with sub-10ms latency
- Production systems handle millions of vectors with single-digit millisecond p99

---

## How Vector Search Actually Works

Vector search involves three steps: embedding, indexing, and similarity calculation.

### Step 1: Generate Embeddings

Embeddings transform data into dense numerical vectors that capture semantic relationships. Text, images, and code all become points in the same mathematical space.

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Generate embedding for a query
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'How do I implement authentication in Next.js?',
});

// Result: Float32Array with 1536 dimensions
console.log(embedding.length); // 1536
```

The embedding model matters. OpenAI's `text-embedding-3-small` produces 1536-dimensional vectors optimized for semantic similarity. For code-specific search, models like CodeBERT or StarCoder embeddings capture programming semantics more effectively.

### Step 2: Index for Fast Retrieval

With millions of vectors, brute-force comparison (O(n) complexity) becomes impractical. Approximate Nearest Neighbor (ANN) algorithms reduce this to O(log n) by organizing vectors into specialized data structures.

**Two dominant approaches:**

**HNSW (Hierarchical Navigable Small World)** builds a multi-layer graph where each node connects to its nearest neighbors. Search starts at the top layer (sparse, long-range connections) and descends through increasingly dense layers:

```typescript
// HNSW index configuration (Qdrant example)
const indexConfig = {
  hnsw_config: {
    m: 16,              // Max connections per node (16-64 typical)
    ef_construct: 128,  // Candidate list size during build
  },
};

// At query time, ef_search controls accuracy vs speed
const searchParams = {
  hnsw_ef: 128,  // Higher = better recall, slower
};
```

**IVF (Inverted File Index)** clusters vectors using k-means, then searches only relevant clusters:

```typescript
// IVF index configuration
const ivfConfig = {
  nlist: 1024,   // Number of clusters
  nprobe: 16,    // Clusters to search (higher = better recall)
};
```

### Step 3: Calculate Similarity

Three distance metrics dominate:

| Metric | Formula | Best For |
|--------|---------|----------|
| **Cosine** | 1 - (A·B / \|\|A\|\|\|\|B\|\|) | Normalized text embeddings |
| **Euclidean (L2)** | √Σ(Aᵢ - Bᵢ)² | Image embeddings, clustering |
| **Inner Product** | A·B | When vectors are pre-normalized |

Most text embedding models produce normalized vectors, making cosine similarity the default choice.

---

## HNSW: The Algorithm Powering Production Search

HNSW dominates production deployments for good reason. The algorithm constructs a hierarchy of proximity graphs, enabling greedy traversal from coarse to fine granularity.

**How it works:**

1. **Layer 0 (bottom)**: Every vector with dense local connections
2. **Layer 1+**: Progressively sparser, containing subsets of vectors
3. **Search**: Start at top layer, greedily find nearest neighbor, use as entry point for next layer

The key insight: long-range connections at upper layers enable quick navigation to the right neighborhood, then dense connections at layer 0 ensure high recall.

**Critical parameters:**

```typescript
// Production-tuned HNSW settings
const hnswConfig = {
  m: 32,              // Connections per node (memory vs recall)
  ef_construct: 200,  // Build quality (one-time cost)
  ef_search: 128,     // Query-time recall vs latency
};
```

- **M=16**: Good default, ~95% recall
- **M=32**: Higher recall (~97%), 2x memory
- **M=64**: Diminishing returns, rarely needed

---

## Performance Reality Check

Benchmarks vary by dataset and configuration, but these numbers reflect real production scenarios with 1M vectors at 768 dimensions:

| Database | p95 Latency | QPS | Recall | Memory Overhead |
|----------|-------------|-----|--------|-----------------|
| **Qdrant** | 30-40ms | 2,000-5,000 | 99% | 1.5x |
| **Pinecone** | 45ms (p99) | 5,000+ | 99% | Managed |
| **Milvus** | Variable | 2,400+ | 98% | 1.2x |
| **Weaviate** | 95ms (p99) | 2,000+ | 97% | 1.3x |
| **pgvector** | 8ms | 140-470 | 99% | 1x |

**What actually matters:**

- **p99 latency < 100ms** for user-facing search
- **Recall > 95%** for RAG applications (missing context degrades LLM output)
- **QPS** determines infrastructure cost at scale

**Memory optimization with quantization:**

Product Quantization (PQ) compresses vectors 64:1 at the cost of recall:

| Index Type | Memory | Recall |
|------------|--------|--------|
| HNSW (full) | 1.5x data | 98%+ |
| IVF_FLAT | 1x data | 95% |
| IVF_SQ8 | 0.25x data | 90% |
| IVF_PQ | 0.016x data | 70-85% |

---

## Choosing Your Vector Database

The decision framework is straightforward:

**Pinecone** when you want managed infrastructure and predictable latency. Best for teams without dedicated infrastructure engineers.

**Qdrant** when you need advanced filtering. Its pre-filtering approach maintains stable performance even with 90%+ filter ratios where HNSW degrades.

**pgvector** when you have under 100k vectors and already run Postgres. ACID transactions and familiar SQL are significant advantages.

**Milvus** when you're operating at enterprise scale (billions of vectors) and can manage distributed infrastructure.

```typescript
// pgvector with Drizzle ORM
import { pgTable, vector, text, index } from 'drizzle-orm/pg-core';

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  content: text('content'),
  embedding: vector('embedding', { dimensions: 1536 }),
}, (table) => ({
  embeddingIdx: index('embedding_idx')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
}));
```

---

## Frequently Asked Questions

**Q: How is vector search different from traditional keyword search?**

Keyword search matches exact tokens using inverted indexes and TF-IDF scoring. Vector search converts data into numerical embeddings that capture semantic meaning, then finds similar items by measuring mathematical distance. This means "best pizza restaurant" can match "top-rated pizzeria" even without shared words.

**Q: What embedding model should I use for vector search?**

For general text, OpenAI's text-embedding-3-small (1536 dimensions) or Cohere's embed-v3 offer strong performance. For code, use specialized models like CodeBERT. Match your embedding dimensions to your vector database limits—pgvector supports up to 2,000 dimensions while Weaviate handles 65,535.

**Q: When should I use HNSW vs IVF indexing?**

Use HNSW for highest recall (98%+) and fastest queries when memory isn't constrained. Choose IVF when you need heavy metadata filtering (IVF maintains stable performance even with 90%+ filter ratios), have memory constraints, or need faster index build times.

**Q: Should I use pgvector or a dedicated vector database?**

Use pgvector for under 100k vectors when you need ACID transactions and already run Postgres. Choose dedicated vector databases like Pinecone, Qdrant, or Milvus for larger datasets, higher throughput requirements, or when vector search is your primary access pattern.

---

## Resources

- [Pinecone HNSW Explained](https://www.pinecone.io/learn/series/faiss/hnsw/) – Deep algorithm walkthrough
- [pgvector Documentation](https://github.com/pgvector/pgvector) – PostgreSQL extension setup
- [Qdrant Benchmarks](https://qdrant.tech/benchmarks/) – Production performance data
- [Milvus IVF Guide](https://milvus.io/blog/understanding-ivf-vector-index-how-It-works-and-when-to-choose-it-over-hnsw.md) – When to choose IVF
