# @repo/console-pinecone

Console-specific Pinecone utilities with typed vector metadata for document ingestion.

## Purpose

This package provides console application-specific vector metadata types and utilities built on top of `@vendor/pinecone`. It defines the schema for document metadata stored in Pinecone indexes.

## Usage

```typescript
import { VectorMetadata } from "@repo/console-pinecone";
import { pineconeClient } from "@vendor/pinecone";

// Create metadata with console-specific fields
const metadata: VectorMetadata = {
  text: "chunk content",
  path: "docs/guide.md",
  slug: "guide",
  contentHash: "abc123",
  chunkIndex: 0,
  docId: "doc_123",
  title: "Guide",
  snippet: "chunk content...",
  url: "/guide",
};

// Upsert with type-safe metadata
await pineconeClient.upsertVectors("index-name", {
  ids: ["vec_1"],
  vectors: [[0.1, 0.2, ...]],
  metadata: [metadata],
});
```

## Architecture

- **@vendor/pinecone**: Pure Pinecone SDK wrapper (generic)
- **@repo/console-pinecone**: Console-specific metadata schema (this package)
