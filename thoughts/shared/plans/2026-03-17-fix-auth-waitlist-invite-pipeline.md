---
date: 2026-03-17T00:00:00+11:00
author: claude
branch: feat/post-login-welcome-and-team-switcher-refactor
repository: lightfast
topic: "Fix Clerk waitlist invite pipeline — 3 bugs blocking invited user sign-up"
tags: [plan, auth, clerk, waitlist, invite, otp, oauth, github]
status: ready
---

# Fix Clerk Waitlist Invite Pipeline

## Overview

Fix 3 bugs in `apps/auth` that prevent invited users from completing sign-up via email OTP or GitHub OAuth. Bugs were identified in research doc `thoughts/shared/research/2026-03-17-auth-waitlist-invite-pipeline.md`.

## Current State Analysis

- **Bug 1 (Critical)**: `OTPIsland.init()` calls `signUp.ticket({ ticket })` correctly, but when the status isn't `complete` it falls through to `signUp.create()` — which has no ticket and fails with `sign_up_restricted_waitlist`
- **Bug 2**: `OAuthButton.handleTicketSignUp()` calls `signUp.ticket()` (email method) instead of `signUp.sso({ strategy, ticket })`, so GitHub OAuth never initiates and the user sees "please use email option"
- **Bug 3**: `onError` prop not passed from `sign-up/page.tsx` (server component) to either `OTPIsland` or `OAuthButton`; waitlist errors silently swallowed since `onError?.()` is a no-op on undefined

## Desired End State

Invited users can:
1. Enter their email on the invite URL → receive OTP → complete sign-up → reach `/account/welcome`
2. Click "Continue with GitHub" on the invite URL → OAuth redirect → complete → reach `/account/welcome`
3. See a proper error page (with "Join the Waitlist" CTA) if anything goes wrong, never a silent no-op

### Key Discoveries

- `sign-up/page.tsx` is a **server component** — it cannot pass function callbacks to client components. The `onError` prop was never passable; fix must be internal to each component
- `signUp.ticket()` initializes the sign-up object with the invitation — you must then call `signUp.verifications.sendEmailCode()` (not `signUp.create()`) to send the OTP
- Clerk supports `signUp.sso({ strategy, ticket, ... })` to associate an OAuth flow with an invitation ticket
- `sso-callback/page.tsx` already uses `AuthenticateWithRedirectCallback` with `continueSignUpUrl="/sign-up"` — no changes needed there
- Vitest environment is `node`; no React component test setup exists. Manual testing uses `some-email+clerk_test@lightfast.ai` / OTP `424242`

## What We're NOT Doing

- Adding `@testing-library/react` or jsdom (component unit tests require significant setup)
- Modifying `sign-up/page.tsx` server component structure
- Changing `onError` prop interface (kept for future client-component parents)
- Fixing `handleSignIn` waitlist fallback (sign-in mode users are existing accounts, shouldn't hit waitlist)
- Adding ticket to the SSO callback URL (Clerk stores ticket association server-side)
- Writing Playwright E2E tests for the invitation flow (good follow-up, out of scope here)

---

## Phase 1: Fix OTPIsland Ticket Flow

### Overview

Fix the fall-through bug (Bug 1) and add self-redirect fallback for waitlist errors (Bug 3 for OTPIsland).

### Changes Required

#### 1. `otp-island.tsx` — fix `init()` ticket branch

**File**: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx`

**Change: lines 78–93** — after `signUp.ticket()` succeeds but isn't complete, send the OTP code and `return`. Do NOT fall through to `signUp.create()`.

```typescript
// BEFORE (lines 78–93):
if (mode === "sign-up" && ticket) {
  const { error: ticketError } = await signUp.ticket({ ticket });
  if (ticketError) {
    handleClerkError(ticketError);
    return;
  }
  if (signUp.status === "complete") {
    setIsRedirecting(true);
    await signUp.finalize({ navigate: async () => navigateToConsole() });
    return;
  }
  // Ticket didn't auto-complete — fall through to email code  ← BUG
}

// AFTER:
if (mode === "sign-up" && ticket) {
  const { error: ticketError } = await signUp.ticket({ ticket });
  if (ticketError) {
    handleClerkError(ticketError);
    return;
  }
  if (signUp.status === "complete") {
    setIsRedirecting(true);
    await signUp.finalize({ navigate: async () => navigateToConsole() });
    return;
  }
  // Ticket accepted, email verification required — send OTP now
  const { error: sendError } = await startSpan(
    { name: "auth.otp.send", op: "auth", attributes: { mode } },
    () => signUp.verifications.sendEmailCode()
  );
  if (sendError) {
    addBreadcrumb({
      category: "auth",
      message: "OTP send failed",
      level: "error",
      data: { code: sendError.code, mode },
    });
    handleClerkError(sendError);
  } else {
    addBreadcrumb({
      category: "auth",
      message: "OTP code sent",
      level: "info",
      data: { mode, email },
    });
  }
  return; // ← must return; do NOT fall through to signUp.create()
}
```

#### 2. `otp-island.tsx` — self-redirect fallback for waitlist errors

**Change: lines 53–59** — when `onError` is not provided (server component parent), redirect instead of no-op.

```typescript
// BEFORE:
if (errCode === "sign_up_restricted_waitlist") {
  onError?.(
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
    true
  );
  return;
}

// AFTER:
if (errCode === "sign_up_restricted_waitlist") {
  const msg =
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
  if (onError) {
    onError(msg, true);
  } else {
    window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
  }
  return;
}
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (biome)
- [x] Existing unit tests pass: `pnpm --filter @lightfast/auth test`

#### Manual Verification
- [ ] Visit `/sign-up?__clerk_ticket=<valid JWT>`, enter invited email → OTP step → code arrives in inbox
- [ ] Enter correct OTP `424242` (using Clerk test account) → redirected to `/account/welcome`
- [ ] With an already-complete invite (instant complete) → redirected without OTP step
- [ ] With expired/invalid ticket → error displayed inline (not silent failure)

**Implementation note**: After automated checks pass, confirm the email OTP flow manually before moving to Phase 2.

---

## Phase 2: Fix OAuth Ticket Flow

### Overview

Replace `handleTicketSignUp()` with a proper `signUp.sso({ strategy, ticket })` call (Bug 2), and add self-redirect fallback for waitlist errors in `handleSignUp` (Bug 3 for OAuthButton).

### Changes Required

#### 1. `oauth-button.tsx` — replace `handleTicketSignUp`

**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx`

**Change A: lines 23–44** — replace the entire `handleTicketSignUp` function:

```typescript
// BEFORE:
async function handleTicketSignUp() {
  const { error: ticketError } = await signUp.ticket({ ticket: ticket! });
  if (ticketError) {
    onError?.("Please use the email option above to complete your invitation sign-up.");
    setLoading(false);
    return;
  }
  if (signUp.status === "complete") {
    await signUp.finalize({
      navigate: async () => { window.location.href = `${consoleUrl}/account/welcome`; },
    });
    return;
  }
  onError?.("Please use the email option above to complete your invitation sign-up.");
  setLoading(false);
}

// AFTER:
async function handleTicketSignUp(strategy: OAuthStrategy) {
  const { error } = await startSpan(
    {
      name: "auth.oauth.initiate",
      op: "auth",
      attributes: { strategy, mode },
    },
    () =>
      signUp.sso({
        strategy,
        ticket: ticket!,
        redirectCallbackUrl: "/sign-up/sso-callback",
        redirectUrl: `${consoleUrl}/account/welcome`,
      })
  );
  if (error) {
    const errCode = error.code;
    if (errCode === "sign_up_restricted_waitlist") {
      addBreadcrumb({
        category: "auth",
        message: "OAuth blocked by waitlist (ticket flow)",
        level: "warning",
        data: { strategy },
      });
      const msg =
        "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
      if (onError) {
        onError(msg, true);
      } else {
        window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
      }
    } else {
      toast.error(error.longMessage ?? error.message ?? "Authentication failed");
    }
    setLoading(false);
  }
}
```

**Change B: line 130** — pass `strategy` to `handleTicketSignUp`:

```typescript
// BEFORE:
const handler =
  mode === "sign-up" && ticket
    ? () => handleTicketSignUp()
    : ...

// AFTER:
const handler =
  mode === "sign-up" && ticket
    ? () => handleTicketSignUp(strategy)
    : ...
```

**Change C: lines 98–113** — add self-redirect fallback in `handleSignUp` for waitlist errors (Bug 3 for non-ticket sign-up path):

```typescript
// BEFORE (in handleSignUp):
if (errCode === "sign_up_restricted_waitlist") {
  // ...
  onError?.(
    "Sign-ups are currently unavailable...",
    true
  );
}

// AFTER:
if (errCode === "sign_up_restricted_waitlist") {
  // ...
  const msg =
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.";
  if (onError) {
    onError(msg, true);
  } else {
    window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`;
  }
}
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (biome)
- [x] Existing unit tests pass: `pnpm --filter @lightfast/auth test`

#### Manual Verification
- [ ] Visit `/sign-up?__clerk_ticket=<valid JWT>`, click "Continue with GitHub" → redirected to GitHub OAuth (not "please use email" error)
- [ ] Complete GitHub OAuth → redirected to `/account/welcome` (or `/account/teams/new` if no org)
- [ ] Non-invited user clicking GitHub on `/sign-up` → waitlist error page with "Join the Waitlist" CTA
- [ ] Normal sign-up GitHub flow (no ticket) unchanged: `signUp.sso()` called without ticket

**Implementation note**: GitHub OAuth with ticket requires a live Clerk instance in waitlist mode. Test with a real invite URL in the development environment.

---

## Testing Strategy

### Unit Tests (no new tests required)
Existing `sign-up.test.ts` covers the `initiateSignUp` server action — those tests remain unchanged.

Client components (`OTPIsland`, `OAuthButton`) use Clerk FAPI hooks which require a browser environment. The vitest config uses `environment: "node"` with no React testing library configured. Component behavior is best verified manually or via Playwright E2E.

### Manual Testing Credentials
From `apps/auth/CLAUDE.md`:
- **Email**: `some-email+clerk_test@lightfast.ai`
- **OTP**: `424242`

### Full Manual Test Matrix

See Phase 3 for the consolidated test matrix covering all flows end-to-end.

---

---

## Phase 3: Zero-Friction "Accept Invitation" Experience

### Overview

Transform the invitation landing from a generic sign-up form into a focused "Accept Your Invitation" UI. Remove email entry entirely for invited users — the ticket already knows their email. Make GitHub the primary CTA (one click). Reveal the invited email dynamically at OTP time via `signUp.emailAddress` — keeping it out of URL params and browser history. Show the invitation expiry decoded from the JWT public claims.

### Key Design Decisions

- **Email out of URL**: The invited email no longer travels as `?email=user@corp.com`. `OTPIsland` reads `signUp.emailAddress` after `signUp.ticket()` resolves and stores it in local state. Reduces exposure in browser history, server logs, and referrer headers.
- **GitHub-first**: Invitations are high-intent. GitHub OAuth (one click) is a better primary CTA than an email form requiring typing + OTP. The email path becomes secondary.
- **Ticket travels via Clerk session, not URL**: After `signUp.sso({ strategy, ticket })`, the ticket association lives in Clerk's session cookie — it persists through the OAuth round-trip without appearing in the callback URL.
- **Graceful email mismatch (GitHub)**: If the user's GitHub primary email differs from the invited email, Clerk redirects to `continueSignUpUrl="/sign-up"` (already configured in `sso-callback/page.tsx`). Since the ticket is in Clerk's session, no data is lost.

### Changes Required

#### 1. `sign-up/page.tsx` — Accept Invitation UI when ticket is present

**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`

**Change A** — add JWT expiry decoder (pure function, no secret needed — `exp` is a public claim):

```typescript
// Add at module level (after imports):
function decodeTicketExpiry(ticket: string): Date | null {
  try {
    const segment = ticket.split(".")[1];
    if (!segment) return null;
    const payload = JSON.parse(
      atob(segment.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number"
      ? new Date(payload.exp * 1000)
      : null;
  } catch {
    return null;
  }
}
```

**Change B** — compute expiry and the email-free continue URL in the page body:

```typescript
const invitationExpiry = invitationTicket
  ? decodeTicketExpiry(invitationTicket)
  : null;

const continueWithEmailUrl = invitationTicket
  ? `/sign-up?step=code&ticket=${encodeURIComponent(invitationTicket)}`
  : null;
```

**Change C** — split the `step === "email"` branch on whether a ticket is present:

```tsx
{!error && step === "email" && (
  <>
    {invitationTicket ? (
      // Invitation flow — no email form, GitHub primary
      <>
        <OAuthButton mode="sign-up" ticket={invitationTicket} />
        <SeparatorWithText text="Or" />
        <Button asChild className="w-full" size="lg" variant="outline">
          <NextLink href={continueWithEmailUrl!}>Continue with Email</NextLink>
        </Button>
        {invitationExpiry && (
          <p className="text-center text-muted-foreground text-xs">
            Invitation expires{" "}
            {invitationExpiry.toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </>
    ) : (
      // Standard waitlist sign-up — email form + GitHub secondary
      <>
        <EmailForm action="sign-up" ticket={null} />
        <p className="text-center text-muted-foreground text-sm">
          {/* existing legal text */}
        </p>
        <SeparatorWithText text="Or" />
        <OAuthButton mode="sign-up" ticket={null} />
      </>
    )}
  </>
)}
```

**Change D** — allow `OTPIsland` to render without email (ticket-only path):

```tsx
{/* Step: code — allow ticket-only path (email revealed dynamically by Clerk) */}
{!error && step === "code" && (email || invitationTicket) && (
  <OTPIsland
    email={email ?? null}
    mode="sign-up"
    ticket={invitationTicket}
  />
)}
```

Previously the condition was `step === "code" && email` — `email` being required blocked the ticket-only path where `?email=` is absent from the URL.

#### 2. `otp-island.tsx` — nullable email + dynamic email reveal

**File**: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx`

**Change A** — widen `email` prop to `string | null`:

```typescript
interface OTPIslandProps {
  email: string | null;   // was: string
  mode: "sign-in" | "sign-up";
  onError?: (message: string, isWaitlist?: boolean) => void;
  ticket?: string | null;
}
```

**Change B** — add `resolvedEmail` state, seeded from prop (handles both paths):

```typescript
// Tracks the display email — may be null initially on ticket-only path
// and populated after signUp.ticket() resolves via signUp.emailAddress
const [resolvedEmail, setResolvedEmail] = React.useState<string | null>(email);
```

**Change C** — in the ticket branch of `init()`, read `signUp.emailAddress` after the ticket call:

```typescript
if (mode === "sign-up" && ticket) {
  const { error: ticketError } = await signUp.ticket({ ticket });
  if (ticketError) {
    handleClerkError(ticketError);
    return;
  }
  // Reveal the invited email from Clerk's sign-up object
  if (signUp.emailAddress) {
    setResolvedEmail(signUp.emailAddress);
  }
  if (signUp.status === "complete") {
    setIsRedirecting(true);
    await signUp.finalize({ navigate: async () => navigateToConsole() });
    return;
  }
  // ... sendEmailCode() + return (Phase 1)
}
```

**Change D** — pass `resolvedEmail` (not `email`) to `CodeVerificationUI`:

```tsx
<CodeVerificationUI
  email={resolvedEmail}   // was: email
  // ... other props unchanged
/>
```

**Change E** — update `handleReset` to return to Accept Invitation page (no email in URL) on ticket path:

```typescript
function handleReset() {
  if (mode === "sign-in") {
    window.location.href = "/sign-in";
  } else if (ticket) {
    // Return to Accept Invitation page (ticket-only URL, no email)
    window.location.href = `/sign-up?__clerk_ticket=${encodeURIComponent(ticket)}`;
  } else {
    window.location.href = "/sign-up";
  }
}
```

#### 3. `code-verification-ui.tsx` — widen email type

**File**: `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx`

**Change** — `email: string` → `email: string | null` (line 14). The conditional at lines 43–50 already handles null/empty:

```typescript
interface CodeVerificationUIProps {
  email: string | null;   // was: string — component already renders gracefully
  // ... rest unchanged
}
```

### What this does NOT change

- `initiateSignUp` server action — still used for the standard (no-ticket) email form path
- `EmailForm` — still rendered for non-ticket sign-ups
- `sign-in/page.tsx` — the sign-in OTPIsland always has `email` from the URL, TypeScript will verify this
- `sso-callback/page.tsx` — no changes (ticket persists in Clerk session through OAuth round-trip)
- The `onError` prop interface — unchanged

### Updated test matrix (replaces Testing Strategy section above)

| Scenario | Expected outcome |
|---|---|
| Invite URL (`?__clerk_ticket=`) → landing page | "Accept Invitation" UI: GitHub primary, "Continue with Email" link, expiry shown |
| Invite URL → GitHub button | Initiates OAuth with ticket (Phase 2 fix) → `/account/welcome` |
| Invite URL → "Continue with Email" | Goes to `/sign-up?step=code&ticket=<JWT>` (no email in URL) |
| OTP step (ticket-only) → mount | Calls `signUp.ticket()`, reveals invited email in UI dynamically |
| OTP step → enter `424242` | Redirected to `/account/welcome` |
| OTP step → Back button | Returns to Accept Invitation page (not `/sign-up` generic) |
| Invite URL → GitHub → email mismatch | Clerk handles, `continueSignUpUrl="/sign-up"` fallback, ticket in session |
| `/sign-up` (no ticket) → email form | Standard flow unchanged: email form visible, GitHub secondary |
| `/sign-up` (no ticket) → GitHub | Waitlist error page shown (no regression) |
| Expired invite ticket | Error displayed inline, not silent failure |

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (biome)
- [x] Existing unit tests pass: `pnpm --filter @lightfast/auth test`

#### Manual Verification
- [ ] Accept Invitation landing renders correctly with ticket in URL
- [ ] GitHub button is visually primary (full-width, above separator)
- [ ] "Continue with Email" navigates to OTP step without requiring email input
- [ ] OTP screen shows "We sent a verification code to **[email]**" after a brief loading moment
- [ ] Email is NOT visible in the URL bar at any point in the invite flow
- [ ] Back button from OTP returns to Accept Invitation page (not generic `/sign-up`)
- [ ] Expiry date renders from JWT and is human-readable
- [ ] Standard `/sign-up` (no ticket) shows email form + GitHub secondary — no regression

---

## References

- Research: `thoughts/shared/research/2026-03-17-auth-waitlist-invite-pipeline.md`
- Bug 1 location: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:78–93`
- Bug 2 location: `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx:23–44`
- Bug 3 location: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:111,117`
- SSO callback (no changes): `apps/auth/src/app/(app)/(auth)/sign-up/sso-callback/page.tsx`
