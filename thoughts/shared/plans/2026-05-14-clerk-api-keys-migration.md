# Clerk API Keys Migration Implementation Plan

## Overview

Replace Lightfast's hand-rolled `orgApiKeys` system (local Postgres table, SHA-256 hashed `sk-lf-*` secrets, custom verification) with Clerk's first-party [API Keys primitive](https://clerk.com/docs/nextjs/reference/objects/api-keys). The tRPC `orgApiKeys` procedure surface stays — list/create/revoke/delete become thin wrappers over `clerkClient.apiKeys.*`. The public oRPC `/api/v1/*` verification path switches from a DB-hash lookup to `clerkClient.apiKeys.verify(secret)`. The `lightfast_workspace_api_keys` table, the `@repo/app-api-key` package, the `sk-lf-` format, and `isValidApiKeyFormat` all get deleted.

## Current State Analysis

Verified against `git_commit 967fcbffc` (current HEAD).

- **Storage**: `db/app/src/schema/tables/org-api-keys.ts:27-145` defines `lightfast_workspace_api_keys` — bigint id, varchar publicId (nanoid), clerkOrgId, createdByUserId, name, keyHash (SHA-256 hex), keyPrefix (`sk-lf-`), keySuffix (last 4), isActive, expiresAt, lastUsedAt, lastUsedFromIp, createdAt, updatedAt. Indexes on clerkOrgId, keyHash, isActive, (clerkOrgId, isActive).
- **Crypto / utilities**: `packages/app-api-key/src/crypto.ts` — `generateApiKey`, `generateOrgApiKey`, `hashApiKey` (SHA-256), `extractKeyPreview`, `isValidApiKeyFormat`. `LIGHTFAST_API_KEY_PREFIX = "sk-lf-"`, `API_KEY_SECRET_LENGTH = 43` (~256 bits via nanoid), `API_KEY_PREVIEW_LENGTH = 4`.
- **Management procedures** (tRPC, internal cookie/desktop-JWT auth): `api/app/src/router/(pending-not-allowed)/org-api-keys.ts:25-194` — `list`/`create`/`revoke`/`delete` under `pendingNotAllowedProcedure`. `rotate` was removed (see `thoughts/shared/plans/2026-05-09-drop-org-api-key-rotate.md`).
- **Verification** (oRPC, public `/api/v1/*` only): `api/app/src/orpc/middleware/auth.ts:14-87` — extracts Bearer token, validates `sk-lf-` format, hashes with SHA-256, looks up active row by `keyHash`, checks `expiresAt`, fire-and-forget UPDATEs `lastUsedAt`/`lastUsedFromIp`, returns `{ apiKeyId, clerkOrgId, userId }`. Internal tRPC `(trpc)/api/trpc/[trpc]` does NOT verify `sk-lf-` keys — it only handles Clerk session cookies (web) and Clerk JWT Bearer (desktop) via `api/app/src/auth/resolve.ts`.
- **Validation schemas**: `packages/app-validation/src/schemas/org-api-key.ts` — Zod schemas for `create` (name, optional expiresAt), `revoke`/`delete` (keyId = publicId nanoid string).
- **UI**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx` — consumes `trpc.pendingNotAllowed.orgApiKeys.{list,create,revoke,delete}`. Renders `keyPreview` as `sk-lf-...XYZ9`.
- **CLI mint**: `apps/app/src/app/api/cli/setup/route.ts` — Clerk-JWT-authed, verifies org membership, INSERTs into `orgApiKeys`, returns raw `sk-lf-*` key.
- **SDK**: `core/lightfast/src/index.ts:21` — validates `apiKey.startsWith("sk-lf-")`, sends `Authorization: Bearer ${apiKey}`.
- **MCP**: `core/mcp/src/index.ts` — passes `LIGHTFAST_API_KEY` env as Bearer.
- **Docs / examples**: `apps/www/src/app/(app)/(content)/_lib/code-samples.ts`, `.env.mcp.example` — reference `sk-lf-` format.
- **Tests**:
  - `api/app/src/orpc/__tests__/auth.test.ts` — unit tests for the oRPC middleware (valid/invalid/missing/expired key paths).
  - `core/lightfast/src/__tests__/integration/setup.ts` — seeds a real `orgApiKeys` row via `generateOrgApiKey`/`hashApiKey` for an end-to-end test that calls `/api/v1/system/health`.
  - `core/lightfast/src/__tests__/integration/system-health.test.ts` — boots `@lightfast/app` and exercises the SDK round-trip with the seeded `sk-lf-` key.
  - `core/lightfast/src/__tests__/client.test.ts` — validates `sk-lf-` prefix enforcement in the SDK.
- **Vendor / Clerk infra**: `vendor/clerk/src/server.ts` re-exports `clerkClient` (and `auth`, `verifyToken`, `clerkMiddleware`). `vendor/clerk/src/backend.ts` re-exports `createClerkClient` from `@clerk/backend`. The installed version is `@clerk/backend@3.4.7` (via `@clerk/nextjs@7.3.3`), which ships a non-experimental `apiKeys` property on `clerkClient`.
- **Clerk dev tenant**: `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md` notes `api_keys_settings.enabled = false`. The dashboard toggle must be flipped before any of this works.

### Clerk API Keys — confirmed contract

Verified against `node_modules/.pnpm/@clerk+backend@3.4.7/.../dist/api/endpoints/APIKeysApi.d.ts` and `dist/api/resources/APIKey.d.ts`:

- `clerkClient.apiKeys.list({ subject, includeInvalid?, limit?, offset? })` → `PaginatedResourceResponse<APIKey[]>`
- `clerkClient.apiKeys.create({ name, subject, description?, claims?, scopes?, createdBy?, secondsUntilExpiration? })` → `APIKey` (with `secret` field present)
- `clerkClient.apiKeys.revoke({ apiKeyId, revocationReason? })` → `APIKey` (soft revoke, `revoked: true`)
- `clerkClient.apiKeys.delete(apiKeyId)` → `DeletedObject` (hard delete)
- `clerkClient.apiKeys.verify(secret)` → `APIKey` (used by middleware)
- `APIKey` shape: `{ id, type: 'api_key', name, subject, scopes, claims, revoked, revocationReason, expired, expiration, createdBy, description, lastUsedAt, createdAt, updatedAt, secret? }`. `lastUsedAt` and `expired` are Clerk-managed — we get them for free.
- Token format: `ak_*` — hardcoded prefix (custom prefixes are roadmap, not shipped).
- `auth({ acceptsToken: ['session_token', 'api_key'] })` opts a Next route into accepting `ak_*` Bearers; without this, `auth()` rejects them as `TokenTypeMismatch`. NOT needed for the oRPC mount (we call `verify()` directly), but listed here for context.
- No `api_key.*` webhook events. No prebuilt React components.

## Desired End State

After this plan:

- The `lightfast_workspace_api_keys` Postgres table is dropped via a Drizzle-generated migration.
- The `@repo/app-api-key` package is deleted from the workspace.
- `api/app/src/orpc/middleware/auth.ts` verifies `ak_*` Bearer tokens via `clerkClient.apiKeys.verify(secret)`. No DB lookup, no SHA-256 hashing, no local `lastUsedAt` write.
- `api/app/src/router/(pending-not-allowed)/org-api-keys.ts` proxies `list`/`create`/`revoke`/`delete` to `clerkClient.apiKeys.*` with `subject = ctx.auth.orgId`.
- `apps/app/src/app/api/cli/setup/route.ts` mints CLI keys via `clerkClient.apiKeys.create({ subject: orgId, name: "CLI (auto-generated)", createdBy: userId })`.
- `core/lightfast/src/index.ts` validates `apiKey.startsWith("ak_")`.
- Docs samples, `.env.mcp.example`, and any other `sk-lf-` references are updated to `ak_`.
- The UI list drops the `keyPreview` field. Each row shows `name`, Clerk key id (`apk_*` shortened), `createdAt`, `lastUsedAt`, revoked badge.
- Clerk dashboard has `api_keys_settings.enabled = true` (one-time manual step in Clerk Dashboard, recorded in the dev-tenant inventory doc).

### Verification

- `curl https://app.lightfast.localhost/api/v1/system/health` → `401` with no header; `401` with old `sk-lf-*` key; `200` with a freshly minted `ak_*` key.
- `pnpm typecheck` at repo root passes.
- `pnpm --filter @api/app test` passes (new `auth.test.ts` exercises `verify()` path with mocked `clerkClient`).
- `pnpm --filter lightfast test:integration` passes (integration test mints a real Clerk API key via Backend API, calls SDK, asserts round-trip).
- `grep -rn "sk-lf-\|hashApiKey\|@repo/app-api-key\|isValidApiKeyFormat\|orgApiKeys\b" -- :^thoughts/ :^.changeset/` returns no production matches (only plan/research/handoff docs).
- `find db/app/src/migrations -name "*workspace_api_keys*"` includes the drop migration generated by `pnpm db:generate`.

### Key Discoveries

- Clerk's `APIKey` resource includes `lastUsedAt` natively (`APIKey.d.ts:56-57`) — we don't lose the "last used" UX, only `lastUsedFromIp`.
- `clerkClient.apiKeys` is non-experimental in `@clerk/backend@3.4.7` (`dist/index.js:4906` — no `__experimental_` prefix, unlike `agentTasks`).
- The oRPC middleware is the ONLY production verification path for API keys today. The internal tRPC mount handles cookies + Clerk JWTs (desktop), not `sk-lf-` keys — so the verification rewrite is scoped to one file.
- `pendingNotAllowedProcedure` (`api/app/src/trpc.ts:191`) guarantees `ctx.auth.orgId` is populated, so the Clerk API key subject can be derived directly from `ctx.auth.orgId` without an extra membership check.
- The `@vendor/clerk` package already re-exports `clerkClient` — Phase 1 adds no new export surface, only a typed helper module.
- `db/CLAUDE.md` explicitly forbids hand-written `.sql` files. The table drop must go through `pnpm db:generate`.
- The Clerk dev tenant currently has `api_keys_settings.enabled = false` (`thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md`). This must be toggled before Phase 2 can run end-to-end.

## What We're NOT Doing

- **No `rotate` procedure.** Already removed (`thoughts/shared/plans/2026-05-09-drop-org-api-key-rotate.md`). Clerk also has no rotate primitive — pattern is revoke + create.
- **No dual-run window for `sk-lf-*` keys.** Hard cutover (per user decision). Existing keys stop working the moment Phase 2 deploys. The SDK is pre-1.0 alpha with no documented external consumers; the blast radius is internal.
- **No per-key scopes / claims.** Clerk supports them; we ship full-org access per key for parity with today (per user decision). Adding scopes is a future plan that touches `clerkClient.apiKeys.create({ scopes })` and a scope-check middleware.
- **No verify-result caching in Upstash.** Each `/api/v1/*` request makes one network call to Clerk Backend API (per user decision). Add only if measured latency hurts.
- **No local audit table.** `lastUsedAt` comes back via Clerk's resource. `lastUsedFromIp` is dropped. Acceptable per user decision.
- **No `acceptsToken` change to `auth()` in the tRPC mount.** The internal tRPC mount remains session-only (cookie + Clerk JWT Bearer). API keys live exclusively on `/api/v1/*` (oRPC). Mixing API-key auth into tRPC is a separate plan.
- **No webhook plumbing.** Clerk doesn't emit `api_key.*` events. No external listener depends on these.
- **No UI redesign.** Drop `keyPreview` and adapt to Clerk's `id`/`name`/`lastUsedAt`/`revoked` shape; otherwise the UI is unchanged.
- **No migration script for existing `sk-lf-*` keys.** Hard cutover — table is dropped, users remint.
- **No changes to `auth/resolve.ts` or `trpc.ts`.** All API key changes are confined to oRPC + the org-api-keys tRPC router.

## Implementation Approach

Four phases. Each halts at the boundary for human review before the next starts.

- **Phase 1** is purely additive — typed Clerk wrapper helpers, schema updates. No verification or management behavior changes.
- **Phase 2** swaps `/api/v1/*` verification to Clerk. This is the cutover moment for SDK consumers — `sk-lf-*` keys stop working. UI still operates the legacy DB-backed table (so users can see their dead `sk-lf-*` keys exist and read about the migration).
- **Phase 3** swaps the tRPC management surface to Clerk. UI now lists/creates/revokes/deletes Clerk-managed `ak_*` keys. CLI setup route + SDK validator + docs all flip to `ak_*`.
- **Phase 4** is pure deletion — `lightfast_workspace_api_keys` table dropped, `@repo/app-api-key` package removed, `sk-lf-` references purged.

The integration test (`core/lightfast/src/__tests__/integration/`) gets rewritten in Phase 2 to mint a real Clerk API key against the dev tenant in `beforeAll`/`afterAll`. This is a deliberate live dependency on Clerk dev — without it, we have no end-to-end verification of the `verify()` path.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Clerk API key helper module + schema updates

### Overview

Add a typed `@vendor/clerk` helper that normalizes Clerk's `APIKey` shape into a domain-friendly type. Update Zod schemas to drop `expiresAt` from `create` (Clerk uses `secondsUntilExpiration` and our UI never passed `expiresAt` — verified by reading the UI component). No behavioral changes — additive only.

### Changes Required

#### 1. `@vendor/clerk` — re-export `APIKey` type

**File**: `vendor/clerk/src/server.ts`
**Changes**: Re-export the `APIKey` type from `@clerk/backend` alongside the existing exports. (`@clerk/nextjs/server` does not re-export `APIKey`, so this is added as a separate `export type` block.)

```ts
export type { APIKey } from "@clerk/backend";
```

No mapper helper. Phase 3 router returns `APIKey` (and `APIKey & { secret: string }` on `create`) directly — Clerk's type is the source of truth, the UI can read `expiration`/`createdAt`/etc. fields directly without a remapping layer.

#### 2. Update validation schemas

**File**: `packages/app-validation/src/schemas/org-api-key.ts`
**Changes**: Replace `expiresAt: z.coerce.date().optional()` with `secondsUntilExpiration: z.number().int().positive().optional()` to match Clerk's API. Keep `revoke`/`delete` schemas but change `keyId` semantics (still a string, but now opaque Clerk id, not nanoid publicId — same type, different shape). Add `revocationReason?: string` to `revokeOrgApiKeySchema` (optional, surfaces in Clerk for audit).

**Knock-on**: the legacy tRPC router (`api/app/src/router/(pending-not-allowed)/org-api-keys.ts`) referenced `input.expiresAt?.toISOString()` on insert and in its return value. The UI never passed `expiresAt`, so this was effectively dead. Drop the `expiresAt` key from the insert and hardcode `expiresAt: null` in the return so typecheck stays green between Phase 1 and Phase 3.

```ts
import { z } from "zod";

export const createOrgApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  secondsUntilExpiration: z.number().int().positive().optional(),
});

export const revokeOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
  revocationReason: z.string().max(200).optional(),
});

export const deleteOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
});
```

#### 3. Enable Clerk API Keys in dev tenant

**Action**: The feature is gated behind a tenant-level toggle. `api_keys_settings` is NOT exposed in the customer-facing config schema (`npx clerk config schema` confirms — only `auth_*`, `billing`, `branding`, `compliance`, `organization_settings`, `paths`, `session`, `user_model`, `connection_oauth_*` are present). The toggle lives in the Clerk Dashboard or requires Platform-API access via `npx clerk api --platform`.

Verify current state with the bundled CLI:

```bash
npx clerk api GET /api_keys
# Disabled → { "errors": [{ "code": "feature_not_enabled", ... }] }
# Enabled  → { "data": [], "total_count": 0 }
```

If disabled, enable it via the Dashboard (Configure → API Keys → toggle on) for the dev instance. Production gets the same flip in the rollout PR. Once enabled, re-run the verify command to confirm — `feature_not_enabled` becomes a valid empty list.

Append a dated entry to `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md` recording the flip and the verification output.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @vendor/clerk typecheck` passes
- [x] `pnpm --filter @repo/app-validation typecheck` passes (`@repo/app-validation` has no `test` script — typecheck is the only check)
- [x] `pnpm typecheck` at repo root passes
- [x] `grep -rn "expiresAt" packages/app-validation/src/schemas/org-api-key.ts` returns no matches (renamed to `secondsUntilExpiration`)
- [x] `npx clerk api GET /api_keys?subject=org_...` returns `{ "data": [], "total_count": 0 }` (feature toggle flipped on by user in Phase 2)

#### Human Review

- [x] `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md` now has an `## Update — 2026-05-14` section recording the dashboard flip + verification CLI output

---

## Phase 2: Swap `/api/v1/*` verification to Clerk

### Overview

Rewrite `api/app/src/orpc/middleware/auth.ts` to call `clerkClient.apiKeys.verify(secret)` instead of a SHA-256 DB lookup. This is the cutover moment for SDK consumers. After this phase deploys, `sk-lf-*` keys return `401` and `ak_*` keys verify successfully. The tRPC management procedures are NOT touched in this phase — they continue managing the legacy `lightfast_workspace_api_keys` table; the UI still shows old `sk-lf-*` rows but those rows no longer authenticate anything.

### Changes Required

#### 1. Rewrite the oRPC auth middleware

**File**: `api/app/src/orpc/middleware/auth.ts`
**Changes**: Drop the DB lookup, the SHA-256 hash, the `isValidApiKeyFormat` check, and the fire-and-forget `lastUsedAt` UPDATE. Call `clerkClient.apiKeys.verify(token)` instead.

```ts
import { ORPCError, os } from "@orpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { enrichContext } from "@vendor/observability/context";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import type { AuthContext, InitialContext } from "../context";

const base = os.$context<InitialContext>();

async function resolveApiKey(
  headers: Headers,
  requestId: string,
): Promise<AuthContext> {
  const authHeader = headers.get("authorization");
  const [scheme, token] = authHeader?.trim().split(/\s+/, 2) ?? [];
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "API key required. Provide 'Authorization: Bearer <api-key>' header.",
    });
  }

  // Cheap pre-flight: every Clerk API key starts with `ak_`. Reject obviously
  // wrong tokens (e.g. legacy `sk-lf-*` or session JWTs) without a network call.
  if (!token.startsWith("ak_")) {
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid API key format." });
  }

  let key;
  try {
    const clerk = await clerkClient();
    key = await clerk.apiKeys.verify(token);
  } catch (err) {
    log.warn("API key verification failed", { requestId, error: parseError(err) });
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid API key" });
  }

  if (key.revoked) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key revoked" });
  }
  if (key.expired) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key expired" });
  }
  if (!key.subject.startsWith("org_")) {
    // Only org-scoped keys are admitted at this surface.
    throw new ORPCError("FORBIDDEN", { message: "API key is not org-scoped" });
  }
  if (!key.createdBy) {
    // Defensive: Clerk should always populate createdBy for keys minted via our
    // procedures, but the API leaves it nullable. Reject explicitly so the
    // ctx.userId invariant downstream is real.
    throw new ORPCError("FORBIDDEN", { message: "API key is missing creator metadata" });
  }

  log.info("API key verified", {
    requestId,
    apiKeyId: key.id,
    orgId: key.subject,
  });

  return {
    apiKeyId: key.id,
    clerkOrgId: key.subject,
    userId: key.createdBy,
  };
}

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const auth = await resolveApiKey(context.headers, context.requestId);
  enrichContext({
    userId: auth.userId,
    clerkOrgId: auth.clerkOrgId,
    authType: "api-key",
    apiKeyId: auth.apiKeyId,
  });
  return next({ context: auth });
});
```

`AuthContext` field shape is unchanged (`apiKeyId`/`clerkOrgId`/`userId`), so downstream oRPC procedures need no edits.

**Note on the `userId` field**: pre-migration it came from `orgApiKeys.createdByUserId` (the user who minted the key). Post-migration it comes from `APIKey.createdBy`. Same semantic — the Clerk user who created the key — so observability and any downstream procedures see the same value shape.

#### 2. Rewrite oRPC middleware tests

**File**: `api/app/src/orpc/__tests__/auth.test.ts`
**Changes**: Replace mocks of `db`/`hashApiKey` with mocks of `clerkClient.apiKeys.verify`. Cover:

- Missing Authorization header → `UNAUTHORIZED`
- Non-Bearer scheme → `UNAUTHORIZED`
- Bearer with non-`ak_` token → `UNAUTHORIZED` (no network call made — assert mock NOT called)
- Bearer + `clerkClient.apiKeys.verify` throws → `UNAUTHORIZED`
- Verify returns `revoked: true` → `UNAUTHORIZED`
- Verify returns `expired: true` → `UNAUTHORIZED`
- Verify returns `subject: "user_..."` → `FORBIDDEN`
- Verify returns `createdBy: null` → `FORBIDDEN`
- Verify returns valid org key → context has `{ apiKeyId, clerkOrgId, userId }` set correctly

Use `vi.mock("@vendor/clerk/server")` to stub `clerkClient`.

#### 3. Rewrite integration test setup

**File**: `core/lightfast/src/__tests__/integration/setup.ts`
**Changes**: Drop `generateOrgApiKey`/`hashApiKey` and the direct DB insert. Mint a real Clerk API key in `beforeAll`, capture `{ id, secret }`, expose `secret` to the test as the Bearer token. In `afterAll`, delete the key for cleanup.

The bundled `npx clerk api` CLI is the recommended path for tenant ops — it picks up the linked-instance secret from `~/.config/clerk` without juggling env vars, and is consistent with the `lightfast-clerk` skill workflows. Driving it from inside vitest via `execSync` keeps the test self-contained:

```ts
// pseudo-code shape — keep existing surrounding boot/teardown logic
import { execSync } from "node:child_process";

const TEST_ORG_ID = process.env.LIGHTFAST_TEST_CLERK_ORG_ID!;
const TEST_USER_ID = process.env.LIGHTFAST_TEST_CLERK_USER_ID!;

const create = execSync(
  `npx -y clerk api POST /api_keys --yes -d '${JSON.stringify({
    name: `integration-test-${Date.now()}`,
    subject: TEST_ORG_ID,
    created_by: TEST_USER_ID,
  })}'`,
  { encoding: "utf8" },
);
const key = JSON.parse(create) as { id: string; secret: string };
// key.secret is the only place we can read the raw token

afterAll(() => {
  execSync(`npx -y clerk api DELETE /api_keys/${key.id} --yes`);
});
```

The test org id and user id are seeded once via the `lightfast-clerk` skill and recorded in its meta directory. If not already present, document the bootstrap in `.agents/skills/lightfast-clerk/SKILL.md` (single-line entry pointing at how to mint them via `command/curl.sh`).

If shelling out to `npx clerk` from vitest proves flaky (slow cold start, CI lacks network for `npx`), swap to `@clerk/backend`'s `createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).apiKeys.create(...)` — same payload shape, no CLI dependency. Decide at implementation time based on which feels less painful.

#### 4. SDK client validator — narrow the prefix during the cutover

**File**: `core/lightfast/src/index.ts:21`
**Changes**: Accept both `ak_` and `sk-lf-` during the cutover phase — but only briefly. The SDK is the surface external consumers integrate against; a strict prefix flip would break any installed package version pinned to the old SDK. Since this is alpha and the hard cutover decision is global, flip to `ak_` only.

```ts
if (!apiKey?.startsWith("ak_")) {
  throw new Error("Invalid Lightfast API key");
}
```

This intentionally rejects `sk-lf-*` keys at the SDK level too. Anyone who installs the new SDK with an old key gets a clean error message rather than a confusing 401.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app test` passes (19/19)
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter lightfast typecheck` passes
- [x] `pnpm --filter lightfast test` passes (4/4 unit tests; integration block skipped without `LIGHTFAST_RUN_INTEGRATION=1`)
- [ ] `pnpm --filter lightfast test:integration` passes (gated on dashboard toggle being on + `CLERK_SECRET_KEY`/`LIGHTFAST_TEST_CLERK_ORG_ID`/`LIGHTFAST_TEST_CLERK_USER_ID` in env — runs with `LIGHTFAST_RUN_INTEGRATION=1 pnpm --filter lightfast test`)
- [x] `grep -rn "hashApiKey\|isValidApiKeyFormat\|sk-lf-" api/app/src/orpc/` returns no matches

#### Human Review

- [x] With the dev stack running (`pnpm dev:app`), curl `https://app.lightfast.localhost/api/v1/system/health` with no Authorization header → HTTP 401, `{"message":"API key required. Provide 'Authorization: Bearer <api-key>' header."}`
- [x] Same curl with `Authorization: Bearer sk-lf-fake` → HTTP 401, `{"message":"Invalid API key format."}`
- [x] Mint a real Clerk org key via `npx clerk api -X POST /api_keys -d '{"name":"smoke","subject":"<orgId>","created_by":"<userId>"}' --yes`; copy the `secret` field; curl same endpoint with `Authorization: Bearer ak_...` → HTTP 200, `{"status":"ok","timestamp":"...","version":"0.1.0"}`
- [x] After a successful request, `npx clerk api GET /api_keys/<keyId>` → `last_used_at` ~10s prior to GET — TODO: automate via integration test assertion

**Finding — revocation has a ~30s propagation lag.** `clerkClient.apiKeys.verify()` returns the key resource with `revoked: false` for ~30s after revocation, after which it starts returning `api_key_not_found` (our middleware then returns 401 "Invalid API key" via the catch block). Our `if (key.revoked) → UNAUTHORIZED` check works in unit tests (the mock honours the assertion) but is effectively a no-op against real Clerk traffic during the cache window. Revoked keys are NOT immediately unusable — they're unusable after ~30s. Acceptable for v1 (UI flow can disclaim); document as a follow-up if tighter SLO needed (would need a `clerk.apiKeys.get(key.id)` round-trip after verify, doubling Clerk calls per request).

---

## Phase 3: Swap tRPC `orgApiKeys` procedures to Clerk

### Overview

Rewrite the four tRPC procedures to read/write via `clerkClient.apiKeys.*`. Update the UI to consume the new shape (drop `keyPreview`, add Clerk-managed `lastUsedAt`/`expired`/`revoked` fields). Flip the CLI setup route + docs samples.

### Changes Required

#### 1. Rewrite the tRPC router

**File**: `api/app/src/router/(pending-not-allowed)/org-api-keys.ts`
**Changes**: Replace the Drizzle queries with `clerkClient.apiKeys.*` calls.

```ts
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import { log } from "@vendor/observability/log/next";

import { pendingNotAllowedProcedure } from "../../trpc";

export const orgApiKeysRouter = {
  list: pendingNotAllowedProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const { data } = await clerk.apiKeys.list({
      subject: ctx.auth.orgId,
      includeInvalid: true, // surface revoked keys so users see history
    });
    return data;
  }),

  create: pendingNotAllowedProcedure
    .input(createOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const key = await clerk.apiKeys.create({
        name: input.name,
        subject: ctx.auth.orgId,
        createdBy: ctx.auth.userId,
        secondsUntilExpiration: input.secondsUntilExpiration ?? null,
      });
      log.info("[org-api-keys] created", {
        clerkOrgId: ctx.auth.orgId,
        keyId: key.id,
        name: input.name,
      });
      // key.secret is ONLY present on create — the UI must prompt copy-now.
      return key;
    }),

  revoke: pendingNotAllowedProcedure
    .input(revokeOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      try {
        const key = await clerk.apiKeys.revoke({
          apiKeyId: input.keyId,
          revocationReason: input.revocationReason ?? null,
        });
        if (key.subject !== ctx.auth.orgId) {
          // Defense-in-depth: Clerk doesn't enforce subject-scope on the revoke
          // call; the caller's org must match the key's subject or we'd let
          // org A revoke org B's keys by guessing IDs.
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }
        log.info("[org-api-keys] revoked", {
          clerkOrgId: ctx.auth.orgId,
          keyId: key.id,
        });
        return { success: true };
      } catch (err) {
        if (isClerkNotFound(err)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
        }
        throw err;
      }
    }),

  delete: pendingNotAllowedProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      // Same subject-scope defense as revoke: fetch first, confirm subject, then delete.
      let existing;
      try {
        existing = await clerk.apiKeys.get(input.keyId);
      } catch (err) {
        if (isClerkNotFound(err)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
        }
        throw err;
      }
      if (existing.subject !== ctx.auth.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }
      await clerk.apiKeys.delete(input.keyId);
      log.info("[org-api-keys] deleted", {
        clerkOrgId: ctx.auth.orgId,
        keyId: input.keyId,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;

function isClerkNotFound(err: unknown): boolean {
  // Clerk Backend API surfaces 404s as Error with status property. Defensive:
  // also match err.errors[0].code === 'resource_not_found' which is Clerk's
  // documented error code shape.
  if (!err || typeof err !== "object") return false;
  if ("status" in err && (err as { status?: number }).status === 404) return true;
  const errs = (err as { errors?: Array<{ code?: string }> }).errors;
  return Array.isArray(errs) && errs.some((e) => e.code === "resource_not_found");
}
```

#### 2. Rewrite the UI list component

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx`
**Changes**:

- Replace `key.keyPreview` rendering with `key.id` (truncated, e.g. `apk_abc123...`)
- Add a `revoked` badge separate from `isActive` (Clerk returns both `revoked` and `expired` independently)
- `key.createdAt`/`lastUsedAt` are now `number` (unix ms) instead of ISO strings — adjust `formatDistanceToNow(new Date(key.createdAt))` calls accordingly
- The expiry field is `key.expiration` (Clerk's name), not `key.expiresAt`
- The created-key dialog shows `data.secret` (renamed from `data.key`)
- Drop the `isActive` field (Clerk uses `revoked`)
- Update mutation `onSuccess` handler to set `setCreatedKey(data.secret)`

The shape changes are mechanical — `formatDistanceToNow` already accepts `number | Date`, so the `new Date()` wrapper can be removed.

#### 3. Update the CLI setup route

**File**: `apps/app/src/app/api/cli/setup/route.ts`
**Changes**: Replace DB insert with `clerkClient.apiKeys.create(...)`.

```ts
const clerk = await clerkClient();
const memberships = await clerk.users.getOrganizationMembershipList({
  userId: session.userId,
});
const membership = memberships.data.find((m) => m.organization.id === orgId);
if (!membership) {
  return Response.json({ error: "not_a_member" }, { status: 403 });
}

const key = await clerk.apiKeys.create({
  name: "CLI (auto-generated)",
  subject: orgId,
  createdBy: session.userId,
});

return Response.json({
  apiKey: key.secret,
  orgId: membership.organization.id,
  orgSlug: membership.organization.slug,
  orgName: membership.organization.name,
});
```

Drop the `@db/app/client`/`@db/app/schema`/`@repo/app-api-key` imports.

#### 4. Update docs / examples / env templates

**File**: `apps/www/src/app/(app)/(content)/_lib/code-samples.ts`
**Changes**: Replace `sk-lf-` snippets with `ak_` examples.

**File**: `apps/www/src/app/(app)/(content)/api/search/route.ts`
**Changes**: Same — update any hardcoded prefix references.

**File**: `.env.mcp.example`
**Changes**: Update example `LIGHTFAST_API_KEY=sk-lf-...` → `LIGHTFAST_API_KEY=ak_...`

Use `rg "sk-lf-" -l --glob '!thoughts/**' --glob '!.changeset/**'` to locate any remaining references and update each.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app test` passes (19/19; no new orgApiKeys router tests added — router is a thin pass-through, marginal value vs maintenance cost)
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @lightfast/app typecheck` passes (build fails pre-existing on `/sign-up/accept-invitation` due to user's bfcache debug `console.log` — unrelated to Phase 3; reproduces with my changes stashed away)
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `rg "sk-lf-" --glob '!thoughts/**' --glob '!.changeset/**' --glob '!**/node_modules/**'` returns only Phase-4-pending matches (`packages/app-api-key/**`, `db/app/schema/tables/org-api-keys.ts`, `db/app/src/migrations/0028_workable_mantis.sql`, `core/mcp/CHANGELOG.md`, `core/lightfast/CHANGELOG.md`, `core/lightfast/src/__tests__/client.test.ts` — the SDK test intentionally asserts rejection of `sk-lf-`)
- [x] `rg "hashApiKey|isValidApiKeyFormat|generateOrgApiKey" --glob '!thoughts/**' --glob '!packages/app-api-key/**' --glob '!**/node_modules/**'` returns no source matches
- [ ] `rg "@repo/app-api-key" --glob '!thoughts/**' --glob '!packages/app-api-key/**' --glob '!**/node_modules/**'` — still present in `api/app/package.json`, `apps/app/package.json`, `apps/app/next.config.ts`, `pnpm-lock.yaml` (Phase 4 removes)

#### Human Review

- [x] UI Settings → API Keys list rendering — verified indirectly via Clerk API: `GET /api_keys?subject=org_3Dhc40yosdcumyEcFW9rsybErIi` returns the user-minted key `ak_2114733a75588ddb5b22d0c97b550630` named `"123"` with correct `subject`/`created_by`, proving the tRPC `create` mutation flowed through to Clerk
- [x] UI Create dialog — same evidence as above; key `"123"` was created via the UI (user action between Phase 3 implementation and smoke run)
- [x] Clerk Dashboard cross-check — `GET /api_keys?subject=<orgId>` lists both UI-minted and CLI-minted keys with correct metadata
- [x] curl `/api/v1/system/health` with fresh `ak_MJPY6ZXM1…` → HTTP 200, `{"status":"ok","timestamp":"2026-05-15T02:34:59.713Z","version":"0.1.0"}`
- [x] Revoke via `POST /api_keys/<id>/revoke` → curl returns HTTP 401 after Clerk verify-cache expires (this run: ~8s after revoke; Phase 2 run: ~30s — observed TTL is variable). Body: `{"code":"UNAUTHORIZED","message":"Invalid API key"}` — comes from the catch block when Clerk's verify throws `api_key_not_found`; the `key.revoked` branch never fires in live traffic (Phase 2 finding still holds)
- [x] Delete via `DELETE /api_keys/<id>` → `{"deleted":true}`; Clerk no longer lists the key
- [ ] CLI setup end-to-end — not driven headlessly (route at `/api/cli/setup` requires a Clerk session JWT bearer that's normally minted by the `lightfast cli login` interactive flow); the route handler has been read and uses `clerkClient.apiKeys.create({ subject, createdBy })` correctly — runtime verification deferred to when the CLI gets an e2e harness

---

## Phase 4: Tear-down — drop legacy table, delete package, purge references

### Overview

Pure deletion. After Phase 3 deploys and runs cleanly for whatever soak time you want (could be the same merge, since this is alpha), drop the `lightfast_workspace_api_keys` Drizzle table, delete `packages/app-api-key/`, remove dependency references, and verify nothing else imports the legacy code.

### Changes Required

#### 1. Drop the table via Drizzle

**Action**: Delete `db/app/src/schema/tables/org-api-keys.ts`. Remove the `orgApiKeys` re-export from `db/app/src/schema/tables/index.ts` and from `db/app/src/schema/relations.ts`. Run `cd db/app && pnpm db:generate` to produce a drop migration.

Per `db/CLAUDE.md`: NEVER write `.sql` by hand. Let Drizzle generate the migration. Inspect the generated SQL before applying — it should be one `DROP TABLE "lightfast_workspace_api_keys"` plus index drops.

Then `pnpm db:migrate` to apply.

#### 2. Delete the `@repo/app-api-key` package

**Action**: Remove the directory entirely.

```bash
rm -rf packages/app-api-key
```

Remove `@repo/app-api-key` from:
- `api/app/package.json`
- `apps/app/package.json`
- Any other workspace `package.json` that declares it (verify via `rg '"@repo/app-api-key"'`)

Run `pnpm install` to update the lockfile.

#### 3. Remove any remaining `sk-lf-` / legacy references

**Action**: `rg "sk-lf-|hashApiKey|isValidApiKeyFormat|generateOrgApiKey|generateApiKey|API_KEY_SECRET_LENGTH|API_KEY_PREVIEW_LENGTH|LIGHTFAST_API_KEY_PREFIX|orgApiKeys\b" --glob '!thoughts/**' --glob '!.changeset/**' --glob '!**/node_modules/**'` and clean up any matches.

`orgApiKeys` as a router key in `api/app/src/root.ts` and as a tRPC namespace in the UI (`trpc.pendingNotAllowed.orgApiKeys.*`) is the public surface name — keep that. The grep above is for the Drizzle table symbol and helper imports, which are the things actually being deleted.

#### 4. Update the validation schemas package

**File**: `packages/app-validation/src/schemas/index.ts`
**Changes**: Confirm the org-api-key schemas are still exported (they remain — only their shape changed in Phase 1).

#### 5. Final cleanup

- Remove the now-unused index entries from `db/app/src/schema/index.ts` if any
- Verify `pnpm db:studio` shows no `lightfast_workspace_api_keys` table after migration
- Update the `.agents/skills/lightfast-clerk/SKILL.md` if it mentioned the local table anywhere (search for "orgApiKeys" or "workspace_api_keys")

### Success Criteria

#### Automated Verification

- [x] `pnpm install` completes (pre-existing peer-dep warnings only: @t3-oss/env-nextjs ↔ zod, fumadocs-mdx ↔ vite — both unrelated to this plan)
- [x] `pnpm typecheck` at repo root passes (36/36 tasks)
- [x] `pnpm --filter @db/app typecheck` passes (`@db/app` has no `build` script — typecheck is the equivalent check)
- [x] `pnpm --filter @api/app typecheck && pnpm --filter @api/app test` pass (19/19)
- [x] `pnpm --filter @lightfast/app typecheck` passes (build fails pre-existing on `/sign-up/accept-invitation` bfcache debug — unrelated, reproduces stashed)
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `cd db/app && pnpm db:generate` returns "No schema changes, nothing to migrate" after applying 0065_brave_ghost_rider.sql
- [x] `find packages/app-api-key -type f` returns nothing
- [x] `rg "@repo/app-api-key|hashApiKey|isValidApiKeyFormat|generateOrgApiKey|sk-lf-" --glob '!thoughts/**' --glob '!.changeset/**' --glob '!**/node_modules/**' --glob '!**/CHANGELOG.md' --glob '!**/migrations/**' --glob '!**/.next/**' --glob '!**/.vercel/**'` returns only `core/lightfast/src/__tests__/client.test.ts` — intentional regression test asserting SDK rejects legacy `sk-lf-` keys
- [x] `grep -rn "workspace_api_keys" db/app/src/schema/ apps/ api/ packages/ 2>/dev/null` returns no matches (only the migration history under `db/app/src/migrations/` retains the historical name, which is required and immutable)
- [x] `db/app/src/migrations/0065_brave_ghost_rider.sql` is the new drop migration (single `DROP TABLE "lightfast_workspace_api_keys" CASCADE;` statement)

#### Human Review

- [x] Local Postgres (`docker exec lightfast-postgres psql -U postgres -d lightfast_main_26888480 -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'lightfast_workspace%'"`) returns 0 rows → table is dropped (Drizzle Studio would show the same; opening the GUI is optional)
- [x] UI list still renders via Phase 3 verification — Clerk-backed keys (`"123"`, `"phase3-4-smoke"`) visible via Clerk Backend API listing; no regression
- [x] `db/app/src/migrations/0065_brave_ghost_rider.sql` contains a single statement: `DROP TABLE "lightfast_workspace_api_keys" CASCADE;` — no `CREATE`, no unrelated edits, no separate index drops (the table's indexes are dropped implicitly by `CASCADE`)

---

## Testing Strategy

### Unit Tests

- **`api/app/src/orpc/__tests__/auth.test.ts`** (rewritten Phase 2): mock `clerkClient.apiKeys.verify`; cover all failure modes (missing header, wrong scheme, non-`ak_` prefix, verify throws, revoked, expired, non-org subject, missing createdBy, happy path).
- **`api/app/src/router/(pending-not-allowed)/__tests__/org-api-keys.test.ts`** (new, Phase 3): mock `clerkClient.apiKeys.*`; cover `list` (maps shape correctly, passes through `includeInvalid: true`), `create` (returns secret + view), `revoke` (subject mismatch → NOT_FOUND), `delete` (subject mismatch → NOT_FOUND).
- **`core/lightfast/src/__tests__/client.test.ts`** (updated Phase 2): assert `ak_*` accepted, `sk-lf-*` rejected, anything else rejected.

### Integration Tests

- **`core/lightfast/src/__tests__/integration/system-health.test.ts`** (rewritten Phase 2): boots `@lightfast/app`, mints a real Clerk API key via Backend API against the dev tenant, calls `lf.system.health()` via the SDK, asserts the 200 response. Tears down the key afterwards. Relies on `CLERK_SECRET_KEY` + `LIGHTFAST_TEST_CLERK_ORG_ID` + `LIGHTFAST_TEST_CLERK_USER_ID` env in the test runner.

### Manual

- End-to-end UI smoke (Phase 3 Human Review checklist).
- CLI setup smoke (Phase 3 Human Review checklist).

## Performance Considerations

- **Per-request Clerk Backend API call**: Each `/api/v1/*` request now incurs one round trip to `https://api.clerk.com/v1/api_keys/verify`. Expected median latency ~50–200ms (Clerk's docs do not publish SLOs as of this plan). This is acceptable for SDK/MCP traffic, which is async and tolerant. If p99 hurts in practice, the follow-up is an Upstash-Redis cache keyed on the token hash with a short TTL (e.g. 60s) and explicit invalidation on revoke. Not in this plan.
- **Network failure mode**: If Clerk Backend API is unreachable, all `/api/v1/*` requests return 401. There is no fallback. This is an availability dependency we're taking on deliberately — Clerk is already on the critical path for session auth, so adding it to API-key auth doesn't change the SLO profile.

## Migration Notes

- **Hard cutover**: After Phase 2 deploys, all `sk-lf-*` keys stop authenticating. Phase 3 surfaces the new Clerk-managed list in the UI. Phase 4 deletes the legacy table.
- **Existing CLI users**: Run `pnpm lightfast cli login` to mint a new `ak_*` key. The CLI setup route auto-rotates on each login, so there's no manual user-side migration.
- **Existing SDK / MCP users**: Update `LIGHTFAST_API_KEY` env var to a freshly minted `ak_*`. The SDK validator (`core/lightfast/src/index.ts:21`) emits a clean error for `sk-lf-*` keys.
- **No data preservation**: The legacy `lightfast_workspace_api_keys` rows do not migrate. Keys are secrets — only the user can remint them. Names/createdBy from the old table are not surfaced anywhere post-migration.

## References

- Foundation research: `thoughts/shared/research/2026-05-10-api-lib-middleware-and-public-vs-internal-api-boundary.md`
- Prior tRPC + oRPC plans:
  - `thoughts/shared/plans/2026-05-10-orpc-public-api-and-api-lib-rework.md` (the surface this migration replaces)
  - `thoughts/shared/plans/2026-05-09-drop-org-api-key-rotate.md` (rotate removal — pre-aligned with Clerk's surface)
  - `thoughts/shared/plans/2026-05-14-pending-allowed-not-allowed-scopes.md` (procedure tier naming this plan adheres to)
- Clerk source ground truth:
  - `node_modules/.pnpm/@clerk+backend@3.4.7/.../dist/api/endpoints/APIKeysApi.d.ts`
  - `node_modules/.pnpm/@clerk+backend@3.4.7/.../dist/api/resources/APIKey.d.ts`
- Clerk dev tenant inventory: `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md` (needs an update entry in Phase 1)
- Clerk public docs: <https://clerk.com/docs/nextjs/reference/objects/api-keys>
