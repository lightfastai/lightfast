---
title: Package Structure (Phase 1 — Docs)
description: Monorepo package organization for docs ingestion and search
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [architecture, packages, monorepo]
---

# Package Structure (Phase 1 — Docs)

This document defines the package structure for Phase 1 docs ingestion and search, following existing monorepo patterns and conventions.

---

## Overview

Phase 1 introduces **7 new packages** and updates **2 existing packages** to support:
- Push-to-main docs ingestion via GitHub webhooks
- Vector storage using Mastra Pinecone
- Store-scoped search via `/v1/search` API
- Type-safe configuration with `lightfast.yml`

All packages follow the established naming convention: `console-*` prefix for shared packages.

---

## Package Map

```
lightfast/
├── db/
│   └── console/              # NEW: Lightfast database schemas
├── vendor/
│   ├── pinecone/             # NEW: Mastra Pinecone wrapper
│   └── db/                   # UPDATE: Add console client exports
├── packages/
│   ├── console-config/       # NEW: lightfast.yml parsing
│   ├── console-chunking/     # NEW: Text chunking and MDX parsing
│   ├── console-embed/        # NEW: Embedding computation
│   └── console-types/        # NEW: Shared TypeScript types
├── api/
│   └── console/              # UPDATE: Add Inngest workflows + tRPC routers
├── apps/
│   ├── console/              # UPDATE: Add Inngest route, update webhooks
│   └── docs/                 # FUTURE: Add /api/search proxy
└── core/
    └── cli/                  # NEW: CLI for config validation
```

---

## Database Layer (`db/`)

### `@db/console` (NEW)

**Purpose:** Drizzle ORM schemas for Lightfast data model

**Location:** `db/console/`

**Schemas:**
- `lf_stores` - Store identity and config per `(workspaceId, store)`
- `lf_docs_documents` - Document state per repo-relative file path
- `lf_vector_entries` - Chunk → vector ID mapping for idempotent upsert/delete
- `lf_ingestion_commits` - Idempotency and audit trail for push deliveries

**Structure:**
```
db/console/
├── src/
│   ├── schema/
│   │   ├── stores.ts             # Store table schema
│   │   ├── docs-documents.ts     # Document table schema
│   │   ├── vector-entries.ts     # Vector mapping schema
│   │   └── ingestion-commits.ts  # Commit audit schema
│   ├── client.ts                 # Database client factory
│   └── index.ts                  # Exports
├── drizzle/                      # Migrations directory
├── drizzle.config.ts             # Drizzle config
└── package.json
```

**Dependencies:**
- `drizzle-orm` (catalog)
- `@planetscale/database` (catalog)
- `@vendor/db` (workspace)

**Exports:**
```typescript
export { stores, docsDocuments, vectorEntries, ingestionCommits } from './schema';
export { createClient, db } from './client';
export type * from './schema';
```

**Reference:** See `data-model.md` for detailed schema definitions.

---

## Vendor Layer (`vendor/`)

### `@vendor/pinecone` (NEW)

**Purpose:** Type-safe wrapper around `@pinecone-database/pinecone` SDK

**Location:** `vendor/pinecone/`

**Structure:**
```
vendor/pinecone/
├── src/
│   ├── client.ts     # PineconeVector wrapper class
│   ├── types.ts      # Type definitions
│   ├── errors.ts     # Error classes
│   ├── env.ts        # Environment config
│   └── index.ts      # Exports
└── package.json
```

**Dependencies:**
- `@pinecone-database/pinecone` (catalog)
- `@t3-oss/env-nextjs` (catalog)
- `zod` (catalog)

**Key Methods:**
```typescript
class PineconeClient {
  // Index management
  async createIndex(workspaceId: string, storeName: string, dimension: number): Promise<string>;
  async deleteIndex(indexName: string): Promise<void>;

  // Vector operations
  async upsertVectors(indexName: string, vectors: UpsertRequest): Promise<UpsertResponse>;
  async deleteVectors(indexName: string, vectorIds: string[]): Promise<void>;
  async query(indexName: string, query: QueryRequest): Promise<QueryResponse>;

  // Utilities
  resolveIndexName(workspaceId: string, storeName: string): string;
}
```

**Environment:**
```typescript
export const env = createEnv({
  server: {
    PINECONE_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
});
```

**Error Handling:**
- Exponential backoff for transient failures
- Detailed error messages with request context
- Observability hooks for latency tracking

**Reference:** See `mastra-integration.md` for usage patterns.

---

### `@vendor/db` (UPDATE)

**Purpose:** Add exports for Lightfast database client

**Changes:**
- Export `@db/console` client alongside existing `@db/chat`, `@db/www` clients
- No schema changes to existing database packages

---

## Shared Packages (`packages/`)

### `@repo/console-config` (NEW)

**Purpose:** Parse and validate `lightfast.yml` configuration

**Location:** `packages/console-config/`

**Structure:**
```
packages/console-config/
├── src/
│   ├── parse.ts      # Config file parsing
│   ├── schema.ts     # Zod validation schemas
│   ├── resolve.ts    # Workspace/store resolution
│   ├── glob.ts       # Glob pattern utilities
│   └── index.ts      # Exports
└── package.json
```

**Dependencies:**
- `zod` (catalog)
- `yaml` (catalog)
- `fast-glob` (catalog)

**Config Schema:**
```typescript
export const LightfastConfigSchema = z.object({
  version: z.literal(1),
  workspace: z.string().optional(), // Resolve from env if omitted
  store: z.string().min(1),         // Human-readable store name
  include: z.array(z.string()).min(1), // Glob patterns (repo-relative)
});

export type LightfastConfig = z.infer<typeof LightfastConfigSchema>;
```

**Key Functions:**
```typescript
// Load and parse config
export async function loadConfig(repoPath: string): Promise<Result<LightfastConfig, ConfigError>>;

// Validate config structure
export function validateConfig(config: unknown): Result<LightfastConfig, ZodError>;

// Resolve workspace from env or config
export function resolveWorkspace(config: LightfastConfig): Result<string, WorkspaceError>;

// Match files against include globs
export async function matchFiles(repoPath: string, globs: string[]): Promise<string[]>;
```

**Reference:** See `dx-configuration.md` for config specification.

---

### `@repo/console-chunking` (NEW)

**Purpose:** Text chunking, MDX parsing, and content hashing

**Location:** `packages/console-chunking/`

**Structure:**
```
packages/console-chunking/
├── src/
│   ├── chunk.ts         # Token-based chunking algorithm
│   ├── mdx.ts           # MDX frontmatter extraction
│   ├── slug.ts          # Slug/URL derivation
│   ├── hash.ts          # Content hashing (SHA-256)
│   ├── types.ts         # Type definitions
│   └── index.ts         # Exports
└── package.json
```

**Dependencies:**
- `@repo/console-types` (workspace)
- `gray-matter` (catalog) - Frontmatter parsing
- `js-tiktoken` (catalog) - Token counting

**Key Types:**
```typescript
export interface ChunkOptions {
  maxTokens: number;      // Max tokens per chunk (default: 512)
  overlap: number;        // Token overlap between chunks (default: 50)
  preserveBoundaries: boolean; // Respect paragraph/code block boundaries
}

export interface Chunk {
  index: number;          // 0-based chunk index
  text: string;           // Chunk content
  tokens: number;         // Token count
  startOffset: number;    // Byte offset in original text
  endOffset: number;
}

export interface MDXMetadata {
  frontmatter: Record<string, unknown>;
  title?: string;
  description?: string;
  slug: string;
  contentHash: string;    // SHA-256 of body (excluding frontmatter)
}
```

**Key Functions:**
```typescript
// Chunk text with configurable options
export function chunkText(text: string, options?: Partial<ChunkOptions>): Chunk[];

// Parse MDX file and extract metadata
export async function parseMDX(filePath: string, content: string): Promise<MDXMetadata>;

// Derive slug from file path
export function deriveSlug(filePath: string, basePath: string): string;

// Compute content hash (SHA-256)
export function hashContent(content: string): string;
```

**Chunking Strategy:**
- Default: 512 tokens per chunk, 50 token overlap
- Preserve semantic boundaries (paragraphs, code blocks)
- Use tiktoken for accurate token counting (GPT-4 encoding)

---

### `@repo/console-embed` (NEW)

**Purpose:** Embedding computation with swappable providers

**Location:** `packages/console-embed/`

**Structure:**
```
packages/console-embed/
├── src/
│   ├── char-hash.ts     # Phase 1: char-hash 1536 implementation
│   ├── model.ts         # Phase 2: model-based embeddings
│   ├── batch.ts         # Batch processing utilities
│   ├── types.ts         # Type definitions
│   └── index.ts         # Exports
└── package.json
```

**Dependencies:**
- `@repo/console-types` (workspace)
- Phase 2: `openai` (catalog), `@anthropic-ai/sdk` (catalog)

**Key Types:**
```typescript
export interface EmbedRequest {
  texts: string[];
  model?: "char-hash-1536" | "openai-text-embedding-3-small";
}

export interface EmbedResponse {
  embeddings: number[][];  // Each embedding matches dimension
  model: string;
  usage?: {
    totalTokens: number;
  };
}

export interface EmbeddingProvider {
  readonly dimension: number;
  embed(texts: string[]): Promise<EmbedResponse>;
}
```

**Providers:**

**Phase 1: Character Hash (char-hash-1536)**
```typescript
export class CharHashEmbedding implements EmbeddingProvider {
  readonly dimension = 1536;

  async embed(texts: string[]): Promise<EmbedResponse> {
    const embeddings = texts.map(text => this.hashToVector(text));
    return { embeddings, model: "char-hash-1536" };
  }

  private hashToVector(text: string): number[] {
    // Simple deterministic embedding for Phase 1
    // Use character frequencies + n-grams to generate 1536-dim vector
  }
}
```

**Phase 2: Model-Based**
```typescript
export class OpenAIEmbedding implements EmbeddingProvider {
  readonly dimension = 1536;

  async embed(texts: string[]): Promise<EmbedResponse> {
    // Call OpenAI text-embedding-3-small API
  }
}
```

**Batch Processing:**
```typescript
// Process texts in batches to avoid rate limits
export async function embedBatch(
  texts: string[],
  provider: EmbeddingProvider,
  batchSize = 100
): Promise<number[][]>;
```

**Reference:** See `mastra-integration.md` for embedding details.

---

### `@repo/console-types` (NEW)

**Purpose:** Shared TypeScript types and Zod schemas

**Location:** `packages/console-types/`

**Structure:**
```
packages/console-types/
├── src/
│   ├── api/
│   │   ├── search.ts       # /v1/search types
│   │   ├── contents.ts     # /v1/contents types
│   │   └── common.ts       # Common API types
│   ├── document.ts         # Document metadata types
│   ├── vector.ts           # Vector and embedding types
│   ├── error.ts            # Error types
│   └── index.ts            # Exports
└── package.json
```

**Dependencies:**
- `zod` (catalog)

**API Types:**

**Search Request/Response (`api/search.ts`)**
```typescript
export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(100).default(10),
  filters: z.object({
    labels: z.array(z.string()).optional(), // e.g., ["store:docs-site"]
  }).optional(),
  includeHighlights: z.boolean().default(true),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = z.object({
  id: z.string(),           // Document/chunk ID
  title: z.string(),
  url: z.string(),
  snippet: z.string(),      // Highlighted snippet
  score: z.number(),        // Relevance score
  metadata: z.record(z.unknown()),
});

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  requestId: z.string(),
  latency: z.object({
    total: z.number(),
    retrieval: z.number(),
    rerank: z.number().optional(),
  }),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
```

**Contents Request/Response (`api/contents.ts`)**
```typescript
export const ContentsRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(50), // Batch fetch by IDs
});

export const DocumentContentSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string(),      // Full document content
  metadata: z.record(z.unknown()),
  committedAt: z.string(),  // ISO 8601
});

export const ContentsResponseSchema = z.object({
  documents: z.array(DocumentContentSchema),
  requestId: z.string(),
});

export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;
```

**Document Types (`document.ts`)**
```typescript
export interface DocumentMetadata {
  storeId: string;
  path: string;
  slug: string;
  title?: string;
  description?: string;
  contentHash: string;
  commitSha: string;
  committedAt: Date;
  frontmatter?: Record<string, unknown>;
  chunkCount: number;
}

export interface ChunkMetadata {
  docId: string;
  chunkIndex: number;
  text: string;
  vectorId: string;
}
```

**Error Types (`error.ts`)**
```typescript
export enum ErrorCode {
  INVALID_REQUEST = "INVALID_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  STORE_NOT_FOUND = "STORE_NOT_FOUND",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface APIError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}
```

---

## API Layer (`api/`)

### `@api/console` (UPDATE)

**Purpose:** Add Inngest workflows and tRPC routers for docs ingestion and search

**Location:** `api/console/`

**Changes:**

#### 1. Add Inngest Workflows

**Structure:**
```
api/console/src/inngest/
├── client/
│   └── client.ts           # Inngest client with event schemas
├── workflow/
│   ├── docs-ingestion.ts   # Main ingestion workflow
│   ├── chunk-upsert.ts     # Chunk embedding + upsert step
│   └── doc-delete.ts       # Document deletion step
└── index.ts                # Export workflows + route context
```

**Event Schemas (`client/client.ts`):**
```typescript
import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

const eventsMap = {
  "console/docs.push": {
    data: z.object({
      workspaceId: z.string(),
      storeName: z.string(),
      beforeSha: z.string(),
      afterSha: z.string(),
      deliveryId: z.string(),
      changedFiles: z.array(z.object({
        path: z.string(),
        status: z.enum(["added", "modified", "removed"]),
      })),
    }),
  },
  "console/docs.chunk.upsert": {
    data: z.object({
      storeId: z.string(),
      docId: z.string(),
      chunks: z.array(z.object({
        index: z.number(),
        text: z.string(),
        embedding: z.array(z.number()),
      })),
    }),
  },
};

export const inngest = new Inngest({
  id: "console",
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(eventsMap),
});
```

**Main Workflow (`workflow/docs-ingestion.ts`):**
```typescript
import { inngest } from "../client/client";

export const docsIngestion = inngest.createFunction(
  { id: "docs-ingestion", name: "Docs Push-to-Main Ingestion" },
  { event: "console/docs.push" },
  async ({ event, step }) => {
    // 1. Check idempotency
    const isDuplicate = await step.run("check-duplicate", async () => {
      return checkIngestionCommit(event.data.storeName, event.data.afterSha);
    });

    if (isDuplicate) {
      return { status: "skipped", reason: "duplicate commit" };
    }

    // 2. Process each changed file
    const results = await step.run("process-files", async () => {
      const results = [];

      for (const file of event.data.changedFiles) {
        if (file.status === "removed") {
          await deleteDocument(event.data.storeId, file.path);
          results.push({ path: file.path, status: "deleted" });
        } else {
          // Fetch file content, parse MDX, chunk, embed, upsert
          const result = await ingestDocument(event.data, file);
          results.push(result);
        }
      }

      return results;
    });

    // 3. Record commit
    await step.run("record-commit", async () => {
      await recordIngestionCommit({
        storeId: event.data.storeId,
        beforeSha: event.data.beforeSha,
        afterSha: event.data.afterSha,
        deliveryId: event.data.deliveryId,
        status: "processed",
      });
    });

    return { status: "processed", results };
  }
);
```

**Export (`index.ts`):**
```typescript
export { inngest } from "./client/client";
export { docsIngestion } from "./workflow/docs-ingestion";

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [docsIngestion],
    servePath: "/api/inngest",
  });
}
```

#### 2. Add tRPC Routers

**Search Router (`router/search.ts`):**
```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../trpc";
import { SearchRequestSchema } from "@repo/console-types";
import { pineconeClient } from "@vendor/pinecone";

export const searchRouter = {
  query: publicProcedure
    .input(SearchRequestSchema)
    .query(async ({ input, ctx }) => {
      const { query, topK, filters } = input;

      // Extract store from filters
      const storeLabel = filters?.labels?.find(l => l.startsWith("store:"));
      if (!storeLabel) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Store label required" });
      }

      const storeName = storeLabel.replace("store:", "");

      // Resolve index name
      const indexName = pineconeClient.resolveIndexName(ctx.workspaceId, storeName);

      // Query vectors
      const results = await pineconeClient.query(indexName, {
        vector: await embedQuery(query),
        topK,
        includeMetadata: true,
      });

      // Map to SearchResponse
      return mapToSearchResponse(results);
    }),
} satisfies TRPCRouterRecord;
```

**Contents Router (`router/contents.ts`):**
```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../trpc";
import { ContentsRequestSchema } from "@repo/console-types";
import { db } from "@db/console";

export const contentsRouter = {
  fetch: publicProcedure
    .input(ContentsRequestSchema)
    .query(async ({ input, ctx }) => {
      // Fetch documents by IDs from database
      const documents = await db
        .select()
        .from(docsDocuments)
        .where(inArray(docsDocuments.id, input.ids));

      return { documents, requestId: generateRequestId() };
    }),
} satisfies TRPCRouterRecord;
```

**Update Root Router (`root.ts`):**
```typescript
import { searchRouter } from "./router/search";
import { contentsRouter } from "./router/contents";

export const appRouter = createTRPCRouter({
  // Existing routers
  organization: organizationRouter,
  repository: repositoryRouter,

  // New routers
  search: searchRouter,
  contents: contentsRouter,
});
```

**Dependencies to Add:**
- `@repo/console-config` (workspace)
- `@repo/console-chunking` (workspace)
- `@repo/console-embed` (workspace)
- `@repo/console-types` (workspace)
- `@vendor/pinecone` (workspace)
- `@db/console` (workspace)

---

## Integration (`apps/`)

### `apps/console` (UPDATE)

**Purpose:** Add Inngest route and update GitHub webhook handler

**Changes:**

#### 1. Add Inngest Route

**File:** `apps/console/src/app/(inngest)/api/inngest/route.ts`

```typescript
import { createInngestRouteContext } from "@api/console/inngest";
import type { NextRequest } from "next/server";

const handlers = createInngestRouteContext();

export const GET = handlers.GET as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;

export const POST = handlers.POST as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;

export const PUT = handlers.PUT as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;
```

#### 2. Update GitHub Webhook Handler

**File:** `apps/console/src/app/(github)/api/github/webhooks/route.ts`

**Add Push Event Handler:**
```typescript
// Add to GitHubWebhookEvent type
type GitHubWebhookEvent =
  | "push"  // NEW
  | "installation"
  | "installation_repositories"
  | "repository";

// Add PushPayload interface
interface PushPayload {
  ref: string;           // e.g., "refs/heads/main"
  before: string;        // Commit SHA before push
  after: string;         // Commit SHA after push
  repository: {
    id: number;
    full_name: string;
    default_branch: string;
  };
  installation?: {
    id: number;
  };
  commits: Array<{
    id: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}

// Add push event handler
async function handlePushEvent(payload: PushPayload, deliveryId: string) {
  // Only process pushes to default branch
  const branch = payload.ref.replace("refs/heads/", "");
  if (branch !== payload.repository.default_branch) {
    return;
  }

  console.log(`[Webhook] Push to ${payload.repository.full_name}:${branch}`);

  // Aggregate changed files across all commits
  const changedFiles = new Map<string, "added" | "modified" | "removed">();
  for (const commit of payload.commits) {
    commit.added.forEach(path => changedFiles.set(path, "added"));
    commit.modified.forEach(path => changedFiles.set(path, "modified"));
    commit.removed.forEach(path => changedFiles.set(path, "removed"));
  }

  // Load lightfast.yml from repo to get workspace + store config
  const config = await loadRepoConfig(payload.repository.full_name, payload.after);
  if (!config) {
    console.log(`[Webhook] No lightfast.yml found, skipping ingestion`);
    return;
  }

  // Filter changed files by config globs
  const matchedFiles = Array.from(changedFiles.entries())
    .filter(([path]) => matchesGlobs(path, config.include))
    .map(([path, status]) => ({ path, status }));

  if (matchedFiles.length === 0) {
    console.log(`[Webhook] No matching docs changed, skipping`);
    return;
  }

  // Trigger Inngest workflow
  await inngest.send({
    name: "console/docs.push",
    data: {
      workspaceId: config.workspace || payload.repository.full_name,
      storeName: config.store,
      beforeSha: payload.before,
      afterSha: payload.after,
      deliveryId,
      changedFiles: matchedFiles,
    },
  });

  console.log(`[Webhook] Triggered ingestion for ${matchedFiles.length} files`);
}

// Update switch statement
switch (event) {
  case "push":
    await handlePushEvent(body as PushPayload, deliveryId);
    break;
  // ... existing handlers
}
```

**Dependencies to Add:**
- `@repo/console-config` (workspace)
- `@api/console` (workspace) - for Inngest client

---

### `apps/docs` (FUTURE - Phase 1.5)

**Purpose:** Add search proxy to Fumadocs

**File:** `apps/docs/src/app/api/search/route.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@api/console";
import SuperJSON from "superjson";

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.CONSOLE_API_URL}/api/trpc`,
      transformer: SuperJSON,
    }),
  ],
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // Call Lightfast search API
  const response = await trpc.search.query.query({
    query,
    topK: 10,
    filters: {
      labels: ["store:docs-site"],
    },
  });

  // Map to Fumadocs search shape
  const results = response.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
  }));

  return NextResponse.json({ results });
}
```

---

## Core Tooling (`core/`)

### `core/cli` (NEW)

**Purpose:** CLI for local testing and validation of `lightfast.yml`

**Location:** `core/cli/`

**Structure:**
```
core/cli/
├── src/
│   ├── commands/
│   │   ├── validate.ts      # Validate lightfast.yml
│   │   ├── test-search.ts   # Test search locally
│   │   └── sync.ts          # Manual ingestion (future)
│   ├── index.ts             # CLI entrypoint
│   └── bin.ts               # Binary wrapper
├── package.json
└── tsconfig.json
```

**Dependencies:**
- `commander` (catalog) - CLI framework
- `chalk` (catalog) - Terminal colors
- `ora` (catalog) - Spinners
- `@repo/console-config` (workspace)
- `@repo/console-chunking` (workspace)
- `@repo/console-embed` (workspace)

**Commands:**

**Validate Config:**
```bash
lightfast validate [--config lightfast.yml]
```

Checks:
- Config file exists
- Valid YAML syntax
- Schema validation
- Workspace resolution
- Include globs match at least one file

**Test Search (Future):**
```bash
lightfast test-search "query" [--store docs-site]
```

Queries local Pinecone index for testing.

**Binary Setup (`package.json`):**
```json
{
  "name": "@lightfastai/cli",
  "version": "0.1.0",
  "bin": {
    "lightfast": "./dist/bin.js"
  },
  "scripts": {
    "build": "tsup src/index.ts src/bin.ts --format esm --dts",
    "dev": "tsup src/index.ts src/bin.ts --format esm --watch"
  }
}
```

---

## Implementation Order

### Phase 1.1: Foundation (Week 1)
1. ✅ Define package structure (this document)
2. Create `@db/console` with Drizzle schemas
3. Create `@vendor/pinecone` wrapper
4. Create `@repo/console-types`

### Phase 1.2: Processing (Week 2)
5. Create `@repo/console-config`
6. Create `@repo/console-chunking`
7. Create `@repo/console-embed` (char-hash only)

### Phase 1.3: Integration (Week 3)
8. Update `@api/console` with Inngest workflows
9. Update `@api/console` with tRPC routers
10. Update `apps/console` webhook handler
11. Add `apps/console` Inngest route

### Phase 1.4: Tooling (Week 4)
12. Create `core/cli` for validation
13. Add end-to-end tests
14. Documentation and examples

### Phase 1.5: Docs Integration (Week 5)
15. Add `apps/docs` search proxy
16. Test with real docs

---

## Testing Strategy

### Unit Tests
- Each package has its own test suite
- Focus on pure functions (chunking, hashing, validation)
- Mock external services (Pinecone, GitHub API)

### Integration Tests
- Test Inngest workflows with local Inngest dev server
- Test tRPC routers with in-memory database
- Test webhook → Inngest → database flow

### End-to-End Tests
- Deploy to staging environment
- Push test commit to repo with `lightfast.yml`
- Verify ingestion completes successfully
- Query search API and verify results

---

## Dependencies Summary

### New External Dependencies
- `@pinecone-database/pinecone` - Pinecone client
- `gray-matter` - MDX frontmatter parsing
- `js-tiktoken` - Token counting
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - CLI spinners
- `fast-glob` - Glob matching

### Existing Dependencies (Reused)
- `drizzle-orm` - Database ORM
- `@planetscale/database` - PlanetScale client
- `inngest` - Background jobs
- `@trpc/server` - API framework
- `zod` - Validation
- `neverthrow` - Result types

---

## Environment Variables

### Required (Phase 1)

**Database:**
```bash
DATABASE_URL=postgres://...
```

**Pinecone:**
```bash
PINECONE_API_KEY=pc_...
```

**Inngest:**
```bash
INNGEST_APP_NAME=console
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

**GitHub:**
```bash
GITHUB_APP_ID=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
```

### Optional

**Console API:**
```bash
CONSOLE_API_URL=http://localhost:4107  # For apps/docs integration
```

---

## Migration Notes

### Database Migration

**Command:**
```bash
pnpm --filter @db/console db:migrate:generate
pnpm --filter @db/console db:migrate
```

**Migration Files:**
- `0001_create_stores.sql`
- `0002_create_docs_documents.sql`
- `0003_create_vector_entries.sql`
- `0004_create_ingestion_commits.sql`

### Existing Code Changes

**Minimal Changes Required:**
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` - Add push handler
- `api/console/src/root.ts` - Add search/contents routers
- `vendor/db/src/index.ts` - Export `@db/console` client

**No Breaking Changes:**
- All new packages are additive
- Existing console functionality remains unchanged

---

## Open Questions

1. **Pinecone Index Management:**
   - Auto-create indexes on first write, or require manual provisioning?
   - **Decision:** Auto-create with sensible defaults (dimension=1536, metric=cosine)

2. **Store Provisioning:**
   - Auto-provision stores from `lightfast.yml`, or require Console UI setup?
   - **Decision:** Auto-provision on first push (store table acts as registry)

3. **Error Handling:**
   - Retry failed ingestion jobs, or mark as failed and alert?
   - **Decision:** Exponential backoff (3 retries), then mark failed + send alert

4. **Multi-Workspace:**
   - Support multiple workspaces per repo, or one workspace per repo?
   - **Decision:** One workspace per repo in Phase 1; multi-workspace in Phase 2

5. **Search Ranking:**
   - Use raw Pinecone scores, or apply reranking?
   - **Decision:** Raw scores in Phase 1; add Mastra reranking in Phase 1.5

---

## Success Criteria

### Package Structure (Completed)
- ✅ All packages follow naming conventions
- ✅ Clear dependency graph (no circular dependencies)
- ✅ Proper separation of concerns (DB, vendor, shared, API, apps)

### Implementation (In Progress)
- [ ] All packages scaffold with README and package.json
- [ ] Database migrations run successfully
- [ ] Pinecone client connects and performs operations
- [ ] Config parser validates test `lightfast.yml`

### Integration (Pending)
- [ ] Push to main triggers Inngest workflow
- [ ] Documents are chunked and indexed to Pinecone
- [ ] Search API returns relevant results
- [ ] CLI validates config and runs local tests

---

## References

- [data-model.md](./data-model.md) - Database schema details
- [dx-configuration.md](./dx-configuration.md) - `lightfast.yml` specification
- [mastra-integration.md](./mastra-integration.md) - Pinecone client usage
- [inngest-pipeline.md](./inngest-pipeline.md) - Ingestion workflow details
- [implementation-plan.md](./implementation-plan.md) - Overall implementation plan
