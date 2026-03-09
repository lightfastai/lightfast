# Auth Sign-Up Completion Test Hardening Plan

## Overview

Harden the auth app's test suite so that Clerk sign-up/sign-in flows that fail to reach `"complete"` status are always caught. The `legalAccepted` bug (stuck "Verifying..." loader) was missed because the E2E assertion matched the broken state, there was no defensive handling for non-complete status, and no test verified the Clerk API contract.

## Current State Analysis

### The Bug

`signUp.create()` was called without `legalAccepted: true`. After OTP verification, `signUp.status` was `"missing_requirements"` instead of `"complete"`. The UI showed "Verifying..." indefinitely because the code only handled `status === "complete"` — falling through silently on any other status.

### Why Tests Didn't Catch It

**E2E test** (`sign-up-email.spec.ts:50-52`):
```ts
await expect(page.getByText(/Verifying|Redirecting/)).toBeVisible({
  timeout: 10_000,
});
```
This regex matches "Verifying..." — the exact stuck state. The test passed while the user was stuck.

**Sign-in test** (`sign-in-email.spec.ts:52-54`): Same weak assertion pattern.

**No component test** exists for `OTPIsland` — the only unit tests cover server actions (Zod validation + redirect URL construction), not the client-side Clerk interactions.

**No defensive code** — `otp-island.tsx:151-170` only handles `"complete"` status. Any other status after successful verification silently falls through with `isVerifying` still `true`.

### Key Discoveries:
- `apps/auth/e2e/tests/sign-up-email.spec.ts:50` — regex `/Verifying|Redirecting/` matches the broken state
- `apps/auth/e2e/tests/sign-in-email.spec.ts:52` — identical weak assertion for sign-in
- `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:151-170` — no else branch after `status === "complete"` check
- `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx:101-106` — "Verifying..." shown when `isVerifying`, "Redirecting..." only when `isRedirecting`

## Desired End State

After this plan is complete:

1. E2E sign-up/sign-in OTP tests **fail** if the flow gets stuck at "Verifying..." instead of reaching "Redirecting..."
2. `OTPIsland` shows an error and stops the spinner if Clerk returns any non-`"complete"` status after verification — never hangs silently
3. An E2E contract test verifies the Clerk sign-up create request includes `legal_accepted` in the payload

### Verification:
```bash
pnpm --filter @lightfast/auth test:e2e  # E2E tests pass (requires dev server)
pnpm --filter @lightfast/auth typecheck  # No type errors
pnpm build:auth                          # Build succeeds
```

## What We're NOT Doing

- Adding React component testing infrastructure (happy-dom, @testing-library/react) — E2E covers the Clerk integration layer
- Modifying existing unit tests — they test server actions which are unrelated to this bug
- Adding vitest tests for OTPIsland — the Clerk hooks make this impractical without heavy mocking infrastructure
- Testing OAuth flows — Clerk handles `legalAccepted` internally for SSO strategies

## Implementation Approach

Three layers of defense:
1. **E2E assertions catch the symptom** — flow must reach "Redirecting...", not just "Verifying..."
2. **Defensive code prevents silent hangs** — non-complete status after verification triggers an error
3. **E2E contract test catches the root cause** — Clerk API request must include `legal_accepted`

---

## Phase 1: Harden E2E Completion Assertions

### Overview
Change sign-up and sign-in E2E tests to assert the flow actually completes — specifically that "Redirecting..." text appears. The current regex `/Verifying|Redirecting/` passes on the stuck state.

### Changes Required:

#### 1. Sign-up OTP completion test
**File**: `apps/auth/e2e/tests/sign-up-email.spec.ts`
**Changes**: Replace the weak regex assertion with a specific "Redirecting..." check

```ts
test("entering 424242 OTP completes sign-up", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-up");

  const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
  await page.getByPlaceholder("Email Address").fill(email);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await expect(page).toHaveURL(/step=code/);

  const otpInput = page.getByRole("textbox");
  await otpInput.fill("424242");

  // Must reach "Redirecting..." — if stuck at "Verifying..." this fails
  await expect(page.getByText("Redirecting...")).toBeVisible({
    timeout: 15_000,
  });
});
```

#### 2. Sign-in OTP completion test
**File**: `apps/auth/e2e/tests/sign-in-email.spec.ts`
**Changes**: Same fix — assert "Redirecting..." specifically

```ts
test("entering 424242 OTP verifies and redirects", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");

  await page
    .getByPlaceholder("Email Address")
    .fill("test+clerk_test@lightfast.ai");
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await expect(page).toHaveURL(/step=code/);

  const otpInput = page.getByRole("textbox");
  await otpInput.fill("424242");

  // Must reach "Redirecting..." — if stuck at "Verifying..." this fails
  await expect(page.getByText("Redirecting...")).toBeVisible({
    timeout: 15_000,
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] E2E tests pass: `pnpm --filter @lightfast/auth test:e2e`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [ ] Temporarily revert `legalAccepted: true` from `otp-island.tsx` and confirm the E2E sign-up test FAILS (then re-add it)
- [ ] Confirm no regressions in other E2E tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Defensive Handling for Non-Complete Status

### Overview
Add else branches in `OTPIsland` so that any non-`"complete"` status after successful verification triggers an error message and stops the spinner. This prevents silent infinite hangs for any future Clerk requirement changes.

### Changes Required:

#### 1. OTPIsland verify logic
**File**: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx`
**Changes**: Add else branches after both sign-in and sign-up status checks (lines 151-170)

Current code (sign-in path, lines 151-156):
```ts
if (signIn.status === "complete") {
  setIsRedirecting(true);
  await signIn.finalize({
    navigate: async () => navigateToConsole(),
  });
}
```

New code:
```ts
if (signIn.status === "complete") {
  setIsRedirecting(true);
  await signIn.finalize({
    navigate: async () => navigateToConsole(),
  });
} else {
  setError(
    "Sign-in could not be completed. Please try again or contact support."
  );
  setIsVerifying(false);
}
```

Current code (sign-up path, lines 165-170):
```ts
if (signUp.status === "complete") {
  setIsRedirecting(true);
  await signUp.finalize({
    navigate: async () => navigateToConsole(),
  });
}
```

New code:
```ts
if (signUp.status === "complete") {
  setIsRedirecting(true);
  await signUp.finalize({
    navigate: async () => navigateToConsole(),
  });
} else {
  setError(
    "Sign-up could not be completed. Please try again or contact support."
  );
  setIsVerifying(false);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] E2E tests pass: `pnpm --filter @lightfast/auth test:e2e`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [ ] Temporarily revert `legalAccepted: true` and confirm the sign-up flow shows the error message instead of hanging (then re-add it)
- [ ] Confirm normal sign-up and sign-in flows still work end-to-end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: E2E Contract Test for Clerk API Payload

### Overview
Add a Playwright E2E test that intercepts Clerk's FAPI requests during sign-up and verifies the `sign_ups` create request includes `legal_accepted`. This catches the root cause directly — if `legalAccepted: true` is accidentally removed from the `signUp.create()` call, this test fails before the flow even reaches OTP.

### Changes Required:

#### 1. Contract test in sign-up E2E
**File**: `apps/auth/e2e/tests/sign-up-email.spec.ts`
**Changes**: Add a new test that uses Playwright request interception

```ts
test("sign-up create request includes legal_accepted", async ({ page }) => {
  await setupClerkTestingToken({ page });

  const clerkCreateRequests: string[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("sign_ups")
    ) {
      clerkCreateRequests.push(req.postData() ?? "");
    }
  });

  await page.goto("/sign-up");

  const email = `signup-${Date.now()}+clerk_test@lightfast.ai`;
  await page.getByPlaceholder("Email Address").fill(email);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await expect(page).toHaveURL(/step=code/);

  // Verify at least one sign_ups POST included legal_accepted
  const hasLegalAccepted = clerkCreateRequests.some(
    (body) => body.includes("legal_accepted")
  );
  expect(hasLegalAccepted).toBe(true);
});
```

**Note**: Clerk's JS SDK sends POST requests to FAPI endpoints matching `*/sign_ups*`. The request body is form-encoded and includes `legal_accepted=true` when passed to `signUp.create()`. The exact URL depends on the Clerk testing environment but will contain `sign_ups` in the path.

### Success Criteria:

#### Automated Verification:
- [ ] E2E tests pass: `pnpm --filter @lightfast/auth test:e2e`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [ ] Temporarily revert `legalAccepted: true` and confirm this specific test FAILS (then re-add it)
- [ ] Inspect Playwright test output to confirm the request interception is capturing the right requests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### E2E Tests (Playwright):
- **Hardened completion assertions**: Both sign-up and sign-in OTP tests assert "Redirecting..." (not the ambiguous regex)
- **Contract test**: Verifies Clerk FAPI request payload includes `legal_accepted` during sign-up
- **Existing tests**: Error states, edge cases, redirects remain unchanged

### Defensive Code:
- `OTPIsland` shows error on any non-`"complete"` status after verification
- Prevents silent infinite spinner for any future Clerk requirement changes
- Makes the failure visible both to users and to E2E tests (error text appears)

### What This Catches:
| Scenario | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| `legalAccepted` removed from `signUp.create()` | Fails (no "Redirecting...") | Shows error msg | Fails (no `legal_accepted` in request) |
| New Clerk required field added | Fails (no "Redirecting...") | Shows error msg | Passes (unrelated field) |
| Clerk API returns unexpected status | Fails (no "Redirecting...") | Shows error msg | Passes (unrelated) |

## Performance Considerations

- E2E tests add ~10-15s per test (Clerk FAPI round-trip)
- Request interception in Phase 3 has negligible overhead (passive listener)
- No new dependencies required — Playwright already supports request interception

## References

- Research: `thoughts/shared/research/2026-03-09-auth-signup-legal-accepted-stuck-loader.md`
- Testing pyramid plan: `thoughts/shared/plans/2026-03-09-auth-testing-pyramid.md`
- OTP component: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:139-177`
- Sign-up E2E: `apps/auth/e2e/tests/sign-up-email.spec.ts:38-53`
- Sign-in E2E: `apps/auth/e2e/tests/sign-in-email.spec.ts:36-55`
- Verification UI: `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx:101-106`
