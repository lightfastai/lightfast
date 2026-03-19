# Auth App Migration Analysis

**Date**: 2026-03-19
**Purpose**: Comprehensive documentation of `apps/auth/` in preparation for migrating it into `apps/console/`.

---

## 1. Complete File Inventory of `apps/auth/`

### Configuration & Root
```
apps/auth/package.json
apps/auth/next.config.ts
apps/auth/tsconfig.json
apps/auth/.env.local.example
apps/auth/src/env.ts
apps/auth/src/proxy.ts                     ← middleware entry point (Next.js 16 uses proxy.ts not middleware.ts)
apps/auth/src/instrumentation.ts           ← Sentry server/edge init
apps/auth/src/instrumentation-client.ts    ← Sentry browser init with Replay
apps/auth/src/styles/globals.css
apps/auth/src/lib/fonts.ts                 ← ppNeueMontreal (medium 500 only)
apps/auth/src/lib/observability.ts         ← getAuthTraceContext() helper
apps/auth/src/lib/related-projects.ts      ← consoleUrl via @vercel/related-projects
```

### App Shell
```
apps/auth/src/app/layout.tsx               ← root layout: ClerkProvider, NuqsAdapter, fonts, metadata
apps/auth/src/app/global-error.tsx
apps/auth/src/app/not-found.tsx
apps/auth/src/app/_components/sentry-user-identification.tsx
```

### Auth Routes — `(app)/(auth)/`
```
apps/auth/src/app/(app)/(auth)/layout.tsx
apps/auth/src/app/(app)/(auth)/error.tsx
apps/auth/src/app/(app)/(auth)/sign-in/page.tsx
apps/auth/src/app/(app)/(auth)/sign-in/sso-callback/page.tsx
apps/auth/src/app/(app)/(auth)/sign-up/page.tsx
apps/auth/src/app/(app)/(auth)/sign-up/sso-callback/page.tsx
apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts
apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts
apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts
apps/auth/src/app/(app)/(auth)/_actions/sign-up.test.ts
apps/auth/src/app/(app)/(auth)/_lib/search-params.ts
apps/auth/src/app/(app)/(auth)/_lib/search-params.test.ts
apps/auth/src/app/(app)/(auth)/_components/email-form.tsx
apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx
apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx
apps/auth/src/app/(app)/(auth)/_components/error-banner.tsx
apps/auth/src/app/(app)/(auth)/_components/separator-with-text.tsx
apps/auth/src/app/(app)/(auth)/_components/session-activator.tsx
apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx
```

### Early Access Routes — `(app)/(early-access)/`
```
apps/auth/src/app/(app)/(early-access)/layout.tsx
apps/auth/src/app/(app)/(early-access)/error.tsx
apps/auth/src/app/(app)/(early-access)/early-access/page.tsx
apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts
apps/auth/src/app/(app)/(early-access)/_actions/early-access.test.ts
apps/auth/src/app/(app)/(early-access)/_lib/search-params.ts
apps/auth/src/app/(app)/(early-access)/_lib/search-params.test.ts
apps/auth/src/app/(app)/(early-access)/_components/early-access-form-server.tsx
apps/auth/src/app/(app)/(early-access)/_components/company-size-island.tsx
apps/auth/src/app/(app)/(early-access)/_components/sources-island.tsx
apps/auth/src/app/(app)/(early-access)/_components/confetti-wrapper.tsx
apps/auth/src/app/(app)/(early-access)/_components/error-banner.tsx
apps/auth/src/app/(app)/(early-access)/_components/submit-button.tsx
```

### User/Test Routes — `(app)/(user)/`
```
apps/auth/src/app/(app)/(user)/layout.tsx
apps/auth/src/app/(app)/(user)/test-page/page.tsx
apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx
```

### API Routes
```
apps/auth/src/app/(health)/api/health/route.ts
```

### Public Assets
```
apps/auth/public/favicon.ico + favicons (identical to console's)
apps/auth/public/fonts/pp-neue-montreal/   ← identical font files to console
apps/auth/public/fonts/exposure-plus/      ← identical font files to console
apps/auth/public/fonts/pp-supply-sans/PPSupplySans-Regular.woff2
```

---

## 2. Every Route and What It Does

### `/sign-in` — `(app)/(auth)/sign-in/page.tsx`
Server component. Reads `step`, `email`, `error`, `token`, `errorCode` from search params via nuqs.

- `step=email` (default): Renders `<EmailForm action="sign-in">` + `<OAuthButton mode="sign-in">` separated by `<SeparatorWithText>`.
- `step=code` + email present: Renders `<OTPIsland mode="sign-in" email={email}>` (dynamically imported).
- `step=activate` + token present: Renders `<SessionActivator token={token}>` (dynamically imported). Used for CLI token-based login.
- Any error/errorCode: Renders `<ErrorBanner>` with action buttons for recovery.

### `/sign-in/sso-callback` — `sign-in/sso-callback/page.tsx`
Client component. Renders `<AuthenticateWithRedirectCallback>` from `@vendor/clerk/client`. This is the final step of the GitHub OAuth sign-in flow. `continueSignUpUrl` is set to `/sign-in?errorCode=account_not_found` to handle users whose GitHub account has no Lightfast account.

### `/sign-up` — `(app)/(auth)/sign-up/page.tsx`
Server component. Reads `step`, `email`, `error`, `ticket`, `__clerk_ticket`, `errorCode` from search params.

- Standard path (`step=email`, no ticket): Email form primary, GitHub OAuth secondary. Legal terms links shown.
- Invitation path (`step=email`, ticket present): GitHub OAuth primary, email form secondary. Decodes JWT ticket to show expiry date.
- `step=code` + email: Renders `<OTPIsland mode="sign-up" email={email} ticket={invitationTicket}>`.
- Error state: Renders `<ErrorBanner>`.

### `/sign-up/sso-callback` — `sign-up/sso-callback/page.tsx`
Client component. Handles the GitHub OAuth callback for sign-ups. Contains two `useEffect` chains:
1. If `__clerk_ticket` is in the URL and `signUp.status === "missing_requirements"` with only `legal_accepted` missing, calls `signUp.update({ legalAccepted: true })` inline (avoids navigation).
2. Once `signUp.status === "complete"` after that update, calls `signUp.finalize()` and redirects to `${consoleUrl}/account/welcome`.
Non-invite flow: `continueSignUpUrl="/sign-up"`.

### `/early-access` — `(app)/(early-access)/early-access/page.tsx`
Server component. Reads all early access form state from search params. Shows:
- Success state (confetti + confirmation) when `success=true`.
- Error banner when field errors or general error is present.
- `<EarlyAccessFormServer>` with pre-filled field values on validation error re-render.

### `/test-page` — `(app)/(user)/test-page/page.tsx`
Placeholder page for testing the `UserPageHeader` component. Contains a `UserPageHeader` that shows team switcher and user menu with sign-out. Served under the `(user)` route group which requires authentication.

### `/api/health` — `(health)/api/health/route.ts`
Edge runtime. Returns `{ status: "ok", timestamp, service: "auth", environment }`. Requires Bearer token auth if `HEALTH_CHECK_AUTH_TOKEN` is set. Handles OPTIONS for CORS preflight.

---

## 3. Components Deep Dive

### `EmailForm` (`_components/email-form.tsx`)
Pure server component. Native `<form>` with `action={serverAction}`. Passes optional `ticket` as hidden input. Calls `initiateSignIn` or `initiateSignUp` server action based on `action` prop.

### `OTPIsland` (`_components/otp-island.tsx`)
Client component. On mount, sends OTP via Clerk FAPI:
- `sign-in`: calls `signIn.emailCode.sendCode()`
- `sign-up` with ticket: calls `signUp.create({ ticket, emailAddress, legalAccepted: true })` then `signUp.verifications.sendEmailCode()`
- `sign-up` without ticket: calls `signUp.create({ emailAddress, legalAccepted: true })` then `signUp.verifications.sendEmailCode()`

Auto-verifies when 6 digits entered. On success, calls `signIn.finalize()` or `signUp.finalize()` navigating to `${consoleUrl}/account/welcome`. Uses Sentry `startSpan` and `addBreadcrumb` for tracing all OTP operations.

### `OAuthButton` (`_components/oauth-button.tsx`)
Client component. Handles GitHub OAuth for three cases:
1. Sign-in: `signIn.sso({ strategy: "oauth_github", redirectCallbackUrl: "/sign-in/sso-callback" })`
2. Sign-up (no ticket): `signUp.sso({ strategy: "oauth_github", redirectCallbackUrl: "/sign-up/sso-callback" })`
3. Sign-up with ticket (invite flow): First calls `signUp.create({ ticket })` to bind ticket, then `signUp.sso({ ..., redirectCallbackUrl: "/sign-up/sso-callback?__clerk_ticket=..." , legalAccepted: true })`

All three paths handle `sign_up_restricted_waitlist` error code specifically, redirecting to the waitlist error URL.

### `SessionActivator` (`_components/session-activator.tsx`)
Client component. On mount calls `signIn.ticket({ ticket: token })`. If `signIn.status === "complete"`, calls `signIn.finalize()` navigating to `${consoleUrl}/account/welcome`. Used exclusively when `step=activate` in the sign-in URL (CLI token exchange flow).

### `CodeVerificationUI` (`_components/shared/code-verification-ui.tsx`)
Pure display component. Renders the 6-slot `InputOTP` from `@repo/ui`, inline error, loading states, back button (calls `onReset`), and resend link (calls `onResend`). Used by `OTPIsland`.

### `EarlyAccessFormServer` (`(early-access)/_components/early-access-form-server.tsx`)
Server component. Renders the full early access form with `action={joinEarlyAccessAction}`. Composes `CompanySizeIsland` (shadcn Select), `SourcesIsland` (Popover+Command combobox), and `SubmitButton`.

### `CompanySizeIsland` / `SourcesIsland`
Client components. Both use hidden `<input>` fields to bridge shadcn/Radix UI components into the native form submission. `SourcesIsland` manages a multi-select via `useState`.

### `ConfettiWrapper`
Client component. Uses `useSyncExternalStore` to detect client-mount, then `createPortal`s `<Confetti>` (from `react-confetti`) into `document.body`. Fully SSR-safe.

### `UserPageHeader` (`(user)/_components/user-page-header.tsx`)
Client component. Uses `useClerk`, `useUser`, `useOrganizationList` from `@vendor/clerk/client`. Renders `TeamSwitcher` and `UserMenu` from `@repo/ui/components/app-header/`. Signs out to `/sign-in`. Used only by the `(user)` test route group.

---

## 4. Server Actions

### `initiateSignIn` (`_actions/sign-in.ts`)
`"use server"`. Validates email with Zod. On failure: `redirect(serializeSignInParams("/sign-in", { error: message }))`. On success: `redirect(serializeSignInParams("/sign-in", { step: "code", email }))`. No Clerk API calls — client OTPIsland handles those.

### `initiateSignUp` (`_actions/sign-up.ts`)
`"use server"`. Validates email + optional ticket. On failure: preserves ticket in redirect URL. On success: `redirect` to `step=code` with email and ticket.

### `joinEarlyAccessAction` (`(early-access)/_actions/early-access.ts`)
`"use server"`. Full pipeline:
1. Zod validation (email, companySize, sources array)
2. Arcjet protection (validateEmail, shield, detectBot, slidingWindow 1h/24h, fixedWindow 10s)
3. Redis `sismember` check against `"early-access:emails"` set (duplicate detection)
4. `clerkClient().waitlistEntries.create({ emailAddress })` 
5. `after()` → Redis `sadd` (non-blocking)
6. Redirect to `success=true`

Error handling covers: Arcjet rate limit/bot/shield/email, Redis failures (fallthrough), Clerk `email_address_exists`, `form_identifier_exists`, 429/`too_many_requests`, `user_locked` (with lockout seconds), and generic Clerk errors.

---

## 5. Middleware (`src/proxy.ts`)

Auth uses `proxy.ts` (not `middleware.ts` — this is Next.js 16 convention). The export name is `proxy` (not `default`), and the config matcher is `config`.

### Route matchers defined:
- `isPublicRoute`: `/`, `/sign-in`, `/sign-in/sso-callback`, `/sign-up`, `/sign-up/sso-callback`, `/api/health`, `/early-access`
- `isAuthRoute`: `/sign-in`, `/sign-up`
- `isRootPath`: `/`

### Logic flow:
1. Gets `{ userId, orgId, orgSlug }` from `auth({ treatPendingAsSignedOut: false })`
2. `isPending = userId && !orgId`, `isActive = userId && orgId`
3. If (pending or active) AND on an auth route (`/sign-in`, `/sign-up`):
   - If pending: secure redirect to `new URL("/account/teams/new", consoleUrl)`
   - If active: secure redirect to `new URL("/${orgSlug}", consoleUrl)`
4. If root path `/`:
   - No userId: redirect to `/sign-in`
   - Pending: redirect to `new URL("/account/teams/new", consoleUrl)` (console)
   - Active: redirect to `new URL("/${orgSlug}", consoleUrl)` (console)
5. If not public route: `auth.protect()`
6. Runs NEMO middleware chain (currently empty `before` array)
7. Returns response with CSP security headers

### CSP directives used:
- `createNextjsCspDirectives()`, `createClerkCspDirectives()`, `createAnalyticsCspDirectives()`, `createSentryCspDirectives()`
- Development only: `{ connectSrc: ["http://localhost:8969"] }` (Sentry Spotlight)

### Clerk options on `clerkMiddleware`:
```
{ signInUrl: "/sign-in", signUpUrl: "/sign-up" }
```
No `afterSignInUrl`/`afterSignUpUrl` — those live in the ClerkProvider in the root layout.

---

## 6. Root Layout (`src/app/layout.tsx`)

Wraps everything with:
- `<ClerkProvider>` with:
  - `publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}`
  - `signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}`
  - `signInUrl="/sign-in"`
  - `signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}`
  - `signUpUrl="/sign-up"`
  - `taskUrls={{ "choose-organization": `${consoleUrl}/account/teams/new` }}`
  - `waitlistUrl="/early-access"`
- `<NuqsAdapter>` (nuqs adapter for Next.js app router)
- `<Toaster position="bottom-right">` (sonner)
- `<VercelAnalytics />` + `<SpeedInsights />`
- `<SentryUserIdentification />` (sets Sentry user from Clerk)

Font setup: `geistFonts` (from `@repo/ui/lib/fonts`) + `ppNeueMontreal.variable` (weight 500 only, local font from `public/fonts/`).

---

## 7. Environment Variables

### Auth app `src/env.ts` composition:
Extends these preset groups:
- `vercel()` — standard Vercel env vars (`VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL`, etc.)
- `clerkEnvBase` — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `betterstackEnv` — BetterStack logging
- `sentryEnv` — `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- `securityEnv` — Arcjet key (`ARCJET_KEY`)
- `upstashEnv` — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

Auth-specific server vars:
- `HEALTH_CHECK_AUTH_TOKEN` (optional, min 32 chars)

Auth-specific client vars:
- `NEXT_PUBLIC_VERCEL_ENV` (development|preview|production, defaults to "development")

### Console `src/env.ts` composition (for comparison):
Extends all of the above plus: `dbEnv`, `githubEnv`, `vercelEnv`, `knockEnv`, `basehubEnv`

Console-specific server vars: `HEALTH_CHECK_AUTH_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `ENCRYPTION_KEY`

**Delta — vars in auth that console already has:** All of them. Console's env.ts is a superset of auth's env.ts. No env vars are unique to auth.

---

## 8. Dependencies Unique to Auth (Not in Console)

Comparing `apps/auth/package.json` against `apps/console/package.json`:

### Runtime dependencies in auth but NOT console:
- `react-confetti: ^6.4.0` — used exclusively in `ConfettiWrapper` for early access success celebration

### Dev dependencies in auth but NOT console:
- `@clerk/testing: ^2.0.1` — Playwright/Vitest Clerk test helpers (E2E test accounts)
- `@playwright/test: ^1.58.2` — E2E test runner (console uses vitest only, no Playwright)
- `@tailwindcss/typography: catalog:tailwind4` — console does not have this

### Already in console (shared):
All other deps (`@rescale/nemo`, `@sentry/nextjs`, `@t3-oss/env-nextjs`, `@vendor/*`, `@vercel/microfrontends`, `@vercel/related-projects`, `geist`, `lucide-react`, `next`, `nuqs`, `react`, `react-dom`, `zod`, `vitest`, etc.)

---

## 9. Microfrontends Routing (`apps/console/microfrontends.json`)

Current `lightfast-auth` routing block:
```json
"lightfast-auth": {
  "packageName": "@lightfast/auth",
  "development": { "local": 4104 },
  "routing": [{
    "group": "auth",
    "paths": [
      "/early-access",
      "/sign-in",
      "/sign-in/:path*",
      "/sign-up",
      "/sign-up/opengraph-image-:hash",
      "/test-page"
    ]
  }]
}
```

These paths are currently delegated from the console (port 4107, default catch-all) to the auth app (port 4104) at request time via the Vercel microfrontends proxy.

After migration, all these paths would be served by console directly and the `lightfast-auth` entry in `microfrontends.json` would be removed.

---

## 10. Console Middleware Differences

### Auth (`src/proxy.ts`) vs Console (`src/middleware.ts`):

| Aspect | Auth | Console |
|--------|------|---------|
| File name | `proxy.ts` (export name `proxy`) | `middleware.ts` (export `default`) |
| Export pattern | `export const proxy = clerkMiddleware(...)` | `export default clerkMiddleware(...)` |
| Clerk `signInUrl` | `/sign-in` (relative, self) | `${authUrl}/sign-in` (points to auth app) |
| Clerk `signUpUrl` | `/sign-up` (relative, self) | `${authUrl}/sign-up` (points to auth app) |
| After-auth URLs | None set in middleware | `afterSignInUrl: "/account/welcome"`, `afterSignUpUrl: "/account/welcome"` |
| `organizationSyncOptions` | Not present | `{ organizationPatterns: ["/:slug", "/:slug/(.*)"] }` |
| CSP | nextjs + clerk + analytics + sentry + spotlight | nextjs + clerk + analytics + knock + sentry |
| Extra CSP (dev) | `connectSrc: ["http://localhost:8969"]` | None |
| Pending redirect target | `/account/teams/new` on `consoleUrl` | `/account/teams/new` on `req.url` (self) |
| Active redirect target | `/${orgSlug}` on `consoleUrl` | Not handled (org routes protected by `auth.protect()`) |
| `treatPendingAsSignedOut` | `false` | `false` |
| NEMO `before` array | Empty | Empty |
| Matcher pattern | Identical | Identical |

**Key difference**: Auth middleware handles redirecting authenticated users _away_ from auth pages to the console app. Console middleware handles protecting routes and redirecting unauthenticated users _to_ the auth app.

---

## 11. Console `ClerkProvider` Configuration

### Auth root layout `ClerkProvider`:
```
signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
signInUrl="/sign-in"
signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
signUpUrl="/sign-up"
taskUrls={{ "choose-organization": `${consoleUrl}/account/teams/new` }}
waitlistUrl="/early-access"
```

### Console `(app)/layout.tsx` `ClerkProvider`:
```
afterSignOutUrl={`${authUrl}/sign-in`}
publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
signInFallbackRedirectUrl="/account/welcome"
signInUrl={`${authUrl}/sign-in`}
signUpFallbackRedirectUrl="/account/welcome"
signUpUrl={`${authUrl}/sign-up`}
taskUrls={{ "choose-organization": "/account/teams/new" }}
```

Note: Auth's ClerkProvider sets `waitlistUrl="/early-access"`. Console's ClerkProvider does not set `waitlistUrl`. Auth uses relative sign-in/sign-up URLs (self-referential). Console points to `authUrl`.

---

## 12. `related-projects.ts` Usage

### Auth `src/lib/related-projects.ts`:
```typescript
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost: isDevelopment ? "http://localhost:4107" : "https://lightfast.ai",
});
```
Used in: `proxy.ts` (redirects), `app/layout.tsx` (ClerkProvider URLs), `_components/otp-island.tsx`, `_components/oauth-button.tsx`, `_components/session-activator.tsx`, `sign-up/sso-callback/page.tsx`.

### Console `src/lib/related-projects.ts`:
```typescript
export const authUrl = withRelatedProject({
  projectName: "lightfast-auth",
  defaultHost: isDevelopment ? "http://localhost:4104" : "https://lightfast.ai",
});
```
Used in: `middleware.ts` (Clerk signInUrl/signUpUrl), `(app)/layout.tsx` (ClerkProvider).

After migration, console's `related-projects.ts` would no longer need `authUrl` for sign-in/sign-up (they'd be self-hosted), and auth's `consoleUrl` references would become relative paths or self-references.

---

## 13. Font Differences

### Auth (`src/lib/fonts.ts`):
Loads only `PPNeueMontreal-Medium.woff2` (weight 500) under variable `--font-pp-neue-montreal`.

### Console (`src/lib/fonts.ts`):
Loads all 6 PP Neue Montreal weights (100, 400 normal+italic, 500, 600 italic, 700) plus Exposure Plus (4 weights) and PP Supply Sans.

Both apps have identical font files in `public/fonts/`. Auth's font loading is a subset of console's. After migration, the console's `ppNeueMontreal.variable` already covers weight 500 (medium) which is all that auth uses for headings.

---

## 14. Sentry Configuration Differences

### Auth `instrumentation.ts` (server):
- Initializes for `NEXT_RUNTIME === "nodejs"` and `NEXT_RUNTIME === "edge"` separately.
- `tracesSampleRate`: 0.2 production, 1.0 otherwise.
- `sendDefaultPii: true`, `enableLogs: true`, `includeLocalVariables: true` (node only).
- Integrations: `captureConsoleIntegration`, `extraErrorDataIntegration`.

### Auth `instrumentation-client.ts` (browser):
- Enables Session Replay: `replaysSessionSampleRate` 0.1 prod, 1.0 dev; `replaysOnErrorSampleRate: 1.0`.
- URL scrubbing in `beforeBreadcrumb`: redacts `token=`, `__clerk_ticket=`, `ticket=` params.
- Integrations: `replayIntegration` (maskAllText, blockAllMedia), `httpClientIntegration` (400-599), `reportingObserverIntegration`, `captureConsoleIntegration`, `extraErrorDataIntegration`.

Console has its own Sentry configuration (not read for this analysis). The auth app's `instrumentation-client.ts` token scrubbing in breadcrumbs is a notable auth-specific concern.

---

## 15. Test Infrastructure

Auth has both unit tests (Vitest) and E2E tests (Playwright):

### Unit tests (Vitest):
- `_actions/sign-in.test.ts` — tests `initiateSignIn` redirect behavior (4 cases)
- `_actions/sign-up.test.ts` — not separately reviewed but mirrors sign-in pattern
- `(early-access)/_actions/early-access.test.ts` — comprehensive tests (21 cases) covering Zod validation, Arcjet decisions, Redis dedup, Clerk happy path + all error codes
- `(early-access)/_lib/search-params.test.ts` — parameter parsing tests (19 cases)
- `(auth)/_lib/search-params.test.ts` — parameter parsing tests

### E2E tests (Playwright):
- `apps/auth/e2e/` directory (not read, but referenced via `@clerk/testing` and `@playwright/test` devDependencies)
- Test account: `some-email+clerk_test@lightfast.ai` / OTP `424242`
- Config: `apps/auth/playwright.config.ts`

Console has no Playwright dependency. All unit tests can be co-located after migration. The E2E tests require additional consideration (running against whichever app serves the routes).

---

## 16. `(app)/(auth)/layout.tsx` — Auth Shell Layout

Wraps sign-in and sign-up pages. Contains:
- `<Show when="signed-out"><RedirectToTasks /></Show>` — Clerk component that redirects authenticated users to their pending task (e.g. org creation). This fires for already-signed-in users navigating to `/sign-in` or `/sign-up` at the React component level (as a fallback to middleware).
- Fixed top header with logo (via `MicrofrontendLink href="/"`) and "Join the Early Access" CTA button (via `MicrofrontendLink href="/early-access"`).
- Full-height centered content area.

Note: Uses `@vercel/microfrontends/next/client` `Link` for inter-app navigation (logo to `/` routes to www; early-access routes to auth). After migration into console, these links would need to either remain as `MicrofrontendLink` or convert to console routing.

---

## 17. `(app)/(early-access)/layout.tsx` — Early Access Shell Layout

Same fixed header pattern as auth layout but with "Sign In" CTA linking to `/sign-in` via Next.js `Link` (not `MicrofrontendLink`). This is important: the early access layout uses `next/link` for the sign-in button, while the auth layout uses `MicrofrontendLink` for logo/waitlist. This inconsistency exists in auth today.

---

## 18. Search Param Schemas

### Sign-in params (`_lib/search-params.ts`):
```typescript
step: parseAsStringLiteral(["email", "code", "activate"]).withDefault("email")
email: parseAsString
error: parseAsString
token: parseAsString
errorCode: parseAsStringLiteral(["waitlist", "account_not_found"])
```

### Sign-up params:
```typescript
step: parseAsStringLiteral(["email", "code"]).withDefault("email")
email: parseAsString
error: parseAsString
ticket: parseAsString
__clerk_ticket: parseAsString   ← Clerk's own invitation URL parameter
errorCode: parseAsStringLiteral(["waitlist", "account_not_found"])
```

### Early access params:
```typescript
email: parseAsString.withDefault("")
companySize: parseAsString.withDefault("")
sources: parseAsString.withDefault("")  ← comma-separated
error: parseAsString
emailError: parseAsString
sourcesError: parseAsString
companySizeError: parseAsString
isRateLimit: parseAsBoolean.withDefault(false)
success: parseAsBoolean.withDefault(false)
```

---

## 19. Console Middleware — What Needs Changing for Migration

After migrating auth routes into console, `apps/console/src/middleware.ts` requires these changes:

### a. Add auth routes to `isPublicRoute`:
Currently the console middleware has no `/sign-in`, `/sign-up`, or `/early-access` entries. These need to be added as public (unauthenticated) routes.

### b. Handle authenticated-user redirect from auth pages:
Auth's `proxy.ts` lines 94–101 redirect signed-in/pending users away from `/sign-in` and `/sign-up`. This logic does not exist in console middleware. It would need to be added, or the `(auth)/layout.tsx`'s `<Show when="signed-out"><RedirectToTasks /></Show>` Clerk component can serve as the client-side fallback.

### c. Update `signInUrl` / `signUpUrl` in `clerkMiddleware` options:
Currently points to `${authUrl}/sign-in`. After migration, these become `/sign-in` (self-relative).

### d. Update `afterSignInUrl` / `afterSignUpUrl`:
Currently `/account/welcome`. No change needed.

### e. Remove `authUrl` from `related-projects.ts`:
Once auth routes live in console, console no longer needs to reference the auth project for sign-in/sign-up URLs.

---

## 20. Console ClerkProvider — What Needs Changing

Console's `(app)/layout.tsx` ClerkProvider currently sets:
```
signInUrl={`${authUrl}/sign-in`}
signUpUrl={`${authUrl}/sign-up`}
```

After migration, these become:
```
signInUrl="/sign-in"
signUpUrl="/sign-up"
```

Also, auth's ClerkProvider has `waitlistUrl="/early-access"` which is missing from console's ClerkProvider. This would need to be added.

---

## 21. Route Groups Needed in Console

The migration requires creating the following route group structure in `apps/console/src/app/`:

```
apps/console/src/app/(auth)/
  layout.tsx            ← auth shell (header with logo + early access CTA)
  error.tsx
  sign-in/
    page.tsx
    sso-callback/
      page.tsx
  sign-up/
    page.tsx
    sso-callback/
      page.tsx
  _actions/
    sign-in.ts
    sign-up.ts
  _lib/
    search-params.ts
  _components/
    email-form.tsx
    otp-island.tsx
    oauth-button.tsx
    error-banner.tsx
    separator-with-text.tsx
    session-activator.tsx
    shared/
      code-verification-ui.tsx

apps/console/src/app/(early-access)/
  layout.tsx
  error.tsx
  early-access/
    page.tsx
  _actions/
    early-access.ts
  _lib/
    search-params.ts
  _components/
    early-access-form-server.tsx
    company-size-island.tsx
    sources-island.tsx
    confetti-wrapper.tsx
    error-banner.tsx
    submit-button.tsx
```

Note: The `(user)/test-page/` route is likely not needed in production. It can be dropped or kept as dev scaffolding.

---

## 22. `~ / ~/` Alias Mapping

Auth uses `~/*` mapped to `./src/*` in `tsconfig.json`. Console uses the same convention.

Auth imports using `~/`:
- `~/env` — `src/env.ts`
- `~/lib/related-projects` — `src/lib/related-projects.ts`
- `~/lib/observability` — `src/lib/observability.ts`
- `~/styles/globals.css` — `src/styles/globals.css`

These all resolve cleanly within the `src/` directory. After migration to console, these same `~/` imports would resolve to the console's `src/` directory — the paths are portable but the target files would need to exist in console.

---

## 23. Packages Used by Auth — Presence in Console

| Package | Auth | Console | Notes |
|---------|------|---------|-------|
| `@vendor/clerk` | yes | yes | same vendor abstraction |
| `@vendor/security` | yes | yes | Arcjet, CSP middleware |
| `@vendor/upstash` | yes | yes | Redis |
| `@vendor/observability` | yes | yes | logging, error parsing |
| `@vendor/analytics` | yes | yes | Vercel analytics |
| `@vendor/seo` | yes | yes | createMetadata |
| `@vendor/next` | yes | yes | mergeNextConfig, etc. |
| `@rescale/nemo` | yes | yes | NEMO middleware |
| `@repo/ui` | yes | yes | all UI components |
| `@vercel/microfrontends` | yes | yes | Link, withMicrofrontends |
| `@vercel/related-projects` | yes | yes | withRelatedProject |
| `nuqs` | yes | yes | search params |
| `react-confetti` | yes | NO | unique to auth — needs adding to console |
| `geist` | yes | NO | used only in `global-error.tsx` for fallback fonts |
| `@t3-oss/env-nextjs` | yes | yes | env validation |
| `@sentry/nextjs` | yes | yes | error tracking |
| `zod` | yes | yes | validation |
| `lucide-react` | yes | yes | icons |

---

## 24. `geist` Direct Import — Edge Case

Auth's `global-error.tsx` (line 11-12) directly imports from `geist/font/mono` and `geist/font/sans` for the global error fallback font:
```typescript
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
```

This is because `global-error.tsx` cannot use the root layout's font variables (it replaces the entire HTML document). The `geist` package is a dependency in auth's `package.json`. Console's `package.json` does not list `geist` as a direct dependency (it comes through `@repo/ui`). This import would need verification in console — it likely works fine since `geist` is hoisted, but it should be added as an explicit dep if it becomes a direct import in console.

---

## 25. Key Behavioral Notes for Migration

### `MicrofrontendLink` vs `next/link`
Auth uses `@vercel/microfrontends/next/client` `Link` component in several places to navigate across app boundaries (auth → console, auth → www). After merging into console, these cross-app navigations change:
- Logo link `href="/"` routes to www (lightfast-www) — still cross-app, keep `MicrofrontendLink`
- `/early-access` link — will be same app, can use `next/link`
- `/sign-in` link from early-access layout — will be same app, can use `next/link`
- `/legal/terms` and `/legal/privacy` links — routes to www, keep `MicrofrontendLink`

### `consoleUrl` references in auth components
Every navigation to console uses `${consoleUrl}/account/welcome` or `${consoleUrl}/account/teams/new`. After migration, console URL becomes `https://lightfast.ai` in production (same domain, same app). These references become self-relative paths: `/account/welcome` and `/account/teams/new`. The `window.location.href` assignments in client components (`OTPIsland`, `OAuthButton`, `SessionActivator`, `sign-up/sso-callback`) can use `next/navigation`'s `router.push()` or direct relative paths.

### Auth's `proxy.ts` redirect logic for already-signed-in users
Auth middleware redirects signed-in users from `/sign-in` and `/sign-up` to console. Once these routes live in console, the existing console middleware would handle this but currently does _not_ have that logic. The `(auth)/layout.tsx` uses `<Show when="signed-out"><RedirectToTasks /></Show>` as a client-side fallback — this component from `@vendor/clerk/client` already handles redirection for authenticated users at the React layer.

### The `step=activate` flow (CLI token exchange)
The `SessionActivator` component handles a CLI login flow where `?step=activate&token=<jwt>` is passed to `/sign-in`. This uses `signIn.ticket()` which is a non-standard Clerk flow. This component and the `token` search param in `signInSearchParams` must be preserved exactly during migration.

### Arcjet in early access action
`joinEarlyAccessAction` uses `@vendor/security`'s arcjet integration with `request()` from `next/server`-equivalent. The Arcjet `characteristics: ["ip.src"]` means it needs real request context. This works as a server action and should continue to work in console.

### Redis key namespace
The early access action uses Redis key `"early-access:emails"` (a set). This key is app-agnostic and will continue to work regardless of which app hosts the server action.

---

## 26. `next.config.ts` Differences

### Auth `next.config.ts`:
- No `images.remotePatterns`
- `transpilePackages`: `@repo/ui`, `@vendor/seo`, `@vendor/observability`, `@vendor/next`, `@vendor/clerk`, `@vendor/analytics`
- No `experimental` block
- Wrapped: `withMicrofrontends(withSentry(baseConfig), { debug: true })`

### Console `next.config.ts`:
- Has `images.remotePatterns` for GitHub avatars
- Much longer `transpilePackages` list (all `@api/console`, `@db/console`, `@repo/console-*`, `@vendor/*`)
- `experimental.optimizePackageImports` list
- `experimental.turbopackScopeHoisting: false`
- `experimental.serverActions.bodySizeLimit: "2mb"` with `allowedOrigins`
- `redirects()` and `rewrites()` for docs proxy
- Debug conditional on `env.NODE_ENV !== "production"`

After migration, console's `next.config.ts` needs no structural changes. The auth routes will be served by it as-is. The auth app's `transpilePackages` entries are already a subset of console's.

---

## 27. `vercel.json`

Auth does not have a `vercel.json`. Routing is handled entirely via `microfrontends.json` in console.

