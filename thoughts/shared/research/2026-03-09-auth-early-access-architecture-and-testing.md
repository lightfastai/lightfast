---
date: 2026-03-09T00:00:00+11:00
researcher: claude
git_commit: adfc038e7955ed53b448e31f6f2ddc261b8c1173
branch: refactor/move-early-access-to-auth
repository: lightfast
topic: "(auth) vs (early-access) architecture: pattern alignment + full testing strategy"
tags: [research, codebase, auth, early-access, nuqs, testing, vitest, playwright, e2e]
status: complete
last_updated: 2026-03-09
last_updated_note: "Added: replace handleClerkError with Clerk SDK v3; adopt nuqs createSerializer for type-safe redirect URLs"
---

# Research: (auth) vs (early-access) Architecture + Testing Strategy

**Date**: 2026-03-09
**Git Commit**: `adfc038e7955ed53b448e31f6f2ddc261b8c1173`
**Branch**: `refactor/move-early-access-to-auth`

## Research Question

Deep research into the `(auth)` flow and components to understand the mature architecture pattern, then discuss two areas:
1. What `(early-access)` needs to adopt from `(auth)` (layout, error boundary, nuqs tightening)
2. Full unit + E2E testing strategy for `(early-access)`

---

## Summary

`(auth)` is the mature SSR pattern for the auth app. `(early-access)` was recently SSR-converted (from react-hook-form) following the same direction, but it hasn't fully adopted the structural conventions — it's missing `layout.tsx`, `error.tsx`, a dedicated error component, and all tests. The gaps are well-defined and direct to close.

---

## Part 1: The (auth) Pattern — Complete Documentation

### File Structure

```
apps/auth/src/app/(app)/(auth)/
├── layout.tsx                         # Shared page chrome for all auth routes
├── error.tsx                          # Next.js route-group error boundary
├── sign-in/
│   ├── page.tsx
│   └── sso-callback/page.tsx
├── sign-up/
│   ├── page.tsx
│   └── sso-callback/page.tsx
├── _actions/
│   ├── sign-in.ts                     # Server action: validate → redirect
│   ├── sign-in.test.ts                # Unit tests for action redirect paths
│   ├── sign-up.ts
│   └── sign-up.test.ts
├── _components/
│   ├── email-form.tsx                 # Pure server component (no "use client")
│   ├── error-banner.tsx               # URL-error display component
│   ├── oauth-button.tsx               # Client island
│   ├── otp-island.tsx                 # Client island (Clerk FAPI)
│   ├── separator-with-text.tsx        # Server component
│   ├── session-activator.tsx          # Client island (token → session)
│   └── shared/
│       └── code-verification-ui.tsx   # Pure presentational UI (client)
└── _lib/
    ├── search-params.ts               # nuqs param definitions + loaders
    └── search-params.test.ts          # Unit tests for each parser
```

### Layout (`layout.tsx:1-57`)

The layout wraps ALL auth routes (sign-in, sign-up, sso-callback). Key structure:

```tsx
// Guards: redirect signed-in users away before rendering any child
<Show when="signed-out"><RedirectToTasks /></Show>

// Page chrome
<div className="flex min-h-screen flex-col bg-background">
  <header>  {/* fixed top navbar: logo left, "Join Early Access" CTA right */}
  <div aria-hidden className="h-16 shrink-0 md:h-20" />  {/* spacer for fixed header */}
  <main className="flex flex-1 items-center justify-center p-4">
    <div className="w-full max-w-xs">{children}</div>   {/* content width: xs */}
  </main>
  <div aria-hidden className="h-16 shrink-0 md:h-20" />  {/* bottom spacer = top spacer = perfect centering */}
</div>
```

The symmetrical spacers (`h-16 md:h-20`) mirror the fixed header height so the main content is visually centered when accounting for the header.

### Error Boundary (`error.tsx:1-57`)

Next.js route-group-level error boundary — catches any throw within the `(auth)` route group. Notable:

- `"use client"` required (Next.js error boundaries are always client components)
- Captures every error to Sentry with `tags: { location: "auth-routes" }` and `extra: { errorDigest }`
- Renders `LightfastErrorPage` with `ErrorCode.InternalServerError`
- Two action buttons: "Try again" (`reset()`) and "Back to Sign In" (hard link)
- Uses `useEffect([error])` so Sentry capture happens once per error instance

```tsx
// apps/auth/src/app/(app)/(auth)/error.tsx:18-57
export default function AuthError({ error, reset }: AuthErrorProps) {
  useEffect(() => {
    captureException(error, { tags: { location: "auth-routes" }, extra: { errorDigest: error.digest } });
    console.error("Auth route error:", error);
  }, [error]);
  return (
    <LightfastCustomGridBackground.Root ...>
      <LightfastErrorPage code={ErrorCode.InternalServerError} ...>
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild><Link href="/sign-in">Back to Sign In</Link></Button>
      </LightfastErrorPage>
    </LightfastCustomGridBackground.Root>
  );
}
```

### Search Params (`_lib/search-params.ts:1-24`)

Two separate param sets, one per page. Key conventions:

1. **Steps use `parseAsStringLiteral`** — typed tuple → only valid values parse, invalid returns `null`
2. **Freeform strings use `parseAsString`** — no `.withDefault()` means absent = `null`
3. **Named loaders exported** — `loadSignInSearchParams`, `loadSignUpSearchParams`
4. **No inline comments** — self-documenting field names

```ts
const signInSteps = ["email", "code", "activate"] as const;

export const signInSearchParams = {
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
```

**Critical**: Pages use `Promise<SearchParams>` from `nuqs/server`, not the raw Next.js `Record<string, string | string[] | undefined>` type. The `loadXSearchParams(searchParams)` call handles the promise.

```tsx
// apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:36
interface PageProps { searchParams: Promise<SearchParams>; }
```

### Search Params Unit Tests (`_lib/search-params.test.ts:1-68`)

Every parser is tested individually. Pattern: call `.parse()` and `.serialize()` and `.defaultValue` directly on the parser object — no `createLoader`, no URL construction.

```ts
describe("signInSearchParams.step", () => {
  const parser = signInSearchParams.step;
  it("parses valid step values", () => { ... });
  it("rejects invalid step values", () => { expect(parser.parse("invalid")).toBe(null); });
  it("defaults to email", () => { expect(parser.defaultValue).toBe("email"); });
});
```

### Actions Pattern (`_actions/sign-in.ts`, `sign-up.ts`)

Minimal server actions — validate → redirect, nothing more:

```ts
"use server";
export async function initiateSignIn(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }
  redirect(`/sign-in?step=code&email=${encodeURIComponent(parsed.data.email)}`);
}
```

No try/catch needed because these actions only do validation (no external calls). The action's only job is to validate and encode state into the URL.

### Action Unit Tests Pattern

Mock `next/navigation` so `redirect()` throws an interceptable error:

```ts
vi.mock("next/navigation", () => ({
  redirect: (...args) => mockRedirect(...args),  // mockRedirect throws `new Error(`REDIRECT:${url}`)
}));

it("redirects to step=code", async () => {
  formData.set("email", "user@example.com");
  await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
  expect(mockRedirect).toHaveBeenCalledWith("/sign-in?step=code&email=user%40example.com");
});
```

Key insight: `import after mocks` — use top-level `await import("./sign-in")` after `vi.mock` to get the server action with the mock applied.

### ErrorBanner Component (`_components/error-banner.tsx:1-43`)

Dedicated component for URL-driven inline error display. Two render paths:

```tsx
// isWaitlist=true: shows CTA + back button
// isWaitlist=false (default): shows red banner + "Try again" back link

interface ErrorBannerProps {
  backUrl: string;
  isWaitlist: boolean;
  message: string;
}
```

No `"use client"` — pure server component. The `backUrl` is passed from the page (e.g., `/sign-in` or `/sign-up?__clerk_ticket=...`) so the back link resets the error without losing ticket state.

### Pages Pattern

Pages are pure async server components:

```tsx
export default async function SignInPage({ searchParams }: PageProps) {
  const { step, email, error, token, waitlist } = await loadSignInSearchParams(searchParams);

  return (
    <div className="w-full space-y-8">
      {step === "email" && !error && <Header />}
      <div className="space-y-4">
        {error && <ErrorBanner message={error} isWaitlist={waitlist === "true"} backUrl="/sign-in" />}
        {!error && step === "email" && <><EmailForm /><SeparatorWithText /><OAuthButton /></>}
        {!error && step === "code" && email && <OTPIsland email={email} mode="sign-in" />}
        {step === "activate" && token && <SessionActivator token={token} />}
      </div>
    </div>
  );
}
```

Three guard levels:
1. `{error && ...}` — show error exclusively
2. `{!error && step === "X" && ...}` — show step content only when no error
3. `{!error && step === "X" && requiredParam && ...}` — guard required params (email, token)

### Islands Pattern

Client interactivity is isolated to named islands. Two tiers:
- **Logic islands** (`OTPIsland`, `OAuthButton`, `SessionActivator`) — own their state + Clerk FAPI calls
- **Presentation layer** (`CodeVerificationUI`) — pure UI, all state passed as props

This separation allows `CodeVerificationUI` to be tested/rendered independently without mocking Clerk.

### E2E Setup

```
apps/auth/e2e/
├── global.setup.ts          # clerkSetup() only
└── tests/
    ├── sign-in-email.spec.ts
    ├── sign-up-email.spec.ts
    ├── error-states.spec.ts  # URL-driven error state tests (no form submission needed)
    ├── redirects.spec.ts     # Middleware redirect assertions
    └── edge-cases.spec.ts    # URL param edge cases (?step=activate with/without token)
```

**Clerk test account convention** (`apps/auth/CLAUDE.md`):
- Email: `some-email+clerk_test@lightfast.ai`
- OTP: `424242`

**Per-test pattern**:
```ts
test("...", async ({ page }) => {
  await setupClerkTestingToken({ page });  // required for Clerk FAPI calls
  await page.goto("/sign-in");
  // ...
});
```

**Error state testing** (no server action needed — direct URL navigation):
```ts
test("error param displays error banner", async ({ page }) => {
  await page.goto("/sign-in?error=Something+went+wrong");
  await expect(page.getByText("Something went wrong")).toBeVisible();
});
```

---

## Part 2: (early-access) Current State

### File Structure

```
apps/auth/src/app/(app)/(early-access)/
├── early-access/
│   └── page.tsx                         # Main page (no layout.tsx)
├── _actions/
│   └── early-access.ts                  # Complex server action (Arcjet+Redis+Clerk)
├── _components/
│   ├── company-size-island.tsx           # Client: shadcn Select + hidden input
│   ├── confetti-wrapper.tsx              # Client: success animation portal
│   ├── early-access-form-server.tsx      # Server: form component with 3 islands
│   ├── sources-island.tsx                # Client: Popover+Command multi-select
│   └── submit-button.tsx                 # Client: useFormStatus pending state
└── _lib/
    ├── search-params.ts                  # nuqs params (with inline comments)
    └── clerk-error-handler.ts            # Standalone Clerk error utility
```

**Key difference**: The page is at `early-access/page.tsx` not `page.tsx`. The `(early-access)` group is a routing container only; the actual URL is `/early-access`.

### What's Already Done vs (auth)

| Pattern | (auth) | (early-access) | Status |
|---------|--------|----------------|--------|
| SSR server action | ✅ | ✅ | Done — SSR conversion complete |
| nuqs search params | ✅ | ✅ | Done — `loadEarlyAccessSearchParams` |
| Islands pattern | ✅ | ✅ | Done — 3 client islands |
| `layout.tsx` | ✅ | ❌ | Missing |
| `error.tsx` | ✅ | ❌ | Missing |
| `ErrorBanner` / error component | ✅ | ❌ | Inline in page.tsx |
| `SearchParams` type for page | ✅ | ❌ | Raw `Record<string, ...>` |
| Search params unit tests | ✅ | ❌ | Missing |
| Action unit tests | ✅ | ❌ | Missing |
| `clerk-error-handler` unit tests | N/A | ❌ | Missing (pure logic, no mocks) |
| E2E tests | ✅ (5 files) | ❌ | Missing |

### (early-access) Search Params vs (auth) Differences

`_lib/search-params.ts`:

```ts
// early-access — uses parseAsBoolean, more params, withDefault on string fields, inline comments
export const earlyAccessSearchParams = {
  email: parseAsString.withDefault(""),        // (auth) has no .withDefault for strings)
  companySize: parseAsString.withDefault(""),
  sources: parseAsString.withDefault(""),      // comma-separated
  error: parseAsString,
  emailError: parseAsString,
  sourcesError: parseAsString,
  companySizeError: parseAsString,
  isRateLimit: parseAsBoolean.withDefault(false),  // (auth) uses parseAsString for waitlist
  success: parseAsBoolean.withDefault(false),       // (auth) has no success state — redirects to console
};
```

Differences:
1. **`parseAsBoolean`** — not used in `(auth)`. Used here for `isRateLimit` and `success`. Reasonable.
2. **`.withDefault("")` on string fields** — `(auth)` uses bare `parseAsString` (null when absent). Both are valid; `withDefault("")` avoids null checks.
3. **Inline comments** — `(auth)` has none. Comments here explain non-obvious semantics (comma-separated).
4. **`searchParams` type in page.tsx** — currently `Record<string, string | string[] | undefined>`, should be `Promise<SearchParams>` from `nuqs/server`.

### (early-access) Action Complexity

The early-access action (`_actions/early-access.ts`) is structurally more complex than sign-in/sign-up because it calls three external services:

```
FormData → zod validation → Arcjet (4 rules) → Redis (duplicate check) → Clerk waitlist API → after() redis.sadd → redirect(success)
```

Each layer has its own error path. The action uses `isRedirectError()` from `next/dist/client/components/redirect-error` to distinguish Next.js redirect throws from actual errors — this is the correct pattern.

The `buildEarlyAccessUrl()` helper (`_actions/early-access.ts:35-45`) is private to the action file. It builds the redirect URL from a record, filtering out `undefined`/`""`/`false` values.

### (early-access) Inline Error Display (vs ErrorBanner)

Current page.tsx renders errors inline with raw Tailwind:

```tsx
{error && (
  <div className={`rounded-lg border p-3 ${
    isRateLimit
      ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
  }`}>
    <p className={`text-sm ${isRateLimit ? "text-yellow-800 ..." : "text-red-800 ..."}`}>
      {error}
    </p>
  </div>
  {isRateLimit && <p>Please wait a moment...</p>}
)}
```

This has three modes that `(auth)`'s `ErrorBanner` doesn't cover: rate-limit (yellow), general error (red), field-level errors (per-field below each input). The field-level errors are already handled inside `EarlyAccessFormServer` and the islands.

---

## Discussion: Part 1 — Closing the Pattern Gaps

### Gap 1: `layout.tsx`

Early-access page inlines its own full layout. Extracting a `layout.tsx` at `(early-access)/layout.tsx` would:
- Remove the `flex min-h-screen flex-col bg-background` wrapper from `page.tsx`
- Provide a standard place to add shared chrome (logo header) if needed

**Key difference vs auth layout**: Early-access does NOT need:
- `<Show when="signed-out"><RedirectToTasks /></Show>` — it's a public route; signed-in users CAN join waitlist
- "Join the Early Access" CTA in header — they're already on the page

The minimal early-access layout would be the centering structure only:
```tsx
// (early-access)/layout.tsx — no auth guard, just page chrome
export default function EarlyAccessLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </div>
  );
}
```

The logo block (`Icons.logoShort` in the card) stays in `page.tsx` because it's content-level (part of the form card), not chrome.

### Gap 2: `error.tsx`

Direct port of `(auth)/error.tsx` with one change: button says "Back to Early Access" instead of "Back to Sign In".

```tsx
// (early-access)/error.tsx
export default function EarlyAccessError({ error, reset }) {
  useEffect(() => {
    captureException(error, { tags: { location: "early-access-route" } });
  }, [error]);
  return (
    <LightfastCustomGridBackground.Root ...>
      <LightfastErrorPage code={ErrorCode.InternalServerError} ...>
        <Button onClick={reset}>Try again</Button>
        <Button asChild><Link href="/early-access">Back to Early Access</Link></Button>
      </LightfastErrorPage>
    </LightfastCustomGridBackground.Root>
  );
}
```

### Gap 3: Error Component Extraction

The inline error in `page.tsx` could become an `EarlyAccessErrorBanner` component (or reuse a shared `ErrorBanner` pattern). However, early-access errors are semantically different from auth errors:
- **Rate limit** (yellow) — `(auth)` doesn't have this visual distinction
- **General error** (red) — same as auth
- **No "Join Waitlist" CTA** — already on the page

The simplest approach is a small local `_components/error-banner.tsx` within `(early-access)` rather than sharing with `(auth)`.

### Gap 4: nuqs Type Tightening

Two changes:
1. Page `searchParams` type: `Record<string, string | string[] | undefined>` → `Promise<SearchParams>` (import from `nuqs/server`)
2. `loadEarlyAccessSearchParams(searchParams)` already handles this; only the TypeScript annotation needs updating

No behavioral change, just type safety and convention alignment.

---

## Discussion: Part 2 — Testing Strategy for (early-access)

### Tier 1: Unit Tests (Vitest)

Vitest config is at `apps/auth/vitest.config.ts` — extends `vitest.shared.ts` (threads pool, max 2 threads, no file parallelism). Tests must be `.test.ts` files in `src/**/*.test.ts`.

#### 1. `_lib/search-params.test.ts`

Port the same pattern from `(auth)/_lib/search-params.test.ts`. Test each parser directly:

```ts
describe("earlyAccessSearchParams", () => {
  describe("isRateLimit", () => {
    const parser = earlyAccessSearchParams.isRateLimit;
    it("parses 'true' as true", () => expect(parser.parse("true")).toBe(true));
    it("parses 'false' as false", () => expect(parser.parse("false")).toBe(false));
    it("defaults to false", () => expect(parser.defaultValue).toBe(false));
  });
  describe("success", () => { /* same */ });
  describe("email", () => {
    const parser = earlyAccessSearchParams.email;
    it("parses string values", () => expect(parser.parse("test@example.com")).toBe("test@example.com"));
    it("defaults to empty string", () => expect(parser.defaultValue).toBe(""));
  });
  // sources, companySize, error, emailError, etc.
});
```

#### 2. `_lib/clerk-error-handler.test.ts`

Pure logic — no mocks needed. Test each ClerkErrorCode branch:

```ts
describe("handleClerkError", () => {
  it("returns isAlreadyExists for email_address_exists code", () => {
    const result = handleClerkError(
      { errors: [{ code: "email_address_exists", message: "exists", long_message: "already exists" }] },
      { action: "test" }
    );
    expect(result.isAlreadyExists).toBe(true);
    expect(result.shouldLog).toBe(false);
  });
  it("returns isRateLimit for rate_limit_exceeded", () => { ... });
  it("returns isUserLocked for user_locked with retryAfterSeconds", () => { ... });
  it("handles httpStatus 429 even without error body", () => { ... });
  it("handles Backend API format (code + shortMessage)", () => { ... });
  it("handles SDK format (errors array)", () => { ... });
  it("handles non-object errorData gracefully", () => { ... });
});
```

This is the highest-value test: 12+ error code branches, two input formats (SDK/Backend), HTTP status-based detection — currently zero coverage.

#### 3. `_actions/early-access.test.ts`

More complex than sign-in/sign-up actions because there are external calls. Mocks needed:
- `next/navigation` (redirect)
- `@vendor/security` (arcjet, request)
- `@vendor/upstash` (redis)
- `fetch` (Clerk waitlist API)
- `@sentry/nextjs` (captureException)

```ts
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@vendor/security", () => ({
  arcjet: vi.fn(() => ({ protect: vi.fn() })),
  request: vi.fn(),
  // ... other named exports
}));
vi.mock("@vendor/upstash", () => ({ redis: { sismember: vi.fn(), sadd: vi.fn() } }));
global.fetch = vi.fn();

describe("joinEarlyAccessAction", () => {
  it("redirects with field errors on invalid email", async () => {
    formData.set("email", "not-an-email");
    await expect(joinEarlyAccessAction(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining("emailError="));
  });
  it("redirects with field errors on missing companySize", async () => { ... });
  it("redirects with field errors on missing sources", async () => { ... });
  it("preserves field values in validation error redirect", async () => {
    // email should appear in redirect URL even when invalid
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining("email=not-an-email"));
  });
  it("redirects with isRateLimit on Arcjet rate limit decision", async () => { ... });
  it("redirects with error on already-registered email (Redis)", async () => { ... });
  it("redirects with error on already-registered email (Clerk API)", async () => { ... });
  it("redirects to success with email on happy path", async () => { ... });
  it("re-throws NEXT_REDIRECT errors", async () => { ... });
});
```

**Note on mocking `@vendor/security`**: The Arcjet config (`aj.protect()`) is called with the request. Mock `request()` to return a fake request object, and mock `aj.protect()` to return `{ isDenied: () => false }` for the happy path.

### Tier 2: E2E Tests (Playwright)

Strategy: **mock at the boundary using MSW** (Mock Service Worker). This means:
- The Playwright browser makes real HTTP requests to the Next.js dev server
- The Next.js dev server's fetch calls to Clerk waitlist API are intercepted by MSW
- Arcjet and Redis calls need separate handling

**Alternative for URL-param states**: Like `error-states.spec.ts` in `(auth)`, navigate directly to `?error=...&isRateLimit=true` etc. — no form submission needed. This covers ~80% of the test value.

#### File: `e2e/tests/early-access.spec.ts` (URL-driven states — no server action needed)

```ts
test.describe("Early Access: URL-Driven States", () => {
  test("renders the form on /early-access", async ({ page }) => {
    await page.goto("/early-access");
    await expect(page.getByRole("heading", { name: /Join the Early Access/i })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByText("Company size")).toBeVisible();
    await expect(page.getByText("Tools your team uses")).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Early Access" })).toBeVisible();
  });

  test("success state shows confetti and You're in message", async ({ page }) => {
    await page.goto("/early-access?success=true&email=test%40example.com");
    await expect(page.getByText("You're in!")).toBeVisible();
    await expect(page.getByText("Successfully joined early access")).toBeVisible();
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  test("general error shows red banner", async ({ page }) => {
    await page.goto("/early-access?error=Something+went+wrong");
    await expect(page.getByText("Something went wrong")).toBeVisible();
    // Form should still be visible (not hidden on error unlike auth)
    await expect(page.getByRole("button", { name: "Get Early Access" })).toBeVisible();
  });

  test("rate limit error shows yellow banner with message", async ({ page }) => {
    await page.goto("/early-access?error=Too+many+signup+attempts&isRateLimit=true");
    await expect(page.getByText("Too many signup attempts")).toBeVisible();
    await expect(page.getByText("Please wait a moment before trying again")).toBeVisible();
  });

  test("field errors show below respective fields", async ({ page }) => {
    await page.goto("/early-access?emailError=Please+enter+a+valid+email&email=bad");
    await expect(page.getByText("Please enter a valid email")).toBeVisible();
    // Email input should be pre-filled
    await expect(page.getByDisplayValue("bad")).toBeVisible();
  });

  test("field values are preserved in error state", async ({ page }) => {
    await page.goto("/early-access?email=test%40company.com&companySize=11-50&sourcesError=Please+select+at+least+one");
    await expect(page.getByDisplayValue("test@company.com")).toBeVisible();
    await expect(page.getByText("Please select at least one")).toBeVisible();
  });

  test("terms and privacy links are present", async ({ page }) => {
    await page.goto("/early-access");
    await expect(page.getByRole("link", { name: "Terms and Conditions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  });
});
```

#### File: `e2e/tests/early-access-submission.spec.ts` (form submission — with boundary mocking)

For submission tests, two approaches to mock the Clerk API call:

**Option A: MSW via Next.js middleware handler** — register an MSW server in the Next.js dev server process that intercepts `fetch("https://api.clerk.com/v1/waitlist_entries")`. Requires adding `msw` to auth app and a test fixture setup.

**Option B: Environment variable bypass** — add a `SKIP_EARLY_ACCESS_EXTERNAL_CALLS=true` env flag to the action that returns a fake success/error response. Simpler but couples test code to production code.

**Option C: Playwright `page.route()`** — intercept outbound requests at the browser level. However, the Clerk API call is made server-side (in the Next.js server action), not from the browser — so `page.route()` cannot intercept it.

**Recommended: MSW server-side** — cleanest isolation without coupling prod code to test flags.

```ts
// With MSW setup, submission tests would look like:
test("valid submission completes with success screen", async ({ page }) => {
  // MSW returns 200 from fake Clerk API
  // Arcjet mocked to ALLOW in test environment
  // Redis mock returns 0 (email not exists)
  await page.goto("/early-access");
  await page.getByLabel("Email address").fill(`test-${Date.now()}+clerk_test@lightfast.ai`);
  // Select company size
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "1-10 employees" }).click();
  // Select sources
  await page.getByRole("combobox", { name: /Select tools/ }).click(); // approximate
  await page.getByRole("option", { name: "GitHub" }).click();
  await page.keyboard.press("Escape");
  // Submit
  await page.getByRole("button", { name: "Get Early Access" }).click();
  // Should land on success screen
  await expect(page.getByText("You're in!")).toBeVisible({ timeout: 15_000 });
});

test("validation errors appear on empty submission", async ({ page }) => {
  await page.goto("/early-access");
  await page.getByRole("button", { name: "Get Early Access" }).click();
  // Server validates and redirects back with errors
  await expect(page.getByText("Email is required")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Company size is required")).toBeVisible();
  await expect(page.getByText("Please select at least one data source")).toBeVisible();
});
```

---

## Architecture Pattern: Standard Form Flow

Based on both codebases, the standard architecture for a "one-time form + nuqs + testing" in this app is:

```
(route-group)/
├── layout.tsx           # Page chrome (centering structure, optional auth guard)
├── error.tsx            # Sentry-capturing Next.js error boundary
├── page/page.tsx        # Async server component, loads params via createLoader
├── _lib/
│   ├── search-params.ts  # nuqs param definitions + createLoader export
│   └── search-params.test.ts  # Parser unit tests (parse/serialize/default)
├── _actions/
│   ├── <action>.ts      # "use server": validate → redirect on every path
│   └── <action>.test.ts # Mock next/navigation, assert redirect URLs
└── _components/
    ├── <form>-server.tsx # Server form component (no "use client")
    ├── <field>-island.tsx # Client islands for interactive fields
    ├── error-banner.tsx  # URL-error display (optional: shared or local)
    └── submit-button.tsx # "use client" useFormStatus pending
```

---

## Code References

- `apps/auth/src/app/(app)/(auth)/layout.tsx:1-57` — shared chrome pattern
- `apps/auth/src/app/(app)/(auth)/error.tsx:1-57` — Sentry error boundary
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:1-24` — typed nuqs params
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.test.ts:1-68` — parser unit test pattern
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts:1-22` — minimal action pattern
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts:1-58` — action unit test pattern
- `apps/auth/src/app/(app)/(auth)/_components/error-banner.tsx:1-43` — error display component
- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:1-84` — step-based page pattern
- `apps/auth/src/app/(app)/(early-access)/early-access/page.tsx:1-130` — current page (inline layout, inline errors)
- `apps/auth/src/app/(app)/(early-access)/_lib/search-params.ts:1-22` — current params
- `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts:1-357` — complex action
- `apps/auth/src/app/(app)/(early-access)/_lib/clerk-error-handler.ts:1-304` — 12+ error code handler
- `apps/auth/e2e/tests/error-states.spec.ts:1-82` — URL-param E2E test pattern
- `apps/auth/e2e/tests/sign-in-email.spec.ts:1-132` — full flow E2E pattern
- `apps/auth/playwright.config.ts:1-44` — Playwright config (PORT 4104, global.setup.ts)
- `apps/auth/vitest.config.ts:1-13` — Vitest config (node env, src/**/*.test.ts)

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-03-09-move-early-access-to-auth.md` — Phase 1-4 plan for moving early-access from www to auth (complete). Documents why react-hook-form was removed, the colocated file structure, and microfrontends routing update.
- `thoughts/shared/plans/2026-03-09-early-access-ssr-conversion.md` — Detailed plan for converting from react-hook-form + useActionState to SSR redirect pattern. Contains the exact island API designs that were implemented. Phases 1-3 are complete.
- `thoughts/shared/plans/2026-03-09-auth-early-access-public-route.md` — Plan for making `/early-access` a public middleware route.

## Follow-up Finding: Replacing handleClerkError with Clerk SDK v3 Pattern

### The Problem

`_lib/clerk-error-handler.ts` (304 lines) exists because the current action calls Clerk's REST API directly via `fetch`:

```ts
// _actions/early-access.ts:207-228 — raw fetch to Clerk API
const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, ... },
  body: JSON.stringify({ email_address: email, public_metadata: { companySize, sources } }),
});
if (!response.ok) {
  const errorData = await response.json();
  const errorResult = handleClerkError(errorData, { action: "...", httpStatus: response.status });
  // 12+ if/else branches on errorResult flags
}
```

This required a custom 304-line error normalizer to handle both SDK error format (`{ errors: [...] }`) and Backend API format (`{ code, shortMessage, longMessage }`).

### The SDK Solution

`@clerk/backend` v2.31.0 has `WaitlistEntryAPI.create()` available via `clerkClient()`:

```ts
// factory.d.ts:38
waitlistEntries: WaitlistEntryAPI;

// WaitlistEntryApi.d.ts:37
create(params: WaitlistEntryCreateParams): Promise<WaitlistEntry>;
// WaitlistEntryCreateParams = { emailAddress: string; notify?: boolean; }
```

The Backend SDK throws `ClerkAPIResponseError` on failures. The codebase already uses this pattern in `apps/console/src/app/lib/clerk/error-handling.ts` via `isClerkAPIResponseError` from `@vendor/clerk`.

### Replacement Pattern

```ts
import { clerkClient } from "@vendor/clerk/server";
import { isClerkAPIResponseError } from "@vendor/clerk";

// Replace the fetch + handleClerkError block with:
try {
  await (await clerkClient()).waitlistEntries.create({ emailAddress: email });
} catch (err) {
  if (isRedirectError(err)) throw err;

  if (isClerkAPIResponseError(err)) {
    const code = err.errors[0]?.code;

    if (code === "email_address_exists" || code === "form_identifier_exists") {
      redirect(buildEarlyAccessUrl({ error: "This email is already registered for early access!" }));
    }
    if (err.status === 429 || code === "too_many_requests" || code === "rate_limit_exceeded") {
      redirect(buildEarlyAccessUrl({
        error: "Too many signup attempts. Please try again later.",
        isRateLimit: true, email, companySize, sources: sourcesStr,
      }));
    }
    if (code === "user_locked") {
      const seconds = (err.errors[0]?.meta as any)?.lockout_expires_in_seconds;
      redirect(buildEarlyAccessUrl({
        error: seconds ? `Account locked. Try again in ${Math.ceil(seconds / 60)} minutes.` : "Account locked.",
        email, companySize, sources: sourcesStr,
      }));
    }
    // All other Clerk errors: log + generic message
    captureException(err, { tags: { action: "joinEarlyAccess:clerk" } });
    redirect(buildEarlyAccessUrl({ error: err.errors[0]?.longMessage ?? "An unexpected error occurred.", email, companySize, sources: sourcesStr }));
  }

  // Non-Clerk errors
  captureException(err, { tags: { action: "joinEarlyAccess:unexpected" } });
  redirect(buildEarlyAccessUrl({ error: "An unexpected error occurred. Please try again." }));
}
```

### Trade-off: public_metadata

`WaitlistEntryCreateParams` only accepts `{ emailAddress, notify? }`. The current raw fetch sends `public_metadata: { companySize, sources, submittedAt }` as Clerk waitlist entry metadata. The SDK does not expose this parameter.

Options:
1. **Drop metadata** — companySize/sources still exist in Redis (email stored in `early-access:emails` set) but not in Clerk dashboard. Acceptable if Clerk dashboard metadata is not actively used.
2. **Retain raw fetch for metadata** — keep the `fetch` call but simplify error handling to `isClerkAPIResponseError`-style inline checks.
3. **Store metadata in Redis separately** — add a Redis hash `early-access:metadata:{email}` after the Clerk call succeeds.

The cleanest path is option 1 if the metadata in Clerk is not used — the SDK-based approach eliminates `handleClerkError` and `env.CLERK_SECRET_KEY` from the action (clerkClient handles auth internally).

### Impact on Unit Tests

Replacing raw `fetch` + `handleClerkError` with `clerkClient().waitlistEntries.create()`:
- **Removes**: `_lib/clerk-error-handler.test.ts` (no longer needed — pure SDK throws typed errors)
- **Simplifies**: `_actions/early-access.test.ts` — mock `clerkClient` instead of `fetch` + custom error structure
- **Adds**: standard Clerk SDK mock pattern used across the console app

## Follow-up Finding: nuqs `createSerializer` for Type-Safe Redirect URLs

### Source

[nuqs Utilities docs](https://nuqs.dev/docs/utilities) — `createSerializer` (available since v1.16.0)

### What It Does

`createSerializer` generates a function that serializes state values into query strings, matching the same parser definitions used by `createLoader`. It handles:
- **Type-safe params** — only accepts keys defined in the parser schema
- **Automatic encoding** — handles `encodeURIComponent` internally
- **Null omission** — `null` values are excluded from the output
- **Base URL support** — can append to existing URL paths: `serialize("/path", { key: "value" })`

```ts
import { createSerializer } from "nuqs/server";

const serialize = createSerializer({
  step: parseAsStringLiteral(["email", "code"]).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
});

serialize("/sign-in", { step: "code", email: "user@example.com" });
// → "/sign-in?step=code&email=user%40example.com"

serialize("/sign-in", { error: "Invalid email", step: null });
// → "/sign-in?error=Invalid+email"  (step omitted because null)
```

### Impact on Both Route Groups

#### Standard `_lib/search-params.ts` Pattern

Each search-params file becomes a **single source of truth** for both reading and writing URL state:

```ts
import { createLoader, createSerializer, parseAsString, parseAsBoolean } from "nuqs/server";

export const earlyAccessSearchParams = {
  email: parseAsString.withDefault(""),
  error: parseAsString,
  success: parseAsBoolean.withDefault(false),
  // ...
};

// Reading (pages) — already exists
export const loadEarlyAccessSearchParams = createLoader(earlyAccessSearchParams);

// Writing (actions) — NEW
export const serializeEarlyAccessParams = createSerializer(earlyAccessSearchParams);
```

#### (early-access) — Replaces `buildEarlyAccessUrl`

**Before** (`_actions/early-access.ts:35-45`):
```ts
function buildEarlyAccessUrl(params: Record<string, string | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      searchParams.set(key, String(value));
    }
  }
  return `/early-access?${searchParams.toString()}`;
}

// Usage: redirect(buildEarlyAccessUrl({ error: "...", email, isRateLimit: true }));
```

**After**:
```ts
import { serializeEarlyAccessParams } from "../_lib/search-params";

// Type-safe, encoding handled, nulls omitted automatically
redirect(serializeEarlyAccessParams("/early-access", { error: "...", email, isRateLimit: true }));
redirect(serializeEarlyAccessParams("/early-access", { success: true, email }));
redirect(serializeEarlyAccessParams("/early-access", {
  emailError: fieldErrors.email?.[0],
  email: rawEmail,
  companySize: rawCompanySize,
  sources: rawSources,
}));
```

#### (auth) — Replaces Manual Template Literals

**Before** (`_actions/sign-in.ts:17,21`):
```ts
redirect(`/sign-in?error=${encodeURIComponent(message)}`);
redirect(`/sign-in?step=code&email=${encodeURIComponent(parsed.data.email)}`);
```

**After**:
```ts
import { serializeSignInParams } from "../_lib/search-params";

redirect(serializeSignInParams("/sign-in", { error: message }));
redirect(serializeSignInParams("/sign-in", { step: "code", email: parsed.data.email }));
```

**Before** (`_actions/sign-up.ts:20-33` — manual ticket param handling):
```ts
const ticketParam = parsed.data.ticket
  ? `&ticket=${encodeURIComponent(parsed.data.ticket)}`
  : "";
redirect(`/sign-up?step=code&email=${encodeURIComponent(parsed.data.email)}${ticketParam}`);
```

**After**:
```ts
import { serializeSignUpParams } from "../_lib/search-params";

redirect(serializeSignUpParams("/sign-up", {
  step: "code",
  email: parsed.data.email,
  ticket: parsed.data.ticket ?? null,  // null → omitted automatically
}));
```

### Other Useful Utilities from nuqs

1. **`inferParserType<T>`** — Type helper that extracts the inferred output type from a parser definition. Useful for typing component props that receive parsed search params:
   ```ts
   type EarlyAccessParams = inferParserType<typeof earlyAccessSearchParams>;
   // { email: string; companySize: string; error: string | null; success: boolean; ... }
   ```

2. **`createStandardSchemaV1`** — Converts parser definitions into Standard Schema validators for use with tRPC or TanStack Router. Not immediately needed but could be useful if search params ever need validation at the tRPC boundary.

### Impact on Unit Tests

`createSerializer` changes the action unit test pattern slightly. Instead of asserting exact URL strings:
```ts
expect(mockRedirect).toHaveBeenCalledWith("/sign-in?step=code&email=user%40example.com");
```

You'd assert the same thing — the serializer produces the same output. But the test becomes more resilient to parameter ordering changes since `URLSearchParams` handles ordering internally.

## Open Questions

1. **`buildEarlyAccessUrl()` location** — Currently private in the action file. If tests for the action mock `redirect`, the helper doesn't need to move. But if it grows (e.g. needed by a future test fixture), it could move to `_lib/`.
2. **MSW vs env-flag for E2E** — MSW server-side is cleanest but requires setup. If Arcjet has a `DRY_RUN` mode configurable via env (it does: `env.NODE_ENV !== "production"`), tests in `NODE_ENV=test` would skip Arcjet blocking. Redis can be mocked by pointing to a local Redis in CI.
3. **`error.tsx` placement** — Currently no error boundary exists. The boundary should be at `(early-access)/error.tsx` to catch the server action's outer error throws.
4. **Success state persistence** — The `?success=true` URL state means refreshing the success page re-shows confetti. This is intentional (same pattern as auth's error states being URL-driven). No change needed.
5. **public_metadata fate** — Decide whether to drop Clerk waitlist metadata (companySize/sources/submittedAt) or retain via alternate storage. If the Clerk dashboard view of this data is unused, drop it.
