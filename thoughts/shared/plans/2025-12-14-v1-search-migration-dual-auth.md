# V1 Search Migration: Dual Auth & UI Route Selection

## Overview

Migrate the console's internal workspace search to use `/v1/search` with dual authentication support, enabling both Clerk session users (console UI) and API key users (external clients) to use a unified search endpoint. This consolidates two separate search routes into one, adds mode-based reranking to the UI, and implements proper workspace access validation for session users.

## Current State Analysis

### Two Separate Search Routes

1. **Workspace Route** (`/[slug]/[workspaceName]/api/search`):
   - Uses Clerk session auth (`auth()`)
   - Validates workspace access via `resolveWorkspaceByName()` (org membership check)
   - Uses `llmRelevanceFilter()` for reranking (always "thorough" mode)
   - No mode selection, no pagination

2. **V1 Route** (`/v1/search`):
   - Uses API key auth (`withApiKeyAuth()`)
   - Trusts client-provided workspace ID (no validation)
   - Uses `@repo/console-rerank` with mode selection (fast/balanced/thorough)
   - Full pagination, enriched results, URL population

### Key Discoveries

- `llmRelevanceFilter()` at `apps/console/src/lib/neural/llm-filter.ts:66` is essentially the "thorough" mode reranker - same concept as `LLMRerankProvider` in `@repo/console-rerank`
- The v1 route trusts `X-Workspace-ID` header without validation - security concern for session users
- WorkspaceSearch component at `apps/console/src/components/workspace-search.tsx:126` calls the workspace route directly
- Response schemas differ significantly - v1 uses `data[]` with richer fields, workspace uses `results[]`

## Desired End State

After this plan is complete:

1. **Single unified search endpoint** at `/v1/search` handling both auth methods
2. **Workspace access validation** for Clerk session users (don't trust client-provided workspace ID)
3. **Mode toggle in UI** defaulting to "balanced", allowing user to select fast/balanced/thorough
4. **Workspace search route deleted** - fully removed, no backwards compatibility
5. **WorkspaceSearch component** adapted to v1 schema and calling `/v1/search`
6. **Contents and FindSimilar routes** updated with same dual-auth pattern

### Verification

- Console search UI works with all 3 modes
- API key auth still works exactly as before
- Session users can only search workspaces they have access to
- Latency breakdown shows correct mode-specific metrics (rerank, not llmFilter)

## What We're NOT Doing

- Adding backwards compatibility for old response format
- Supporting both routes simultaneously
- Changing the rerank providers themselves
- Modifying fourPathParallelSearch internals
- Adding new search features (just consolidating existing)

## Implementation Approach

Option B from research: **Session-Validated Dual Auth** - Add workspace access validation for Clerk sessions in a new `withDualAuth()` function that wraps both auth methods.

**Rationale**: This maintains security (users can only search workspaces they belong to) while providing a clean single endpoint. The existing `resolveWorkspaceByName()` pattern validates org membership via Clerk API.

**Middleware Strategy**: The Next.js middleware (`apps/console/src/middleware.ts`) runs before route handlers. Currently, `/v1/*` routes would match `isOrgPageRoute` (`/:slug` pattern) and trigger `auth.protect()`, which would reject API key requests (no Clerk session). We need to add v1 routes to a bypass matcher so auth is handled at the route level instead.

---

## Phase 0: Update Middleware to Bypass v1 Routes

### Overview

Add v1 API routes to a middleware bypass matcher. This allows both API key and session requests to reach the route handlers, where `withDualAuth()` handles authentication.

**Why this is needed**: The current middleware would reject API key requests to `/v1/*` because:
1. `/v1/search` matches `isOrgPageRoute` (`/:slug` where slug="v1")
2. This triggers `auth.protect()` which requires a Clerk session
3. API key requests have no Clerk session → rejected with 401

This is the same pattern used for webhooks (`/api/github/webhooks`, `/api/vercel/webhooks`).

### Changes Required

#### 1. Add v1 API Route Matcher

**File**: `apps/console/src/middleware.ts`

Add new route matcher after `isOrgPageRoute` (after line 62):

```typescript
// v1 API routes - auth handled at route level (API key or session)
// Must bypass Clerk middleware to allow API key authentication
const isV1ApiRoute = createRouteMatcher(["/v1/(.*)"]);
```

#### 2. Add Bypass Logic in Middleware

**File**: `apps/console/src/middleware.ts`

Add condition after `isUserScopedRoute` check (after line 140, before `isOrgScopedRoute`):

```typescript
// v1 API routes: auth handled at route level via withDualAuth
// Supports both API key (external clients) and session (console UI)
else if (isV1ApiRoute(req)) {
  // Allow through without Clerk auth checks
  // Route handlers use withDualAuth() for authentication
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] API key requests to `/v1/search` are not blocked by middleware
- [ ] Session requests to `/v1/search` are not blocked by middleware
- [ ] Other routes still protected by Clerk middleware

---

## Phase 1: Create Dual Auth Helper

### Overview

Create a new `withDualAuth()` function that tries API key auth first, then falls back to Clerk session auth with workspace access validation.

### Changes Required

#### 1. New Dual Auth Function

**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

Create new file that exports `withDualAuth()`:

```typescript
/**
 * Dual Authentication Middleware for v1 Routes
 *
 * Supports both API key and Clerk session authentication.
 * - API key: Uses existing withApiKeyAuth, trusts X-Workspace-ID
 * - Session: Validates workspace access via org membership
 */

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { withApiKeyAuth, type AuthResult, type ApiKeyAuthContext } from "./with-api-key-auth";

export interface DualAuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}

export interface DualAuthSuccess {
  success: true;
  auth: DualAuthContext;
}

export interface DualAuthError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  status: number;
}

export type DualAuthResult = DualAuthSuccess | DualAuthError;

/**
 * Verify authentication via API key OR Clerk session
 *
 * Priority:
 * 1. API key (Authorization: Bearer header) - for external clients
 * 2. Clerk session - for console UI
 *
 * For API key auth: trusts X-Workspace-ID header (existing behavior)
 * For session auth: validates workspace access via org membership
 */
export async function withDualAuth(
  request: NextRequest,
  requestId?: string
): Promise<DualAuthResult> {
  // Check for API key first
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    // API key path - use existing implementation
    const apiKeyResult = await withApiKeyAuth(request, requestId);

    if (!apiKeyResult.success) {
      return apiKeyResult;
    }

    return {
      success: true,
      auth: {
        workspaceId: apiKeyResult.auth.workspaceId,
        userId: apiKeyResult.auth.userId,
        authType: "api-key",
        apiKeyId: apiKeyResult.auth.apiKeyId,
      },
    };
  }

  // Session path - validate via Clerk
  const { userId } = await auth();

  if (!userId) {
    log.warn("No authentication provided", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Provide 'Authorization: Bearer <api-key>' header or sign in.",
      },
      status: 401,
    };
  }

  // Session requires X-Workspace-ID header
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    log.warn("Missing X-Workspace-ID for session auth", { requestId, userId });
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      },
      status: 400,
    };
  }

  // Validate workspace access for session users
  const accessResult = await validateWorkspaceAccess(workspaceId, userId, requestId);

  if (!accessResult.success) {
    return accessResult;
  }

  log.info("Session auth verified", { requestId, userId, workspaceId });

  return {
    success: true,
    auth: {
      workspaceId,
      userId,
      authType: "session",
    },
  };
}

/**
 * Validate that a Clerk user has access to the specified workspace
 *
 * Security: Verifies org membership via Clerk API before allowing access.
 * This prevents users from accessing workspaces they don't belong to.
 */
async function validateWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requestId?: string
): Promise<DualAuthResult> {
  try {
    // 1. Fetch workspace to get clerkOrgId
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: {
        id: true,
        clerkOrgId: true,
      },
    });

    if (!workspace) {
      log.warn("Workspace not found", { requestId, workspaceId });
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Workspace not found",
        },
        status: 404,
      };
    }

    // 2. Verify user is member of the org
    const { clerkClient } = await import("@vendor/clerk/server");
    const clerk = await clerkClient();

    const membership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: workspace.clerkOrgId,
    });

    const userMembership = membership.data.find(
      (m) => m.publicUserData?.userId === userId
    );

    if (!userMembership) {
      log.warn("User not member of workspace org", {
        requestId,
        userId,
        workspaceId,
        orgId: workspace.clerkOrgId,
      });
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access denied to this workspace",
        },
        status: 403,
      };
    }

    return {
      success: true,
      auth: {
        workspaceId,
        userId,
        authType: "session",
      },
    };
  } catch (error) {
    log.error("Workspace access validation failed", { requestId, error });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to validate workspace access",
      },
      status: 500,
    };
  }
}

/**
 * Helper to create error response from DualAuthError
 */
export function createDualAuthErrorResponse(
  result: DualAuthError,
  requestId: string
): Response {
  return Response.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}
```

#### 2. Export from lib index

**File**: `apps/console/src/app/(api)/v1/lib/index.ts` (create if doesn't exist)

```typescript
export * from "./with-api-key-auth";
export * from "./with-dual-auth";
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] File exists at correct path
- [ ] Types are correctly defined

---

## Phase 2: Update v1/search Route to Use Dual Auth

### Overview

Modify the v1/search route to use the new `withDualAuth()` instead of `withApiKeyAuth()`. The search logic remains unchanged.

### Changes Required

#### 1. Update v1/search Route

**File**: `apps/console/src/app/(api)/v1/search/route.ts`

Replace `withApiKeyAuth` import and usage with `withDualAuth`:

```typescript
// Change import (line 31)
import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";

// Update auth call (lines 41-49)
const authResult = await withDualAuth(request, requestId);
if (!authResult.success) {
  return createDualAuthErrorResponse(authResult, requestId);
}

const { workspaceId, userId, authType } = authResult.auth;

log.info("v1/search authenticated", {
  requestId,
  workspaceId,
  userId,
  authType,
  apiKeyId: authResult.auth.apiKeyId
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] API key auth still works (test with curl)
- [ ] Session auth requires X-Workspace-ID header
- [ ] Session auth validates org membership

---

## Phase 3: Update WorkspaceSearch Component

### Overview

Update the WorkspaceSearch component to:
1. Call `/v1/search` instead of workspace route
2. Add mode toggle (fast/balanced/thorough)
3. Adapt to v1 response schema
4. Send workspace ID header

### Changes Required

#### 1. Update Imports and Remove Local Types

**File**: `apps/console/src/components/workspace-search.tsx`

Import types from `@repo/console-types` instead of defining locally:

```typescript
// Update imports (add after line 12)
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import { Zap, Scale, Brain } from "lucide-react";
import type { V1SearchResponse, V1SearchResult, RerankMode } from "@repo/console-types";

// DELETE local interfaces (lines 21-38):
// - SearchResult interface
// - SearchResponse interface
// These are now imported from @repo/console-types

// Add mode options constant (after OBSERVATION_TYPE_OPTIONS)
const MODE_OPTIONS: Array<{ value: RerankMode; label: string; icon: typeof Zap; description: string }> = [
  { value: "fast", label: "Fast", icon: Zap, description: "Vector scores only (~50ms)" },
  { value: "balanced", label: "Balanced", icon: Scale, description: "Cohere rerank (~130ms)" },
  { value: "thorough", label: "Thorough", icon: Brain, description: "LLM scoring (~600ms)" },
];
```

#### 2. Update State Types

**File**: `apps/console/src/components/workspace-search.tsx`

Update state to use imported types:

```typescript
// Update line 78 - use V1SearchResponse instead of local SearchResponse
const [searchResults, setSearchResults] = useState<V1SearchResponse | null>(null);

// Add mode state after filters state (after line 84)
const [mode, setMode] = useState<RerankMode>("balanced");
```

#### 3. Update Search Handler

**File**: `apps/console/src/components/workspace-search.tsx`

Update the fetch call (lines 125-139) to call v1/search with mode:

```typescript
const handleSearch = useCallback(async () => {
  if (!query.trim()) {
    setError("Please enter a search query");
    return;
  }

  if (!store) {
    setError("No store configured for this workspace. Connect a source first.");
    return;
  }

  setIsSearching(true);
  setError(null);

  try {
    const response = await fetch("/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-ID": store.workspaceId,
      },
      body: JSON.stringify({
        query: query.trim(),
        limit: 20,
        offset: 0,
        mode: mode,
        filters: {
          sourceTypes: filters.sourceTypes.length > 0 ? filters.sourceTypes : undefined,
          observationTypes: filters.observationTypes.length > 0 ? filters.observationTypes : undefined,
        },
        includeContext: true,
        includeHighlights: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: undefined, message: undefined })) as { error?: string; message?: string };
      throw new Error(errorData.message ?? errorData.error ?? `Search failed: ${response.status}`);
    }

    const data = (await response.json()) as V1SearchResponse;
    setSearchResults(data);
    void updateSearchParams(query.trim());
  } catch (err) {
    setError(err instanceof Error ? err.message : "Search failed");
    setSearchResults(null);
  } finally {
    setIsSearching(false);
  }
}, [query, store, mode, updateSearchParams, filters]);
```

#### 4. Add Mode Toggle UI

**File**: `apps/console/src/components/workspace-search.tsx`

Add mode toggle after the store info section (after line 190):

```typescript
{/* Search Mode Toggle */}
<div className="flex flex-col gap-1">
  <span className="text-xs text-muted-foreground">Search Mode</span>
  <ToggleGroup
    type="single"
    value={mode}
    onValueChange={(value) => value && setMode(value as RerankMode)}
    className="justify-start"
  >
    {MODE_OPTIONS.map((option) => (
      <ToggleGroupItem
        key={option.value}
        value={option.value}
        aria-label={option.label}
        className="gap-1 text-xs"
        title={option.description}
      >
        <option.icon className="h-3 w-3" />
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
</div>
```

#### 5. Update Results Display

**File**: `apps/console/src/components/workspace-search.tsx`

Update the results section to use `data` instead of `results` and show rerank latency:

```typescript
{/* Results Header - update line 296-303 */}
<div className="flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    {searchResults.data.length} result{searchResults.data.length !== 1 ? "s" : ""} found
    <span className="ml-2 text-xs">
      ({searchResults.latency.total}ms total, {searchResults.latency.retrieval}ms retrieval
      {searchResults.latency.rerank > 0 && `, ${searchResults.latency.rerank}ms ${searchResults.meta.mode}`})
    </span>
  </p>
  <Badge variant="outline" className="text-xs">
    {searchResults.meta.mode}
  </Badge>
</div>

{/* Results List - update lines 306-325 */}
{searchResults.data.length === 0 ? (
  <Card className="border-border/60">
    <CardContent className="py-8 text-center">
      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">
        No results found for "{query}"
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Try a different query or check that documents are indexed
      </p>
    </CardContent>
  </Card>
) : (
  <div className="space-y-3">
    {searchResults.data.map((result, index) => (
      <SearchResultCard key={result.id} result={result} rank={index + 1} />
    ))}
  </div>
)}
```

#### 6. Update SearchResultCard

**File**: `apps/console/src/components/workspace-search.tsx`

Update the SearchResultCard to handle v1 response fields (lines 380-441):

```typescript
function SearchResultCard({ result, rank }: { result: V1SearchResult; rank: number }) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank indicator */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
            {rank}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-tight">
                {result.title || "Untitled Document"}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <Badge
                  variant={scorePercent >= 80 ? "default" : scorePercent >= 60 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {scorePercent}%
                </Badge>
                {/* Source badge */}
                {result.source && (
                  <Badge variant="outline" className="text-xs">
                    {result.source}
                  </Badge>
                )}
              </div>
            </div>

            {/* Snippet */}
            {result.snippet && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {result.snippet}
              </p>
            )}

            {/* Type and date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.type && <span>{result.type}</span>}
              {result.occurredAt && (
                <span>
                  {new Date(result.occurredAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* URL / Actions */}
            {result.url && (
              <div className="flex items-center gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-md"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{result.url}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Mode toggle appears in UI with 3 options
- [ ] Default mode is "balanced"
- [ ] Changing mode affects search results and latency
- [ ] Results display correctly with source, type, and URL
- [ ] Latency shows mode-specific rerank time

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Delete Workspace Search Route

### Overview

Remove the workspace-level search route entirely. No backwards compatibility.

### Changes Required

#### 1. Delete Route File

**File to delete**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`

Delete the entire file.

#### 2. Clean up imports (if any)

Search for any imports of the deleted route and remove them.

### Success Criteria

#### Automated Verification:
- [x] Route file deleted
- [x] No remaining imports: `pnpm --filter @lightfast/console typecheck`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/[slug]/[workspaceName]/api/search` returns 404
- [ ] Console search still works via `/v1/search`

---

## Phase 5: Update v1/contents and v1/findsimilar Routes

### Overview

Apply the same dual-auth pattern to the other v1 routes for consistency.

### Changes Required

#### 1. Update v1/contents Route

**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

Replace `withApiKeyAuth` with `withDualAuth`:

```typescript
// Change import
import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";

// Update auth call in POST handler
const authResult = await withDualAuth(request, requestId);
if (!authResult.success) {
  return createDualAuthErrorResponse(authResult, requestId);
}

const { workspaceId, userId, authType } = authResult.auth;
```

#### 2. Update v1/findsimilar Route

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

Same changes as v1/contents.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] All v1 routes support both API key and session auth
- [ ] Session auth validates workspace access for all routes

---

## Phase 6: Update Store tRPC to Return workspaceId

### Overview

The WorkspaceSearch component needs the workspaceId to send in the X-Workspace-ID header. Update the store.get tRPC query to include it.

### Changes Required

#### 1. Check Current Return Type

**File**: `api/console/src/router/org/workspace.ts` (or wherever store.get is defined)

Verify `workspaceId` is returned. If not, add it to the return object.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles
- [x] Store query returns workspaceId (as `id` field)

#### Manual Verification:
- [x] Component can access store.id (workspaceId)

**Note**: The store.get tRPC already returns `id: workspaceWithCount.id` at line 665. The WorkspaceSearch component uses `store.id` as the X-Workspace-ID header. No changes needed.

---

## Testing Strategy

### Unit Tests
- Test `withDualAuth()` with:
  - Valid API key → returns api-key auth type
  - Valid session + valid workspace → returns session auth type
  - Valid session + invalid workspace → returns 404
  - Valid session + unauthorized workspace → returns 403
  - No auth → returns 401

### Integration Tests
- Test `/v1/search` endpoint with:
  - API key auth (existing behavior preserved)
  - Session auth with valid workspace
  - Session auth with workspace user doesn't own

### Manual Testing Steps
1. Sign in to console, navigate to search
2. Verify mode toggle appears with 3 options
3. Test each mode and observe latency changes:
   - Fast: ~50ms rerank
   - Balanced: ~130ms rerank
   - Thorough: ~600ms rerank
4. Verify results display correctly with all fields
5. Test API key auth via curl to ensure it still works

## Performance Considerations

- **Session auth adds latency**: Clerk API call to verify org membership (~100-200ms)
- **Mitigation**: Cache org membership in future iteration
- **No impact on API key path**: Existing behavior unchanged

## Migration Notes

- **Breaking change**: Old workspace route is deleted
- **No client changes needed**: WorkspaceSearch component is internal
- **API key users unaffected**: v1/search continues to work exactly as before

## References

- Original research: `thoughts/shared/research/2025-12-14-v1-search-migration.md`
- Next.js middleware: `apps/console/src/middleware.ts`
- v1/search route: `apps/console/src/app/(api)/v1/search/route.ts`
- Workspace search route: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/api/search/route.ts`
- API key auth: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
- Rerank factory: `packages/console-rerank/src/factory.ts`
- WorkspaceSearch component: `apps/console/src/components/workspace-search.tsx`
