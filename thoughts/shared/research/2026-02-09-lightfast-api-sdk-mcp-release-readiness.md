---
date: 2026-02-09T02:59:08+0000
researcher: Claude Sonnet 4.5
git_commit: 614beeb595a7b7a79621c6a17d16f1575c3f912c
branch: main
repository: lightfast
topic: "Lightfast API, SDK, and MCP Release Readiness Analysis"
tags: [research, codebase, api, sdk, mcp, release, publishing]
status: complete
last_updated: 2026-02-09
last_updated_by: Claude Sonnet 4.5
---

# Research: Lightfast API, SDK, and MCP Release Readiness Analysis

**Date**: 2026-02-09T02:59:08+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: 614beeb595a7b7a79621c6a17d16f1575c3f912c
**Branch**: main
**Repository**: lightfast

## Research Question

With the `@apps/console/src/app/(api)/v1/` API structure now complete, investigate the release readiness of:
1. The Lightfast TypeScript SDK (`@core/lightfast`)
2. The Lightfast MCP Server (`@core/mcp`)
3. How both align with the current v1 API implementation

## Summary

The Lightfast v1 API, SDK, and MCP server form a cohesive three-tier architecture where:
- **API Layer**: 6 HTTP endpoints in `apps/console/src/app/(api)/v1/` providing semantic search, content retrieval, similarity discovery, and relationship graph traversal
- **SDK Layer**: `lightfast` npm package (0.1.0-alpha.1) exposing 3 core methods (search, contents, findSimilar) that map directly to API endpoints
- **MCP Layer**: `@lightfastai/mcp` npm package (0.1.0-alpha.1) wrapping the SDK as 3 Model Context Protocol tools for AI assistants

Both packages are configured for npm publishing with Changesets-based CI/CD, but there are **alignment gaps** between the API surface and SDK implementation:
- SDK implements 3 of 6 v1 endpoints
- Missing SDK methods: `graph()` and `related()`
- Missing MCP tools for graph/related functionality
- Answer endpoint (`/v1/answer`) is streaming-only, not exposed in SDK

## Detailed Findings

### 1. V1 API Structure

The v1 API provides 6 HTTP endpoints with dual authentication (API key or Clerk session) and workspace scoping:

#### Endpoint Overview

| Endpoint | HTTP Methods | Purpose | SDK Coverage |
|----------|-------------|---------|--------------|
| `/v1/search` | POST | Semantic search with mode-based reranking | ✅ `lightfast.search()` |
| `/v1/contents` | POST | Fetch full content by IDs | ✅ `lightfast.contents()` |
| `/v1/findsimilar` | POST | Find similar content | ✅ `lightfast.findSimilar()` |
| `/v1/graph/{id}` | GET | Relationship graph traversal | ❌ Not in SDK |
| `/v1/related/{id}` | GET | Direct relationships lookup | ❌ Not in SDK |
| `/v1/answer/[...v]` | POST/GET | AI agent with streaming responses | ❌ Streaming-only |

**Location**: `apps/console/src/app/(api)/v1/`

#### Authentication Architecture

All endpoints use `withDualAuth()` middleware (`/v1/lib/with-dual-auth.ts:50-183`) supporting:

1. **API Key** (`Authorization: Bearer sk-lf-{key}`):
   - Validates against hashed keys in `orgApiKeys` table
   - Workspace determined from key binding (NOT from header)
   - Tracks `lastUsedAt` and `lastUsedFromIp`

2. **Clerk Session** (`X-Workspace-ID` header):
   - Validates user's org membership
   - Fetches cached user org memberships (optimized)

3. **Bearer Token** (Internal):
   - For service-to-service calls
   - Requires `X-Workspace-ID` and `X-User-ID` headers

#### Logic Separation Pattern

All business logic extracted to `~/lib/v1/index.ts`:
- `searchLogic()`
- `contentsLogic()`
- `findsimilarLogic()`
- `graphLogic()`
- `relatedLogic()`

Each accepts `V1AuthContext` with workspace/user info.

### 2. Lightfast SDK Implementation

**Package**: `lightfast` (version 0.1.0-alpha.1)
**Location**: `core/lightfast/src/`

#### Architecture

The SDK is a fetch-based HTTP client with:
- **Entry Point**: `core/lightfast/src/index.ts:2-43`
- **Client Class**: `core/lightfast/src/client.ts:45-233`
- **Type Definitions**: `core/lightfast/src/types.ts:1-90`
- **Error Handling**: `core/lightfast/src/errors.ts:1-101`

#### Public API Methods

##### `search(query: string, options?: SearchOptions)`
- **File**: `client.ts:78-88`
- **Endpoint**: POST `/v1/search`
- **Defaults**: limit=10, offset=0, mode="balanced", includeContext=true, includeHighlights=true
- **Returns**: `V1SearchResponse` with results, scores, metadata

##### `contents(ids: string[])`
- **File**: `client.ts:103-107`
- **Endpoint**: POST `/v1/contents`
- **Validates**: 1-50 IDs required
- **Returns**: `V1ContentsResponse` with items and missing IDs

##### `findSimilar(options: { id?: string, url?: string, ... })`
- **File**: `client.ts:124-138`
- **Endpoint**: POST `/v1/findsimilar`
- **Defaults**: limit=10, threshold=0.5, sameSourceOnly=false
- **Validates**: Either `id` or `url` required
- **Returns**: `V1FindSimilarResponse` with similar items

#### HTTP Request Handling (`client.ts:143-188`)

- Uses native `fetch` with `AbortController` for timeout (default 30s)
- Sets `Authorization: Bearer {apiKey}` header
- Sets `User-Agent: lightfast/{SDK_VERSION}` header
- Maps HTTP status codes to typed errors:
  - 400 → `ValidationError`
  - 401 → `AuthenticationError`
  - 404 → `NotFoundError`
  - 429 → `RateLimitError`
  - 500-504 → `ServerError`

#### Package Configuration (`core/lightfast/package.json`)

```json
{
  "name": "lightfast",
  "version": "0.1.0-alpha.1",
  "type": "module",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs" },
    "./client": { "types": "./dist/client.d.ts", "import": "./dist/client.mjs" },
    "./types": { "types": "./dist/types.d.ts", "import": "./dist/types.mjs" },
    "./errors": { "types": "./dist/errors.d.ts", "import": "./dist/errors.mjs" }
  },
  "publishConfig": {
    "tag": "latest",
    "access": "public"
  },
  "engines": {
    "node": ">=18"
  }
}
```

#### Build Configuration (`core/lightfast/tsup.config.ts`)

- **Entry Points**: index.ts, client.ts, types.ts, errors.ts
- **Format**: ESM-only (`.mjs` extension)
- **Target**: Node.js 18
- **Features**: TypeScript declarations, sourcemaps, version injection

### 3. MCP Server Implementation

**Package**: `@lightfastai/mcp` (version 0.1.0-alpha.1)
**Location**: `core/mcp/src/`

#### Architecture

The MCP server is a CLI tool that bridges the Model Context Protocol to the Lightfast SDK:
- **CLI Entry**: `core/mcp/src/index.ts:31` - Argument parsing and validation
- **Server Setup**: `core/mcp/src/server.ts:21` - Tool registration and transport

#### Registered MCP Tools

##### 1. `lightfast_search` (`server.ts:33-43`)
- **Description**: "Search through workspace neural memory for relevant documents and observations"
- **Schema**: `V1SearchRequestSchema.shape`
- **Handler**: Calls `lightfast.search(args)`
- **Response**: JSON-stringified results

##### 2. `lightfast_contents` (`server.ts:46-56`)
- **Description**: "Fetch full content for documents and observations by their IDs"
- **Schema**: `V1ContentsRequestSchema.shape`
- **Handler**: Calls `lightfast.contents(args)`
- **Response**: JSON-stringified results

##### 3. `lightfast_find_similar` (`server.ts:62-74`)
- **Description**: "Find content semantically similar to a given document or URL"
- **Schema**: `V1FindSimilarBaseSchema.shape` (extracted from `.refine()` wrapper)
- **Handler**: Calls `lightfast.findSimilar(validated)`
- **Response**: JSON-stringified results

#### CLI Configuration

**Environment Variables**:
- `LIGHTFAST_API_KEY`: API key (alternative to `--api-key` flag)

**CLI Flags**:
- `--api-key`: Lightfast API key (required)
- `--base-url`: API base URL (default: https://lightfast.ai)
- `--help` / `-h`: Show help text
- `--version` / `-v`: Show version

**Usage** (`index.ts:20-28`):
```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp", "--api-key", "sk_live_..."]
    }
  }
}
```

#### Package Configuration (`core/mcp/package.json`)

```json
{
  "name": "@lightfastai/mcp",
  "version": "0.1.0-alpha.1",
  "type": "module",
  "bin": {
    "lightfast-mcp": "./dist/index.mjs",
    "@lightfastai/mcp": "./dist/index.mjs"
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "publishConfig": {
    "tag": "latest",
    "access": "public"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "lightfast": "workspace:*",
    "zod": "catalog:zod3"
  }
}
```

#### Build Configuration (`core/mcp/tsup.config.ts`)

- **Entry Point**: `src/index.ts`
- **Format**: ESM-only (`.mjs` extension)
- **Target**: Node.js 18
- **Banner**: `#!/usr/bin/env node` shebang for CLI execution
- **Features**: TypeScript declarations, sourcemaps, version injection

#### MCP Transport Pattern

The server uses `StdioServerTransport` (`server.ts:77-78`) for stdin/stdout communication:
- MCP protocol messages on stdin/stdout
- Logging must go to stderr to avoid protocol corruption
- AI assistants (Claude Desktop) communicate over this transport

### 4. API-SDK-MCP Alignment

#### Coverage Matrix

| API Endpoint | SDK Method | MCP Tool | Status |
|--------------|------------|----------|--------|
| POST `/v1/search` | ✅ `search()` | ✅ `lightfast_search` | Complete |
| POST `/v1/contents` | ✅ `contents()` | ✅ `lightfast_contents` | Complete |
| POST `/v1/findsimilar` | ✅ `findSimilar()` | ✅ `lightfast_find_similar` | Complete |
| GET `/v1/graph/{id}` | ❌ Missing | ❌ Missing | **Gap** |
| GET `/v1/related/{id}` | ❌ Missing | ❌ Missing | **Gap** |
| POST/GET `/v1/answer/[...v]` | ❌ Streaming only | ❌ Not applicable | By design |

#### Alignment Gaps

**Graph Endpoint Not Exposed**:
- **API**: GET `/v1/graph/{id}` exists at `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
- **Logic**: `graphLogic()` implemented in `~/lib/v1/index.ts`
- **SDK**: No `graph()` method in `core/lightfast/src/client.ts`
- **MCP**: No `lightfast_graph` tool in `core/mcp/src/server.ts`

**Related Endpoint Not Exposed**:
- **API**: GET `/v1/related/{id}` exists at `apps/console/src/app/(api)/v1/related/[id]/route.ts`
- **Logic**: `relatedLogic()` implemented in `~/lib/v1/index.ts`
- **SDK**: No `related()` method in `core/lightfast/src/client.ts`
- **MCP**: No `lightfast_related` tool in `core/mcp/src/server.ts`

**Answer Endpoint Streaming-Only**:
- **API**: POST/GET `/v1/answer/[...v]` at `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`
- **Nature**: Streaming AI agent responses using `@lightfastai/ai-sdk/server/adapters/fetch`
- **SDK**: Not applicable - streaming responses require different handling
- **MCP**: Not exposed - MCP tools are request/response, not streaming

#### Type Alignment

**Schemas**:
- All v1 request/response types defined in `@repo/console-types/src/api/v1/`
- SDK re-exports these types from `core/lightfast/src/types.ts:1-22`
- MCP uses same schemas directly from `@repo/console-types`

**Type Flow**:
```
API Definition (@repo/console-types)
    ↓
SDK Re-exports (core/lightfast/types.ts)
    ↓
MCP Imports (@repo/console-types)
```

All three layers share the same type definitions, ensuring schema consistency.

### 5. Release Configuration

#### Changesets Setup

**Configuration**: `.changeset/config.json:1-11`
```json
{
  "fixed": [["lightfast", "@lightfastai/mcp"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

**Key**: Both packages version together as a fixed group.

#### CI/CD Workflow

**Workflow**: `.github/workflows/release.yml:1-73`

**Trigger**:
- Push to main with changeset file changes
- Manual workflow dispatch

**Steps**:
1. Configure git user: `lightfast-release-bot`
2. Install dependencies with pnpm 10.5.2
3. Build packages: `pnpm turbo build --filter lightfast --filter @lightfastai/mcp`
4. Run tests: `pnpm --filter lightfast test`
5. Changesets action:
   - Creates "Version Packages" PR (if unreleased changesets)
   - OR publishes to npm (if Version Packages PR merged)
6. Publishes with npm provenance

**Secrets Required**:
- `LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN`: For creating PRs
- `LIGHTFAST_RELEASE_BOT_NPM_TOKEN`: For publishing to npm

#### Changeset Verification

**Workflow**: `.github/workflows/verify-changeset.yml:1-70`

**Validation**:
- Checks changeset mentions `lightfast` or `@lightfastai/mcp`
- Enforces semver type: patch, minor, or major
- Requires summary description

#### Manual Release Commands

**From root** (`package.json:40-42`):
```bash
pnpm changeset           # Create new changeset
pnpm version-packages    # Consume changesets, update versions
pnpm release             # Publish to npm
```

## Code References

### V1 API Endpoints
- `apps/console/src/app/(api)/v1/search/route.ts:34-149` - Search endpoint POST handler
- `apps/console/src/app/(api)/v1/contents/route.ts:24-104` - Contents endpoint POST handler
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:27-114` - FindSimilar endpoint POST handler
- `apps/console/src/app/(api)/v1/graph/[id]/route.ts:24-81` - Graph endpoint GET handler
- `apps/console/src/app/(api)/v1/related/[id]/route.ts:24-71` - Related endpoint GET handler
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:43-220` - Answer endpoint POST handler
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-183` - Dual authentication middleware

### SDK Implementation
- `core/lightfast/src/index.ts:2-43` - Main exports
- `core/lightfast/src/client.ts:50-61` - Lightfast class constructor
- `core/lightfast/src/client.ts:78-88` - search() method
- `core/lightfast/src/client.ts:103-107` - contents() method
- `core/lightfast/src/client.ts:124-138` - findSimilar() method
- `core/lightfast/src/client.ts:143-188` - Private request() handler
- `core/lightfast/src/types.ts:35-62` - SDK input types
- `core/lightfast/src/errors.ts:4-100` - Error hierarchy

### MCP Server
- `core/mcp/src/index.ts:32-77` - CLI entry point
- `core/mcp/src/server.ts:22-25` - SDK initialization
- `core/mcp/src/server.ts:33-43` - lightfast_search tool
- `core/mcp/src/server.ts:46-56` - lightfast_contents tool
- `core/mcp/src/server.ts:62-74` - lightfast_find_similar tool
- `core/mcp/src/server.ts:77-78` - Stdio transport setup

### Release Configuration
- `.changeset/config.json:1-11` - Changesets configuration
- `.github/workflows/release.yml:1-73` - Release automation
- `.github/workflows/verify-changeset.yml:1-70` - PR validation
- `core/lightfast/package.json:1-68` - SDK package config
- `core/mcp/package.json:1-67` - MCP package config
- `core/lightfast/tsup.config.ts:4-26` - SDK build config
- `core/mcp/tsup.config.ts:4-18` - MCP build config

## Architecture Documentation

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistant (Claude)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MCP Protocol (stdio)
┌───────────────────────────▼─────────────────────────────────────┐
│              @lightfastai/mcp (0.1.0-alpha.1)                    │
│  Tools: lightfast_search, lightfast_contents, lightfast_find_similar │
│  CLI: npx @lightfastai/mcp --api-key sk_live_...               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ TypeScript SDK
┌───────────────────────────▼─────────────────────────────────────┐
│                lightfast (0.1.0-alpha.1)                         │
│  Methods: search(), contents(), findSimilar()                   │
│  Auth: Bearer sk-lf-{key}                                       │
│  Transport: HTTP fetch (30s timeout)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (Bearer token)
┌───────────────────────────▼─────────────────────────────────────┐
│              apps/console/src/app/(api)/v1/                     │
│  POST /v1/search          - Semantic search                     │
│  POST /v1/contents        - Fetch by IDs                        │
│  POST /v1/findsimilar     - Similarity discovery                │
│  GET  /v1/graph/{id}      - Relationship graph ⚠️ Not in SDK    │
│  GET  /v1/related/{id}    - Direct relations ⚠️ Not in SDK      │
│  POST /v1/answer/[...v]   - AI agent (streaming)                │
│                                                                  │
│  Auth: withDualAuth() - API keys or Clerk sessions              │
│  Logic: Extracted to ~/lib/v1/                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current Coverage

**Fully Implemented Pipeline**:
1. User creates `lightfast` client with API key
2. Calls `search()`, `contents()`, or `findSimilar()`
3. SDK makes HTTP POST to v1 endpoint
4. API authenticates via `withDualAuth()`
5. Logic functions process request
6. Response returned through SDK to user

**MCP Integration**:
1. Claude Desktop loads `@lightfastai/mcp` via stdio
2. User message triggers tool call
3. MCP server validates args with Zod schema
4. Handler calls corresponding SDK method
5. SDK makes HTTP request to API
6. Response JSON-stringified and returned to Claude

### Type Safety Chain

All layers share types from `@repo/console-types`:
- **API**: Uses Zod schemas for validation
- **SDK**: Re-exports same types for input/output
- **MCP**: Uses same Zod schemas for tool validation

This ensures end-to-end type consistency.

### Build Pipeline

**SDK Build**:
```bash
cd core/lightfast
pnpm build  # tsup → dist/*.mjs + dist/*.d.ts
```

**MCP Build**:
```bash
cd core/mcp
pnpm build  # tsup → dist/index.mjs (executable) + dist/index.d.ts
```

**Build Dependencies**:
- Both use tsup 8.5.0
- Target Node.js 18+
- ESM-only output
- TypeScript declarations included

### Publishing Flow

**Changesets Workflow**:
1. Developer: `pnpm changeset` → Create changeset in `.changeset/`
2. PR: `.github/workflows/verify-changeset.yml` validates format
3. Merge: `.github/workflows/release.yml` triggers
4. Action: Creates "Version Packages" PR with bumped versions
5. Merge VP PR: Changesets publishes to npm with provenance
6. Result: Both packages published together (fixed group)

## Current State

### What Exists

**V1 API** (✅ Complete):
- 6 HTTP endpoints fully implemented
- Dual authentication (API key + Clerk session)
- Logic functions extracted and testable
- Type-safe request/response handling
- Comprehensive error responses

**SDK** (⚠️ Partial):
- 3 of 6 endpoints implemented
- Type-safe client with error handling
- Timeout support (30s default)
- ESM package ready for npm
- Comprehensive error classes

**MCP** (⚠️ Partial):
- 3 MCP tools matching SDK methods
- CLI with proper argument parsing
- Stdio transport for Claude Desktop
- ESM package ready for npm
- Proper error handling

**Release Infrastructure** (✅ Complete):
- Changesets configuration
- GitHub Actions CI/CD
- Automated versioning and publishing
- PR validation
- npm provenance support

### What's Missing

**SDK Gaps**:
1. No `graph(id: string, options?: GraphOptions)` method
2. No `related(id: string)` method
3. Answer endpoint intentionally not exposed (streaming)

**MCP Gaps**:
1. No `lightfast_graph` tool
2. No `lightfast_related` tool
3. Answer streaming not exposed (by design)

**Impact**:
- Users can search, fetch, and find similar content
- Users CANNOT traverse relationship graphs via SDK
- Users CANNOT get direct relationships via SDK
- Graph functionality only available through raw HTTP API

## Related Research

No prior research documents found on this topic.

## Questions for Further Investigation

1. **Should graph/related be added to SDK before first release?**
   - These are implemented in API and logic layer
   - Adding them would complete the SDK surface
   - Would require corresponding MCP tools

2. **Is streaming answer endpoint meant for SDK?**
   - Currently only accessible via raw HTTP
   - Could be exposed as async generator or callback pattern
   - May require different SDK architecture (streaming client)

3. **Are there alpha users expecting full API coverage?**
   - Current version is 0.1.0-alpha.1 (pre-release)
   - May want to achieve feature parity before 1.0.0

4. **Should packages publish before adding missing methods?**
   - Pros: Get feedback on core search functionality early
   - Cons: Alpha users can't access all API features
   - Current state allows limited but functional use cases
