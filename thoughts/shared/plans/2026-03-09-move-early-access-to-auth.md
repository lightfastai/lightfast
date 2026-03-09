# Move Early Access from www to auth — Implementation Plan

## Overview

Move the early-access waitlist feature from `apps/www` to `apps/auth`, consolidating auth-adjacent logic (Clerk waitlist API, form submission with Arcjet protection) into the auth app. This removes heavy server-side dependencies (`@vendor/upstash`, `react-hook-form`, `react-confetti`, `@hookform/resolvers`) from the marketing site and places the feature alongside the sign-in/sign-up flows where it logically belongs.

## Current State Analysis

**Source files in `apps/www`:**
- `src/app/(app)/early-access/page.tsx` — page with metadata + searchParams
- `src/app/(app)/early-access/opengraph-image.tsx` — OG image generation (will be dropped)
- `src/components/early-access-form.tsx` — client component (react-hook-form + confetti)
- `src/components/early-access-actions.ts` — server action (Arcjet + Redis + Clerk API)
- `src/components/early-access-form.schema.ts` — zod validation schema
- `src/components/confetti-wrapper.tsx` — success confetti animation
- `src/lib/clerk-error-handler.ts` — Clerk API error handling utility

**Dependencies used exclusively by early-access in www:**
- `@hookform/resolvers` — form validation
- `react-hook-form` — form state management
- `react-confetti` — success animation
- `@vendor/upstash` — Redis duplicate checking (runtime import only in early-access-actions.ts)

**Dependencies shared with other www features (stay in www):**
- `@vendor/security` — also used in `middleware.ts` for CSP + security middleware
- `@sentry/nextjs` — used throughout
- `@repo/ui` — used throughout
- `lucide-react` — used throughout

### Key Discoveries:
- `clerk-error-handler.ts` is only imported by `early-access-actions.ts` — can move entirely
- `confetti-wrapper.tsx` is only imported by `early-access-form.tsx` — can move entirely
- `@vendor/upstash` runtime usage is only in `early-access-actions.ts:14`, but env extends it in `env.ts:9`
- `CLERK_SECRET_KEY` in www `env.ts:36` is only used by `early-access-actions.ts:206`
- `apps/auth` already has `@vendor/clerk` (which provides `CLERK_SECRET_KEY` via `clerkEnvBase`)
- `apps/auth` already has `@vendor/security` at `workspace:^` — needs matching env extension
- `apps/auth` uses colocated `_components/`, `_actions/`, `_lib/` pattern in `(auth)` route group
- 10+ links to `/early-access` across www components (navbar, footer, CTAs) — these stay as cross-app links
- OG image dropped — avoids adding `@repo/og`, og-fonts utility, and font files to auth

## Desired End State

- `apps/auth/src/app/(app)/(early-access)/` contains the page, components, actions, and schema
- `apps/auth/package.json` includes `@hookform/resolvers`, `react-hook-form`, `react-confetti`, `@vendor/upstash`
- `apps/auth/src/env.ts` extends `securityEnv` and `upstashEnv`
- `microfrontends.json` routes `/early-access` to `lightfast-auth`
- `apps/www` no longer contains any early-access files
- `apps/www/package.json` no longer has `@hookform/resolvers`, `react-hook-form`, `react-confetti`
- `apps/www/src/env.ts` no longer extends `upstashEnv` or declares `CLERK_SECRET_KEY`
- All existing `/early-access` links across the codebase continue to work

### Verification:
- `pnpm build:auth` succeeds
- `pnpm build:www` succeeds
- `pnpm typecheck` passes
- `pnpm check` passes
- `/early-access` renders correctly in browser via auth app
- Form submission works end-to-end

## What We're NOT Doing

- NOT moving the OG image (`opengraph-image.tsx`) — dropped for simplicity
- NOT changing any `/early-access` links in www components — they work as cross-app links via microfrontends
- NOT modifying `@vendor/security` or `@vendor/upstash` packages themselves
- NOT removing `@vendor/security` from www (still used in middleware.ts)
- NOT removing `@vendor/email` or `@vendor/inngest` from www (used by other features)

## Implementation Approach

Colocate all early-access files inside the auth route group `(early-access)` following the existing `(auth)` pattern with `_components/`, `_actions/`, and `_lib/` directories. Update microfrontends routing so `/early-access` is served by the auth app instead of www.

---

## Phase 1: Add Dependencies to auth

### Overview
Add the required npm packages and environment variable configuration to `apps/auth`.

### Changes Required:

#### 1. Update `apps/auth/package.json`
**File**: `apps/auth/package.json`
**Changes**: Add 4 production dependencies

```jsonc
// Add to "dependencies":
"@hookform/resolvers": "catalog:",
"@vendor/upstash": "workspace:*",
"react-confetti": "^6.4.0",
"react-hook-form": "catalog:",
```

#### 2. Update `apps/auth/src/env.ts`
**File**: `apps/auth/src/env.ts`
**Changes**: Extend with `securityEnv` and `upstashEnv`, add `CLERK_SECRET_KEY` for direct API calls

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { clerkEnvBase } from "@vendor/clerk/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { env as securityEnv } from "@vendor/security/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, betterstackEnv, sentryEnv, securityEnv, upstashEnv],
  // ... rest stays the same
});
```

Note: `clerkEnvBase` from `@vendor/clerk/env` already provides `CLERK_SECRET_KEY`, so no additional server var is needed in auth's env.ts.

#### 3. Install dependencies
Run `pnpm install` from the monorepo root to resolve the new deps.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm build:auth` succeeds

#### Manual Verification:
- [ ] No unexpected changes to other apps' lock entries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Move Source Files to auth

### Overview
Create the `(early-access)` route group in auth and move all source files, adapting imports.

### Changes Required:

#### 1. Create route group structure
```
apps/auth/src/app/(app)/(early-access)/
├── page.tsx
├── _actions/
│   └── early-access.ts
├── _components/
│   ├── early-access-form.tsx
│   ├── early-access-form.schema.ts
│   └── confetti-wrapper.tsx
└── _lib/
    └── clerk-error-handler.ts
```

#### 2. Move page.tsx
**File**: `apps/auth/src/app/(app)/(early-access)/page.tsx`
**Changes**: Copy from www, update import paths, remove OG-specific metadata fields

```tsx
import { Icons } from "@repo/ui/components/icons";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import { EarlyAccessForm } from "./_components/early-access-form";

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
  searchParams: Promise<{
    email?: string;
    companySize?: string;
    sources?: string;
  }>;
}) {
  const params = await searchParams;
  const initialEmail = params.email ?? "";
  const initialCompanySize = params.companySize ?? "";
  const initialSources = params.sources ? params.sources.split(",") : [];
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="w-fit rounded-sm bg-card p-3">
            <Icons.logoShort className="h-5 w-5 text-foreground" />
          </div>
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Join the Early Access waitlist
          </h1>
          <EarlyAccessForm
            initialCompanySize={initialCompanySize}
            initialEmail={initialEmail}
            initialSources={initialSources}
          />
        </div>
      </main>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </div>
  );
}
```

#### 3. Move early-access-form.tsx
**File**: `apps/auth/src/app/(app)/(early-access)/_components/early-access-form.tsx`
**Changes**: Copy from www, update relative imports to use colocated paths

```tsx
// Change these imports:
// OLD: import { ConfettiWrapper } from "./confetti-wrapper";
// OLD: import type { EarlyAccessState } from "./early-access-actions";
// OLD: import { joinEarlyAccessAction } from "./early-access-actions";
// OLD: import type { EarlyAccessFormValues } from "./early-access-form.schema";
// OLD: import { earlyAccessFormSchema } from "./early-access-form.schema";

// NEW:
import { ConfettiWrapper } from "./confetti-wrapper";
import type { EarlyAccessState } from "../_actions/early-access";
import { joinEarlyAccessAction } from "../_actions/early-access";
import type { EarlyAccessFormValues } from "./early-access-form.schema";
import { earlyAccessFormSchema } from "./early-access-form.schema";
```

Rest of the component stays identical.

#### 4. Move early-access-actions.ts → _actions/early-access.ts
**File**: `apps/auth/src/app/(app)/(early-access)/_actions/early-access.ts`
**Changes**: Copy from www, update `~/env` and `~/lib/clerk-error-handler` imports

```ts
// Change these imports:
// OLD: import { env } from "~/env";
// OLD: import { handleClerkError } from "~/lib/clerk-error-handler";

// NEW:
import { env } from "~/env";
import { handleClerkError } from "../_lib/clerk-error-handler";
```

Note: `~/env` still works because auth has its own `env.ts` — we just updated it in Phase 1 to include the required env extensions.

#### 5. Move remaining files (no import changes needed)
- `early-access-form.schema.ts` → `_components/early-access-form.schema.ts` (no changes)
- `confetti-wrapper.tsx` → `_components/confetti-wrapper.tsx` (no changes)
- `clerk-error-handler.ts` → `_lib/clerk-error-handler.ts` (no changes)

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @lightfast/auth typecheck` passes
- [ ] `pnpm build:auth` succeeds

#### Manual Verification:
- [ ] Early access page renders at `/early-access` (via auth app dev server)
- [ ] Form submission works end-to-end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Update Microfrontends Routing

### Overview
Move `/early-access` route from www to auth in the microfrontends config.

### Changes Required:

#### 1. Update microfrontends.json
**File**: `apps/console/microfrontends.json`
**Changes**: Move early-access paths from `lightfast-www` to `lightfast-auth`

Remove from `lightfast-www` routing paths:
```json
"/early-access",
"/early-access/opengraph-image-:hash",
```

Add to `lightfast-auth` routing paths:
```json
"/early-access"
```

Note: `/early-access/opengraph-image-:hash` is dropped since we're not moving the OG image.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build:auth` succeeds
- [ ] `pnpm build:www` succeeds

#### Manual Verification:
- [ ] `pnpm dev:app` — navigating to `/early-access` renders the auth app's page
- [ ] Links from www navbar/footer to `/early-access` navigate correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Clean Up apps/www

### Overview
Delete moved files and remove dependencies that are no longer used by www.

### Changes Required:

#### 1. Delete source files
Delete these files from `apps/www`:
- `src/app/(app)/early-access/page.tsx`
- `src/app/(app)/early-access/opengraph-image.tsx`
- `src/components/early-access-form.tsx`
- `src/components/early-access-actions.ts`
- `src/components/early-access-form.schema.ts`
- `src/components/confetti-wrapper.tsx`
- `src/lib/clerk-error-handler.ts`

Delete the now-empty directory:
- `src/app/(app)/early-access/`

#### 2. Remove unused dependencies from `apps/www/package.json`
**File**: `apps/www/package.json`
**Changes**: Remove 3 dependencies exclusively used by early-access

```jsonc
// Remove from "dependencies":
"@hookform/resolvers": "catalog:",
"react-confetti": "^6.4.0",
"react-hook-form": "catalog:",
```

Note: `@vendor/security` stays (used in middleware.ts). `@vendor/upstash` stays in package.json for now because its env extension is still referenced — but we clean that up next.

#### 3. Clean up `apps/www/src/env.ts`
**File**: `apps/www/src/env.ts`
**Changes**: Remove `upstashEnv` extension and `CLERK_SECRET_KEY` server var (both only used by early-access)

```ts
// Remove this import:
import { upstashEnv } from "@vendor/upstash/env";

// Remove from extends array:
upstashEnv,

// Remove from server object:
CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
```

#### 4. Remove `@vendor/upstash` from `apps/www/package.json`
**File**: `apps/www/package.json`
**Changes**: Now that env.ts no longer references upstashEnv, remove the dep

```jsonc
// Remove from "dependencies":
"@vendor/upstash": "workspace:*",
```

#### 5. Run `pnpm install` to update lockfile

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [ ] `pnpm build:www` succeeds
- [ ] `pnpm build:auth` succeeds
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

#### Manual Verification:
- [ ] www app renders correctly without early-access routes
- [ ] All navbar/footer links to `/early-access` still work (cross-app routing)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Automated Tests:
- Both `pnpm build:auth` and `pnpm build:www` succeed
- `pnpm typecheck` passes across the monorepo
- `pnpm check` (linting) passes

### Manual Testing Steps:
1. Start `pnpm dev:app` (full microfrontends stack)
2. Navigate to `lightfast.ai/early-access` — verify form renders
3. Submit the form with valid data — verify confetti + success message
4. Submit with duplicate email — verify error handling
5. Click `/early-access` link from www navbar — verify cross-app navigation works
6. Click `/early-access` link from auth error banner — verify same-app navigation works

## Performance Considerations

- www bundle size should decrease (removing react-hook-form, react-confetti, @hookform/resolvers)
- auth bundle size will increase slightly but this is acceptable since the form is auth-adjacent
- No runtime performance impact — same server action logic, same Redis + Arcjet protection

## References

- Current early-access page: `apps/www/src/app/(app)/early-access/page.tsx`
- Auth route group pattern: `apps/auth/src/app/(app)/(auth)/`
- Microfrontends config: `apps/console/microfrontends.json`
- Vendor security env: `vendor/security/env.ts`
- Vendor upstash env: `vendor/upstash/env.ts`
