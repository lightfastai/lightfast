# Gateway connections.ts Decomposition Plan

## Overview

Decompose the 706-line monolithic `apps/gateway/src/routes/connections.ts` into proper isolation boundaries using a strategy pattern per provider. Extract shared infrastructure (token store, resource cache) and convert teardown to a durable workflow.

**Why**: The current file conflates 5 responsibilities (OAuth, token vault, resource lifecycle, teardown orchestration, provider-specific branching) with inline `if (provider.name === "github")` checks. Adding or modifying any provider requires understanding all 706 lines. Each new provider makes it worse.

## Current State Analysis

### Single File, 5 Responsibilities

`apps/gateway/src/routes/connections.ts` contains 7 routes:

| Route | Auth | Responsibility |
|---|---|---|
| `GET /:provider/authorize` | `tenantMiddleware` | OAuth initiation |
| `GET /:provider/callback` | none (Redis state) | OAuth callback — GitHub branch + standard branch |
| `GET /:id/token` | `apiKeyAuth` | Token vault — 3 strategies inline |
| `GET /:id` | `apiKeyAuth` | Connection read |
| `DELETE /:provider/:id` | `apiKeyAuth` | 5-step teardown orchestration |
| `POST /:id/resources` | `apiKeyAuth` | Resource link |
| `DELETE /:id/resources/:resourceId` | `apiKeyAuth` | Resource unlink |

### Key Problems

1. **GitHub callback is a hardcoded branch** at line 77 — completely different flow (no code exchange, no token storage) gated by a string check
2. **Token vault has 3 inline strategies** — GitHub JWT on-demand, OAuth decrypt, Sentry refresh — with no dispatch mechanism
3. **`providerAccountInfo` constructed 3x** — lines 116-131 (update), 152-168 (insert), 220-234 (standard OAuth) — all inline object literals
4. **Redis cache write duplicated 3x** across `connections.ts:644`, `webhook-receipt.ts:82`, `admin.ts:75`
5. **Token encrypt→write duplicated** between callback (lines 251-268) and refresh (lines 390-408)
6. **Teardown sequences 5 steps synchronously** with mixed best-effort/must-succeed semantics

### Provider Differences

| | GitHub | Vercel | Linear | Sentry |
|---|---|---|---|---|
| **Callback** | `installation_id` (no code) | `code` | `code` | `code` (composite `installId:authCode`) |
| **Token** | On-demand JWT (never stored) | Encrypted in DB, no refresh | Encrypted in DB, no refresh | Encrypted in DB, **with refresh** |
| **Webhook reg** | Dashboard | Dashboard | GraphQL API | Dashboard (no-op) |
| **Account info** | `installations[]` array | `teamId`, `configurationId` | minimal | minimal |

### Key Discoveries

- `apps/gateway/src/app.ts:11` — routes mount via `app.route("/connections", connections)`, can be swapped to a composed sub-router
- `apps/gateway/src/middleware/auth.ts` — `apiKeyAuth` is applied per-route, not globally
- `apps/gateway/src/middleware/tenant.ts` — `tenantMiddleware` sets `orgId` from header/query, does not block if absent
- `packages/gateway-types/src/interfaces.ts:37-60` — `ConnectionProvider` interface lives in shared package, should not be modified
- `apps/gateway/src/providers/index.ts:31-36` — provider singleton map, `getProvider()` returns typed instances
- `apps/gateway/src/lib/github-jwt.ts` — GitHub JWT generation (dynamic import in current code, should be static)
- `apps/gateway/src/lib/crypto.ts` — `encrypt()`/`decrypt()` for AES-256-GCM token storage

## Desired End State

```
apps/gateway/src/
├── routes/connections/
│   ├── index.ts              # Composes sub-routers into single Hono instance
│   ├── oauth.ts              # GET /:provider/authorize + GET /:provider/callback
│   ├── resources.ts          # POST /:id/resources + DELETE /:id/resources/:resourceId
│   └── lifecycle.ts          # GET /:id + DELETE /:provider/:id (triggers workflow)
├── strategies/
│   ├── types.ts              # ConnectionStrategy interface
│   ├── registry.ts           # Strategy lookup by provider name
│   ├── github.ts             # GitHub: JWT on-demand, app installation callback
│   ├── vercel.ts             # Vercel: stored token, standard OAuth callback
│   ├── linear.ts             # Linear: stored token, standard OAuth + webhook registration
│   └── sentry.ts             # Sentry: stored token with refresh, composite code callback
├── workflows/
│   ├── webhook-receipt.ts    # (existing, unchanged)
│   └── connection-teardown.ts # NEW: durable teardown workflow
├── lib/
│   ├── token-store.ts        # writeTokenRecord(), updateTokenRecord()
│   ├── resource-cache.ts     # setResourceCache(), deleteResourceCache(), rebuildCache()
│   ├── github-jwt.ts         # (existing, unchanged)
│   ├── crypto.ts             # (existing, unchanged)
│   └── ...                   # (other existing files unchanged)
└── routes/
    ├── admin.ts              # Updated: uses lib/resource-cache.ts
    ├── webhooks.ts           # (unchanged)
    └── connections.ts        # DELETED — replaced by routes/connections/
```

### Verification

- `pnpm --filter @lightfast/gateway typecheck` passes
- `pnpm lint` passes
- `grep -r "connections.ts" apps/gateway/src/` returns no results (old file gone)
- All 4 provider OAuth flows work end-to-end
- Token retrieval works for all 4 providers
- Resource link/unlink works
- Teardown triggers durable workflow
- Adding a hypothetical 5th provider requires only: new strategy file + register in registry

## What We're NOT Doing

- **No changes to `ConnectionProvider` interface** — it's in `@repo/gateway-types`, a shared package
- **No changes to provider classes** (`providers/github.ts`, etc.) — they handle webhook verification, payload parsing, code exchange
- **No changes to webhook receipt workflow** — unrelated to connections
- **No changes to Console-side code** — this is purely a Gateway refactor
- **No new database tables or schema changes** — same `gw_*` tables

## Implementation Approach

Bottom-up: extract shared infrastructure first (lib modules), then create strategies, then decompose routes, then add teardown workflow. Each phase produces a working system.

---

## Phase 1: Shared Infrastructure Extraction

### Overview

Extract the 3 duplicated patterns into shared modules before touching routes. This is purely additive — existing code continues to work, new modules are unused until Phase 2+.

### Changes Required

#### 1.1. Token Store

**File**: `apps/gateway/src/lib/token-store.ts` (NEW)

```typescript
import { eq } from "drizzle-orm";
import { gwTokens } from "@db/console/schema";
import { db } from "@db/console/client";
import { encrypt } from "./crypto";
import { env } from "../env";
import type { OAuthTokens } from "@repo/gateway-types";

/**
 * Write an encrypted token record for an installation.
 * Used after OAuth code exchange.
 */
export async function writeTokenRecord(
  installationId: string,
  oauthTokens: OAuthTokens,
): Promise<void> {
  const encryptedAccess = await encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);
  const encryptedRefresh = oauthTokens.refreshToken
    ? await encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : null;

  await db.insert(gwTokens).values({
    installationId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt: oauthTokens.expiresIn
      ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
      : null,
    tokenType: oauthTokens.tokenType,
    scope: oauthTokens.scope,
  });
}

/**
 * Update an existing token record after refresh.
 */
export async function updateTokenRecord(
  tokenId: string,
  oauthTokens: OAuthTokens,
  existingRefreshToken: string | null,
): Promise<void> {
  const encryptedAccess = await encrypt(oauthTokens.accessToken, env.ENCRYPTION_KEY);
  const newEncryptedRefresh = oauthTokens.refreshToken
    ? await encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : existingRefreshToken;

  await db
    .update(gwTokens)
    .set({
      accessToken: encryptedAccess,
      refreshToken: newEncryptedRefresh,
      expiresAt: oauthTokens.expiresIn
        ? new Date(Date.now() + oauthTokens.expiresIn * 1000).toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(gwTokens.id, tokenId));
}
```

#### 1.2. Resource Cache

**File**: `apps/gateway/src/lib/resource-cache.ts` (NEW)

```typescript
import type { ProviderName } from "../providers/types";
import { redis } from "./redis";
import { resourceKey } from "./keys";

/**
 * Populate the Redis routing cache for a resource.
 * Used by: resource link, webhook-receipt fallthrough, admin cache rebuild.
 */
export async function setResourceCache(
  provider: ProviderName,
  providerResourceId: string,
  data: { connectionId: string; orgId: string },
): Promise<void> {
  await redis.hset(resourceKey(provider, providerResourceId), data);
}

/**
 * Remove a resource from the Redis routing cache.
 * Used by: resource unlink, connection teardown.
 */
export async function deleteResourceCache(
  provider: ProviderName,
  providerResourceId: string,
): Promise<void> {
  await redis.del(resourceKey(provider, providerResourceId));
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/gateway typecheck` passes
- [x] `pnpm lint` passes
- [x] New files exist: `lib/token-store.ts`, `lib/resource-cache.ts`

#### Manual Verification:
- [x] No behavioral changes — existing routes still work

---

## Phase 2: Strategy Pattern

### Overview

Create the `ConnectionStrategy` interface and implement one strategy per provider. Each strategy encapsulates: how to handle the OAuth callback, how to resolve a token, and how to build `providerAccountInfo`.

### Changes Required

#### 2.1. Strategy Interface

**File**: `apps/gateway/src/strategies/types.ts` (NEW)

```typescript
import type { Context } from "hono";
import type { ConnectionProvider, OAuthTokens } from "@repo/gateway-types";
import type { GwInstallation } from "@db/console/schema";

export interface TokenResult {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}

export interface CallbackResult {
  installationId: string;
  provider: string;
  status: string;
  [key: string]: unknown;
}

export interface ConnectionStrategy {
  /**
   * Handle the OAuth callback for this provider.
   * Returns the created/updated installation ID and response data.
   */
  handleCallback(
    c: Context,
    provider: ConnectionProvider,
    stateData: Record<string, string>,
  ): Promise<CallbackResult>;

  /**
   * Resolve a usable access token for this provider.
   * May generate on-demand (GitHub), decrypt from DB, or refresh if expired.
   */
  resolveToken(installation: GwInstallation): Promise<TokenResult>;

  /**
   * Build the typed providerAccountInfo for this provider.
   */
  buildAccountInfo(
    stateData: Record<string, string>,
    oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"];
}
```

#### 2.2. GitHub Strategy

**File**: `apps/gateway/src/strategies/github.ts` (NEW)

Implements:
- `handleCallback`: reads `installation_id` query param, upserts `gwInstallations` (no code exchange, no token write)
- `resolveToken`: calls `getInstallationToken()` from `lib/github-jwt.ts` (static import)
- `buildAccountInfo`: returns `{ version: 1, sourceType: "github", installations: [...] }`

#### 2.3. Vercel Strategy

**File**: `apps/gateway/src/strategies/vercel.ts` (NEW)

Implements:
- `handleCallback`: standard code exchange via `provider.exchangeCode()`, writes token via `writeTokenRecord()`
- `resolveToken`: decrypts stored token from `gwTokens`, no refresh support
- `buildAccountInfo`: returns `{ version: 1, sourceType: "vercel", teamId, teamSlug, configurationId }`

#### 2.4. Linear Strategy

**File**: `apps/gateway/src/strategies/linear.ts` (NEW)

Implements:
- `handleCallback`: standard code exchange, writes token, registers webhook via `WebhookRegistrant.registerWebhook()`
- `resolveToken`: decrypts stored token, no refresh support
- `buildAccountInfo`: returns `{ version: 1, sourceType: "linear" }`

#### 2.5. Sentry Strategy

**File**: `apps/gateway/src/strategies/sentry.ts` (NEW)

Implements:
- `handleCallback`: code exchange with composite code decoding (Sentry sends `installationId:authCode`), writes token with refresh
- `resolveToken`: decrypts stored token, **refreshes if expired** via `provider.refreshToken()` + `updateTokenRecord()`
- `buildAccountInfo`: returns `{ version: 1, sourceType: "sentry" }`

#### 2.6. Strategy Registry

**File**: `apps/gateway/src/strategies/registry.ts` (NEW)

```typescript
import type { ProviderName } from "../providers/types";
import type { ConnectionStrategy } from "./types";
import { GitHubStrategy } from "./github";
import { VercelStrategy } from "./vercel";
import { LinearStrategy } from "./linear";
import { SentryStrategy } from "./sentry";

const strategies = new Map<ProviderName, ConnectionStrategy>([
  ["github", new GitHubStrategy()],
  ["vercel", new VercelStrategy()],
  ["linear", new LinearStrategy()],
  ["sentry", new SentryStrategy()],
]);

export function getStrategy(provider: ProviderName): ConnectionStrategy {
  const strategy = strategies.get(provider);
  if (!strategy) {
    throw new Error(`No strategy registered for provider: ${provider}`);
  }
  return strategy;
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/gateway typecheck` passes
- [x] `pnpm lint` passes
- [x] Strategy files exist for all 4 providers
- [x] Each strategy implements the full `ConnectionStrategy` interface

#### Manual Verification:
- [x] No behavioral changes yet — strategies are created but not wired into routes

---

## Phase 3: Route Decomposition

### Overview

Split `connections.ts` into 4 focused route files inside `routes/connections/`. Wire strategies into the callback and token handlers. Delete the original `connections.ts`.

### Changes Required

#### 3.1. OAuth Routes

**File**: `apps/gateway/src/routes/connections/oauth.ts` (NEW)

Two routes:
- `GET /:provider/authorize` — unchanged logic (Redis state write, return auth URL)
- `GET /:provider/callback` — dispatches to `strategy.handleCallback()` instead of inline branches

```typescript
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const provider = getProvider(providerName);
  const strategy = getStrategy(providerName);

  // Validate and consume OAuth state from Redis
  const stateData = await resolveAndConsumeState(c, provider);
  if (!stateData) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  const result = await strategy.handleCallback(c, provider, stateData);
  return c.json(result);
});
```

Extract `resolveAndConsumeState()` as a shared helper — reads state from Redis based on provider-specific query params, validates, deletes, returns `stateData`.

#### 3.2. Resource Routes

**File**: `apps/gateway/src/routes/connections/resources.ts` (NEW)

Two routes, moved from connections.ts with minimal changes:
- `POST /:id/resources` — uses `setResourceCache()` from `lib/resource-cache.ts`
- `DELETE /:id/resources/:resourceId` — uses `deleteResourceCache()` from `lib/resource-cache.ts`

#### 3.3. Lifecycle Routes

**File**: `apps/gateway/src/routes/connections/lifecycle.ts` (NEW)

Two routes:
- `GET /:id` — connection details (unchanged from current)
- `DELETE /:provider/:id` — triggers `connection-teardown` durable workflow instead of inline orchestration (Phase 4)

For now (before Phase 4), the DELETE handler keeps the synchronous logic but imports from shared modules.

#### 3.4. Composed Router

**File**: `apps/gateway/src/routes/connections/index.ts` (NEW)

```typescript
import { Hono } from "hono";
import type { TenantVariables } from "../../middleware/tenant";
import { oauth } from "./oauth";
import { resources } from "./resources";
import { lifecycle } from "./lifecycle";

const connections = new Hono<{ Variables: TenantVariables }>();

// Mount sub-routers — order matters for route matching
connections.route("/", oauth);       // /:provider/authorize, /:provider/callback
connections.route("/", lifecycle);   // /:id, /:provider/:id
connections.route("/", resources);   // /:id/resources, /:id/resources/:resourceId

export { connections };
```

#### 3.5. Update App Mount

**File**: `apps/gateway/src/app.ts`

Change import from:
```typescript
import { connections } from "./routes/connections";
```
To:
```typescript
import { connections } from "./routes/connections/index";
```

#### 3.6. Delete Old File

Delete `apps/gateway/src/routes/connections.ts`.

#### 3.7. Update Admin to Use Resource Cache

**File**: `apps/gateway/src/routes/admin.ts`

Replace inline `redis.hset(resourceKey(...), ...)` at the cache rebuild endpoint with `setResourceCache()`.

#### 3.8. Update Webhook Receipt to Use Resource Cache

**File**: `apps/gateway/src/workflows/webhook-receipt.ts`

Replace inline `redis.hset(resourceKey(...), ...)` at the cache-miss fallthrough with `setResourceCache()`.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/gateway typecheck` passes
- [x] `pnpm lint` passes
- [x] `grep -r "from.*routes/connections\"" apps/gateway/src/` returns no results (old single-file import gone)
- [x] Old `connections.ts` file no longer exists at `apps/gateway/src/routes/connections.ts`

#### Manual Verification:
- [x] GitHub OAuth flow: authorize → callback → installation created
- [x] Vercel OAuth flow: authorize → callback → installation + token created
- [x] Token retrieval: `GET /connections/:id/token` works for GitHub (JWT) and Vercel (decrypt)
- [x] Resource link: `POST /connections/:id/resources` creates resource + populates Redis cache
- [x] Resource unlink: deletes from cache
- [x] Connection read: `GET /connections/:id` returns correct data

---

## Phase 4: Durable Teardown Workflow

### Overview

Convert the synchronous 5-step teardown orchestration into a durable Upstash Workflow. The DELETE route handler triggers the workflow and returns immediately. Each step runs independently with automatic retries.

### Changes Required

#### 4.1. Teardown Workflow

**File**: `apps/gateway/src/workflows/connection-teardown.ts` (NEW)

```typescript
import { serve } from "@vendor/upstash-workflow/hono";

interface TeardownPayload {
  installationId: string;
  provider: ProviderName;
  orgId: string;
}

export const connectionTeardownWorkflow = serve<TeardownPayload>(async (context) => {
  const { installationId, provider, orgId } = context.requestPayload;

  // Step 1: Revoke token at provider (best-effort)
  await context.run("revoke-token", async () => {
    // Decrypt token, call provider.revokeToken()
    // Swallow errors — best-effort
  });

  // Step 2: Deregister webhook if applicable (best-effort)
  await context.run("deregister-webhook", async () => {
    // Check requiresWebhookRegistration, call deregisterWebhook()
    // Swallow errors — best-effort
  });

  // Step 3: Clean up Redis cache for linked resources
  await context.run("cleanup-cache", async () => {
    // Query gwResources for installation, deleteResourceCache() for each
  });

  // Step 4: Soft-delete installation and resources in DB
  await context.run("soft-delete", async () => {
    // Update gwInstallations.status = "revoked"
    // Update gwResources.status = "removed" WHERE installationId
  });
});
```

#### 4.2. Mount Workflow

**File**: `apps/gateway/src/routes/workflows.ts`

Add the teardown workflow route alongside the existing webhook-receipt:

```typescript
import { connectionTeardownWorkflow } from "../workflows/connection-teardown";

workflows.post("/connection-teardown", connectionTeardownWorkflow);
```

#### 4.3. Update Lifecycle Route

**File**: `apps/gateway/src/routes/connections/lifecycle.ts`

The `DELETE /:provider/:id` handler becomes:

```typescript
connections.delete("/:provider/:id", apiKeyAuth, async (c) => {
  // Validate installation exists and belongs to provider
  // ...

  // Trigger durable teardown workflow
  await workflowClient.trigger({
    url: `${gatewayBaseUrl}/workflows/connection-teardown`,
    body: { installationId: id, provider: providerName, orgId: installation.orgId },
  });

  return c.json({ status: "teardown_initiated", installationId: id });
});
```

**Note**: Response changes from `{ status: "revoked" }` to `{ status: "teardown_initiated" }` since teardown is now async. Console consumers of this endpoint (if any) need to handle this — but currently only the Gateway admin/UI calls this endpoint.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/gateway typecheck` passes
- [x] `pnpm lint` passes
- [x] Workflow file exists: `workflows/connection-teardown.ts`
- [x] Workflow mounted in `routes/workflows.ts`

#### Manual Verification:
- [x] `DELETE /connections/:provider/:id` returns immediately with `teardown_initiated`
- [x] Workflow executes: token revoked, webhook deregistered, cache cleaned, DB soft-deleted
- [x] Redis cache entries removed for all linked resources after teardown

---

## Testing Strategy

### Per-Provider End-to-End

For each of the 4 providers:
1. `GET /connections/:provider/authorize` — returns auth URL with state
2. Complete OAuth flow at provider
3. `GET /connections/:provider/callback` — creates installation (+ token for non-GitHub)
4. `GET /connections/:id/token` — returns valid access token
5. `POST /connections/:id/resources` — links a resource
6. `DELETE /connections/:provider/:id` — tears down

### Strategy Unit Tests

Each strategy's `resolveToken`, `handleCallback`, and `buildAccountInfo` can be tested in isolation with mock DB/Redis.

### Adding a New Provider (Validation)

To validate the architecture, mentally trace adding a hypothetical 5th provider:
1. Create `providers/newprovider.ts` implementing `ConnectionProvider`
2. Register in `providers/index.ts`
3. Create `strategies/newprovider.ts` implementing `ConnectionStrategy`
4. Register in `strategies/registry.ts`
5. **No changes to route files** — this is the goal

## Performance Considerations

- **Teardown latency**: Changes from synchronous (~500ms) to async (workflow trigger ~50ms response, background execution). Better UX for the caller.
- **Token resolution**: No change — each strategy calls the same DB/JWT paths as before, just organized differently.
- **Import cost**: Static imports replace the dynamic `import("../lib/github-jwt")` — slightly better cold start.

## References

- Current file: `apps/gateway/src/routes/connections.ts`
- Provider interface: `packages/gateway-types/src/interfaces.ts:37-60`
- Provider implementations: `apps/gateway/src/providers/`
- App mounting: `apps/gateway/src/app.ts:11`
- Existing teardown workflow pattern: `apps/gateway/src/workflows/webhook-receipt.ts`
- Resource cache duplication: `connections.ts:644`, `webhook-receipt.ts:82`, `admin.ts:75`
- Token write duplication: `connections.ts:251-268` (callback), `connections.ts:390-408` (refresh)
