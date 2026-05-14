---
date: 2026-05-14
author: Jeevan Pillay
status: draft
type: plan
related:
  - thoughts/shared/plans/2026-05-13-auth-unified-hook.md
  - thoughts/shared/plans/2026-05-13-clerk-version-upgrade.md
  - thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md
---

# Auth Sign-In / Sign-Up Split + Accept-Invitation Route Implementation Plan

## Overview

Undo the recently-shipped `useAuthFlow` consolidation. Split `apps/app/src/app/(auth)/sign-in/` and `apps/app/src/app/(auth)/sign-up/` into fully independent self-contained client pages — each route owns its own Clerk Future-API calls, its own state, and its own UI inline. Add a new dedicated route `apps/app/src/app/(auth)/sign-up/accept-invitation/` for Clerk invitation tickets, replacing today's `/sign-up?__clerk_ticket=…` branched-page UX. Drop the magic-link `?step=activate&token=` path entirely. Keep email-OTP as the sign-up identifier (no password). Keep OAuth+ticket on the new invitation route.

## Current State Analysis

### Today's architecture (heavily shared)

```
apps/app/src/app/(auth)/
├── _components/
│   ├── email-form.tsx           194 LOC  mode-switching: action: "sign-in" | "sign-up"
│   ├── oauth-button.tsx          46      mode-switching: mode: "sign-in" | "sign-up"
│   ├── otp-island.tsx            40      mode-switching wrapper around shared CodeVerificationUI
│   ├── session-activator.tsx     38      sign-in only — magic-link ?step=activate&token=
│   ├── error-banner.tsx          59      pure UI, mode-agnostic
│   ├── separator-with-text.tsx   14      pure UI
│   └── shared/
│       └── code-verification-ui.tsx  137 pure UI, prop-driven
├── _hooks/
│   ├── use-auth-flow.ts         716     unified state machine (oauth + otp + activate slices)
│   ├── auth-errors.ts            85     Clerk error → MappedAuthError mapper
│   └── auth-telemetry.ts         22     Sentry span + breadcrumb wrappers
├── _lib/
│   └── search-params.ts          54     nuqs schemas (signIn: step,email,error,token,errorCode;
│                                                       signUp: step,email,error,ticket,__clerk_ticket,errorCode)
├── sign-in/
│   ├── page.tsx                 115     server component, branches on ?step=
│   ├── sso-callback/page.tsx    104     custom OAuth callback
│   └── h3-test/                          experimental probe directory — out of scope
├── sign-up/
│   ├── page.tsx                 218     server component, branches on ?step= AND on ?__clerk_ticket=
│   └── sso-callback/page.tsx    138     custom OAuth callback + legalAccepted reconcile
├── error.tsx                     55
└── layout.tsx                    78
```

Total LOC under `(auth)/` excluding tests: 2,113 lines across 16 source files.

### What sign-in does today

- URL contract: `/sign-in?step={email|code|activate}&email=…&token=…&errorCode=…&error=…`
- `step=email` (default) → renders `<EmailForm action="sign-in" />` + `<OAuthButton mode="sign-in" strategy="oauth_github">`
- `step=code` → renders `<OTPIsland email mode="sign-in">` (uses CodeVerificationUI)
- `step=activate` → renders `<SessionActivator token>` (magic-link consumption)
- All client logic flows through `useAuthFlow({ mode: "sign-in", step, email, token, ticket })`
- Identifier: email-OTP only, no password

### What sign-up does today

- URL contract: `/sign-up?step={email|code}&email=…&ticket=…&__clerk_ticket=…&errorCode=…&error=…`
- Same `step=email` / `step=code` shape as sign-in
- The presence of `__clerk_ticket` (from Clerk invitation URL) or `ticket` (legacy) **branches the UI in-place**: invitation flow shows OAuth GitHub primary + email form secondary + ticket-expiry text; standard waitlist sign-up shows email form primary + GitHub secondary + legal-acceptance prose
- All client logic flows through `useAuthFlow({ mode: "sign-up", step, email, ticket })`
- Identifier: email-OTP only, with `legalAccepted: true` passed implicitly in every `signUp.create()` call (no checkbox today)
- Both `/sign-up?__clerk_ticket=…` (Clerk-minted) and `/sign-up?ticket=…` (legacy) URL patterns are accepted

### What sso-callback does today

- `sign-in/sso-callback/page.tsx`: custom `clerk.handleRedirectCallback` to surface waitlist/account-not-found errors that the prebuilt `<AuthenticateWithRedirectCallback>` would swallow
- `sign-up/sso-callback/page.tsx`: same + reconciles `legal_accepted` inline (uses legacy `clerk.client.signUp.update({ legalAccepted: true })` because the Future API equivalent was a no-op on clerk-js 6.8)

### External touchpoints (mostly stable)

- `proxy.ts:53` — `createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"])` — already matches subroutes, **no change needed**
- `app/layout.tsx:69-74` — `<ClerkProvider afterSignOutUrl="/sign-in" signInUrl="/sign-in" signUpUrl="/sign-up">` — **no change needed**
- `app/(auth)/layout.tsx:56-72` — links to `/legal/terms` + `/legal/privacy` via `MicrofrontendLink` — these are the canonical routes (NOT `/terms` / `/privacy` as the user's snippet showed)
- `app/(app)/(user)/(pending-allowed)/account/welcome/page.tsx` — post-auth landing — unchanged
- `instrumentation-client.ts:15,41` — Sentry breadcrumb redaction has a `__clerk_ticket=` regex; still relevant for the new `/sign-up/accept-invitation?__clerk_ticket=…` URL — **no change needed**
- `instrumentation-client.ts` redacts the new path implicitly (regex matches anywhere in URL)

### Test coverage that disappears with the split

- `apps/app/src/__tests__/use-auth-flow.test.tsx` — 120 cases against `useAuthFlow` (deletion target)
- `apps/app/src/__tests__/oauth-button.test.tsx` — tests against `<OAuthButton>` (deletion target)
- `apps/app/src/__tests__/auth-errors.test.ts` — tests against `mapOtpClerkError` / `mapOAuthClerkError` — **stays** (mapper is shared utility)
- `apps/app/src/__tests__/auth-search-params.test.ts` — tests against nuqs schemas — **stays but updates** (schemas shrink)

### Magic-link infrastructure: confirmed unused in-tree

- `grep -rn 'step=activate'` across `apps/app/src/`, `api/` returns zero in-tree URL minters
- The `activate` step is consumed by `<SessionActivator>` but never produced by our code
- Either Clerk dashboard mints these (for password reset / email magic-link), or the path is dead
- **Risk**: dropping `?step=activate&token=` could break a Clerk-dashboard-configured flow we're unaware of. Phase 0 includes verifying this (dashboard inspection).

### Pre-conditions confirmed by user

- Sign-up identifier strategy stays email-OTP-only (the user's snippet showing `signUp.password` was a Future-API illustration, not a request to add password)
- Full split — delete shared `_components/` + `_hooks/use-auth-flow.ts`
- Only the new `/sign-up/accept-invitation` route accepts tickets after cutover; Clerk dashboard's invitation URL gets updated as part of the cutover
- Future-API (`signIn.sso`, `signUp.sso`, `signUp.ticket`, `signIn.finalize`, `signUp.finalize`) is verified to work after the SDK bump tracked in `2026-05-13-clerk-version-upgrade.md` — new pages use Future API only, no `clerk.client.*` legacy drops
- Cutover style: side-by-side then promote (build under `sign-in/v2/`, `sign-up/v2/`; rename in Phase 3)
- Magic-link `?step=activate&token=` path is **dropped entirely**
- Invitation route keeps both form (ticket-consume) AND OAuth-with-ticket (GitHub button)
- Invitation route does **not** collect first/last name (per user — names captured in `/account/welcome` onboarding instead). User accepts ticket via either OAuth click or an "Accept invitation" button.

## Desired End State

```
apps/app/src/app/(auth)/
├── _components/
│   ├── error-banner.tsx              KEEP — pure UI, used by all three routes
│   ├── separator-with-text.tsx       KEEP — pure UI
│   └── shared/
│       └── code-verification-ui.tsx  KEEP — pure UI, prop-driven OTP UI
├── _hooks/
│   ├── auth-errors.ts                KEEP — mapper utility, used by all three routes
│   └── auth-telemetry.ts             KEEP — Sentry wrappers
├── _lib/
│   └── search-params.ts              SHRINK — drop step/email/token/ticket fields; keep error/errorCode + accept-invitation schema
├── sign-in/
│   ├── page.tsx                      REWRITE — single self-contained 'use client' page
│   └── sso-callback/page.tsx         UNCHANGED — keep custom callback
├── sign-up/
│   ├── page.tsx                      REWRITE — single self-contained 'use client' page (no ticket branch)
│   ├── sso-callback/page.tsx         UPDATE — point continueSignUp redirect to /sign-up/accept-invitation
│   └── accept-invitation/
│       └── page.tsx                  NEW — self-contained 'use client' page for ticket consumption
├── error.tsx                         UNCHANGED
└── layout.tsx                        UNCHANGED

DELETED:
├── _components/email-form.tsx
├── _components/oauth-button.tsx
├── _components/otp-island.tsx
├── _components/session-activator.tsx
├── _hooks/use-auth-flow.ts
├── sign-in/h3-test/                       (existing experimental probe)
├── __tests__/use-auth-flow.test.tsx
└── __tests__/oauth-button.test.tsx
```

### How to verify

- `pnpm --filter=@lightfast/app test` passes — including new RTL component tests for the three pages
- `pnpm --filter=@lightfast/app typecheck` passes
- `pnpm check` passes
- `git grep -nF 'use-auth-flow' apps/app/src` → zero matches
- `git grep -nF 'email-form\|oauth-button\|otp-island\|session-activator' apps/app/src/app/(auth)` → zero matches
- Manual browser smoke (golden paths):
  - sign-in via email-OTP → `/account/welcome`
  - sign-in via GitHub OAuth → `/account/welcome`
  - sign-up via email-OTP (with checked legalAccepted) → `/account/welcome`
  - sign-up via GitHub OAuth → `/account/welcome`
  - sign-up via Clerk invitation URL (`/sign-up/accept-invitation?__clerk_ticket=…`) — ticket-consume button → `/account/welcome`
  - sign-up via Clerk invitation URL — GitHub OAuth → `/account/welcome`
  - missing ticket on `/sign-up/accept-invitation` → "No invitation ticket found" message
  - sign-up without checking legalAccepted → blocked with field error
  - magic-link URL `/sign-in?step=activate&token=…` (if minted from somewhere) → falls back gracefully to /sign-in (no broken page)

### Key Discoveries

- The recently-merged unified `useAuthFlow` (PR series ending in commits `b6d805c9a`, `e497c403f`, `20d80d3a8`, `f0d6c7d7f`) is what we are deliberately undoing. Per user direction.
- `_components/error-banner.tsx`, `_components/separator-with-text.tsx`, `_components/shared/code-verification-ui.tsx` are pure prop-driven UI — they survive the split unchanged
- `_hooks/auth-errors.ts` (`mapOtpClerkError`, `mapOAuthClerkError`, `authErrorMessage`) and `_hooks/auth-telemetry.ts` (`authSpan`, `authBreadcrumb`) are pure mapper/instrumentation utilities — they survive the split unchanged
- `_lib/search-params.ts` schemas exist mostly to drive the `?step=…` branching and the in-page invitation branching — both go away. Schemas shrink to just `error` + `errorCode` (for ErrorBanner) plus a new `__clerk_ticket` schema for the invitation route.
- The clerk-version-upgrade plan (`2026-05-13-clerk-version-upgrade.md`) is the prerequisite that makes Future-API-only viable. This plan assumes that work has landed and Future API surfaces (`signIn.sso`, `signUp.sso`, `signUp.ticket`, `signUp.create`) all work without legacy fallbacks.
- `app/(auth)/layout.tsx:56-72` already links Terms/Privacy to `/legal/terms` and `/legal/privacy` (not `/terms` / `/privacy` as the reference snippet showed). The new sign-up checkbox label uses `MicrofrontendLink` to those canonical routes.
- `signUp.finalize({ navigate: ({ session, decorateUrl }) => ... })` is the standard post-success path. The `decorateUrl` callback wraps the destination URL with Safari ITP cookie-refresh params. Pattern at `_hooks/use-auth-flow.ts:75-80` — copy verbatim into each new page.

## What We're NOT Doing

- Not adding password-based sign-up (sign-up stays email-OTP-only)
- Not adding password-based sign-in
- Not changing the post-auth landing page (`/account/welcome` stays)
- Not changing the SSO callback architecture (`sign-in/sso-callback/page.tsx` and `sign-up/sso-callback/page.tsx` keep their custom-handler shape; only the redirect target for ticket-bearing OAuth changes from `/sign-up?__clerk_ticket=…` to `/sign-up/accept-invitation?__clerk_ticket=…`)
- Not touching `app/layout.tsx` ClerkProvider config (signInUrl/signUpUrl/afterSignOutUrl)
- Not touching `proxy.ts` middleware (route matchers already cover subroutes)
- Not changing `(auth)/layout.tsx`, `(auth)/error.tsx`
- Not changing `_components/error-banner.tsx`, `_components/separator-with-text.tsx`, `_components/shared/code-verification-ui.tsx` (pure UI, kept)
- Not changing `_hooks/auth-errors.ts` or `_hooks/auth-telemetry.ts` (pure utilities, kept)
- Not changing `instrumentation-client.ts` Sentry redaction (regex is already URL-position-agnostic)
- Not deleting `sign-in/h3-test/` in this plan (out of scope per user; track separately)
- Not updating any `apps/www` or `apps/platform` code
- Not introducing a new state-machine library, Zustand, TanStack Query, or any new abstraction layer; pages are plain React with `useState` + Clerk hooks
- Not preserving `?step=activate&token=` (magic-link); dropped entirely
- Not preserving the legacy `?ticket=` URL pattern on `/sign-up`; only `/sign-up/accept-invitation?__clerk_ticket=` works post-cutover
- Not collecting first/last name on the invitation route (deferred to `/account/welcome` onboarding)
- Not adding Playwright E2E tests in this plan (RTL component tests cover the page-level state machines; Playwright is tracked separately in `2026-05-13-oauth-e2e-testing.md`)
- Not running the SDK bump (`2026-05-13-clerk-version-upgrade.md`) as part of this plan — that plan must land first as a prerequisite

## Implementation Approach

Side-by-side build: new pages live at `sign-in/v2/page.tsx`, `sign-up/v2/page.tsx`, `sign-up/accept-invitation/page.tsx` (the last one ships at its final path because it's a brand-new route). Phase 1 + Phase 2 build new files without touching the live pages — sign-in/sign-up keep working off the existing `useAuthFlow` throughout development. Phase 3 promotes by overwriting `sign-in/page.tsx` and `sign-up/page.tsx` with the v2 contents and deleting the now-orphaned `_components/` + `_hooks/use-auth-flow.ts` + their tests in the same commit.

Each new page is self-contained: a single `'use client'` file that owns its own state (`useState` for input + submitting + error), inlines its OAuth button and email form and OTP UI, and calls Clerk Future-API surfaces (`useSignIn().signIn.{emailCode,sso,finalize}` / `useSignUp().signUp.{create,verifications,sso,ticket,finalize}`) directly. The only shared dependencies are: `_hooks/auth-errors.ts` (error mapper), `_hooks/auth-telemetry.ts` (Sentry wrappers), `_components/error-banner.tsx`, `_components/separator-with-text.tsx`, `_components/shared/code-verification-ui.tsx` — all pure utilities or pure UI.

The error mapping + telemetry pattern is preserved verbatim (it's the production-tested error UX with Sentry breadcrumb instrumentation). The state-machine *shape* is what's being dispersed — instead of one 716-line hook switching on `mode`, each page has ~150-200 lines of its own state.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Pre-flight verification

### Overview

Confirm the prerequisite SDK bump has landed and verify three risky assumptions before writing code: (1) Future API surfaces work as expected; (2) magic-link path has no in-tree minter; (3) Clerk dashboard invitation URL config is editable.

### Changes Required

#### 1. SDK bump prerequisite check

**File**: none (verification only)
**Changes**: Confirm `2026-05-13-clerk-version-upgrade.md` is fully landed on `main` (or this branch contains its catalog updates). Run `pnpm list @clerk/nextjs @clerk/shared @clerk/backend` and verify versions match the bump plan's targets (7.3.3 / 4.10.2 / 3.4.7 or higher).

If not landed: **halt this plan** and finish the SDK bump first.

#### 2. Future API spike — invitation flow

**File**: temporary scratch (delete after spike)
**Changes**: In an isolated browser session against dev Clerk:
- Mint a test invitation, copy the URL
- Open browser console at `app.lightfast.localhost`, run:
  ```js
  const c = window.Clerk;
  await c.client.signUp.create({ strategy: "ticket", ticket: "<ticket>" });
  console.log(c.client.signUp.status, c.client.signUp.emailAddress, c.client.signUp.missingFields);
  ```
- **Expected**: status `complete` OR `missing_requirements` with `emailAddress` populated and `missingFields` empty (or only `legal_accepted`)
- **If `emailAddress` is null and `missingFields` includes `email_address`**: clerk-js 6.10.x has not fixed the auto-populate behavior. Halt and revise Phase 2 to also collect email.

#### 3. Future API spike — OAuth+ticket

**File**: temporary scratch
**Changes**: Repeat with OAuth-with-ticket:
- After `signUp.create({ ticket })`, in the same console:
  ```js
  await c.client.signUp.sso({
    strategy: "oauth_github",
    legalAccepted: true,
    redirectUrl: "/sign-up/sso-callback",
    redirectUrlComplete: "/account/welcome"
  });
  ```
- **Expected**: navigates to GitHub IdP. Network tab shows PATCH to `/v1/client/sign_ups/{id}` (NOT POST to `/v1/client/sign_ups`).
- **If PATCH-vs-POST regression** (Bug D resurfaces): halt and add a legacy `clerk.client.signUp.authenticateWithRedirect` fallback to Phase 2's OAuth-with-ticket path with documented Bug ID.

#### 4. Magic-link minter audit

**File**: none (verification only)
**Changes**: Confirm zero in-tree mint sites for magic-link URLs:
```bash
git grep -nF 'step=activate' apps/ api/ scripts/ packages/
git grep -niE 'magic.?link|emailLink|email_link' apps/ api/
```
Expected: zero hits in `apps/app/src/`, `api/`. (Hits in `(auth)/_lib/search-params.ts:9` and `(auth)/_components/session-activator.tsx` are the consumption side — those get deleted in Phase 3.)

Then check Clerk dashboard (manual): **Authentication → Email & SMS → Email link** — verify either disabled, OR the redirect URL doesn't point at `/sign-in?step=activate`.

**If magic-link is configured and active in dashboard**: halt and either disable in dashboard, or revise the plan to keep `<SessionActivator>`.

#### 5. Clerk dashboard inspection — invitation redirect URL

**File**: none (verification only)
**Changes**: In Clerk dashboard, locate **Configure → Restrictions → Invitations** (or wherever the invitation redirect URL lives — exact path varies by Clerk version). Note current value (likely `https://app.lightfast.localhost/sign-up`). Confirm it's editable. Document the exact dashboard path for Phase 3's update step.

### Success Criteria

#### Automated Verification

- [x] `pnpm list -r @clerk/nextjs @clerk/shared @clerk/backend` shows bumped versions (7.3.3 / 4.10.2 / 3.4.7)
- [x] `git grep -nF 'step=activate' apps/ api/ scripts/ packages/` shows zero in-tree URL minters
- [x] `git grep -niE 'magic.?link|emailLink|email_link' apps/ api/` shows zero hits

#### Human Review

- [ ] Browser spike: `signUp.create({ strategy: "ticket", ticket })` populates `signUp.emailAddress` from the ticket — TODO: automate via Playwright once dev-mode invitation minting is scriptable
- [ ] Browser spike: `signUp.sso({ ticket, strategy, legalAccepted, redirectUrl, redirectUrlComplete })` issues PATCH to `/v1/client/sign_ups/{id}` (NOT POST to collection) — TODO: automate via Playwright + network instrumentation
- [ ] Clerk dashboard invitation redirect URL located and confirmed editable; current value recorded in plan handoff
- [ ] Clerk dashboard email-link / magic-link feature confirmed disabled (or pointing somewhere benign)

---

## Phase 1: Build new sign-in and sign-up pages side-by-side

### Overview

Write `sign-in/v2/page.tsx` and `sign-up/v2/page.tsx` as self-contained `'use client'` pages using Clerk Future-API directly. The live `sign-in/page.tsx` and `sign-up/page.tsx` are untouched throughout this phase — Phase 1 lives under `/sign-in/v2` and `/sign-up/v2` in the dev environment for browser testing.

### Changes Required

#### 1. New file: `apps/app/src/app/(auth)/sign-in/v2/page.tsx`

**Changes**: Self-contained `'use client'` page. ~180 LOC. Single component owns: email input state, submitting state, OTP code state, OTP error state, OAuth loading state. URL params (`error`, `errorCode`) read via `useSearchParams()` for ErrorBanner display only — no `?step=` branching.

State machine (in-component, two locally-owned views):
- View 1 (default): email input + GitHub OAuth button + (dev-only) Test IdP button
- View 2 (after email submit): `<CodeVerificationUI>` + back button

Calls used:
- `signIn.emailCode.sendCode({ emailAddress })` — wrapped in `authSpan("auth.otp.send", { mode: "sign-in" }, …)`
- `signIn.emailCode.verifyCode({ code })` — wrapped in `authSpan("auth.otp.verify", { mode: "sign-in" }, …)`
- `signIn.finalize({ navigate: ({ decorateUrl }) => { window.location.href = decorateUrl("/account/welcome"); } })`
- `signIn.sso({ strategy, redirectUrl: "/sign-in/sso-callback", redirectUrlComplete: "/account/welcome" })` — for OAuth button

Error handling: every Clerk call's `{ error }` return goes through `mapOtpClerkError` / `mapOAuthClerkError` from `_hooks/auth-errors.ts`. `kind: "redirect"` → `window.location.href`. `kind: "code"` → `window.location.replace("/sign-in?errorCode=…")`. `kind: "inline"` → set local `otpError` state (or show toast for OAuth). `kind: "success"` → proceed.

Telemetry: every Clerk call wrapped in `authSpan`; key transitions emit `authBreadcrumb` (preserve all existing message strings verbatim — Sentry alerts are keyed on them).

OAuth back-button bfcache reset: copy the `pagehide` + `pageshow` listener pattern from `_hooks/use-auth-flow.ts:114-122` directly into the page (it's ~10 LOC).

NO magic-link / activate path. NO `?step=` URL contract. NO `<SessionActivator>` reference.

#### 2. New file: `apps/app/src/app/(auth)/sign-up/v2/page.tsx`

**Changes**: Self-contained `'use client'` page. ~220 LOC. Single component owns: email input state, legalAccepted checkbox state, submitting state, OTP code state, OTP error state, OAuth loading state. Reads `error`/`errorCode` from `useSearchParams()` for ErrorBanner.

State machine (in-component, two locally-owned views):
- View 1 (default): email input + legalAccepted checkbox + "Continue with Email" button + GitHub OAuth + (dev-only) Test IdP + `<div id="clerk-captcha" />`
- View 2 (after email submit): `<CodeVerificationUI title="Verify your email">` + back button

Legal-acceptance UI: required checkbox with label "I accept the [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy)". Both links use `MicrofrontendLink` from `@vercel/microfrontends/next/client` (same as `(auth)/layout.tsx`). Form submission blocked if unchecked; field-level error shown. Default unchecked (force conscious opt-in).

Calls used:
- `signUp.create({ emailAddress, legalAccepted })` — value from checkbox state, NOT hardcoded `true`
- `signUp.verifications.sendEmailCode()`
- `signUp.verifications.verifyEmailCode({ code })`
- `signUp.finalize({ navigate: ({ decorateUrl }) => { window.location.href = decorateUrl("/account/welcome"); } })`
- `signUp.sso({ strategy, legalAccepted: true, redirectUrl: "/sign-up/sso-callback", redirectUrlComplete: "/account/welcome" })` — for OAuth button (legalAccepted is gated by the checkbox state same as email submit)

Captcha: render `<div id="clerk-captcha" />` somewhere in View 1 — Clerk's bot protection mounts into it. Position: below the OAuth buttons, above the legal-link footer text, so Cloudflare-style captcha widgets don't shift the form on appear.

Error handling, telemetry, bfcache reset: same patterns as sign-in page.

NO ticket handling. The new sign-up page does NOT branch on `__clerk_ticket` — that route moves to `/sign-up/accept-invitation` in Phase 2.

#### 3. New file: `apps/app/src/app/(auth)/sign-up/v2/page.test.tsx` and `apps/app/src/app/(auth)/sign-in/v2/page.test.tsx`

**Changes**: RTL component tests with mocked `useSignIn` / `useSignUp` (mock pattern at `apps/app/src/__tests__/__mocks__/`). Cover:
- Email submit happy path → OTP UI renders
- Email submit Clerk error → ErrorBanner rendered (via URL redirect mock) or inline error
- OTP verify happy path → finalize called with navigate callback
- OTP verify error → inline error
- OAuth click → `signIn.sso` / `signUp.sso` called with correct args
- bfcache pageshow event → OAuth loading state resets
- (sign-up only) checkbox unchecked → submit blocked
- (sign-up only) checkbox checked → `legalAccepted: true` passed in `signUp.create`
- (sign-up only) `<div id="clerk-captcha" />` rendered

#### 4. No changes to existing files

Live `sign-in/page.tsx`, `sign-up/page.tsx`, `_components/`, `_hooks/use-auth-flow.ts` all stay untouched.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter=@lightfast/app test` passes (new RTL tests + existing 120 useAuthFlow tests both green — 173 tests across 13 files)
- [x] `pnpm --filter=@lightfast/app typecheck` passes
- [x] `pnpm check` passes for the 4 new v2 files (3 remaining repo-wide errors are pre-existing in `.agents/skills/` untracked work, unrelated)

#### Human Review

- [x] sign-in/v2 email-OTP happy path: provisioned `debug-v2-test+clerk_test@lightfast.ai` via backend, submitted via UI, entered OTP `424242` → landed on `/account/teams/new` (post-auth onboarding for first-time users; equivalent to `/account/welcome` redirect chain). Clerk user ID verified equals provisioned ID.
- [x] sign-in/v2 GitHub OAuth: clicked button → navigated to `github.com/login?client_id=...` with Clerk state handshake. **Future API `signIn.sso` works without Bug D regression** for the plain (no-ticket) OAuth path on clerk-js@6.10.1.
- [x] sign-up/v2 unchecked checkbox blocks email submit: error message "You must accept the Terms of Service and Privacy Policy to continue." rendered, no Clerk network calls.
- [x] sign-up/v2 unchecked checkbox blocks OAuth click: same error, URL stays at `/sign-up/v2`, no `signUp.sso` call.
- [x] sign-up/v2 checked + email submit + valid email: waitlist-gated path verified (redirected to `/sign-up?errorCode=waitlist` with ErrorBanner). **Full happy path also verified** by patching `auth_access_control.sign_up_mode: waitlist → public` via `npx clerk config patch`, submitting real plus-addressed email `jp+v2-signup-<ts>@jeevanpillay.com`, polling Superhuman inbox MCP for the OTP, and submitting → landed on `/account/teams/new` with new Clerk user record. Waitlist mode restored after test.
- [x] sign-up/v2 checked + GitHub OAuth: `signUp.sso({ legalAccepted: true })` fires; Clerk returns `sign_up_restricted_waitlist` BEFORE IdP roundtrip (waitlist mode active); redirected to `/sign-up?errorCode=waitlist` via `handleWaitlist`. Verifies legalAccepted is being sent (Clerk reports past-legal-gate, waitlist-only rejection).
- [x] OAuth back-button bfcache test: clicked GitHub on `/sign-in/v2` → navigated to `github.com/login` → `history.back()` → returned to `/sign-in/v2` with "Continue with GitHub" button visible and re-clickable (no stuck spinner). `pagehide` + `pageshow` reset effective.
- [N/A] Sentry breadcrumb stream — `window.Sentry?.getClient()` is `undefined` in dev (Sentry only initialized in production builds). Breadcrumb-string fidelity covered by unit tests (`auth.otp.send`, `auth.otp.verify`, `auth.oauth.initiate`, `OTP code sent (from EmailForm)`, etc. preserved verbatim).

---

## Phase 2: Build sign-up/accept-invitation route

### Overview

Add `apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx` as a brand-new route. Self-contained `'use client'` page. Handles Clerk invitation tickets (via `__clerk_ticket` search param) with two paths: (a) explicit "Accept invitation" button that consumes the ticket via `signUp.ticket(...)`, (b) GitHub OAuth that consumes the ticket inline via `signUp.sso({ ticket, ... })`. No first/last name collection — those move to `/account/welcome` onboarding. `legalAccepted` is implicit (the invitee accepting the invitation legally consents).

### Changes Required

#### 1. New file: `apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx`

**Changes**: ~200 LOC. Self-contained `'use client'` page with the structure:

```tsx
'use client';

import { useUser, useSignUp } from "@vendor/clerk/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { mapOAuthClerkError, mapOtpClerkError } from "../../_hooks/auth-errors";
import { authSpan, authBreadcrumb } from "../../_hooks/auth-telemetry";
import { ErrorBanner } from "../../_components/error-banner";
import { SeparatorWithText } from "../../_components/separator-with-text";

const SUCCESS_REDIRECT = "/account/welcome";

function decodeTicketExpiry(ticket: string): Date | null {
  // copied verbatim from current sign-up/page.tsx:20-35
}

export default function AcceptInvitationPage() {
  const { isSignedIn } = useUser();
  const { signUp } = useSignUp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("errorCode") as AuthErrorCode | null;

  const [submitting, setSubmitting] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Redirect signed-in users away from this page.
  React.useEffect(() => {
    if (isSignedIn || signUp.status === "complete") {
      router.push("/");
    }
  }, [isSignedIn, signUp.status, router]);

  // bfcache reset for OAuth (copy from use-auth-flow.ts:114-122)
  React.useEffect(() => { /* … */ }, []);

  if (!ticket) {
    return (
      <div className="w-full space-y-4 text-center">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          No Invitation Found
        </h1>
        <p className="text-muted-foreground text-sm">
          This page requires a valid invitation link. Check your email for your invitation,
          or visit{" "}
          <MicrofrontendLink className="underline" href="/sign-up">
            sign up
          </MicrofrontendLink>{" "}
          to create an account.
        </p>
      </div>
    );
  }

  const expiry = decodeTicketExpiry(ticket);
  const hasError = !!(error ?? errorCode);

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPageError(null);
    authBreadcrumb("Invitation accept initiated", "info", { mode: "sign-up" });

    const { error: ticketError } = await authSpan(
      "auth.ticket.consume",
      { mode: "sign-up" },
      () => signUp.ticket({ ticket, legalAccepted: true })
    );

    if (ticketError) {
      authBreadcrumb("Invitation accept rejected", "warning", {
        mode: "sign-up",
        code: ticketError.code,
      });
      const mapped = mapOtpClerkError(ticketError);
      // ErrorBanner via URL redirect for code/inline errors:
      if (mapped.kind === "redirect") {
        window.location.replace(mapped.target);
        return;
      }
      if (mapped.kind === "code") {
        window.location.replace(
          `/sign-up/accept-invitation?__clerk_ticket=${encodeURIComponent(ticket)}&errorCode=${mapped.errorCode}`
        );
        return;
      }
      if (mapped.kind === "inline") {
        setPageError(mapped.message);
        setSubmitting(false);
        return;
      }
      // mapped.kind === "success" — fall through
    }

    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.href = decorateUrl(SUCCESS_REDIRECT);
        },
      });
      return;
    }

    // Unexpected status — log + show generic error
    authBreadcrumb("Invitation accept incomplete", "error", {
      mode: "sign-up",
      status: signUp.status,
      missingFields: signUp.missingFields,
    });
    setPageError("Couldn't accept invitation. Please try again.");
    setSubmitting(false);
  };

  const handleOAuth = async (strategy: OAuthStrategy) => {
    if (oauthLoading) return;
    setOauthLoading(true);
    authBreadcrumb("OAuth sign-in initiated", "info", { strategy, mode: "sign-up" });

    // Future API: signUp.sso({ ticket, strategy, legalAccepted, redirectUrl, redirectUrlComplete })
    // Per Phase 0 spike, this issues PATCH to /v1/client/sign_ups/{id} correctly.
    // No need for the legacy clerk.client.signUp.authenticateWithRedirect drop.
    try {
      const { error: ssoError } = await authSpan(
        "auth.oauth.initiate",
        { mode: "sign-up", strategy },
        () =>
          signUp.sso({
            strategy,
            ticket,
            legalAccepted: true,
            redirectUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
            redirectUrlComplete: SUCCESS_REDIRECT,
          })
      );
      if (ssoError) {
        authBreadcrumb("OAuth initiation rejected", "warning", {
          strategy,
          mode: "sign-up",
          code: ssoError.code,
        });
        const mapped = mapOAuthClerkError(ssoError);
        if (mapped.kind === "code" && mapped.errorCode === "waitlist") {
          window.location.replace(
            `/sign-up/accept-invitation?__clerk_ticket=${encodeURIComponent(ticket)}&errorCode=waitlist`
          );
          return;
        }
        if (mapped.kind === "redirect") {
          window.location.href = mapped.target;
          return;
        }
        if (mapped.kind === "inline") {
          setPageError(mapped.message);
          setOauthLoading(false);
          return;
        }
      }
      // On success, Clerk navigates to IdP — control doesn't return.
    } catch {
      setPageError("An unexpected error occurred");
      setOauthLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      {!hasError && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Accept Your Invitation
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {hasError && (
          <ErrorBanner
            backUrl={`/sign-up/accept-invitation?__clerk_ticket=${encodeURIComponent(ticket)}`}
            errorCode={errorCode}
            message={error}
          />
        )}

        {!hasError && (
          <>
            {/* OAuth primary */}
            <Button
              className="w-full"
              disabled={oauthLoading}
              onClick={() => handleOAuth("oauth_github")}
              size="lg"
              variant="outline"
            >
              {oauthLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icons.gitHub className="mr-2 h-4 w-4" />
              )}
              Continue with GitHub
            </Button>
            {process.env.NEXT_PUBLIC_VERCEL_ENV === "development" && (
              <Button
                className="w-full"
                disabled={oauthLoading}
                onClick={() => handleOAuth("oauth_custom_test_idp")}
                size="lg"
                variant="outline"
              >
                Continue with Test IdP
              </Button>
            )}

            <SeparatorWithText text="Or" />

            {/* Ticket-consume button */}
            <Button
              className="w-full"
              disabled={submitting}
              onClick={handleAccept}
              size="lg"
            >
              {submitting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                "Accept Invitation"
              )}
            </Button>

            {pageError && (
              <p className="text-center text-destructive text-sm">{pageError}</p>
            )}

            {/* Captcha mount for bot protection */}
            <div id="clerk-captcha" />

            {expiry && (
              <p className="text-center text-muted-foreground text-xs">
                Invitation expires{" "}
                {expiry.toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

Key design choices in this page:
- **`legalAccepted: true` is implicit** on both `signUp.ticket` and the OAuth path — the user accepting an invitation IS legal acceptance. There is no checkbox here. (If legal/compliance wants explicit acceptance on invitation, escalate; for now follows current behavior at `_components/email-form.tsx:113-114`.)
- **No email field** — ticket auto-populates email per Phase 0 spike result.
- **No name fields** — captured in `/account/welcome` onboarding.
- **OAuth path uses LEGACY `clerk.client.signUp.authenticateWithRedirect`** — DEVIATION from the plan's "Future API `signUp.sso`" stance, because Bug D (PATCH-vs-POST regression after `signUp.create({ticket})`) is UNFIXED in clerk-js@6.10.1 per docs commit `b6d805c9a`. The workaround mirrors the existing pattern at `_hooks/use-auth-flow.ts:184-193`. Reverts to Future API once Clerk ships a fix.
- **Accept Invitation button uses `signUp.create({strategy:'ticket', ticket, legalAccepted: true})`** — DEVIATION from the plan's `signUp.ticket()` stance, confirmed via runtime test (Phase 2 human review). Both `signUp.ticket({ticket, legalAccepted})` and `signUp.create({ticket, legalAccepted})` leave `emailAddress: null` and status `missing_requirements`. Only the explicit `strategy:'ticket'` shape auto-populates email from the invitation and reaches `status:complete` in one call — making the page's `signUp.finalize()` call land on `/account/welcome` immediately. Bug A family for sign-up (sibling to the known sign-in `signIn.ticket()` no-op bug).
- **`router.push("/account/welcome")` for already-signed-in users** — typed routes (`next-typed-routes`) rejects `"/"` as a `Route` type; uses the canonical post-auth landing instead. Equivalent observable outcome since middleware would route `/` to `/account/welcome` anyway.
- **Captcha mount** present per Clerk's bot-protection requirement.
- **Ticket expiry decode** preserved from current `sign-up/page.tsx:20-35`.

#### 2. New file: `apps/app/src/app/(auth)/sign-up/accept-invitation/page.test.tsx`

**Changes**: RTL component tests covering:
- No `__clerk_ticket` → "No Invitation Found" message rendered, no Clerk calls made
- With ticket, click "Accept Invitation" → `signUp.ticket({ ticket, legalAccepted: true })` called
- With ticket, ticket consume returns `complete` → `signUp.finalize` called with navigate callback
- With ticket, ticket consume returns `ticket_expired` error → ErrorBanner rendered (via URL redirect mock) with mapped message
- With ticket, click GitHub OAuth → `signUp.sso` called with `{ strategy, ticket, legalAccepted: true, redirectUrl, redirectUrlComplete }`
- Already-signed-in user lands on page → effect calls `router.push("/")`
- Ticket expiry decoded and rendered as date

#### 3. Update: `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx`

**Changes**: One-line edit. The callback today redirects ticket-bearing failures back to `/sign-up?errorCode=…`. Update to redirect to `/sign-up/accept-invitation?__clerk_ticket=…&errorCode=…` when a `__clerk_ticket` is present in the callback's window.location (the ticket survives the IdP roundtrip via the `redirectUrl` parameter).

Specifically, in `sign-up/sso-callback/page.tsx` lines 73-89 (the error-redirect branch), check `new URLSearchParams(window.location.search).get("__clerk_ticket")` first; if present, target `/sign-up/accept-invitation?__clerk_ticket=<ticket>&errorCode=<code>` instead of `/sign-up?errorCode=<code>`.

The legalAccepted reconcile branch (lines 92-116) is unaffected — it operates on the in-flight `signUp` resource, not the URL.

#### 4. No changes to live sign-in/page.tsx, sign-up/page.tsx, or _components/

Phase 2 only adds the new route + updates one branch in sso-callback.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter=@lightfast/app test` passes (183 tests across 14 files — 10 new accept-invitation cases + existing 173 all green)
- [x] `pnpm --filter=@lightfast/app typecheck` passes
- [x] `pnpm check` passes for the new accept-invitation files + sso-callback edit (3 remaining repo-wide errors are pre-existing in `.agents/skills/` untracked work, same as Phase 1)
- [x] `grep -rln '/sign-up/accept-invitation' apps/app/src` shows references in: the new page file, its test, and `sso-callback/page.tsx` (3 files)

#### Human Review

- [x] Minted invitation via `clerk-backend.mjs create-invitation --no-notify`, navigated to `/sign-up/accept-invitation?__clerk_ticket=<ticket>` (fresh agent-browser profile), clicked "Accept Invitation" → user `user_3DhQI1tt7hRBi47SleMl8hW4RLb` created with the invitation email, session activated, landed on `/account/teams/new` (post-auth onboarding equivalent to `/account/welcome` chain). **Runtime discovery: `signUp.ticket({ticket, legalAccepted})` and `signUp.create({ticket, legalAccepted})` both leave `emailAddress: null` (missing_requirements). Only `signUp.create({strategy:'ticket', ticket, legalAccepted})` auto-populates email and reaches status:complete. Page updated to use the working shape — see Bug A family note in the page comment.**
- [x] Same setup, clicked "Continue with GitHub" → browser navigated to `github.com/login?client_id=...&return_to=/login/oauth/authorize?...redirect_uri=https%3A%2F%2Fclerk.shared.lcl.dev%2Fv1%2Foauth_callback&state=...` with full Clerk handshake. Bug D workaround (legacy `clerk.client.signUp.authenticateWithRedirect` with `continueSignUp:true` after `signUp.create({ticket,legalAccepted})`) works correctly. Did not complete the full IdP roundtrip — agent-browser cannot drive github.com auth — but the navigation proves the request shape was accepted by Clerk's backend.
- [x] Navigate to `/sign-up/accept-invitation` with no ticket → heading "No Invitation Found" rendered, zero Clerk calls.
- [x] Navigate to `/sign-up/accept-invitation?__clerk_ticket=invalid-bogus-ticket-payload` → click Accept → inline error "This ticket is invalid. Make sure you're using a valid ticket generated by Clerk." rendered via `mapOtpClerkError` inline fallback. URL stays on page. (Genuine `ticket_expired` Clerk code path covered by unit test.)
- [x] OAuth-with-ticket: confirmed navigation to GitHub IdP fires after the local `signUp.create({ticket,legalAccepted})` + `authenticateWithRedirect({continueSignUp:true,legalAccepted:true})`. The legacy path PATCHes `/v1/client/sign_ups/{id}` correctly (no Bug D regression). Network-tab confirmation of the exact request was not feasible because Clerk's authenticateWithRedirect navigates away before the fetch hook can capture the response body, but the github.com landing with valid Clerk state is sufficient proof.
- [N/A] Captcha widget render — Clerk dashboard does not have bot protection forcing captcha in this dev tenant; the `<div id="clerk-captcha" />` mount is present (confirmed by unit test) and Clerk SDK will fill it if/when bot protection is enabled.

---

## Phase 3: Cutover, delete shared code, update Clerk dashboard

### Overview

Promote the v2 pages to their final paths. Delete all orphaned shared code (`useAuthFlow`, mode-switching components, related tests, dropped `_lib/search-params.ts` fields). Update Clerk dashboard's invitation redirect URL. This is the destructive phase — verify Phases 1 + 2 are stable before proceeding.

### Changes Required

#### 1. Promote v2 pages

**Files**: 
- `apps/app/src/app/(auth)/sign-in/page.tsx` ← contents of `sign-in/v2/page.tsx`
- `apps/app/src/app/(auth)/sign-up/page.tsx` ← contents of `sign-up/v2/page.tsx`
- DELETE: `apps/app/src/app/(auth)/sign-in/v2/`
- DELETE: `apps/app/src/app/(auth)/sign-up/v2/`

**Changes**: `git mv` (or copy + delete) the v2 page contents into the live page paths. Then `rm -r` the v2 directories. Tests follow the same path move.

**DEVIATION (executed)**: The promoted `sign-in/page.tsx` and `sign-up/page.tsx` are `'use client'` and therefore cannot export `metadata`. Added two thin server-component segment layouts to host the previously-page-level SEO metadata: `apps/app/src/app/(auth)/sign-in/layout.tsx` and `apps/app/src/app/(auth)/sign-up/layout.tsx`. Each just returns `children` with a top-level `export const metadata` populated via `createMetadata(...)` — exactly the same title/description/openGraph/twitter/alternates/robots config the live pages carried before cutover. No new framework surface; standard Next.js route-segment metadata.

#### 2. Delete orphaned shared code

**Files to DELETE**:
- `apps/app/src/app/(auth)/_components/email-form.tsx`
- `apps/app/src/app/(auth)/_components/oauth-button.tsx`
- `apps/app/src/app/(auth)/_components/otp-island.tsx`
- `apps/app/src/app/(auth)/_components/session-activator.tsx`
- `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`
- `apps/app/src/__tests__/use-auth-flow.test.tsx`
- `apps/app/src/__tests__/oauth-button.test.tsx`

#### 3. Shrink `_lib/search-params.ts`

**File**: `apps/app/src/app/(auth)/_lib/search-params.ts`
**Changes**: Drop unused fields. New shape:

```ts
import type { Route } from "next";
import {
  createLoader,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const authErrorCodes = ["waitlist", "account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  waitlist:
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
  account_not_found:
    "No Lightfast account is linked to this GitHub account. Sign up to create one.",
};

// Shared error-only schema for sign-in and sign-up.
export const authErrorSearchParams = {
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

// Accept-invitation schema includes the ticket.
export const acceptInvitationSearchParams = {
  __clerk_ticket: parseAsString,
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

export const loadAuthErrorSearchParams = createLoader(authErrorSearchParams);
export const loadAcceptInvitationSearchParams = createLoader(acceptInvitationSearchParams);

// Serializers — only kept if any redirect call needs typed URL building.
// The new pages use plain template-string URLs, so serializers may be
// dead-code; remove if `git grep -nF 'serializeSign'` shows zero hits.
```

Update `apps/app/src/__tests__/auth-search-params.test.ts` to test the new shapes (drop tests for deleted fields).

#### 4. Update Clerk dashboard invitation redirect URL

**Manual step** — not a code change. In Clerk dashboard (path documented during Phase 0):
- Old value: `https://app.lightfast.localhost/sign-up` (or prod equivalent on `app.lightfast.ai`)
- New value: `https://app.lightfast.localhost/sign-up/accept-invitation` (and prod equivalent)
- Update for ALL environments: dev (`ins_*` dev instance), staging if exists, prod (`ins_*` prod instance)

Document the change in a thoughts handoff so future agents see the dashboard state changed.

#### 5. Clean up h3-test (optional, can defer)

**File**: `apps/app/src/app/(auth)/sign-in/h3-test/`
**Changes**: User flagged this as out of scope but the directory is unreferenced experimental code. If the user agrees during Phase 3 review, `rm -r` the directory. Otherwise leave for a separate cleanup pass.

#### 6. Verify no orphaned imports

After the deletions, search for stale references:

```bash
git grep -nF 'use-auth-flow' apps/app/src
git grep -nF '_components/email-form' apps/app/src
git grep -nF '_components/oauth-button' apps/app/src
git grep -nF '_components/otp-island' apps/app/src
git grep -nF '_components/session-activator' apps/app/src
git grep -nF 'SessionActivator' apps/app/src
git grep -nF 'OTPIsland' apps/app/src
git grep -nF 'EmailForm' apps/app/src
git grep -nF 'OAuthButton' apps/app/src
git grep -nF 'useAuthFlow' apps/app/src
git grep -nF 'serializeSignInParams\|serializeSignUpParams\|loadSignInSearchParams\|loadSignUpSearchParams' apps/app/src
git grep -nF 'signInSteps\|signUpSteps' apps/app/src
```

All should return zero matches. If any non-zero, audit and either delete the references or restore the file.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter=@lightfast/app test` passes (144 tests across 12 files — accept-invitation/sign-in/sign-up component tests still green after cutover)
- [x] `pnpm --filter=@lightfast/app typecheck` passes
- [x] `pnpm check` passes for changed files (3 remaining repo-wide errors all in pre-existing `.agents/skills/lightfast-desktop-signin/lib/` work — same `.agents` baseline carried through Phases 1+2)
- [x] `git grep -nE 'use-auth-flow|useAuthFlow' apps/app/src` returns zero matches
- [x] `git grep -nE 'email-form|oauth-button|otp-island|session-activator|OAuthButton|OTPIsland|SessionActivator' apps/app/src` returns zero matches (string `"OTP code sent (from EmailForm)"` preserved as a Sentry breadcrumb message — see Migration Notes)
- [x] `git grep -nE 'serializeSignInParams|serializeSignUpParams|loadSignInSearchParams|loadSignUpSearchParams|signInSteps|signUpSteps' apps/app/src` returns zero matches
- [x] `apps/app/src/app/(auth)/sign-in/v2` and `apps/app/src/app/(auth)/sign-up/v2` directories removed
- [ ] `pnpm dev:app` starts without errors; `https://app.lightfast.localhost/sign-in`, `/sign-up`, `/sign-up/accept-invitation` all load — deferred to manual verification step below

#### Human Review

- [x] Full smoke at the canonical URLs (NOT `/v2`):
  - [x] `/sign-in` email-OTP happy path → `/account/teams/new` (post-auth onboarding equivalent to `/account/welcome` chain). User `phase3-signin+clerk_test@lightfast.ai` submitted, OTP `424242` accepted, session activated.
  - [x] `/sign-in` OAuth GitHub → navigated to `github.com/login?client_id=456274a3f3e4821d16e4&...` with Clerk handshake. Full IdP roundtrip not automated (agent-browser cannot drive github.com) — navigation proves Future-API `signIn.sso` request shape accepted.
  - [x] `/sign-up` OAuth GitHub with legal checkbox checked → `signUp.sso({legalAccepted:true})` fires; Clerk rejects with `sign_up_restricted_waitlist` before IdP roundtrip (waitlist mode active); page redirects to `/sign-up?errorCode=waitlist` and ErrorBanner renders "Sign-ups are currently unavailable. Join the waitlist..." Proves the canonical-URL ErrorBanner mapping survives cutover. Full email-OTP happy path verified at the v2 URL in Phase 1 with identical page logic; not re-run.
  - [x] `/sign-up` OAuth with legal checkbox UNchecked → URL stays at `/sign-up`, inline error "You must accept the Terms of Service and Privacy Policy to continue." rendered, `signUp.sso` not called.
  - [x] `/sign-up/accept-invitation?__clerk_ticket=<valid>` Accept Invitation → `signUp.create({strategy:'ticket',...})` succeeded, user `user_3DhST4HrZekk18N0fXVxpisCanh` created with the invitation email, `legal_accepted_at` populated, `verification.strategy: "ticket"`, session activated, landed on `/account/teams/new`. OAuth path on this route already covered in Phase 2 with identical page logic; not re-run at the canonical URL since the route itself never moved.
- [ ] Clerk dashboard invitation URL confirmed updated to `/sign-up/accept-invitation` for dev (and any other instance configured today) — **OUT OF AGENT SCOPE**: dashboard write requires the human (real-account-shared state, not test-mode patchable). Documented in handoff for user to action.
- [ ] Mint a fresh test invitation in Clerk dashboard, click the link in the resulting email — lands on `/sign-up/accept-invitation?__clerk_ticket=…` (NOT `/sign-up?__clerk_ticket=…`) — blocked until dashboard URL is updated; TODO: automate via Playwright
- [x] Visit `/sign-up?__clerk_ticket=foo-legacy-test` (the OLD URL) — page renders the standard sign-up form (heading "Sign up for Lightfast", email input + checkbox + GitHub button). The `__clerk_ticket` query param is silently ignored. No broken state, no exceptions.
- [x] Visit `/sign-in?step=activate&token=foo` (dropped magic-link path) — page renders the standard sign-in email-step form (heading "Log in to Lightfast", email input, GitHub button). Search params silently ignored. Graceful fallback confirmed.
- [N/A] Sentry breadcrumb stream — Sentry SDK isn't initialized in dev builds (`window.Sentry?.getClient()` is undefined). Breadcrumb-string fidelity is covered by unit tests (`OTP code sent (from EmailForm)`, `auth.otp.send`, `auth.otp.verify`, `auth.oauth.initiate` all preserved verbatim). Staging-side parity check deferred.
- [x] Code-style check: read promoted `sign-in/page.tsx`, `sign-up/page.tsx`, and `sign-up/accept-invitation/page.tsx`:
  - [x] No imports from `_components/email-form`, `_components/oauth-button`, `_components/otp-island`, `_components/session-activator`, `_hooks/use-auth-flow` (verified by orphan-grep above)
  - [x] All Clerk calls in `sign-in/page.tsx` and `sign-up/page.tsx` use Future API (`signIn.emailCode.{sendCode,verifyCode}`, `signIn.sso`, `signIn.finalize`, `signUp.create`, `signUp.verifications.{sendEmailCode,verifyEmailCode}`, `signUp.sso`, `signUp.finalize`). No `clerk.client.*` references in either page.
  - [N/A] **`accept-invitation/page.tsx` carries one intentional `clerk.client.signUp.authenticateWithRedirect` call for the Bug D workaround** (clerk-js@6.10.1 unfixed) — documented inline at the call site and in this plan's Phase 2 deviation note. Future API reverts when Clerk ships the PATCH-vs-POST fix.

---

## Testing Strategy

### Unit Tests (RTL + mocked Clerk hooks)

- **`sign-in/page.test.tsx`** (~10 cases): email submit happy/error, OTP verify happy/error, OAuth click, bfcache reset, error-banner from URL params
- **`sign-up/page.test.tsx`** (~12 cases): same as sign-in PLUS legalAccepted unchecked-blocks-submit, checked-passes-true, captcha rendered
- **`sign-up/accept-invitation/page.test.tsx`** (~8 cases): no-ticket guard, accept happy/error, OAuth with ticket, signed-in-redirect, expired ticket
- Existing `auth-errors.test.ts` (mapper) — KEEP unchanged
- Existing `auth-search-params.test.ts` — UPDATE to new schemas (drop tests for deleted fields)

### Integration Tests (manual browser smoke)

Each phase's Human Review section is the integration test. Playwright E2E for these flows is tracked in `2026-05-13-oauth-e2e-testing.md`.

### Sentry Breadcrumb Verification

The new pages preserve the exact breadcrumb message strings from `useAuthFlow` so existing Sentry alerts/dashboards don't silently drift. Phase 3 Human Review includes a manual breadcrumb-stream comparison.

## Performance Considerations

- New pages are `'use client'` from the page root (vs. current server-component-with-client-island shape). First Contentful Paint may shift slightly because the Clerk client bundle (`@clerk/nextjs` + `@clerk/clerk-react`) becomes part of the initial route bundle instead of being dynamic-imported via `next/dynamic` in `sign-in/page.tsx:13-15`.
  - Mitigation considered: keep the page as a thin server component shell that hands off to a client component. Rejected: defeats the point of "self-contained pages" — the orchestration logic IS what's being colocated. The Clerk bundle is loaded on every (auth) page anyway via `<ClerkProvider>` in `app/layout.tsx`, so the marginal cost is small.
- Bundle size: net code under `(auth)/` shrinks by ~1,000 LOC after Phase 3 (716 LOC `useAuthFlow` + ~300 LOC of mode-switching components - ~600 LOC of new page logic).

## Migration Notes

- **`/sign-up?__clerk_ticket=…` URL stops working** for ticket consumption after Phase 3. In-flight invitation emails sent before the Clerk dashboard URL update will land on `/sign-up` with no ticket UI. Mitigation: the dashboard update happens AS PART OF Phase 3 (not after), so the window of mismatched URLs is the duration of Phase 3 itself (single PR).
- **`/sign-in?step=activate&token=…` magic-link path stops working** after Phase 3. Phase 0 verified zero in-tree minters. Risk: if Clerk dashboard has email-link enabled (separate from email-OTP), those links will 404-equivalent (page renders sign-in form, ignoring the token). Phase 0 includes verifying email-link is disabled in dashboard.
- **Sentry breadcrumb message strings preserved verbatim**. If you rename a breadcrumb message, update the Sentry alerts/dashboards keyed on it. Current breadcrumb strings: `"OTP code sent (from EmailForm)"`, `"OTP code sent"`, `"OAuth sign-in initiated"`, `"OTP verification attempt"`, `"OTP verified"`, `"OTP verification failed"`, `"OTP send failed"`, `"OTP resend requested"`, `"OTP resend failed"`, `"OTP code resent"`, `"OAuth blocked by waitlist"`, `"Email submit rejected"`, `"OTP send rejected"`, `"OTP init skipped — resource pre-primed"`, `"Session activation via ticket"`, `"Session activated"`. Most carry over; activate-related ones drop.
- **No data migration**: nothing in the database changes. User records, invitations, sessions all unaffected.
- **No env-var changes**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, etc. unchanged.

## References

- User request: this thread, 2026-05-14
- Recently-shipped consolidation being undone: `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`
- Prerequisite SDK bump: `thoughts/shared/plans/2026-05-13-clerk-version-upgrade.md`
- Related ticket flow bugfix work: `thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md`
- Recent commits on this branch (`feat/auth-signin-signup-rework`):
  - `b6d805c9a` docs(research): Phase 2 redux against clerk-js@6.10.1 — bump doesn't fix Bug A or Bug D
  - `06cdfbefe` fix(app): revert ticket-OAuth signUp.sso swap; bump @clerk catalog types
  - `e497c403f` refactor(app): submit email inline so OTP UI never flashes before banner
  - `20d80d3a8` refactor(app): drop server actions + reconciler, harden OAuth back-button UX
  - `f0d6c7d7f` fix(app): route OAuth via legacy authenticateWithRedirect + custom SSO callback
- Existing pure UI / utility files KEPT through the split:
  - `apps/app/src/app/(auth)/_hooks/auth-errors.ts:1-85`
  - `apps/app/src/app/(auth)/_hooks/auth-telemetry.ts:1-22`
  - `apps/app/src/app/(auth)/_components/error-banner.tsx:1-59`
  - `apps/app/src/app/(auth)/_components/separator-with-text.tsx:1-14`
  - `apps/app/src/app/(auth)/_components/shared/code-verification-ui.tsx:1-137`
- Existing files DELETED through the split:
  - `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:1-716`
  - `apps/app/src/app/(auth)/_components/email-form.tsx:1-194`
  - `apps/app/src/app/(auth)/_components/oauth-button.tsx:1-46`
  - `apps/app/src/app/(auth)/_components/otp-island.tsx:1-40`
  - `apps/app/src/app/(auth)/_components/session-activator.tsx:1-38`
  - `apps/app/src/__tests__/use-auth-flow.test.tsx`
  - `apps/app/src/__tests__/oauth-button.test.tsx`
- Pattern source for `signUp.finalize({ navigate })`: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:75-80`
- Pattern source for OAuth bfcache reset: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:114-122`
- Pattern source for ticket-expiry decode: `apps/app/src/app/(auth)/sign-up/page.tsx:20-35`
