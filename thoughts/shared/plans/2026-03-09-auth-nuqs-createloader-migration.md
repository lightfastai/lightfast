# Auth: Migrate nuqs to createLoader Pattern

## Overview

Replace `createSearchParamsCache` with `createLoader` in the auth app's sign-in and sign-up pages. Use the `SearchParams` type from `nuqs/server` for strict type correctness on page props. Export both raw parser objects and loader functions for reusability.

## Current State Analysis

- `_lib/search-params.ts` uses `createSearchParamsCache` (older API) with `.parse()` method
- Both pages manually type `searchParams` as `Promise<Record<string, string | string[] | undefined>>` instead of the canonical `SearchParams` type
- Only 2 consumers: `sign-in/page.tsx` and `sign-up/page.tsx`
- nuqs 2.8.9 is installed, which exports `createLoader` and `SearchParams`

### Key Discoveries:
- `createLoader` is available in nuqs 2.8.9: `node_modules/.pnpm/nuqs@2.8.9.../dist/server.d.ts:59`
- `SearchParams` type is exported from `nuqs/server`: `server.d.ts:158`
- No other files import `signInSearchParams` or `signUpSearchParams`

## Desired End State

- `search-params.ts` exports raw parser objects (`signInSearchParams`, `signUpSearchParams`) AND loader functions (`loadSignInSearchParams`, `loadSignUpSearchParams`)
- Both pages use `SearchParams` from `nuqs/server` for the page prop type
- Both pages call loader functions directly instead of `.parse()`
- All types are strict and inferred from the parser definitions

## What We're NOT Doing

- Not changing any parser definitions (steps, params stay the same)
- Not adding `strict` mode (can be added later per-page)
- Not migrating client components to `useQueryStates` with shared parsers (separate task)
- Not upgrading nuqs version

## Implementation Approach

Single phase — 3 files, minimal diff. Swap the API surface, fix the types.

## Phase 1: Migrate to createLoader

### Changes Required:

#### 1. Search Params Module
**File**: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts`
**Changes**: Replace `createSearchParamsCache` with plain parser objects + `createLoader`

```ts
import {
  createLoader,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

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
  __clerk_ticket: parseAsString,
  waitlist: parseAsString,
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
export const loadSignUpSearchParams = createLoader(signUpSearchParams);
```

#### 2. Sign-In Page
**File**: `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx`
**Changes**: Use `SearchParams` type, call `loadSignInSearchParams` directly

```diff
-import { signInSearchParams } from "../_lib/search-params";
+import type { SearchParams } from "nuqs/server";
+import { loadSignInSearchParams } from "../_lib/search-params";

-export default async function SignInPage({
-  searchParams,
-}: {
-  searchParams: Promise<Record<string, string | string[] | undefined>>;
-}) {
-  const { step, email, error, token, waitlist } =
-    await signInSearchParams.parse(searchParams);
+type PageProps = {
+  searchParams: Promise<SearchParams>;
+};
+
+export default async function SignInPage({ searchParams }: PageProps) {
+  const { step, email, error, token, waitlist } =
+    await loadSignInSearchParams(searchParams);
```

#### 3. Sign-Up Page
**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`
**Changes**: Same pattern — `SearchParams` type, call `loadSignUpSearchParams` directly

```diff
-import { signUpSearchParams } from "../_lib/search-params";
+import type { SearchParams } from "nuqs/server";
+import { loadSignUpSearchParams } from "../_lib/search-params";

-export default async function SignUpPage({
-  searchParams,
-}: {
-  searchParams: Promise<Record<string, string | string[] | undefined>>;
-}) {
-  const { step, email, error, ticket, __clerk_ticket, waitlist } =
-    await signUpSearchParams.parse(searchParams);
+type PageProps = {
+  searchParams: Promise<SearchParams>;
+};
+
+export default async function SignUpPage({ searchParams }: PageProps) {
+  const { step, email, error, ticket, __clerk_ticket, waitlist } =
+    await loadSignUpSearchParams(searchParams);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/auth lint`
- [x] Auth app builds: `pnpm build:auth`
- [x] E2E tests pass: `cd apps/auth && pnpm exec playwright test`

#### Manual Verification:
- [x] Sign-in page loads correctly at `/sign-in`
- [x] Sign-up page loads correctly at `/sign-up`
- [x] Search params (step, email, error, token) parse correctly from URL
- [x] Invitation ticket flow works on sign-up (`?__clerk_ticket=...`)

## References

- nuqs createLoader docs: https://nuqs.47ng.com/docs/server-side/loaders
- nuqs server.d.ts types: `node_modules/.pnpm/nuqs@2.8.9.../dist/server.d.ts`
- Current search-params: `apps/auth/src/app/(app)/(auth)/_lib/search-params.ts`
