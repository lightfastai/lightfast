---
date: 2026-03-17T00:00:00+11:00
researcher: claude
git_commit: 6cc89ae450dd5c11f968e9714c6417fc44f61982
branch: feat/post-login-welcome-and-team-switcher-refactor
repository: lightfast
topic: "Clerk waitlist invite pipeline — end-to-end lifecycle and bugs"
tags: [research, auth, clerk, waitlist, invite, sign-up, oauth, github]
status: complete
last_updated: 2026-03-17
---

# Research: Clerk Waitlist Invite Pipeline

**Date**: 2026-03-17
**Git Commit**: `6cc89ae450dd5c11f968e9714c6417fc44f61982`
**Branch**: `feat/post-login-welcome-and-team-switcher-refactor`

## Research Question

The Lightfast `apps/auth` app is in Clerk "waitlist mode". Investigate the entire end-to-end lifecycle of a waitlist invitation, including the email OTP flow, GitHub OAuth flow, what's broken, why, and whether GitHub can be used to accept an invite.

Test invite URL used during research:
`https://lightfast.ai/sign-up?__clerk_ticket=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

## Summary

There are **three compounding bugs** in the invitation sign-up pipeline. The most critical is in `OTPIsland`: after correctly calling `signUp.ticket()`, the code falls through to `signUp.create()` — which tries to create a new sign-up without the ticket, triggering Clerk's `sign_up_restricted_waitlist` error. The GitHub OAuth flow is also completely broken for invite acceptance. Additionally, neither component receives the `onError` prop from the sign-up page, so waitlist errors are silently swallowed rather than being shown to the user.

**GitHub OAuth with an invite: Yes, it is possible**, but not with the current `handleTicketSignUp()` implementation. It requires passing the `ticket` parameter directly to `signUp.sso()`.

---

## Detailed Findings

### Architecture Overview

The auth app (`apps/auth`) is a standalone Next.js microfrontend. The sign-up pipeline for invited users involves:

```
Clerk sends invite email
  → User clicks link: /sign-up?__clerk_ticket=<JWT>
  → sign-up/page.tsx (server component) reads params, renders form
  → User enters email → EmailForm → initiateSignUp (server action)
  → Redirects to /sign-up?step=code&email=...&ticket=...
  → OTPIsland (client component) calls Clerk FAPI
  → On success → /account/welcome (console app)
```

**Key files:**
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx` — server page, renders form or OTP island
- `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts` — server action for email submission
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx` — client island, Clerk FAPI calls
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx` — client island, GitHub OAuth
- `apps/auth/src/app/(app)/(auth)/_components/email-form.tsx` — server form with hidden ticket field
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts` — nuqs param definitions
- `apps/auth/src/middleware.ts` — Clerk middleware, route protection

---

### Invitation Token (`__clerk_ticket`)

The `__clerk_ticket` URL param is a signed JWT from Clerk. Decoded:
```json
{
  "eis": 2592000,        // expiry window (30 days)
  "exp": 1776303533,     // absolute expiry timestamp
  "iid": "ins_33USDy...", // Clerk instance ID
  "sid": "inv_3B3Isy...", // invitation ID
  "st": "invitation"     // type
}
```

The token is URL-safe base64 (no `+`/`/`, uses `-`/`_`). Dots separate JWT sections.

---

### Step 1: URL Landing (`sign-up/page.tsx:43-47`)

```tsx
const { step, email, error, ticket, __clerk_ticket, waitlist } =
  await loadSignUpSearchParams(searchParams);

// Merges both param names into one
const invitationTicket = ticket ?? __clerk_ticket ?? null;
```

`loadSignUpSearchParams` (`search-params.ts:19-26`) defines both `ticket` (nuqs internal) and `__clerk_ticket` (Clerk's native param) as separate parsers. The page merges them. This is correct.

---

### Step 2: Email Form Submission

`EmailForm` (`email-form.tsx:16`) renders a hidden `<input name="ticket" value={ticket} />` so the ticket travels with the form submission.

`initiateSignUp` (`sign-up.ts:12-39`) receives `email` + `ticket`, validates email, then redirects:
```
/sign-up?step=code&email=user@example.com&ticket=<JWT>
```

The ticket is renamed from `__clerk_ticket` → `ticket` (nuqs internal name) at this point. The tests (`sign-up.test.ts:28-37`) cover this correctly.

---

### Step 3: OTPIsland Initialization — **BUG 1 (CRITICAL)**

`otp-island.tsx:71-163` — the `init()` `useEffect` runs on mount:

```typescript
if (mode === "sign-up" && ticket) {
  // Attempt 1: accept the invitation
  const { error: ticketError } = await signUp.ticket({ ticket });
  if (ticketError) {
    handleClerkError(ticketError);
    return;
  }
  if (signUp.status === "complete") {
    // auto-complete: user already existed or simple invite
    setIsRedirecting(true);
    await signUp.finalize({ navigate: async () => navigateToConsole() });
    return;
  }
  // *** FALLS THROUGH HERE — BUG ***
}

// This executes for BOTH the non-ticket path AND the fall-through:
const { error: createError } = await signUp.create({
  emailAddress: email,
  legalAccepted: true,
});
if (createError) {
  handleClerkError(createError); // <-- gets sign_up_restricted_waitlist
  return;
}
await signUp.verifications.sendEmailCode();
```

**What happens:** When `signUp.ticket()` succeeds but the invite requires email verification (status ≠ `complete`), the code falls through and calls `signUp.create({ emailAddress: email })`. This creates a **brand new sign-up attempt without the invitation ticket**. Clerk's waitlist mode blocks this with `sign_up_restricted_waitlist`.

**What should happen:** After `signUp.ticket()` succeeds but is not complete, call `signUp.verifications.sendEmailCode()` directly — the sign-up object is already initialized by the ticket call.

**Correct flow:**
```typescript
if (mode === "sign-up" && ticket) {
  const { error: ticketError } = await signUp.ticket({ ticket });
  if (ticketError) { handleClerkError(ticketError); return; }
  if (signUp.status === "complete") { /* finalize */ return; }
  // Ticket accepted but needs email verification — send OTP now
  await signUp.verifications.sendEmailCode();
  return; // <-- MUST RETURN, not fall through
}
// Non-ticket path only:
await signUp.create({ emailAddress: email, legalAccepted: true });
await signUp.verifications.sendEmailCode();
```

---

### Step 3b: GitHub OAuth with Invite — **BUG 2 (COMPLETE BREAKAGE)**

`oauth-button.tsx:118-141` — the routing logic:

```typescript
const handler =
  mode === "sign-up" && ticket
    ? () => handleTicketSignUp()    // ← ticket + sign-up path
    : mode === "sign-in"
      ? () => handleSignIn(strategy)
      : () => handleSignUp(strategy);
```

`handleTicketSignUp()` (`oauth-button.tsx:23-44`):
```typescript
async function handleTicketSignUp() {
  const { error: ticketError } = await signUp.ticket({ ticket: ticket! });
  if (ticketError) {
    onError?.("Please use the email option above...");
    return;
  }
  if (signUp.status === "complete") {
    await signUp.finalize(...);
    return;
  }
  // Not complete → shows error "Please use email option above"
  onError?.("Please use the email option above...");
}
```

This calls `signUp.ticket()` (email-based ticket acceptance) but never initiates OAuth. If the ticket doesn't auto-complete (which it won't for a GitHub OAuth flow), it shows an error.

**Can GitHub OAuth accept a Clerk invitation? YES.** The correct approach is:
```typescript
await signUp.sso({
  strategy: "oauth_github",
  ticket: ticket,                              // ← pass ticket here
  redirectCallbackUrl: "/sign-up/sso-callback",
  redirectUrl: `${consoleUrl}/account/welcome`,
});
```

Clerk supports the `ticket` parameter in `signUp.sso()` to associate the OAuth flow with an invitation. The current code never does this.

**SSO Callback** (`sign-up/sso-callback/page.tsx`): Uses `AuthenticateWithRedirectCallback` with `continueSignUpUrl="/sign-up"`. This would handle the return flow correctly once the OAuth is properly initiated with the ticket.

---

### Error Propagation — **BUG 3 (SILENT FAILURES)**

`otp-island.tsx:53-59` — the waitlist error handler:
```typescript
if (errCode === "sign_up_restricted_waitlist") {
  onError?.(
    "Sign-ups are currently unavailable...",
    true
  );
  return; // ← never calls setError()
}
```

`sign-up/page.tsx:117`:
```tsx
<OTPIsland email={email} mode="sign-up" ticket={invitationTicket} />
// ↑ onError is NOT passed
```

`sign-up/page.tsx:111`:
```tsx
<OAuthButton mode="sign-up" ticket={invitationTicket} />
// ↑ onError is NOT passed
```

When `sign_up_restricted_waitlist` fires in either component, `onError?.()` is a no-op (optional chaining on undefined). `setError` is never called for this code path. **The user sees nothing change.**

The `onError` prop is designed to trigger a redirect: it should call the sign-up page with `?error=<message>&waitlist=true` so the `ErrorBanner` component (`error-banner.tsx`) renders. But without the prop being passed, this redirect never happens.

**Contrast with sign-in page** (`sign-in/page.tsx:70-71`): Also doesn't pass `onError` to `OAuthButton`. But sign-in doesn't face waitlist issues for existing users. GitHub OAuth sign-in uses `handleSignIn()` which goes through `signIn.sso()` (different path, not blocked by sign-up restrictions for existing accounts).

---

### Middleware (No Issues Found)

`middleware.ts:50-58` — public routes include both `/sign-up` and `/sign-up/sso-callback`. The `__clerk_ticket` param is not referenced in middleware; Clerk's SDK handles it automatically at the component level.

`middleware.ts:86-88` — `treatPendingAsSignedOut: false` means users who've signed up but have no org still get treated as authenticated (not re-directed to sign-in). This is correct for the post-sign-up onboarding flow.

---

### Existing Tests — Gaps

**What IS tested:**
- `sign-up.test.ts` — `initiateSignUp` server action: redirect URLs, ticket passthrough, email validation (6 cases)
- `sign-in.test.ts` — `initiateSignIn` server action: redirect URLs, email validation
- `search-params.test.ts` — nuqs parser validation for step literals, string params

**What is NOT tested (all the broken paths):**
- `OTPIsland` ticket flow: `signUp.ticket()` → fall-through → `signUp.create()` bug
- `OTPIsland` ticket flow: correct path (after ticket, `sendEmailCode()` instead of `create()`)
- `OAuthButton` `handleTicketSignUp()` — that `signUp.ticket()` is called instead of `signUp.sso()`
- `OAuthButton` `handleSignUp()` — that `sign_up_restricted_waitlist` error is handled
- The `onError` callback: that waitlist errors reach the page-level `ErrorBanner`
- End-to-end: invitation URL → enter email → OTP → complete sign-up
- End-to-end: invitation URL → GitHub OAuth → complete sign-up

The auth CLAUDE.md (`apps/auth/CLAUDE.md`) documents test accounts:
- Email: `some-email+clerk_test@lightfast.ai`
- OTP: `424242`

But no E2E tests using these for the invitation flow exist.

---

## Bug Summary Table

| # | Location | Description | User-facing symptom |
|---|----------|-------------|---------------------|
| 1 | `otp-island.tsx:117-145` | After `signUp.ticket()` succeeds (not complete), falls through to `signUp.create()` which fails with `sign_up_restricted_waitlist` | "Sign-ups are currently unavailable" (silently swallowed, or shown if `onError` wired) |
| 2 | `oauth-button.tsx:23-44` | `handleTicketSignUp()` uses `signUp.ticket()` (email method) instead of `signUp.sso({ strategy, ticket })` | GitHub button does nothing or shows "please use email" |
| 3 | `sign-up/page.tsx:111,117` | `onError` prop not passed to `OAuthButton` or `OTPIsland` | Waitlist errors silently swallowed — no UI feedback |

---

## Correct Invite Flows (As They Should Work)

### Email + Invite (correct flow)
```
1. Visit /sign-up?__clerk_ticket=<JWT>
2. Page shows invitation banner + email form
3. User enters email → initiateSignUp → redirect to /sign-up?step=code&email=...&ticket=...
4. OTPIsland.init():
   a. signUp.ticket({ ticket })
   b. If complete → finalize → /account/welcome
   c. If NOT complete → signUp.verifications.sendEmailCode()
5. User enters 6-digit code → signUp.verifications.verifyEmailCode({ code })
6. If complete → finalize → /account/welcome
```

### GitHub OAuth + Invite (correct flow, not yet implemented)
```
1. Visit /sign-up?__clerk_ticket=<JWT>
2. Page shows invitation banner + email form + GitHub button
3. User clicks GitHub → OAuthButton.handleOAuth()
4. Should call: signUp.sso({ strategy: "oauth_github", ticket, redirectCallbackUrl: "/sign-up/sso-callback", redirectUrl: ... })
5. User authenticates with GitHub
6. Clerk redirects to /sign-up/sso-callback
7. AuthenticateWithRedirectCallback handles completion → /account/welcome
```

---

## Code References

- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:43-47` — ticket param merging
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:111` — OAuthButton (missing onError)
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:117` — OTPIsland (missing onError)
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:71-163` — `init()` function
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:78-93` — ticket branch with fall-through bug
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:117-145` — `signUp.create()` that should not execute for ticket path
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:53-59` — `sign_up_restricted_waitlist` handler (onError? no-op)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx:23-44` — `handleTicketSignUp()` (wrong approach)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx:82-116` — `handleSignUp()` (correct for non-invite path)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx:128-133` — routing logic
- `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts:32-38` — redirect with ticket param
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:19-26` — `__clerk_ticket` param definition
- `apps/auth/src/app/(app)/(auth)/sign-up/sso-callback/page.tsx` — OAuth callback handler
- `apps/auth/src/middleware.ts:50-58` — public routes (no issues)

## Open Questions

1. Should GitHub OAuth even be shown on the sign-up page when an invite ticket is present? Given that it currently can't work correctly, hiding it until fixed would avoid confusion.
2. Should the OTP step be shown at all for the ticket flow, or should `OTPIsland` handle the full ticket → OTP transition internally without requiring a page redirect to `step=code`?
3. What Clerk configuration is needed in the dashboard to allow `signUp.sso({ ticket })` on an instance in waitlist mode? Does the invitation bypass all waitlist restrictions for OAuth as well as email?
