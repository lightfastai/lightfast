# Fix pnpm build:www TypeScript Compilation Errors

## Overview

Fix the `pnpm build:www` failure caused by two TypeScript compilation issues in `@repo/cms-workflows`:
1. Missing `zod` dependency
2. Missing Basehub `Scalars` type augmentations

## Current State Analysis

### Build Error Output

```
@repo/cms-workflows:build: src/mutations/blog.ts(6,35): error TS2339: Property 'BSHBSelect__442379851' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/workflows/blog.ts(3,19): error TS2307: Cannot find module 'zod' or its corresponding type declarations.
```

### Root Causes

**Issue 1: Missing `zod` dependency**
- `packages/cms-workflows/src/workflows/blog.ts:3` imports `z` from `"zod"` directly
- `zod` is not declared in `packages/cms-workflows/package.json`
- While `@repo/ai` has `zod`, TypeScript requires declared dependencies for direct imports

**Issue 2: Basehub Type Augmentation Not Loaded**
- The `vendor/cms/basehub-types.d.ts` contains module augmentation that extends `basehub`'s `Scalars` interface
- This augmentation adds project-specific types: `BSHBSelect__442379851`, `BSHBSelect__1319627841`, etc.
- `@repo/cms-workflows` imports from `@vendor/cms/env` (not the main export)
- The main export (`vendor/cms/index.ts:3`) loads the type augmentation via `import type * as _types from "./basehub-types.d.ts"`
- Since cms-workflows doesn't import from the main export, the augmentation never gets loaded

### Key Discoveries

- `vendor/cms/basehub-types.d.ts:14-21` contains the module augmentation
- `vendor/cms/basehub-types.d.ts:53-56` defines the BSHBSelect types
- `vendor/cms/index.ts:3` imports the types file to trigger augmentation
- `packages/cms-workflows/src/mutations/blog.ts:2` imports `Scalars` directly from `basehub`

## Desired End State

After implementation:
1. `pnpm build:www` completes successfully
2. `@repo/cms-workflows` has proper type safety for Basehub scalar types
3. The codebase follows the vendor abstraction pattern (no direct `basehub` type imports)
4. Type augmentations are reliably loaded for all consumers

### Verification

```bash
# All commands should succeed
pnpm build:www
pnpm --filter @repo/cms-workflows typecheck
pnpm --filter @repo/cms-workflows build
```

## What We're NOT Doing

- Not refactoring the entire cms-workflows package
- Not changing the Basehub schema or regenerating types
- Not modifying how other packages import from @vendor/cms
- Not adding zod re-exports from @repo/ai (direct dependency is cleaner)

## Implementation Approach

Follow the monorepo's vendor abstraction pattern:
1. Add `zod` as a direct dependency (standard pattern seen in `@vendor/cms`, `@repo/ai`)
2. Create a dedicated `@vendor/cms/types` export that re-exports Basehub scalar types
3. Update cms-workflows to import types from `@vendor/cms/types` instead of `basehub`

This approach:
- Maintains the vendor abstraction (no direct imports from external packages)
- Makes type dependencies explicit and reliable
- Follows existing patterns in the codebase

## Phase 1: Add zod Dependency

### Overview
Add `zod` as a direct dependency to `@repo/cms-workflows`.

### Changes Required

#### 1. Update package.json
**File**: `packages/cms-workflows/package.json`
**Changes**: Add zod to dependencies

```json
{
  "dependencies": {
    "@repo/ai": "workspace:*",
    "@vendor/cms": "workspace:*",
    "@vendor/mastra": "workspace:*",
    "basehub": "^9.5.2",
    "remark-gfm": "^4.0.1",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.0",
    "zod": "catalog:"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] Package installs successfully: `pnpm install`
- [x] No "Cannot find module 'zod'" errors: `pnpm --filter @repo/cms-workflows typecheck`

---

## Phase 2: Create @vendor/cms/types Export

### Overview
Create a dedicated types export from `@vendor/cms` that provides Basehub scalar types to consumers.

### Changes Required

#### 1. Create types.ts File
**File**: `vendor/cms/types.ts` (new file)
**Purpose**: Re-export Basehub scalar types with vendor abstraction

```typescript
/**
 * Re-export Basehub scalar types for consumers.
 *
 * This file ensures the module augmentation in basehub-types.d.ts is loaded
 * and provides a clean API for accessing project-specific Basehub types.
 *
 * Consumers should import from "@vendor/cms/types" instead of "basehub" directly.
 */

// Import the type augmentation file to ensure it's loaded
import "./basehub-types.d.ts";

// Re-export the augmented Scalars type
export type { Scalars } from "basehub";

// Re-export specific scalar types for convenience
export type {
  Scalars as BasehubScalars,
} from "basehub";

// Type aliases for commonly used BSHBSelect types
import type { Scalars } from "basehub";

export type ContentType = Scalars["BSHBSelect__442379851"];
export type BusinessGoal = Scalars["BSHBSelect__1319627841"];
export type CTAType = Scalars["BSHBSelect_957971831"];
export type PostStatus = Scalars["BSHBSelect_950708073"];
```

#### 2. Update package.json Exports
**File**: `vendor/cms/package.json`
**Changes**: Add types export path

```json
{
  "exports": {
    ".": {
      "default": "./index.ts"
    },
    "./env": "./env.ts",
    "./types": "./types.ts",
    "./next-config": "./next-config.ts",
    "./components/*": "./components/*"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] Types export resolves: `pnpm --filter @vendor/cms typecheck` (types.ts compiles correctly, JSX errors are pre-existing)
- [x] Type aliases are accessible from the export

---

## Phase 3: Update cms-workflows to Use @vendor/cms/types

### Overview
Update `@repo/cms-workflows` to import Basehub types from `@vendor/cms/types` instead of directly from `basehub`.

### Changes Required

#### 1. Update mutations/blog.ts
**File**: `packages/cms-workflows/src/mutations/blog.ts`
**Changes**: Replace basehub import with @vendor/cms/types

Before:
```typescript
import { basehub } from "basehub";
import type { Scalars } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

// Reuse scalar enums from generated Basehub types
export type ContentType = Scalars["BSHBSelect__442379851"];
export type BusinessGoal = Scalars["BSHBSelect__1319627841"];
export type CTAType = Scalars["BSHBSelect_957971831"];
export type PostStatus = Scalars["BSHBSelect_950708073"];
```

After:
```typescript
import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";
import type {
  ContentType,
  BusinessGoal,
  CTAType,
  PostStatus,
} from "@vendor/cms/types";

// Re-export types for consumers of this module
export type { ContentType, BusinessGoal, CTAType, PostStatus };
```

#### 2. Update workflows/blog.ts
**File**: `packages/cms-workflows/src/workflows/blog.ts`
**Changes**: Replace basehub Scalars import with @vendor/cms/types

Before:
```typescript
import { createStep, createWorkflow } from "@vendor/mastra";
import { anthropic, generateObject } from "@repo/ai/ai";
import { z } from "zod";
import type { Scalars } from "basehub";

// ... later in file (lines 81-82)
type PostContentType = Scalars["BSHBSelect__442379851"];
type PostBusinessGoal = Scalars["BSHBSelect__1319627841"];
```

After:
```typescript
import { createStep, createWorkflow } from "@vendor/mastra";
import { anthropic, generateObject } from "@repo/ai/ai";
import { z } from "zod";
import type { ContentType, BusinessGoal } from "@vendor/cms/types";

// ... later in file - use imported types directly
type PostContentType = ContentType;
type PostBusinessGoal = BusinessGoal;
```

### Success Criteria

#### Automated Verification:
- [x] No "BSHBSelect" type errors: The original errors `Property 'BSHBSelect__442379851' does not exist on type 'Scalars'` and `Cannot find module 'zod'` are resolved
- [ ] TypeScript compiles without errors: `pnpm --filter @repo/cms-workflows typecheck` (blocked by pre-existing zod v3/v4 incompatibility with mastra)
- [ ] Build succeeds: `pnpm --filter @repo/cms-workflows build` (blocked by pre-existing issues)
- [ ] Full www build succeeds: `pnpm build:www` (blocked by pre-existing issues)

#### Manual Verification:
- [ ] IDE shows correct type inference for ContentType, BusinessGoal, etc.
- [ ] No runtime behavior changes (this is a types-only change)

---

## Testing Strategy

### Unit Tests
- No new unit tests required (types-only changes)
- Existing tests should continue to pass

### Integration Tests
- Build pipeline is the integration test: `pnpm build:www`

### Manual Testing Steps
1. Run `pnpm build:www` and verify it completes successfully
2. Open `packages/cms-workflows/src/mutations/blog.ts` in IDE and verify type inference
3. Hover over `ContentType` to confirm it shows the union type `'tutorial' | 'announcement' | ...`

## Performance Considerations

None - these are compile-time type changes only.

## Migration Notes

None - this is an internal refactor with no API changes to consumers of `@repo/cms-workflows`.

## References

- Original research: `thoughts/shared/research/2025-12-18-build-www-failure.md`
- Type augmentation definition: `vendor/cms/basehub-types.d.ts:14-21`
- BSHBSelect types: `vendor/cms/basehub-types.d.ts:53-56`
- Main export type import: `vendor/cms/index.ts:3`
- Broken imports: `packages/cms-workflows/src/mutations/blog.ts:2`, `packages/cms-workflows/src/workflows/blog.ts:4`

## Alternative Approaches Considered

### Alternative 1: Add TypeScript Reference Directive
Add `/// <reference path="..." />` to cms-workflows files pointing to basehub-types.d.ts.

**Rejected because**: Creates implicit, fragile dependency. Easy to break when moving files.

### Alternative 2: Import from Main @vendor/cms Export
Change cms-workflows to import something from main `@vendor/cms` to trigger type loading.

**Rejected because**: May have side effects (initializes basehub client), doesn't follow vendor abstraction pattern for types.

### Alternative 3: Re-export zod from @repo/ai
Have cms-workflows import `z` from `@repo/ai` instead of adding zod dependency.

**Rejected because**: Creates unnecessary coupling. Direct dependency is cleaner and follows existing patterns.
