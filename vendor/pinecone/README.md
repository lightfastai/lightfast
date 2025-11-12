# @vendor/pinecone

Type-safe wrapper around the official `@pinecone-database/pinecone` SDK for vector operations.

## Purpose

Provides a clean abstraction over the Pinecone SDK with:
- Type-safe vector operations (upsert, query, delete)
- Index management (create, delete, wait-until-ready)
- Error handling with custom error types
- Observability-friendly logging hooks

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { PineconeClient } from "@vendor/pinecone/client";

const client = new PineconeClient();

// Create index (caller handles index naming logic)
await client.createIndex("my-index-name", 1536);

// Upsert vectors
await client.upsertVectors("my-index-name", {
  ids: ["vec-1", "vec-2"],
  vectors: [[...], [...]],
  metadata: [{ title: "Doc 1" }, { title: "Doc 2" }]
});

// Query vectors
const results = await client.query("my-index-name", {
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
