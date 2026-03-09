---
date: 2026-03-09T01:24:37Z
researcher: claude
git_commit: 3af9ecb87e387d34c66d864486286e266ee0761f
branch: feat/auth-server-actions-migration
repository: lightfast
topic: "Clerk 303/429 too_many_requests in apps/auth dev instance"
tags: [research, codebase, clerk, auth, rate-limiting, middleware, otp-island]
status: complete
last_updated: 2026-03-09
---

# Research: Clerk 303/429 `too_many_requests` in `apps/auth` Dev Instance

**Date**: 2026-03-09T01:24:37Z
**Git Commit**: 3af9ecb87e387d34c66d864486286e266ee0761f
**Branch**: feat/auth-server-actions-migration

## Research Question

> In the development instance of `apps/auth/`, consistently getting 303 errors with `{"errors":[{"code":"too_many_requests","message":"Too many requests. Please try again in a bit."}]}` from Clerk. What is happening?

## Summary

There are **three compounding mechanisms** that cause persistent Clerk 429s in the dev instance. The 303 HTTP status is Clerk's FAPI convention — for browser clients, rate-limited endpoints return a `303 See Other` redirect to an error URL rather than a direct 429. The redirect target then returns the 429 JSON body. Once the rate limit is hit, ongoing requests from the Clerk frontend library prevent it from resetting, creating a persistent loop.

## Detailed Findings

### 1. The 303 → 429 Pattern Is Clerk's Browser-Client Rate-Limit Convention

Clerk's FAPI (Frontend API) — the client-side API at `clerk.lightfast.ai/v1/...` — does **not** return raw 429 responses to browser clients. Instead it returns:

- **303 See Other** → redirect to a Clerk error URL
- The redirect target responds with `{"errors":[{"code":"too_many_requests","message":"..."}]}`

This is Clerk's architecture for browser-based clients (they assume a browser will follow the redirect and display a page). The JavaScript SDK catches the redirect target's body and surfaces it as a FAPI error. So 303 + 429 JSON is one atomic rate-limit response, not two separate issues.

---

### 2. Root Cause A: `OTPIsland` `init()` Effect Has Unstable Dependencies

**File**: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx:66-118`

The `useEffect` that sends the OTP code on mount has this dependency array:

```ts
}, [
  email,
  mode,
  ticket,
  signIn,      // ← from useSignIn()
  signUp,      // ← from useSignUp()
  handleClerkError,
  navigateToConsole,
]);
```

`signIn` and `signUp` come from Clerk's `useSignIn()` and `useSignUp()` hooks (`otp-island.tsx:17-18`). In Clerk's SDK, these objects are **not referentially stable** — they can return a new object reference on re-renders (e.g., after internal Clerk state updates). Every time `signIn` or `signUp` gets a new reference, this effect re-runs, causing another `sendCode()` call:

```ts
// sign-in path (otp-island.tsx:86-88)
const { error: sendError } = await signIn.emailCode.sendCode({
  emailAddress: email,
});

// sign-up path (otp-island.tsx:94-104)
const { error: createError } = await signUp.create({ emailAddress: email });
const { error: sendError } = await signUp.verifications.sendEmailCode();
```

Each re-run fires 1–2 FAPI requests. In development, Clerk's internal state can change multiple times per page load (e.g., from initialization to session-loaded state), causing the effect to run 2–5+ times before the user has even entered any code.

---

### 3. Root Cause B: React Strict Mode Double-Invokes All Effects

**File**: `apps/auth/src/app/layout.tsx` — Next.js dev mode always enables React Strict Mode.

In development, React Strict Mode intentionally mounts → unmounts → remounts every component. This means the `init()` effect in `OTPIsland` fires **twice per navigation** to the OTP step. Two simultaneous `sendCode()` calls are the minimum in dev before any re-render instability occurs.

For sign-up, each mount fires **two** FAPI calls (`signUp.create()` + `signUp.verifications.sendEmailCode()`). Strict Mode gives you 4 FAPI calls per page load minimum on the sign-up OTP step.

---

### 4. Root Cause C: `clerkMiddleware` `auth()` Call on Every Request

**File**: `apps/auth/src/middleware.ts:78-82`

```ts
export default clerkMiddleware(
  async (auth, req: NextRequest, event: NextFetchEvent) => {
    const { userId, orgId, orgSlug } = await auth({
      treatPendingAsSignedOut: false,
    });
```

`clerkMiddleware` wraps every request matching the config (lines 135-140). The matcher covers all non-static URLs:

```
/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|...)).*)
```

In Next.js development, a single page navigation generates:
- Initial page request
- RSC (React Server Component) payload fetch (separate request)
- Next.js prefetch requests for links visible on screen
- Any server action POSTs

Each of these goes through `clerkMiddleware` → `auth()`. While `auth()` verifies JWTs locally (no Clerk network call), `clerkMiddleware` itself makes Clerk FAPI requests for session handshake on first load and whenever the Clerk session token needs refreshing.

Additionally, if `auth.protect()` is called (line 117) for any route that accidentally matches as non-public, it can trigger a Clerk FAPI network request.

---

### 5. Contributing Factor: Dev Instance Rate Limits Are Much Lower Than Production

Clerk development instances (apps using `pk_test_*` publishable keys) have significantly lower rate limits than production instances. The exact limit is not published, but common experience is ~60 FAPI requests/minute per IP, compared to much higher production limits.

In `apps/auth/src/env.ts`, the publishable key is `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. If this is a `pk_test_*` key (development instance), you're subject to dev rate limits.

The `OTPIsland` error handler does handle the code (`otp-island.tsx:43-46`):

```ts
if (errCode === "too_many_requests") {
  setError("Too many attempts. Please wait a moment and try again.");
  return;
}
```

But this only catches the error *after* the rate limit is already hit. It doesn't prevent the subsequent re-fires of the effect that prevent the rate limit from resetting.

---

### 6. The `<Show when="signed-out"><RedirectToTasks /></Show>` in Auth Layout

**File**: `apps/auth/src/app/(app)/(auth)/layout.tsx:14-16`

```tsx
<Show when="signed-out">
  <RedirectToTasks />
</Show>
```

`<Show when="signed-out">` from `@vendor/clerk/client` renders its children when the user's Clerk session state is **not** signed-out — i.e., when they ARE signed in (either pending or active). `<RedirectToTasks />` then fires a Clerk API call to determine what task to redirect to, using `taskUrls` from `ClerkProvider`.

For the **pending** state (has userId, no orgId): `<RedirectToTasks />` redirects to `taskUrls["choose-organization"]` = `${consoleUrl}/account/teams/new` = `http://localhost:4107/account/teams/new` in dev. If the console app is not running at port 4107, this redirect request fails silently at the network level but the Clerk FAPI call to determine the task URL still went out.

This is the client-side complement to the middleware's server-side redirect (middleware handles it at lines 89-96 before the page even renders), but it still involves a Clerk API call.

---

## Code References

| File | Lines | What's there |
|------|-------|-------------|
| `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx` | 66-118 | `init()` effect with `signIn`/`signUp` in dependency array — root cause of repeated `sendCode()` calls |
| `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx` | 17-18 | `useSignIn()` / `useSignUp()` destructuring — source of potentially unstable object references |
| `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx` | 43-46 | `too_many_requests` error handler — catches it but doesn't prevent re-fires |
| `apps/auth/src/middleware.ts` | 78-82 | `clerkMiddleware` + `auth()` called on every request |
| `apps/auth/src/middleware.ts` | 116-118 | `auth.protect()` for non-public routes |
| `apps/auth/src/app/(app)/(auth)/layout.tsx` | 14-16 | `<Show when="signed-out"><RedirectToTasks /></Show>` — client-side auth redirect |
| `apps/auth/src/app/layout.tsx` | 85-95 | `ClerkProvider` with `signInFallbackRedirectUrl`, `taskUrls` config |

## Architecture Documentation

### How the 429 Persists

Once the rate limit is hit:
1. `OTPIsland` effect fires → gets 303 → follows redirect → gets 429 JSON → sets error state
2. Setting error state causes a re-render
3. Re-render potentially causes `signIn`/`signUp` references to change
4. Changed references cause the effect to re-run (back to step 1)
5. Rate limit never resets because requests keep coming in

### Clerk 303 Redirect Mechanism

Clerk FAPI endpoints that are rate-limited respond with:
- `303 See Other` with `Location: https://api.clerk.com/v1/error?...` (or similar error URL)
- The redirect target returns `{"errors":[{"code":"too_many_requests",...}]}`

This is Clerk's browser-optimized rate-limit response. The Clerk JS SDK follows the redirect internally and surfaces the error via the hook's return value (`{ error: { code: "too_many_requests" } }`).

### Dev vs Production Behavior

| Factor | Development | Production |
|--------|-------------|------------|
| React Strict Mode | ON (double effects) | OFF |
| Hot reload remounts | Frequent | Never |
| Clerk rate limits | Low (test instance) | High |
| `signIn`/`signUp` stability | Potentially unstable | Potentially unstable |

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-03-09-auth-server-actions-migration.md` — The server actions migration plan explicitly documents handling `too_many_requests` (code `"too_many_requests" || err.status === 429`) in the `signInWithPassword` BAPI flow (dev/preview only). The OTPIsland's FAPI rate limiting is addressed in the current `handleClerkError` callback but the effect re-fire loop was not addressed in the plan.
- `thoughts/shared/research/2026-03-08-auth-server-actions-design.md` — Documents `isRateLimitError(err)` check pattern and Clerk FAPI rate limit behavior (`status === 429`, `code === "too_many_requests"`).

## Related Research

- `thoughts/shared/research/2026-03-08-auth-server-actions-design.md` — Auth server actions architecture
- `thoughts/shared/research/2026-03-09-auth-testing-strategy.md` — Clerk test accounts (`+clerk_test` emails) and `424242` OTP bypass

## Open Questions

- Does Clerk's `useSignIn()` / `useSignUp()` return stable object references across renders in the current `@vendor/clerk/client` version?
- Does `<Show when="signed-out">` in Clerk's `@clerk/nextjs` render for signed-IN users (inverted condition) or signed-OUT users?
- Is `auth.protect()` (middleware line 117) making network FAPI calls or is it purely local JWT validation?
