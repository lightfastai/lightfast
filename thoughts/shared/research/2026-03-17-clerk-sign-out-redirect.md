---
date: 2026-03-17T00:00:00+11:00
researcher: claude
git_commit: b7d0be8aeb13be7473517117c74cfe4c3e6f3c89
branch: feat/post-login-welcome-and-team-switcher-refactor
repository: lightfast
topic: "Clerk sign-out redirect — why user stays on page after sign-out from dropdown"
tags: [research, codebase, clerk, auth, sign-out, redirect, user-menu, microfrontends]
status: complete
last_updated: 2026-03-17
---

# Research: Clerk Sign-Out Redirect

**Date**: 2026-03-17
**Git Commit**: `b7d0be8aeb13be7473517117c74cfe4c3e6f3c89`
**Branch**: `feat/post-login-welcome-and-team-switcher-refactor`

---

## Research Question

When the user clicks "Sign out" from the user dropdown, the dropdown closes but the user remains on the current page. Investigate the correct and most optimal sign-out approach for Clerk in the console app.

---

## Summary

The bug is caused by `signOut()` being called without any redirect URL in both primary header components (`AppHeader` and `UserPageHeader`). Neither `ClerkProvider` instance (console or auth) sets an `afterSignOutUrl` prop as a global fallback. This means Clerk has no redirect destination after revoking the session and falls back to the Clerk Dashboard configuration. The middleware detects the revoked session and re-evaluates the current route — causing the page to remain visible momentarily or until the middleware forces a redirect to `/sign-in`. This is a well-known race condition documented in Clerk's own GitHub issues (#3864).

The standalone `SignOutButton` used on the org not-found page is the only place that correctly calls `signOut({ redirectUrl: \`${authUrl}/sign-in\` })`.

---

## Detailed Findings

### 1. UserMenu Component (shared UI)

**File**: `packages/ui/src/components/app-header/user-menu.tsx`

The `UserMenu` component is a pure UI component — it accepts `onSignOut: () => void` as a prop and fires it via `onClick` on the "Sign out" `DropdownMenuItem`:

```tsx
// user-menu.tsx:62-67
<DropdownMenuItem
  className="cursor-pointer text-sm"
  onClick={onSignOut}
>
  Sign out
</DropdownMenuItem>
```

The component itself has no knowledge of Clerk. All sign-out logic is delegated to the parent via `onSignOut`. This is correct separation of concerns — the issue is in what the parents pass as `onSignOut`.

---

### 2. AppHeader (org-scoped pages)

**File**: `apps/console/src/components/app-header.tsx`

```tsx
// app-header.tsx:14
const { signOut } = useClerk();

// app-header.tsx:63
onSignOut={() => void signOut()}
```

`signOut()` is called with **no arguments**. No `redirectUrl`, no `sessionId`.

---

### 3. UserPageHeader (user-scoped pages)

**File**: `apps/console/src/components/user-page-header.tsx`

```tsx
// user-page-header.tsx:12
const { signOut } = useClerk();

// user-page-header.tsx:69
onSignOut={() => void signOut()}
```

Same pattern — `signOut()` called with **no arguments**.

---

### 4. ClerkProvider — Console App

**File**: `apps/console/src/app/(app)/layout.tsx:16-25`

```tsx
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl="/account/welcome"
  signInUrl={`${authUrl}/sign-in`}
  signUpFallbackRedirectUrl="/account/welcome"
  signUpUrl={`${authUrl}/sign-up`}
  taskUrls={{ "choose-organization": "/account/teams/new" }}
>
```

No `afterSignOutUrl` prop. No `afterMultiSessionSingleSignOutUrl` prop.

---

### 5. ClerkProvider — Auth App

**File**: `apps/auth/src/app/layout.tsx:81-91`

```tsx
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signInUrl="/sign-in"
  signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signUpUrl="/sign-up"
  taskUrls={{ "choose-organization": `${consoleUrl}/account/teams/new` }}
  waitlistUrl="/early-access"
>
```

No `afterSignOutUrl` prop here either.

---

### 6. Standalone SignOutButton (not-found page — works correctly)

**File**: `apps/console/src/app/(app)/(org)/sign-out-button.tsx:15-17`

```tsx
const handleSignOut = async () => {
  await signOut({ redirectUrl: `${authUrl}/sign-in` });
};
```

This is the only sign-out call site that explicitly provides a `redirectUrl`. It navigates the user to the auth app's `/sign-in` page after sign-out. This call site works correctly.

---

## Clerk SDK API — How signOut Works (v7.0.1 / `@clerk/nextjs`)

**Type definition**: `node_modules/@clerk/shared/dist/types/index.d.ts:7685-7703`

```ts
type SignOutOptions = {
  sessionId?: string;   // sign out only one session (multi-session apps)
  redirectUrl?: string; // URL to navigate to after sign-out
};

interface SignOut {
  (options?: SignOutOptions): Promise<void>;
  (signOutCallback?: () => void | Promise<any>, options?: SignOutOptions): Promise<void>;
}
```

### Redirect resolution priority (highest → lowest):

| Priority | Surface | Property |
|----------|---------|----------|
| 1 (highest) | `signOut()` call argument | `options.redirectUrl` |
| 2 | `<SignOutButton>` prop | `redirectUrl` |
| 3 | `<ClerkProvider>` prop | `afterSignOutUrl` |
| 4 (lowest) | Clerk Dashboard setting | `DisplayConfigResource.afterSignOutAllUrl` |

When no redirect URL is found at any level, Clerk's behaviour is undefined beyond whatever the Dashboard default is. In this repo, levels 1-3 are all absent for the main dropdown sign-out.

### Next.js-specific behaviour

`NextClerkProviderProps.__internal_invokeMiddlewareOnAuthStateChange` defaults to `true` in `@clerk/nextjs` (`types.d.ts:18`). This means: after `signOut()` resolves, the Next.js middleware is **automatically re-invoked**. If the user is still on a protected route with no valid session, the middleware will redirect them to `signInUrl` (`${authUrl}/sign-in`). However, this is a **server-side re-evaluation** — it does not immediately navigate the client away. The client sees the current page until the middleware's redirect fires, which creates the appearance of "staying on the page."

---

## Architecture Context

### Microfrontend routing (prod: all apps on `lightfast.ai`)

The three apps (console @ port 4107, auth @ port 4104, www @ port 4101) all share the same domain via `apps/console/microfrontends.json`. Auth routes (`/sign-in`, `/sign-up`, `/early-access`) are routed to the `lightfast-auth` app. All other paths go to `lightfast-console`.

Because sign-in lives on the same origin (`lightfast.ai/sign-in`), a relative `redirectUrl: "/sign-in"` would work in production. However, in dev the auth app runs on a different port (4104), so a relative path would send the user to console port 4107 `/sign-in`, which doesn't exist — causing a 404. The correct dev approach is to use `authUrl` from `lib/related-projects.ts`, which resolves to `http://localhost:4104` in dev and `https://lightfast.ai` in prod.

### `authUrl` resolution

**File**: `apps/console/src/lib/related-projects.ts`

- Dev: `http://localhost:4104`
- Prod/preview: `https://lightfast.ai`

The `sign-out-button.tsx` (not-found page) already uses `authUrl` correctly: `` `${authUrl}/sign-in` ``.

---

## All Sign-Out Call Sites

| File | Line | Call | Redirect |
|------|------|------|----------|
| `apps/console/src/components/app-header.tsx` | 63 | `signOut()` | ❌ None — falls back to Clerk Dashboard default |
| `apps/console/src/components/user-page-header.tsx` | 69 | `signOut()` | ❌ None — falls back to Clerk Dashboard default |
| `apps/console/src/app/(app)/(org)/sign-out-button.tsx` | 16 | `signOut({ redirectUrl: \`${authUrl}/sign-in\` })` | ✅ Redirects to auth app sign-in |
| `apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx` | 65 | `signOut()` | ❌ None — falls back to Clerk Dashboard default |

---

## Clerk GitHub Issues — Known Sign-Out Race Condition

From official Clerk GitHub repository:

- **Issue #3864** — "404 (not-found.tsx) triggered when logging out": Confirmed race between client-side session revocation and server-side middleware guard. When signing out from a protected route, `not-found.tsx` briefly renders before the `afterSignOutUrl` redirect fires. Fix: always pass `redirectUrl` explicitly in the `signOut()` call (or `afterSignOutUrl` on `<ClerkProvider>`). Status: fixed in later v5 releases.

- **Issue #3353** — "Sign out not working reliably in @clerk/nextjs v5": Affected v5.0.7 specifically; resolved in the same v5 minor series.

- **Issue #5590** — "`redirect_url` appended after signing out": After a hard refresh on a protected page, sign-out sends the user to `/sign-in?redirect_url=/current-path`. Clerk's position: this is expected middleware behaviour; the next sign-in returns the user to where they were. Workaround via `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` if always-override is desired.

---

## Environment Variable Coverage

No `CLERK_AFTER_SIGN_OUT_URL` or `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` env variable exists anywhere in the repo. The only Clerk URL env vars in use are:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (legacy, in `apps/auth/.env.local.example`)
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (legacy, in `apps/auth/.env.local.example`)

---

## Code References

- `packages/ui/src/components/app-header/user-menu.tsx:62-67` — `DropdownMenuItem` with `onClick={onSignOut}`
- `apps/console/src/components/app-header.tsx:14,63` — `useClerk().signOut()` called without redirect
- `apps/console/src/components/user-page-header.tsx:12,69` — same pattern
- `apps/console/src/app/(app)/(org)/sign-out-button.tsx:16` — correct call with `redirectUrl: \`${authUrl}/sign-in\``
- `apps/console/src/app/(app)/layout.tsx:16-25` — `ClerkProvider` missing `afterSignOutUrl`
- `apps/auth/src/app/layout.tsx:81-91` — auth `ClerkProvider` also missing `afterSignOutUrl`
- `apps/console/src/lib/related-projects.ts` — `authUrl` (dev: port 4104, prod: lightfast.ai)
- `apps/console/src/middleware.ts:194-207` — `clerkMiddleware` options with `signInUrl: \`${authUrl}/sign-in\``
- `node_modules/@clerk/shared/dist/types/index.d.ts:7685-7703` — `SignOut` interface type definition

---

## Clerk Docs References

- https://clerk.com/docs/custom-flows/sign-out — Custom sign-out flow (canonical)
- https://clerk.com/docs/nextjs/reference/components/unstyled/sign-out-button — `<SignOutButton>` props
- https://clerk.com/docs/nextjs/reference/components/clerk-provider — `afterSignOutUrl` and `allowedRedirectOrigins` on `<ClerkProvider>`
- https://clerk.com/docs/guides/development/customize-redirect-urls — Full redirect URL customization (env vars + props)

---

## Open Questions

- Whether the Clerk Dashboard has a default `afterSignOutUrl` configured for this instance (would explain partial redirect behaviour in some environments).
- Whether `apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx` (auth app's own user header) needs the same fix as the console headers.
- Whether `afterSignOutUrl` on `<ClerkProvider>` should point to `${authUrl}/sign-in` (requires `authUrl` to be imported into `layout.tsx`, which is currently a server component) or whether the per-call `redirectUrl` approach is preferred.
