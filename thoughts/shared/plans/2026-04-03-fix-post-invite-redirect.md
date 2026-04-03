# Fix Post-Invite Redirect (404 / Redirect Loop) Implementation Plan

## Overview

After completing the create-org onboarding (invite step), the app redirects to `/new?teamSlug=<slug>`. `/new` is not a real route — it is caught by the `[slug]` dynamic segment, which calls `requireOrgAccess("new")`, gets a Clerk 404, and renders a `notFound()`. The fix is a two-line change: both redirect targets must point to `/${teamSlug}` instead.

## Current State Analysis

Two files emit the broken redirect:

1. **Server action** — `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts:50`
   ```ts
   redirect(`/new?teamSlug=${teamSlug}`);
   ```

2. **"Skip for now" link** — `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_components/invite-form.tsx:29`
   ```tsx
   <Link href={`/new?teamSlug=${teamSlug}`}>Skip for now</Link>
   ```

Both paths (submit form + skip) terminate at the same broken destination.

The `[slug]` layout at `apps/app/src/app/(app)/(org)/[slug]/layout.tsx:57` calls `requireOrgAccess(slug)`. When `slug === "new"`, Clerk throws org-not-found, setting `hasAccess = false` and calling `notFound()` at line 63.

The pending session failure mode (failure mode B in the research doc) is also fixed by the same change: `/new` is not in `isPendingAllowedRoute` (`/account/(.*)`), but `/${teamSlug}` is not either. However, by the time the user reaches the invite step, `setActive` has already been called in `team-name-form.tsx:32` and the session is active — so the pending gate is not a concern on the happy path.

## Desired End State

After completing the invite step (or skipping it), the user lands on `/${teamSlug}` — the newly created org's dashboard, served by `apps/app/src/app/(app)/(org)/[slug]/page.tsx`.

### Verification:
- Create a new org named `test-org` → complete the invite step → browser navigates to `/test-org`
- Skip the invite step → browser navigates to `/test-org`
- No 404, no redirect loop

## What We're NOT Doing

- Adding activity logging to org creation (separate concern, system-wide gap)
- Fixing the Inngest dev proxy 404 (dev tooling, separate ticket)
- Adding a "you're all set" interstitial page
- Wiring up real email sending in `inviteTeammates`

## Implementation

### Phase 1: Fix redirect targets

#### 1. Server action

**File**: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts`

**Line 50** — change:
```ts
// Before
redirect(`/new?teamSlug=${teamSlug}`);

// After
redirect(`/${teamSlug}`);
```

#### 2. Skip link

**File**: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_components/invite-form.tsx`

**Line 29** — change:
```tsx
// Before
<Link href={`/new?teamSlug=${teamSlug}`}>Skip for now</Link>

// After
<Link href={`/${teamSlug}`}>Skip for now</Link>
```

#### 3. Middleware — allow tRPC org creation for pending sessions

**File**: `apps/app/src/proxy.ts`

The `/api/trpc/organization.create` POST is called from the `/account/teams/new` page, which a pending session (no org yet) is allowed to visit. But the tRPC route itself is NOT in `isPendingAllowedRoute`, so `auth.protect()` intercepts it and redirects to `/sign-in/tasks` before it ever reaches the `userScopedProcedure` handler (which is designed to allow pending sessions).

**Fix**: add the route to `isPendingAllowedRoute`:
```ts
const isPendingAllowedRoute = createRouteMatcher([
  "/account/(.*)",
  // tRPC mutations callable before an org exists.
  // userScopedProcedure handles auth; middleware must not block these.
  "/api/trpc/organization.create(.*)",
]);
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (pre-existing proxy.ts formatting errors unrelated to this fix; changed files are clean)

#### Manual Verification:
- [ ] Sign up as a new user with no org → create org → submit invite step → lands on `/${teamSlug}` dashboard (not 404)
- [x] Create org → click "Skip for now" → lands on `/${teamSlug}` dashboard ✅ verified with `redirect-fix-apr3`

## References

- Research doc: `thoughts/shared/research/2026-04-03-login-create-org-flow-bugs.md`
- Server action: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts:50`
- Skip link: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_components/invite-form.tsx:29`
