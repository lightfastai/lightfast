# Auth Unified Hook Implementation Plan

## Overview

Consolidate the three client-side auth components (`oauth-button.tsx`, `otp-island.tsx`, `session-activator.tsx`) onto a single `useAuthFlow` hook that owns all Clerk-FAPI interactions, Sentry instrumentation, error mapping, and post-success navigation. Components shrink to thin slice consumers; the URL-driven step contract and server-rendered surfaces (pages, `EmailForm`, `ErrorBanner`) remain unchanged.

## Current State Analysis

The `apps/app/src/app/(auth)/` surface is split between server-rendered pages (URL state via `nuqs`) and three client islands that each implement their own state machine against `@vendor/clerk/client`'s `useSignIn` / `useSignUp` (Core 3 programmatic API).

**Client components and their owned state:**

| File | Lines | Owned state | Effects |
| --- | --- | --- | --- |
| `_components/oauth-button.tsx` | 222 | `loading` + 3 internal handler functions (`handleSignIn`, `handleSignUp`, `handleTicketSignUp`) selected by `mode + ticket` | — |
| `_components/otp-island.tsx` | 363 | `code`, `error`, `isVerifying`, `isRedirecting`, `isResending`, `isInitializing`, `resolvedEmail`, `hasInitRef`, `verifyingCodeRef` | init-on-mount (3 branches: sign-in OTP, sign-up OTP, ticket sign-up); auto-verify on `code.length === 6` (2 branches) |
| `_components/session-activator.tsx` | 72 | `error` | ticket activation on mount |

**Duplicated patterns across these three files:**

1. **Waitlist mapping** — `sign_up_restricted_waitlist` → either invoke `onError("waitlist")` or `window.location.href = ".../sign-{in,up}?errorCode=waitlist"`. Repeated 4×.
   - `oauth-button.tsx:40-58` (ticket flow create)
   - `oauth-button.tsx:83-103` (ticket flow sso)
   - `oauth-button.tsx:120-140` (sign-in sso)
   - `oauth-button.tsx:157-177` (sign-up sso)

   **Note** the OTP-island waitlist case redirects to `/sign-up?error=<msg>&waitlist=true` (`otp-island.tsx:62`) — a different URL contract from the OAuth paths. This plan unifies all four onto `?errorCode=waitlist` (the typed discriminant from `search-params.ts:15`). See **Migration Notes** for the URL contract change.
2. **Sentry span wrapping** — `startSpan({ name: "auth.<...>", op: "auth", attributes: { mode } }, () => clerkCall(...))`. Repeated 6× across `oauth-button.tsx:27`, `:69`, `:107`, `:144`, `otp-island.tsx:106-108`, `:130-132`, `:160-162`, `:219-221`, `:252-254`, `session-activator.tsx:24-26`.
3. **Sentry breadcrumbs** — `addBreadcrumb({ category: "auth", message, level, data: { mode, ... } })`. Repeated ~10×.
4. **Clerk error toast fallback** — `toast.error(err.longMessage ?? err.message ?? "Authentication failed")`. Repeated 4× in `oauth-button.tsx`.
5. **Finalize-and-navigate** — `signIn.finalize({ navigate: async () => { window.location.href = "/account/welcome" } })`. Repeated 3× (`otp-island.tsx:242-244`, `:275-277`, `session-activator.tsx:38-42`).
6. **Effect re-run guards** — `hasInitRef`, `verifyingCodeRef` patterns to prevent React 18 strict-mode and code-change re-fires.

**Vendor surface (`@vendor/clerk/src/client/index.ts:42-44`):**
- `useSignIn()` → `SignInSignalValue { signIn: SignInFutureResource, errors: SignInErrors, fetchStatus: 'idle' | 'fetching' }` with `signIn.{sso, ticket, emailCode.sendCode, emailCode.verifyCode, finalize, status}`.
- `useSignUp()` → `SignUpSignalValue { signUp: SignUpFutureResource, errors: SignUpErrors, fetchStatus: 'idle' | 'fetching' }` with `signUp.{create, sso, verifications.sendEmailCode, verifications.verifyEmailCode, finalize, update, status, emailAddress, missingFields, verifications.externalAccount.status}`.
- Both resources are non-nullable on the public hook surface; no `isLoaded` flag. Every method returns `Promise<{ error: ClerkError | null }>` (never throws for FAPI errors). The `errors` field exposes hook-level field/global errors as a separate signal; this hook deliberately consumes only the per-method `{ error }` returns to keep call-site control over routing/UX (see hook comments).
- `signIn.finalize({ navigate })` / `signUp.finalize({ navigate })` invoke `navigate: ({ session, decorateUrl }) => void | Promise<unknown>`. `decorateUrl` (typed `(url: string) => string`) decorates the destination URL for Safari ITP cookie refresh — see hook implementation for the canonical usage pattern.

**Existing tests (vitest, `pnpm --filter=@lightfast/app test`):**
- `apps/app/src/__tests__/sign-in.test.ts` — `initiateSignIn` server action redirects.
- `apps/app/src/__tests__/sign-up.test.ts` — `initiateSignUp` server action redirects + ticket preservation.
- `apps/app/src/__tests__/auth-search-params.test.ts` — nuqs parsers.

These cover the server-side URL contract. The client hook plumbing has no tests today.

## Desired End State

A single `useAuthFlow({ mode, step, email, ticket, token })` hook in `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` owns every interaction with `@vendor/clerk/client`. Three thin "use client" components (`oauth-button.tsx`, `otp-island.tsx`, `session-activator.tsx`) each consume exactly one slice and render existing UI components. Page-level files (`sign-in/page.tsx`, `sign-up/page.tsx`) are unchanged. Net line delta: `_components/` shrinks by ~400–500 lines; `_hooks/` adds ~300 lines (one hook + small helpers).

### How to verify
- `pnpm --filter=@lightfast/app test` passes — including new unit tests for pure helpers.
- `pnpm --filter=@lightfast/app typecheck` passes.
- `pnpm check` passes (Biome lint + format).
- Manual browser smoke: each step of sign-in (email → code → /account/welcome), sign-up (email → code → /account/welcome), ticket sign-up (`?__clerk_ticket=...` → OAuth and email-code branches), and magic-link activation (`?step=activate&token=...`) all succeed with no visual regression.

### Key Discoveries

- Server actions stay: `_actions/sign-in.ts:11` and `_actions/sign-up.ts:12` validate email and `redirect()` to the next URL step. No client logic to reuse there.
- Search-param schema is the URL contract: `_lib/search-params.ts:25-40`. Hook reads the same fields the page already loads — no nuqs client wiring needed (pages pass loaded values to client components as props, which we preserve).
- `code-verification-ui.tsx` is already prop-driven and reusable; `otp-island.tsx` is its only caller. The hook's `otp` slice maps 1:1 onto its props.
- `sign-up/sso-callback/page.tsx:10-57` runs its own legal-accepted patch with two effects against `signUp` directly. **This is intentionally out of scope** — the patch interacts with `<AuthenticateWithRedirectCallback>`'s internal Clerk navigation, and folding it into `useAuthFlow` would require modelling the SSO-callback lifecycle, which is a different shape from the email-step/code-step/activate-step contract this hook addresses.
- `error-banner.tsx:11-58` renders errors purely from URL params (`error`, `errorCode`) — the hook's "waitlist" mapping continues to drive a URL redirect by default, so `ErrorBanner` keeps working with no changes.
- `@vendor/clerk/client` re-exports `@clerk/nextjs` hooks 1:1 — no wrapper layer to update.

## What We're NOT Doing

- Not changing `_actions/sign-in.ts` or `_actions/sign-up.ts` (server actions stay).
- Not changing `_lib/search-params.ts` (URL contract stays).
- Not changing `email-form.tsx` (server component, only uses server actions).
- Not changing `error-banner.tsx`, `separator-with-text.tsx`, `code-verification-ui.tsx` (pure UI).
- Not changing `sign-in/page.tsx` or `sign-up/page.tsx` (server-rendered step routing).
- Not folding `sign-{in,up}/sso-callback/page.tsx` into the hook (different lifecycle vs `AuthenticateWithRedirectCallback`).
- Not introducing `useReducer`, TanStack Query mutations, or a Zustand slice. State machine stays as `useState` calls inside the hook.
- Not unifying the post-success redirect target (`/account/welcome`) into a config constant — preserve current literal.
- Not adding Playwright E2E coverage. Hook unit tests (vitest + RTL + mocked Clerk stubs) cover the high-risk effects; Playwright is a follow-up plan once it lands in `apps/app`.
- Not renaming or moving any existing files outside the three migrated components.
- Not consuming the hook-level `errors` signal from `useSignIn()` / `useSignUp()` (`errors.fields.code`, `errors.global`). Stays on the per-method `{ error }` return, which is what the existing components use. Hook-level errors are a future signal-reactive UI concern.

## Implementation Approach

One feature branch `feat/auth-unified-hook`, one PR through the lightfast merge queue, one bundled commit. Phase boundaries below are review checkpoints rather than commit boundaries; the PR description should mirror the phase list for reviewers.

Build the hook first with all three slices live but zero call sites (phase 1) — typecheck and pure-helper tests pass before any component is touched. Then migrate the three components one at a time (phases 2–4); after each migration, `pnpm typecheck` must still pass so the working tree remains green between phases. Phase 5 is verification + cleanup of any leftover imports.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Build `useAuthFlow` hook in isolation

### Overview

Add the hook and its pure helpers. No component changes. The hook is callable but unused; pure helpers have unit tests. Working tree must typecheck.

### Changes Required

#### 1. New file: helpers for error mapping

**File**: `apps/app/src/app/(auth)/_hooks/auth-errors.ts`
**Changes**: Pure helpers that map a Clerk error to a discriminated union covering the four real outcomes the UI needs:

- `kind: "code"` — typed `AuthErrorCode` for URL-driven banner rendering (`ErrorBanner` consumes `errorCode`).
- `kind: "inline"` — display string for inline form errors / toasts. Carries optional `retryAfter` for rate-limit UX.
- `kind: "success"` — Clerk reported "already verified" (e.g. strict-mode double-fire); caller should check `status === "complete"` and `finalize()` instead of showing an error.
- `kind: "redirect"` — caller should hard-nav to `target` (e.g. already-signed-in `session_exists`).

Two mappers:
- `mapOtpClerkError` — full mapping with rate-limit/lock specialization, used for OTP and ticket flows.
- `mapOAuthClerkError` — thin mapper that special-cases waitlist + `session_exists`, otherwise falls through to verbatim `longMessage` (preserves Clerk's localized OAuth error text — see B1 in Improvement Log).

Both mappers accept `unknown` and resolve input to a `ClerkAPIError` (the per-error item type from `@vendor/clerk/types`) via `asClerkAPIError()`. The helper uses `isClerkAPIResponseError` so that *if* Clerk ever returns a `ClerkAPIResponseError` class instance (the documented `{ error: ClerkError | null }` contract), we pull `errors[0]` natively; otherwise we accept the unwrapped per-item shape clerk-js currently produces at runtime. The shape returned is just `ClerkAPIError` itself — no parallel "normalized" type. `retryAfter` is read inline in the one branch that needs it. See **Migration Notes — Clerk Future API error shape** for why this dual-path matters.

No React, no Sentry. Imports from `@vendor/clerk` only (not from `@clerk/nextjs/errors` directly) — preserves the vendor-abstraction boundary; precedent: `apps/app/src/app/(early-access)/_actions/early-access.ts:231`.

```ts
import { isClerkAPIResponseError } from "@vendor/clerk";
import type { ClerkAPIError } from "@vendor/clerk/types";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../_lib/search-params";

export type MappedAuthError =
  | { kind: "code"; errorCode: AuthErrorCode }
  | { kind: "inline"; message: string; retryAfter?: number }
  | { kind: "success" }
  | { kind: "redirect"; target: string };

const SUCCESS_REDIRECT = "/account/welcome";

// Resolves the Clerk Future API's { error } to a single per-error item.
// Future API types say ClerkError, but clerk-js currently returns an
// unwrapped ClerkAPIError-shaped object at runtime (not a ClerkAPIResponseError
// instance). Native guards like isUserLockedError gate on constructor.kind
// and would silently return false against the unwrapped shape. This handles
// both — see Improvement Log B-Native-2.
function asClerkAPIError(err: unknown): ClerkAPIError | null {
  if (!err) return null;
  if (isClerkAPIResponseError(err)) return err.errors[0] ?? null;
  const e = err as Partial<ClerkAPIError>;
  return typeof e.code === "string" ? (e as ClerkAPIError) : null;
}

export function mapOtpClerkError(err: unknown): MappedAuthError {
  const e = asClerkAPIError(err);
  if (!e) return { kind: "inline", message: "Authentication failed" };

  switch (e.code) {
    case "sign_up_restricted_waitlist":
      return { kind: "code", errorCode: "waitlist" };
    case "verification_already_verified":
      return { kind: "success" };
    case "session_exists":
      return { kind: "redirect", target: SUCCESS_REDIRECT };
    case "ticket_expired":
      return {
        kind: "inline",
        message: "This invitation link has expired. Request a new one.",
      };
    case "too_many_requests": {
      const retryAfter = isClerkAPIResponseError(err) ? err.retryAfter : undefined;
      return {
        kind: "inline",
        message: retryAfter
          ? `Too many attempts. Please wait ${retryAfter}s and try again.`
          : "Too many attempts. Please wait a moment and try again.",
        retryAfter,
      };
    }
    case "user_locked":
      return {
        kind: "inline",
        message: "Account locked. Please try again later.",
      };
    default:
      // Preserve Clerk's longMessage (verbatim FAPI copy) for unhandled codes.
      return { kind: "inline", message: e.longMessage ?? e.message };
  }
}

export function mapOAuthClerkError(err: unknown): MappedAuthError {
  const e = asClerkAPIError(err);
  if (!e) return { kind: "inline", message: "Authentication failed" };

  if (e.code === "sign_up_restricted_waitlist") {
    return { kind: "code", errorCode: "waitlist" };
  }
  if (e.code === "session_exists") {
    return { kind: "redirect", target: SUCCESS_REDIRECT };
  }
  // Preserve Clerk's longMessage verbatim for all other OAuth errors —
  // see Improvement Log B1.
  return { kind: "inline", message: e.longMessage ?? e.message };
}

export function authErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}
```

#### 2. New file: Sentry tracing wrapper

**File**: `apps/app/src/app/(auth)/_hooks/auth-telemetry.ts`
**Changes**: Thin module that centralises the `startSpan` and `addBreadcrumb` calls so the hook body reads cleanly. Direct re-export of `@sentry/nextjs` primitives with the `category: "auth"` / `op: "auth"` defaults baked in.

```ts
import { addBreadcrumb, startSpan } from "@sentry/nextjs";

interface SpanAttributes {
  mode: "sign-in" | "sign-up";
  strategy?: string;
}

export function authSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  return startSpan({ name, op: "auth", attributes }, fn);
}

export function authBreadcrumb(
  message: string,
  level: "info" | "warning" | "error",
  data: Record<string, unknown>
): void {
  addBreadcrumb({ category: "auth", message, level, data });
}
```

#### 3. New file: `useAuthFlow` hook

**File**: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`
**Changes**: Single hook with the contract below. Each slice owns its state and effects; effects are gated on `step` so unused slices don't run side effects.

```ts
"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import type { OAuthStrategy } from "@vendor/clerk/types";
import * as React from "react";
import { authErrorMessage, mapOAuthClerkError, mapOtpClerkError } from "./auth-errors";
import { authBreadcrumb, authSpan } from "./auth-telemetry";

const SUCCESS_REDIRECT = "/account/welcome";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "email" | "code" | "activate";

interface UseAuthFlowInput {
  mode: AuthMode;
  step: AuthStep;
  email?: string | null;
  ticket?: string | null;
  token?: string | null;
  onWaitlistError?: () => void;
}

interface OAuthSlice {
  initiate: (strategy: OAuthStrategy) => Promise<void>;
  loading: boolean;
}

interface OtpSlice {
  code: string;
  email: string | null;
  error: string | null;
  isInitializing: boolean;
  isVerifying: boolean;
  isRedirecting: boolean;
  isResending: boolean;
  onCodeChange: (v: string) => void;
  onResend: () => Promise<void>;
  onReset: () => void;
}

interface ActivateSlice {
  error: string | null;
}

interface UseAuthFlowReturn {
  oauth: OAuthSlice;
  otp: OtpSlice;
  activate: ActivateSlice;
}

// Clerk passes { session, decorateUrl } to the navigate callback in
// finalize({ navigate }). decorateUrl appends ITP cookie-refresh params for
// Safari third-party cookie environments. We hard-nav (window.location.href)
// because finalize calls navigate AFTER the session is active and we want a
// full reload to pick up any server-rendered state on /account/welcome.
type NavigateArgs = { decorateUrl: (url: string) => string };

export function useAuthFlow(input: UseAuthFlowInput): UseAuthFlowReturn {
  const { mode, step, email, ticket, token, onWaitlistError } = input;
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  // --- shared helpers (stable refs) ---
  const navigateToSuccess = React.useCallback(
    async ({ decorateUrl }: NavigateArgs) => {
      window.location.href = decorateUrl(SUCCESS_REDIRECT);
    },
    []
  );

  // Mode-aware waitlist redirect. sign-in users land back on /sign-in;
  // sign-up users on /sign-up. Both render <ErrorBanner> via the
  // errorCode=waitlist URL contract. See Improvement Log B3.
  const handleWaitlist = React.useCallback(() => {
    if (onWaitlistError) {
      onWaitlistError();
      return;
    }
    const target = mode === "sign-in" ? "/sign-in" : "/sign-up";
    window.location.href = `${target}?errorCode=waitlist`;
  }, [onWaitlistError, mode]);

  // --- OAuth slice ---
  const [oauthLoading, setOauthLoading] = React.useState(false);

  // OAuth errors use the verbatim mapper so Clerk's localized longMessage
  // surfaces to the user — matches the pre-refactor toast.error behavior.
  // See Improvement Log B1.
  const handleOAuthMapped = React.useCallback(
    (
      mapped: ReturnType<typeof mapOAuthClerkError>,
      strategy: OAuthStrategy,
      label: string
    ) => {
      if (mapped.kind === "code" && mapped.errorCode === "waitlist") {
        authBreadcrumb(`OAuth blocked by waitlist (${label})`, "warning", { strategy });
        handleWaitlist();
        return;
      }
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return;
      }
      if (mapped.kind === "inline") {
        toast.error(mapped.message);
      }
      // mapOAuthClerkError never returns kind: "success" — narrowing is exhaustive.
    },
    [handleWaitlist]
  );

  const initiateOAuth = React.useCallback(
    async (strategy: OAuthStrategy): Promise<void> => {
      setOauthLoading(true);
      // Breadcrumb message preserved verbatim from oauth-button.tsx:184 so
      // existing Sentry dashboards/alerts keyed on the string still match.
      authBreadcrumb("OAuth sign-in initiated", "info", { strategy, mode });

      try {
        if (mode === "sign-up" && ticket) {
          // Ticket flow: signUp.create({ ticket }) THEN signUp.sso(...).
          // signUp.sso() silently drops the ticket param (clerk-js@5.125.3); only
          // signUp.create() forwards it to FAPI.
          //
          // Note: legalAccepted is intentionally passed to sso() (below), not
          // create(), because Clerk's ticket-OAuth flow uses sso() to carry
          // legal acceptance through the redirect to the final account
          // record. The OTP-ticket path is different — it passes legalAccepted
          // to create() directly. Do not unify.
          const { error: createError } = await authSpan(
            "auth.ticket.create",
            { mode, strategy },
            () => signUp.create({ ticket })
          );
          if (createError) {
            handleOAuthMapped(mapOAuthClerkError(createError), strategy, "ticket create");
            setOauthLoading(false);
            return;
          }

          const { error: ssoError } = await authSpan(
            "auth.oauth.initiate",
            { mode, strategy },
            () =>
              signUp.sso({
                strategy,
                redirectCallbackUrl: `/sign-up/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
                redirectUrl: SUCCESS_REDIRECT,
                legalAccepted: true,
              })
          );
          if (ssoError) {
            handleOAuthMapped(mapOAuthClerkError(ssoError), strategy, "ticket flow");
            setOauthLoading(false);
          }
          return;
        }

        const callbackUrl =
          mode === "sign-in" ? "/sign-in/sso-callback" : "/sign-up/sso-callback";
        const resource = mode === "sign-in" ? signIn : signUp;

        // Standard sign-up SSO intentionally omits legalAccepted —
        // sign-up/sso-callback/page.tsx runs a patch effect that applies it
        // post-callback. Adding legalAccepted here would race that patch.
        const { error } = await authSpan(
          "auth.oauth.initiate",
          { mode, strategy },
          () =>
            resource.sso({
              strategy,
              redirectCallbackUrl: callbackUrl,
              redirectUrl: SUCCESS_REDIRECT,
            })
        );
        if (error) {
          handleOAuthMapped(mapOAuthClerkError(error), strategy, "sso");
          setOauthLoading(false);
        }
      } catch {
        toast.error("An unexpected error occurred");
        setOauthLoading(false);
      }
    },
    [mode, ticket, signIn, signUp, handleOAuthMapped]
  );

  // --- OTP slice ---
  const [code, setCode] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(step === "code");
  const [resolvedEmail, setResolvedEmail] = React.useState<string | null>(email ?? null);

  const hasInitRef = React.useRef(false);
  const verifyingCodeRef = React.useRef<string | null>(null);

  // Hoist the otp error-handling closure so both init and verify effects share it.
  // Returns true if the caller should treat the error as success (e.g.
  // verification_already_verified) — caller then checks status === "complete"
  // and proceeds to finalize(). Param typed as `unknown` because mapOtpClerkError
  // normalizes both the unwrapped clerk-js runtime shape and the typed
  // ClerkAPIResponseError instance (see auth-errors.ts comments).
  const handleOtpClerkError = React.useCallback(
    (err: unknown): { success: boolean } => {
      if (!err) return { success: false };
      const mapped = mapOtpClerkError(err);
      if (mapped.kind === "success") {
        return { success: true };
      }
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return { success: false };
      }
      if (mapped.kind === "code") {
        if (mapped.errorCode === "waitlist") {
          handleWaitlist();
          return { success: false };
        }
        // Forward-compat: any future AuthErrorCode (e.g. account_not_found)
        // falls back to inline rendering of the canonical banner copy. See
        // Improvement Log B22.
        setOtpError(authErrorMessage(mapped.errorCode));
        return { success: false };
      }
      // mapped.kind === "inline"
      setOtpError(mapped.message);
      return { success: false };
    },
    [handleWaitlist]
  );

  // Init effect: send the OTP (or apply the invitation ticket) exactly once when step === "code".
  React.useEffect(() => {
    if (step !== "code" || hasInitRef.current) return;
    hasInitRef.current = true;

    // Self-guard: sign-in requires an email to send the OTP against.
    // Today the pages gate <OTPIsland> on `email && step === "code"`, but
    // the hook is a separate surface — guard it directly.
    if (mode === "sign-in" && !email) {
      setOtpError("Missing email. Please start over.");
      setIsInitializing(false);
      return;
    }

    async function init() {
      if (mode === "sign-up" && ticket) {
        const { error: createError } = await signUp.create({
          ticket,
          emailAddress: email ?? undefined,
          legalAccepted: true,
        });
        if (createError) {
          const { success } = handleOtpClerkError(createError);
          if (!success) return;
          // fall through to status check (verification_already_verified)
        }
        if (signUp.status === "complete") {
          setIsRedirecting(true);
          await signUp.finalize({ navigate: navigateToSuccess });
          return;
        }
        setResolvedEmail(signUp.emailAddress ?? email ?? null);

        const { error: sendError } = await authSpan(
          "auth.otp.send",
          { mode },
          () => signUp.verifications.sendEmailCode()
        );
        if (sendError) {
          authBreadcrumb("OTP send failed", "error", { code: sendError.code, mode });
          handleOtpClerkError(sendError);
        } else {
          authBreadcrumb("OTP code sent", "info", { mode, email });
        }
        return;
      }

      if (mode === "sign-in") {
        const { error: sendError } = await authSpan(
          "auth.otp.send",
          { mode },
          () => signIn.emailCode.sendCode({ emailAddress: email ?? undefined })
        );
        if (sendError) {
          authBreadcrumb("OTP send failed", "error", { code: sendError.code, mode });
          handleOtpClerkError(sendError);
        } else {
          authBreadcrumb("OTP code sent", "info", { mode, email });
        }
        return;
      }

      // mode === "sign-up" without ticket
      const { error: createError } = await signUp.create({
        emailAddress: email ?? undefined,
        legalAccepted: true,
      });
      if (createError) {
        handleOtpClerkError(createError);
        return;
      }
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode },
        () => signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP send failed", "error", { code: sendError.code, mode });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code sent", "info", { mode, email });
      }
    }

    init()
      .catch(() => setOtpError("An unexpected error occurred. Please try again."))
      .finally(() => setIsInitializing(false));
  }, [step, mode, ticket, email, signIn, signUp, handleOtpClerkError, navigateToSuccess]);

  // Auto-verify effect: fires on code.length === 6, guarded by verifyingCodeRef.
  React.useEffect(() => {
    if (step !== "code") return;
    if (code.length !== 6 || otpError || isInitializing) return;
    if (verifyingCodeRef.current === code) return;
    verifyingCodeRef.current = code;

    async function verify() {
      authBreadcrumb("OTP verification attempt", "info", { mode });
      setIsVerifying(true);
      try {
        if (mode === "sign-in") {
          const { error: verifyError } = await authSpan(
            "auth.otp.verify",
            { mode },
            () => signIn.emailCode.verifyCode({ code })
          );
          if (verifyError) {
            authBreadcrumb("OTP verification failed", "warning", { code: verifyError.code, mode });
            const { success } = handleOtpClerkError(verifyError);
            if (!success) {
              // Reset the dedup ref so re-pasting the same 6 digits after the
              // user corrects the input still triggers re-verify. See
              // Improvement Log B4.
              verifyingCodeRef.current = null;
              setIsVerifying(false);
              return;
            }
            // success: fall through to status check
          }
          if (signIn.status === "complete") {
            authBreadcrumb("OTP verified", "info", { mode });
            setIsRedirecting(true);
            await signIn.finalize({ navigate: navigateToSuccess });
          } else {
            verifyingCodeRef.current = null;
            setOtpError("Sign-in could not be completed. Please try again or contact support.");
            setIsVerifying(false);
          }
          return;
        }

        const { error: verifyError } = await authSpan(
          "auth.otp.verify",
          { mode },
          () => signUp.verifications.verifyEmailCode({ code })
        );
        if (verifyError) {
          authBreadcrumb("OTP verification failed", "warning", { code: verifyError.code, mode });
          const { success } = handleOtpClerkError(verifyError);
          if (!success) {
            verifyingCodeRef.current = null;
            setIsVerifying(false);
            return;
          }
          // success: fall through to status check
        }
        if (signUp.status === "complete") {
          authBreadcrumb("OTP verified", "info", { mode });
          setIsRedirecting(true);
          await signUp.finalize({ navigate: navigateToSuccess });
        } else {
          verifyingCodeRef.current = null;
          setOtpError("Sign-up could not be completed. Please try again or contact support.");
          setIsVerifying(false);
        }
      } catch {
        verifyingCodeRef.current = null;
        setOtpError("An unexpected error occurred. Please try again.");
        setIsVerifying(false);
      }
    }

    verify();
  }, [step, code, otpError, isInitializing, mode, signIn, signUp, handleOtpClerkError, navigateToSuccess]);

  const onCodeChange = React.useCallback((value: string) => {
    setOtpError(null);
    if (value.length < 6) verifyingCodeRef.current = null;
    setCode(value);
  }, []);

  const onResend = React.useCallback(async () => {
    // Don't race the init effect's initial sendCode — Clerk will return
    // too_many_requests for the second concurrent send. See Improvement Log B21.
    if (isInitializing) return;
    setIsResending(true);
    setOtpError(null);
    authBreadcrumb("OTP resend requested", "info", { mode });
    try {
      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode },
        () =>
          mode === "sign-in"
            ? signIn.emailCode.sendCode({ emailAddress: email ?? undefined })
            : signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP resend failed", "error", { code: sendError.code, mode });
        handleOtpClerkError(sendError);
      } else {
        authBreadcrumb("OTP code resent", "info", { mode });
        toast.success("Verification code sent to your email");
        setCode("");
        verifyingCodeRef.current = null;
      }
    } catch {
      setOtpError("An unexpected error occurred. Please try again.");
    }
    setIsResending(false);
  }, [isInitializing, mode, email, signIn, signUp, handleOtpClerkError]);

  const onReset = React.useCallback(() => {
    if (mode === "sign-in") {
      window.location.href = "/sign-in";
      return;
    }
    const ticketParam = ticket
      ? `?__clerk_ticket=${encodeURIComponent(ticket)}`
      : "";
    window.location.href = `/sign-up${ticketParam}`;
  }, [mode, ticket]);

  // --- Activate slice ---
  const [activateError, setActivateError] = React.useState<string | null>(null);
  const hasActivatedRef = React.useRef(false);

  React.useEffect(() => {
    if (step !== "activate" || !token || hasActivatedRef.current) return;
    // Strict-mode + invitation-ticket guard: signIn.ticket() consumes the
    // ticket server-side. Without this ref, React 18 strict mode's double
    // effect-fire in dev calls .ticket() twice — the second call sees an
    // already-consumed ticket and trips a spurious "Sign-in failed". See
    // Improvement Log B6 (activate-slice variant).
    hasActivatedRef.current = true;

    async function activate() {
      authBreadcrumb("Session activation via ticket", "info", {});
      const { error: ticketError } = await authSpan(
        "auth.session.activate",
        { mode },
        () => signIn.ticket({ ticket: token! })
      );
      if (ticketError) {
        // verification_already_verified can fire here on retry/refresh —
        // treat it as success and check status. Reuse mapOtpClerkError so the
        // activate slice never bypasses the normalizer / native guard path.
        const mapped = mapOtpClerkError(ticketError);
        if (mapped.kind !== "success") {
          setActivateError("Sign-in failed. Please try again.");
          return;
        }
      }
      if (signIn.status === "complete") {
        authBreadcrumb("Session activated", "info", {});
        await signIn.finalize({ navigate: navigateToSuccess });
      } else {
        setActivateError("Sign-in failed. Please try again.");
      }
    }
    activate().catch(() => setActivateError("Sign-in failed. Please try again."));
  }, [step, token, mode, signIn, navigateToSuccess]);

  return {
    oauth: { initiate: initiateOAuth, loading: oauthLoading },
    otp: {
      code,
      email: resolvedEmail,
      error: otpError,
      isInitializing,
      isVerifying,
      isRedirecting,
      isResending,
      onCodeChange,
      onResend,
      onReset,
    },
    activate: { error: activateError },
  };
}
```

#### 4. New tests for pure helpers

**File**: `apps/app/src/__tests__/auth-errors.test.ts`
**Changes**: Unit-test both mappers against (a) the unwrapped runtime shape clerk-js produces today and (b) a synthetic `ClerkAPIResponseError` instance via the `@vendor/clerk` re-exports — proves the normalizer handles both.

```ts
import { ClerkAPIResponseError } from "@clerk/nextjs/errors";
import { describe, expect, it } from "vitest";
import { mapOAuthClerkError, mapOtpClerkError } from "~/app/(auth)/_hooks/auth-errors";

// Helper: synthesize a real ClerkAPIResponseError so isClerkAPIResponseError
// (which checks `constructor.kind === "ClerkAPIResponseError"`) returns true.
// Mirrors the documented Future API `{ error: ClerkError | null }` contract.
function makeApiResponseError(opts: {
  code: string;
  message?: string;
  longMessage?: string;
  status?: number;
  retryAfter?: number;
}) {
  const err = new ClerkAPIResponseError(opts.message ?? "FAPI error", {
    data: [
      {
        code: opts.code,
        message: opts.message ?? "msg",
        long_message: opts.longMessage,
        meta: {},
      },
    ],
    status: opts.status ?? 400,
    clerkTraceId: "trace_test",
    retryAfter: opts.retryAfter,
  });
  return err;
}

describe("mapOtpClerkError — unwrapped runtime shape (current clerk-js Future API)", () => {
  it("maps sign_up_restricted_waitlist to waitlist code", () => {
    expect(mapOtpClerkError({ code: "sign_up_restricted_waitlist" })).toEqual({
      kind: "code",
      errorCode: "waitlist",
    });
  });

  it("maps verification_already_verified to success", () => {
    expect(mapOtpClerkError({ code: "verification_already_verified" })).toEqual({
      kind: "success",
    });
  });

  it("maps session_exists to redirect to /account/welcome", () => {
    expect(mapOtpClerkError({ code: "session_exists" })).toEqual({
      kind: "redirect",
      target: "/account/welcome",
    });
  });

  it("maps ticket_expired to inline copy", () => {
    expect(mapOtpClerkError({ code: "ticket_expired" })).toEqual({
      kind: "inline",
      message: "This invitation link has expired. Request a new one.",
    });
  });

  it("maps too_many_requests to inline rate-limit message without retryAfter", () => {
    expect(mapOtpClerkError({ code: "too_many_requests" })).toEqual({
      kind: "inline",
      message: "Too many attempts. Please wait a moment and try again.",
      retryAfter: undefined,
    });
  });

  it("maps user_locked to inline lock message", () => {
    expect(mapOtpClerkError({ code: "user_locked" })).toEqual({
      kind: "inline",
      message: "Account locked. Please try again later.",
    });
  });

  it("prefers longMessage for unknown codes", () => {
    expect(
      mapOtpClerkError({
        code: "form_param_format_invalid",
        longMessage: "Long form message.",
        message: "short",
      })
    ).toEqual({ kind: "inline", message: "Long form message." });
  });

  it("falls back to message when longMessage missing", () => {
    expect(mapOtpClerkError({ code: "x", message: "short" })).toEqual({
      kind: "inline",
      message: "short",
    });
  });

  it("falls back to generic message for null err", () => {
    expect(mapOtpClerkError(null)).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
  });

  it("falls back to generic message for malformed err (no code field)", () => {
    expect(mapOtpClerkError({ message: "no code" })).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
  });
});

describe("mapOtpClerkError — ClerkAPIResponseError instance (documented contract)", () => {
  it("extracts errors[0].code for waitlist", () => {
    const err = makeApiResponseError({ code: "sign_up_restricted_waitlist" });
    expect(mapOtpClerkError(err)).toEqual({ kind: "code", errorCode: "waitlist" });
  });

  it("extracts retryAfter for too_many_requests and renders countdown copy", () => {
    const err = makeApiResponseError({
      code: "too_many_requests",
      status: 429,
      retryAfter: 30,
    });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Too many attempts. Please wait 30s and try again.",
      retryAfter: 30,
    });
  });

  it("maps user_locked from errors[0]", () => {
    const err = makeApiResponseError({ code: "user_locked" });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Account locked. Please try again later.",
    });
  });

  it("prefers errors[0].long_message for unknown codes", () => {
    const err = makeApiResponseError({
      code: "form_param_format_invalid",
      longMessage: "Long form message.",
      message: "short",
    });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Long form message.",
    });
  });
});

describe("mapOAuthClerkError", () => {
  it("maps waitlist to waitlist code (unwrapped shape)", () => {
    expect(mapOAuthClerkError({ code: "sign_up_restricted_waitlist" })).toEqual({
      kind: "code",
      errorCode: "waitlist",
    });
  });

  it("maps waitlist to waitlist code (ClerkAPIResponseError shape)", () => {
    const err = makeApiResponseError({ code: "sign_up_restricted_waitlist" });
    expect(mapOAuthClerkError(err)).toEqual({ kind: "code", errorCode: "waitlist" });
  });

  it("maps session_exists to redirect", () => {
    expect(mapOAuthClerkError({ code: "session_exists" })).toEqual({
      kind: "redirect",
      target: "/account/welcome",
    });
  });

  it("preserves verbatim longMessage for too_many_requests (OAuth keeps Clerk-localized copy)", () => {
    expect(
      mapOAuthClerkError({
        code: "too_many_requests",
        longMessage: "Veuillez patienter avant de réessayer.",
      })
    ).toEqual({
      kind: "inline",
      message: "Veuillez patienter avant de réessayer.",
    });
  });

  it("preserves verbatim longMessage for user_locked", () => {
    expect(
      mapOAuthClerkError({
        code: "user_locked",
        longMessage: "Account locked — Clerk localized.",
      })
    ).toEqual({
      kind: "inline",
      message: "Account locked — Clerk localized.",
    });
  });

  it("never returns kind: success for OAuth errors", () => {
    expect(
      mapOAuthClerkError({ code: "verification_already_verified" }).kind
    ).not.toBe("success");
  });
});
```

#### 5. New tests for the hook itself

**File**: `apps/app/src/__tests__/use-auth-flow.test.tsx`
**Changes**: Vitest + @testing-library/react. Mock `useSignIn` / `useSignUp` from `@vendor/clerk/client` to return stub resources with controllable `error`, `status`, `emailAddress`. Cover the high-risk effects identified during plan review:

- `hasInitRef` fires `signUp.create` exactly once even under React 18 strict mode double-mount.
- `hasActivatedRef` fires `signIn.ticket` exactly once for the activate slice.
- `verifyingCodeRef` is reset on verifyError so re-pasting the same 6 digits re-triggers verify.
- `isInitializing` race: pasting a 6-digit code before init resolves does NOT verify until init flips false.
- `mapOtpClerkError`'s `kind: "success"` branch (e.g. `verification_already_verified`) causes the verify path to read `signIn.status === "complete"` and call `finalize` instead of showing an inline error.
- `account_not_found` future-coded errors render via `authErrorMessage` (the canonical banner copy) rather than getting silently dropped.
- `onResend` early-returns while `isInitializing` is true.
- Mode-aware waitlist: `mode === "sign-in"` redirects to `/sign-in?errorCode=waitlist`, not `/sign-up`.

Each test sets up a controllable stub, mounts the hook via `renderHook`, drives state, and asserts on:
- Stub `.create` / `.sendCode` / `.verifyCode` / `.ticket` call counts (`vi.fn`).
- `window.location.href` assignments (mock `window.location` via `vi.stubGlobal`).
- The slice return values (`result.current.otp.error`, etc.).

The hook test stub does not need to model Clerk's signal store fidelity — only the surface the hook reads.

### Success Criteria

#### Automated Verification:

- [x] Tests pass: `pnpm --filter=@lightfast/app test`
- [x] Type checking passes: `pnpm --filter=@lightfast/app typecheck`
- [x] Linting passes: `pnpm check`
- [x] New files exist: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`, `auth-errors.ts`, `auth-telemetry.ts`, `apps/app/src/__tests__/auth-errors.test.ts`, and `apps/app/src/__tests__/use-auth-flow.test.tsx`
- [x] `auth-errors.test.ts` covers `mapOtpClerkError` against both runtime shapes (10 unwrapped-shape branches + 4 `ClerkAPIResponseError`-instance branches incl. `retryAfter` extraction) and `mapOAuthClerkError` (6 branches across both shapes)
- [x] `use-auth-flow.test.tsx` covers the eight hook-level scenarios listed in section 5 above
- [x] Hook is exported but has zero call sites at this phase: `grep -rn 'useAuthFlow' apps/app/src` returns only the definition + test files

---

## Phase 2: Migrate `oauth-button.tsx` onto the hook [DONE]

### Overview

Replace the three internal handler functions and `loading` state in `oauth-button.tsx` with `useAuthFlow({ mode, step: "email", ticket }).oauth`. The button becomes ~40 lines of UI.

### Changes Required

#### 1. Rewrite `oauth-button.tsx`

**File**: `apps/app/src/app/(auth)/_components/oauth-button.tsx`
**Changes**: Drop all 3 handler functions, all Clerk imports, all Sentry imports. Render UI from `oauth` slice.

```tsx
"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useAuthFlow } from "../_hooks/use-auth-flow";

interface OAuthButtonProps {
  mode: "sign-in" | "sign-up";
  ticket?: string | null;
  onWaitlistError?: () => void;
}

export function OAuthButton({ mode, ticket, onWaitlistError }: OAuthButtonProps) {
  const { oauth } = useAuthFlow({ mode, step: "email", ticket, onWaitlistError });

  return (
    <Button
      className="w-full"
      disabled={oauth.loading}
      onClick={() => oauth.initiate("oauth_github")}
      size="lg"
      variant="outline"
    >
      {oauth.loading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      Continue with GitHub
    </Button>
  );
}
```

Note: the prop renamed from `onError: (errorCode: AuthErrorCode) => void` to `onWaitlistError: () => void`. Pages don't currently pass this prop (only the URL redirect path is used), so this is a tightening rename with no caller impact. Verify by grep: callers in `sign-in/page.tsx:78` and `sign-up/page.tsx:109, :151` pass only `mode` (and `ticket` on sign-up).

### Success Criteria

#### Automated Verification:

- [x] Tests pass: `pnpm --filter=@lightfast/app test`
- [x] Type checking passes: `pnpm --filter=@lightfast/app typecheck`
- [x] Linting passes: `pnpm check`
- [x] `oauth-button.tsx` line count is ≤ 50: `wc -l apps/app/src/app/\(auth\)/_components/oauth-button.tsx`
- [x] No remaining `useSignIn`/`useSignUp`/`startSpan`/`addBreadcrumb` imports in `oauth-button.tsx`: `grep -E 'useSignIn|useSignUp|startSpan|addBreadcrumb' apps/app/src/app/\(auth\)/_components/oauth-button.tsx` returns empty

#### Human Review:

- [x] Open `https://app.lightfast.localhost/sign-in`, click "Continue with GitHub" → redirects to GitHub OAuth and back to `/account/welcome` (existing account) or `/sign-in?errorCode=account_not_found` (new GitHub account) — Verified 2026-05-13: SSO initiation redirects to `github.com/login` with correct OAuth params (client_id, Clerk callback `clerk.shared.lcl.dev/v1/oauth_callback`, scopes `user:email read:user`). Full round-trip back through GitHub not exercised in this session
- [x] Open `https://app.lightfast.localhost/sign-up`, click "Continue with GitHub" → behaves as before (waitlist users redirect to `/sign-up?errorCode=waitlist`) — Verified 2026-05-13: hook's `mapOAuthClerkError` correctly mapped `sign_up_restricted_waitlist` → URL redirect to `/sign-up?errorCode=waitlist`; ErrorBanner rendered waitlist copy

---

## Phase 3: Migrate `otp-island.tsx` onto the hook [DONE]

### Overview

Replace 7 `useState` declarations, 2 `useRef`, both effects, and all 3 handler functions with `useAuthFlow({ mode, step: "code", email, ticket }).otp`. Render via existing `CodeVerificationUI`.

### Changes Required

#### 1. Rewrite `otp-island.tsx`

**File**: `apps/app/src/app/(auth)/_components/otp-island.tsx`
**Changes**: Drop all state, refs, effects, Clerk imports, Sentry imports.

```tsx
"use client";

import { useAuthFlow } from "../_hooks/use-auth-flow";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface OTPIslandProps {
  email: string | null;
  mode: "sign-in" | "sign-up";
  ticket?: string | null;
  onWaitlistError?: () => void;
}

export function OTPIsland({ email, mode, ticket, onWaitlistError }: OTPIslandProps) {
  const { otp } = useAuthFlow({ mode, step: "code", email, ticket, onWaitlistError });

  return (
    <CodeVerificationUI
      code={otp.code}
      email={otp.email}
      inlineError={otp.error}
      isRedirecting={otp.isRedirecting}
      isResending={otp.isResending}
      isVerifying={otp.isVerifying}
      onCodeChange={otp.onCodeChange}
      onResend={otp.onResend}
      onReset={otp.onReset}
    />
  );
}
```

The `isInitializing` flag is exposed on the slice but `CodeVerificationUI` doesn't currently consume it — the OTP form is fully rendered during init, and only the auto-verify effect is gated. Preserve current UX. If we later want a loading indicator, it's a one-line UI change with no hook impact.

The `onError` prop (previously `(message: string, isWaitlist?: boolean) => void`) is replaced by `onWaitlistError: () => void`. The previous signature was wider than callers needed — `sign-up/page.tsx:157` and `sign-in/page.tsx:84` never pass it. Tightening it removes dead surface.

### Success Criteria

#### Automated Verification:

- [x] Tests pass: `pnpm --filter=@lightfast/app test`
- [x] Type checking passes: `pnpm --filter=@lightfast/app typecheck`
- [x] Linting passes: `pnpm check`
- [x] `otp-island.tsx` line count is ≤ 50: `wc -l apps/app/src/app/\(auth\)/_components/otp-island.tsx`
- [x] No remaining `useSignIn`/`useSignUp`/`startSpan`/`addBreadcrumb`/`useState`/`useEffect`/`useRef` imports in `otp-island.tsx`: `grep -E 'useSignIn|useSignUp|startSpan|addBreadcrumb|useState|useEffect|useRef' apps/app/src/app/\(auth\)/_components/otp-island.tsx` returns empty

#### Human Review:

- [x] Sign-in OTP: enter email at `/sign-in` → arrive at `?step=code` → OTP arrives in email → enter 6 digits → auto-verifies → lands on `/account/welcome` — Verified 2026-05-13: URL transitioned `?step=code&email=...`, OTP `424242` (clerk_test mode) auto-verified in ~2s, navigate hit `/account/welcome` which the post-welcome router forwarded to `/account/teams/new` for the no-team test user
- [x] Sign-up OTP (non-ticket): same flow at `/sign-up` → `/account/welcome` — Verified 2026-05-13 (waitlist path only): fresh `+clerk_test@` email hit `sign_up_restricted_waitlist`; hook's `mapOtpClerkError` redirected to `/sign-up?errorCode=waitlist` as designed. Success path requires a non-waitlisted user (ticket flow or Clerk dashboard config) — out of scope this session
- [ ] Ticket sign-up OTP: visit `/sign-up?__clerk_ticket=<test>`, choose email path → enter email → OTP path completes — **BLOCKED 2026-05-13 by latent pre-existing bug, not introduced by refactor.** Drove via `agent-browser` with a Backend-API-minted Clerk invitation. UI flow worked through to `?step=code`: invitation page rendered ("Accept Your Invitation"), email submitted, redirect to `?step=code&email=...&ticket=...` succeeded, `OTPIsland` rendered with the Clerk-issued verification heading + textbox. **But:** the hook's init effect calls `signUp.create({ ticket, emailAddress, legalAccepted: true })` and Clerk rejects with `form_identifier_exists` ("This email address is already in use. Creating multiple accounts with the same email address is not allowed.") — because the invitation pre-claims the email and the explicit `emailAddress` parameter conflicts. Reproduced with two fresh invitations + fresh browser daemon. Pre-refactor `otp-island.tsx` had the identical `signUp.create({ ticket, emailAddress: email ?? undefined, legalAccepted: true })` shape (verified via `git show HEAD:.../otp-island.tsx`), so refactor preserves behavior verbatim. Suspected fix: drop `emailAddress` when `ticket` is present (the JWT carries the email). Path was never E2E tested before this session.
- [x] Resend: click "Resend" → toast confirms code re-sent; OTP input clears — Verified 2026-05-13: hook's success path executes (OTP input cleared, code state reset). Toast UI not visible — pre-existing issue: `(auth)/layout.tsx` does not mount `<Toaster />`, so all `toast.{success,error}` calls from the hook (and from the pre-refactor components) are silently dropped. Not introduced by Phase 3
- [x] Back: click "Back" → returns to `/sign-{in,up}` with ticket preserved on sign-up — Verified 2026-05-13 sign-in mode: URL went from `/sign-in?step=code&email=...` back to `/sign-in`. Sign-up + ticket variant not exercised this session
- [x] Bad code: type 6 wrong digits → inline error appears; typing fewer than 6 clears it — Verified 2026-05-13: `123456` produced "Incorrect code" inline error (Clerk's longMessage preserved verbatim); backspacing to `12345` cleared the error via hook's `onCodeChange` setOtpError(null)

---

## Phase 4: Migrate `session-activator.tsx` onto the hook

### Overview

Replace the activate effect and `error` state with `useAuthFlow({ mode: "sign-in", step: "activate", token }).activate`. Renders the same loading + error UI.

### Changes Required

#### 1. Rewrite `session-activator.tsx`

**File**: `apps/app/src/app/(auth)/_components/session-activator.tsx`
**Changes**: Drop Clerk/Sentry imports, drop effect, drop `useState`.

```tsx
"use client";

import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";
import { useAuthFlow } from "../_hooks/use-auth-flow";

interface SessionActivatorProps {
  token: string;
}

export function SessionActivator({ token }: SessionActivatorProps) {
  const { activate } = useAuthFlow({ mode: "sign-in", step: "activate", token });

  if (activate.error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive text-sm">{activate.error}</p>
        <Link className="text-muted-foreground text-sm underline" href="/sign-in">
          Back to Sign In
        </Link>
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

### Success Criteria

#### Automated Verification:

- [x] Tests pass: `pnpm --filter=@lightfast/app test` (12 files, 150/150 passing — 2026-05-13)
- [x] Type checking passes: `pnpm --filter=@lightfast/app typecheck` (2026-05-13)
- [x] Linting passes: `pnpm check` — scoped check on `apps/app/src/app/(auth)` + `apps/app/src/__tests__` clean (29 files, no errors). Repo-wide `pnpm check` fails on an unrelated untracked WIP file (`.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs`) outside this refactor's scope.
- [x] `session-activator.tsx` line count is ≤ 40: 38 lines (2026-05-13)
- [x] No remaining `useSignIn`/`startSpan`/`addBreadcrumb`/`useState`/`useEffect` imports in `session-activator.tsx`: `grep -E 'useSignIn|startSpan|addBreadcrumb|useState|useEffect' apps/app/src/app/\(auth\)/_components/session-activator.tsx` returns empty

#### Human Review:

- [x] Same URL with an invalid token → "Sign-in failed. Please try again." + "Back to Sign In" link — Verified 2026-05-13 via `agent-browser` against `https://lightfast.localhost/sign-in?step=activate&token=garbage_<ts>_xyz`. Accessibility tree snapshot showed `paragraph` with `"Sign-in failed. Please try again."` and `link "Back to Sign In"` — the refactored `useAuthFlow.activate` slice correctly maps the bad-ticket error via `mapOtpClerkError` → `kind: "inline"` → renders the hardcoded fallback copy.
- [ ] Trigger magic-link activation by hand-crafting a URL `…/sign-in?step=activate&token=<dev-token>` (token sourced from Clerk dashboard or `lightfast-clerk` skill) → loading state shows, then `/account/welcome` — **BLOCKED 2026-05-13 by latent pre-existing bug, not introduced by refactor**. With a real `sign_in_tokens`-minted ticket for an existing Clerk user, the hook's `signIn.ticket({ ticket })` Future API call returns `{ error: null }` but leaves `signIn.status === "needs_identifier"`. Debug instrumentation captured: `stage: "status-not-complete", status: "needs_identifier"`. The hook then hits the `else` branch and renders "Sign-in failed." The legacy `window.Clerk.client.signIn.create({ strategy: "ticket", ticket })` returned `status: "complete"` on the same ticket — proves the ticket is valid and Clerk's instance/user state is fine. Spiked the same shape inside the hook (`signIn.create({ strategy: "ticket", ticket })`) — still failed inside React context (reactive Future API surface behaves differently from legacy). Pre-refactor `session-activator.tsx` had identical call shape `signIn.ticket({ ticket })`, so refactor preserves behavior verbatim. Path was never E2E tested before this session (Phase 3 notes listed it as `TODO: automate`). Recommend a separate follow-up to debug the Future API behavior with Clerk support or by reading clerk-js runtime.

---

## Phase 5: Cleanup & verification

### Overview

Confirm no stragglers — no orphan imports, no dead helpers, no leftover prop types. Run the full local verification gauntlet and stage the commit.

### Changes Required

#### 1. Sweep for orphans

**Files**: any leftover in `(auth)/_components/`
**Changes**: Verify `useSignIn`, `useSignUp`, `startSpan`, `addBreadcrumb`, and `toast` are no longer imported anywhere in `_components/` except through the hook.

```bash
grep -rn -E 'useSignIn|useSignUp|@sentry/nextjs|@vendor/clerk/client' apps/app/src/app/\(auth\)/_components/
# expected: no matches
```

If any match remains (e.g. UI files like `code-verification-ui.tsx` use `Icons` only — keep), explicitly justify in the PR description.

#### 2. Re-export hook from a barrel?

**Decision**: No barrel. Direct imports from `../_hooks/use-auth-flow` only — matches the existing direct-import style in `_actions/` and `_lib/`.

### Success Criteria

#### Automated Verification:

- [ ] Tests pass: `pnpm --filter=@lightfast/app test`
- [ ] Type checking passes: `pnpm --filter=@lightfast/app typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Build passes: `pnpm build:app`
- [ ] No orphan imports in `_components/`: `grep -rnE 'useSignIn|useSignUp|@sentry/nextjs|@vendor/clerk/client' apps/app/src/app/\(auth\)/_components/` returns empty
- [ ] Hook is wired to exactly three call sites: `grep -rn 'useAuthFlow' apps/app/src` returns the definition plus three component imports

#### Human Review:

- [ ] Full smoke pass on `https://app.lightfast.localhost`: sign-in email→code, sign-up email→code, sign-up ticket OAuth, sign-up ticket email, OAuth sign-in, magic-link activate — all paths reach `/account/welcome` or the documented error states
- [ ] Sentry breadcrumbs visible in browser console (via `Sentry.getClient()?.getOptions()` if useful) for each flow — confirms the `authBreadcrumb` calls still fire — TODO: automate via Sentry SDK assertions in Playwright

---

## Testing Strategy

### Unit Tests

- `mapClerkError`: each branch (waitlist, rate limit, lock, longMessage, message, generic fallback). Covered in phase 1.
- Server actions: unchanged, existing tests in `sign-in.test.ts` / `sign-up.test.ts` continue to pass.
- Search params: unchanged, existing tests in `auth-search-params.test.ts` continue to pass.

### Integration / E2E

- Not added in this plan. Manual smoke at each phase's human review covers the integration surface. Each phase's `Human Review` list is annotated with `TODO: automate via Playwright` lines so we can graduate them once Playwright lands in `apps/app`.

## Performance Considerations

- Hook adds a single `React.useState(step === "code")` initialiser to gate `isInitializing`. No new effects beyond the three the components already run (init, verify, activate).
- The OAuth slice always calls `useSignIn()` and `useSignUp()` regardless of step. This matches today's `oauth-button.tsx:19-20` behaviour — no regression. Clerk Core 3 hooks are cheap (single Signals subscription).
- Slice-gated effects (`if (step !== "code") return`) keep unused slices' effects from firing — same effective cost as the per-component split.

## Migration Notes

No data migration. **One URL contract change**: today, an OTP-island waitlist error (`otp-island.tsx:62`) redirects to `/sign-up?error=<msg>&waitlist=true`. The unified hook redirects to `/sign-up?errorCode=waitlist` instead, matching what the OAuth paths already do. Both URL shapes render the same banner via `ErrorBanner`, but external links, monitors, or Playwright tests that asserted on `?error=...&waitlist=true` must be updated.

Live deploy is otherwise safe: hook is purely client-side and the URL → step routing the pages produce is identical to today. If a regression surfaces post-merge, revert the single commit.

**Sentry breadcrumb message** "OAuth sign-in initiated" is preserved verbatim from the existing component to avoid breaking dashboards/alerts keyed on the literal string. The plan's earlier draft renamed this to "OAuth initiated" — that change was reverted.

### Clerk Future API error shape — defensive dual-shape normalization

The Future API methods (`signIn.emailCode.verifyCode()`, `signUp.create()`, etc.) are typed as `Promise<{ error: ClerkError | null }>`. The documented contract says `error` should be a `ClerkAPIResponseError` instance — its constructor (in `@clerk/shared/dist/runtime/error-BkPoOeMv.js:94`) hardcodes `code: "api_response_error"` on the base, with the semantic FAPI code at `errors[0].code`. **But at runtime today**, clerk-js's Future API returns an *unwrapped* per-error item (`ClerkAPIError` shape: `{ code, message, longMessage }` directly) — confirmed by the working prod code at `otp-island.tsx:48` reading `clerkError.code === "too_many_requests"` and matching. The React proxy at `@clerk/react/dist/internal.js:1607-1620` does no normalization.

This means Clerk's native type guards from `@clerk/shared/error` (`isClerkAPIResponseError`, `isUserLockedError`, `is429Error`, `isCaptchaError`, `isClerkRuntimeError`) **all return `false` against the current runtime shape** — they gate on `constructor.kind === "ClerkAPIResponseError"`. Naive adoption (`if (isUserLockedError(err)) ...`) would silently break the rate-limit/lock branches.

The mappers resolve both shapes through `asClerkAPIError(err): ClerkAPIError | null`:
1. If `isClerkAPIResponseError(err)` is true → return `err.errors[0]`. Future-proofs against Clerk shipping the documented contract.
2. Otherwise → cast the unwrapped runtime shape (already structurally a `ClerkAPIError`). Matches today's runtime.

Both paths produce a real `ClerkAPIError` for the switch logic — no parallel "normalized" type. `retryAfter` (which lives on the `ClerkAPIResponseError` wrapper, not the per-error item) is read inline only in the `too_many_requests` branch where it matters. If Clerk fixes the runtime to match its types, the mapper transparently picks up `retryAfter` for the UX countdown without any code change.

## References

- Server actions: `apps/app/src/app/(auth)/_actions/sign-in.ts`, `apps/app/src/app/(auth)/_actions/sign-up.ts`
- Search params: `apps/app/src/app/(auth)/_lib/search-params.ts:1-55`
- Existing components: `apps/app/src/app/(auth)/_components/{oauth-button,otp-island,session-activator}.tsx`
- Page composition: `apps/app/src/app/(auth)/sign-in/page.tsx:46-92`, `apps/app/src/app/(auth)/sign-up/page.tsx:63-180`
- Clerk vendor surface: `vendor/clerk/src/client/index.ts:42-44`
- Existing tests: `apps/app/src/__tests__/sign-in.test.ts`, `sign-up.test.ts`, `auth-search-params.test.ts`
- SSO callback (out of scope): `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx:10-57`

## Improvement Log

### Native Clerk error integration (2026-05-13 — second-pass review)

User-requested deep dive on whether `mapOtpClerkError` should adopt Clerk's native error utilities (`@clerk/nextjs/errors`, `@clerk/shared/error`). Sourced from web-analyzer (installed `@clerk/nextjs@7.2.4` + `@clerk/shared@4.9.0` source), codebase-locator (existing `@vendor/clerk` re-exports), codebase-analyzer (current magic-string `.code` checks), plus a targeted spike-validator to resolve the runtime-shape ambiguity.

**Spike result (verdict: PARTIAL, actionable):** The Clerk Future API's `{ error: ClerkError | null }` return is **typed** as `ClerkAPIResponseError` (the SDK's documented contract) but at runtime today resolves to an *unwrapped* per-error item (`ClerkAPIError` shape: `{ code, message, longMessage }`). The React proxy at `@clerk/react/dist/internal.js:1607-1620` passes through whatever clerk-js produces — no normalization. Confirmed via `otp-island.tsx:48` reading `clerkError.code === "too_many_requests"` working in prod (would always be `"api_response_error"` if `error` were a `ClerkAPIResponseError` instance). All `@clerk/shared/error` native guards (`isClerkAPIResponseError`, `isUserLockedError`, `is429Error`, `isCaptchaError`, `isClerkRuntimeError`) check `constructor.kind === "ClerkAPIResponseError"` and would **silently return false** against today's runtime shape.

**Key finding for the plan:** Naive adoption of native guards (`if (isUserLockedError(err)) ...`) would break the rate-limit/lock branches that work today. The right move is **defensive dual-shape normalization**: try `isClerkAPIResponseError(err)` → extract `.errors[0]` + `.retryAfter` if true (future-proofs against Clerk fixing the runtime to match its types); otherwise read the unwrapped shape directly.

**Changes applied:**
- **B-Native-1 / Replace `ClerkErrorLike` with vendor type** — `auth-errors.ts` no longer declares its own inline structural type. Imports `ClerkAPIError` from `@vendor/clerk/types` and `isClerkAPIResponseError` from `@vendor/clerk` (vendor already re-exports these at `vendor/clerk/src/index.ts:1-4`; precedent: `apps/app/src/app/(early-access)/_actions/early-access.ts:231`).
- **B-Native-2 / Add `asClerkAPIError(err: unknown): ClerkAPIError | null`** — Single helper resolves both runtime shapes to a real `ClerkAPIError` (the per-error item type from `@vendor/clerk/types`). No parallel "normalized" type introduced — we reuse Clerk's own type. Mappers accept `unknown`, call the helper, then `switch` on `e.code`. `retryAfter` is read inline only in the `too_many_requests` branch (it lives on `ClerkAPIResponseError`, not on the per-error item). `handleOtpClerkError` callback in the hook re-typed to `unknown`. Activate slice's direct `ticketError.code !== "verification_already_verified"` check replaced with `mapOtpClerkError(ticketError)` for consistency.
- **B-Native-3 / Surface `retryAfter` from `ClerkAPIResponseError`** — `MappedAuthError`'s `kind: "inline"` discriminant now carries optional `retryAfter`. Rate-limit copy upgrades from "Too many attempts. Please wait a moment" to "Too many attempts. Please wait 30s and try again" when the SDK exposes it (currently only available via the `ClerkAPIResponseError` instance path, but available transparently when Clerk fixes the runtime contract).
- **B-Native-4 / Test both runtime shapes** — `auth-errors.test.ts` now synthesizes real `ClerkAPIResponseError` instances via `new ClerkAPIResponseError(...)` and asserts both `mapOtpClerkError` and `mapOAuthClerkError` produce equivalent output across both shapes. Covers `retryAfter` extraction, `errors[0].code` extraction, and the `null`/malformed-input fallback.
- **B-Native-5 / Document the dual-shape constraint** — New "Clerk Future API error shape" section in Migration Notes explains why we normalize and what's load-bearing.

**Considered but not adopted:**
- **Add `isClerkRuntimeError` to vendor re-exports** — would be useful for network/offline error UX, but per spike it also won't fire at runtime today (same `constructor.kind` gating). Adding it now would be dead code until Clerk fixes its runtime. Deferred.
- **Replace remaining magic strings (`"sign_up_restricted_waitlist"`, `"ticket_expired"`, `"verification_already_verified"`, `"session_exists"`) with constants** — Clerk doesn't ship a typed enum for FAPI codes (only narrow guards for `user_locked`, `429`, captcha codes, password-pwned). Centralizing as local string constants would be cosmetic; postponed.
- **Hybrid: native guards inside `if (isClerkAPIResponseError(err))` branch** — added at the top of `asClerkAPIError` as documented above. Inside the switch we still compare on `e.code` strings because most codes have no native guard.

### Original review pass (2026-05-13)

Adversarial review applied 2026-05-13. Findings sourced from four agents (codebase-analyzer, codebase-pattern-finder via general-purpose, web-analyzer on @clerk/shared@4.9.0 + @clerk/react@6.5.0 types, thoughts-locator). User approved the in-flight fixes below.

### Critical (fixed in plan)

- **B-Crit-1 / `SessionActivator` strict-mode double-fire** — Added `hasActivatedRef` to the activate slice. Previously the existing `session-activator.tsx:17-50` had no ref guard, so React 18 strict-mode double-mount in dev called `signIn.ticket()` twice and the second call tripped a spurious "Sign-in failed" on an already-consumed ticket. Hook now matches the OTP slice's `hasInitRef` pattern.
- **B-Crit-2 / `verifyingCodeRef` not reset on `verifyError`** — Added `verifyingCodeRef.current = null` in both error branches of the auto-verify effect plus the `signIn/signUp.status !== "complete"` fallback and the outer catch. Pre-existing bug in `otp-island.tsx:223-232` where re-pasting the same six wrong digits left users unable to re-trigger verify. `onResend` also resets the ref on success.
- **B-Crit-3 / `verification_already_verified` unhandled** — Added `kind: "success"` discriminant to `MappedAuthError`. The verify path now checks `success: true` from `handleOtpClerkError`, falls through to `status === "complete"`, and calls `finalize()` instead of showing "Verification failed" on a flow that actually succeeded. Same handling added to the activate slice's `ticketError` branch.
- **B-Crit-4 / `account_not_found` silently dropped** — Added a default branch in `handleOtpClerkError` for non-waitlist `kind: "code"` results: renders the canonical `AUTH_ERROR_MESSAGES[errorCode]` copy inline. Removes the forward-compat hazard where adding a new `AuthErrorCode` would create an invisible-failure state.

### High (fixed in plan)

- **B1 / OAuth error toast regression** — Split mappers: `mapOAuthClerkError` only special-cases waitlist + `session_exists` and otherwise falls through to verbatim `longMessage`, preserving Clerk's localized OAuth error text. `mapOtpClerkError` retains the rate-limit/lock specialization for the OTP flow (parity with `otp-island.tsx:48-55`).
- **B3 / Mode-blind waitlist redirect** — `handleWaitlist()` now derives `target` from `mode` (sign-in → `/sign-in?errorCode=waitlist`, sign-up → `/sign-up?errorCode=waitlist`). Pre-existing in `otp-island.tsx:62`, inherited by the original plan. One-line fix free-rolled in.
- **B7 / `decorateUrl` dropped on `finalize` navigate** — `navigateToSuccess` now accepts `{ decorateUrl }` and hard-navs to `decorateUrl(SUCCESS_REDIRECT)`. Maintains Safari ITP cookie refresh. Passed directly to `finalize({ navigate: navigateToSuccess })` at all three call sites (sign-in verify, sign-up verify, activate).
- **B13/B21/B28 / `onResend` race + observability gap** — Wrapped in `authSpan("auth.otp.send", { mode }, …)`, added `authBreadcrumb` on request/success/failure, added `if (isInitializing) return;` guard, and added `verifyingCodeRef.current = null` on successful resend.

### Improvements (fixed in plan)

- **B12 / Breadcrumb message rename reverted** — `"OAuth sign-in initiated"` preserved verbatim to avoid breaking Sentry dashboards/alerts keyed on the literal.
- **B5 / Hook self-guard on missing sign-in email** — `if (mode === "sign-in" && !email)` returns an inline error without firing `signIn.emailCode.sendCode({ emailAddress: undefined })`.
- **B11/B18/B26 / Asymmetric `signUp.create` shapes documented** — Inline comments explain why the OAuth-ticket path defers `legalAccepted` to `sso()` while the OTP-ticket path passes it to `create()`, and why standard sign-up SSO intentionally omits `legalAccepted` (relies on the `/sign-up/sso-callback` patch effect).
- **B14 / "`CodeVerificationUI` shows nothing during init" claim corrected** — Reworded to "OTP form is fully rendered during init; only the auto-verify effect is gated."
- **Type/citation fixes** — `useSignIn()` return correctly typed as `SignInSignalValue` (not `{ signIn: SignInResource }`); waitlist-block line citations corrected to `oauth-button.tsx:83-103`, `:120-140`, `:157-177`.
- **Error-code coverage expanded** — Added `ticket_expired` and `session_exists` per user decision. `form_code_incorrect` and `verification_expired` left to fall through to verbatim FAPI copy (their default messages are acceptable).

### Tests (expanded in plan)

- `auth-errors.test.ts` now covers both `mapOtpClerkError` (9 branches) and `mapOAuthClerkError` (5 branches), including the verbatim-`longMessage` and `success`/`redirect` discriminants.
- New `use-auth-flow.test.tsx` covers eight hook-level scenarios with mocked Clerk stubs: `hasInitRef` once-only under strict-mode double-mount, `hasActivatedRef` once-only, `verifyingCodeRef` reset on verifyError, `isInitializing`/paste race, `verification_already_verified` falling through to `finalize`, `account_not_found` rendering via `authErrorMessage`, `onResend` early-return while initializing, and mode-aware waitlist redirect target.

### Not changed (intentional)

- **B6 / React 18 strict-mode double-`signUp.create()` on the ticket path** — left as-is. The OAuth-button equivalent has the same shape and the bug is dev-only. Fixing it requires `signUp.id`-aware reasoning (state-based, not ref-based), out of scope for this refactor.
- **Hook-level `errors` signal from `useSignIn()` / `useSignUp()`** — not consumed. Stays on per-method `{ error }` returns; signal-reactive UI is a future refactor.
- **`onReset` URL params (other than `__clerk_ticket`)** — preserved as-is; pre-existing behavior, low impact.

### Process

First pass: no spike — `@clerk/shared@4.9.0` type definitions answered the highest-leverage uncertainties (`decorateUrl` callback shape, `useSignIn` nullability, `Promise<{ error }>` contract) at high confidence directly from the installed source.

Second pass: one targeted spike-validator run to resolve the runtime-vs-documented-type divergence for Future API `{ error }` returns (read-only source spelunking, no production code touched). Result documented in the "Native Clerk error integration" subsection above.
