# Product-Wide Waitlist Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Lightfast's waitlist product surface and Clerk waitlist integration end to end while preserving `/early-access` as a query-stripping permanent redirect to `/sign-up`.

**Architecture:** Remove waitlist as an auth error state, delete the early-access route group, and make the proxy own legacy `/early-access` redirects before Clerk/public-route handling. Marketing keeps conversion CTAs, renamed to `Get started`, while auth pages use contextual `Sign up` / `Log in` account navigation.

**Tech Stack:** Next.js App Router, Clerk custom auth hooks, Vercel Microfrontends links, Vitest/Testing Library, pnpm/Turborepo.

---

## File Structure

- Modify `apps/app/src/app/(auth)/_lib/search-params.ts`: remove `waitlist` from typed auth error codes and update `account_not_found` copy.
- Modify `apps/app/src/app/(auth)/_hooks/auth-errors.ts`: map Clerk `sign_up_restricted_waitlist` to generic inline failure instead of `errorCode=waitlist`.
- Modify `apps/app/src/app/(auth)/_components/error-banner.tsx`: remove waitlist branch and make `account_not_found` link to `/sign-up`.
- Modify `apps/app/src/app/(auth)/sign-in/page.tsx`: remove waitlist special handling and add the form-local sign-up footer.
- Modify `apps/app/src/app/(auth)/sign-up/page.tsx`: remove waitlist special handling and normalize footer casing to `Log in`.
- Modify `apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx`: rely on generic inline waitlist-misconfiguration handling.
- Create `apps/app/src/app/(auth)/_components/auth-header-cta.tsx`: client component that uses `usePathname()` for contextual `Sign up` / `Log in`.
- Modify `apps/app/src/app/(auth)/layout.tsx`: replace the early-access CTA with `AuthHeaderCta`.
- Modify `apps/app/src/app/layout.tsx`: remove `waitlistUrl`.
- Create `apps/app/src/__tests__/app/layout.test.tsx`: assert `ClerkProvider` no longer receives `waitlistUrl`.
- Modify `apps/app/src/proxy.ts`: add a pre-auth `308` redirect for `/early-access(.*)` that strips search params; remove `/early-access(.*)` from `PUBLIC_ROUTE_PATTERNS`.
- Delete `apps/app/src/app/(early-access)/**`: retired early-access route, server action, form components, and search-param helpers.
- Delete `apps/app/src/__tests__/app/(early-access)/**`: retired early-access tests.
- Modify app auth/proxy tests under `apps/app/src/__tests__`.
- Rename `apps/www/src/app/(app)/_components/waitlist-cta.tsx` to `get-started-cta.tsx`.
- Modify `apps/www` marketing/nav files that link to `/early-access` or import `WaitlistCTA`.
- Modify `apps/www/src/app/sitemap.ts`: remove `/early-access`.
- Preserve `packages/app-reserved-names/**` and `apps/www/src/config/pitch-deck-data.ts` waitlist references.

## Task 1: Remove Waitlist From Auth Error Model

**Files:**
- Modify: `apps/app/src/app/(auth)/_lib/search-params.ts`
- Modify: `apps/app/src/app/(auth)/_hooks/auth-errors.ts`
- Modify: `apps/app/src/app/(auth)/_components/error-banner.tsx`
- Modify: `apps/app/src/__tests__/auth-search-params.test.ts`
- Modify: `apps/app/src/__tests__/auth-errors.test.ts`
- Modify: `apps/app/src/__tests__/app/(auth)/sign-in/page.test.tsx`
- Modify: `apps/app/src/__tests__/app/(auth)/sign-up/page.test.tsx`
- Modify: `apps/app/src/__tests__/app/(auth)/sign-up/accept-invitation/page.test.tsx`

- [ ] **Step 1: Update auth search-param tests first**

Change `apps/app/src/__tests__/auth-search-params.test.ts` expectations to this behavior:

```ts
describe("authErrorCodes", () => {
  it("exports the expected canonical error codes", () => {
    expect(authErrorCodes).toEqual(["account_not_found"]);
  });

  it("has a canonical message for each error code", () => {
    for (const code of authErrorCodes) {
      expect(AUTH_ERROR_MESSAGES[code]).toBeTypeOf("string");
      expect(AUTH_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe("authErrorSearchParams", () => {
  it("parses valid errorCode values", () => {
    expect(authErrorSearchParams.errorCode.parse("account_not_found")).toBe(
      "account_not_found"
    );
  });

  it("rejects invalid errorCode values", () => {
    expect(authErrorSearchParams.errorCode.parse("waitlist")).toBe(null);
    expect(authErrorSearchParams.errorCode.parse("invalid")).toBe(null);
    expect(authErrorSearchParams.errorCode.parse("")).toBe(null);
  });

  it("parses arbitrary error strings", () => {
    expect(
      authErrorSearchParams.error.parse("Please enter a valid email")
    ).toBe("Please enter a valid email");
  });
});

describe("acceptInvitationSearchParams", () => {
  it("parses __clerk_ticket strings", () => {
    expect(acceptInvitationSearchParams.__clerk_ticket.parse("tok_abc")).toBe(
      "tok_abc"
    );
  });

  it("shares the same errorCode parser as authErrorSearchParams", () => {
    expect(
      acceptInvitationSearchParams.errorCode.parse("account_not_found")
    ).toBe("account_not_found");
    expect(acceptInvitationSearchParams.errorCode.parse("waitlist")).toBe(null);
    expect(acceptInvitationSearchParams.errorCode.parse("invalid")).toBe(null);
  });
});
```

- [ ] **Step 2: Update auth error mapping tests**

In `apps/app/src/__tests__/auth-errors.test.ts`, replace both waitlist mapping tests with generic inline failure expectations:

```ts
it("maps sign_up_restricted_waitlist to a generic inline configuration failure", () => {
  expect(mapOtpClerkError({ code: "sign_up_restricted_waitlist" })).toEqual({
    kind: "inline",
    message: "Authentication failed",
  });
});
```

```ts
it("extracts errors[0].code for waitlist restriction without exposing waitlist UX", () => {
  const err = makeApiResponseError({ code: "sign_up_restricted_waitlist" });
  expect(mapOtpClerkError(err)).toEqual({
    kind: "inline",
    message: "Authentication failed",
  });
});
```

- [ ] **Step 3: Update auth page tests for removed waitlist UI**

In `apps/app/src/__tests__/app/(auth)/sign-in/page.test.tsx`:

- Replace the send-code waitlist redirect test with an inline error redirect test:

```ts
it("redirects to a generic error when Clerk waitlist mode is still enabled", async () => {
  signInStub.emailCode.sendCode.mockResolvedValue({
    error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
  });
  render(<SignInPage />);

  fireEvent.change(screen.getByPlaceholderText(/email address/i), {
    target: { value: "u@example.com" },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /continue with email/i })
    );
  });

  await waitFor(() => {
    expect(hrefValue).toBe("/sign-in?error=Authentication+failed");
  });
});
```

- Replace the waitlist banner tests with:

```ts
it("ignores retired ?errorCode=waitlist URLs", () => {
  searchParamsValue = new URLSearchParams("errorCode=waitlist");
  render(<SignInPage />);

  expect(
    screen.queryByText(/sign-ups are currently unavailable/i)
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /join the waitlist/i })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /log in to lightfast/i })
  ).toBeInTheDocument();
});

it("renders a sign-up action when ?errorCode=account_not_found is present", () => {
  searchParamsValue = new URLSearchParams("errorCode=account_not_found");
  render(<SignInPage />);

  expect(
    screen.getByText(/couldn't find a lightfast account/i)
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
    "href",
    "/sign-up"
  );
});
```

In `apps/app/src/__tests__/app/(auth)/sign-up/page.test.tsx`, replace the waitlist URL test with:

```ts
it("ignores retired ?errorCode=waitlist URLs", () => {
  searchParamsValue = new URLSearchParams("errorCode=waitlist");
  render(<SignUpPage />);

  expect(
    screen.queryByText(/sign-ups are currently unavailable/i)
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /sign up for lightfast/i })
  ).toBeInTheDocument();
});
```

In `apps/app/src/__tests__/app/(auth)/sign-up/accept-invitation/page.test.tsx`:

- Replace the waitlist rejection redirect test with:

```ts
it("renders a generic page error when Clerk waitlist mode is still enabled", async () => {
  clerkStub.client.signUp.create.mockRejectedValue({
    code: "sign_up_restricted_waitlist",
    message: "waitlist",
  });

  render(<AcceptInvitationPage />);

  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /accept invitation/i })
    );
  });

  await waitFor(() => {
    expect(screen.getByText(/^authentication failed$/i)).toBeInTheDocument();
  });
  expect(hrefValue).toBe("");
});
```

- Replace the waitlist URL banner test with:

```ts
it("ignores retired ?errorCode=waitlist URLs alongside a ticket", () => {
  searchParamsValue = new URLSearchParams(
    "__clerk_ticket=tok_abc123&errorCode=waitlist"
  );
  render(<AcceptInvitationPage />);

  expect(
    screen.queryByText(/sign-ups are currently unavailable/i)
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /accept invitation/i })
  ).toBeInTheDocument();
});
```

- [ ] **Step 4: Run focused tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/auth-search-params.test.ts src/__tests__/auth-errors.test.ts 'src/__tests__/app/(auth)/sign-in/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/accept-invitation/page.test.tsx'
```

Expected: failures mentioning `waitlist` is still a valid auth code, waitlist banners still render, and waitlist errors still redirect.

- [ ] **Step 5: Implement auth model removal**

Update `apps/app/src/app/(auth)/_lib/search-params.ts`:

```ts
import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

// Typed error codes — the authoritative discriminant for error rendering.
// Known errors carry their canonical message here; `error` is for dynamic
// validation messages only (e.g. "Please enter a valid email address").
export const authErrorCodes = ["account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  account_not_found:
    "We couldn't find a Lightfast account for that email. Create an account to continue.",
};

// Shared error-only schema for sign-in and sign-up.
export const authErrorSearchParams = {
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

// Accept-invitation schema includes the ticket.
export const acceptInvitationSearchParams = {
  __clerk_ticket: parseAsString,
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

export const loadAuthErrorSearchParams = createLoader(authErrorSearchParams);
export const loadAcceptInvitationSearchParams = createLoader(
  acceptInvitationSearchParams
);
```

Update the waitlist case in `apps/app/src/app/(auth)/_hooks/auth-errors.ts`:

```ts
    case "sign_up_restricted_waitlist":
      return { kind: "inline", message: "Authentication failed" };
```

Update `apps/app/src/app/(auth)/_components/error-banner.tsx` so it has only an `account_not_found` special branch:

```tsx
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../_lib/search-params";

interface ErrorBannerProps {
  backUrl: string;
  errorCode?: AuthErrorCode | null;
  message?: string | null;
}

export function ErrorBanner({ message, errorCode, backUrl }: ErrorBannerProps) {
  const displayMessage =
    message ??
    (errorCode ? AUTH_ERROR_MESSAGES[errorCode] : null) ??
    "An error occurred.";

  if (errorCode === "account_not_found") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{displayMessage}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/sign-up">Sign up</Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={backUrl}>Try again</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-destructive/30 p-3">
        <p className="text-foreground text-sm">{displayMessage}</p>
      </div>
      <Button asChild className="w-full" size="lg" variant="outline">
        <a href={backUrl}>Try again</a>
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Remove waitlist branches from auth pages**

In `apps/app/src/app/(auth)/sign-in/page.tsx` and `apps/app/src/app/(auth)/sign-up/page.tsx`:

- Delete `handleWaitlist`.
- In `handleOtpClerkError`, replace the `mapped.kind === "code"` block with:

```ts
      if (mapped.kind === "code") {
        setOtpError(authErrorMessage(mapped.errorCode));
        return { success: false };
      }
```

No code change is needed in `accept-invitation/page.tsx` beyond what falls out of `mapOtpClerkError`; the existing `mapped.kind === "inline"` branch should now render the generic page error.

- [ ] **Step 7: Run focused tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/auth-search-params.test.ts src/__tests__/auth-errors.test.ts 'src/__tests__/app/(auth)/sign-in/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/accept-invitation/page.test.tsx'
```

Expected: all listed tests pass.

- [ ] **Step 8: Commit auth error model removal**

Run:

```bash
git add 'apps/app/src/app/(auth)' apps/app/src/__tests__/auth-search-params.test.ts apps/app/src/__tests__/auth-errors.test.ts 'apps/app/src/__tests__/app/(auth)'
git commit -m "fix: remove waitlist auth error state"
```

## Task 2: Add Contextual Auth Navigation

**Files:**
- Create: `apps/app/src/app/(auth)/_components/auth-header-cta.tsx`
- Modify: `apps/app/src/app/(auth)/layout.tsx`
- Modify: `apps/app/src/app/(auth)/sign-in/page.tsx`
- Modify: `apps/app/src/app/(auth)/sign-up/page.tsx`
- Create: `apps/app/src/__tests__/app/(auth)/layout.test.tsx`
- Modify: `apps/app/src/__tests__/app/(auth)/sign-in/page.test.tsx`
- Modify: `apps/app/src/__tests__/app/(auth)/sign-up/page.test.tsx`

- [ ] **Step 1: Add failing auth layout tests**

Create `apps/app/src/__tests__/app/(auth)/layout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/sign-in";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: AuthLayout } = await import("~/app/(auth)/layout");

describe("auth layout", () => {
  beforeEach(() => {
    pathname = "/sign-in";
  });

  it("shows Sign up in the header on sign-in", () => {
    render(
      <AuthLayout>
        <main>Auth page</main>
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });

  it("shows Log in in the header on sign-up", () => {
    pathname = "/sign-up";

    render(
      <AuthLayout>
        <main>Auth page</main>
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });

  it("shows Log in in the header on invitation acceptance", () => {
    pathname = "/sign-up/accept-invitation";

    render(
      <AuthLayout>
        <main>Auth page</main>
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});
```

In `apps/app/src/__tests__/app/(auth)/sign-in/page.test.tsx`, add:

```ts
it("renders a form-local sign-up recovery link", () => {
  render(<SignInPage />);

  expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
    "href",
    "/sign-up"
  );
});
```

In `apps/app/src/__tests__/app/(auth)/sign-up/page.test.tsx`, add or update an assertion for the existing footer:

```ts
it("renders a form-local login recovery link", () => {
  render(<SignUpPage />);

  expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute(
    "href",
    "/sign-in"
  );
});
```

- [ ] **Step 2: Run auth layout/page tests and verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(auth)/layout.test.tsx' 'src/__tests__/app/(auth)/sign-in/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/page.test.tsx'
```

Expected: layout test fails because header still points to `/early-access`; sign-in footer test fails because the footer does not exist.

- [ ] **Step 3: Add the contextual header component**

Create `apps/app/src/app/(auth)/_components/auth-header-cta.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthHeaderCta() {
  const pathname = usePathname();
  const isSignIn = pathname === "/sign-in";
  const href = isSignIn ? "/sign-up" : "/sign-in";
  const label = isSignIn ? "Sign up" : "Log in";

  return (
    <Button asChild className="rounded-full" size="lg" variant="secondary">
      <Link href={href} prefetch={true}>
        {label}
      </Link>
    </Button>
  );
}
```

Modify `apps/app/src/app/(auth)/layout.tsx`:

- Remove `import Link from "next/link";`.
- Add `import { AuthHeaderCta } from "./_components/auth-header-cta";`.
- Replace the right header button block with:

```tsx
          <div className="flex items-center gap-2 md:justify-self-end">
            <AuthHeaderCta />
          </div>
```

- [ ] **Step 4: Add the sign-in footer and normalize sign-up copy**

In `apps/app/src/app/(auth)/sign-in/page.tsx`, add `import NextLink from "next/link";`, then add this block after the main form/code container inside the returned root `<div>`:

```tsx
      {view === "email" && !hasError && (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Don&apos;t have an account?{" "}
          </span>
          <Button
            asChild
            className="inline-flex h-auto rounded-none p-0 text-sm"
            variant="link-blue"
          >
            <NextLink href="/sign-up" prefetch>
              Sign up
            </NextLink>
          </Button>
        </div>
      )}
```

In `apps/app/src/app/(auth)/sign-up/page.tsx`, change the existing footer link text from `Log In` to:

```tsx
              Log in
```

- [ ] **Step 5: Run auth navigation tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(auth)/layout.test.tsx' 'src/__tests__/app/(auth)/sign-in/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/page.test.tsx'
```

Expected: all listed tests pass.

- [ ] **Step 6: Commit contextual auth navigation**

Run:

```bash
git add 'apps/app/src/app/(auth)' 'apps/app/src/__tests__/app/(auth)'
git commit -m "feat: add contextual auth navigation"
```

## Task 3: Retire Early Access Route and Clerk Waitlist Config

**Files:**
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/app/layout.tsx`
- Modify: `apps/app/src/__tests__/proxy.test.ts`
- Create: `apps/app/src/__tests__/app/layout.test.tsx`
- Delete: `apps/app/src/app/(early-access)/**`
- Delete: `apps/app/src/__tests__/app/(early-access)/**`

- [ ] **Step 1: Add failing proxy redirect and provider coverage**

In `apps/app/src/__tests__/proxy.test.ts`, add a new `describe` block near the public-route tests:

```ts
describe("proxy retired early-access redirects", () => {
  it("permanently redirects /early-access to sign-up without query params", async () => {
    const { response } = await invoke("/early-access?email=u%40example.com");

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/sign-up"
    );
    expect(authMock).not.toHaveBeenCalled();
  });

  it("permanently redirects nested early-access paths to sign-up", async () => {
    const { response } = await invoke("/early-access/thanks?success=true");

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/sign-up"
    );
    expect(authMock).not.toHaveBeenCalled();
  });
});
```

Create `apps/app/src/__tests__/app/layout.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let clerkProviderProps: Record<string, unknown> | undefined;

interface Kids {
  children?: React.ReactNode;
}

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
  },
}));

vi.mock("@vendor/clerk", () => ({
  ClerkProvider: ({ children, ...props }: Kids & Record<string, unknown>) => {
    clerkProviderProps = props;
    return <>{children}</>;
  },
}));

vi.mock("@vendor/analytics/vercel", () => ({
  SpeedInsights: () => null,
  VercelAnalytics: () => null,
}));

vi.mock("@vendor/seo/metadata", () => ({
  createMetadata: (input: unknown) => input,
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  PrefetchCrossZoneLinks: () => null,
  PrefetchCrossZoneLinksProvider: ({ children }: Kids) => <>{children}</>,
}));

const { default: RootLayout } = await import("~/app/layout");

describe("root layout ClerkProvider", () => {
  beforeEach(() => {
    clerkProviderProps = undefined;
  });

  it("configures Clerk auth URLs without a waitlist URL", () => {
    render(
      <RootLayout>
        <main>App</main>
      </RootLayout>
    );

    expect(clerkProviderProps).toMatchObject({
      afterSignOutUrl: "/sign-in",
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
    });
    expect(clerkProviderProps).not.toHaveProperty("waitlistUrl");
  });
});
```

- [ ] **Step 2: Run proxy test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/layout.test.tsx
```

Expected: new redirect tests fail because `/early-access` currently passes as a public route, and the root layout test fails because `ClerkProvider` still receives `waitlistUrl`.

- [ ] **Step 3: Implement proxy redirect and remove public allowlist**

In `apps/app/src/proxy.ts`:

- Remove `"/early-access(.*)",` from `PUBLIC_ROUTE_PATTERNS`.
- Add this matcher near `isPublicRoute`:

```ts
const isRetiredEarlyAccessRoute = createRouteMatcher(["/early-access(.*)"]);
```

- Add this branch at the start of the default `proxy()` function, before the `isApiRoute(req)` branch:

```ts
  if (isRetiredEarlyAccessRoute(req)) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/sign-up", req.url), 308)
    );
  }
```

- [ ] **Step 4: Remove Clerk waitlist provider prop**

In `apps/app/src/app/layout.tsx`, remove:

```tsx
          waitlistUrl="/early-access"
```

Do not change `signInUrl`, `signUpUrl`, sign-out URL, or fallback redirects.

- [ ] **Step 5: Delete the retired early-access route and tests**

Run:

```bash
rm -rf 'apps/app/src/app/(early-access)' 'apps/app/src/__tests__/app/(early-access)'
```

Then run:

```bash
rg -n "waitlistEntries|EARLY_ACCESS_EMAILS_SET_KEY|earlyAccessSearchParams|joinEarlyAccessAction" apps/app
```

Expected: no matches.

- [ ] **Step 6: Run proxy test and verify it passes**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/layout.test.tsx
```

Expected: all proxy and root layout tests pass.

- [ ] **Step 7: Commit early-access retirement**

Run:

```bash
git add apps/app/src/proxy.ts apps/app/src/app/layout.tsx apps/app/src/__tests__/proxy.test.ts apps/app/src/__tests__/app/layout.test.tsx
git add -A 'apps/app/src/app/(early-access)' 'apps/app/src/__tests__/app/(early-access)'
git commit -m "feat: redirect retired early access route"
```

## Task 4: Replace Marketing Waitlist CTAs With Get Started

**Files:**
- Rename: `apps/www/src/app/(app)/_components/waitlist-cta.tsx` -> `apps/www/src/app/(app)/_components/get-started-cta.tsx`
- Modify: `apps/www/src/config/nav.ts`
- Modify: `apps/www/src/app/(app)/_components/app-navbar.tsx`
- Modify: `apps/www/src/app/(app)/_components/app-mobile-nav.tsx`
- Modify: `apps/www/src/app/(app)/_components/app-navbar-menu.tsx`
- Modify: `apps/www/src/app/(app)/_components/app-footer.tsx`
- Modify: `apps/www/src/app/(app)/_components/faq-section.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(content)/layout.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/platform-engineers/page.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/technical-founders/page.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/engineering-leaders/page.tsx`
- Modify: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/agent-builders/page.tsx`
- Modify: `apps/www/src/app/sitemap.ts`
- Create: `apps/www/src/app/sitemap.test.ts`

- [ ] **Step 1: Add sitemap regression test**

Create `apps/www/src/app/sitemap.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("~/app/(app)/(content)/_lib/source", () => ({
  getBlogPages: () => [],
  getChangelogPages: () => [],
  getLegalPages: () => [],
}));

const { default: sitemap } = await import("./sitemap");

describe("sitemap", () => {
  it("does not advertise the retired early-access URL", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).not.toContain("https://lightfast.ai/early-access");
  });
});
```

- [ ] **Step 2: Run www sitemap test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/www test -- src/app/sitemap.test.ts
```

Expected: fails because `/early-access` is still in the sitemap.

- [ ] **Step 3: Rename the CTA component and update its implementation**

Run:

```bash
git mv 'apps/www/src/app/(app)/_components/waitlist-cta.tsx' 'apps/www/src/app/(app)/_components/get-started-cta.tsx'
```

Replace the component body with:

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";

export function GetStartedCTA() {
  return (
    <section className="flex w-full flex-col items-center justify-center bg-card py-56 text-center">
      <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
        <h2 className="mb-12 font-normal font-pp text-4xl text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Try Lightfast now.
        </h2>

        <Button asChild className="rounded-full text-base" size="xl">
          <MicrofrontendLink href="/sign-up" prefetch={true}>
            Get started
          </MicrofrontendLink>
        </Button>
      </div>
    </section>
  );
}
```

Update imports and usages:

```tsx
import { GetStartedCTA } from "~/app/(app)/_components/get-started-cta";
```

```tsx
<GetStartedCTA />
```

- [ ] **Step 4: Update nav and page CTAs**

Apply these concrete changes:

- In `apps/www/src/config/nav.ts`, remove `{ title: "Early Access", href: "/early-access", microfrontend: true },` from `INTERNAL_NAV`.
- In `apps/www/src/app/(app)/_components/app-navbar.tsx`, change comment to `{/* Get started button */}`, `href="/sign-up"`, and button text to `Get started`.
- In `apps/www/src/app/(app)/_components/app-mobile-nav.tsx`, change the primary CTA `href` to `/sign-up` and text to `Get started`.
- In `apps/www/src/app/(app)/_components/app-navbar-menu.tsx`, remove the `.filter((i) => i.href !== "/early-access")` because `INTERNAL_NAV` no longer contains that route.
- In `apps/www/src/app/(app)/_components/app-footer.tsx`, replace the `Early Access` resource link with a microfrontend `/sign-up` link labeled `Get started`.
- In `apps/www/src/app/(app)/_components/faq-section.tsx`, change `href="/early-access"` to `href="/sign-up"` and `Join early access` to `Get started`.
- In `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`, change the JSON-LD offer URL to `https://lightfast.ai/sign-up`, update the hero CTA to `href="/sign-up"` with `Get started`, and update the renamed CTA import/usage.
- In each use-case page listed in this task, change `href="/early-access"` to `href="/sign-up"` and `<span>Join Early Access</span>` to `<span>Get started</span>`.
- In `apps/www/src/app/sitemap.ts`, delete the `/early-access` sitemap entry.

- [ ] **Step 5: Run www tests/typecheck**

Run:

```bash
pnpm --filter @lightfast/www test -- src/app/sitemap.test.ts
pnpm --filter @lightfast/www typecheck
```

Expected: sitemap test and typecheck pass.

- [ ] **Step 6: Commit marketing CTA updates**

Run:

```bash
git add apps/www
git commit -m "feat: replace waitlist marketing ctas"
```

## Task 5: Final Cleanup and Verification

**Files:**
- Modify: any remaining app/www runtime files found by the searches below.
- Preserve: `packages/app-reserved-names/data/organization-names.json`
- Preserve: `packages/app-reserved-names/data/workspace-names.json`
- Preserve: `apps/www/src/config/pitch-deck-data.ts`

- [ ] **Step 1: Remove remaining runtime waitlist references**

Run:

```bash
rg -n "early-access|Early Access|waitlist|Waitlist|waitlistUrl|waitlistEntries|sign_up_restricted_waitlist|Join Early|Join the Waitlist" apps/app apps/www packages api -g '!node_modules'
```

Expected allowed matches after cleanup:

```text
apps/app/src/proxy.ts:...isRetiredEarlyAccessPath...
apps/app/src/__tests__/proxy.test.ts:...proxy retired early-access redirects...
apps/app/src/app/(auth)/_hooks/auth-errors.ts:...sign_up_restricted_waitlist...
apps/app/src/__tests__/auth-errors.test.ts:...sign_up_restricted_waitlist...
apps/www/src/config/pitch-deck-data.ts:...5,000 teams on waitlist...
packages/app-reserved-names/data/organization-names.json:..."early-access"...
packages/app-reserved-names/data/workspace-names.json:..."early-access"...
```

Also update stale comments such as `Mirrors the (auth)/(early-access) error.tsx` in billing error files if they remain in `apps/app`.

- [ ] **Step 2: Verify no Clerk waitlist APIs remain**

Run:

```bash
rg -n "waitlistEntries|waitlistUrl|sign_up_restricted_waitlist|errorCode=waitlist" apps/app apps/www api packages -g '!node_modules'
```

Expected matches are limited to:

```text
apps/app/src/app/(auth)/_hooks/auth-errors.ts:...sign_up_restricted_waitlist...
apps/app/src/__tests__/auth-errors.test.ts:...sign_up_restricted_waitlist...
```

There must be no matches for `waitlistEntries`, `waitlistUrl`, or `errorCode=waitlist`.

- [ ] **Step 3: Run focused app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/auth-search-params.test.ts src/__tests__/auth-errors.test.ts src/__tests__/proxy.test.ts src/__tests__/app/layout.test.tsx 'src/__tests__/app/(auth)/layout.test.tsx' 'src/__tests__/app/(auth)/sign-in/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/page.test.tsx' 'src/__tests__/app/(auth)/sign-up/accept-invitation/page.test.tsx'
```

Expected: all listed tests pass.

- [ ] **Step 4: Run package typechecks**

Run:

```bash
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/www typecheck
```

Expected: both typechecks pass.

- [ ] **Step 5: Run broader repository checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: both commands pass. If `pnpm check` reports formatting or lint issues caused by edited files, run `pnpm fix`, review the diff, and rerun `pnpm check`.

- [ ] **Step 6: Document operational release gate**

Add this note to the PR description or release checklist, not to runtime code:

```md
Operational release gate: disable Clerk Waitlist mode in development and staging, verify `/sign-up`, then disable Clerk Waitlist mode in production before or at the same time as deploying this code. The app no longer provides waitlist recovery UX.
```

- [ ] **Step 7: Commit final cleanup**

If Step 1 or Step 5 changed files after the marketing commit, run:

```bash
git add apps/app apps/www packages api
git commit -m "chore: remove remaining waitlist references"
```

If no files changed, do not create an empty commit.
