---
date: 2025-12-16T00:00:00+08:00
researcher: Claude
git_commit: ebb0c0a9
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Auth app sign-in redirect loop with Clerk organizations"
tags: [research, codebase, auth, clerk, organizations, redirect, session-tasks]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
---

# Research: Auth App Sign-in Redirect Loop

**Date**: 2025-12-16
**Researcher**: Claude
**Git Commit**: ebb0c0a9
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Why does the auth app redirect back to `/sign-in` after successful login? The issue is related to Clerk's organization feature.

## Summary

**Root Cause**: The team creation flow (`/account/teams/new`) does NOT call `setActive({ organization })` after creating an org. This means the Clerk "choose-organization" session task is never completed, leaving users in a "pending" state.

According to [Clerk's Session Tasks documentation](https://clerk.com/docs/guides/configure/session-tasks):

> "auth.protect(): Redirects pending users to sign-in where they complete tasks."

**The Fix**: Add `setActive({ organization: data.id })` to `CreateTeamButton.tsx` in the `onSuccess` handler.

**Why this happens**:
1. User signs in → redirected to team creation
2. User creates team → org created but NOT set as active
3. User redirected to workspace creation (`/new`)
4. If anything interrupts this flow, user hits `auth.protect()` → redirect to sign-in

## Key Finding: Session Tasks Behavior

### Clerk's Three Session States

From the documentation:
1. **Signed-in**: Authentication complete, all tasks finished, full access granted
2. **Pending**: Authentication succeeded but session tasks remain incomplete; access restricted by default
3. **Signed-out**: Authentication failed or never attempted; no access

### Critical Behavior

> "By default, pending sessions are treated as signed-out across Clerk's authentication context."

This means:
- `auth.protect()` treats pending users as signed-out and redirects to sign-in
- `<SignedOut>` component renders for pending users
- Auth utilities return null for user identifiers (unless `treatPendingAsSignedOut: false`)

## Detailed Findings

### Authentication Flow Architecture

The system uses two apps with Clerk for authentication:

1. **Auth App** (`apps/auth`, port 4103): Handles sign-in/sign-up UI with **custom components**
2. **Console App** (`apps/console`, port 4107): Main application requiring organization membership

### Current Implementation

#### Auth App Has `<RedirectToTasks />` (`apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:31-39`)

```typescript
export default function SignInPage() {
  return (
    <>
      <SignedOut>
        <RedirectToTasks />  // ← This should redirect to taskUrls["choose-organization"]
      </SignedOut>
      <SignInForm />
    </>
  );
}
```

#### Auth App Layout Also Has It (`apps/auth/src/app/(app)/(auth)/layout.tsx:14-16`)

```typescript
<SignedOut>
  <RedirectToTasks />
</SignedOut>
```

### The Problem

The `<RedirectToTasks />` is wrapped in `<SignedOut>`, which should work because pending users are treated as signed-out. However:

1. **`<RedirectToTasks />` should redirect to `taskUrls["choose-organization"]`** which is `${consoleUrl}/account/teams/new`
2. **But console's `/account/teams/new` doesn't have the task completion flow** - it's just a form to create a team

The disconnect is:
- Clerk's task system expects the task to be **completed** (organization selected/created AND set as active)
- The current team creation flow creates an org but may not properly signal task completion to Clerk

### Console Middleware Route Flow

```typescript
// apps/console/src/middleware.ts:125-169
if (isPublicRoute(req)) { /* allow */ }
else if (isTeamCreationRoute(req)) { /* allow - includes /account/teams/new */ }
else if (isUserScopedRoute(req)) { /* allow */ }
else if (isV1ApiRoute(req)) { /* allow */ }
else if (isOrgScopedRoute(req)) { await auth.protect(); }
else if (isOrgPageRoute(req)) { await auth.protect(); }
else if (isPending) { redirect to /account/teams/new }
else { await auth.protect(); }  // ← Pending users hitting this = redirect to sign-in
```

### Why Pending Users Might Hit `auth.protect()`

1. **Root path `/` doesn't have a page** - Console app has no `page.tsx` at root
2. **No `isPublicRoute` match** - Root `/` isn't in public routes
3. **No `isTeamCreationRoute` match** - Root `/` isn't `/account/teams/new`
4. **Falls through to `isPending` check** - Should redirect to team creation
5. **BUT if session not synced** - `isPending` is `false`, hits `auth.protect()`

### The Missing Piece: `<TaskChooseOrganization />`

According to Clerk docs, for custom sign-in implementations:

> "For custom implementations, check `Session.currentTask` via `useSession()` hook"

The auth app's custom `<SignInForm />` doesn't:
1. Check for `Session.currentTask`
2. Render `<TaskChooseOrganization />` when task is pending
3. Handle the task completion flow inline

## Root Cause Analysis

### Primary Cause: `setActive()` Not Called After Team Creation

**This is the root cause.** The team creation flow creates a Clerk organization but does NOT call `setActive({ organization })`. According to Clerk's Session Tasks documentation, calling `setActive()` is what completes the "choose-organization" task.

Without this call:
1. User creates team → org exists in Clerk
2. User is still "pending" (no active org in session)
3. Any `auth.protect()` call treats them as signed-out
4. User is redirected to sign-in

The code explicitly documents this decision (incorrectly):
```typescript
// apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:24-26
/**
 * Note: No setActive() call needed - user can select org from dropdown.
 * The middleware will activate the org when they navigate to /:slug routes.
 */
```

### Secondary Cause: Custom Sign-in Without Task Handling

The auth app uses custom sign-in components (`SignInForm`, `SignInEmailInput`, etc.) instead of Clerk's built-in `<SignIn />` component. The built-in component has task handling embedded, but custom components require explicit implementation.

### Tertiary Cause: Cross-App Session Timing

When redirecting between auth (4103) and console (4107):
1. Session may not be immediately available
2. `auth()` returns no `userId`
3. User falls through to `auth.protect()`
4. Clerk redirects pending user to sign-in

## Code References

- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:31-39` - Sign-in page with `<RedirectToTasks />`
- `apps/auth/src/app/(app)/(auth)/layout.tsx:14-16` - Layout with `<RedirectToTasks />`
- `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx` - Custom sign-in form (no task handling)
- `apps/auth/src/app/layout.tsx:95-97` - ClerkProvider with taskUrls
- `apps/console/src/middleware.ts:93-199` - Console middleware
- `apps/console/src/app/(app)/(user)/account/teams/new/page.tsx` - Team creation page

## Potential Solutions

### Option 1: Add Task Handling to Custom Sign-in

In the auth app's sign-in flow, after authentication completes, check for pending tasks:

```typescript
import { useSession } from "@clerk/nextjs";
import { TaskChooseOrganization } from "@clerk/nextjs";

function SignInFlow() {
  const { session } = useSession();

  if (session?.currentTask?.key === "choose-organization") {
    return <TaskChooseOrganization redirectUrlComplete="/dashboard" />;
  }

  return <SignInForm />;
}
```

### Option 2: Use Clerk's Built-in `<SignIn />`

Replace custom components with Clerk's `<SignIn />` which has task handling built-in.

### Option 3: Redirect Directly to Team Creation After OAuth

In the OAuth flow, set `redirectUrlComplete` to `/account/teams/new` instead of `consoleUrl`:

```typescript
// apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx
await signIn.authenticateWithRedirect({
  strategy,
  redirectUrl: "/sign-in/sso-callback",
  redirectUrlComplete: `${consoleUrl}/account/teams/new`,  // Direct to team creation
});
```

### Option 4: Call `setActive()` in Team Creation (Recommended Fix)

The team creation button explicitly states it does NOT call `setActive()`:

```typescript
// apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:24-26
/**
 * Note: No setActive() call needed - user can select org from dropdown.
 * The middleware will activate the org when they navigate to /:slug routes.
 */
```

However, the workspace creation button DOES call `setActive()`:

```typescript
// apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:176-179
// Step 2: Set active organization before bulk linking (required for org-scoped procedures)
if (setActive) {
  await setActive({ organization: selectedOrgId });
}
```

**The gap**: Between team creation and workspace creation, the user remains "pending". If they navigate away or anything interrupts the flow, they hit `auth.protect()` and get redirected to sign-in.

**Fix**: Add `setActive()` call to `CreateTeamButton.tsx` after successfully creating the org:

```typescript
onSuccess: async (data) => {
  // Complete the "choose-organization" task
  if (setActive) {
    await setActive({ organization: data.id });
  }

  toast({ title: "Team created!", description: `Successfully created ${teamName}` });
  router.push(`/new?teamSlug=${data.slug}`);
},
```

## Architecture Documentation

### User States in Clerk

| State | userId | orgId | `auth.protect()` behavior |
|-------|--------|-------|---------------------------|
| Signed-out | null | null | Redirect to signInUrl |
| Pending | exists | null | Redirect to signInUrl (by default) |
| Signed-in | exists | exists | Allow through |

### Route Protection with Pending Users

| Route Type | Default Behavior | With `treatPendingAsSignedOut: false` |
|------------|------------------|--------------------------------------|
| Public routes | Allowed | Allowed |
| Protected (`auth.protect()`) | Redirect to sign-in | Redirect to sign-in |
| Manual `isPending` check | Works correctly | Works correctly |

## Open Questions

1. **Does creating a team via tRPC and calling `setActive({ organization })` complete the "choose-organization" task?** - Need to verify this signals task completion to Clerk

2. **Should the auth app render `<TaskChooseOrganization />` inline?** - This would keep users on auth app for task completion

3. **Is `<RedirectToTasks />` actually firing?** - Add logging to verify the redirect chain

## Related Documentation

- [Clerk Session Tasks Documentation](https://clerk.com/docs/guides/configure/session-tasks)
- [TaskChooseOrganization Component](https://clerk.com/docs/components/control/task-choose-organization)
- [RedirectToTasks Component](https://clerk.com/docs/components/control/redirect-to-tasks)
