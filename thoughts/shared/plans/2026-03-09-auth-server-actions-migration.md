# Auth Server Actions Migration — Implementation Plan

## Overview

Migrate `apps/auth` from fully client-side Clerk legacy hooks (`useSignIn`/`useSignUp` from `@clerk/nextjs/legacy`) to a server-actions-first architecture using `clerkClient` from `@vendor/clerk/server`. URL-driven step state via nuqs replaces `React.useState` orchestration. Client JS drops from ~800+ lines across 13 components to ~120 lines across 3 irreducible islands.

## Current State Analysis

### What exists now

13 `"use client"` components manage the entire sign-in/sign-up flow:
- `sign-in-form.tsx` / `sign-up-form.tsx` — step orchestrators using `React.useState`
- `sign-in-email-input.tsx` / `sign-up-email-input.tsx` — email forms using `react-hook-form` + `zod` + legacy `useSignIn`/`useSignUp`
- `sign-in-code-verification.tsx` / `sign-up-code-verification.tsx` — OTP verification using legacy hooks + `setActive`
- `sign-in-password.tsx` / `sign-up-password.tsx` — password forms (dev/preview only) using legacy hooks
- `oauth-sign-in.tsx` / `oauth-sign-up.tsx` — GitHub OAuth buttons using legacy hooks
- `shared/code-verification-ui.tsx` — pure OTP input UI component
- `use-code-verification.ts` — UI state hook for OTP input

Supporting utilities:
- `error-handler.ts` (144 lines) — Sentry-integrated error classifier with `handleClerkError`, `handleUnexpectedStatus`
- `error-handling.ts` (152 lines) — error type utilities: `getErrorMessage`, `isRateLimitError`, `isAccountLockedError`, `isSignUpRestricted`, `formatLockoutTime`

All forms use `@vendor/forms` (react-hook-form wrapper) + `@hookform/resolvers` for validation.

### Key constraints

- Clerk's FAPI (Frontend API) is the **only** way to: send OTPs, verify OTPs, initiate OAuth redirects, write session cookies. No BAPI equivalent exists. ([source: Clerk architecture docs](https://clerk.com/docs/guides/how-clerk-works/overview))
- `clerkClient` (BAPI) **can**: look up users, verify passwords, create sign-in tokens, create users with auto-verified email, manage sessions.
- Session cookie creation requires a browser-side FAPI call — `signIn.ticket()` + `signIn.finalize()` or equivalent. This is architecturally unavoidable.
- The vendor abstraction at `vendor/clerk/src/client/index.ts:46` sources `useSignIn`/`useSignUp` from `@clerk/nextjs/legacy`. Must switch to `@clerk/nextjs` for Core 3 API in the islands.

### What's already server-side (no changes needed)

- `middleware.ts` — `clerkMiddleware` with route protection and redirect logic
- `sign-in/page.tsx`, `sign-up/page.tsx` — server components (just render form components)
- `layout.tsx` (auth) — server component with `<Show>` and `<RedirectToTasks>`
- `layout.tsx` (root) — server component wrapping `<ClerkProvider>`
- `sign-in/sso-callback/page.tsx`, `sign-up/sso-callback/page.tsx` — `AuthenticateWithRedirectCallback` (Clerk's own component, unchanged)

## Desired End State

```
src/app/(app)/(auth)/
├── _actions/
│   ├── sign-in.ts                     "use server" — email validation, redirect to ?step=code
│   ├── sign-up.ts                     "use server" — email validation, redirect to ?step=code
│   └── sign-in-password.ts            "use server" — clerkClient password verify + sign-in token
├── _components/
│   ├── email-form.tsx                 Server Component — <form action={serverAction}>
│   ├── password-form.tsx              Server Component — <form action={passwordAction}>
│   ├── error-banner.tsx               Server Component — reads ?error from URL
│   ├── otp-island.tsx                 "use client" island — OTP input + FAPI verify (~55 lines)
│   ├── oauth-button.tsx               "use client" island — triggers OAuth redirect (~30 lines)
│   └── session-activator.tsx          "use client" island — exchanges sign-in token for session (~20 lines)
├── _lib/
│   └── search-params.ts              nuqs parser config — createSearchParamsCache
├── sign-in/
│   ├── page.tsx                       Server Component — reads step from nuqs, renders correct form
│   └── sso-callback/page.tsx          "use client" — unchanged
└── sign-up/
    ├── page.tsx                       Server Component — reads step from nuqs, renders correct form
    └── sso-callback/page.tsx          "use client" — unchanged
```

**Client components**: 5 files, ~120 lines total (3 islands + 2 SSO callbacks unchanged)
**Server components**: 5 files (2 pages, 2 forms, 1 error banner)
**Server actions**: 3 files
**Config**: 1 file (nuqs search params)

### Verification

1. `pnpm --filter @lightfast/auth typecheck` passes
2. `pnpm check` passes (Biome lint)
3. Sign-in email OTP flow works: email → code → redirect to console
4. Sign-in password flow works (dev/preview only): email + password → redirect to console
5. Sign-up email OTP flow works: email → code → redirect to console
6. Sign-up with invitation ticket works: `?__clerk_ticket=xxx` → auto-complete or code → redirect
7. OAuth sign-in/sign-up works: GitHub button → SSO callback → redirect
8. Waitlist restriction errors display correctly with "Join the Waitlist" CTA
9. Rate limit and account locked errors display correctly
10. Back button and URL state work correctly (bookmarkable steps)

## What We're NOT Doing

- **Removing OTP for sign-in**: FAPI OTP is kept because it provides email ownership verification. The sign-in token approach (`clerkClient.signInTokens`) skips this verification and is only used for password-authenticated sessions.
- **Building custom email/OTP system**: Server-side OTP would require our own email sending + code storage infrastructure. Not worth it when Clerk FAPI handles this.
- **Changing the OAuth flow**: SSO callback pages remain `"use client"` with `AuthenticateWithRedirectCallback`. This is Clerk's component and architecturally required.
- **Changing the redirect destination**: All successful auth paths continue to redirect to `${consoleUrl}/account/teams/new`.
- **Modifying the auth layout**: Header, logo, "Join the Early Access" button, spacing — all unchanged.
- **Touching middleware.ts**: Already server-side, no changes needed.

## Implementation Approach

**Module split:**
- **Server actions**: `clerkClient` from `@vendor/clerk/server` — email validation, password verification (`clerkClient.users.verifyPassword`), sign-in token creation (`clerkClient.signInTokens.createSignInToken`), user lookup (`clerkClient.users.getUserList`)
- **Client islands**: Core 3 `useSignIn`/`useSignUp` from `@vendor/clerk/client` (after updating vendor export from `@clerk/nextjs/legacy` to `@clerk/nextjs`) — only for irreducible FAPI calls: OTP send/verify, OAuth redirect, session activation

**State management**: nuqs `createSearchParamsCache` for server-side URL param parsing. Server actions use `redirect()` to transition steps. No `React.useState` for step management.

**Error handling**: Inline in server actions (redirect to `?error=...`) and client islands (`useState`). Delete `error-handler.ts` and `error-handling.ts`. `isClerkAPIResponseError` imported directly from `@vendor/clerk`.

---

## Phase 1: Infrastructure

### Overview
Add nuqs to auth app, set up `NuqsAdapter`, create search params configuration, and update vendor clerk exports for Core 3.

### Changes Required:

#### 1. Add nuqs to auth app
**File**: `apps/auth/package.json`
**Changes**: Add `nuqs` dependency

```json
"dependencies": {
    ...
    "nuqs": "^2.8.9",
    ...
}
```

Then run `pnpm install` from repo root.

#### 2. Add NuqsAdapter to root layout
**File**: `apps/auth/src/app/layout.tsx`
**Changes**: Wrap children with `NuqsAdapter` inside `ClerkProvider` (same pattern as `apps/console/src/app/(app)/layout.tsx:26`)

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

// Inside the return, wrap {children}:
<ClerkProvider ...>
  <NuqsAdapter>
    {children}
  </NuqsAdapter>
  <Toaster position="bottom-right" />
  ...
</ClerkProvider>
```

#### 3. Create nuqs search params cache
**File**: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts` (NEW)
**Changes**: Define typed search param parsers for sign-in and sign-up pages

```ts
import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const signInSteps = ["email", "code", "password", "activate"] as const;
const signUpSteps = ["email", "code", "password"] as const;

export const signInSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,
});

export const signUpSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(signUpSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,
  __clerk_ticket: parseAsString, // Clerk invitation URL parameter
  waitlist: parseAsString,
});
```

#### 4. Update vendor clerk exports to Core 3
**File**: `vendor/clerk/src/client/index.ts`
**Changes**: Switch `useSignIn`/`useSignUp` from `@clerk/nextjs/legacy` to `@clerk/nextjs` (Core 3 API)

```ts
// Before (line 45-46):
// useSignIn and useSignUp use the legacy programmatic API (Core 3 replaced with components-based API)
export { useSignIn, useSignUp } from "@clerk/nextjs/legacy";

// After:
// useSignIn and useSignUp use Core 3 programmatic API (signIn.emailCode.sendCode, signIn.finalize, etc.)
export { useSignIn, useSignUp } from "@clerk/nextjs";
```

This is safe because ALL consumers of `useSignIn`/`useSignUp` are in `apps/auth` and will be replaced in this migration. No other app uses these hooks.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm check` passes

#### Manual Verification:
- [ ] Existing auth flows still work (this phase makes no behavioral changes)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server Actions

### Overview
Create the three server action files. These handle form submissions, validation, and `clerkClient` operations. They redirect to URL-based steps and error states.

### Changes Required:

#### 1. Sign-in server action (email OTP initiation)
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts` (NEW)
**Changes**: Validate email, redirect to OTP step

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function initiateSignIn(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }

  // Email validated. Redirect to OTP step — the client island will call
  // signIn.emailCode.sendCode() via Clerk's FAPI.
  redirect(
    `/sign-in?step=code&email=${encodeURIComponent(parsed.data.email)}`
  );
}
```

#### 2. Sign-in password server action (fully server-side verification)
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-in-password.ts` (NEW)
**Changes**: Verify password via `clerkClient`, create sign-in token, redirect to session activator

```ts
"use server";

import { redirect } from "next/navigation";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { clerkClient } from "@vendor/clerk/server";
import { captureException } from "@sentry/nextjs";
import { z } from "zod";

const passwordSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      `/sign-in?step=password&error=${encodeURIComponent("Invalid credentials")}`
    );
  }

  try {
    const client = await clerkClient();

    // 1. Find user by email
    const users = await client.users.getUserList({
      emailAddress: [parsed.data.identifier],
    });
    const user = users.data[0];
    if (!user) {
      redirect(
        `/sign-in?step=password&error=${encodeURIComponent("Account not found")}`
      );
    }

    // 2. Verify password server-side (never touches client)
    await client.users.verifyPassword({
      userId: user.id,
      password: parsed.data.password,
    });

    // 3. Mint a short-lived sign-in token
    const { token } = await client.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 60,
    });

    // 4. Redirect to session activator (thin client island)
    redirect(`/sign-in?step=activate&token=${token}`);
  } catch (err) {
    // redirect() throws — let it propagate
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
      throw err;
    }

    if (isClerkAPIResponseError(err)) {
      const code = err.errors[0]?.code;
      if (code === "user_locked") {
        redirect(
          `/sign-in?step=password&error=${encodeURIComponent("Account locked. Please try again later.")}`
        );
      }
      if (code === "too_many_requests" || err.status === 429) {
        redirect(
          `/sign-in?step=password&error=${encodeURIComponent("Too many attempts. Please wait and try again.")}`
        );
      }
      const message =
        err.errors[0]?.longMessage ??
        err.errors[0]?.message ??
        "Invalid email or password";
      redirect(
        `/sign-in?step=password&error=${encodeURIComponent(message)}`
      );
    }

    captureException(err);
    redirect(
      `/sign-in?step=password&error=${encodeURIComponent("An unexpected error occurred")}`
    );
  }
}
```

#### 3. Sign-up server action (email validation + invitation ticket detection)
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts` (NEW)
**Changes**: Validate email, preserve invitation ticket in URL, redirect to OTP step

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  ticket: z.string().optional(),
});

export async function initiateSignUp(formData: FormData) {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    ticket: formData.get("ticket") || undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    const ticketParam = formData.get("ticket")
      ? `&ticket=${encodeURIComponent(formData.get("ticket") as string)}`
      : "";
    redirect(`/sign-up?error=${encodeURIComponent(message)}${ticketParam}`);
  }

  // Email validated. Redirect to OTP step — the client island will handle
  // signUp.emailCode.sendCode() or signUp.ticket() via Clerk's FAPI.
  const ticketParam = parsed.data.ticket
    ? `&ticket=${encodeURIComponent(parsed.data.ticket)}`
    : "";
  redirect(
    `/sign-up?step=code&email=${encodeURIComponent(parsed.data.email)}${ticketParam}`
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm check` passes
- [ ] All three action files compile without errors

#### Manual Verification:
- [ ] N/A — actions are not wired to UI yet

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Client Islands

### Overview
Build the 3 minimal client islands that handle irreducible Clerk FAPI calls. These use Core 3 `useSignIn`/`useSignUp` hooks (updated in Phase 1).

### Changes Required:

#### 1. OTP Island (sign-in + sign-up shared)
**File**: `apps/auth/src/app/(app)/(auth)/_components/otp-island.tsx` (NEW)
**Changes**: Handles OTP send, verify, resend, and invitation ticket exchange. Preserves the existing `CodeVerificationUI` visuals from `shared/code-verification-ui.tsx`.

```tsx
"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface OTPIslandProps {
  email: string;
  mode: "sign-in" | "sign-up";
  ticket?: string | null;
  onError?: (message: string, isWaitlist?: boolean) => void;
}

export function OTPIsland({ email, mode, ticket, onError }: OTPIslandProps) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);

  function navigateToConsole() {
    window.location.href = `${consoleUrl}/account/teams/new`;
  }

  function handleClerkError(err: unknown) {
    if (isClerkAPIResponseError(err)) {
      const first = err.errors[0];
      const errCode = first?.code;

      if (errCode === "too_many_requests" || err.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }
      if (errCode === "user_locked") {
        setError("Account locked. Please try again later.");
        return;
      }
      if (errCode === "sign_up_restricted_waitlist") {
        onError?.(
          "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
          true
        );
        return;
      }
      setError(first?.longMessage ?? first?.message ?? "Verification failed");
      return;
    }
    setError("An unexpected error occurred. Please try again.");
  }

  // Send OTP on mount (or handle ticket)
  React.useEffect(() => {
    async function init() {
      try {
        if (mode === "sign-up" && ticket) {
          // Invitation ticket flow — may auto-complete
          await signUp.ticket({ ticket });
          if (signUp.status === "complete") {
            setIsRedirecting(true);
            await signUp.finalize({
              navigate: async () => navigateToConsole(),
            });
            return;
          }
          // Ticket didn't auto-complete — fall through to email code
        }

        if (mode === "sign-in") {
          await signIn.emailCode.sendCode({ emailAddress: email });
        } else {
          await signUp.emailCode.sendCode({ emailAddress: email });
        }
      } catch (err) {
        handleClerkError(err);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Auto-verify when 6 digits entered
  React.useEffect(() => {
    if (code.length !== 6 || error) return;

    async function verify() {
      setIsVerifying(true);
      try {
        if (mode === "sign-in") {
          await signIn.emailCode.verifyCode({ code });
          if (signIn.status === "complete") {
            setIsRedirecting(true);
            await signIn.finalize({
              navigate: async () => navigateToConsole(),
            });
          }
        } else {
          await signUp.emailCode.verifyCode({ code });
          if (signUp.status === "complete") {
            setIsRedirecting(true);
            await signUp.finalize({
              navigate: async () => navigateToConsole(),
            });
          }
        }
      } catch (err) {
        handleClerkError(err);
        setIsVerifying(false);
      }
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trigger on code change
  }, [code, error]);

  async function handleResendCode() {
    setIsResending(true);
    setError(null);
    try {
      if (mode === "sign-in") {
        await signIn.emailCode.sendCode({ emailAddress: email });
      } else {
        await signUp.emailCode.sendCode({ emailAddress: email });
      }
      toast.success("Verification code sent to your email");
      setCode("");
    } catch (err) {
      handleClerkError(err);
    }
    setIsResending(false);
  }

  function handleCodeChange(value: string) {
    setError(null);
    setCode(value);
  }

  function handleReset() {
    // Navigate back to email step (server-side URL)
    if (mode === "sign-in") {
      window.location.href = "/sign-in";
    } else {
      const ticketParam = ticket
        ? `?__clerk_ticket=${encodeURIComponent(ticket)}`
        : "";
      window.location.href = `/sign-up${ticketParam}`;
    }
  }

  return (
    <CodeVerificationUI
      code={code}
      email={email}
      inlineError={error}
      isRedirecting={isRedirecting}
      isResending={isResending}
      isVerifying={isVerifying}
      onCodeChange={handleCodeChange}
      onResend={handleResendCode}
      onReset={handleReset}
    />
  );
}
```

#### 2. OAuth Button (sign-in + sign-up shared)
**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx` (NEW)
**Changes**: Handles GitHub OAuth redirect. Handles invitation ticket for sign-up (ticket exchange before redirect).

```tsx
"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { useClerk, useSignIn, useSignUp } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";

interface OAuthButtonProps {
  mode: "sign-in" | "sign-up";
  ticket?: string | null;
  onError?: (message: string, isWaitlist?: boolean) => void;
}

export function OAuthButton({ mode, ticket, onError }: OAuthButtonProps) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { setActive } = useClerk();
  const [loading, setLoading] = React.useState(false);

  async function handleOAuth(strategy: OAuthStrategy) {
    setLoading(true);
    try {
      // If sign-up with invitation ticket, try ticket strategy first
      // (OAuth redirect cannot carry ticket context)
      if (mode === "sign-up" && ticket) {
        const attempt = await signUp.create({
          strategy: "ticket",
          ticket,
        });
        if (attempt.status === "complete") {
          await setActive({ session: attempt.createdSessionId });
          window.location.href = `${consoleUrl}/account/teams/new`;
          return;
        }
        // Ticket didn't auto-complete — OAuth can't help here
        onError?.(
          "Please use the email option above to complete your invitation sign-up."
        );
        setLoading(false);
        return;
      }

      if (mode === "sign-in") {
        await signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: "/sign-in/sso-callback",
          redirectUrlComplete: `${consoleUrl}/account/teams/new`,
        });
      } else {
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl: "/sign-up/sso-callback",
          redirectUrlComplete: `${consoleUrl}/account/teams/new`,
        });
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        const code = err.errors[0]?.code;
        if (code === "sign_up_restricted_waitlist") {
          onError?.(
            "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
            true
          );
        } else {
          toast.error(
            err.errors[0]?.longMessage ??
              err.errors[0]?.message ??
              "Authentication failed"
          );
        }
      } else {
        toast.error("An unexpected error occurred");
      }
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={() => handleOAuth("oauth_github")}
      size="lg"
      variant="outline"
    >
      {loading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      Continue with GitHub
    </Button>
  );
}
```

#### 3. Session Activator (password sign-in → token exchange)
**File**: `apps/auth/src/app/(app)/(auth)/_components/session-activator.tsx` (NEW)
**Changes**: Exchanges a server-generated sign-in token for a browser session via Clerk FAPI

```tsx
"use client";

import { Icons } from "@repo/ui/components/icons";
import { useSignIn } from "@vendor/clerk/client";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";

interface SessionActivatorProps {
  token: string;
}

export function SessionActivator({ token }: SessionActivatorProps) {
  const { signIn } = useSignIn();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    signIn
      .ticket({ ticket: token })
      .then(() => {
        if (signIn.status === "complete") {
          signIn.finalize({
            navigate: async () => {
              window.location.href = `${consoleUrl}/account/teams/new`;
            },
          });
        }
      })
      .catch(() => {
        setError("Sign-in failed. Please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <a className="text-muted-foreground text-sm underline" href="/sign-in">
          Back to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Signing in...</span>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm check` passes

#### Manual Verification:
- [ ] N/A — islands are not wired to pages yet

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Page Rewrite

### Overview
Rewrite `sign-in/page.tsx` and `sign-up/page.tsx` as server components that read URL state via nuqs, render server component forms with `<form action={serverAction}>`, and mount client islands only for irreducible FAPI steps. Create the server component forms (`email-form.tsx`, `password-form.tsx`, `error-banner.tsx`).

### Changes Required:

#### 1. Error Banner (server component)
**File**: `apps/auth/src/app/(app)/(auth)/_components/error-banner.tsx` (NEW)
**Changes**: Renders error/waitlist messages from URL params. Pure server component.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";

interface ErrorBannerProps {
  backUrl: string;
  isWaitlist: boolean;
  message: string;
}

export function ErrorBanner({ message, isWaitlist, backUrl }: ErrorBannerProps) {
  if (isWaitlist) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{message}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <MicrofrontendLink href="/early-access">
            Join the Waitlist
          </MicrofrontendLink>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={backUrl}>Back</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-red-800 text-sm">{message}</p>
      </div>
      <Button asChild className="w-full" size="lg" variant="outline">
        <a href={backUrl}>Try again</a>
      </Button>
    </div>
  );
}
```

#### 2. Email Form (server component)
**File**: `apps/auth/src/app/(app)/(auth)/_components/email-form.tsx` (NEW)
**Changes**: Native HTML form with server action. No `"use client"`, no hooks, no react-hook-form.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { initiateSignIn } from "../_actions/sign-in";
import { initiateSignUp } from "../_actions/sign-up";

interface EmailFormProps {
  action: "sign-in" | "sign-up";
  ticket?: string | null;
}

export function EmailForm({ action, ticket }: EmailFormProps) {
  const serverAction = action === "sign-in" ? initiateSignIn : initiateSignUp;

  return (
    <form action={serverAction} className="space-y-4">
      {ticket && <input name="ticket" type="hidden" value={ticket} />}
      <Input
        className="h-12 bg-background dark:bg-background"
        name="email"
        placeholder="Email Address"
        required
        type="email"
      />
      <Button className="w-full" size="lg" type="submit">
        Continue with Email
      </Button>
    </form>
  );
}
```

#### 3. Password Form (server component)
**File**: `apps/auth/src/app/(app)/(auth)/_components/password-form.tsx` (NEW)
**Changes**: Native HTML form with server action. Dev/preview only.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { signInWithPassword } from "../_actions/sign-in-password";

export function PasswordForm() {
  return (
    <form action={signInWithPassword} className="space-y-4">
      <Input
        className="bg-background dark:bg-background"
        name="identifier"
        placeholder="Email or username"
        required
        type="text"
      />
      <Input
        className="bg-background dark:bg-background"
        name="password"
        placeholder="Password"
        required
        type="password"
      />
      <Button className="w-full" size="lg" type="submit">
        Sign in with Password
      </Button>
    </form>
  );
}
```

#### 4. Sign-in page (server component with nuqs step routing)
**File**: `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx`
**Changes**: Complete rewrite. Reads step from nuqs, renders appropriate server/client component.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata, SearchParams } from "next";
import { env } from "~/env";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { OTPIsland } from "../_components/otp-island";
import { PasswordForm } from "../_components/password-form";
import { SessionActivator } from "../_components/session-activator";
import { signInSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Sign In - Lightfast Auth",
  description:
    "Sign in to your Lightfast account to access the AI agent platform. Secure authentication portal for developers.",
  openGraph: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-in",
  },
  twitter: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-in",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { step, email, error, token, waitlist } =
    await signInSearchParams.parse(searchParams);

  const showPasswordSignIn = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  return (
    <div className="w-full space-y-8">
      {/* Header — only on email and password steps */}
      {(step === "email" || step === "password") && !error && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Log in to Lightfast
          </h1>
        </div>
      )}

      <div className="space-y-4">
        {/* Error display */}
        {error && (
          <ErrorBanner
            backUrl="/sign-in"
            isWaitlist={waitlist === "true"}
            message={error}
          />
        )}

        {/* Step: email — server component form + client OAuth island */}
        {!error && step === "email" && (
          <>
            <EmailForm action="sign-in" />

            {showPasswordSignIn && (
              <>
                <SeparatorWithText text="Or" />
                <Button asChild className="w-full" size="lg" variant="outline">
                  <a href="/sign-in?step=password">Sign in with Password</a>
                </Button>
              </>
            )}

            <SeparatorWithText text="Or" />
            <OAuthButton mode="sign-in" />
          </>
        )}

        {/* Step: password — server component form (dev/preview only) */}
        {!error && step === "password" && (
          <>
            <PasswordForm />
            <Button
              asChild
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
              variant="ghost"
            >
              <a href="/sign-in">← Back to other options</a>
            </Button>
          </>
        )}

        {/* Step: code — client island (irreducible: OTP + Clerk FAPI) */}
        {!error && step === "code" && email && (
          <OTPIsland email={email} mode="sign-in" />
        )}

        {/* Step: activate — thin client island for session creation */}
        {step === "activate" && token && <SessionActivator token={token} />}
      </div>
    </div>
  );
}

function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
```

#### 5. Sign-up page (server component with nuqs step routing)
**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`
**Changes**: Complete rewrite. Reads step + ticket from nuqs, renders appropriate server/client component.

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { createMetadata } from "@vendor/seo/metadata";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type { Metadata, SearchParams } from "next";
import NextLink from "next/link";
import { env } from "~/env";
import { EmailForm } from "../_components/email-form";
import { ErrorBanner } from "../_components/error-banner";
import { OAuthButton } from "../_components/oauth-button";
import { OTPIsland } from "../_components/otp-island";
import { signUpSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Sign Up - Lightfast Auth",
  description:
    "Create your Lightfast account to access the AI agent platform. Secure sign-up portal for developers.",
  openGraph: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-up",
  },
  twitter: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-up",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { step, email, error, ticket, __clerk_ticket, waitlist } =
    await signUpSearchParams.parse(searchParams);

  // Support both ?ticket= (nuqs) and ?__clerk_ticket= (Clerk invitation URL)
  const invitationTicket = ticket ?? __clerk_ticket ?? null;

  const showPasswordSignUp = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  const signUpBaseUrl = invitationTicket
    ? `/sign-up?__clerk_ticket=${encodeURIComponent(invitationTicket)}`
    : "/sign-up";

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header — only on email and password steps */}
      {(step === "email" || step === "password") && !error && (
        <div className="text-center">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            Sign up for Lightfast
          </h1>
        </div>
      )}

      {/* Invitation info */}
      {invitationTicket && step === "email" && !error && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-blue-800 text-sm">
            You've been invited to join Lightfast. Complete sign-up below.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Error display */}
        {error && (
          <ErrorBanner
            backUrl={signUpBaseUrl}
            isWaitlist={waitlist === "true"}
            message={error}
          />
        )}

        {/* Step: email — server component form + OAuth */}
        {!error && step === "email" && (
          <>
            <EmailForm
              action="sign-up"
              ticket={invitationTicket}
            />

            {/* Legal compliance */}
            <p className="text-center text-muted-foreground text-sm">
              By joining, you agree to our{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href="/legal/terms"
                rel="noopener noreferrer"
                target="_blank"
              >
                Terms of Service
              </MicrofrontendLink>{" "}
              and{" "}
              <MicrofrontendLink
                className="text-foreground underline hover:text-foreground/80"
                href="/legal/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </MicrofrontendLink>
            </p>

            {showPasswordSignUp && (
              <>
                <SeparatorWithText text="Or" />
                <Button asChild className="w-full" size="lg" variant="outline">
                  <a href={`${signUpBaseUrl}${invitationTicket ? "&" : "?"}step=password`}>
                    Sign up with Password
                  </a>
                </Button>
              </>
            )}

            <SeparatorWithText text="Or" />
            <OAuthButton
              mode="sign-up"
              ticket={invitationTicket}
            />
          </>
        )}

        {/* Step: password — need OTP island after password (sign-up requires email verification) */}
        {!error && step === "password" && (
          <>
            {/* Sign-up password still requires email verification after account creation.
                The OTP island handles signUp.create() + signUp.emailCode.sendCode().
                For sign-up password, we need a client island. */}
            <SignUpPasswordIsland
              onReset={() => {}}
            />
            <Button
              asChild
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
              variant="ghost"
            >
              <a href={signUpBaseUrl}>← Back to other options</a>
            </Button>
          </>
        )}

        {/* Step: code — client island (irreducible: OTP + Clerk FAPI) */}
        {!error && step === "code" && email && (
          <OTPIsland
            email={email}
            mode="sign-up"
            ticket={invitationTicket}
          />
        )}
      </div>

      {/* Sign In Link — only on email step */}
      {step === "email" && !error && (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?{" "}
          </span>
          <Button
            asChild
            className="inline-flex h-auto rounded-none p-0 text-sm"
            variant="link-blue"
          >
            <NextLink href="/sign-in" prefetch>
              Log In
            </NextLink>
          </Button>
        </div>
      )}
    </div>
  );
}

function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
```

**Note on sign-up password step**: The sign-up password flow (`sign-up-password.tsx`) creates a user with email+password and then requires email code verification. This inherently needs FAPI (`signUp.create` + `signUp.prepareEmailAddressVerification`). Since this flow is dev/preview only, the simplest approach is to keep the password form as a small client island or redirect to the sign-in password flow instead (since sign-in password is fully server-side). The exact approach for this dev-only flow should be decided during implementation — it can reuse the sign-in password server action pattern (`clerkClient.users.createUser` + `clerkClient.signInTokens.createSignInToken`) if we want to avoid FAPI entirely, but at the cost of skipping email verification for dev accounts.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm check` passes
- [ ] `pnpm build:auth` succeeds (no build errors)

#### Manual Verification:
- [ ] Sign-in email OTP: enter email → receive code → enter code → redirected to console
- [ ] Sign-in password (dev/preview): enter email+password → redirected to console
- [ ] Sign-up email OTP: enter email → receive code → enter code → redirected to console
- [ ] Sign-up with invitation ticket: `/sign-up?__clerk_ticket=xxx` → auto-complete or code → console
- [ ] OAuth sign-in: click GitHub → SSO callback → redirected to console
- [ ] OAuth sign-up: click GitHub → SSO callback → redirected to console
- [ ] Waitlist error: blocked sign-up shows "Join the Waitlist" CTA
- [ ] Invalid email shows error banner with "Try again"
- [ ] URL state: `/sign-in?step=code&email=test@example.com` renders OTP input directly
- [ ] Back button works: browser back from code step returns to email step
- [ ] Test accounts from `apps/auth/CLAUDE.md` work:
  - Password: `admin@lightfast.ai` / `ijXFdBJ3U2eMDFnKqngp`
  - Fresh account OTP: `some-email+clerk_test@lightfast.ai` / code `424242`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Cleanup

### Overview
Delete all old client components, error handling files, and unused dependencies. Remove `@vendor/forms` and `@hookform/resolvers` from auth app.

### Changes Required:

#### 1. Delete old client components (12 files)
```
DELETE:
  apps/auth/src/app/(app)/(auth)/_components/sign-in-form.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-in-code-verification.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-in-password.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-up-form.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-up-email-input.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-up-code-verification.tsx
  apps/auth/src/app/(app)/(auth)/_components/sign-up-password.tsx
  apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx
  apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx
  apps/auth/src/app/hooks/use-code-verification.ts
  apps/auth/src/app/lib/clerk/error-handler.ts
  apps/auth/src/app/lib/clerk/error-handling.ts
```

**Note**: Keep `apps/auth/src/app/(app)/(auth)/_components/shared/code-verification-ui.tsx` — it is reused by the new `otp-island.tsx`.

#### 2. Remove unused dependencies from auth package.json
**File**: `apps/auth/package.json`
**Changes**: Remove `@hookform/resolvers` and `@vendor/forms`

```diff
  "dependencies": {
-   "@hookform/resolvers": "^3.10.0",
    ...
-   "@vendor/forms": "workspace:*",
    ...
  }
```

Then run `pnpm install` from repo root.

#### 3. Remove `<Suspense>` wrapper (no longer needed)
The current `sign-up/page.tsx` wraps `<SignUpForm>` in `<Suspense fallback={null}>` because `SignUpForm` calls `useSearchParams()` (client hook). The new page is a server component that reads `searchParams` from page props — no `<Suspense>` needed. This is already handled in the Phase 4 rewrite.

#### 4. Verify no dangling imports
Search for any remaining imports of deleted files:
```bash
pnpm --filter @lightfast/auth typecheck
```

If `error-handler.ts` or `error-handling.ts` are imported anywhere else (they shouldn't be — they're only used by the deleted components), fix those imports.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm check` passes
- [ ] `pnpm build:auth` succeeds
- [ ] No references to deleted files: `grep -r "sign-in-form\|sign-up-form\|sign-in-email-input\|sign-up-email-input\|sign-in-code-verification\|sign-up-code-verification\|sign-in-password\|sign-up-password\|oauth-sign-in\|oauth-sign-up\|use-code-verification\|error-handler\|error-handling" apps/auth/src/ --include="*.ts" --include="*.tsx"` returns no results

#### Manual Verification:
- [ ] All flows from Phase 4 manual verification still work
- [ ] No console errors in browser devtools during auth flows
- [ ] Bundle size decreased (check with `pnpm build:auth` output)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that all flows work correctly.

---

## Testing Strategy

### Unit Tests:
- No existing unit tests for auth components. None needed for this migration — the components are thin wrappers around Clerk FAPI.

### Integration Tests:
- Auth flows are end-to-end by nature. Manual testing is the primary verification method.

### Manual Testing Steps:
1. **Sign-in (email OTP)**:
   - Go to `/sign-in`
   - Enter `some-email+clerk_test@lightfast.ai` → submit
   - URL changes to `/sign-in?step=code&email=...`
   - Enter code `424242`
   - Redirected to console `/account/teams/new`

2. **Sign-in (password, dev only)**:
   - Go to `/sign-in` → click "Sign in with Password"
   - URL changes to `/sign-in?step=password`
   - Enter `admin@lightfast.ai` / `ijXFdBJ3U2eMDFnKqngp` → submit
   - URL briefly shows `/sign-in?step=activate&token=...`
   - Redirected to console `/account/teams/new`

3. **Sign-in (OAuth)**:
   - Go to `/sign-in` → click "Continue with GitHub"
   - Redirected to GitHub → authorize → `/sign-in/sso-callback` → console

4. **Sign-up (email OTP)**:
   - Go to `/sign-up`
   - Enter email → submit → code step → enter code → redirected to console

5. **Sign-up (invitation ticket)**:
   - Go to `/sign-up?__clerk_ticket=xxx`
   - Enter email → submit → auto-complete or code → redirected to console

6. **Error states**:
   - Invalid email → error banner with "Try again"
   - Waitlist restricted → "Join the Waitlist" CTA
   - Wrong OTP code → inline error in OTP island
   - URL manipulation: `/sign-in?error=Test%20error` → renders error banner

7. **URL state**:
   - Direct navigation to `/sign-in?step=code&email=test@test.com` → renders OTP input
   - Browser back from code step → returns to email step
   - Refresh on code step → stays on code step

## Performance Considerations

- **Reduced client JS**: ~800+ lines of client components → ~120 lines across 3 islands. Significant reduction in JavaScript sent to the browser.
- **Progressive enhancement**: Email form works without JavaScript (native HTML form + server action). This is a new capability.
- **No waterfall**: Server components render immediately. OTP island starts sending code on mount — no waiting for Clerk SDK to load first.
- **`@hookform/resolvers` and `@vendor/forms` removed**: These libraries are no longer bundled for the auth app.

## Migration Notes

- **No data migration needed** — this is a UI/architecture change only. Clerk's backend state is unchanged.
- **No API changes** — the auth app doesn't expose any APIs.
- **Rollback**: Revert the git commits. No database changes to undo.
- **Feature flags**: Not needed. The migration is all-or-nothing per phase, and each phase is independently verifiable.

## References

- Research document: `thoughts/shared/research/2026-03-08-auth-server-actions-design.md`
- Clerk Server Actions docs: https://clerk.com/docs/references/nextjs/server-actions
- Clerk Core 3 upgrade guide: https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3
- Clerk sign-in tokens BAPI: https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token
- Clerk embeddable email links: https://clerk.com/docs/guides/development/custom-flows/authentication/embedded-email-links
- nuqs server-side usage: https://nuqs.47ng.com/docs/server-side
- Existing nuqs pattern: `apps/console/src/app/(app)/layout.tsx:5,26,39`
- Vendor clerk client exports: `vendor/clerk/src/client/index.ts`
- Vendor clerk server exports: `vendor/clerk/src/server.ts`
