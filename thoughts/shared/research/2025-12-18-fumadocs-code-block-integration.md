---
date: 2025-12-18T10:30:00+08:00
researcher: Claude
git_commit: 49070f33d86e785c031370b87dd3b61432481ee5
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Fumadocs code block integration - why className is undefined"
tags: [research, codebase, fumadocs, mdx, code-blocks, shiki, ssr]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: Fumadocs Code Block Integration

**Date**: 2025-12-18T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: 49070f33d86e785c031370b87dd3b61432481ee5
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Why does the custom `code` component in `mdx-components.tsx` receive `className: undefined` instead of `language-typescript` (or similar language class)?

```
classname undefined
code props: {
  inline: undefined,
  className: undefined,
  children: 'string',
  props: {}
}
```

## Summary

**Root Cause**: Fumadocs processes code blocks **at build time** using `rehypeCode` (a Shiki wrapper). This transforms markdown code fences (` ```typescript `) into fully highlighted HTML **before** they reach custom MDX components. The `className="language-typescript"` is **consumed and removed** during this transformation.

**Why SSRCodeBlock never receives language info**: The custom `code` and `pre` components in `mdx-components.tsx` are attempting to re-highlight code that has already been processed by Shiki. By the time these components receive the props, fumadocs has already:
1. Extracted the language from the className
2. Generated syntax-highlighted HTML with `<span>` tags
3. Removed the original `language-*` class

## Detailed Findings

### Fumadocs Build-Time Processing Pipeline

```
Markdown (```typescript)
    ↓
remarkPlugins (parse markdown)
    ↓
rehypeCode (Shiki highlighting) ← CODE BLOCKS TRANSFORMED HERE
    ↓
MDX components (code/pre)      ← Receive already-highlighted HTML
    ↓
React output
```

The key insight is that `rehypeCode` from `fumadocs-core/mdx-plugins` intercepts code blocks during MDX compilation:
- Uses Shiki to generate syntax-highlighted HTML with `<span>` tags
- Outputs a complete `<pre><code>` structure with inline styles
- The `className="language-typescript"` is consumed and removed

### Current Implementation Analysis

**File**: `apps/docs/mdx-components.tsx`

The current implementation spreads `defaultMdxComponents` from `fumadocs-ui/mdx` (line 7, 45), then overrides with custom `code` and `pre` components (lines 76-150).

**Problem in `code` component** (lines 93-101):
```typescript
const langMatch = className?.match(/language-(\w+)/);
if (langMatch && typeof children === "string") {
  const language = langMatch[1];
  return SSRCodeBlock({ children, language, className: "my-6" });
}
```
This code expects `className` to contain `language-typescript`, but fumadocs has already consumed it.

**Problem in `pre` component** (lines 112-134):
```typescript
const langMatch = codeProps.className?.match(/language-(\w+)/);
if (langMatch && typeof codeProps.children === "string") {
  // ...
}
```
Same issue - the className is undefined because rehypeCode already processed it.

### Fumadocs Configuration in Codebase

**Source Configuration**: `apps/docs/source.config.ts`
```typescript
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
});

export default defineConfig();
```

**Next.js Integration**: `apps/docs/next.config.ts`
```typescript
import { createMDX } from "fumadocs-mdx/next";
const withMDX = createMDX();
export default withMDX(config);
```

The `createMDX()` function automatically applies `rehypeCode` with default Shiki configuration. No explicit rehype/remark plugin configuration was found in the codebase.

### SSRCodeBlock Component

**Location**: `packages/ui/src/components/ssr-code-block/index.tsx`

The SSRCodeBlock is a well-implemented server-side component that:
- Uses Shiki for syntax highlighting (lines 32-41)
- Generates dual-theme output (github-light, github-dark)
- Converts HAST to JSX (lines 88-100)
- Includes line numbers and copy button

**Props Interface** (lines 12-18):
```typescript
interface SSRCodeBlockProps {
  children: string;           // The code content
  language?: string;          // Programming language
  className?: string;         // Additional CSS classes
  showHeader?: boolean;       // Show language label and copy button
  showLineNumbers?: boolean;  // Show line numbers
}
```

The component works correctly when called directly with a language prop. The issue is that it's never being called because the language detection in mdx-components.tsx fails.

### How Fumadocs Expects Code Blocks to Work

According to Fumadocs documentation and source code analysis:

1. **Don't override code/pre for syntax highlighting** - fumadocs handles this automatically
2. **Use CodeBlock/Pre for styling** - if you need custom wrapper styling:
```typescript
import { Pre, CodeBlock } from 'fumadocs-ui/components/codeblock';

export const mdxComponents = {
  ...defaultMdxComponents,
  pre: ({ ref: _ref, ...props }) => (
    <CodeBlock {...props}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
};
```

3. **Configure Shiki via rehypeCodeOptions** - for custom themes or options:
```typescript
// source.config.ts
import { defineConfig } from 'fumadocs-mdx/config';
import { type RehypeCodeOptions } from 'fumadocs-core/mdx-plugins';

const rehypeCodeOptions: RehypeCodeOptions = {
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  }
};

export default defineConfig({
  mdxOptions: {
    rehypePlugins: [[rehypeCode, rehypeCodeOptions]],
  },
});
```

## Code References

- `apps/docs/mdx-components.tsx:76-109` - Custom code component (receiving undefined className)
- `apps/docs/mdx-components.tsx:112-150` - Custom pre component (receiving undefined className)
- `apps/docs/source.config.ts` - Fumadocs source configuration
- `apps/docs/next.config.ts` - MDX wrapper configuration
- `packages/ui/src/components/ssr-code-block/index.tsx:20-147` - SSRCodeBlock implementation
- `packages/ui/src/components/ssr-code-block/index.tsx:32-41` - Shiki HAST generation

## Architecture Documentation

### Current Flow (Broken)
```
MDX File → rehypeCode (Shiki) → defaultMdxComponents.pre/code → custom code/pre override
                                                                   ↓
                                                            className is undefined
                                                                   ↓
                                                            langMatch fails
                                                                   ↓
                                                            Falls through to unstyled fallback
```

### Expected Flow (Fumadocs Default)
```
MDX File → rehypeCode (Shiki) → defaultMdxComponents.pre/code → Rendered with Shiki highlighting
                                   ↑
                           (already includes styling)
```

### Why Custom SSRCodeBlock Won't Work Here

The custom SSRCodeBlock expects raw code strings and a language identifier. But:
1. By the time MDX components receive the content, it's already highlighted HTML
2. The language class has been consumed by rehypeCode
3. Attempting to re-highlight would result in double processing

## Options for Resolution

### Option 1: Remove Custom Code/Pre Overrides
Simply remove the `code` and `pre` overrides from mdx-components.tsx and let `defaultMdxComponents` handle everything. Fumadocs' built-in handling includes Shiki syntax highlighting.

### Option 2: Use Fumadocs CodeBlock Components
```typescript
import { Pre, CodeBlock } from 'fumadocs-ui/components/codeblock';

export const mdxComponents = {
  ...defaultMdxComponents,
  pre: ({ ref: _ref, ...props }) => (
    <CodeBlock keepBackground className="my-6" {...props}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  // Keep inline code styling only
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className={cn("bg-muted/50 rounded-md px-1 py-0.5 text-sm font-mono", className)} {...props}>
          {children}
        </code>
      );
    }
    return <code {...props}>{children}</code>;
  },
};
```

### Option 3: Disable rehypeCode and Use SSRCodeBlock
Configure fumadocs to skip code block processing and use custom SSRCodeBlock. This would require:
1. Disabling `rehypeCode` in fumadocs config
2. Implementing custom rehype plugin that preserves `language-*` classes
3. More complex but gives full control

### Option 4: Use DynamicCodeBlock for Runtime Highlighting
For cases where runtime highlighting is needed:
```typescript
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

// In MDX files:
<DynamicCodeBlock lang="ts" code='console.log("Hello")' />
```

## Related Files

- `apps/docs/src/app/globals.css` - Imports fumadocs CSS presets
- `apps/docs/src/lib/source.ts` - Document loader configuration
- `packages/ui/src/shiki.css` - Shiki CSS variables (unused in current flow)

## Open Questions

1. Should the codebase use fumadocs' default code block handling or maintain custom SSRCodeBlock?
2. Are there specific styling requirements that fumadocs' CodeBlock doesn't provide?
3. Is the dual-theme rendering (light/dark) in SSRCodeBlock necessary, or does fumadocs' Shiki config handle this?
