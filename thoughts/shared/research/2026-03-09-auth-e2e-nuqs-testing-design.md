---
date: 2026-03-09T01:05:01+00:00
researcher: claude
git_commit: 2e897018f37f5493c098bd4ef5f532c8d9ea0ea1
branch: feat/auth-server-actions-migration
repository: lightfast
topic: "auth e2e testing design: nuqs/testing integration & long-term strategy"
tags: [research, codebase, auth, nuqs, playwright, testing, e2e, search-params]
status: complete
last_updated: 2026-03-09
---

# Research: Auth E2E Testing Design — nuqs/testing Integration & Long-Term Strategy

**Date**: 2026-03-09T01:05:01+00:00
**Git Commit**: `2e897018f37f5493c098bd4ef5f532c8d9ea0ea1`
**Branch**: `feat/auth-server-actions-migration`

## Research Question

Consider the `apps/auth/e2e/` implementation for testing our Clerk implementation. Look at https://nuqs.dev/docs/testing — discuss if the integration of nuqs testing is valuable too to enforce stricter type safety and correctness. Design the most accretive, efficient, and best long-term maintainable and correct testing implementation of apps/auth.

---

## Summary

The auth app uses nuqs **exclusively server-side** (`nuqs/server`) to parse typed search params. There are **no client-side `useQueryState` hooks**. This makes `withNuqsTestingAdapter` inapplicable today, but the `nuqs/testing` parser utilities (`isParserBijective`, `testParseThenSerialize`, `testSerializeThenParse`) are directly applicable and add meaningful type-safety guarantees.

The optimal strategy is a **3-layer testing pyramid**:
1. **Parser unit tests** — vitest + `nuqs/testing` (new, high-ROI)
2. **Server action unit tests** — vitest (new, high-ROI)
3. **E2E Playwright tests** — existing, well-maintained

---

## Architecture: How the Auth App Uses nuqs

### Schema definition (`_lib/search-params.ts:1-28`)

```ts
const signInSteps = ["email", "code", "activate"] as const;
const signUpSteps = ["email", "code"] as const;

export const signInSearchParams = {
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,
};

export const signUpSearchParams = {
  step: parseAsStringLiteral(signUpSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,
  __clerk_ticket: parseAsString,
  waitlist: parseAsString,
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
export const loadSignUpSearchParams = createLoader(signUpSearchParams);
```

- `step` is the most critical param: a typed string literal union, not a plain string
- Both loaders exported and used consistently across both pages

### Server pages consume nuqs loaders

- `sign-in/page.tsx:45` → `await loadSignInSearchParams(searchParams)` — TypeScript-typed result
- `sign-up/page.tsx:47` → `await loadSignUpSearchParams(searchParams)` — same pattern, consistent

### Server actions set URL state via `redirect()`

- `_actions/sign-in.ts`: validates email with Zod → `redirect('/sign-in?step=code&email=...')` or `redirect('/sign-in?error=...')`
- `_actions/sign-up.ts`: same pattern, adds optional `ticket` param

### Client components read props (not URL state)

- `OTPIsland`, `SessionActivator`, `ErrorBanner`, `EmailForm` — all receive parsed values as props from server page
- **No `useQueryState` hooks anywhere in the client components**

---

## Existing E2E Tests (`apps/auth/e2e/`)

### Test coverage map

| File | What's tested |
|------|--------------|
| `sign-in-email.spec.ts` | Form render, email→OTP URL transition (`?step=code`), 424242 OTP, resend, back button |
| `sign-up-email.spec.ts` | Form render, email→OTP, OTP completion, sign-in link, invitation ticket banner |
| `error-states.spec.ts` | `?error=` banner display, waitlist UI, wrong OTP inline error |
| `redirects.spec.ts` | Middleware redirect from `/`, authenticated redirect (skipped — needs full stack) |

### What's **not** covered

- `?step=activate&token=...` flow (`SessionActivator` component) — zero E2E coverage
- `?step=code` without `email` (page silently renders nothing for the code block)
- Parser correctness at the schema level (e.g., what happens with `?step=invalid`)

### Infrastructure

- `global.setup.ts`: `clerkSetup()` — registers Clerk test mode globally
- `playwright.config.ts`: Chromium only, `webServer` spins up `pnpm dev:auth` on port 4104
- Retries on CI (2), single worker on CI, `setupClerkTestingToken()` per test
- `test+clerk_test@lightfast.ai` + OTP `424242` as magic credentials per `apps/auth/CLAUDE.md`

---

## nuqs Testing: Value Analysis

### `withNuqsTestingAdapter` — NOT currently applicable

This adapter wraps components that use `useQueryState` hooks. Since auth components receive parsed search param values as **props** from server pages (no `useQueryState` usage), the adapter has no surface to attach to.

**Would become applicable if**: a client component is introduced that manages step/error state via `useQueryState` rather than server redirects.

### `nuqs/testing` parser utilities — HIGH VALUE

These are available in `nuqs@2.4.0+` (currently on `2.8.9`) and work directly on parser definitions:

```ts
import {
  isParserBijective,
  testParseThenSerialize,
  testSerializeThenParse
} from 'nuqs/testing'
```

**Applicable to `signInSearchParams.step`** (`parseAsStringLiteral(["email", "code", "activate"])`):
- Verify the literal union parses/serializes correctly
- Verify invalid values return `null` (rejected)
- Verify default `"email"` behavior
- Catch regressions if `signInSteps` array is modified

**Applicable to all `parseAsString` params**: simpler but confirms nullability behavior.

---

## Proposed Testing Architecture

### Layer 1: Parser Unit Tests (new)

**File**: `apps/auth/src/app/(app)/(auth)/_lib/search-params.test.ts`
**Runner**: vitest (already in workspace catalog: `vitest: ^4.0.18`)
**Dependencies to add**: `vitest` to `devDependencies` in `apps/auth/package.json`

```ts
import { parseAsStringLiteral, parseAsString } from 'nuqs'
import {
  isParserBijective,
  testParseThenSerialize,
  testSerializeThenParse,
} from 'nuqs/testing'
import { describe, expect, it } from 'vitest'
import { signInSearchParams, signUpSearchParams } from './search-params'

describe('signInSearchParams.step', () => {
  it('is bijective for valid values', () => {
    expect(isParserBijective(signInSearchParams.step, 'email', 'email')).toBe(true)
    expect(isParserBijective(signInSearchParams.step, 'code', 'code')).toBe(true)
    expect(isParserBijective(signInSearchParams.step, 'activate', 'activate')).toBe(true)
  })
  it('rejects invalid step values', () => {
    // parseAsStringLiteral returns null for values outside the union
    expect(testParseThenSerialize(signInSearchParams.step, 'invalid')).toBe(false)
  })
  it('round-trips all valid steps', () => {
    for (const step of ['email', 'code', 'activate']) {
      expect(testParseThenSerialize(signInSearchParams.step, step)).toBe(true)
    }
  })
})

describe('signUpSearchParams.step', () => {
  it('only accepts email|code, not activate', () => {
    expect(testParseThenSerialize(signUpSearchParams.step, 'activate')).toBe(false)
    expect(testParseThenSerialize(signUpSearchParams.step, 'code')).toBe(true)
  })
})
```

**Value**: Type contracts at the schema boundary. Catches the most common class of regression — someone adding/removing a step from the const array without updating logic.

### Layer 2: Server Action Unit Tests (new)

**Files**:
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts`
- `apps/auth/src/app/(app)/(auth)/_actions/sign-up.test.ts`

**Dependencies**: vitest, mock for `next/navigation` redirect

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { initiateSignIn } from './sign-in'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

describe('initiateSignIn', () => {
  it('redirects to ?step=code&email=... on valid email', async () => {
    const formData = new FormData()
    formData.set('email', 'user@example.com')
    await expect(initiateSignIn(formData)).rejects.toThrow(
      'REDIRECT:/sign-in?step=code&email=user%40example.com'
    )
  })
  it('redirects to ?error=... on invalid email', async () => {
    const formData = new FormData()
    formData.set('email', 'not-an-email')
    await expect(initiateSignIn(formData)).rejects.toThrow(/REDIRECT:\/sign-in\?error=/)
  })
  it('redirects to ?error=... on empty email', async () => {
    const formData = new FormData()
    await expect(initiateSignIn(formData)).rejects.toThrow(/REDIRECT:\/sign-in\?error=/)
  })
})
```

**Value**: Fast, deterministic tests for the validation + URL construction logic. No browser, no Clerk FAPI, no server needed.

### Layer 3: E2E Playwright Tests (existing + gaps)

Keep all existing tests. **Gaps to fill**:

1. **`step=activate` flow** — `SessionActivator` is completely untested:
   ```ts
   test("activate step renders signing-in state", async ({ page }) => {
     await setupClerkTestingToken({ page })
     await page.goto('/sign-in?step=activate&token=test-token-123')
     await expect(page.getByText('Signing in...')).toBeVisible()
   })
   ```

2. **`step=code` without email** — edge case where page renders no OTP island:
   ```ts
   test("code step without email shows nothing", async ({ page }) => {
     await page.goto('/sign-in?step=code')
     // No OTP island visible — no email to display
     await expect(page.getByText('We sent a verification code')).not.toBeVisible()
   })
   ```

---

## Why NOT `withNuqsTestingAdapter` for this app

The testing adapter is designed for this pattern (which doesn't exist in auth):

```ts
// Client component using URL-synced state
function StepNavigator() {
  const [step, setStep] = useQueryState('step', parseAsStringLiteral(signInSteps))
  // ...
}
```

The auth app uses **server-side URL state** (Next.js server actions + `redirect()`) rather than client-side URL state (`useQueryState`). The current architecture is intentionally server-first: the server action validates and redirects, the page reads via `loadSignInSearchParams`, then passes resolved values down as props.

If the architecture ever shifts toward client-side step management (e.g., for instant transitions without full page reload), `withNuqsTestingAdapter` becomes the right tool.

---

## Code References

- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:1-24` — nuqs parser definitions + `createLoader` exports
- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:45` — `loadSignInSearchParams` usage
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:47` — `loadSignUpSearchParams` usage
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts:10-22` — server action → redirect pattern
- `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts:11-34` — server action with ticket param
- `apps/auth/e2e/tests/sign-in-email.spec.ts` — Clerk E2E: email→OTP flow
- `apps/auth/e2e/tests/sign-up-email.spec.ts` — Clerk E2E: sign-up + invitation ticket
- `apps/auth/e2e/tests/error-states.spec.ts` — error banner + waitlist UI
- `apps/auth/e2e/tests/redirects.spec.ts` — middleware redirect coverage
- `apps/auth/e2e/global.setup.ts` — `clerkSetup()` global init
- `apps/auth/playwright.config.ts` — Chromium only, port 4104, `webServer` config
- `apps/auth/package.json:37` — `nuqs: ^2.8.9`
- `pnpm-workspace.yaml:49` — `vitest: ^4.0.18` in catalog

---

## Implementation Order (by ROI)

1. **Add vitest** to `apps/auth/package.json` devDependencies
2. **Write parser unit tests** (`_lib/search-params.test.ts`) — highest type-safety ROI
3. **Write server action unit tests** (`_actions/sign-in.test.ts`, `_actions/sign-up.test.ts`)
4. **Add E2E gap tests** (`step=activate`, `step=code` without email)

---

## Open Questions

- Should vitest config live in `apps/auth/vitest.config.ts` or inherit from a shared workspace config?
- Does `nuqs/server` (used in pages) require special vitest config for ESM? nuqs v2 is ESM-only; may need `extensionsToTreatAsEsm` config.
- Is `SessionActivator` ever invoked in practice today (is `?step=activate&token=...` generated anywhere in the codebase)?
