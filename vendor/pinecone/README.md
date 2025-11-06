# @vendor/pinecone

Type-safe wrapper around Mastra Pinecone client for vector operations.

## Purpose

Provides a clean abstraction over the `@mastra/pinecone` client with:
- Type-safe vector operations (upsert, query, delete)
- Index management (create, delete)
- Automatic index name resolution per workspace/store
- Error handling with exponential backoff
- Observability hooks for latency tracking

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { PineconeClient } from "@vendor/pinecone/client";

const client = new PineconeClient();

// Create index
const indexName = await client.createIndex("workspace-123", "docs-site", 1536);

// Upsert vectors
await client.upsertVectors(indexName, {
  vectors: [
    { id: "vec-1", values: [...], metadata: { title: "Document" } }
  ]
});

// Query vectors
const results = await client.query(indexName, {
  vector: [...],
  topK: 10,
  includeMetadata: true
});
```

## Environment Variables

```bash
PINECONE_API_KEY=pc_...
```

## Documentation

For integration details, see [docs/architecture/phase1/mastra-integration.md](../../docs/architecture/phase1/mastra-integration.md).
