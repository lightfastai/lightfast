---
date: 2025-12-18T11:00:00+08:00
researcher: claude-opus-4-5
topic: "SSR Code Block Implementation with Shiki for Next.js 15"
tags: [research, web-analysis, shiki, syntax-highlighting, ssr, react-server-components, aeo]
status: complete
created_at: 2025-12-18
confidence: high
sources_count: 12
related:
  - ./2025-12-18-web-analysis-code-examples-aeo-client-side-rendering.md
---

# Web Research: SSR Code Block Implementation with Shiki for Next.js 15

**Date**: 2025-12-18T11:00:00+08:00
**Topic**: Finding an SSR-compatible code block solution to replace client-side implementation
**Confidence**: High - Based on official Shiki documentation and established patterns

## Research Question

Given our current `apps/docs/src/components/code-block.tsx` which is a client component, we need an SSR-compatible version for better AEO (Answer Engine Optimization).

## Current Implementation Analysis

```tsx
// apps/docs/src/components/code-block.tsx (CURRENT)
"use client";  // ❌ Client component

import { cn } from "@repo/ui/lib/utils";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ children, language, ... }) {
  const [copied, setCopied] = useState(false);
  // ... renders plain text code with copy button
}
```

**Current Issues**:
- ✅ Code content IS in initial HTML (good for AEO)
- ❌ No syntax highlighting
- ❌ Entire component is client-side (unnecessary)
- ❌ Copy button state forces client component

**What AI Crawlers See**: Plain code text (acceptable but not optimal)

## Executive Summary

**Recommended Solution**: Use **Shiki** with React Server Components for syntax highlighting, with a small client component for the copy button only.

The pattern is:
1. **Server Component**: Handles syntax highlighting with Shiki (async)
2. **Client Component**: Only the copy button (minimal JS)

This gives us:
- ✅ Full syntax highlighting in initial HTML
- ✅ Zero client-side JS for highlighting
- ✅ AI crawlers see highlighted code structure
- ✅ Copy functionality preserved

## Recommended Implementation

### Option 1: Shiki with JSX Runtime (Recommended)

Best for: Full control, type safety, custom styling

```tsx
// packages/ui/src/components/code-block/index.tsx (Server Component)
import type { JSX } from 'react'
import type { BundledLanguage } from 'shiki'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { codeToHast } from 'shiki'
import { CopyButton } from './copy-button'
import { cn } from '@repo/ui/lib/utils'

interface CodeBlockProps {
  children: string
  lang?: BundledLanguage
  className?: string
  showLineNumbers?: boolean
  title?: string
}

export async function CodeBlock({
  children,
  lang = 'typescript',
  className,
  showLineNumbers = false,
  title,
}: CodeBlockProps) {
  const hast = await codeToHast(children.trim(), {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  })

  const rendered = toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: {
      pre: (props) => (
        <pre
          {...props}
          className={cn(
            'rounded-lg border border-border bg-muted/30 dark:bg-muted/10 p-4 overflow-x-auto',
            className
          )}
        />
      ),
    },
  }) as JSX.Element

  return (
    <div className="relative group my-4">
      {title && (
        <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-background text-xs text-muted-foreground">
          {title}
        </div>
      )}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        <span className="text-xs font-medium opacity-60 text-muted-foreground">
          {lang}
        </span>
        <CopyButton code={children} />
      </div>
      {rendered}
    </div>
  )
}
```

```tsx
// packages/ui/src/components/code-block/copy-button.tsx (Client Component)
'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@repo/ui/lib/utils'

interface CopyButtonProps {
  code: string
  className?: string
}

export function CopyButton({ code, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-xs font-medium',
        'transition-colors hover:bg-muted focus-visible:outline-none',
        'focus-visible:ring-1 focus-visible:ring-ring h-7 w-7',
        'text-muted-foreground hover:text-foreground',
        className
      )}
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
```

### Option 2: Using dangerouslySetInnerHTML (Simpler)

Best for: Quick implementation, less type complexity

```tsx
// Server Component
import { codeToHtml } from 'shiki'
import { CopyButton } from './copy-button'

export async function CodeBlock({ children, lang = 'typescript' }: Props) {
  const html = await codeToHtml(children.trim(), {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  })

  return (
    <div className="relative group my-4">
      <CopyButton code={children} className="absolute right-2 top-2 z-10" />
      <div
        className="[&_pre]:rounded-lg [&_pre]:border [&_pre]:p-4 [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
```

### CSS for Dual Theme Support

```css
/* globals.css */
.shiki,
.shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}

.dark .shiki,
.dark .shiki span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
}

/* Code block styling */
.shiki {
  @apply text-sm font-mono;
}

.shiki code {
  @apply block;
}
```

## Trade-off Analysis

### Current Client Component

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ⚠️ Partial | Code visible, no highlighting |
| Bundle Size | ❌ Higher | Entire component client-side |
| Syntax Highlighting | ❌ None | Plain text only |
| Interactivity | ✅ Full | Copy button works |

### Shiki SSR + Client Copy Button

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ✅ Excellent | Highlighted code in HTML |
| Bundle Size | ✅ Minimal | Only copy button is client |
| Syntax Highlighting | ✅ Full | 200+ languages, themes |
| Interactivity | ✅ Full | Copy button works |
| Build Time | ⚠️ Slight increase | ~50-200ms per block |

### Lightweight Alternative (sugar-high)

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ✅ Good | Highlighted code in HTML |
| Bundle Size | ✅ ~1KB | Ultra lightweight |
| Syntax Highlighting | ⚠️ Limited | JS/TS/JSX only |
| Build Time | ✅ Fast | <10ms per block |

## Recommendations

### 1. **Use Shiki for docs and changelogs**

Shiki provides the best balance of features and AEO optimization.

```bash
pnpm add shiki hast-util-to-jsx-runtime
```

### 2. **Consider sugar-high for simple JS examples**

If most code is JavaScript/TypeScript and you want minimal overhead:

```bash
pnpm add sugar-high
```

### 3. **For BaseHub CMS integration**

Override the code component in your rich text renderer:

```tsx
// vendor/cms/components/body.tsx
import { CodeBlock } from '@repo/ui/components/code-block'

<RichText
  components={{
    code: ({ children, isInline, language }) => {
      if (isInline) {
        return <code className="...">{children}</code>
      }
      return <CodeBlock lang={language}>{children}</CodeBlock>
    },
  }}
>
  {content}
</RichText>
```

### 4. **Performance optimization**

For many code blocks, consider caching the highlighter:

```tsx
// lib/shiki.ts
import { createHighlighter } from 'shiki'

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null

export async function getHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['typescript', 'javascript', 'tsx', 'jsx', 'bash', 'json'],
    })
  }
  return highlighter
}
```

## Comparison: Solution Options

| Feature | Shiki | sugar-high | Bright | Current |
|---------|-------|------------|--------|---------|
| **SSR Support** | ✅ | ✅ | ✅ | ❌ |
| **Languages** | 200+ | JS/TS only | 100+ | N/A |
| **Themes** | 150+ | 1 | 20+ | N/A |
| **Bundle Size** | 0KB (SSR) | ~1KB | ~50KB | ~5KB |
| **Line Numbers** | ✅ | ❌ | ✅ | ✅ |
| **Line Highlighting** | ✅ | ❌ | ✅ | ❌ |
| **Copy Button** | + Client | + Client | + Client | ✅ |
| **AEO Score** | Excellent | Good | Excellent | Partial |

## Migration Path

1. **Create new SSR CodeBlock** in `packages/ui/src/components/code-block/`
2. **Keep existing component** temporarily for backwards compatibility
3. **Update imports** in docs and changelogs to use new component
4. **Test AEO** by viewing page source to confirm highlighted code in HTML
5. **Remove old component** once migration complete

## Files to Create/Modify

```
packages/ui/src/components/
├── code-block/
│   ├── index.tsx          # Server component (Shiki highlighting)
│   ├── copy-button.tsx    # Client component (copy functionality)
│   └── styles.css         # Optional: theme-specific styles

vendor/cms/components/
├── body.tsx               # Update to use new CodeBlock

apps/docs/src/components/
├── code-block.tsx         # Can be deprecated after migration
```

## Sources

### Official Documentation
- [Shiki Official Docs](https://shiki.style/) - Shiki maintainers, 2024
- [Shiki Next.js Package](https://shiki.style/packages/next) - Official Next.js guide
- [hast-util-to-jsx-runtime](https://github.com/syntax-tree/hast-util-to-jsx-runtime) - JSX conversion

### Implementation Guides
- [Lucky Media - Shiki with RSC](https://www.luckymedia.dev/blog/syntax-highlighting-with-shiki-react-server-components-and-next-js) - Lucky Media, 2024
- [Fumadocs Code Block](https://fumadocs.dev/docs/ui/components/codeblock) - Fumadocs, 2024
- [Matt Hamlin - Shiki on Next.js](https://matthamlin.me/2023/march/shiki-on-next-js) - March 2023

### Alternatives
- [sugar-high GitHub](https://github.com/huozhi/sugar-high) - Lightweight alternative
- [Bright by Code Hike](https://bright.codehike.org/) - RSC-first highlighter
- [rehype-pretty-code](https://rehype-pretty.pages.dev/) - MDX integration

---

**Last Updated**: 2025-12-18
**Confidence Level**: High - Based on official documentation and established patterns
**Next Steps**:
1. Decide between Shiki (full-featured) vs sugar-high (lightweight)
2. Implement SSR CodeBlock in packages/ui
3. Update BaseHub CMS body renderer
4. Migrate existing code blocks
