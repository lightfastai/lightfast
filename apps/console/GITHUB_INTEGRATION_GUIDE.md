# GitHub App Integration - Complete Implementation Guide

**Last Updated:** 2025-11-26
**Status:** 🔴 In Progress - Phase 1 Complete, Phase 2 In Progress

This document provides a comprehensive guide to the GitHub App installation flow, covering all edge cases, implementation steps, and production requirements.

---

## Table of Contents

1. [Current Status](#current-status)
2. [Architecture Overview](#architecture-overview)
3. [Edge Case Catalog](#edge-case-catalog)
4. [Implementation Phases](#implementation-phases)
5. [Detailed Implementation Steps](#detailed-implementation-steps)
6. [Testing Requirements](#testing-requirements)
7. [Deployment Checklist](#deployment-checklist)
8. [Monitoring & Observability](#monitoring--observability)

---

## Current Status

### Completed ✅
- Phase 1: Basic OAuth flow (success path works)
- Client-side popup handling
- Basic state validation
- Success callback and refetch

### Critical Issues 🔴

| Priority | Issue | Impact | Files Affected |
|----------|-------|--------|----------------|
| 🔴 **CRITICAL** | All error redirects go to non-existent `/` | Users never see error messages | `user-authorized/route.ts` (10 error handlers) |
| 🔴 **HIGH** | Poll interval memory leak on unmount | Memory leak, orphaned intervals | `github-connector.tsx:96-101` |
| 🔴 **HIGH** | Refetch fails silently | Stale UI state after OAuth | `github-connector.tsx:99` |
| 🔴 **HIGH** | Multiple popup opens (double-click) | Race conditions, duplicate flows | `github-connector.tsx:78-102` |

### Implementation Phases

- ✅ **Phase 1.1-1.5:** Basic fixes (documented in GITHUB_EDGE_CASES.md)
- 🔴 **Phase 2:** Error redirect fixes (CRITICAL - this document)
- ⚠️ **Phase 3:** Edge case hardening

---

## Architecture Overview

### OAuth Flow

```
User clicks "Connect GitHub" (github-connector.tsx:78-102)
  ↓
Popup opens → /api/github/install-app
  ↓
GitHub App Installation Page
  ↓
/api/github/app-installed (redirect handler)
  ↓
/api/github/authorize-user (OAuth start)
  ↓
GitHub OAuth Authorization Page
  ↓
/api/github/user-authorized (OAuth callback)
  ↓
SUCCESS: /github/connected (popup shows success)
ERROR: /?github_error=* (❌ BROKEN - page doesn't exist)
  ↓
Popup closes → parent refetches data
```

### File Structure

```
apps/console/src/
├── app/
│   ├── (app)/
│   │   ├── (user)/new/_components/
│   │   │   ├── github-connector.tsx        # Popup launcher
│   │   │   └── repository-picker.tsx       # Installation selector
│   │   └── layout.tsx                      # App layout (add error handler here)
│   └── (github)/api/github/
│       ├── install-app/route.ts            # Start installation flow
│       ├── app-installed/route.ts          # After app install
│       ├── authorize-user/route.ts         # Start OAuth
│       └── user-authorized/route.ts        # ❌ OAuth callback (10 broken redirects)
├── components/
│   ├── github-connect-dialog.tsx           # ⚠️ Duplicate error handler (remove)
│   └── github-oauth-error-handler.tsx      # ✅ NEW - Global error handler
└── lib/
    └── github/
        └── oauth-state.ts                  # State validation utilities
```

---

## Edge Case Catalog

### 1. Popup Management Edge Cases

#### A. Popup Blocked by Browser

**Location:** `github-connector.tsx:90-93`

```typescript
if (!popup || popup.closed) {
  alert("Popup was blocked. Please allow popups for this site.");
  return;
}
```

**Status:** ⚠️ Partial - Uses browser alert
**Missing:**
- Toast notification instead of alert
- Instructions on how to enable popups
- Fallback to full-page redirect option

**Fix Priority:** 🟡 Phase 3 (UX improvement)

---

#### B. Popup Closed Before Completion

**Location:** `github-connector.tsx:96-101`

```typescript
const pollTimer = setInterval(() => {
  if (popup.closed) {
    clearInterval(pollTimer);
    void refetchIntegration();
  }
}, 500);
```

**Status:** ❌ **CRITICAL ISSUES**
- ❌ No cleanup if component unmounts while polling
- ❌ Refetch happens even if user manually closed popup (didn't complete flow)
- ❌ No way to distinguish between "user canceled" vs "flow completed"
- ❌ Interval keeps running forever if popup never closes

**Fix Priority:** 🔴 Phase 1 - MUST FIX

**Solution:** (See Phase 1 implementation below)

---

#### C. Multiple Popups Opened (Double-Click)

**Status:** ❌ No prevention

**Risk:** User clicks button multiple times → multiple poll intervals → race conditions

**Fix Priority:** 🔴 Phase 1 - MUST FIX

---

#### D. Popup Timeout

**Status:** ❌ Poll interval runs indefinitely

**Need:** Timeout after 10 minutes

**Fix Priority:** 🔴 Phase 1

---

### 2. Refetch Edge Cases

#### A. Refetch Fails (Network Error)

**Location:** `github-connector.tsx:99`

```typescript
void refetchIntegration();
```

**Status:** ❌ No error handling, retry logic, or user notification

**Fix Priority:** 🔴 Phase 1

---

#### B. Refetch Returns Partial Data

**Scenario:** OAuth completes but database write delayed

**Status:** ❌ No handling for eventual consistency

**Fix Priority:** 🟡 Phase 2

---

#### C. Refetch During Component Unmount

**Status:** ⚠️ Uses `void` keyword (ignores promise)

**Risk:** State updates after unmount → React warnings

**Fix Priority:** 🔴 Phase 1 (cleanup in useEffect)

---

### 3. OAuth Error Redirect Edge Cases

#### A. All Error Redirects Go to Non-Existent Page

**Location:** `apps/console/src/app/(github)/api/github/user-authorized/route.ts`

**Status:** ❌ **CRITICAL** - All 10 error types redirect to `/?github_error=*` which doesn't exist

| Line | Error Type | Current Redirect | Impact |
|------|-----------|------------------|---------|
| 54 | OAuth error from GitHub | `/?github_error={error}` | ❌ Silent failure |
| 62 | Missing state cookie | `/?github_error=invalid_state` | ❌ Silent failure |
| 70 | State validation failed | `/?github_error=state_expired` | ❌ Silent failure |
| 75 | Missing authorization code | `/?github_error=missing_code` | ❌ Silent failure |
| 104 | GitHub token error | `/?github_error={error}` | ❌ Silent failure |
| 111 | No access token | `/?github_error=no_access_token` | ❌ Silent failure |
| 122 | User not authenticated | `/?github_error=unauthorized` | ❌ Silent failure |
| 131 | Failed to fetch installations | `/?github_error=installations_fetch_failed` | ❌ Silent failure |
| 177 | Database error | `/?github_error=database_error` | ❌ Silent failure |
| 211 | Exchange failed | `/?github_error=exchange_failed` | ❌ Silent failure |

**Fix Priority:** 🔴 Phase 2 - CRITICAL

---

#### B. Error Messages Not User-Friendly

**Status:** ❌ Internal error codes shown to users

**Example:**
- Shows: `Error: invalid_state`
- Should show: "Your GitHub connection session is invalid. This usually happens if you opened the connection in multiple tabs. Please try again."

**Fix Priority:** 🔴 Phase 2

---

#### C. Duplicate Error Handler

**Location:** `github-connect-dialog.tsx:63-70`

**Status:** ⚠️ Duplicate logic that will never run (errors never reach `/`)

**Fix Priority:** 🟢 Phase 3 (cleanup)

---

### 4. Installation State Edge Cases

#### A. User Has Multiple Installations

**Location:** `github-connector.tsx:67-72`

**Status:** ⚠️ Always selects first installation (might not be what user intended)

**Fix Priority:** 🟡 Phase 3

---

#### B. Installation Deleted While Page Open

**Status:** ✅ Partially handled - clears selection if none exist

**Missing:** Notification, refetch on window focus

**Fix Priority:** 🟢 Phase 3

---

#### C. Installation Permissions Changed

**Status:** ❌ No detection of permission changes

**Fix Priority:** 🟢 Phase 3

---

### 5. Component Lifecycle Edge Cases

#### A. Component Unmounts During Popup Flow

**Status:** ❌ Poll interval not cleaned up, refetch promise not canceled

**Fix Priority:** 🔴 Phase 1 - MUST FIX

---

#### B. Page Refresh During Flow

**Status:** ❌ Popup connection lost, flow orphaned

**Fix Priority:** 🟡 Phase 2

---

#### C. Network Disconnection

**Status:** ❌ No handling

**Fix Priority:** 🟢 Phase 3

---

### 6. Browser-Specific Edge Cases

#### A. Safari Popup Restrictions

**Status:** ✅ `window.open` called synchronously from click handler

**Fix Priority:** ✅ Already handled

---

#### B. Third-Party Cookies Blocked

**Status:** ✅ Uses `sameSite: "lax"`

**Risk:** Some privacy tools block all cross-site cookies

**Fix Priority:** 🟢 Phase 3 (documentation/warning)

---

#### C. LocalStorage/SessionStorage Unavailable

**Status:** ❌ No fallback if storage APIs fail

**Fix Priority:** 🟢 Phase 3

---

## Implementation Phases

### Phase 1: Critical Client-Side Fixes ✅ (Documented in GITHUB_EDGE_CASES.md)

**Objective:** Fix memory leaks and race conditions

**Tasks:**
1. ✅ Add useEffect cleanup for poll interval
2. ✅ Add loading/disabled state to prevent double-clicks
3. ✅ Add refetch error handling with retry logic
4. ✅ Add popup timeout (10 minutes max)

**Status:** ✅ Complete (see lines 480-483 in GITHUB_EDGE_CASES.md)

---

### Phase 2: Error Redirect Fixes 🔴 **CURRENT PHASE**

**Objective:** Fix broken error redirects and implement global error handler

**Priority:** 🔴 **CRITICAL** - Must complete before production

**Estimated Time:** ~45 minutes

#### Tasks

| # | Task | File | Lines | Priority | Status | Est. Time |
|---|------|------|-------|----------|--------|-----------|
| 1 | Create global error handler component | `github-oauth-error-handler.tsx` | 1-102 | 🔴 CRITICAL | ⏳ Todo | 15 min |
| 2 | Add error handler to layout | `app/(app)/layout.tsx` | ~18 | 🔴 CRITICAL | ⏳ Todo | 2 min |
| 3 | Fix error redirects in OAuth callback | `user-authorized/route.ts` | 50-211 | 🔴 CRITICAL | ⏳ Todo | 20 min |
| 4 | Pass callback parameter from client | `github-connector.tsx` | 84-86 | 🟡 HIGH | ⏳ Todo | 3 min |
| 5 | Remove duplicate error handler | `github-connect-dialog.tsx` | 63-70 | 🟢 LOW | ⏳ Todo | 2 min |

**Success Criteria:**
- ✅ All error types show user-friendly messages
- ✅ Errors redirect to appropriate callback page (`/new`)
- ✅ URL parameters cleaned up after error shown
- ✅ No duplicate error handlers
- ✅ Errors logged for debugging

---

### Phase 3: UX Improvements & Edge Case Hardening ⚠️

**Objective:** Improve user experience and handle rare scenarios

**Priority:** 🟡 Medium (post-production)

**Tasks:**
- Improve OAuth error messages (map internal codes to user-friendly messages) ✅ (in Phase 2)
- Add toast for popup blocked instead of alert
- Add installation selection indicator (show which org is selected)
- Add loading state during refetch ✅ (in Phase 1)
- Add refetch on window focus (detect external changes)
- Add duplicate callback prevention
- Add network status detection
- Add browser compatibility warnings

---

## Detailed Implementation Steps (Phase 2)

### Step 1: Create Global Error Handler Component

**Priority:** 🔴 CRITICAL
**File:** `apps/console/src/components/github-oauth-error-handler.tsx` (NEW FILE)
**Estimated Time:** 15 minutes

<details>
<summary>Full Implementation (Click to expand)</summary>

```typescript
"use client";

import { useEffect } from "react";
import { useToast } from "@repo/ui/hooks/use-toast";

/**
 * User-friendly error messages for GitHub OAuth errors
 * Maps internal error codes to actionable messages
 */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  invalid_state: {
    title: "Session Invalid",
    description:
      "Your GitHub connection session is invalid. This usually happens if you opened the connection in multiple tabs. Please try again.",
  },
  state_expired: {
    title: "Session Expired",
    description:
      "Your GitHub connection session has expired. Please start the connection process again.",
  },
  missing_code: {
    title: "Authorization Incomplete",
    description:
      "GitHub authorization was incomplete. Please ensure you completed all steps in the GitHub authorization flow.",
  },
  no_access_token: {
    title: "Access Token Failed",
    description:
      "Failed to obtain an access token from GitHub. Please try again or contact support if this persists.",
  },
  unauthorized: {
    title: "Not Signed In",
    description:
      "You must be signed in to connect GitHub. Please sign in and try again.",
  },
  installations_fetch_failed: {
    title: "Failed to Load Installations",
    description:
      "Unable to fetch your GitHub installations. Please check your internet connection and try again.",
  },
  database_error: {
    title: "Save Failed",
    description:
      "Failed to save your GitHub connection to our database. Please try again or contact support if this persists.",
  },
  exchange_failed: {
    title: "Authorization Failed",
    description:
      "GitHub authorization failed unexpectedly. Please try again or contact support if this persists.",
  },
};

/**
 * Global GitHub OAuth Error Handler
 *
 * Detects and displays GitHub OAuth errors from URL search parameters.
 * Automatically cleans up URL after showing error to user.
 *
 * Should be mounted once at root level (in layout).
 */
export function GitHubOAuthErrorHandler() {
  const { toast } = useToast();

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    // Check for github_error parameter
    const urlParams = new URLSearchParams(window.location.search);
    const githubError = urlParams.get("github_error");

    if (!githubError) return;

    // Get user-friendly message or use default
    const errorInfo =
      ERROR_MESSAGES[githubError] ??
      {
        title: "GitHub Connection Failed",
        description: `An error occurred: ${githubError}. Please try again.`,
      };

    // Show error toast
    toast({
      title: errorInfo.title,
      description: errorInfo.description,
      variant: "destructive",
      duration: 8000, // 8 seconds - longer for error messages
    });

    // Log error for debugging (remove in production or send to monitoring service)
    console.error("[GitHub OAuth Error]", {
      code: githubError,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });

    // Clean up URL parameter (remove ?github_error=*)
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("github_error");
    window.history.replaceState({}, "", newUrl.toString());
  }, [toast]);

  // This component renders nothing
  return null;
}
```

</details>

---

### Step 2: Add Error Handler to Layout

**Priority:** 🔴 CRITICAL
**File:** `apps/console/src/app/(app)/layout.tsx`
**Estimated Time:** 2 minutes

**Changes:**
1. Add import: `import { GitHubOAuthErrorHandler } from "~/components/github-oauth-error-handler";`
2. Add component inside `PageErrorBoundary`: `<GitHubOAuthErrorHandler />`

<details>
<summary>Modified Code (Click to expand)</summary>

```typescript
import { GitHubOAuthErrorHandler } from "~/components/github-oauth-error-handler"; // ← ADD THIS

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; workspace: string }>;
}) {
  return (
    <PageErrorBoundary fallbackTitle="Failed to load application">
      <GitHubOAuthErrorHandler /> {/* ← ADD THIS */}
      <div className="dark h-screen flex flex-col overflow-hidden">
        <NavbarContainer params={params} />
        <main className="flex flex-1 overflow-hidden">{children}</main>
      </div>
    </PageErrorBoundary>
  );
}
```

</details>

---

### Step 3: Fix Error Redirects in OAuth Callback

**Priority:** 🔴 CRITICAL
**File:** `apps/console/src/app/(github)/api/github/user-authorized/route.ts`
**Estimated Time:** 20 minutes

**Changes:**

#### 3A: Add Error Redirect Helper Function (after line 49)

```typescript
/**
 * Helper function to redirect with error parameter
 * Attempts to redirect to callback URL from OAuth state, falls back to /new
 */
const redirectWithError = (errorType: string) => {
  // Try to extract callback from state if available
  let errorRedirectPath = "/new"; // Default fallback

  const storedStateEncoded = request.cookies.get("github_oauth_state")?.value;
  if (state && storedStateEncoded) {
    try {
      const stateValidation = validateOAuthState(state, storedStateEncoded);
      if (stateValidation.valid && stateValidation.state?.redirectPath) {
        errorRedirectPath = stateValidation.state.redirectPath;
      }
    } catch {
      // If state validation fails, use default
    }
  }

  const errorUrl = `${baseUrl}${errorRedirectPath}?github_error=${errorType}`;
  return NextResponse.redirect(errorUrl);
};
```

#### 3B: Replace All Error Redirects

Replace all 10 instances of `NextResponse.redirect(\`${baseUrl}/?github_error=...\`)` with `redirectWithError("error_type")`:

| Line | Old Code | New Code |
|------|----------|----------|
| 54 | `return NextResponse.redirect(\`${baseUrl}/?github_error=${encodeURIComponent(error)}\`);` | `return redirectWithError(encodeURIComponent(error));` |
| 62 | `return NextResponse.redirect(\`${baseUrl}/?github_error=invalid_state\`);` | `return redirectWithError("invalid_state");` |
| 70 | `return NextResponse.redirect(\`${baseUrl}/?github_error=${errorParam}\`);` | `return redirectWithError(errorParam);` |
| 75 | `return NextResponse.redirect(\`${baseUrl}/?github_error=missing_code\`);` | `return redirectWithError("missing_code");` |
| 104 | `return NextResponse.redirect(\`${baseUrl}/?github_error=${encodeURIComponent(tokenData.error)}\`);` | `return redirectWithError(encodeURIComponent(tokenData.error));` |
| 111 | `return NextResponse.redirect(\`${baseUrl}/?github_error=no_access_token\`);` | `return redirectWithError("no_access_token");` |
| 122 | `return NextResponse.redirect(\`${baseUrl}/?github_error=unauthorized\`);` | `return redirectWithError("unauthorized");` |
| 131 | `return NextResponse.redirect(\`${baseUrl}/?github_error=installations_fetch_failed\`);` | `return redirectWithError("installations_fetch_failed");` |
| 177 | `return NextResponse.redirect(\`${baseUrl}/?github_error=database_error\`);` | `return redirectWithError("database_error");` |
| 211 | `return NextResponse.redirect(\`${baseUrl}/?github_error=exchange_failed\`);` | `return redirectWithError("exchange_failed");` |

---

### Step 4: Pass Callback Parameter from Client

**Priority:** 🟡 HIGH
**File:** `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
**Estimated Time:** 3 minutes

**Changes:**
- Line 84: Add `const callback = "/new";`
- Line 86: Change popup URL to include callback parameter

<details>
<summary>Modified Code (Click to expand)</summary>

```typescript
const handleConnectGitHub = () => {
  const width = 600;
  const height = 800;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  // Pass current page as callback so errors/success return here
  const callback = "/new"; // ← ADD THIS

  const popup = window.open(
    `/api/github/install-app?callback=${encodeURIComponent(callback)}`, // ← CHANGE THIS
    "github-install",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
  );

  // ... rest of code
};
```

</details>

---

### Step 5: Remove Duplicate Error Handler

**Priority:** 🟢 LOW (Optional cleanup)
**File:** `apps/console/src/components/github-connect-dialog.tsx`
**Estimated Time:** 2 minutes

**Changes:** Remove lines 63-70 (`else if (githubError)` block)

**Reason:** Global `GitHubOAuthErrorHandler` in layout now handles all errors

---

## Testing Requirements

### Phase 2 Testing Checklist

Before deploying Phase 2 changes, verify:

#### Error Redirect Tests (CRITICAL)

- [ ] **Test 1: Invalid State**
  - Clear cookies, go to `/new`, click "Connect GitHub"
  - In dev tools, delete `github_oauth_state` cookie during flow
  - Expected: Error toast shows "Session Invalid", redirects to `/new`

- [ ] **Test 2: Expired State**
  - Go to `/new`, click "Connect GitHub"
  - Wait 11 minutes (state expires after 10 minutes)
  - Complete OAuth flow
  - Expected: Error toast shows "Session Expired", redirects to `/new`

- [ ] **Test 3: User Cancels Authorization**
  - Go to `/new`, click "Connect GitHub"
  - On GitHub authorization page, click "Cancel"
  - Expected: Error toast shows appropriate message, redirects to `/new`

- [ ] **Test 4: No Access Token**
  - Simulate by modifying response in proxy/dev tools
  - Expected: Error toast shows "Access Token Failed", redirects to `/new`

- [ ] **Test 5: Database Error**
  - Temporarily break database connection
  - Complete OAuth flow
  - Expected: Error toast shows "Save Failed", redirects to `/new`

- [ ] **Test 6: User Not Signed In**
  - Sign out from Clerk
  - Try to connect GitHub
  - Expected: Error toast shows "Not Signed In", redirects to `/new`

- [ ] **Test 7: URL Cleanup**
  - After any error is shown
  - Check URL in address bar
  - Expected: No `?github_error=*` parameter in URL

#### Success Flow Tests

- [ ] **Test 8: Successful Connection**
  - Go to `/new`, click "Connect GitHub"
  - Complete full OAuth flow successfully
  - Expected: Success message, popup closes, data refetches, installations appear

#### Edge Case Tests

- [ ] **Test 9: Browser Back Button**
  - Complete OAuth flow with error
  - Error toast shown
  - Click browser back button
  - Expected: No duplicate error toast

### Full Testing Checklist (All Phases)

See "Testing Checklist" section in original GITHUB_EDGE_CASES.md (lines 499-538) for complete list.

---

## Deployment Checklist

### Pre-Deployment

- [ ] All Phase 2 code changes implemented and tested locally
- [ ] All manual tests passing (see Testing Requirements)
- [ ] TypeScript type checking passes (`pnpm typecheck`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Code review completed
- [ ] Error messages reviewed by Product/UX team
- [ ] Error logging verified (console.error or monitoring service)

### GitHub App Configuration Update

⚠️ **CRITICAL:** Update GitHub App settings after deployment

#### Development App

1. Go to GitHub App settings (Dev app)
2. Update **Callback URL** to: `http://localhost:3024/api/github/user-authorized`
3. Update **Setup URL** to: `http://localhost:3024/api/github/app-installed`
4. Save changes

#### Production App

1. Go to GitHub App settings (Prod app)
2. Update **Callback URL** to: `https://console.lightfast.ai/api/github/user-authorized`
3. Update **Setup URL** to: `https://console.lightfast.ai/api/github/app-installed`
4. Save changes

### Post-Deployment

- [ ] Smoke test on staging/preview environment
- [ ] Test with real GitHub account (not test account)
- [ ] Verify error logging/monitoring is capturing errors
- [ ] Monitor for first 24 hours for any issues
- [ ] Check error rates in monitoring dashboard

### Rollback Plan

If errors occur post-deployment:

1. **Immediate:** Revert deployment
2. **Investigation:** Check error logs for root cause
3. **Fix:** Address issue locally
4. **Re-test:** Run full test suite
5. **Re-deploy:** With confidence

---

## Monitoring & Observability

### Error Logging

Current implementation logs to console:

```typescript
console.error("[GitHub OAuth Error]", {
  code: githubError,
  timestamp: new Date().toISOString(),
  url: window.location.href,
});
```

### Recommended Enhancements

#### Option A: Send to Sentry

```typescript
import * as Sentry from "@sentry/nextjs";

if (githubError) {
  Sentry.captureMessage("GitHub OAuth Error", {
    level: "error",
    tags: {
      error_code: githubError,
      flow: "github_oauth",
    },
    extra: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
    },
  });
}
```

#### Option B: Send to Analytics

```typescript
import { trackEvent } from "~/lib/analytics";

if (githubError) {
  trackEvent("github_oauth_error", {
    error_code: githubError,
    error_message: errorInfo.description,
    timestamp: new Date().toISOString(),
  });
}
```

### Metrics to Track

- **Error Rate:** % of OAuth flows that result in errors
- **Error Breakdown:** Count by error type (invalid_state, no_access_token, etc.)
- **User Impact:** # of unique users experiencing errors
- **Recovery Rate:** % of users who retry after error
- **Time to Error:** How long into flow error occurs

---

## Summary

### Production Readiness Criteria

✅ **READY FOR PRODUCTION** when:
- [ ] All 5 files modified as specified (Phase 2)
- [ ] All 9 manual tests passing (Phase 2 checklist)
- [ ] GitHub App URLs updated (dev + prod)
- [ ] Error monitoring configured
- [ ] Code reviewed and approved
- [ ] TypeScript/ESLint passing

### Current State vs. Target State

| Aspect | Current State | Target State (Phase 2) |
|--------|---------------|------------------------|
| Error redirects | ❌ All go to non-existent `/` | ✅ Go to callback URL (`/new`) |
| Error messages | ❌ Never shown to user | ✅ User-friendly toast notifications |
| URL cleanup | ❌ Parameters persist in URL | ✅ Cleaned up automatically |
| Error handling | ❌ Duplicate handlers in wrong places | ✅ Single global handler |
| Callback passing | ❌ Not passed from initiating page | ✅ Passed and used for redirects |
| User experience | ❌ Silent failures | ✅ Clear error messages |
| Debugging | ❌ No error logging | ✅ Errors logged for monitoring |

### Files Modified Summary

| File | Action | Priority | Status |
|------|--------|----------|--------|
| `github-oauth-error-handler.tsx` | **CREATE** | 🔴 CRITICAL | ⏳ Todo |
| `app/(app)/layout.tsx` | **MODIFY** | 🔴 CRITICAL | ⏳ Todo |
| `user-authorized/route.ts` | **MODIFY** | 🔴 CRITICAL | ⏳ Todo |
| `github-connector.tsx` | **MODIFY** | 🟡 HIGH | ⏳ Todo |
| `github-connect-dialog.tsx` | **MODIFY** | 🟢 LOW | ⏳ Todo |

**Total Estimated Time:** ~45 minutes

---

## Next Steps

1. **Implement Phase 2** (this document) - CRITICAL
2. Review and test all changes
3. Deploy to staging for QA
4. Deploy to production
5. Monitor error rates for 24-48 hours
6. Plan Phase 3 (UX improvements) based on user feedback

---

## References

- **Original Documents:**
  - `GITHUB_EDGE_CASES.md` - Comprehensive edge case catalog
  - `GITHUB_OAUTH_REDIRECT_ANALYSIS.md` - Error redirect implementation guide
- **Next.js Error Handling:** https://nextjs.org/docs/app/building-your-application/routing/error-handling
- **OAuth 2.0 Error Codes:** https://www.oauth.com/oauth2-servers/server-side-apps/possible-errors/
- **GitHub OAuth Documentation:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

---

**Document Status:** 🔴 Ready for Implementation
**Last Reviewed:** 2025-11-26
**Next Review:** After Phase 2 deployment
