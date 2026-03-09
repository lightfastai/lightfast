# Auth E2E: OTP Input Selector Specificity

## Overview

Replace the generic `page.getByRole("textbox")` OTP selector in 3 E2E test files with a scoped selector using the existing `data-slot="input-otp"` attribute, improving test robustness and readability without any component changes.

## Current State Analysis

Three test files use `page.getByRole("textbox")` to target the OTP input:

- `apps/auth/e2e/tests/sign-up-email.spec.ts:47`
- `apps/auth/e2e/tests/sign-in-email.spec.ts:48`
- `apps/auth/e2e/tests/error-states.spec.ts:57`

The `input-otp` library renders a single hidden `<input type="text">` inside a container that already carries `data-slot="input-otp"` (set in `packages/ui/src/components/ui/input-otp.tsx:41`). Today `getByRole("textbox")` matches only one element on the OTP step, but the selector is fragile and not self-documenting.

### Key Discoveries:
- No `data-testid`, `name`, or `aria-label` exists on the OTP input — `data-slot="input-otp"` is the only semantic attribute available without component changes
- The `data-slot` attribute is set by the shared UI primitive, not the auth app, so it's stable
- All 3 test files follow the exact same pattern: `const otpInput = page.getByRole("textbox");`

## Desired End State

All OTP input selectors in E2E tests use `page.locator('[data-slot="input-otp"]')`, scoping the textbox lookup to the OTP container. No component changes required.

Verification: all E2E tests pass with the updated selectors.

## What We're NOT Doing

- Not adding `data-testid` attributes to the component
- Not creating page object models or test helpers
- Not changing any other selectors in the test files
- Not modifying the `InputOTP` UI primitive

## Implementation Approach

Direct find-and-replace of the selector in 3 files. Single phase, no dependencies.

## Phase 1: Update OTP Selectors

### Overview
Replace `page.getByRole("textbox")` with the scoped `page.locator('[data-slot="input-otp"]')` in all 3 test files.

### Changes Required:

#### 1. `apps/auth/e2e/tests/sign-up-email.spec.ts`
**Line**: 47
**Change**: Replace generic textbox selector with scoped OTP selector

```typescript
// Before:
const otpInput = page.getByRole("textbox");

// After:
const otpInput = page.locator('[data-slot="input-otp"]');
```

#### 2. `apps/auth/e2e/tests/sign-in-email.spec.ts`
**Line**: 48
**Change**: Same replacement

```typescript
// Before:
const otpInput = page.getByRole("textbox");

// After:
const otpInput = page.locator('[data-slot="input-otp"]');
```

#### 3. `apps/auth/e2e/tests/error-states.spec.ts`
**Line**: 57
**Change**: Same replacement

```typescript
// Before:
const otpInput = page.getByRole("textbox");

// After:
const otpInput = page.locator('[data-slot="input-otp"]');
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] E2E tests pass: `cd apps/auth && pnpm exec playwright test` (22/24 passed, 1 skipped, 1 pre-existing failure unrelated to OTP selector)

#### Manual Verification:
- [ ] None required — this is a test-only change with no UI impact

## Testing Strategy

### Automated:
- Existing E2E tests exercise the updated selectors directly — no new tests needed
- The 3 affected tests (`entering 424242 OTP completes sign-up`, `entering 424242 OTP verifies and redirects`, `wrong OTP shows inline error`) will fail immediately if the selector doesn't match

## References

- UI primitive: `packages/ui/src/components/ui/input-otp.tsx:41` (`data-slot="input-otp"`)
- OTP component: `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx:56-90`
