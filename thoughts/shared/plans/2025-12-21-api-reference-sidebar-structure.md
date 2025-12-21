# API Reference Sidebar Structure Implementation Plan

## Overview

Restructure the API reference content from a flat file structure to a folder-based hierarchy, enabling sidebar navigation to render correctly. The `DocsMarketingSidebar` component only renders `folder` and `separator` types at root level, ignoring flat pages.

## Current State Analysis

### Root Cause: Why Sidebar Is Empty

The sidebar at `apps/docs/src/components/docs-marketing-sidebar.tsx:66-117` only handles two item types at root level:
- `item.type === "separator"` (line 67) → renders section headers
- `item.type === "folder"` (line 80) → renders folders with child pages
- All other types → `return null` (line 116, ignored)

**The problem:** Current API content is flat (7 .mdx files at root with no folders). When fumadocs processes a flat `meta.json` like `{ "pages": ["overview", "authentication", ...] }`, it creates `type: "page"` items at tree root. These are ignored by the sidebar.

**The fix:** Restructuring content into folders. When `meta.json` references folder names like `{ "pages": ["getting-started", "endpoints", ...] }`, fumadocs creates `type: "folder"` items at tree root, which the sidebar renders correctly.

No code changes needed. The sidebar component works correctly - the content structure is the issue.

### Current Files
```
apps/docs/src/content/api/
├── meta.json              → { "pages": ["overview", "authentication", ...] }
├── overview.mdx
├── authentication.mdx
├── search.mdx
├── contents.mdx
├── findsimilar.mdx
├── errors.mdx
└── sdks.mdx               → NOT in meta.json, documents different product (@lightfast/memory)
```

### Key Discovery: Two Different SDKs
- `sdks.mdx` documents `@lightfast/memory` package (vector database/memory SDK)
- `integrate/sdk.mdx` documents `lightfast` package (search API SDK)

These are **different products**. The API reference should document the `lightfast` package that matches the REST API endpoints.

## Desired End State

```
apps/docs/src/content/api/
├── meta.json                    → { "pages": ["getting-started", "endpoints", "sdks-tools"] }
│
├── getting-started/
│   ├── meta.json                → { "title": "Getting Started", "pages": ["overview", "authentication", "errors"] }
│   ├── overview.mdx
│   ├── authentication.mdx
│   └── errors.mdx
│
├── endpoints/
│   ├── meta.json                → { "title": "Endpoints", "pages": ["search", "contents", "findsimilar"] }
│   ├── search.mdx
│   ├── contents.mdx
│   └── findsimilar.mdx
│
└── sdks-tools/
    ├── meta.json                → { "title": "SDKs & Tools", "pages": ["typescript-sdk", "mcp-server"] }
    ├── typescript-sdk.mdx       → Technical reference (types, methods, errors)
    └── mcp-server.mdx           → Technical reference (tools, schemas, parameters)
```

### Verification
1. Navigate to `/docs/api-reference/overview` - sidebar should show three sections
2. All pages should be accessible via sidebar navigation
3. No broken internal links

## What We're NOT Doing

1. Modifying the sidebar component logic (the component works correctly; content structure is the issue)
2. Changing the existing `/docs/integrate/` tutorial content
3. Duplicating content between API reference and integrate sections
4. Adding new endpoints or features to the API documentation

## Implementation Approach

The restructure involves:
1. Creating folder hierarchy with meta.json files
2. Moving existing files to appropriate folders
3. Creating new technical reference files for SDK/MCP (extracting technical content)
4. Updating internal links in all files
5. Deleting the obsolete `sdks.mdx` (documents wrong product)

---

## Phase 1: Create Folder Structure

### Overview
Create the folder hierarchy with meta.json configuration files.

### Changes Required:

#### 1. Create getting-started folder
**File**: `apps/docs/src/content/api/getting-started/meta.json`
**Action**: Create new file

```json
{
  "title": "Getting Started",
  "pages": ["overview", "authentication", "errors"]
}
```

#### 2. Create endpoints folder
**File**: `apps/docs/src/content/api/endpoints/meta.json`
**Action**: Create new file

```json
{
  "title": "Endpoints",
  "pages": ["search", "contents", "findsimilar"]
}
```

#### 3. Create sdks-tools folder
**File**: `apps/docs/src/content/api/sdks-tools/meta.json`
**Action**: Create new file

```json
{
  "title": "SDKs & Tools",
  "pages": ["typescript-sdk", "mcp-server"]
}
```

#### 4. Update root meta.json
**File**: `apps/docs/src/content/api/meta.json`
**Action**: Replace content

```json
{
  "title": "API Reference",
  "description": "Complete API documentation for Lightfast",
  "defaultOpen": true,
  "pages": ["getting-started", "endpoints", "sdks-tools"]
}
```

### Success Criteria:

#### Automated Verification:
- [x] Folders exist: `ls apps/docs/src/content/api/*/meta.json`
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Typecheck passes: `pnpm --filter @lightfast/docs typecheck`

#### Manual Verification:
- [ ] Folder structure matches plan

---

## Phase 2: Move Existing Files

### Overview
Move existing .mdx files to their new folder locations.

### Changes Required:

#### 1. Move getting-started files
```bash
mv apps/docs/src/content/api/overview.mdx apps/docs/src/content/api/getting-started/
mv apps/docs/src/content/api/authentication.mdx apps/docs/src/content/api/getting-started/
mv apps/docs/src/content/api/errors.mdx apps/docs/src/content/api/getting-started/
```

#### 2. Move endpoints files
```bash
mv apps/docs/src/content/api/search.mdx apps/docs/src/content/api/endpoints/
mv apps/docs/src/content/api/contents.mdx apps/docs/src/content/api/endpoints/
mv apps/docs/src/content/api/findsimilar.mdx apps/docs/src/content/api/endpoints/
```

#### 3. Delete obsolete sdks.mdx
```bash
rm apps/docs/src/content/api/sdks.mdx
```

**Rationale**: This file documents `@lightfast/memory` package which is a different product. The API reference should document the `lightfast` package that matches the REST API endpoints.

### Success Criteria:

#### Automated Verification:
- [x] No .mdx files at root: `ls apps/docs/src/content/api/*.mdx` should return nothing
- [x] Files in folders: `ls apps/docs/src/content/api/*/*.mdx` shows 8 files (6 existing + 2 new SDK/MCP)
- [x] Build passes: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] All files moved to correct folders

---

## Phase 3: Create SDK Reference

### Overview
Create technical API reference for the TypeScript SDK, extracting technical specifications from existing tutorial content.

### Changes Required:

#### 1. Create TypeScript SDK Reference
**File**: `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`
**Action**: Create new file

```mdx
---
title: TypeScript SDK
description: TypeScript SDK API reference for the Lightfast search API
---

# TypeScript SDK Reference

The `lightfast` npm package provides a type-safe client for the Lightfast API.

## Installation

```bash
npm install lightfast
```

## Client Configuration

```typescript
import { Lightfast } from "lightfast";

const client = new Lightfast(config: LightfastConfig);
```

### LightfastConfig

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | - | API key (starts with `sk_live_` or `sk_test_`) |
| `baseUrl` | `string` | No | `https://lightfast.ai` | API base URL |
| `timeout` | `number` | No | `30000` | Request timeout in milliseconds |

---

## Methods

### search()

Search through workspace memory for relevant documents and observations.

```typescript
const response = await client.search(input: SearchInput): Promise<V1SearchResponse>
```

#### SearchInput

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `query` | `string` | Yes | - | Natural language search query |
| `limit` | `number` | No | `10` | Number of results to return |
| `offset` | `number` | No | `0` | Pagination offset |
| `mode` | `"fast" \| "balanced" \| "quality"` | No | `"balanced"` | Search mode |
| `includeContext` | `boolean` | No | `true` | Include surrounding context |
| `includeHighlights` | `boolean` | No | `true` | Include highlighted snippets |
| `filters` | `SearchFilters` | No | - | Filter results |

#### SearchFilters

| Property | Type | Description |
|----------|------|-------------|
| `sources` | `string[]` | Filter by source (e.g., `["github"]`) |
| `dateRange` | `string` | Filter by date (e.g., `"30d"`, `"7d"`) |

#### V1SearchResponse

```typescript
interface V1SearchResponse {
  results: V1SearchResult[];
  meta: {
    total: number;
    latency: { total: number };
  };
}

interface V1SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  url: string;
  metadata: Record<string, unknown>;
}
```

---

### contents()

Fetch full content for documents by their IDs.

```typescript
const response = await client.contents(input: ContentsInput): Promise<V1ContentsResponse>
```

#### ContentsInput

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ids` | `string[]` | Yes | Array of document IDs to fetch |

#### V1ContentsResponse

```typescript
interface V1ContentsResponse {
  items: V1ContentItem[];
  missing: string[];
}

interface V1ContentItem {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}
```

---

### findSimilar()

Find content semantically similar to a given document or URL.

```typescript
const response = await client.findSimilar(input: FindSimilarInput): Promise<V1FindSimilarResponse>
```

#### FindSimilarInput

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | One of `id` or `url` | - | Document ID to find similar content for |
| `url` | `string` | One of `id` or `url` | - | URL to find similar content for |
| `limit` | `number` | No | `10` | Number of results |
| `threshold` | `number` | No | `0.5` | Minimum similarity score (0-1) |
| `sameSourceOnly` | `boolean` | No | `false` | Only return results from same source |
| `excludeIds` | `string[]` | No | - | Document IDs to exclude |

#### V1FindSimilarResponse

```typescript
interface V1FindSimilarResponse {
  results: V1SimilarResult[];
  source: {
    id: string;
    title: string;
    type: string;
  };
}

interface V1SimilarResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  url: string;
}
```

---

## Error Classes

The SDK exports typed error classes for handling specific error conditions.

```typescript
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
} from "lightfast";
```

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `AuthenticationError` | 401 | Invalid or expired API key |
| `ValidationError` | 400 | Invalid request parameters. Access `error.details` for field-specific errors |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Too many requests. Access `error.retryAfter` for retry delay in seconds |
| `NetworkError` | - | Connection or timeout error |

---

## Type Exports

All request and response types are exported:

```typescript
import type {
  LightfastConfig,
  SearchInput,
  SearchFilters,
  V1SearchResponse,
  V1SearchResult,
  ContentsInput,
  V1ContentsResponse,
  V1ContentItem,
  FindSimilarInput,
  V1FindSimilarResponse,
  V1SimilarResult,
} from "lightfast";
```

---

## Related

- [TypeScript SDK Tutorial](/docs/integrate/sdk) — Getting started guide with examples
- [POST /v1/search](/docs/api-reference/endpoints/search) — REST API endpoint reference
- [GitHub Repository](https://github.com/lightfastai/lightfast/tree/main/core/lightfast) — SDK source code
```

### Success Criteria:

#### Automated Verification:
- [x] File exists: `ls apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`
- [x] Build passes: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Content is technical reference (types, parameters, return values)
- [ ] No tutorial/guide content (that stays in /docs/integrate/sdk)

---

## Phase 4: Create MCP Reference

### Overview
Create technical API reference for the MCP server tools, extracting technical specifications from existing tutorial content.

### Changes Required:

#### 1. Create MCP Server Reference
**File**: `apps/docs/src/content/api/sdks-tools/mcp-server.mdx`
**Action**: Create new file

```mdx
---
title: MCP Server
description: Model Context Protocol server API reference for AI assistant integration
---

# MCP Server Reference

The `@lightfastai/mcp` package provides a Model Context Protocol server that exposes Lightfast tools to AI assistants.

## Installation

```bash
npx @lightfastai/mcp
# or
npm install -g @lightfastai/mcp
```

## CLI Options

```bash
npx @lightfastai/mcp [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--api-key` | `string` | `$LIGHTFAST_API_KEY` | Lightfast API key |
| `--base-url` | `string` | `https://lightfast.ai` | API base URL |
| `--help, -h` | - | - | Show help message |
| `--version, -v` | - | - | Show version |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LIGHTFAST_API_KEY` | API key (alternative to `--api-key` flag) |

---

## Tools

The MCP server exposes three tools to AI assistants.

### lightfast_search

Search through workspace memory for relevant documents and observations.

#### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | `string` | Yes | - | Natural language search query |
| `limit` | `number` | No | `10` | Number of results to return |
| `mode` | `string` | No | `"balanced"` | Search mode: `"fast"`, `"balanced"`, or `"quality"` |
| `filters` | `object` | No | - | Filter object with `sources` and `dateRange` |

#### Example Request
```json
{
  "name": "lightfast_search",
  "arguments": {
    "query": "how does authentication work",
    "limit": 5,
    "mode": "quality"
  }
}
```

#### Response Schema
```typescript
{
  results: Array<{
    id: string;
    type: string;
    title: string;
    snippet: string;
    score: number;
    source: string;
    url: string;
  }>;
  meta: {
    total: number;
    latency: { total: number };
  };
}
```

---

### lightfast_contents

Fetch full content for documents by their IDs.

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | `string[]` | Yes | Array of document IDs to fetch |

#### Example Request
```json
{
  "name": "lightfast_contents",
  "arguments": {
    "ids": ["doc_abc123", "doc_def456"]
  }
}
```

#### Response Schema
```typescript
{
  items: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }>;
  missing: string[];
}
```

---

### lightfast_find_similar

Find content semantically similar to a given document or URL.

#### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | `string` | One of `id`/`url` | - | Document ID |
| `url` | `string` | One of `id`/`url` | - | URL to find similar content for |
| `limit` | `number` | No | `10` | Number of results |
| `threshold` | `number` | No | `0.5` | Minimum similarity score (0-1) |

#### Example Request
```json
{
  "name": "lightfast_find_similar",
  "arguments": {
    "url": "https://github.com/org/repo/pull/123",
    "limit": 5,
    "threshold": 0.7
  }
}
```

#### Response Schema
```typescript
{
  results: Array<{
    id: string;
    type: string;
    title: string;
    snippet: string;
    score: number;
    source: string;
    url: string;
  }>;
  source: {
    id: string;
    title: string;
    type: string;
  };
}
```

---

## Error Responses

All tools return errors in the following format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "requestId": "req_abc123"
}
```

| Error Code | Description |
|------------|-------------|
| `UNAUTHORIZED` | Invalid or missing API key |
| `VALIDATION_ERROR` | Invalid parameters |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Server error |

---

## Related

- [MCP Setup Guide](/docs/integrate/mcp) — Configuration for Claude, Cursor, Codex
- [POST /v1/search](/docs/api-reference/endpoints/search) — REST API endpoint reference
- [GitHub Repository](https://github.com/lightfastai/lightfast/tree/main/core/mcp) — MCP server source code
```

### Success Criteria:

#### Automated Verification:
- [x] File exists: `ls apps/docs/src/content/api/sdks-tools/mcp-server.mdx`
- [x] Build passes: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Content is technical reference (tool specs, parameters, schemas)
- [ ] No tutorial/guide content (that stays in /docs/integrate/mcp)

---

## Phase 5: Update Internal Links

### Overview
Update internal links in all moved files to reflect new URL structure.

### Changes Required:

The URL structure changes from flat to nested:
- `/docs/api-reference/overview` → `/docs/api-reference/getting-started/overview`
- `/docs/api-reference/authentication` → `/docs/api-reference/getting-started/authentication`
- `/docs/api-reference/errors` → `/docs/api-reference/getting-started/errors`
- `/docs/api-reference/search` → `/docs/api-reference/endpoints/search`
- `/docs/api-reference/contents` → `/docs/api-reference/endpoints/contents`
- `/docs/api-reference/findsimilar` → `/docs/api-reference/endpoints/findsimilar`

#### Files to Update

1. **overview.mdx** - Update links to authentication, errors, and endpoints
2. **authentication.mdx** - Update links to errors
3. **search.mdx** - Update links to authentication, errors, contents, findsimilar
4. **contents.mdx** - Update links to authentication, errors, search, findsimilar
5. **findsimilar.mdx** - Update links to authentication, errors, search, contents
6. **errors.mdx** - Update any endpoint links

#### Link Pattern Updates
```
/docs/api-reference/authentication → /docs/api-reference/getting-started/authentication
/docs/api-reference/errors → /docs/api-reference/getting-started/errors
/docs/api-reference/search → /docs/api-reference/endpoints/search
/docs/api-reference/contents → /docs/api-reference/endpoints/contents
/docs/api-reference/findsimilar → /docs/api-reference/endpoints/findsimilar
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfast/docs build`
- [x] Grep for old links: `grep -r "/api-reference/authentication" apps/docs/src/content/api/` returns empty (after update)

#### Manual Verification:
- [ ] All internal links in API reference work correctly
- [ ] No 404s when navigating between pages

---

## Phase 6: Verification

### Overview
Final verification that sidebar navigation works and all pages are accessible.

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter @lightfast/docs build`
- [x] Typecheck passes: `pnpm --filter @lightfast/docs typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/docs lint` (pre-existing errors in unrelated files)

#### Manual Verification:
- [ ] Navigate to `/docs/api-reference/getting-started/overview`
- [ ] Sidebar shows three sections: "Getting Started", "Endpoints", "SDKs & Tools"
- [ ] Each section shows correct child pages
- [ ] All pages accessible via sidebar
- [ ] All internal links work
- [ ] No duplicate content with `/docs/integrate/` section

---

## Testing Strategy

### Build Tests
- Run `pnpm --filter @lightfast/docs build` after each phase
- Verify no build errors or warnings about missing pages

### Link Validation
- After Phase 5, grep for any remaining old-format links
- Manually test all internal links in API reference section

### Visual Verification
- Run dev server: `pnpm dev:docs`
- Navigate to `/docs/api-reference/getting-started/overview`
- Verify sidebar renders correctly with all three sections

---

## References

- Research document: `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md`
- Sidebar component: `apps/docs/src/components/docs-marketing-sidebar.tsx:66-117`
- Source config: `apps/docs/source.config.ts`
- Source loader: `apps/docs/src/lib/source.ts`
