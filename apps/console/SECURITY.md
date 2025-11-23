# Console Security Architecture

## Authentication & Authorization Model

### Multi-Layer Defense

Console implements defense-in-depth with 4 independent authorization layers:

1. **Middleware Layer** - Routing control and session management
2. **tRPC Context Layer** - Authentication context creation
3. **Procedure Layer** - Role-based access control
4. **Business Logic Layer** - Resource ownership verification

**Key Principle**: No single layer is trusted. Each layer validates independently.

---

## Middleware Layer (Layer 1)

**File**: `apps/console/src/middleware.ts`

### Responsibilities

- Session detection (pending vs. active users)
- Route access control (public vs. protected)
- Organization URL syncing via Clerk's `organizationSyncOptions`

### Authentication Flow

```typescript
const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
const isPending = Boolean(userId && !orgId);
```

**User States:**
- **Unauthenticated**: `userId` is null → redirect to sign-in
- **Pending**: `userId` exists, `orgId` is null → limited access
- **Active**: Both `userId` and `orgId` exist → full access

### Route Access Matrix

| Route Pattern | Pending Users | Active Users | Notes |
|--------------|---------------|--------------|-------|
| `/api/health`, `/api/inngest` | ✅ Allowed | ✅ Allowed | Public routes |
| `/account/teams/new`, `/new` | ✅ Allowed | ✅ Allowed | Onboarding flows |
| `/api/trpc/user/*` | ✅ Allowed | ✅ Allowed | User-scoped procedures |
| `/api/trpc/org/*` | ❌ Blocked | ✅ Allowed | Org-scoped procedures |
| `/:slug/*` (org routes) | ✅ Allowed | ✅ Allowed | **Org activated from URL** |
| Other routes | ❌ Redirect | ✅ Allowed | Protected routes |

### Critical Pattern: Pending Users on Org Routes

**Why pending users can access `/:slug` routes:**

1. **Middleware allows navigation** (line 125-128)
2. **Clerk's `organizationSyncOptions` activates org from URL** (line 150-152)
3. **User transitions from pending → active** (if they're a member)
4. **tRPC procedures verify membership** (independent of middleware)

**Security guarantee:** Middleware grants routing rights, NOT data access.

---

## tRPC Context Layer (Layer 2)

**File**: `api/console/src/trpc.ts`

### Two tRPC Endpoints with Different Auth Models

#### User-Scoped Endpoint (`/api/trpc/user/*`)

```typescript
const clerkSession = await auth({
  treatPendingAsSignedOut: false  // Allow pending users
});
```

**Auth Types Returned:**
- `clerk-pending`: User authenticated but no org claimed
- `clerk-active`: User authenticated with active org
- `m2m`: Machine-to-machine token
- `unauthenticated`: No auth

**Use Cases:**
- Organization management (create, list, switch)
- User profile and settings
- User-level integrations (GitHub account)

#### Org-Scoped Endpoint (`/api/trpc/org/*`)

```typescript
const clerkSession = await auth({
  treatPendingAsSignedOut: true  // BLOCK pending users
});
```

**Auth Types Returned:**
- `clerk-active`: User authenticated with active org (only valid state)
- `m2m`: Machine-to-machine token
- `unauthenticated`: Pending users treated as unauthenticated

**Use Cases:**
- Workspace operations (create, update, delete)
- Repository management
- Org member management
- Data access (search, contents)

### Security Boundary

**Critical insight:** Even if middleware allows pending users to `/:slug` routes, org-scoped tRPC procedures will REJECT them until org activation completes.

This creates a synchronization point where:
1. Middleware allows route access
2. `organizationSyncOptions` activates org (async)
3. tRPC queries wait for activation via React Suspense
4. Once activated, procedures verify membership independently

---

## Procedure Layer (Layer 3)

**File**: `api/console/src/trpc.ts` (lines 327-403)

### Procedure Types

#### `userScopedProcedure`

```typescript
if (ctx.auth.type !== "clerk-pending" && ctx.auth.type !== "clerk-active") {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}
```

**Accepts:** Pending users + Active users
**Type Safety:** `ctx.auth` is `clerk-pending | clerk-active`
**Use For:** User-level operations that don't require org context

#### `orgScopedProcedure`

```typescript
if (ctx.auth.type !== "clerk-active") {
  throw new TRPCError({ code: "FORBIDDEN" });
}
```

**Accepts:** Active users ONLY
**Type Safety:** `ctx.auth.orgId` guaranteed to exist
**Use For:** All org-scoped data access

### Why This Matters

The procedure layer enforces auth **independent of middleware**:
- Attackers can't bypass by calling tRPC directly
- Pending users blocked even if they reach org routes
- Type system prevents accessing `orgId` on pending users

---

## Business Logic Layer (Layer 4)

**File**: `api/console/src/router/org/workspace.ts` (lines 49-89)

### Membership Verification Pattern

Every org-scoped procedure MUST verify user membership:

```typescript
// 1. Fetch org by slug from Clerk (source of truth)
const clerkOrg = await clerk.organizations.getOrganization({
  slug: input.clerkOrgSlug
});

// 2. Fetch membership list for that org
const membership = await clerk.organizations.getOrganizationMembershipList({
  organizationId: clerkOrg.id
});

// 3. Verify user is a member
const userMembership = membership.data.find(
  (m) => m.publicUserData?.userId === ctx.auth.userId
);

if (!userMembership) {
  throw new TRPCError({ code: "FORBIDDEN" });
}
```

### Why Not Trust `auth().orgId`?

**From `apps/console/src/lib/org-access-clerk.ts:103`:**
> "We don't check if it matches auth().orgSlug because middleware's organizationSyncOptions may not have synced yet during RSC fetches."

**Race condition handling:**
- Middleware's `organizationSyncOptions` is async and best-effort
- RSC prefetch queries may execute before org sync completes
- Procedures independently verify by fetching org and checking membership
- **No reliance on session state** - Clerk API is source of truth

---

## Security Guarantees

### ✅ What IS Guaranteed

1. **No unauthorized data access**
   - Every org-scoped procedure verifies membership
   - Procedures are independent of middleware state
   - Direct tRPC calls subject to same auth checks

2. **Pending users can't access org data**
   - Org-scoped endpoint blocks pending users (context layer)
   - Even if middleware allows route access
   - Must have active org to call org-scoped procedures

3. **Race conditions handled**
   - Procedures don't trust `auth().orgId`
   - Independent membership verification via Clerk API
   - Suspense boundaries wait for auth to settle

4. **Defense in depth**
   - 4 independent authorization layers
   - Each layer validates independently
   - Compromise of one layer doesn't grant access

### ❌ What Is NOT Guaranteed

1. **Org slug enumeration prevention**
   - Attackers can try random slugs: `/:acme`, `/:google`
   - Will receive NOT_FOUND or FORBIDDEN errors
   - **Acceptable risk**: Org slugs are semi-public (used in URLs)

2. **Timing attack resistance**
   - Different errors may have different response times
   - Could leak org existence vs. non-existence
   - **Acceptable risk**: Minimal information leak, no data access

3. **Perfect synchronization**
   - Small window where user is pending on org route
   - `organizationSyncOptions` activating org (async)
   - Queries suspended until activation completes
   - **Safe**: Error boundaries handle activation failures

---

## Attack Scenarios & Mitigations

### Attack 1: Pending User → Unauthorized Org

**Attack Vector:**
```
Pending user manually navigates to /:victim-org
```

**Defense Layers:**
1. Middleware: Allows navigation (line 125)
2. Org Sync: Fails to activate (not a member)
3. Procedure: Verifies membership → FORBIDDEN
4. UI: Error boundary shows access denied

**Result:** ❌ Attack fails - no data access

### Attack 2: Direct tRPC Call (Bypass Middleware)

**Attack Vector:**
```http
POST /api/trpc/org/workspace.listByClerkOrgSlug
Authorization: Bearer <pending-user-session>
{
  "clerkOrgSlug": "victim-org"
}
```

**Defense Layers:**
1. Middleware: Not involved (direct API call)
2. tRPC Context: Pending user → treated as unauthenticated (line 203)
3. Procedure: Requires `clerk-active` → UNAUTHORIZED
4. Business Logic: Never reached

**Result:** ❌ Attack fails - tRPC auth independent

### Attack 3: Session Manipulation

**Attack Vector:**
```
Attacker modifies session cookie to claim orgId
```

**Defense Layers:**
1. Middleware: Clerk validates session signature
2. tRPC Context: Clerk SDK validates session
3. Procedure: Calls Clerk API for membership
4. Business Logic: Clerk API returns authoritative membership list

**Result:** ❌ Attack fails - can't forge Clerk sessions

### Attack 4: Race Condition Exploitation

**Attack Vector:**
```
Send tRPC query before organizationSyncOptions completes
Hope to access data with stale session state
```

**Defense Layers:**
1. Middleware: `organizationSyncOptions` async (best effort)
2. tRPC Context: May return pending or active state
3. Procedure: **Independently verifies membership** (doesn't trust context)
4. Business Logic: Fetches membership from Clerk API

**Result:** ❌ Attack fails - procedures don't trust session state

---

## Clerk Organization Syncing

### How `organizationSyncOptions` Works

**Configuration** (`middleware.ts:150-152`):
```typescript
organizationSyncOptions: {
  organizationPatterns: ["/:slug", "/:slug/(.*)"]
}
```

**Behavior from Clerk Docs:**
> "If there's a mismatch between the Active Organization in the session and the Organization indicated by the URL, the middleware will attempt to activate the Organization specified in the URL."

**Failure Handling:**
> "If the Organization can't be activated—either because it doesn't exist or the user lacks access—the previously Active Organization will remain unchanged."

### Critical Implications

1. **Silent Failures**: Middleware doesn't throw errors on activation failure
2. **Best Effort**: Org sync is optimization, not security boundary
3. **Developer Responsibility**: "Components must detect this case and provide an appropriate error" (Clerk docs)

### Our Implementation

We handle sync failures at the **business logic layer**:
- tRPC procedures verify membership independently
- Error boundaries catch and display access errors
- No assumption that `auth().orgId` matches URL slug

---

## Testing Recommendations

### Unit Tests

- [ ] Middleware allows pending users to `/:slug` routes
- [ ] Middleware blocks pending users from other routes
- [ ] tRPC user-scoped endpoint accepts pending users
- [ ] tRPC org-scoped endpoint blocks pending users
- [ ] Procedures verify membership independently

### Integration Tests

- [ ] Pending user clicks org in TeamSwitcher → success
- [ ] Pending user navigates to unauthorized org → FORBIDDEN
- [ ] Active user switches orgs via URL → membership verified
- [ ] Direct tRPC call with pending user → UNAUTHORIZED
- [ ] Race: query before org sync → waits for activation

### E2E Tests

- [ ] User creates first org → redirects to org route
- [ ] User switches between orgs in dropdown → works
- [ ] User manually types wrong org slug → error UI
- [ ] User logs out while on org route → redirects to sign-in

---

## Monitoring & Alerting

### Security Events to Monitor

1. **Repeated FORBIDDEN errors** from same user
   - Possible enumeration attack
   - Alert threshold: >10/minute from single IP

2. **High rate of NOT_FOUND on org routes**
   - Possible slug enumeration
   - Alert threshold: >50/hour across all users

3. **Pending user accessing org-scoped procedures**
   - Should be impossible (blocked at context layer)
   - Alert threshold: Any occurrence (indicates bug)

4. **Auth context type mismatches**
   - e.g., `clerk-pending` reaching org-scoped procedure
   - Alert threshold: Any occurrence (indicates bug)

### Logging Best Practices

```typescript
// Log auth decisions with context
console.info(`[Auth] ${authType} user accessing ${procedure}`, {
  userId,
  orgId,
  requestedOrg: input.clerkOrgSlug,
  allowed: Boolean(userMembership)
});
```

---

## Security Principles Summary

1. **Zero Trust Between Layers**
   - Middleware doesn't trust user sessions
   - tRPC doesn't trust middleware
   - Procedures don't trust context
   - Business logic verifies everything

2. **Clerk as Source of Truth**
   - All authorization queries hit Clerk API
   - Session state is cache, not authority
   - Membership verified on every request

3. **Fail Closed**
   - Default deny on all routes
   - Explicit allowlists for public/pending routes
   - Errors escalate to user, not silent failures

4. **Defense in Depth**
   - 4 independent authorization layers
   - Each layer can reject independently
   - No single point of failure

---

## Changelog

### 2025-01-23: Pending Users on Org Routes
**Change:** Allow pending users to access `/:slug` routes in middleware

**Rationale:**
- Fixes redirect loop when pending users click org in TeamSwitcher
- `organizationSyncOptions` activates org from URL
- tRPC procedures already verify membership independently
- No security impact (procedures are the security boundary)

**Security Review:** ✅ Passed (see above)
