# Auth Middleware: Make /early-access a Public Route

## Overview

Add `/early-access` to the `isPublicRoute` matcher in `apps/auth/src/middleware.ts` so unauthenticated users can access the early-access waitlist form. The early-access page was recently moved from www to auth (commit `7c481b0c7`), but the middleware was not updated to allow public access.

## Current State Analysis

The middleware at `apps/auth/src/middleware.ts:46-53` defines public routes:
```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/api/health",
]);
```

Non-public routes are protected at line 116-118:
```ts
if (!isPublicRoute(req)) {
  await auth.protect();
}
```

`/early-access` is not in the public list, so unauthenticated visitors are blocked.

## Desired End State

- `/early-access` is accessible to all users (authenticated and unauthenticated)
- No redirect logic for authenticated users on this route
- The waitlist form renders and submits correctly for everyone

### Verification:
- `pnpm build:auth` succeeds
- `/early-access` is accessible without signing in

## What We're NOT Doing

- NOT adding redirect logic for authenticated users on `/early-access`
- NOT changing any other middleware behavior
- NOT modifying the early-access page or components

## Phase 1: Add /early-access to Public Routes

### Overview
Single change to the `isPublicRoute` matcher.

### Changes Required:

#### 1. Update `isPublicRoute` matcher
**File**: `apps/auth/src/middleware.ts`
**Changes**: Add `"/early-access"` to the route matcher array

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/api/health",
  "/early-access",
]);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (no lint script in auth, used workspace check)
- [ ] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [ ] `/early-access` renders the waitlist form when not signed in
- [ ] `/early-access` renders the waitlist form when signed in (no redirect)
- [ ] Form submission works end-to-end
- [ ] Sign-in and sign-up flows are unaffected

## References

- Middleware: `apps/auth/src/middleware.ts:46-53`
- Early access page: `apps/auth/src/app/(app)/(early-access)/page.tsx`
- Move plan: `thoughts/shared/plans/2026-03-09-move-early-access-to-auth.md`
