# Auth Redirect Assertion Clarity

## Overview

Improve the compound assertion in `redirects.spec.ts` to provide better failure diagnostics while preserving the correct OR semantics.

## Current State Analysis

**File**: `apps/auth/e2e/tests/redirects.spec.ts:14`

The test checks that visiting `/` on the auth app (port 4104) redirects away — either to `/sign-in` or to the MF proxy. The current assertion uses a compound `||` inside `toBeTruthy()` which gives no diagnostic information on failure:

```ts
expect(url.includes("/sign-in") || !url.includes(":4104/")).toBeTruthy();
```

**Important**: This is OR logic (either condition is acceptable). Two separate `expect()` calls would create AND semantics and break the test when redirecting to `http://localhost:4104/sign-in`.

## Desired End State

The assertion should:
1. Preserve OR semantics (either redirect target is valid)
2. Show the actual URL and which conditions were checked on failure
3. Use named boolean variables for readability

### Verification:
- `pnpm --filter @lightfast/auth typecheck` passes
- E2E test still passes: `cd apps/auth && npx playwright test e2e/tests/redirects.spec.ts`

## What We're NOT Doing

- Not changing the test logic or redirect behavior
- Not splitting into two separate `expect()` calls (would change semantics)
- Not adding new tests

## Phase 1: Improve Assertion

### Overview
Extract boolean conditions into named variables and add a descriptive failure message.

### Changes Required:

#### 1. Redirect test assertion
**File**: `apps/auth/e2e/tests/redirects.spec.ts`
**Lines**: 12-14

Replace:
```ts
    // Should not stay at the bare auth root — either redirected to
    // /sign-in or to the MF proxy homepage
    expect(url.includes("/sign-in") || !url.includes(":4104/")).toBeTruthy();
```

With:
```ts
    // Should not stay at the bare auth root —
    // either redirected to /sign-in or to the MF proxy
    const redirectedToSignIn = url.includes("/sign-in");
    const leftAuthApp = !url.includes(":4104/");

    expect(
      redirectedToSignIn || leftAuthApp,
      `Expected redirect to /sign-in or away from :4104, got: ${url}`,
    ).toBeTruthy();
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`

#### Manual Verification:
- [x] E2E redirect test still passes when run against dev server

## References

- Original file: `apps/auth/e2e/tests/redirects.spec.ts:14`
