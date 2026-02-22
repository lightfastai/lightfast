---
date: 2026-02-22T05:32:51Z
researcher: claude-sonnet-4-6
git_commit: c510c99b
branch: main
repository: lightfast-search-perf-improvements
topic: "Implementing Unkey.com for the v1 API Layer"
tags: [research, codebase, unkey, api-keys, auth, rate-limiting, v1-api]
status: complete
last_updated: 2026-02-22
last_updated_by: claude-sonnet-4-6
---

# Research: Implementing Unkey.com for the v1 API Layer

**Date**: 2026-02-22T05:32:51Z
**Git Commit**: c510c99b
**Branch**: main
**Repository**: lightfast-search-perf-improvements

## Research Question

We want to implement unkey.com for our API layer in `apps/console/src/app/(api)/v1/`. Investigate everything we need to set this up.

## Summary

The v1 API layer currently uses a fully custom, self-hosted API key system: keys are generated with `sk-lf-` prefix, SHA-256 hashed, stored in the `lightfast_workspace_api_keys` Postgres table, and validated on every request via a DB lookup in `with-api-key-auth.ts`. All 6 routes (`search`, `contents`, `answer`, `findsimilar`, `graph`, `related`) use `withDualAuth` which delegates to this custom system.

Integrating Unkey replaces the DB-based key verification with an edge-fast RPC call to Unkey's servers, and moves key lifecycle management (create, revoke, rotate, expiry) to Unkey's platform. The DB table and tRPC management routers remain but shift from being the auth source-of-truth to being a metadata store tracking Unkey key IDs.

---

## Detailed Findings

### Current Auth Stack (What Exists Today)

#### Entry Points — All 6 Routes
Every route in `apps/console/src/app/(api)/v1/` calls `withDualAuth` from `../lib/with-dual-auth.ts`:

- `apps/console/src/app/(api)/v1/search/route.ts:43`
- `apps/console/src/app/(api)/v1/contents/route.ts:32`
- `apps/console/src/app/(api)/v1/findsimilar/route.ts:35`
- `apps/console/src/app/(api)/v1/related/route.ts:56`
- `apps/console/src/app/(api)/v1/graph/route.ts:57`
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:48`

#### `withDualAuth` — Priority Logic
`apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

Priority order:
1. `Authorization: Bearer sk-lf-*` → delegates to `withApiKeyAuth`
2. `Authorization: Bearer <other>` → trusts `X-Workspace-ID` + `X-User-ID` headers (internal service calls)
3. No Bearer token → Clerk session cookie via `auth()` + `X-Workspace-ID` header

Returns `DualAuthContext`:
```typescript
{
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}
```

#### `withApiKeyAuth` — Current DB Verification Flow
`apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

Steps:
1. Extract `Authorization: Bearer` header
2. Validate `sk-lf-` prefix + 49 char length via `isValidApiKeyFormat`
3. SHA-256 hash the key
4. DB query: `SELECT ... FROM lightfast_workspace_api_keys WHERE key_hash = $1 AND is_active = true`
5. Check `expiresAt` manually
6. Fire-and-forget UPDATE of `lastUsedAt` and `lastUsedFromIp`
7. Return `workspaceId`, `userId` (createdByUserId), `apiKeyId` (publicId), `clerkOrgId`

#### Key Generation — `@repo/console-api-key`
`packages/console-api-key/src/crypto.ts`

- Prefix: `LIGHTFAST_API_KEY_PREFIX = "sk-lf-"` (6 chars)
- Secret: `nanoid(43)` — 43 chars, ~256 bits entropy
- Total length: 49 chars
- Format: `sk-lf-<43 random chars>`
- Stored as SHA-256 hash; plaintext never persisted

#### DB Schema — `orgApiKeys`
`db/console/src/schema/tables/org-api-keys.ts` → table `lightfast_workspace_api_keys`

Key columns:
| Column | Type | Purpose |
|---|---|---|
| `key_hash` | text | SHA-256 of full key (primary lookup) |
| `key_prefix` | varchar(20) | `sk-lf-` |
| `key_suffix` | varchar(4) | Last 4 chars (display only) |
| `workspace_id` | varchar(191) | FK to `org_workspaces.id` |
| `clerk_org_id` | varchar(191) | Denormalized for fast lookups |
| `is_active` | boolean | Soft revocation flag |
| `expires_at` | timestamp | Checked in app code |
| `last_used_at` | timestamp | Updated on every request |
| `last_used_from_ip` | varchar(45) | Updated on every request |

Indexes: `key_hash_idx`, `workspace_active_idx`, `clerk_org_id_idx`

#### tRPC Management Router
`api/console/src/router/org/org-api-keys.ts`

Operations: `list`, `create`, `revoke`, `delete`, `rotate`
- `create`: calls `generateOrgApiKey()` + `hashApiKey()`, inserts to DB
- `rotate`: DB transaction atomically revokes old key, inserts new one
- All operations call `recordCriticalActivity` for audit trail

---

### Unkey.com — What It Provides

#### Package
```bash
pnpm add @unkey/api
```

#### Verification (replaces `withApiKeyAuth`)
```typescript
import { Unkey } from "@unkey/api";

const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY! });

const { result, error } = await unkey.keys.verify({
  key: "sk-lf-xxxxxxxxxxxx",
  apiId: process.env.UNKEY_API_ID,  // scope to our API, not other Unkey customers
});
// result.valid, result.ownerId, result.meta, result.ratelimit, result.remaining, result.code
```

#### Key Creation (replaces tRPC `orgApiKey.create`)
```typescript
const { result } = await unkey.keys.create({
  apiId: process.env.UNKEY_API_ID!,
  prefix: "sk-lf",          // Note: Unkey uses _ separator → "sk-lf_xxxx" not "sk-lf-xxxx"
  name: input.name,
  ownerId: workspace.clerkOrgId,  // used to retrieve workspaceId on verify
  meta: {
    workspaceId: workspace.id,
    createdBy: userId,
  },
  expires: input.expiresAt?.getTime(),
  ratelimit: {
    type: "fast",
    limit: 1000,
    refillRate: 1000,
    refillInterval: 60000,
  },
});
// result.key — full key (only exposed once)
// result.keyId — Unkey's internal key ID, store in DB for management
```

#### Verify Response Shape
```typescript
{
  valid: boolean;
  keyId: string;           // "key_xxxx" — Unkey's ID
  ownerId?: string;        // your orgId / workspaceId
  meta?: Record<string, unknown>; // { workspaceId, createdBy }
  ratelimit?: {
    limit: number;
    remaining: number;
    reset: number;         // Unix ms when window resets
  };
  remaining?: number;      // usage-based limit remaining
  expires?: number;        // Unix ms expiry
  code?: "VALID" | "NOT_FOUND" | "RATE_LIMITED" | "USAGE_EXCEEDED" | "EXPIRED" | "DISABLED";
}
```

#### Environment Variables Needed
```bash
UNKEY_ROOT_KEY="unkey_xxxx"   # Full management access (create/revoke keys)
UNKEY_API_ID="api_xxxx"       # Your API namespace ID
```

These go into `apps/console/.vercel/.env.development.local` alongside existing vars.

#### Rate Limiting — Built-In
Unkey handles rate limiting at the key level. No Upstash/Redis integration needed for per-key rate limits. The `ratelimit` object in the verify response contains `remaining` and `reset` values you can surface to callers via response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).

#### Prefix Caveat
Unkey's native key format uses `_` as separator: `{prefix}_{random}`. Setting `prefix: "sk-lf"` produces `sk-lf_xxx`, not `sk-lf-xxx`. This is a **breaking change** for existing keys (they use `sk-lf-`). Migration requires either:
- Accepting the new `sk-lf_` format for new keys while supporting old `sk-lf-` keys during transition
- OR not using the Unkey `prefix` parameter and keeping `sk-lf-` by customizing key generation

---

### Vendor Package Pattern

Existing vendors follow this structure in `vendor/`:
```
vendor/<name>/
  package.json   # name: "@vendor/<name>"
  env.ts         # createEnv() with Zod validation
  src/
    index.ts     # re-exports with abstraction
```

Example: `vendor/security` wraps `@arcjet/next`, exports `arcjet`, `detectBot`, `shield`, etc.
Example: `vendor/upstash` wraps `@upstash/redis`.

A `vendor/unkey` package would follow the same pattern, providing `@vendor/unkey` to the rest of the monorepo.

---

### What Changes and What Stays

| Component | Current | With Unkey |
|---|---|---|
| `with-api-key-auth.ts` | DB hash lookup | Unkey `keys.verify` RPC call |
| `orgApiKeys` DB table | Auth source-of-truth | Metadata store (tracks `unkeyKeyId`) |
| Key generation | `@repo/console-api-key` | Unkey `keys.create` |
| Revoke | DB `isActive = false` | Unkey `keys.revoke` (+ DB update) |
| Rotate | DB transaction | Unkey `keys.revoke` + `keys.create` |
| Expiry check | App-level `expiresAt` compare | Unkey enforces + returns `code: "EXPIRED"` |
| Rate limiting | Not implemented at key level | Unkey built-in per-key ratelimit |
| `lastUsedAt` tracking | DB UPDATE on every request | Available via Unkey `getVerifications` |
| `with-dual-auth.ts` | Routes through `withApiKeyAuth` | Routes through new Unkey verifier |
| Clerk session path | Unchanged | Unchanged |
| Internal bearer token path | Unchanged | Unchanged |

---

## Code References

- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49` — `withApiKeyAuth` function (to be replaced)
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:51` — `withDualAuth` orchestrator (routing logic)
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:62` — API key path detection (`LIGHTFAST_API_KEY_PREFIX`)
- `packages/console-api-key/src/crypto.ts:16` — `LIGHTFAST_API_KEY_PREFIX = "sk-lf-"`
- `packages/console-api-key/src/crypto.ts:108` — `hashApiKey` (SHA-256, no longer needed for verification)
- `db/console/src/schema/tables/org-api-keys.ts:29` — `orgApiKeys` table schema
- `api/console/src/router/org/org-api-keys.ts:32` — tRPC `orgApiKeysRouter` (create/revoke/rotate)
- `vendor/security/src/index.ts` — Example vendor abstraction pattern

---

## Architecture Documentation

### Current Auth Flow (DB-based)
```
Request → withDualAuth → withApiKeyAuth
                              ↓
                         SHA-256 hash key
                              ↓
                         DB SELECT (key_hash + is_active)
                              ↓
                         Check expiresAt in app
                              ↓
                         fire-and-forget UPDATE lastUsedAt
                              ↓
                         return { workspaceId, userId, apiKeyId, clerkOrgId }
```

### Proposed Auth Flow (Unkey-based)
```
Request → withDualAuth → withUnkeyAuth (new)
                              ↓
                         unkey.keys.verify({ key, apiId })
                              ↓
                         Unkey checks: active? expired? rate limited?
                              ↓
                         return { result.ownerId → workspaceId, result.meta, result.keyId }
                              ↓ (optional)
                         DB SELECT workspace from ownerId (if not in meta)
```

### Key Lifecycle With Unkey
```
CREATE:
  tRPC orgApiKey.create
    → unkey.keys.create({ prefix:"sk-lf", ownerId: clerkOrgId, meta:{workspaceId} })
    → DB INSERT with unkeyKeyId (store Unkey's keyId for management)
    → return full key to user (once only)

REVOKE:
  tRPC orgApiKey.revoke
    → unkey.keys.revoke({ keyId: unkeyKeyId })
    → DB UPDATE isActive = false

ROTATE:
  tRPC orgApiKey.rotate
    → unkey.keys.revoke({ keyId: oldUnkeyKeyId })
    → unkey.keys.create({ ... })
    → DB transaction: update old, insert new
```

---

## What Needs to Be Built

1. **`vendor/unkey` package** — `@vendor/unkey` wrapping `@unkey/api`
   - `env.ts` with `UNKEY_ROOT_KEY` and `UNKEY_API_ID` Zod validation
   - `src/index.ts` exporting `unkey` client singleton and re-exporting `Unkey`, `verifyKey`

2. **`with-unkey-auth.ts`** — replaces `with-api-key-auth.ts`
   - Calls `unkey.keys.verify({ key, apiId })`
   - Maps `result.ownerId` to `workspaceId` (via `result.meta.workspaceId` if stored there, or DB lookup)
   - Handles Unkey error codes: `NOT_FOUND`, `RATE_LIMITED`, `EXPIRED`, `DISABLED`
   - Optionally sets `X-RateLimit-*` response headers

3. **DB schema update** — add `unkey_key_id` column to `lightfast_workspace_api_keys`
   - Needed to call `unkey.keys.revoke({ keyId })` and `unkey.keys.update()`
   - Run `pnpm db:generate` from `db/console/`

4. **tRPC `orgApiKeysRouter` update** — `api/console/src/router/org/org-api-keys.ts`
   - `create`: call `unkey.keys.create()`, store `unkeyKeyId` in DB
   - `revoke`: call `unkey.keys.revoke()` before DB update
   - `rotate`: call Unkey revoke + create instead of DB transaction
   - `delete`: call `unkey.keys.revoke()` before DB delete

5. **Environment variables** — add `UNKEY_ROOT_KEY` and `UNKEY_API_ID` to:
   - `apps/console/.vercel/.env.development.local`
   - Vercel project env vars (production)
   - `vendor/unkey/env.ts` for type-safe validation

6. **`with-dual-auth.ts` update** — swap `withApiKeyAuth` call for `withUnkeyAuth`
   - The `LIGHTFAST_API_KEY_PREFIX` detection logic remains unchanged
   - Only the called function changes

7. **Prefix decision** — decide between:
   - Accept `sk-lf_` (Unkey native) for new keys, support old `sk-lf-` during migration
   - Skip Unkey prefix, keep `sk-lf-` format by generating key locally and passing to `unkey.keys.create` with no prefix (not supported — Unkey generates the key)
   - Use `prefix: "sk"` to produce `sk_xxxx` (shorter, cleaner break)

---

## Open Questions

1. **Prefix format change**: New Unkey keys will be `sk-lf_xxx` (underscore) vs existing `sk-lf-xxx` (hyphen). How to handle migration for existing keys in DB?
2. **`workspaceId` in `ownerId` vs `meta`**: Should `ownerId` store `clerkOrgId` (already in DB, allows cross-workspace queries) or the Lightfast `workspaceId` (direct, no DB lookup needed)? Using `meta.workspaceId` avoids the ambiguity.
3. **Dual-write period**: During migration, do we verify against Unkey first and fall back to DB for old-format keys?
4. **`lastUsedAt` tracking**: Currently the DB tracks this for display in the dashboard. With Unkey, this is available via `unkey.keys.getVerifications()` but not automatically written to our DB. Remove from DB or sync via webhook?
5. **Rate limit configuration**: What are the desired per-key rate limits? Currently no rate limiting is enforced. Suggested starting point: `{ type: "fast", limit: 1000, refillRate: 1000, refillInterval: 60000 }` (1000 req/min).
6. **Existing key migration**: ~N existing keys in DB have no `unkeyKeyId`. Options: (a) migrate all to Unkey on first use, (b) batch-migrate via script, (c) keep old system for existing keys + Unkey for new keys.
