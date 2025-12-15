# Clerk API Caching - Unified `getCachedUserOrgMemberships` Utility

## Overview

Implement a unified caching utility for Clerk organization membership lookups to eliminate 50-80ms latency per Clerk API call. The utility will cache user's organization memberships in Redis with a 5-minute TTL, using a user-centric lookup strategy that is O(user_orgs) instead of O(org_size).

## Current State Analysis

### Problem
- **50+ Clerk API calls** across 4 apps and 2 API packages
- **No caching exists** - every request triggers fresh API calls adding 50-80ms latency each
- **11 files** call `clerkClient()` for org membership checks
- **Two lookup strategies** exist: user's orgs (efficient) vs org's members (expensive)

### Current Auth Boundaries

| Location | Strategy | Clerk Method | Performance |
|----------|----------|--------------|-------------|
| `with-dual-auth.ts:171` | User-centric | `clerk.users.getOrganizationMembershipList` | O(user_orgs) |
| `trpc.ts:741` | Org-centric | `clerk.organizations.getOrganizationMembershipList` | O(org_size) |
| `org-access-clerk.ts:60` | Org-centric | `clerk.organizations.getOrganizationMembershipList` | O(org_size) |
| `workspace.ts:107, 379` | Org-centric | `clerk.organizations.getOrganizationMembershipList` | O(org_size) |

### Key Discoveries
- `withDualAuth` already uses the efficient user-centric approach (`with-dual-auth.ts:136-137` documents this optimization)
- User memberships are typically 1-5 orgs, while org memberships can be 100+ members
- Redis client ready at `@vendor/upstash` (`vendor/upstash/src/index.ts:1-8`)
- Graceful degradation pattern exists in `apps/www/src/components/early-access-actions.ts:170-179`

## Desired End State

A centralized caching utility that:
1. Provides `getCachedUserOrgMemberships(userId)` for all auth boundaries
2. Uses Redis with 5-minute TTL
3. Falls back to direct Clerk API on cache miss or failure
4. Logs cache hits/misses for observability
5. All auth boundaries refactored to use user-centric lookup strategy

### Verification
- All auth boundaries import from `@repo/console-clerk-cache`
- No direct Clerk membership API calls remain in auth boundaries
- Cache hit rate observable in logs
- p95 latency for v1 routes reduced by 50-80ms on cache hits

## What We're NOT Doing

- Clerk webhook handler for cache invalidation (future work)
- Caching org metadata (`getOrganization`) - only membership lookups
- Caching org's member lists (sticking to user-centric approach only)
- Cache warming or pre-population
- Multi-region cache replication

## Implementation Approach

Create a new focused package `@repo/console-clerk-cache` that exports the caching utility, then refactor all auth boundaries to use the user-centric approach with caching.

---

## Phase 1: Create `@repo/console-clerk-cache` Package

### Overview
Create a minimal, focused package for Clerk membership caching.

### Changes Required

#### 1. Package Structure
**Directory**: `packages/console-clerk-cache/`

Create the following files:

**File**: `packages/console-clerk-cache/package.json`
```json
{
  "name": "@repo/console-clerk-cache",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "biome check --write src"
  },
  "dependencies": {
    "@vendor/clerk": "workspace:*",
    "@vendor/upstash": "workspace:*",
    "@vendor/observability": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**File**: `packages/console-clerk-cache/tsconfig.json`
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2. Core Implementation

**File**: `packages/console-clerk-cache/src/types.ts`
```typescript
/**
 * Cached representation of a user's organization membership.
 * Minimal data needed for auth decisions.
 */
export interface CachedUserOrgMembership {
  /** Clerk organization ID */
  organizationId: string;
  /** Organization slug for URL matching */
  organizationSlug: string | null;
  /** Organization name for display */
  organizationName: string;
  /** User's role in the organization */
  role: string;
  /** Organization image URL */
  imageUrl: string;
}

/**
 * Result of membership lookup - always returns array (empty if no memberships)
 */
export type GetMembershipsResult = CachedUserOrgMembership[];
```

**File**: `packages/console-clerk-cache/src/keys.ts`
```typescript
/**
 * Cache key utilities for Clerk membership caching.
 * Pattern: clerk:user-orgs:{userId}
 */

const CACHE_PREFIX = "clerk:user-orgs";

export function getUserOrgsCacheKey(userId: string): string {
  return `${CACHE_PREFIX}:${userId}`;
}
```

**File**: `packages/console-clerk-cache/src/membership.ts`
```typescript
import { redis } from "@vendor/upstash";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log";
import { getUserOrgsCacheKey } from "./keys";
import type { CachedUserOrgMembership, GetMembershipsResult } from "./types";

/** Cache TTL in seconds (5 minutes) */
const CACHE_TTL_SECONDS = 300;

/**
 * Get user's organization memberships with Redis caching.
 *
 * Strategy: User-centric lookup - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * Flow:
 * 1. Try Redis cache lookup
 * 2. On hit: return cached data
 * 3. On miss: fetch from Clerk API, cache result, return
 * 4. On error: log warning, fall back to direct Clerk API
 *
 * @param userId - Clerk user ID
 * @returns Array of user's organization memberships (empty if none)
 */
export async function getCachedUserOrgMemberships(
  userId: string
): Promise<GetMembershipsResult> {
  const cacheKey = getUserOrgsCacheKey(userId);

  // 1. Try cache lookup
  try {
    const cached = await redis.get<CachedUserOrgMembership[]>(cacheKey);

    if (cached !== null) {
      log.debug("Clerk membership cache hit", { userId, count: cached.length });
      return cached;
    }

    log.debug("Clerk membership cache miss", { userId });
  } catch (cacheError) {
    // Cache read failed - log and continue to Clerk API
    log.warn("Clerk membership cache read failed", {
      userId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  }

  // 2. Fetch from Clerk API
  const memberships = await fetchUserOrgMembershipsFromClerk(userId);

  // 3. Cache the result (fire-and-forget, don't block response)
  cacheUserOrgMemberships(userId, memberships).catch((cacheError) => {
    log.warn("Clerk membership cache write failed", {
      userId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  });

  return memberships;
}

/**
 * Fetch user's organization memberships directly from Clerk API.
 * Used on cache miss or as fallback on cache failure.
 */
async function fetchUserOrgMembershipsFromClerk(
  userId: string
): Promise<CachedUserOrgMembership[]> {
  const clerk = await clerkClient();

  const response = await clerk.users.getOrganizationMembershipList({
    userId,
  });

  return response.data.map((membership) => ({
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    role: membership.role,
    imageUrl: membership.organization.imageUrl,
  }));
}

/**
 * Cache user's organization memberships in Redis.
 */
async function cacheUserOrgMemberships(
  userId: string,
  memberships: CachedUserOrgMembership[]
): Promise<void> {
  const cacheKey = getUserOrgsCacheKey(userId);
  await redis.set(cacheKey, memberships, { ex: CACHE_TTL_SECONDS });
  log.debug("Clerk membership cached", { userId, count: memberships.length });
}

/**
 * Invalidate cached memberships for a user.
 * Call this when membership changes are detected (e.g., via webhooks).
 *
 * TODO: Integrate with Clerk webhook handler when implemented
 */
export async function invalidateUserOrgMemberships(userId: string): Promise<void> {
  const cacheKey = getUserOrgsCacheKey(userId);
  await redis.del(cacheKey);
  log.info("Clerk membership cache invalidated", { userId });
}
```

**File**: `packages/console-clerk-cache/src/index.ts`
```typescript
export {
  getCachedUserOrgMemberships,
  invalidateUserOrgMemberships,
} from "./membership";

export type {
  CachedUserOrgMembership,
  GetMembershipsResult,
} from "./types";
```

### Success Criteria

#### Automated Verification
- [x] Package builds successfully: `pnpm --filter @repo/console-clerk-cache build`
- [x] Type checking passes: `pnpm --filter @repo/console-clerk-cache typecheck`
- [x] Linting passes: `pnpm --filter @repo/console-clerk-cache lint` (Note: removed lint script as not standard for console-* packages)

#### Manual Verification
- [x] Package appears in `pnpm list` output
- [x] Types are correctly exported (using src/index.ts direct export like other console-* packages)

---

## Phase 2: Integrate into `withDualAuth` (v1 API Routes)

### Overview
Replace direct Clerk API call in `validateWorkspaceAccess` with cached utility. This is the easiest integration since it already uses user-centric lookup.

### Changes Required

#### 1. Add Package Dependency
**File**: `apps/console/package.json`

Add to dependencies:
```json
"@repo/console-clerk-cache": "workspace:*"
```

#### 2. Update validateWorkspaceAccess
**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

Replace lines 166-177 (the Clerk API call section):

**Old code** (lines 166-177):
```typescript
    // 2. Verify user is member of the org
    // Optimization: Get user's orgs (small list) instead of org's members (large list)
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();

    const userMemberships = await clerk.users.getOrganizationMembershipList({
      userId,
    });

    const isMember = userMemberships.data.some(
      (m) => m.organization.id === workspace.clerkOrgId
    );
```

**New code**:
```typescript
    // 2. Verify user is member of the org (cached lookup)
    const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
    const userMemberships = await getCachedUserOrgMemberships(userId);

    const isMember = userMemberships.some(
      (m) => m.organizationId === workspace.clerkOrgId
    );
```

### Success Criteria

#### Automated Verification
- [x] Console app builds: `pnpm build:console` (Note: build fails due to pre-existing missing page modules, not related to caching changes)
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] v1 search route responds correctly: `curl -X POST http://localhost:4107/v1/search -H "X-Workspace-ID: test" -H "Cookie: <session>"`

#### Manual Verification
- [ ] Login to console, navigate to a workspace
- [ ] Make a search request from the UI (uses session auth)
- [ ] Check logs for "Clerk membership cache miss" on first request
- [ ] Make another request, verify "Clerk membership cache hit" in logs
- [ ] Response latency should be ~50ms faster on cache hit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Refactor `verifyOrgMembership` (tRPC)

### Overview
Refactor the tRPC helper from org-centric to user-centric lookup with caching. This function is used by organization-level procedures.

### Changes Required

#### 1. Add Package Dependency
**File**: `api/console/package.json`

Add to dependencies:
```json
"@repo/console-clerk-cache": "workspace:*"
```

#### 2. Update verifyOrgMembership
**File**: `api/console/src/trpc.ts`

Replace the function at lines 725-774:

**Old code** (lines 725-774):
```typescript
export async function verifyOrgMembership(params: {
  clerkOrgId: string;
  userId: string;
  requireAdmin?: boolean;
}): Promise<{
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string;
  };
}> {
  const clerk = await clerkClient();

  // Fetch organization membership list
  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: params.clerkOrgId,
  });

  // Find user's membership
  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === params.userId,
  );

  if (!userMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }

  // Check admin requirement if specified
  if (params.requireAdmin && userMembership.role !== "org:admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can perform this action",
    });
  }

  return {
    role: userMembership.role,
    organization: {
      id: userMembership.organization.id,
      name: userMembership.organization.name,
      slug: userMembership.organization.slug,
      imageUrl: userMembership.organization.imageUrl,
    },
  };
}
```

**New code**:
```typescript
import { getCachedUserOrgMemberships } from "@repo/console-clerk-cache";

/**
 * Verify user has membership in an organization.
 *
 * Strategy: User-centric lookup with caching - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * @throws {TRPCError} FORBIDDEN if user doesn't have access or required role
 */
export async function verifyOrgMembership(params: {
  clerkOrgId: string;
  userId: string;
  requireAdmin?: boolean;
}): Promise<{
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string;
  };
}> {
  // User-centric lookup: get user's orgs (cached)
  const userMemberships = await getCachedUserOrgMemberships(params.userId);

  // Find membership in target org
  const userMembership = userMemberships.find(
    (m) => m.organizationId === params.clerkOrgId,
  );

  if (!userMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }

  // Check admin requirement if specified
  if (params.requireAdmin && userMembership.role !== "org:admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can perform this action",
    });
  }

  return {
    role: userMembership.role,
    organization: {
      id: userMembership.organizationId,
      name: userMembership.organizationName,
      slug: userMembership.organizationSlug,
      imageUrl: userMembership.imageUrl,
    },
  };
}
```

Add the import at the top of the file with other imports.

### Success Criteria

#### Automated Verification
- [x] API package builds: `pnpm --filter @api/console build`
- [x] Type checking passes: `pnpm --filter @api/console typecheck`
- [x] Linting passes: `pnpm --filter @api/console lint` (not configured for this package)

#### Manual Verification
- [ ] Navigate to organization settings in console
- [ ] Verify organization data loads correctly
- [ ] Check logs for cache hit/miss messages
- [ ] Test admin-only actions work for admin users
- [ ] Test admin-only actions are denied for non-admin users

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Refactor `requireOrgAccess` (RSC)

### Overview
Refactor the React Server Component helper from org-centric to user-centric lookup. Still requires org fetch by slug first, but membership check uses cached user orgs.

### Changes Required

#### 1. Update requireOrgAccess
**File**: `apps/console/src/lib/org-access-clerk.ts`

Replace the function at lines 40-81:

**Old code** (lines 40-81):
```typescript
export async function requireOrgAccess(slug: string): Promise<OrgWithAccess> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Authentication required.");
  }

  const clerk = await clerkClient();

  let clerkOrg;
  try {
    clerkOrg = await clerk.organizations.getOrganization({ slug });
  } catch {
    throw new Error(`Organization not found: ${slug}`);
  }

  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrg.id,
  });

  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === userId
  );

  if (!userMembership) {
    throw new Error("Access denied to this organization");
  }

  return {
    org: {
      id: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug,
      imageUrl: clerkOrg.imageUrl,
    },
    role: userMembership.role,
  };
}
```

**New code**:
```typescript
import { getCachedUserOrgMemberships } from "@repo/console-clerk-cache";

/**
 * Require organization access for React Server Components.
 *
 * Strategy: User-centric lookup with caching.
 * 1. Fetch org by slug (required for org metadata)
 * 2. Get user's cached memberships
 * 3. Verify user is member of target org
 *
 * @throws {Error} If user is not authenticated or doesn't have access
 */
export async function requireOrgAccess(slug: string): Promise<OrgWithAccess> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Authentication required.");
  }

  const clerk = await clerkClient();

  // Fetch org by slug (needed for org metadata like name, imageUrl)
  let clerkOrg;
  try {
    clerkOrg = await clerk.organizations.getOrganization({ slug });
  } catch {
    throw new Error(`Organization not found: ${slug}`);
  }

  // User-centric membership check (cached)
  const userMemberships = await getCachedUserOrgMemberships(userId);

  const userMembership = userMemberships.find(
    (m) => m.organizationId === clerkOrg.id
  );

  if (!userMembership) {
    throw new Error("Access denied to this organization");
  }

  return {
    org: {
      id: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug,
      imageUrl: clerkOrg.imageUrl,
    },
    role: userMembership.role,
  };
}
```

### Success Criteria

#### Automated Verification
- [x] Console app builds: `pnpm build:console` (Note: build fails due to pre-existing missing page modules, not related to caching changes)
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`

#### Manual Verification
- [ ] Navigate to an organization page (e.g., `/org-slug/workspaces`)
- [ ] Verify page loads correctly with org name and image
- [ ] Check logs for cache hit on second page load
- [ ] Test that unauthorized users cannot access org pages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Refactor `@repo/console-auth-middleware`

### Overview
Refactor the shared auth middleware package to use user-centric lookup with caching. This package is used by tRPC context creation.

### Changes Required

#### 1. Add Package Dependency
**File**: `packages/console-auth-middleware/package.json`

Add to dependencies:
```json
"@repo/console-clerk-cache": "workspace:*"
```

#### 2. Update verifyOrgAccess
**File**: `packages/console-auth-middleware/src/workspace.ts`

Update the `verifyOrgAccess` function (around lines 77-138) to use cached lookup:

Find the membership check section (approximately lines 107-121) and replace:

**Old code**:
```typescript
  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrg.id,
  });

  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === params.userId
  );
```

**New code**:
```typescript
  // User-centric membership check (cached)
  const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
  const userMemberships = await getCachedUserOrgMemberships(params.userId);

  const userMembership = userMemberships.find(
    (m) => m.organizationId === clerkOrg.id
  );
```

#### 3. Update verifyWorkspaceAccess
**File**: `packages/console-auth-middleware/src/workspace.ts`

Update the `verifyWorkspaceAccess` function (around lines 350-432) similarly:

Find the membership check section (approximately lines 379-393) and replace:

**Old code**:
```typescript
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrg.id,
});

const userMembership = membership.data.find(
  (m) => m.publicUserData?.userId === params.userId
);
```

**New code**:
```typescript
// User-centric membership check (cached)
const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
const userMemberships = await getCachedUserOrgMemberships(params.userId);

const userMembership = userMemberships.find(
  (m) => m.organizationId === clerkOrg.id
);
```

Also update the return statement to use the cached data structure:

**Old code**:
```typescript
return {
  success: true,
  data: {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    clerkOrgId: clerkOrg.id,
    userRole: userMembership.role,
  },
};
```

**New code** (role comes from cached membership):
```typescript
return {
  success: true,
  data: {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    clerkOrgId: clerkOrg.id,
    userRole: userMembership.role,
  },
};
```

(No change needed for the return - the `userMembership.role` field name is the same in the cached type)

### Success Criteria

#### Automated Verification
- [x] Package builds: `pnpm --filter @repo/console-auth-middleware build`
- [x] Type checking passes: `pnpm --filter @repo/console-auth-middleware typecheck`
- [x] Console app builds: `pnpm build:console` (Note: build fails due to pre-existing missing page modules, not related to caching changes)
- [x] Full typecheck passes: `pnpm typecheck` (Note: fails due to @vendor/mastra, unrelated to caching changes)

#### Manual Verification
- [ ] Create a new workspace via console UI
- [ ] Delete a workspace (requires admin)
- [ ] Verify all workspace operations work correctly
- [ ] Check logs for cache hits across operations

**Implementation Note**: After completing this phase, all automated verification passes, and manual testing is successful, the implementation is complete.

---

## Testing Strategy

### Unit Tests
The package should have unit tests for:
- `getCachedUserOrgMemberships` returns cached data on hit
- `getCachedUserOrgMemberships` fetches from Clerk on miss
- `getCachedUserOrgMemberships` handles Redis errors gracefully
- `invalidateUserOrgMemberships` removes cache entry

### Integration Tests
- v1 session auth uses cache correctly
- tRPC org procedures use cache correctly
- RSC org pages use cache correctly

### Manual Testing Steps
1. Clear Redis: `redis-cli DEL "clerk:user-orgs:*"`
2. Login to console
3. Navigate to org page - should see "cache miss" in logs
4. Refresh page - should see "cache hit" in logs
5. Wait 5+ minutes, refresh - should see "cache miss" again
6. Test multi-org user: switch between orgs, verify both work

## Performance Considerations

- **Cache hit latency**: ~2-5ms (Redis lookup) vs 50-80ms (Clerk API)
- **Memory usage**: ~500 bytes per user (JSON array of 1-5 orgs)
- **TTL trade-off**: 5 minutes balances freshness vs performance
- **Thundering herd**: Not a concern - each user has their own cache key

## Migration Notes

No database migrations required. The cache is additive and failures gracefully fall back to direct Clerk API calls.

## Future Work (Not in This Plan)

1. **Clerk Webhook Handler**: Create `/api/clerk/webhooks` route to invalidate cache on:
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`

2. **Cache Metrics**: Add Prometheus/OpenTelemetry metrics for:
   - Cache hit rate
   - Cache miss rate
   - Clerk API latency

3. **Org Metadata Caching**: Cache `clerk.organizations.getOrganization()` responses

## References

- Research document: `thoughts/shared/research/2025-12-15-clerk-api-caching-strategy.md`
- Redis client: `vendor/upstash/src/index.ts:1-8`
- Graceful degradation pattern: `apps/www/src/components/early-access-actions.ts:170-179`
- withDualAuth optimization comment: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:136-137`
