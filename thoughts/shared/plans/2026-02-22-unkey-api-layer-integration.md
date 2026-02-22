# Unkey API Layer Integration — Implementation Plan

## Overview

Replace the self-hosted, DB-based API key system with Unkey.com for the v1 API layer. This is a **breaking change**: existing `sk-lf-` keys stop working, new keys use `sk_xxx` format (Unkey native with `prefix: "sk"`), and all key verification moves from SHA-256 DB lookups to Unkey's edge RPC.

## Current State Analysis

The v1 API layer (`apps/console/src/app/(api)/v1/`) uses `withDualAuth` → `withApiKeyAuth` for API key authentication. Keys are generated with `sk-lf-` prefix (6 chars + 43 random = 49 total), SHA-256 hashed, stored in `lightfast_workspace_api_keys`, and verified via DB lookup on every request. The tRPC `orgApiKeysRouter` handles create/revoke/rotate/delete with synchronous activity logging.

The `sk-lf-` prefix is defined in two places:
1. `packages/console-api-key/src/crypto.ts:16` — backend source of truth
2. `core/lightfast/src/constants.ts:26` — published SDK source of truth (intentionally duplicated, see comment at that location)

Both the published SDK (`core/lightfast/src/client.ts:59`) and MCP server (`core/mcp/src/index.ts:64`) validate the prefix client-side.

### Key Discoveries:
- `withApiKeyAuth` returns `ApiKeyAuthContext { workspaceId, userId, apiKeyId, clerkOrgId }` — `workspaceId` always comes from the DB, never from headers (`with-api-key-auth.ts:166`)
- `withDualAuth` uses discriminated unions (`success: true | false`) — callers pattern-match cleanly (`with-dual-auth.ts:25-39`)
- The `rotate` operation is the only one using a DB transaction (`org-api-keys.ts:356`)
- Fire-and-forget `lastUsedAt` tracking runs on every request (`with-api-key-auth.ts:131-144`)
- There's a separate `userApiKeysRouter` for user-scoped keys (`api/console/src/router/user/user-api-keys.ts`) — out of scope for this change
- `api/console/src/trpc.ts:23` imports `hashApiKey` for tRPC-level auth — out of scope

## Desired End State

After implementation:
1. New API keys are created via Unkey with `sk_xxx` format
2. API key verification uses Unkey's `keys.verify` RPC (no DB lookup)
3. Per-key rate limiting is enforced at 1000 req/min via Unkey
4. `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on all API responses
5. Key lifecycle (create/revoke/rotate/delete) goes through Unkey API
6. DB table retains metadata (name, workspace binding, `unkeyKeyId`) but is not the auth source-of-truth
7. Published SDK and MCP server accept the new `sk_` prefix
8. Old `sk-lf-` keys are invalidated (not verified by any path)

### Verification:
- `pnpm lint && pnpm typecheck` passes across the monorepo
- `pnpm build:console` succeeds
- Creating a key via the dashboard returns an `sk_xxx` key
- Using the `sk_xxx` key against `/v1/search` returns 200 with rate limit headers
- Using an old `sk-lf-` key returns 401
- Revoking a key in the dashboard makes it return 401 immediately
- Rate limit headers decrement correctly across requests

## What We're NOT Doing

- **Not migrating existing keys** — old `sk-lf-` keys are invalidated. Users must create new keys.
- **Not changing user-scoped API keys** — the `userApiKeysRouter` and `lightfast_user_api_keys` table are unaffected.
- **Not changing Clerk session auth** — Branch B (other bearer) and Branch C (no auth / Clerk session) in `withDualAuth` are untouched.
- **Not changing tRPC-level auth** — `api/console/src/trpc.ts` has its own `hashApiKey` usage; out of scope.
- **Not adding Unkey analytics/dashboard** — we don't sync `lastUsedAt` back to our DB. Usage data lives in Unkey.
- **Not publishing SDK/MCP updates** — updating the prefix constant is part of this plan, but the actual npm publish is a separate step.

## Implementation Approach

Build bottom-up: vendor package → DB schema → auth middleware → tRPC router → SDK/MCP prefix → cleanup.

---

## Phase 1: Create `vendor/unkey` Package

### Overview
Create the `@vendor/unkey` package following the established vendor abstraction pattern (see `vendor/upstash/` and `vendor/security/` for reference).

### Changes Required:

#### 1. `vendor/unkey/package.json`

```json
{
  "name": "@vendor/unkey",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    },
    "./env": {
      "types": "./dist/env.d.ts",
      "default": "./env.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@unkey/api": "latest",
    "@t3-oss/env-nextjs": "catalog:",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

#### 2. `vendor/unkey/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const unkeyEnv = createEnv({
  server: {
    UNKEY_ROOT_KEY: z.string().min(1).startsWith("unkey_"),
    UNKEY_API_ID: z.string().min(1).startsWith("api_"),
  },
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
```

#### 3. `vendor/unkey/src/index.ts`

```typescript
import { Unkey } from "@unkey/api";
import { unkeyEnv } from "../env";

export const unkey = new Unkey({ rootKey: unkeyEnv.UNKEY_ROOT_KEY });

export const UNKEY_API_ID = unkeyEnv.UNKEY_API_ID;

export { Unkey } from "@unkey/api";
```

#### 4. `vendor/unkey/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "paths": { "~/env": ["./env.ts"] }
  },
  "include": ["*.ts", "src"],
  "exclude": ["node_modules", "dist"]
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` resolves `@unkey/api` successfully
- [x] `pnpm --filter @vendor/unkey typecheck` passes
- [ ] `pnpm --filter @vendor/unkey build` emits declarations to `dist/`

#### Manual Verification:
- [ ] Verify `UNKEY_ROOT_KEY` and `UNKEY_API_ID` are set in `apps/console/.vercel/.env.development.local`

**Implementation Note**: After completing this phase, pause for manual confirmation that the env vars are configured before proceeding.

---

## Phase 2: DB Schema Update

### Overview
Add `unkeyKeyId` column to `lightfast_workspace_api_keys` to track the Unkey-issued key ID for management operations (revoke, update). Make `keyHash` nullable since Unkey-created keys won't have a local hash.

### Changes Required:

#### 1. `db/console/src/schema/tables/org-api-keys.ts`
**Changes**: Add `unkeyKeyId` column, make `keyHash` nullable.

Add after the existing `keyHash` column (around line 76):
```typescript
unkeyKeyId: varchar("unkey_key_id", { length: 191 }),
```

Change `keyHash` from required to optional:
```typescript
keyHash: text("key_hash"),  // Was implicitly required; now nullable for Unkey-managed keys
```

#### 2. Generate migration
Run from `db/console/`:
```bash
pnpm db:generate
```

This will produce a new SQL migration file in `db/console/src/migrations/`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm db:generate` produces a clean migration (run from `db/console/`)
- [ ] `pnpm db:migrate` applies without errors (run from `db/console/`)
- [x] `pnpm --filter @db/console typecheck` passes

#### Manual Verification:
- [ ] Verify `unkey_key_id` column exists in the table via `pnpm db:studio`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Auth Middleware — `with-unkey-auth.ts` + Update `with-dual-auth.ts`

### Overview
Create a new `withUnkeyAuth` function that calls Unkey's `keys.verify` API. Update `withDualAuth` to route `sk_` prefix keys to `withUnkeyAuth` instead of the old `withApiKeyAuth`.

### Changes Required:

#### 1. New file: `apps/console/src/app/(api)/v1/lib/with-unkey-auth.ts`

```typescript
import { type NextRequest } from "next/server";
import { unkey, UNKEY_API_ID } from "@vendor/unkey";

/**
 * API key prefix for Unkey-managed keys.
 * Unkey produces keys in the format: {prefix}_{random}
 * With prefix "sk", the full key looks like: sk_xxxxxxxxxxxx
 */
export const UNKEY_API_KEY_PREFIX = "sk_";

export interface UnkeyAuthContext {
  workspaceId: string;
  userId: string;
  apiKeyId: string; // Unkey's keyId (key_xxx)
  clerkOrgId: string;
  ratelimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export interface UnkeyAuthSuccess {
  success: true;
  auth: UnkeyAuthContext;
}

export interface UnkeyAuthError {
  success: false;
  error: { code: string; message: string };
  status: number;
}

export type UnkeyAuthResult = UnkeyAuthSuccess | UnkeyAuthError;

export async function withUnkeyAuth(
  request: NextRequest,
  requestId?: string,
): Promise<UnkeyAuthResult> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
        status: 401,
      };
    }

    const apiKey = authHeader.slice(7);

    const { result, error } = await unkey.keys.verify({
      key: apiKey,
      apiId: UNKEY_API_ID,
    });

    if (error) {
      console.error(`[${requestId}] Unkey verification error:`, error.message);
      return {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Authentication service error" },
        status: 500,
      };
    }

    if (!result.valid) {
      const codeMap: Record<string, { message: string; status: number }> = {
        NOT_FOUND: { message: "Invalid API key", status: 401 },
        EXPIRED: { message: "API key expired", status: 401 },
        DISABLED: { message: "API key revoked", status: 401 },
        RATE_LIMITED: { message: "Rate limit exceeded", status: 429 },
        USAGE_EXCEEDED: { message: "Usage limit exceeded", status: 429 },
      };
      const mapped = codeMap[result.code ?? ""] ?? {
        message: "Invalid API key",
        status: 401,
      };
      return {
        success: false,
        error: { code: result.code ?? "UNAUTHORIZED", message: mapped.message },
        status: mapped.status,
      };
    }

    // Extract workspace context from Unkey metadata
    const meta = result.meta as
      | { workspaceId?: string; clerkOrgId?: string; createdBy?: string }
      | undefined;
    const workspaceId = result.ownerId; // We store workspaceId as ownerId
    const clerkOrgId = meta?.clerkOrgId;
    const userId = meta?.createdBy;

    if (!workspaceId || !clerkOrgId || !userId) {
      console.error(
        `[${requestId}] Unkey key ${result.keyId} missing required metadata:`,
        { workspaceId, clerkOrgId, userId },
      );
      return {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "API key metadata incomplete" },
        status: 500,
      };
    }

    return {
      success: true,
      auth: {
        workspaceId,
        userId,
        apiKeyId: result.keyId,
        clerkOrgId,
        ratelimit: result.ratelimit
          ? {
              limit: result.ratelimit.limit,
              remaining: result.ratelimit.remaining,
              reset: result.ratelimit.reset,
            }
          : undefined,
      },
    };
  } catch (err) {
    console.error(`[${requestId}] Unkey auth error:`, err);
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal authentication error" },
      status: 500,
    };
  }
}
```

#### 2. Update `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

**Change the import** at line 15:
```typescript
// Before:
import { LIGHTFAST_API_KEY_PREFIX } from "@repo/console-api-key";

// After:
import { UNKEY_API_KEY_PREFIX } from "./with-unkey-auth";
```

**Change the import** at line 16:
```typescript
// Before:
import { withApiKeyAuth } from "./with-api-key-auth";

// After:
import { withUnkeyAuth } from "./with-unkey-auth";
```

**Update Branch A** (around line 58-78) — change the prefix detection and delegation:
```typescript
// Before:
if (token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
  const apiKeyResult = await withApiKeyAuth(request, requestId);

// After:
if (token.startsWith(UNKEY_API_KEY_PREFIX)) {
  const apiKeyResult = await withUnkeyAuth(request, requestId);
```

The re-mapping of `ApiKeyAuthContext` → `DualAuthContext` stays the same pattern, but update the field sources to match `UnkeyAuthContext`:
```typescript
if (apiKeyResult.success) {
  return {
    success: true,
    auth: {
      workspaceId: apiKeyResult.auth.workspaceId,
      userId: apiKeyResult.auth.userId,
      authType: "api-key" as const,
      apiKeyId: apiKeyResult.auth.apiKeyId,
    },
  };
}
```

**Add rate limit headers**: Modify `createDualAuthErrorResponse` or create a new helper to attach rate limit headers when available. The route handlers will need access to the ratelimit data. Two options:

Option A (minimal change): Extend `DualAuthContext` with optional `ratelimit` field:
```typescript
export interface DualAuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
  ratelimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}
```

Then in each route handler, after getting the auth result, attach headers to the response:
```typescript
// In route handlers, when building the response:
const headers = new Headers();
if (authResult.auth.ratelimit) {
  headers.set("X-RateLimit-Limit", String(authResult.auth.ratelimit.limit));
  headers.set("X-RateLimit-Remaining", String(authResult.auth.ratelimit.remaining));
  headers.set("X-RateLimit-Reset", String(authResult.auth.ratelimit.reset));
}
```

Option B (helper function): Create a `withRateLimitHeaders(response, authContext)` wrapper. This avoids touching all 6 routes individually.

**Recommendation**: Option A — extend `DualAuthContext` and add headers in route handlers. This is explicit and each route can decide whether to include them. The route handlers already build their own `Response.json(...)` calls, so adding headers is minimal.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter console typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Create an Unkey test key manually via Unkey dashboard, verify it returns 200 against `/v1/search`
- [ ] Verify rate limit headers appear in the response
- [ ] Verify old `sk-lf-` keys return 401

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: tRPC `orgApiKeysRouter` Update

### Overview
Update the tRPC router to create, revoke, rotate, and delete keys through Unkey's API. The DB table becomes a metadata store tracking the Unkey key ID, name, workspace binding, and display info.

### Changes Required:

#### 1. `api/console/src/router/org/org-api-keys.ts`

**Update imports** (around line 13):
```typescript
// Before:
import { generateOrgApiKey, hashApiKey } from "@repo/console-api-key";

// After:
import { unkey, UNKEY_API_ID } from "@vendor/unkey";
```

**`create` mutation** (lines 88-161) — replace key generation with Unkey:
```typescript
// Instead of:
//   const { key, prefix, suffix } = generateOrgApiKey();
//   const keyHash = await hashApiKey(key);
//   db.insert with keyHash...

// Do:
const { result: unkeyResult, error: unkeyError } = await unkey.keys.create({
  apiId: UNKEY_API_ID,
  prefix: "sk",
  name: input.name,
  ownerId: workspace.id,  // workspaceId as ownerId for direct access on verify
  meta: {
    workspaceId: workspace.id,
    clerkOrgId: workspace.clerkOrgId,
    createdBy: ctx.auth.userId,
  },
  expires: input.expiresAt?.getTime(),
  ratelimit: {
    type: "fast",
    limit: 1000,
    refillRate: 1000,
    refillInterval: 60000, // 1000 req/min
  },
});

if (unkeyError || !unkeyResult) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create API key",
  });
}

// Insert metadata row in DB
const created = await ctx.db
  .insert(orgApiKeys)
  .values({
    publicId: nanoid(),
    workspaceId: workspace.id,
    clerkOrgId: workspace.clerkOrgId,
    createdByUserId: ctx.auth.userId,
    name: input.name,
    keyPrefix: "sk",
    keySuffix: unkeyResult.key.slice(-4),
    unkeyKeyId: unkeyResult.keyId,
    // keyHash is null — Unkey manages verification
    expiresAt: input.expiresAt,
  })
  .returning({ id: orgApiKeys.id, publicId: orgApiKeys.publicId });

// Return the full key (once only)
return {
  id: created[0].publicId,
  key: unkeyResult.key,
  name: input.name,
  keyPreview: `sk_...${unkeyResult.key.slice(-4)}`,
  expiresAt: input.expiresAt ?? null,
  createdAt: new Date(),
};
```

**`revoke` mutation** (lines 167-236) — call Unkey revoke before DB update:
```typescript
// After fetching existingKey and verifying workspace ownership...
// Add Unkey revocation:
if (existingKey.unkeyKeyId) {
  const { error: unkeyError } = await unkey.keys.update({
    keyId: existingKey.unkeyKeyId,
    enabled: false,
  });
  if (unkeyError) {
    console.error("Unkey revoke failed:", unkeyError);
    // Still proceed with DB update — Unkey key will be invalid on next verify
  }
}

// Existing DB update stays:
await ctx.db.update(orgApiKeys).set({ isActive: false, updatedAt: now })...
```

**`delete` mutation** (lines 242-304) — call Unkey delete:
```typescript
// After fetching existingKey and verifying workspace ownership...
if (existingKey.unkeyKeyId) {
  await unkey.keys.delete({ keyId: existingKey.unkeyKeyId });
}

// Existing DB hard delete stays:
await ctx.db.delete(orgApiKeys).where(...)
```

**`rotate` mutation** (lines 310-415) — Unkey revoke old + create new:
```typescript
// Replace the DB transaction body:
// 1. Revoke old key in Unkey
if (existingKey.unkeyKeyId) {
  await unkey.keys.update({ keyId: existingKey.unkeyKeyId, enabled: false });
}

// 2. Create new key in Unkey
const { result: newUnkeyResult, error: unkeyError } = await unkey.keys.create({
  apiId: UNKEY_API_ID,
  prefix: "sk",
  name: existingKey.name,
  ownerId: existingKey.workspaceId,
  meta: {
    workspaceId: existingKey.workspaceId,
    clerkOrgId: existingKey.clerkOrgId,
    createdBy: ctx.auth.userId,
  },
  expires: input.expiresAt?.getTime(),
  ratelimit: {
    type: "fast",
    limit: 1000,
    refillRate: 1000,
    refillInterval: 60000,
  },
});

if (unkeyError || !newUnkeyResult) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create replacement API key",
  });
}

// 3. DB transaction: deactivate old, insert new
const newKey = await ctx.db.transaction(async (tx) => {
  await tx.update(orgApiKeys).set({ isActive: false, updatedAt: now }).where(...);
  return tx.insert(orgApiKeys).values({
    publicId: nanoid(),
    workspaceId: existingKey.workspaceId,
    clerkOrgId: existingKey.clerkOrgId,
    createdByUserId: ctx.auth.userId,
    name: existingKey.name,
    keyPrefix: "sk",
    keySuffix: newUnkeyResult.key.slice(-4),
    unkeyKeyId: newUnkeyResult.keyId,
    expiresAt: input.expiresAt,
  }).returning({ id: orgApiKeys.id, publicId: orgApiKeys.publicId });
});
```

**`list` query** — no changes needed. The `keyPrefix` and `keySuffix` fields already construct the preview display. New keys will show `sk_...XXXX` instead of `sk-lf-...XXXX`.

#### 2. Add `@vendor/unkey` dependency to `api/console/package.json`
```json
"dependencies": {
  "@vendor/unkey": "workspace:*",
  ...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @api/console typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Create a new API key via the dashboard — it should start with `sk_`
- [ ] The key appears in the dashboard list with `sk_...XXXX` preview
- [ ] Revoking the key makes it return 401 immediately
- [ ] Rotating the key returns a new `sk_` key and the old one stops working
- [ ] Deleting the key removes it from the list and from Unkey

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 5: Update SDK + MCP Prefix Constants

### Overview
Update the prefix constant in the published SDK and MCP server to accept the new `sk_` format. This is a breaking change for SDK consumers — they must update to the new version and generate new keys.

### Changes Required:

#### 1. `core/lightfast/src/constants.ts`
**Change** line 26:
```typescript
// Before:
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

// After:
export const LIGHTFAST_API_KEY_PREFIX = "sk_";
```

**Update** `API_KEY_SECRET_LENGTH` at line 35 — Unkey keys have variable length, so length validation should be relaxed:
```typescript
// Before:
export const API_KEY_SECRET_LENGTH = 43;

// After — remove fixed length, Unkey controls key length
export const API_KEY_SECRET_LENGTH = undefined;
```

**Update** `isValidApiKeyFormat` (line 43):
```typescript
// Before: checked exact prefix + exact length
// After: only check prefix (Unkey controls key length)
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(LIGHTFAST_API_KEY_PREFIX);
}
```

**Update the JSDoc comments** at lines 1-25 to reflect the new prefix. Remove the "DO NOT CHANGE" warnings since we're intentionally changing it.

#### 2. `core/lightfast/src/client.ts`
**Line 59-62** — the constructor validation already uses `LIGHTFAST_API_KEY_PREFIX`, so it will automatically pick up the new value. But update the error message if it references the old format:
```typescript
if (!config.apiKey.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
  throw new Error(
    `Invalid API key format. Keys should start with '${LIGHTFAST_API_KEY_PREFIX}'`
  );
}
```
No code change needed here — it already uses the constant. Just verify it works.

#### 3. `core/mcp/src/index.ts`
**Line 64-66** — same pattern, uses `LIGHTFAST_API_KEY_PREFIX` from `lightfast/constants`. No code change needed, but:
- **Update help text** at lines 17-27 to show `sk_xxx` examples instead of `sk-lf-xxx`

#### 4. `core/lightfast/src/client.test.ts`
Update all test fixtures that use `sk-lf-` to use the new `sk_` prefix. The test file has ~20 occurrences.

#### 5. `packages/console-api-key/src/crypto.ts`
**Line 16**: Update `LIGHTFAST_API_KEY_PREFIX = "sk_"` (or deprecate entirely since Unkey now generates keys)

**Note**: The `generateOrgApiKey()` and `hashApiKey()` functions are no longer needed for org API keys, but may still be used by the user API keys router (`api/console/src/router/user/user-api-keys.ts`). Leave them functional but update the prefix constant.

#### 6. Documentation files
- `apps/docs/src/lib/code-samples.ts` — update `sk-lf-` references in API examples
- `apps/docs/src/lib/api-page.client.tsx` — update key placeholder
- `packages/console-openapi/src/registry.ts` — update example key format

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes across the monorepo
- [ ] `pnpm lint` passes
- [ ] Tests in `core/lightfast/src/client.test.ts` pass after fixture updates
- [ ] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] SDK constructor accepts `sk_xxx` keys
- [ ] SDK constructor rejects old `sk-lf-` keys with clear error message
- [ ] MCP server accepts `sk_xxx` keys via `--api-key` flag

**Implementation Note**: After completing this phase, pause for manual confirmation. SDK + MCP publish is a separate step.

---

## Phase 6: Cleanup

### Overview
Remove dead code paths and unused dependencies now that Unkey is the sole auth path for org API keys.

### Changes Required:

#### 1. Delete `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
No longer imported anywhere after Phase 3 changes.

#### 2. Remove unused imports from `@repo/console-api-key`
- `api/console/src/router/org/org-api-keys.ts` — remove `generateOrgApiKey, hashApiKey` import (replaced by Unkey in Phase 4)
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts` — deleted in step 1

#### 3. Deprecate functions in `packages/console-api-key/src/crypto.ts`
Mark `generateOrgApiKey()` and `hashApiKey()` as `@deprecated` with a note to use Unkey. Don't delete yet — `user-api-keys.ts` and `trpc.ts` still use them.

#### 4. Remove `lastUsedAt` / `lastUsedFromIp` fire-and-forget update
This was in the deleted `with-api-key-auth.ts`. No further action needed since the file is gone.

#### 5. Add `@vendor/unkey` to `apps/console/package.json`
Ensure the console app has the vendor dependency for the auth middleware import.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (no unused imports)
- [ ] `pnpm build:console` succeeds
- [ ] No references to `with-api-key-auth` remain (except possibly in git history)

#### Manual Verification:
- [ ] Full end-to-end flow: create key → use key → revoke key → verify rejection

---

## Testing Strategy

### Unit Tests:
- Update `core/lightfast/src/client.test.ts` with new `sk_` prefix fixtures
- No new unit tests needed for `with-unkey-auth.ts` (Unkey SDK is the test surface)

### Integration Tests:
- Create key via tRPC → verify via `/v1/search` → revoke → verify 401
- Rate limit: hit 1000+ requests/min → verify 429 response with correct headers
- Expired key: create with short TTL → wait → verify 401

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Create a new org API key via the dashboard
3. Copy the `sk_xxx` key
4. `curl -H "Authorization: Bearer sk_xxx" https://localhost:3024/v1/search -d '{"query":"test"}'`
5. Verify 200 response with `X-RateLimit-*` headers
6. Revoke the key in the dashboard
7. Repeat curl — verify 401
8. Try an old `sk-lf-` key — verify 401

## Environment Variables

Add to `apps/console/.vercel/.env.development.local`:
```bash
UNKEY_ROOT_KEY=unkey_xxxx    # Get from unkey.com dashboard
UNKEY_API_ID=api_xxxx        # Get from unkey.com dashboard
```

Add to Vercel project env vars for production deployment.

## Migration Notes

**This is a breaking change.** All existing `sk-lf-` keys are invalidated. Communication plan:
1. Announce the change in advance (changelog, email, docs)
2. Deploy the update
3. Users must create new `sk_` keys from the dashboard
4. Old keys in the DB remain as inactive records

No batch migration script is needed — the old keys simply stop working because `withDualAuth` no longer routes `sk-lf-` prefix to any verification path.

## Performance Considerations

- **Latency**: Unkey verify is an HTTP RPC call (~20-50ms from edge). The current DB lookup is similar (~10-30ms). Net impact is minimal.
- **Removed DB write**: The fire-and-forget `lastUsedAt` UPDATE is eliminated, removing one DB write per request.
- **Rate limiting**: Previously no per-key rate limits. Now enforced at 1000 req/min via Unkey, protecting backend services.

## References

- Research: `thoughts/shared/research/2026-02-22-unkey-api-layer-integration.md`
- Current auth: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:51`
- Current key verification: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49`
- tRPC router: `api/console/src/router/org/org-api-keys.ts:32`
- DB schema: `db/console/src/schema/tables/org-api-keys.ts:29`
- SDK prefix: `core/lightfast/src/constants.ts:26`
- Vendor pattern: `vendor/upstash/` (reference implementation)
