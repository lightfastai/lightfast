# Early-Access Structural Alignment + Clerk SDK Migration

## Overview

Close the structural gaps between `(early-access)` and `(auth)`, migrate the Clerk waitlist API call from raw `fetch` + 304-line custom error handler to the Clerk Backend SDK, and adopt nuqs `createSerializer` for type-safe URL construction across both route groups.

## Current State Analysis

`(early-access)` was recently SSR-converted from react-hook-form and moved from www to auth. It follows the same SSR + nuqs + islands pattern as `(auth)`, but has structural gaps:

- **No `layout.tsx`** — page.tsx inlines its own centering chrome (`flex min-h-screen flex-col bg-background`)
- **No `error.tsx`** — no Next.js error boundary; unhandled throws bubble to the app-level boundary
- **Inline error display** — error banner UI is raw Tailwind inline in page.tsx instead of a dedicated component
- **Raw `searchParams` type** — `Promise<Record<string, string | string[] | undefined>>` instead of nuqs `Promise<SearchParams>`
- **Raw Clerk `fetch`** — calls `https://api.clerk.com/v1/waitlist_entries` directly with `env.CLERK_SECRET_KEY`
- **304-line `clerk-error-handler.ts`** — custom error normalizer handling 11+ Clerk error codes across two input formats (SDK and Backend API)
- **Manual URL construction** — `buildEarlyAccessUrl()` uses `URLSearchParams` manually; `(auth)` actions use template literals with `encodeURIComponent`

### Key Discoveries:
- `clerkClient().waitlistEntries.create()` is available via `@vendor/clerk/server` (`@clerk/backend@3.0.1`) — `apps/auth/src/app/(app)/(auth)/layout.tsx:1-57`
- `isClerkAPIResponseError` is exported from `@vendor/clerk` and already used in `apps/console/src/app/lib/clerk/error-handling.ts:1`
- `WaitlistEntryCreateParams` only accepts `{ emailAddress, notify? }` — no `public_metadata` support
- `createSerializer` from `nuqs/server` (available since v1.16.0) can replace both `buildEarlyAccessUrl` and manual template literals

## Desired End State

After this plan is complete:
1. `(early-access)` has `layout.tsx`, `error.tsx`, and `_components/error-banner.tsx` matching `(auth)` conventions
2. `page.tsx` uses `Promise<SearchParams>` type and is slimmer (no inline layout/error code)
3. `clerk-error-handler.ts` is deleted; Clerk calls use the SDK + `isClerkAPIResponseError`
4. Both route groups use `createSerializer` for type-safe redirect URL construction
5. `env.CLERK_SECRET_KEY` is no longer imported in the action (clerkClient handles auth internally)
6. `buildEarlyAccessUrl()` is deleted
7. `public_metadata` is dropped from the Clerk waitlist call (data still exists in Redis)

### Verification:
- `pnpm --filter @lightfast/auth typecheck` passes
- `pnpm --filter @lightfast/auth lint` passes
- `pnpm build:auth` succeeds
- `/early-access` page renders correctly with all states (form, success, error, rate-limit, field errors)
- `(auth)` sign-in/sign-up flows still work correctly

## What We're NOT Doing

- **Unit tests** — search-params, clerk-error-handler, and action tests are deferred to a separate plan
- **E2E tests** — URL-driven state tests and form submission tests are deferred
- **MSW setup** — no mock service worker configuration
- **Shared ErrorBanner** — `(early-access)` and `(auth)` have different error semantics (rate-limit yellow vs red); each keeps its own component
- **nuqs `createSerializer` for `(auth)` layout or pages** — only actions get the serializer treatment
- **Redis metadata storage** — not adding a separate Redis hash for companySize/sources

## Implementation Approach

Four phases, each independently testable:
1. Add `createSerializer` exports (purely additive, no behavior change)
2. Extract structural components from page.tsx (visual parity, no logic change)
3. Replace Clerk raw fetch with SDK (logic change, same behavior)
4. Update `(auth)` actions to use serializers (logic change, same behavior)

---

## Phase 1: nuqs createSerializer Foundation

### Overview
Add `createSerializer` exports to both `_lib/search-params.ts` files. Purely additive — no existing code changes, no consumers yet.

### Changes Required:

#### 1. `(early-access)/_lib/search-params.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_lib/search-params.ts`
**Changes**: Add `createSerializer` import and export

```ts
import { createLoader, createSerializer, parseAsBoolean, parseAsString } from "nuqs/server";

export const earlyAccessSearchParams = {
  // Form field values (preserved across validation errors)
  email: parseAsString.withDefault(""),
  companySize: parseAsString.withDefault(""),
  sources: parseAsString.withDefault(""), // comma-separated

  // Error states
  error: parseAsString, // general error message
  emailError: parseAsString, // email field validation error
  sourcesError: parseAsString, // sources field validation error
  companySizeError: parseAsString, // company size field validation error
  isRateLimit: parseAsBoolean.withDefault(false),

  // Success state
  success: parseAsBoolean.withDefault(false),
};

export const loadEarlyAccessSearchParams = createLoader(
  earlyAccessSearchParams
);

export const serializeEarlyAccessParams = createSerializer(
  earlyAccessSearchParams
);
```

#### 2. `(auth)/_lib/search-params.ts`
**File**: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts`
**Changes**: Add `createSerializer` import and two serializer exports

```ts
import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";

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
  __clerk_ticket: parseAsString, // Clerk invitation URL parameter
  waitlist: parseAsString,
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
export const loadSignUpSearchParams = createLoader(signUpSearchParams);

export const serializeSignInParams = createSerializer(signInSearchParams);
export const serializeSignUpParams = createSerializer(signUpSearchParams);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [ ] No behavior change — existing pages and actions are unaffected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Structural Alignment

### Overview
Add `layout.tsx`, `error.tsx`, extract error banner to a component, and fix the `searchParams` type in `page.tsx`.

### Changes Required:

#### 1. Add `layout.tsx`
**File**: `apps/auth/src/app/(app)/(early-access)/layout.tsx` (NEW)
**Changes**: Extract centering structure from page.tsx. No auth guard (public route), no header navbar (user is already on the page).

```tsx
import type React from "react";

export default function EarlyAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

**Note**: The `(auth)` layout has a top spacer + fixed header + bottom spacer for centering. Early-access has no fixed header, so only the bottom spacer is needed to push content slightly above center (matching the current visual position from `page.tsx:127`).

#### 2. Add `error.tsx`
**File**: `apps/auth/src/app/(app)/(early-access)/error.tsx` (NEW)
**Changes**: Port from `(auth)/error.tsx` with "Back to Early Access" instead of "Back to Sign In" and `location: "early-access-route"` tag.

```tsx
"use client";

import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

interface EarlyAccessErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EarlyAccessError({
  error,
  reset,
}: EarlyAccessErrorProps) {
  useEffect(() => {
    captureException(error, {
      tags: {
        location: "early-access-route",
      },
      extra: {
        errorDigest: error.digest,
      },
    });

    console.error("Early access route error:", error);
  }, [error]);

  return (
    <LightfastCustomGridBackground.Root
      marginHorizontal="25vw"
      marginHorizontalMobile="10vw"
      marginVertical="25vh"
      marginVerticalMobile="25vh"
    >
      <LightfastCustomGridBackground.Container>
        <LightfastErrorPage
          code={ErrorCode.InternalServerError}
          description="We encountered an issue. Please try again."
          errorId={error.digest}
        >
          <Button onClick={() => reset()} size="lg">
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/early-access">Back to Early Access</Link>
          </Button>
        </LightfastErrorPage>
      </LightfastCustomGridBackground.Container>
    </LightfastCustomGridBackground.Root>
  );
}
```

#### 3. Extract error banner to component
**File**: `apps/auth/src/app/(app)/(early-access)/_components/error-banner.tsx` (NEW)
**Changes**: Move inline error display (page.tsx lines 86-111) to a dedicated server component.

```tsx
interface EarlyAccessErrorBannerProps {
  isRateLimit: boolean;
  message: string;
}

export function EarlyAccessErrorBanner({
  isRateLimit,
  message,
}: EarlyAccessErrorBannerProps) {
  return (
    <div className="space-y-1">
      <div
        className={`rounded-lg border p-3 ${
          isRateLimit
            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        }`}
      >
        <p
          className={`text-sm ${
            isRateLimit
              ? "text-yellow-800 dark:text-yellow-200"
              : "text-red-800 dark:text-red-200"
          }`}
        >
          {message}
        </p>
      </div>
      {isRateLimit && (
        <p className="text-muted-foreground text-sm">
          Please wait a moment before trying again.
        </p>
      )}
    </div>
  );
}
```

#### 4. Update `page.tsx`
**File**: `apps/auth/src/app/(app)/(early-access)/early-access/page.tsx`
**Changes**:
- Fix `searchParams` type to `Promise<SearchParams>` from `nuqs/server`
- Remove inline layout wrapper (now in `layout.tsx`)
- Replace inline error banner with `EarlyAccessErrorBanner` component

```tsx
import { Icons } from "@repo/ui/components/icons";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { ConfettiWrapper } from "../_components/confetti-wrapper";
import { EarlyAccessErrorBanner } from "../_components/error-banner";
import { EarlyAccessFormServer } from "../_components/early-access-form-server";
import { loadEarlyAccessSearchParams } from "../_lib/search-params";

export const metadata: Metadata = createMetadata({
  title: "Early Access – Lightfast",
  description:
    "Get early access to the operating layer between your agents and apps. Connect your tools, observe events in real time, and give agents a single system to operate through.",
  openGraph: {
    title: "Early Access – Lightfast",
    description:
      "Get early access to the operating layer between your agents and apps. Observe events, build memory, and act across your entire tool stack.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access – Lightfast",
    description: "Get early access to the operating layer for agents and apps.",
  },
  alternates: {
    canonical: "https://lightfast.ai/early-access",
  },
});

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const {
    email,
    companySize,
    sources,
    error,
    emailError,
    companySizeError,
    sourcesError,
    isRateLimit,
    success,
  } = await loadEarlyAccessSearchParams(searchParams);

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="w-fit rounded-sm bg-card p-3">
        <Icons.logoShort className="h-5 w-5 text-foreground" />
      </div>

      {success ? (
        <>
          <ConfettiWrapper />
          <div className="fade-in slide-in-from-bottom-4 animate-in space-y-4 duration-300">
            <div className="space-y-2">
              <h2 className="font-semibold text-2xl text-foreground">
                You're in!
              </h2>
              <p className="text-muted-foreground text-sm">
                Successfully joined early access! We'll send you an invite
                when Lightfast is ready.
              </p>
            </div>
            {email && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-muted-foreground text-sm">
                  We'll send updates to{" "}
                  <span className="font-medium text-foreground">
                    {email}
                  </span>
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Join the Early Access waitlist
          </h1>

          {error && (
            <EarlyAccessErrorBanner isRateLimit={isRateLimit} message={error} />
          )}

          <EarlyAccessFormServer
            companySizeError={companySizeError}
            emailError={emailError}
            initialCompanySize={companySize}
            initialEmail={email}
            initialSources={
              sources ? sources.split(",").filter(Boolean) : []
            }
            sourcesError={sourcesError}
          />
        </>
      )}
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [ ] `/early-access` renders correctly — form centered, logo visible, same visual layout as before
- [ ] `/early-access?success=true&email=test@example.com` shows confetti + "You're in!" screen
- [ ] `/early-access?error=Something+went+wrong` shows red error banner above form
- [ ] `/early-access?error=Rate+limited&isRateLimit=true` shows yellow banner with "Please wait" hint
- [ ] `/early-access?emailError=Invalid+email&email=bad` shows field-level error below email input
- [ ] Unhandled throw in the route shows the new error boundary (not the app-level one)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Clerk SDK Migration

### Overview
Replace the raw `fetch` call to Clerk's waitlist API + 304-line custom error handler with `clerkClient().waitlistEntries.create()` + `isClerkAPIResponseError`. Replace `buildEarlyAccessUrl()` with `serializeEarlyAccessParams()`. Delete `clerk-error-handler.ts`.

### Changes Required:

#### 1. Rewrite `_actions/early-access.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts`
**Changes**:
- Remove: `import { env } from "~/env"`, `import { handleClerkError }`, `buildEarlyAccessUrl()` function
- Add: `import { clerkClient } from "@vendor/clerk/server"`, `import { isClerkAPIResponseError } from "@vendor/clerk"`, `import { serializeEarlyAccessParams } from "../_lib/search-params"`
- Replace all `buildEarlyAccessUrl(...)` calls with `serializeEarlyAccessParams("/early-access", ...)`
- Replace the raw `fetch` block (lines 207-289) with `clerkClient().waitlistEntries.create()` + `isClerkAPIResponseError` error handling
- Drop `public_metadata` from the Clerk call
- Simplify the nested try/catch structure — the SDK throw model means one catch block handles all Clerk errors

The full rewritten file:

```ts
"use server";

import { captureException } from "@sentry/nextjs";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { clerkClient } from "@vendor/clerk/server";
import {
  ARCJET_KEY,
  arcjet,
  detectBot,
  fixedWindow,
  request,
  shield,
  slidingWindow,
  validateEmail,
} from "@vendor/security";
import { redis } from "@vendor/upstash";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { serializeEarlyAccessParams } from "../_lib/search-params";

const earlyAccessSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  companySize: z.string().min(1, "Company size is required"),
  sources: z.array(z.string()).min(1, "Please select at least one data source"),
});

const EARLY_ACCESS_EMAILS_SET_KEY = "early-access:emails";

// Configure Arcjet protection for early access signup
const aj = arcjet({
  key: ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    validateEmail({
      mode: "LIVE",
      deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
    }),
    shield({
      mode: env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
    }),
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
      ],
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "1h",
      max: 10,
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "24h",
      max: 50,
    }),
    fixedWindow({
      mode: "LIVE",
      window: "10s",
      max: 3,
    }),
  ],
});

export async function joinEarlyAccessAction(
  formData: FormData
): Promise<never> {
  try {
    // Parse raw form values for preserving across redirects
    const rawEmail = (formData.get("email") as string | null) ?? "";
    const rawCompanySize = (formData.get("companySize") as string | null) ?? "";
    const rawSources = (formData.get("sources") as string | null) ?? "";

    // Validate form data
    const validatedFields = earlyAccessSchema.safeParse({
      email: rawEmail,
      companySize: rawCompanySize,
      sources: rawSources.split(",").filter(Boolean),
    });

    // Redirect with field errors if validation fails
    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      redirect(
        serializeEarlyAccessParams("/early-access", {
          email: rawEmail,
          companySize: rawCompanySize,
          sources: rawSources,
          emailError: fieldErrors.email?.[0] ?? null,
          companySizeError: fieldErrors.companySize?.[0] ?? null,
          sourcesError: fieldErrors.sources?.[0] ?? null,
        })
      );
    }

    // Fields have been validated
    const { email, companySize, sources } = validatedFields.data;
    const sourcesStr = sources.join(",");

    // Check Arcjet protection with the validated email
    const req = await request();
    const decision = await aj.protect(req, { email });

    // Handle denied requests from Arcjet
    if (decision.isDenied()) {
      const reason = decision.reason;

      if (reason.isRateLimit()) {
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: "Too many signup attempts. Please try again later.",
            isRateLimit: true,
            email,
            companySize,
            sources: sourcesStr,
          })
        );
      }

      let errorMessage =
        "Your request could not be processed. Please try again.";
      if (reason.isBot()) {
        errorMessage =
          "Automated signup detected. Please complete the form manually.";
      } else if (reason.isShield()) {
        errorMessage =
          "Request blocked for security reasons. Please try again.";
      } else if (
        "isEmail" in reason &&
        typeof reason.isEmail === "function" &&
        reason.isEmail()
      ) {
        errorMessage =
          "Please use a valid email address. Temporary or disposable email addresses are not allowed.";
      }

      redirect(
        serializeEarlyAccessParams("/early-access", {
          error: errorMessage,
          email,
          companySize,
          sources: sourcesStr,
        })
      );
    }

    // Check if email already exists in Redis for fast duplicate detection
    try {
      const emailExists = await redis.sismember(
        EARLY_ACCESS_EMAILS_SET_KEY,
        email
      );
      if (emailExists) {
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: "This email is already registered for early access!",
          })
        );
      }
    } catch (redisError) {
      if (isRedirectError(redisError)) throw redisError;
      console.error("Redis error checking early access:", redisError);
      captureException(redisError, {
        tags: { action: "joinEarlyAccess:redis-check", email },
      });
    }

    // Add to Clerk waitlist via SDK
    const clerk = await clerkClient();
    await clerk.waitlistEntries.create({ emailAddress: email });

    // Track in Redis after response is sent (non-blocking)
    after(async () => {
      try {
        await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
      } catch (redisError) {
        console.error("Failed to add email to Redis tracking:", redisError);
        captureException(redisError, {
          tags: { action: "joinEarlyAccess:redis-add", email },
        });
      }
    });

    // Success — redirect with success state
    redirect(
      serializeEarlyAccessParams("/early-access", {
        success: true,
        email,
      })
    );
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — must re-throw
    if (isRedirectError(error)) throw error;

    // Handle Clerk SDK errors with typed error checking
    if (isClerkAPIResponseError(error)) {
      const code = error.errors[0]?.code;

      if (code === "email_address_exists" || code === "form_identifier_exists") {
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: "This email is already registered for early access!",
          })
        );
      }

      if (error.status === 429 || code === "too_many_requests" || code === "rate_limit_exceeded") {
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: "Too many signup attempts. Please try again later.",
            isRateLimit: true,
          })
        );
      }

      if (code === "user_locked") {
        const seconds = (error.errors[0]?.meta as Record<string, unknown>)
          ?.lockout_expires_in_seconds as number | undefined;
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: seconds
              ? `Your account is temporarily locked. Please try again in ${Math.ceil(seconds / 60)} minutes.`
              : "Your account is temporarily locked. Please try again later.",
          })
        );
      }

      // All other Clerk errors: log + generic message
      captureException(error, {
        tags: { action: "joinEarlyAccess:clerk" },
      });
      redirect(
        serializeEarlyAccessParams("/early-access", {
          error: error.errors[0]?.longMessage ?? "An unexpected error occurred. Please try again.",
        })
      );
    }

    // Non-Clerk errors
    console.error("Error in early access action:", error);
    captureException(error, {
      tags: { action: "joinEarlyAccess:unexpected" },
    });
    redirect(
      serializeEarlyAccessParams("/early-access", {
        error: "An error occurred. Please try again.",
      })
    );
  }
}
```

**Key structural changes:**
1. **Flattened try/catch** — The original had nested try/catch blocks (outer for general, inner for Clerk, inner for Redis). The SDK throw model means Clerk errors propagate to the outer catch. The Redis section keeps its own try/catch because Redis failures should not block the user.
2. **No more `response.ok` check** — The SDK throws on non-2xx responses.
3. **`env.CLERK_SECRET_KEY` removed from action** — `clerkClient()` reads `CLERK_SECRET_KEY` internally.
4. **`public_metadata` dropped** — SDK doesn't support it; data is still tracked in Redis via `after()`.
5. **`buildEarlyAccessUrl` deleted** — replaced by `serializeEarlyAccessParams` from Phase 1.

**Note on `env` import**: `env.NODE_ENV` is still needed for the Arcjet shield mode, so the `import { env } from "~/env"` stays but only for `env.NODE_ENV`. If `env.CLERK_SECRET_KEY` was the only usage, we'd remove it — but verify `env` exports `NODE_ENV` from the same module.

#### 2. Delete `clerk-error-handler.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_lib/clerk-error-handler.ts`
**Action**: Delete this file entirely (304 lines).

No other files import from this module — it was only used by `_actions/early-access.ts`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds: `pnpm build:auth`
- [x] No references to `clerk-error-handler` remain: `grep -r "clerk-error-handler" apps/auth/`

#### Manual Verification:
- [ ] `/early-access` form submission with a new email → success screen
- [ ] `/early-access` form submission with duplicate email → "already registered" error
- [ ] `/early-access` form submission with invalid email → field-level validation error
- [ ] `/early-access` form submission with missing fields → field-level validation errors with values preserved
- [ ] Rate-limited submission → yellow "Too many signup attempts" banner

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: (auth) Actions Serializer Adoption

### Overview
Update `sign-in.ts` and `sign-up.ts` to use `serializeSignInParams`/`serializeSignUpParams` instead of manual template literals with `encodeURIComponent`.

### Changes Required:

#### 1. Update `sign-in.ts`
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts`
**Changes**: Replace manual template literals with serializer.

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeSignInParams } from "../_lib/search-params";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function initiateSignIn(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    redirect(serializeSignInParams("/sign-in", { error: message }));
  }

  // Email validated. Redirect to OTP step — the client island will call
  // signIn.emailCode.sendCode() via Clerk's FAPI.
  redirect(serializeSignInParams("/sign-in", { step: "code", email: parsed.data.email }));
}
```

#### 2. Update `sign-up.ts`
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-up.ts`
**Changes**: Replace manual template literals + `ticketParam` ternary with serializer. Null values are automatically omitted by `createSerializer`.

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeSignUpParams } from "../_lib/search-params";

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
    const rawTicket = (formData.get("ticket") as string | null) ?? undefined;
    redirect(
      serializeSignUpParams("/sign-up", {
        error: message,
        ticket: rawTicket ?? null,
      })
    );
  }

  // Email validated. Redirect to OTP step — the client island will handle
  // signUp.emailCode.sendCode() or signUp.ticket() via Clerk's FAPI.
  redirect(
    serializeSignUpParams("/sign-up", {
      step: "code",
      email: parsed.data.email,
      ticket: parsed.data.ticket ?? null,
    })
  );
}
```

**Key improvement**: The `ticketParam` ternary (`parsed.data.ticket ? \`&ticket=${encodeURIComponent(...)}\` : ""`) is eliminated. `createSerializer` handles null omission automatically — passing `ticket: null` simply excludes it from the URL.

#### 3. Update existing action unit tests
**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.test.ts`
**Changes**: The test assertions on exact redirect URLs may need updating if `createSerializer` produces slightly different parameter ordering than the manual template literals. However, `createSerializer` uses `URLSearchParams` internally which produces stable alphabetical ordering. The assertions should remain compatible, but verify after running tests.

**File**: `apps/auth/src/app/(app)/(auth)/_actions/sign-up.test.ts`
**Changes**: Same consideration. Run existing tests and fix any assertion mismatches due to parameter ordering.

**Important**: The existing tests mock `next/navigation` and assert exact redirect URL strings. If `createSerializer` orders params differently (e.g., `email=...&step=code` vs `step=code&email=...`), update the test assertions to match the new ordering. Alternatively, parse both URLs and compare params individually.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [x] Existing unit tests pass: `cd apps/auth && pnpm vitest run`
- [ ] Auth app builds: `pnpm build:auth`
- [x] No `encodeURIComponent` remains in action files: `grep -r "encodeURIComponent" apps/auth/src/app/\(app\)/\(auth\)/_actions/`

#### Manual Verification:
- [ ] Sign-in with valid email → redirects to OTP step with email preserved
- [ ] Sign-in with invalid email → error message displayed on sign-in page
- [ ] Sign-up with valid email → redirects to OTP step
- [ ] Sign-up with ticket → ticket preserved in redirect URL
- [ ] Sign-up with invalid email + ticket → error displayed, ticket preserved

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

Testing is explicitly out of scope for this plan. A follow-up plan should cover:
- `_lib/search-params.test.ts` for `(early-access)` parsers
- `_actions/early-access.test.ts` with `clerkClient` mocks (simpler than the old `fetch` + `handleClerkError` mock structure)
- E2E URL-driven state tests for `/early-access`

## Performance Considerations

- **No performance impact** — `createSerializer` is a thin wrapper around `URLSearchParams`. The SDK `waitlistEntries.create()` makes the same HTTP call as the raw `fetch` but with built-in retry and error handling.
- **One fewer HTTP header** — removing `Authorization: Bearer ${env.CLERK_SECRET_KEY}` from the action (clerkClient handles it internally).

## Migration Notes

- **`public_metadata` dropped** — The Clerk dashboard will no longer show companySize/sources/submittedAt on new waitlist entries. Existing entries retain their metadata. This data is still captured in Redis via the `after()` callback.
- **`clerk-error-handler.ts` deleted** — If any future code needs Clerk error handling, use `isClerkAPIResponseError` from `@vendor/clerk` directly (same pattern as `apps/console/src/app/lib/clerk/error-handling.ts`).
- **Unit test updates** — Existing `sign-in.test.ts` and `sign-up.test.ts` may need assertion updates for parameter ordering changes from `createSerializer`.

## References

- Related research: `thoughts/shared/research/2026-03-09-auth-early-access-architecture-and-testing.md`
- Auth error boundary pattern: `apps/auth/src/app/(app)/(auth)/error.tsx:1-57`
- Auth layout pattern: `apps/auth/src/app/(app)/(auth)/layout.tsx:1-57`
- Clerk SDK error handling pattern: `apps/console/src/app/lib/clerk/error-handling.ts:1`
- Clerk client usage pattern: `api/console/src/router/user/account.ts:3`
- nuqs createSerializer docs: https://nuqs.dev/docs/utilities
