# Early Access SSR Conversion Implementation Plan

## Overview

Convert the early-access waitlist form from a client-heavy React Hook Form implementation to SSR using redirect-based server actions + nuqs URL state, matching the `(auth)` route group pattern. This eliminates `react-hook-form` and `@hookform/resolvers` from the auth app while reducing client-side JavaScript to three small islands (SourcesIsland, CompanySizeIsland, SubmitButton).

## Current State Analysis

The early-access form lives at `apps/auth/src/app/(app)/(early-access)/` (moved from `apps/www` in commit `7c481b0c7` on `refactor/move-early-access-to-auth`). The form component (`_components/early-access-form.tsx`) is a monolithic `"use client"` component using:

- `react-hook-form` (`useForm`, `useWatch`, `zodResolver`) for state management and validation
- `useState` for action state, submitted email, and popover open state
- `useEffect` for Sentry error tracking on state changes
- Shadcn `Form`/`FormField`/`FormMessage` wrappers (require react-hook-form)
- Shadcn `Select`, `Popover`+`Command` (multi-select combobox), `Badge`

The server action (`_actions/early-access.ts`) already does all the real work (Zod validation, Arcjet, Redis, Clerk API, Sentry) but **returns `EarlyAccessState`** instead of redirecting. Both `react-hook-form` and `@hookform/resolvers` are used **only** in this one file — safe to remove after conversion.

### Key Discoveries:
- The `(auth)` route group pattern (`_lib/search-params.ts`, `_actions/sign-in.ts`, `_components/email-form.tsx`) is the proven SSR model: nuqs `createLoader` + redirect-based actions + server form components
- `useFormStatus` is not used anywhere in auth — SubmitButton will be the first usage
- Zod schema is duplicated: `_components/early-access-form.schema.ts` (client) and inline in `_actions/early-access.ts:35-44` (server) — identical fields
- `ConfettiWrapper` already auto-fires on render (no event trigger needed) — works perfectly with `?success=true` URL param

## Desired End State

After completion:
- `page.tsx` is a pure async server component that reads URL params via nuqs `createLoader`
- Server action calls `redirect()` on every code path (success, error, validation error)
- Form is a server component with three thin client islands: SourcesIsland, CompanySizeIsland, SubmitButton
- `react-hook-form` and `@hookform/resolvers` removed from `apps/auth/package.json`
- `early-access-form.schema.ts` deleted (single schema lives in the action)
- Error/success states flow through URL search params, not React state

### Verification:
- `pnpm --filter @lightfast/auth typecheck` passes
- `pnpm --filter @lightfast/auth lint` passes
- `pnpm build:auth` succeeds
- Manual test: full early-access flow works (submit, validation errors, success + confetti, rate limit errors, duplicate email detection)

## What We're NOT Doing

- Not changing the Arcjet, Redis, or Clerk API logic in the server action — only the return/redirect mechanism
- Not touching `ConfettiWrapper` — it stays as-is (already works on render)
- Not touching `_lib/clerk-error-handler.ts` — pure utility, no client deps
- Not changing the page layout/styling (header, logo, container) — only the form internals
- Not adding client-side field validation gating (server validates, matching auth pattern)
- Not converting to `useActionState`/`useFormState` — using direct `<form action={serverAction}>` + redirect pattern

## Implementation Approach

Follow the `(auth)` route group pattern exactly:
1. Server action redirects instead of returning state
2. URL params encode all state (errors, field values, success)
3. Page reads params via nuqs `createLoader`, renders server components conditionally
4. Client islands are minimal — only for irreducibly interactive UI (combobox, select popover, submit pending)

---

## Phase 1: Add nuqs Search Params + Convert Server Action to Redirects

### Overview
Create the URL state schema with nuqs and convert the server action from returning `EarlyAccessState` to calling `redirect()` on every code path. This phase doesn't break the UI yet — the existing client form still works because it calls the action directly (not via `<form action>`), but the action's return type changes.

### Changes Required:

#### 1. Create `_lib/search-params.ts`
**File**: `apps/auth/src/app/(app)/(early-access)/_lib/search-params.ts` (new file)
**Changes**: New nuqs search params schema mirroring the `(auth)` pattern at `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:1-24`

```ts
import {
  createLoader,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

export const earlyAccessSearchParams = {
  // Form field values (preserved across validation errors)
  email: parseAsString.withDefault(""),
  companySize: parseAsString.withDefault(""),
  sources: parseAsString.withDefault(""), // comma-separated

  // Error states
  error: parseAsString,           // general error message
  emailError: parseAsString,      // email field validation error
  sourcesError: parseAsString,    // sources field validation error
  companySizeError: parseAsString, // company size field validation error
  isRateLimit: parseAsBoolean.withDefault(false),

  // Success state
  success: parseAsBoolean.withDefault(false),
};

export const loadEarlyAccessSearchParams = createLoader(earlyAccessSearchParams);
```

#### 2. Convert server action to redirect-based
**File**: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts`
**Changes**:
- Remove `EarlyAccessState` type export
- Change action signature to accept `FormData` only (no `_prevState`)
- Replace all `return { status: ... }` with `redirect()` calls
- Add `import { redirect } from "next/navigation"`
- Keep all Arcjet, Redis, Clerk API logic untouched

The action transforms from:
```ts
// BEFORE: returns state
export async function joinEarlyAccessAction(
  _prevState: EarlyAccessState | null,
  formData: FormData
): Promise<EarlyAccessState> {
  // ...
  return { status: "validation_error", fieldErrors, error: "..." };
  // ...
  return { status: "error", error: "...", isRateLimit: true };
  // ...
  return { status: "success", message: "..." };
}
```

To:
```ts
// AFTER: redirects on every path
export async function joinEarlyAccessAction(formData: FormData): Promise<never> {
  try {
    // Parse and validate
    const rawEmail = formData.get("email") as string | null ?? "";
    const rawCompanySize = formData.get("companySize") as string | null ?? "";
    const rawSources = formData.get("sources") as string | null ?? "";

    const validatedFields = earlyAccessSchema.safeParse({
      email: rawEmail,
      companySize: rawCompanySize,
      sources: rawSources.split(",").filter(Boolean),
    });

    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      const params = new URLSearchParams();
      // Preserve field values
      params.set("email", rawEmail);
      params.set("companySize", rawCompanySize);
      params.set("sources", rawSources);
      // Set field-specific errors
      if (fieldErrors.email?.[0]) params.set("emailError", fieldErrors.email[0]);
      if (fieldErrors.companySize?.[0]) params.set("companySizeError", fieldErrors.companySize[0]);
      if (fieldErrors.sources?.[0]) params.set("sourcesError", fieldErrors.sources[0]);
      redirect(`/early-access?${params.toString()}`);
    }

    const { email, companySize, sources } = validatedFields.data;

    // ... Arcjet protection (unchanged) ...

    if (decision.isDenied()) {
      // Rate limit
      if (reason.isRateLimit()) {
        redirect(`/early-access?error=${encodeURIComponent("Too many signup attempts. Please try again later.")}&isRateLimit=true&email=${encodeURIComponent(email)}&companySize=${encodeURIComponent(companySize)}&sources=${encodeURIComponent(sources.join(","))}`);
      }
      // Bot, shield, email validation — same pattern, different messages
      redirect(`/early-access?error=${encodeURIComponent(errorMessage)}&email=${encodeURIComponent(email)}&companySize=${encodeURIComponent(companySize)}&sources=${encodeURIComponent(sources.join(","))}`);
    }

    // ... Redis check (unchanged logic, but redirect instead of return) ...
    if (emailExists) {
      redirect(`/early-access?error=${encodeURIComponent("This email is already registered for early access!")}`);
    }

    // ... Clerk API call (unchanged logic) ...

    // On Clerk error:
    redirect(`/early-access?error=${encodeURIComponent(errorResult.userMessage)}&isRateLimit=${errorResult.isRateLimit}&email=${encodeURIComponent(email)}&companySize=${encodeURIComponent(companySize)}&sources=${encodeURIComponent(sources.join(","))}`);

    // On success:
    after(async () => { /* redis.sadd — unchanged */ });
    redirect(`/early-access?success=true&email=${encodeURIComponent(email)}`);
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — must re-throw it
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    // Actual errors
    captureException(error, { tags: { action: "joinEarlyAccess:outer" } });
    redirect(`/early-access?error=${encodeURIComponent("An error occurred. Please try again.")}`);
  }
}
```

**Important**: `redirect()` throws a special `NEXT_REDIRECT` error internally. The outer `catch` block must re-throw it. Use the standard Next.js pattern:
```ts
import { isRedirectError } from "next/dist/client/components/redirect-error";

catch (error) {
  if (isRedirectError(error)) throw error;
  // ... handle real errors
}
```

#### 3. Helper function for building redirect URLs
To keep the action DRY, add a helper at the top of the action file:

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
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`

#### Manual Verification:
- [x] N/A — Phase 1 changes the action interface but the old client form won't work with it yet. Proceed directly to Phase 2.

**Implementation Note**: Phase 1 and Phase 2 must be implemented together before testing. The action's redirect-based interface is consumed by the new server form in Phase 2.

---

## Phase 2: Replace Client Form with Server Component + Client Islands

### Overview
Replace the monolithic `"use client"` `EarlyAccessForm` with a server form component and three minimal client islands. Update `page.tsx` to use nuqs `loadEarlyAccessSearchParams` and conditionally render success/error/form states.

### Changes Required:

#### 1. Create `_components/submit-button.tsx` (client island)
**File**: `apps/auth/src/app/(app)/(early-access)/_components/submit-button.tsx` (new file)

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Submitting...
        </>
      ) : (
        "Get Early Access"
      )}
    </Button>
  );
}
```

#### 2. Create `_components/company-size-island.tsx` (client island)
**File**: `apps/auth/src/app/(app)/(early-access)/_components/company-size-island.tsx` (new file)

Thin client wrapper around shadcn `Select` that writes a hidden `<input name="companySize">` for form submission:

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useState } from "react";

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

export function CompanySizeIsland({ defaultValue, error }: CompanySizeIslandProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <label className="font-medium text-muted-foreground text-xs">
        Company size
      </label>
      <input name="companySize" type="hidden" value={value} />
      <Select onValueChange={setValue} value={value}>
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

#### 3. Create `_components/sources-island.tsx` (client island)
**File**: `apps/auth/src/app/(app)/(early-access)/_components/sources-island.tsx` (new file)

Multi-select combobox with badges. Renders a hidden `<input name="sources">` with comma-separated values:

```tsx
"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

const DATA_SOURCES = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "slack", label: "Slack" },
  { value: "notion", label: "Notion" },
  { value: "linear", label: "Linear" },
  { value: "jira", label: "Jira" },
  { value: "confluence", label: "Confluence" },
  { value: "google-drive", label: "Google Drive" },
  { value: "microsoft-teams", label: "Microsoft Teams" },
  { value: "discord", label: "Discord" },
];

const DATA_SOURCES_MAP = new Map(DATA_SOURCES.map((s) => [s.value, s]));

interface SourcesIslandProps {
  defaultSources: string[];
  error?: string | null;
}

export function SourcesIsland({ defaultSources, error }: SourcesIslandProps) {
  const [selected, setSelected] = useState<string[]>(defaultSources);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label className="font-medium text-muted-foreground text-xs">
        Tools your team uses
      </label>
      <input name="sources" type="hidden" value={selected.join(",")} />
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-controls="sources-listbox"
            aria-expanded={open}
            className={cn(
              "h-auto min-h-8 w-full justify-start px-2 py-1 font-normal",
              !selected.length && "text-muted-foreground"
            )}
            role="combobox"
            variant="outline"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selected.length > 0 ? (
                  selected.map((value) => {
                    const source = DATA_SOURCES_MAP.get(value);
                    return (
                      <Badge
                        className="gap-1 pr-1"
                        key={value}
                        variant="secondary"
                      >
                        {source?.label}
                        <span
                          className="ml-1 cursor-pointer rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(selected.filter((s) => s !== value));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelected(selected.filter((s) => s !== value));
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    );
                  })
                ) : (
                  <span>Select tools</span>
                )}
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-full p-0">
          <Command id="sources-listbox">
            <CommandInput placeholder="Search tools..." />
            <CommandList>
              <CommandEmpty>No tools found.</CommandEmpty>
              <CommandGroup>
                {DATA_SOURCES.map((source) => {
                  const isSelected = selected.includes(source.value);
                  return (
                    <CommandItem
                      key={source.value}
                      onSelect={() => {
                        setSelected(
                          isSelected
                            ? selected.filter((s) => s !== source.value)
                            : [...selected, source.value]
                        );
                      }}
                      value={source.value}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {source.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
```

#### 4. Create `_components/early-access-form-server.tsx` (server component)
**File**: `apps/auth/src/app/(app)/(early-access)/_components/early-access-form-server.tsx` (new file)

Pure server component — no `"use client"` directive. Renders the `<form action={joinEarlyAccessAction}>` with server-rendered fields and client islands:

```tsx
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { joinEarlyAccessAction } from "../_actions/early-access";
import { CompanySizeIsland } from "./company-size-island";
import { SourcesIsland } from "./sources-island";
import { SubmitButton } from "./submit-button";

interface EarlyAccessFormServerProps {
  initialEmail: string;
  initialCompanySize: string;
  initialSources: string[];
  emailError?: string | null;
  companySizeError?: string | null;
  sourcesError?: string | null;
}

export function EarlyAccessFormServer({
  initialEmail,
  initialCompanySize,
  initialSources,
  emailError,
  companySizeError,
  sourcesError,
}: EarlyAccessFormServerProps) {
  return (
    <div className="w-full">
      <form action={joinEarlyAccessAction} className="space-y-4">
        {/* Email — pure server-rendered input */}
        <div className="space-y-2">
          <label className="font-medium text-muted-foreground text-xs" htmlFor="email">
            Email address
          </label>
          <Input
            defaultValue={initialEmail}
            id="email"
            name="email"
            placeholder="name@company.com"
            type="email"
          />
          {emailError && <p className="text-destructive text-sm">{emailError}</p>}
        </div>

        {/* Company Size — client island (shadcn Select needs JS) */}
        <CompanySizeIsland defaultValue={initialCompanySize} error={companySizeError} />

        {/* Sources — client island (Popover+Command combobox) */}
        <SourcesIsland defaultSources={initialSources} error={sourcesError} />

        {/* Submit + Terms */}
        <div className="space-y-3">
          <SubmitButton />
        </div>

        <p className="text-muted-foreground text-xs">
          By continuing you acknowledge that you understand and agree to our{" "}
          <Link
            className="underline transition-colors hover:text-foreground"
            href="/legal/terms"
          >
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link
            className="underline transition-colors hover:text-foreground"
            href="/legal/privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
```

#### 5. Update `page.tsx` to use nuqs and conditional rendering
**File**: `apps/auth/src/app/(app)/(early-access)/page.tsx`
**Changes**: Replace manual `searchParams` parsing with nuqs `loadEarlyAccessSearchParams`. Conditionally render success state vs error banner vs form, matching the `sign-in/page.tsx` pattern.

```tsx
import { Icons } from "@repo/ui/components/icons";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import { ConfettiWrapper } from "./_components/confetti-wrapper";
import { EarlyAccessFormServer } from "./_components/early-access-form-server";
import { loadEarlyAccessSearchParams } from "./_lib/search-params";

export const metadata: Metadata = createMetadata({
  /* ... unchanged ... */
});

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">
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
                      <span className="font-medium text-foreground">{email}</span>
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

              {/* General error banner */}
              {error && (
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
                      {error}
                    </p>
                  </div>
                  {isRateLimit && (
                    <p className="text-muted-foreground text-sm">
                      Please wait a moment before trying again.
                    </p>
                  )}
                </div>
              )}

              <EarlyAccessFormServer
                initialEmail={email}
                initialCompanySize={companySize}
                initialSources={sources ? sources.split(",").filter(Boolean) : []}
                emailError={emailError}
                companySizeError={companySizeError}
                sourcesError={sourcesError}
              />
            </>
          )}
        </div>
      </main>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds successfully: `pnpm build:auth` (pre-existing failure: missing ARCJET_KEY env var from move-early-access-to-auth migration)

#### Manual Verification:
- [ ] Navigate to `/early-access` — form renders with all three fields
- [ ] Submit with empty fields — redirects back with validation errors displayed per-field
- [ ] Submit with valid data — redirects to `?success=true` with confetti + success message
- [ ] Submit with an already-registered email — shows "already registered" error banner
- [ ] Submit rapidly — rate limit error banner appears with yellow styling
- [ ] Refresh the success page — success state persists (URL-driven)
- [ ] Use browser back after success — returns to form (not broken state)
- [ ] Company size select renders and works (shadcn popover)
- [ ] Sources multi-select: add/remove badges, search, hidden input value correct
- [ ] Submit button shows spinner during submission
- [ ] Terms/Privacy links work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3.

---

## Phase 3: Clean Up

### Overview
Delete the old client form component and schema, remove `react-hook-form` and `@hookform/resolvers` from auth's dependencies.

### Changes Required:

#### 1. Delete old client form
**File**: `apps/auth/src/app/(app)/(early-access)/_components/early-access-form.tsx`
**Action**: Delete entirely

#### 2. Delete client schema
**File**: `apps/auth/src/app/(app)/(early-access)/_components/early-access-form.schema.ts`
**Action**: Delete entirely

#### 3. Remove dependencies from `apps/auth/package.json`
**File**: `apps/auth/package.json`
**Changes**: Remove these two lines:
```diff
-    "@hookform/resolvers": "catalog:",
-    "react-hook-form": "catalog:",
```

#### 4. Run pnpm install to update lockfile
```bash
pnpm install
```

#### 5. Verify no remaining imports
Search for any remaining imports of the deleted files or packages:
- `react-hook-form` in `apps/auth/src/`
- `@hookform/resolvers` in `apps/auth/src/`
- `early-access-form.schema` in `apps/auth/src/`
- `EarlyAccessForm` (the old component name) in `apps/auth/src/`

### Success Criteria:

#### Automated Verification:
- [ ] No remaining `react-hook-form` imports: `grep -r "react-hook-form" apps/auth/src/` returns empty
- [ ] No remaining `@hookform/resolvers` imports: `grep -r "@hookform/resolvers" apps/auth/src/` returns empty
- [ ] `pnpm install` succeeds (lockfile updates cleanly)
- [ ] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [ ] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds successfully: `pnpm build:auth`

#### Manual Verification:
- [ ] Full early-access flow still works end-to-end after cleanup
- [ ] No console errors in browser DevTools

---

## Testing Strategy

### Unit Tests:
- No unit tests needed — the server action's business logic (Arcjet, Redis, Clerk) is unchanged
- The only change is redirect vs return, which is covered by integration/E2E testing

### Integration Tests:
- Consider adding a test that verifies the action calls `redirect()` with correct params on validation error
- Consider adding a test that verifies `loadEarlyAccessSearchParams` correctly parses all param combinations

### Manual Testing Steps:
1. Fresh load of `/early-access` — blank form, no errors
2. Submit empty form — all three field errors appear
3. Submit with only email — company size and sources errors appear, email preserved
4. Submit with valid data — success screen with confetti, email displayed
5. Submit with `some-email+clerk_test@lightfast.ai` — tests Clerk integration
6. Refresh success page — success state persists
7. Navigate away and back — form resets (clean URL)
8. Submit same email twice — "already registered" error
9. Rapid submissions — rate limit error with yellow styling

## Performance Considerations

- **Reduced JS bundle**: Removing `react-hook-form` (~45KB minified) and `@hookform/resolvers` (~8KB minified) from the client bundle
- **Server-rendered form**: Email input and labels render without JS, improving FCP
- **Three small islands**: SubmitButton (~1KB), CompanySizeIsland (~3KB for shadcn Select), SourcesIsland (~5KB for Popover+Command) — all load independently
- **URL state**: No client-side state management overhead; page re-renders are full server renders via redirect

## Migration Notes

- This plan targets the `refactor/move-early-access-to-auth` branch
- Phase 1 and Phase 2 should be implemented together in a single commit since the action interface change breaks the old form
- Phase 3 (cleanup) can be a separate commit after manual verification

## References

- Research: `thoughts/shared/research/2026-03-09-early-access-ssr-conversion.md`
- Migration plan (Phases 1-2 complete): `thoughts/shared/plans/2026-03-09-move-early-access-to-auth.md`
- Auth nuqs pattern: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts:1-24`
- Auth redirect action: `apps/auth/src/app/(app)/(auth)/_actions/sign-in.ts:1-22`
- Auth server form: `apps/auth/src/app/(app)/(auth)/_components/email-form.tsx`
- Auth error banner: `apps/auth/src/app/(app)/(auth)/_components/error-banner.tsx`
- Current client form: `apps/auth/src/app/(app)/(early-access)/_components/early-access-form.tsx` (on `refactor/move-early-access-to-auth`)
- Current server action: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts` (on `refactor/move-early-access-to-auth`)
