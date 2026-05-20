# Auth UI Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reset the custom auth UI to Clerk's current custom-flow APIs and upgrade Clerk patch versions.

**Architecture:** Keep the same auth routes and visual components, but replace stale page-level Clerk workarounds with direct Core 3 hook calls and a small shared helper layer for navigation and error routing. Boundary A only: no middleware, API, tRPC, desktop, org, or waitlist server-action changes.

**Tech Stack:** Next.js App Router, React 19, Clerk Core 3 hooks through `@vendor/clerk`, Vitest, Testing Library, pnpm catalogs.

---

### Task 1: Red Tests

**Files:**
- Modify: `apps/app/src/app/(auth)/sign-in/page.test.tsx`
- Modify: `apps/app/src/app/(auth)/sign-up/accept-invitation/page.test.tsx`

- [ ] Add a sign-in test asserting `form_identifier_not_found` redirects to `/sign-in?errorCode=account_not_found` and renders the waitlist CTA.
- [ ] Change invitation acceptance tests to expect Clerk ticket-strategy sign-up creation and session activation.
- [ ] Remove invitation OAuth workaround assertions against `clerk.client.signUp.authenticateWithRedirect`.
- [ ] Run `pnpm --filter @lightfast/app test -- src/app/\\(auth\\)/sign-in/page.test.tsx src/app/\\(auth\\)/sign-up/accept-invitation/page.test.tsx` and confirm the new expectations fail against the old implementation.

### Task 2: Shared Auth Helpers

**Files:**
- Modify: `apps/app/src/app/(auth)/_hooks/auth-errors.ts`
- Modify: `apps/app/src/app/(auth)/_hooks/auth-navigate.ts`
- Modify: `apps/app/src/app/(auth)/_lib/search-params.ts`

- [ ] Map account-not-found Clerk errors to `account_not_found`.
- [ ] Remove comments that describe stale Clerk runtime bugs as current facts.
- [ ] Keep `decorateUrl()` in every finalize/setActive navigation path.
- [ ] Run the focused helper/page tests and keep them green.

### Task 3: Page Reset

**Files:**
- Modify: `apps/app/src/app/(auth)/sign-in/page.tsx`
- Modify: `apps/app/src/app/(auth)/sign-up/page.tsx`
- Modify: `apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx`
- Modify: `apps/app/src/app/(auth)/sso-callback/page.tsx`
- Modify: `apps/app/src/app/(auth)/sign-up/continue/page.tsx`

- [ ] Rebuild sign-in around `signIn.emailCode` and `signIn.sso`.
- [ ] Rebuild sign-up around `signUp.create`, `signUp.verifications`, and `signUp.sso`.
- [ ] Rebuild invitation acceptance around Clerk's ticket sign-up strategy.
- [ ] Keep captcha mounts on sign-up, invitation, OAuth callback, and continuation pages.
- [ ] Keep visual components and copy consistent with the approved diagrams.
- [ ] Run all `(auth)` page tests until green.

### Task 4: Clerk Upgrade

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

- [ ] Update Clerk catalog pins to `@clerk/nextjs@7.3.7`, `@clerk/backend@3.4.11`, and `@clerk/shared@4.12.2`.
- [ ] Run `pnpm install --lockfile-only` to regenerate the lockfile.
- [ ] Run focused auth tests again after the lockfile update.

### Task 5: Verification

**Files:**
- No planned source edits.

- [ ] Run `pnpm --filter @lightfast/app test -- src/app/\\(auth\\)`.
- [ ] Run `pnpm --filter @lightfast/app typecheck`.
- [ ] Start or reuse the app dev server and verify `/sign-in`, `/sign-up`, and `/sign-up/accept-invitation` in the in-app browser.
