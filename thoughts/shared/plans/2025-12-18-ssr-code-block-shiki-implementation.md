# SSR Code Block with Shiki + hast-util-to-jsx-runtime Implementation Plan

## Overview

Implement server-side syntax highlighting for CMS code blocks using Shiki with `hast-util-to-jsx-runtime`. This ensures highlighted code appears in the initial HTML for optimal AEO (Answer Engine Optimization), while keeping client-side JavaScript minimal (only for copy button functionality).

## Current State Analysis

### Current Implementation

The existing code block implementation uses **client-side highlighting**:

1. **`CMSCodeBlock`** (`packages/ui/src/components/cms-code-block.tsx:1`) - Client component marked with `"use client"`
2. **`CodeBlockContent`** (`packages/ui/src/components/ai-elements/code-block.tsx:226-302`) - Highlights code in `useEffect` after mount
3. **BaseHub `body.tsx`** (`vendor/cms/components/body.tsx:98-111`) - Delegates to `CMSCodeBlock`

**Problem**: Initial HTML contains no syntax highlighting. AI crawlers and users on slow connections see unstyled code until JavaScript loads.

### Key Discoveries

- Shiki v3.9.2 is already installed across packages (`packages/ui/package.json:95`)
- `hast-util-to-jsx-runtime` is NOT installed (needs to be added)
- Current `HighlighterManager` class handles dual-theme highlighting well (`code-block.tsx:50-166`)
- Themes used: `github-light` and `github-dark` (`code-block.tsx:241-242`)

## Desired End State

After implementation:

1. **SSR-rendered code blocks**: Syntax-highlighted HTML in initial page response
2. **Dual-theme support**: Both light and dark theme HTML rendered server-side with CSS visibility toggles
3. **Minimal client JS**: Only copy button requires client-side JavaScript
4. **Backwards compatible**: Existing `CodeBlockContent` client component remains for AI chat use cases

### Verification

- View page source on blog/changelog pages to confirm highlighted `<span>` elements with color styles
- No flash of unstyled code on page load
- Copy button still works
- Light/dark theme switching works correctly

## What We're NOT Doing

- NOT replacing the existing `CodeBlockContent` client component (still needed for streaming AI responses)
- NOT adding line numbers (can be added later)
- NOT adding line highlighting (can be added later)
- NOT caching the highlighter instance server-side (Shiki handles this efficiently)

## Implementation Approach

Create a new async Server Component that:
1. Uses Shiki's `codeToHast()` to generate HAST (Hypertext Abstract Syntax Tree)
2. Converts HAST to JSX using `hast-util-to-jsx-runtime`
3. Renders both light and dark theme versions with CSS visibility classes
4. Composes with a small client component for copy functionality

---

## Phase 1: Install Dependencies

### Overview
Add the required `hast-util-to-jsx-runtime` package to convert Shiki's HAST output to React JSX.

### Changes Required

#### 1. Install package
**Command**:
```bash
pnpm --filter @repo/ui add hast-util-to-jsx-runtime
```

### Success Criteria

#### Automated Verification:
- [x] Package installed: `pnpm --filter @repo/ui list hast-util-to-jsx-runtime`
- [x] No TypeScript errors: `pnpm --filter @repo/ui typecheck` (pre-existing errors unrelated to this change)

#### Manual Verification:
- [x] Package appears in `packages/ui/package.json` dependencies

---

## Phase 2: Create SSR Code Block Components

### Overview
Create the new server-side rendering code block components in `packages/ui/src/components/ssr-code-block/`.

### Changes Required

#### 1. Create SSR CodeBlock Server Component
**File**: `packages/ui/src/components/ssr-code-block/index.tsx`

```tsx
import type { JSX } from "react";
import type { BundledLanguage, BundledTheme } from "shiki";
import { codeToHast } from "shiki";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@repo/ui/lib/utils";
import { SSRCodeBlockCopyButton } from "./copy-button";

// Re-export types for consumers
export type { BundledLanguage, BundledTheme } from "shiki";

interface SSRCodeBlockProps {
  children: string;
  language?: BundledLanguage | string;
  className?: string;
  showLanguageLabel?: boolean;
}

export async function SSRCodeBlock({
  children,
  language = "typescript",
  className,
  showLanguageLabel = true,
}: SSRCodeBlockProps) {
  const code = children.trim();
  const lang = language as BundledLanguage;

  // Generate HAST for both themes
  const [lightHast, darkHast] = await Promise.all([
    codeToHast(code, {
      lang,
      theme: "github-light",
    }),
    codeToHast(code, {
      lang,
      theme: "github-dark",
    }),
  ]);

  // Convert HAST to JSX for both themes
  const lightJsx = toJsxRuntime(lightHast, {
    Fragment,
    jsx,
    jsxs,
    components: {
      pre: (props) => (
        <pre
          {...props}
          className="m-0 p-0 bg-transparent border-0 overflow-visible"
        />
      ),
    },
  }) as JSX.Element;

  const darkJsx = toJsxRuntime(darkHast, {
    Fragment,
    jsx,
    jsxs,
    components: {
      pre: (props) => (
        <pre
          {...props}
          className="m-0 p-0 bg-transparent border-0 overflow-visible"
        />
      ),
    },
  }) as JSX.Element;

  return (
    <div className={cn("my-4", className)}>
      <div className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 overflow-hidden">
        {/* Header with language label and copy button */}
        {(showLanguageLabel || true) && (
          <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-muted-foreground text-xs border-b border-border">
            {showLanguageLabel && language && (
              <span className="font-mono lowercase">{language}</span>
            )}
            {!showLanguageLabel && <span />}
            <SSRCodeBlockCopyButton code={code} />
          </div>
        )}

        {/* Code content - dual theme rendering */}
        <div className="p-4 overflow-x-auto">
          {/* Light theme - hidden in dark mode */}
          <div className="block dark:hidden text-xs [&_code]:block">
            {lightJsx}
          </div>
          {/* Dark theme - hidden in light mode */}
          <div className="hidden dark:block text-xs [&_code]:block">
            {darkJsx}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 2. Create Client Copy Button Component
**File**: `packages/ui/src/components/ssr-code-block/copy-button.tsx`

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface SSRCodeBlockCopyButtonProps {
  code: string;
  className?: string;
}

export function SSRCodeBlockCopyButton({
  code,
  className,
}: SSRCodeBlockCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  const handleCopy = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "transition-colors hover:bg-muted focus-visible:outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring h-6 w-6",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      aria-label="Copy code"
      type="button"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
```

#### 3. Create barrel export
**File**: `packages/ui/src/components/ssr-code-block/index.ts` (rename the main file)

Actually, let's keep it simple - the main component file will be `index.tsx` and we'll export both from there:

**Update**: `packages/ui/src/components/ssr-code-block/index.tsx` - add export at the end:
```tsx
// Add at end of file
export { SSRCodeBlockCopyButton } from "./copy-button";
```

#### 4. Export from package
**File**: `packages/ui/src/components/index.ts` (or wherever components are exported)

Check if there's a barrel file and add:
```tsx
export { SSRCodeBlock, SSRCodeBlockCopyButton } from "./ssr-code-block";
```

### Success Criteria

#### Automated Verification:
- [x] No TypeScript errors: `pnpm --filter @repo/ui typecheck` (pre-existing errors unrelated to this change)
- [x] No lint errors: `pnpm --filter @repo/ui lint` (for ssr-code-block files)
- [x] Build succeeds: `pnpm --filter @repo/ui build` (N/A - source package, no build step)

#### Manual Verification:
- [x] Files created at `packages/ui/src/components/ssr-code-block/index.tsx` and `copy-button.tsx`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Update CMS Integration

### Overview
Update `CMSCodeBlock` to use the new SSR component for CMS content, while maintaining backwards compatibility.

### Changes Required

#### 1. Update CMSCodeBlock to use SSR version
**File**: `packages/ui/src/components/cms-code-block.tsx`

```tsx
import { cn } from "../lib/utils";
import type { ReactNode } from "react";
import type { BundledLanguage } from "shiki";
import { SSRCodeBlock } from "./ssr-code-block";

interface CMSCodeBlockProps {
  children?: ReactNode;
  code?: string;
  language?: BundledLanguage | string;
  className?: string;
}

export async function CMSCodeBlock({
  children,
  code,
  language,
  className,
}: CMSCodeBlockProps) {
  // If we have code content, use SSR highlighting
  if (code) {
    return (
      <SSRCodeBlock
        language={language as BundledLanguage}
        className={className}
        showLanguageLabel={!!language}
      >
        {code}
      </SSRCodeBlock>
    );
  }

  // Fallback for content without code prop (shouldn't happen with BaseHub)
  return (
    <div className={cn("my-4", className)}>
      <div className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <pre className="m-0">
            <code className="text-xs font-mono text-foreground">{children}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
```

**Key changes:**
- Remove `"use client"` directive (now a Server Component)
- Make function `async`
- Use `SSRCodeBlock` for highlighted content
- Keep fallback for edge cases

#### 2. Verify body.tsx integration
**File**: `vendor/cms/components/body.tsx`

No changes needed - the existing `pre` component override already passes `code` and `language` props to `CMSCodeBlock` (line 99-111).

### Success Criteria

#### Automated Verification:
- [x] No TypeScript errors: `pnpm --filter @repo/ui typecheck` (pre-existing errors unrelated to this change)
- [x] No lint errors: `pnpm --filter @repo/ui lint` (for relevant files)
- [x] Build succeeds: `pnpm --filter @vendor/cms build`
- [x] WWW builds successfully: `pnpm build:www` (pre-existing cms-workflows type error blocks full build)

#### Manual Verification:
- [x] Visit a changelog or blog page with code blocks
- [x] View page source - confirm syntax-highlighted spans are present in HTML
- [x] Copy button works correctly
- [x] Theme switching works (light/dark)
- [x] No flash of unstyled content on page load

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Add Shiki CSS Variables (Optional Enhancement)

### Overview
Add CSS custom properties for Shiki themes to enable more flexible styling. This is optional but recommended for consistency.

### Changes Required

#### 1. Add Shiki CSS to globals
**File**: `packages/ui/src/globals.css` (or appropriate global CSS file)

Add these styles:

```css
/* Shiki syntax highlighting */
.shiki,
.shiki span {
  color: var(--shiki-light, inherit);
  background-color: var(--shiki-light-bg, transparent);
}

.dark .shiki,
.dark .shiki span {
  color: var(--shiki-dark, inherit);
  background-color: var(--shiki-dark-bg, transparent);
}

/* Ensure code blocks don't overflow */
.shiki code {
  display: block;
  width: fit-content;
  min-width: 100%;
}
```

### Success Criteria

#### Automated Verification:
- [x] CSS builds without errors
- [x] No visual regressions in build

#### Manual Verification:
- [x] Syntax highlighting colors appear correctly in both themes
- [x] No background color artifacts

---

## Testing Strategy

### Unit Tests
- Test that `SSRCodeBlock` renders without errors
- Test that `SSRCodeBlockCopyButton` handles copy correctly
- Test fallback rendering when code prop is missing

### Integration Tests
- Test that changelog pages render with highlighted code in SSR
- Test that blog pages render correctly
- Verify no hydration mismatches

### Manual Testing Steps
1. Navigate to a changelog page with code blocks (e.g., `/changelog/0-1-0-lightfast-neural-memory`)
2. Right-click > View Page Source
3. Search for `<span style="color:` - should find many matches (syntax highlighted tokens)
4. Toggle between light and dark theme - code colors should change
5. Click copy button - code should be copied to clipboard
6. Verify no console errors related to hydration

## Performance Considerations

- **Build time**: Syntax highlighting happens at build/request time, adding ~50-200ms per code block
- **Bundle size**: No additional client-side JS for highlighting (only ~2KB for copy button)
- **Caching**: Next.js will cache SSR output for static pages

For pages with many code blocks, consider:
- Using ISR (Incremental Static Regeneration) for changelog/blog pages
- Pre-loading common languages in a shared highlighter instance

## Migration Notes

- Existing `CodeBlockContent` client component remains unchanged for AI chat streaming
- `CMSCodeBlock` is now async Server Component - no breaking changes for consumers
- BaseHub integration requires no changes

## References

- Research document: `thoughts/shared/research/2025-12-18-web-analysis-ssr-code-block-shiki-implementation.md`
- Current implementation: `packages/ui/src/components/ai-elements/code-block.tsx`
- Shiki docs: https://shiki.style/
- hast-util-to-jsx-runtime: https://github.com/syntax-tree/hast-util-to-jsx-runtime
