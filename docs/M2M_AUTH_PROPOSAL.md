# M2M Authentication for Sources Router - Proposal

## Current Security Issue

The `sources` router in `/api/console/src/router/sources.ts` currently uses `publicProcedure`, which means **anyone** can call these endpoints without authentication:

```typescript
export const sourcesRouter = {
  findByGithubRepoId: publicProcedure.input(...).query(...),
  updateGithubSyncStatus: publicProcedure.input(...).mutation(...),
  updateGithubConfigStatus: publicProcedure.input(...).mutation(...),
  markGithubInstallationInactive: publicProcedure.input(...).mutation(...),
  markGithubDeleted: publicProcedure.input(...).mutation(...),
  updateGithubMetadata: publicProcedure.input(...).mutation(...),
}
```

**Risk**: An attacker could:
- Mark all repositories as inactive
- Update repository metadata arbitrarily
- Manipulate sync status and trigger unwanted operations

## Current Callers

### 1. GitHub Webhook Handlers (`apps/console/src/app/(github)/api/github/webhooks/route.ts`)
- Called via `SourcesService` class
- Service uses `createCaller()` from `@repo/console-trpc/server`
- Caller sets `x-webhook-source: internal` header
- Protected by GitHub webhook signature verification

**Flow:**
```
GitHub → Webhook Route → Verify Signature → SourcesService → createCaller() → sources.* procedures
```

### 2. Inngest Workflows (`api/console/src/inngest/workflow/`)
- Currently use **direct database access** (Drizzle ORM)
- Update `workspaceSources` table directly
- Example: `repository-initial-sync.ts` sets `lastSyncStatus`

**Current approach:**
```typescript
await db
  .update(workspaceSources)
  .set({ lastSyncStatus: "in_progress" })
  .where(eq(workspaceSources.id, resourceId));
```

## Existing Auth Infrastructure

The codebase already has a `webhookProcedure` in `/api/console/src/trpc.ts`:

```typescript
export const webhookProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "webhook") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This endpoint can only be called by verified webhook handlers",
      });
    }
    return next({ ctx: { ...ctx, auth: ctx.auth } });
  });
```

**How it works:**
1. `createWebhookContext()` sets `x-webhook-source: internal` header
2. `createTRPCContext()` checks for this header and sets `auth.type = "webhook"`
3. `webhookProcedure` verifies `auth.type === "webhook"`

**Problem:** This relies on header-based auth, which is:
- ✅ Safe for server-to-server calls (headers set by our code)
- ❌ Not industry-standard M2M pattern
- ❌ No token-based audit trail
- ❌ Can't be used by external services (like Inngest Cloud)

## Proposed Solution: Clerk M2M Authentication

Clerk supports **Machine-to-Machine (M2M)** authentication via OAuth 2.0 Client Credentials flow:
https://clerk.com/docs/authentication/m2m

### Architecture

```
┌─────────────────┐
│ GitHub Webhook  │
│   Handler       │──┐
└─────────────────┘  │
                     │    ┌──────────────┐      ┌────────────┐
┌─────────────────┐  │    │              │      │            │
│ Inngest         │──┼───→│  Clerk M2M   │─────→│  sources   │
│   Workflow      │  │    │  Token Auth  │      │  router    │
└─────────────────┘  │    │              │      │            │
                     │    └──────────────┘      └────────────┘
┌─────────────────┐  │
│ Other Internal  │──┘
│   Services      │
└─────────────────┘
```

### Implementation Steps

#### 1. Set Up Clerk M2M Application

**In Clerk Dashboard:**
1. Create new application type: "Machine-to-Machine"
2. Name: "Console Internal Services"
3. Get credentials:
   - `CLERK_M2M_CLIENT_ID`
   - `CLERK_M2M_CLIENT_SECRET`
4. Set permissions/scopes: `sources:write`, `sources:read`

#### 2. Create M2M Token Provider (`vendor/clerk/src/m2m.ts`)

```typescript
import { env } from "../env";

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get M2M access token from Clerk
 * Caches token until near expiration
 */
export async function getM2MToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  // Request new token via OAuth 2.0 Client Credentials flow
  const response = await fetch(
    `https://${env.CLERK_FRONTEND_API}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.CLERK_M2M_CLIENT_ID,
        client_secret: env.CLERK_M2M_CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get M2M token: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache token (expires_in is in seconds)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}
```

#### 3. Update tRPC Context (`api/console/src/trpc.ts`)

```typescript
export type AuthContext =
  | { type: "clerk"; userId: string }
  | { type: "m2m"; service: string } // NEW: M2M auth
  | { type: "apiKey"; workspaceId: string; userId: string; apiKeyId: string }
  | { type: "unauthenticated" };

export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Check for M2M Bearer token
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      // Verify token with Clerk
      const { clerkClient } = await import("@vendor/clerk/server");
      const clerk = await clerkClient();
      const verification = await clerk.verifyToken(token);

      if (verification.sessionClaims?.azp) {
        // azp = authorized party (client_id of M2M app)
        return {
          auth: {
            type: "m2m" as const,
            service: verification.sessionClaims.azp
          },
          db,
          headers: opts.headers,
        };
      }
    } catch (error) {
      console.error("[M2M Auth] Token verification failed:", error);
      // Fall through to other auth methods
    }
  }

  // ... existing Clerk session auth ...
  // ... existing unauthenticated fallback ...
};
```

#### 4. Create M2M Procedure (`api/console/src/trpc.ts`)

```typescript
/**
 * M2M Protected Procedure
 *
 * For server-to-server calls from internal services:
 * - GitHub webhook handlers
 * - Inngest background jobs
 * - Other internal automation
 *
 * Requires valid Clerk M2M access token in Authorization header.
 */
export const m2mProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "m2m") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "M2M token required. This endpoint is for internal services only.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<AuthContext, { type: "m2m" }>,
      },
    });
  });
```

#### 5. Update Sources Router (`api/console/src/router/sources.ts`)

```typescript
export const sourcesRouter = {
  // Change ALL procedures from publicProcedure to m2mProcedure
  findByGithubRepoId: m2mProcedure
    .input(findByGithubRepoIdSchema)
    .query(async ({ ctx, input }) => { /* ... */ }),

  updateGithubSyncStatus: m2mProcedure
    .input(updateGithubSyncStatusSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // ... all other procedures ...
} satisfies TRPCRouterRecord;
```

#### 6. Update Webhook Context (`packages/console-trpc/src/server.tsx`)

```typescript
import { getM2MToken } from "@vendor/clerk/m2m";

/**
 * Create context for internal service calls (webhooks, Inngest)
 * Uses Clerk M2M authentication
 */
const createM2MContext = cache(async () => {
  const token = await getM2MToken();

  const heads = new Headers();
  heads.set("x-trpc-source", "m2m-service");
  heads.set("authorization", `Bearer ${token}`);

  return createTRPCContext({ headers: heads });
});

/**
 * Create a server-side tRPC caller for internal services
 * Authenticated with Clerk M2M token
 */
export const createCaller = cache(async () => {
  const ctx = await createM2MContext();
  return consoleAppRouter.createCaller(ctx);
});
```

#### 7. Update Inngest Workflows (Optional but Recommended)

Instead of direct DB access, use the tRPC procedures:

```typescript
import { createCaller } from "@repo/console-trpc/server";

export const repositoryInitialSync = inngest.createFunction(
  { /* ... */ },
  { event: "apps-console/repository.connected" },
  async ({ event, step }) => {
    const { resourceId } = event.data;

    await step.run("mark-sync-in-progress", async () => {
      const caller = await createCaller();
      await caller.sources.updateGithubSyncStatus({
        githubRepoId: resourceId,
        isActive: true,
        // ... other params
      });
    });
  }
);
```

**Benefits:**
- ✅ Centralized business logic (no DB queries in workflows)
- ✅ Audit trail via tRPC logs
- ✅ Type-safe procedure calls
- ✅ Consistent error handling

**Trade-off:**
- Slightly more latency (tRPC layer + token fetch)
- Keep direct DB access for high-frequency operations if needed

### Environment Variables

Add to `.env`:

```bash
# Clerk M2M Authentication
CLERK_M2M_CLIENT_ID=client_xxx
CLERK_M2M_CLIENT_SECRET=secret_xxx
```

Add to `vendor/clerk/env.ts`:

```typescript
export const env = createEnv({
  server: {
    // ... existing vars ...
    CLERK_M2M_CLIENT_ID: z.string().min(1),
    CLERK_M2M_CLIENT_SECRET: z.string().min(1),
  },
  // ...
});
```

## Migration Strategy

### Phase 1: Add M2M Support (Non-Breaking)
1. Create Clerk M2M application
2. Add M2M token provider
3. Add M2M auth to tRPC context
4. Create `m2mProcedure`
5. Update `createCaller()` to use M2M token
6. Test webhook handlers still work

### Phase 2: Migrate Procedures
1. Change sources router to use `m2mProcedure`
2. Test all webhook events (push, installation, repository)
3. Monitor logs for auth failures

### Phase 3: Migrate Inngest (Optional)
1. Update workflows to use `createCaller()`
2. Test background jobs
3. Remove direct DB updates if all workflows migrated

## Security Benefits

### Before (publicProcedure)
- ❌ No authentication
- ❌ Anyone can call endpoints
- ❌ No audit trail
- ❌ Vulnerable to unauthorized modifications

### After (m2mProcedure)
- ✅ Token-based authentication
- ✅ Only services with valid Clerk M2M credentials can call
- ✅ Full audit trail (token issued to specific client_id)
- ✅ Token rotation support
- ✅ Revocable credentials (revoke M2M app in Clerk)
- ✅ Industry-standard OAuth 2.0 flow

## Testing Plan

### Unit Tests
```typescript
describe("m2mProcedure", () => {
  it("should reject calls without M2M token", async () => {
    const caller = createCaller({ headers: new Headers() });
    await expect(caller.sources.findByGithubRepoId({ githubRepoId: "123" }))
      .rejects.toThrow("M2M token required");
  });

  it("should accept calls with valid M2M token", async () => {
    const token = await getM2MToken();
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const caller = createCaller({ headers });

    const result = await caller.sources.findByGithubRepoId({ githubRepoId: "123" });
    expect(result).toBeDefined();
  });
});
```

### Integration Tests
1. Send test webhook from GitHub
2. Verify webhook handler calls procedures successfully
3. Check database for expected updates
4. Verify audit logs show M2M service name

## Alternative: Keep Existing webhookProcedure

If Clerk M2M setup is too complex initially, we could:

1. **Keep current approach** but rename to `internalProcedure`:
   - Uses `x-webhook-source: internal` header
   - Only set by server-side `createCaller()`
   - Cannot be spoofed via HTTP

2. **Add validation** to ensure header not coming from HTTP:
   ```typescript
   export const createTRPCContext = async (opts: { headers: Headers }) => {
     const webhookSource = opts.headers.get("x-webhook-source");
     const trpcSource = opts.headers.get("x-trpc-source");

     // Only trust x-webhook-source if NOT from HTTP client
     if (webhookSource === "internal" && trpcSource !== "client") {
       return { auth: { type: "webhook", source: "internal" }, db };
     }
     // ...
   };
   ```

**Pros:**
- ✅ No external dependencies
- ✅ Works today
- ✅ Simple to understand

**Cons:**
- ❌ Not industry-standard
- ❌ No token-based audit trail
- ❌ Can't be used by truly external services (like Inngest Cloud)
- ❌ Harder to revoke access

## Recommendation

**Use Clerk M2M Authentication** for production-grade security:

1. Industry-standard OAuth 2.0
2. Token-based audit trail
3. Revocable credentials
4. Works with external services (Inngest Cloud, future integrations)
5. Clerk already provides the infrastructure

The implementation is straightforward and provides significant security improvements over header-based auth.

---

## Questions for Discussion

1. **Should Inngest workflows use tRPC procedures or direct DB access?**
   - Procedures: Better abstraction, audit trail, centralized logic
   - Direct DB: Lower latency, simpler for simple updates

2. **Should we migrate all at once or gradually?**
   - All at once: Clean cutover, but higher risk
   - Gradual: Support both `publicProcedure` and `m2mProcedure` during transition

3. **Do we need different M2M apps for different services?**
   - Single app: "Console Internal Services" (simpler)
   - Multiple apps: "Webhook Handler", "Inngest Jobs", "CLI" (better audit trail)

4. **What about local development?**
   - Use same M2M credentials (dev environment app)
   - Or allow `publicProcedure` in development only (via env flag)
