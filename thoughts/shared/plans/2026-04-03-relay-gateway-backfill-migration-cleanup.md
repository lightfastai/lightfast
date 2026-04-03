# relay/gateway/backfill Migration Cleanup Implementation Plan

## Overview

Fix one live OAuth routing bug and clean up all remaining stale references left over from the consolidation of apps/relay, apps/backfill, and apps/gateway into apps/platform.

## Current State Analysis

The migration is largely complete. One live bug remains: the Linear and Vercel OAuth provider implementations still construct callback URLs using the old Hono gateway path structure (`/gateway/<provider>/callback`), which does not match the route the platform app actually serves (`/api/connect/<provider>/callback`). This causes OAuth flows for Linear and Vercel to 404.

The remainder of the work is cosmetic (stale comments and a dead local env var) with no functional impact.

### Key Discoveries

- `callbackBaseUrl` is resolved dynamically from `VERCEL_PROJECT_PRODUCTION_URL` in `api/platform/src/lib/provider-configs.ts:21-35` — domain is handled automatically, only the path suffix is wrong
- Platform production domain is now `lightfast-platform.vercel.app` (not `platform.lightfast.ai`, which has been removed)
- Linear has the stale path in two places: `buildAuthUrl` (line 416) and `processCallback` (line 481) — both must match
- Vercel has it in one place: `processCallback` (line 342) — `buildAuthUrl` for Vercel does not embed `callbackBaseUrl` (uses pre-configured integration dashboard URL instead)
- GitHub: no issue — uses `app-token` auth kind, never constructs callback URLs
- Sentry: no issue — `_redirectUri` param is accepted but unused

## Desired End State

All three OAuth callback URLs match the actual platform route. Stale service references in comments are updated to reflect the current single-service architecture. The dead `GATEWAY_API_KEY` and `NEXT_PUBLIC_API_URL` env vars are removed.

### Verification

- Linear OAuth connect flow succeeds end-to-end (authorize → callback → token stored)
- Vercel OAuth connect flow succeeds end-to-end
- No `/gateway/linear/callback` or `/gateway/vercel/callback` strings remain in provider packages
- No `GATEWAY_API_KEY` in local dev env file

## What We're NOT Doing

- Renaming `gateway_*` database tables — these are live table names requiring a DB migration
- Touching `backfill` as a feature domain (`BackfillDef`, etc.) — live platform feature
- Touching `/api/gateway/stream` and `/api/gateway/realtime` in `apps/app` — Upstash SSE proxy routes, unrelated to old gateway service
- Touching `@ai-sdk/gateway` — external Vercel AI SDK package
- Touching "Ported from apps/gateway/..." provenance comments — intentional attribution

## Implementation Approach

Fix the live bug first (Phase 1). Update developer consoles before or alongside deploying the code change, since OAuth won't work until both sides agree. Clean up cosmetics after (Phases 2–3).

---

## Phase 1: Fix OAuth Callback URL Mismatch

### Overview

Update the 3 stale path strings in the Linear and Vercel provider implementations. Then update the registered redirect URIs in both developer consoles to match the new domain and path.

### Changes Required

#### 1. Linear Provider

**File**: `packages/app-providers/src/providers/linear/index.ts`

Two occurrences of `/gateway/linear/callback` → `/api/connect/linear/callback`:

```typescript
// Line 416 — inside buildAuthUrl
// OLD:
`${config.callbackBaseUrl}/gateway/linear/callback`
// NEW:
`${config.callbackBaseUrl}/api/connect/linear/callback`

// Line 481 — inside processCallback
// OLD:
const redirectUri = `${config.callbackBaseUrl}/gateway/linear/callback`;
// NEW:
const redirectUri = `${config.callbackBaseUrl}/api/connect/linear/callback`;
```

#### 2. Vercel Provider

**File**: `packages/app-providers/src/providers/vercel/index.ts`

One occurrence of `/gateway/vercel/callback` → `/api/connect/vercel/callback`:

```typescript
// Line 342 — inside processCallback
// OLD:
const redirectUri = `${config.callbackBaseUrl}/gateway/vercel/callback`;
// NEW:
const redirectUri = `${config.callbackBaseUrl}/api/connect/vercel/callback`;
```

#### 3. Developer Console Redirect URI Updates

**Linear developer console** — update the registered OAuth callback URL:
- Old: `https://platform.lightfast.ai/gateway/linear/callback`
- New: `https://lightfast-platform.vercel.app/api/connect/linear/callback`

**Vercel integration dashboard** — update the registered OAuth callback URL:
- Old: `https://platform.lightfast.ai/gateway/vercel/callback`
- New: `https://lightfast-platform.vercel.app/api/connect/vercel/callback`

> **Deployment note**: The developer console update and code deploy must happen together. Deploy the code first (it can't break anything new — OAuth is already broken), then update the consoles. Do not update the consoles before deploying or the old code will still reconstruct the wrong path.

### Success Criteria

#### Automated Verification

- [x] No remaining `/gateway/linear/callback` or `/gateway/vercel/callback` strings in packages: `grep -r "gateway/linear/callback\|gateway/vercel/callback" packages/`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check` (3 pre-existing failures in unrelated files)

#### Manual Verification

- [ ] Linear OAuth connect flow completes successfully (user can connect a Linear workspace)
- [ ] Vercel OAuth connect flow completes successfully (user can install the Vercel integration)

**Implementation Note**: After automated verification passes, update the developer consoles and manually test both OAuth flows before proceeding to Phase 2.

---

## Phase 2: Remove Dead Env Vars

### Overview

Delete stale environment variable entries with no consumers.

### Changes Required

**File**: `apps/app/.vercel/.env.development.local`

Delete line 19:
```
GATEWAY_API_KEY="N942M46vbVIinQCunZIdIBKa8IvdwTDa15jzxGpkgs8"
```

**File**: `apps/app/turbo.json`

Remove `NEXT_PUBLIC_API_URL` from the `build.env` array. No Zod schema defines it, no source file reads it — confirmed dead. (Already done.)

### Success Criteria

#### Automated Verification

- [x] `NEXT_PUBLIC_API_URL` removed from turbo.json: `grep "NEXT_PUBLIC_API_URL" apps/app/turbo.json` returns no results
- [ ] `GATEWAY_API_KEY` removed from dev env file: `grep "GATEWAY_API_KEY" apps/app/.vercel/.env.development.local` returns no results

#### Manual Verification

- [ ] Dev server starts normally: `pnpm dev:app`

---

## Phase 3: Update Stale Comments

### Overview

Update comments across 6 files that still reference relay, gateway, and backfill as separate services. These have no functional impact but create confusion about the current architecture.

### Changes Required

#### 1. `packages/app-providers/src/contracts/backfill.ts`

**Lines 3–6** (JSDoc header):
```typescript
// OLD:
/**
 * Cross-service schemas for the Console → Relay → Backfill orchestration pipeline.
 * These define the wire formats between the console API, relay, and backfill services.
 */

// NEW:
/**
 * Cross-service schemas for the Console → Platform backfill orchestration pipeline.
 * These define the wire formats between the console API and the platform service.
 */
```

**Line 12** (inline comment):
```typescript
// OLD:
// ── Trigger payload (Console → Relay → Backfill) ──
// NEW:
// ── Trigger payload (Console → Platform backfill) ──
```

#### 2. `packages/app-providers/src/provider/webhook.ts`

Five references to relay middleware/relay-as-service — update to reference platform:

- **Line 9**: `WebhookDef, ProviderDefinition, and relay middleware are untouched.` → `WebhookDef, ProviderDefinition, and platform webhook handling are untouched.`
- **Line 48**: `HMAC returns synchronously; relay awaits all results uniformly.` → `HMAC returns synchronously; the platform webhook handler awaits all results uniformly.`
- **Lines 62–63**: `Keys are lowercase header names. Used by relay middleware for early rejection.` → `Keys are lowercase header names. Used by the platform webhook handler for early rejection.`
- **Line 68**: `Zod-first signature scheme — relay derives verifySignature from this automatically.` → `Zod-first signature scheme — the platform derives verifySignature from this automatically.`
- **Line 71**: `When absent, relay derives from signatureScheme via deriveVerifySignature().` → `When absent, the platform derives from signatureScheme via deriveVerifySignature().`

#### 3. `packages/app-providers/src/provider/shape.ts`

**Lines 112–115** (ManagedProvider JSDoc):
```typescript
// OLD:
 * Runtime wiring (DB migration for webhookSetupState, relay guard migration,
 * gateway managed-provider setup flow) is deferred until a concrete managed provider

// NEW:
 * Runtime wiring (DB migration for webhookSetupState, platform webhook guard,
 * platform managed-provider setup flow) is deferred until a concrete managed provider
```

**Line 248** (hasInboundWebhooks JSDoc):
```typescript
// OLD:
 * Used by relay middleware to gate webhook handling.
// NEW:
 * Used by the platform webhook handler to gate webhook handling.
```

#### 4. `packages/app-providers/src/provider/api.ts`

**Lines 68–69** (buildAuth JSDoc):
```typescript
// OLD:
 * When present, the gateway calls this instead of the default oauth.getActiveToken flow.
 * Receives the provider config (typed as unknown — gateway erases generics).
// NEW:
 * When present, the platform calls this instead of the default oauth.getActiveToken flow.
 * Receives the provider config (typed as unknown — platform erases generics).
```

**Line 97** (parseRateLimit JSDoc):
```typescript
// OLD:
 * This is an API-level concern — consumed by callers, never by gateway.
// NEW:
 * This is an API-level concern — consumed by callers, never by the platform proxy.
```

#### 5. `packages/app-providers/src/provider/resource-picker.ts`

**Lines 3–4** (JSDoc header):
```typescript
// OLD:
/** Callback signature for gateway proxy calls inside resourcePicker functions.
 *  The generic tRPC procedure binds the installationId and passes this to the provider. */
// NEW:
/** Callback signature for platform proxy calls inside resourcePicker functions.
 *  The generic tRPC procedure binds the installationId and passes this to the provider. */
```

#### 6. `.claude/commands/validate_plan.md`

**Line 29** — remove stale build script alternatives from the example comment:
```bash
# OLD:
pnpm build:console  # or build:relay, build:gateway, build:backfill, etc.
# NEW:
pnpm build:app  # or build:platform, build:www
```

#### 7. `db/app/src/schema/tables/index.ts`

**Line 1**:
```typescript
// OLD:
// Gateway-owned tables (gateway_*)
// NEW:
// Platform-owned tables (gateway_* prefix is historical)
```

### Success Criteria

#### Automated Verification

- [x] No remaining "relay middleware", "relay guard", "gateway managed-provider", "build:relay", "build:gateway", "build:backfill" strings in the changed files: `grep -r "relay middleware\|relay guard\|gateway managed-provider\|build:relay\|build:gateway\|build:backfill" packages/ .claude/commands/ db/`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check` (3 pre-existing failures in unrelated files)

---

## References

- Research audit: `thoughts/shared/research/2026-04-03-relay-backfill-gateway-to-platform-migration-audit.md`
- Live OAuth callback handler: `apps/platform/src/app/api/connect/[provider]/callback/route.ts`
- `callbackBaseUrl` resolution: `api/platform/src/lib/provider-configs.ts:21-35`
- Linear provider: `packages/app-providers/src/providers/linear/index.ts:416,481`
- Vercel provider: `packages/app-providers/src/providers/vercel/index.ts:342`
