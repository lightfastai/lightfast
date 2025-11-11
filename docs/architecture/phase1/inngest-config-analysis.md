# Inngest Workflow Configuration Analysis

## Available Configuration Options

Based on Inngest SDK v3.44.3 type definitions and [official documentation](https://www.inngest.com/docs/guides/handling-idempotency):

### Core Configuration

```typescript
interface FunctionOptions {
  id: string;                    // Unique ID (required)
  name?: string;                 // Display name in UI
  description?: string;          // Function description
  retries?: 0-20;               // Max retries (default: 3)

  // Idempotency & Deduplication
  idempotency?: string;          // CEL expression for unique key (24hr window)
  singleton?: {                  // Only one run at a time per key
    key?: string;                // Optional scoping key
    mode: "skip" | "cancel";     // How to handle new runs
  };

  // Rate Limiting
  rateLimit?: {                  // Hard limit (lossy)
    key?: string;
    limit: number;
    period: TimeStr;
  };
  throttle?: {                   // Queue-based limit
    key?: string;
    limit: number;
    period: TimeStr;
    burst?: number;
  };

  // Timing & Batching
  debounce?: {                   // Delay execution
    key?: string;
    period: TimeStr;
    timeout?: TimeStr;
  };
  batchEvents?: {                // Process multiple events
    maxSize: number;
    timeout: TimeStrBatch;
    key?: string;
    if?: string;
  };

  // Execution Control
  concurrency?: number | ConcurrencyOption | [ConcurrencyOption, ConcurrencyOption];
  priority?: {
    run?: string;                // -600 to 600
  };
  timeouts?: {
    start?: TimeStr;             // Queue time limit
    finish?: TimeStr;            // Execution time limit
  };

  // Failure Handling
  onFailure?: Handler;
  cancelOn?: Cancellation[];

  // Performance
  optimizeParallelism?: boolean; // Reduce Promise resolution overhead
}
```

## Critical Insights

### 1. Idempotency Window
- **24 hour window** - After 24hrs, same key triggers new execution
- Uses CEL expressions: `"event.data.userId"` or `"event.data.userId + '-' + event.data.orderId"`
- **Ignored by debouncing and batching**

### 2. Idempotency vs Singleton
- **Idempotency**: Prevents duplicate work for same input (24hr dedup)
- **Singleton**: Ensures only one run active at a time for a key (execution control)
- **Use both**: Idempotency for dedup + singleton for exclusive execution

### 3. Rate Limiting vs Throttling
- **rateLimit**: Hard limit, drops excess (lossy)
- **throttle**: Queues excess (can cause backlog)
- **idempotency**: Different purpose (dedup, not rate control)

---

## Workflow Analysis

### 1. docs-ingestion (Webhook Orchestration)

**Current:**
```typescript
{
  id: "apps-console/docs-ingestion",
  name: "Docs Ingestion",
  retries: 3,
}
```

**Issues:**
- ❌ No idempotency (webhook redelivery will cause duplicate processing)
- ❌ No concurrency control (same repo can be processed concurrently → race conditions)
- ❌ No timeout (loading config from GitHub can hang)

**Recommended:**
```typescript
{
  id: "apps-console/docs-ingestion",
  name: "Docs Ingestion",
  retries: 3,

  // Prevent duplicate processing of same webhook delivery
  idempotency: 'event.data.deliveryId',

  // Only process one push per repo at a time (prevent concurrent ingestion)
  singleton: {
    key: 'event.data.repoFullName',
    mode: 'skip' // Skip if already processing this repo
  },

  // Timeout for GitHub API calls
  timeouts: {
    start: '2m',  // Max queue time
    finish: '15m' // Max execution (config load + file processing triggers)
  },

  // Clear description
  description: 'Orchestrates document ingestion from GitHub push webhooks'
}
```

**Why:**
- `idempotency` on `deliveryId`: GitHub may redeliver webhooks → same delivery = skip
- `singleton` on `repoFullName`: Prevent concurrent pushes to same repo from racing
- `timeouts`: Prevent runaway executions if GitHub API is slow

---

### 2. ensure-store (Store Provisioning)

**Current:**
```typescript
{
  id: "apps-console/ensure-store",
  name: "Ensure Store Exists",
  retries: 3,
  // Comment about idempotency but not implemented!
}
```

**Issues:**
- ❌ **CRITICAL**: No idempotency configured (duplicate Pinecone indexes can be created!)
- ❌ No singleton (concurrent calls can create duplicate stores)
- ❌ No timeout (Pinecone index creation can take minutes)

**Recommended:**
```typescript
{
  id: "apps-console/ensure-store",
  name: "Ensure Store Exists",
  retries: 5, // Pinecone API can be flaky, increase retries

  // CRITICAL: Prevent duplicate store/index creation
  idempotency: 'event.data.workspaceId + "-" + event.data.storeName',

  // Ensure exclusive execution per workspace+store
  singleton: {
    key: 'event.data.workspaceId + "-" + event.data.storeName',
    mode: 'skip' // If already creating, skip new request
  },

  // Pinecone index creation can be slow
  timeouts: {
    start: '1m',
    finish: '10m' // Pinecone index creation + DB write
  },

  description: 'Idempotently provisions store and Pinecone index'
}
```

**Why:**
- `idempotency` on `workspaceId + storeName`: Same store request within 24hrs → skip
- `singleton` on `workspaceId + storeName`: **CRITICAL** - prevents concurrent creation
- Higher retries (5): Pinecone API can have transient failures
- Longer timeout: Pinecone serverless index creation takes time

---

### 3. process-doc (Document Ingestion)

**Current:**
```typescript
{
  id: "apps-console/process-doc",
  name: "Process Document",
  retries: 3,
}
```

**Issues:**
- ❌ No idempotency (same file can be processed multiple times)
- ❌ No timeout (large files can hang)
- ⚠️ No deduplication for unchanged content (handled in workflow, could be config)

**Recommended:**
```typescript
{
  id: "apps-console/process-doc",
  name: "Process Document",
  retries: 3,

  // Prevent reprocessing same file at same commit
  idempotency: 'event.data.storeName + "-" + event.data.filePath + "-" + event.data.commitSha',

  // Timeout for large files
  timeouts: {
    start: '1m',
    finish: '10m' // Fetch + parse + chunk + embed + upsert
  },

  // Allow parallel processing (no singleton needed)
  concurrency: 10, // Process max 10 docs concurrently per store

  description: 'Processes single document: fetch, parse, chunk, embed, upsert'
}
```

**Why:**
- `idempotency` on `storeName + filePath + commitSha`: Same file at same commit = same vectors
- `concurrency`: Limit parallel processing to avoid overwhelming Pinecone/GitHub APIs
- `timeouts`: Prevent hanging on large files
- No singleton: Files can process in parallel

---

### 4. delete-doc (Document Deletion)

**Current:**
```typescript
{
  id: "apps-console/delete-doc",
  name: "Delete Document",
  retries: 3,
}
```

**Issues:**
- ❌ No idempotency (same deletion can run multiple times)
- ⚠️ Deletion is idempotent by nature, but wastes resources

**Recommended:**
```typescript
{
  id: "apps-console/delete-doc",
  name: "Delete Document",
  retries: 2, // Deletion is simpler, fewer retries needed

  // Prevent duplicate deletion work
  idempotency: 'event.data.storeName + "-" + event.data.filePath',

  // Timeout for Pinecone deletion
  timeouts: {
    start: '30s',
    finish: '5m' // Query + delete vectors + delete DB records
  },

  // Allow parallel deletions
  concurrency: 10,

  description: 'Deletes document and vectors from DB and Pinecone'
}
```

**Why:**
- `idempotency` on `storeName + filePath`: Same deletion within 24hrs = skip
- Lower retries (2): Deletion is simpler than ingestion
- Shorter timeouts: Deletion is faster than processing
- No singleton: Files can be deleted in parallel

---

## Summary of Changes

| Workflow | Critical Adds | Rationale |
|----------|---------------|-----------|
| **docs-ingestion** | `idempotency: deliveryId`<br>`singleton: repoFullName` | Prevent webhook redelivery duplicates<br>Prevent concurrent repo processing |
| **ensure-store** | `idempotency: workspace+store`<br>`singleton: workspace+store`<br>`retries: 5` | **PREVENT DUPLICATE PINECONE INDEXES**<br>Exclusive store creation<br>Handle Pinecone API flakiness |
| **process-doc** | `idempotency: store+file+sha`<br>`concurrency: 10` | Dedup same file processing<br>Limit parallel load |
| **delete-doc** | `idempotency: store+file`<br>`retries: 2` | Dedup deletion work<br>Simpler operation |

## Best Practices Applied

✅ **Idempotency for all workflows** - Prevent duplicate work
✅ **Singleton for exclusive ops** - Prevent race conditions (ensure-store, docs-ingestion)
✅ **Appropriate timeouts** - Prevent runaway executions
✅ **Concurrency limits** - Protect external APIs
✅ **Retry tuning** - More for flaky ops (Pinecone), less for simple ops (deletion)
✅ **Clear descriptions** - Self-documenting configuration

## Migration Impact

**Breaking Changes:**
- None (additive configuration only)

**Behavior Changes:**
- Webhook redeliveries will be skipped (idempotency)
- Concurrent pushes to same repo will be serialized (singleton)
- Same store creation requests will be deduplicated (idempotency + singleton)
- Timeouts will cancel long-running executions

**Testing Recommendations:**
1. Test webhook redelivery handling
2. Test concurrent pushes to same repository
3. Test concurrent store creation attempts
4. Monitor timeout occurrences in production
