---
date: 2025-12-24T14:30:00+08:00
researcher: Claude
git_commit: 69fae218c2ac204bacadcc5c25bbb9abd8b0a5da
branch: feat/docs-seo-frontmatter
repository: lightfast
topic: "Fumadocs Upgrade and Zod v4 Migration for apps/docs"
tags: [research, fumadocs, zod, upgrade, docs, seo, frontmatter]
status: complete
last_updated: 2025-12-24
last_updated_by: Claude
---

# Research: Fumadocs Upgrade and Zod v4 Migration for apps/docs

**Date**: 2025-12-24T14:30:00+08:00
**Researcher**: Claude
**Git Commit**: 69fae218c2ac204bacadcc5c25bbb9abd8b0a5da
**Branch**: feat/docs-seo-frontmatter
**Repository**: lightfast

## Research Question

How to upgrade @apps/docs fumadocs packages to latest versions and migrate to Zod v4, then update source.config.ts to properly extend fumadocs frontmatterSchema.

## Summary

**Key Finding**: fumadocs-mdx v14+ uses **Zod v4.2.1 internally**. This means:
1. apps/docs CAN use `catalog:zod4` since it doesn't have drizzle-zod dependency
2. The current workaround (redefining full schema) is unnecessary
3. We can import and extend `frontmatterSchema` directly

---

## Current State

### Package Versions (apps/docs/package.json)
```json
{
  "fumadocs-core": "15.6.9",
  "fumadocs-mdx": "11.7.4",
  "fumadocs-openapi": "^9.6.4",
  "fumadocs-ui": "15.6.9",
  "zod": "catalog:zod3"
}
```

### source.config.ts Current Implementation
```typescript
// Manually defines full schema due to Zod version mismatch concern
const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  // ... all fields manually defined
});
```

---

## Latest Versions (as of 2025-12-24)

| Package | Current | Latest | Upgrade |
|---------|---------|--------|---------|
| fumadocs-core | 15.6.9 | **16.3.2** | Major (v16) |
| fumadocs-mdx | 11.7.4 | **14.2.2** | Major (v14) |
| fumadocs-openapi | 9.6.4 | **10.2.1** | Major (v10) |
| fumadocs-ui | 15.6.9 | **16.3.2** | Major (v16) |

### Zod Dependency in fumadocs-mdx@latest
```json
// npm view fumadocs-mdx@latest dependencies
{
  "zod": "^4.2.1"
}
```

---

## Breaking Changes to Address

### fumadocs-mdx v11 → v14

1. **Zod v4 Requirement**: fumadocs-mdx now requires Zod v4
2. **Schema extension**: Use `frontmatterSchema.extend()` pattern
3. **Runtime imports**: `createMDXSource` moved to `fumadocs-mdx/runtime/next`

### fumadocs-core/ui v15 → v16

1. **React 19.2+ required** (apps/docs already uses 19.2.1 ✓)
2. **Provider import**: `fumadocs-ui/provider` → `fumadocs-ui/provider/next`
3. **Removed exports from `fumadocs-core/server`**:
   - `getGithubLastEdit` → `fumadocs-core/content/github`
   - `getTableOfContents` → `fumadocs-core/content/toc`
4. **Shiki**: Default switch to JavaScript Regex Engine

### fumadocs-openapi v9 → v10

1. Changed file path generation algorithm
2. `index.mdx` no longer auto-generated
3. Set `name: { algorithm: 'v1' }` to maintain old behavior

---

## Upgrade Plan

### Step 1: Update package.json

```json
{
  "dependencies": {
    "fumadocs-core": "16.3.2",
    "fumadocs-mdx": "14.2.2",
    "fumadocs-openapi": "^10.2.1",
    "fumadocs-ui": "16.3.2",
    "zod": "catalog:zod4"
  }
}
```

### Step 2: Update source.config.ts

**Before (current):**
```typescript
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

// Manually defined full schema
const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  // ... 15+ fields manually defined
});

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  docs: { schema: docsSchema },
});
```

**After (upgraded):**
```typescript
import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

/**
 * Extended frontmatter schema with SEO fields.
 * Base fields (title, description, icon, full, _openapi) inherited from fumadocs.
 */
const docsSchema = frontmatterSchema.extend({
  // SEO meta fields
  keywords: z.string().optional(),
  canonical: z.string().optional(),

  // OpenGraph overrides
  ogImage: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),

  // Indexing controls
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),

  // Article metadata for structured data
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),

  // TechArticle-specific fields
  proficiencyLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
});

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
  docs: { schema: docsSchema },
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
  docs: { schema: docsSchema },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
  },
});
```

### Step 3: Check for Import Changes

Search for and update any affected imports:
- `fumadocs-ui/provider` → `fumadocs-ui/provider/next`
- `fumadocs-core/server` utilities → new locations

---

## Why apps/docs Can Use Zod v4

From `thoughts/shared/research/2025-12-24-zod-v4-migration-breaking-changes.md`:

> **CRITICAL BLOCKER**: The codebase cannot migrate to Zod v4 yet due to **drizzle-zod lacking v4 support**.

However, `apps/docs`:
1. Does NOT use drizzle-zod
2. Does NOT use MCP SDK
3. Has isolated dependencies from main app

The Zod v4 blocker affects `db/chat/` and main apps, but NOT the docs app.

---

## Zod v4 Syntax Changes (if needed)

Most Zod v3 patterns work in v4, but these may need attention:

```typescript
// Error messages (rare pattern, unlikely in docs)
// v3: z.string().min(5, { message: "..." })
// v4: z.string().min(5, { error: "..." })

// Email/URL validators (if used)
// v3: z.string().email()
// v4: z.email() - but .email() still works
```

---

## Testing Checklist

After upgrade:

1. [ ] `pnpm install` succeeds
2. [ ] `pnpm --filter @lightfast/docs build` passes
3. [ ] `pnpm --filter @lightfast/docs typecheck` passes
4. [ ] Docs site renders correctly locally
5. [ ] Frontmatter validation works with new SEO fields
6. [ ] OpenAPI docs generate correctly

---

## Code References

- `apps/docs/package.json` - Package versions
- `apps/docs/source.config.ts` - Frontmatter schema definition
- `pnpm-workspace.yaml:68-71` - Zod catalog definitions

---

## Related Research

- `thoughts/shared/research/2025-12-24-zod-v4-migration-breaking-changes.md` - Full Zod v4 analysis
- `thoughts/shared/research/2025-12-24-web-analysis-fumadocs-seo-optimization.md` - SEO field requirements
