# Replace Remaining Hardcoded Provider Type Literals

## Overview

After the main console-providers SoT propagation plan (Phases 1–6), several hardcoded `"github" | "vercel" | "linear" | "sentry"` type literals remain across `@api/console`, `@apps/console`, and `@repo/console-test-data`. These are QoL fixes — they don't cause build failures but will break silently when a new provider is added.

## Current State Analysis

The main plan covers `connections.ts:51,75` and `workspace.ts` bulk-link procedures. A codebase grep reveals 5 additional sites with hardcoded provider literals.

### Key Convention:
- **Server-side code** (`api/console`, `packages/`): use `SourceType` from `@repo/console-providers`
- **Client-side code** (`apps/console`): use `ProviderSlug` from `@repo/console-providers/display` (client-safe subpath, same type)

## Desired End State

Zero hardcoded `"github" | "vercel" | "linear" | "sentry"` type literals outside of `@repo/console-providers` itself.

### How to verify:
```bash
pnpm typecheck
grep -r '"github" | "vercel" | "linear" | "sentry"' --include='*.ts' --include='*.tsx' \
  api/console/src apps/console/src packages/console-test-data/src
```
Should return zero matches (excluding comments).

## What We're NOT Doing

- Provider-specific **business logic** branches (`source === "github"` in `relationship-detection.ts`, `actor-resolution.ts`) — these are semantic checks, not type definitions
- Doc **comments** mentioning provider names (e.g., `workspace-events.ts:48`)
- Files inside `thoughts/` or `packages/console-providers/` itself

## Implementation Approach

Single phase — all changes are independent one-line type replacements.

---

## Phase 1: Replace All Hardcoded Provider Type Literals

### Changes Required:

#### 1. `workspace.ts` events list input
**File**: `api/console/src/router/org/workspace.ts`
**Line**: 1777
**Changes**: Replace hardcoded enum with `sourceTypeSchema`

`sourceTypeSchema` should already be imported from Phase 3 of the main plan. If not:
```ts
import { sourceTypeSchema } from "@repo/console-providers";
```

```ts
// BEFORE:
source: z.enum(["github", "vercel", "linear", "sentry"]).optional(),
// AFTER:
source: sourceTypeSchema.optional(),
```

#### 2. `use-oauth-popup.ts` interface
**File**: `apps/console/src/hooks/use-oauth-popup.ts`
**Line**: 9
**Changes**: Replace inline union with `ProviderSlug` type

```ts
import type { ProviderSlug } from "@repo/console-providers/display";

interface UseOAuthPopupOptions {
  // BEFORE:
  provider: "github" | "vercel" | "linear" | "sentry";
  // AFTER:
  provider: ProviderSlug;
  // ...
}
```

#### 3. `events-table.tsx` props interface
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx`
**Line**: 50
**Changes**: Replace inline union with `ProviderSlug` type

Already imports from `@repo/console-providers/display` at line 30. Add type import:
```ts
import { SOURCE_TYPE_OPTIONS } from "@repo/console-providers/display";
import type { ProviderSlug } from "@repo/console-providers/display";
```

```ts
interface EventsTableProps {
  orgSlug: string;
  workspaceName: string;
  // BEFORE:
  initialSource?: "github" | "vercel" | "linear" | "sentry";
  // AFTER:
  initialSource?: ProviderSlug;
}
```

#### 4. `events/page.tsx` validation and cast
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/page.tsx`
**Lines**: 15–18
**Changes**: Replace hardcoded array with `PROVIDER_SLUGS` and cast with `ProviderSlug`

```ts
import { PROVIDER_SLUGS } from "@repo/console-providers/display";
import type { ProviderSlug } from "@repo/console-providers/display";
```

```ts
// BEFORE:
const validSources = ["github", "vercel", "linear", "sentry"];
const initialSource =
  typeof search.source === "string" && validSources.includes(search.source)
    ? (search.source as "github" | "vercel" | "linear" | "sentry")
    : undefined;

// AFTER:
const initialSource =
  typeof search.source === "string" &&
  (PROVIDER_SLUGS as readonly string[]).includes(search.source)
    ? (search.source as ProviderSlug)
    : undefined;
```

Note: Cast `PROVIDER_SLUGS as readonly string[]` is needed because `Array.includes()` narrows the argument type — `string` is not assignable to `ProviderSlug` without widening the array type.

#### 5. `console-test-data/raw.ts` interface
**File**: `packages/console-test-data/src/raw.ts`
**Line**: 13
**Changes**: Replace inline union with `SourceType` type

`@repo/console-providers` is already a dependency in `package.json`.

```ts
import type { SourceType } from "@repo/console-providers";
```

```ts
export interface RawWebhook {
  // BEFORE:
  source: "github" | "vercel" | "linear" | "sentry";
  // AFTER:
  source: SourceType;
  eventType: string;
  payload: Record<string, unknown>;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build passes: `pnpm build:console`
- [x] Type check passes: `pnpm typecheck` (pre-existing failures in unrelated files confirmed)
- [x] Grep returns zero non-comment matches: `grep -rn '"github" | "vercel" | "linear" | "sentry"' --include='*.ts' --include='*.tsx' api/console/src apps/console/src packages/console-test-data/src`

---

## References

- Main plan: `thoughts/shared/plans/2026-03-06-console-providers-single-source-of-truth-propagation.md`
- Research: `thoughts/shared/research/2026-03-06-console-providers-single-source-of-truth-propagation.md`
