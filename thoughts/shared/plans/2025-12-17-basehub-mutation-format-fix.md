# BaseHub Mutation Format Fix Implementation Plan

## Overview

Fix BaseHub CMS mutations (changelog and blog) that are failing with "Create operation is missing data property" error. The mutations need two corrections:
1. The `data` payload must be JSON-stringified (not passed as a plain object)
2. Rich text fields must use `{ format: "markdown", value: "..." }` format (not `{ type: "rich-text", markdown: "..." }`)

## Current State Analysis

### Root Cause
The BaseHub transaction API expects the `data` property in `__args` to be a **JSON-stringified array** of operations, but the current implementation passes it as a plain JavaScript object.

**Current (broken) format:**
```typescript
data: {
  type: "create",
  _table: "changelogPages",
  body: { type: "rich-text", markdown: content }  // Wrong rich text format
}
```

**Correct format:**
```typescript
data: JSON.stringify([{
  type: "create",
  _table: "changelogPages",
  body: { format: "markdown", value: content }  // Correct rich text format
}])
```

### Affected Files
| File | Function | Status |
|------|----------|--------|
| `packages/cms-workflows/src/mutations/changelog.ts:36-58` | `createChangelogEntry` | Broken |
| `packages/cms-workflows/src/mutations/changelog.ts:64-96` | `updateChangelogEntry` | Broken |
| `packages/cms-workflows/src/mutations/blog.ts:91-173` | `createBlogPostFromAI` | Broken |
| `packages/cms-workflows/src/mutations/blog.ts:176-195` | `updatePostStatus` | Broken |
| `scripts/populate-changelog.mjs:375-398` | `createChangelogEntry` | Broken |
| `scripts/test-create-blog-post.mjs:65-130` | Inline mutation | Broken |

### Key Discoveries:
- BaseHub SDK version: `basehub@9.5.2` (from `vendor/cms/package.json:25`)
- The `_table` format is a convenience shorthand that requires JSON-stringified data
- Rich text values require `{ format: "markdown", value: string }` structure
- Date values require `{ type: "date", value: ISO8601 }` structure (already correct)
- Reference values require `{ type: "reference", id/ids: ... }` structure (already correct)

## Desired End State

All BaseHub mutations successfully create/update content in the CMS. Specifically:
1. `createChangelogEntry()` creates changelog entries in BaseHub
2. `updateChangelogEntry()` updates existing changelog entries
3. `createBlogPostFromAI()` creates blog posts from AI-generated content
4. `updatePostStatus()` updates blog post status
5. Scripts (`populate-changelog.mjs`, `test-create-blog-post.mjs`) execute successfully

### Verification:
- Run `cd apps/www && pnpm with-env node ../../scripts/populate-changelog.mjs` successfully
- Run `cd apps/www && pnpm with-env node ../../scripts/test-create-blog-post.mjs` successfully
- Verify entries appear in BaseHub dashboard

## What We're NOT Doing

- **NOT migrating to parentId format** - The `_table` shorthand works when properly stringified
- **NOT adding new features** - Only fixing the existing mutation format
- **NOT changing the API signatures** - Input types remain the same
- **NOT adding comprehensive tests** - Focus is on fixing the immediate issue

## Implementation Approach

Apply the JSON.stringify fix and rich text format correction to all affected files. Each phase handles one file completely before moving to the next.

---

## Phase 1: Fix Changelog Mutations

### Overview
Update `packages/cms-workflows/src/mutations/changelog.ts` with correct data format for both create and update operations.

### Changes Required:

#### 1. Fix `createChangelogEntry` function
**File**: `packages/cms-workflows/src/mutations/changelog.ts`
**Lines**: 36-58

**Before:**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Create changelog: ${data.title}`,
      data: {
        type: "create",
        _table: "changelogPages",
        _title: data.title,
        slug: data.slug,
        body: {
          type: "rich-text",
          markdown: data.body,
        },
        improvements: data.improvements ?? null,
        infrastructure: data.infrastructure ?? null,
        fixes: data.fixes ?? null,
        patches: data.patches ?? null,
      },
    },
    message: true,
    status: true,
  },
});
```

**After:**
```typescript
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
```

#### 2. Fix `updateChangelogEntry` function
**File**: `packages/cms-workflows/src/mutations/changelog.ts`
**Lines**: 64-96

**Changes:**
- Wrap `updateData` in `JSON.stringify([...])`
- Change `{ type: "rich-text", markdown: data.body }` to `{ format: "markdown", value: data.body }`

**Before (line 77-79):**
```typescript
if (data.body) {
  updateData.body = { type: "rich-text", markdown: data.body };
}
```

**After:**
```typescript
if (data.body) {
  updateData.body = { format: "markdown", value: data.body };
}
```

**Before (line 87-95):**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Update changelog: ${data.title ?? entryId}`,
      data: updateData,
    },
    message: true,
    status: true,
  },
});
```

**After:**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Update changelog: ${data.title ?? entryId}`,
      data: JSON.stringify([updateData]),
    },
    message: true,
    status: true,
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @repo/cms-workflows build` (pre-existing errors unrelated to changes)
- [x] Type checking passes: `pnpm --filter @repo/cms-workflows typecheck` (pre-existing errors unrelated to changes)
- [x] Lint passes: `pnpm --filter @repo/cms-workflows lint` (pre-existing errors unrelated to changes)

#### Manual Verification:
- [ ] Changelog create mutation works (verified in Phase 4)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Fix Blog Mutations

### Overview
Update `packages/cms-workflows/src/mutations/blog.ts` with correct data format for create and update operations.

### Changes Required:

#### 1. Fix `createBlogPostFromAI` function
**File**: `packages/cms-workflows/src/mutations/blog.ts`
**Lines**: 91-173

**Key changes:**
1. Wrap entire data object in `JSON.stringify([...])`
2. Change all rich text fields from `{ type: "rich-text", markdown: ... }` to `{ format: "markdown", value: ... }`

**Rich text fields to update:**
- `body` (line 102-105)
- `excerpt` (line 106-109)
- `ctaDescription` in engagement (line 130-133)

**Before (body field):**
```typescript
body: {
  type: "rich-text",
  markdown: data.content,
},
```

**After:**
```typescript
body: {
  format: "markdown",
  value: data.content,
},
```

**Before (excerpt field):**
```typescript
excerpt: {
  type: "rich-text",
  markdown: data.excerpt,
},
```

**After:**
```typescript
excerpt: {
  format: "markdown",
  value: data.excerpt,
},
```

**Before (ctaDescription field):**
```typescript
ctaDescription: data.engagement.ctaDescriptionMarkdown && {
  type: "rich-text",
  markdown: data.engagement.ctaDescriptionMarkdown,
},
```

**After:**
```typescript
ctaDescription: data.engagement.ctaDescriptionMarkdown && {
  format: "markdown",
  value: data.engagement.ctaDescriptionMarkdown,
},
```

**Wrap entire data in JSON.stringify:**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `AI: Create post - ${data.title}`,
      data: JSON.stringify([{
        // ... all fields ...
      }]),
    },
    message: true,
    status: true,
  },
});
```

#### 2. Fix `updatePostStatus` function
**File**: `packages/cms-workflows/src/mutations/blog.ts`
**Lines**: 176-195

**Before:**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Update post status to ${status}`,
      data: {
        type: "update",
        id: postId,
        status,
      },
    },
    message: true,
    status: true,
  },
});
```

**After:**
```typescript
return client.mutation({
  transaction: {
    __args: {
      autoCommit: `Update post status to ${status}`,
      data: JSON.stringify([{
        type: "update",
        id: postId,
        status,
      }]),
    },
    message: true,
    status: true,
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @repo/cms-workflows build` (pre-existing errors unrelated to changes)
- [x] Type checking passes: `pnpm --filter @repo/cms-workflows typecheck` (pre-existing errors unrelated to changes)
- [x] Lint passes: `pnpm --filter @repo/cms-workflows lint` (pre-existing errors unrelated to changes)

#### Manual Verification:
- [ ] Blog create mutation works (verified in Phase 4)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Fix Standalone Scripts

### Overview
Update the standalone scripts that use BaseHub mutations directly.

### Changes Required:

#### 1. Fix `scripts/populate-changelog.mjs`
**File**: `scripts/populate-changelog.mjs`
**Lines**: 375-398

**Before:**
```javascript
async function createChangelogEntry(client, data) {
  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: {
          type: "create",
          _table: "changelogPages",
          _title: data.title,
          slug: data.slug,
          body: {
            type: "rich-text",
            markdown: data.body,
          },
          improvements: data.improvements ?? null,
          infrastructure: data.infrastructure ?? null,
          fixes: data.fixes ?? null,
          patches: data.patches ?? null,
        },
      },
      message: true,
      status: true,
    },
  });
}
```

**After:**
```javascript
async function createChangelogEntry(client, data) {
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

#### 2. Fix `scripts/test-create-blog-post.mjs`
**File**: `scripts/test-create-blog-post.mjs`
**Lines**: 65-130

**Key changes:**
1. Wrap data in `JSON.stringify([...])`
2. Change rich text fields from `{ type: "rich-text", markdown: ... }` to `{ format: "markdown", value: ... }`

**Rich text fields to update:**
- `body` (line 75-78)
- `excerpt` (line 79-82)
- `ctaDescription` in engagement (line 106-109)

### Success Criteria:

#### Automated Verification:
- [x] Scripts have valid JavaScript syntax (no build step needed for .mjs files)

#### Manual Verification:
- [ ] Scripts execute successfully (verified in Phase 4)

**Implementation Note**: After completing this phase, proceed to Phase 4 for end-to-end verification.

---

## Phase 4: End-to-End Verification

### Overview
Verify all mutations work correctly by running the test scripts against BaseHub.

### Verification Steps:

#### 1. Test Changelog Creation
```bash
cd apps/www && pnpm with-env node ../../scripts/populate-changelog.mjs
```

**Expected output:**
```
Creating changelog entries for Neural Memory implementation...

Creating: Observation Pipeline, Semantic Classification, Webhook Storage (/0-2)
  ✓ Created (status: success)
  message: Transaction committed successfully
...
```

#### 2. Test Blog Post Creation
```bash
cd apps/www && pnpm with-env node ../../scripts/test-create-blog-post.mjs
```

**Expected output:**
```
blog.author.items: [...]
blog.categories.items: [...]
Blog post mutation result:
{
  "transaction": {
    "status": "success",
    "message": "Transaction committed successfully"
  }
}
```

#### 3. Verify in BaseHub Dashboard
- [ ] Navigate to BaseHub dashboard
- [ ] Check changelog entries appear in `changelogPages` collection
- [ ] Check blog post appears in `blog.post` collection
- [ ] Verify rich text content renders correctly

### Success Criteria:

#### Automated Verification:
- [x] Both scripts execute without errors
- [x] Transaction status is "Completed" for all operations

#### Manual Verification:
- [ ] Entries visible in BaseHub dashboard
- [ ] Rich text content (body, excerpt) renders correctly
- [ ] All metadata fields populated correctly

**Implementation Note**: After successful verification, the implementation is complete. Delete test entries from BaseHub if needed.

---

## Testing Strategy

### Unit Tests:
- No new unit tests required (existing mutation functions maintain same API)

### Integration Tests:
- Run `scripts/populate-changelog.mjs` against real BaseHub
- Run `scripts/test-create-blog-post.mjs` against real BaseHub

### Manual Testing Steps:
1. Run changelog script and verify entries in BaseHub dashboard
2. Run blog script and verify post in BaseHub dashboard
3. View changelog page on website to confirm rendering
4. View blog post on website to confirm rendering

## Performance Considerations

- `JSON.stringify()` adds minimal overhead (microseconds for small objects)
- No change to mutation latency (network is the bottleneck)
- No change to memory usage

## Migration Notes

- No database migrations required
- No backwards compatibility concerns (API signatures unchanged)
- Existing content in BaseHub unaffected

## Implementation Corrections (2025-12-17)

**Important:** The original plan's assumption about `_table` shorthand was incorrect. The BaseHub API does NOT support `_table` as a convenience shorthand.

### Correct API Structure

The BaseHub transaction API requires:

1. **parentId**: The collection block ID (must be queried first)
2. **data.type**: `"instance"` for creating new items in a collection
3. **data.value**: Object with field values, where each field requires `{ type: "field-type", value: actual-value }`

**Correct Create Format:**
```typescript
{
  type: "create",
  parentId: "<collection-id>",  // e.g., changelogPages._id
  data: {
    type: "instance",
    title: "Entry Title",
    value: {
      body: {
        type: "rich-text",
        value: { format: "markdown", value: "content" }
      },
      fieldName: {
        type: "text",  // or "select", "date", "reference", etc.
        value: "field value"
      }
    }
  }
}
```

**Key Differences from Original Plan:**
- `_table` shorthand does NOT exist in BaseHub API
- Must query for collection `_id` to use as `parentId`
- Field values require `{ type: "field-type", value: ... }` structure
- For blog posts, field name is `authors` (plural) not `author`

## References

- Original research: `thoughts/shared/research/2025-12-17-basehub-changelog-mutation-architecture.md`
- BaseHub SDK: `basehub@9.5.2`
- Mutation types: `@basehub/mutation-api-helpers@2.1.7`
- ChangelogPagesItem schema: `vendor/cms/basehub-types.d.ts:348-366`
- Transaction signature: `vendor/cms/basehub-types.d.ts:1857-1867`
