# vendor/cms Type Structural Derivation Plan

## Overview

Replace manually maintained runtime type interfaces (`PostMeta`, `Post`, `ChangelogEntryMeta`, `ChangelogEntry`, `Category`) with types structurally derived from BaseHub fragment return types. This permanently eliminates the class of bug where runtime types are looser than BaseHub's guarantees — not by fixing the drift, but by deleting the source of drift.

Remove the legal fallback that silently serves legal content as blog content. Simplify all consumer fallback chains that become unnecessary once types are correct.

## Current State Analysis

`vendor/cms/index.ts` maintains three parallel representations of the same data:
1. `basehub-types.d.ts` — BaseHub's auto-generated source of truth (correct)
2. `postMetaFragment` etc. — selection sets describing which fields to fetch (correct)
3. `interface PostMeta` etc. — manually typed runtime interfaces (wrong — all fields nullable)

The divergence between 1 and 3 forces 17 consumer files to add defensive fallback chains on fields that BaseHub guarantees are required. These fallbacks are dead code that obscures intent, makes refactoring harder, and will silently hide future data issues.

### Key Facts Verified in Codebase

- `PostItem_1._title`, `._slug`, `.slug`, `.description` — required `string` in BaseHub (`basehub-types.d.ts:628-646`)
- `PostItem.publishedAt`, `.prefix`, `._title`, `._slug` — required `string` in BaseHub (notably `publishedAt` has NO null on changelog)
- `SeoComponent_1.metaTitle`, `.metaDescription`, `.secondaryKeywords` — required in BaseHub
- `SeoComponent.metaTitle`, `.metaDescription` — nullable in BaseHub (changelog SEO is looser than blog SEO)
- `blog.getPosts()` has a nested try/catch that falls back to `legal.getPosts()` then `mapLegalMetaToBlogMeta()` — legal posts silently appear as blog posts on BaseHub failure (`vendor/cms/index.ts:226-238`)
- `BlogPostQueryResponse` is defined locally in `blog/[slug]/page.tsx:18-24` — vendor exports `ChangelogEntryQueryResponse` and `LegalPostQueryResponse` but not this equivalent
- `categories.getCategories()` already has an internal catch returning `[]` (`index.ts:54-59`) — the consumer `layout.tsx:11` relies on this correctly

### The Structural Derivation Insight

When `blog.getPosts()` removes its explicit `: Promise<PostMeta[]>` annotation and returns `data.blog.post.items` directly, TypeScript infers the type from BaseHub's generic `query<T>` return. Since `postsQuery` uses `fragmentOn("PostItem_1", ...)`, BaseHub types the result as a pick of `PostItem_1` with only the selected fields — preserving required/nullable from the generated types.

```ts
// Before: explicit annotation overrides inference (wrong)
getPosts: async (): Promise<PostMeta[]> => {
  return data.blog.post.items  // ← forced into PostMeta[] (all nullable)
}

// After: inference flows from BaseHub's typed query result (correct)
getPosts: async () => {
  return data.blog.post.items  // ← BaseHub infers: { _slug: string; _title: string; ... }[]
}

// Exported type derived from the function:
export type PostMeta = Awaited<ReturnType<typeof blog['getPosts']>>[number]
// Result: { _slug: string; _title: string; slug: string; description: string; ... }
// Required fields are required because PostItem_1 says so — not because we said so
```

### Why Consumer Code Doesn't Break in Phase 1

Tightening types is non-breaking for consumers because:
- `post._title ?? ""` — compiles when `_title: string`. The `??` is dead code but valid TS.
- `post.seo?.metaTitle` — compiles when `seo` is required. The `?.` is unnecessary but valid TS.
- `let posts: Post[] = []` — works when `Post` is the derived type (updated simultaneously).

Phases 2–3 clean up the now-unnecessary defensive patterns.

## Desired End State

After this plan, `vendor/cms/index.ts` contains NO manually maintained type interfaces for blog/changelog/category. Every exported type is derived from a fragment-backed function return. BaseHub type regen (`basehub sync`) automatically propagates correctness changes without manual intervention.

Consumer files use field access without defensive fallbacks on guaranteed-present fields: `post._title`, `post.slug`, `post.seo.metaTitle`, `entry.publishedAt` (no `??`). Nullable fields retain appropriate guards: `post.publishedAt`, `post.featuredImage?.url`, `entry.seo.metaTitle`.

### Verification:
```bash
pnpm --filter @vendor/cms typecheck   # vendor layer clean
pnpm --filter @lightfast/www typecheck  # www consumers clean
pnpm check                             # no lint errors
```

## What We're NOT Doing

- **Not adding runtime validation (Zod)** — TypeScript structural derivation is sufficient; runtime shapes match because BaseHub enforces them server-side
- **Not adding BaseHub webhooks or revalidation** — ISR (`revalidate = 300`) stays as-is
- **Not migrating to direct fragment type access in Feed consumers** — the `data as XQueryResponse` cast pattern is preserved; we only tighten what XQueryResponse contains
- **Not deleting `apps/app/src/app/sitemap.ts`** — that's Phase 2.7 of the existing SEO plan
- **Not touching `LegalPostMeta`/`LegalPost`** — legal types are correct (not mixed with blog anymore); leave them manual
- **Not changing fragment field selections** — fragments stay identical; we're only changing how types are exported
- **Not touching `packages/cms-workflows/`** — publish scripts use `blog.getPost()` and `changelog.getEntryBySlug()` as existence checks; type derivation doesn't affect their logic

## Implementation Approach

Three phases, each independently typechecked:

1. **Phase 1** — vendor/cms boundary only. Remove legal fallback, drop explicit annotations, add derived type exports. No consumer changes. All consumers continue to compile (defensive patterns are valid TS on tighter types).
2. **Phase 2** — blog consumers. Remove fallbacks that are now dead code on required fields.
3. **Phase 3** — changelog and shared consumers. Same cleanup.

---

## Phase 1: Type Derivation at vendor/cms Boundary

### Overview

Single file: `vendor/cms/index.ts`. Three changes in one commit:
1. Remove the legal fallback from the three blog getter functions
2. Remove explicit return type annotations from all getters
3. Replace manual interface/type declarations with derived type aliases

### Changes Required

#### 1. Remove legal fallback helpers (lines 168–190)

**File**: `vendor/cms/index.ts`

Delete `mapLegalMetaToBlogMeta` and `mapLegalToBlogPost` entirely. These functions only exist to support the legal fallback.

```ts
// DELETE lines 168-190:
// const mapLegalMetaToBlogMeta = (item: LegalPostMeta): PostMeta => ({ ... })
// const mapLegalToBlogPost = (item: LegalPost): Post => ({ ... })
```

#### 2. Remove explicit return types + legal fallback from blog getters (lines 226–267)

**File**: `vendor/cms/index.ts`

```ts
// BEFORE:
getPosts: async (): Promise<PostMeta[]> => {
  try {
    const data = await basehub.query(blog.postsQuery);
    return data.blog.post.items;
  } catch {
    try {
      const fallback = await legal.getPosts();
      return fallback.map(mapLegalMetaToBlogMeta);
    } catch {
      return [];
    }
  }
},

getLatestPost: async (): Promise<Post | null> => {
  try {
    const data = await basehub.query(blog.latestPostQuery);
    return data.blog.post.item;
  } catch {
    try {
      const fallback = await legal.getLatestPost();
      return fallback ? mapLegalToBlogPost(fallback) : null;
    } catch {
      return null;
    }
  }
},

getPost: async (slug: string): Promise<Post | null> => {
  try {
    const query = blog.postQuery(slug);
    const data = await basehub.query(query);
    return data.blog.post.item;
  } catch {
    try {
      const fallback = await legal.getPost(slug);
      return fallback ? mapLegalToBlogPost(fallback) : null;
    } catch {
      return null;
    }
  }
},

// AFTER:
getPosts: async () => {
  try {
    const data = await basehub.query(blog.postsQuery);
    return data.blog.post.items;
  } catch {
    return [];
  }
},

getLatestPost: async () => {
  try {
    const data = await basehub.query(blog.latestPostQuery);
    return data.blog.post.item;
  } catch {
    return null;
  }
},

getPost: async (slug: string) => {
  try {
    const query = blog.postQuery(slug);
    const data = await basehub.query(query);
    return data.blog.post.item;
  } catch {
    return null;
  }
},
```

#### 3. Remove explicit return types from changelog getters (lines 561–625)

**File**: `vendor/cms/index.ts`

Same pattern — remove `: Promise<ChangelogEntry[]>`, `: Promise<ChangelogEntry | null>`, `: Promise<ChangelogAdjacentEntries>` annotations. Function bodies stay identical.

```ts
// Remove `: Promise<...>` annotations from:
getEntries: async () => { ... },
getLatestEntry: async () => { ... },
getEntry: async (slug: string) => { ... },
getEntryBySlug: async (slug: string) => { ... },
getAdjacentEntries: async (currentSlug: string) => { ... },
```

#### 4. Remove explicit return type from categories getter (line 53)

```ts
// BEFORE:
getCategories: async (): Promise<Category[]> => {

// AFTER:
getCategories: async () => {
```

#### 5. Replace manual type declarations with derived types

**File**: `vendor/cms/index.ts`

Delete the manually maintained interfaces/types and replace with derived aliases. The declarations can live in the same position in the file (after the `blog`, `changelog`, `categories` const objects since TypeScript hoists type declarations).

```ts
// DELETE: interface PostMeta { ... }     (lines 115-143)
// DELETE: type Post = PostMeta & { ... } (lines 145-166)
// DELETE: interface Category { ... }     (lines 36-42)
// DELETE: interface ChangelogEntryMeta { ... }  (lines 430-439)
// DELETE: type ChangelogEntry = ChangelogEntryMeta & { ... } (lines 441-476)
// DELETE: interface ChangelogEntryQueryResponse { ... }  (lines 478-484)
// DELETE: interface ChangelogEntriesQueryResponse { ... } (lines 486-492)
// DELETE: interface ChangelogAdjacentEntries { ... }     (lines 494-497)

// ADD in their place:

// Blog types — derived from fragment-backed query return types
export type PostMeta = Awaited<ReturnType<typeof blog["getPosts"]>>[number];
export type Post = NonNullable<Awaited<ReturnType<typeof blog["getPost"]>>>;

// Blog Feed response wrapper — exported for use in blog/[slug]/page.tsx Feed callback
// (replaces the local BlogPostQueryResponse defined in that file)
export type BlogPostQueryResponse = {
  blog: { post: { item: Post | null } };
};

// Category type — derived from fragment-backed query return type
export type Category = Awaited<
  ReturnType<typeof categories["getCategories"]>
>[number];

// Changelog types — derived from fragment-backed query return types
// ChangelogAdjacentEntries must be declared before ChangelogEntryMeta
// since ChangelogEntryMeta is derived from it
export type ChangelogAdjacentEntries = Awaited<
  ReturnType<typeof changelog["getAdjacentEntries"]>
>;
export type ChangelogEntryMeta = NonNullable<ChangelogAdjacentEntries["next"]>;
export type ChangelogEntry = Awaited<
  ReturnType<typeof changelog["getEntries"]>
>[number];

// Changelog Feed response wrappers — tightened to match actual query results
// (non-optional top-level since Feed only calls these on success)
export type ChangelogEntryQueryResponse = {
  changelog: { post: { item: ChangelogEntry | null } };
};
export type ChangelogEntriesQueryResponse = {
  changelog: { post: { items: ChangelogEntry[] } };
};
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @vendor/cms typecheck` passes — vendor layer internally consistent
- [x] `pnpm --filter @lightfast/www typecheck` passes — all consumers compile (defensive patterns on required fields are valid TS)
- [x] `pnpm check` passes — no lint errors (biome)

#### Manual Verification:
- [ ] `blog.getPosts()` returns data with correct types in TypeScript hover (VSCode/IDE shows `string` not `string | null | undefined` for `_title`)
- [ ] Legal content does NOT appear on the blog listing page — confirm by temporarily breaking BaseHub token and reloading `/blog` (should show empty state, not legal fallback content)

---

## Phase 2: Blog Consumer Cleanup

### Overview

Remove fallback chains on fields that are now required. Files: 5 blog-related files in `apps/www`.

### Changes Required

#### 1. `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`

**Remove local `BlogPostQueryResponse` and switch to vendor export:**

```ts
// BEFORE (lines 2-5, 18-24):
import type { Post } from "@vendor/cms";
import { blog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";

interface BlogPostQueryResponse {
  blog?: { post?: { item?: Post | null } | null } | null;
}

// AFTER:
import type { BlogPostQueryResponse, Post } from "@vendor/cms";
import { blog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
// (no local BlogPostQueryResponse interface)
```

**Simplify fallbacks on required fields:**

```ts
// generateStaticParams (~line 33):
// BEFORE: post.slug ?? post._slug ?? ""
// AFTER:  post.slug

// generateMetadata (~lines 56-62):
// BEFORE: post.description ?? post.body?.plainText?.slice(0, 160) ?? `${post._title} - Lightfast blog`
// AFTER:  post.description
// (description is required; body.plainText is a fallback that was never needed)

// BEFORE: post._title ?? undefined
// AFTER:  post._title

// BEFORE: post._title ?? "Blog Post"  (×2 occurrences)
// AFTER:  post._title

// BEFORE: author._title ?? undefined
// AFTER:  author._title

// BEFORE: author._title ?? ""
// AFTER:  author._title

// BEFORE: post.seo?.metaTitle ?? post._title ?? ""
// AFTER:  post.seo.metaTitle
// (seo is required, seo.metaTitle is required per SeoComponent_1)

// BEFORE: post.seo?.metaDescription ?? post.description ?? ""
// AFTER:  post.seo.metaDescription

// Keep with guard (still nullable):
// post.publishedAt — string | null, keep null guard
// post.featuredImage?.url — BlockImage | null, keep ?.
// author.xUrl — string | null, keep null guard

// Feed callback (~line 103):
// BEFORE: const response = data as BlogPostQueryResponse;
// AFTER:  const response = data as BlogPostQueryResponse;
// (same cast, but now BlogPostQueryResponse is imported from vendor with tighter types)
// BEFORE: const post = response.blog?.post?.item;
// AFTER:  const post = response.blog.post.item;

// In page body (various):
// BEFORE: post.authors?.map(a => a._title ?? "")
// AFTER:  post.authors.map(a => a._title)

// BEFORE: post.description ?? undefined  (×2)
// AFTER:  post.description

// BEFORE: post.featuredImage.alt ?? post._title ?? ""
// AFTER:  post.featuredImage.alt ?? post._title

// BEFORE: post.featuredImage.height ?? 630, post.featuredImage.width ?? 1200
// AFTER:  post.featuredImage.height, post.featuredImage.width
// (BlockImage.height/width are required in BaseHub)
```

#### 2. `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx`

```ts
// BEFORE (line 102, 103):
post.slug ?? post._slug   // ×2 in blogPosting URL and href construction
// AFTER:
post.slug

// BEFORE (line 157):
post._slug ?? post._title  // React key
// AFTER:
post._slug

// BEFORE (line 152):
post.categories?.[0]?._title
// AFTER:
post.categories[0]?._title
// (categories is required array — can be empty, so [0] still needs ?)
```

#### 3. `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/opengraph-image.tsx`

```ts
// BEFORE:
post._title ?? "Blog"
// AFTER:
post._title

// BEFORE:
post.description ?? undefined
// AFTER:
post.description

// BEFORE:
post.categories?.[0]?._title ?? undefined
// AFTER:
post.categories[0]?._title  // (undefined if empty, no ?? needed)

// BEFORE:
post.authors?.[0]?._title ?? undefined
// AFTER:
post.authors[0]?._title  // (undefined if empty)

// Keep: post.publishedAt guard (still nullable)
```

#### 4. `apps/www/src/app/(app)/_lib/feeds/generate-feed.ts`

```ts
// BEFORE:
post.slug ?? post._slug
// AFTER:
post.slug

// BEFORE:
post._title ?? "Untitled"
// AFTER:
post._title

// BEFORE:
post.description ?? "Read more on the Lightfast blog"
// AFTER:
post.description

// BEFORE:
post.categories ?? []
// AFTER:
post.categories

// BEFORE:
cat._title ?? "Uncategorized"
// AFTER:
cat._title

// BEFORE:
post.authors ?? []
// AFTER:
post.authors

// BEFORE:
author._title ?? "Lightfast Team"
// AFTER:
author._title

// Keep nullable guards:
// author.xUrl ?? undefined  (still nullable)
// post.featuredImage?.url ?? undefined  (still nullable)
// post.publishedAt  (still nullable — filter stays)
```

#### 5. `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/topic/[category]/page.tsx`

```ts
// BEFORE:
cat._slug?.toLowerCase()
// AFTER:
cat._slug.toLowerCase()
// (_slug is now required on Category)
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [ ] `/blog` listing page loads, posts render with correct titles/slugs
- [ ] `/blog/[slug]` post page loads with correct title, description, authors
- [ ] RSS feed route returns valid XML with correct post data
- [ ] Blog OG images render (check `/blog/[slug]/opengraph-image`)

---

## Phase 3: Changelog & Shared Consumer Cleanup

### Overview

Remove fallbacks on required fields in changelog pages, shared components, and sitemap. The most impactful change: `entry.publishedAt` is required on changelog (BaseHub `PostItem.publishedAt: string`, no null), eliminating the `?? entry._sys?.createdAt` fallback everywhere it appears (5 files).

### Changes Required

#### 1. `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

```ts
// Feed callback (~line 52):
// BEFORE:
const response = data as ChangelogEntriesQueryResponse;
const items = response.changelog?.post?.items ?? [];
// AFTER:
const response = data as ChangelogEntriesQueryResponse;
const items = response.changelog.post.items;

// BEFORE:
item.publishedAt ?? item._sys?.createdAt
// AFTER:
item.publishedAt
// (publishedAt is required string on PostItem — no null in BaseHub)

// BEFORE (React key):
item._slug ?? item._title
// AFTER:
item._slug
```

#### 2. `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

**`generateMetadata`:**
```ts
// BEFORE:
entry.seo?.metaTitle ?? entry._title ?? "Changelog"
// AFTER:
entry.seo.metaTitle ?? entry._title
// (seo is now required; seo.metaTitle is nullable on SeoComponent — keep ??)

// BEFORE:
entry.seo?.metaDescription ?? entry.excerpt ?? entry.tldr ?? entry.body?.plainText?.slice(0, 160) ?? `...`
// AFTER:
entry.seo.metaDescription ?? entry.excerpt ?? entry.tldr ?? entry.body?.plainText?.slice(0, 160) ?? entry._title
// (seo required; metaDescription nullable — keep ??)

// BEFORE:
entry.seo?.canonicalUrl ?? `https://...`
// AFTER:
entry.seo.canonicalUrl ?? `https://...`

// BEFORE:
entry.publishedAt ?? entry._sys?.createdAt
// AFTER:
entry.publishedAt

// BEFORE:
entry.seo?.noIndex ? { robots: { index: false } } : {}
// AFTER:
entry.seo.noIndex ? { robots: { index: false } } : {}
```

**Page body:**
```ts
// BEFORE:
entry.publishedAt ?? entry._sys?.createdAt
// AFTER:
entry.publishedAt

// BEFORE (5-level description fallback):
entry.seo?.metaDescription ?? entry.excerpt ?? entry.tldr ?? entry.body?.plainText?.slice(0, 160) ?? entry._title ?? "..."
// AFTER:
entry.seo.metaDescription ?? entry.excerpt ?? entry.tldr ?? entry.body?.plainText?.slice(0, 160) ?? entry._title

// BEFORE:
entry.seo?.faq?.items?.filter(...)
// AFTER:
entry.seo.faq.items.filter(...)
// (seo required; faq required on SeoComponent; items is required array)

// BEFORE (Feed callback):
const response = data as ChangelogEntryQueryResponse;
response.changelog?.post?.item
// AFTER:
const response = data as ChangelogEntryQueryResponse;
response.changelog.post.item

// Keep nullable guards:
// entry.seo.metaTitle (still nullable on SeoComponent)
// entry.seo.metaDescription (still nullable on SeoComponent)
// entry.featuredImage?.url (still nullable)
// entry.body?.plainText (still nullable on PostItem)
// entry.excerpt (still nullable)
// entry.slug (still nullable — changelog slug can be null)
```

#### 3. `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/opengraph-image.tsx`

```ts
// BEFORE:
entry._title ?? "Changelog"
// AFTER:
entry._title

// BEFORE:
entry.publishedAt ?? entry._sys?.createdAt
// AFTER:
entry.publishedAt

// Keep: entry.excerpt ?? undefined (still nullable)
```

#### 4. `apps/www/src/app/(app)/_components/changelog-preview.tsx`

```ts
// BEFORE:
response.changelog?.post?.items ?? []
// AFTER:
response.changelog.post.items

// BEFORE:
item.publishedAt ?? item._sys?.createdAt
// AFTER:
item.publishedAt

// BEFORE (React key):
item._slug ?? item._title
// AFTER:
item._slug
```

#### 5. `apps/www/src/app/(app)/_components/hero-changelog-badge.tsx`

```ts
// BEFORE:
response.changelog?.post?.items ?? []
// AFTER:
response.changelog.post.items

// BEFORE:
latest.publishedAt ?? latest._sys?.createdAt
// AFTER:
latest.publishedAt
```

#### 6. `apps/www/src/app/(app)/_lib/feeds/generate-changelog-feed.ts`

```ts
// BEFORE:
entry.slug ?? entry._slug
// AFTER:
entry.slug ?? entry._slug
// (changelog entry.slug IS nullable in BaseHub — keep this fallback)

// BEFORE:
entry.publishedAt ? ... : entry._sys?.createdAt ? ... : buildDate
// AFTER:
entry.publishedAt
// (publishedAt is required string — use directly as the date)
// The line now becomes simply: feed.addItem({ date: new Date(entry.publishedAt), ... })

// BEFORE:
entry._title ?? "Untitled"
// AFTER:
entry._title

// Keep nullable guards:
// entry.excerpt (nullable)
// entry.tldr (nullable)
// entry.body?.plainText (nullable)
// entry.featuredImage?.url (nullable)
```

#### 7. `apps/www/src/app/sitemap.ts`

**Blog section:**
```ts
// BEFORE filter predicate:
!!post.slug || !!post._slug
// AFTER (slug is required — but keep a guard for non-empty):
post.slug.length > 0
// Or remove the filter entirely since BaseHub guarantees a non-empty slug string

// BEFORE URL construction:
post.slug ?? post._slug ?? ""
// AFTER:
post.slug

// BEFORE _sys access:
post._sys?.lastModifiedAt
// AFTER:
post._sys.lastModifiedAt
// (_sys is required on PostItem_1; lastModifiedAt is required on BlockDocumentSys)
```

**Changelog section:**
```ts
// BEFORE lastModified fallback:
entry._sys?.lastModifiedAt ?? entry.publishedAt ?? entry._sys?.createdAt
// AFTER:
entry._sys.lastModifiedAt
// (both _sys and lastModifiedAt are required)
```

**Helper function `getMostRecentDate` (lines 56-82):**

This helper accepts an inline structural type `{ _sys?: ...; publishedAt?: ... }[]`. After type tightening, the actual array elements are more specific. Either:
- Update the parameter type to match (using `PostMeta | ChangelogEntry`)
- Or leave as-is since structural typing means the derived types are assignable to the inline type

The simplest fix: import `PostMeta` and `ChangelogEntry` from `@vendor/cms` and update the parameter type.

#### 8. `apps/app/src/app/sitemap.ts`

Apply identical changes as item 7 above. Note: this file is scheduled for deletion in the existing SEO plan's Phase 2.7 once microfrontend routing is confirmed. Apply the cleanup anyway — it keeps the two files consistent until deletion.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm --filter @lightfast/app typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [ ] `/changelog` listing loads with correct dates (from `publishedAt`, not `_sys.createdAt`)
- [ ] `/changelog/[slug]` page loads with correct metadata and page body
- [ ] Sitemap (`/sitemap.xml`) renders with correct slugs and `lastmod` dates
- [ ] Changelog RSS feed returns valid XML
- [ ] Changelog badge in hero shows correct latest entry date
- [ ] Changelog preview component on homepage/landing shows correct entries

---

## Testing Strategy

### Automated:
- `pnpm --filter @vendor/cms typecheck` — after Phase 1
- `pnpm --filter @lightfast/www typecheck` — after each phase
- `pnpm check` — after each phase

### Manual smoke test after Phase 1 (before any consumer changes):
Hover over `PostMeta` in an IDE. Verify `_title: string` (required, not `string | null | undefined`). Hover over `Post.seo`. Verify `seo.metaTitle: string` (required).

### Regression validation:
All routes that existed before this change must continue to work:
- `/blog` listing
- `/blog/[slug]` (each post)
- `/blog/topic/[category]`
- `/changelog`
- `/changelog/[slug]`
- `/sitemap.xml`
- `/blog/[slug]/opengraph-image`
- `/changelog/[slug]/opengraph-image`
- RSS feed routes

---

## Migration Notes

### Fields That Stay Nullable After Tightening

These were nullable in BaseHub and remain nullable in derived types — consumers keep their null guards:

| Field | Type | Reason |
|---|---|---|
| `PostMeta.publishedAt` | `string \| null` | `PostItem_1.publishedAt` is nullable |
| `PostMeta.featuredImage` | `BlockImage \| null` | `PostItem_1.featuredImage` is nullable |
| `Post.tldr` | `string \| null` | `PostItem_1.tldr` is nullable |
| `Post.seo.canonicalUrl` | `string \| null` | `SeoComponent_1.canonicalUrl` is nullable |
| `Post.seo.focusKeyword` | `string \| null` | `SeoComponent_1.focusKeyword` is nullable |
| `ChangelogEntry.slug` | `string \| null` | `PostItem.slug` is nullable — `entry.slug ?? entry._slug` stays |
| `ChangelogEntry.body` | `Body \| null` | `PostItem.body` is nullable |
| `ChangelogEntry.excerpt` | `string \| null` | `PostItem.excerpt` is nullable |
| `ChangelogEntry.seo.metaTitle` | `string \| null` | `SeoComponent.metaTitle` is nullable (changelog SEO is looser than blog SEO) |
| `ChangelogEntry.seo.metaDescription` | `string \| null` | `SeoComponent.metaDescription` is nullable |
| `ChangelogEntry.featuredImage` | `BlockImage \| null` | `PostItem.featuredImage` is nullable |

### Fields That Become Required

These were `string | null | undefined` in manual types but are required in BaseHub — the primary bug class we're fixing:

| Field | BaseHub type | Consumer fallbacks that become dead code |
|---|---|---|
| `PostMeta._title` | `string` | `?? "Untitled"`, `?? "Blog Post"`, `?? undefined` |
| `PostMeta._slug` | `string` | `?? post._title` (as React key) |
| `PostMeta.slug` | `string` | `?? post._slug ?? ""` (×5 consumers) |
| `PostMeta.description` | `string` | `?? body.plainText.slice(...)` (×3) |
| `PostMeta.authors` | `Author[]` | `?? []` guards |
| `PostMeta.categories` | `Category[]` | `?? []` guards, `?.` on array |
| `Post.seo` | object (required) | `?.` before every seo field |
| `Post.seo.metaTitle` | `string` | `?? post._title ?? ""` |
| `Post.seo.metaDescription` | `string` | `?? post.description ?? ""` |
| `ChangelogEntryMeta._title` | `string` | `?? "Untitled"` (2 files) |
| `ChangelogEntryMeta._slug` | `string` | `?? _title` (React key, 3 files) |
| `ChangelogEntryMeta.prefix` | `string` | `&&` conditional renders |
| `ChangelogEntry.publishedAt` | `string` | `?? _sys?.createdAt` (×5 consumers) |
| `ChangelogEntry.seo` | object (required) | `?.` before every seo field |

---

## References

- Research: `thoughts/shared/research/2026-03-21-vendor-cms-basehub-type-gaps.md`
- Related plan: `thoughts/shared/plans/2026-03-21-www-seo-maintainability.md` (Phase 2.7 deletes `apps/app/src/app/sitemap.ts`)
- BaseHub generated types: `vendor/cms/basehub-types.d.ts`
- Implementation file: `vendor/cms/index.ts`
