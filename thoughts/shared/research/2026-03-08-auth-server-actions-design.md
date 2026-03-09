---
date: 2026-03-08T08:36:18+11:00
researcher: jeevanpillay
git_commit: 55d458c06
branch: chore/clerk-core3-upgrade
repository: lightfastai/lightfast
topic: "Convert apps/auth to server actions with strictly server-side components for sign-in and sign-up"
tags: [research, codebase, auth, clerk, server-actions, server-components, core3, nuqs]
status: complete
last_updated: 2026-03-09
last_updated_by: jeevanpillay
last_updated_note: "Added follow-up: delete error-handler.ts + error-handling.ts, simplified direct error handling for server actions + tiny islands"
---

# Research: apps/auth Server-First Architecture Design

**Date**: 2026-03-08T08:36:18+11:00
**Researcher**: jeevanpillay
**Git Commit**: 55d458c06
**Branch**: chore/clerk-core3-upgrade
**Repository**: lightfastai/lightfast

## Research Question

> Convert the whole of `@apps/auth/` into server actions with strictly server side components only for ALL logic. Design the most efficient, useful and accretive implementation that achieves this full server-only runtime for apps/auth's sign-in and sign-up.

## Summary

The existing `apps/auth/` sign-in and sign-up flows are **fully client-side** — every form component carries `"use client"` and uses Clerk's legacy programmatic hooks (`useSignIn`, `useSignUp`) directly against Clerk's Frontend API (FAPI). The page files and layout are already server components; the client-side boundary begins at the form components.

**The hard architectural constraint**: Clerk's authentication flows (email OTP initiation, OTP verification, OAuth redirects, session creation) require Clerk's **Frontend API (FAPI)**, which runs in the browser against a per-instance Clerk endpoint. There is no Backend SDK (BAPI) equivalent for creating sign-in attempts, sending OTPs to anonymous users, or verifying codes. This means a **pure server-only runtime for auth logic is not achievable with Clerk**.

**What is achievable** — and what represents the most efficient design — falls into two distinct implementation paths depending on how much custom UI control is needed:

- **Path A (Recommended for maximum server-side purity)**: Replace all custom form components with Clerk's prebuilt `<SignIn />` and `<SignUp />` components. Pages remain server components. Zero custom client-side auth logic. Custom styling via Clerk's `appearance` API.
- **Path B (Recommended if custom UI must be preserved)**: Island architecture — static form shells as server components with `<form action={serverAction}>` for email input, server actions for validation and pre-checks via `clerkClient`, and minimal `"use client"` islands only for the Clerk API calls (OTP send, OTP verify, session finalize). Migrate hooks from legacy Core 2 API to Core 3's new `signIn.emailCode.*` pattern.

---

## Current State

### File Map

| File | "use client"? | Clerk imports |
|---|---|---|
| `src/app/(app)/(auth)/sign-in/page.tsx` | No | None (server component) |
| `src/app/(app)/(auth)/sign-up/page.tsx` | No | None (server component) |
| `src/app/(app)/(auth)/layout.tsx` | No | `Show`, `RedirectToTasks` |
| `src/app/layout.tsx` | No | `ClerkProvider` |
| `src/middleware.ts` | No | `clerkMiddleware`, `createRouteMatcher` |
| `src/app/(app)/(auth)/_components/sign-in-form.tsx` | **Yes** | `useSignIn` (legacy) |
| `src/app/(app)/(auth)/_components/sign-in-email-input.tsx` | **Yes** | `useSignIn` (vendor client) |
| `src/app/(app)/(auth)/_components/sign-in-code-verification.tsx` | **Yes** | `useSignIn` (vendor client), `setActive` |
| `src/app/(app)/(auth)/_components/sign-in-password.tsx` | **Yes** | `useSignIn` (legacy) |
| `src/app/(app)/(auth)/_components/sign-up-form.tsx` | **Yes** | `useSignUp` (legacy), `useSearchParams` |
| `src/app/(app)/(auth)/_components/sign-up-email-input.tsx` | **Yes** | `useSignUp` (legacy), `useClerk` |
| `src/app/(app)/(auth)/_components/sign-up-code-verification.tsx` | **Yes** | `useSignUp` (vendor client) |
| `src/app/(app)/(auth)/_components/sign-up-password.tsx` | **Yes** | `useSignUp` (legacy) |
| `src/app/(app)/(auth)/_components/oauth-sign-in.tsx` | **Yes** | `useSignIn` (legacy), `OAuthStrategy` |
| `src/app/(app)/(auth)/_components/oauth-sign-up.tsx` | **Yes** | `useSignUp` (legacy), `useClerk` |
| `src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx` | **Yes** | None (pure UI) |
| `src/app/hooks/use-code-verification.ts` | No (`"use client"` removed) | None (UI state only) |
| `src/app/(app)/(auth)/sign-in/sso-callback/page.tsx` | **Yes** | `AuthenticateWithRedirectCallback` |
| `src/app/(app)/(auth)/sign-up/sso-callback/page.tsx` | **Yes** | `AuthenticateWithRedirectCallback` |
| `src/app/lib/clerk/error-handler.ts` | No | `captureException` (Sentry) |
| `src/app/lib/clerk/error-handling.ts` | No | `isClerkAPIResponseError`, `isUserLockedError` |

### Sign-In Flow (Current)

```
sign-in/page.tsx (Server)
  └── <SignInForm> (Client) — useSignIn() from @clerk/nextjs/legacy
        ├── Step: "email"
        │   ├── <SignInEmailInput> (Client)
        │   │   ├── useSignIn()
        │   │   ├── signIn.create({ identifier: email })           → FAPI call
        │   │   ├── signIn.prepareFirstFactor({ strategy: "email_code" }) → FAPI call
        │   │   └── onSuccess(email) → parent advances step to "code"
        │   └── <OAuthSignIn> (Client)
        │       ├── useSignIn()
        │       └── signIn.authenticateWithRedirect({ strategy: "oauth_github" }) → browser redirect
        ├── Step: "code"
        │   └── <SignInCodeVerification> (Client)
        │       ├── useSignIn()
        │       ├── signIn.attemptFirstFactor({ strategy: "email_code", code }) → FAPI call
        │       ├── setActive({ session: createdSessionId })        → FAPI call (sets cookie)
        │       └── window.location.href = consoleUrl + /account/teams/new
        └── Step: "password" (dev/preview only)
            └── <SignInPassword> (Client)
                ├── useSignIn()
                └── signIn.create({ identifier, password })         → FAPI call
```

### Sign-Up Flow (Current)

```
sign-up/page.tsx (Server, wrapped in <Suspense>)
  └── <SignUpForm> (Client) — useSignUp(), useSearchParams()
        ├── Step: "email"
        │   ├── <SignUpEmailInput> (Client)
        │   │   ├── useSignUp(), useClerk()
        │   │   ├── signUp.create({ emailAddress }) or { strategy: "ticket" }  → FAPI call
        │   │   └── signUp.prepareEmailAddressVerification({ strategy: "email_code" }) → FAPI call
        │   └── <OAuthSignUp> (Client)
        │       ├── useSignUp(), useClerk()
        │       ├── signUp.create({ strategy: "ticket", ticket }) [if invitation] → FAPI call
        │       └── signUp.authenticateWithRedirect({ strategy: "oauth_github" }) → browser redirect
        ├── Step: "code"
        │   └── <SignUpCodeVerification> (Client)
        │       ├── useSignUp()
        │       ├── signUp.attemptEmailAddressVerification({ code }) → FAPI call
        │       ├── setActive({ session: createdSessionId })          → FAPI call
        │       └── window.location.href = consoleUrl + /account/teams/new
        └── Step: "password" (dev/preview only)
            └── <SignUpPassword> (Client)
                └── signUp.create({ emailAddress, password }) → FAPI call
```

### What Is Already Server-Side

The following are already server-side and require no changes:
- **Middleware** (`middleware.ts`): `clerkMiddleware` runs server-side. Reads `userId`, `orgId`, `orgSlug` from the Clerk session. Handles all redirects for authenticated/pending/unauthenticated users.
- **Page files** (`sign-in/page.tsx`, `sign-up/page.tsx`): Pure server components. Export metadata, import form components.
- **Auth layout** (`layout.tsx`): Server component. Uses `<Show when="signed-out">` (Core 3, works in RSC).
- **Root layout** (`layout.tsx`): Server component wrapping `<ClerkProvider>`.
- **Error utilities** (`lib/clerk/error-handler.ts`, `lib/clerk/error-handling.ts`): Pure utility functions, importable server-side.
- **Environment** (`env.ts`): T3-env, server-only secrets available.

---

## Clerk's Server/Client Boundary — Definitive Map

### What Backend API (BAPI) CAN do server-side

Accessible via `clerkClient` from `@vendor/clerk/server` in Server Actions and Route Handlers:

| Method | Use case |
|---|---|
| `clerkClient.users.getUserList({ emailAddress: [email] })` | Pre-check if email is registered |
| `clerkClient.users.createUser(params)` | Create user with verified email (no OTP) |
| `clerkClient.users.verifyPassword({ userId, password })` | Server-side password check |
| `clerkClient.signInTokens.createSignInToken({ userId, expiresInSeconds })` | Generate one-time sign-in token for known user |
| `clerkClient.invitations.createInvitation({ emailAddress, redirectUrl })` | Invite user by email |
| `clerkClient.sessions.revokeSession(sessionId)` | Sign out server-side |

### What Frontend API (FAPI) requires (cannot be server-side)

| Operation | Why it must be client-side |
|---|---|
| `signIn.create({ identifier })` | Creates attempt bound to browser client cookie on FAPI |
| `signIn.prepareFirstFactor({ strategy: "email_code" })` | Triggers OTP send via FAPI state machine |
| `signIn.attemptFirstFactor({ strategy: "email_code", code })` | Verifies OTP against FAPI attempt state |
| `signIn.finalize()` / `setActive({ session })` | Writes session to browser (HttpOnly cookie via FAPI) |
| `signUp.create(params)` | Creates sign-up attempt on FAPI |
| `signUp.prepareEmailAddressVerification(...)` | Sends OTP via FAPI |
| `signUp.attemptEmailAddressVerification({ code })` | Verifies OTP against FAPI sign-up state |
| `signIn.authenticateWithRedirect(...)` | Triggers OAuth provider redirect (browser only) |
| `AuthenticateWithRedirectCallback` | Handles OAuth callback via browser FAPI exchange |

**Root cause**: Clerk's sign-in/sign-up "attempt" concept is maintained in a per-browser `Client` object on FAPI. The Backend SDK has no endpoint to create or drive this state machine for anonymous users.

---

## Clerk Core 3 Hook API (New in v7)

The current code uses the legacy `useSignIn`/`useSignUp` API (still available at `@clerk/nextjs/legacy`). Core 3 introduces a cleaner `SignInFuture`/`SignUpFuture` API accessible via the default import. This is still client-side but changes the call surface:

**Legacy (Core 2, current):**
```tsx
const { signIn, setActive } = useSignIn()
await signIn.create({ identifier: email })
await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId })
const result = await signIn.attemptFirstFactor({ strategy: "email_code", code })
if (result.status === "complete") await setActive({ session: result.createdSessionId })
```

**Core 3 (new):**
```tsx
const { signIn, fetchStatus, errors } = useSignIn()
await signIn.emailCode.sendCode({ emailAddress: email })
await signIn.emailCode.verifyCode({ code })
if (signIn.status === "complete") await signIn.finalize()
// signIn.status, fetchStatus, errors.fields.* — built-in structured state
```

The vendor client export at `vendor/clerk/src/client/index.ts:51` already notes: `// useSignIn and useSignUp use the legacy programmatic API (Core 3 replaced with components-based API)`.

---

## Design: Two Implementation Paths

### Path A — Clerk Prebuilt Components (Maximum server-side purity)

**Principle**: Pages are server components. The only client code is Clerk's own `<SignIn />` and `<SignUp />` components, which are maintained by Clerk and not the app's responsibility.

**File changes:**

```
REMOVE:
  src/app/(app)/(auth)/_components/sign-in-form.tsx
  src/app/(app)/(auth)/_components/sign-in-email-input.tsx
  src/app/(app)/(auth)/_components/sign-in-code-verification.tsx
  src/app/(app)/(auth)/_components/sign-in-password.tsx
  src/app/(app)/(auth)/_components/sign-up-form.tsx
  src/app/(app)/(auth)/_components/sign-up-email-input.tsx
  src/app/(app)/(auth)/_components/sign-up-code-verification.tsx
  src/app/(app)/(auth)/_components/sign-up-password.tsx
  src/app/(app)/(auth)/_components/oauth-sign-in.tsx
  src/app/(app)/(auth)/_components/oauth-sign-up.tsx
  src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx
  src/app/hooks/use-code-verification.ts
  src/app/lib/clerk/error-handler.ts
  src/app/lib/clerk/error-handling.ts

MODIFY:
  src/app/(app)/(auth)/sign-in/page.tsx  → render <SignIn />
  src/app/(app)/(auth)/sign-up/page.tsx  → render <SignUp />
  (sso-callback pages unchanged — AuthenticateWithRedirectCallback is Clerk's component)
```

**Result structure:**

```tsx
// sign-in/page.tsx (Server Component — no changes needed to file type)
import { SignIn } from "@vendor/clerk/client"
import type { Metadata } from "next"
import { createMetadata } from "@vendor/seo/metadata"

export const metadata: Metadata = createMetadata({ ... })

export default function SignInPage() {
  return (
    <SignIn
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/account/teams/new"  // ClerkProvider already sets this
      appearance={{
        elements: {
          // Map to Tailwind CSS variables matching the app's design system
          rootBox: "w-full",
          card: "shadow-none border-0 bg-transparent p-0",
          formButtonPrimary: "bg-primary text-primary-foreground ...",
          // etc.
        }
      }}
    />
  )
}
```

**Tradeoffs:**
- Zero custom client-side auth code to maintain
- Clerk handles all flows: email OTP, OAuth, password, waitlist errors, rate limiting
- Visual customization limited to Clerk's `appearance` API (less flexible than current custom UI)
- Clerk's component is a client-rendered island internally (can't avoid)
- `<Suspense>` wrapper on the sign-up page is no longer needed (Clerk's component handles loading)
- The invitation ticket (`__clerk_ticket`) URL parameter is handled by Clerk's `<SignUp />` automatically
- Waitlist restriction is handled by Clerk's `waitlistUrl` prop (already set on `ClerkProvider`)
- SSO callbacks remain unchanged

**This path eliminates all custom auth client code** while keeping page files as server components. The app goes from ~15 client components to 0 custom client components for auth logic.

---

### Path B — nuqs + Server Actions Island Architecture (Recommended — preserve custom UI, maximum server-side)

**Principle**: Use nuqs `createSearchParamsCache` to manage auth flow state (`step`, `email`, `error`) in URL search params — readable by server components. Server actions handle form submissions with `redirect()`. Minimal client islands only for irreducible Clerk FAPI calls and interactive OTP input.

**Key insight**: The current `SignInForm` and `SignUpForm` are `"use client"` primarily because of `useState` for step management, not because of Clerk. Moving step state to URL params via nuqs makes the form orchestrator a **server component**. nuqs is already used in `apps/console` with `NuqsAdapter` in the layout.

**URL state design:**
```
/sign-in                                    → step=email (default)
/sign-in?step=code&email=user@example.com   → OTP verification
/sign-in?step=password                      → password form (dev/preview only)
/sign-in?step=activate&token=ey...          → session activation
/sign-in?error=Invalid+email                → error display

/sign-up                                    → step=email (default)
/sign-up?step=code&email=user@example.com   → OTP verification
/sign-up?ticket=xxx                         → invitation flow
/sign-up?error=...                          → error display
```

**Component architecture:**

```
src/app/(app)/(auth)/
├── _actions/
│   ├── sign-in.ts             ("use server" — validate email, redirect to ?step=code)
│   ├── sign-up.ts             ("use server" — validate email, handle invitation ticket)
│   └── sign-in-password.ts    ("use server" — verifyPassword + createSignInToken via clerkClient)
├── _components/
│   ├── email-form.tsx         (Server Component — <form action={serverAction}>)
│   ├── password-form.tsx      (Server Component — <form action={passwordAction}>)
│   ├── error-banner.tsx       (Server Component — reads ?error from URL)
│   ├── otp-island.tsx         ("use client" island — OTP input + sendCode/verifyCode/finalize)
│   ├── oauth-button.tsx       ("use client" island — triggers OAuth redirect)
│   └── session-activator.tsx  ("use client" island — exchanges sign-in token for session)
├── _lib/
│   └── search-params.ts       (nuqs parser config — createSearchParamsCache)
├── sign-in/
│   ├── page.tsx               (Server Component — reads step from nuqs, renders correct form)
│   └── sso-callback/page.tsx  ("use client" — AuthenticateWithRedirectCallback, unchanged)
└── sign-up/
    ├── page.tsx               (Server Component — reads step from nuqs, renders correct form)
    └── sso-callback/page.tsx  ("use client" — AuthenticateWithRedirectCallback, unchanged)
```

**nuqs search params cache (_lib/search-params.ts):**
```tsx
import { createSearchParamsCache, parseAsString, parseAsStringLiteral } from "nuqs/server"

const steps = ["email", "code", "password", "activate"] as const

export const signInSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(steps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,  // "true" if waitlist-restricted error
})

export const signUpSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(steps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,   // __clerk_ticket for invitations
  waitlist: parseAsString,
})
```

**Sign-in page (Server Component — step routing via nuqs):**
```tsx
// sign-in/page.tsx
import type { Metadata, SearchParams } from "next"
import { signInSearchParams } from "../_lib/search-params"
import { EmailForm } from "../_components/email-form"
import { PasswordForm } from "../_components/password-form"
import { OTPIsland } from "../_components/otp-island"
import { SessionActivator } from "../_components/session-activator"
import { ErrorBanner } from "../_components/error-banner"
import { OAuthButton } from "../_components/oauth-button"

export const metadata: Metadata = createMetadata({ ... })

export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { step, email, error, token, waitlist } = await signInSearchParams.parse(searchParams)

  return (
    <div className="w-full space-y-8">
      {/* Header — pure server component */}
      {(step === "email" || step === "password") && (
        <h1 className="text-3xl font-pp font-medium text-foreground text-center">
          Log in to Lightfast
        </h1>
      )}

      {/* Error display — pure server component, reads ?error from URL */}
      {error && <ErrorBanner message={error} isWaitlist={waitlist === "true"} />}

      {/* Step: email — server component form + client OAuth island */}
      {!error && step === "email" && (
        <>
          <EmailForm action="sign-in" />
          <Separator />
          <OAuthButton mode="sign-in" />
        </>
      )}

      {/* Step: code — client island (irreducible: OTP input + Clerk FAPI) */}
      {!error && step === "code" && email && (
        <OTPIsland email={email} mode="sign-in" />
      )}

      {/* Step: password — server component form (dev/preview only) */}
      {!error && step === "password" && <PasswordForm />}

      {/* Step: activate — thin client island for session creation */}
      {step === "activate" && token && <SessionActivator token={token} />}
    </div>
  )
}
```

**Email form (Server Component — native HTML form):**
```tsx
// _components/email-form.tsx (NO "use client"!)
import { initiateSignIn } from "../_actions/sign-in"
import { initiateSignUp } from "../_actions/sign-up"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"

export function EmailForm({ action }: { action: "sign-in" | "sign-up" }) {
  const serverAction = action === "sign-in" ? initiateSignIn : initiateSignUp

  return (
    <form action={serverAction} className="space-y-4">
      <Input name="email" type="email" placeholder="Email Address" className="h-12" required />
      <Button type="submit" size="lg" className="w-full">
        Continue with Email
      </Button>
    </form>
  )
}
```

**Server action (sign-in.ts):**
```tsx
"use server"
import { redirect } from "next/navigation"
import { z } from "zod"

const emailSchema = z.object({ email: z.string().email("Please enter a valid email address") })

export async function initiateSignIn(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent(parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email")}`)
  }
  // Redirect to OTP step — the client island will call signIn.emailCode.sendCode()
  redirect(`/sign-in?step=code&email=${encodeURIComponent(parsed.data.email)}`)
}
```

**Password server action (fully server-side verification):**
```tsx
"use server"
import { redirect } from "next/navigation"
import { clerkClient } from "@vendor/clerk/server"
import { z } from "zod"

const passwordSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    redirect(`/sign-in?step=password&error=${encodeURIComponent("Invalid credentials")}`)
  }

  try {
    const client = await clerkClient()

    // 1. Find user by email
    const users = await client.users.getUserList({ emailAddress: [parsed.data.identifier] })
    const user = users.data[0]
    if (!user) {
      redirect(`/sign-in?step=password&error=${encodeURIComponent("Account not found")}`)
    }

    // 2. Verify password server-side (never touches client)
    await client.users.verifyPassword({ userId: user.id, password: parsed.data.password })

    // 3. Mint a short-lived sign-in token
    const { token } = await client.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 60,
    })

    // 4. Redirect to session activator (thin client island)
    redirect(`/sign-in?step=activate&token=${token}`)
  } catch {
    redirect(`/sign-in?step=password&error=${encodeURIComponent("Invalid email or password")}`)
  }
}
```

**Session activator (thin client island — ~15 lines, the irreducible FAPI call):**
```tsx
"use client"
import * as React from "react"
import { useSignIn } from "@clerk/nextjs"
import { Icons } from "@repo/ui/components/icons"
import { consoleUrl } from "~/lib/related-projects"

export function SessionActivator({ token }: { token: string }) {
  const { signIn } = useSignIn()

  React.useEffect(() => {
    signIn.ticket({ ticket: token }).then(() => {
      if (signIn.status === "complete") {
        signIn.finalize({
          navigate: async () => {
            window.location.href = `${consoleUrl}/account/teams/new`
          },
        })
      }
    })
  }, [token, signIn])

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Signing in...</span>
    </div>
  )
}
```

**OTP island (client island — interactive 6-digit input + Clerk FAPI):**
```tsx
"use client"
import * as React from "react"
import { useSignIn } from "@clerk/nextjs"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui/components/ui/input-otp"
import { consoleUrl } from "~/lib/related-projects"

export function OTPIsland({ email, mode }: { email: string; mode: "sign-in" | "sign-up" }) {
  const { signIn } = useSignIn()
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isVerifying, setIsVerifying] = React.useState(false)

  // Send OTP on mount
  React.useEffect(() => {
    signIn.emailCode.sendCode({ emailAddress: email })
  }, [email, signIn])

  // Auto-verify when 6 digits entered
  React.useEffect(() => {
    if (code.length === 6 && !error) {
      setIsVerifying(true)
      signIn.emailCode.verifyCode({ code }).then(() => {
        if (signIn.status === "complete") {
          signIn.finalize({
            navigate: async () => {
              window.location.href = `${consoleUrl}/account/teams/new`
            },
          })
        }
      }).catch(() => {
        setError("Incorrect code. Please try again.")
        setIsVerifying(false)
      })
    }
  }, [code, error, signIn])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Verification code sent to <span className="font-medium">{email}</span>
      </p>
      <InputOTP value={code} onChange={(v) => { setError(null); setCode(v) }} maxLength={6} disabled={isVerifying}>
        <InputOTPGroup className="gap-2">
          {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="border" />)}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  )
}
```

**Client island count (irreducible minimum):**

| Island | Lines | Why client-only |
|---|---|---|
| `otp-island.tsx` | ~50 | Interactive OTP input + `signIn.emailCode.sendCode/verifyCode/finalize` — FAPI |
| `oauth-button.tsx` | ~20 | `signIn.authenticateWithRedirect()` — browser redirect |
| `session-activator.tsx` | ~15 | `signIn.ticket()` + `signIn.finalize()` — exchanges server token for session |
| `sign-in/sso-callback/page.tsx` | ~10 | `AuthenticateWithRedirectCallback` — Clerk's own component |
| `sign-up/sso-callback/page.tsx` | ~10 | Same |

**Total: ~105 lines of client JS** across 5 files. Down from ~800+ lines across 12 client components.

**What moves to server (was client, now server):**
- Step orchestration (`email` → `code` → `password` → `activate`) — via nuqs URL params
- Email form rendering and validation — `<form action={serverAction}>`
- Password verification — `clerkClient.users.verifyPassword()` in server action
- Sign-in token generation — `clerkClient.signInTokens.createSignInToken()` in server action
- Error display and waitlist banners — server component reads `?error=&waitlist=true`
- Invitation ticket detection — `searchParams.ticket` in server component
- All layout and static UI — already server

**Dependencies to add to `apps/auth/package.json`:**
```json
{
  "dependencies": {
    "nuqs": "catalog:"  // already in console, add to auth
  }
}
```

**Root layout change (add NuqsAdapter):**
```tsx
// src/app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app"

// Inside <body>:
<ClerkProvider ...>
  <NuqsAdapter>
    {children}
  </NuqsAdapter>
</ClerkProvider>
```

**Tradeoffs vs current:**
- Server actions handle all validation (removes client-side Zod, react-hook-form)
- `clerkClient` verifyPassword + createSignInToken makes password flow ~95% server-side
- Custom UI is fully preserved — same form components, same styling
- Only ~105 lines of client JS remain (down from ~800+)
- `@hookform/resolvers` and `@vendor/forms` can be removed from auth's dependencies
- Progressive enhancement: email form works without JavaScript enabled
- URL-driven state: step is bookmarkable, back button works naturally
- nuqs already established pattern in the codebase (console app)
- Slightly more files, but each file is smaller and has a clear responsibility

---

### Path C — Core 3 Hook Migration (Minimum viable upgrade, custom UI preserved)

**Principle**: Migrate legacy hook API to Core 3 new API within the existing component structure. Does not change the server/client boundary, but modernizes the Clerk call surface for Core 3 compatibility.

This is the minimum required change for the current `chore/clerk-core3-upgrade` branch. It is additive to either Path A or Path B.

**Changes required per component:**

`sign-in-email-input.tsx`:
```tsx
// Before (legacy):
import { useSignIn } from "@clerk/nextjs/legacy"
const { signIn } = useSignIn()
await signIn.create({ identifier: data.email })
const factors = signIn.supportedFirstFactors
const emailFactor = factors.find(f => f.strategy === "email_code")
await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId })

// After (Core 3):
import { useSignIn } from "@clerk/nextjs"  // default, not /legacy
const { signIn } = useSignIn()
await signIn.emailCode.sendCode({ emailAddress: data.email })
// No need to find emailAddressId — Core 3 handles this internally
```

`sign-in-code-verification.tsx`:
```tsx
// Before (legacy):
await signIn.attemptFirstFactor({ strategy: "email_code", code: value })
if (result.status === "complete") await setActive({ session: result.createdSessionId })

// After (Core 3):
await signIn.emailCode.verifyCode({ code: value })
if (signIn.status === "complete") await signIn.finalize()
// No need for setActive — finalize() handles session creation
```

`sign-up-email-input.tsx`:
```tsx
// Before (legacy):
await signUp.create({ emailAddress: data.email })
await signUp.prepareEmailAddressVerification({ strategy: "email_code" })

// After (Core 3):
await signUp.emailCode.sendCode({ emailAddress: data.email })
// invitation ticket: signUp.ticket({ ticket: invitationTicket })
```

`sign-up-code-verification.tsx`:
```tsx
// Before (legacy):
await signUp.attemptEmailAddressVerification({ code: value })
if (result.status === "complete") await setActive({ session: result.createdSessionId })

// After (Core 3):
await signUp.emailCode.verifyCode({ code: value })
if (signUp.status === "complete") await signUp.finalize()
```

---

## Recommendation

Given:
1. The app is mid-upgrade on `chore/clerk-core3-upgrade`
2. The goal is server-first with maximum server-side purity
3. The existing custom UI has been carefully designed (waitlist handling, invitation tickets, password-dev-only flow, SSO callbacks)
4. nuqs is already established in the codebase (`apps/console` uses `NuqsAdapter` + `createSearchParamsCache`)

**Recommended implementation: Path B (nuqs + server actions + Core 3 hooks)**

This is the most efficient and accretive approach because it:
- Preserves the existing custom UI (no visual changes)
- Reduces client JS from ~800+ lines to ~105 lines
- Makes the email and password forms work without JavaScript (progressive enhancement)
- Leverages server-side password verification (`clerkClient.users.verifyPassword`)
- Uses established patterns already in the codebase (nuqs, server actions)
- Migrates to Core 3 hook API simultaneously (required for the upgrade branch)
- Removes `@vendor/forms` and `@hookform/resolvers` from auth dependencies
- URL-driven state makes auth flow debuggable, bookmarkable, and back-button friendly

**Implementation order:**
1. Add nuqs + `NuqsAdapter` to auth app
2. Create `_lib/search-params.ts` with nuqs cache definitions
3. Create `_actions/sign-in.ts` and `_actions/sign-up.ts` server actions
4. Create `_actions/sign-in-password.ts` with `clerkClient.users.verifyPassword` + `createSignInToken`
5. Build client islands: `otp-island.tsx`, `oauth-button.tsx`, `session-activator.tsx` (Core 3 hook API)
6. Rewrite `sign-in/page.tsx` and `sign-up/page.tsx` as server components with nuqs step routing
7. Delete all old `"use client"` form components (12 files)
8. Remove `@hookform/resolvers` and `@vendor/forms` from auth dependencies

**Path A (Clerk prebuilt components) as fallback** if custom UI maintenance becomes too costly. This eliminates ALL custom auth code but trades design control.

**The SSO callback pages cannot be changed**: `AuthenticateWithRedirectCallback` is Clerk's component and is required for the OAuth flow to complete. These pages remain `"use client"` regardless of which path is taken.

---

## Code References

- `apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx` — root sign-in orchestrator, manages step state
- `apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx` — root sign-up orchestrator, reads `__clerk_ticket` from URL
- `apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx` — email submission + OTP initiation (useSignIn via vendor client)
- `apps/auth/src/app/(app)/(auth)/_components/sign-in-code-verification.tsx` — OTP verify + setActive (useSignIn via vendor client)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx` — GitHub OAuth button (useSignIn legacy)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx` — GitHub OAuth + invitation ticket handling (useSignUp legacy + useClerk)
- `apps/auth/src/app/hooks/use-code-verification.ts` — pure UI state hook (no Clerk, reusable)
- `apps/auth/src/app/lib/clerk/error-handler.ts` — Sentry-integrated error classifier (server-compatible)
- `apps/auth/src/app/lib/clerk/error-handling.ts` — Clerk error type utilities (server-compatible)
- `apps/auth/src/middleware.ts` — clerkMiddleware, session-aware routing (already server-side)
- `vendor/clerk/src/client/index.ts:51` — note about legacy useSignIn/useSignUp exports
- `vendor/clerk/src/server.ts` — all server-side Clerk exports including clerkClient

## Architecture Documentation

**Clerk's client/server split is enforced by Clerk's own architecture, not by Next.js**. FAPI (Frontend API) is a browser-accessible REST endpoint that manages auth state via a per-browser `Client` object tracked with an HttpOnly cookie. BAPI (Backend API) manages already-known user accounts. The two halves don't overlap for auth initiation.

**The vendor abstraction** (`@vendor/clerk/client`, `@vendor/clerk/server`) already correctly models this split. `@vendor/clerk/server` uses `import "server-only"` at line 1. `@vendor/clerk/client` exports all client hooks and UI components.

**OAuth flow cannot be server-side**: `signIn.authenticateWithRedirect()` triggers a browser navigation to the OAuth provider. The callback (`/sign-in/sso-callback`) uses `AuthenticateWithRedirectCallback` which exchanges the OAuth code with Clerk's FAPI via client-side JS. This is fundamental to how OAuth works across all providers.

## Related Research

- `thoughts/shared/plans/2026-03-08-clerk-core3-upgrade.md` — upgrade plan for the current branch; Phase 3.2 already documents the `SignedOut` → `Show` migration in `layout.tsx`

## Open Questions

1. **Appearance API feasibility**: Does Clerk's `appearance` API provide sufficient design system integration to match the current custom UI (PP Neue Montreal font, `bg-destructive/30` waitlist card, custom OTP slots)?
2. **Invitation ticket with Clerk's `<SignUp />`**: Does Clerk's prebuilt component automatically handle `__clerk_ticket` in the query string for invitation-based sign-ups?
3. **Password flow (dev-only)**: Clerk's `<SignIn />` component will show password if the Clerk instance has passwords enabled. If the instance has password disabled for production but enabled for dev, does the component respect this automatically?
4. **Waitlist redirect**: `ClerkProvider` already has `waitlistUrl="/early-access"`. Does `<SignIn />` and `<SignUp />` use this prop automatically when encountering waitlist restrictions?

---

## Follow-up Research 2026-03-09

### Topic: Delete error-handler.ts + error-handling.ts — Simplified Error Handling Design

**Context**: `apps/auth/src/app/lib/clerk/error-handler.ts` and `apps/auth/src/app/lib/clerk/error-handling.ts` are to be deleted. These two files collectively provide Sentry capture wrappers, error type classification (`isRateLimitError`, `isAccountLockedError`, `isSignUpRestricted`), retry-after extraction, and formatted lockout time display. In the Path B architecture (server actions + tiny islands), error handling is simpler and more direct because:

1. **Server actions** redirect errors into URL params — no error objects need to be passed across the network boundary
2. **Client islands** are small enough (~50 lines) to handle errors inline
3. **Clerk's `isClerkAPIResponseError`** is already re-exported from `@vendor/clerk` (root index) — no wrapper needed
4. **Sentry** auto-captures unhandled errors via the `@sentry/nextjs` instrumentation already in `instrumentation.ts` and `instrumentation-client.ts`

---

### Clerk Backend API Error Structure (BAPI)

When `clerkClient()` methods throw in a server action, the error is a `ClerkAPIResponseError`. The shape:

```typescript
// From @clerk/shared/error — already re-exported as isClerkAPIResponseError from @vendor/clerk
{
  status: 422,           // HTTP status (400, 403, 404, 422, 429, etc.)
  errors: [
    {
      code: "identifier_not_found",           // machine-readable error code
      message: "Couldn't find your account",  // short message
      longMessage: "Couldn't find your account. Please check your email...", // detailed
      meta: { ... }     // additional structured data (e.g. lockout_expires_in_seconds)
    }
  ],
  clerkTraceId: "..."    // trace ID for Clerk support
}
```

Key BAPI error codes relevant to auth:
- `identifier_not_found` — email not registered (sign-in)
- `form_password_incorrect` — wrong password
- `user_locked` — account locked, `meta.lockout_expires_in_seconds` present
- `too_many_requests` / `err.status === 429` — rate limited
- `sign_up_restricted_waitlist` — waitlist restriction

FAPI errors (in client islands) have the same shape. The `isClerkAPIResponseError` type guard works for both.

---

### Simplified Error Handling Patterns

**Pattern 1 — Server action (redirect errors to URL):**

```typescript
// _actions/sign-in.ts
"use server"
import { redirect } from "next/navigation"
import { isClerkAPIResponseError } from "@vendor/clerk"
import { captureException } from "@sentry/nextjs"

export async function signInWithPassword(formData: FormData) {
  try {
    const client = await clerkClient()
    // ... clerkClient calls
  } catch (err) {
    if (isClerkAPIResponseError(err)) {
      const code = err.errors[0]?.code
      const message = err.errors[0]?.longMessage ?? err.errors[0]?.message ?? "Sign in failed"

      if (code === "user_locked") {
        redirect(`/sign-in?step=password&error=${encodeURIComponent("Account locked. Please try again later.")}`)
      }
      redirect(`/sign-in?step=password&error=${encodeURIComponent(message)}`)
    }
    // Unknown errors: capture and show generic message
    captureException(err)
    redirect(`/sign-in?step=password&error=${encodeURIComponent("An unexpected error occurred")}`)
  }
}
```

No wrapper needed. `isClerkAPIResponseError` → `err.errors[0].code` → `redirect`. Sentry only for unknown errors.

**Pattern 2 — Client island inline error state:**

```typescript
// Inside OTPIsland, OAuthButton, SessionActivator
import { isClerkAPIResponseError } from "@vendor/clerk"

try {
  await signIn.emailCode.verifyCode({ code })
  // ...
} catch (err) {
  if (isClerkAPIResponseError(err)) {
    const firstError = err.errors[0]
    const code = firstError?.code

    if (code === "too_many_requests" || err.status === 429) {
      setError("Too many attempts. Please wait a moment and try again.")
    } else if (code === "user_locked") {
      setError("Account locked. Please try again later.")
    } else if (code === "sign_up_restricted_waitlist") {
      onError?.("Sign-ups are currently unavailable.", true) // surface to parent
    } else {
      setError(firstError?.longMessage ?? firstError?.message ?? "Verification failed")
    }
  } else {
    setError("An unexpected error occurred. Please try again.")
  }
}
```

All logic is inline, visible, and ~15 lines. No abstraction layer.

**Pattern 3 — Unexpected status (was `handleUnexpectedStatus`):**

In Core 3, `signIn.status` / `signUp.status` values are typed. There is no need for a separate handler — unexpected states should not occur if the flow is correctly sequenced. If they do, a simple `captureException(new Error(...))` inline suffices.

---

### What `error-handler.ts` + `error-handling.ts` Provided vs What Replaces It

| Feature | Old files | New approach |
|---|---|---|
| `getErrorMessage(err)` | Extracts `longMessage \|\| message` from ClerkAPIResponseError | Inline: `err.errors[0]?.longMessage ?? err.errors[0]?.message` |
| `isRateLimitError(err)` | Checks `status === 429` or `code === "too_many_requests"` | Inline: `err.status === 429 \|\| err.errors[0]?.code === "too_many_requests"` |
| `isAccountLockedError(err)` | Checks `isUserLockedError` + extracts `meta.lockout_expires_in_seconds` | Inline: `err.errors[0]?.code === "user_locked"` (lockout time rarely shown) |
| `isSignUpRestricted(err)` | Checks `code === "sign_up_restricted_waitlist"` | Inline: `err.errors[0]?.code === "sign_up_restricted_waitlist"` |
| `formatLockoutTime(seconds)` | Formats seconds to human-readable | Not needed in new design (lockout time not extracted — server-side lockout is opaque) |
| `handleUnexpectedStatus(status)` | Sends non-complete states to Sentry | Not needed — Core 3 status values are typed; unexpected states are exceptions |
| Sentry capture with context | `captureException(sentryError, { tags, extra })` | Direct `captureException(err)` — Sentry SDK already attaches tags from instrumentation |
| PII stripping (email from context) | Explicit `const { email: _email, ...safeContext } = context` | Not needed — no context object constructed; server action never sends email to Sentry |

**Net result**: ~270 lines of abstraction → ~15 lines of inline logic per island, zero lines in server actions (redirect handles everything).

---

### Files to Delete

```
apps/auth/src/app/lib/clerk/error-handler.ts    — 144 lines, 0 remaining usages after migration
apps/auth/src/app/lib/clerk/error-handling.ts   — 152 lines, 0 remaining usages after migration
```

All 8 call sites (one per component that calls a Clerk async method) move to inline error handling in their respective client islands or server actions.

**`isUserLockedError` import**: The old `error-handling.ts` used `isUserLockedError` from `@vendor/clerk`. In the new design, checking `err.errors[0]?.code === "user_locked"` is equivalent and doesn't require this type guard import.

---

### Step Addition to Path B Implementation Order

Revised step 8 in the implementation order:

```
8. Delete error-handler.ts and error-handling.ts
9. Remove @hookform/resolvers and @vendor/forms from auth dependencies
```

The deletion of the two error files is safe once all 8 call-site components are replaced by the new islands (step 7 in the original order).
