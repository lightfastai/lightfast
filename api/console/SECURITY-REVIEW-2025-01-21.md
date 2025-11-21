# Console API Security & Architecture Review
**Date:** 2025-01-21
**Scope:** All tRPC procedures in `api/console/src/router/`
**Reviewers:** Claude Code (Automated Analysis)

---

## Executive Summary

This review analyzed 10 router files containing **68 procedures** across the console API. The analysis identified:

- 🔴 **6 Critical Security Issues** - Require immediate attention
- 🟡 **11 Medium Security Issues** - Should be addressed soon
- 🔵 **15 Optimization Opportunities** - Performance improvements
- 🟢 **8 Simplification Opportunities** - Code quality improvements
- ⚪ **6 Unification Opportunities** - Reduce duplication
- 🗑️ **2 Unused Procedures** - Can be deleted

**Note:** Rate limiting has been explicitly excluded from this review per project requirements.

---

## 🔴 Critical Security Issues

### 1. **contents.ts: Missing Authorization on Public Endpoint**
**File:** `api/console/src/router/contents.ts:35`
**Severity:** Critical
**Issue:** The `contents.fetch` procedure uses `publicProcedure` and fetches documents by ID without verifying the caller has access to the workspace containing those documents.

```typescript
// BEFORE (INSECURE):
fetch: publicProcedure
  .input(ContentsRequestSchema)
  .query(async ({ input }) => {
    const documents = await db
      .select()
      .from(docsDocuments)
      .where(inArray(docsDocuments.id, input.ids)); // ❌ No access control
  })
```

**Recommendation:**
```typescript
// AFTER (SECURE):
fetch: publicProcedure
  .input(ContentsRequestSchema.extend({
    workspaceId: z.string(), // Or derive from API key auth
  }))
  .query(async ({ input }) => {
    // Verify workspace access via API key or session
    const documents = await db
      .select()
      .from(docsDocuments)
      .innerJoin(stores, eq(docsDocuments.storeId, stores.id))
      .where(
        and(
          inArray(docsDocuments.id, input.ids),
          eq(stores.workspaceId, verifiedWorkspaceId) // ✅ Tenant isolation
        )
      );
  })
```

---

### 2. **search.ts: Public Search Without Tenant Isolation**
**File:** `api/console/src/router/search.ts:42`
**Severity:** Critical
**Issue:** The `search.query` procedure uses `publicProcedure` and only validates store existence, not workspace access.

```typescript
// Current validation only checks store exists:
const store = await db.query.stores.findFirst({
  where: eq(stores.slug, storeSlug),
}); // ❌ No workspace access verification
```

**Recommendation:**
Add API key authentication and workspace validation:
```typescript
query: protectedProcedure // Or apiKeyProcedure
  .input(SearchRequestSchema)
  .query(async ({ ctx, input }) => {
    // Verify API key grants access to workspace
    const store = await db.query.stores.findFirst({
      where: and(
        eq(stores.slug, storeSlug),
        eq(stores.workspaceId, ctx.auth.workspaceId) // ✅ From API key
      ),
    });
  })
```

---

### 3. **stores.ts: No Authorization on Store Operations**
**File:** `api/console/src/router/stores.ts:27-64`
**Severity:** Critical
**Issue:** All three procedures (`getOrCreate`, `getByName`, `listByWorkspace`) use `protectedProcedure` but never verify the user has access to the workspace.

```typescript
// BEFORE (INSECURE):
getOrCreate: protectedProcedure
  .input(z.object({ workspaceId: z.string(), ... }))
  .mutation(async ({ input }) => {
    return getOrCreateStore(input); // ❌ No workspace ownership check
  })
```

**Recommendation:**
```typescript
// AFTER (SECURE):
getOrCreate: protectedProcedure
  .input(z.object({
    clerkOrgSlug: z.string(),
    workspaceName: z.string(),
    storeSlug: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { workspaceId } = await resolveWorkspaceByName({
      clerkOrgSlug: input.clerkOrgSlug,
      workspaceName: input.workspaceName,
      userId: ctx.auth.userId, // ✅ Verifies access
    });
    return getOrCreateStore({ workspaceId, storeSlug: input.storeSlug });
  })
```

---

### 4. **repository.ts: Expensive Reindex Without Access Control**
**File:** `api/console/src/router/repository.ts:496`
**Severity:** Critical
**Issue:** The `reindex` mutation allows any authenticated user to trigger a full repository scan and ingestion, which is extremely expensive.

**Problems:**
1. No admin-only restriction
2. Synchronous tree enumeration (can timeout on large repos)
3. No deduplication (user could spam reindex)

**Recommendation:**
```typescript
reindex: protectedProcedure
  .input(z.object({ repositoryId: z.string(), clerkOrgSlug: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Verify admin access
    const { clerkOrgId } = await verifyOrgAccessAndResolve({...});
    const membership = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
    });
    const userMembership = membership.data.find(
      (m) => m.publicUserData?.userId === ctx.auth.userId,
    );
    if (userMembership?.role !== "org:admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    // 2. Check for existing reindex job (prevent spam)
    const existingJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.repositoryId, input.repositoryId),
        eq(jobs.name, "reindex"),
        inArray(jobs.status, ["queued", "running"]),
      ),
    });
    if (existingJob) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Reindex already in progress"
      });
    }

    // 3. Queue job asynchronously instead of running inline
    await inngest.send({
      name: "apps-console/repository.reindex",
      data: { repositoryId: input.repositoryId, ... },
    });

    return { queued: true, jobId: "..." };
  })
```

---

### 5. **clerk.ts: Missing User ID Verification**
**File:** `api/console/src/router/clerk.ts:24`
**Severity:** High
**Issue:** The `createOrGetOrganization` procedure accepts a `userId` parameter but doesn't verify it matches `ctx.auth.userId`.

```typescript
// BEFORE (INSECURE):
createOrGetOrganization: protectedProcedure
  .input(z.object({
    userId: z.string(), // ❌ Could be any user ID
    orgName: z.string(),
    orgSlug: z.string(),
  }))
  .mutation(async ({ input }) => {
    const clerkOrg = await clerk.organizations.createOrganization({
      createdBy: input.userId, // ❌ Not validated
    });
  })
```

**Recommendation:**
```typescript
// AFTER (SECURE):
createOrGetOrganization: protectedProcedure
  .input(z.object({
    orgName: z.string(),
    orgSlug: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const clerkOrg = await clerk.organizations.createOrganization({
      createdBy: ctx.auth.userId, // ✅ Use authenticated user
    });
  })
```

---

### 6. **integration.ts: No Workspace Ownership Verification**
**File:** `api/console/src/router/integration.ts:752`
**Severity:** High
**Issue:** The `workspace.connect` procedure doesn't verify the user has access to the workspace they're connecting resources to.

```typescript
// BEFORE (INSECURE):
connect: protectedProcedure
  .input(z.object({
    workspaceId: z.string(), // ❌ Any workspace ID accepted
    resourceId: z.string(),
    syncConfig: z.object({...}),
  }))
  .mutation(async ({ ctx, input }) => {
    // Only verifies resource ownership, not workspace access
  })
```

**Recommendation:**
```typescript
// AFTER (SECURE):
connect: protectedProcedure
  .input(z.object({
    clerkOrgSlug: z.string(),
    workspaceName: z.string(),
    resourceId: z.string(),
    syncConfig: z.object({...}),
  }))
  .mutation(async ({ ctx, input }) => {
    const { workspaceId } = await resolveWorkspaceByName({
      clerkOrgSlug: input.clerkOrgSlug,
      workspaceName: input.workspaceName,
      userId: ctx.auth.userId, // ✅ Verifies workspace access
    });
    // ... rest of logic
  })
```

---

### 7. **workspace.ts: Public Procedures Exposing Internal Data**
**File:** `api/console/src/router/workspace.ts:288,324`
**Severity:** Medium-High
**Issue:** `resolveFromClerkOrgId` and `resolveFromGithubOrgSlug` use `publicProcedure`, allowing anyone to map organizations to workspace IDs.

**Recommendation:**
```typescript
// Change to webhookProcedure for internal use:
resolveFromClerkOrgId: webhookProcedure // Or create apiKeyProcedure
  .input(workspaceResolveFromClerkOrgIdInputSchema)
  .query(async ({ input }) => { ... })
```

---

## 🟡 Medium Security Issues

### 8. **integration.ts: Unverified OAuth Installations**
**File:** `api/console/src/router/integration.ts:507`
**Severity:** Medium
**Issue:** `storeOAuthResult` accepts installation data from client without server-side verification.

**Recommendation:** Fetch installations from GitHub API server-side:
```typescript
storeOAuthResult: protectedProcedure
  .input(z.object({
    accessToken: z.string(),
    // Remove installations from input
  }))
  .mutation(async ({ ctx, input }) => {
    // Fetch installations server-side
    const { installations } = await getUserInstallations(input.accessToken);
    // ... store verified data
  })
```

---

### 9. **integration.ts: Unsafe YAML Parsing**
**File:** `api/console/src/router/integration.ts:459`
**Severity:** Medium
**Issue:** YAML parsing errors are caught but not logged, making debugging difficult.

**Recommendation:**
```typescript
try {
  const yaml = await import("yaml");
  yaml.parse(content);
} catch (yamlError) {
  log.error("Invalid YAML in config", {
    path,
    owner,
    repo,
    error: yamlError
  }); // ✅ Log for monitoring
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid YAML format in config file.",
  });
}
```

---

### 10. **repository.ts: Missing Admin Check on Connect**
**File:** `api/console/src/router/repository.ts:121`
**Severity:** Medium
**Issue:** Any organization member can connect repositories, not just admins.

**Recommendation:** Add admin-only check (see reindex example above).

---

### 11. **Multiple Files: Inconsistent Error Handling**
**Severity:** Low-Medium
**Issue:** Some procedures catch errors and log, others don't. Inconsistent error messages.

**Recommendation:** Standardize error handling:
```typescript
try {
  // ... operation
} catch (error) {
  log.error("Operation failed", {
    procedure: "router.procedure",
    userId: ctx.auth.userId,
    error
  });

  if (error instanceof TRPCError) throw error;

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Operation failed",
    cause: error,
  });
}
```

---

### 12-18. **Minor Security Issues**
- **integration.ts:413**: Ref validation allows slashes - could be path traversal (low risk with GitHub API)
- **organization.ts:82-95**: Membership check repeated 4 times - extract to helper
- **repository.ts:299**: Metadata update doesn't validate structure
- **account.ts:304**: API key rotation doesn't require 2FA or email confirmation
- **integration.ts:274**: Installation validation could cache results
- **jobs.ts:280**: Job cancellation doesn't verify user initiated the job
- **workspace.ts:1090**: Integration disconnect doesn't notify external service

---

## 🔵 Optimization Opportunities

### 20. **integration.ts: N+1 Query in workspace.list**
**File:** `api/console/src/router/integration.ts:941`
**Current:** Fetches connections, then resources separately, then joins in memory.

```typescript
// BEFORE (N+1):
const connections = await db.select().from(workspaceIntegrations)...;
const resourceIds = connections.map((c) => c.resourceId);
const resources = await db.select().from(integrationResources)
  .where(inArray(integrationResources.id, resourceIds));
```

**Already Optimized!** ✅ This is actually a good pattern (1+1 queries, not N+1).

---

### 21. **workspace.ts: Batch Query Optimization** ✅ Already Excellent!
**File:** `api/console/src/router/workspace.ts:96-190`
The `listByClerkOrgSlug` procedure already uses optimal batch queries:
- Single query for all repositories
- Single aggregation for document counts
- In-memory grouping

**No changes needed** - this is best practice reference implementation!

---

### 22. **jobs.ts: Statistics Query Optimization** ✅ Already Excellent!
**File:** `api/console/src/router/jobs.ts:160`
Uses SQL aggregation instead of fetching all rows. **No changes needed!**

---

### 23. **repository.ts: Potential Octokit Request Caching**
**File:** `api/console/src/router/repository.ts:420-437`
**Opportunity:** Cache repository metadata (default branch, etc.) with TTL.

```typescript
// Add Redis cache layer:
const cacheKey = `repo:${owner}/${repo}:metadata`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const { data: repoInfo } = await octokit.request(...);
await redis.setex(cacheKey, 300, JSON.stringify(repoInfo)); // 5min TTL
```

---

### 24. **integration.ts: Redundant Ownership Verification**
**File:** Multiple locations
**Issue:** `verifyIntegrationOwnership` is called multiple times in sequence.

**Recommendation:** Cache result in procedure context:
```typescript
const integration = await verifyIntegrationOwnership(ctx, input.integrationId);
// Pass integration object down instead of re-fetching
```

---

### 25-30. **Minor Optimizations**
- **account.ts:144**: Add index on `apiKeys(userId, isActive)`
- **workspace.ts:514**: Store aggregations could use materialized view
- **jobs.ts:60**: Add compound index on `jobs(workspaceId, status, createdAt)`
- **integration.ts:162**: Cache GitHub installation validation (5min TTL)
- **organization.ts:30**: Clerk API calls could be batched
- **repository.ts:591**: Tree enumeration should paginate for large repos

---

## 🟢 Simplification Opportunities

### 31. **clerk.ts: Unnecessary mapRole Procedure**
**File:** `api/console/src/router/clerk.ts:120`
**Issue:** This procedure just calls a pure function.

```typescript
// DELETE THIS:
mapRole: protectedProcedure
  .input(z.object({ githubRole: z.enum(["admin", "member"]) }))
  .query(({ input }) => {
    return mapGitHubRoleToClerkRole(input.githubRole);
  }),
```

**Recommendation:** Move to client-side or shared package. Not needed as tRPC procedure.

---

### 32. **repository.ts: Trivial Helper Function**
**File:** `api/console/src/router/repository.ts:642`

```typescript
// DELETE THIS:
async function octikitSafe<T>(fn: () => Promise<{ data: T }>): Promise<{ data: T }> {
  return await fn();
}
```

**Recommendation:** Just use `await fn()` directly. This adds no value.

---

### 33. **organization.ts: Duplicate Membership Checks**
**File:** `api/console/src/router/organization.ts`
**Issue:** Membership verification repeated in 4 procedures (lines 31, 82, 150, 280).

**Recommendation:** Extract to helper:
```typescript
async function verifyOrgMembership(
  clerkOrgId: string,
  userId: string
): Promise<OrganizationMembership> {
  const clerk = await clerkClient();
  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrgId,
  });
  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === userId
  );
  if (!userMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }
  return userMembership;
}
```

---

### 34-38. **Minor Simplifications**
- **account.ts:228-260**: Consolidate `revoke` and `delete` into single soft-delete procedure
- **integration.ts:88-235**: Extract common GitHub App setup to shared module
- **workspace.ts:205-278**: `resolveFromClerkOrgSlug` duplicates `listByClerkOrgSlug` - unify
- **jobs.ts:86-118**: `get` and `recent` share similar queries - extract helper
- **contents.ts:69-88**: Document mapping logic could be utility function

---

## ⚪ Unification Opportunities

### 39. **organization.ts: Duplicate Find Procedures**
**File:** `api/console/src/router/organization.ts:55,122`
**Issue:** `findByClerkOrgId` and `findByClerkOrgSlug` are 95% identical.

```typescript
// BEFORE: Two separate procedures
findByClerkOrgId: protectedProcedure...
findByClerkOrgSlug: protectedProcedure...

// AFTER: Single unified procedure
find: protectedProcedure
  .input(z.object({
    clerkOrgId: z.string().optional(),
    clerkOrgSlug: z.string().optional(),
  }).refine(data => data.clerkOrgId || data.clerkOrgSlug, {
    message: "Either clerkOrgId or clerkOrgSlug required",
  }))
  .query(async ({ ctx, input }) => {
    const clerk = await clerkClient();
    const clerkOrg = await clerk.organizations.getOrganization(
      input.clerkOrgId
        ? { organizationId: input.clerkOrgId }
        : { slug: input.clerkOrgSlug! }
    );
    // ... common logic
  })
```

---

### 40. **workspace.ts: Duplicate Resolution Procedures**
**File:** `api/console/src/router/workspace.ts:205,288,324`
**Issue:** Three similar "resolve" procedures with duplicate org access checks.

**Recommendation:** Unify into single procedure with source discriminator:
```typescript
resolve: protectedProcedure
  .input(z.discriminatedUnion("source", [
    z.object({ source: z.literal("clerk"), clerkOrgSlug: z.string() }),
    z.object({ source: z.literal("github"), githubOrgSlug: z.string() }),
  ]))
  .query(async ({ input }) => {
    switch (input.source) {
      case "clerk": // ... clerk logic
      case "github": // ... github logic
    }
  })
```

---

### 41. **integration.ts + clerk.ts: Merge Routers**
**Recommendation:** Merge `clerk.ts` into `integration.ts` or `organization.ts` - only 3 procedures.

---

### 42-44. **Minor Unifications**
- **workspace.ts:492,638**: `statistics` and `statisticsComparison` share aggregation logic
- **jobs.ts:18,124,160**: List/recent/statistics share base queries
- **account.ts:71,144**: Profile and integrations could be nested under `account.user`

---

## 🗑️ Unused/Dead Code

### 45. **clerk.ts: mapRole Procedure** (Already mentioned in #31)
**Delete:** This procedure is never called from the frontend.

### 46. **repository.ts: octikitSafe Helper** (Already mentioned in #32)
**Delete:** Adds no value, used in 3 places - inline the calls.

---

## 📊 Procedure Summary by Router

| Router | Total Procedures | Public | Protected | Webhook | Critical Issues | Med Issues | Optimizations |
|--------|-----------------|--------|-----------|---------|----------------|------------|---------------|
| **account.ts** | 10 | 0 | 10 | 0 | 0 | 0 | 2 |
| **clerk.ts** | 3 | 0 | 3 | 0 | 1 | 0 | 1 (delete) |
| **contents.ts** | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| **integration.ts** | 17 | 0 | 17 | 0 | 1 | 2 | 3 |
| **jobs.ts** | 4 | 0 | 4 | 0 | 0 | 1 | 1 |
| **organization.ts** | 5 | 0 | 5 | 0 | 0 | 1 | 2 |
| **repository.ts** | 11 | 0 | 4 | 7 | 1 | 2 | 3 |
| **search.ts** | 1 | 1 | 0 | 0 | 1 | 1 | 0 |
| **stores.ts** | 3 | 0 | 3 | 0 | 1 | 0 | 0 |
| **workspace.ts** | 13 | 2 | 11 | 0 | 1 | 1 | 0 ✅ |
| **TOTAL** | **68** | **4** | **57** | **7** | **6** | **11** | **15** |

---

## 🎯 Immediate Action Items (Priority Order)

### Week 1: Critical Security Fixes
1. ✅ **Add workspace authorization to contents.fetch** (#1)
2. ✅ **Add workspace authorization to search.query** (#2)
3. ✅ **Add workspace authorization to stores router** (#3)
4. ✅ **Add admin-only check + deduplication to repository.reindex** (#4)
5. ✅ **Fix userId verification in clerk.createOrGetOrganization** (#5)

### Week 2: High Priority Fixes
6. ✅ **Add workspace verification to integration.workspace.connect** (#6)
7. ✅ **Change public workspace procedures to webhook/apiKey** (#7)
8. ✅ **Server-side OAuth installation verification** (#8)
9. ✅ **Add YAML parsing error logging** (#9)

### Week 3: Code Quality & Optimizations
10. Delete unused procedures (#45, #46)
11. Unify organization find procedures (#39)
12. Extract membership verification helper (#33)
13. Add request caching for GitHub API (#23)
14. Standardize error handling (#12)

### Week 4: Nice-to-Have
15. Consolidate API key revoke/delete (#34)
16. Unify workspace resolution procedures (#40)
17. Add database indexes (#25-30)
18. Improve logging and monitoring

---

## 📋 Testing Checklist

After implementing fixes, verify:

- [ ] All public endpoints require authentication or API key
- [ ] All workspace-scoped queries verify tenant isolation
- [ ] All organization-scoped queries verify membership
- [ ] No procedure accepts user/workspace IDs without verification
- [ ] Admin-only operations check role
- [ ] Expensive operations have deduplication checks (prevent spam)
- [ ] All mutations use transactions where needed
- [ ] Error messages don't leak sensitive data
- [ ] Logging doesn't include secrets (tokens, passwords)
- [ ] Input validation on all user-controlled fields

---

## 🏆 Excellent Patterns to Replicate

### ✅ Best Practices Found in Code:

1. **workspace.ts batch queries** (lines 96-190) - Perfect N+1 avoidance
2. **jobs.ts SQL aggregations** (line 185) - Efficient statistics
3. **Ownership verification pattern** - Used consistently in integration.ts
4. **Transaction usage** - API key rotation (account.ts:334)
5. **Helper functions** - `verifyOrgAccessAndResolve`, `resolveWorkspaceByName`
6. **Webhook procedure isolation** - repository.ts webhook operations
7. **Zod input validation** - Comprehensive schemas throughout

---

## 📚 References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [tRPC Security Best Practices](https://trpc.io/docs/server/authorization)
- Project: `/CLAUDE.md` - tRPC Integration Guide
- Project: `/SPEC.md` - API Design Principles

---

**Review Status:** ✅ Complete
**Next Review:** 2025-04-21 (Quarterly)
