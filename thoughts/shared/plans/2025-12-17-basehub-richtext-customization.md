# BaseHub RichText Customization - List Spacing and Custom Code Blocks

## Overview

Enhance the BaseHub `Body` component to provide consistent list spacing and custom code block rendering across all CMS content (changelog, blog, legal pages). The solution uses a unified style approach with a simple CodeBlock component (no syntax highlighting) that supports copy functionality and language labels.

## Current State Analysis

The `Body` component in `vendor/cms/components/body.tsx` is a 3-line re-export of BaseHub's `RichText` without any customization. Styling is applied inconsistently at each usage site via Tailwind prose classes:

- **Changelog pages**: Missing list spacing (`prose-ul:my-4`, `prose-li:my-1`) and code styling
- **Blog pages**: Full prose styling including `prose-code` and `prose-pre` classes
- **Legal pages**: Basic prose styling

### Key Discoveries:
- `vendor/cms/components/body.tsx:1-3` - Current Body is just `export const Body = RichText`
- `vendor/cms/components/toc.tsx:16-38` - Shows pattern for custom component handlers
- `apps/docs/src/components/code-block.tsx:14-85` - Simple CodeBlock with copy, language labels, optional line numbers
- `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx:122` - Missing list/code styling
- `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx:359-373` - Full prose styling reference

## Desired End State

After implementation:
1. All CMS content (changelog, blog, legal) renders with consistent list spacing
2. Code blocks display with language labels, copy buttons, and proper styling
3. Inline code has consistent styling (`bg-muted`, rounded, padding)
4. The Body component is a single unified implementation with custom handlers

### Verification:
- Navigate to `/changelog` and verify list items have tighter spacing
- Add a code block in BaseHub CMS and verify it renders with copy button and language label
- Inline `code` renders with background highlighting
- Blog and legal pages continue to work correctly

## What We're NOT Doing

- Syntax highlighting (Shiki) - keeping it simple for CMS content
- Variant-based Body component - using unified style
- Modifying the existing `@repo/ui/components/ai-elements/code-block.tsx` - that's for AI chat
- Download functionality - not needed for CMS content

## Implementation Approach

1. Create a simple `CMSCodeBlock` component in `@repo/ui` (based on docs version)
2. Enhance the `Body` component with custom handlers for `ul`, `ol`, `li`, `pre`, `code`
3. Update usage sites to remove redundant prose classes (already handled by Body)

---

## Phase 1: Create CMSCodeBlock Component in @repo/ui

### Overview
Create a simple, client-side code block component for CMS content with copy functionality and language labels.

### Changes Required:

#### 1. Create CMSCodeBlock Component
**File**: `packages/ui/src/components/cms-code-block.tsx`

```typescript
"use client";

import { cn } from "../lib/utils";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CMSCodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

const languageColors: Record<string, string> = {
  typescript: "text-blue-400",
  javascript: "text-yellow-400",
  python: "text-green-400",
  bash: "text-purple-400",
  json: "text-orange-400",
  go: "text-cyan-400",
  tsx: "text-blue-400",
  jsx: "text-yellow-400",
  css: "text-pink-400",
  html: "text-orange-400",
  sql: "text-green-400",
  yaml: "text-red-400",
  markdown: "text-gray-400",
  shell: "text-purple-400",
};

export function CMSCodeBlock({
  children,
  language,
  className,
}: CMSCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative group my-4", className)}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        {language && (
          <span
            className={cn(
              "text-xs font-medium opacity-60",
              languageColors[language.toLowerCase()] || "text-muted-foreground"
            )}
          >
            {language}
          </span>
        )}
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 p-4 pr-12 overflow-x-auto">
        <code className="text-xs font-mono text-foreground">{children}</code>
      </pre>
    </div>
  );
}
```

#### 2. Export from Package Index
**File**: `packages/ui/src/components/index.ts`

Add export:
```typescript
export { CMSCodeBlock } from "./cms-code-block";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/ui typecheck`
- [x] Build succeeds: `pnpm --filter @repo/ui build` (if applicable)
- [x] Lint passes: `pnpm --filter @repo/ui lint` (if applicable)

#### Manual Verification:
- [x] Component can be imported from `@repo/ui/components/cms-code-block`

---

## Phase 2: Enhance Body Component with Custom Handlers

### Overview
Update the Body component to use custom component handlers for lists and code blocks.

### Changes Required:

#### 1. Update Body Component
**File**: `vendor/cms/components/body.tsx`

```typescript
"use client";

import { RichText } from "basehub/react-rich-text";
import type { ComponentProps, ReactNode } from "react";
import { CMSCodeBlock } from "@repo/ui/components/cms-code-block";

type BodyProps = ComponentProps<typeof RichText>;

// Extract text content from React children
function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return extractTextContent((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

// Extract language from className (e.g., "language-typescript" -> "typescript")
function extractLanguage(className?: string): string | undefined {
  if (!className) return undefined;
  const match = className.match(/language-(\w+)/);
  return match?.[1];
}

export const Body = ({ components, ...props }: BodyProps) => (
  <RichText
    // @ts-expect-error BaseHub RichText components typing issue
    components={{
      // Tighter list spacing
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="my-4 space-y-1 list-disc pl-6">{children}</ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className="my-4 space-y-1 list-decimal pl-6">{children}</ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li className="my-1">{children}</li>
      ),

      // Custom code blocks
      pre: ({ children, className }: { children?: ReactNode; className?: string }) => {
        const code = extractTextContent(children);
        const language = extractLanguage(className);
        return <CMSCodeBlock language={language}>{code}</CMSCodeBlock>;
      },

      // Inline code styling
      code: ({ children, isInline }: { children?: ReactNode; isInline?: boolean }) => {
        if (isInline !== false) {
          return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          );
        }
        return <code className="font-mono text-sm">{children}</code>;
      },

      // Allow consumer overrides
      ...components,
    }}
    {...props}
  />
);

// Keep simple export for cases that need raw RichText
export { RichText as SimpleBody } from "basehub/react-rich-text";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`
- [x] No lint errors: `pnpm lint`

#### Manual Verification:
- [ ] Navigate to `/changelog` and verify list spacing is tighter
- [ ] Create a changelog entry with a code block in BaseHub and verify rendering

---

## Phase 3: Update Usage Sites

### Overview
Remove redundant prose classes from usage sites since the Body component now handles list and code styling internally.

### Changes Required:

#### 1. Update Changelog Listing Page
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/page.tsx`

**Line 122-124** - Update prose classes:
```typescript
// From:
<div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80 prose-ul:text-foreground/80 prose-li:text-foreground/80">

// To:
<div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80">
```

#### 2. Update Changelog Detail Page
**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`

**Line 145-147** - Same update pattern:
```typescript
// From:
<div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80 prose-ul:text-foreground/80 prose-li:text-foreground/80">

// To:
<div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80">
```

#### 3. Update Blog Post Page
**File**: `apps/www/src/app/(app)/(marketing)/(content)/blog/[slug]/page.tsx`

**Lines 359-370** - Simplify prose classes:
```typescript
// From:
<div className="prose prose-lg max-w-none mt-12
  prose-headings:text-foreground prose-headings:font-semibold
  prose-p:text-foreground/80 prose-p:leading-relaxed
  prose-strong:text-foreground prose-strong:font-semibold
  prose-a:text-foreground prose-a:underline hover:prose-a:text-foreground/80
  prose-ul:text-foreground/80 prose-ul:my-6
  prose-ol:text-foreground/80 prose-ol:my-6
  prose-li:text-foreground/80 prose-li:my-2
  prose-blockquote:text-foreground/80 prose-blockquote:border-foreground/20
  prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
  prose-pre:bg-muted prose-pre:text-foreground
  prose-img:rounded-lg"
>

// To:
<div className="prose prose-lg max-w-none mt-12
  prose-headings:text-foreground prose-headings:font-semibold
  prose-p:text-foreground/80 prose-p:leading-relaxed
  prose-strong:text-foreground prose-strong:font-semibold
  prose-a:text-foreground prose-a:underline hover:prose-a:text-foreground/80
  prose-blockquote:text-foreground/80 prose-blockquote:border-foreground/20
  prose-img:rounded-lg"
>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`
- [x] No lint errors: `pnpm lint`

#### Manual Verification:
- [ ] Navigate to `/changelog` - verify consistent list spacing
- [ ] Navigate to `/blog/[any-post]` - verify blog posts still render correctly
- [ ] Navigate to `/legal/[any-page]` - verify legal pages still work

---

## Phase 4: Verify Legal Pages

### Overview
Check legal pages and update if needed for consistency.

### Changes Required:

#### 1. Check Legal Page Implementation
**File**: `apps/www/src/app/(app)/(marketing)/legal/[slug]/page.tsx`

Read the current implementation and update prose classes to match the pattern (remove list/code classes that Body now handles).

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Navigate to `/legal/privacy` or `/legal/terms` - verify rendering

---

## Testing Strategy

### Unit Tests:
- No unit tests needed for this change (component is primarily styling)

### Integration Tests:
- Verify www build completes successfully

### Manual Testing Steps:
1. Run dev server: `pnpm dev:www`
2. Navigate to `/changelog` - verify list items have tighter spacing
3. Create a test changelog entry in BaseHub with:
   - Bullet list
   - Numbered list
   - Code block with language (```typescript)
   - Inline code (`code`)
4. Verify each element renders correctly
5. Test copy button on code block
6. Navigate to existing blog posts - verify no regressions

## Performance Considerations

- CMSCodeBlock is a client component (required for useState/clipboard API)
- This adds minimal JavaScript bundle size (~2KB)
- No external syntax highlighting library = faster load times

## Migration Notes

- No data migration needed
- Existing CMS content will automatically render with new styling
- No breaking changes to API

## References

- Research document: `thoughts/shared/research/2025-12-17-basehub-richtext-customization.md`
- Reference implementation: `apps/docs/src/components/code-block.tsx`
- BaseHub RichText docs: https://docs.basehub.com/api-reference/javascript-sdk/react/rich-text-component
