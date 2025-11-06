# @repo/console-types

Shared TypeScript types and Zod schemas for Lightfast console.

## Purpose

Provides centralized type definitions for:
- API request/response schemas (`/v1/search`, `/v1/contents`)
- Document and chunk metadata
- Vector and embedding types
- Error codes and error types
- Common utilities

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

**API Types:**

```typescript
import { SearchRequestSchema, SearchResponse } from "@repo/console-types/api";

// Validate request
const request = SearchRequestSchema.parse({
  query: "search term",
  topK: 10,
  filters: { labels: ["store:docs-site"] }
});
```

**Document Types:**

```typescript
import { DocumentMetadata, ChunkMetadata } from "@repo/console-types/document";

const doc: DocumentMetadata = {
  storeId: "store-123",
  path: "docs/intro.md",
  slug: "/intro",
  title: "Introduction",
  contentHash: "abc123",
  commitSha: "def456",
  committedAt: new Date(),
  chunkCount: 5
};
```

**Error Types:**

```typescript
import { ErrorCode, APIError } from "@repo/console-types/error";

const error: APIError = {
  code: ErrorCode.STORE_NOT_FOUND,
  message: "Store not found",
  requestId: "req-123"
};
```

## Documentation

For API specifications, see [docs/architecture/phase1/package-structure.md](../../docs/architecture/phase1/package-structure.md).
