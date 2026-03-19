# Migrate apps/auth into apps/console — Implementation Plan

## Overview

Collapse `apps/auth/` into `apps/console/` so the auth app's routes (`/sign-in`, `/sign-up`, `/early-access`, `/test-page`) are served directly by the console Next.js app. This eliminates the `lightfast-auth` microfrontend, reducing the architecture from 3 apps to 2 (console + www).

## Current State Analysis

- **3 apps** on lightfast.ai: console (catch-all), www (marketing), auth (sign-in/sign-up/early-access)
- Auth routes are delegated from console to auth via `microfrontends.json` routing
- Auth has custom Clerk UI (not prebuilt components), Arcjet+Redis for early access, CLI token exchange flow
- Console middleware redirects unauthenticated users to `${authUrl}/sign-in`
- Auth middleware redirects authenticated users to `${consoleUrl}/${orgSlug}`

### Key Discoveries:
- Console root layout has NO ClerkProvider — it lives in `(app)/layout.tsx` (`apps/console/src/app/(app)/layout.tsx:16`)
- Auth routes need their own ClerkProvider with `waitlistUrl="/early-access"` and different fallback URLs
- Auth uses `proxy.ts` (Next.js 16), console uses `middleware.ts` — both export `clerkMiddleware`
- All auth env vars are already in console's env.ts (superset)
- Only unique runtime dep: `react-confetti`
- Auth's Sentry `instrumentation-client.ts` scrubs `token=`, `__clerk_ticket=`, `ticket=` from breadcrumbs
- `consoleUrl` references in 4 client components become relative paths (same app after merge)

## Desired End State

- `apps/auth/` deleted
- `lightfast-auth` removed from `microfrontends.json`
- Auth routes served directly by console under `(auth)` and `(early-access)` route groups
- Console middleware handles auth routes as public, redirects authenticated users away
- `authUrl` removed from console's `related-projects.ts`
- All Clerk URLs in console are self-relative (`/sign-in`, `/sign-up`)
- CLI `step=activate` flow preserved exactly
- Early access (Arcjet + Redis + Clerk waitlist) works unchanged

### Verification:
- `pnpm build:console` passes
- `pnpm --filter @lightfast/console typecheck` passes
- `/sign-in` renders custom email/OTP/OAuth flow
- `/sign-up` renders with invitation ticket support
- `/sign-up/sso-callback` handles GitHub OAuth + legal acceptance
- `/sign-in?step=activate&token=<jwt>` activates CLI session
- `/early-access` renders form with Arcjet protection
- Authenticated users on `/sign-in` or `/sign-up` are redirected to console
- `pnpm dev:app` serves all routes correctly without auth dev server

## What We're NOT Doing

- NOT migrating E2E Playwright tests (they can be updated separately to point at console)
- NOT migrating the `(user)/test-page` route — dropping it (dev placeholder only, confirmed)
- NOT migrating `(user)/layout.tsx` or `(user)/_components/user-page-header.tsx`
- NOT changing Sentry DSN or project configuration
- NOT refactoring auth components (lift-and-shift, fix imports only)

## Implementation Approach

Lift-and-shift: copy all auth route groups, components, actions, and libs into console's `src/app/` directory. Then update imports, middleware, ClerkProvider config, and microfrontends.json. Finally delete `apps/auth/`.

---

## Phase 1: Add Dependencies & Config

### Overview
Add auth-only dependencies to console and update instrumentation.

### Changes Required:

#### 1. Console `package.json` — add `react-confetti`
**File**: `apps/console/package.json`
**Change**: Add `react-confetti` to dependencies

```json
"react-confetti": "^6.4.0"
```

Then run `pnpm install` from repo root.

#### 2. Console `instrumentation-client.ts` — add token scrubbing
**File**: `apps/console/src/instrumentation-client.ts`
**Change**: Add `beforeBreadcrumb` hook that scrubs `token=`, `__clerk_ticket=`, `ticket=` from navigation breadcrumb URLs (ported from auth's `instrumentation-client.ts`).

Read the existing console file first to understand current Sentry config, then add the scrubbing logic from auth's `instrumentation-client.ts` lines covering the `beforeBreadcrumb` callback.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @lightfast/console typecheck` passes
- [ ] `SKIP_ENV_VALIDATION=true pnpm build:console` passes

---

## Phase 2: Copy Auth Routes into Console

### Overview
Lift all route groups, components, actions, libs, and search param schemas from auth into console.

### Changes Required:

#### 1. Create `(auth)` route group
**Source**: `apps/auth/src/app/(app)/(auth)/`
**Destination**: `apps/console/src/app/(auth)/`

Copy the entire directory tree:
```
(auth)/
  layout.tsx
  error.tsx
  sign-in/page.tsx
  sign-in/sso-callback/page.tsx
  sign-up/page.tsx
  sign-up/sso-callback/page.tsx
  _actions/sign-in.ts
  _actions/sign-in.test.ts
  _actions/sign-up.ts
  _actions/sign-up.test.ts
  _lib/search-params.ts
  _lib/search-params.test.ts
  _components/email-form.tsx
  _components/otp-island.tsx
  _components/oauth-button.tsx
  _components/error-banner.tsx
  _components/separator-with-text.tsx
  _components/session-activator.tsx
  _components/shared/code-verification-ui.tsx
```

#### 2. Create `(early-access)` route group
**Source**: `apps/auth/src/app/(app)/(early-access)/`
**Destination**: `apps/console/src/app/(early-access)/`

Copy the entire directory tree:
```
(early-access)/
  layout.tsx
  error.tsx
  early-access/page.tsx
  _actions/early-access.ts
  _actions/early-access.test.ts
  _lib/search-params.ts
  _lib/search-params.test.ts
  _components/early-access-form-server.tsx
  _components/company-size-island.tsx
  _components/sources-island.tsx
  _components/confetti-wrapper.tsx
  _components/error-banner.tsx
  _components/submit-button.tsx
```

#### 3. Copy shared auth lib files
**Source**: `apps/auth/src/lib/observability.ts`
**Destination**: `apps/console/src/lib/observability.ts` (if it doesn't exist; merge if it does)

**Source**: `apps/auth/src/app/_components/sentry-user-identification.tsx`
**Destination**: Check if console already has Sentry user identification. If not, copy.

### Import Fixups (applied during copy):

For ALL copied files, update these imports:
- `~/env` → `~/env` (same convention, resolves to console's env — no change needed)
- `~/lib/related-projects` → remove `consoleUrl` usage entirely (see Phase 3)
- `~/lib/observability` → `~/lib/observability` (copy the file or merge)
- `~/styles/globals.css` → already exists in console

### Success Criteria:

#### Automated Verification:
- [ ] All files exist in correct locations
- [ ] No duplicate file conflicts
- [ ] `pnpm --filter @lightfast/console typecheck` passes (may have import errors — fixed in Phase 3)

---

## Phase 3: Fix Imports & Remove Cross-App References

### Overview
Convert all `consoleUrl` references to relative paths and all `MicrofrontendLink` intra-app links to `next/link`.

### Changes Required:

#### 1. Client components — replace `consoleUrl` with relative paths
These 4 client components use `window.location.href = \`${consoleUrl}/account/welcome\``:

- `(auth)/_components/otp-island.tsx` → `window.location.href = "/account/welcome"`
- `(auth)/_components/oauth-button.tsx` → `window.location.href = "/account/welcome"`
- `(auth)/_components/session-activator.tsx` → `window.location.href = "/account/welcome"`
- `(auth)/sign-up/sso-callback/page.tsx` → `window.location.href = "/account/welcome"`

Remove the `consoleUrl` import from each file.

#### 2. Auth layout — fix MicrofrontendLink usage
**File**: `(auth)/layout.tsx`

- Logo link `href="/"` → **keep as MicrofrontendLink** (routes to www)
- Early access CTA `href="/early-access"` → **convert to `next/link`** (same app now)
- **Keep** `<Show when="signed-out"><RedirectToTasks /></Show>` as defense-in-depth (confirmed)
- **Wrap children with ClerkProvider** for auth-specific config:
  ```tsx
  <ClerkProvider
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    signInFallbackRedirectUrl="/account/teams/new"
    signUpFallbackRedirectUrl="/account/teams/new"
    taskUrls={{ "choose-organization": "/account/teams/new" }}
    waitlistUrl="/early-access"
  >
    {children}
  </ClerkProvider>
  ```
  This is needed because auth routes have different ClerkProvider config than the `(app)` routes (waitlistUrl, different fallback redirects).

#### 3. Early access layout — fix links
**File**: `(early-access)/layout.tsx`

- Logo link `href="/"` → **keep as MicrofrontendLink** (routes to www)
- Sign-in link → already uses `next/link` (no change)
- **Wrap children with ClerkProvider** (same config as auth layout)

#### 4. Sign-up page — fix legal links
**File**: `(auth)/sign-up/page.tsx`

- `/legal/terms` and `/legal/privacy` → **keep as MicrofrontendLink** (routes to www)

#### 5. Error banner — fix early-access link
**File**: `(auth)/_components/error-banner.tsx`

- `/early-access` link → **convert to `next/link`** (same app now)

### Success Criteria:

#### Automated Verification:
- [ ] No imports of `consoleUrl` remain in `(auth)/` or `(early-access)/`
- [ ] `pnpm --filter @lightfast/console typecheck` passes
- [ ] `SKIP_ENV_VALIDATION=true pnpm build:console` passes

---

## Phase 4: Update Console Middleware

### Overview
Update console middleware to handle auth routes as public and redirect authenticated users away from auth pages.

### Changes Required:

#### 1. Add auth routes to `isPublicRoute`
**File**: `apps/console/src/middleware.ts`

```typescript
const isPublicRoute = createRouteMatcher([
  // ... existing routes ...
  "/sign-in",
  "/sign-in/sso-callback",
  "/sign-up",
  "/sign-up/sso-callback",
  "/early-access",
]);
```

#### 2. Add `isAuthRoute` matcher
```typescript
const isAuthRoute = createRouteMatcher(["/sign-in", "/sign-up"]);
```

#### 3. Add authenticated-user redirect from auth pages
Inside the `clerkMiddleware` callback, BEFORE the existing public route check, add:

```typescript
// Redirect authenticated users away from auth pages
if (isAuthRoute(req)) {
  if (isPending) {
    return await createRedirectResponse(
      new URL("/account/teams/new", req.url)
    );
  }
  if (userId && orgId) {
    const { orgSlug } = await auth({ treatPendingAsSignedOut: false });
    if (orgSlug) {
      return await createRedirectResponse(
        new URL(`/${orgSlug}`, req.url)
      );
    }
  }
}
```

Note: redirects are now to `req.url` (self), not `consoleUrl` (cross-app).

#### 4. Update Clerk options — self-relative URLs
```typescript
{
  signInUrl: "/sign-in",        // was: `${authUrl}/sign-in`
  signUpUrl: "/sign-up",        // was: `${authUrl}/sign-up`
  afterSignInUrl: "/account/welcome",
  afterSignUpUrl: "/account/welcome",
  organizationSyncOptions: { ... }, // unchanged
}
```

#### 5. Remove stale public routes
Remove from `isPublicRoute`:
- `/api/gateway/ingress(.*)` — deleted in memory consolidation
- `/services/gateway/(.*)` — deleted
- `/services/relay/(.*)` — deleted
- `/services/backfill/(.*)` — deleted

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/console typecheck` passes
- [ ] `SKIP_ENV_VALIDATION=true pnpm build:console` passes

#### Manual Verification:
- [ ] Unauthenticated user hitting `/sign-in` sees sign-in page
- [ ] Authenticated user hitting `/sign-in` is redirected to their org
- [ ] Pending user hitting `/sign-in` is redirected to `/account/teams/new`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Update Console ClerkProvider & Related Projects

### Overview
Update the `(app)/layout.tsx` ClerkProvider to use self-relative auth URLs and remove `authUrl`.

### Changes Required:

#### 1. Console `(app)/layout.tsx` — update ClerkProvider
**File**: `apps/console/src/app/(app)/layout.tsx`

```typescript
<ClerkProvider
  afterSignOutUrl="/sign-in"              // was: `${authUrl}/sign-in`
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInFallbackRedirectUrl="/account/welcome"
  signInUrl="/sign-in"                    // was: `${authUrl}/sign-in`
  signUpFallbackRedirectUrl="/account/welcome"
  signUpUrl="/sign-up"                    // was: `${authUrl}/sign-up`
  waitlistUrl="/early-access"             // NEW — ported from auth
  taskUrls={{ "choose-organization": "/account/teams/new" }}
>
```

Remove the `authUrl` import.

#### 2. Console `related-projects.ts` — remove `authUrl`
**File**: `apps/console/src/lib/related-projects.ts`

Remove the `authUrl` export entirely. Keep `wwwUrl` and `relayUrl`.

Also remove `relayUrl` — relay was decommissioned in memory consolidation (confirmed: clean up now).

#### 3. Update `microfrontends.json` — remove `lightfast-auth`
**File**: `apps/console/microfrontends.json`

Remove the entire `lightfast-auth` block:
```json
"lightfast-auth": { ... }  // DELETE
```

### Success Criteria:

#### Automated Verification:
- [ ] No imports of `authUrl` remain in console
- [ ] `pnpm --filter @lightfast/console typecheck` passes
- [ ] `SKIP_ENV_VALIDATION=true pnpm build:console` passes

---

## Phase 6: Delete apps/auth & Cleanup

### Overview
Remove the auth app entirely and clean up workspace references.

### Changes Required:

#### 1. Delete `apps/auth/` directory

#### 2. Remove from root `pnpm-workspace.yaml` (if listed explicitly)

#### 3. Remove `dev:auth`, `build:auth` scripts from root `package.json` (if they exist)

#### 4. Remove from `turbo.json` (if there are auth-specific task configs)

#### 5. Update `pnpm dev:app` script
If `dev:app` starts the auth dev server, remove it. Auth routes are now served by console.

#### 6. Update CLAUDE.md
Remove `auth (4104)` from the architecture diagram. Update the port listing. Note that auth routes are now served by console.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds (no broken workspace references)
- [ ] `pnpm build:console` passes
- [ ] `pnpm typecheck` passes (full monorepo)
- [ ] `pnpm check` passes

#### Manual Verification:
- [ ] `pnpm dev:console` serves `/sign-in`, `/sign-up`, `/early-access` correctly
- [ ] CLI token exchange flow works: `/sign-in?step=activate&token=<jwt>`
- [ ] GitHub OAuth flow works end-to-end for both sign-in and sign-up
- [ ] Invitation flow works: `/sign-up?ticket=<jwt>`
- [ ] Early access form submits successfully with confetti
- [ ] Rate limiting works on early access (Arcjet)

---

## Testing Strategy

### Unit Tests:
- All existing auth unit tests (`sign-in.test.ts`, `sign-up.test.ts`, `early-access.test.ts`, `search-params.test.ts`) are co-located with their source and should pass after migration
- Run: `pnpm --filter @lightfast/console test`

### Manual Testing Steps:
1. Sign in with email → receive OTP → verify → redirected to console
2. Sign in with GitHub OAuth → SSO callback → redirected to console
3. Sign up with email → receive OTP → verify → redirected to welcome
4. Sign up with invitation ticket → GitHub OAuth → legal auto-accept → redirected to welcome
5. Visit `/sign-in?step=activate&token=<test-jwt>` → CLI session activated
6. Visit `/early-access` → fill form → confetti on success
7. Visit `/sign-in` while authenticated → redirected to org dashboard
8. Visit `/sign-up` while pending → redirected to `/account/teams/new`

## Performance Considerations

- No performance impact — auth routes are lightweight (no heavy data fetching)
- Console bundle size increases negligibly (auth components are small)
- `react-confetti` is dynamically imported only on early-access success page

## Migration Notes

- Auth's Redis key `"early-access:emails"` is app-agnostic — continues working
- Clerk test accounts work regardless of which app serves the routes
- Auth's Sentry breadcrumb scrubbing is now in console's `instrumentation-client.ts`
- E2E Playwright tests (if used) need URL updates from port 4104 to 4107

## References

- Research: `thoughts/shared/research/2026-03-19-auth-migration-analysis.md`
- Console middleware: `apps/console/src/middleware.ts`
- Auth proxy: `apps/auth/src/proxy.ts`
- Console ClerkProvider: `apps/console/src/app/(app)/layout.tsx:16-41`
- Microfrontends config: `apps/console/microfrontends.json`
