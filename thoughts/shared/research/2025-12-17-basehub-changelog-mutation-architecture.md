---
date: 2025-12-17T10:23:37+08:00
researcher: Claude
git_commit: 70b178508c4a4640fd50f68899fba8f5757b3870
branch: feat/memory-layer-foundation
repository: lightfast
topic: "BaseHub Changelog Mutation Architecture"
tags: [research, codebase, basehub, cms, mutations, changelog, api]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude
---

# Research: BaseHub Changelog Mutation Architecture

**Date**: 2025-12-17T10:23:37+08:00
**Researcher**: Claude
**Git Commit**: 70b178508c4a4640fd50f68899fba8f5757b3870
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

What is the correct BaseHub mutation structure for creating changelog entries? Current mutations are failing with "Create operation is missing data property."

## Summary

The BaseHub mutation API has **two different formats** that can be used:

1. **High-level `_table` format**: Used in the current implementation (`_table: "changelogPages"`)
2. **Low-level Transaction format**: The official `@basehub/mutation-api-helpers` format with `parentId` + `data.type: "instance"`

The current implementation uses the **`_table` shorthand format**, which is a simplified API that BaseHub's SDK processes internally. However, based on the error message "Create operation is missing data property," the current structure is **nested incorrectly** - the `data` property needs to be passed directly to `__args`, not wrapped inside another `data` object.

## Detailed Findings

### 1. Current Implementation Structure (Failing)

**Location**: `packages/cms-workflows/src/mutations/changelog.ts:36-58`

```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Create changelog: ${data.title}`,
      data: {                              // <-- THIS IS THE PROBLEM
        type: "create",
        _table: "changelogPages",
        _title: data.title,
        // ...
      },
    },
    message: true,
    status: true,
  },
});
```

The same pattern is used in:
- `packages/cms-workflows/src/mutations/blog.ts:91-173`
- `scripts/test-create-blog-post.mjs:65-130`
- `scripts/populate-changelog.mjs:376-398`

### 2. BaseHub Transaction API Structure

**Source**: `@basehub/mutation-api-helpers@2.1.7` (`node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/transaction.d.ts`)

The official Transaction type structure:

```typescript
export type Operation = {
  type: 'create';
  parentId?: string | null;  // The collection block ID
  data: CreateOp;            // The block data to create
} | {
  type: 'update';
} & UpdateOp | {
  type: 'delete';
} & DeleteOp;

export type Transaction = {
  autoCommit?: string | false;
  operations: Operation[];   // Array of operations
};
```

### 3. CreateOp Type for Collection Items

For creating an item in a collection (like changelog entries), use `type: 'instance'`:

```typescript
type CreateOp = {
  type: 'instance';
  mainComponentId?: string;  // ID of parent collection (optional if using parentId)
  title?: string | null;
  slug?: string | null;
  value?: Record<string, {
    type: 'text' | 'rich-text' | 'number' | 'boolean' | ...;
    value: TextValue | RichTextValue | ...;
  }>;
} | // ... other CreateOp types
```

### 4. RichTextValue Format

**Critical**: Rich text values require a specific format:

```typescript
type RichTextValue = {
  format: 'markdown' | 'html';
  value: string;  // The actual content
} | {
  format: 'json';
  value: string | RichTextNode[];
};
```

**Current code uses**:
```typescript
body: {
  type: "rich-text",
  markdown: data.body,  // WRONG - should be { format: 'markdown', value: data.body }
}
```

### 5. ChangelogPagesItem Schema

**Source**: `vendor/cms/basehub-types.d.ts:348-366`

```typescript
export interface ChangelogPagesItem {
  _id: Scalars['String']
  _title: Scalars['String']
  _slug: Scalars['String']
  body: (Body_1 | null)           // RichText field
  fixes: (Scalars['String'] | null)         // Plain text
  improvements: (Scalars['String'] | null)  // Plain text
  infrastructure: (Scalars['String'] | null) // Plain text
  patches: (Scalars['String'] | null)       // Plain text
  slug: (Scalars['String'] | null)          // Custom slug field
}
```

**Field mapping**:
| Schema Field | Field Type | API Name |
|--------------|-----------|----------|
| `_title` | System title | title |
| `slug` | Text | slug |
| `body` | RichText | body |
| `improvements` | Text | improvements |
| `infrastructure` | Text | infrastructure |
| `fixes` | Text | fixes |
| `patches` | Text | patches |

### 6. Two Possible Correct Mutation Structures

#### Option A: High-Level `_table` Format (Simplified)

This format uses `_table` to specify the target collection by path:

```typescript
const mutation = await client.mutation({
  transaction: {
    __args: {
      autoCommit: "Create changelog entry",
      data: JSON.stringify([{
        type: "create",
        _table: "changelogPages",  // Collection path identifier
        _title: "Entry Title",
        slug: "entry-slug",
        body: {
          format: "markdown",
          value: "# Markdown content"
        },
        improvements: "- Bullet point",
        infrastructure: null,
        fixes: null,
        patches: null
      }])
    },
    message: true,
    status: true
  }
});
```

**Key difference**: The `data` should be `JSON.stringify()`'d when using this format.

#### Option B: Low-Level Transaction Format (Type-Safe)

This format uses the official `@basehub/mutation-api-helpers` types:

```typescript
import type { Transaction } from "basehub";

const mutation = await client.mutation({
  transaction: {
    __args: {
      autoCommit: "Create changelog entry",
      data: JSON.stringify([{
        type: "create",
        parentId: "<changelogPages-collection-id>",  // Actual BaseHub block ID
        data: {
          type: "instance",
          title: "Entry Title",
          slug: "entry-slug",
          value: {
            body: {
              type: "rich-text",
              value: { format: "markdown", value: "# Markdown content" }
            },
            improvements: { type: "text", value: "- Bullet point" },
            infrastructure: { type: "text", value: null },
            fixes: { type: "text", value: null },
            patches: { type: "text", value: null }
          }
        }
      }] satisfies Transaction["operations"])
    },
    message: true,
    status: true
  }
});
```

### 7. Finding the changelogPages Collection ID

To use Option B, you need the collection's block ID:

```typescript
// Query to find the changelogPages collection ID
const result = await client.query({
  changelogPages: {
    _id: true
  }
});
const collectionId = result.changelogPages._id;
```

### 8. BaseHub SDK Version

**Current version**: `basehub@9.5.2` (from `vendor/cms/package.json:27`)

**Mutation helpers version**: `@basehub/mutation-api-helpers@2.1.7`

## Root Cause Analysis

The "Create operation is missing data property" error occurs because:

1. The current code passes `data` as a plain object, not as a JSON string
2. The BaseHub GraphQL mutation expects either:
   - A `Transaction` object (with `operations` array)
   - OR a JSON-stringified array of operations
3. The `_table` format appears to be a convenience shorthand, but when used, the entire payload should be JSON-stringified

## Recommended Fix

**Option 1**: JSON-stringify the data payload

```typescript
// In packages/cms-workflows/src/mutations/changelog.ts
export async function createChangelogEntry(data: ChangelogEntryInput) {
  const client = getMutationClient();

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: JSON.stringify([{
          type: "create",
          _table: "changelogPages",
          _title: data.title,
          slug: data.slug,
          body: {
            format: "markdown",
            value: data.body,
          },
          improvements: data.improvements ?? null,
          infrastructure: data.infrastructure ?? null,
          fixes: data.fixes ?? null,
          patches: data.patches ?? null,
        }]),
      },
      message: true,
      status: true,
    },
  });
}
```

**Option 2**: Use the type-safe Transaction format (requires collection ID lookup)

## Code References

- `packages/cms-workflows/src/mutations/changelog.ts:33-59` - Current changelog mutation
- `packages/cms-workflows/src/mutations/blog.ts:91-173` - Blog mutation (same pattern)
- `vendor/cms/basehub-types.d.ts:348-366` - ChangelogPagesItem schema
- `vendor/cms/basehub-types.d.ts:1857-1867` - Transaction mutation signature
- `node_modules/.pnpm/@basehub+mutation-api-helpers@2.1.7_zod@3.25.76/node_modules/@basehub/mutation-api-helpers/dist/transaction.d.ts` - Official Transaction types
- `scripts/populate-changelog.mjs:376-398` - Script attempting to create changelog entries

## Architecture Documentation

### BaseHub Mutation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BASEHUB MUTATION API                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client Code                basehub SDK            BaseHub GraphQL API       │
│                                                                              │
│  ┌────────────────┐    ┌──────────────────┐    ┌──────────────────────┐    │
│  │ client.mutation │───▶│ GraphQL mutation │───▶│ transaction(data)    │    │
│  │ { transaction } │    │ with __args      │    │ processes operations │    │
│  └────────────────┘    └──────────────────┘    └──────────────────────┘    │
│                                                                              │
│  Data Format Options:                                                        │
│  ├─ JSON.stringify([{ type: "create", _table: "...", ... }])                │
│  └─ Transaction object { operations: [...] }                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comparison with Blog Mutation

Both blog and changelog mutations use identical patterns:

| Aspect | Blog (`blog.ts:98`) | Changelog (`changelog.ts:42`) |
|--------|---------------------|-------------------------------|
| `_table` value | `"blog.post"` | `"changelogPages"` |
| Data passed as | Object (not stringified) | Object (not stringified) |
| Rich text format | `{ type: "rich-text", markdown: ... }` | `{ type: "rich-text", markdown: ... }` |
| Status | **Likely also broken** | **Confirmed broken** |

## Historical Context

The current mutation pattern appears to be based on an older or undocumented BaseHub API format. The official `@basehub/mutation-api-helpers` package defines a different structure.

## Related Research

- `thoughts/shared/research/2025-12-17-changelog-pipeline-end-to-end-analysis.md` - Previous research on changelog pipeline

## Open Questions

1. **Is `_table` a supported format?** - The official SDK types don't include `_table`. It may be an internal/legacy format.
2. **Does blog mutation also fail?** - The blog mutation uses the same pattern and may have the same issue.
3. **Should we migrate to parentId format?** - Using the official type-safe format with `parentId` would provide better type checking but requires fetching collection IDs.

## Action Items

1. **Test JSON.stringify fix** - Wrap the data payload in `JSON.stringify()` and test
2. **Verify blog mutation** - Check if `scripts/test-create-blog-post.mjs` also fails with the same error
3. **Query changelogPages ID** - If JSON.stringify doesn't work, fetch the collection ID and use the type-safe format
4. **Update both mutations** - Apply the fix to both blog and changelog mutations
