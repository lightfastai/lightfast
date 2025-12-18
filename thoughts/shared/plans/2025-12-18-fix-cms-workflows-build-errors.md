# Fix @repo/cms-workflows Build Errors

## Overview

The `@repo/cms-workflows` package fails TypeScript compilation due to type mismatches between custom RichTextNode types and basehub's official types, plus improper typing of mutation value objects. This plan addresses all 3 TypeScript errors to restore build functionality.

## Current State Analysis

The package has 3 TypeScript errors:

1. **blog.ts:204** - `Record<string, unknown>` not assignable to basehub's mutation value type
2. **changelog.ts:134** - Custom `RichTextNode[]` not assignable to basehub's `RichTextNode[]` (due to `BaseRichTextNode.type: string`)
3. **changelog.ts:237** - `Record<string, unknown>` not assignable to `Operation` type

### Key Discoveries:

- `markdown-to-basehub.ts:49-54` defines `BaseRichTextNode` with `type: string` instead of literal union
- Basehub's `RichTextNode` (from `@basehub/mutation-api-helpers`) uses discriminated union with literal `type` values
- Mutation value objects use `Record<string, unknown>` instead of properly typed `CreateInstanceBlockOp['value']`
- Basehub exports both `RichTextNode` and `CreateInstanceBlockOp` types that can be imported directly

### Relevant Basehub Types:

From `@basehub/mutation-api-helpers/dist/rich-text.d.ts`:
```typescript
export type RichTextNode =
  | { type: 'paragraph' | 'bulletList' | 'listItem' | 'taskList' | 'blockquote' | 'table' | 'tableRow' | 'tableBody'; ... }
  | { type: 'text'; text: string; ... }
  | { type: 'codeBlock'; attrs: { language?: string }; ... }
  | { type: 'orderedList'; attrs?: { start: number }; ... }
  | { type: 'heading'; attrs: { level: number }; ... }
  | { type: 'horizontalRule'; ... }
  | { type: 'hardBreak'; ... }
  | { type: 'image'; attrs: { src: string; alt?: string; ... }; ... }
  | { type: 'tableCell' | 'tableHeader' | 'tableFooter'; attrs: { colspan: number; rowspan: number; ... }; ... }
  | { type: 'basehub-block'; attrs: { id: string }; ... }
```

From `@basehub/mutation-api-helpers/dist/transaction.d.ts`:
```typescript
export type CreateInstanceBlockOp = {
  value?: null | Record<string,
    | { type: 'text'; value: TextValue | null; ... }
    | { type: 'rich-text'; value: RichTextValue | null; ... }
    | { type: 'boolean'; value: BooleanValue | null; ... }
    | { type: 'select'; value: TextValue | TextValue[] | null; ... }
    | { type: 'date'; value: TextValue | null; ... }
    | { type: 'reference'; value: ReferenceValue | ReferenceValue[] | null; ... }
    | { type: 'instance'; value?: CreateInstanceBlockOp['value'] | null; ... }
    | ...
  >;
};
```

## Desired End State

- `pnpm --filter @repo/cms-workflows typecheck` passes with 0 errors
- `pnpm build:www` succeeds (cms-workflows is a dependency)
- All existing functionality preserved (mutations work identically)

### Verification Commands:
```bash
pnpm --filter @repo/cms-workflows typecheck
pnpm build:www
```

## What We're NOT Doing

- **NOT changing runtime behavior** - Only fixing type annotations
- **NOT refactoring the markdown parser logic** - Just fixing type definitions
- **NOT adding new features** - Purely type-safety fix
- **NOT updating basehub SDK version** - Current version 9.5.2 is fine

## Implementation Approach

**Strategy**: Import and use basehub's official types where possible, and create properly-typed local aliases where custom types are needed.

The fix involves:
1. Import `RichTextNode` from `@basehub/mutation-api-helpers` and use it in `markdown-to-basehub.ts`
2. Define a proper typed helper for mutation values in the mutation files
3. Properly type the update operation in `changelog.ts`

---

## Phase 1: Fix RichTextNode Type in markdown-to-basehub.ts

### Overview
Replace the custom `RichTextNode` union that includes `BaseRichTextNode` (with `type: string`) with basehub's official `RichTextNode` type.

### Changes Required:

#### 1. Update type imports and definitions
**File**: `packages/cms-workflows/src/utils/markdown-to-basehub.ts`

**Change 1**: Import basehub's RichTextNode type and create compatible type alias

Replace lines 34-104:
```typescript
// BaseHub RichText types (from @basehub/mutation-api-helpers)
type Mark =
  | { type: "bold" | "italic" | "underline" | "strike" | "kbd" }
  | {
      type: "code";
      attrs: { isInline?: boolean; language: string; code: string };
    }
  | {
      type: "link";
      attrs:
        | { type: "link"; href: string; target?: string | null }
        | { type: "internal"; targetId: string; target?: string | null };
    }
  | { type: "highlight"; attrs: { color?: string | null } };

type BaseRichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: RichTextNode[];
};

type TextNode = {
  type: "text";
  text: string;
  marks?: Mark[];
};

type CodeBlockNode = {
  type: "codeBlock";
  attrs: { language?: string };
  content?: [{ type: "text"; text: string }];
};

type HeadingNode = {
  type: "heading";
  attrs: { level: number; id?: string };
  content?: RichTextNode[];
};

type OrderedListNode = {
  type: "orderedList";
  attrs?: { start: number };
  content?: RichTextNode[];
};

type TableCellNode = {
  type: "tableCell" | "tableHeader" | "tableFooter";
  attrs: { colspan: number; rowspan: number; colwidth?: null | number[] };
  content?: RichTextNode[];
};

type ImageNode = {
  type: "image";
  attrs: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    caption?: string;
  };
};

export type RichTextNode =
  | BaseRichTextNode
  | TextNode
  | CodeBlockNode
  | HeadingNode
  | OrderedListNode
  | TableCellNode
  | ImageNode;
```

With:
```typescript
// Import official basehub RichTextNode type for type compatibility
import type { RichTextNode as BasehubRichTextNode } from "@basehub/mutation-api-helpers";

// Re-export basehub's type for consumers
export type RichTextNode = BasehubRichTextNode;

// Mark type matches basehub's Mark type
type Mark =
  | { type: "bold" | "italic" | "underline" | "strike" | "kbd" }
  | {
      type: "code";
      attrs: { isInline?: boolean; language: string; code: string };
    }
  | {
      type: "link";
      attrs:
        | { type: "link"; href: string; target?: string | null }
        | { type: "internal"; targetId: string; target?: string | null };
    }
  | { type: "highlight"; attrs: { color?: string | null } };
```

**Change 2**: Update internal helper function return types to match basehub's types

The `createTextNode` function (lines 117-123) should return a type that's compatible with basehub's RichTextNode:
```typescript
function createTextNode(text: string, marks: Mark[] = []): RichTextNode {
  const node: RichTextNode = { type: "text", text } as RichTextNode;
  if (marks.length > 0) {
    (node as { marks?: Mark[] }).marks = [...marks];
  }
  return node;
}
```

**Change 3**: Update convertNode return type to be explicit

At line 259, change:
```typescript
function convertNode(
  node: Content,
  ctx: ConversionContext,
): RichTextNode | RichTextNode[] | null {
```

The function body already returns nodes that match basehub's types, so no logic changes needed.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/cms-workflows typecheck` - no errors from markdown-to-basehub.ts
- [x] `markdownToBaseHubJson()` return type is `RichTextNode[]` compatible with basehub

#### Manual Verification:
- [ ] Existing changelog creation still works via `/publish_changelog` command

---

## Phase 2: Fix Mutation Value Types in blog.ts

### Overview
Replace `Record<string, unknown>` with properly typed mutation value objects.

### Changes Required:

#### 1. Add type import and helper type
**File**: `packages/cms-workflows/src/mutations/blog.ts`

Add import at top of file (after existing imports):
```typescript
import type { CreateInstanceBlockOp } from "@basehub/mutation-api-helpers";

// Type alias for cleaner code
type MutationValue = NonNullable<CreateInstanceBlockOp["value"]>;
```

#### 2. Update valueFields declaration
**File**: `packages/cms-workflows/src/mutations/blog.ts`
**Line**: 110

Change:
```typescript
const valueFields: Record<string, unknown> = {
```

To:
```typescript
const valueFields: MutationValue = {
```

#### 3. Update engagementValue declaration
**File**: `packages/cms-workflows/src/mutations/blog.ts`
**Line**: 174

Change:
```typescript
const engagementValue: Record<string, unknown> = {
```

To:
```typescript
const engagementValue: MutationValue = {
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/cms-workflows typecheck` - no errors from blog.ts:204

---

## Phase 3: Fix Mutation Types in changelog.ts

### Overview
Fix the RichTextNode return type issue and the update operation type issue.

### Changes Required:

#### 1. The RichTextNode issue at line 134 will be automatically fixed
Once Phase 1 is complete (markdown-to-basehub exports basehub's RichTextNode), the type compatibility issue at changelog.ts:134 will be resolved since `markdownToBaseHubJson()` will return `BasehubRichTextNode[]`.

#### 2. Fix valueUpdates declaration
**File**: `packages/cms-workflows/src/mutations/changelog.ts`
**Line**: 185

Add import at top:
```typescript
import type { CreateInstanceBlockOp, Operation } from "@basehub/mutation-api-helpers";

type MutationValue = NonNullable<CreateInstanceBlockOp["value"]>;
```

Change:
```typescript
const valueUpdates: Record<string, unknown> = {};
```

To:
```typescript
const valueUpdates: MutationValue = {};
```

#### 3. Fix updateData declaration
**File**: `packages/cms-workflows/src/mutations/changelog.ts`
**Line**: 222-231

Change:
```typescript
const updateData: Record<string, unknown> = {
  type: "update",
  id: entryId,
};

if (data.title) updateData.title = data.title;
if (data.slug) updateData.slug = data.slug;
if (Object.keys(valueUpdates).length > 0) {
  updateData.value = valueUpdates;
}
```

To:
```typescript
const updateData: Extract<Operation, { type: "update" }> = {
  type: "update",
  id: entryId,
  ...(data.title && { title: data.title }),
  ...(data.slug && { slug: data.slug }),
  ...(Object.keys(valueUpdates).length > 0 && { value: { [entryId]: { type: "instance" as const, value: valueUpdates } } }),
};
```

Wait - looking at the basehub types more carefully, the `UpdateOp` expects `value` to be `UpdatesByBlock` which is `Record<string, {...}>`. Let me reconsider.

Actually, the issue is simpler. The `updateData` is being passed to `data: [updateData]` in the mutation. The type needs to be a valid `Operation`.

Looking at the existing working code in `createChangelogEntry`, it uses inline object literals which TypeScript can infer correctly. The issue is that `updateChangelogEntry` creates an intermediate variable typed as `Record<string, unknown>`.

**Better fix**: Remove the intermediate variable and use inline spread:

```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Update changelog: ${data.title ?? entryId}`,
      data: [{
        type: "update" as const,
        id: entryId,
        ...(data.title && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        ...(Object.keys(valueUpdates).length > 0 && { value: valueUpdates }),
      }],
    },
    message: true,
    status: true,
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/cms-workflows typecheck` passes with 0 errors
- [x] `pnpm build:www` completes successfully

#### Manual Verification:
- [ ] Test `/publish_changelog` command works correctly

---

## Testing Strategy

### Automated Tests:
- TypeScript compilation (`pnpm typecheck`)
- Full build (`pnpm build:www`)

### Manual Testing Steps:
1. Run `/publish_changelog` with a test changelog draft
2. Verify changelog entry appears correctly in BaseHub
3. Verify markdown content (especially tables) renders properly

---

## Performance Considerations

None - this is purely a type-safety fix with no runtime changes.

---

## Migration Notes

None - no database or data changes.

---

## References

- Research document: `thoughts/shared/research/2025-12-18-cms-workflows-build-failures.md`
- Basehub types: `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/`
- Source files:
  - `packages/cms-workflows/src/utils/markdown-to-basehub.ts`
  - `packages/cms-workflows/src/mutations/blog.ts`
  - `packages/cms-workflows/src/mutations/changelog.ts`
