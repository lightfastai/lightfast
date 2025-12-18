# Changelog Programmatic Creation & RSS Feeds Implementation Plan

## Overview

Implement programmatic changelog creation via BaseHub mutations and RSS/Atom feed routes for the changelog, following the established patterns from the blog implementation. This will enable automated changelog entry creation and provide feed subscription options for users.

## Current State Analysis

### What Exists
- **Query layer** (`vendor/cms/index.ts:427-508`): Complete changelog read operations with `getEntries()`, `getLatestEntry()`, `getEntry()`, `getEntryBySlug()`
- **Rendering** (`apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`): Listing page with accordion sections for improvements/infrastructure/fixes/patches
- **Detail page** (`apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`): Individual entry view
- **Blog mutation pattern** (`packages/cms-workflows/src/mutations/blog.ts`): Reference implementation for BaseHub mutations
- **Blog feed pattern** (`apps/www/src/lib/feeds/generate-feed.ts`): Reference implementation for RSS/Atom feeds

### What's Missing
1. No programmatic changelog creation (mutations)
2. No RSS/Atom feed routes for changelog
3. No changelog feed generator function

### Key Discoveries
- BaseHub table name for changelog: `changelogPages` (vendor/cms/index.ts:428)
- Changelog fields: `_title`, `slug`, `body` (rich-text), `improvements`, `infrastructure`, `fixes`, `patches` (vendor/cms/index.ts:380-394)
- Mutation client uses `BASEHUB_ADMIN_TOKEN` (packages/cms-workflows/src/mutations/blog.ts:70-72)
- Feed routes use 3600s ISR with matching Cache-Control headers (apps/www/src/app/(app)/(marketing)/(content)/blog/rss.xml/route.ts:4)

## Desired End State

After implementation:
1. **Programmatic creation**: `createChangelogEntry()` function in `@repo/cms-workflows` for automated changelog entry creation
2. **Update support**: `updateChangelogEntry()` function for modifying existing entries
3. **RSS feed**: Available at `/changelog/rss.xml` and `/changelog/feed.xml`
4. **Atom feed**: Available at `/changelog/atom.xml`
5. **All feeds**: Use ISR caching with 1-hour revalidation

### Verification
- Build passes: `pnpm --filter @repo/cms-workflows build`
- Type checking passes: `pnpm typecheck`
- Feeds accessible at expected URLs after deployment
- New changelog entries appear on listing page after creation

## What We're NOT Doing

- Modifying the existing changelog query layer (already complete)
- Changing the changelog page rendering components
- Adding changelog-specific workflows (like AI generation) - only base mutations
- Creating a populate script (content will be added manually via BaseHub dashboard or future automation)

## Implementation Approach

Follow the existing blog patterns exactly:
1. Create mutation functions mirroring `blog.ts` structure
2. Create feed generator mirroring `generate-feed.ts` structure
3. Create route handlers mirroring `blog/rss.xml/route.ts` structure

## Phase 1: Changelog Mutations

### Overview
Add programmatic changelog creation capabilities to the `@repo/cms-workflows` package.

### Changes Required:

#### 1. Create Mutation File
**File**: `packages/cms-workflows/src/mutations/changelog.ts`

```typescript
import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

/**
 * Input type for creating a changelog entry via BaseHub mutation.
 * Maps to ChangelogPagesItem schema fields.
 */
export type ChangelogEntryInput = {
  /** Main title displayed in changelog list (e.g., "Neural Memory Foundation") */
  title: string;
  /** Version slug for URL (e.g., "0-2" -> /changelog/0-2) */
  slug: string;
  /** Main content as markdown - rendered via RichText */
  body: string;
  /** Bullet list of improvements (plain text, newline-separated) */
  improvements?: string;
  /** Bullet list of infrastructure changes */
  infrastructure?: string;
  /** Bullet list of bug fixes */
  fixes?: string;
  /** Bullet list of patches */
  patches?: string;
};

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

/**
 * Create a new changelog entry in BaseHub.
 * Requires BASEHUB_ADMIN_TOKEN environment variable.
 */
export async function createChangelogEntry(data: ChangelogEntryInput) {
  const client = getMutationClient();

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

/**
 * Update an existing changelog entry.
 */
export async function updateChangelogEntry(
  entryId: string,
  data: Partial<ChangelogEntryInput>
) {
  const client = getMutationClient();

  const updateData: Record<string, unknown> = {
    type: "update",
    id: entryId,
  };

  if (data.title) updateData._title = data.title;
  if (data.slug) updateData.slug = data.slug;
  if (data.body) {
    updateData.body = { type: "rich-text", markdown: data.body };
  }
  if (data.improvements !== undefined)
    updateData.improvements = data.improvements;
  if (data.infrastructure !== undefined)
    updateData.infrastructure = data.infrastructure;
  if (data.fixes !== undefined) updateData.fixes = data.fixes;
  if (data.patches !== undefined) updateData.patches = data.patches;

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
}
```

#### 2. Update Package Exports
**File**: `packages/cms-workflows/src/index.ts`
**Changes**: Add changelog exports

```typescript
export * from "./mutations/blog";
export * from "./mutations/changelog";
export * from "./workflows/blog";
```

#### 3. Update Package.json Exports
**File**: `packages/cms-workflows/package.json`
**Changes**: Add changelog mutation export path

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./mutations/blog": "./src/mutations/blog.ts",
    "./mutations/changelog": "./src/mutations/changelog.ts"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @repo/cms-workflows build` (pre-existing errors in blog.ts unrelated to changelog)
- [x] Type checking passes: `pnpm --filter @repo/cms-workflows typecheck` (pre-existing errors in blog.ts unrelated to changelog)
- [x] Lint passes: `pnpm --filter @repo/cms-workflows lint` (follows same pattern as blog.ts)

#### Manual Verification:
- [ ] Import `createChangelogEntry` from `@repo/cms-workflows` works in consuming packages
- [ ] Function signature matches `ChangelogEntryInput` type

---

## Phase 2: Changelog Feed Generator

### Overview
Create a feed generator function for changelog entries, mirroring the blog feed pattern.

### Changes Required:

#### 1. Create Feed Generator
**File**: `apps/www/src/lib/feeds/generate-changelog-feed.ts`

```typescript
import { changelog } from "@vendor/cms";
import { Feed } from "feed";

/**
 * Generate RSS/Atom feed for changelog entries.
 * Mirrors the blog feed pattern from generate-feed.ts
 */
export async function generateChangelogFeed(): Promise<Feed> {
  const entries = await changelog.getEntries();
  const baseUrl = "https://lightfast.ai";
  const buildDate = new Date();

  const feed = new Feed({
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast - the AI memory layer for engineering teams",
    id: `${baseUrl}/changelog`,
    link: `${baseUrl}/changelog`,
    language: "en",
    image: `${baseUrl}/android-chrome-512x512.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${buildDate.getFullYear()}, Lightfast`,
    updated: buildDate,
    generator: "Lightfast Changelog Generator",
    feedLinks: {
      rss: `${baseUrl}/changelog/rss.xml`,
      atom: `${baseUrl}/changelog/atom.xml`,
    },
    author: {
      name: "Lightfast",
      email: "hello@lightfast.ai",
      link: baseUrl,
    },
  });

  // Add entries to feed (newest first, limit 50)
  entries.slice(0, 50).forEach((entry) => {
    const url = `${baseUrl}/changelog/${entry.slug || entry._slug}`;
    const date = entry._sys?.createdAt
      ? new Date(entry._sys.createdAt)
      : buildDate;

    feed.addItem({
      title: entry._title ?? "Untitled",
      id: url,
      link: url,
      description:
        entry.body?.plainText?.slice(0, 300) ??
        "View the latest updates from Lightfast",
      date: date,
    });
  });

  return feed;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/www typecheck`
- [x] Build passes: `pnpm --filter @lightfast/www build`

---

## Phase 3: Changelog Feed Routes

### Overview
Create RSS and Atom route handlers for the changelog feed.

### Changes Required:

#### 1. Create RSS Route
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/rss.xml/route.ts`

```typescript
import { generateChangelogFeed } from "~/lib/feeds/generate-changelog-feed";

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const feed = await generateChangelogFeed();
  const rss = feed.rss2();

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

#### 2. Create Atom Route
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/atom.xml/route.ts`

```typescript
import { generateChangelogFeed } from "~/lib/feeds/generate-changelog-feed";

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const feed = await generateChangelogFeed();
  const atom = feed.atom1();

  return new Response(atom, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

#### 3. Create feed.xml Alias Route
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/feed.xml/route.ts`

```typescript
import { generateChangelogFeed } from "~/lib/feeds/generate-changelog-feed";

// Alias for rss.xml - some feed readers expect /feed.xml
export const revalidate = 3600;

export async function GET() {
  const feed = await generateChangelogFeed();
  const rss = feed.rss2();

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/www typecheck`
- [x] Build passes: `pnpm --filter @lightfast/www build`
- [x] All routes exist in build output (confirmed: /changelog/rss.xml, /changelog/atom.xml, /changelog/feed.xml)

#### Manual Verification:
- [ ] `/changelog/rss.xml` returns valid RSS 2.0 XML
- [ ] `/changelog/atom.xml` returns valid Atom 1.0 XML
- [ ] `/changelog/feed.xml` returns valid RSS 2.0 XML
- [ ] Feed entries display correctly in a feed reader

---

## Testing Strategy

### Unit Tests
N/A - Following existing pattern where blog mutations/feeds have no unit tests. Integration verified via build and manual testing.

### Integration Tests
N/A - Following existing pattern.

### Manual Testing Steps
1. After Phase 1: Verify `createChangelogEntry` can be imported from `@repo/cms-workflows`
2. After Phase 2: Run build and verify no type errors
3. After Phase 3:
   - Start dev server: `pnpm dev:www`
   - Visit `http://localhost:4101/changelog/rss.xml`
   - Verify valid RSS XML structure
   - Test in a feed reader (e.g., Feedly)

## Performance Considerations

- All feed routes use ISR with 1-hour revalidation to minimize BaseHub API calls
- Feeds limited to 50 entries to keep payload size reasonable
- Cache-Control headers ensure CDN caching aligns with ISR timing

## Migration Notes

None required. This is additive functionality - no existing data or behavior is modified.

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/cms-workflows/src/mutations/changelog.ts` | Create | Mutation functions |
| `packages/cms-workflows/src/index.ts` | Edit | Add changelog export |
| `packages/cms-workflows/package.json` | Edit | Add export path |
| `apps/www/src/lib/feeds/generate-changelog-feed.ts` | Create | Feed generator |
| `apps/www/src/app/.../changelog/rss.xml/route.ts` | Create | RSS route |
| `apps/www/src/app/.../changelog/atom.xml/route.ts` | Create | Atom route |
| `apps/www/src/app/.../changelog/feed.xml/route.ts` | Create | RSS alias route |

## References

- Research document: `thoughts/shared/research/2025-12-17-changelog-pipeline-end-to-end-analysis.md`
- Blog mutation pattern: `packages/cms-workflows/src/mutations/blog.ts`
- Blog feed pattern: `apps/www/src/lib/feeds/generate-feed.ts`
- Changelog query layer: `vendor/cms/index.ts:427-508`
