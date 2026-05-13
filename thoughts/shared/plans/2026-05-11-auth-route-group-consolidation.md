# Auth Route Group Consolidation Implementation Plan

## Overview

Reorganize the auth-related surfaces in `apps/app` into three single-purpose route groups that match the codebase's existing conventions:

1. **`(auth)/`** stays exactly as it is — sign-in/sign-up UI surfaces (untouched).
2. **`(auth-api)/`** is new — a single-purpose API group (matching `(trpc)`, `(inngest)`, `(health)`) that owns the OAuth-style PKCE endpoints `/api/auth/code` and `/api/auth/token`, plus a `_server/` folder for their shared Node-only helpers.
3. **`(client-handshake)/`** is new — a top-level group for the `/cli/auth` and `/desktop/auth` completion pages, with a minimal centered layout.

This plan deletes two folders that become empty after the moves: `apps/app/src/app/api/desktop/` (whole tree) and `apps/app/src/app/(app)/(user)/(pending-not-allowed)/` (whole group). CLI routes stay flat at `apps/app/src/app/api/cli/*` because the CLI binary is in the wild — renaming its URLs is a separate, coordinated release that belongs in a follow-on plan.

URL changes are scoped to the unreleased desktop binary:
- `/api/desktop/auth/code` → `/api/auth/code`
- `/api/desktop/auth/exchange` → `/api/auth/token`

The names `code` and `token` match OAuth 2.0 endpoint naming (RFC 6749 §3.2, §4.1.3) — anyone reading the URL knows what it does. The `/api/auth/*` prefix drops client-typing entirely, so future clients (mobile, IDE plugin) reuse the same surface.

This plan only reorganizes — it does not change auth behavior. The follow-on implementation that wires the full CLI + desktop flows (and that may eventually rename CLI URLs) happens in a separate plan.

## Current State Analysis

Today `apps/app/src/app/` contains three auth-adjacent surfaces in three separate locations:

```
apps/app/src/app/
├── api/
│   ├── cli/
│   │   ├── lib/verify-jwt.ts                       (exports verifyCliJwt — also used by desktop)
│   │   ├── login/route.ts                          POST /api/cli/login
│   │   └── setup/route.ts                          POST /api/cli/setup
│   └── desktop/auth/
│       ├── lib/code-store.ts                       (Upstash Redis 30s TTL store)
│       ├── code/route.ts                           POST /api/desktop/auth/code
│       ├── code/route.test.ts
│       ├── exchange/route.ts                       POST /api/desktop/auth/exchange
│       └── exchange/route.test.ts
├── (auth)/
│   ├── layout.tsx                                  (logo + "Early Access" CTA)
│   ├── error.tsx
│   ├── sign-in/page.tsx + sso-callback/page.tsx
│   ├── sign-up/page.tsx + sso-callback/page.tsx
│   ├── _actions/sign-{in,up}.ts (+ sign-up.test.ts)
│   ├── _components/{email-form,error-banner,oauth-button,otp-island,
│   │                separator-with-text,session-activator}.tsx +
│   │                shared/code-verification-ui.tsx
│   └── _lib/search-params.ts (+ search-params.test.ts)
└── (app)/(user)/(pending-not-allowed)/
    ├── _components/client-auth-bridge.{tsx,test.tsx}
    ├── cli/auth/page.tsx + _components/cli-auth-client.tsx       → /cli/auth
    └── desktop/auth/page.tsx + _components/desktop-auth-client.tsx → /desktop/auth
```

### Key Discoveries

**Helper coupling:**
- `apps/app/src/app/api/desktop/auth/code/route.ts:4` imports `verifyCliJwt` from `../../../cli/lib/verify-jwt` — a cross-tree relative import. The JWT verifier is shared between CLI and desktop, but its name and folder placement claim CLI-only ownership.
- `apps/app/src/app/api/cli/lib/verify-jwt.ts:5` exports `verifyCliJwt(req): Promise<{ userId, jwt } | null>` — pure server-only helper using `verifyToken` from `@clerk/nextjs/server`. No CLI-specific behavior in the body.
- `apps/app/src/app/api/desktop/auth/lib/code-store.ts` — Upstash Redis one-shot store with 30s TTL using `redis.getdel`. Used only by `desktop/auth/{code,exchange}/route.ts`.

**Convention check against current `_lib/`:**
- Every `_lib/` directory under `apps/app/src/app/` today contains *only* `nuqs/server` typed search-param helpers (3 instances). Zero `_lib/` files import `@clerk/nextjs/server` or `@vendor/upstash`. The new server-only helpers must NOT live in `(auth)/_lib/` — they belong in a `_server/` folder that signals "Node-only, do not import from client."

**Convention check against existing API route groups:**
- Every route group in `apps/app` is single-purpose: `(auth)` (UI only), `(trpc)`, `(inngest)`, `(health)`, `(api)` (each one `route.ts`, no layout). The new `(auth-api)/` follows this single-purpose API-only convention.

**External pinned references** (5 places):
- `apps/app/src/proxy.ts:41-42` — matcher `/api/cli/(.*)`, `/api/desktop/(.*)`. The new `/api/auth/(.*)` URL needs a new matcher; the existing `/api/desktop/(.*)` matcher can be removed.
- `apps/app/src/proxy.ts:61-62` — `isPendingAllowedRoute` includes `/cli/auth(.*)` and `/desktop/auth(.*)` (UI page URLs; unchanged by this plan).
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx:45` — `const CODE_ENDPOINT = "/api/desktop/auth/code"` (updated to `/api/auth/code`).
- `apps/desktop/src/main/auth-flow.ts:250` — `createAppUrl("/api/desktop/auth/exchange")` (updated to `/api/auth/token`).
- 4 test files with hardcoded request fixture URLs (updated).

**Group emptiness after moves:**
- `apps/app/src/app/api/desktop/` contains only the `/auth/` subtree. After the moves the entire `apps/app/src/app/api/desktop/` directory is empty and must be deleted.
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/` contains exactly two routes (`cli/auth/`, `desktop/auth/`) plus the shared `_components/`. After the moves the entire `(pending-not-allowed)/` group is empty and must be deleted (the earlier draft of this plan was wrong to suggest the group might contain other routes — it does not).

**Bridge consumers:**
- The `client-auth-bridge.tsx` component is imported by two clients via relative path: `cli-auth-client.tsx:3` and `desktop-auth-client.tsx:3` (both use `"../../../_components/client-auth-bridge"`). After Phase 2 all three files sit under `(client-handshake)/` and the imports become `"../../_components/client-auth-bridge"`.

**Layout inheritance:**
- The `(app)/(user)/layout.tsx` (the parent layout the bridge pages currently inherit) prefetches `trpc.account.get` and renders `<UserPageHeader />`. After Phase 2 the bridge pages move out of that tree to a top-level `(client-handshake)/`, inheriting only the root `app/layout.tsx`. The new `(client-handshake)/layout.tsx` is minimal (centered main only). This is correct: handshake screens are transient and self-contained.

**Route group URL invisibility:**
- Next.js route groups (`(name)`) are URL-invisible — moving folders between groups does not change URLs. The only URL changes in this plan are deliberate: trimming `/api/desktop/auth/{code,exchange}` → `/api/auth/{code,token}`.

## Desired End State

```
apps/app/src/app/
├── (auth)/                                         UNCHANGED
│   ├── layout.tsx
│   ├── error.tsx
│   ├── sign-in/page.tsx + sso-callback/page.tsx
│   ├── sign-up/page.tsx + sso-callback/page.tsx
│   ├── _actions/sign-{in,up}.ts (+ sign-up.test.ts)
│   ├── _components/...
│   └── _lib/search-params.{ts,test.ts}
├── (auth-api)/                                     NEW
│   ├── _server/
│   │   ├── verify-bearer-jwt.ts                    ← from api/cli/lib/verify-jwt.ts (renamed)
│   │   └── code-store.ts                           ← from api/desktop/auth/lib/code-store.ts
│   └── api/
│       └── auth/
│           ├── code/route.ts                       POST /api/auth/code   (was /api/desktop/auth/code)
│           ├── code/route.test.ts
│           ├── token/route.ts                      POST /api/auth/token  (was /api/desktop/auth/exchange)
│           └── token/route.test.ts
├── (client-handshake)/                             NEW
│   ├── layout.tsx                                  (new — minimal centered main)
│   ├── cli/auth/page.tsx                           ← from (pending-not-allowed)/cli/auth/
│   ├── cli/auth/_components/cli-auth-client.tsx
│   ├── desktop/auth/page.tsx                       ← from (pending-not-allowed)/desktop/auth/
│   ├── desktop/auth/_components/desktop-auth-client.tsx
│   └── _components/
│       ├── client-auth-bridge.tsx                  ← from (pending-not-allowed)/_components/
│       └── client-auth-bridge.test.tsx
└── api/
    └── cli/                                        UNCHANGED (CLI binary in the wild)
        ├── login/route.ts                          POST /api/cli/login
        └── setup/route.ts                          POST /api/cli/setup
```

After the plan:

1. `apps/app/src/app/api/desktop/` no longer exists. The desktop PKCE surface lives under `(auth-api)/api/auth/*` with OAuth-conventional URLs.
2. `apps/app/src/app/(app)/(user)/(pending-not-allowed)/` no longer exists. The handshake pages live under top-level `(client-handshake)/`.
3. The function `verifyCliJwt` is renamed to `verifyBearerJwt` and lives at `(auth-api)/_server/verify-bearer-jwt.ts`. CLI routes import it via absolute `~/app/(auth-api)/_server/verify-bearer-jwt`.
4. The `code-store.ts` helper moves to `(auth-api)/_server/code-store.ts`.
5. Two desktop URLs are renamed: `/api/desktop/auth/code` → `/api/auth/code` and `/api/desktop/auth/exchange` → `/api/auth/token`.
6. CLI URLs and route locations are unchanged.
7. `(auth)/` UI tree (sign-in/sign-up) is unchanged.
8. `proxy.ts` matchers updated: add `/api/auth/(.*)`, remove `/api/desktop/(.*)`.

### Verification

- `pnpm --filter @lightfast/app typecheck` passes.
- `pnpm --filter @lightfast/app test` passes (all moved test files run from their new locations).
- `pnpm --filter @lightfast/desktop typecheck && pnpm --filter @lightfast/desktop test` pass (auth-flow.test.ts updated to new URL).
- `pnpm build:app` passes.
- The following greps return zero hits in `apps/`, `packages/`, `api/`:
  - `grep -rn "verifyCliJwt" --include="*.ts" --include="*.tsx"`
  - `grep -rn "/api/cli/lib" --include="*.ts" --include="*.tsx"`
  - `grep -rn "/api/desktop" --include="*.ts" --include="*.tsx"`
  - `grep -rn "(pending-not-allowed)" --include="*.ts" --include="*.tsx"`
- `find apps/app/src/app/api/desktop -type f 2>/dev/null` returns nothing.
- `find apps/app/src/app/\(app\)/\(user\)/\(pending-not-allowed\) -type f 2>/dev/null` returns nothing.

## What We're NOT Doing

- Not changing any auth logic: PKCE flow, Bearer admission, code-store TTL, redirect URI allowlist, Clerk verification — all preserved byte-for-byte.
- Not renaming CLI URLs (`/api/cli/login`, `/api/cli/setup`) or relocating CLI routes. The CLI binary is in the wild; renaming requires a coordinated CLI release. That belongs in a follow-on plan.
- Not modifying `(auth)/` at all. Sign-in/sign-up surfaces stay exactly where they are. The earlier draft of this plan split `(auth)/` into `(public-auth)` and `(client-handshake)` sub-groups; that split is gone — sibling nested route-group layouts have no precedent in this codebase.
- Not implementing the full CLI + desktop flow wiring. That is the follow-on plan; this one only relocates files and renames desktop URLs.
- Not modifying `apps/app/src/cors.ts`, `apps/app/src/origins.ts`, or any middleware admission logic beyond updating the route matcher.
- Not putting the new server-only helpers in `(auth)/_lib/` — that folder is by convention `nuqs/server` search-param helpers only. The helpers live in `(auth-api)/_server/`.
- Not introducing a new layout for the API routes (route handlers ignore layouts; they receive a request, return a response).
- Not extracting `verify-bearer-jwt` or `code-store` into a shared `@vendor/*` package. Two consumers each at the same path depth is cheaper than the abstraction.

## Implementation Approach

Three phases — one isolation setup, two implementation:

0. **Worktree setup** — create an isolated git worktree on a new `refactor/` branch so this reorganization does not touch `main`. All subsequent phases run in the worktree.
1. **API consolidation + URL rename** — create `(auth-api)/_server/` with the renamed/moved helpers, create `(auth-api)/api/auth/{code,token}/` with the moved+renamed desktop routes, update CLI routes' imports of the renamed helper, update all production callers and test fixtures, update `proxy.ts` matcher, delete the empty `api/desktop/` tree and the empty `api/cli/lib/` folder.
2. **UI relocation** — create top-level `(client-handshake)/` with a minimal layout, move the two handshake pages and the shared bridge into it, update relative imports inside moved files, delete the now-empty `(pending-not-allowed)/` group.

Phases 1 and 2 are mechanically independent of each other; both run inside the Phase 0 worktree.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Worktree setup [DONE]

### Overview

Create a secondary git worktree on a new `refactor/auth-route-group-consolidation` branch so the reorganization is isolated from `main` and from any other in-flight worktree. All file moves, edits, and validation in Phases 1 and 2 happen inside this worktree. The portless dev system auto-derives a worktree-prefixed URL (e.g., `https://auth-route-group-consolidation.app.lightfast.localhost`) so the dev server in this worktree does not collide with any concurrent `pnpm dev:app` on `main` or another branch.

### Changes Required

#### 1. Create the worktree on a new branch

From the primary checkout at `/Users/jeevanpillay/Code/@lightfastai/lightfast`:

```bash
git fetch origin main
git worktree add ../lightfast-auth-route-consolidation -b refactor/auth-route-group-consolidation origin/main
cd ../lightfast-auth-route-consolidation
```

Branch naming follows the established `refactor/` prefix convention (see recent commits `refactor/delete-app-lib-clerk-dead-code`, `refactor/api-platform-app-cleanup`). This is a refactor, not a desktop release, so `refactor/` is the right prefix.

#### 2. Install dependencies in the worktree

Worktrees share `.git/` but not `node_modules/` — each needs its own install:

```bash
pnpm install
```

#### 3. Verify the worktree-prefixed URL resolves

```bash
node scripts/with-desktop-env.mjs --print
```

Expected output: a URL containing the sanitized branch suffix, e.g. `https://auth-route-group-consolidation.app.lightfast.localhost`. This confirms portless will route the worktree's dev server to a non-colliding host.

#### 4. Confirm a clean starting state

```bash
git status                  # should show "nothing to commit, working tree clean"
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/app test
pnpm build:app
```

All four must pass before starting Phase 1. If they don't pass on a clean `origin/main` checkout, stop and investigate — Phase 1's "passes" criteria depend on a green baseline.

### Success Criteria

#### Automated Verification

- [x] `git worktree list` includes `../lightfast-auth-route-consolidation` on branch `refactor/auth-route-group-consolidation`
- [x] `cd ../lightfast-auth-route-consolidation && git status` reports a clean working tree
- [x] `node scripts/with-desktop-env.mjs --print` outputs a worktree-prefixed URL (not `https://lightfast.ai`)
- [x] `pnpm --filter @lightfast/app typecheck` passes on the baseline
- [x] `pnpm --filter @lightfast/app test` passes on the baseline
- [x] `pnpm build:app` passes on the baseline

#### Human Review

- [ ] Confirm the worktree path (`../lightfast-auth-route-consolidation`) does not conflict with an existing worktree — check `git worktree list` first.
- [ ] All subsequent phase commands run from inside this worktree, not the primary checkout.

---

## Phase 1: API consolidation + URL rename [DONE]

### Overview

Create `(auth-api)/` as a single-purpose API route group containing `_server/` helpers (server-only) and `api/auth/{code,token}/` routes (OAuth-conventional URLs). Update the 4 import sites for the renamed helper, 2 production caller URL strings, 4 test-fixture URL strings, and the `proxy.ts` API matcher. Delete the empty `api/desktop/` and `api/cli/lib/` folders.

### Changes Required

#### 1. Create `(auth-api)/_server/verify-bearer-jwt.ts`

**File**: `apps/app/src/app/(auth-api)/_server/verify-bearer-jwt.ts` (new)

Body byte-identical to `apps/app/src/app/api/cli/lib/verify-jwt.ts` except for the exported function name:

```ts
import { verifyToken } from "@clerk/nextjs/server";

import { env } from "~/env";

export async function verifyBearerJwt(
  req: Request,
): Promise<{ userId: string; jwt: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const jwt = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyToken(jwt, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    return { userId: payload.sub, jwt };
  } catch {
    return null;
  }
}
```

Delete the old file: `apps/app/src/app/api/cli/lib/verify-jwt.ts` (and the empty `api/cli/lib/` folder).

#### 2. Create `(auth-api)/_server/code-store.ts`

**File**: `apps/app/src/app/(auth-api)/_server/code-store.ts` (new)

Body byte-identical to `apps/app/src/app/api/desktop/auth/lib/code-store.ts`. No symbol renames.

Delete the old file: `apps/app/src/app/api/desktop/auth/lib/code-store.ts`.

#### 3. Create `(auth-api)/api/auth/code/route.ts` (moved + URL renamed)

**File**: `apps/app/src/app/(auth-api)/api/auth/code/route.ts` (new)

Body equivalent to `apps/app/src/app/api/desktop/auth/code/route.ts`, with:
- Comment header updated: `// POST /api/auth/code` (was `// POST /api/desktop/auth/code`)
- Imports updated to absolute paths:
  ```ts
  import { verifyBearerJwt } from "~/app/(auth-api)/_server/verify-bearer-jwt";
  import { issueCode } from "~/app/(auth-api)/_server/code-store";
  ```
- The call site uses `verifyBearerJwt(req)` instead of `verifyCliJwt(req)`.

Delete `apps/app/src/app/api/desktop/auth/code/route.ts`.

#### 4. Create `(auth-api)/api/auth/code/route.test.ts` (moved + fixtures updated)

**File**: `apps/app/src/app/(auth-api)/api/auth/code/route.test.ts` (new)

Body equivalent to `apps/app/src/app/api/desktop/auth/code/route.test.ts`, with:
- `vi.mock("../../../cli/lib/verify-jwt", ...)` → `vi.mock("~/app/(auth-api)/_server/verify-bearer-jwt", () => ({ verifyBearerJwt: ... }))`
- `vi.mock("../lib/code-store", ...)` → `vi.mock("~/app/(auth-api)/_server/code-store", ...)`
- `verifyCliJwtMock` renamed to `verifyBearerJwtMock` everywhere (lines 3, 38, 47-48, 58, 68, 80, 91, 100, 118, 122 in the original)
- URL fixtures updated:
  - Line 24: `"http://localhost/api/desktop/auth/code"` → `"http://localhost/api/auth/code"`
  - Line 36: `describe("POST /api/desktop/auth/code", ...)` → `describe("POST /api/auth/code", ...)`
  - Line 128: same URL string
- Descriptive strings updated: line 47 `"when verifyCliJwt returns null"` → `"when verifyBearerJwt returns null"`; line 118 `"verifyCliJwt authenticated"` → `"verifyBearerJwt authenticated"`

Delete `apps/app/src/app/api/desktop/auth/code/route.test.ts`.

#### 5. Create `(auth-api)/api/auth/token/route.ts` (moved + URL renamed)

**File**: `apps/app/src/app/(auth-api)/api/auth/token/route.ts` (new)

Body equivalent to `apps/app/src/app/api/desktop/auth/exchange/route.ts`, with:
- Comment header updated: `// POST /api/auth/token` (was `// POST /api/desktop/auth/exchange`)
- Any inline reference to `/api/desktop/auth/code` in comments updated to `/api/auth/code`
- Import updated to absolute path:
  ```ts
  import { consumeCode } from "~/app/(auth-api)/_server/code-store";
  ```

Delete `apps/app/src/app/api/desktop/auth/exchange/route.ts`.

#### 6. Create `(auth-api)/api/auth/token/route.test.ts` (moved + fixtures updated)

**File**: `apps/app/src/app/(auth-api)/api/auth/token/route.test.ts` (new)

Body equivalent to `apps/app/src/app/api/desktop/auth/exchange/route.test.ts`, with:
- `vi.mock("../lib/code-store", ...)` → `vi.mock("~/app/(auth-api)/_server/code-store", ...)`
- URL fixtures updated:
  - Line 17: `"http://localhost/api/desktop/auth/exchange"` → `"http://localhost/api/auth/token"`
  - Line 32: `describe("POST /api/desktop/auth/exchange", ...)` → `describe("POST /api/auth/token", ...)`

Delete `apps/app/src/app/api/desktop/auth/exchange/route.test.ts`.

#### 7. Update CLI route imports to use renamed helper

**File**: `apps/app/src/app/api/cli/login/route.ts:7`

```ts
// Before
import { verifyCliJwt } from "../lib/verify-jwt";
// ...
const session = await verifyCliJwt(req);

// After
import { verifyBearerJwt } from "~/app/(auth-api)/_server/verify-bearer-jwt";
// ...
const session = await verifyBearerJwt(req);
```

**File**: `apps/app/src/app/api/cli/setup/route.ts:11`

Same change pattern as above.

CLI route handler files do not move. They stay at `apps/app/src/app/api/cli/{login,setup}/route.ts`.

#### 8. Update production callers (2 files)

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx:45`

```ts
// Before
const CODE_ENDPOINT = "/api/desktop/auth/code";
// After
const CODE_ENDPOINT = "/api/auth/code";
```

Note: this file is still under `(pending-not-allowed)/_components/` after Phase 1. Phase 2 relocates it to `(client-handshake)/_components/`. Only the URL constant changes here.

**File**: `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.test.tsx`

- Line 294: `it("POSTs to /api/desktop/auth/code ..."` → `it("POSTs to /api/auth/code ...")`
- Line 322: `expect(url).toBe("/api/desktop/auth/code")` → `expect(url).toBe("/api/auth/code")`
- Line 369: `it("... when /api/desktop/auth/code returns 4xx", ...` → `it("... when /api/auth/code returns 4xx", ...)`

**File**: `apps/desktop/src/main/auth-flow.ts:250`

```ts
// Before
const response = await fetch(
  createAppUrl("/api/desktop/auth/exchange").toString(),
  { /* ... */ }
);

// After
const response = await fetch(
  createAppUrl("/api/auth/token").toString(),
  { /* ... */ }
);
```

**File**: `apps/desktop/src/main/__tests__/auth-flow.test.ts:261`

```ts
// Before
expect(exchUrl).toBe("http://localhost:3024/api/desktop/auth/exchange");
// After
expect(exchUrl).toBe("http://localhost:3024/api/auth/token");
```

#### 9. Update `proxy.ts` API matcher

**File**: `apps/app/src/proxy.ts` (around lines 41-42 in the `isApiRoute` matcher)

```ts
// Before
const isApiRoute = createRouteMatcher([
  "/api/cli/(.*)",
  "/api/desktop/(.*)",
  // ... other matchers
]);

// After
const isApiRoute = createRouteMatcher([
  "/api/cli/(.*)",
  "/api/auth/(.*)",
  // ... other matchers
]);
```

The change: remove `/api/desktop/(.*)`, add `/api/auth/(.*)`. Verify the surrounding matchers (tRPC, Inngest, health) are untouched. Read the actual file before editing to capture the exact line numbers and adjacent matchers.

The `isPendingAllowedRoute` matcher at proxy.ts:61-62 is unchanged — it matches the UI page URLs `/cli/auth(.*)` and `/desktop/auth(.*)` which Phase 2 does NOT rename.

#### 10. Delete empty folders

After all moves complete, these directories are empty and must be removed:

```bash
rm -rf apps/app/src/app/api/cli/lib
rm -rf apps/app/src/app/api/desktop
```

Verify before deletion:

```bash
find apps/app/src/app/api/cli/lib -type f       # should be empty
find apps/app/src/app/api/desktop -type f       # should be empty
```

The `apps/app/src/app/api/cli/` directory itself is NOT deleted — it still contains `login/route.ts` and `setup/route.ts`.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/app typecheck` passes.
- [x] `pnpm --filter @lightfast/app test` passes (both moved route tests run from `(auth-api)/api/auth/`).
- [x] `pnpm --filter @lightfast/desktop typecheck && pnpm --filter @lightfast/desktop test` pass.
- [x] `pnpm build:app` passes.
- [x] `test -f apps/app/src/app/\(auth-api\)/_server/verify-bearer-jwt.ts`
- [x] `test -f apps/app/src/app/\(auth-api\)/_server/code-store.ts`
- [x] `test -f apps/app/src/app/\(auth-api\)/api/auth/code/route.ts`
- [x] `test -f apps/app/src/app/\(auth-api\)/api/auth/token/route.ts`
- [x] `test ! -e apps/app/src/app/api/desktop` (directory deleted)
- [x] `test ! -e apps/app/src/app/api/cli/lib` (directory deleted)
- [x] `test -f apps/app/src/app/api/cli/login/route.ts` (CLI routes preserved)
- [x] `test -f apps/app/src/app/api/cli/setup/route.ts`
- [x] `grep -rn "verifyCliJwt" apps packages api --include="*.ts" --include="*.tsx"` returns zero hits
- [x] `grep -rn "/api/desktop" apps packages api --include="*.ts" --include="*.tsx"` returns zero hits
- [x] `grep -rn "cli/lib/verify-jwt\|desktop/auth/lib/code-store" apps --include="*.ts" --include="*.tsx"` returns zero hits
- [x] `grep -n "/api/auth\|/api/cli\|/api/desktop" apps/app/src/proxy.ts` shows the matcher includes `/api/auth/(.*)` and `/api/cli/(.*)` but not `/api/desktop/(.*)`

#### Human Review

- [x] Start `pnpm dev:app`, sign in as a test user, trigger the desktop auth flow (the `lightfast-clerk` skill can mint a Bearer token and the `lightfast-desktop-signin` skill drives the bridge). Verify in browser DevTools Network panel that the bridge POSTs to `/api/auth/code` (200) — not `/api/desktop/auth/code`. *Verified 2026-05-11 via agent harness: minted lightfast-desktop JWT for fresh user, `POST /api/auth/code` → 200 `{code:"…"}`, `POST /api/auth/token` with PKCE-correct verifier → 200 `{token:"…"}`, old `POST /api/desktop/auth/{code,exchange}` → 404 once past middleware.*
- [x] With a valid Bearer JWT in `$TOKEN`, run `curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' https://app.lightfast.localhost/api/cli/login` — verify a non-404 response (CLI URLs untouched). *Verified: `POST /api/cli/login` with Bearer → 200 `{organizations:[]}` (fresh user had no orgs).*

---

## Phase 2: UI relocation to `(client-handshake)/` [DONE]

### Overview

Create a top-level `(client-handshake)/` route group with a minimal layout. Move the two handshake pages, their `_components/` folders, and the shared `client-auth-bridge.{tsx,test.tsx}` out of `(pending-not-allowed)/` and into `(client-handshake)/`. Update the relative imports inside the moved client components (relative depth drops by one). Delete the now-empty `(pending-not-allowed)/` group entirely.

URLs are unchanged: `/cli/auth` and `/desktop/auth` keep their public paths (route groups are URL-invisible).

### Changes Required

#### 1. Create `(client-handshake)/layout.tsx`

**File**: `apps/app/src/app/(client-handshake)/layout.tsx` (new)

```tsx
import type React from "react";

export default function ClientHandshakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
```

No header, no logo, no CTA — handshake screens are transient and self-contained.

#### 2. Move the handshake pages and shared bridge

| From | To |
|---|---|
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/page.tsx` | `apps/app/src/app/(client-handshake)/cli/auth/page.tsx` |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx` | `apps/app/src/app/(client-handshake)/cli/auth/_components/cli-auth-client.tsx` |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/page.tsx` | `apps/app/src/app/(client-handshake)/desktop/auth/page.tsx` |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx` | `apps/app/src/app/(client-handshake)/desktop/auth/_components/desktop-auth-client.tsx` |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx` | `apps/app/src/app/(client-handshake)/_components/client-auth-bridge.tsx` |
| `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.test.tsx` | `apps/app/src/app/(client-handshake)/_components/client-auth-bridge.test.tsx` |

#### 3. Update relative imports inside moved client components

**No edits required.** Both `cli-auth-client.tsx` (under `cli/auth/_components/`) and `client-auth-bridge.tsx` (under `_components/`) moved by the same number of segments — from `(pending-not-allowed)/` to `(client-handshake)/` — so the relative path between them is unchanged at `../../../_components/client-auth-bridge`. The earlier draft of this plan claimed the depth dropped by one segment; that was wrong. (Verified during implementation: editing to `../../_components/...` broke `tsc` and `next build`; reverting to `../../../_components/...` restored both.)

The test file `client-auth-bridge.test.tsx` uses `await import("./client-auth-bridge")` (relative, same folder) — unaffected by the move.

#### 4. Delete the now-empty `(pending-not-allowed)/` group

After the moves, the entire `(pending-not-allowed)/` tree is empty (audit confirms it contained only the `cli/`, `desktop/`, and `_components/` subtrees moved above).

```bash
rm -rf apps/app/src/app/\(app\)/\(user\)/\(pending-not-allowed\)
```

Verify before deletion:

```bash
find apps/app/src/app/\(app\)/\(user\)/\(pending-not-allowed\) -type f
```

Must return empty. If it doesn't, stop and investigate before deletion.

#### 5. Verify `proxy.ts` matchers (no edits expected)

`apps/app/src/proxy.ts:61-62` lists `/cli/auth(.*)` and `/desktop/auth(.*)` in `isPendingAllowedRoute`. The UI page URLs are unchanged (route groups are URL-invisible), so these matchers still admit pending sessions to the moved pages.

```bash
grep -n "/cli/auth\|/desktop/auth" apps/app/src/proxy.ts
```

Expected: the existing two matcher lines, unchanged.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfast/app typecheck` passes.
- [x] `pnpm --filter @lightfast/app test` passes (client-auth-bridge.test.tsx runs from new location).
- [x] `pnpm build:app` passes.
- [x] `test -f apps/app/src/app/\(client-handshake\)/layout.tsx`
- [x] `test -f apps/app/src/app/\(client-handshake\)/cli/auth/page.tsx`
- [x] `test -f apps/app/src/app/\(client-handshake\)/desktop/auth/page.tsx`
- [x] `test -f apps/app/src/app/\(client-handshake\)/_components/client-auth-bridge.tsx`
- [x] `test ! -e apps/app/src/app/\(app\)/\(user\)/\(pending-not-allowed\)` (group deleted)
- [x] `grep -rn "(pending-not-allowed)" apps --include="*.ts" --include="*.tsx"` returns zero hits
- [x] `grep -rn "(pending-not-allowed)/_components/client-auth-bridge" apps --include="*.ts" --include="*.tsx"` returns zero hits

#### Human Review

- [x] Open `https://app.lightfast.localhost/sign-in` in a browser. Expected observation: logo top-left, "Join the Early Access" CTA top-right, centered email form below — same as before the plan ran. The `(auth)/layout.tsx` is untouched. *Verified 2026-05-11 via agent-browser snapshot: banner has logo link + "Join the Early Access" link; main has "Log in to Lightfast" heading and email form.*
- [x] Open `https://app.lightfast.localhost/sign-up`. Same chrome as sign-in. *Verified via curl SSR inspection: same chrome markers present.*
- [ ] Open `https://app.lightfast.localhost/cli/auth?port=8765&state=test-state-value` (signed in as a test user). Expected observation: a centered "Authenticating…" card on a plain background — no logo, no Early Access CTA, no UserPageHeader. The `(client-handshake)/layout.tsx` is rendering. The bridge then attempts a redirect to `http://localhost:8765/callback?...`. *Skipped — CLI login is scaffold only; verifying CLI flow belongs in the CLI implementation plan.*
- [x] Open `https://app.lightfast.localhost/desktop/auth?state=test&code_challenge=<sha256-b64url>&code_challenge_method=S256&redirect_uri=lightfast-dev://auth/callback` (signed in). Expected observation: same minimal chrome; bridge POSTs to `/api/auth/code` (200 with `{code}`) and then redirects to `lightfast-dev://auth/callback?code=…&state=…`. *Verified 2026-05-11 with active-session test user via agent-browser: rendered DOM = `<main class="w-full max-w-md">` (the new `(client-handshake)/layout.tsx`), no banner/CTA/UserPageHeader; bridge POSTed `/api/auth/code` → `200` (per dev server log) and transitioned to "Opening Lightfast…" (redirect step).*
- [x] On a pending session (signed in but no org selected), navigate to `/cli/auth?...` and `/desktop/auth?...` — expected: middleware does NOT bounce to `/account/welcome` (the `isPendingAllowedRoute` matcher still covers these URLs). *Verified for `/desktop/auth` 2026-05-11: pending session (`window.Clerk.session.status === "pending"`, `tasks: [{key: "choose-organization"}]`) stayed at `/desktop/auth` — middleware admission worked. Bridge itself shows "Authentication Failed" for pending users because `useAuth().isSignedIn` is false (Clerk default `treatPendingAsSignedOut: true`) — pre-existing behavior, unchanged by this refactor.*

---

## Testing Strategy

### Unit Tests

- `(auth)/_lib/search-params.test.ts` — unchanged, untouched.
- `(auth)/_actions/sign-up.test.ts` — unchanged, untouched.
- `(auth-api)/api/auth/code/route.test.ts` (moved + URL fixtures updated + mock paths updated) — six existing cases on the PKCE code endpoint.
- `(auth-api)/api/auth/token/route.test.ts` (moved + URL fixtures updated + mock paths updated) — six existing cases on the token endpoint.
- `(client-handshake)/_components/client-auth-bridge.test.tsx` (moved, URL string updates) — exercises the bridge in all three modes (post / redirect / code-redirect).
- `apps/desktop/src/main/__tests__/auth-flow.test.ts` (URL fixture updated) — exercises the desktop main process's exchange call against the new `/api/auth/token` URL.

### Integration Tests

There are no end-to-end tests for the CLI/desktop handshake in this repo today. The Human Review checks in Phase 1 and Phase 2 cover the integration smoke-test surface by driving the actual flows through the dev server. The "full implementation" follow-on plan is the right place to add a Playwright or similar harness.

## Performance Considerations

None. The plan moves files; no runtime change. Route group nesting and route handler resolution are both compile-time concerns in Next.js — no extra runtime cost vs. the current shape.

## Migration Notes

- **No production traffic to migrate**. The desktop binary that calls `/api/desktop/auth/exchange` is not yet released (per `memory/project_desktop_release_state.md`: first signed v0.1.0 is blocked on Apple enrollment). No clients in the wild rely on the old `/api/desktop/auth/*` URLs.
- **CLI URLs untouched**. `/api/cli/login` and `/api/cli/setup` stay at their current paths because the CLI binary is shipped. A future plan can rename these to OAuth-conventional shapes (e.g., `/api/auth/orgs`, `/api/orgs/{id}/api-keys`) along with a coordinated CLI binary release.
- **Stale reference in oRPC plan**. `thoughts/shared/plans/2026-05-10-orpc-public-api-and-api-lib-rework.md` mentions `/api/desktop/auth/*` will remain unchanged in its "What We're NOT Doing." After Phase 1 lands, that note is stale — update or annotate it.
- **Worktree isolation**: Phase 0 creates a dedicated `refactor/auth-route-group-consolidation` worktree so the work cannot disturb `main` or any concurrent worktree. Each implementation phase is locally reversible by `git restore` until merged. The portless dev system gives the worktree its own URL prefix automatically.
- **No DB migration**. `code-store.ts` is the only persistence touchpoint and it uses Upstash Redis with 30s TTL — keys auto-expire, no schema, no data carryover concerns.

## References

- Existing API routes (pre-plan):
  - `apps/app/src/app/api/cli/login/route.ts`
  - `apps/app/src/app/api/cli/setup/route.ts`
  - `apps/app/src/app/api/cli/lib/verify-jwt.ts`
  - `apps/app/src/app/api/desktop/auth/code/route.ts`
  - `apps/app/src/app/api/desktop/auth/exchange/route.ts`
  - `apps/app/src/app/api/desktop/auth/lib/code-store.ts`
- Existing UI tree (pre-plan):
  - `apps/app/src/app/(auth)/layout.tsx` — UNTOUCHED by this plan
  - `apps/app/src/app/(auth)/_lib/search-params.ts` — UNTOUCHED by this plan
  - `apps/app/src/app/(app)/(user)/(pending-not-allowed)/_components/client-auth-bridge.tsx`
  - `apps/app/src/app/(app)/(user)/(pending-not-allowed)/{cli,desktop}/auth/page.tsx`
- Production callers:
  - `apps/app/src/proxy.ts:41-42` — `isApiRoute` matcher (updated: drop `/api/desktop/(.*)`, add `/api/auth/(.*)`)
  - `apps/app/src/proxy.ts:61-62` — `isPendingAllowedRoute` matcher (unchanged)
  - `apps/desktop/src/main/auth-flow.ts:250` — `createAppUrl("/api/desktop/auth/exchange")` (updated to `/api/auth/token`)
- Existing route-group conventions in this codebase:
  - `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` — single-purpose API group, no layout
  - `apps/app/src/app/(inngest)/api/inngest/route.ts` — same pattern
  - `apps/app/src/app/(health)/api/health/route.ts` — same pattern
  - `apps/app/src/app/(api)/api/v1/[...rest]/route.ts` — same pattern (the new `(auth-api)/` follows this convention)
- Companion research:
  - `thoughts/shared/research/2026-05-11-cors-three-app-implementation.md` — concurrent CORS doc
  - `thoughts/shared/plans/2026-04-25-desktop-auth-url-scheme-pkce.md` — implemented PKCE plan that the consolidation reorganizes
- OAuth 2.0 endpoint naming conventions: RFC 6749 §3.2 (authorization code), §4.1.3 (token endpoint).

## Improvement Log

### 2026-05-11 — Adversarial review

Three parallel investigations (codebase-analyzer, codebase-pattern-finder, thoughts-locator) surfaced the following issues with the original plan, which were resolved by user decision before this rewrite:

**Critical findings:**

1. **`_lib/` convention violation.** The original plan placed server-only Node modules (`verify-bearer-jwt.ts` using `@clerk/nextjs/server`; `code-store.ts` using `@vendor/upstash` + `node:crypto`) into `(auth)/_lib/`. Audit confirmed every existing `_lib/` directory under `apps/app/src/app/` contains only `nuqs/server` search-param helpers — putting server-only modules in `_lib/` is a stealth foot-gun for anyone expecting client-loadable utilities. **Resolution**: helpers moved to a new `(auth-api)/_server/` folder; the `_server/` convention signals "Node-only, do not import from client."

2. **Mixed-purpose route group was unprecedented.** The original plan placed API route handlers inside `(auth)/`, which is a UI-only group today. Audit confirmed every route group in `apps/app` is single-purpose: `(auth)` (UI), `(trpc)`/`(inngest)`/`(health)`/`(api)` (one `route.ts` each, no layout). **Resolution**: split into a dedicated single-purpose `(auth-api)/` group for API handlers (matching `(trpc)`/`(inngest)` pattern); `(auth)/` UI tree stays exactly as it is.

**High findings:**

3. **Sibling nested route-group layouts were unprecedented.** The original plan split `(auth)/` into `(auth)/(public-auth)/layout.tsx` and `(auth)/(client-handshake)/layout.tsx` — two sibling sub-groups with their own layouts. Audit found zero precedent for this pattern in the monorepo. **Resolution**: handshake pages moved to a top-level `(client-handshake)/` group instead. `(auth)/` is not split. Zero novel patterns introduced.

4. **`(pending-not-allowed)/` becomes empty but original plan tiptoed around it.** Audit confirmed `(pending-not-allowed)/` contains only `cli/auth/` and `desktop/auth/` (plus shared `_components/`) — zero other routes. **Resolution**: plan now deletes `(pending-not-allowed)/` entirely after Phase 2 moves.

5. **Asymmetric URL trim with weak rationale.** Original plan proposed `/api/desktop/auth/code` → `/api/desktop/code` and `/api/desktop/auth/exchange` → `/api/desktop/exchange`. The names `code` and `exchange` at the top of `/api/desktop/*` are not self-descriptive ("what is a desktop code?"), and the client-typing (`desktop`) bakes "who called" into a URL that future clients (mobile, IDE plugin) should reuse. **Resolution**: URLs renamed to OAuth 2.0-conventional shapes `/api/auth/code` (PKCE code issue, RFC 6749 §3.2) and `/api/auth/token` (token endpoint, §4.1.3). Drops client-typing entirely. CLI URLs unchanged — renaming them requires a coordinated CLI binary release, deferred to a follow-on plan.

**Plan structural changes:**

- Phase count went from 3 → 2 (collapse of original Phase 1 + Phase 2 — helpers and routes move together to the same new group), then 2 → 3 with the addition of Phase 0.
- Added **Phase 0: Worktree setup** at user request — all implementation phases run in an isolated `refactor/auth-route-group-consolidation` worktree so the reorganization cannot disturb `main` or any concurrent worktree.
- The new `(auth)/(public-auth)` split is removed entirely.
- The new `(client-handshake)/` group is top-level, not nested under `(auth)/`.
- CLI route handlers stay flat at `apps/app/src/app/api/cli/*` (not moved into any group), consistent with the decision to defer CLI URL rename.

No spike was required — all open questions were architectural/convention choices that needed user input rather than technical validation.
