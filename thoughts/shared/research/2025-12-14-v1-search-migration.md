---
date: 2025-12-14T08:19:40Z
researcher: Claude
git_commit: 8fa7cab2e53439c58dc5e6dfa2a4cb1955d85372
branch: feat/memory-layer-foundation
repository: lightfast
topic: "v1/search Migration: Removing Workspace-Level Search Route"
tags: [research, codebase, v1-api, search, migration, console]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: v1/search Migration - Consolidating Search APIs

**Date**: 2025-12-14T08:19:40Z
**Researcher**: Claude
**Git Commit**: 8fa7cab2e53439c58dc5e6dfa2a4cb1955d85372
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Can we completely remove `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` and migrate to use `/v1/search` instead, ensuring v1/search handles both internal lightfast.ai console search AND API key authentication for external users?

## Summary

The migration is feasible but requires modifications. The current v1/search route **only supports API key authentication**, while the workspace search route uses **Clerk session authentication**. To consolidate:

1. **v1/search** needs dual-auth support: detect and handle both Clerk sessions (for console UI) and API keys (for external users)
2. **WorkspaceSearch component** needs to call `/v1/search` instead of the workspace-level route, passing appropriate auth headers
3. **Response schema differences** must be reconciled - v1/search has richer schema with mode-based reranking

## Detailed Findings

### Current Architecture

#### 1. Workspace-Level Search Route (To Be Removed)
**Location**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

- **Authentication**: Clerk session via `auth()` from `@clerk/nextjs/server`
- **Workspace Resolution**: `resolveWorkspaceByName()` - verifies org membership then fetches workspace
- **Search Method**: `fourPathParallelSearch()` + `llmRelevanceFilter()`
- **Endpoint**: `POST /[slug]/[workspaceName]/api/search`

**Request Schema**:
```typescript
{
  query: string;
  topK?: number;           // 1-100, default 10
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: { start?: string; end?: string };
  }
}
```

**Response Schema**:
```typescript
{
  results: Array<{
    id: string;
    title: string;
    url: string;           // Always ""
    snippet: string;
    score: number;
    metadata: {
      relevanceScore: number;
      vectorScore: number;
      title?: string;
      snippet?: string;
    }
  }>;
  requestId: string;
  context?: {
    clusters: Array<{ topic, summary, keywords }>;
    relevantActors: Array<{ displayName, expertise }>;
  };
  latency: {
    total: number;
    embedding: number;
    retrieval: number;
    entitySearch: number;
    clusterSearch: number;
    actorSearch: number;
    llmFilter: number;
  }
}
```

#### 2. v1/search Route (Target)
**Location**: `apps/console/src/app/(api)/v1/search/route.ts`

- **Authentication**: API key via `withApiKeyAuth()` - `Authorization: Bearer <key>` + `X-Workspace-ID: <id>`
- **Workspace Resolution**: Workspace ID passed directly in header (no database lookup)
- **Search Method**: `fourPathParallelSearch()` + mode-based reranking via `@repo/console-rerank`
- **Endpoint**: `POST /v1/search`

**Request Schema** (from `@repo/console-types`):
```typescript
{
  query: string;
  limit?: number;          // 1-100, default 10
  offset?: number;         // default 0
  mode?: "fast" | "balanced" | "thorough";  // default "balanced"
  filters?: {              // Same as workspace route
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: { start?: string; end?: string };
  };
  includeContext?: boolean;    // default true
  includeHighlights?: boolean; // default true
}
```

**Response Schema** (from `@repo/console-types`):
```typescript
{
  data: Array<{
    id: string;
    title: string;
    url: string;              // Populated via enrichSearchResults
    snippet: string;
    score: number;
    source: string;           // e.g., "github", "linear"
    type: string;             // e.g., "commit", "issue"
    occurredAt?: string;      // ISO datetime
    entities?: Array<{ key, category }>;
    highlights?: { title?, snippet? };
  }>;
  context?: {
    clusters: Array<{ topic, summary, keywords }>;
    relevantActors: Array<{ displayName, expertiseDomains }>;
  };
  meta: {
    total: number;
    limit: number;
    offset: number;
    took: number;
    mode: "fast" | "balanced" | "thorough";
    paths: { vector, entity, cluster, actor };
  };
  latency: {
    total: number;
    embedding?: number;
    retrieval: number;
    entitySearch?: number;
    clusterSearch?: number;
    actorSearch?: number;
    rerank: number;           // NEW: reranking latency
  };
  requestId: string;
}
```

### Key Differences

| Aspect | Workspace Route | v1/search |
|--------|-----------------|-----------|
| **Auth** | Clerk session (`auth()`) | API key (`withApiKeyAuth()`) |
| **Workspace** | Resolved by name via URL | Header `X-Workspace-ID` |
| **Limit param** | `topK` | `limit` + `offset` |
| **Reranking** | `llmRelevanceFilter()` | `@repo/console-rerank` (mode-based) |
| **URL in results** | Always `""` | Populated via `enrichSearchResults()` |
| **Pagination** | None | `offset` parameter |
| **Mode** | N/A | `fast`/`balanced`/`thorough` |
| **Result schema** | Less fields | Includes `source`, `type`, `entities` |

### Authentication Patterns

#### withApiKeyAuth (Current v1)
**Location**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:57-170`

1. Extract `Authorization: Bearer <key>` header
2. Extract `X-Workspace-ID` header (required)
3. Hash API key with SHA-256
4. Query `lightfast_user_api_keys` table for matching hash + active status
5. Check expiration timestamp
6. Update `lastUsedAt` (non-blocking)
7. Return `{ workspaceId, userId, apiKeyId }`

**Note**: Workspace ID is **not validated** against user's access - client provides it directly.

#### resolveWorkspaceByName (Current Workspace Route)
**Location**: `packages/console-auth-middleware/src/workspace.ts:172-225`

1. Call `verifyOrgAccess()` - fetch org by slug, verify user membership via Clerk API
2. Query `orgWorkspaces` table by `clerkOrgId` + `name`
3. Return `{ workspaceId, workspaceName, workspaceSlug, clerkOrgId }`

**Key Difference**: Validates user has org membership before allowing workspace access.

### WorkspaceSearch Component Analysis

**Location**: `apps/console/src/components/workspace-search.tsx`

**Current Behavior**:
- Fetches workspace store info via tRPC: `trpc.workspace.store.get`
- Calls `fetch(\`/\${orgSlug}/\${workspaceName}/api/search\`)` with POST
- Expects response with `results`, `requestId`, `latency` fields
- Displays `latency.total`, `latency.retrieval`, `latency.llmFilter`
- Uses `result.score` and `result.metadata.relevanceScore` for display

**Migration Requirements**:
1. Change fetch URL to `/v1/search`
2. Add workspace ID header (from store info)
3. Handle new response schema (`data` instead of `results`)
4. Update latency display (no `llmFilter`, has `rerank` instead)
5. Handle new result fields (`source`, `type`, `entities`)
6. Decide on `mode` parameter (could make UI configurable)

### Supporting v1 Routes

#### /v1/contents
**Location**: `apps/console/src/app/(api)/v1/contents/route.ts`

- Fetches full content for document/observation IDs
- Request: `{ ids: string[] }` (max 50)
- Returns full content for observations, metadata for documents

#### /v1/findsimilar
**Location**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

- Finds similar content by ID or URL
- Uses vector similarity via Pinecone
- Includes cluster membership info

### Migration Path Options

#### Option A: Dual Auth in v1/search

Add Clerk session detection to `withApiKeyAuth`:

```typescript
// Pseudo-code for dual auth
async function withDualAuth(request: NextRequest, requestId?: string) {
  // Try API key first
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (apiKey) {
    return withApiKeyAuth(request, requestId);
  }

  // Fall back to Clerk session
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  // For Clerk auth, workspace ID must come from header
  const workspaceId = request.headers.get("X-Workspace-ID");
  if (!workspaceId) {
    return { success: false, error: "X-Workspace-ID required", status: 400 };
  }

  // Optionally verify workspace access
  return { success: true, auth: { workspaceId, userId, apiKeyId: null } };
}
```

**Pros**: Single endpoint, simpler API surface
**Cons**: Workspace access not validated for Clerk users (security concern)

#### Option B: Session-Validated Dual Auth

Add workspace access validation for Clerk sessions:

```typescript
async function withDualAuth(request: NextRequest, requestId?: string) {
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (apiKey) {
    // API key path - unchanged
    return withApiKeyAuth(request, requestId);
  }

  // Clerk session path
  const { userId, orgSlug } = await auth();
  if (!userId) {
    return { success: false, error: "Authentication required", status: 401 };
  }

  const workspaceId = request.headers.get("X-Workspace-ID");
  if (!workspaceId) {
    return { success: false, error: "X-Workspace-ID required", status: 400 };
  }

  // Verify user has access to this workspace via org membership
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    return { success: false, error: "Workspace not found", status: 404 };
  }

  // Verify org membership via Clerk
  const orgResult = await verifyOrgAccess({ clerkOrgSlug: orgSlug, userId });
  if (!orgResult.success || orgResult.data.clerkOrgId !== workspace.clerkOrgId) {
    return { success: false, error: "Access denied", status: 403 };
  }

  return { success: true, auth: { workspaceId, userId, apiKeyId: null } };
}
```

**Pros**: Maintains security, single endpoint
**Cons**: More complexity, requires org slug from session

#### Option C: Separate Internal Route

Keep a thin internal route that proxies to v1/search:

```typescript
// /[slug]/[workspaceName]/api/search/route.ts
export async function POST(request: NextRequest, context) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve workspace via existing pattern
  const workspaceResult = await resolveWorkspaceByName({...});
  if (!workspaceResult.success) {...}

  // Forward to v1/search with workspace ID header
  const v1Response = await fetch("/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Workspace-ID": workspaceResult.data.workspaceId,
      "X-Internal-Auth": "clerk-session", // Signal internal call
    },
    body: await request.text(),
  });

  return v1Response;
}
```

**Pros**: No changes to v1/search, preserves auth patterns
**Cons**: Extra hop, route still exists (just thinner)

## Code References

### Search Routes
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts` - Current workspace route
- `apps/console/src/app/(api)/v1/search/route.ts` - v1 public API route

### Auth Utilities
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:57` - API key auth
- `packages/console-auth-middleware/src/workspace.ts:172` - Clerk workspace resolution

### Components
- `apps/console/src/components/workspace-search.tsx:67` - Search UI component
- `apps/console/src/components/workspace-search.tsx:126` - Fetch call location

### Schemas
- `packages/console-types/src/api/v1/search.ts` - v1 search schemas
- `packages/console-types/src/api/v1/contents.ts` - v1 contents schemas
- `packages/console-types/src/api/v1/findsimilar.ts` - v1 findsimilar schemas

### Shared Utilities
- `apps/console/src/lib/neural/four-path-search.ts:167` - fourPathParallelSearch
- `apps/console/src/lib/neural/four-path-search.ts:336` - enrichSearchResults

## Architecture Documentation

### Current Search Flow (Workspace Route)

```
WorkspaceSearch UI
       │
       ▼
POST /[slug]/[workspaceName]/api/search
       │
       ├─ auth() → Clerk userId
       │
       ├─ resolveWorkspaceByName()
       │    │
       │    ├─ verifyOrgAccess() → Clerk API
       │    │
       │    └─ db.query.orgWorkspaces → workspaceId
       │
       ├─ fourPathParallelSearch()
       │    │
       │    ├─ Vector (Pinecone)
       │    ├─ Entity (DB)
       │    ├─ Cluster (DB)
       │    └─ Actor (DB)
       │
       └─ llmRelevanceFilter()
              │
              └─ Response
```

### Current v1/search Flow

```
External Client
       │
       ▼
POST /v1/search
       │ Headers: Authorization: Bearer <key>
       │          X-Workspace-ID: <id>
       │
       ├─ withApiKeyAuth()
       │    │
       │    ├─ hashApiKey()
       │    │
       │    └─ db.query.userApiKeys → userId, apiKeyId
       │
       ├─ fourPathParallelSearch()
       │    │
       │    └─ (same 4 paths)
       │
       ├─ createRerankProvider(mode)
       │    │
       │    └─ reranker.rerank()
       │
       └─ enrichSearchResults()
              │
              └─ Response
```

### Proposed Unified Flow

```
WorkspaceSearch UI          External Client
       │                          │
       ▼                          ▼
POST /v1/search ◄─────────────────┘
       │
       ├─ withDualAuth()
       │    │
       │    ├─ API Key path:
       │    │    └─ hashApiKey() → db lookup
       │    │
       │    └─ Clerk session path:
       │         └─ auth() + workspace access verify
       │
       ├─ fourPathParallelSearch()
       │
       ├─ createRerankProvider(mode)
       │
       └─ enrichSearchResults()
              │
              └─ Unified Response
```

## Open Questions

1. **Security**: Should Clerk sessions require workspace access validation, or trust client-provided workspace ID?
   - Current API key auth trusts client workspace ID
   - Current Clerk auth validates via org membership

2. **Mode Selection**: How should the WorkspaceSearch UI select rerank mode?
   - Default to "balanced" for normal use?
   - Add UI toggle for power users?
   - Use "fast" mode initially, "balanced" on user request?

3. **Response Mapping**: Should WorkspaceSearch component adapt to v1 response schema, or should v1 support legacy response format?
   - Prefer: Adapt component to v1 schema (cleaner)
   - Alternative: Response format query param (complex)

4. **Backwards Compatibility**: Do any external consumers depend on the workspace-level route?
   - Need to check if any integrations use `/[slug]/[workspaceName]/api/search`

5. **Latency Display**: v1/search uses `rerank` instead of `llmFilter` - how to update UI?
   - Direct rename in component
   - Or support both fields conditionally
