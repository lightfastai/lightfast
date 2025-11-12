# Embedding Model Lock Implementation

## Problem Statement

When adding a COHERE_API_KEY to the environment, the system was attempting to use a different embedding model (Cohere 1024D) than what was used to create the existing store (CharHash 1536D). This caused several issues:

1. **Dimension mismatch**: Pinecone indexes are immutable - once created with 1536D, they cannot accept 1024D vectors
2. **Semantic space violation**: You cannot mix different embedding models in the same vector store - query and document embeddings must use the same model for accurate similarity
3. **Silent skipping**: Documents were skipped as "content_unchanged" even though the embedding configuration had changed

## Solution: Store-Level Embedding Model Lock

We implemented a **store-level embedding model lock** that ensures embedding configuration consistency throughout the lifecycle of a store.

### Changes Made

#### 1. Store-Bound Embedding Provider Factory

**File**: `packages/console-embed/src/utils.ts`

Added `createEmbeddingProviderForStore()` function that:
- Takes store configuration (id, embeddingModel, embeddingDim)
- Uses the store's configured embedding model, NOT environment defaults
- Throws error if required API key is missing for store's model
- Prevents accidental model switching

```typescript
export function createEmbeddingProviderForStore(
    store: StoreEmbeddingConfig,
    config: EmbeddingProviderConfig,
): EmbeddingProvider
```

#### 2. Configuration Drift Detection

**File**: `api/console/src/inngest/workflow/ensure-store.ts`

Added configuration drift detection when store already exists:
- Compares store's embedding configuration with current environment defaults
- Logs warning if drift detected
- Recommends creating new store for new configuration
- Store continues using original configuration (immutable)

#### 3. Configuration Hash Tracking

**File**: `db/console/src/schema/tables/docs-documents.ts`

Added `configHash` field to track configuration used when document was processed:
```typescript
configHash: varchar("config_hash", { length: 64 })
```

This hash captures:
- Embedding model and dimension
- Chunking parameters (maxTokens, overlap)

#### 4. Updated Document Processing

**File**: `api/console/src/inngest/workflow/lib/document-processing.ts`

Changes:
- Added `computeConfigHash()` function
- Updated skip logic to check BOTH `contentHash` AND `configHash`
- Documents are re-processed if configuration changes (even if content unchanged)
- Logs when re-processing due to configuration change
- Uses store-bound embedding provider

#### 5. Updated Search Queries

**File**: `api/console/src/router/search.ts`

Changes:
- Uses `createEmbeddingProviderForStore()` instead of environment-based selection
- Query embeddings now match document embeddings (same model)

## Configuration Impact Matrix

| Configuration | Tracked in Store? | Immutable in Pinecone? | Impact if Changed | Required Action |
|--------------|-------------------|------------------------|-------------------|-----------------|
| Embedding Model | ✅ | ❌ (dimension is) | Different semantic space | Create new store |
| Embedding Dimension | ✅ | ✅ YES | Pinecone rejects mismatched vectors | Create new store |
| Chunk Max Tokens | ✅ | ❌ | Different chunk boundaries | Re-process all docs |
| Chunk Overlap | ✅ | ❌ | Different chunk boundaries | Re-process all docs |
| Pinecone Metric | ✅ | ✅ YES | Different similarity calculations | Create new index |
| Pinecone Cloud | ✅ | ✅ YES | Cannot change after creation | Create new index |
| Pinecone Region | ✅ | ✅ YES | Cannot change after creation | Create new index |

## How It Works Now

### Scenario 1: Creating New Store

```yaml
# lightfast.yml
version: 1
store: docs
include:
  - "**/*.md"
```

1. Environment has `COHERE_API_KEY` set
2. `ensure-store` workflow creates store with:
   - `embeddingModel: "embed-english-v3.0"`
   - `embeddingDim: 1024`
   - Pinecone index created with 1024D
3. All documents embedded with Cohere 1024D
4. All queries use Cohere 1024D
5. ✅ **Same semantic space - perfect similarity**

### Scenario 2: Existing Store (CharHash) + New COHERE_API_KEY

1. Store exists with:
   - `embeddingModel: "char-hash-1536"`
   - `embeddingDim: 1536`
   - Pinecone index has 1536D vectors
2. Add `COHERE_API_KEY` to environment
3. Next ingestion:
   - `ensure-store` detects configuration drift
   - Logs warning recommending new store
   - ✅ **Store continues using CharHash 1536D**
4. Documents: Embedded with CharHash 1536D (store's config)
5. Queries: Embedded with CharHash 1536D (store's config)
6. ✅ **Same semantic space - perfect similarity**

### Scenario 3: Configuration Change (e.g., chunking)

1. Update `PRIVATE_CONFIG.chunking.maxTokens` from 512 → 768
2. Next ingestion:
   - Computes new `configHash`
   - Compares with existing documents' `configHash`
   - Documents have different hash → re-process
3. ✅ **All documents re-chunked and re-embedded**

## Migration Guide for Your Current Situation

You have two options:

### Option A: Keep Using CharHash (Simplest)

```bash
# Remove COHERE_API_KEY temporarily
unset COHERE_API_KEY

# System continues using CharHash
# Everything works as before
```

### Option B: Create New Store with Cohere (Recommended)

```yaml
# lightfast.yml
version: 1
store: docs-v2  # New store name
include:
  - "**/*.md"
```

```bash
# Keep COHERE_API_KEY set
export COHERE_API_KEY="your-key"

# Re-trigger ingestion (GitHub push or manual trigger)
# New store created with Cohere 1024D
# All documents re-embedded with Cohere
```

Old store (`docs`) remains unchanged with CharHash vectors.

## Database Migration Required

Before deploying these changes, you need to add the `configHash` column:

```sql
-- Add configHash column to docs_documents table
ALTER TABLE lightfast_docs_documents
ADD COLUMN config_hash VARCHAR(64);

-- Existing documents will have NULL configHash
-- They will be re-processed on next ingestion to populate the hash
```

Or use Drizzle migrations:

```bash
cd db/console
pnpm db:generate  # Generate migration
pnpm db:migrate   # Apply migration
```

## Key Benefits

1. **Semantic Space Integrity**: Ensures query and document embeddings always use the same model
2. **Dimension Safety**: Prevents dimension mismatch errors when querying Pinecone
3. **Configuration Auditability**: Track which configuration was used for each document
4. **Automatic Re-processing**: Documents automatically re-processed when configuration changes
5. **Clear Error Messages**: Helpful errors if API key missing for store's model

## Testing Checklist

- [ ] Create new store with CharHash (no API key)
- [ ] Ingest documents to CharHash store
- [ ] Query CharHash store (verify results)
- [ ] Add COHERE_API_KEY
- [ ] Verify existing store continues using CharHash (check logs)
- [ ] Create new store with different name
- [ ] Verify new store uses Cohere
- [ ] Ingest documents to Cohere store
- [ ] Query Cohere store (verify results)
- [ ] Change chunking config
- [ ] Verify documents re-processed

## Future Enhancements

1. **Store Migration Workflow**: Automated migration from one embedding model to another
2. **Multi-Model Support**: Allow multiple stores with different models in same workspace
3. **Configuration Versioning**: Track configuration history per store
4. **Batch Re-processing**: Efficient re-processing of large document sets when config changes
