# Fix Build: CLI Auth Page Prerender Error

## Overview

The `pnpm build:console` build fails because Next.js attempts to statically prerender the `/cli/auth` page, which triggers the `(app)/layout.tsx` tRPC prefetch (`organization.listUserOrganizations`) during build time. Since there's no tRPC server running during build, the fetch fails with `ECONNREFUSED`.

## Current State Analysis

- `apps/console/src/app/(app)/layout.tsx:17` — calls `prefetch(userTrpc.organization.listUserOrganizations.queryOptions())` for all pages under `(app)/`
- `apps/console/src/app/(app)/(user)/cli/auth/page.tsx` — pure `"use client"` component with no server-side dynamic APIs
- Other `(app)/` pages are inherently dynamic due to `searchParams` usage or direct `prefetch()` calls, so they skip static generation
- `/cli/auth` is the ONLY `(app)/` page that Next.js considers a candidate for static prerendering

### Key Discoveries:
- Build error: `Error occurred prerendering page "/cli/auth"` → `TRPCClientError: fetch failed` → `ECONNREFUSED`
- The page requires Clerk `useAuth()` at runtime — static prerendering is meaningless for this page
- The page redirects to `localhost:{port}/callback` — entirely runtime-dependent

## Desired End State

`pnpm build:console` completes successfully with no prerendering errors.

## What We're NOT Doing

- Not modifying the layout's `prefetch()` call (it works correctly at runtime)
- Not changing the tRPC server/client architecture
- Not adding error handling to `prefetchQuery` (TanStack Query's `prefetchQuery` already catches errors; the issue is specific to static generation context)

## Implementation Approach

Add `export const dynamic = 'force-dynamic'` to the `/cli/auth` page to opt it out of static generation. This is the correct semantic: the page requires authentication and runtime redirect — it cannot be meaningfully prerendered.

## Phase 1: Fix CLI Auth Page Prerendering

### Overview
Prevent `/cli/auth` from being statically prerendered.

### Changes Required:

#### 1. CLI Auth Page
**File**: `apps/console/src/app/(app)/(user)/cli/auth/page.tsx`
**Changes**: Add `force-dynamic` export to opt out of static generation

```tsx
// Add before the component:
export const dynamic = "force-dynamic";
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] CLI auth flow still works at runtime (requires running dev server + CLI)
