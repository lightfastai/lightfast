---
date: 2026-03-09T02:20:29Z
researcher: claude
git_commit: 55e330316385604b3673d32b14924825a9632f73
branch: feat/auth-server-actions-migration
repository: lightfast
topic: "Sign-up stuck in 'verifying...' loader — missing legal_accepted field"
tags: [research, codebase, auth, clerk, sign-up, otp, legal-accepted]
status: complete
last_updated: 2026-03-09
---

# Research: Sign-up stuck in "verifying..." loader — missing legal_accepted field

**Date**: 2026-03-09T02:20:29Z
**Git Commit**: 55e330316385604b3673d32b14924825a9632f73
**Branch**: feat/auth-server-actions-migration

## Research Question

During the sign-up OTP verification step, after the user enters the 6-digit code, the UI gets
stuck in the "verifying..." loader state and never redirects. The Clerk API response shows:

```json
{
  "status": "missing_requirements",
  "required_fields": ["legal_accepted", "email_address"],
  "missing_fields": ["legal_accepted"],
  "legal_accepted_at": null
}
```

## Summary

The sign-up flow never completes because `legal_accepted` is a required field in the Clerk
dashboard configuration, but it is never submitted by the client. After OTP verification
succeeds, `signUp.status` is `"missing_requirements"` — not `"complete"` — so the finalize
block is never reached and `isVerifying` remains `true`, causing the persistent loader.

**Root field**: `legalAccepted: true` is missing from the `signUp.create()` call in
`otp-island.tsx`.

## Detailed Findings

### Sign-up OTP Island (`apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx`)

The `OTPIsland` component handles both `sign-in` and `sign-up` OTP flows.

**Sign-up creation (line 101-108):**
```ts
const { error: createError } = await signUp.create({
  emailAddress: email,
  // ⚠️ legalAccepted: true is NOT passed here
});
```

Clerk's dashboard has "legal acceptance" enabled as a required field. Because `legalAccepted`
is not set at creation time, the field stays in `missing_fields` for the entire session.

**OTP verification (lines 157-169):**
```ts
const { error: verifyError } =
  await signUp.verifications.verifyEmailCode({ code });
if (verifyError) {
  handleClerkError(verifyError);
  setIsVerifying(false);
  return;
}
if (signUp.status === "complete") {
  setIsRedirecting(true);
  await signUp.finalize({
    navigate: async () => navigateToConsole(),
  });
}
```

After `verifyEmailCode` resolves successfully:
- `signUp.status === "missing_requirements"` (not `"complete"`)
- The `if (signUp.status === "complete")` block is skipped
- `setIsVerifying(false)` is never called
- `isVerifying` stays `true` → the spinner renders indefinitely

### Sign-up Page (`apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`)

- Legal compliance is shown as a static paragraph ("By joining, you agree to our Terms of Service and Privacy Policy") — a UI acknowledgement only (lines 88–108)
- This text is never transmitted to Clerk — it is display-only
- The `OTPIsland` is rendered at line 117 with `mode="sign-up"`

### Sign-up Server Action (`apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts`)

The `initiateSignUp` server action only validates the email and redirects to `?step=code`. It
has no interaction with the Clerk API directly (that happens client-side in `OTPIsland`). No
`legalAccepted` logic here.

## Code References

- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:101-108` — `signUp.create()` missing `legalAccepted: true`
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:157-169` — verify block only handles `"complete"` status, not `"missing_requirements"`
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:88-108` — static legal text (display-only)

## Architecture Documentation

The sign-up flow has two phases:

1. **Server action phase** (`sign-up.ts`): validates email, redirects to `?step=code&email=...`
2. **Client OTP phase** (`otp-island.tsx`):
   - On mount: calls `signUp.create({ emailAddress })` then `signUp.verifications.sendEmailCode()`
   - On 6-digit entry: calls `signUp.verifications.verifyEmailCode({ code })`
   - On `status === "complete"`: calls `signUp.finalize()` → navigates to console

The `legalAccepted` field is a Clerk-level requirement configured in the Clerk dashboard.
It must be submitted via `signUp.create({ legalAccepted: true })` or
`signUp.update({ legalAccepted: true })` for the status to transition to `"complete"`.

## The Fix

Pass `legalAccepted: true` in the `signUp.create()` call:

```ts
// otp-island.tsx line ~102
const { error: createError } = await signUp.create({
  emailAddress: email,
  legalAccepted: true,
});
```

This satisfies the required field upfront. After OTP verification, `signUp.status` will be
`"complete"` and the `finalize()` block will execute correctly.

## Open Questions

- Whether `legalAccepted` should also be passed in the OAuth path (`OAuthButton` component) —
  needs investigation if the same Clerk setting applies to OAuth sign-ups.
