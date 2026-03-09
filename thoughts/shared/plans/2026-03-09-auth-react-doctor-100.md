# Auth React Doctor 100/100 Implementation Plan

## Overview

Fix all 4 React Doctor issues in `apps/auth` to achieve a perfect 100/100 score. Currently at 97/100 with 1 error and 3 warnings.

## Current State Analysis

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Error | `oauth-button.tsx:26` | React Compiler can't optimize — conditionals inside try/catch |
| 2 | Warning | `sources-island.tsx:43` | `useState` initialized from prop `defaultSources` |
| 3 | Warning | `company-size-island.tsx:30` | `useState` initialized from prop `defaultValue` |
| 4 | Warning | `session-activator.tsx:42` | `<a>` instead of `next/link` for internal `/sign-in` link |

## Desired End State

All 4 files pass React Doctor with zero errors and zero warnings. Score: 100/100.

### Verification:
```bash
cd apps/auth && npx -y react-doctor@latest . --verbose --diff
```

## What We're NOT Doing

- No behavior changes — all fixes are structural refactors only
- No changes to form submission logic or server actions
- No changes to OAuth flow behavior
- No new dependencies

## Implementation Approach

All 4 fixes are independent. Single phase, one file at a time.

## Phase 1: Fix All React Doctor Issues

### 1. Extract try body to fix React Compiler — `oauth-button.tsx`

**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-button.tsx`
**Problem**: Lines 24-95 have conditional/logical/optional-chaining expressions inside a single try/catch block. The React Compiler can't optimize this (known limitation).
**Fix**: Extract the three OAuth branches into separate async functions defined inside the component. The try/catch block then contains only `await fn()` — no conditionals.

```tsx
async function handleOAuth(strategy: OAuthStrategy) {
  setLoading(true);
  try {
    if (mode === "sign-up" && ticket) {
      await handleTicketSignUp();
    } else if (mode === "sign-in") {
      await handleSignIn(strategy);
    } else {
      await handleSignUp(strategy);
    }
  } catch {
    toast.error("An unexpected error occurred");
    setLoading(false);
  }
}
```

Wait — this still has conditionals in try/catch. The fix is to move branching OUTSIDE try/catch entirely:

```tsx
async function handleTicketSignUp() {
  const { error: ticketError } = await signUp.ticket({ ticket: ticket! });
  if (ticketError) {
    onError?.(
      "Please use the email option above to complete your invitation sign-up."
    );
    setLoading(false);
    return;
  }
  if (signUp.status === "complete") {
    await signUp.finalize({
      navigate: async () => {
        window.location.href = `${consoleUrl}/account/teams/new`;
      },
    });
    return;
  }
  onError?.(
    "Please use the email option above to complete your invitation sign-up."
  );
  setLoading(false);
}

async function handleSignIn(strategy: OAuthStrategy) {
  const { error } = await signIn.sso({
    strategy,
    redirectCallbackUrl: "/sign-in/sso-callback",
    redirectUrl: `${consoleUrl}/account/teams/new`,
  });
  if (error) {
    const errCode = error.code;
    if (errCode === "sign_up_restricted_waitlist") {
      onError?.(
        "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
        true
      );
    } else {
      toast.error(
        error.longMessage ?? error.message ?? "Authentication failed"
      );
    }
    setLoading(false);
  }
}

async function handleSignUp(strategy: OAuthStrategy) {
  const { error } = await signUp.sso({
    strategy,
    redirectCallbackUrl: "/sign-up/sso-callback",
    redirectUrl: `${consoleUrl}/account/teams/new`,
  });
  if (error) {
    const errCode = error.code;
    if (errCode === "sign_up_restricted_waitlist") {
      onError?.(
        "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
        true
      );
    } else {
      toast.error(
        error.longMessage ?? error.message ?? "Authentication failed"
      );
    }
    setLoading(false);
  }
}

async function handleOAuth(strategy: OAuthStrategy) {
  setLoading(true);

  // Determine handler BEFORE entering try/catch
  const handler =
    mode === "sign-up" && ticket
      ? () => handleTicketSignUp()
      : mode === "sign-in"
        ? () => handleSignIn(strategy)
        : () => handleSignUp(strategy);

  try {
    await handler();
  } catch {
    toast.error("An unexpected error occurred");
    setLoading(false);
  }
}
```

The try block now only contains `await handler()` — zero conditionals, zero optional chaining, zero logical expressions.

---

### 2. Remove useState from prop — `company-size-island.tsx`

**File**: `apps/auth/src/app/(app)/(early-access)/_components/company-size-island.tsx`
**Problem**: `useState(defaultValue)` initializes state from a prop.
**Fix**: Eliminate state entirely. Use uncontrolled `Select` with `defaultValue` + ref to imperatively update the hidden input.

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useRef } from "react";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" },
];

interface CompanySizeIslandProps {
  defaultValue: string;
  error?: string | null;
}

export function CompanySizeIsland({
  defaultValue,
  error,
}: CompanySizeIslandProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label
        className="font-medium text-muted-foreground text-xs"
        htmlFor="companySize"
      >
        Company size
      </label>
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        id="companySize"
        name="companySize"
        type="hidden"
      />
      <Select
        defaultValue={defaultValue}
        onValueChange={(v) => {
          if (inputRef.current) inputRef.current.value = v;
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select company size" />
        </SelectTrigger>
        <SelectContent>
          {COMPANY_SIZES.map((size) => (
            <SelectItem key={size.value} value={size.value}>
              {size.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
```

No `useState` at all — warning eliminated.

---

### 3. Ref-based initialization — `sources-island.tsx`

**File**: `apps/auth/src/app/(app)/(early-access)/_components/sources-island.tsx`
**Problem**: `useState<string[]>(defaultSources)` initializes from a prop.
**Fix**: Initialize state with empty array, use ref gate to set from prop on first render (setState-during-render pattern, supported by React 18+).

Change lines 43-44 from:
```tsx
const [selected, setSelected] = useState<string[]>(defaultSources);
const [open, setOpen] = useState(false);
```

To:
```tsx
const [selected, setSelected] = useState<string[]>([]);
const [open, setOpen] = useState(false);
const initialized = useRef(false);

if (!initialized.current) {
  initialized.current = true;
  if (defaultSources.length > 0) {
    setSelected(defaultSources);
  }
}
```

Also add `useRef` to the imports:
```tsx
import { useRef, useState } from "react";
```

The hidden input value is still derived from `selected` state — form submission behavior unchanged.

---

### 4. Replace `<a>` with `next/link` — `session-activator.tsx`

**File**: `apps/auth/src/app/(app)/(auth)/_components/session-activator.tsx`
**Problem**: Line 42 uses `<a href="/sign-in">` for an internal route.
**Fix**: Import `Link` from `next/link` and replace the `<a>` tag.

Change:
```tsx
import * as React from "react";
```
To:
```tsx
import Link from "next/link";
import * as React from "react";
```

Change line 42:
```tsx
<a className="text-muted-foreground text-sm underline" href="/sign-in">
  Back to Sign In
</a>
```
To:
```tsx
<Link className="text-muted-foreground text-sm underline" href="/sign-in">
  Back to Sign In
</Link>
```

---

### Success Criteria

#### Automated Verification:
- [x] React Doctor score is 100/100: `cd apps/auth && npx -y react-doctor@latest . --verbose --diff`
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [ ] OAuth sign-in with GitHub still works
- [ ] OAuth sign-up with invitation ticket still works
- [ ] Early access form: company size selection persists on submit
- [ ] Early access form: source multi-select works (add/remove badges)
- [ ] Session activator error state "Back to Sign In" link navigates correctly

## References

- React Doctor: https://www.react.doctor
- React Compiler try/catch limitation: compiler TODO for value blocks in try/catch
- React setState-during-render pattern: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
