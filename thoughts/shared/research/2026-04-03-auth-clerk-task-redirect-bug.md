---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "Auth ClerkProvider layout — /sign-in/tasks redirect bug and consolidation opportunity"
tags: [research, codebase, clerk, auth, layout, tasks]
status: complete
last_updated: 2026-04-03
---

# Research: Auth Clerk Task Redirect Bug and ClerkProvider Consolidation

**Date**: 2026-04-03
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

Post sign-in for a new user in `apps/app/src/app/(auth)/`, the user gets redirected to a non-existent page:
`http://localhost:3024/sign-in/tasks?redirect_url=http%3A%2F%2Flocalhost%3A3024%2Faccount%2Fsettings%2Fgeneral`

Also: it may make sense to collapse and share `ClerkProvider` between `(app)/layout.tsx` and `(auth)/layout.tsx`.

## Summary

There are three interlocking issues:

1. **Missing `/sign-in/tasks` page** — Clerk's middleware-level task detection redirects to `signInUrl + "/tasks"` (`/sign-in/tasks`) when it detects a pending task. This page does not exist.
2. **Inverted `Show` conditional in `(auth)/layout.tsx`** — `<Show when="signed-out"><RedirectToTasks /></Show>` fires only when the user IS signed out, which is the opposite of the intended guard (redirect a signed-in user with pending tasks away from auth pages).
3. **Two ClerkProvider instances** — `(app)/layout.tsx` and `(auth)/layout.tsx` both independently instantiate `ClerkProvider` with slightly different props. The root `app/layout.tsx` has no `ClerkProvider` and is a clean Server Component, making it a candidate for consolidation.

## Detailed Findings

### 1. The `/sign-in/tasks` Route Does Not Exist

**`apps/app/src/app/(auth)/sign-in/`** contains:
- `page.tsx` → `/sign-in`
- `sso-callback/page.tsx` → `/sign-in/sso-callback`

There is no `tasks/` subdirectory. Clerk's task system (activated server-side via `organizationSyncOptions` in the middleware) redirects to `<signInUrl>/tasks` when it detects a pending task. With `signInUrl="/sign-in"`, this becomes `/sign-in/tasks`.

**Why the middleware triggers it:** `apps/app/src/proxy.ts:71-78` configures `clerkMiddleware` with:
```typescript
{
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  afterSignInUrl: "/account/welcome",
  afterSignUpUrl: "/account/welcome",
  organizationSyncOptions: {
    organizationPatterns: ["/:slug", "/:slug/(.*)"],
  },
}
```
When `organizationSyncOptions` is active and a signed-in user visits a protected route (like `/account/settings/general`) with no active organization, Clerk detects the pending "choose-organization" task and redirects to `/sign-in/tasks?redirect_url=<original_url>`.

**Why `taskUrls` on `ClerkProvider` doesn't help here:** Both layout files set:
```typescript
taskUrls={{ "choose-organization": "/account/teams/new" }}
```
But this is **client-side** configuration for the Clerk JS SDK in the browser. The server-side middleware redirect to the task hub (`/sign-in/tasks`) happens before any React renders. The `taskUrls` prop tells Clerk where to send the user from inside the task hub page, not whether to use the hub at all.

**What should exist at `/sign-in/tasks`:** Clerk's task components (`TaskChooseOrganization`, `TaskResetPassword`, both exported from `@vendor/clerk/client`) are designed to render at this URL. The task hub page would render the appropriate task component, which then uses `taskUrls` to redirect to the final destination.

### 2. Inverted `Show` Conditional in `(auth)/layout.tsx`

`apps/app/src/app/(auth)/layout.tsx:24-26`:
```tsx
<Show when="signed-out">
  <RedirectToTasks />
</Show>
```

`Show` is a direct re-export from `@clerk/nextjs` (`vendor/clerk/src/client/index.ts`). `<Show when="signed-out">` renders its children **when the user IS signed out**.

`<RedirectToTasks />` is Clerk's component that redirects to the first pending task URL from `taskUrls`. Tasks belong to signed-in users.

As written, this fires `<RedirectToTasks />` for signed-out users visiting auth pages — a state where tasks don't exist. The guard that would make logical sense for "redirect a signed-in user with pending tasks away from auth pages" would be `<Show when="signed-in">`.

### 3. Two ClerkProvider Instances

**`(app)/layout.tsx:15-25`** (`apps/app/src/app/(app)/layout.tsx`):
```tsx
<ClerkProvider
  afterSignOutUrl="/sign-in"
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl="/account/welcome"
  signInUrl="/sign-in"
  signUpFallbackRedirectUrl="/account/welcome"
  signUpUrl="/sign-up"
  taskUrls={{ "choose-organization": "/account/teams/new" }}
  waitlistUrl="/early-access"
>
```

**`(auth)/layout.tsx:15-23`** (`apps/app/src/app/(auth)/layout.tsx`):
```tsx
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl="/account/teams/new"
  signInUrl="/sign-in"
  signUpFallbackRedirectUrl="/account/teams/new"
  signUpUrl="/sign-up"
  taskUrls={{ "choose-organization": "/account/teams/new" }}
  waitlistUrl="/early-access"
>
```

**Prop diff:**

| Prop | `(app)/layout.tsx` | `(auth)/layout.tsx` |
|---|---|---|
| `afterSignOutUrl` | `/sign-in` | absent |
| `signInFallbackRedirectUrl` | `/account/welcome` | `/account/teams/new` |
| `signUpFallbackRedirectUrl` | `/account/welcome` | `/account/teams/new` |
| `taskUrls["choose-organization"]` | `/account/teams/new` | `/account/teams/new` |
| `waitlistUrl` | `/early-access` | `/early-access` |
| `signInUrl` / `signUpUrl` | `/sign-in` / `/sign-up` | same |

The fallback redirect difference: `(app)` sends to `/account/welcome` (a server-side relay that checks active org and memberships before routing), `(auth)` sends directly to `/account/teams/new`. `/account/welcome` is more robust for users who already have an org.

**Root layout state:** `apps/app/src/app/layout.tsx` is a clean Server Component (fonts, metadata, analytics — no ClerkProvider). It renders `<PrefetchCrossZoneLinksProvider>` from `@vercel/microfrontends`. This layout wraps both `(app)` and `(auth)` route groups and is a candidate host for a single consolidated `ClerkProvider`.

### 4. Route Structure Relevant to the Task Flow

Post-login routing chain:
- `/account/welcome` (`(pending-allowed)/account/welcome/page.tsx`) — server-side relay: checks `orgSlug` in Clerk JWT, falls back to `getCachedUserOrgMemberships`, redirects to `/${orgSlug}` or `/account/teams/new`
- `/account/teams/new` (`(pending-allowed)/account/teams/new/page.tsx`) — team creation form; on success calls Clerk `setActive({ organization })` then pushes to `/account/teams/invite?teamSlug=...`
- `/account/teams/invite` — invite form; on success redirects to `/new?teamSlug=...`

The `(pending-allowed)` segment indicates these routes are accessible while account setup is pending.

## Code References

- `apps/app/src/app/(auth)/layout.tsx:15-23` — `ClerkProvider` in auth layout (missing `afterSignOutUrl`, inverted `Show`)
- `apps/app/src/app/(auth)/layout.tsx:24-26` — `<Show when="signed-out"><RedirectToTasks /></Show>`
- `apps/app/src/app/(app)/layout.tsx:15-25` — `ClerkProvider` in app layout
- `apps/app/src/app/layout.tsx:53-75` — Root layout (no `ClerkProvider`, `PrefetchCrossZoneLinksProvider`)
- `apps/app/src/proxy.ts:71-78` — `clerkMiddleware` options with `organizationSyncOptions` (no `taskUrls`)
- `apps/app/src/proxy.ts:27-36` — Public routes matcher (includes `/sign-in(.*)`, `/sign-up(.*)`)
- `vendor/clerk/src/client/index.ts:1-47` — `ClerkProvider`, `RedirectToTasks`, `Show`, `TaskChooseOrganization` all direct re-exports from `@clerk/nextjs`

## Architecture Documentation

### Clerk Route Group Layout Pattern

The app uses two independent `ClerkProvider` instances because `(app)` and `(auth)` are separate Next.js route groups with separate layouts. Neither layout inherits from the other — both inherit from `app/layout.tsx` (root), which has no Clerk context.

Clerk requires `ClerkProvider` to exist in the React tree for any component using Clerk hooks or components. The current dual-provider approach ensures Clerk context is available in both route groups.

### Middleware vs. Client-Side Task Routing

The middleware (`proxy.ts`) runs server-side before any React rendering. Its `organizationSyncOptions` causes Clerk to issue a server-side redirect for pending tasks. This redirect target is `signInUrl + "/tasks"` and is not configurable via the `ClerkProvider`'s `taskUrls` prop (which is client-side).

The `taskUrls` prop on `ClerkProvider` configures where Clerk routes from within the task hub page, not the hub URL itself.

### `@vendor/clerk` Is Pure Re-Export

Every component used (`ClerkProvider`, `RedirectToTasks`, `Show`, `TaskChooseOrganization`) is a direct, unmodified re-export from `@clerk/nextjs`. There is no custom wrapper logic. The vendor abstraction's only original code is `src/types.ts` (session discriminated union) and `src/env.ts` (key decoding for CSP).

## Open Questions

- Does `clerkMiddleware` support a `taskUrls` option (to skip the `/sign-in/tasks` hub and redirect directly to the task page)? The `proxy.ts` config currently has no such option.
- Is the `<Show when="signed-out"><RedirectToTasks /></Show>` in `(auth)/layout.tsx` intentional (testing Clerk's behavior with a no-op) or a bug?
- If `ClerkProvider` is moved to `app/layout.tsx`, does `PrefetchCrossZoneLinksProvider` from `@vercel/microfrontends` have any compatibility constraints with Clerk?
