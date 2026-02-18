---
date: 2026-02-18T00:00:00+11:00
researcher: jeevan
git_commit: 143fb6da40b205ab94a57a0cfb227d2b2bbba143
branch: main
repository: lightfast
topic: "Docs frontmatter enforcement and structured data headline fallbacks"
tags: [research, docs, seo, frontmatter, structured-data, fumadocs]
status: complete
last_updated: 2026-02-18
last_updated_by: jeevan
---

# Research: Docs Frontmatter Enforcement and Structured Data Headline Fallbacks

**Date**: 2026-02-18
**Researcher**: jeevan
**Git Commit**: 143fb6da40b205ab94a57a0cfb227d2b2bbba143
**Branch**: main
**Repository**: lightfast

## Research Question

Two specific structured-data bugs were flagged and a long-term solution requested:

1. **General docs page** (`(general)/[[...slug]]/page.tsx` ~line 139): `headline: title` could be `undefined` — needs a string fallback.
2. **API reference page** (`(api)/api-reference/[[...slug]]/page.tsx` lines 101 & 202): `headline: title || "API Reference"` uses `||` inconsistently with how `title` is declared using `??`; both should use `??`.
3. **Long-term**: Enforce required frontmatter fields (at minimum `description`) so that the build fails if a new docs page is added without them.

## Summary

All three issues were verified against the live code and fixed. All 17 existing `.mdx` content files already carry both `title` and `description` in their frontmatter, so the schema enforcement change is safe and purely protective for future files.

## Detailed Findings

### Finding 1 — General docs page: undefined headline

**File**: `apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx`

`title` is extracted from `frontmatter.title` (line 78):
```ts
const title = frontmatter.title;
```

`frontmatter` is typed as `ExtendedFrontmatter` (lines 21-41) where `title?: string` — i.e. explicitly optional.

The `TechArticle` structured-data object (lines 136–159) previously set:
```ts
headline: title,          // could be undefined → invalid schema.org TechArticle
```

**Fix applied** (`page.tsx:139`):
```ts
headline: title ?? "Documentation",
```

### Finding 2 — API reference page: inconsistent `||` vs `??`

**File**: `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`

Two `Article` structured-data objects exist — one for OpenAPI virtual pages (line ~101) and one for MDX pages (line ~202). Both previously used:
```ts
headline: title || "API Reference",
```

The OpenAPI branch declares `title` with `??` (line 43):
```ts
const title = page.data.title ?? "API Reference";
```

Using `||` on a value already guaranteed non-empty by `??` is harmless but inconsistent. For the MDX branch `title` has no default (`const title = pageData.title`), making `||` semantically different from `??` (would swallow empty strings).

**Fix applied** at both occurrences:
```ts
headline: title ?? "API Reference",
```

### Finding 3 — Long-term: frontmatter schema enforcement

**File**: `apps/docs/source.config.ts`

The schema is built by extending fumadocs-mdx's `frontmatterSchema`:
```ts
const docsSchema = frontmatterSchema.extend({ ... });
```

The base `frontmatterSchema` requires `title`. `description` was not declared in the extended schema, meaning it fell through as whatever the base defines (optional). No Zod-level enforcement prevented a new page from omitting `description`.

**Fix applied** — `description` added as the first field in the extension, overriding any optional base definition:
```ts
description: z.string().min(1),
```

Both collections (`docs` and `apiDocs`) share `docsSchema`, so enforcement applies uniformly.

**Frontmatter audit result** (all 17 content files):

| File | Has title | Has description |
|------|-----------|-----------------|
| `docs/features/citations.mdx` | ✓ | ✓ |
| `docs/features/index.mdx` | ✓ | ✓ |
| `docs/features/memory.mdx` | ✓ | ✓ |
| `docs/features/quality.mdx` | ✓ | ✓ |
| `docs/features/relationships.mdx` | ✓ | ✓ |
| `docs/features/search.mdx` | ✓ | ✓ |
| `docs/features/security.mdx` | ✓ | ✓ |
| `docs/get-started/config.mdx` | ✓ | ✓ |
| `docs/get-started/overview.mdx` | ✓ | ✓ |
| `docs/get-started/quickstart.mdx` | ✓ | ✓ |
| `docs/integrate/mcp.mdx` | ✓ | ✓ |
| `docs/integrate/sdk.mdx` | ✓ | ✓ |
| `api/getting-started/authentication.mdx` | ✓ | ✓ |
| `api/getting-started/errors.mdx` | ✓ | ✓ |
| `api/getting-started/overview.mdx` | ✓ | ✓ |
| `api/sdks-tools/mcp-server.mdx` | ✓ | ✓ |
| `api/sdks-tools/typescript-sdk.mdx` | ✓ | ✓ |

No file needed updating — all had `description` already.

## Code References

- `apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx:139` — `headline: title ?? "Documentation"` (was `headline: title`)
- `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:101` — `headline: title ?? "API Reference"` (was `|| `)
- `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:202` — `headline: title ?? "API Reference"` (was `|| `)
- `apps/docs/source.config.ts:29` — `description: z.string().min(1)` (new required field)
- `apps/docs/src/lib/source.ts` — loader setup; `docsSource` and `apiSource` both consume `docsSchema`

## Architecture Documentation

- **Schema enforcement**: `source.config.ts` uses a single `docsSchema` applied to both `docs` and `apiDocs` collections via `defineDocs`. Adding a required field here gates both the general docs tree and the API reference tree at build time (fumadocs-mdx/Zod validation runs during `next build` / `fumadocs-mdx` code-gen).
- **Structured data pattern**: Both page routes build a `@graph` containing `Organization`, `WebSite`, `BreadcrumbList`, and an article entity (`TechArticle` for general, `Article` for API). The `headline` property maps from the page's frontmatter `title`.
- **Operator semantics**: `??` (nullish coalescing) only falls back on `null | undefined`; `||` also falls back on `""`, `0`, `false`. For string fields that might be empty, `??` preserves intentional empty strings while `||` would silently override them.

## Open Questions

- Should `title` also be enforced via `z.string().min(1)` in `docsSchema`? The base `frontmatterSchema` from fumadocs requires it, but the min-length constraint is not explicit. Low priority since fumadocs would error at a different layer first.
- The MDX branch of the API route declares `const title = pageData.title` with no fallback (line 144). A corresponding `?? "API Reference"` on the variable declaration (not just the headline property) would make it fully consistent with the OpenAPI branch — a minor follow-up.
