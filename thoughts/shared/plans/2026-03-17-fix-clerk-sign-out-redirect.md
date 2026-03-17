# Fix Clerk Sign-Out Redirect Implementation Plan

## Overview

Sign-out from the user dropdown leaves the user on the current page because `signOut()` is called with no `redirectUrl` and no `afterSignOutUrl` is set on `<ClerkProvider>`. This applies the belt-and-suspenders fix: a global `afterSignOutUrl` default on `<ClerkProvider>` plus explicit `redirectUrl` on every `signOut()` call site.

---

## Current State Analysis

Three `signOut()` call sites in the console app and one in the auth app. Only the standalone `sign-out-button.tsx` (not-found page) passes a `redirectUrl` — it works correctly. The two primary header components and the auth app header all call `signOut()` with no arguments.

Neither `ClerkProvider` instance (console `(app)/layout.tsx` or auth `layout.tsx`) sets `afterSignOutUrl`.

Clerk's redirect resolution order (highest → lowest):
1. `signOut({ redirectUrl })` — **missing** on 3/4 call sites
2. `<ClerkProvider afterSignOutUrl>` — **missing** on both providers
3. Clerk Dashboard default — unknown, causing the "stays on page" race condition

### Key Discoveries

- `apps/console/src/app/(app)/layout.tsx:9` — `authUrl` is already imported; just add the prop
- `apps/console/src/components/app-header.tsx:63` — `signOut()` called with no args; needs import + redirectUrl
- `apps/console/src/components/user-page-header.tsx:69` — same as above
- `apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx:65` — same; auth app is same-origin so `/sign-in` relative path is correct
- `apps/console/src/app/(app)/(org)/sign-out-button.tsx:16` — already correct; no change needed
- `apps/console/src/lib/related-projects.ts:9-12` — `authUrl` resolves to `http://localhost:4104` (dev) / `https://lightfast.ai` (prod); confirmed client-safe (used in `"use client"` components)

---

## Desired End State

After this plan is complete:
- Clicking "Sign out" from the user dropdown immediately navigates the user to `${authUrl}/sign-in`
- No race condition — the client navigates before the middleware re-evaluates
- All `signOut()` calls are consistent with the established pattern in `sign-out-button.tsx`

### Verification

- [ ] Clicking "Sign out" from the dropdown on an org page (`AppHeader`) redirects to `/sign-in`
- [ ] Clicking "Sign out" from the dropdown on a user page (`UserPageHeader`) redirects to `/sign-in`
- [ ] Sign-out from the auth app's user page redirects to `/sign-in`
- [ ] The not-found page `SignOutButton` is unaffected (no change needed)

---

## What We're NOT Doing

- Changing `UserMenu` in `@repo/ui` — it is correctly decoupled via `onSignOut` prop
- Adding sign-out to the auth app's `ClerkProvider` (`afterSignOutUrl`) — sign-out rarely occurs from the auth app itself; per-call is sufficient
- Changing `sign-out-button.tsx` — already correct
- Using the `<SignOutButton>` Clerk component — we keep the `useClerk().signOut()` pattern for consistency with the existing codebase

---

## Implementation Approach

Two phases, applied together (belt-and-suspenders):

1. **Global default** — add `afterSignOutUrl` to the console `ClerkProvider`. This catches any future `signOut()` call that forgets to pass `redirectUrl`.
2. **Per-call explicit** — pass `redirectUrl` in each `signOut()` call. This immediately navigates the client without waiting for the `ClerkProvider` fallback or middleware re-evaluation, eliminating the race condition.

---

## Phase 1: Add `afterSignOutUrl` to Console ClerkProvider

### Overview

One-line addition to the console app layout. Acts as the catch-all fallback for any sign-out that doesn't pass an explicit `redirectUrl`.

### Changes Required

#### 1. Console App Layout — ClerkProvider
**File**: `apps/console/src/app/(app)/layout.tsx`

`authUrl` is already imported at line 9. Add `afterSignOutUrl` prop to `<ClerkProvider>`:

```tsx
<ClerkProvider
  afterSignOutUrl={`${authUrl}/sign-in`}   // ← add this line
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl="/account/welcome"
  signInUrl={`${authUrl}/sign-in`}
  signUpFallbackRedirectUrl="/account/welcome"
  signUpUrl={`${authUrl}/sign-up`}
  taskUrls={{
    "choose-organization": "/account/teams/new",
  }}
>
```

### Success Criteria

#### Automated Verification
- [x] Type check passes: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm check`

#### Manual Verification
- [ ] `<ClerkProvider>` renders without console errors

---

## Phase 2: Add `redirectUrl` to All `signOut()` Call Sites

### Overview

Update the three call sites that currently call `signOut()` with no arguments. Mirrors the pattern already established in `sign-out-button.tsx`.

### Changes Required

#### 1. AppHeader (org-scoped pages)
**File**: `apps/console/src/components/app-header.tsx`

Add import for `authUrl` and update the `onSignOut` prop:

```tsx
// Add import (after existing imports, before component)
import { authUrl } from "~/lib/related-projects";

// Change line 63 from:
onSignOut={() => void signOut()}
// To:
onSignOut={() => void signOut({ redirectUrl: `${authUrl}/sign-in` })}
```

#### 2. UserPageHeader — Console (user-scoped pages)
**File**: `apps/console/src/components/user-page-header.tsx`

Same pattern as AppHeader:

```tsx
// Add import
import { authUrl } from "~/lib/related-projects";

// Change line 69 from:
onSignOut={() => void signOut()}
// To:
onSignOut={() => void signOut({ redirectUrl: `${authUrl}/sign-in` })}
```

#### 3. UserPageHeader — Auth App
**File**: `apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx`

The auth app is same-origin so a relative path is correct (no cross-port issue in dev):

```tsx
// Change line 65 from:
onSignOut={() => void signOut()}
// To:
onSignOut={() => void signOut({ redirectUrl: "/sign-in" })}
```

No new import needed.

### Success Criteria

#### Automated Verification
- [x] Type check passes: `pnpm --filter @lightfast/console typecheck`
- [x] Lint passes: `pnpm check`

#### Manual Verification
- [ ] Click "Sign out" on an org page → redirected immediately to `/sign-in` (no flash of current page)
- [ ] Click "Sign out" on a user account page → same result
- [ ] In dev (`pnpm dev:app`), sign-out redirects to `http://localhost:4104/sign-in` (auth app port), not the console port

---

## Testing Strategy

### Manual Testing Steps
1. Sign in and navigate to any org page (e.g. `/:slug`)
2. Open user dropdown → click "Sign out"
3. Verify: immediate navigation to `/sign-in`, no flash of the protected page
4. Repeat from a user-scoped page (e.g. `/account/settings/general`)
5. Verify the not-found page sign-out button is unaffected (still works)

### Dev Environment
- Run with `pnpm dev:app` (microfrontends mode — both apps active)
- Verify redirect goes to auth app port 4104, not console port 4107

---

## References

- Research: `thoughts/shared/research/2026-03-17-clerk-sign-out-redirect.md`
- Correct pattern: `apps/console/src/app/(app)/(org)/sign-out-button.tsx:16`
- Clerk docs: https://clerk.com/docs/custom-flows/sign-out
- Clerk docs: https://clerk.com/docs/nextjs/reference/components/clerk-provider
