---
date: 2026-03-09T00:13:23+0000
researcher: jeevanpillay
git_commit: 08a6515acc6b9b9cadf200e291d4298e0a608df8
branch: feat/auth-server-actions-migration
repository: lightfast
topic: "Auth Testing Strategy: Sign-In and Sign-Up Flows with Clerk"
tags: [research, auth, testing, playwright, clerk, e2e, sign-in, sign-up]
status: complete
last_updated: 2026-03-09
last_updated_by: jeevanpillay
---

# Research: Auth Testing Strategy — Sign-In & Sign-Up

**Date**: 2026-03-09T00:13:23+0000
**Researcher**: jeevanpillay
**Git Commit**: `08a6515acc6b9b9cadf200e291d4298e0a608df8`
**Branch**: `feat/auth-server-actions-migration`
**Repository**: lightfast

## Research Question

The `apps/auth` infrastructure has just been re-architected to a server-actions-first pattern. We need to:
1. Design an automated testing system for all sign-in and sign-up flows
2. Determine the optimal Clerk dashboard settings to enable testability

## Summary

The auth app uses a **URL-driven, multi-step architecture** with 3 irreducible client islands (`OTPIsland`, `OAuthButton`, `SessionActivator`) and server actions for validation/redirect orchestration. Currently **zero automated tests exist**. The optimal testing strategy is a two-layer approach: unit tests (Vitest) for pure server-action logic, and Playwright E2E tests using `@clerk/testing` for UI flows. The critical enabling decision for E2E automation is to use **email verification CODE** (not magic link) in Clerk dashboard — this unlocks the `+clerk_test` email bypass with OTP code `424242`, which the `CLAUDE.md` already documents.

---

## Current Architecture (as-is)

### Auth Flow Steps

**Sign-In** (`apps/auth/src/app/(app)/(auth)/sign-in/page.tsx`)

| URL Params | Component Rendered | Type |
|---|---|---|
| `step=email` (default) | `EmailForm` + `OAuthButton` (+ password link in dev) | Server |
| `step=code&email=...` | `OTPIsland` | Client Island |
| `step=password` (dev/preview only) | `PasswordForm` | Server |
| `step=activate&token=...` | `SessionActivator` | Client Island |
| `error=...` | `ErrorBanner` | Server |

**Sign-Up** (`apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`)

| URL Params | Component Rendered | Type |
|---|---|---|
| `step=email` (default) | `EmailForm` + `OAuthButton` + legal copy | Server |
| `step=code&email=...` | `OTPIsland` | Client Island |
| `step=code&ticket=...` | `OTPIsland` (invitation auto-complete or OTP) | Client Island |
| `error=...` | `ErrorBanner` | Server |

### Server Actions

- `initiateSignIn` (`_actions/sign-in.ts:10`): Validates email via Zod → redirects to `?step=code&email=...`
- `initiateSignUp` (`_actions/sign-up.ts:11`): Validates email+ticket via Zod → redirects to `?step=code&email=...`
- `signInWithPassword` (`_actions/sign-in-password.ts:14`): Full server-side BAPI flow: lookup user → verify password → mint sign-in token (60s TTL) → redirect to `?step=activate&token=...`

### Client Islands

- `OTPIsland` (`_components/otp-island.tsx`): Calls `signIn.emailCode.sendCode()` or `signUp.create()` + `signUp.verifications.sendEmailCode()` on mount. Auto-verifies when 6 digits entered. Handles ticket flow. Navigates to `consoleUrl/account/teams/new` on success.
- `OAuthButton` (`_components/oauth-button.tsx`): Calls `signIn.sso()` or `signUp.sso()` with `oauth_github`. Redirects to SSO callback pages.
- `SessionActivator` (`_components/session-activator.tsx`): Receives server-minted token, calls `signIn.ticket()` to activate session, navigates to `consoleUrl/account/teams/new`.

### Middleware

`middleware.ts`: Clerk middleware via NEMO composition. Key rules:
- Authenticated users hitting `/sign-in` or `/sign-up` → redirect to `consoleUrl/account/teams/new` (pending) or `consoleUrl/:orgSlug` (active)
- Root path `/` → redirect to `/sign-in` if unauthenticated
- Non-public routes → `auth.protect()`

### No Existing Tests

Zero test files exist under `apps/auth/`. No `playwright.config.ts`, no `vitest.config.*`, no `__tests__/` directories.

---

## Clerk Dashboard Settings Recommendation

This is the most important decision for unlocking automated testing.

### Recommended Settings

| Setting | Recommendation | Reason |
|---|---|---|
| **Sign-up with email** | ✅ ON | App requires email; it's the only sign-up option |
| **Require email address** | ✅ ON | Email is the account identifier |
| **Verify at sign-up** | ✅ ON (Recommended) | Critical for preventing spam accounts |
| **Verification method: Email verification CODE** | ✅ ON | Required for `+clerk_test` OTP bypass (`424242`) |
| **Verification method: Email verification LINK** | ❌ OFF | Magic links cannot use the `424242` bypass; near-impossible to automate in E2E |
| **Sign-in with email: Email verification CODE** | ✅ ON | Matches OTP island implementation; enables test automation |
| **Sign-in with email: Email verification LINK** | ❌ OFF | Same reason — magic links block automated testing |
| **Sign-up with phone** | ❌ OFF | Not in the app |
| **Sign-in with phone** | ❌ OFF | Not in the app |
| **Sign-up with username** | ❌ OFF | Not in the app (password form uses email as identifier) |
| **Sign-in with username** | ❌ OFF | Not in the app |
| **Sign-up with password** | ❌ OFF | Password is dev/preview-only via BAPI server-side; not Clerk's built-in password sign-up |
| **Add password to account** | Optional | Only needed if password remains a feature |
| **Client Trust** | Optional OFF | Password flow is dev-only BAPI; not relevant for production |
| **Sign-in with passkey** | ❌ OFF | Not in the app |
| **Add passkey to account** | ❌ OFF | Not in the app |
| **First and last name** | ✅ ON (optional) | Useful for UX; do NOT require — not collected in sign-up form |
| **Require first and last name** | ❌ OFF | Sign-up form only captures email |
| **Allow users to delete their accounts** | Product decision | Consider OFF until self-serve deletion is built |

### The Critical Choice: Code vs. Link

The OTP code strategy is non-negotiable for automated testing:

```
Email: some-email+clerk_test@lightfast.ai
Code:  424242   ← always works for +clerk_test addresses
```

This is already documented in `apps/auth/CLAUDE.md`. Magic links cannot use this bypass, requiring real email interception (headless email services, mailinator, etc.) which adds significant complexity and fragility.

---

## Testing Strategy

### Layer 1: Unit Tests (Vitest) — Pure Logic

No browser needed. Test server-action validation in isolation.

**Target files:**
- `_actions/sign-in.ts` — email Zod validation, redirect behavior
- `_actions/sign-up.ts` — email + ticket Zod validation
- `_actions/sign-in-password.ts` — error branches (mock `clerkClient`)
- `_lib/search-params.ts` — nuqs step literal parsing

**What to test:**
```
src/__tests__/
  actions/
    sign-in.test.ts         ← initiateSignIn: valid email → code redirect; invalid → error redirect
    sign-up.test.ts         ← initiateSignUp: valid email → code redirect; with ticket; invalid → error
    sign-in-password.test.ts ← password: account not found, locked, rate limited, unexpected error
  lib/
    search-params.test.ts   ← step defaults, literal validation, ticket params
```

**Mock strategy for `signInWithPassword`:**
- Mock `@vendor/clerk/server` `clerkClient` to return controlled users/errors
- Test all `if (code === "user_locked")` and `if (code === "too_many_requests")` branches
- Verify `captureException` is called for unexpected errors (mock Sentry)

### Layer 2: E2E Tests (Playwright + @clerk/testing) — Full UI Flows

**Installation:**
```bash
pnpm add -D @clerk/testing @playwright/test -w  # or filtered to apps/auth
```

**File structure:**
```
apps/auth/
  playwright.config.ts
  e2e/
    global.setup.ts
    tests/
      sign-in-email.spec.ts      ← email code flow (primary path)
      sign-up-email.spec.ts      ← sign-up email code flow
      sign-in-password.spec.ts   ← dev-only password flow (gated)
      redirects.spec.ts          ← middleware + authenticated user redirect
      error-states.spec.ts       ← invalid email, wrong OTP, back navigation
      invitation.spec.ts         ← ?__clerk_ticket= sign-up flow
```

**`playwright.config.ts`:**
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalSetup: './e2e/global.setup.ts',
  use: {
    baseURL: 'http://localhost:4104', // auth app port
  },
  webServer: {
    command: 'pnpm dev:auth',
    port: 4104,
    reuseExistingServer: !process.env.CI,
  },
})
```

**`e2e/global.setup.ts`:**
```ts
import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'

setup.describe.configure({ mode: 'serial' })
setup('global setup', async () => {
  await clerkSetup()
})
```

### E2E Test Scenarios

#### Sign-In Email Code (Primary Flow)

```ts
// sign-in-email.spec.ts
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { test, expect } from '@playwright/test'

test('sign-in: email code happy path', async ({ page }) => {
  await setupClerkTestingToken({ page })
  await page.goto('/sign-in')

  // Step 1: email form renders
  await expect(page.getByRole('heading', { name: 'Log in to Lightfast' })).toBeVisible()

  // Step 2: submit email → triggers initiateSignIn server action
  await page.getByPlaceholder('Email Address').fill('test+clerk_test@lightfast.ai')
  await page.getByRole('button', { name: 'Continue with Email' }).click()

  // Step 3: OTP island renders (URL: ?step=code&email=...)
  await expect(page).toHaveURL(/step=code/)
  await expect(page.getByText('We sent a verification code')).toBeVisible()

  // Step 4: enter magic test code
  await page.getByRole('textbox').fill('424242')

  // Step 5: redirect to console (redirecting state → navigation)
  await expect(page.getByText('Redirecting...')).toBeVisible()
})

test('sign-in: invalid email shows error', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByPlaceholder('Email Address').fill('not-an-email')
  await page.getByRole('button', { name: 'Continue with Email' }).click()
  await expect(page).toHaveURL(/error=/)
  await expect(page.getByText(/valid email/i)).toBeVisible()
})

test('sign-in: wrong OTP code shows inline error', async ({ page }) => {
  await setupClerkTestingToken({ page })
  await page.goto('/sign-in?step=code&email=test%2Bclerk_test%40lightfast.ai')
  await page.getByRole('textbox').fill('000000')
  await expect(page.locator('[data-invalid]')).toBeVisible() // or error text
})

test('sign-in: back button returns to email step', async ({ page }) => {
  await page.goto('/sign-in?step=code&email=test%2Bclerk_test%40lightfast.ai')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL('/sign-in')
})
```

#### Sign-Up Email Code

```ts
// sign-up-email.spec.ts
test('sign-up: email code happy path', async ({ page }) => {
  await setupClerkTestingToken({ page })
  await page.goto('/sign-up')

  await page.getByPlaceholder('Email Address').fill('new-user+clerk_test@lightfast.ai')
  await page.getByRole('button', { name: 'Continue with Email' }).click()

  await expect(page).toHaveURL(/step=code/)
  await page.getByRole('textbox').fill('424242')
  await expect(page.getByText('Redirecting...')).toBeVisible()
})
```

#### Already-Authenticated Redirect (Middleware)

```ts
// redirects.spec.ts
import { clerk } from '@clerk/testing/playwright'

test('authenticated user: sign-in page redirects to console', async ({ page }) => {
  await page.goto('/')

  // Pre-auth programmatically (no UI)
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'email_code',
      identifier: 'admin+clerk_test@lightfast.ai',
    },
  })

  // Try to visit sign-in — should redirect away
  await page.goto('/sign-in')
  await expect(page).not.toHaveURL('/sign-in')
})

test('unauthenticated root: redirects to sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/sign-in')
})
```

#### Password Sign-In (Dev/Preview Only)

```ts
// sign-in-password.spec.ts
// This test should be skipped in production environments
test.skip(
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
  'Password sign-in is dev/preview only'
)

test('password: valid credentials mint token and activate session', async ({ page }) => {
  await setupClerkTestingToken({ page })
  await page.goto('/sign-in?step=password')

  await page.getByPlaceholder('Email or username').fill('admin@lightfast.ai')
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in with Password' }).click()

  // Should land on activate step
  await expect(page).toHaveURL(/step=activate/)
  await expect(page.getByText('Signing in...')).toBeVisible()
})

test('password: account not found shows error', async ({ page }) => {
  await page.goto('/sign-in?step=password')
  await page.getByPlaceholder('Email or username').fill('nonexistent@lightfast.ai')
  await page.getByPlaceholder('Password').fill('wrongpassword')
  await page.getByRole('button', { name: 'Sign in with Password' }).click()
  await expect(page).toHaveURL(/error=Account\+not\+found/)
})
```

### Invitation Ticket Flow

```ts
// invitation.spec.ts
test('sign-up: invitation ticket banner shows', async ({ page }) => {
  // Simulate invitation URL (Clerk format)
  await page.goto('/sign-up?__clerk_ticket=test-ticket-123')
  await expect(page.getByText("You've been invited to join Lightfast")).toBeVisible()
})
```

---

## Clerk Testing Infrastructure Details

### How Testing Tokens Work

Clerk runs a WAF at edge that blocks bot traffic. Without testing tokens, automated tests hit `"Bot traffic detected"` errors.

- `clerkSetup()` in global setup fetches one token for the whole test suite
- `setupClerkTestingToken({ page })` injects it per-test
- Available in **both dev and production** (since Aug 2025)
- Production limitation: `email_code` strategy in `clerk.signIn()` is dev-only; use `emailAddress` param for production

### The +clerk_test Bypass

```
Email pattern: anything+clerk_test@yourdomain.com
OTP code:      424242
Applies to:    sign-up, sign-in, adding email to account
Does NOT work: magic links (email verification link strategy)
Does NOT count toward dev instance email send limits
```

### What `@clerk/testing` Provides

| Export | Purpose |
|---|---|
| `@clerk/testing/playwright` | `clerkSetup`, `setupClerkTestingToken`, `clerk` |
| `clerk.signIn()` | Programmatic sign-in (no UI), skips auth flow entirely |
| `clerk.signOut()` | Programmatic sign-out |
| `clerk.loaded()` | Wait for Clerk to initialize on page |

**No `clerk.signUp()` equivalent exists** — sign-up flows must be tested through the UI using `setupClerkTestingToken` + `424242` OTP.

---

## Code References

- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts:10` — `initiateSignIn` server action
- `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts:11` — `initiateSignUp` server action
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in-password.ts:14` — `signInWithPassword` server action
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:16` — `OTPIsland` client island
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx:17` — `OAuthButton` client island
- `apps/auth/src/app/(app)/(auth)/_components/session-activator.tsx:12` — `SessionActivator` client island
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:7-25` — step literals and nuqs cache
- `apps/auth/src/middleware.ts:46-53` — public route matchers
- `apps/auth/src/middleware.ts:78-131` — Clerk middleware with redirect logic
- `apps/auth/CLAUDE.md` — test credentials and `424242` code documented

---

## Architecture Documentation

### Why No `clerk.signUp()` Helper

Clerk's `@clerk/testing` intentionally only provides `clerk.signIn()`. Sign-up creates new user records, which must be cleaned up between test runs. The recommended pattern is:
1. Use a fixed `+clerk_test` email per test (same user, re-uses existing account on second run)
2. Or provision test users via Backend API before tests and delete after

### Why Email Code Over Magic Link (Testing Perspective)

Magic links require:
- Intercepting real email (mailhog, mailpit, mailosaur, etc.)
- Extracting the click link from email body
- Handling link expiry timing

Email codes require:
- Input `424242` (static, always works for `+clerk_test` addresses)
- Zero infrastructure beyond `@clerk/testing`

### Server Action Architecture Testability

The server actions are pure functions (validate → redirect):
- No database calls in `initiateSignIn`/`initiateSignUp` — entirely testable with Zod mocks
- `signInWithPassword` calls `clerkClient()` — mockable via `vi.mock('@vendor/clerk/server')`
- Redirect destinations are deterministic from input → easy to assert in unit tests

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-03-08-auth-server-actions-design.md` — original architectural research that led to the server-actions-first migration; covers Clerk BAPI vs. FAPI boundary and why OTPIsland must remain a client component
- `thoughts/shared/plans/2026-03-09-auth-server-actions-migration.md` — 5-phase migration plan; mentions testing section noting "no existing unit tests for auth components" and "integration tests are the relevant layer"

---

## Related Research

- `thoughts/shared/research/2026-03-08-auth-server-actions-design.md`

---

## Open Questions

1. **Test user cleanup strategy**: Should `+clerk_test` emails be unique per test run (via `Date.now()` suffix) or reused? Reuse is simpler but may hit "email already registered" on sign-up tests. Consider: create new user per run, tear down via BAPI `deleteUser` in `afterEach`.

2. **Console URL in tests**: After successful auth, OTPIsland navigates to `consoleUrl/account/teams/new`. Should E2E tests assert the final console URL (requires console to be running), or mock the navigation? Consider: intercept `window.location.href` assignment in tests.

3. **CI environment**: Playwright tests need `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` for development instance. Should these be the dev instance keys (allows `email_code` strategy + `424242`) or production keys?
   - **Recommended**: Use dev instance keys for CI — enables `email_code` strategy and `424242` bypass.

4. **OAuth (GitHub) testing**: `OAuthButton` initiates GitHub OAuth, which redirects to GitHub for browser-based auth. This cannot be automated without mocking. Consider:
   - Skip OAuth flow tests entirely (trust Clerk's own testing)
   - Test only the error case (when `onError` is called)
   - Mock GitHub OAuth in a separate environment-level Playwright test

5. **Vitest vs. native Next.js test runner**: No `vitest.config.ts` exists in the monorepo. Check if there's a shared test config in the workspace root before setting up a new one for `apps/auth`.
