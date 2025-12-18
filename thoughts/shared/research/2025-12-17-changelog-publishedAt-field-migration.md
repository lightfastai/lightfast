---
date: 2025-12-17T18:00:00+08:00
researcher: Claude Code
git_commit: 64237e4b96deeaf60868fb759943866c14c80e12
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Changelog publishedAt Field Migration Analysis"
tags: [research, codebase, changelog, basehub, cms, date-handling]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude Code
---

# Research: Changelog publishedAt Field Migration Analysis

**Date**: 2025-12-17T18:00:00+08:00
**Researcher**: Claude Code
**Git Commit**: 64237e4b96deeaf60868fb759943866c14c80e12
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

We've added a new `publishedAt` field to changelog. We need to understand how `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx` and `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx` currently use `publishedAt` vs the internal BaseHub `createdAt` field.

## Summary

The codebase has a **partially migrated** state for changelog date handling:

1. **Main changelog pages** (`page.tsx` and `[slug]/page.tsx`) - Already use `publishedAt` with fallback to `_sys?.createdAt`
2. **Feed generation** (`generate-changelog-feed.ts`) - Already uses `publishedAt` with fallback
3. **Changelog preview component** - Uses ONLY `_sys?.createdAt` (needs update)
4. **Sitemap generation** - Uses ONLY `_sys?.createdAt` (needs update)
5. **Query ordering** - All queries order by `_sys_createdAt__DESC`, not `publishedAt__DESC`

## Detailed Findings

### 1. BaseHub Type Definitions

**File**: `vendor/cms/basehub-types.d.ts`

The `publishedAt` field is defined in the BaseHub schema:

```typescript
// Line 367
publishedAt: (Scalars['String'] | null)  // ISO 8601 date string
```

The `_sys.createdAt` field comes from `BlockDocumentSys`:

```typescript
// Line 151
createdAt: Scalars['String']  // Always present, auto-generated
```

Both fields support:
- **Sorting**: `publishedAt__ASC/DESC` and `_sys_createdAt__ASC/DESC` in `ChangelogPagesItemOrderByEnum`
- **Filtering**: Via `DateFilter` in `ChangelogPagesItemFilterInput`

### 2. Current Date Handling Patterns

#### Pattern A: Prefer publishedAt with fallback (CORRECT)

Used in main changelog pages and feed generation:

```typescript
const publishedTime = item.publishedAt || item._sys?.createdAt;
```

**Files using this pattern:**
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:70`
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx:50, 122`
- `apps/www/src/lib/feeds/generate-changelog-feed.ts:41-45`

#### Pattern B: Only createdAt (NEEDS UPDATE)

These files only use `_sys?.createdAt`:

**`apps/www/src/components/changelog-preview.tsx:39-41`**
```typescript
const created = item._sys?.createdAt
  ? new Date(item._sys.createdAt)
  : null;
```

**`apps/console/src/app/sitemap.ts:178-179`**
```typescript
lastModified: entry._sys?.createdAt
  ? new Date(entry._sys.createdAt)
  : new Date(),
```

### 3. Query Ordering Analysis

All changelog queries in `vendor/cms/index.ts` currently order by `_sys_createdAt__DESC`:

**entriesQuery** (line 477-484):
```typescript
changelogPages: {
  __args: { orderBy: "_sys_createdAt__DESC" },
  items: changelogEntryFragment,
}
```

**entriesMetaQuery** (line 486-493):
```typescript
changelogPages: {
  __args: { orderBy: "_sys_createdAt__DESC" },
  items: changelogEntryMetaFragment,
}
```

**latestEntryQuery** (line 495-502):
```typescript
changelogPages: {
  __args: { first: 1, orderBy: "_sys_createdAt__DESC" },
  item: changelogEntryFragment,
}
```

### 4. Fragment Definitions

The `changelogEntryFragment` in `vendor/cms/index.ts:380-413` includes both fields:

```typescript
const changelogEntryFragment = fragmentOnLoose("ChangelogPagesItem")({
  ...changelogEntryMetaFragment,  // Contains _sys.createdAt
  // ... other fields ...
  publishedAt: true,  // Line 406
  // ...
});
```

The `changelogEntryMetaFragment` (lines 371-378) includes:
```typescript
_sys: { createdAt: true }
```

### 5. Data Flow Summary

```
BaseHub CMS
    │
    ├── publishedAt (custom field, nullable)
    │   └── ISO 8601 string, manually set
    │
    └── _sys.createdAt (auto-generated, always present)
        └── ISO 8601 string, set on creation
    │
    ▼
vendor/cms/index.ts
    │
    ├── Queries order by: _sys_createdAt__DESC
    └── Types export both fields
    │
    ▼
Apps consume data
    │
    ├── Main pages: publishedAt || _sys?.createdAt ✓
    ├── Feed gen:   publishedAt || _sys?.createdAt ✓
    ├── Preview:    _sys?.createdAt only ✗
    └── Sitemap:    _sys?.createdAt only ✗
```

## Code References

| File | Line(s) | Current Behavior | Status |
|------|---------|-----------------|--------|
| `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx` | 70 | `publishedAt \|\| _sys?.createdAt` | Correct |
| `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx` | 50, 122 | `publishedAt \|\| _sys?.createdAt` | Correct |
| `apps/www/src/lib/feeds/generate-changelog-feed.ts` | 41-45 | `publishedAt \|\| _sys?.createdAt \|\| buildDate` | Correct |
| `apps/www/src/components/changelog-preview.tsx` | 39-41 | `_sys?.createdAt` only | Needs Update |
| `apps/console/src/app/sitemap.ts` | 178-179 | `_sys?.createdAt` only | Needs Update |
| `vendor/cms/index.ts` | 477-502 | Queries order by `_sys_createdAt__DESC` | Consider Update |

## Architecture Documentation

### Current Pattern (Post-Migration)

The intended pattern throughout the codebase is:
```typescript
const publishedTime = item.publishedAt || item._sys?.createdAt;
const publishedDate = publishedTime ? new Date(publishedTime) : null;
```

This pattern:
1. **Prefers** `publishedAt` when available (allows backdating/scheduling)
2. **Falls back** to `_sys?.createdAt` for entries without explicit publish date
3. **Handles null** gracefully with ternary check

### Decision Points for Full Migration

If `publishedAt` should become the primary date source:

1. **Query ordering**: Should queries order by `publishedAt__DESC` instead of `_sys_createdAt__DESC`?
   - Pro: Respects intended publish order
   - Con: Null values in `publishedAt` may affect ordering

2. **Fallback removal**: If `publishedAt` is now required, the fallback pattern could be simplified
   - Requires ensuring all existing entries have `publishedAt` set in BaseHub

## Related Research

No related research documents found for this specific topic.

## Open Questions

1. Is `publishedAt` now a required field in BaseHub, or should the fallback pattern be maintained?
2. Should query ordering change from `_sys_createdAt__DESC` to `publishedAt__DESC`?
3. For entries without `publishedAt`, should we backfill from `_sys.createdAt` in BaseHub?
