---
date: 2025-12-14
author: Claude
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Day 3: /v1/contents + /v1/findsimilar Implementation"
tags: [plan, neural-memory, public-api, v1-routes, contents, findsimilar]
status: ready
---

# Neural Memory Day 3: /v1/contents + /v1/findsimilar Implementation Plan

## Overview

Implement two public API endpoints for the Neural Memory system:
- **`POST /v1/contents`** - Fetch full content by document/observation IDs
- **`POST /v1/findsimilar`** - Find similar content to a given ID or URL

## Current State Analysis

### Existing Infrastructure
- `/v1/search` route implemented with `withApiKeyAuth` middleware
- Type schemas in `packages/console-types/src/api/v1/search.ts`
- Four-path search in `apps/console/src/lib/neural/four-path-search.ts`
- tRPC contents router at `api/console/src/router/org/contents.ts` (documents only, empty content)

### Key Discoveries
- **Observations** have full content in DB: `title` + `content` columns (`workspace-neural-observations.ts:111-116`)
- **Documents** do NOT store content - only metadata + Pinecone chunks
- Decision: Return **URLs** for documents instead of reconstructed content
- `withApiKeyAuth` pattern established at `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

## Desired End State

Two functional v1 API endpoints:

```bash
# Fetch content by IDs
curl -X POST https://api.lightfast.ai/v1/contents \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -d '{"ids": ["obs_abc123", "doc_xyz789"]}'

# Find similar content
curl -X POST https://api.lightfast.ai/v1/findsimilar \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -d '{"id": "obs_abc123", "limit": 10}'
```

### Success Criteria
- [x] Both endpoints return correct JSON responses
- [ ] API key authentication works correctly (manual verification)
- [x] Observations return full content from database
- [x] Documents return metadata + source URL
- [x] FindSimilar resolves both IDs and URLs
- [x] Type exports work from `@repo/console-types`
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

## What We're NOT Doing

- **`includeRelationships` parameter** - Deferred to Day 4+ (requires new database table)
- **Chunk reconstruction** - Documents return URLs instead
- **Format conversion** (`markdown`/`text`/`html`) - All content returned as-is
- **`maxLength` truncation** - Full content returned

## Implementation Approach

Follow the established `/v1/search` pattern:
1. Create Zod schemas in `packages/console-types/src/api/v1/`
2. Create route handlers in `apps/console/src/app/(api)/v1/`
3. Use `withApiKeyAuth` middleware
4. Return consistent error format: `{ error, message, requestId }`

---

## Phase 1: Type Definitions

### Overview
Create Zod schemas for `/v1/contents` and `/v1/findsimilar` request/response types.

### Changes Required

#### 1. Contents Schemas
**File**: `packages/console-types/src/api/v1/contents.ts` (new)

```typescript
/**
 * /v1/contents API schemas
 *
 * Fetch full content for documents and observations by ID.
 */

import { z } from "zod";

/**
 * V1 Contents request schema
 */
export const V1ContentsRequestSchema = z.object({
  /** Array of content IDs (doc_* or obs_*) */
  ids: z
    .array(z.string())
    .min(1, "At least one ID required")
    .max(50, "Maximum 50 IDs per request"),
});

export type V1ContentsRequest = z.infer<typeof V1ContentsRequestSchema>;

/**
 * Individual content item in response
 */
export const V1ContentItemSchema = z.object({
  /** Content ID (doc_* or obs_*) */
  id: z.string(),
  /** Content title */
  title: z.string().nullable(),
  /** URL to source (GitHub, Linear, Vercel, etc.) */
  url: z.string(),
  /** Content snippet or full content for observations */
  snippet: z.string(),
  /** Full content (observations only) */
  content: z.string().optional(),
  /** Source system (github, linear, vercel) */
  source: z.string(),
  /** Content type (pull_request, issue, file, deployment) */
  type: z.string(),
  /** When the content was created/occurred */
  occurredAt: z.string().datetime().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type V1ContentItem = z.infer<typeof V1ContentItemSchema>;

/**
 * V1 Contents response schema
 */
export const V1ContentsResponseSchema = z.object({
  /** Found content items */
  items: z.array(V1ContentItemSchema),
  /** IDs that were not found */
  missing: z.array(z.string()),
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1ContentsResponse = z.infer<typeof V1ContentsResponseSchema>;
```

#### 2. FindSimilar Schemas
**File**: `packages/console-types/src/api/v1/findsimilar.ts` (new)

```typescript
/**
 * /v1/findsimilar API schemas
 *
 * Find content similar to a given document or observation.
 */

import { z } from "zod";
import { V1SearchFiltersSchema } from "./search";

/**
 * V1 FindSimilar request schema
 */
export const V1FindSimilarRequestSchema = z
  .object({
    /** Content ID to find similar items for */
    id: z.string().optional(),
    /** URL to find similar items for (alternative to id) */
    url: z.string().url().optional(),
    /** Maximum results to return (1-50, default 10) */
    limit: z.number().int().min(1).max(50).default(10),
    /** Minimum similarity threshold (0-1, default 0.5) */
    threshold: z.number().min(0).max(1).default(0.5),
    /** Only return results from same source type */
    sameSourceOnly: z.boolean().default(false),
    /** IDs to exclude from results */
    excludeIds: z.array(z.string()).optional(),
    /** Optional filters for scoping results */
    filters: V1SearchFiltersSchema.optional(),
  })
  .refine((data) => data.id || data.url, {
    message: "Either id or url must be provided",
  });

export type V1FindSimilarRequest = z.infer<typeof V1FindSimilarRequestSchema>;

/**
 * Similar content result
 */
export const V1FindSimilarResultSchema = z.object({
  /** Content ID */
  id: z.string(),
  /** Content title */
  title: z.string(),
  /** URL to source */
  url: z.string(),
  /** Content snippet */
  snippet: z.string().optional(),
  /** Combined similarity score (0-1) */
  score: z.number(),
  /** Raw vector similarity score */
  vectorSimilarity: z.number(),
  /** Entity overlap ratio (0-1) */
  entityOverlap: z.number().optional(),
  /** Whether result is in same cluster as source */
  sameCluster: z.boolean(),
  /** Source system */
  source: z.string(),
  /** Content type */
  type: z.string(),
  /** When content occurred */
  occurredAt: z.string().datetime().optional(),
});

export type V1FindSimilarResult = z.infer<typeof V1FindSimilarResultSchema>;

/**
 * Source document info in response
 */
export const V1FindSimilarSourceSchema = z.object({
  /** Source content ID */
  id: z.string(),
  /** Source title */
  title: z.string(),
  /** Source content type */
  type: z.string(),
  /** Cluster info if available */
  cluster: z
    .object({
      /** Cluster topic */
      topic: z.string().nullable(),
      /** Number of items in cluster */
      memberCount: z.number(),
    })
    .optional(),
});

export type V1FindSimilarSource = z.infer<typeof V1FindSimilarSourceSchema>;

/**
 * V1 FindSimilar response schema
 */
export const V1FindSimilarResponseSchema = z.object({
  /** Source document/observation info */
  source: V1FindSimilarSourceSchema,
  /** Similar content items */
  similar: z.array(V1FindSimilarResultSchema),
  /** Response metadata */
  meta: z.object({
    /** Total similar items found (before limit) */
    total: z.number(),
    /** Request processing time in ms */
    took: z.number(),
    /** Embedding source info */
    inputEmbedding: z.object({
      /** Whether embedding was found in storage */
      found: z.boolean(),
      /** Whether embedding was generated on-the-fly */
      generated: z.boolean(),
    }),
  }),
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1FindSimilarResponse = z.infer<typeof V1FindSimilarResponseSchema>;
```

#### 3. Update Index Exports
**File**: `packages/console-types/src/api/v1/index.ts`

```typescript
/**
 * V1 Public API schemas
 */

export * from "./search";
export * from "./contents";
export * from "./findsimilar";
```

### Success Criteria

#### Automated Verification
- [x] Types compile: `pnpm --filter @repo/console-types typecheck`
- [x] Lint passes: `pnpm --filter @repo/console-types lint`
- [x] Package builds: `pnpm --filter @repo/console-types build`

---

## Phase 2: URL Builder Utility

### Overview
Create utility to construct source URLs from document/observation metadata.

### Changes Required

#### 1. URL Builder
**File**: `apps/console/src/lib/neural/url-builder.ts` (new)

```typescript
/**
 * URL Builder for Neural Memory content
 *
 * Constructs source URLs from document/observation metadata.
 */

/**
 * Build source URL based on source type and ID patterns.
 */
export function buildSourceUrl(
  source: string,
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  switch (source) {
    case "github":
      return buildGitHubUrl(sourceId, metadata);
    case "vercel":
      return buildVercelUrl(sourceId, metadata);
    case "linear":
      return buildLinearUrl(sourceId, metadata);
    default:
      // Fallback to metadata URL if available
      return (metadata?.url as string) || "";
  }
}

/**
 * Build GitHub URL from sourceId patterns.
 *
 * Patterns:
 * - PR: "pr:owner/repo#123:merged" -> https://github.com/owner/repo/pull/123
 * - Issue: "issue:owner/repo#45:opened" -> https://github.com/owner/repo/issues/45
 * - Push: "push:owner/repo:abc123" -> https://github.com/owner/repo/commit/abc123
 * - File: "owner/repo/path/to/file.md" -> https://github.com/owner/repo/blob/main/path/to/file.md
 */
function buildGitHubUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // PR pattern: pr:owner/repo#123:action
  if (sourceId.startsWith("pr:")) {
    const match = sourceId.match(/pr:([^#]+)#(\d+)/);
    if (match) {
      return `https://github.com/${match[1]}/pull/${match[2]}`;
    }
  }

  // Issue pattern: issue:owner/repo#45:action
  if (sourceId.startsWith("issue:")) {
    const match = sourceId.match(/issue:([^#]+)#(\d+)/);
    if (match) {
      return `https://github.com/${match[1]}/issues/${match[2]}`;
    }
  }

  // Push/commit pattern: push:owner/repo:sha
  if (sourceId.startsWith("push:")) {
    const match = sourceId.match(/push:([^:]+):([a-f0-9]+)/);
    if (match) {
      return `https://github.com/${match[1]}/commit/${match[2]}`;
    }
  }

  // Release pattern: release:owner/repo:tag:action
  if (sourceId.startsWith("release:")) {
    const match = sourceId.match(/release:([^:]+):([^:]+)/);
    if (match) {
      return `https://github.com/${match[1]}/releases/tag/${match[2]}`;
    }
  }

  // Discussion pattern: discussion:owner/repo#10
  if (sourceId.startsWith("discussion:")) {
    const match = sourceId.match(/discussion:([^#]+)#(\d+)/);
    if (match) {
      return `https://github.com/${match[1]}/discussions/${match[2]}`;
    }
  }

  // File path pattern: owner/repo/path/to/file.md
  // Use commit SHA from metadata if available
  const commitSha = (metadata?.commitSha as string) || "main";
  const path = sourceId.replace(/^\//, "");

  // Extract owner/repo from path
  const parts = path.split("/");
  if (parts.length >= 3) {
    const owner = parts[0];
    const repo = parts[1];
    const filePath = parts.slice(2).join("/");
    return `https://github.com/${owner}/${repo}/blob/${commitSha}/${filePath}`;
  }

  // Fallback to metadata URL
  return (metadata?.url as string) || "";
}

/**
 * Build Vercel URL from sourceId.
 *
 * Pattern: "deployment:project:id" -> https://vercel.com/project/deployments/id
 */
function buildVercelUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // Use metadata URL if available (Vercel provides full URLs)
  if (metadata?.url) {
    return metadata.url as string;
  }

  // Deployment pattern
  if (sourceId.startsWith("deployment:")) {
    const parts = sourceId.split(":");
    if (parts.length >= 3) {
      return `https://vercel.com/${parts[1]}/deployments/${parts[2]}`;
    }
  }

  return "";
}

/**
 * Build Linear URL from sourceId.
 *
 * Pattern: "issue:TEAM-123" -> https://linear.app/team/issue/TEAM-123
 */
function buildLinearUrl(
  sourceId: string,
  metadata?: Record<string, unknown>
): string {
  // Use metadata URL if available
  if (metadata?.url) {
    return metadata.url as string;
  }

  // Issue pattern: issue:TEAM-123
  if (sourceId.startsWith("issue:")) {
    const issueId = sourceId.replace("issue:", "");
    const teamKey = issueId.split("-")[0]?.toLowerCase() || "team";
    return `https://linear.app/${teamKey}/issue/${issueId}`;
  }

  return "";
}
```

### Success Criteria

#### Automated Verification
- [x] File created at correct path
- [x] TypeScript compiles: `pnpm --filter console typecheck`

---

## Phase 3: URL Resolver Utility

### Overview
Create utility to resolve URLs back to internal document/observation IDs for `/v1/findsimilar`.

### Changes Required

#### 1. URL Resolver
**File**: `apps/console/src/lib/neural/url-resolver.ts` (new)

```typescript
/**
 * URL Resolver for Neural Memory
 *
 * Resolves external URLs (GitHub, Linear, etc.) to internal content IDs.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export interface ResolvedContent {
  id: string;
  type: "observation" | "document";
}

/**
 * Parse GitHub URL into components.
 */
interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  type: "pr" | "issue" | "commit" | "release" | "discussion" | "file";
  identifier: string;
}

const URL_PATTERNS = [
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
    type: "pr" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
    type: "issue" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/,
    type: "commit" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)/,
    type: "release" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/,
    type: "discussion" as const,
  },
] as const;

function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  for (const { regex, type } of URL_PATTERNS) {
    const match = url.match(regex);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        type,
        identifier: match[3],
      };
    }
  }
  return null;
}

/**
 * Build sourceId candidates from parsed URL.
 * URLs don't indicate action state, so we query all variants.
 */
function buildSourceIdCandidates(parsed: ParsedGitHubUrl): string[] {
  const repoPath = `${parsed.owner}/${parsed.repo}`;

  switch (parsed.type) {
    case "pr":
      return [
        `pr:${repoPath}#${parsed.identifier}:merged`,
        `pr:${repoPath}#${parsed.identifier}:closed`,
        `pr:${repoPath}#${parsed.identifier}:opened`,
        `pr:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "issue":
      return [
        `issue:${repoPath}#${parsed.identifier}:closed`,
        `issue:${repoPath}#${parsed.identifier}:opened`,
        `issue:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "commit":
      return [`push:${repoPath}:${parsed.identifier}`];
    case "release":
      return [
        `release:${repoPath}:${parsed.identifier}:published`,
        `release:${repoPath}:${parsed.identifier}:created`,
      ];
    case "discussion":
      return [`discussion:${repoPath}#${parsed.identifier}`];
    default:
      return [];
  }
}

/**
 * Resolve a URL to an internal content ID.
 *
 * Uses indexed sourceId lookup for efficient resolution.
 */
export async function resolveByUrl(
  workspaceId: string,
  url: string
): Promise<ResolvedContent | null> {
  // Parse GitHub URL
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return null;
  }

  const sourceIdCandidates = buildSourceIdCandidates(parsed);
  if (sourceIdCandidates.length === 0) {
    return null;
  }

  // Query observations using indexed sourceId lookup
  const observation = await db.query.workspaceNeuralObservations.findFirst({
    columns: { id: true },
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      inArray(workspaceNeuralObservations.sourceId, sourceIdCandidates)
    ),
    orderBy: [desc(workspaceNeuralObservations.occurredAt)],
  });

  if (observation) {
    return { id: observation.id, type: "observation" };
  }

  // For file URLs, check documents table
  if (parsed.type === "file") {
    const document = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: { id: true },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.sourceType, "github"),
        eq(workspaceKnowledgeDocuments.sourceId, parsed.identifier)
      ),
    });

    if (document) {
      return { id: document.id, type: "document" };
    }
  }

  return null;
}
```

### Success Criteria

#### Automated Verification
- [x] File created at correct path
- [x] TypeScript compiles: `pnpm --filter console typecheck`

---

## Phase 4: /v1/contents Route

### Overview
Implement the contents endpoint to fetch full content by IDs.

### Changes Required

#### 1. Contents Route Handler
**File**: `apps/console/src/app/(api)/v1/contents/route.ts` (new)

```typescript
/**
 * POST /v1/contents - Fetch Content by IDs
 *
 * Fetch full content for documents and observations.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - ids: string[] (required) - Content IDs (doc_* or obs_*)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { V1ContentsRequestSchema } from "@repo/console-types";
import type { V1ContentsResponse, V1ContentItem } from "@repo/console-types";

import { withApiKeyAuth, createAuthErrorResponse } from "../lib/with-api-key-auth";
import { buildSourceUrl } from "~/lib/neural/url-builder";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/contents request", { requestId });

  try {
    // 1. Authenticate via API key
    const authResult = await withApiKeyAuth(request, requestId);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, apiKeyId } = authResult.auth;

    log.info("v1/contents authenticated", { requestId, workspaceId, userId, apiKeyId });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1ContentsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { ids } = parseResult.data;

    log.info("v1/contents validated", { requestId, idCount: ids.length });

    // 3. Separate IDs by prefix
    const obsIds = ids.filter((id) => id.startsWith("obs_"));
    const docIds = ids.filter((id) => id.startsWith("doc_"));

    // 4. Fetch in parallel
    const [observations, documents] = await Promise.all([
      obsIds.length > 0
        ? db
            .select({
              id: workspaceNeuralObservations.id,
              title: workspaceNeuralObservations.title,
              content: workspaceNeuralObservations.content,
              source: workspaceNeuralObservations.source,
              sourceId: workspaceNeuralObservations.sourceId,
              observationType: workspaceNeuralObservations.observationType,
              occurredAt: workspaceNeuralObservations.occurredAt,
              metadata: workspaceNeuralObservations.metadata,
            })
            .from(workspaceNeuralObservations)
            .where(
              and(
                eq(workspaceNeuralObservations.workspaceId, workspaceId),
                inArray(workspaceNeuralObservations.id, obsIds)
              )
            )
        : Promise.resolve([]),

      docIds.length > 0
        ? db
            .select({
              id: workspaceKnowledgeDocuments.id,
              sourceType: workspaceKnowledgeDocuments.sourceType,
              sourceId: workspaceKnowledgeDocuments.sourceId,
              sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
            })
            .from(workspaceKnowledgeDocuments)
            .where(
              and(
                eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
                inArray(workspaceKnowledgeDocuments.id, docIds)
              )
            )
        : Promise.resolve([]),
    ]);

    // 5. Map to response format
    const items: V1ContentItem[] = [
      // Observations - full content from DB
      ...observations.map((obs) => {
        const metadata = (obs.metadata as Record<string, unknown>) || {};
        return {
          id: obs.id,
          title: obs.title,
          url: buildSourceUrl(obs.source, obs.sourceId, metadata),
          snippet: obs.content?.slice(0, 200) || "",
          content: obs.content || "",
          source: obs.source,
          type: obs.observationType,
          occurredAt: obs.occurredAt || undefined,
          metadata,
        };
      }),

      // Documents - metadata + URL only
      ...documents.map((doc) => {
        const metadata = (doc.sourceMetadata as Record<string, unknown>) || {};
        const frontmatter = (metadata.frontmatter as Record<string, unknown>) || {};
        return {
          id: doc.id,
          title: (frontmatter.title as string) || doc.sourceId,
          url: buildSourceUrl(doc.sourceType, doc.sourceId, metadata),
          snippet: (frontmatter.description as string) || "",
          // No content for documents - use URL to fetch
          source: doc.sourceType,
          type: "file",
          metadata: frontmatter,
        };
      }),
    ];

    // 6. Track missing IDs
    const foundIds = new Set(items.map((item) => item.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      log.warn("v1/contents missing IDs", { requestId, missing });
    }

    // 7. Build response
    const response: V1ContentsResponse = {
      items,
      missing,
      requestId,
    };

    log.info("v1/contents complete", {
      requestId,
      itemCount: items.length,
      missingCount: missing.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/contents error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch contents",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}
```

### Success Criteria

#### Automated Verification
- [x] File created at correct path
- [x] TypeScript compiles: `pnpm --filter console typecheck`
- [x] Lint passes: `pnpm --filter console lint`

#### Manual Verification
- [ ] Endpoint returns observations with full content
- [ ] Endpoint returns documents with URL
- [ ] Missing IDs reported correctly
- [ ] API key authentication works

---

## Phase 5: /v1/findsimilar Route

### Overview
Implement the findsimilar endpoint to find similar content.

### Changes Required

#### 1. FindSimilar Route Handler
**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts` (new)

```typescript
/**
 * POST /v1/findsimilar - Find Similar Content
 *
 * Find content similar to a given document or observation.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - id: string (optional) - Content ID to find similar items for
 * - url: string (optional) - URL to find similar items for
 * - limit: number (1-50, default 10)
 * - threshold: number (0-1, default 0.5)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceKnowledgeDocuments,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  orgWorkspaces,
} from "@db/console/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProvider } from "@repo/console-embed";
import { V1FindSimilarRequestSchema } from "@repo/console-types";
import type { V1FindSimilarResponse, V1FindSimilarResult } from "@repo/console-types";

import { withApiKeyAuth, createAuthErrorResponse } from "../lib/with-api-key-auth";
import { resolveByUrl } from "~/lib/neural/url-resolver";
import { buildSourceUrl } from "~/lib/neural/url-builder";

interface SourceContent {
  id: string;
  title: string;
  content: string;
  type: string;
  source: string;
  clusterId: string | null;
  embeddingId: string | null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/findsimilar request", { requestId });

  try {
    // 1. Authenticate via API key
    const authResult = await withApiKeyAuth(request, requestId);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, apiKeyId } = authResult.auth;

    log.info("v1/findsimilar authenticated", { requestId, workspaceId, userId, apiKeyId });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1FindSimilarRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { id, url, limit, threshold, sameSourceOnly, excludeIds, filters } = parseResult.data;

    // 3. Resolve source content
    let sourceId = id;
    if (!sourceId && url) {
      const resolved = await resolveByUrl(workspaceId, url);
      if (!resolved) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "URL not found in workspace", requestId },
          { status: 404 }
        );
      }
      sourceId = resolved.id;
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Either id or url must be provided", requestId },
        { status: 400 }
      );
    }

    // 4. Fetch source content
    const sourceContent = await fetchSourceContent(workspaceId, sourceId);
    if (!sourceContent) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Content not found", requestId },
        { status: 404 }
      );
    }

    // 5. Get workspace config for Pinecone
    const workspace = await db.query.orgWorkspaces.findFirst({
      columns: {
        indexName: true,
        namespaceName: true,
      },
      where: eq(orgWorkspaces.id, workspaceId),
    });

    if (!workspace?.indexName || !workspace?.namespaceName) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "Workspace not configured for search", requestId },
        { status: 500 }
      );
    }

    // 6. Get or generate embedding
    let embedding: number[];
    let embeddingFound = false;

    if (sourceContent.embeddingId) {
      // Try to fetch existing embedding from Pinecone
      const fetchResult = await consolePineconeClient.fetchVectors(
        workspace.indexName,
        [sourceContent.embeddingId],
        workspace.namespaceName
      );

      const vector = fetchResult.records[sourceContent.embeddingId];
      if (vector?.values) {
        embedding = vector.values;
        embeddingFound = true;
      }
    }

    if (!embeddingFound) {
      // Generate embedding on-the-fly
      const provider = createEmbeddingProvider("search_document");
      const result = await provider.getTextEmbedding(sourceContent.content);
      embedding = result;
    }

    // 7. Build Pinecone filter
    const pineconeFilter: Record<string, unknown> = {
      layer: { $eq: "observations" },
    };

    if (sameSourceOnly) {
      pineconeFilter.source = { $eq: sourceContent.source };
    }

    if (filters?.sourceTypes?.length) {
      pineconeFilter.source = { $in: filters.sourceTypes };
    }

    if (filters?.observationTypes?.length) {
      pineconeFilter.observationType = { $in: filters.observationTypes };
    }

    // 8. Query Pinecone for similar vectors
    const pineconeResults = await consolePineconeClient.query(
      workspace.indexName,
      {
        vector: embedding,
        topK: limit * 2, // Over-fetch for filtering
        filter: pineconeFilter,
        includeMetadata: true,
      },
      workspace.namespaceName
    );

    // 9. Filter and process results
    const exclusions = new Set([sourceContent.id, ...(excludeIds || [])]);
    const filtered = pineconeResults.matches
      .filter((m) => !exclusions.has(m.id) && (m.score ?? 0) >= threshold)
      .slice(0, limit);

    // 10. Enrich results with database info
    const resultIds = filtered.map((m) => m.id);
    const enrichedData = await enrichResults(workspaceId, resultIds, sourceContent.clusterId);

    // 11. Get cluster info for source
    let clusterInfo: { topic: string | null; memberCount: number } | undefined;
    if (sourceContent.clusterId) {
      const cluster = await db.query.workspaceObservationClusters.findFirst({
        columns: { topicLabel: true, observationCount: true },
        where: eq(workspaceObservationClusters.id, sourceContent.clusterId),
      });
      if (cluster) {
        clusterInfo = {
          topic: cluster.topicLabel,
          memberCount: cluster.observationCount,
        };
      }
    }

    // 12. Build response
    const similar: V1FindSimilarResult[] = filtered.map((match) => {
      const data = enrichedData.get(match.id);
      const metadata = (match.metadata as Record<string, unknown>) || {};

      return {
        id: match.id,
        title: (metadata.title as string) || data?.title || "",
        url: data?.url || (metadata.url as string) || "",
        snippet: (metadata.snippet as string) || "",
        score: match.score ?? 0,
        vectorSimilarity: match.score ?? 0,
        entityOverlap: data?.entityOverlap,
        sameCluster: data?.sameCluster ?? false,
        source: (metadata.source as string) || data?.source || "",
        type: (metadata.observationType as string) || data?.type || "",
        occurredAt: data?.occurredAt,
      };
    });

    const response: V1FindSimilarResponse = {
      source: {
        id: sourceContent.id,
        title: sourceContent.title,
        type: sourceContent.type,
        cluster: clusterInfo,
      },
      similar,
      meta: {
        total: filtered.length,
        took: Date.now() - startTime,
        inputEmbedding: {
          found: embeddingFound,
          generated: !embeddingFound,
        },
      },
      requestId,
    };

    log.info("v1/findsimilar complete", {
      requestId,
      sourceId: sourceContent.id,
      similarCount: similar.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/findsimilar error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to find similar content",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch source content by ID (observation or document)
 */
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
  if (contentId.startsWith("obs_")) {
    const obs = await db.query.workspaceNeuralObservations.findFirst({
      columns: {
        id: true,
        title: true,
        content: true,
        observationType: true,
        source: true,
        clusterId: true,
        embeddingContentId: true,
      },
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.id, contentId)
      ),
    });

    if (obs) {
      return {
        id: obs.id,
        title: obs.title,
        content: obs.content,
        type: obs.observationType,
        source: obs.source,
        clusterId: obs.clusterId,
        embeddingId: obs.embeddingContentId,
      };
    }
  }

  if (contentId.startsWith("doc_")) {
    const doc = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: {
        id: true,
        sourceId: true,
        sourceType: true,
        sourceMetadata: true,
      },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.id, contentId)
      ),
    });

    if (doc) {
      const metadata = (doc.sourceMetadata as Record<string, unknown>) || {};
      const frontmatter = (metadata.frontmatter as Record<string, unknown>) || {};
      return {
        id: doc.id,
        title: (frontmatter.title as string) || doc.sourceId,
        content: (frontmatter.description as string) || "",
        type: "file",
        source: doc.sourceType,
        clusterId: null,
        embeddingId: null,
      };
    }
  }

  return null;
}

/**
 * Enrich results with database info
 */
async function enrichResults(
  workspaceId: string,
  resultIds: string[],
  sourceClusterId: string | null
): Promise<
  Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >
> {
  const result = new Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >();

  if (resultIds.length === 0) return result;

  // Fetch observations
  const obsIds = resultIds.filter((id) => id.startsWith("obs_"));
  if (obsIds.length > 0) {
    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        title: workspaceNeuralObservations.title,
        source: workspaceNeuralObservations.source,
        sourceId: workspaceNeuralObservations.sourceId,
        observationType: workspaceNeuralObservations.observationType,
        occurredAt: workspaceNeuralObservations.occurredAt,
        clusterId: workspaceNeuralObservations.clusterId,
        metadata: workspaceNeuralObservations.metadata,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          inArray(workspaceNeuralObservations.id, obsIds)
        )
      );

    for (const obs of observations) {
      const metadata = (obs.metadata as Record<string, unknown>) || {};
      result.set(obs.id, {
        title: obs.title,
        url: buildSourceUrl(obs.source, obs.sourceId, metadata),
        source: obs.source,
        type: obs.observationType,
        occurredAt: obs.occurredAt || undefined,
        sameCluster: sourceClusterId !== null && obs.clusterId === sourceClusterId,
      });
    }
  }

  return result;
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}
```

### Success Criteria

#### Automated Verification
- [x] File created at correct path
- [x] TypeScript compiles: `pnpm --filter console typecheck`
- [x] Lint passes: `pnpm --filter console lint`

#### Manual Verification
- [ ] Endpoint finds similar content by ID
- [ ] Endpoint resolves URLs correctly
- [ ] Similarity threshold works
- [ ] Cluster context enrichment works
- [ ] API key authentication works

---

## Testing Strategy

### Manual Testing Steps

1. **Test /v1/contents with observations:**
   ```bash
   curl -X POST http://localhost:4107/api/v1/contents \
     -H "Authorization: Bearer $API_KEY" \
     -H "X-Workspace-ID: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["obs_abc123"]}'
   ```

2. **Test /v1/contents with documents:**
   ```bash
   curl -X POST http://localhost:4107/api/v1/contents \
     -H "Authorization: Bearer $API_KEY" \
     -H "X-Workspace-ID: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["doc_xyz789"]}'
   ```

3. **Test /v1/findsimilar by ID:**
   ```bash
   curl -X POST http://localhost:4107/api/v1/findsimilar \
     -H "Authorization: Bearer $API_KEY" \
     -H "X-Workspace-ID: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d '{"id": "obs_abc123", "limit": 5}'
   ```

4. **Test /v1/findsimilar by URL:**
   ```bash
   curl -X POST http://localhost:4107/api/v1/findsimilar \
     -H "Authorization: Bearer $API_KEY" \
     -H "X-Workspace-ID: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://github.com/owner/repo/pull/123", "limit": 5}'
   ```

---

## References

- Day 3 Research: `thoughts/shared/research/2025-12-14-neural-memory-week1-day3-search-route.md`
- Chunk Reconstruction (deferred): `thoughts/shared/research/2025-12-14-chunk-reconstruction-patterns.md`
- Relationship Graph (deferred): `thoughts/shared/research/2025-12-14-neural-memory-relationship-graph-design.md`
- Existing /v1/search route: `apps/console/src/app/(api)/v1/search/route.ts`
- API Key Auth: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

---

_Last updated: 2025-12-14_
