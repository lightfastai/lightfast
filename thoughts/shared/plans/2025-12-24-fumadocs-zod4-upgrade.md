# Fumadocs Upgrade and Zod v4 Migration Implementation Plan

## Overview

Upgrade apps/docs from fumadocs v15/v11 to v16/v14 and migrate from Zod v3 to v4. This enables using `frontmatterSchema.extend()` pattern instead of the current workaround of manually defining the full schema.

## Current State Analysis

### Package Versions (apps/docs/package.json)
| Package | Current | Target |
|---------|---------|--------|
| fumadocs-core | 15.6.9 | 16.3.2 |
| fumadocs-mdx | 11.7.4 | 14.2.2 |
| fumadocs-openapi | 9.6.4 | 10.2.1 |
| fumadocs-ui | 15.6.9 | 16.3.2 |
| zod | catalog:zod3 | catalog:zod4 |

### Key Discoveries

1. **Import changes required** (from codebase research):
   - `apps/docs/src/app/layout.tsx:6` - `fumadocs-ui/provider` → `fumadocs-ui/provider/next`
   - `apps/docs/src/lib/source.ts:3` - `fumadocs-mdx` → `fumadocs-mdx/runtime/next` for `createMDXSource`
   - `fumadocs-core/server` type imports (PageTree, TOCItemType) - need verification

2. **OpenAPI v10 migration** (`apps/docs/src/lib/openapi.ts`):
   - No `name.algorithm` configured currently
   - Must add `name: { algorithm: 'v1' }` to preserve existing file paths

3. **source.config.ts workaround** (`apps/docs/source.config.ts:27-55`):
   - Currently manually defines full schema (15+ fields)
   - Can be simplified to `frontmatterSchema.extend()` after upgrade

## Desired End State

After this plan is complete:
1. All fumadocs packages upgraded to v16/v14/v10
2. apps/docs using Zod v4 via `catalog:zod4`
3. `source.config.ts` uses clean `frontmatterSchema.extend()` pattern
4. All imports updated to new locations
5. Build and typecheck pass
6. Docs site renders correctly

### Verification
```bash
pnpm --filter @lightfast/docs build
pnpm --filter @lightfast/docs typecheck
```

## What We're NOT Doing

- Upgrading Zod v4 in other apps (blocked by drizzle-zod)
- Changing existing MDX frontmatter content
- Regenerating OpenAPI docs (file paths preserved with v1 algorithm)
- Modifying any component behavior

## Implementation Approach

Single-phase upgrade since all changes are interconnected. The upgrade must happen atomically because:
- fumadocs-mdx v14 requires Zod v4
- Import paths change together with package versions
- Schema extension only works with Zod v4

---

## Phase 1: Complete Fumadocs + Zod v4 Upgrade

### Overview
Upgrade all packages and update all affected imports/configurations in one atomic change.

### Changes Required

#### 1. Update package.json
**File**: `apps/docs/package.json`

Update dependencies:
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

#### 2. Update RootProvider import
**File**: `apps/docs/src/app/layout.tsx`

**Line 6** - Change:
```typescript
// Before
import { RootProvider } from "fumadocs-ui/provider";

// After
import { RootProvider } from "fumadocs-ui/provider/next";
```

#### 3. Update createMDXSource import
**File**: `apps/docs/src/lib/source.ts`

**Line 3** - Change:
```typescript
// Before
import { createMDXSource } from "fumadocs-mdx";

// After
import { createMDXSource } from "fumadocs-mdx/runtime/next";
```

#### 4. Add OpenAPI v1 algorithm
**File**: `apps/docs/src/lib/openapi.ts`

Change to preserve existing file paths:
```typescript
import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
  input: ["./openapi.json"],
  name: { algorithm: "v1" },
});
```

#### 5. Simplify source.config.ts with frontmatterSchema.extend()
**File**: `apps/docs/source.config.ts`

Replace manual schema definition with extension pattern:
```typescript
import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

/**
 * Extended frontmatter schema with SEO fields.
 * Base fields (title, description, icon, full, _openapi) inherited from fumadocs.
 *
 * These fields allow per-page SEO customization in MDX files:
 *
 * ```yaml
 * ---
 * title: MCP Server
 * description: Connect AI assistants via Model Context Protocol
 * keywords: MCP, Model Context Protocol, AI assistants, Claude, Cursor
 * ogTitle: Lightfast MCP Server - Connect AI to Your Knowledge
 * ogDescription: Enable Claude, Cursor, and Codex to search your workspace
 * ogImage: /og/docs-mcp.png
 * author: Lightfast Team
 * publishedAt: 2024-12-01
 * updatedAt: 2024-12-24
 * ---
 * ```
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
  docs: {
    schema: docsSchema,
  },
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
  docs: {
    schema: docsSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // Disable fumadocs' built-in Shiki code highlighting
    // to preserve language-* className for custom SSRCodeBlock
    rehypeCodeOptions: false,
  },
});
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter @lightfast/docs typecheck` passes
- [ ] `pnpm --filter @lightfast/docs build` passes
- [ ] `pnpm --filter @lightfast/docs lint` passes

#### Manual Verification:
- [ ] Run `pnpm dev:docs` and verify docs site renders correctly
- [ ] Navigate to multiple doc pages to verify content loads
- [ ] Verify OpenAPI/API reference pages render correctly
- [ ] Check that TOC (table of contents) displays properly
- [ ] Verify sidebar navigation works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Potential Issues & Mitigations

### 1. Type Import Location Changes
The research found imports from `fumadocs-core/server`:
- `PageTree` type (3 files)
- `TOCItemType` type (2 files)

**Mitigation**: These are type-only imports. If the build fails, check fumadocs v16 changelog for new locations. Likely candidates:
- `fumadocs-core/source` for PageTree
- `fumadocs-core/toc` for TOCItemType

### 2. Zod v4 Syntax Differences
Most Zod v3 patterns work in v4. The current schema uses standard patterns that are compatible.

**Potential issue**: If any Zod error messages use `{ message: "..." }`, they need to change to `{ error: "..." }`. Current schema doesn't use custom messages.

### 3. Build Cache Issues
After major version upgrades, stale cache can cause issues.

**Mitigation**: If build fails with strange errors, run:
```bash
pnpm --filter @lightfast/docs clean
pnpm install
pnpm --filter @lightfast/docs build
```

---

## Testing Strategy

### Unit Tests
- N/A (no custom logic being added)

### Integration Tests
- Build verification covers MDX compilation with new schema

### Manual Testing Steps
1. Start dev server: `pnpm dev:docs`
2. Navigate to `/docs` - verify landing page
3. Navigate to a specific doc page - verify content and TOC
4. Navigate to `/docs/api-reference` - verify OpenAPI docs
5. Check browser console for errors
6. Test sidebar expand/collapse

---

## References

- Original research: `thoughts/shared/research/2025-12-24-fumadocs-zod4-upgrade.md`
- Zod v4 breaking changes: `thoughts/shared/research/2025-12-24-zod-v4-migration-breaking-changes.md`
- Fumadocs SEO research: `thoughts/shared/research/2025-12-24-web-analysis-fumadocs-seo-optimization.md`
- Fumadocs v16 changelog: https://fumadocs.vercel.app/docs/changelog
