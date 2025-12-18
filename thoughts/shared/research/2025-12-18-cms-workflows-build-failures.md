---
date: 2025-12-18T05:04:22Z
researcher: Claude
git_commit: 32d95b1d01d9d32797a93b91f3a7150fdd183fb1
branch: feat/memory-layer-foundation
repository: lightfastai/lightfast
topic: "@repo/cms-workflows Build Failures Analysis"
tags: [research, codebase, cms-workflows, basehub, type-errors]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: @repo/cms-workflows Build Failures Analysis

**Date**: 2025-12-18T05:04:22Z
**Researcher**: Claude
**Git Commit**: 32d95b1d01d9d32797a93b91f3a7150fdd183fb1
**Branch**: feat/memory-layer-foundation
**Repository**: lightfastai/lightfast

## Research Question

The `pnpm build:www` command fails on `@repo/cms-workflows` with TypeScript errors related to:
1. ~~Zod v3/v4 incompatibility between `@vendor/mastra` and `@repo/cms-workflows`~~ **RESOLVED** - Mastra removed
2. Basehub RichTextNode type mismatches
3. Record<string, unknown> type issues with basehub mutations

## Summary

**Update**: The Mastra workflow code (`workflows/blog.ts`) has been deleted and `@vendor/mastra` removed from dependencies. The zod v3/v4 incompatibility issue is no longer relevant.

The remaining build failures stem from two basehub-related type issues:

1. **RichTextNode Type Mismatch**: The custom `RichTextNode` type in `markdown-to-basehub.ts` uses `type: string` for the base node, while basehub's official type expects literal union types like `'paragraph' | 'bulletList' | 'basehub-block'`.

2. **Mutation Value Types**: The basehub SDK expects specific typed value objects (e.g., `{ type: 'text', value: string }`) but the code uses `Record<string, unknown>`.

## Current Package Structure

```
packages/cms-workflows/src/
├── index.ts
├── mutations/
│   ├── blog.ts      # basehub blog post mutations
│   └── changelog.ts # basehub changelog mutations
└── utils/
    └── markdown-to-basehub.ts  # markdown → RichText JSON converter
```

Dependencies (from package.json):
- `basehub: ^9.5.2`
- `@vendor/cms: workspace:*`
- `unified`, `remark-parse`, `remark-gfm` (markdown parsing)
- `zod: catalog:` (^3.24.0)

Note: `@vendor/mastra` has been removed.

## Detailed Findings

### 1. RichTextNode Type Mismatch

#### Basehub's Official Type
Location: `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/rich-text.d.ts`

```typescript
export type RichTextNode = {
    type: 'paragraph' | 'bulletList' | 'listItem' | 'taskList' | 'blockquote' | 'table' | 'tableRow' | 'tableBody';
    attrs?: Attrs;
    marks?: Array<Mark>;
    content?: Array<RichTextNode>;
} | {
    type: 'text';
    text: string;
    // ...
} | {
    type: 'codeBlock';
    attrs: { language?: string };
    // ...
} | {
    type: 'basehub-block';
    attrs: { id: string };
    // ...
};
```

The `type` field is a **literal union**, not a generic string.

#### Custom Type in cms-workflows
Location: `packages/cms-workflows/src/utils/markdown-to-basehub.ts:49-54`

```typescript
type BaseRichTextNode = {
  type: string;                    // <-- PROBLEM: generic string
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: RichTextNode[];
};
```

The custom union type includes `BaseRichTextNode` which uses `type: string` (line 50), making it incompatible with basehub's expected literal union.

#### Fix Strategy
Replace `type: string` with basehub's literal union:
```typescript
type BaseRichTextNode = {
  type: 'paragraph' | 'bulletList' | 'listItem' | 'taskList' | 'blockquote' |
        'table' | 'tableRow' | 'tableBody' | 'horizontalRule' | 'hardBreak';
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: RichTextNode[];
};
```

Or import and use basehub's `RichTextNode` type directly:
```typescript
import type { RichTextNode } from '@basehub/mutation-api-helpers';
```

### 2. Basehub Mutation Value Types

Location: `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/transaction.d.ts`

The basehub SDK expects specific value shapes:
```typescript
// CreateInstanceBlockOp.value expects:
value?: null | Record<string, {
    type: 'text';
    value: TextValue | null;
} | {
    type: 'rich-text';
    value: RichTextValue | null;
} | {
    type: 'boolean';
    value: BooleanValue | null;
} | ... >;
```

#### Issues in mutations/blog.ts
- **Line 110**: `const valueFields: Record<string, unknown> = { ... }`
- **Line 174**: `const engagementValue: Record<string, unknown> = { ... }`

#### Issues in mutations/changelog.ts
- **Line 185**: `const valueUpdates: Record<string, unknown> = {}`
- **Line 222**: `const updateData: Record<string, unknown> = { ... }`

#### Fix Strategy
Import basehub's mutation types and use them:
```typescript
import type { CreateInstanceBlockOp } from '@basehub/mutation-api-helpers';

// Then type the value objects properly:
const valueFields: NonNullable<CreateInstanceBlockOp['value']> = { ... };
```

Or define a local type that matches basehub's expected shape:
```typescript
type BasehubFieldValue =
  | { type: 'text'; value: string | null }
  | { type: 'rich-text'; value: { format: 'markdown' | 'json'; value: string | RichTextNode[] } | null }
  | { type: 'boolean'; value: boolean | null }
  | { type: 'select'; value: string | null }
  | { type: 'date'; value: string | null }
  | { type: 'reference'; value: string | string[] | null }
  | { type: 'image'; value: string | null }
  | { type: 'instance'; value: Record<string, BasehubFieldValue> };

type BasehubMutationValue = Record<string, BasehubFieldValue>;
```

## Code References

- `packages/cms-workflows/src/utils/markdown-to-basehub.ts:49-54` - custom RichTextNode with `type: string`
- `packages/cms-workflows/src/mutations/blog.ts:110` - `valueFields: Record<string, unknown>`
- `packages/cms-workflows/src/mutations/blog.ts:174` - `engagementValue: Record<string, unknown>`
- `packages/cms-workflows/src/mutations/changelog.ts:185` - `valueUpdates: Record<string, unknown>`
- `packages/cms-workflows/src/mutations/changelog.ts:222` - `updateData: Record<string, unknown>`
- `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/rich-text.d.ts:35-121` - basehub's RichTextNode type
- `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/transaction.d.ts:146-237` - basehub's CreateInstanceBlockOp type

## Required Fixes

### Fix 1: Update RichTextNode types in markdown-to-basehub.ts

**Option A** (Recommended): Import from basehub
```typescript
import type { RichTextNode } from '@basehub/mutation-api-helpers';
// Remove local RichTextNode type, use basehub's
```

**Option B**: Update local type to match basehub's literal unions
```typescript
type BaseRichTextNode = {
  type: 'paragraph' | 'bulletList' | 'listItem' | 'taskList' | 'blockquote' |
        'table' | 'tableRow' | 'tableBody' | 'horizontalRule' | 'hardBreak';
  // ...
};
```

### Fix 2: Type the mutation value objects

Replace `Record<string, unknown>` with properly typed basehub mutation values. Either:
- Import types from `@basehub/mutation-api-helpers`
- Define compatible local types
- Use type assertions with `as const` where appropriate

## Verification

After fixes, run:
```bash
pnpm --filter @repo/cms-workflows typecheck
pnpm build:www
```
