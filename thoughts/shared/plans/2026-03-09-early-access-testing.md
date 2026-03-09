# Early Access Testing Implementation Plan

## Overview

Add full test coverage for the `(early-access)` route group in the auth app. The structural alignment (layout, error boundary, error banner, createSerializer, Clerk SDK migration) is already complete — this plan covers only the missing tests: search params unit tests, server action unit tests, and E2E URL-driven state tests.

## Current State Analysis

The `(early-access)` route group is structurally aligned with `(auth)` but has zero test coverage:

- `_lib/search-params.ts` — 9 parsers, `createLoader`, `createSerializer` — **no tests**
- `_actions/early-access.ts` — complex server action (Zod → Arcjet → Redis → Clerk SDK → redirect) — **no tests**
- E2E — 5 existing spec files cover `(auth)` only — **no early-access specs**

### Key Discoveries:
- `(auth)` test patterns at `_lib/search-params.test.ts:1-68` and `_actions/sign-in.test.ts:1-58` provide exact templates
- Server action uses `serializeEarlyAccessParams` for all redirects (type-safe, consistent)
- Arcjet shield is `DRY_RUN` when `env.NODE_ENV !== "production"` (`_actions/early-access.ts:47`)
- Error banner has two visual modes: red (general) and yellow (rate limit) at `_components/error-banner.tsx:13-28`
- Success state shows "You're in!" with confetti at `early-access/page.tsx:54-78`

## Desired End State

Three new test files exist with full coverage:

1. `apps/auth/src/app/(app)/(early-access)/_lib/search-params.test.ts` — all 9 parsers tested
2. `apps/auth/src/app/(app)/(early-access)/_actions/early-access.test.ts` — ~14 test cases covering all redirect paths
3. `apps/auth/e2e/tests/early-access.spec.ts` — ~7 URL-driven E2E tests

### Verification:
- `pnpm --filter @lightfast/auth test` passes with all new unit tests green
- `pnpm --filter @lightfast/auth exec playwright test e2e/tests/early-access.spec.ts` passes

## What We're NOT Doing

- Form submission E2E tests (require Arcjet/Redis/Clerk boundary mocking with MSW)
- Component-level tests for error-banner, submit-button, or islands
- Any structural changes to existing code

## Implementation Approach

Three sequential phases, each producing one test file. Each phase follows the established `(auth)` test patterns exactly.

---

## Phase 1: Search Params Unit Tests

### Overview
Port the `(auth)/_lib/search-params.test.ts` pattern to test all 9 early-access parsers.

### Changes Required:

#### 1. New file: `_lib/search-params.test.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_lib/search-params.test.ts`
**Changes**: New file — test each parser's `.parse()`, `.serialize()`, and `.defaultValue`

```ts
import { describe, expect, it } from "vitest";
import { earlyAccessSearchParams } from "./search-params";

describe("earlyAccessSearchParams", () => {
  describe("email", () => {
    const parser = earlyAccessSearchParams.email;

    it("parses string values", () => {
      expect(parser.parse("test@example.com")).toBe("test@example.com");
    });

    it("returns empty string for empty input", () => {
      expect(parser.parse("")).toBe("");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("companySize", () => {
    const parser = earlyAccessSearchParams.companySize;

    it("parses string values", () => {
      expect(parser.parse("11-50")).toBe("11-50");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("sources", () => {
    const parser = earlyAccessSearchParams.sources;

    it("parses comma-separated string", () => {
      expect(parser.parse("github,slack")).toBe("github,slack");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("error", () => {
    const parser = earlyAccessSearchParams.error;

    it("parses error messages", () => {
      expect(parser.parse("Something went wrong")).toBe("Something went wrong");
    });

    it("has no default (nullable)", () => {
      expect(parser.defaultValue).toBeUndefined();
    });
  });

  describe("emailError", () => {
    const parser = earlyAccessSearchParams.emailError;

    it("parses validation messages", () => {
      expect(parser.parse("Please enter a valid email")).toBe(
        "Please enter a valid email"
      );
    });

    it("has no default (nullable)", () => {
      expect(parser.defaultValue).toBeUndefined();
    });
  });

  describe("sourcesError", () => {
    const parser = earlyAccessSearchParams.sourcesError;

    it("parses validation messages", () => {
      expect(parser.parse("Please select at least one")).toBe(
        "Please select at least one"
      );
    });

    it("has no default (nullable)", () => {
      expect(parser.defaultValue).toBeUndefined();
    });
  });

  describe("companySizeError", () => {
    const parser = earlyAccessSearchParams.companySizeError;

    it("parses validation messages", () => {
      expect(parser.parse("Company size is required")).toBe(
        "Company size is required"
      );
    });

    it("has no default (nullable)", () => {
      expect(parser.defaultValue).toBeUndefined();
    });
  });

  describe("isRateLimit", () => {
    const parser = earlyAccessSearchParams.isRateLimit;

    it("parses 'true' as true", () => {
      expect(parser.parse("true")).toBe(true);
    });

    it("parses 'false' as false", () => {
      expect(parser.parse("false")).toBe(false);
    });

    it("defaults to false", () => {
      expect(parser.defaultValue).toBe(false);
    });
  });

  describe("success", () => {
    const parser = earlyAccessSearchParams.success;

    it("parses 'true' as true", () => {
      expect(parser.parse("true")).toBe(true);
    });

    it("parses 'false' as false", () => {
      expect(parser.parse("false")).toBe(false);
    });

    it("defaults to false", () => {
      expect(parser.defaultValue).toBe(false);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Unit tests pass: `pnpm --filter @lightfast/auth test src/app/\(app\)/\(early-access\)/_lib/search-params.test.ts`
- [ ] Type checking passes: `pnpm --filter @lightfast/auth typecheck`

#### Manual Verification:
- [x] None required — pure parser logic

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Server Action Unit Tests

### Overview
Test all redirect paths in the `joinEarlyAccessAction` server action. Mock 8 external dependencies following the `(auth)` pattern (mock before dynamic import).

### Changes Required:

#### 1. New file: `_actions/early-access.test.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.test.ts`
**Changes**: New file — mock dependencies, test ~14 redirect paths

The action at `_actions/early-access.ts:74-259` has these redirect paths:
1. **Validation failure** (line 91-103) — field errors with preserved values
2. **Arcjet rate limit** (line 117-127) — `isRateLimit: true`
3. **Arcjet bot** (line 131-133) — generic error
4. **Arcjet shield** (line 134-136) — generic error
5. **Arcjet email** (line 137-144) — disposable email error
6. **Arcjet other** (line 146-153) — generic error
7. **Redis duplicate** (line 162-168) — already registered
8. **Redis error** (line 169-175) — fallthrough (continues to Clerk)
9. **Clerk success** (line 178-199) — `success: true`
10. **Clerk email_address_exists** (line 208-213) — already registered
11. **Clerk 429 / rate limit** (line 216-223) — `isRateLimit: true`
12. **Clerk user_locked with seconds** (line 225-235) — minutes message
13. **Clerk user_locked without seconds** (line 225-235) — generic locked
14. **Clerk other error** (line 237-245) — longMessage or fallback
15. **Non-Clerk error** (line 248-257) — generic error

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (before dynamic import) ──────────────────────────────────

const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

// isRedirectError: detect our mock's REDIRECT throws
vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: (err: unknown) =>
    err instanceof Error && err.message.startsWith("REDIRECT:"),
}));

// next/server: after() runs callback immediately in tests
vi.mock("next/server", () => ({
  after: (fn: () => void) => fn(),
}));

// Arcjet
const mockProtect = vi.fn();
vi.mock("@vendor/security", () => ({
  ARCJET_KEY: "test-key",
  arcjet: () => ({ protect: mockProtect }),
  detectBot: vi.fn(),
  fixedWindow: vi.fn(),
  request: vi.fn(async () => new Request("http://localhost")),
  shield: vi.fn(),
  slidingWindow: vi.fn(),
  validateEmail: vi.fn(),
}));

// Redis
const mockSismember = vi.fn();
const mockSadd = vi.fn();
vi.mock("@vendor/upstash", () => ({
  redis: { sismember: mockSismember, sadd: mockSadd },
}));

// Clerk
const mockWaitlistCreate = vi.fn();
vi.mock("@vendor/clerk/server", () => ({
  clerkClient: async () => ({
    waitlistEntries: { create: mockWaitlistCreate },
  }),
}));

vi.mock("@vendor/clerk", () => ({
  isClerkAPIResponseError: (err: unknown) =>
    err instanceof Error && "errors" in err && "status" in err,
}));

// Sentry
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Env
vi.mock("~/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ── Import after mocks ─────────────────────────────────────────────

const { joinEarlyAccessAction } = await import("./early-access");

// ── Helpers ─────────────────────────────────────────────────────────

function validFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("email", overrides.email ?? "user@example.com");
  fd.set("companySize", overrides.companySize ?? "11-50");
  fd.set("sources", overrides.sources ?? "github,slack");
  return fd;
}

function allowArcjet() {
  mockProtect.mockResolvedValue({
    isDenied: () => false,
  });
}

function denyArcjet(
  reasonType: "isRateLimit" | "isBot" | "isShield" | "isEmail"
) {
  mockProtect.mockResolvedValue({
    isDenied: () => true,
    reason: {
      isRateLimit: () => reasonType === "isRateLimit",
      isBot: () => reasonType === "isBot",
      isShield: () => reasonType === "isShield",
      isEmail: () => reasonType === "isEmail",
    },
  });
}

function clerkAPIError(
  code: string,
  opts: { status?: number; longMessage?: string; meta?: Record<string, unknown> } = {}
) {
  const err = new Error("ClerkAPIError") as Error & {
    errors: { code: string; longMessage?: string; meta?: unknown }[];
    status: number;
  };
  err.errors = [{ code, longMessage: opts.longMessage, meta: opts.meta }];
  err.status = opts.status ?? 422;
  return err;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("joinEarlyAccessAction", () => {
  beforeEach(() => {
    allowArcjet();
    mockSismember.mockResolvedValue(0); // email not in Redis
    mockWaitlistCreate.mockResolvedValue({}); // Clerk success
    mockSadd.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation ──────────────────────────────────────────────────

  it("redirects with emailError on invalid email", async () => {
    const fd = validFormData({ email: "not-an-email" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("emailError=")
    );
  });

  it("redirects with companySizeError on missing companySize", async () => {
    const fd = validFormData({ companySize: "" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("companySizeError=")
    );
  });

  it("redirects with sourcesError on missing sources", async () => {
    const fd = validFormData({ sources: "" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("sourcesError=")
    );
  });

  it("preserves field values in validation error redirect", async () => {
    const fd = validFormData({ email: "not-an-email", companySize: "11-50", sources: "github" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("email=not-an-email");
    expect(url).toContain("companySize=11-50");
    expect(url).toContain("sources=github");
  });

  // ── Arcjet ──────────────────────────────────────────────────────

  it("redirects with isRateLimit on Arcjet rate limit", async () => {
    denyArcjet("isRateLimit");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("isRateLimit=true");
    expect(url).toContain("error=");
  });

  it("redirects with bot error on Arcjet bot detection", async () => {
    denyArcjet("isBot");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with shield error on Arcjet shield", async () => {
    denyArcjet("isShield");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with email error on Arcjet email validation", async () => {
    denyArcjet("isEmail");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  // ── Redis ───────────────────────────────────────────────────────

  it("redirects with already-registered on Redis duplicate", async () => {
    mockSismember.mockResolvedValue(1); // email exists
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
    // Should NOT call Clerk
    expect(mockWaitlistCreate).not.toHaveBeenCalled();
  });

  it("continues to Clerk on Redis error (fallthrough)", async () => {
    mockSismember.mockRejectedValue(new Error("Redis connection error"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    // Should still call Clerk despite Redis failure
    expect(mockWaitlistCreate).toHaveBeenCalled();
    // Should reach success
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("success=true")
    );
  });

  // ── Clerk success ───────────────────────────────────────────────

  it("redirects to success with email on happy path", async () => {
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockWaitlistCreate).toHaveBeenCalledWith({
      emailAddress: "user@example.com",
    });
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("success=true");
    expect(url).toContain("email=user");
  });

  it("calls redis.sadd after Clerk success (via after())", async () => {
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockSadd).toHaveBeenCalledWith("early-access:emails", "user@example.com");
  });

  // ── Clerk errors ────────────────────────────────────────────────

  it("redirects with already-registered on Clerk email_address_exists", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("email_address_exists")
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with isRateLimit on Clerk 429", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("too_many_requests", { status: 429 })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("isRateLimit=true");
  });

  it("redirects with lockout message on Clerk user_locked with seconds", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("user_locked", { meta: { lockout_expires_in_seconds: 300 } })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("5+minutes")  // Math.ceil(300/60) = 5
    );
  });

  it("redirects with generic locked on Clerk user_locked without seconds", async () => {
    mockWaitlistCreate.mockRejectedValue(clerkAPIError("user_locked"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with longMessage on other Clerk errors", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("unknown_code", { longMessage: "Detailed error info" })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockCaptureException).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  // ── Non-Clerk errors ────────────────────────────────────────────

  it("redirects with generic error on non-Clerk errors", async () => {
    mockWaitlistCreate.mockRejectedValue(new Error("Network error"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow("REDIRECT:");
    expect(mockCaptureException).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });
});
```

**Key mock decisions:**
- `isRedirectError` detects our mock's `REDIRECT:` prefix (same pattern as `(auth)` tests)
- `after()` runs callbacks immediately so Redis `sadd` is testable synchronously
- `isClerkAPIResponseError` checks for `errors` + `status` properties (duck-typing, matching `@vendor/clerk` re-export behavior)
- Arcjet mock returns an object with `isDenied()` and `reason` with type-checking methods
- The `clerkAPIError()` helper constructs errors matching the real `ClerkAPIResponseError` shape

### Success Criteria:

#### Automated Verification:
- [x] Unit tests pass: `pnpm --filter @lightfast/auth test src/app/\(app\)/\(early-access\)/_actions/early-access.test.ts`
- [ ] Type checking passes: `pnpm --filter @lightfast/auth typecheck`

#### Manual Verification:
- [x] None required — pure logic testing with mocks

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: E2E URL-Driven State Tests

### Overview
Add Playwright tests that navigate directly to URL states (success, error, rate limit, field errors). No form submission — the URL is the source of truth.

### Changes Required:

#### 1. New file: `e2e/tests/early-access.spec.ts`
**File**: `apps/auth/e2e/tests/early-access.spec.ts`
**Changes**: New file — 7 URL-driven E2E tests

```ts
import { expect, test } from "@playwright/test";

test.describe("Early Access: URL-Driven States", () => {
  test("renders the form on /early-access", async ({ page }) => {
    await page.goto("/early-access");

    await expect(
      page.getByRole("heading", { name: /Join the Early Access/i })
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByText("Company size")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).toBeVisible();
  });

  test("success state shows You're in message", async ({ page }) => {
    await page.goto("/early-access?success=true&email=test%40example.com");

    await expect(page.getByText("You're in!")).toBeVisible();
    await expect(
      page.getByText("Successfully joined early access")
    ).toBeVisible();
    await expect(page.getByText("test@example.com")).toBeVisible();
    // Form should NOT be visible in success state
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).not.toBeVisible();
  });

  test("general error shows red banner with form still visible", async ({
    page,
  }) => {
    await page.goto("/early-access?error=Something+went+wrong");

    await expect(page.getByText("Something went wrong")).toBeVisible();
    // Form should still be visible (user can retry)
    await expect(
      page.getByRole("button", { name: "Get Early Access" })
    ).toBeVisible();
  });

  test("rate limit error shows yellow banner with wait message", async ({
    page,
  }) => {
    await page.goto(
      "/early-access?error=Too+many+signup+attempts&isRateLimit=true"
    );

    await expect(page.getByText("Too many signup attempts")).toBeVisible();
    await expect(
      page.getByText("Please wait a moment before trying again")
    ).toBeVisible();
  });

  test("field errors display below respective fields", async ({ page }) => {
    await page.goto(
      "/early-access?emailError=Please+enter+a+valid+email&email=bad"
    );

    await expect(
      page.getByText("Please enter a valid email")
    ).toBeVisible();
  });

  test("field values are preserved in error state", async ({ page }) => {
    await page.goto(
      "/early-access?email=test%40company.com&companySize=11-50&sourcesError=Please+select+at+least+one"
    );

    // Email input should be pre-filled
    await expect(page.getByLabel("Email address")).toHaveValue(
      "test@company.com"
    );
    await expect(
      page.getByText("Please select at least one")
    ).toBeVisible();
  });

  test("terms and privacy links are present", async ({ page }) => {
    await page.goto("/early-access");

    await expect(
      page.getByRole("link", { name: "Terms and Conditions" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();
  });
});
```

**Key E2E decisions:**
- No `setupClerkTestingToken` needed — these tests don't interact with Clerk FAPI
- No form submission — all state is driven by URL params
- Uses the same Playwright assertions pattern as `e2e/tests/error-states.spec.ts`
- Tests verify both positive (content visible) and negative (form hidden in success state) assertions

### Success Criteria:

#### Automated Verification:
- [x] E2E tests pass: `pnpm --filter @lightfast/auth exec playwright test e2e/tests/early-access.spec.ts`
- [ ] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [ ] Navigate to `/early-access` manually and verify the form renders correctly
- [ ] Navigate to `/early-access?success=true&email=test@example.com` and verify confetti + success message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests (Vitest):
- Search params: test `.parse()`, `.serialize()`, `.defaultValue` on each parser
- Server action: mock-then-dynamic-import pattern, assert redirect URLs contain expected params
- No component tests — server components are covered by E2E, client islands have minimal logic

### E2E Tests (Playwright):
- URL-driven state tests only — navigate to pre-built URLs and assert DOM content
- No form submission E2E (covered by action unit tests)
- No Clerk testing token needed (no FAPI interaction)

### Test Value Distribution:
| Test | Value | Complexity |
|------|-------|------------|
| Search params unit | Low (simple parsers) | Trivial |
| Action unit | **High** (14 redirect paths, 3 external services) | Medium (mocking) |
| E2E URL-driven | **High** (validates SSR rendering of all states) | Low (no mocking) |

## References

- Research document: `thoughts/shared/research/2026-03-09-auth-early-access-architecture-and-testing.md`
- Auth search params test pattern: `apps/auth/src/app/(app)/(auth)/_lib/search-params.test.ts:1-68`
- Auth action test pattern: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts:1-58`
- Auth E2E error states: `apps/auth/e2e/tests/error-states.spec.ts:1-82`
- Early-access action: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts:74-259`
- Early-access search params: `apps/auth/src/app/(app)/(early-access)/_lib/search-params.ts:1-27`
- Vitest config: `apps/auth/vitest.config.ts:1-13`
- Playwright config: `apps/auth/playwright.config.ts:1-44`
