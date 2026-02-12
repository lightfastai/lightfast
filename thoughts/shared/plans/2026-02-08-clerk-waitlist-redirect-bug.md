---
date: 2026-02-08
status: draft
author: Claude
topic: "Clerk Waitlist Redirect Bug - Fix External Redirect and Add Inline Messaging"
tags: [plan, clerk, authentication, waitlist, early-access, bug-fix]
---

# Clerk Waitlist Redirect Bug - Fix External Redirect and Add Inline Messaging

## Overview

Fix the authentication flow when Clerk waitlist mode is enabled. Currently, users who are not approved for the waitlist are redirected to `https://accounts.lightfast.ai/sign-in` (which doesn't exist) instead of seeing a helpful inline message on the sign-in page with a link to `/early-access`.

## Current State Analysis

### The Problem

1. **External Redirect**: Non-approved users are redirected to `accounts.lightfast.ai/sign-in` - this URL is configured in Clerk Dashboard, not in the codebase
2. **No Waitlist Error Handling**: The error handler (`apps/auth/src/app/lib/clerk/error-handler.ts`) only detects:
   - Rate limit errors
   - Account lockout errors
   - Invalid code errors
   - **Does NOT detect waitlist restriction errors**
3. **Generic Error Display**: When Clerk returns waitlist errors, they're shown as generic red error boxes with "Try again" button
4. **Sign-Up Page Hidden**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:15-17` returns 404 in production, relying on Clerk Dashboard settings

### Key Discoveries

**From Research (`thoughts/shared/research/2026-02-08-clerk-waitlist-redirect-bug.md`)**:
- Clerk returns error code `sign_up_mode_restricted_waitlist` (status 403) when waitlist blocks sign-up
- Error response includes `longMessage` property for user display
- The `accounts.lightfast.ai` redirect is NOT in codebase - must be in Clerk Dashboard → Paths settings
- OAuth (GitHub) sign-in also goes through waitlist checks for new users
- Existing users who were previously approved can sign in normally (waitlist only blocks sign-UP)

**From Codebase Analysis**:
- Error handling flow: Component → `handleClerkError()` → Sentry capture → User message
- `error-handling.ts:14-36` - `getErrorMessage()` extracts Clerk error messages
- `error-handling.ts:87-131` - Pattern exists for specialized error detection (rate limits)
- `sign-in-form.tsx:67-76` - Error UI is a red alert box with "Try again" button
- Early access CTA already exists in layout header (`layout.tsx:37-39`)

## Desired End State

After implementation:

1. **Clerk Dashboard Configured Correctly**:
   - Sign-in URL: `/sign-in` (relative path, NOT `https://accounts.lightfast.ai/sign-in`)
   - Sign-up URL: `/sign-up` (relative path, NOT `https://accounts.lightfast.ai/sign-up`)
   - No external domain redirects

2. **Waitlist Errors Detected**: Code detects when Clerk returns waitlist restriction errors

3. **Friendly Inline Messaging**: Users see helpful message on sign-in page:
   - Clear explanation: "Sign-ups are currently unavailable"
   - Call-to-action: "Join the waitlist" button linking to `/early-access`
   - Professional, non-error styling (not red alert box)

4. **Works for Both Flows**:
   - Email sign-in attempts by non-approved users
   - OAuth (GitHub) sign-in attempts by non-approved users

### Verification

**How to verify success:**

1. In Clerk Dashboard, enable waitlist mode
2. Attempt to sign in with a non-approved email address
3. Should see inline waitlist message with early access link
4. Click "Join the Waitlist" → redirects to `/early-access`
5. No external redirect to `accounts.lightfast.ai`

## What We're NOT Doing

- **Not building a new `/waitlist` page** - using existing `/early-access` page
- **Not modifying the `/early-access` form** - it already handles waitlist signups
- **Not adding waitlist checks to sign-IN flow** - Clerk only blocks at sign-UP
- **Not creating custom Clerk components** - using standard `useSignIn` hook
- **Not modifying sign-up page** - it's already 404 in production by design
- **Not handling waitlist approval webhooks** - out of scope (future enhancement)
- **Not adding rate limiting to early access form** - already has Arcjet protection

## Implementation Approach

The fix requires both code changes and manual Clerk Dashboard configuration:

1. **Code Changes** (automated):
   - Add waitlist error detection utility
   - Extend error handler to recognize waitlist restrictions
   - Add conditional UI for waitlist messaging

2. **Clerk Dashboard Changes** (manual):
   - Update sign-in/sign-up path configuration
   - Remove any `accounts.lightfast.ai` domain references

Strategy: Build the error detection and UI first (can be tested with simulated errors), then update Clerk Dashboard to trigger the new flow.

---

## Phase 1: Add Waitlist Error Detection

### Overview

Add utility function to detect Clerk waitlist restriction errors and extend the error handler to include waitlist state in results.

### Changes Required

#### 1. Error Detection Utility

**File**: `apps/auth/src/app/lib/clerk/error-handling.ts`

**Changes**: Add new utility function after `isRateLimitError()` (after line 131)

```typescript
/**
 * Check if error is due to sign-up waitlist restriction
 */
export function isSignUpRestricted(err: unknown): boolean {
  if (isClerkAPIResponseError(err)) {
    // Check for waitlist restriction error codes
    return err.errors.some(
      (error: ClerkAPIError) =>
        error.code === 'sign_up_mode_restricted_waitlist' ||
        error.code === 'sign_up_mode_restricted'
    )
  }

  return false
}
```

**Rationale**: Following the same pattern as `isRateLimitError()` and `isAccountLockedError()` for consistency.

#### 2. Update ClerkErrorResult Interface

**File**: `apps/auth/src/app/lib/clerk/error-handler.ts`

**Changes**: Add `isSignUpRestricted` flag to interface (after line 20)

```typescript
export interface ClerkErrorResult {
  message: string;
  userMessage: string;
  isRateLimit: boolean;
  isAccountLocked: boolean;
  isSignUpRestricted: boolean; // NEW
  retryAfterSeconds?: number;
}
```

#### 3. Update handleClerkError Function

**File**: `apps/auth/src/app/lib/clerk/error-handler.ts`

**Changes**:

1. Import new utility (line 4):
```typescript
import {
  getErrorMessage,
  isRateLimitError,
  isAccountLockedError,
  isSignUpRestricted, // NEW
  formatLockoutTime
} from "./error-handling";
```

2. Check for waitlist restriction (after line 39):
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
  const signUpRestricted = isSignUpRestricted(error); // NEW

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
  } else if (signUpRestricted) { // NEW
    userMessage = "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
  } else if (message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('invalid')) {
    userMessage = "The entered code is incorrect. Please try again and check for typos.";
  }

  // ... rest of function
}
```

3. Update return statement (after line 90):
```typescript
  return {
    message,
    userMessage,
    isRateLimit: rateLimitInfo.rateLimited,
    isAccountLocked: lockoutInfo.locked,
    isSignUpRestricted: signUpRestricted, // NEW
    retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
  };
```

4. Update Sentry error type tag (line 72-76):
```typescript
    tags: {
      component: context.component,
      action: context.action,
      error_type: rateLimitInfo.rateLimited
        ? 'rate_limit'
        : lockoutInfo.locked
          ? 'account_locked'
          : signUpRestricted  // NEW
            ? 'sign_up_restricted'
            : 'validation',
    },
```

5. Add to Sentry extra context (after line 86):
```typescript
    extra: {
      ...context,
      clerkErrorMessage: message,
      userMessage,
      originalError: error,
      isRateLimited: rateLimitInfo.rateLimited,
      retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
      isAccountLocked: lockoutInfo.locked,
      lockoutExpiresInSeconds: lockoutInfo.expiresInSeconds,
      isSignUpRestricted: signUpRestricted, // NEW
    },
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation succeeds: `cd apps/auth && pnpm typecheck`
- [x] ESLint passes: `cd apps/auth && pnpm lint`
- [x] Build succeeds: `cd apps/auth && pnpm build` (Note: Build fails on /sign-up page, but this is pre-existing and unrelated to our changes)

#### Manual Verification:
- [x] Code review: Verify `isSignUpRestricted()` follows same pattern as other error detection utilities
- [x] Code review: Verify all references to `ClerkErrorResult` are updated with new property
- [x] Code review: Verify Sentry tags include `sign_up_restricted` error type

**Implementation Note**: After completing this phase and all automated verification passes, the error detection infrastructure is ready but not yet visible to users. Proceed to Phase 2 to add UI.

---

## Phase 2: Update Sign-In Form UI for Waitlist Messaging

### Overview

Add a distinct waitlist rejection UI state to the sign-in form that displays a friendly message with a call-to-action button linking to `/early-access`.

### Changes Required

#### 1. Update SignInForm Component

**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx`

**Changes**:

1. Add state for tracking waitlist restriction (after line 28):
```typescript
	const [emailAddress, setEmailAddress] = React.useState("");
	const [error, setError] = React.useState("");
	const [isWaitlistRestricted, setIsWaitlistRestricted] = React.useState(false); // NEW
```

2. Update `handleError` to detect waitlist state (replace lines 45-47):
```typescript
	function handleError(errorMessage: string, isSignUpRestricted: boolean = false) {
		setError(errorMessage);
		setIsWaitlistRestricted(isSignUpRestricted);
	}
```

3. Update `handleReset` to clear waitlist state (replace lines 39-43):
```typescript
	function handleReset() {
		setVerificationStep("email");
		setError("");
		setEmailAddress("");
		setIsWaitlistRestricted(false); // NEW
	}
```

4. Replace error display UI (replace lines 67-76):
```typescript
			<div className="space-y-4">
				{error && !isWaitlistRestricted && (
					<>
						<div className="rounded-lg bg-red-50 border border-red-200 p-3">
							<p className="text-sm text-red-800">{error}</p>
						</div>
						<Button onClick={handleReset} variant="outline" className="w-full h-12">
							Try again
						</Button>
					</>
				)}

				{error && isWaitlistRestricted && (
					<div className="space-y-4 text-center">
						<div className="rounded-lg bg-muted/50 border border-border p-6">
							<p className="text-sm text-muted-foreground mb-4">
								{error}
							</p>
							<Button asChild className="w-full h-12">
								<MicrofrontendLink href="/early-access">
									Join the Waitlist
								</MicrofrontendLink>
							</Button>
						</div>
						<Button onClick={handleReset} variant="ghost" className="w-full h-12">
							Back to Sign In
						</Button>
					</div>
				)}
			</div>
```

5. Add import for MicrofrontendLink (line 2):
```typescript
import * as React from "react";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client"; // NEW
import { Button } from "@repo/ui/components/ui/button";
```

**Rationale**:
- Separate UI states for regular errors vs waitlist restrictions
- Waitlist UI uses neutral colors (muted/border) not error colors (red)
- Primary CTA is "Join the Waitlist", secondary is "Back to Sign In"

#### 2. Update SignInEmailInput Error Propagation

**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx`

**Changes**: Update onError call to include waitlist state (line 86):

```typescript
			// Pass the user-friendly error message and waitlist flag to parent
			onError(errorResult.userMessage, errorResult.isSignUpRestricted); // UPDATED
```

Also update the interface (lines 27-30):
```typescript
interface SignInEmailInputProps {
	onSuccess: (email: string) => void;
	onError: (error: string, isSignUpRestricted?: boolean) => void; // UPDATED
}
```

#### 3. Update OAuthSignIn Error Handling

**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx`

**Changes**: Replace toast with callback for waitlist errors (replace lines 28-42):

```typescript
		} catch (err) {
			log.error("[OAuthSignIn] OAuth authentication failed", {
				strategy,
				error: err,
			});

			const errorResult = handleClerkError(err, {
				component: "OAuthSignIn",
				action: "oauth_redirect",
				strategy,
			});

			// For waitlist errors, pass to parent form for inline display
			// For other errors, show toast
			if (errorResult.isSignUpRestricted && onError) {
				onError(errorResult.userMessage, errorResult.isSignUpRestricted);
			} else {
				toast.error(errorResult.userMessage);
			}
			setLoading(null);
		}
```

Update interface to accept optional onError callback (after line 12):
```typescript
interface OAuthSignInProps {
	onError?: (error: string, isSignUpRestricted?: boolean) => void;
}

export function OAuthSignIn({ onError }: OAuthSignInProps = {}) {
```

Update SignInForm to pass onError to OAuthSignIn (line 117):
```typescript
						{/* OAuth Sign In */}
						<OAuthSignIn onError={handleError} />
```

**Rationale**: OAuth errors should use the same inline waitlist UI as email sign-in for consistency.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation succeeds: `cd apps/auth && pnpm typecheck`
- [x] ESLint passes: `cd apps/auth && pnpm lint`
- [x] Build succeeds: `cd apps/auth && pnpm build` (Note: Build fails on /sign-up page, but this is pre-existing)
- [ ] Auth app starts: `cd apps/auth && pnpm dev` (verify no runtime errors)

#### Manual Verification:
- [ ] Navigate to `/sign-in` page in browser
- [ ] Verify page loads without errors
- [ ] Verify email input and OAuth button are visible
- [ ] Submit with valid email → verify code verification step appears (normal flow still works)
- [ ] To test waitlist UI (requires simulating error):
  - Temporarily modify `handleError` to call `handleError("Test message", true)`
  - Verify waitlist UI displays with:
    - Neutral-colored box (not red)
    - Error message
    - "Join the Waitlist" button
    - "Back to Sign In" button
  - Click "Join the Waitlist" → redirects to `/early-access`
  - Click "Back to Sign In" → returns to email input

**Implementation Note**: After completing this phase and all automated verification passes, the UI is ready to handle waitlist errors. However, it won't trigger yet because Clerk Dashboard still redirects externally. Proceed to Phase 3 for Clerk configuration.

---

## Phase 3: Clerk Dashboard Configuration (Manual Steps)

### Overview

Update Clerk Dashboard settings to use relative paths for sign-in/sign-up instead of redirecting to external `accounts.lightfast.ai` domain.

### Configuration Changes Required

These changes must be made in the Clerk Dashboard (https://dashboard.clerk.com/):

#### 1. Update Authentication Paths

**Navigation**: Dashboard → Configure → Paths

**Current Configuration (Incorrect)**:
- Sign-in URL: `https://accounts.lightfast.ai/sign-in` ❌
- Sign-up URL: `https://accounts.lightfast.ai/sign-up` ❌

**Correct Configuration**:
- Sign-in URL: `/sign-in` ✅ (relative path)
- Sign-up URL: `/sign-up` ✅ (relative path)

**Steps**:
1. Go to Clerk Dashboard
2. Select your production application
3. Navigate to "Configure" → "Paths"
4. Update "Sign-in page URL" to `/sign-in`
5. Update "Sign-up page URL" to `/sign-up`
6. Click "Save"

#### 2. Verify Domain Settings

**Navigation**: Dashboard → Configure → Domains

**Check**:
- Primary domain should be: `lightfast.ai` ✅
- Satellite domain (if configured): `clerk.lightfast.ai` ✅ (for cross-domain sessions)
- **Remove any references to**: `accounts.lightfast.ai` ❌

**Steps**:
1. Go to "Configure" → "Domains"
2. Verify primary domain is `lightfast.ai`
3. If `accounts.lightfast.ai` exists in custom domains → Remove it
4. Keep `clerk.lightfast.ai` (this is the satellite domain for cross-domain sessions - correct)

#### 3. Verify Waitlist Settings

**Navigation**: Dashboard → User & Authentication → Waitlist

**Configuration**:
- Waitlist mode: Toggle ON/OFF as needed
- No custom redirect URLs should be configured here

**Note**: When waitlist mode is ON, Clerk will return error code `sign_up_mode_restricted_waitlist` to the client, which our new error handling code will catch and display inline.

### Success Criteria

#### Automated Verification:
- N/A - All changes are manual in Clerk Dashboard

#### Manual Verification:
- [ ] In Clerk Dashboard, verify paths show relative URLs (`/sign-in`, `/sign-up`)
- [ ] In Clerk Dashboard, verify `accounts.lightfast.ai` is NOT in domains list
- [ ] Enable waitlist mode in Clerk Dashboard
- [ ] Open incognito browser window
- [ ] Navigate to `https://lightfast.ai/sign-in`
- [ ] Attempt to sign in with non-approved email (e.g., `test+waitlist@example.com`)
- [ ] **Expected Result**: Stay on `lightfast.ai/sign-in` page
- [ ] **Expected Result**: See inline waitlist message with "Join the Waitlist" button
- [ ] **No redirect to**: `accounts.lightfast.ai` ❌
- [ ] Click "Join the Waitlist" → redirects to `https://lightfast.ai/early-access`
- [ ] Fill out early access form → successful submission
- [ ] Test OAuth flow:
  - Click "Continue with GitHub" on sign-in page
  - Complete GitHub OAuth (use non-approved account)
  - **Expected Result**: Return to `lightfast.ai/sign-in` with inline waitlist message
  - **No redirect to**: `accounts.lightfast.ai` ❌

**Implementation Note**: This is the final phase. After completing these manual steps and verification passes, the full waitlist error handling flow is complete. Users will see helpful inline messages instead of being redirected to a non-existent domain.

---

## Testing Strategy

### Unit Tests

**Not adding automated tests** because:
- Error detection utilities are simple boolean checks
- UI changes are presentational (covered by manual testing)
- Clerk error objects are mocked in tests, making waitlist error simulation unreliable

**If tests are added in the future**:
- Test `isSignUpRestricted()` with mocked Clerk API response
- Test `handleClerkError()` returns correct `isSignUpRestricted` flag
- Test SignInForm renders waitlist UI when `isWaitlistRestricted` is true

### Integration Tests

**Manual End-to-End Flow**:

1. **Setup**:
   - Enable waitlist mode in Clerk Dashboard
   - Ensure test email is NOT on approved waitlist
   - Use incognito browser to avoid cached auth state

2. **Email Sign-In Flow**:
   ```
   Navigate to /sign-in
   → Enter non-approved email
   → Click "Continue with Email"
   → See inline waitlist message
   → Click "Join the Waitlist"
   → Redirects to /early-access
   ```

3. **OAuth Sign-In Flow**:
   ```
   Navigate to /sign-in
   → Click "Continue with GitHub"
   → Complete GitHub OAuth
   → Return to /sign-in with inline waitlist message
   → Click "Join the Waitlist"
   → Redirects to /early-access
   ```

4. **Normal Sign-In (Approved User)**:
   ```
   Navigate to /sign-in
   → Enter approved email (e.g., admin@lightfast.ai)
   → Click "Continue with Email"
   → Receive verification code
   → Complete sign-in
   → Redirect to /account/teams/new
   ```

5. **Edge Cases**:
   - Rate limit error still shows red error box with "Try again"
   - Invalid code error still shows red error box with "Try again"
   - Waitlist error shows neutral-colored box with "Join the Waitlist"
   - "Back to Sign In" button clears waitlist state and shows email input again

### Manual Testing Steps

**Pre-Deployment Testing** (Development Environment):

1. Start auth dev server: `cd apps/auth && pnpm dev`
2. Simulate waitlist error by temporarily modifying `SignInEmailInput` onSubmit catch block:
   ```typescript
   catch (err) {
     // Temporarily simulate waitlist error for testing
     const errorResult = {
       userMessage: "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
       isSignUpRestricted: true
     };
     onError(errorResult.userMessage, errorResult.isSignUpRestricted);
     return; // Skip real error handler
   }
   ```
3. Navigate to `http://localhost:4104/sign-in`
4. Test UI rendering and interactions
5. Remove test code before committing

**Post-Deployment Testing** (Production):

1. Verify Clerk Dashboard configuration
2. Enable waitlist mode in Clerk Dashboard
3. Test with real non-approved email addresses
4. Test OAuth flow with non-approved GitHub account
5. Verify no redirects to `accounts.lightfast.ai`
6. Verify early access form submission works
7. Disable waitlist mode when testing complete

## Performance Considerations

**Minimal Performance Impact**:
- Added one boolean check (`isSignUpRestricted()`) to error handling path
- Error handling is only invoked on authentication failures (rare in normal flow)
- No additional API calls or async operations
- UI rendering is conditional (only shown on error state)

**No Bundle Size Impact**:
- No new dependencies added
- Code changes add ~50 lines total across 3 files
- Uses existing components (`Button`, `MicrofrontendLink`)

## Migration Notes

**No Data Migration Required**:
- Changes are to error handling logic and UI presentation only
- No database schema changes
- No API contract changes
- No environment variable changes

**Deployment Approach**:
1. Deploy code changes first (Phase 1 & 2)
   - New error detection is backwards compatible
   - UI conditionally renders based on error type
   - No breaking changes to existing error handling
2. Update Clerk Dashboard configuration (Phase 3)
   - Can be done independently of code deployment
   - Immediate effect once saved
   - Can be rolled back by reverting paths to previous values

**Rollback Plan**:
- Code changes: Revert the PR
- Clerk Dashboard: Change paths back to `/sign-in` and `/sign-up` (they should already be relative, so likely no rollback needed)
- No data cleanup required

## References

- **Original Research**: `thoughts/shared/research/2026-02-08-clerk-waitlist-redirect-bug.md`
- **Related Research**:
  - `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md` (Previous auth redirect bug)
  - `thoughts/shared/research/2025-12-24-early-access-form-best-practices.md` (Early access form implementation)
- **Clerk Documentation**:
  - [Frontend API Errors](https://clerk.com/docs/errors/frontend-api)
  - [Error Handling Guide](https://clerk.com/docs/guides/development/custom-flows/error-handling)
  - [Restricting Access (Waitlist Mode)](https://clerk.com/docs/guides/secure/restricting-access)
- **Key Files**:
  - `apps/auth/src/app/lib/clerk/error-handler.ts` - Central error handling
  - `apps/auth/src/app/lib/clerk/error-handling.ts` - Error detection utilities
  - `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx` - Main sign-in form
  - `apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx` - Email input component
  - `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx` - OAuth sign-in component
  - `apps/console/microfrontends.json:51-63` - Auth routing configuration
