# CodeBlock/CodeEditor to SSRCodeBlock Migration Plan

## Overview

Migrate from client-side `CodeBlock` and `CodeEditor` components to server-side `SSRCodeBlock` using standard markdown code fences. This improves performance (no client-side JavaScript for syntax highlighting), SEO (content visible to crawlers), and maintainability (simpler markdown syntax).

## Current State Analysis

### Components to Delete
- `apps/docs/src/components/code-block.tsx` - Client-side ("use client") component with basic syntax highlighting
- `apps/docs/src/components/code-editor.tsx` - Client-side ("use client") component with more advanced styling

### Key Discoveries
- `apps/docs/mdx-components.tsx:102-140` - Already configured to use `SSRCodeBlock` for `pre` component override
- `packages/ui/src/components/ssr-code-block/index.tsx:1` - SSR implementation using Shiki exists and works
- 6 MDX files use `<CodeBlock>` component directly (all in `apps/docs/src/content/api/`)
- 2 MDX files use `<CodeEditor>` component (in `apps/docs/src/content/docs/get-started/`)
- 1 TSX file uses `CodeEditor` directly (`apps/docs/src/app/(docs)/docs/[[...slug]]/_components/developer-platform-landing.tsx`)

### Files to Migrate

**API docs using CodeBlock (6 files):**
| File | CodeBlock Usages |
|------|------------------|
| `apps/docs/src/content/api/authentication.mdx` | 10 |
| `apps/docs/src/content/api/contents.mdx` | 12 |
| `apps/docs/src/content/api/errors.mdx` | 15 |
| `apps/docs/src/content/api/findsimilar.mdx` | 10 |
| `apps/docs/src/content/api/sdks.mdx` | 22 |
| `apps/docs/src/content/api/search.mdx` | 9 |

**Get-started docs using CodeEditor (2 files):**
| File | CodeEditor Usages |
|------|-------------------|
| `apps/docs/src/content/docs/get-started/quickstart.mdx` | 2 |
| `apps/docs/src/content/docs/get-started/config.mdx` | ~11 |

**React component using CodeEditor (1 file):**
| File | Import |
|------|--------|
| `apps/docs/src/app/(docs)/docs/[[...slug]]/_components/developer-platform-landing.tsx` | Direct import |

## Desired End State

- All code blocks in MDX files use standard markdown triple-backtick syntax
- No more `<CodeBlock>` or `<CodeEditor>` component usage in MDX files
- `developer-platform-landing.tsx` uses `SSRCodeBlock` directly
- `code-block.tsx` and `code-editor.tsx` files deleted
- `mdx-components.tsx` cleaned up (no CodeBlock/CodeEditor imports/exports)
- All syntax highlighting happens server-side via Shiki

### Verification

After migration:
1. All code blocks render correctly with syntax highlighting
2. No client-side JavaScript for code highlighting (check bundle size)
3. Type checking passes
4. Build succeeds without errors

## What We're NOT Doing

- Changing the `SSRCodeBlock` component itself (it already works)
- Migrating code blocks in other apps (only `apps/docs`)
- Changing the visual appearance (should look the same or better)
- Adding new features to code blocks

## Implementation Approach

Migrate in phases to minimize risk:
1. First, migrate all MDX content files to use markdown syntax
2. Update the TSX component that imports CodeEditor directly
3. Remove unused imports from mdx-components.tsx
4. Delete the old component files
5. Verify and clean up

---

## Phase 1: Migrate API Documentation MDX Files

### Overview
Convert all CodeBlock usages in the 6 API documentation files to standard markdown code fences.

### Changes Required:

#### Pattern Transformation

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

#### Files to Modify:
1. `apps/docs/src/content/api/authentication.mdx` - Remove import, convert 10 CodeBlocks
2. `apps/docs/src/content/api/contents.mdx` - Remove import, convert 12 CodeBlocks
3. `apps/docs/src/content/api/errors.mdx` - Remove import, convert 15 CodeBlocks
4. `apps/docs/src/content/api/findsimilar.mdx` - Remove import, convert 10 CodeBlocks
5. `apps/docs/src/content/api/sdks.mdx` - Remove import, convert 22 CodeBlocks
6. `apps/docs/src/content/api/search.mdx` - Remove import, convert 9 CodeBlocks

### Success Criteria:

#### Automated Verification:
- [x] No grep results for `import.*CodeBlock.*from.*code-block` in content/api/
- [x] No grep results for `<CodeBlock` in content/api/
- [x] Type checking passes: `pnpm --filter @lightfast/docs typecheck`
- [x] Build succeeds: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Visit each API docs page and verify code blocks render correctly
- [ ] Syntax highlighting works for all languages (bash, typescript, json)
- [ ] Copy button works on code blocks
- [ ] Light/dark theme switching works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Migrate Get-Started Documentation MDX Files

### Overview
Convert all CodeEditor usages in the 2 get-started documentation files to standard markdown code fences.

### Changes Required:

#### Pattern Transformation

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

Note: The `showHeader` prop difference is acceptable - SSRCodeBlock shows header by default which is preferred.

#### Files to Modify:
1. `apps/docs/src/content/docs/get-started/quickstart.mdx` - Convert 2 CodeEditors
2. `apps/docs/src/content/docs/get-started/config.mdx` - Convert ~11 CodeEditors

### Success Criteria:

#### Automated Verification:
- [ ] No grep results for `<CodeEditor` in content/docs/get-started/
- [ ] Type checking passes: `pnpm --filter @lightfast/docs typecheck`
- [ ] Build succeeds: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Visit quickstart and config pages
- [ ] Verify YAML and bash code blocks render correctly
- [ ] Syntax highlighting is correct
- [ ] Copy functionality works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Update developer-platform-landing.tsx

### Overview
Update the React component to use `SSRCodeBlock` instead of `CodeEditor`.

### Changes Required:

**File**: `apps/docs/src/app/(docs)/docs/[[...slug]]/_components/developer-platform-landing.tsx`

**Current code (line 1):**
```tsx
import { CodeEditor } from "@/src/components/code-editor";
```

**New code:**
```tsx
import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
```

**Current usage (lines 70-74):**
```tsx
<CodeEditor
  code={lightfastConfig}
  language="yaml"
  className="border-border"
/>
```

**New usage:**
```tsx
<SSRCodeBlock language="yaml" className="border-border">
  {lightfastConfig}
</SSRCodeBlock>
```

Note: The `code` prop becomes children in SSRCodeBlock.

### Success Criteria:

#### Automated Verification:
- [ ] No grep results for `CodeEditor` in developer-platform-landing.tsx
- [ ] Type checking passes: `pnpm --filter @lightfast/docs typecheck`
- [ ] Build succeeds: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Visit the docs landing page
- [ ] YAML configuration code block renders correctly
- [ ] Syntax highlighting works
- [ ] Component layout is preserved

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Clean Up mdx-components.tsx

### Overview
Remove unused CodeBlock and CodeEditor imports and exports from mdx-components.tsx.

### Changes Required:

**File**: `apps/docs/mdx-components.tsx`

**Remove line 19:**
```tsx
import { CodeBlock } from "@/src/components/code-block";
```

**Remove line 24:**
```tsx
import { CodeEditor as CodeEditorBase } from "@/src/components/code-editor";
```

**Remove line 397:**
```tsx
CodeBlock,
```

**Remove lines 469-493 (entire CodeEditor wrapper):**
```tsx
// CodeEditor with consistent spacing
CodeEditor({
  code,
  language,
  className,
  showHeader,
  ...props
}: {
  code: string;
  language: string;
  className?: string;
  showHeader?: boolean;
}) {
  return (
    <div className="my-10">
      <CodeEditorBase
        code={code}
        language={language}
        className={className}
        showHeader={showHeader}
        {...props}
      />
    </div>
  );
},
```

### Success Criteria:

#### Automated Verification:
- [ ] No grep results for `CodeBlock` import in mdx-components.tsx
- [ ] No grep results for `CodeEditor` import in mdx-components.tsx
- [ ] Type checking passes: `pnpm --filter @lightfast/docs typecheck`
- [ ] Build succeeds: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] All previously working pages still render correctly
- [ ] No console errors related to missing components

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Delete Old Component Files

### Overview
Remove the now-unused client-side code block components.

### Changes Required:

Delete these files:
1. `apps/docs/src/components/code-block.tsx`
2. `apps/docs/src/components/code-editor.tsx`

### Success Criteria:

#### Automated Verification:
- [ ] Files no longer exist: `ls apps/docs/src/components/code-block.tsx` returns error
- [ ] Files no longer exist: `ls apps/docs/src/components/code-editor.tsx` returns error
- [ ] No grep results for `code-block` or `code-editor` imports in apps/docs/
- [ ] Type checking passes: `pnpm --filter @lightfast/docs typecheck`
- [ ] Build succeeds: `pnpm --filter @lightfast/docs build`

#### Manual Verification:
- [ ] Full site smoke test - visit key pages
- [ ] All code blocks render with syntax highlighting
- [ ] Copy buttons work
- [ ] Theme switching works

---

## Testing Strategy

### Automated Tests:
- Type checking: `pnpm --filter @lightfast/docs typecheck`
- Build verification: `pnpm --filter @lightfast/docs build`
- Grep verification for remaining usages

### Manual Testing Steps:
1. Start dev server: `pnpm dev:docs`
2. Visit API documentation pages:
   - `/api/authentication`
   - `/api/contents`
   - `/api/errors`
   - `/api/findsimilar`
   - `/api/sdks`
   - `/api/search`
3. Visit get-started pages:
   - `/docs/get-started/quickstart`
   - `/docs/get-started/config`
4. Visit docs landing page (for developer-platform-landing.tsx)
5. For each page, verify:
   - Code blocks render with correct syntax highlighting
   - Language label is shown
   - Copy button works
   - Light/dark theme both work
   - Line numbers display correctly

## Performance Considerations

This migration should improve performance:
- **Reduced JavaScript bundle**: Client-side syntax highlighting code removed
- **Faster initial render**: No hydration needed for code blocks
- **Better SEO**: Code content visible to crawlers immediately
- **Simpler maintenance**: Standard markdown is more portable

## Migration Notes

### Content Transformation Rules:
1. Remove all `import { CodeBlock } from '@/src/components/code-block';` lines
2. Replace `<CodeBlock language="X">{\`code\`}</CodeBlock>` with triple-backtick blocks
3. Replace `<CodeEditor code={\`code\`} language="X" />` with triple-backtick blocks
4. Preserve exact whitespace in code content
5. Keep any surrounding MDX/JSX structure intact

### Edge Cases to Watch:
- Multi-line code with template literals containing backticks
- Code blocks with special characters that need escaping
- Inline code vs block code (only block code changes)

## References

- Research document: `thoughts/shared/research/2025-12-18-code-block-migration-to-ssr.md`
- SSRCodeBlock implementation: `packages/ui/src/components/ssr-code-block/index.tsx`
- MDX components config: `apps/docs/mdx-components.tsx:102-140`
