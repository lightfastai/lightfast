---
date: 2026-02-08T00:53:55+0000
researcher: Claude
git_commit: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
branch: main
repository: lightfastai/lightfast
topic: "Clerk Waitlist Mode Redirect Bug - accounts.lightfast.ai Redirect"
tags: [research, codebase, clerk, authentication, waitlist, early-access, redirect, bug, node-modules, clerk-props]
status: complete
last_updated: 2026-02-08
last_updated_by: Claude
last_updated_note: "Added Clerk props and configuration options from node_modules inspection"
---

# Research: Clerk Waitlist Mode Redirect Bug

**Date**: 2026-02-08T00:53:55+0000
**Researcher**: Claude
**Git Commit**: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
**Branch**: main
**Repository**: lightfastai/lightfast

## Research Question

Document the current authentication flow and redirect behavior when Clerk is in waitlist mode. The reported issue is that users not accepted into the waitlist are redirected to `https://accounts.lightfast.ai/sign-in` instead of seeing the appropriate "Sign-ups are currently unavailable" message directly in the sign-in/sign-up pages within the app, with a link to `/early-access`.

## Summary

The codebase does NOT use `accounts.lightfast.ai` as a subdomain for authentication. All authentication routes are path-based (`lightfast.ai/sign-in`, `lightfast.ai/sign-up`) and served via Vercel microfrontends. The redirect to `accounts.lightfast.ai` is NOT coming from the codebase configuration.

### Key Findings

1. **No Subdomain Pattern**: The codebase uses path-based routing (`/sign-in`, `/sign-up`) not subdomain-based (`accounts.lightfast.ai`)
2. **Microfrontends Architecture**: Auth app routes are mapped through `apps/console/microfrontends.json` to serve from main domain
3. **No Waitlist Messaging**: The sign-in/sign-up pages do NOT contain any waitlist-related error handling or messaging
4. **Only Clerk Reference**: The only domain containing "accounts" is `clerk.lightfast.ai` - Clerk's satellite domain for cross-domain sessions
5. **External Redirect Source**: The `accounts.lightfast.ai` redirect must be configured in Clerk Dashboard, not in the codebase

## Detailed Findings

### 1. Authentication Architecture

#### Microfrontends Routing Configuration

**File**: `apps/console/microfrontends.json:51-63`

```json
{
  "lightfast-auth": {
    "packageName": "@lightfast/auth",
    "development": {
      "local": 4104
    },
    "routing": [
      {
        "group": "auth",
        "paths": ["/sign-in", "/sign-in/:path*", "/sign-up"]
      }
    ]
  }
}
```

**Architecture**:
- Auth routes served from `lightfast.ai/sign-in` and `lightfast.ai/sign-up`
- Development: `http://localhost:4104`
- Production: `https://lightfast.ai` (NOT a separate subdomain)
- Console app (port 4107) acts as default/catch-all

#### Related Projects URL Configuration

**File**: `apps/console/src/lib/related-projects.ts:8-13`

```typescript
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_AUTH_PORT}`
    : 'https://lightfast.ai',
});
```

**Development**: `http://localhost:4104`
**Production**: `https://lightfast.ai` (NOT `accounts.lightfast.ai`)

### 2. Clerk Configuration in Codebase

#### Console App Middleware

**File**: `apps/console/src/middleware.ts:187-200`

```typescript
export default clerkMiddleware(
  async (auth, req: NextRequest, event) => {
    // ... middleware logic
  },
  {
    // Redirect to auth app for sign-in/sign-up
    signInUrl: `${authUrl}/sign-in`,
    signUpUrl: `${authUrl}/sign-up`,
    // Post-authentication redirects
    afterSignInUrl: "/account/teams/new",
    afterSignUpUrl: "/account/teams/new",
    // Sync Clerk organization state
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
  },
);
```

**Key Observation**: Uses `authUrl` variable which resolves to `lightfast.ai/sign-in` in production, NOT a subdomain.

#### Auth App Layout (ClerkProvider)

**File**: `apps/auth/src/app/layout.tsx:81-89`

```typescript
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  taskUrls={{
    "choose-organization": `${consoleUrl}/account/teams/new`,
  }}
>
```

**Configuration**:
- Sign-in/up URLs are relative paths: `/sign-in`, `/sign-up`
- Fallback redirects point to console: `/account/teams/new`
- No subdomain references

#### Clerk Environment Variables

**File**: `vendor/clerk/env.ts:8-11`

```typescript
server: {
  CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
},
client: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
},
```

**No custom domain configuration** in environment variables or configuration files.

### 3. Current Sign-In/Sign-Up Implementation

#### Sign-In Page

**File**: `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:30-36`

```typescript
export default function SignInPage() {
  return (
    <>
      <SignInForm />
    </>
  );
}
```

**Simple wrapper** - no waitlist error handling

#### Sign-Up Page

**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:12-16`

```typescript
export default function SignUpPage() {
  // Only show sign-up in development environment
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  // ...
}
```

**Development-only** - shows 404 in production (relies on Clerk Dashboard settings)

#### Sign-In Form Component

**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx`

**Flow**:
1. Email input → Code verification
2. Optional password sign-in (dev/preview only)
3. OAuth sign-in (GitHub)
4. Generic error display with "Try again" button

**No waitlist-specific error handling** or messaging

#### Clerk Error Handler

**File**: `apps/auth/src/app/lib/clerk/error-handler.ts:30-54`

```typescript
export function handleClerkError(
  error: unknown,
  context: ClerkErrorContext
): ClerkErrorResult {
  const message = getErrorMessage(error);
  const rateLimitInfo = isRateLimitError(error);
  const lockoutInfo = isAccountLockedError(error);

  let userMessage = message;

  if (rateLimitInfo.rateLimited) {
    userMessage = `Rate limit exceeded. Please try again in ${formatLockoutTime(rateLimitInfo.retryAfterSeconds)}.`;
  } else if (lockoutInfo.locked) {
    userMessage = `Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`;
  } else if (message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('invalid')) {
    userMessage = "The entered code is incorrect. Please try again and check for typos.";
  }
  // ...
}
```

**Handles**:
- Rate limiting errors
- Account lockout errors
- Invalid/incorrect code errors
- Generic Clerk API errors

**Does NOT handle**:
- Waitlist rejection errors
- Sign-up unavailable errors
- Restricted access errors

### 4. Auth Layout with Early Access CTA

**File**: `apps/auth/src/app/(app)/(auth)/layout.tsx:29-40`

```typescript
{/* Right: Waitlist CTA */}
<div className="flex items-center gap-2 md:justify-self-end">
  <Button
    variant="secondary"
    size="lg"
    asChild
    className="rounded-full"
  >
    <MicrofrontendLink href="/early-access">
      Join the Early Access
    </MicrofrontendLink>
  </Button>
</div>
```

**Current Implementation**:
- Early access link in navigation header
- No inline waitlist messaging on sign-in/sign-up pages
- Does NOT show when users are rejected by Clerk waitlist

### 5. Early Access Page

**File**: `apps/www/src/app/(app)/early-access/page.tsx`

**Location**: Served from `apps/www` via microfrontends routing at `lightfast.ai/early-access`

**Components**:
- Multi-step form with email, company size, and source questions
- Server actions for form submission
- Email integration via `@lightfast/email` package
- Redis for deduplication

**Key Finding**: Early access page exists and is functional, but users rejected by Clerk waitlist never see it because they're redirected to `accounts.lightfast.ai/sign-in` first.

### 6. The Only "accounts" Reference: Clerk Satellite

**File**: `vendor/security/src/csp/clerk.ts:26-41`

```typescript
export function createClerkCspDirectives(): PartialCspDirectives {
  const clerkFrontendApi = getClerkFrontendApi();

  return {
    scriptSrc: [
      clerkFrontendApi as Source,
      "https://clerk.lightfast.ai", // Satellite domain for cross-domain sessions
      "https://challenges.cloudflare.com",
    ],
    connectSrc: [
      clerkFrontendApi as Source,
      "https://clerk.lightfast.ai", // Satellite domain for cross-domain sessions
    ],
    // ...
  };
}
```

**Purpose**: `clerk.lightfast.ai` is Clerk's satellite domain for cross-domain session syncing, NOT an auth subdomain.

### 7. Historical Context

#### Related Research Documents

**File**: `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md`

**Issue**: Sign-in redirect loop where pending users (authenticated but no org) were redirected back to sign-in

**Root Cause**: Missing `setActive()` call after team creation

**Status**: Fixed

**Relevance**: Previous auth redirect issues were codebase bugs, but current issue appears to be Clerk Dashboard configuration.

---

**File**: `thoughts/shared/research/2025-12-24-early-access-form-best-practices.md`

**Analysis**: Early access form implementation with react-hook-form, Zod, Redis, Arcjet

**Relevance**: Documents that `/early-access` page exists and works correctly, but doesn't address how users reach it from auth rejection.

---

## Code References

**Authentication Configuration**:
- `apps/console/microfrontends.json:51-63` - Auth routing configuration
- `apps/console/src/lib/related-projects.ts:8-13` - Auth URL construction
- `apps/console/src/middleware.ts:187-200` - Clerk middleware config
- `apps/auth/src/app/layout.tsx:81-89` - ClerkProvider setup
- `apps/auth/src/middleware.ts:78-131` - Auth app middleware

**Sign-In/Sign-Up Pages**:
- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx` - Sign-in page (no waitlist handling)
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx` - Sign-up page (dev-only, 404 in prod)
- `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx` - Sign-in form
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx` - OAuth GitHub sign-in
- `apps/auth/src/app/(app)/(auth)/layout.tsx:29-40` - Early access CTA in header

**Error Handling**:
- `apps/auth/src/app/lib/clerk/error-handler.ts:30-97` - Clerk error handler
- `apps/auth/src/app/lib/clerk/error-handling.ts` - Error utilities

**Early Access**:
- `apps/www/src/app/(app)/early-access/page.tsx` - Early access page
- `apps/www/src/components/early-access-form.tsx` - Early access form
- `apps/www/src/components/early-access-actions.ts` - Server actions

**CSP Configuration**:
- `vendor/security/src/csp/clerk.ts:26-41` - Only "accounts" reference (clerk.lightfast.ai satellite)

## Architecture Documentation

### Authentication Flow (Current Implementation)

```
User visits lightfast.ai
  ↓
Unauthenticated → Redirected to /sign-in
  ↓
User attempts sign-in/sign-up
  ↓
Clerk processes authentication
  ↓
┌─────────────────────────────────────┐
│ IF waitlist mode enabled in Clerk:  │
│   → Clerk redirects to configured   │
│     URL (currently accounts.        │
│     lightfast.ai - NOT in codebase) │
└─────────────────────────────────────┘
  ↓
IF accepted:
  → Authenticated → /account/teams/new
  ↓
User creates/selects organization
  ↓
Active user → /{orgSlug} workspace
```

### Expected Flow (What Should Happen)

```
User visits lightfast.ai
  ↓
Unauthenticated → Redirected to /sign-in
  ↓
User attempts sign-in/sign-up
  ↓
Clerk processes authentication
  ↓
┌─────────────────────────────────────┐
│ IF waitlist rejection:              │
│   → Show inline error message       │
│   → "Sign-ups are currently         │
│      unavailable. Join the          │
│      waitlist..."                   │
│   → Link to /early-access           │
│   → DO NOT redirect externally      │
└─────────────────────────────────────┘
  ↓
IF accepted:
  → Continue normal flow
```

## Root Cause Analysis

### Where is `accounts.lightfast.ai` Coming From?

**Hypothesis**: The redirect to `accounts.lightfast.ai/sign-in` is configured in the **Clerk Dashboard**, not in the codebase.

**Evidence**:

1. **No subdomain in codebase**: Zero references to `accounts.lightfast.ai` in any configuration file
2. **Only one "accounts" reference**: `clerk.lightfast.ai` (satellite domain, different purpose)
3. **Microfrontends routing**: All apps route through `lightfast.ai` with path-based routing
4. **ClerkProvider config**: Uses relative paths (`/sign-in`, `/sign-up`) not external URLs

**Clerk Dashboard Settings to Check**:

1. **Paths → Sign-in URL**: Should be `/sign-in` (relative) NOT `https://accounts.lightfast.ai/sign-in`
2. **Paths → Sign-up URL**: Should be `/sign-up` (relative) NOT `https://accounts.lightfast.ai/sign-up`
3. **Restrictions → Waitlist Mode**: If enabled, check redirect behavior
4. **Domain Settings**: Check if `accounts.lightfast.ai` was previously configured and needs removal

### Why No Inline Waitlist Messaging?

**Current Implementation Gaps**:

1. **No Clerk error detection**: `handleClerkError()` doesn't check for waitlist rejection errors
2. **No waitlist UI component**: Sign-in/sign-up forms don't have waitlist messaging UI
3. **Sign-up page is 404 in prod**: Relies entirely on Clerk Dashboard settings to block sign-ups
4. **No error code mapping**: No handling for Clerk's waitlist rejection error codes

**What's Missing**:

```typescript
// In handleClerkError() or sign-in form component
if (isWaitlistRejection(error)) {
  return (
    <div className="text-center space-y-4">
      <p className="text-muted-foreground">
        Sign-ups are currently unavailable. Join the waitlist,
        and you will be notified when access becomes available.
      </p>
      <Button asChild>
        <Link href="/early-access">Join the Waitlist</Link>
      </Button>
    </div>
  );
}
```

## Related Research

- [2025-12-16-auth-sign-in-redirect-loop.md](thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md) - Previous sign-in redirect bug (fixed)
- [2025-12-24-early-access-form-best-practices.md](thoughts/shared/research/2025-12-24-early-access-form-best-practices.md) - Early access form implementation
- [2026-02-06-web-analysis-clerk-middleware-auth-header-stripping.md](thoughts/shared/research/2026-02-06-web-analysis-clerk-middleware-auth-header-stripping.md) - Clerk middleware behavior

## Available Clerk Props and Configuration (from node_modules)

### ClerkProvider Props for Waitlist

**File**: `node_modules/@clerk/types/dist/index.d.ts`

```typescript
// Line 5482-5484
/**
 * The full URL or path to the waitlist page. If `undefined`,
 * will redirect to the Account Portal waitlist page.
 */
waitlistUrl?: string;
```

**Usage**: Can be added to `ClerkProvider` in `apps/auth/src/app/layout.tsx`:

```typescript
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  waitlistUrl="/early-access"  // ← Add this!
  signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  // ...
>
```

### Sign-Up Mode Types

**File**: `node_modules/@clerk/types/dist/index.d.ts:1838`

```typescript
type SignUpModes = 'public' | 'restricted' | 'waitlist';
```

This confirms waitlist mode is a first-class feature in Clerk.

### Waitlist Error Code

**File**: `node_modules/@clerk/types/dist/index.d.ts:4717`

```typescript
not_allowed_access: LocalizationValue;
```

**Error code**: `not_allowed_access` - This is the Clerk error code returned when a user is rejected by waitlist mode.

### Waitlist Action Links

**File**: `node_modules/@clerk/types/dist/index.d.ts:4003-4004`

```typescript
actionText__join_waitlist: LocalizationValue;
actionLink__join_waitlist: LocalizationValue;
```

These are built-in Clerk UI elements that can show a "Join waitlist" link.

### Display Config Properties

**File**: `node_modules/@clerk/types/dist/index.d.ts:408-409`

```typescript
waitlist_url: string;
after_join_waitlist_url: string;
```

These properties are available on the `DisplayConfigResource` and control waitlist behavior.

## Recommended Solution

### 1. Add `waitlistUrl` Prop to ClerkProvider

**File**: `apps/auth/src/app/layout.tsx:81-89`

**Current**:
```typescript
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  taskUrls={{
    "choose-organization": `${consoleUrl}/account/teams/new`,
  }}
>
```

**Recommended**:
```typescript
<ClerkProvider
  publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  waitlistUrl="/early-access"  // ← Add this!
  signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
  taskUrls={{
    "choose-organization": `${consoleUrl}/account/teams/new`,
  }}
>
```

### 2. Handle `not_allowed_access` Error in Error Handler

**File**: `apps/auth/src/app/lib/clerk/error-handler.ts:30-54`

Add detection for the `not_allowed_access` error code:

```typescript
export function handleClerkError(
  error: unknown,
  context: ClerkErrorContext
): ClerkErrorResult {
  const message = getErrorMessage(error);
  const rateLimitInfo = isRateLimitError(error);
  const lockoutInfo = isAccountLockedError(error);

  let userMessage = message;

  if (rateLimitInfo.rateLimited) {
    userMessage = `Rate limit exceeded. Please try again in ${formatLockoutTime(rateLimitInfo.retryAfterSeconds)}.`;
  } else if (lockoutInfo.locked) {
    userMessage = `Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`;
  } else if (message.includes('not_allowed_access')) {  // ← Add this!
    userMessage = "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
  } else if (message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('invalid')) {
    userMessage = "The entered code is incorrect. Please try again and check for typos.";
  }
  // ...
}
```

### 3. Verify Clerk Dashboard Settings

The `waitlistUrl` prop in code only takes effect if Clerk's waitlist mode is properly configured. Check:

1. **Restrictions → Waitlist Mode**: Should be enabled
2. **Paths → Sign-in URL**: Should be `/sign-in` (relative) NOT `https://accounts.lightfast.ai/sign-in`
3. **Paths → Sign-up URL**: Should be `/sign-up` (relative) NOT `https://accounts.lightfast.ai/sign-up`
4. **Domain Settings**: Remove any reference to `accounts.lightfast.ai` if it exists

## Open Questions

1. **Clerk Dashboard Configuration**: What is currently configured in the Clerk Dashboard for:
   - Sign-in URL path?
   - Sign-up URL path?
   - Waitlist mode redirect URL?
   - Custom domain settings?

2. **Expected Behavior**: Should users rejected by waitlist:
   - See inline error on current page with link to `/early-access`? (Recommended)
   - Be redirected to `/early-access` directly? (Clerk default with `waitlistUrl` prop)
   - Be redirected to a dedicated `/waitlist` page?

3. **OAuth Flow**: How does waitlist rejection work with OAuth (GitHub) sign-in vs email sign-in?

4. **Development vs Production**: Is waitlist mode only enabled in production, explaining why sign-up page has `notFound()` in production?
