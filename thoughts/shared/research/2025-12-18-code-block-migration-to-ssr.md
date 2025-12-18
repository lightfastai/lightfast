---
date: 2025-12-18T03:27:11Z
researcher: Claude
git_commit: 49070f33d86e785c031370b87dd3b61432481ee5
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Migration from CodeBlock/CodeEditor to SSRCodeBlock"
tags: [research, codebase, code-block, ssr, migration, docs]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: Migration from CodeBlock/CodeEditor to SSRCodeBlock

**Date**: 2025-12-18T03:27:11Z
**Researcher**: Claude
**Git Commit**: 49070f33d86e785c031370b87dd3b61432481ee5
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Document the current state of CodeBlock and CodeEditor component usage in apps/docs to enable migration to SSRCodeBlock using standard markdown code fences.

## Summary

The codebase has two client-side code block components (`CodeBlock` and `CodeEditor`) in `apps/docs/src/components/` that can be deleted. The `mdx-components.tsx` already has `SSRCodeBlock` configured to handle standard markdown code fences (```language), meaning all MDX content files can be updated to use traditional markdown syntax instead of explicit component usage.

## Detailed Findings

### Components to Delete

| Component | Location | Type |
|-----------|----------|------|
| `CodeBlock` | `apps/docs/src/components/code-block.tsx` | Client-side ("use client") |
| `CodeEditor` | `apps/docs/src/components/code-editor.tsx` | Client-side ("use client") |

### MDX Components Configuration

`apps/docs/mdx-components.tsx` already properly configured:

- **Line 9**: Imports `SSRCodeBlock` from `@repo/ui/components/ssr-code-block`
- **Lines 102-140**: The `pre` component uses `SSRCodeBlock` for syntax highlighting

This means standard markdown code fences are already handled by SSR syntax highlighting.

### Files Using CodeBlock Component (6 files)

All in `apps/docs/src/content/api/`:

| File | CodeBlock Usages |
|------|------------------|
| `authentication.mdx` | 10 |
| `contents.mdx` | 12 |
| `errors.mdx` | 15 |
| `findsimilar.mdx` | 10 |
| `sdks.mdx` | 22 |
| `search.mdx` | 9 |

**Current pattern:**
```jsx
import { CodeBlock } from '@/src/components/code-block';

<CodeBlock language="bash">
{`curl -X POST https://example.com/api`}
</CodeBlock>
```

**Target pattern:**
```markdown
```bash
curl -X POST https://example.com/api
```
```

### Files Using CodeEditor Component (2 MDX + 1 TSX)

**MDX Files** in `apps/docs/src/content/docs/get-started/`:

| File | CodeEditor Usages |
|------|-------------------|
| `quickstart.mdx` | 2 |
| `config.mdx` | 11 |

**TSX File** (special case):
- `apps/docs/src/app/(docs)/docs/[[...slug]]/_components/developer-platform-landing.tsx` - 1 usage

**Current pattern:**
```jsx
<CodeEditor
  code={`code here`}
  language="yaml"
  showHeader={false}
/>
```

**Target pattern:**
```markdown
```yaml
code here
```
```

### Special Case: developer-platform-landing.tsx

This React component directly imports `CodeEditor`. It needs to be updated to use `SSRCodeBlock` directly:

```tsx
import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";

// In the component:
<SSRCodeBlock language="yaml" showHeader={true}>
  {lightfastConfig}
</SSRCodeBlock>
```

### MDX Components to Remove

In `apps/docs/mdx-components.tsx`:

1. **Line 19**: Remove `import { CodeBlock } from "@/src/components/code-block";`
2. **Line 24**: Remove `import { CodeEditor as CodeEditorBase } from "@/src/components/code-editor";`
3. **Line 397**: Remove `CodeBlock,` from exports
4. **Lines 470-493**: Remove entire `CodeEditor` component wrapper

### Content Files Summary

| Directory | Total MDX Files | Files Needing Update |
|-----------|-----------------|----------------------|
| `apps/docs/src/content/api/` | 7 | 6 |
| `apps/docs/src/content/docs/get-started/` | 3 | 2 |
| `apps/docs/src/content/docs/features/` | 7 | 0 |
| `apps/docs/src/content/docs/integrate/` | 3 | 0 |
| `apps/docs/src/content/docs/` | 1 | 0 |
| **Total** | **21** | **8** |

### Other Usages (Not in docs content)

These usages are in other parts of the codebase and are NOT affected by this migration:

| File | Import |
|------|--------|
| `apps/chat/src/components/artifacts/code-editor.tsx` | Type import only from `@repo/ui` |
| `vendor/cms/components/body.tsx` | Uses `CMSCodeBlock` from `@repo/ui` |

## Code References

- `apps/docs/src/components/code-block.tsx:1` - Component to delete
- `apps/docs/src/components/code-editor.tsx:1` - Component to delete
- `apps/docs/mdx-components.tsx:9` - SSRCodeBlock already imported
- `apps/docs/mdx-components.tsx:102-140` - Pre component using SSRCodeBlock
- `packages/ui/src/components/ssr-code-block/index.tsx:1` - New SSR implementation

## Architecture Documentation

The SSR code block implementation:
1. Uses Shiki for syntax highlighting at build/server time
2. Generates both light and dark theme variants
3. Uses CSS classes to show/hide based on theme
4. Includes line numbers and copy button
5. Already integrated into MDX via the `pre` component override

## Migration Steps

1. Delete `apps/docs/src/components/code-block.tsx`
2. Delete `apps/docs/src/components/code-editor.tsx`
3. Update `apps/docs/mdx-components.tsx` to remove CodeBlock/CodeEditor imports and exports
4. Update `apps/docs/src/app/(docs)/docs/[[...slug]]/_components/developer-platform-landing.tsx` to use SSRCodeBlock
5. Update 8 MDX files to use standard markdown code fences instead of component syntax

## Open Questions

None - the migration path is clear.
