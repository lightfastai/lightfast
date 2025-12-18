---
date: 2025-12-18T23:15:00+08:00
researcher: Claude
git_commit: cc16b40fc7f1213019d5f6a4276a8f461235c690
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Why pnpm build:www fails"
tags: [research, build, cms-workflows, typescript, basehub]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: Why pnpm build:www fails

**Date**: 2025-12-18T23:15:00+08:00
**Researcher**: Claude
**Git Commit**: cc16b40fc7f1213019d5f6a4276a8f461235c690
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Why does running `pnpm build:www` fail?

## Summary

The build fails in the `@repo/cms-workflows` package (a dependency of `@lightfast/www`) due to two TypeScript compilation issues:

1. **Missing `zod` dependency**: The package imports `z` from `"zod"` directly but doesn't declare `zod` as a dependency
2. **Missing Basehub type augmentations**: The `Scalars` type imported from `basehub` doesn't include the project-specific `BSHBSelect_*` types because the module augmentation from `vendor/cms/basehub-types.d.ts` isn't being loaded during cms-workflows compilation

## Detailed Findings

### Build Error Output

```
@repo/cms-workflows:build: src/mutations/blog.ts(6,35): error TS2339: Property 'BSHBSelect__442379851' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/mutations/blog.ts(7,36): error TS2339: Property 'BSHBSelect__1319627841' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/mutations/blog.ts(8,31): error TS2339: Property 'BSHBSelect_957971831' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/mutations/blog.ts(9,34): error TS2339: Property 'BSHBSelect_950708073' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/workflows/blog.ts(3,19): error TS2307: Cannot find module 'zod' or its corresponding type declarations.
@repo/cms-workflows:build: src/workflows/blog.ts(81,32): error TS2339: Property 'BSHBSelect__442379851' does not exist on type 'Scalars'.
@repo/cms-workflows:build: src/workflows/blog.ts(82,33): error TS2339: Property 'BSHBSelect__1319627841' does not exist on type 'Scalars'.
```

### Issue 1: Missing `zod` Dependency

**File**: `packages/cms-workflows/src/workflows/blog.ts:3`

```typescript
import { z } from "zod";  // Line 3 - zod not in package.json
```

**Package.json**: `packages/cms-workflows/package.json`

The `zod` package is not listed in dependencies. While `@repo/ai` (a dependency of cms-workflows) has `zod`, TypeScript requires direct imports to be from declared dependencies.

### Issue 2: Basehub Type Augmentation Not Loaded

**How the types are defined**:

The `vendor/cms/basehub-types.d.ts` file contains a module augmentation that extends the `basehub` package's `Scalars` interface:

```typescript
// vendor/cms/basehub-types.d.ts
declare module "basehub" {
  export interface Scalars extends _Scalars {}
}

export interface Scalars {
    BSHBSelect_950708073: 'draft' | 'published' | 'archived',
    BSHBSelect_957971831: 'none' | 'newsletter' | 'demo' | 'download' | 'signup',
    BSHBSelect__1319627841: 'awareness' | 'consideration' | 'conversion' | 'retention',
    BSHBSelect__442379851: 'tutorial' | 'announcement' | 'thought-leadership' | 'case-study' | 'comparison' | 'deep-dive' | 'guide',
    // ... other fields
}
```

**Why it doesn't work**:

1. The `vendor/cms/index.ts` imports the types file:
   ```typescript
   import type * as _types from "./basehub-types.d.ts";
   ```

2. However, `@repo/cms-workflows` imports from `@vendor/cms/env` (not the main export):
   ```typescript
   // packages/cms-workflows/src/mutations/blog.ts
   import { basehubEnv } from "@vendor/cms/env";  // Line 3
   ```

3. The `env.ts` export doesn't include the type augmentation file

4. When TypeScript compiles cms-workflows, it doesn't include `basehub-types.d.ts` in the compilation, so the module augmentation doesn't take effect

**How code uses these types**:

```typescript
// packages/cms-workflows/src/mutations/blog.ts
import type { Scalars } from "basehub";

export type ContentType = Scalars["BSHBSelect__442379851"];      // Line 6
export type BusinessGoal = Scalars["BSHBSelect__1319627841"];    // Line 7
export type CTAType = Scalars["BSHBSelect_957971831"];           // Line 8
export type PostStatus = Scalars["BSHBSelect_950708073"];        // Line 9
```

```typescript
// packages/cms-workflows/src/workflows/blog.ts
import type { Scalars } from "basehub";

type PostContentType = Scalars["BSHBSelect__442379851"];         // Line 81
type PostBusinessGoal = Scalars["BSHBSelect__1319627841"];       // Line 82
```

## Code References

- `packages/cms-workflows/package.json` - Missing `zod` dependency
- `packages/cms-workflows/src/workflows/blog.ts:3` - Direct import of `zod`
- `packages/cms-workflows/src/mutations/blog.ts:6-9` - References to BSHBSelect types
- `packages/cms-workflows/src/workflows/blog.ts:81-82` - References to BSHBSelect types
- `vendor/cms/basehub-types.d.ts:53-56` - Definition of BSHBSelect types
- `vendor/cms/index.ts:3` - Type import that loads basehub-types.d.ts
- `vendor/cms/env.ts` - Doesn't include basehub-types.d.ts

## Architecture Documentation

### Dependency Chain
```
@lightfast/www
  └── @repo/cms-workflows
        ├── @vendor/cms (dependency, but only imports /env subpath)
        ├── @repo/ai (has zod as dependency)
        └── basehub (direct dependency)
```

### Type Augmentation Pattern

The codebase uses TypeScript module augmentation to extend the `basehub` package's types with project-specific Basehub schema types. This is defined in `vendor/cms/basehub-types.d.ts` and is auto-generated by the Basehub SDK based on the CMS schema.

For the augmentation to work in consuming packages, the declaration file must be included in their TypeScript compilation context.

## Open Questions

1. Should cms-workflows import from `@vendor/cms` (main export) instead of `@vendor/cms/env` to get the type augmentation?
2. Should the `Scalars` and `BSHBSelect_*` types be re-exported from `@vendor/cms` so consumers don't need to import directly from `basehub`?
3. Should `zod` be added directly to cms-workflows dependencies, or should the code use zod through `@repo/ai`?
