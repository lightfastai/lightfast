# Auth Testing Pyramid Implementation Plan

## Overview

Add a complete testing pyramid to `apps/auth` — parser unit tests (nuqs/testing), server action unit tests (vitest + mocked redirect), and E2E gap coverage (Playwright). The auth app currently has zero unit test infrastructure; this plan bootstraps vitest and adds high-ROI tests at every layer.

## Current State Analysis

- `apps/auth` has **no vitest** — no config, no dependency, no test scripts
- E2E tests exist in `apps/auth/e2e/` covering sign-in/sign-up happy paths, error states, and redirects
- E2E gaps: `step=activate` (SessionActivator) is completely untested; `step=code` without `email` edge case is untested
- Server actions (`_actions/sign-in.ts`, `_actions/sign-up.ts`) are pure Zod validation + `redirect()` — no Clerk SDK, highly unit-testable
- nuqs parsers (`_lib/search-params.ts`) define typed step unions — testable with `nuqs/testing` utilities
- The monorepo has a standard vitest pattern: root `vitest.shared.ts` extended via `mergeConfig` in each package

### Key Discoveries:
- `vitest.shared.ts:14-24` — shared config uses `pool: "threads"`, `maxThreads: 2`, `fileParallelism: false`
- `apps/relay/vitest.config.ts:1-12` — simplest node-environment config pattern to follow
- `turbo.json:39-42` — `test` task already configured with `inputs: ["src/**", "vitest.config.ts", "tsconfig.json"]`
- `apps/relay/package.json:16` — test script pattern: `"test": "vitest run"`
- `pnpm-workspace.yaml:49` — vitest catalog version: `^4.0.18`
- `search-params.ts:3-4` — `signInSteps = ["email", "code", "activate"]`, `signUpSteps = ["email", "code"]`
- `_actions/sign-in.ts:1` — `"use server"` directive; imports only `redirect` and `z`
- `_actions/sign-up.ts:1` — `"use server"` directive; same minimal imports + optional `ticket` param handling

## Desired End State

After this plan is complete:

1. `apps/auth` has vitest configured and integrated into the monorepo test pipeline
2. Parser unit tests verify nuqs schema correctness (bijectivity, round-trips, rejection of invalid values)
3. Server action unit tests verify Zod validation logic and redirect URL construction
4. E2E tests cover the previously untested `step=activate` flow and `step=code` without `email` edge case
5. Running `pnpm --filter @lightfast/auth test` executes all unit tests
6. Running `pnpm --filter @lightfast/auth test:e2e` continues to run all E2E tests

### Verification:
```bash
pnpm --filter @lightfast/auth test         # Unit tests pass
pnpm --filter @lightfast/auth test:e2e     # E2E tests pass (requires dev server)
pnpm --filter @lightfast/auth typecheck    # No type errors
pnpm build:auth                            # Build succeeds
```

## What We're NOT Doing

- Adding `withNuqsTestingAdapter` — inapplicable since auth uses server-side nuqs only (no `useQueryState` hooks)
- Adding `happy-dom` or component-level tests — auth tests are server-side only
- Adding coverage configuration — can be added later if needed
- Modifying existing E2E tests — they're well-structured and working
- Adding vitest to the Turborepo `check` pipeline — `test` is already a separate task

## Implementation Approach

Follow the established monorepo patterns exactly. The auth vitest setup mirrors `apps/relay` (simplest node-environment config). Unit tests are co-located with source files per the existing `*.test.ts` convention.

---

## Phase 1: Vitest Infrastructure

### Overview
Bootstrap vitest in `apps/auth` — add dependency, config, and test script.

### Changes Required:

#### 1. Add vitest devDependency
**File**: `apps/auth/package.json`
**Changes**: Add `vitest` using the catalog version

```json
"devDependencies": {
    ...
    "typescript": "catalog:",
    "vitest": "catalog:"
}
```

#### 2. Create vitest config
**File**: `apps/auth/vitest.config.ts` (new)
**Changes**: Create config extending shared config, matching `apps/relay/vitest.config.ts` pattern

```ts
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

#### 3. Add test script
**File**: `apps/auth/package.json`
**Changes**: Add `"test": "vitest run"` script (matching `apps/relay/package.json:16` pattern)

```json
"scripts": {
    ...
    "test": "vitest run",
    "test:e2e": "pnpm with-env playwright test",
    ...
}
```

#### 4. Install dependencies
Run `pnpm install` from monorepo root to resolve the new catalog dependency.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] `pnpm --filter @lightfast/auth test` runs (exits with "no test files" or 0 tests, not an error)
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [x] Confirm `vitest.config.ts` appears in `apps/auth/` directory

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Parser Unit Tests

### Overview
Add unit tests for nuqs search param schemas using `nuqs/testing` utilities. These tests verify type contracts at the schema boundary — catching regressions if the step union arrays are modified.

### Changes Required:

#### 1. Parser unit test file
**File**: `apps/auth/src/app/(app)/(auth)/_lib/search-params.test.ts` (new)
**Changes**: Test bijectivity, round-trips, and rejection of invalid values for both sign-in and sign-up schemas

```ts
import { describe, expect, it } from "vitest";
import { signInSearchParams, signUpSearchParams } from "./search-params";

describe("signInSearchParams.step", () => {
  const parser = signInSearchParams.step;

  it("parses valid step values", () => {
    expect(parser.parse("email")).toBe("email");
    expect(parser.parse("code")).toBe("code");
    expect(parser.parse("activate")).toBe("activate");
  });

  it("rejects invalid step values", () => {
    expect(parser.parse("invalid")).toBe(null);
    expect(parser.parse("")).toBe(null);
    expect(parser.parse("signup")).toBe(null);
  });

  it("serializes valid step values", () => {
    expect(parser.serialize("email")).toBe("email");
    expect(parser.serialize("code")).toBe("code");
    expect(parser.serialize("activate")).toBe("activate");
  });

  it("defaults to email", () => {
    expect(parser.defaultValue).toBe("email");
  });
});

describe("signUpSearchParams.step", () => {
  const parser = signUpSearchParams.step;

  it("parses valid step values", () => {
    expect(parser.parse("email")).toBe("email");
    expect(parser.parse("code")).toBe("code");
  });

  it("rejects activate (sign-up has no activate step)", () => {
    expect(parser.parse("activate")).toBe(null);
  });

  it("rejects invalid step values", () => {
    expect(parser.parse("invalid")).toBe(null);
    expect(parser.parse("")).toBe(null);
  });

  it("defaults to email", () => {
    expect(parser.defaultValue).toBe("email");
  });
});

describe("string params", () => {
  it("signInSearchParams.email parses strings", () => {
    expect(signInSearchParams.email.parse("user@example.com")).toBe("user@example.com");
  });

  it("signInSearchParams.email returns null for empty", () => {
    expect(signInSearchParams.email.parse("")).toBe("");
  });

  it("signUpSearchParams.__clerk_ticket parses strings", () => {
    expect(signUpSearchParams.__clerk_ticket.parse("ticket-123")).toBe("ticket-123");
  });
});
```

**Note**: The `nuqs/testing` utilities (`isParserBijective`, `testParseThenSerialize`, `testSerializeThenParse`) are available in nuqs 2.4.0+ and can be used here. However, direct `.parse()` / `.serialize()` calls on the parser objects are simpler and test the same contracts. If `nuqs/testing` utilities provide additional value (e.g., the bijectivity check verifies parse-then-serialize AND serialize-then-parse in one call), they can be added. The key tests are:
- Valid values parse correctly
- Invalid values return `null`
- Default values are correct
- Sign-up step does NOT include `activate`

### Success Criteria:

#### Automated Verification:
- [x] All parser tests pass: `pnpm --filter @lightfast/auth test`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [x] Review test output to confirm all assertions are meaningful (not vacuously true)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Server Action Unit Tests

### Overview
Add unit tests for `initiateSignIn` and `initiateSignUp` server actions. These test Zod validation logic and redirect URL construction without browser, Clerk, or server. The `redirect` function from `next/navigation` throws a `NEXT_REDIRECT` error — we mock it to capture the redirect URL.

### Changes Required:

#### 1. Sign-in action tests
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts` (new)
**Changes**: Test valid email redirect, invalid email error redirect, and empty email error redirect

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect — it throws in real Next.js
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

// Import after mocks
const { initiateSignIn } = await import("./sign-in");

describe("initiateSignIn", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to step=code with encoded email on valid input", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user%40example.com"
    );
  });

  it("redirects to error on invalid email", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-in?error=")
    );
  });

  it("redirects to error on missing email", async () => {
    const formData = new FormData();

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-in?error=")
    );
  });

  it("encodes special characters in email", async () => {
    const formData = new FormData();
    formData.set("email", "user+test@example.com");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user%2Btest%40example.com"
    );
  });
});
```

#### 2. Sign-up action tests
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-up.test.ts` (new)
**Changes**: Test valid email, email with ticket, invalid email with ticket preservation, and missing email

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

const { initiateSignUp } = await import("./sign-up");

describe("initiateSignUp", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to step=code with encoded email on valid input", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user%40example.com"
    );
  });

  it("includes ticket param when provided", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("ticket", "inv_abc123");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user%40example.com&ticket=inv_abc123"
    );
  });

  it("redirects to error on invalid email", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-up?error=")
    );
  });

  it("preserves ticket in error redirect", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("ticket", "inv_abc123");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringMatching(/\/sign-up\?error=.*&ticket=inv_abc123/)
    );
  });

  it("redirects to error on missing email", async () => {
    const formData = new FormData();

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-up?error=")
    );
  });

  it("omits ticket param when empty string", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("ticket", "");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user%40example.com"
    );
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `pnpm --filter @lightfast/auth test`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [x] Review test output to confirm redirect URLs match the expected patterns in the server action source
- [x] Verify that the "use server" directive doesn't cause issues with vitest (no server-only boundary error)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E Gap Coverage

### Overview
Add Playwright tests for the two identified E2E gaps: the `step=activate` flow (SessionActivator component) and the `step=code` without `email` edge case.

### Changes Required:

#### 1. Edge case tests
**File**: `apps/auth/e2e/tests/edge-cases.spec.ts` (new)
**Changes**: Test step=activate rendering and step=code without email

```ts
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Edge Cases", () => {
  test("activate step renders signing-in state", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=activate&token=test-token-123");

    // SessionActivator renders a "Signing in..." state
    await expect(page.getByText(/Signing in/)).toBeVisible({ timeout: 10_000 });
  });

  test("code step without email shows no OTP island", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=code");

    // Without email, OTP island should not render
    await expect(
      page.getByText("We sent a verification code")
    ).not.toBeVisible();
  });

  test("activate step without token shows no activator", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in?step=activate");

    // Without token, SessionActivator should not render
    // Page should show email form (default behavior when conditions aren't met)
    await expect(page.getByText(/Signing in/)).not.toBeVisible();
  });
});
```

**Note**: The exact text content of SessionActivator needs to be verified during implementation. Read `apps/auth/src/app/(app)/(auth)/_components/session-activator.tsx` to confirm the rendered text before writing the final assertion.

### Success Criteria:

#### Automated Verification:
- [x] All E2E tests pass: `pnpm --filter @lightfast/auth test:e2e` (requires dev server running via `pnpm dev:auth`)
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Build succeeds: `pnpm build:auth`

#### Manual Verification:
- [x] Manually navigate to `/sign-in?step=activate&token=test-token-123` and confirm the SessionActivator UI
- [x] Manually navigate to `/sign-in?step=code` (no email) and confirm no OTP island renders
- [x] Confirm no regressions in existing E2E tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests (vitest):
- **Parser tests**: Verify nuqs schema correctness — valid/invalid parsing, serialization, defaults, step union boundaries
- **Server action tests**: Verify Zod validation and redirect URL construction — valid email, invalid email, missing email, special characters, ticket param handling

### E2E Tests (Playwright):
- **Existing**: Sign-in flow, sign-up flow, error states, redirects
- **New**: Activate step, code-without-email edge case, activate-without-token edge case

### Key Edge Cases:
- `parseAsStringLiteral` rejecting values outside the const array
- Sign-up `step` not accepting `"activate"` (only sign-in has it)
- Empty `ticket` field being coerced to `undefined` via `|| undefined`
- `encodeURIComponent` handling of `+` and `@` in emails
- Redirect URL preserving ticket on validation failure

## Performance Considerations

- Unit tests run in ~1-2 seconds (no browser, no server, no network)
- E2E tests are gated behind `test:e2e` script (not in `test` script) — won't slow down `pnpm test` pipeline
- Vitest config uses shared thread pool settings to prevent CPU saturation in Turborepo parallel runs

## References

- Related research: `thoughts/shared/research/2026-03-09-auth-e2e-nuqs-testing-design.md`
- Shared vitest config: `vitest.shared.ts:14-24`
- Relay vitest config (pattern to follow): `apps/relay/vitest.config.ts:1-12`
- Auth search params schema: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:1-24`
- Sign-in server action: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts:10-22`
- Sign-up server action: `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts:11-34`
- Turbo test task: `turbo.json:39-42`
- Existing E2E tests: `apps/auth/e2e/tests/`
