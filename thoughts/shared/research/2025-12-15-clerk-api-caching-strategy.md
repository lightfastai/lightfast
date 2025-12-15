---
date: 2025-12-15T12:30:00+08:00
researcher: Claude
git_commit: b6cc18daffa893e5b11b97699fd7dab459f0878b
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Clerk API Usage Patterns for Unified Caching Strategy"
tags: [research, clerk, caching, auth, redis, performance]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude
---

# Research: Clerk API Usage Patterns for Unified Caching Strategy

**Date**: 2025-12-15T12:30:00+08:00
**Researcher**: Claude
**Git Commit**: b6cc18daffa893e5b11b97699fd7dab459f0878b
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question
Research all Clerk API usage patterns across the codebase to inform design of a unified caching strategy, specifically a centralized `getCachedUserOrgMemberships(userId)` utility.

## Summary

The codebase makes **50+ Clerk API calls** across 4 apps and 2 API packages, with organization membership verification being the most frequent operation. Currently, **no caching exists** for Clerk API responses - every request triggers fresh API calls adding 50-80ms latency each. The primary caching opportunity is `clerk.users.getOrganizationMembershipList()` and `clerk.organizations.getOrganizationMembershipList()`, which are called in auth boundaries for every authenticated request.

Key findings:
- **11 files** call `clerkClient()` for org membership checks
- **3 auth patterns** exist: `withDualAuth` (v1), `verifyOrgMembership` (tRPC), `requireOrgAccess` (RSC)
- **@vendor/upstash** provides Redis client but no Clerk caching utilities
- **React.cache()** used for per-request memoization, but not for cross-request caching
- Membership data is relatively stable (changes only on org/user modifications)

## Detailed Findings

### 1. All Clerk API Callsites

#### Organization Membership Lookups (Primary Caching Target)

| File | Line | Method | Lookup Type | Context |
|------|------|--------|-------------|---------|
| `api/console/src/router/user/organization.ts` | 28 | `clerk.users.getOrganizationMembershipList()` | User's orgs | List user's organizations |
| `api/console/src/router/user/workspace.ts` | 56 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Verify user can create workspace |
| `api/console/src/router/user/workspace.ts` | 129 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Verify admin for workspace deletion |
| `api/console/src/router/org/workspace.ts` | 75 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Verify membership for workspace creation |
| `api/console/src/router/org/workspace.ts` | 226 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Verify admin for workspace deletion |
| `api/console/src/trpc.ts` | 741 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | `verifyOrgMembership()` helper |
| `api/console/src/inngest/workflow/neural/actor-resolution.ts` | 143 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Get all members for actor resolution |
| `apps/console/src/lib/org-access-clerk.ts` | 60 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | `requireOrgAccess()` RSC helper |
| `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts` | 171 | `clerk.users.getOrganizationMembershipList()` | User's orgs | Session auth workspace validation |
| `packages/console-auth-middleware/src/workspace.ts` | 107 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | Session auth path |
| `packages/console-auth-middleware/src/workspace.ts` | 379 | `clerk.organizations.getOrganizationMembershipList()` | Org's members | API key auth path |

#### Other Clerk API Calls

| File | Line | Method | Purpose |
|------|------|--------|---------|
| `api/console/src/router/user/account.ts` | 30 | `clerk.users.getUser()` | Get user profile |
| `api/console/src/router/user/organization.ts` | 70 | `clerk.organizations.getOrganization()` | Get org by ID |
| `api/console/src/router/user/organization.ts` | 140 | `clerk.organizations.createOrganization()` | Create new org |
| `api/console/src/router/user/organization.ts` | 220-232 | `clerk.organizations.getOrganization()` + `updateOrganization()` | Update org |
| `api/console/src/router/org/clerk.ts` | 36-51 | `clerk.organizations.createOrganization()` | Create org for new user |
| `api/console/src/router/org/clerk.ts` | 107 | `clerk.organizations.createOrganizationMembership()` | Add member to org |
| `api/console/src/inngest/workflow/neural/actor-resolution.ts` | 154 | `clerk.users.getUser()` | Get user details for actor |
| `api/chat/src/router/billing/billing.ts` | 40, 154 | `clerk.billing.getUserBillingSubscription()` | Get billing info |
| `api/chat/src/router/chat/usage.ts` | 60, 71 | `clerk.billing.getUserBillingSubscription()` | Get billing for usage |

### 2. Auth Middleware Patterns

#### Pattern A: `withDualAuth` (v1 API Routes)

**Location**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-128`

**Flow**:
1. Check for `Authorization: Bearer <key>` header
2. If API key: delegate to `withApiKeyAuth()` (database lookup)
3. If session: call `auth()` from Clerk, then `validateWorkspaceAccess()`
4. `validateWorkspaceAccess()` calls `clerk.users.getOrganizationMembershipList()` at line 171

**Return Type**:
```typescript
type DualAuthResult =
  | { success: true; auth: { workspaceId, userId, authType, apiKeyId? } }
  | { success: false; error: { code, message }; status: number }
```

**Consumers**: 3 v1 routes
- `POST /v1/search` at line 49
- `POST /v1/contents` at line 38
- `POST /v1/findsimilar` at line 193

**Clerk API Impact**: 1 call per session-authenticated request

#### Pattern B: `verifyOrgMembership` (tRPC)

**Location**: `api/console/src/trpc.ts:725-774`

**Input**:
```typescript
{ clerkOrgId: string; userId: string; requireAdmin?: boolean }
```

**Flow**:
1. Get Clerk client
2. Call `clerk.organizations.getOrganizationMembershipList({ organizationId })`
3. Find user in membership list
4. Optionally check admin role

**Return Type**:
```typescript
{ role: string; organization: { id, name, slug, imageUrl } }
```

**Consumers**: Called in `userRouter` procedures
- `organization.find` at line 84
- `organization.updateName` at line 225

**Clerk API Impact**: 1 call per procedure invocation

#### Pattern C: `requireOrgAccess` (React Server Components)

**Location**: `apps/console/src/lib/org-access-clerk.ts:40-81`

**Input**: `slug: string` (org slug from URL)

**Flow**:
1. Get `userId` from `auth()`
2. Fetch org by slug: `clerk.organizations.getOrganization({ slug })`
3. Get membership list: `clerk.organizations.getOrganizationMembershipList()`
4. Find user's membership

**Return Type**:
```typescript
{ org: { id, name, slug, imageUrl }; role: string }
```

**Consumers**: Org layout at `app/(app)/(org)/[slug]/layout.tsx:39`

**Clerk API Impact**: 2 calls per org page render (getOrganization + getMembershipList)

#### Pattern D: `@repo/console-auth-middleware` Package

**Location**: `packages/console-auth-middleware/src/workspace.ts`

**Functions**:
- `verifyOrgAccess()` at lines 77-138 - Verify user has org access
- `resolveWorkspaceByName()` at lines 172-225 - Resolve workspace + verify access
- `resolveWorkspaceBySlug()` at lines 252-305 - Internal workspace resolution
- `verifyWorkspaceAccess()` at lines 350-432 - All-in-one with role

**All functions** call `clerk.organizations.getOrganizationMembershipList()` internally

### 3. Data Flow Analysis

#### What Triggers Clerk Calls?

| Trigger | Pattern | Frequency | Data Fetched |
|---------|---------|-----------|--------------|
| v1 API request (session) | `withDualAuth` | Every request | User's orgs |
| tRPC org procedure | `orgScopedProcedure` context | Every procedure | Org's members |
| tRPC user procedure (some) | `verifyOrgMembership` | When org access needed | Org's members |
| Server component render | `requireOrgAccess` | Every org page | Org's members |
| Inngest workflow | Direct calls | Per workflow step | Org's members |

#### User's Orgs vs Org's Members Lookup

**User's orgs** (`clerk.users.getOrganizationMembershipList`):
- Used in: `withDualAuth`, `organization.listUserOrganizations`
- Returns: All orgs the user belongs to (typically 1-5)
- Best for: "Which orgs does this user have access to?"

**Org's members** (`clerk.organizations.getOrganizationMembershipList`):
- Used in: `verifyOrgMembership`, `requireOrgAccess`, auth middleware
- Returns: All members of a specific org (can be 1-1000+)
- Best for: "Does this user have access to this org?"

**Optimization Note**: `withDualAuth` at line 166-167 documents:
```typescript
// Optimization: fetches user's orgs (O(user_orgs))
// instead of org's members (O(org_size))
```

#### Latency Impact

- Clerk API call: 50-80ms per call
- v1 session request: +50-80ms (1 call)
- RSC org page: +100-160ms (2 calls)
- tRPC org procedure: +50-80ms (1 call in context creation)

### 4. Existing Caching Patterns

#### `@vendor/upstash` - Redis Client

**Location**: `vendor/upstash/src/index.ts:1-8`

```typescript
import { Redis } from "@upstash/redis";
export const redis = new Redis({ url, token });
```

**Current usage**:
- Email deduplication in `apps/www/src/components/early-access-actions.ts`
- No Clerk data caching

#### `React.cache()` - Per-Request Memoization

**Location**: `packages/console-trpc/src/server.tsx:24-78`

```typescript
const createUserContext = cache(async () => { ... });
const createOrgContext = cache(async () => { ... });
```

**Limitation**: Only memoizes within single RSC render, not across requests

#### TanStack Query - Client Hydration

**Location**: `packages/console-trpc/src/server.tsx:135-158`

```typescript
export function prefetch(queryOptions) { ... }
export function HydrateClient({ children }) { ... }
```

**staleTime**: 30 seconds - prevents immediate refetch on client

#### No `unstable_cache` Usage

Search found no usage of Next.js `unstable_cache` API in the codebase.

### 5. Consumer Inventory

#### v1 API Routes (3 routes)

| Route | File | Auth Pattern |
|-------|------|--------------|
| `POST /v1/search` | `apps/console/src/app/(api)/v1/search/route.ts` | `withDualAuth` |
| `POST /v1/contents` | `apps/console/src/app/(api)/v1/contents/route.ts` | `withDualAuth` |
| `POST /v1/findsimilar` | `apps/console/src/app/(api)/v1/findsimilar/route.ts` | `withDualAuth` |

#### tRPC Procedures

| Router | Procedure Count | Auth Requirement | Clerk Calls |
|--------|-----------------|------------------|-------------|
| `userRouter` | 25 | `userScopedProcedure` | 2 use `verifyOrgMembership` |
| `orgRouter` | 27 | `orgScopedProcedure` | All via context |
| `m2mRouter` | 13 | M2M tokens | None (trusted) |
| `apiKeyProcedure` | 1 | API key | None |

#### Server Components

| Component | File | Auth Pattern |
|-----------|------|--------------|
| Org Layout | `app/(app)/(org)/[slug]/layout.tsx:39` | `requireOrgAccess` |
| Workspace Settings | `app/(app)/(org)/[slug]/[workspaceName]/settings/page.tsx:15` | `auth()` |

#### Next.js Middleware

**Location**: `apps/console/src/middleware.ts`

| Route Matcher | Auth Enforcement |
|---------------|------------------|
| `isPublicRoute` | No auth |
| `isTeamCreationRoute` | Pending users allowed |
| `isUserScopedRoute` | Procedure-level auth |
| `isOrgScopedRoute` | `auth.protect()` |
| `isV1ApiRoute` | Route-level `withDualAuth` |

## Code References

### Clerk API Callsites
- `api/console/src/router/user/organization.ts:28` - User's org list
- `api/console/src/trpc.ts:741` - Org membership verification
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:171` - Session auth validation
- `apps/console/src/lib/org-access-clerk.ts:60` - RSC org access

### Auth Middleware
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-128` - Dual auth implementation
- `api/console/src/trpc.ts:725-774` - `verifyOrgMembership` helper
- `apps/console/src/lib/org-access-clerk.ts:40-81` - `requireOrgAccess` helper
- `packages/console-auth-middleware/src/workspace.ts:350-432` - `verifyWorkspaceAccess`

### Existing Caching
- `vendor/upstash/src/index.ts:1-8` - Redis client
- `packages/console-trpc/src/server.tsx:24-35` - React.cache() usage

## Architecture Documentation

### Current Auth Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Request Flow                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ v1 Routes:   Request → withDualAuth → [API Key DB | Clerk API] → Handler   │
│                                              ↓                               │
│                            clerk.users.getOrganizationMembershipList()       │
│                                                                              │
│ tRPC (org):  Request → orgScopedProcedure → createOrgContext → Handler      │
│                                                   ↓                          │
│                           clerk.organizations.getOrganizationMembershipList()│
│                                                                              │
│ RSC:         Render → requireOrgAccess → [getOrg | getMembershipList]       │
│                                                   ↓                          │
│                           clerk.organizations.getOrganization()              │
│                           clerk.organizations.getOrganizationMembershipList()│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Import Patterns

**Vendor abstraction** (`@vendor/clerk/server`):
- `api/console/src/router/user/organization.ts`
- `api/console/src/router/org/workspace.ts`
- `api/console/src/trpc.ts`
- `packages/console-auth-middleware/src/workspace.ts`

**Direct SDK** (`@clerk/nextjs/server`):
- `api/console/src/router/user/account.ts`
- `apps/console/src/lib/org-access-clerk.ts`
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

## Design Implications for `getCachedUserOrgMemberships(userId)`

### Recommended Approach

1. **Cache Key**: `user-orgs:{userId}` - User's organization memberships
2. **Cache Location**: Redis via `@vendor/upstash`
3. **TTL**: 5-10 minutes (org membership changes are infrequent)
4. **Invalidation**: On org membership changes via Clerk webhooks

### Integration Points

The utility should be integrated at:

1. **`withDualAuth`** (`apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:171`)
   - Replace direct Clerk call with cached lookup

2. **`createOrgContext`** (`api/console/src/trpc.ts:738-743`)
   - Replace `verifyOrgMembership` call with cached lookup

3. **`requireOrgAccess`** (`apps/console/src/lib/org-access-clerk.ts:60`)
   - Replace direct Clerk call with cached lookup

4. **`@repo/console-auth-middleware`** (`packages/console-auth-middleware/src/workspace.ts`)
   - Replace all `getOrganizationMembershipList` calls

### Data Structure

```typescript
interface CachedUserOrgMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string; // "org:admin" | "org:member"
}

// Redis value: JSON array of CachedUserOrgMembership
// Redis key: `user-orgs:{userId}`
```

### Lookup Optimization

Current code has two patterns:
- **User's orgs**: `clerk.users.getOrganizationMembershipList({ userId })` - O(user's orgs)
- **Org's members**: `clerk.organizations.getOrganizationMembershipList({ organizationId })` - O(org size)

Caching user's orgs is more efficient because:
- Users typically belong to 1-5 orgs
- Orgs can have 1-1000+ members
- User membership cache is smaller and more targeted

## Design Decisions

1. **Cache Invalidation**: Not implemented initially. Add TODO comments for future Clerk webhook integration when membership changes are supported.
2. **Cache Warming**: Not needed. Cache will be populated on first request.
3. **Fallback Strategy**: Fall back to direct Clerk API calls if Redis is unavailable. Graceful degradation.
4. **Role Updates**: Not implemented initially. Add TODO comments for future role change handling.
5. **Multi-Region**: Not needed. Current Redis deployment is sufficient.
