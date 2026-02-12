# Auth Sign-Up Production Enablement Implementation Plan

## Overview

Enable the sign-up page in production to support post-waitlist invitation flows. Currently, the sign-up page returns 404 in production via a `NODE_ENV` check. This plan removes that restriction, adds support for Clerk waitlist invitation tokens (`__clerk_ticket`), creates the missing SSO callback route, and adds inline waitlist error handling to match the sign-in flow UX.

## Current State Analysis

### Sign-Up Page Restrictions
- **Location**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:14-16`
- **Current Behavior**: Returns `notFound()` when `NODE_ENV !== "development"`
- **Dev-Only Elements**: Yellow "DEV ONLY" badge (line 23-25) and descriptive text (line 26-28)
- **No Metadata**: Unlike sign-in page, no SEO metadata defined

### Sign-Up Form Implementation
- **Location**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
- **Current State**: Production-ready two-step flow (email → code verification)
- **OAuth Support**: GitHub OAuth via `<OAuthSignUp />` component
- **Error Handling**: Generic error display (lines 47-60) without waitlist-specific handling

### Missing SSO Callback Route
- **Referenced At**: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx:25`
- **Problem**: OAuth sign-up redirects to `/sign-up/sso-callback` but no page exists
- **Middleware**: Route is declared public at `apps/auth/src/middleware.ts:51`
- **Comparison**: `/sign-in/sso-callback` exists and uses `<AuthenticateWithRedirectCallback />`

### Clerk Invitation Token Flow
- **Token Parameter**: `__clerk_ticket` (from Clerk waitlist invitation emails)
- **Expected Behavior**: When user clicks invitation link, they arrive at `/sign-up?__clerk_ticket=<token>`
- **Required Handling**: Extract token, call `signUp.create({ strategy: 'ticket', ticket: token, ... })`
- **Auto-Verification**: Ticket strategy skips email verification (user is pre-approved)
- **Current State**: No token detection or handling exists

### Waitlist Error Handling Gap
- **Sign-In Form**: Lines 100-118 of `sign-in-form.tsx` have inline waitlist error display with "Join the Waitlist" CTA
- **Sign-Up Form**: Only shows toast notification (no inline handling)
- **OAuth Sign-Up**: `oauth-sign-up.tsx:40` only displays toast, doesn't pass `isSignUpRestricted` flag to parent

## Desired End State

After implementation:
1. Sign-up page accessible in production at `/sign-up` (same as `/sign-in`)
2. Users with `__clerk_ticket` invitation tokens can complete sign-up with pre-verified email
3. OAuth sign-up flow completes via `/sign-up/sso-callback` route
4. Waitlist rejection errors show inline with "Join the Waitlist" CTA (matching sign-in UX)
5. Sign-up page has proper metadata for SEO

### Verification
- Visit `https://lightfast.ai/sign-up` → page renders (not 404)
- Visit `/sign-up?__clerk_ticket=<token>` → auto-completes sign-up without email verification
- Click "Continue with GitHub" → OAuth flow completes via `/sign-up/sso-callback`
- Trigger waitlist error → inline message with "Join the Waitlist" button appears

## What We're NOT Doing

- Password-based sign-up (sign-up only supports email code + GitHub OAuth)
- Custom invitation token storage or validation (relying on Clerk's built-in handling)
- Navbar changes or conditional CTA display
- Waitlist management interface (handled in Clerk Dashboard)
- Analytics/tracking for invitation conversion (future enhancement)
- Custom email templates for invitations (using Clerk's default `waitlist_invitation` template)

## Implementation Approach

We'll progressively enable production access, add missing routes, implement invitation token handling, and improve error UX to match the sign-in flow. Each phase builds on the previous one and can be verified independently before moving forward.

---

## Phase 1: Enable Sign-Up Page for Production

### Overview
Remove the development-only gate and prepare the sign-up page for production use with proper metadata.

### Changes Required

#### 1. Remove NODE_ENV Gate and Dev-Only Elements
**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`
**Changes**:
- Delete lines 6-11 (dev-only documentation comment)
- Delete lines 13-16 (NODE_ENV check and notFound() call)
- Delete lines 22-29 (DEV ONLY badge and description wrapper)
- Update line 20 to remove outer wrapping div
- Add metadata export (matching sign-in page pattern)

**Before** (lines 12-36):
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

**After**:
```typescript
import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Sign Up - Lightfast Auth",
  description:
    "Create your Lightfast account to access the AI agent platform. Secure sign-up portal for developers.",
  openGraph: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-up",
  },
  twitter: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-up",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default function SignUpPage() {
  return (
    <>
      <SignUpForm />
    </>
  );
}
```

**Explanation**: This matches the exact pattern from `sign-in/page.tsx:1-36`, removing all development-only guards and messaging while adding proper SEO metadata.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [x] Visit `http://localhost:4101/sign-up` in development → page renders without "DEV ONLY" badge
- [x] Deploy to Vercel preview → visit preview URL `/sign-up` → page renders (not 404)
- [x] Check page source → metadata tags present (`<title>`, `<meta property="og:title">`, etc.)
- [x] Sign-up form displays email input, GitHub OAuth button, and legal compliance text
- [x] Layout navbar shows "Join the Early Access" button

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Handle Clerk Invitation Tokens (`__clerk_ticket`)

### Overview
Add support for Clerk waitlist invitation tokens that allow pre-approved users to sign up with auto-verified emails.

### Changes Required

#### 1. Create Token-Based Sign-Up Component
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-email-input.tsx`
**Changes**: Add support for invitation ticket strategy

Find the current `onSubmit` function (around line 48-85) and update to check for invitation token:

**Add to component props interface** (after line 12):
```typescript
interface SignUpEmailInputProps {
  onSuccess: (email: string) => void;
  onError: (errorMessage: string) => void;
  invitationTicket?: string | null; // Add this line
}
```

**Update component signature** (line 33):
```typescript
export function SignUpEmailInput({
  onSuccess,
  onError,
  invitationTicket, // Add this parameter
}: SignUpEmailInputProps) {
```

**Update `onSubmit` function** (lines 48-85) to handle ticket strategy:

```typescript
const onSubmit = async (data: FormData) => {
  if (!signUp) {
    return;
  }

  try {
    setSubmitting(true);

    // If invitation ticket is present, use ticket strategy
    if (invitationTicket) {
      const signUpAttempt = await signUp.create({
        strategy: "ticket",
        ticket: invitationTicket,
        emailAddress: data.email,
        password: data.password,
      });

      log.success("[SignUpEmailInput] Sign-up created via invitation ticket", {
        email: data.email,
        status: signUpAttempt.status,
      });

      // Ticket strategy auto-verifies email, so check if complete
      if (signUpAttempt.status === "complete") {
        log.success("[SignUpEmailInput] Sign-up complete, redirecting to console");
        await setActive({ session: signUpAttempt.createdSessionId });
        window.location.href = `${consoleUrl}/account/teams/new`;
        return;
      }

      // If not complete but email verified, transition to success
      if (signUpAttempt.emailAddress && signUpAttempt.verifications.emailAddress.status === "verified") {
        log.success("[SignUpEmailInput] Email auto-verified via ticket", {
          email: data.email,
        });
        onSuccess(data.email);
        return;
      }

      // Unexpected state - fall through to standard verification
      log.warn("[SignUpEmailInput] Ticket sign-up did not auto-verify, falling back to code", {
        status: signUpAttempt.status,
        emailVerificationStatus: signUpAttempt.verifications.emailAddress.status,
      });
    }

    // Standard email/password sign-up flow (existing code)
    const signUpAttempt = await signUp.create({
      emailAddress: data.email,
      password: data.password,
    });

    log.success("[SignUpEmailInput] Sign-up created", {
      email: data.email,
    });

    // Send verification code
    await signUp.prepareEmailAddressVerification({
      strategy: "email_code",
    });

    log.success("[SignUpEmailInput] Verification code sent", {
      email: data.email,
    });

    onSuccess(data.email);
  } catch (err) {
    log.error("[SignUpEmailInput] Sign-up failed", {
      email: data.email,
      error: err,
    });

    const errorResult = handleClerkError(err, {
      component: "SignUpEmailInput",
      action: "create_sign_up",
      email: data.email,
    });

    onError(errorResult.userMessage);
  } finally {
    setSubmitting(false);
  }
};
```

**Add imports** (top of file):
```typescript
import { useClerk } from "@clerk/nextjs";
import { consoleUrl } from "~/lib/related-projects";
```

**Add setActive hook** (after line 35):
```typescript
const { setActive } = useClerk();
```

#### 2. Update Sign-Up Form to Extract Token
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
**Changes**: Extract `__clerk_ticket` from URL and pass to email input

**Add imports** (line 3):
```typescript
import { useSearchParams } from "next/navigation";
```

**Add token extraction** (after line 17):
```typescript
const searchParams = useSearchParams();
const invitationTicket = searchParams.get("__clerk_ticket");
```

**Pass token to SignUpEmailInput** (line 65-68):
```typescript
<SignUpEmailInput
  onSuccess={handleEmailSuccess}
  onError={handleError}
  invitationTicket={invitationTicket}
/>
```

#### 3. Add Invitation Info Display (Optional)
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
**Changes**: Show informational message when invitation token is present

**Add after line 44** (before main form div):
```typescript
{invitationTicket && verificationStep === "email" && (
  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
    <p className="text-sm text-blue-800">
      You've been invited to join Lightfast. Complete sign-up below.
    </p>
  </div>
)}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [ ] Visit `/sign-up` without token → standard flow works (email → code → complete)
- [ ] Visit `/sign-up?__clerk_ticket=<test_token>` → see "You've been invited" message
- [ ] With valid test token: sign-up completes without code verification step
- [ ] With invalid token: error message displays with "Try again" button
- [ ] Check browser console → no errors logged
- [ ] After successful ticket sign-up → redirects to `/account/teams/new`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Create Sign-Up SSO Callback Route

### Overview
Create the missing `/sign-up/sso-callback` route to handle GitHub OAuth redirects from the sign-up flow.

### Changes Required

#### 1. Create SSO Callback Page
**File**: `apps/auth/src/app/(app)/(auth)/sign-up/sso-callback/page.tsx` (new file)
**Changes**: Create new file mirroring sign-in callback

```typescript
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function Page() {
  // Handle the redirect flow by calling the Clerk.handleRedirectCallback() method
  // or rendering the prebuilt <AuthenticateWithRedirectCallback/> component.
  // This is the final step in the custom OAuth flow.
  //
  // Clerk's task system handles redirection:
  // - Pending users (no org) → taskUrls["choose-organization"] → /account/teams/new
  // - Active users (with org) → signUpFallbackRedirectUrl → console

  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account/teams/new"
      signUpFallbackRedirectUrl="/account/teams/new"
      afterSignInUrl="/account/teams/new"
      afterSignUpUrl="/account/teams/new"
    />
  );
}
```

**Explanation**: This mirrors `sign-in/sso-callback/page.tsx:1-23` exactly, ensuring consistent OAuth callback handling for sign-up flows. The `continueSignUpUrl` points back to `/sign-up` in case additional steps are needed.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] Build succeeds: `pnpm build:auth`
- [x] File exists at expected path: `ls apps/auth/src/app/\(app\)/\(auth\)/sign-up/sso-callback/page.tsx`

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:auth`
- [ ] Visit `/sign-up` → click "Continue with GitHub"
- [ ] Authorize on GitHub → redirects to `/sign-up/sso-callback`
- [ ] Callback page loads (no 404 error)
- [ ] After OAuth completes → redirects to `/account/teams/new` in console app
- [ ] Check network tab → no failed requests during redirect flow
- [ ] New user account created successfully in Clerk Dashboard

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Add Waitlist Error Handling to Sign-Up Form

### Overview
Add inline waitlist error handling to match the sign-in form UX, showing a dedicated error state with "Join the Waitlist" CTA button.

### Changes Required

#### 1. Update Sign-Up Form State Management
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
**Changes**: Add waitlist restriction state

**Add state** (after line 17):
```typescript
const [isWaitlistRestricted, setIsWaitlistRestricted] = React.useState(false);
```

**Add import** (line 4):
```typescript
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
```

**Update handleError function** (lines 31-33):
```typescript
function handleError(errorMessage: string, isSignUpRestricted = false) {
  setError(errorMessage);
  setIsWaitlistRestricted(isSignUpRestricted);
}
```

**Update handleReset function** (lines 25-29):
```typescript
function handleReset() {
  setVerificationStep("email");
  setError("");
  setEmailAddress("");
  setIsWaitlistRestricted(false); // Add this line
}
```

**Replace error display** (lines 46-60) with conditional rendering:
```typescript
{error && !isWaitlistRestricted && (
  <div className="space-y-4">
    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
      <p className="text-sm text-red-800">{error}</p>
    </div>
    <Button
      onClick={handleReset}
      variant="outline"
      className="w-full h-12"
    >
      Try again
    </Button>
  </div>
)}

{error && isWaitlistRestricted && (
  <div className="space-y-4">
    <div className="rounded-lg bg-destructive/30 border border-border p-3">
      <p className="text-sm text-foreground">{error}</p>
    </div>
    <Button asChild className="w-full h-12">
      <MicrofrontendLink href="/early-access">
        Join the Waitlist
      </MicrofrontendLink>
    </Button>
    <Button
      onClick={handleReset}
      variant="outline"
      className="w-full h-12"
    >
      Back to Sign Up
    </Button>
  </div>
)}
```

#### 2. Update OAuth Sign-Up Error Handling
**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx`
**Changes**: Pass waitlist restriction flag to parent

**Update props interface** (add after line 12):
```typescript
interface OAuthSignUpProps {
  onError?: (errorMessage: string, isSignUpRestricted?: boolean) => void;
}

export function OAuthSignUp({ onError }: OAuthSignUpProps = {}) {
```

**Update error handling** (lines 34-41):
```typescript
const errorResult = handleClerkError(err, {
  component: "OAuthSignUp",
  action: "oauth_redirect",
  strategy,
});

// Pass waitlist errors to parent for special handling
if (errorResult.isSignUpRestricted && onError) {
  onError(errorResult.userMessage, true);
} else {
  toast.error(errorResult.userMessage);
}

setLoading(null);
```

**Explanation**: This mirrors the pattern from `oauth-sign-in.tsx:44-51`, where waitlist errors are passed to the parent with a flag so the parent can render inline error UI instead of just showing a toast.

#### 3. Update Sign-Up Form OAuth Call
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
**Changes**: Pass error handler to OAuth component

**Update line 103**:
```typescript
<OAuthSignUp onError={handleError} />
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [ ] Trigger waitlist restriction error (use Clerk Dashboard to enable waitlist mode)
- [ ] Attempt email sign-up with waitlist enabled → inline error displays with destructive background
- [ ] "Join the Waitlist" button visible → click → redirects to `/early-access`
- [ ] "Back to Sign Up" button visible → click → returns to email step
- [ ] Attempt GitHub OAuth with waitlist enabled → same inline error display (not toast)
- [ ] Error UI matches sign-in form waitlist error styling exactly
- [ ] No console errors during error flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests
Not adding new unit tests for this plan as:
- Sign-up form is a client-side component with complex Clerk interactions
- Clerk's behavior is better tested through integration/E2E tests
- No new business logic or pure functions being added (just UI state changes)

### Integration Tests
Consider adding E2E tests (future work, not in this plan):
- Sign-up flow with invitation token
- OAuth sign-up redirect through SSO callback
- Waitlist error handling display

### Manual Testing Checklist

#### Standard Sign-Up Flow:
1. Visit `/sign-up` in production
2. Enter email and password
3. Receive verification code via email
4. Enter code → redirects to `/account/teams/new`

#### Invitation Token Flow:
1. Get invitation email from Clerk (or construct test URL with token)
2. Click invitation link → arrives at `/sign-up?__clerk_ticket=<token>`
3. See "You've been invited" message
4. Enter email and password
5. Sign-up completes immediately (no code step) → redirects to console

#### OAuth Sign-Up Flow:
1. Visit `/sign-up`
2. Click "Continue with GitHub"
3. Authorize on GitHub
4. Redirect to `/sign-up/sso-callback` (loading state)
5. Complete → redirects to `/account/teams/new`

#### Waitlist Error Flow:
1. Enable waitlist mode in Clerk Dashboard
2. Attempt to sign up via email → see inline error with "Join the Waitlist" button
3. Attempt to sign up via GitHub → see same inline error (not toast)
4. Click "Join the Waitlist" → redirects to `/early-access`
5. Click "Back to Sign Up" → returns to sign-up form

#### Edge Cases:
- Invalid invitation token → error message displays
- Expired invitation token → Clerk error handled gracefully
- Network errors during OAuth → error toast displays
- Rate limit errors → inline error with retry-after time

## Performance Considerations

- **Metadata**: Adding metadata adds ~1KB to page size (negligible)
- **Token Extraction**: `useSearchParams()` is a client-side hook, no SSR impact
- **OAuth Redirect**: No performance change, just creates missing route
- **Bundle Size**: No new dependencies added, only internal reorganization

## Migration Notes

This is a feature enablement, not a data migration:
- No database schema changes
- No existing data needs migration
- No breaking API changes
- Existing test accounts in development remain functional

**Rollback Strategy**:
If issues arise in production, revert by restoring the `NODE_ENV` check at `sign-up/page.tsx:14-16`. This will return the page to dev-only mode.

## References

- Original research: `thoughts/shared/research/2026-02-08-auth-sign-up-production-enablement.md`
- Sign-up page: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`
- Sign-up form: `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx`
- OAuth sign-up: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx`
- Sign-in form (reference): `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx`
- SSO callback (reference): `apps/auth/src/app/(app)/(auth)/sign-in/sso-callback/page.tsx`
- Clerk Waitlist Docs: https://clerk.com/docs/guides/secure/waitlist
- Clerk Invitation Docs: https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations
