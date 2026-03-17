---
date: 2026-03-17T00:00:00+11:00
author: claude
branch: feat/post-login-welcome-and-team-switcher-refactor
repository: lightfast
topic: "Fix Clerk waitlist invite pipeline — 3 bugs blocking invited user sign-up"
tags: [plan, auth, clerk, waitlist, invite, otp, oauth, github]
status: complete
---

# Fix Clerk Waitlist Invite Pipeline

## Overview

Fix 3 bugs in `apps/auth` that prevent invited users from completing sign-up via email OTP or GitHub OAuth. Bugs were identified in research doc `thoughts/shared/research/2026-03-17-auth-waitlist-invite-pipeline.md`.

Implemented and committed in `97bd426da`.

## Current State Analysis

- **Bug 1 (Critical)**: `OTPIsland.init()` calls `signUp.ticket({ ticket })` correctly, but when the status isn't `complete` it falls through to `signUp.create()` — which has no ticket and fails with `sign_up_restricted_waitlist`
- **Bug 2**: `OAuthButton.handleTicketSignUp()` calls `signUp.ticket()` (email method) instead of `signUp.sso({ strategy, ticket })`, so GitHub OAuth never initiates and the user sees "please use email option"
- **Bug 3**: `onError` prop not passed from `sign-up/page.tsx` (server component) to either `OTPIsland` or `OAuthButton`; waitlist errors silently swallowed since `onError?.()` is a no-op on undefined

## Desired End State

Invited users can:
1. Enter their email on the invite URL → receive OTP → complete sign-up → reach `/account/welcome`
2. Click "Continue with GitHub" on the invite URL → OAuth redirect → complete → reach `/account/welcome`
3. See a proper error page (with "Join the Waitlist" CTA) if anything goes wrong, never a silent no-op

### Key Discoveries (including post-implementation)

- `sign-up/page.tsx` is a **server component** — it cannot pass function callbacks to client components. The `onError` prop was never passable; fix must be internal to each component
- **Clerk does NOT auto-populate `emailAddress` from the invitation ticket on this instance.** After `signUp.ticket({ ticket })`, the sign-up object has `email_address: null` and `missing_fields: ["legal_accepted", "email_address"]`. The ticket only bypasses the waitlist restriction — the user must still provide their own email.
- **The invited email doesn't need to match the user's sign-up email.** The ticket grants access; the email is whatever the user wants.
- The cleanest implementation is a single `signUp.create({ ticket, emailAddress, legalAccepted: true })` call — all three params are properly typed in `SignUpFutureCreateParams`, no type casts needed.
- `signUp.sso({ strategy, ticket, ... })` passes the ticket to the OAuth flow. The `ticket` field is not in the TypeScript type `SignUpFutureSSOParams` but is accepted by Clerk's FAPI. Cast required: `as unknown as Parameters<typeof signUp.sso>[0]`.
- **"GitHub account already taken" is handled automatically** by `AuthenticateWithRedirectCallback` in `sign-up/sso-callback/page.tsx`. When the GitHub OAuth maps to an existing user, Clerk auto-completes a sign-in and redirects to `signInFallbackRedirectUrl="/account/welcome"`. No explicit handling needed.
- `sso-callback/page.tsx` already uses `AuthenticateWithRedirectCallback` with `continueSignUpUrl="/sign-up"` — no changes needed there
- Vitest environment is `node`; no React component test setup exists. Manual testing uses `some-email+clerk_test@lightfast.ai` / OTP `424242`

## What We're NOT Doing

- Adding `@testing-library/react` or jsdom (component unit tests require significant setup)
- Changing `onError` prop interface (kept for future client-component parents)
- Fixing `handleSignIn` waitlist fallback (sign-in mode users are existing accounts, shouldn't hit waitlist)
- Adding ticket to the SSO callback URL (Clerk stores ticket association server-side)
- Writing Playwright E2E tests for the invitation flow (good follow-up, out of scope here)

---

## Phase 1: Fix OTPIsland Ticket Flow ✅

### What Was Implemented

Replaced the two-step `signUp.ticket()` + `sendEmailCode()` approach with a single `signUp.create({ ticket, emailAddress, legalAccepted })` call. This was necessary because:
- `signUp.ticket()` does not populate `emailAddress` on this Clerk instance
- The original plan's `sendEmailCode()` after `signUp.ticket()` failed with "Email address missing on Sign Up Preparation"
- `signUp.create()` with `ticket` + `emailAddress` + `legalAccepted` handles everything in one FAPI call, and all three params are correctly typed

Also added self-redirect fallback for `sign_up_restricted_waitlist` errors (Bug 3 for OTPIsland).

### Actual Implementation

**`otp-island.tsx` — ticket branch**

```typescript
if (mode === "sign-up" && ticket) {
  // Single create() call: ticket bypasses waitlist, emailAddress is user-provided,
  // legalAccepted satisfies the legal_accepted requirement.
  const { error: createError } = await signUp.create({
    ticket,
    emailAddress: email ?? undefined,
    legalAccepted: true,
  });
  if (createError) { handleClerkError(createError); return; }
  if (signUp.status === "complete") {
    setIsRedirecting(true);
    await signUp.finalize({ navigate: async () => navigateToConsole() });
    return;
  }
  setResolvedEmail(signUp.emailAddress ?? email);
  const { error: sendError } = await startSpan(..., () => signUp.verifications.sendEmailCode());
  // ... breadcrumbs + error handling
  return;
}
```

**`otp-island.tsx` — waitlist error self-redirect**

```typescript
if (errCode === "sign_up_restricted_waitlist") {
  const msg = "Sign-ups are currently unavailable...";
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
- [ ] Visit `/sign-up?__clerk_ticket=<valid JWT>`, enter email → OTP step → code arrives in inbox
- [ ] Enter correct OTP `424242` (using Clerk test account) → redirected to `/account/welcome`
- [ ] With an already-complete invite (instant complete) → redirected without OTP step
- [ ] With expired/invalid ticket → error displayed inline (not silent failure)

---

## Phase 2: Fix OAuth Ticket Flow ✅

### What Was Implemented

Replaced `handleTicketSignUp()` with a proper `signUp.sso({ strategy, ticket })` call. The `ticket` field is not exposed in `SignUpFutureSSOParams` TypeScript types, so a cast is used with a comment explaining why. Also added self-redirect fallback for waitlist errors in both `handleTicketSignUp` and `handleSignUp`.

### Actual Implementation

**`oauth-button.tsx` — `handleTicketSignUp`**

```typescript
async function handleTicketSignUp(strategy: OAuthStrategy) {
  const { error } = await startSpan(
    { name: "auth.oauth.initiate", op: "auth", attributes: { strategy, mode } },
    () =>
      signUp.sso(
        // Clerk FAPI accepts `ticket` in sso() for invitation flows; TS types omit this field
        {
          strategy,
          ticket: ticket!,
          redirectCallbackUrl: "/sign-up/sso-callback",
          redirectUrl: `${consoleUrl}/account/welcome`,
        } as unknown as Parameters<typeof signUp.sso>[0]
      )
  );
  if (error) {
    const errCode = error.code;
    if (errCode === "sign_up_restricted_waitlist") {
      const msg = "Sign-ups are currently unavailable...";
      if (onError) { onError(msg, true); }
      else { window.location.href = `/sign-up?error=${encodeURIComponent(msg)}&waitlist=true`; }
    } else {
      toast.error(error.longMessage ?? error.message ?? "Authentication failed");
    }
    setLoading(false);
  }
}
```

**Handler routing updated** to pass `strategy`:

```typescript
const handler =
  mode === "sign-up" && ticket
    ? () => handleTicketSignUp(strategy)
    : mode === "sign-in"
      ? () => handleSignIn(strategy)
      : () => handleSignUp(strategy);
```

**"GitHub account already taken"** is handled transparently by `AuthenticateWithRedirectCallback` in `sign-up/sso-callback/page.tsx` — Clerk auto-signs in and redirects to `signInFallbackRedirectUrl`. No additional handling needed in `handleTicketSignUp`.

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (biome)
- [x] Existing unit tests pass: `pnpm --filter @lightfast/auth test`

#### Manual Verification
- [ ] Visit `/sign-up?__clerk_ticket=<valid JWT>`, click "Continue with GitHub" → redirected to GitHub OAuth
- [ ] Complete GitHub OAuth → redirected to `/account/welcome` (or `/account/teams/new` if no org)
- [ ] Non-invited user clicking GitHub on `/sign-up` → waitlist error page with "Join the Waitlist" CTA
- [ ] Normal sign-up GitHub flow (no ticket) unchanged

---

## Testing Strategy

### Unit Tests (no new tests required)
Existing `sign-up.test.ts` covers the `initiateSignUp` server action — those tests remain unchanged.

Client components (`OTPIsland`, `OAuthButton`) use Clerk FAPI hooks which require a browser environment. The vitest config uses `environment: "node"` with no React testing library configured. Component behavior is best verified manually or via Playwright E2E.

### Manual Testing Credentials
From `apps/auth/CLAUDE.md`:
- **Email**: `some-email+clerk_test@lightfast.ai`
- **OTP**: `424242`

---

## Phase 3: Accept Invitation UI ✅

### What Was Implemented

The original plan proposed an email-free URL approach (skipping email form entirely, revealing email from Clerk's sign-up object). This was revised after discovering Clerk doesn't auto-populate `emailAddress` from the ticket.

**What actually shipped:**
- "Accept Your Invitation" heading when ticket is present
- GitHub OAuth as primary CTA (full-width button, above separator)
- `EmailForm` as secondary (user enters whatever email they want)
- Invitation expiry decoded from JWT public claims and displayed
- `code-verification-ui.tsx` email prop widened to `string | null`
- `OTPIsland` email prop widened to `string | null`; `resolvedEmail` state for display
- OTP step still requires `email` in URL (unchanged from original flow)

**What was dropped from the original plan:**
- Email-free URL (`/sign-up?step=code&ticket=<JWT>` without email) — Clerk requires email to be explicitly set
- "Continue with Email" link that bypassed the email form — replaced with the actual `EmailForm`
- `handleReset` returning to ticket URL without email — reverted to original behavior

### Actual Implementation

**`sign-up/page.tsx` — invitation landing**

```tsx
function decodeTicketExpiry(ticket: string): Date | null {
  try {
    const segment = ticket.split(".")[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch { return null; }
}

// In page body:
const invitationExpiry = invitationTicket ? decodeTicketExpiry(invitationTicket) : null;

// Email step JSX:
invitationTicket ? (
  <>
    <OAuthButton mode="sign-up" ticket={invitationTicket} />
    <SeparatorWithText text="Or" />
    <EmailForm action="sign-up" ticket={invitationTicket} />
    {invitationExpiry && <p>Invitation expires {invitationExpiry.toLocaleDateString(...)}</p>}
  </>
) : (
  // Standard sign-up: email form + GitHub secondary (unchanged)
)
```

### Test Matrix

| Scenario | Expected outcome |
|---|---|
| Invite URL (`?__clerk_ticket=`) → landing page | "Accept Your Invitation" heading, GitHub primary, email form secondary, expiry shown |
| Invite URL → GitHub button | Initiates OAuth with ticket → `/account/welcome` |
| Invite URL → email form → submit | `initiateSignUp` → `/sign-up?step=code&email=...&ticket=...` → OTP |
| OTP step → enter `424242` | Redirected to `/account/welcome` |
| Invite URL → GitHub → account already exists | Clerk auto sign-in → `/account/welcome` (handled by `AuthenticateWithRedirectCallback`) |
| `/sign-up` (no ticket) → email form | Standard flow unchanged |
| `/sign-up` (no ticket) → GitHub | Waitlist error page shown (no regression) |
| Expired invite ticket | Error displayed inline via `handleClerkError` |

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm check` (biome)
- [x] Existing unit tests pass: `pnpm --filter @lightfast/auth test`

#### Manual Verification
- [ ] Accept Invitation landing renders correctly: GitHub primary, email form secondary
- [ ] Expiry date renders from JWT and is human-readable
- [ ] Email form submits → OTP step (email in URL, ticket in URL)
- [ ] OTP screen shows correct email address
- [ ] GitHub button initiates OAuth (does not show "please use email" error)
- [ ] Standard `/sign-up` (no ticket) shows email form + GitHub secondary — no regression

---

## References

- Research: `thoughts/shared/research/2026-03-17-auth-waitlist-invite-pipeline.md`
- Commit: `97bd426da fix(auth): repair waitlist invite sign-up pipeline`
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx`
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx`
- `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx`
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`
- SSO callback (no changes): `apps/auth/src/app/(app)/(auth)/sign-up/sso-callback/page.tsx`
