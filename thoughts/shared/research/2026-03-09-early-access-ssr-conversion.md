---
date: 2026-03-09T00:00:00+11:00
researcher: claude
git_commit: 7c481b0c7b29815e6c667b3c122a94b7ed0c776e
branch: refactor/move-early-access-to-auth
repository: lightfast
topic: "Early Access SSR Conversion — removing react-hook-form in favour of server components + nuqs"
tags: [research, codebase, early-access, auth, ssr, nuqs, server-actions, react-hook-form]
status: complete
last_updated: 2026-03-09
---

# Research: Early Access SSR Conversion

**Date**: 2026-03-09
**Git Commit**: `7c481b0c7b29815e6c667b3c122a94b7ed0c776e`
**Branch**: `refactor/move-early-access-to-auth`

## Research Question

After moving early-access from `apps/www` to `apps/auth`, how much of the implementation can be converted to fully SSR without React Hook Forms? Where does nuqs fit in for error handling and state?

---

## Summary

Almost all of the early-access form logic can move server-side. The only genuine client requirement is the **sources multi-select combobox** (Popover + Command + badge removal) and a thin **SubmitButton island** for pending state. Everything else — email input, company size select, error display, success state, field pre-population, Zod validation, Sentry tracking — all live naturally on the server, matching the `(auth)` pattern exactly.

---

## Current State (post-move to auth)

### File Map
```
apps/auth/src/app/(app)/(early-access)/
├── page.tsx                              — async server component, reads searchParams manually
├── _actions/
│   └── early-access.ts                  — "use server", returns EarlyAccessState (no redirect)
├── _components/
│   ├── early-access-form.tsx            — "use client", React Hook Form, useState, useWatch, useEffect
│   ├── early-access-form.schema.ts      — zod schema (duplicated from action)
│   └── confetti-wrapper.tsx             — "use client", portal confetti
└── _lib/
    └── clerk-error-handler.ts           — pure utility, no client deps
```

### What the current form does client-side

`early-access-form.tsx` (`apps/auth/src/app/(app)/(early-access)/_components/early-access-form.tsx`):

| Hook / State | Purpose | Server-replaceable? |
|---|---|---|
| `useForm` + `zodResolver` | Form state + client validation | Yes — Zod already runs in action |
| `useState<EarlyAccessState>` | Tracks action result | Yes — URL search params |
| `useState<string>(submittedEmail)` | Preserves email for success screen | Yes — `?email=` param |
| `useState<boolean>(sourcesPopoverOpen)` | Combobox open/close | No — inherently interactive |
| `useWatch(email, companySize, sources)` | Drives button disabled state | Partially — sources still needs client |
| `useEffect` on `state.status === "error"` | Sentry client-side capture | No — Sentry already captured in action |

The server action (`_actions/early-access.ts`) already does all the real work:
- Zod validation (`earlyAccessSchema.safeParse`)
- Arcjet protection (bot, rate limit, email validation)
- Redis duplicate check
- Clerk waitlist API call
- Sentry `captureException` throughout

It currently **returns state** (`EarlyAccessState`) instead of redirecting. That's the only thing to change.

---

## Reference Pattern: `(auth)` Route Group

### How it works

**`sign-in/page.tsx`** — pure async server component:
```tsx
const { step, email, error, token, waitlist } = await loadSignInSearchParams(searchParams);
// Conditionally renders server components + client islands based on URL params
```

**`_lib/search-params.ts`** — nuqs/server typed loaders:
```ts
import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const signInSearchParams = {
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
};
export const loadSignInSearchParams = createLoader(signInSearchParams);
```

**`_actions/sign-in.ts`** — redirects instead of returning state:
```ts
export async function initiateSignIn(formData: FormData) {
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }
  redirect(`/sign-in?step=code&email=${encodeURIComponent(parsed.data.email)}`);
}
```

**`_components/email-form.tsx`** — pure server component, zero JS:
```tsx
export function EmailForm({ action }: EmailFormProps) {
  return (
    <form action={serverAction} className="space-y-4">
      <Input name="email" type="email" required />
      <Button type="submit">Continue with Email</Button>
    </form>
  );
}
```

**`_components/error-banner.tsx`** — server component, reads message prop from URL param:
```tsx
export function ErrorBanner({ message, isWaitlist, backUrl }: ErrorBannerProps) { ... }
```

Client islands are reserved for OTP input (Clerk FAPI calls) and OAuth (Clerk redirect methods) — both irreducibly interactive.

---

## SSR Conversion Analysis

### Component-by-component breakdown

| Component / Feature | Current | After SSR | Client reason if kept |
|---|---|---|---|
| Email `<input>` | Client (RHF field) | **Server** | Native `<input name="email" type="email">` |
| Company size `<Select>` | Client (RHF field) | **Server** | Native `<select name="companySize">` or thin island |
| Sources combobox | Client (RHF + useState) | **Client island** | Popover, CommandInput search, badge removal |
| Error display | Client (useState) | **Server** | URL param `?error=` read by server component |
| Field errors | Client (RHF FormMessage) | **Server** | URL params `?email_error=`, `?sources_error=` |
| Success state | Client (useState) | **Server** | URL param `?success=true` |
| Confetti | Client (portal) | **Client island** | Needs DOM |
| Submit pending indicator | Client (useState isPending) | **Client island** | `useFormStatus()` in `<SubmitButton>` |
| Zod validation | Client (zodResolver trigger) | **Server** | Action already does it |
| Sentry error capture | Client (useEffect) | **Server** | `captureException` already in action |
| Form pre-population | Client (defaultValues from props) | **Server** | Read from URL params |

### What stays client (irreducible)

1. **`SourcesIsland`** — the Popover+Command multi-select is genuinely interactive:
   - Needs `open` state for Popover
   - Needs `CommandInput` search text state
   - Needs multi-select toggle (add/remove from array)
   - Needs badge `X` removal handlers
   - Renders a hidden `<input name="sources" value={selected.join(",")} />` for form submission

2. **`SubmitButton`** — thin island using `useFormStatus()`:
   - Shows `<Loader2>` spinner while form is submitting
   - Disables during pending
   - This is genuinely tiny — just the button

3. **`ConfettiWrapper`** — unchanged, stays client (needs DOM/portal)

### What changes in the server action

`joinEarlyAccessAction` needs to change from returning `EarlyAccessState` to calling `redirect()`:

```ts
// ON VALIDATION ERROR — preserve field values + show specific errors
const params = new URLSearchParams({
  email: email || "",
  companySize: companySize || "",
  sources: sources || "",
  email_error: errors.email?.[0] ?? "",
  sources_error: errors.sources?.[0] ?? "",
});
redirect(`/early-access?${params.toString()}`);

// ON SUCCESS
redirect(`/early-access?success=true&email=${encodeURIComponent(email)}`);

// ON ERROR (rate limit, bot, etc.)
const params = new URLSearchParams({ error: "...", isRateLimit: "true" });
redirect(`/early-access?${params.toString()}`);
```

---

## Proposed Architecture

### `_lib/search-params.ts` (new file, mirrors auth pattern)

```ts
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

export const earlyAccessSearchParams = {
  email: parseAsString.withDefault(""),
  companySize: parseAsString.withDefault(""),
  sources: parseAsString.withDefault(""),   // comma-separated
  error: parseAsString,
  email_error: parseAsString,
  sources_error: parseAsString,
  success: parseAsBoolean.withDefault(false),
  isRateLimit: parseAsBoolean.withDefault(false),
};

export const loadEarlyAccessSearchParams = createLoader(earlyAccessSearchParams);
```

### `page.tsx` — server component with nuqs

```tsx
export default async function EarlyAccessPage({ searchParams }: PageProps) {
  const { email, companySize, sources, error, email_error, sources_error, success, isRateLimit }
    = await loadEarlyAccessSearchParams(searchParams);

  if (success) {
    return <SuccessState email={email} />;  // server component + ConfettiWrapper island
  }

  return (
    <div>
      {error && <ErrorBanner message={error} isRateLimit={isRateLimit} />}
      <EarlyAccessFormServer
        initialEmail={email}
        initialCompanySize={companySize}
        initialSources={sources.split(",").filter(Boolean)}
        emailError={email_error}
        sourcesError={sources_error}
      />
    </div>
  );
}
```

### `_components/early-access-form-server.tsx` — server component

```tsx
// No "use client" — pure server component
export function EarlyAccessFormServer({ initialEmail, initialCompanySize, initialSources, emailError, sourcesError }) {
  return (
    <form action={joinEarlyAccessAction} className="space-y-4">
      {/* Email */}
      <div>
        <label>Email address</label>
        <Input name="email" type="email" defaultValue={initialEmail} placeholder="name@company.com" />
        {emailError && <p className="text-destructive text-sm">{emailError}</p>}
      </div>

      {/* Company Size — native select OR thin client wrapper */}
      <div>
        <label>Company size</label>
        <select name="companySize" defaultValue={initialCompanySize}>
          {COMPANY_SIZES.map(size => <option key={size.value} value={size.value}>{size.label}</option>)}
        </select>
      </div>

      {/* Sources — client island, writes hidden input inside this form */}
      <SourcesIsland initialSources={initialSources} sourcesError={sourcesError} />

      {/* Submit — client island for useFormStatus() */}
      <SubmitButton />

      <p>By continuing...Terms...Privacy</p>
    </form>
  );
}
```

### `_components/sources-island.tsx` — minimal client island

```tsx
"use client";
// State: selected string[], popoverOpen bool
// Renders: Popover+Command combobox + badges + hidden <input name="sources" value={...} />
```

### `_components/submit-button.tsx` — minimal client island

```tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Submitting...</> : "Get Early Access"}
    </Button>
  );
}
```

---

## Dependencies Impact

### Can be removed from auth after SSR conversion
- `react-hook-form` — no longer needed
- `@hookform/resolvers` — no longer needed

### Stays
- `react-confetti` — `ConfettiWrapper` stays client
- `nuqs` — already installed (`"nuqs": "^2.8.9"` in `apps/auth/package.json`)
- `zod` — stays in server action

### New
- No new deps required. `nuqs/server` is part of the existing nuqs package.

---

## Company Size Select — Detail

The current implementation uses the shadcn `<Select>` (Radix-based) which requires client JS for the popover trigger. Two options:

**Option A — native `<select>`**: Simplest, SSR-compatible, no JS. Less polished styling.

**Option B — thin client island `<SelectIsland>`**: Client island wrapping shadcn `<Select>` that renders a hidden `<input name="companySize" value={...} />` — same pattern as SourcesIsland. Preserves design, minimal JS.

The `(auth)` pattern precedent (plain `<Input>` in server form) suggests Option A for consistency, but Option B preserves the design system better.

---

## Code References

- `apps/auth/src/app/(app)/(early-access)/page.tsx` — current page (reads searchParams manually)
- `apps/auth/src/app/(app)/(early-access)/_components/early-access-form.tsx` — client heavy form
- `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts` — server action (returns state)
- `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts` — nuqs/server pattern to replicate
- `apps/auth/src/app/(app)/(auth)/_components/email-form.tsx` — pure server form pattern
- `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts` — redirect-based action pattern
- `apps/auth/src/app/(app)/(auth)/_components/error-banner.tsx` — server error display pattern
- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx` — server page with nuqs loadSearchParams

## Historical Context

- `thoughts/shared/plans/2026-03-09-move-early-access-to-auth.md` — original migration plan. Phase 2 desired end state included `@hookform/resolvers` and `react-hook-form` in auth — this research supersedes that assumption, showing they can be eliminated entirely.
- The migration plan noted the `(auth)` colocated pattern (`_components/`, `_actions/`, `_lib/`) as the target structure — confirmed as the right model for SSR conversion too.

## Open Questions

1. **Company size select UX**: Native `<select>` vs thin client island — design system preference?
2. **Submit button disabled state**: With SSR form, the button can't disable based on "all fields filled" without JS. Is that acceptable, or should a thin client island watch field values? The `(auth)` pattern accepts this (no client-side disabled logic on `EmailForm`).
3. **Confetti trigger**: Currently triggered by `state.status === "success"`. In SSR version, triggered by `?success=true` on page load — `ConfettiWrapper` would need to auto-fire on mount. This is already how it works (it fires on render), so no change needed.
