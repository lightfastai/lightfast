---
date: 2026-02-08T01:42:47+0000
researcher: jeevanpillay
git_commit: 935d95f0f730b4abc7342e47a41fb5a987aa549f
branch: main
repository: lightfast
topic: "Re-enabling sign-up page for post-waitlist invitation flow in production"
tags: [research, codebase, auth, sign-up, waitlist, clerk, production]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevanpillay
---

# Research: Re-enabling Sign-Up Page for Post-Waitlist Invitation Flow in Production

**Date**: 2026-02-08T01:42:47+0000
**Researcher**: jeevanpillay
**Git Commit**: 935d95f0f730b4abc7342e47a41fb5a987aa549f
**Branch**: main
**Repository**: lightfast

## Research Question

What is the current state of the sign-up page in `apps/auth/` and how is it configured for the post-waitlist invitation flow? What needs to be done to re-enable it for production?

## Summary

The sign-up page at `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx` is currently **restricted to development environments only** through a runtime check that calls `notFound()` when `NODE_ENV !== "development"`. The page was designed as a dev-only testing tool for iterating on the organization creation flow.

The auth app has comprehensive waitlist infrastructure already in place:
- **Clerk configuration** sets `waitlistUrl="/early-access"` in the root layout
- **Error handling system** detects `sign_up_restricted_waitlist` errors and shows user-friendly messages
- **Sign-in form UI** displays a "Join the Waitlist" button when sign-ups are restricted
- **Early-access page** exists in `apps/www/` to collect waitlist signups

To re-enable the sign-up page for production after users accept waitlist invitations, the primary change needed is **removing or modifying the `NODE_ENV` check** at line 14 of `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`.

## Detailed Findings

### Current Sign-Up Page Implementation

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`

The page has a hardcoded development-only restriction:

```typescript
export default function SignUpPage() {
  // Only show sign-up in development environment
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mb-4">
              DEV ONLY
            </div>
            <p className="text-sm text-muted-foreground">
              Create test accounts for development
            </p>
          </div>

          <SignUpForm />
        </div>
      </div>
    </>
  );
}
```

Key observations:
- **Line 14**: `if (process.env.NODE_ENV !== "development")` triggers `notFound()` in production
- **Line 23-25**: Yellow "DEV ONLY" badge displayed to indicate testing purpose
- **Line 26-28**: Descriptive text explaining this is for test account creation
- **Line 31**: Renders `<SignUpForm />` component when allowed

The component includes inline documentation stating: *"This page is only available in development to allow creating test accounts for iterative testing of the organization creation flow."*

### Sign-Up Form Structure

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`

The `<SignUpForm />` component implements a two-step email verification flow:

```typescript
export function SignUpForm() {
	const [verificationStep, setVerificationStep] = React.useState<
		"email" | "code"
	>("email");
	const [emailAddress, setEmailAddress] = React.useState("");
	const [error, setError] = React.useState("");

	function handleEmailSuccess(email: string) {
		setEmailAddress(email);
		setVerificationStep("code");
		setError("");
	}

	function handleReset() {
		setVerificationStep("email");
		setError("");
		setEmailAddress("");
	}

	function handleError(errorMessage: string) {
		setError(errorMessage);
	}

  // ... renders email input OR code verification based on verificationStep
}
```

The form provides three sign-up methods:
1. **Email + verification code** via `<SignUpEmailInput />` (line 65-68)
2. **OAuth providers** via `<OAuthSignUp />` (line 103)
3. **Legal compliance links** for Terms of Service and Privacy Policy (line 71-90)

The form transitions from email entry → code verification → post-signup redirect to organization creation at `${consoleUrl}/account/teams/new`.

### Waitlist Configuration in Clerk

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/layout.tsx`

The root layout configures Clerk with waitlist settings:

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      waitlistUrl="/early-access"
      signInFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
      signUpFallbackRedirectUrl={`${consoleUrl}/account/teams/new`}
      taskUrls={{
        "choose-organization": `${consoleUrl}/account/teams/new`,
      }}
    >
      {/* ... */}
    </ClerkProvider>
  );
}
```

Key configuration:
- **Line 84**: `signUpUrl="/sign-up"` - points to the currently-blocked sign-up page
- **Line 85**: `waitlistUrl="/early-access"` - redirects to waitlist when sign-ups restricted
- **Line 86-87**: Both sign-in and sign-up redirect to organization creation after success
- **Line 88-90**: `taskUrls` with "choose-organization" task redirects to team creation

This configuration tells Clerk where to send users when they encounter a waitlist restriction.

### Waitlist Error Handling System

**Error Detection**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/lib/clerk/error-handling.ts:87-95`

```typescript
export function isSignUpRestricted(err: unknown): boolean {
  if (isClerkAPIResponseError(err)) {
    return err.errors.some(
      (error: ClerkAPIError) => error.code === 'sign_up_restricted_waitlist'
    )
  }
  return false
}
```

The system checks for the specific Clerk error code `sign_up_restricted_waitlist` to determine if a user is hitting waitlist restrictions.

**Error Processing**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/lib/clerk/error-handler.ts:32-106`

The `handleClerkError()` function transforms the error into user-friendly messaging:

```typescript
export function handleClerkError(
  error: unknown,
  context: ClerkErrorContext
): ClerkErrorResult {
  // Extract the Clerk error message
  const message = getErrorMessage(error);

  // Check for specific error types
  const rateLimitInfo = isRateLimitError(error);
  const lockoutInfo = isAccountLockedError(error);
  const signUpRestricted = isSignUpRestricted(error);

  // Determine the user-facing message
  let userMessage = message;

  if (rateLimitInfo.rateLimited) {
    userMessage = rateLimitInfo.retryAfterSeconds
      ? `Rate limit exceeded. Please try again in ${formatLockoutTime(rateLimitInfo.retryAfterSeconds)}.`
      : "Rate limit exceeded. Please wait a moment and try again.";
  } else if (lockoutInfo.locked) {
    userMessage = lockoutInfo.expiresInSeconds
      ? `Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`
      : "Account locked. Please try again later.";
  } else if (signUpRestricted) {
    userMessage = "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
  }

  // Capture to Sentry with comprehensive context
  captureException(sentryError, {
    tags: {
      component: context.component,
      action: context.action,
      error_type: signUpRestricted ? 'sign_up_restricted' : 'validation',
    },
    extra: {
      clerkErrorMessage: message,
      userMessage,
      isSignUpRestricted: signUpRestricted,
      // ... more metadata
    },
  });

  return {
    message,
    userMessage,
    isRateLimit: rateLimitInfo.rateLimited,
    isAccountLocked: lockoutInfo.locked,
    isSignUpRestricted: signUpRestricted,
    retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
  };
}
```

**Key aspects**:
- Line 42: Detects `sign_up_restricted_waitlist` via `isSignUpRestricted()`
- Line 55-56: Provides user-friendly message when sign-ups restricted
- Line 73-96: Logs to Sentry with `error_type: 'sign_up_restricted'` tag
- Line 98-105: Returns structured result including `isSignUpRestricted` boolean

### Sign-In Form Waitlist UI

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx`

The sign-in form detects waitlist errors and displays special UI:

```typescript
export function SignInForm() {
  const [error, setError] = React.useState("");
  const [isWaitlistRestricted, setIsWaitlistRestricted] = React.useState(false);

  function handleError(errorMessage: string, isSignUpRestricted = false) {
    setError(errorMessage);
    setIsWaitlistRestricted(isSignUpRestricted);
  }

  // Check for waitlist error after OAuth redirect
  React.useEffect(() => {
    const verificationError = signIn?.firstFactorVerification.error;
    if (verificationError?.code === "sign_up_restricted_waitlist") {
      setError(verificationError.longMessage ?? "Sign-up is restricted...");
      setIsWaitlistRestricted(true);
    }
  }, [signIn]);

  return (
    <div className="w-full space-y-8">
      {/* Regular error UI */}
      {error && !isWaitlistRestricted && (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <Button onClick={handleReset} variant="outline" className="w-full h-12">
            Try again
          </Button>
        </div>
      )}

      {/* Waitlist error UI */}
      {error && isWaitlistRestricted && (
        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/30 border border-destructive/50 p-3">
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <Button asChild variant="default" className="w-full h-12">
            <Link href="/early-access">Join the Waitlist</Link>
          </Button>
          <Button onClick={handleReset} variant="outline" className="w-full h-12">
            Back to Sign In
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Key flow**:
- **Line 38-47**: `useEffect` checks for `sign_up_restricted_waitlist` code after OAuth redirect
- **Line 62-65**: `handleError()` callback receives `isSignUpRestricted` flag from child components
- **Line 85-98**: Regular error UI with red background and "Try again" button
- **Line 100-118**: Waitlist error UI with:
  - Destructive-styled background (line 102)
  - "Join the Waitlist" button linking to `/early-access` (line 106-108)
  - "Back to Sign In" button to reset form (line 110-116)

### OAuth Sign-In Waitlist Handling

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx`

The OAuth component passes waitlist errors to parent forms:

```typescript
export function OAuthSignIn({ onError }: OAuthSignInProps) {
  async function signInWith(strategy: OAuthStrategy) {
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: `${consoleUrl}/account/teams/new`,
      });
    } catch (err) {
      logger.error("oauth-sign-in", "Authentication failed", {
        strategy,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "oauth-sign-in",
        action: "authenticateWithRedirect",
        strategy,
      });

      // Pass waitlist errors to parent for special handling
      if (errorResult.isSignUpRestricted) {
        onError?.(errorResult.userMessage, true);
      } else {
        toast.error(errorResult.userMessage);
      }

      setLoading(null);
    }
  }
}
```

**Key aspects**:
- **Line 38-42**: Calls `handleClerkError()` to process Clerk exceptions
- **Line 46**: Checks `errorResult.isSignUpRestricted` boolean
- **Line 47**: If waitlist restricted, calls `onError(message, true)` with second parameter `true`
- **Line 49**: For other errors, displays toast notification

This pattern allows the parent `SignInForm` component to render custom UI for waitlist restrictions while showing inline toasts for transient errors.

### Early-Access Page Structure

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/www/src/app/(app)/early-access/page.tsx`

The waitlist entry point exists in the `apps/www` application (not `apps/auth`):

```typescript
// Primary early-access page component with metadata and form initialization
```

**Supporting files**:
- `apps/www/src/components/early-access-form.tsx` - Main form component (18,359 bytes)
- `apps/www/src/components/early-access-form-provider.tsx` - Form context provider
- `apps/www/src/components/early-access-form.schema.ts` - Zod validation schema
- `apps/www/src/components/early-access-actions.ts` - Server actions (8,683 bytes)
- `apps/www/src/components/use-early-access-params.ts` - URL param parser

The form collects:
- Email address
- Company size
- Traffic sources
- Other metadata for signup analytics

Server actions handle submission and store data in Redis/database for later processing.

### Auth Layout Navbar

**Location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/auth/src/app/(app)/(auth)/layout.tsx`

The auth pages include a navbar with a waitlist CTA:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SignedOut>
        <RedirectToTasks />
      </SignedOut>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="shrink-0 fixed top-0 left-0 right-0 z-50 py-4 page-gutter bg-background">
          <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
            {/* Left: Logo */}
            <div className="-ml-2 flex items-center md:justify-self-start">
              <MicrofrontendLink href="/" className="flex items-center">
                <Icons.logoShort className="text-foreground size-6" />
              </MicrofrontendLink>
            </div>
            {/* Center placeholder */}
            <div className="hidden md:block" aria-hidden />
            {/* Right: Waitlist CTA */}
            <div className="flex items-center gap-2 md:justify-self-end">
              <Button variant="secondary" size="lg" asChild className="rounded-full">
                <MicrofrontendLink href="/early-access">
                  Join the Early Access
                </MicrofrontendLink>
              </Button>
            </div>
          </div>
        </header>
        {/* ... main content ... */}
      </div>
    </>
  );
}
```

**Key aspects**:
- **Line 5**: `<SignedOut><RedirectToTasks /></SignedOut>` redirects authenticated users
- **Line 31-35**: "Join the Early Access" button always visible in navbar
- **Line 37**: Links to `/early-access` route
- Layout provides consistent navigation across sign-in, sign-up, and error states

## Code References

- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:14` - NODE_ENV check blocking production
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:23-28` - DEV ONLY badge and description
- `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx:1-132` - Full sign-up form implementation
- `apps/auth/src/app/layout.tsx:85` - waitlistUrl configuration
- `apps/auth/src/app/lib/clerk/error-handling.ts:87-95` - isSignUpRestricted() function
- `apps/auth/src/app/lib/clerk/error-handler.ts:55-56` - Waitlist user message
- `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx:100-118` - Waitlist UI in sign-in
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx:44-51` - OAuth waitlist passthrough
- `apps/auth/src/app/(app)/(auth)/layout.tsx:31-39` - Navbar with early-access CTA
- `apps/www/src/app/(app)/early-access/page.tsx` - Waitlist signup page

## Architecture Documentation

### Environment-Based Feature Toggling Patterns

The codebase uses several patterns for environment-based feature flags. The sign-up page follows **Pattern 1: Development-Only Routes (Early Return)**:

```typescript
export default function SignUpPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  // ... render component
}
```

Other patterns found in the codebase:

**Pattern 2: Deployment Stage Base URLs** (`apps/www/src/lib/base-url.ts:15-39`):
```typescript
export const createBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

  if (vercelEnv === "production") {
    return "https://www.lightfast.ai";
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
};
```

**Pattern 3: CORS Origin Allowlisting** (`apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:22-44`):
```typescript
const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  if (env.VERCEL_ENV === "production") {
    origins.add("https://lightfast.ai");
  }

  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    origins.add(`https://${env.VERCEL_URL}`);
  }

  if (env.NODE_ENV === "development") {
    origins.add("http://localhost:4107");
    origins.add("http://localhost:3024");
    origins.add("http://localhost:4101");
    origins.add("http://localhost:4104");
  }

  return origins;
};
```

**Pattern 4: Cookie Security by Environment** (`apps/console/src/app/(github)/api/github/authorize-user/route.ts:51-57`):
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // HTTPS in production, HTTP in dev
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};
```

### Clerk Authentication Flow

The authentication system is configured through `<ClerkProvider>` with URL routing:

```
User Journey:

1. User visits /sign-in or /sign-up
   ↓
2. Attempts authentication (email/OAuth)
   ↓
3a. Success → redirects to signInFallbackRedirectUrl or signUpFallbackRedirectUrl
                (`${consoleUrl}/account/teams/new`)
   ↓
3b. Clerk returns sign_up_restricted_waitlist error
   ↓
4. handleClerkError() processes error
   ↓
5. isSignUpRestricted() returns true
   ↓
6. Parent form receives error with isSignUpRestricted flag
   ↓
7. Form renders "Join the Waitlist" button → /early-access
   ↓
8. User fills out waitlist form in apps/www
   ↓
9. Server action stores waitlist signup
   ↓
10. [Future] Admin sends invitation → user gets email with sign-up link
   ↓
11. User clicks link → returns to /sign-up page
   ↓
12. [Current blocker] /sign-up returns 404 in production due to NODE_ENV check
```

The missing piece is **step 11-12**: when users receive waitlist invitations and click through to sign up, they hit a 404 because the sign-up page is blocked in production.

### Environment Variables

**NODE_ENV** - Node.js standard environment variable:
- `"development"` - Local development
- `"production"` - Production builds

**NEXT_PUBLIC_VERCEL_ENV** - Vercel deployment stage (public, available on client):
- `"development"` - Local development
- `"preview"` - Vercel preview deployments
- `"production"` - Production deployment on Vercel

The sign-up page uses `NODE_ENV` for its check, meaning it's blocked in all production builds regardless of whether they're deployed to Vercel preview or production environments.

## Historical Context (from thoughts/)

### Waitlist Redirect Bug
- `thoughts/shared/plans/2026-02-08-clerk-waitlist-redirect-bug.md` - Documents a bug where users rejected by waitlist are redirected to external `accounts.lightfast.ai/sign-in` (which doesn't exist)
- `thoughts/shared/research/2026-02-08-clerk-waitlist-redirect-bug.md` - Deep analysis showing current auth flow uses path-based routing (`/sign-in`, `/sign-up`) but external redirects fail

The fix for this bug involved:
1. Adding `waitlistUrl="/early-access"` to ClerkProvider (already completed)
2. Detecting `sign_up_mode_restricted_waitlist` error code (already implemented)
3. Displaying inline messaging with early access link (already implemented)

### Early Access Form Evaluation
- `thoughts/shared/research/2025-12-24-early-access-form-best-practices.md` - Documents early access form including bot detection (Arcjet), signup flow, Redis failure handling, and security considerations

The form exists and is functional in `apps/www/`.

### Organization Creation Flow
- `thoughts/shared/plans/2026-02-06-org-create-error-propagation-fix.md` - Documents error handling when organization slug is taken
- `thoughts/shared/research/2026-02-06-org-create-error-propagation.md` - Shows Clerk error code analysis for slug conflicts

Post-signup, users are redirected to `${consoleUrl}/account/teams/new` to create their organization.

### Auth Sign-In Redirect Loop
- `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md` - Analysis of sign-in redirect loop after OAuth: custom components don't handle pending organization tasks correctly

This was resolved by adding `<RedirectToTasks />` component in the auth layout (line 5 of `apps/auth/src/app/(app)/(auth)/layout.tsx`).

### Early Access Optimizations
- `thoughts/shared/plans/2026-01-28-early-access-optimizations.md` - Optimization plan for early-access page including bundle size reduction and performance improvements

Planned optimizations for the waitlist form, not yet implemented.

### ClerkOrgId Propagation
- `thoughts/shared/plans/2025-12-16-clerkorgid-propagation-architecture.md` - Architecture plan for passing `clerkOrgId` through event data in workflows instead of database lookups

Affects post-signup organization setup flow.

## Related Research

- `thoughts/shared/research/2026-02-08-clerk-waitlist-redirect-bug.md` - Waitlist redirect bug analysis
- `thoughts/shared/research/2025-12-24-early-access-form-best-practices.md` - Early access form implementation
- `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md` - Auth redirect loop fix
- `thoughts/shared/research/2026-02-06-org-create-error-propagation.md` - Organization creation errors
- `thoughts/shared/research/2025-12-10-clerk-integration-research.md` - Clerk integration capabilities

## Open Questions

1. **What is the post-waitlist invitation flow?**
   - How are waitlist invitations sent to users?
   - Do invitations include a direct link to `/sign-up` with an invitation token?
   - Or do they link to `/early-access` with a special parameter?

2. **Should the sign-up page remain publicly accessible in production?**
   - Or should it only be accessible with a valid invitation token?
   - If token-based, where is the token validation logic?

3. **What about the "DEV ONLY" badge and dev-specific messaging?**
   - Should this be removed or conditionally rendered?
   - Is there production-ready copy for the sign-up page header?

4. **Are there any other production blockers beyond the NODE_ENV check?**
   - Email verification in production vs development
   - OAuth provider configuration differences
   - Database/API endpoints that need production credentials

5. **What is the relationship between Clerk's waitlist feature and the custom waitlist form?**
   - Is Clerk's built-in waitlist being used?
   - Or is this a custom implementation that just uses Clerk's error codes?

6. **Should there be analytics/monitoring for production sign-ups?**
   - Track conversion from waitlist invitation → successful signup
   - Monitor sign-up failures and error rates
   - Log which invitation tokens are being used
