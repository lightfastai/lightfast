# Pinecone Best Practices for Production

**Target Use Case:** Lightfast memory infrastructure - storing company memory with relationships, targeting <100ms search latency

**Last Updated:** 2025-01-27

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Metadata Optimization](#metadata-optimization)
3. [Namespace Strategy](#namespace-strategy)
4. [Vector Optimization](#vector-optimization)
5. [Query Optimization](#query-optimization)
6. [Cost Optimization](#cost-optimization)
7. [Production Patterns](#production-patterns)
8. [Common Pitfalls](#common-pitfalls)
9. [Scaling Strategies](#scaling-strategies)
10. [Recommendations for Lightfast](#recommendations-for-lightfast)

---

## Executive Summary

### Key Findings

**Serverless vs Pod-Based:**
- **Serverless**: 47% average latency reduction, up to 50x cost savings, automatic scaling
- **Pod-Based**: Predictable performance, better for high-throughput applications
- **Recommendation for Lightfast**: Start with serverless for cost efficiency and automatic scaling

**Optimal Configuration:**
- **Dimensions**: 512-768 for best cost/performance balance (modern models perform well with fewer dimensions)
- **Metadata Limit**: 40KB per vector (hard limit)
- **Batch Size**: Up to 1000 records or 2MB per upsert
- **Target Latency**: Sub-100ms achievable with serverless (10ms for small namespaces)

**Critical Success Factors:**
1. Use namespaces for multi-tenant isolation (one namespace per workspace)
2. Implement selective metadata indexing to reduce memory usage
3. Use pre-filtering (single-stage filtering) for accuracy without performance penalty
4. Leverage hybrid search (dense + sparse vectors) for best relevance
5. Implement two-stage retrieval with reranking for 60%+ accuracy improvement

---

## Metadata Optimization

### Size Limits and Constraints

**Hard Limits:**
- Maximum metadata size: **40KB per vector**
- Maximum upsert size: **2MB or 1000 records** (whichever comes first)
- Recommended batch size: **100 vectors per request**
- Maximum record ID length: **512 characters**
- Maximum query result size: **4MB**

**Practical Implications:**
```typescript
// If you have 30KB metadata + 12KB embedding vector = 42KB per entry
// You can only upsert ~47 entries per batch (2MB / 42KB)
// vs 1000 entries with minimal metadata

// Calculate your batch size
const VECTOR_SIZE = 768 * 4; // 768 dimensions * 4 bytes = 3KB
const METADATA_SIZE = estimateMetadataSize(yourMetadata); // e.g., 5KB
const ENTRY_SIZE = VECTOR_SIZE + METADATA_SIZE; // 8KB
const MAX_BATCH = Math.min(1000, Math.floor(2_000_000 / ENTRY_SIZE)); // ~250
```

### Metadata Schema Design

**Best Practice: Selective Metadata Indexing**

Pinecone indexes all metadata fields by default, consuming memory and storage. Use selective indexing to improve performance:

```typescript
// Configure which metadata fields to index
const indexConfig = {
  spec: {
    pod: {
      metadata_config: {
        indexed: [
          'workspace_id',      // High cardinality but needed for filtering
          'entity_type',       // Low cardinality, frequently filtered
          'created_at',        // Date range queries
          'source',            // Filter by data source
        ]
      }
    }
  }
};

// Don't index:
// - High cardinality IDs (use as vector ID instead)
// - Long text fields (store in metadata but don't index)
// - Fields never used for filtering
```

**Metadata Structure for Lightfast:**

```typescript
interface EntityMetadata {
  // INDEXED FIELDS (selective indexing)
  workspace_id: string;        // Namespace isolation
  entity_type: 'pr' | 'issue' | 'message' | 'doc';
  source: 'github' | 'discord' | 'linear' | 'notion';
  created_at: number;          // Unix timestamp for range queries
  author_id: string;           // Filter by author

  // NON-INDEXED FIELDS (stored but not indexed)
  title: string;               // Full text, use sparse vectors instead
  url: string;                 // Reference link
  preview: string;             // Snippet for display (max 500 chars)

  // RELATIONSHIP DATA (stored in vector ID or separate graph DB)
  // Don't store arrays of related IDs in metadata - too expensive
}
```

### Metadata Best Practices

1. **Store Previews, Not Full Content**
   ```typescript
   // ❌ Bad: Store full document (wastes metadata space)
   metadata: {
     content: fullDocument // Could be 30KB+
   }

   // ✅ Good: Store preview + foreign key
   metadata: {
     preview: fullDocument.slice(0, 500), // 500 char snippet
     document_id: 'doc_123' // Fetch full from blob storage
   }
   ```

2. **Use Numbers for Range Queries**
   ```typescript
   // ✅ Good: Numeric timestamps for efficient range queries
   metadata: {
     created_at: 1706227200, // Unix timestamp
     updated_at: 1706313600
   }

   // ❌ Bad: Strings (inefficient for range queries)
   metadata: {
     created_at: '2024-01-26T00:00:00Z'
   }
   ```

3. **Avoid High-Cardinality Numeric IDs**
   ```typescript
   // ❌ Bad: Numeric ID with thousands of unique values
   metadata: {
     user_id: 123456 // Inefficient metadata statistics
   }

   // ✅ Good: Store as string or use as vector ID
   metadata: {
     user_id: 'user_123456' // Better statistics
   }
   // Or use hierarchical ID
   vectorId: 'user_123456#entity_789'
   ```

4. **Null Handling**
   ```typescript
   // ❌ Bad: Pinecone doesn't support null values
   metadata: {
     assignee: null
   }

   // ✅ Good: Omit the key entirely
   const metadata: Record<string, any> = {
     title: 'Task'
   };
   if (assignee) {
     metadata.assignee = assignee;
   }
   ```

### Performance Impact of Metadata

**Memory Consumption:**
- Each indexed metadata field increases memory usage
- High-cardinality fields (many unique values) consume significantly more memory
- Can reduce vector capacity per pod by 20-40%

**Query Performance:**
- Serverless: Disk-based metadata filtering, minimal memory impact
- Pod-based: In-memory filtering, high-cardinality degrades performance

**Recommendation for Lightfast:**
- Use **serverless indexes** to avoid metadata memory issues
- Index only 5-8 essential fields: `workspace_id`, `entity_type`, `source`, `created_at`, `author_id`
- Store relationship data in separate graph database (not in metadata)
- Keep metadata size under 5KB per vector for optimal batch performance

---

## Namespace Strategy

### Namespace Architecture

**What are Namespaces?**
- Physical data isolation in serverless architecture
- Logical partitioning for multi-tenant applications
- No performance penalty for using many namespaces
- Minimal overhead per namespace in serverless

**Serverless Namespace Benefits:**
- **Physical Isolation**: Each namespace stored separately, preventing "noisy neighbors"
- **Automatic Scaling**: Scales independently per namespace
- **Cost Effective**: Minimal overhead, supports millions of namespaces
- **Fast for Small Namespaces**: Linear scan delivers ~10ms response times
- **Adaptive Caching**: Hot namespaces cached in high-performance tiers

### Multi-Tenant Patterns

**Pattern 1: One Namespace Per Tenant (Recommended for Lightfast)**

```typescript
// Best for: Workspace isolation, guaranteed data separation
const namespace = `workspace_${workspaceId}`;

index.namespace(namespace).upsert([{
  id: 'github_pr_123',
  values: embedding,
  metadata: {
    entity_type: 'pr',
    source: 'github'
  }
}]);

// Query only within workspace
const results = await index.namespace(namespace).query({
  vector: queryEmbedding,
  topK: 20
});
```

**Advantages:**
- Physical data isolation (critical for security)
- No cross-tenant data leakage
- Easy to delete all tenant data (delete namespace)
- Scales to millions of tenants
- Fast queries for small to medium workspaces

**Considerations:**
- Serverless limit: 2000 namespaces per backup
- Cold-start latency for rarely-queried namespaces

**Pattern 2: Metadata Filtering (Alternative)**

```typescript
// All tenants in one namespace, filter by metadata
index.query({
  vector: queryEmbedding,
  filter: {
    workspace_id: { $eq: 'workspace_123' }
  },
  topK: 20
});
```

**When to Use:**
- Pod-based indexes with <100 namespaces limit
- Need to query across multiple tenants
- All tenants share similar access patterns

**Disadvantages:**
- No physical isolation (security concern)
- Can't easily delete all tenant data
- Potential for cross-tenant queries (security risk)

### Namespace Performance

**Serverless Performance:**
- **Warm namespaces**: ~10ms latency (regularly queried, cached)
- **Cold namespaces**: Higher latency on first query (fetched from blob storage)
- **Caching**: Active namespaces cached in SSD/memory for fast access

**Scaling Characteristics:**
- Linear performance up to millions of namespaces
- No performance degradation with namespace count
- Each query targets single namespace (no cross-namespace overhead)

**Real-World Example (Notion):**
- Uses thousands of namespaces in single index
- Cost-effective at scale
- Ensures tenant isolation

### Namespace Best Practices

1. **Naming Convention**
   ```typescript
   // Hierarchical namespace naming
   const namespace = `workspace_${workspaceId}`;

   // For testing/staging environments
   const namespace = `${env}_workspace_${workspaceId}`; // e.g., 'dev_workspace_123'
   ```

2. **Namespace Lifecycle**
   ```typescript
   // Create namespace implicitly on first upsert
   await index.namespace(namespace).upsert(vectors);

   // Delete namespace and all data
   await index.namespace(namespace).deleteAll();
   ```

3. **Query Isolation**
   ```typescript
   // Always scope queries to namespace for multi-tenant apps
   const results = await index.namespace(`workspace_${workspaceId}`).query({
     vector: embedding,
     topK: 20,
     // Additional filtering within namespace
     filter: {
       entity_type: { $eq: 'pr' },
       created_at: { $gte: startDate }
     }
   });
   ```

### Recommendation for Lightfast

**Use one namespace per workspace** for:
1. **Security**: Physical data isolation prevents cross-workspace leakage
2. **Compliance**: Easy to delete all workspace data (GDPR, data retention)
3. **Performance**: Fast queries for typical workspace sizes (<100K vectors)
4. **Scalability**: Serverless supports millions of workspaces
5. **Cost**: Minimal overhead per namespace in serverless

**Implementation:**
```typescript
// Namespace structure
const namespace = `workspace_${workspaceId}`;

// All entities for a workspace in same namespace
// Use metadata to differentiate entity types
metadata: {
  entity_type: 'pr' | 'issue' | 'message' | 'doc',
  source: 'github' | 'discord' | 'linear' | 'notion'
}
```

---

## Vector Optimization

### Embedding Dimensions

**Storage Cost per Million Vectors:**
- 512 dimensions: ~2GB storage
- 768 dimensions: ~3GB storage
- 1024 dimensions: ~4GB storage
- 1536 dimensions: ~6GB storage

**Performance Characteristics:**
```
Dimension Size | Query Latency | Storage Cost | Accuracy
512           | Fastest       | Lowest      | Good (modern models)
768           | Fast          | Medium      | Excellent
1024          | Medium        | Medium-High | Excellent
1536          | Slower        | Highest     | Excellent (OpenAI)
```

**Modern Embedding Model Performance:**
- OpenAI text-embedding-3-large at **256 dimensions** outperforms text-embedding-ada-002 at **1536 dimensions**
- Represents 6x reduction in storage with better performance
- Newer models achieve better results with fewer dimensions

**Recommendation for Lightfast:**

Use **768 dimensions** for optimal balance:
- **Voyage AI voyage-3** (1024 dims) or **Mixedbread mxbai-embed-large** (768 dims)
- Excellent performance on code and technical content
- 3GB per million vectors (manageable cost)
- Fast query performance
- Consider using **512 dimensions** if cost is critical and quality remains acceptable

**Dimension Configuration:**
```typescript
// Set during index creation (immutable)
const index = await pinecone.createIndex({
  name: 'lightfast-memory',
  dimension: 768, // Cannot change later
  metric: 'cosine', // or 'dotproduct' for hybrid search
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});
```

### Vector Compression

**Product Quantization (PQ):**
- Compresses high-dimensional vectors while preserving similarity
- Reduces storage requirements significantly
- Pinecone applies automatically for large datasets
- No manual configuration needed

**Scalar Quantization (SQ):**
- Used for small slabs (small vector sets) in serverless
- Minimal storage overhead
- Good performance for small datasets

**Trade-offs:**
- Compression reduces storage cost
- Minimal impact on accuracy (typically <5% recall reduction)
- Improves query speed (less data to scan)

**Recommendation for Lightfast:**
- Let Pinecone handle compression automatically
- Monitor recall metrics to ensure quality
- Use serverless architecture for adaptive optimization

### Batch Upsert Best Practices

**Optimal Batch Sizing:**

```typescript
// Calculate optimal batch size based on your data
const DIMENSION = 768;
const VECTOR_SIZE = DIMENSION * 4; // 4 bytes per float32 = 3KB
const AVG_METADATA_SIZE = 5000; // 5KB per vector
const ENTRY_SIZE = VECTOR_SIZE + AVG_METADATA_SIZE; // ~8KB
const MAX_BATCH = Math.min(
  1000, // Pinecone max records per batch
  Math.floor(2_000_000 / ENTRY_SIZE) // 2MB limit / entry size = ~250
);

console.log(`Optimal batch size: ${MAX_BATCH}`); // ~250 vectors
```

**Parallel Batching:**

```typescript
import { chunk } from 'lodash';
import pMap from 'p-map';

async function upsertVectors(vectors: Vector[]) {
  const batches = chunk(vectors, MAX_BATCH);

  // Parallel upserts with concurrency control
  await pMap(
    batches,
    async (batch) => {
      await index.namespace(namespace).upsert(batch);
    },
    { concurrency: 10 } // Adjust based on rate limits
  );
}
```

**gRPC Client for High Throughput:**

```typescript
// Install gRPC extras for Python
// pip install "pinecone-client[grpc]"

// For Node.js, gRPC is included by default
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  // gRPC automatically used for high throughput
});
```

**Performance Tuning:**

```typescript
// For serverless indexes
const config = {
  pool_threads: 50, // Number of async threads
  connection_pool_maxsize: 50, // Connection pool size
};

// For optimal embedding + upsert
const embeddingConfig = {
  pool_threads: 4, // >4 for OpenAI embeddings
  embedding_chunk_size: 1000, // Batch embeddings
  batch_size: 64, // Upsert batch size
};
```

### Vector Update Strategies

**Upsert (Update or Insert):**

```typescript
// Upsert overwrites existing vectors with same ID
await index.namespace(namespace).upsert([{
  id: 'github_pr_123',
  values: newEmbedding, // Updated embedding
  metadata: {
    ...existingMetadata,
    version: 2, // Track versions
    updated_at: Date.now()
  }
}]);
```

**Versioning Pattern:**

```typescript
// Option 1: Version in metadata
{
  id: 'github_pr_123',
  metadata: {
    version: 2,
    updated_at: 1706313600
  }
}

// Option 2: Version in ID (allows querying old versions)
{
  id: 'github_pr_123#v2',
  metadata: {
    current_version: true
  }
}

// Option 3: Separate namespace per version
const namespace = `workspace_${workspaceId}_v${version}`;
```

**Eventual Consistency:**

```typescript
// Pinecone is eventually consistent
await index.namespace(namespace).upsert(vectors);

// Wait briefly before querying
await new Promise(resolve => setTimeout(resolve, 100));

// Or use describe_index_stats to check if upsert completed
const stats = await index.describeIndexStats();
```

### Recommendation for Lightfast

1. **Dimension**: 768 (Voyage AI or Mixedbread models)
2. **Batch Size**: 100-250 vectors (depending on metadata size)
3. **Parallelism**: 10 concurrent upserts for bulk ingestion
4. **Updates**: Upsert with version tracking in metadata
5. **Consistency**: Assume eventual consistency, design UI accordingly

---

## Query Optimization

### Pre-filtering vs Post-filtering

**Pinecone's Single-Stage Filtering (Best Practice):**

Pinecone implements **single-stage filtering** that merges vector and metadata indexes:
- Combines pre-filtering accuracy with post-filtering speed
- No performance penalty for filtering
- Scales to billions of vectors
- Often **faster** than unfiltered searches (smaller search space)

**How It Works:**
```typescript
// Single-stage filtering (Pinecone's approach)
const results = await index.namespace(namespace).query({
  vector: queryEmbedding,
  topK: 20,
  filter: {
    entity_type: { $eq: 'pr' },
    created_at: { $gte: startTimestamp },
    source: { $in: ['github', 'linear'] }
  }
});

// Pinecone:
// 1. Identifies clusters matching metadata filter
// 2. Performs vector search only within those clusters
// 3. Returns topK most similar results
```

**Traditional Approaches (Pinecone doesn't use these):**
- **Pre-filtering**: Filter first, then vector search (accurate but slow)
- **Post-filtering**: Vector search first, then filter (fast but inaccurate)

### Top-K Optimization

**Guidelines:**

```typescript
// Small topK: Fastest, most relevant
topK: 10 // Best for simple queries

// Medium topK: Good balance
topK: 20-50 // Recommended for most use cases

// Large topK: Include vector values/metadata carefully
topK: 100-1000 // Avoid returning values/metadata if >1000

// Very large topK: Disable values/metadata
topK: 1000+ // Use includeValues: false, includeMetadata: false
```

**Performance Impact:**
- topK < 100: Minimal performance impact
- topK 100-1000: Moderate impact, especially with metadata
- topK > 1000: Significant impact, can hit 4MB result limit

**Best Practice:**

```typescript
// For UI display (first page)
const results = await query({
  topK: 20,
  includeValues: false, // Don't need embeddings
  includeMetadata: true // Need for display
});

// For reranking (get more candidates)
const candidates = await query({
  topK: 100,
  includeValues: false,
  includeMetadata: true
});

// For bulk export (large result set)
const bulk = await query({
  topK: 10000,
  includeValues: false, // Reduce payload size
  includeMetadata: false // Reduce payload size
});
```

### Hybrid Search Strategies

**Dense + Sparse Vectors for Best Relevance:**

```typescript
// Index configuration for hybrid search
const index = await pinecone.createIndex({
  name: 'lightfast-memory',
  dimension: 768, // Dense vector dimensions
  metric: 'dotproduct', // Required for hybrid search
  spec: {
    pod: {
      pod_type: 's1', // s1 or p1 required for hybrid
      // Serverless doesn't support hybrid yet (as of Jan 2025)
    }
  }
});

// Upsert with dense + sparse vectors
await index.namespace(namespace).upsert([{
  id: 'github_pr_123',
  values: denseEmbedding, // Semantic embedding (768 dims)
  sparseValues: {
    indices: [15, 42, 156, ...], // Word indices
    values: [0.8, 0.6, 0.4, ...] // TF-IDF scores
  },
  metadata: { /* ... */ }
}]);

// Query with hybrid search
const results = await index.namespace(namespace).query({
  vector: denseQueryEmbedding,
  sparseVector: {
    indices: sparseIndices,
    values: sparseValues
  },
  topK: 20,
  alpha: 0.7 // Weight: 0=sparse only, 0.5=equal, 1=dense only
});
```

**Alpha Parameter Tuning:**
- `alpha: 0.0` - Pure keyword search (sparse only)
- `alpha: 0.3` - Keyword-heavy hybrid
- `alpha: 0.5` - Balanced hybrid
- `alpha: 0.7` - Semantic-heavy hybrid (recommended)
- `alpha: 1.0` - Pure semantic search (dense only)

**When to Use Hybrid:**
- Technical content with specific terminology (code, API names)
- Queries with exact keywords or acronyms
- Mix of semantic and keyword searches

**Trade-offs:**
- Requires pod-based index (not serverless yet)
- More complex ingestion pipeline (generate sparse vectors)
- Excellent for technical documentation and code search

### Caching Strategies

**Pinecone's Adaptive Caching (Automatic):**

```typescript
// Serverless automatically caches hot data
// - Warm namespaces: Cached in SSD/memory (~10ms latency)
// - Cold namespaces: Fetched from blob storage (higher latency)

// No manual configuration needed
// Caching adapts to access patterns automatically
```

**Application-Level Caching:**

```typescript
// Cache frequent queries in Redis/memory
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache<string, SearchResult>({
  max: 1000, // Cache 1000 queries
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

async function cachedQuery(queryVector: number[], filters: Filter) {
  const cacheKey = `${hash(queryVector)}_${hash(filters)}`;

  const cached = queryCache.get(cacheKey);
  if (cached) return cached;

  const results = await index.namespace(namespace).query({
    vector: queryVector,
    filter: filters,
    topK: 20
  });

  queryCache.set(cacheKey, results);
  return results;
}
```

**Semantic Caching:**

```typescript
// Cache by semantic similarity of queries
async function semanticCachedQuery(queryText: string) {
  const queryEmbedding = await embed(queryText);

  // Search cache for similar queries
  const similarCached = await cacheIndex.query({
    vector: queryEmbedding,
    topK: 1,
    filter: { type: 'cache' }
  });

  if (similarCached.matches[0]?.score > 0.95) {
    // Very similar query, return cached result
    return similarCached.matches[0].metadata.result;
  }

  // Not in cache, perform actual query
  const result = await actualQuery(queryEmbedding);

  // Store in cache
  await cacheIndex.upsert([{
    id: generateId(),
    values: queryEmbedding,
    metadata: {
      type: 'cache',
      query: queryText,
      result: result,
      timestamp: Date.now()
    }
  }]);

  return result;
}
```

### Read Unit (RU) Optimization

**Read Unit Consumption:**
- **Fetching**: 1 RU per 10 records
- **Querying**: Varies by records, dimensionality, metadata size

**Optimization Strategies:**

```typescript
// 1. Use smaller topK when possible
topK: 20 // vs topK: 100 (5x fewer RUs)

// 2. Disable unnecessary fields
{
  includeValues: false, // Don't return embeddings
  includeMetadata: true // Only return metadata
}

// 3. Use namespaces to reduce search space
// Query single namespace vs entire index

// 4. Implement caching for frequent queries
// Avoid repeated identical queries

// 5. Use metadata filtering to narrow results
// Smaller search space = fewer RUs
```

### Connection Pool Settings

**Python SDK:**

```python
from pinecone import Pinecone

pc = Pinecone(
    api_key="YOUR_API_KEY",
    pool_threads=50,  # Async request threads
    connection_pool_maxsize=50  # Connection pool size
)
```

**Node.js SDK:**

```typescript
// gRPC automatically configured for optimal performance
// No manual tuning needed
```

### Recommendation for Lightfast

1. **Filtering**: Always use metadata filters (single-stage filtering is fast)
2. **Top-K**: Use 20 for UI, 100 for reranking
3. **Hybrid Search**: Consider for technical content (requires pod-based)
4. **Caching**: Implement application-level caching for frequent queries
5. **RU Optimization**: Use namespaces + metadata filtering to reduce search space

**Target Performance:**
- Warm namespace queries: <100ms p95
- Cold namespace queries: <500ms p95
- With caching: <10ms for repeated queries

---

## Cost Optimization

### Storage Cost Reduction

**Serverless Pricing Model:**
- **Storage**: Pay per GB stored
- **Read Units**: Pay per query
- **Write Units**: Pay per upsert/update/delete

**Optimization Strategies:**

1. **Reduce Vector Dimensions**
   ```typescript
   // 1536 dims → 768 dims = 50% storage reduction
   // 768 dims → 512 dims = 33% storage reduction

   // Use smaller dimensions if quality remains acceptable
   dimension: 768 // vs 1536
   ```

2. **Minimize Metadata Size**
   ```typescript
   // ❌ Bad: Large metadata (40KB)
   metadata: {
     full_content: '...', // 30KB
     full_history: [...], // 10KB
   }

   // ✅ Good: Minimal metadata (5KB)
   metadata: {
     preview: '...', // 500 bytes
     title: '...', // 200 bytes
     entity_type: 'pr', // 50 bytes
     // Reference full content in external DB
     content_ref: 'blob://doc_123'
   }
   ```

3. **Use Selective Metadata Indexing**
   ```typescript
   // Only index fields used for filtering
   metadata_config: {
     indexed: ['workspace_id', 'entity_type', 'created_at']
     // Don't index: 'title', 'preview', 'url'
   }
   ```

4. **Delete Stale Data**
   ```typescript
   // Implement data retention policies
   async function pruneOldData() {
     const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

     // Delete old vectors
     await index.namespace(namespace).delete({
       filter: {
         created_at: { $lt: sixMonthsAgo },
         archived: { $eq: true }
       }
     });
   }
   ```

5. **Use Collections for Inactive Data**
   ```typescript
   // Archive inactive workspaces to collections (backup)
   // Collections are cheaper storage

   // Create backup
   await pinecone.createBackup({
     name: `workspace_${workspaceId}_backup`,
     sourceIndex: 'lightfast-memory',
     sourceNamespace: `workspace_${workspaceId}`
   });

   // Delete from active index
   await index.namespace(`workspace_${workspaceId}`).deleteAll();

   // Restore when needed
   await pinecone.restoreBackup({
     backup: `workspace_${workspaceId}_backup`,
     targetIndex: 'lightfast-memory',
     targetNamespace: `workspace_${workspaceId}`
   });
   ```

### Compute Cost Reduction

**Serverless Advantages:**
- Auto-scaling: No over-provisioning
- Pay per use: No idle compute costs
- Up to 50x cost savings vs pod-based

**Query Optimization:**

```typescript
// 1. Reduce topK (fewer records scanned)
topK: 20 // vs topK: 100

// 2. Use metadata filtering (smaller search space)
filter: {
  workspace_id: { $eq: workspaceId },
  created_at: { $gte: recentTimestamp }
}

// 3. Disable unnecessary fields
{
  includeValues: false, // Don't return embeddings
  includeMetadata: true
}

// 4. Use namespaces (partition data)
// Query single namespace vs entire index
```

**Write Optimization:**

```typescript
// 1. Batch upserts (reduce API calls)
const batches = chunk(vectors, 250);
await pMap(batches, batch => index.upsert(batch), { concurrency: 10 });

// 2. Use import for bulk loads (>10M vectors)
// Import from S3/GCS is more cost-effective
await pinecone.importData({
  source: 's3://bucket/vectors.parquet',
  index: 'lightfast-memory'
});

// 3. Avoid unnecessary updates
// Only upsert when content actually changes
if (hasContentChanged(old, new)) {
  await index.upsert(updatedVector);
}
```

### Pod-Based Cost Optimization

**If using pod-based indexes:**

1. **Choose Right Pod Type**
   ```typescript
   // s1: Storage-optimized (cheapest)
   // - 5M vectors per pod
   // - Slightly higher latency
   // - Best for: Large datasets, relaxed latency requirements

   // p1: Performance-optimized
   // - 1M vectors per pod
   // - Low latency (<100ms)
   // - Best for: Production apps, strict latency requirements

   // p2: High-performance
   // - 200 QPS per replica
   // - <10ms latency
   // - Best for: High-throughput apps, low dimensions (<512)
   ```

2. **Right-Size Pods**
   ```typescript
   // Monitor index_fullness metric
   const stats = await index.describeIndexStats();
   console.log('Index fullness:', stats.indexFullness);

   // If fullness < 30%, downsize
   // If fullness > 80%, upsize

   // Vertical scaling (2x, 4x, 8x)
   await pinecone.configureIndex({
     name: 'lightfast-memory',
     replicas: 1,
     podType: 's1.x2' // Double capacity
   });
   ```

3. **Delete Unused Indexes**
   ```typescript
   // Don't leave idle indexes running
   // Each pod costs money even with zero queries

   // Archive to collection before deleting
   await pinecone.createCollection({
     name: 'backup_collection',
     source: 'old_index'
   });

   await pinecone.deleteIndex('old_index');
   ```

4. **Use Free Tier for Development**
   ```typescript
   // Free tier: 1 s1 pod
   // Suitable for <300K vectors (OpenAI 1536-dim)
   // Use for dev/test environments
   ```

5. **Negotiate Volume Discounts**
   - 1-year commitment: 25%+ discount
   - 2-year commitment: Higher discounts
   - Contact sales once validated

### Cost Monitoring

```typescript
// Track usage metrics
async function monitorCosts() {
  const stats = await index.describeIndexStats();

  console.log({
    totalVectors: stats.totalRecordCount,
    namespaces: stats.namespaces,
    indexFullness: stats.indexFullness,
    dimensionality: stats.dimension
  });

  // Calculate estimated costs
  const storageGB = (stats.totalRecordCount * stats.dimension * 4) / 1e9;
  const storageCost = storageGB * STORAGE_COST_PER_GB;

  console.log(`Estimated storage cost: $${storageCost}/month`);
}
```

### Recommendation for Lightfast

**Cost Optimization Priority:**

1. **Use Serverless** (up to 50x savings vs pods)
2. **768 dimensions** (50% savings vs 1536)
3. **5KB metadata limit** (optimal batch size)
4. **Selective metadata indexing** (reduce memory)
5. **Data retention policies** (delete old data)
6. **Application caching** (reduce queries)
7. **Batch operations** (reduce API calls)

**Expected Costs (Serverless):**
- 1M vectors (768 dims, 5KB metadata): ~$10-20/month
- 10M vectors: ~$100-200/month
- 100M vectors: ~$1,000-2,000/month

*(Actual costs vary by query volume and write frequency)*

---

## Production Patterns

### Real-World Case Studies

**1. Aquant (AI Service Platform)**
- **Scale**: Tens of millions of vectors
- **Performance**: Sub-100ms latency, 98% retrieval accuracy
- **Architecture**: Customer-specific namespaces (multi-tenant)
- **Results**: 53% reduction in no-response queries, 49% faster time-to-resolution

**2. Gong (Revenue Intelligence)**
- **Use Case**: Smart Trackers with continuous learning
- **Architecture**: Serverless for cost efficiency
- **Results**: Substantial cost reduction at scale

**3. Vanguard (Financial Services)**
- **Use Case**: Customer support with hybrid retrieval
- **Results**: 12% more accurate responses, reduced call times

**4. Entrapeer (Use Case Database)**
- **Scale**: 200K+ use cases, 3M+ profiles
- **Results**: 99% cost reduction, thousands of automatic additions

### Common Production Patterns

**Pattern 1: Two-Stage Retrieval with Reranking**

```typescript
// Stage 1: Vector search (retrieve candidates)
const candidates = await index.namespace(namespace).query({
  vector: queryEmbedding,
  topK: 100, // Over-retrieve
  filter: basicFilters,
  includeMetadata: true
});

// Stage 2: Rerank (refine results)
import { Pinecone } from '@pinecone-database/pinecone';
const reranked = await pinecone.inference.rerank({
  model: 'pinecone-rerank-v0',
  query: queryText,
  documents: candidates.matches.map(m => ({
    id: m.id,
    text: m.metadata.preview
  })),
  topN: 20 // Return top 20
});

// Results: 60%+ accuracy improvement
```

**Pattern 2: Hierarchical Search**

```typescript
// First search by entity type, then refine
async function hierarchicalSearch(query: string, workspaceId: string) {
  const embedding = await embed(query);

  // Search PRs
  const prResults = await index.namespace(`workspace_${workspaceId}`).query({
    vector: embedding,
    topK: 10,
    filter: { entity_type: { $eq: 'pr' } }
  });

  // Search Issues
  const issueResults = await index.namespace(`workspace_${workspaceId}`).query({
    vector: embedding,
    topK: 10,
    filter: { entity_type: { $eq: 'issue' } }
  });

  // Merge and rank
  return mergeAndRank(prResults, issueResults);
}
```

**Pattern 3: Real-Time Indexing**

```typescript
// Webhook handler for real-time updates
async function handleGitHubPREvent(event: GitHubPREvent) {
  // 1. Extract content
  const content = `${event.title}\n${event.description}\n${event.comments.join('\n')}`;

  // 2. Generate embedding
  const embedding = await embed(content);

  // 3. Upsert immediately
  await index.namespace(`workspace_${event.workspaceId}`).upsert([{
    id: `github_pr_${event.prId}`,
    values: embedding,
    metadata: {
      entity_type: 'pr',
      source: 'github',
      title: event.title,
      url: event.url,
      created_at: event.createdAt,
      author_id: event.authorId,
      preview: content.slice(0, 500)
    }
  }]);

  // Note: Pinecone is eventually consistent
  // Wait ~100ms before queries reflect this update
}
```

**Pattern 4: Batch Processing with Error Handling**

```typescript
async function batchUpsert(vectors: Vector[], retries = 3) {
  const batches = chunk(vectors, 250);

  await pMap(
    batches,
    async (batch, index) => {
      try {
        await index.namespace(namespace).upsert(batch);
      } catch (error) {
        if (retries > 0 && isRetryable(error)) {
          // Exponential backoff
          await sleep(Math.pow(2, 3 - retries) * 1000);
          return batchUpsert(batch, retries - 1);
        }

        // Log failed batch for manual review
        logger.error('Batch upsert failed', {
          batchIndex: index,
          error,
          vectorIds: batch.map(v => v.id)
        });
        throw error;
      }
    },
    { concurrency: 10 }
  );
}

function isRetryable(error: any): boolean {
  // Retry on rate limits, timeouts, 5xx errors
  return error.status === 429 ||
         error.status >= 500 ||
         error.code === 'ETIMEDOUT';
}
```

**Pattern 5: Index Host Caching**

```typescript
// ❌ Bad: Calls describe_index on every operation
const index = pinecone.index('lightfast-memory');
await index.query({ ... }); // describe_index API call
await index.upsert({ ... }); // describe_index API call

// ✅ Good: Cache index host
const INDEX_HOST = await getIndexHost('lightfast-memory'); // Once
const index = pinecone.index('lightfast-memory', INDEX_HOST);
await index.query({ ... }); // No extra API call
await index.upsert({ ... }); // No extra API call

// Implementation
let cachedIndexHost: string | null = null;

async function getIndexHost(indexName: string): Promise<string> {
  if (cachedIndexHost) return cachedIndexHost;

  const indexDesc = await pinecone.describeIndex(indexName);
  cachedIndexHost = indexDesc.host;
  return cachedIndexHost;
}
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Update Pinecone Index

on:
  push:
    branches: [main]
    paths:
      - 'data/**'

jobs:
  update-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Generate embeddings
        run: npm run generate-embeddings

      - name: Upsert to Pinecone
        env:
          PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
        run: npm run upsert-vectors

      - name: Validate index
        run: npm run validate-index
```

### Logging and Monitoring

```typescript
// Structured logging for production
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

async function loggedQuery(params: QueryParams) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    logger.info({
      requestId,
      operation: 'query',
      namespace: params.namespace,
      topK: params.topK,
      hasFilter: !!params.filter
    });

    const results = await index.namespace(params.namespace).query(params);

    logger.info({
      requestId,
      operation: 'query',
      status: 'success',
      duration: Date.now() - startTime,
      resultCount: results.matches.length
    });

    return results;
  } catch (error) {
    logger.error({
      requestId,
      operation: 'query',
      status: 'error',
      duration: Date.now() - startTime,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### Backup and Disaster Recovery

```typescript
// Regular backups for critical data
async function createBackup(workspaceId: string) {
  const backupName = `workspace_${workspaceId}_${Date.now()}`;

  await pinecone.createBackup({
    name: backupName,
    sourceIndex: 'lightfast-memory',
    sourceNamespace: `workspace_${workspaceId}`
  });

  logger.info({
    operation: 'backup',
    workspace: workspaceId,
    backup: backupName
  });
}

// Automated backup schedule (daily)
cron.schedule('0 2 * * *', async () => {
  const activeWorkspaces = await getActiveWorkspaces();

  for (const workspace of activeWorkspaces) {
    await createBackup(workspace.id);
  }
});

// Restore from backup
async function restoreBackup(backupName: string, workspaceId: string) {
  await pinecone.restoreBackup({
    backup: backupName,
    targetIndex: 'lightfast-memory',
    targetNamespace: `workspace_${workspaceId}`
  });
}
```

### Recommendation for Lightfast

**Production Architecture:**

1. **Two-stage retrieval**: Vector search (100 candidates) → Rerank (20 results)
2. **Real-time indexing**: Webhook → Embed → Upsert within 1 second
3. **Batch processing**: Nightly jobs for bulk updates with error handling
4. **Index host caching**: Cache host, avoid repeated describe_index calls
5. **Logging**: Structured logs with request IDs for debugging
6. **Monitoring**: Track query latency, error rates, index stats
7. **Backups**: Daily backups for active workspaces

**Performance Targets:**
- Query latency: <100ms p95
- Indexing latency: <1s for real-time, <1hr for batch
- Uptime: 99.9%
- Accuracy: >95% with reranking

---

## Common Pitfalls

### 1. Cost Pitfalls

**❌ Leaving Idle Indexes Running**
```typescript
// Problem: Hobby projects with always-on indexes
// Solution: Use collections to archive, delete index
await pinecone.createCollection({ name: 'backup', source: 'dev_index' });
await pinecone.deleteIndex('dev_index');

// Restore when needed
await pinecone.createIndex({
  name: 'dev_index',
  dimension: 768,
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
});
await pinecone.restoreCollection({ collection: 'backup', index: 'dev_index' });
```

**❌ Over-Provisioned Pods**
```typescript
// Problem: More pods than needed
// Solution: Monitor index_fullness, resize dynamically
const stats = await index.describeIndexStats();
if (stats.indexFullness < 0.3) {
  // Downsize to smaller pod
  await pinecone.configureIndex({
    name: 'lightfast-memory',
    podType: 's1.x1' // Reduce from x2
  });
}
```

**❌ Not Using Free Tier for Dev**
```typescript
// Problem: Paying for dev/test environments
// Solution: Use free tier (1 s1 pod, <300K vectors)
// Only use paid indexes for production
```

### 2. Vector Format Errors

**❌ Dimension Mismatch**
```typescript
// Problem: Vector dimensions don't match index
const index = await pinecone.createIndex({ dimension: 768 });
await index.upsert([{
  id: 'doc1',
  values: embedding1536 // 1536 dimensions - ERROR!
}]);

// Solution: Ensure embedding model matches index
const EMBEDDING_DIMENSION = 768;
const embedding = await embed(text, { dimensions: EMBEDDING_DIMENSION });
```

**❌ Invalid Vector Format**
```typescript
// Problem: Vectors must be Float32Array or number[]
await index.upsert([{
  id: 'doc1',
  values: [1, 2, 3] // Integers work
}]);

await index.upsert([{
  id: 'doc1',
  values: "embedding" // ERROR: Not an array
}]);
```

### 3. Metadata Errors

**❌ Null Values**
```typescript
// Problem: Pinecone doesn't support null
await index.upsert([{
  id: 'doc1',
  values: embedding,
  metadata: {
    assignee: null // ERROR!
  }
}]);

// Solution: Omit the key
const metadata: Record<string, any> = { title: 'Task' };
if (assignee) metadata.assignee = assignee;
```

**❌ Metadata Size Exceeded**
```typescript
// Problem: Metadata > 40KB
await index.upsert([{
  id: 'doc1',
  values: embedding,
  metadata: {
    full_content: longDocument // 50KB - ERROR!
  }
}]);

// Solution: Store preview + reference
await index.upsert([{
  id: 'doc1',
  values: embedding,
  metadata: {
    preview: longDocument.slice(0, 500), // 500 chars
    content_ref: 'blob://doc1' // Fetch full from external storage
  }
}]);
```

### 4. Query Errors

**❌ Result Size Limit**
```typescript
// Problem: Query results > 4MB
const results = await index.query({
  topK: 10000,
  includeMetadata: true, // Large metadata
  includeValues: true // Large vectors
});
// ERROR: Result size exceeds 4MB

// Solution: Reduce topK or exclude values/metadata
const results = await index.query({
  topK: 10000,
  includeMetadata: false,
  includeValues: false
});
```

**❌ Invalid Filter Syntax**
```typescript
// Problem: Incorrect filter operators
const results = await index.query({
  filter: {
    entity_type: 'pr' // Should be { $eq: 'pr' }
  }
});

// Solution: Use proper operators
const results = await index.query({
  filter: {
    entity_type: { $eq: 'pr' },
    created_at: { $gte: timestamp }
  }
});
```

### 5. Connection Errors

**❌ Not Using gRPC for High Throughput**
```python
# Problem: Using REST for high-throughput
from pinecone import Pinecone
pc = Pinecone(api_key="...")

# Solution: Install gRPC extras
# pip install "pinecone-client[grpc]"
# gRPC automatically used for high throughput
```

**❌ Missing Connection Pool Settings**
```python
# Problem: Default pool settings (low throughput)
pc = Pinecone(api_key="...")

# Solution: Increase pool threads and connection pool
pc = Pinecone(
    api_key="...",
    pool_threads=50,
    connection_pool_maxsize=50
)
```

### 6. Consistency Errors

**❌ Assuming Immediate Consistency**
```typescript
// Problem: Query immediately after upsert
await index.upsert(vectors);
const results = await index.query({ ... }); // May not include new vectors

// Solution: Wait briefly or design for eventual consistency
await index.upsert(vectors);
await new Promise(resolve => setTimeout(resolve, 100));
const results = await index.query({ ... });

// Better: Design UI to handle eventual consistency
// Show "Indexing..." state, poll for updates
```

### 7. Index Configuration Errors

**❌ Wrong Metric for Use Case**
```typescript
// Problem: Using cosine for hybrid search
const index = await pinecone.createIndex({
  metric: 'cosine' // ERROR: Hybrid requires dotproduct
});

// Solution: Use dotproduct for hybrid search
const index = await pinecone.createIndex({
  metric: 'dotproduct',
  dimension: 768
});
```

**❌ Can't Change Dimension After Creation**
```typescript
// Problem: Need to change dimension
const index = await pinecone.createIndex({ dimension: 1536 });
// Realize you want 768 dimensions

// Solution: Create new index, migrate data
const newIndex = await pinecone.createIndex({ dimension: 768 });
// Re-embed all data with new model
// Upsert to new index
// Delete old index
```

### 8. Deployment Errors

**❌ Environment-Specific Dependencies**
```typescript
// Problem: Different dependency versions in dev vs prod
// Development: pinecone-client v2.0.0
// Production: pinecone-client v1.5.0

// Solution: Lock dependency versions
// package.json
{
  "dependencies": {
    "@pinecone-database/pinecone": "2.0.0" // Exact version
  }
}
```

**❌ Missing Environment Variables**
```typescript
// Problem: API key not set in production
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY // undefined in prod
});

// Solution: Validate env vars on startup
import { z } from 'zod';

const envSchema = z.object({
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_ENVIRONMENT: z.string().min(1)
});

const env = envSchema.parse(process.env);
```

### 9. ID Structure Errors

**❌ Non-Unique IDs**
```typescript
// Problem: Duplicate IDs overwrite each other
await index.upsert([
  { id: 'doc1', values: embedding1 },
  { id: 'doc1', values: embedding2 } // Overwrites first
]);

// Solution: Ensure unique IDs
await index.upsert([
  { id: 'doc1#chunk1', values: embedding1 },
  { id: 'doc1#chunk2', values: embedding2 }
]);
```

**❌ ID Length Exceeded**
```typescript
// Problem: ID > 512 characters
const longId = `${'a'.repeat(600)}`; // 600 chars - ERROR!

// Solution: Hash long identifiers
import { createHash } from 'crypto';
const id = createHash('sha256').update(longString).digest('hex'); // 64 chars
```

### 10. Batch Processing Errors

**❌ Exceeding Batch Size**
```typescript
// Problem: Batch > 2MB
await index.upsert(largeVectorArray); // 5MB - ERROR!

// Solution: Chunk batches properly
import { chunk } from 'lodash';
const batches = chunk(vectors, 250);
for (const batch of batches) {
  await index.upsert(batch);
}
```

**❌ Not Handling Rate Limits**
```typescript
// Problem: Hitting rate limits with parallel requests
await Promise.all(
  batches.map(batch => index.upsert(batch))
); // Rate limit errors

// Solution: Use concurrency control
import pMap from 'p-map';
await pMap(
  batches,
  batch => index.upsert(batch),
  { concurrency: 10 } // Limit concurrent requests
);
```

### Recommendation for Lightfast

**Pre-Production Checklist:**

- [ ] Lock dependency versions in package.json
- [ ] Validate environment variables on startup
- [ ] Implement proper error handling with retries
- [ ] Use gRPC client for high throughput
- [ ] Set connection pool settings (Python)
- [ ] Cache index host (avoid describe_index calls)
- [ ] Implement structured logging with request IDs
- [ ] Monitor index_fullness metric
- [ ] Set up automated backups
- [ ] Design UI for eventual consistency
- [ ] Validate vector dimensions match index
- [ ] Ensure metadata < 40KB per vector
- [ ] Use proper filter syntax ($eq, $gte, etc.)
- [ ] Implement batch processing with concurrency control
- [ ] Handle rate limits with exponential backoff

---

## Scaling Strategies

### Scaling from 1M to 1B Vectors

**Serverless Architecture:**
- Designed for massive scale (5K to 5B vectors)
- Automatic scaling without manual configuration
- Storage decoupled from compute
- Intelligent caching adapts to access patterns

**Scaling Milestones:**

| Vectors | Storage | Approach | Considerations |
|---------|---------|----------|----------------|
| 1M | 3GB | Single namespace | Fast queries (<100ms) |
| 10M | 30GB | Multiple namespaces | Per-workspace isolation |
| 100M | 300GB | Serverless auto-scale | Monitor costs |
| 1B | 3TB | Serverless + optimization | Metadata efficiency critical |

### 1M Vectors (Startup Phase)

**Characteristics:**
- Small team, single product
- 1-10 workspaces
- Low query volume (<1K QPS)

**Configuration:**
```typescript
const index = await pinecone.createIndex({
  name: 'lightfast-memory',
  dimension: 768,
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});

// Use namespaces for workspaces
const namespace = `workspace_${workspaceId}`;
```

**Expected Performance:**
- Query latency: <50ms p95
- Storage cost: ~$10-20/month
- Query cost: ~$5-10/month

### 10M Vectors (Growth Phase)

**Characteristics:**
- Growing team, multiple products
- 10-100 workspaces
- Moderate query volume (1-10K QPS)

**Optimizations:**
- Selective metadata indexing (reduce memory)
- Application-level caching for frequent queries
- Monitor namespace sizes, split large workspaces

**Configuration:**
```typescript
// Same serverless config, scales automatically
// Optimize metadata
metadata_config: {
  indexed: ['workspace_id', 'entity_type', 'created_at']
}

// Implement caching
const queryCache = new LRUCache({ max: 1000, ttl: 300000 });
```

**Expected Performance:**
- Query latency: <100ms p95
- Storage cost: ~$100-200/month
- Query cost: ~$50-100/month

### 100M Vectors (Scale Phase)

**Characteristics:**
- Large team, multiple products
- 100-1000 workspaces
- High query volume (10-100K QPS)

**Optimizations:**
- Aggressive metadata size reduction (<5KB)
- Two-stage retrieval with reranking
- Separate indexes for different use cases
- Data retention policies (delete old data)

**Configuration:**
```typescript
// Multiple indexes for different latency requirements
const realtimeIndex = await pinecone.createIndex({
  name: 'lightfast-realtime',
  dimension: 512, // Smaller for speed
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
});

const archiveIndex = await pinecone.createIndex({
  name: 'lightfast-archive',
  dimension: 768, // Higher quality for archive
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
});

// Data retention
async function archiveOldData() {
  const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

  // Move old vectors to archive index
  const oldVectors = await fetchOldVectors(sixMonthsAgo);
  await archiveIndex.upsert(oldVectors);

  // Delete from realtime index
  await realtimeIndex.delete({
    filter: { created_at: { $lt: sixMonthsAgo } }
  });
}
```

**Expected Performance:**
- Query latency: <100ms p95 (realtime), <500ms p95 (archive)
- Storage cost: ~$1,000-2,000/month
- Query cost: ~$500-1,000/month

### 1B Vectors (Enterprise Phase)

**Characteristics:**
- Enterprise team, multiple products
- 1000+ workspaces
- Very high query volume (100K+ QPS)

**Optimizations:**
- Minimize metadata size (<3KB)
- Multiple specialized indexes (code, docs, conversations)
- Aggressive caching strategy
- Edge deployment for global latency
- Custom embedding models (smaller dimensions)

**Configuration:**
```typescript
// Specialized indexes
const codeIndex = await pinecone.createIndex({
  name: 'lightfast-code',
  dimension: 512, // Optimized for code
  metric: 'dotproduct', // Hybrid search
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
});

const docsIndex = await pinecone.createIndex({
  name: 'lightfast-docs',
  dimension: 768, // Higher quality for docs
  metric: 'cosine',
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
});

// Multi-region deployment
const euIndex = await pinecone.createIndex({
  name: 'lightfast-memory-eu',
  dimension: 768,
  spec: { serverless: { cloud: 'aws', region: 'eu-west-1' } }
});

// Global routing
async function query(region: string, params: QueryParams) {
  const index = region === 'eu' ? euIndex : usIndex;
  return await index.query(params);
}
```

**Expected Performance:**
- Query latency: <100ms p95 (multi-region)
- Storage cost: ~$10,000-20,000/month
- Query cost: ~$5,000-10,000/month

### Horizontal vs Vertical Scaling

**Serverless (Automatic Scaling):**
- No manual configuration
- Scales compute and storage independently
- Pay per use

**Pod-Based (Manual Scaling):**

**Vertical Scaling:**
```typescript
// Increase pod size (2x, 4x, 8x)
await pinecone.configureIndex({
  name: 'lightfast-memory',
  podType: 's1.x4' // 4x capacity
});
```

**Horizontal Scaling:**
```typescript
// Add replicas for higher throughput
await pinecone.configureIndex({
  name: 'lightfast-memory',
  replicas: 3 // 3x query throughput
});

// Each replica adds ~same QPS
// p1: ~20 QPS per replica
// p2: ~200 QPS per replica
```

### Monitoring and Alerting

```typescript
// Monitor index statistics
async function monitorIndex() {
  const stats = await index.describeIndexStats();

  // Alert on high fullness (pod-based)
  if (stats.indexFullness > 0.8) {
    alert('Index approaching capacity, consider upsize');
  }

  // Alert on large namespaces
  for (const [namespace, count] of Object.entries(stats.namespaces)) {
    if (count.recordCount > 1_000_000) {
      alert(`Namespace ${namespace} has ${count.recordCount} vectors`);
    }
  }

  // Track growth rate
  const growthRate = calculateGrowthRate(stats.totalRecordCount);
  if (growthRate > 0.1) { // >10% growth per day
    alert(`High growth rate: ${growthRate * 100}% per day`);
  }
}

// Schedule monitoring
cron.schedule('0 * * * *', monitorIndex); // Hourly
```

### Recommendation for Lightfast

**Scaling Strategy:**

1. **Start with Serverless** (1M-100M vectors)
   - Automatic scaling
   - Cost-effective
   - No capacity planning

2. **One Namespace Per Workspace** (up to 1M workspaces)
   - Physical isolation
   - Easy data deletion
   - Scales linearly

3. **Optimize Metadata Early** (<5KB per vector)
   - Avoids future migration pain
   - Better batch performance
   - Lower costs

4. **Implement Caching** (10M+ vectors)
   - Application-level cache
   - Semantic caching
   - Reduce query costs

5. **Multi-Index Architecture** (100M+ vectors)
   - Realtime index (hot data, <6 months)
   - Archive index (cold data, >6 months)
   - Specialized indexes (code, docs, etc.)

6. **Monitor Growth** (continuously)
   - Track vector count
   - Monitor costs
   - Alert on anomalies

**Expected Scaling Timeline:**
- Year 1: 1M-10M vectors (serverless)
- Year 2: 10M-100M vectors (serverless + caching)
- Year 3: 100M-1B vectors (multi-index + optimization)

---

## Recommendations for Lightfast

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Lightfast Memory                     │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  MCP API   │  │  REST API  │  │   Web UI   │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
│        │               │               │               │
│        └───────────────┴───────────────┘               │
│                        │                               │
│                ┌───────▼────────┐                      │
│                │ Query Service  │                      │
│                └───────┬────────┘                      │
│                        │                               │
│         ┌──────────────┼──────────────┐               │
│         │              │              │               │
│    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐          │
│    │ Cache   │   │ Rerank  │   │ Graph   │          │
│    │ (Redis) │   │(Pinecone)│   │  DB     │          │
│    └─────────┘   └─────────┘   └─────────┘          │
│                        │                               │
│                ┌───────▼────────┐                      │
│                │   Pinecone     │                      │
│                │   Serverless   │                      │
│                │                │                      │
│                │ Namespace per  │                      │
│                │   Workspace    │                      │
│                └────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### Pinecone Configuration

**Index Setup:**

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

// Production index
const index = await pinecone.createIndex({
  name: 'lightfast-memory-prod',
  dimension: 768, // Mixedbread or Voyage AI
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});

// Development index
const devIndex = await pinecone.createIndex({
  name: 'lightfast-memory-dev',
  dimension: 768,
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});
```

**Metadata Schema:**

```typescript
interface LightfastMetadata {
  // INDEXED FIELDS (8 fields max)
  workspace_id: string;           // For namespace isolation
  entity_type: EntityType;        // 'pr' | 'issue' | 'message' | 'doc'
  source: DataSource;             // 'github' | 'discord' | 'linear' | 'notion'
  created_at: number;             // Unix timestamp
  updated_at: number;             // Unix timestamp
  author_id: string;              // User/bot ID
  status?: string;                // 'open' | 'closed' | 'merged'

  // NON-INDEXED FIELDS
  title: string;                  // Display title
  preview: string;                // First 500 chars
  url: string;                    // Canonical URL

  // Keep total metadata < 5KB for optimal batching
}

type EntityType = 'pr' | 'issue' | 'message' | 'doc' | 'discussion' | 'commit';
type DataSource = 'github' | 'discord' | 'slack' | 'linear' | 'notion' | 'drive';
```

**Vector ID Structure:**

```typescript
// Hierarchical ID pattern
// Format: {source}_{entity_type}_{id}
// Examples:
const vectorId = `github_pr_${prNumber}`;
const vectorId = `discord_message_${messageId}`;
const vectorId = `linear_issue_${issueId}`;
const vectorId = `notion_doc_${docId}`;

// For chunked documents:
// Format: {source}_{entity_type}_{id}#chunk{n}
const vectorId = `notion_doc_${docId}#chunk${chunkIndex}`;

// Max length: 512 characters
// Use hash for very long IDs:
import { createHash } from 'crypto';
if (id.length > 400) {
  const hash = createHash('sha256').update(id).digest('hex');
  vectorId = `${source}_${entityType}_${hash}`;
}
```

### Ingestion Pipeline

**Real-Time Ingestion:**

```typescript
// Webhook handler
async function handleGitHubPR(event: GitHubPREvent) {
  // 1. Extract content
  const content = extractPRContent(event);

  // 2. Generate embedding (768 dims)
  const embedding = await embed(content);

  // 3. Prepare metadata
  const metadata: LightfastMetadata = {
    workspace_id: event.workspaceId,
    entity_type: 'pr',
    source: 'github',
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    author_id: event.authorId,
    status: event.status,
    title: event.title,
    preview: content.slice(0, 500),
    url: event.url
  };

  // 4. Upsert to Pinecone
  const namespace = `workspace_${event.workspaceId}`;
  await index.namespace(namespace).upsert([{
    id: `github_pr_${event.number}`,
    values: embedding,
    metadata
  }]);

  // 5. Update relationship graph (separate DB)
  await graphDB.createRelationships({
    pr: event.number,
    issues: event.linkedIssues,
    commits: event.commits
  });
}
```

**Batch Ingestion:**

```typescript
import { chunk } from 'lodash';
import pMap from 'p-map';

async function batchIngestGitHubData(workspaceId: string) {
  // 1. Fetch all PRs, issues, etc.
  const entities = await fetchAllEntities(workspaceId);

  // 2. Generate embeddings in parallel
  const vectors = await pMap(
    entities,
    async (entity) => ({
      id: `${entity.source}_${entity.type}_${entity.id}`,
      values: await embed(extractContent(entity)),
      metadata: buildMetadata(entity)
    }),
    { concurrency: 50 } // Parallel embeddings
  );

  // 3. Batch upsert to Pinecone
  const batches = chunk(vectors, 250);
  const namespace = `workspace_${workspaceId}`;

  await pMap(
    batches,
    async (batch) => {
      await index.namespace(namespace).upsert(batch);
    },
    { concurrency: 10 } // Parallel upserts
  );

  console.log(`Ingested ${vectors.length} vectors for workspace ${workspaceId}`);
}
```

### Query Service

**Basic Search:**

```typescript
async function search(params: {
  workspaceId: string;
  query: string;
  filters?: SearchFilters;
  topK?: number;
}): Promise<SearchResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await embed(params.query);

  // 2. Build Pinecone filter
  const filter = buildPineconeFilter(params.filters);

  // 3. Query Pinecone
  const namespace = `workspace_${params.workspaceId}`;
  const results = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK: params.topK || 20,
    filter,
    includeMetadata: true,
    includeValues: false
  });

  // 4. Format results
  return results.matches.map(match => ({
    id: match.id,
    score: match.score,
    type: match.metadata.entity_type,
    source: match.metadata.source,
    title: match.metadata.title,
    preview: match.metadata.preview,
    url: match.metadata.url,
    createdAt: match.metadata.created_at
  }));
}

function buildPineconeFilter(filters?: SearchFilters): Filter {
  const conditions: any = {};

  if (filters?.entityTypes?.length) {
    conditions.entity_type = { $in: filters.entityTypes };
  }

  if (filters?.sources?.length) {
    conditions.source = { $in: filters.sources };
  }

  if (filters?.dateRange) {
    conditions.created_at = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  if (filters?.authors?.length) {
    conditions.author_id = { $in: filters.authors };
  }

  if (filters?.status) {
    conditions.status = { $eq: filters.status };
  }

  return conditions;
}
```

**Two-Stage Search with Reranking:**

```typescript
async function enhancedSearch(params: SearchParams): Promise<SearchResult[]> {
  // Stage 1: Vector search (over-retrieve)
  const queryEmbedding = await embed(params.query);
  const namespace = `workspace_${params.workspaceId}`;

  const candidates = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK: 100, // Over-retrieve candidates
    filter: buildPineconeFilter(params.filters),
    includeMetadata: true,
    includeValues: false
  });

  // Stage 2: Rerank with Pinecone Rerank
  const reranked = await pinecone.inference.rerank({
    model: 'pinecone-rerank-v0',
    query: params.query,
    documents: candidates.matches.map(m => ({
      id: m.id,
      text: `${m.metadata.title}\n${m.metadata.preview}`
    })),
    topN: params.topK || 20
  });

  // 3. Format and return
  return reranked.data.map(result => {
    const match = candidates.matches.find(m => m.id === result.document.id);
    return {
      id: result.document.id,
      score: result.score, // Rerank score
      type: match.metadata.entity_type,
      source: match.metadata.source,
      title: match.metadata.title,
      preview: match.metadata.preview,
      url: match.metadata.url,
      createdAt: match.metadata.created_at
    };
  });
}
```

**Cached Search:**

```typescript
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache<string, SearchResult[]>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true
});

async function cachedSearch(params: SearchParams): Promise<SearchResult[]> {
  const cacheKey = createCacheKey(params);

  // Check cache
  const cached = queryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Perform search
  const results = await enhancedSearch(params);

  // Cache results
  queryCache.set(cacheKey, results);

  return results;
}

function createCacheKey(params: SearchParams): string {
  return `${params.workspaceId}_${params.query}_${JSON.stringify(params.filters)}`;
}
```

### Performance Targets

**Latency:**
- Warm namespace queries: <100ms p95
- Cold namespace queries: <500ms p95
- Cached queries: <10ms p95
- With reranking: <200ms p95

**Throughput:**
- Serverless auto-scales to demand
- No manual capacity planning
- Expected: 10-100K QPS

**Accuracy:**
- Basic search: >90% relevance
- With reranking: >95% relevance
- With hybrid search: >98% relevance

### Cost Estimates

**Storage (768 dims, 5KB metadata):**
- 1M vectors: $10-20/month
- 10M vectors: $100-200/month
- 100M vectors: $1,000-2,000/month

**Queries:**
- 1M queries/month: $5-10/month
- 10M queries/month: $50-100/month
- 100M queries/month: $500-1,000/month

**Total (10M vectors, 10M queries/month):**
- Storage: $150/month
- Queries: $75/month
- **Total: ~$225/month**

### Migration Plan

**Phase 1: Development (Month 1)**
- Set up Pinecone serverless index
- Implement ingestion pipeline
- Test basic search

**Phase 2: Beta (Month 2)**
- Launch to 10 beta workspaces
- Implement caching
- Monitor performance

**Phase 3: Production (Month 3)**
- Open to all users
- Implement reranking
- Set up monitoring/alerting

**Phase 4: Scale (Month 4-6)**
- Optimize metadata size
- Implement data retention
- Multi-index architecture

### Monitoring and Alerting

```typescript
// Metrics to track
const metrics = {
  // Performance
  query_latency_p50: 50, // ms
  query_latency_p95: 100, // ms
  query_latency_p99: 200, // ms

  // Usage
  queries_per_second: 100,
  vectors_ingested_per_day: 100_000,
  total_vectors: 10_000_000,

  // Cost
  storage_cost_per_month: 150, // USD
  query_cost_per_month: 75, // USD
  total_cost_per_month: 225, // USD

  // Quality
  search_relevance: 0.95, // 95% relevance
  cache_hit_rate: 0.6, // 60% cache hits

  // Errors
  error_rate: 0.001, // 0.1% errors
  timeout_rate: 0.0001 // 0.01% timeouts
};

// Alerts
const alerts = {
  high_latency: metrics.query_latency_p95 > 200,
  high_error_rate: metrics.error_rate > 0.01,
  high_cost: metrics.total_cost_per_month > 500,
  low_relevance: metrics.search_relevance < 0.9
};
```

### Summary

**Recommended Configuration:**
- **Index**: Pinecone serverless (AWS us-east-1)
- **Dimensions**: 768 (Voyage AI or Mixedbread)
- **Metric**: Cosine (or dotproduct for hybrid)
- **Namespace**: One per workspace
- **Metadata**: <5KB per vector, 8 indexed fields
- **Batch Size**: 250 vectors per upsert
- **Caching**: Redis + application-level
- **Reranking**: Pinecone Rerank for accuracy
- **Monitoring**: Query latency, costs, relevance

**Key Benefits:**
- <100ms search latency (p95)
- Automatic scaling to billions of vectors
- $225/month for 10M vectors + 10M queries
- 95%+ search relevance with reranking
- Physical workspace isolation
- Real-time updates (<1s latency)

---

## Conclusion

This guide synthesizes Pinecone best practices from official documentation, blog posts, case studies, and community discussions. The recommendations are tailored for Lightfast's use case: storing company memory with relationships and targeting <100ms search latency.

**Key Takeaways:**

1. **Use Serverless** for automatic scaling and cost efficiency
2. **One Namespace Per Workspace** for security and performance
3. **768 Dimensions** for optimal cost/performance balance
4. **<5KB Metadata** for efficient batching
5. **Two-Stage Retrieval** (vector search + rerank) for accuracy
6. **Application Caching** to reduce costs and latency
7. **Monitor Continuously** to optimize costs and performance

By following these best practices, Lightfast can deliver fast, accurate, cost-effective memory search at scale.

---

**References:**
- [Pinecone Documentation](https://docs.pinecone.io)
- [Pinecone Blog](https://www.pinecone.io/blog)
- [Pinecone Community](https://community.pinecone.io)
- [Optimizing Pinecone for Agents](https://www.pinecone.io/blog/optimizing-pinecone/)
- [Pinecone Serverless Architecture](https://www.pinecone.io/blog/serverless-architecture/)
- [Vector Search Filtering](https://www.pinecone.io/learn/vector-search-filtering/)
- [Two-Stage Retrieval with Reranking](https://www.pinecone.io/learn/series/rag/rerankers/)
