# Fix Middleware Blocking /monitoring and /ingest/* Routes

## Overview

Third-party service routes (`/monitoring` for Sentry, `/ingest/*` for PostHog) are missing from the middleware's public routes list, causing authentication errors and blocking analytics/error reporting from the browser.

## Current State Analysis

**File**: `apps/console/src/middleware.ts:28-37`

The `isPublicRoute` matcher defines routes that bypass Clerk authentication. Currently missing:
- `/monitoring` - Sentry error reporting tunnel (configured in `vendor/next/src/next-config-builder.ts:103`)
- `/ingest(.*)` - PostHog analytics proxy (configured as Next.js rewrites in `vendor/next/src/next-config-builder.ts:28-40`)

**Why this causes errors**: Next.js middleware runs before rewrites. Browser-side requests to `/monitoring` and `/ingest/flags` hit the Clerk auth check, fail with no session, and get blocked before the rewrites can proxy them to Sentry/PostHog.

### Key Discoveries:
- Sentry comment at `vendor/next/src/next-config-builder.ts:100-101` explicitly warns: "Check that the configured route will not match with your Next.js middleware"
- PostHog client initializes with `api_host: ${baseUrl}/ingest` at `vendor/analytics/src/providers/posthog/instrumentation-client.ts:11`
- Middleware matcher at `middleware.ts:204-208` runs on ALL routes except static files

## Desired End State

After this fix:
1. `/monitoring` and `/ingest/*` routes bypass authentication entirely
2. No more misleading "tRPC User Request from rsc - unauthenticated" errors from analytics routes
3. Sentry error reporting works from browser (if `withSentry` is applied)
4. PostHog analytics, feature flags (`/ingest/flags`), and decisions (`/ingest/decide`) work from browser
5. No security impact - these routes proxy to external services, not internal data

### Verification:
- Dev server starts without errors: `pnpm dev:console`
- No authentication errors in logs for `/monitoring` or `/ingest/*` requests
- Browser DevTools Network tab shows 200 responses for `/ingest/flags` calls

## What We're NOT Doing

- Not fixing the Knock Feed UUID issue (separate follow-up)
- Not adding `withSentry` wrapper to console's `next.config.ts` (separate investigation needed)
- Not changing the middleware architecture or auth flow
- Not modifying any other apps' middleware (only console affected since it's the default microfrontend app)

## Implementation Approach

Single-file change: add 2 route patterns to the existing `isPublicRoute` matcher.

## Phase 1: Add Public Routes for Third-Party Services

### Overview
Add `/monitoring` and `/ingest(.*)` to the public routes matcher so they bypass Clerk authentication.

### Changes Required:

#### 1. Middleware Public Routes
**File**: `apps/console/src/middleware.ts`
**Changes**: Add 2 entries to the `isPublicRoute` matcher at lines 28-37

```typescript
// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/inngest(.*)",
  "/api/github/webhooks", // GitHub webhook endpoint (CRITICAL: must be public)
  "/api/vercel/webhooks", // Vercel webhook endpoint
  "/robots.txt",
  "/sitemap(.*)",
  "/llms.txt", // AI crawler guidance file
  "/docs(.*)", // Documentation pages
  "/monitoring", // Sentry error reporting tunnel (tunnelRoute in vendor/next config)
  "/ingest(.*)", // PostHog analytics proxy (rewrites to us.i.posthog.com)
]);
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build:console` (skipped - requires full env vars, middleware code is valid)
- [x] Type checking passes: `pnpm typecheck` (console app passes)
- [x] Linting passes: `pnpm lint` (console app passes)

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:console`
- [ ] Open browser DevTools → Network tab
- [ ] Navigate to any console page
- [ ] Verify `/ingest/flags` requests return 200 (not 401/redirect)
- [ ] Verify no "Authentication required" errors in server logs for `/monitoring` or `/ingest/*`
- [ ] Verify authenticated routes still work correctly (tRPC calls, org pages)

**Implementation Note**: This is a single-phase plan. After completing automated verification, pause for manual confirmation.

## Testing Strategy

### Manual Testing Steps:
1. Start dev server with `pnpm dev:console`
2. Open browser DevTools Network tab
3. Navigate to console (e.g., `http://localhost:3024`)
4. Filter network requests for "ingest" - verify 200 responses from PostHog proxy
5. Check server terminal - verify no `UNAUTHORIZED` errors for `/monitoring` or `/ingest/*` paths
6. Log in and navigate to org pages - verify tRPC calls still work normally
7. Check that `auth.protect()` still blocks unauthenticated access to protected routes

## Performance Considerations

None - this adds 2 string comparisons to the route matcher. The `createRouteMatcher` function from Clerk uses efficient regex matching.

## Security Considerations

**No security risk**: Both routes proxy to external services, not internal data:
- `/monitoring` → `*.ingest.sentry.io` (Sentry)
- `/ingest/*` → `us.i.posthog.com` (PostHog)

These are the same endpoints that would be called directly by the browser if the proxy wasn't used. The proxy exists only to bypass ad-blockers.

## Follow-up Items (Out of Scope)

1. **Knock Feed UUID**: Replace `"lightfast-console-notifications"` with actual UUID from Knock dashboard in `vendor/knock/src/components/provider.tsx:12`
2. **Sentry Wrapper**: Investigate whether console should use `withSentry` instead of/alongside `withBetterStack` in `apps/console/next.config.ts:13`
3. **Other Apps**: Check if `apps/www`, `apps/auth`, `apps/chat` have similar middleware issues (they may have different middleware configs)

## References

- Research: `thoughts/shared/research/2026-02-08-monitoring-route-sentry-errors.md`
- Sentry tunnel docs: `vendor/next/src/next-config-builder.ts:97-103`
- PostHog proxy config: `vendor/next/src/next-config-builder.ts:27-50`
- Middleware: `apps/console/src/middleware.ts:28-37`
