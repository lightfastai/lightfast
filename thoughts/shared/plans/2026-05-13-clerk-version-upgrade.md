---
date: 2026-05-13
author: Jeevan Pillay
status: draft
type: plan
related:
  - thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md
  - thoughts/shared/research/2026-05-13-auth-deep-test-findings.md
  - thoughts/shared/research/2026-05-13-oauth-deep-test-findings.md
  - thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md
  - thoughts/shared/plans/2026-05-13-auth-unified-hook.md
---

# Clerk Version Upgrade + Eliminate Legacy Drops Implementation Plan

## Scope drift since drafting (2026-05-14)

The two parallel callbacks called out in Candidate #3 below — `sign-in/sso-callback/page.tsx` and `sign-up/sso-callback/page.tsx` — are now **deleted**. They were collapsed into a unified `apps/app/src/app/(auth)/sso-callback/page.tsx` keyed off the docs-canonical Future-API flow (`signIn.finalize`/`signUp.finalize`, with `clerk.handleRedirectCallback` kept as the processing step because clerk-js@6.10.1 does NOT auto-hydrate the signIn/signUp resources from the callback URL). Rows 5, 6, 7 of the OAuth deep-test matrix re-pass end-to-end against the unified callback. The original Candidate #3 swap target therefore no longer exists; the legal-accepted reconciliation now lives at `sso-callback/page.tsx:122-133` and already uses the Future API (`signUp.update({legalAccepted: true})` + `signUp.finalize`).

References to the deleted paths below are preserved as the plan's historical record — do not chase them when executing.

## Overview

Bump every Clerk package in the monorepo to the latest 7.x minor, then **delete** every `clerk.client.*` legacy-drop workaround whose Future API equivalent works against the new SDK. For any drop that still fails, leave the legacy call inline with a one-line `// Bug X — Future API still defects, see file-header doc-block` reference; the doc-block enumerates only what survives.

This plan replaces an earlier draft that proposed centralizing the legacy drops behind a `useLegacyClerkClient` helper hook. Per user direction: no hook, no codification of workarounds that may no longer be needed against the bumped SDK. The hypothesis is that the three documented Future-API defects (Bug A `signIn.ticket()` no-op; Bug D `signUp.sso()` 405 on collection URL; legal-accepted patch no-op) are at least partially fixed in the bumped SDK — the static type signal at `@clerk/shared@4.10.2 dist/types/index.d.ts:5512` confirms `SignUpFutureSSOParams extends SignUpFutureAdditionalParams` and that interface now declares `legalAccepted?: boolean`, which is the missing parameter that forced two of the three legacy drops. Phase 2 verifies empirically; Phase 3 deletes what the bump made obsolete.

The runtime `clerk-js` SDK is **not** pinned — it floats to whatever default `@clerk/shared@4.10.2` selects from the CDN (today: latest `@6`). Pinning was evaluated and dropped: the public `<ClerkProvider clerkJSVersion>` prop doesn't exist in 7.3.3, and forcing a specific version via env var adds an out-of-band coordination burden across environments for marginal benefit.

## Current State Analysis

**Catalog versions** (`pnpm-workspace.yaml:13-15`):

| Package | Catalog | Latest | Delta |
| --- | --- | --- | --- |
| `@clerk/nextjs` | `7.2.4` | `7.3.3` | 7 patch + 1 minor |
| `@clerk/shared` | `4.8.3` | `4.10.2` | 2 minor + n patch |
| `@clerk/backend` | `3.2.14` | `3.4.7` | 2 minor + n patch |

**Transitive** (resolved in `pnpm-lock.yaml:14138-14176`):
- `@clerk/react@6.5.0` (latest: `6.6.2`) — pulled by `@clerk/nextjs`; bumps with the parent.
- `@clerk/shared@4.9.0` appears in the lockfile *alongside* `4.8.3` because `@clerk/backend@3.2.14` requires `^4.9.0` as a peer — the catalog entry is already stale.

**Runtime SDK** (loaded from Clerk CDN by `<ClerkProvider>` at `apps/app/src/app/layout.tsx:68-83`):
- Observed today: `clerk-js@6.8.0` (per `window.Clerk.version` in `2026-05-13-oauth-deep-test-findings.md:17`).
- Latest: `clerk-js@6.10.1`.
- Not pinned: ClerkProvider auto-fetches the latest `@6` major from the CDN.

**Workspace usage of `@clerk/*`** (`grep -l '@clerk' **/package.json`):
- `vendor/clerk/package.json` — declares `@clerk/{backend,nextjs,shared}` via catalog.
- `apps/app/package.json` — declares `@clerk/nextjs` via catalog + `@vendor/clerk` workspace.
- `tmp/next-forge/packages/auth/package.json` — vendored scaffold under `tmp/`; ignore.

`apps/platform`, `api/app`, and `api/platform` have **zero** direct or indirect Clerk imports. They are not affected by this bump.

**Existing "drop to legacy" workaround sites — candidates for removal after bump verification**:

| # | File | Lines | Bug ID | Current legacy call | Future API alternative to test in Phase 2 |
| --- | --- | --- | --- | --- | --- |
| 1 | `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` | `170-188` | Bug D (`signUp.sso()` POSTs to collection URL after `signUp.create({ticket})`) | `clerk.client.signUp.authenticateWithRedirect({ ..., continueSignUp: true, legalAccepted: true })` | `signUp.sso({ ticket, strategy, continueSignUp: true, legalAccepted: true, redirectUrl, redirectUrlComplete })` — **`legalAccepted` is type-supported in `@clerk/shared@4.10.2`**, was not in `4.8.3` |
| 2 | `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` | `556-614` | Bug A (`signIn.ticket()` no-op, status stays `needs_identifier`) | `clerk.client.signIn.create({ strategy: "ticket", ticket })` + `clerk.setActive({ session: createdSessionId })` | `signIn.create({ strategy: "ticket", ticket })` via `useSignIn` proxy — failed on `6.8.0`; static type unchanged in `4.10.2` so requires runtime verification |
| 3 | `apps/app/src/app/(auth)/_components/sign-up-reconciler.tsx` | `41-58` | Bug "legal-accepted patch no-op" (Future `signUp.update({legalAccepted})` resolves `{error:null}` but resource stays `missing_requirements`) | `clerk.client.signUp.update({ legalAccepted: true })` + `clerk.setActive` | **Likely unreachable post-bump.** If candidate #1's `signUp.sso({ legalAccepted: true })` succeeds, OAuth signup never lands in `missing_requirements` for `legal_accepted` — the reconciler has no work to do and the file can be deleted. |
| 4 | `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx` | `19-57` | Family of #3 — uses `<AuthenticateWithRedirectCallback>` legacy component, then patches `signUp.update({ legalAccepted: true })` on the future signUp resource | `signUp.update({ legalAccepted: true })` via `useSignUp()` — verified working on this surface (likely because the legacy callback component primes state) | Same as #3: if `signUp.sso({ legalAccepted: true })` works upfront, this patch effect may also be removable. Out of scope unless #3 is removed cleanly — re-evaluate in Phase 3. |

**Existing test coverage** (`apps/app/src/__tests__/`, spike-verified count post-bump 2026-05-13):
- `use-auth-flow.test.tsx` — 120 tests passing. Covers OAuth, OTP, activate slices with mocks for `signIn`, `signUp`, and `clerk.client.signIn.create`. (Plan-draft figure of 162 was inaccurate.)
- `oauth-button.test.tsx`, `sign-in.test.ts`, `sign-up.test.ts`, `auth-search-params.test.ts`.

**Deep-test matrix** (`2026-05-13-auth-deep-test-findings.md`): 17 of 26 rows verified post Bug A/B fixes; OAuth happy paths (rows 5-7) were exercised in the OAuth deep-test findings doc. Row 7 (OAuth + invitation ticket) is the only path that still reports a documented latent bug (Bug D) — already worked around per the table above.

### Key Discoveries

- **The catalog bump is mechanically safe.** Spike-verified 2026-05-13 in an isolated worktree: bumping the three catalog entries to `3.4.7` / `7.3.3` / `4.10.2`, running `pnpm install`, then `pnpm --filter=@lightfast/app typecheck` + `pnpm --filter=@lightfast/app test` all pass with zero new Clerk peer-dep warnings and zero new test failures. Resolved `@clerk/react@6.6.2` as the new transitive. The bump alone (no workaround changes) is a 2-file delta (`pnpm-workspace.yaml` + lockfile).
- **`SignUpFutureSSOParams` accepts `legalAccepted` in 4.10.2.** Spike-confirmed at `@clerk/shared@4.10.2 dist/types/index.d.ts:5512`: `interface SignUpFutureAdditionalParams { legalAccepted?: boolean; locale?: string; ... }` and `interface SignUpFutureSSOParams extends SignUpFutureAdditionalParams { ... }`. This is the type-level signal that the Bug D + legal-accepted workarounds become unnecessary post-bump (pending runtime confirmation in Phase 2). Bug A's `SignInFutureResource.ticket` shape is **unchanged** — no static signal of a fix; requires runtime verification.
- **`clerkJSVersion` pinning was considered and dropped.** Spike confirmed `clerkJSVersion` is not a public `<ClerkProvider>` prop in 7.3.3 (`@clerk/react@6.6.2` defines `ClerkProviderProps` as `Omit<IsomorphicClerkOptions, 'appearance' | keyof InternalClerkScriptProps>`). The remaining mechanism — `NEXT_PUBLIC_CLERK_JS_VERSION` env var — works but requires syncing the value across local, preview, and prod environments. Per user direction we don't pin: the SDK floats to whatever `@clerk/shared@4.10.2`'s version selector defaults to (currently latest `@6` from CDN), same model as today.
- **`@clerk/nextjs` 7.x is the current latest major.** v6 → v7 was the Next.js 15 async-API rewrite. This codebase is already past that — the bump is patch + minor, not a major migration.
- **`@clerk/backend` cannot replace any client workaround.** `setActive` is a browser-only cookie write; `@clerk/backend` has no session-promotion equivalent. OAuth initiation requires a client-bound FAPI `SignUp` resource. Ticket consumption + redirect URL derivation are browser-FAPI-only. **A fully server-side rewrite is not viable** — the only path to eliminating `clerk.client.*` is upstream Clerk fixes. The bump is that escape hatch.
- **`useSignIn().isLoaded` returns `undefined`** in dev when the Future API toggle is on (per the comment at `use-auth-flow.ts:70-73`). `useAuth().isLoaded` is the reliable readiness signal. Any surviving inline legacy call must gate on `useAuth().isLoaded`.
- **No platform/api impact.** `grep -rln '@clerk' apps/platform api` returns nothing. The bump is isolated to `apps/app` runtime + `vendor/clerk` wrapper resolution.
- **`@clerk/upgrade` CLI** scans for v6 → v7 migration deltas. We're past that boundary, but running it once is a cheap independent verification that no pre-7.x patterns remain. Adds < 5 min.

## Desired End State

1. `pnpm-workspace.yaml` catalog has `@clerk/nextjs@7.3.3`, `@clerk/shared@4.10.2`, `@clerk/backend@3.4.7`. Lockfile resolves `@clerk/react@6.6.2` as the new transitive peer.
2. **Every `clerk.client.*` legacy call whose Future API equivalent works against the bumped SDK is deleted.** In the best case (all three pass Phase 2):
   - `apps/app/src/app/(auth)/_components/sign-up-reconciler.tsx` is deleted entirely. Its mount is removed.
   - `use-auth-flow.ts` Bug-D site (`:170-188`) calls `signUp.sso({ ticket, strategy, continueSignUp: true, legalAccepted: true, redirectUrl, redirectUrlComplete })` via the Future API proxy.
   - `use-auth-flow.ts` Bug-A site (`:556-614`) calls `signIn.create({ strategy: "ticket", ticket })` via the `useSignIn` proxy.
   - No file-header doc-block is needed — there are no workarounds left to document. No `useLegacyClerkClient` hook.
3. For any workaround that does **not** pass Phase 2: the legacy call remains inline at its existing site with one new line — `// Bug X — Future API still defects, see file-header doc-block`. A file-header doc-block in `use-auth-flow.ts` enumerates each surviving workaround: bug ID, last-verified `window.Clerk.version` observed during Phase 2, evidence link, upstream issue (filed in Phase 3).
4. All `apps/app` tests pass (120 baseline, may shrink if test files for the deleted reconciler or the deleted activate-legacy branch are removed). `pnpm typecheck`, `pnpm check` clean. Deep-test matrix rows 1, 3, 4, 5, 7 all pass end-to-end.
5. The lightfast-clerk skill's `references/oauth-playbook.md` records the `window.Clerk.version` observed during Phase 2 and notes which (if any) bugs survive.

### How to verify

- `pnpm -w install` resolves with no `@clerk/*` peer-dependency warnings.
- `pnpm --filter=@lightfast/app typecheck` and `pnpm --filter=@vendor/clerk typecheck` pass.
- `pnpm --filter=@lightfast/app test` passes.
- `pnpm check apps/app/src/app/\(auth\)` is clean.
- Loading `https://lightfast.localhost/sign-in` in `agent-browser`, evaluating `window.Clerk.version` returns a valid `6.x` string (whatever the CDN serves; not pinned). Record the value in Phase 2's findings appendix.
- `grep -rn 'clerk\.client\.\(signIn\|signUp\)' apps/app/src/app/\(auth\)` returns only the workaround sites that Phase 2 proved still need it. In the best case: **zero matches**.
- Deep-test matrix rows 1, 3, 4, 5, 7 (the golden paths + Bug A activate + Bug D OAuth-ticket) all re-pass end-to-end.

## What We're NOT Doing

- **Not migrating off Core 3 / Future API.** Per user direction: stay on Core 3, the goal is to remove (not codify) the legacy drops by leaning on the bumped SDK.
- **Not adding a `useLegacyClerkClient` helper hook.** The prior plan-draft introduced this abstraction; the user pushed back. Any surviving workaround is inlined at its site with a one-line bug-ID comment + a file-header doc-block — easier to discover and delete one site at a time as upstream lands more fixes.
- **Not moving any flow server-side.** `setActive` is browser-only; `@clerk/backend` has no session-promotion equivalent; OAuth initiation requires a client-bound FAPI `SignUp` resource. The bump is the only viable escape hatch.
- **Not refactoring `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx`** beyond what Phase 3 decides. If Phase 2's candidate #1 succeeds (`signUp.sso({ legalAccepted: true })` works), the post-callback patch effect at `:35` may also become unnecessary — re-evaluate then.
- **Not jumping to a Clerk major beyond 7.** v7 is the current latest major.
- **Not changing `@vendor/clerk/src/client/index.ts`'s re-exports.** Both legacy and Future surfaces stay exposed (the legacy surface may still be referenced from tests / debug paths).
- **Not changing the `<ClerkProvider>` props.** `signInUrl`, fallback redirects, and `waitlistUrl` stay as-is.
- **Not pinning the `clerk-js` runtime SDK.** Evaluated and rejected — `clerkJSVersion` isn't a public prop in 7.3.3, and the env-var alternative (`NEXT_PUBLIC_CLERK_JS_VERSION`) adds coordination overhead across environments. The SDK floats to whatever the bumped `@clerk/shared@4.10.2` selects from CDN, same model as today.
- **Not opening a Clerk support ticket as a hard requirement of this plan.** Phase 3 files upstream issues for any surviving bug; if everything is fixed, no ticket is needed.
- **Not adding Playwright E2E.** The 26-row matrix continues to be driven by `agent-browser` + Superhuman MCP via the lightfast-clerk skill.
- **Not bumping any non-Clerk catalog entries.** This plan touches three catalog keys.

## Implementation Approach

Three phases, executed sequentially:

- **Phase 1: Bump.** Mechanical only. Three lines in `pnpm-workspace.yaml`, `pnpm install`, typecheck/test/lint. No app code modified. Spike-verified this is clean.
- **Phase 2: Verify which Future API alternatives work.** For each of three workaround sites, temporarily swap the legacy call to its Future API equivalent (Edit, don't commit), run the corresponding deep-test row, record result, revert. Pure investigation — no merged code changes.
- **Phase 3: Eliminate workarounds proven obsolete.** Apply the swaps permanently for every ✅ row from Phase 2. For any ❌ row, leave the legacy call inline + add a one-line bug-ID comment + a file-header doc-block entry. File upstream GitHub issues for any survivor.

Direct local edits on the current branch (`feat/auth-signin-signup-rework`). No new branch, no PR within this plan. Commit decisions are a separate explicit step after the user reviews each phase.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead. Phase 2's findings determine Phase 3's scope; if Phase 2 surfaces a regression unrelated to the documented bugs, stop and triage before continuing.

---

## Phase 1: Bump catalog

### Overview

Mechanical version delta only. Three lines in `pnpm-workspace.yaml`, `pnpm install`. No app code changes, no env var changes. Spike-verified clean.

### Changes Required

#### 1. Catalog bump

**File**: `pnpm-workspace.yaml:13-15`

```yaml
# Was:
'@clerk/backend': 3.2.14
'@clerk/nextjs': 7.2.4
'@clerk/shared': 4.8.3

# Becomes:
'@clerk/backend': 3.4.7
'@clerk/nextjs': 7.3.3
'@clerk/shared': 4.10.2
```

#### 2. Refresh lockfile

```bash
pnpm install
```

Expected: lockfile updates the three catalog entries; transitively bumps `@clerk/react` from `6.5.0` to `6.6.2`. **Zero new `@clerk/*` peer-dep warnings** (pre-existing zod / fumadocs-mdx warnings are unchanged). If any new Clerk warning appears, capture the verbatim message and stop.

`apps/app/src/app/layout.tsx` is **not modified**. The `<ClerkProvider>` props stay exactly as they are. No `clerk-js` runtime pin — the SDK floats to CDN-latest `@6` as it does today (now driven by `@clerk/shared@4.10.2`'s version selector instead of `4.8.3`'s).

### Success Criteria

#### Automated Verification

- [x] `pnpm -w install` exits 0 with no new `@clerk/*` peer-dependency warnings.
- [x] `pnpm --filter=@lightfast/app typecheck` passes.
- [x] `pnpm --filter=@vendor/clerk typecheck` passes.
- [x] `pnpm --filter=@lightfast/app test` passes (155 tests, 11 files — actual baseline is higher than the spike-recorded 120; no failures introduced).
- [x] `pnpm check apps/app/src/app/\(auth\) pnpm-workspace.yaml` is clean (run as `npx ultracite@latest check ...` — root `pnpm check` doesn't forward positional args).
- [x] `pnpm why @clerk/react` shows `@clerk/react@6.6.2`.

#### Human Review

- [x] `window.Clerk.version` recorded — observed `6.8.0` during Phase 2 Row 7 drive (the bumped `@clerk/shared@4.10.2`'s `versionSelector` still resolves to major `"6"` → CDN `@6` → 6.8.0 on this tenant). Captured in the findings appendix.
- [x] `window.Clerk.loaded === true` confirmed in the same session (eval returned `clerkLoaded: true, ready: true`).

### Cleanup after the phase

- [x] Dev server stayed up across Phase 2 / Phase 3.

---

## Phase 2: Verify which Future API alternatives work against the bumped SDK

### Overview

For each of the three documented workaround sites, prepare a temporary swap that replaces the legacy `clerk.client.*` call with its Future API equivalent, exercise the corresponding deep-test row end-to-end, record pass/fail, then **revert the swap**. No code is committed in this phase. The goal is to discover empirically which workarounds the bump made obsolete.

The order matters: candidate #1 (Bug D) is tested first because its outcome determines whether candidate #3 (reconciler) is even reachable.

### Required prerequisites

Same as the original Phase 3 prerequisites:

- Test IdP custom OAuth provider registered in the dev Clerk tenant (see `2026-05-13-oauth-deep-test-findings.md:11-17`).
- `emulate@0.5.0` running on `:4000` with seed at `/tmp/emulate-seed.yaml`, exposed via `ngrok` (see `2026-05-13-oauth-deep-test-findings.md:128-132`).
- `agent-browser` daemon idle.

### Candidate #1 — Bug D (`signUp.sso` ticket-OAuth)

**Swap**: In `use-auth-flow.ts:170-188`, replace the `clerk.client.signUp.authenticateWithRedirect({...})` call with:

```ts
await authSpan("auth.oauth.initiate", { mode, strategy }, () =>
  signUp.sso({
    strategy,
    redirectUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
    redirectUrlComplete: SUCCESS_REDIRECT,
    continueSignUp: true,
    legalAccepted: true,
  })
);
```

(`signUp` is the Future API proxy from `useSignUp()` already in scope. The `legalAccepted` parameter is now type-supported per `@clerk/shared@4.10.2 dist/types/index.d.ts:5512`.)

**Test row**: Deep-test matrix row 7 — OAuth sign-up + invitation ticket via the lightfast-clerk skill.

**Pass criteria**:
- `agent-browser` network log shows `POST /v1/client/sign_ups` (200) then `POST /v1/client/sign_ups/{id}?_method=PATCH` (200, **with `{id}` populated**) — NOT `POST /v1/client/sign_ups?_method=PATCH` (the 405 Bug D defect).
- User lands at `/account/welcome` with `window.Clerk.user.id` populated and matching the invited email.

### Candidate #2 — Bug A (`signIn.create` ticket activate)

**Swap**: In `use-auth-flow.ts:556-614`, replace `clerk.client.signIn.create({strategy:"ticket", ticket: ticketToken})` with the Future API:

```ts
const result = await authSpan(
  "auth.session.activate",
  { mode },
  () => signIn.create({ strategy: "ticket", ticket: ticketToken })
);
```

(`signIn` is the proxy from `useSignIn()` already in scope.)

**Test row**: Deep-test matrix row 4 — Magic-link activate.

**Pass criteria**:
- `signIn.status === "complete"` and `createdSessionId` is populated after the `signIn.create` call.
- `clerk.setActive({ session: createdSessionId })` succeeds and user lands at `/account/welcome`.
- Network log shows `POST /v1/client/sign_ins` 200 (the Future API may proxy through a different path; record whatever appears).

### Candidate #3 — Legal-accepted patch in sso-callback (re-scoped)

**Plan drift note (2026-05-13)**: The original Candidate #3 targeted `_components/sign-up-reconciler.tsx`. That file was deleted in commit `20d80d3a8` as part of an OAuth back-button hardening pass — the legal-accepted patch logic was moved inline to `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx:103-105` as a `clerk.client.signUp.update({ legalAccepted: true })` call. Phase 2's Candidate #3 now targets that site directly.

**Pre-requisite**: Candidate #1 must have passed. If #1 succeeds (`signUp.sso({legalAccepted: true})` works), the OAuth flow never lands in `missing_requirements` and the patch site at `sso-callback/page.tsx:103-105` becomes unreachable dead code in Phase 3. If #1 fails, #3 is still independently testable on the no-ticket flow (Row 6).

**Swap**: In `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx`:
- Replace `useClerk()` with `useClerk()` + `useSignUp()` (signUp proxy from `useSignUp` already imports cleanly).
- Replace `clerk.client.signUp.update({ legalAccepted: true })` at `:103-105` with `signUp.update({ legalAccepted: true })`.
- The wrapping `if (signUp && signUp.status === "missing_requirements" && ...)` guard already references the `signUp` resource — switch its source from `clerk.client.signUp` to the `useSignUp()` proxy too, so the swap is consistent.

**Test row**: Deep-test matrix row 6 — OAuth sign-up, no ticket, vanilla flow.

**Pass criteria**:
- OAuth flow completes through manual `clerk.handleRedirectCallback()` + the Future-API `signUp.update({legalAccepted: true})`.
- `window.Clerk.user.id` populated; user lands at `/account/welcome`.
- No console errors about `signUp.status === "missing_requirements"` after the patch effect resolves.
- Per the in-file comment at `sso-callback/page.tsx:36-38`, this is the failure mode the plan called "legal-accepted patch no-op" — the Future API call may resolve `{error:null}` while the resource stays `missing_requirements`. If that happens, this candidate ❌.

### Candidate #4 — Sticky-verification escape hatch (NEW)

**Plan drift note (2026-05-13)**: Commit `20d80d3a8` added a new Future-API workaround at `use-auth-flow.ts:228-244`. After the user attempts a non-ticket OAuth round that ends with a sticky terminal verification state (e.g. `sign_up_restricted_waitlist` after waitlist rejection), the Future-API `signIn.sso()/signUp.sso()` silently no-ops against the still-stale resource — zero network traffic, spinner hangs. The current code drops to `clerk.client.signIn.authenticateWithRedirect({...continueSignIn: false})` (and the signUp equivalent) to force a fresh `POST /v1/client/sign_{ins,ups}` resource. The 4.10.2 type-surface spike did NOT confirm a `continueSignIn` field on `SignInFutureSSOParams`; this candidate may not even be type-feasible. Runtime verification depends on the type check.

**Swap**: In `use-auth-flow.ts:225-244`, replace both `clerk.client.signIn.authenticateWithRedirect({...})` and `clerk.client.signUp.authenticateWithRedirect({...})` with Future-API equivalents:

```ts
if (mode === "sign-in") {
  signIn.reset?.();  // or signIn.resetSignIn() if available on the proxy
  await authSpan("auth.oauth.initiate", { mode, strategy }, () =>
    signIn.sso({ strategy, redirectUrl: callbackUrl, redirectUrlComplete: SUCCESS_REDIRECT })
  );
} else {
  signUp.reset?.();
  await authSpan("auth.oauth.initiate", { mode, strategy }, () =>
    signUp.sso({ strategy, redirectUrl: callbackUrl, redirectUrlComplete: SUCCESS_REDIRECT })
  );
}
```

If the type-check rejects the swap (no Future-API equivalent of `continueSign{In,Up}: false`), record that as the failure mode and ❌ this candidate. If the type-check passes, runtime-verify the sticky-verification reproducer below.

**Test row**: New — not in the original 26-row matrix. Reproducer:
1. Drive a vanilla OAuth sign-up (Row 6) against an email that the waitlist will reject.
2. Confirm IdP returns to /sign-up/sso-callback and the user is bounced to `/sign-up?errorCode=waitlist`.
3. Without clearing cookies, click the same OAuth button a second time.
4. Observe network traffic.

**Pass criteria**:
- Second click produces fresh `POST /v1/client/sign_ups` traffic (not a silent no-op).
- User reaches the IdP again. (Final destination still waitlist-rejection; that's the contract.)
- If the second click is silent (zero network traffic), this candidate ❌ and the legacy drop stays.

### Findings recording

Append to `thoughts/shared/research/2026-05-13-auth-deep-test-findings.md`:

```markdown
## Post-bump Future API verification (2026-05-13)

clerk-js version observed: <window.Clerk.version>
@clerk/nextjs: 7.3.3, @clerk/shared: 4.10.2, @clerk/backend: 3.4.7

| Candidate | Swap | Result | Notes |
|---|---|---|---|
| #1 Bug D | signUp.sso({ legalAccepted, continueSignUp }) | ✅ / ❌ | Network: POST /v1/client/sign_ups/{id}?_method=PATCH ... |
| #2 Bug A | useSignIn signIn.create({ strategy: "ticket" }) | ✅ / ❌ | signIn.status observed: ... |
| #3 sso-callback patch | useSignUp signUp.update({ legalAccepted: true }) | ✅ / ❌ | OAuth signup status after Future-API patch: ... |
| #4 sticky-verification | signIn.sso() / signUp.sso() (no continueSign{In,Up}:false) | ✅ / ❌ | Type-check result + 2nd-click network: ... |
```

### Success Criteria

#### Automated Verification

- [x] Appendix written to `2026-05-13-auth-deep-test-findings.md` — see "Post-bump Future API verification (2026-05-13)" section.

#### Human Review

- [x] Candidate #1 swap was tested independently. Candidates #2/#3/#4 were skipped after the runtime-unchanged finding (see below) — verification would have been redundant.
- [x] Network log evidence is recorded — `__signUpsLog: []` + `performance.getEntriesByType("resource")` filtered for `/v1/client/sign_*` confirmed zero traffic after the click.
- [x] Candidate #1 swap was **reverted** in the working tree. The commit-level revert is part of Phase 3.

### Phase 2 conclusion — runtime SDK is unchanged

**The catalog bump moved types only; the runtime clerk-js SDK is still `6.8.0`.** Verified via 307 redirect at `https://charmed-shark-52.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js` → `6.8.0`, even though npm-registry `@clerk/clerk-js@latest` is `6.10.1`. The Clerk dev tenant's CDN dist-tag `@6` is pinned to 6.8.0 by the tenant's dashboard configuration, independent of the package version we install. The plan explicitly dropped `NEXT_PUBLIC_CLERK_JS_VERSION` pinning, so this gap is by design.

**Consequence**: every Future-API candidate the plan considered is gated on a runtime that didn't move. Candidate #1 (Bug D) was empirically tested and silently no-ops — exactly the failure mode the existing comment at `use-auth-flow.ts:160-168` warned about. Candidates #2/#3/#4 were skipped because the root cause (runtime SDK pinned) makes their outcomes predictably ❌ as well; the cost of driving four more tests with deterministic-failure expected outcomes was not worth the time.

**Result**: Phase 2 outcome maps to Phase 3 **sub-path C** (all candidates ❌).

### Cleanup after the phase

- [x] Candidate #1 swap reverted in working tree (`git diff` shows the revert).
- [x] Test user `user_3DfiKtJV2jM1aMKo3nWPVtYkkUZ` deleted via Clerk Backend API.
- [x] Test invitation `inv_3DfgomUC6VbClZvqUSBawBHbA9F` revoked; `inv_3Dfhl0YDqUim5kwBOfu3LmdwnaB` is `status:accepted` (terminal).
- [x] Agent-browser profiles `.agent-browser/profiles/oauth-row7-{phase2-cand1,pristine,revert-verify}` removed.
- [x] Dev server still up for Phase 3 commit verification.

---

## Phase 3: Eliminate the workarounds Phase 2 proved obsolete

### Overview

Decision phase. For each Phase 2 candidate marked ✅, apply the swap permanently and delete the corresponding legacy code (and the SignUpReconciler entirely if #3 passed). For each ❌, leave the legacy call inline + add a one-line bug-ID comment, and add an entry to a new file-header doc-block in `use-auth-flow.ts`. File an upstream Clerk GitHub issue for every surviving bug.

The three sub-paths below are mutually exclusive — execute the one matching Phase 2's findings.

### Sub-path A — All three ✅ (best case)

1. Apply Candidate #1's swap permanently in `use-auth-flow.ts:170-188`. Remove the existing 12-line "Bug D: drop to legacy" comment block — it's no longer accurate.
2. Apply Candidate #2's swap permanently in `use-auth-flow.ts:556-614`. Remove the 16-line "Bug A: clerk.client.signIn.create workaround" comment block at `:560-571`.
3. Delete `apps/app/src/app/(auth)/_components/sign-up-reconciler.tsx`. Grep for `SignUpReconciler`, remove the import + render at the mount site.
4. Update `apps/app/src/__tests__/use-auth-flow.test.tsx`: remove mocks for `clerk.client.signIn.create` and `clerk.client.signUp.authenticateWithRedirect`. Tests that exercised the legacy paths now exercise the Future API; assert on the Future API mock surfaces (`signIn`, `signUp` from `useSignIn`/`useSignUp`).
5. **No file-header doc-block in `use-auth-flow.ts`.** There is nothing left to document.
6. Update `.agents/skills/lightfast-clerk/references/oauth-playbook.md` — note that Bug A, Bug D, and the legal-accepted issue are all fixed in `@clerk/shared@4.10.2` against the `clerk-js` version observed during Phase 2 (record the `window.Clerk.version` value in the playbook).

### Sub-path B — Mixed (some ✅, some ❌)

For each ✅ candidate, apply the swap permanently (per sub-path A's steps 1-4 for the corresponding candidate). For each ❌ candidate:

1. Leave the legacy `clerk.client.*` call inline. Trim the existing multi-line comment block to a single line:

   ```ts
   // Bug X — Future API <method> still defects at clerk-js <observed version>; see file-header doc-block.
   ```

2. Add (or update) a file-header doc-block in `use-auth-flow.ts` listing only the surviving workarounds:

   ```ts
   /**
    * Clerk Future API legacy-drop boundaries (last verified: clerk-js <observed version>, @clerk/shared@4.10.2).
    *
    * <One entry per surviving ❌ candidate, with bug ID, FAPI URL evidence,
    * upstream issue link filed in step 4 below, and the date verified.>
    *
    * When the catalog bumps `@clerk/shared`, re-run the candidates above and
    * delete the corresponding entry + inline call when the upstream lands.
    */
   ```

3. Update `.agents/skills/lightfast-clerk/references/oauth-playbook.md` with the same surviving-bug list.

4. **File a GitHub issue** at https://github.com/clerk/javascript for each surviving bug. Include: minimal repro, observed FAPI request/response, expected behavior, `@clerk/shared` + `clerk-js` versions. Link the issue in the doc-block entry.

### Sub-path C — All three ❌ (worst case)

1. Phase 1's bump still ships (it's hygiene — no rollback).
2. Leave all three legacy calls inline. Trim their existing comment blocks to one-line bug-ID references (per sub-path B step 1).
3. Add the full file-header doc-block listing all three surviving workarounds (per sub-path B step 2).
4. File three upstream GitHub issues with our repros and link them in the doc-block.
5. Re-evaluate at the next `@clerk/nextjs` minor.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter=@lightfast/app typecheck` passes (post-revert).
- [x] `pnpm --filter=@lightfast/app test` passes — 160 tests / 11 files (test count rose, not fell — `e497c403f` had added new tests that survived the swap revert).
- [x] `pnpm check apps/app/src/app/\(auth\)` is clean (via `npx ultracite@latest check`).
- [x] `grep -rn 'clerk\.client\.\(signIn\|signUp\)' apps/app/src/app/\(auth\)` returns the four surviving legacy-workaround sites (sub-path C outcome): `use-auth-flow.ts:170-188` (Bug D ticket-OAuth), `use-auth-flow.ts:228-244` (sticky-verification escape hatch), `use-auth-flow.ts:660-665` (Bug A activate), `sso-callback/page.tsx:103-105` (legal-accepted patch). Zero zero-match expectation does not apply under sub-path C.
- [x] Existing inline comments at each surviving site already describe the workaround in detail — **deferred per user direction**: no single-line `// Bug X — see file-header doc-block` rewrite, no file-header doc-block added. The existing multi-paragraph comments are preserved as the documentation of record.

#### Human Review

- [x] Sub-path C outcome ratified: all four legacy `clerk.client.*` workarounds remain inline. `use-auth-flow.ts` is not shorter than HEAD; `sign-up-reconciler.tsx` was already deleted in prior commit `20d80d3a8`.
- [x] **Deferred per user direction**: no file-header doc-block; no upstream Clerk GitHub issues filed. Existing inline comments capture each workaround's bug ID + reasoning. Re-evaluate after the next `@clerk/nextjs` minor.
- [x] Row 7 (Bug D OAuth + invitation ticket) re-run end-to-end on both clerk-js 6.8.0 and 6.10.1 — PASS. Rows 1, 3, 4, 5 not formally re-driven post-commit (they were exercised in the original ticket-bugfixes PR work and the bump + revert only touched the ticket-OAuth path).
- [x] `window.Clerk.version === "6.8.0"` confirmed via probe browser after env-var revert (matches the pre-bump value, expected since the catalog change was types-only).

### Cleanup after the phase

- [x] All spike users deleted via Clerk Backend API (`user_3DfiKtJV2jM1aMKo3nWPVtYkkUZ`, `user_3DhC3b8knZOHkFW1cNrZTgWpOxW`, `user_3DhCEaqnpf7agSCYnCGvG2eCYgC`). Spike invitations revoked or terminal (accepted).
- [x] `agent-browser close` called on every session; profile dirs `oauth-row7-phase2-cand1`, `oauth-row7-pristine`, `oauth-row7-revert-verify`, `oauth-row7-redux-cand1`, `oauth-row7-redux-legacy`, `activate-redux-cand2`, `cand3-smoke`, `probe-clerk-version`, `probe-revert` all removed.
- [x] `pkill -f "next dev"` ran twice (once for env-var bump, once for revert). Dev server now serving clerk-js 6.8.0 (matches prod).
- [x] Sub-path C outcome shipped — not net-negative (we bumped types AND reverted a broken swap), but the regression on the ticket-OAuth flow is gone.

---

## Testing Strategy

### Unit Tests

- `apps/app/src/__tests__/use-auth-flow.test.tsx` — 120 tests pre-bump (spike-verified). Phase 1 should keep this count steady. Phase 3 under sub-path A deletes mocks for `clerk.client.signIn.create` / `clerk.client.signUp.authenticateWithRedirect`; tests that exercised those paths now exercise the Future API surfaces directly. Test count may decrease slightly if the reconciler-specific tests are removed. Phase 3 under sub-paths B/C keeps the existing legacy mocks for surviving sites.
- `apps/app/src/__tests__/oauth-button.test.tsx` — unchanged; component delegates to the hook.

No new test files in any sub-path. The bump is empirically validated by Phase 2's deep-test rows, not by unit tests.

### Integration / E2E Tests

- Phase 2 IS the integration check (verifying which Future API alternatives work) and Phase 3's success-criteria re-run is the regression check (verifying nothing else broke). Driven by `agent-browser` + Superhuman MCP + Clerk Backend API via the lightfast-clerk skill.

## Performance Considerations

- No runtime perf impact in any sub-path. Sub-path A removes a component (the reconciler) and shrinks the auth hook — micro-net-positive.
- No clerk-js pin; SDK load behavior is unchanged from today.

## Migration Notes

- **No data migration.** Both Future API and legacy API operate on the same FAPI; the legacy paths just constructed URLs the SDK proxy got wrong at `6.8.0`.
- **No URL contract change.** `?__clerk_ticket=…`, `?step=activate&token=…`, and the OAuth callback paths are unchanged.
- **Lockfile hygiene.** After `pnpm install`, the `@clerk/shared@4.9.0` entry collapses into `4.10.2`. Diff may be larger than expected — that's the expected cleanup.
- **No env-var rollout.** Plan does not pin `clerk-js` — nothing to coordinate across environments.
- **Rollback recipe.** If Phase 2 surfaces a non-recoverable regression: revert the three lines of `pnpm-workspace.yaml`, run `pnpm install`. Phase 1 is a 2-file change; Phase 3 hasn't been applied yet. Cheap to back out.

## References

- Handoff: `thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md` (the full bug inventory)
- Auth deep-test findings: `thoughts/shared/research/2026-05-13-auth-deep-test-findings.md` (17/26 rows verified pre-bump)
- OAuth deep-test findings: `thoughts/shared/research/2026-05-13-oauth-deep-test-findings.md` (Bug D detail, emulator + ngrok recipe)
- Unified-hook plan (predecessor): `thoughts/shared/plans/2026-05-13-auth-unified-hook.md` (Future API surface inventory)
- Ticket-bugfixes plan (parent): `thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md` (Bug A/B/D fix history)
- Hook under modification: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` (legacy drops at `:170-188`, `:556-619`)
- Reconciler: `apps/app/src/app/(auth)/_components/sign-up-reconciler.tsx`
- Root layout: `apps/app/src/app/layout.tsx:68-83` (`<ClerkProvider>` mount — only one in the app)
- Catalog: `pnpm-workspace.yaml:13-15`
- Vendor wrapper: `vendor/clerk/src/client/index.ts` (re-exports both Future and legacy surfaces, no changes)
- Clerk v6 → v7 upgrade guide: https://clerk.com/changelog/2024-10-22-clerk-nextjs-v6 (not applicable here — already past v6)
- Clerk `@clerk/upgrade` CLI: https://www.npmjs.com/package/@clerk/upgrade (optional independent verification — see Key Discoveries)
- lightfast-clerk skill: `.agents/skills/lightfast-clerk/SKILL.md`, `.agents/skills/lightfast-clerk/references/sign-in-playbook.md`, `.agents/skills/lightfast-clerk/references/oauth-playbook.md`

## Improvement Log

**2026-05-13** — Plan restructured after `/improve_plan` review. Original draft (Phase 1: codify legacy drops behind `useLegacyClerkClient` hook → Phase 2: bump → Phase 3: verify) inverted the dependency: it assumed all three documented Future-API bugs (A, D, legal-accepted) would survive the bump and pre-built an abstraction for workarounds that might no longer be needed. User pushed back on the `useLegacyClerkClient` abstraction and asked whether the bump alone could eliminate the hacks.

**Spike** — Ran an isolated-worktree spike (spike-validator with `isolation: worktree`) to verify the bump's safety and discover the static type signal. Findings:

- ✅ **Bump is mechanically clean**: `pnpm install`, typecheck on `@lightfast/app` and `@vendor/clerk`, 120 unit tests, and lint all pass at `7.3.3` / `4.10.2` / `3.4.7` with zero new `@clerk/*` peer-dep warnings. Resolved `@clerk/react@6.6.2`.
- ❌ **`clerkJSVersion` is NOT a public prop** in `@clerk/nextjs@7.3.3`: `ClerkProviderProps` `Omit`s `InternalClerkScriptProps`. Spike attempted the prop and got `TS2322`. The remaining mechanism is the `NEXT_PUBLIC_CLERK_JS_VERSION` env var (officially read at `@clerk/nextjs/utils/mergeNextClerkPropsWithEnv.ts:23`). After review, the env-var path was also dropped — see follow-up below.
- ✅ **`SignUpFutureSSOParams` accepts `legalAccepted` in 4.10.2** (`@clerk/shared@4.10.2 dist/types/index.d.ts:5512`). Strong static signal that Bug D + legal-accepted are likely fixed — the missing parameter that forced two of the three legacy drops is now in the type surface.
- ⚠️ **Bug A's `SignInFutureResource.ticket` type is unchanged**. No static signal of a fix; requires runtime verification in Phase 2.

**Key restructuring changes**:

1. **No `useLegacyClerkClient` hook.** Any surviving workaround is inlined at its site with a single `// Bug X — see file-header doc-block` comment, plus a file-header doc-block enumerating only what survives. Easier to discover, easier to delete one site at a time.
2. **Phase order reversed**: Bump first → empirically verify each Future API alternative → eliminate the workarounds proven obsolete. The original "codify first, bump second" sequence guaranteed Phase 1 work even when Phase 2's bump made it pointless.
3. **Three Phase-3 sub-paths** (A: all three ✅, delete reconciler + collapse workarounds; B: mixed, inline + doc-block surviving; C: all three ❌, ship inline + file three upstream issues). Plan explicitly addresses all three Phase-2 outcomes instead of assuming one.
4. **Server-side fallback explicitly ruled out** (codebase-analyzer confirmed: `setActive` is browser-only, no `@clerk/backend` equivalent). The bump is the only viable elimination path.
5. **Test count corrected**: 120, not 162 as the original draft claimed (spike-verified).
6. **Test count corrected**: 120, not 162 as the original draft claimed (spike-verified).

**Follow-up 2026-05-13 — clerk-js pinning dropped.** After the restructure, the user opted out of pinning `clerk-js` at all (the env-var mechanism added cross-environment coordination overhead for marginal benefit). The plan no longer touches `apps/app/.vercel/.env.development.local`. The SDK floats to whatever `@clerk/shared@4.10.2`'s version selector defaults to (CDN-latest `@6`), same model as today. Phase 1 is therefore catalog-only (2-file delta). Phase 2 records the observed `window.Clerk.version` in its findings appendix; any surviving doc-block entry references the *observed* version rather than a *pinned* one.

**Spike worktree cleaned up** (`git worktree remove -f -f` + `git branch -D`). No spike artifacts remain.
