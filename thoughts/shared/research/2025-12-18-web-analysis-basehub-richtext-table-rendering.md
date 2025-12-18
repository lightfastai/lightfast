---
date: 2025-12-18T12:00:00+08:00
researcher: claude-opus-4-5
topic: "BaseHub RichText Table Rendering Issues"
tags: [research, web-analysis, basehub, richtext, tables, cms]
status: complete
created_at: 2025-12-18
confidence: high
sources_count: 6
---

# Web Research: BaseHub RichText Table Rendering Issues

**Date**: 2025-12-18
**Topic**: Why tables don't render in BaseHub RichText and how to fix it
**Confidence**: High - Based on official BaseHub documentation and verified patterns

## Research Question

Tables in BaseHub RichText content are not rendering at all in the output.

## Executive Summary

**Root Cause**: BaseHub's RichText component **does not render tables by default**. The component requires explicit custom handlers for HTML table elements (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`) to be passed via the `components` prop. This is by design, not a bug, allowing developers full control over table rendering and styling.

**Solution**: Add custom table component handlers to the `Body` component in `vendor/cms/components/body.tsx`.

## Key Metrics & Findings

### Architecture Explanation
**Finding**: BaseHub's RichText component is a render-agnostic rich text renderer. It only renders elements that have explicit handlers defined in the `components` prop.

**Sources**:
- [BaseHub Custom Components Documentation](https://docs.basehub.com/templates-and-examples/examples-and-guides/custom-components-in-rich-text)
- [Next-Forge CMS Components](https://www.next-forge.com/packages/cms/components)

**Analysis**: Your current `body.tsx` has handlers for `ul`, `ol`, `li`, `pre`, and `code` - but no table-related handlers. Tables in the content are simply not rendered because no handler tells React how to render them.

### Import Path Verification
**Finding**: The correct import path is `basehub/react-rich-text` (not the deprecated `basehub/react`)

**Source**: [BaseHub Changelog](https://github.com/basehub-ai/basehub/blob/main/packages/basehub/CHANGELOG.md)

**Analysis**: Your codebase is using the correct import path:
```typescript
import { RichText } from "basehub/react-rich-text";
```

### Known Issues with Props
**Finding**: BaseHub passes custom props (like `isTasksList`) to elements which can cause React warnings if not filtered out

**Source**: [Next-Forge GitHub Issue #513](https://github.com/haydenbleasel/next-forge/issues/513)

**Analysis**: When adding table handlers, you should destructure and filter any BaseHub-specific props before passing to native HTML elements.

## Trade-off Analysis

### Option 1: Add Custom Table Handlers to Body Component
| Factor | Impact | Notes |
|--------|--------|-------|
| Implementation | Low effort | ~30 lines of code |
| Maintenance | Low | Handlers are straightforward HTML wrappers |
| Styling Control | Full | You control all table CSS |
| Responsive | Requires wrapper | Need overflow-x-auto container |

### Option 2: CSS-Only Approach
| Factor | Impact | Notes |
|--------|--------|-------|
| Implementation | Minimal | Just CSS rules |
| Maintenance | Low | Standard CSS |
| Styling Control | Limited | Can't add wrapper elements |
| Works? | **No** | Won't fix if tables aren't rendering at all |

## Recommendations

Based on research findings:

1. **Add table handlers to `richTextBaseComponents`**: This is the correct and intended approach per BaseHub documentation.

2. **Include responsive wrapper**: Wrap `<table>` in a `<div className="overflow-x-auto">` for mobile support.

3. **Filter BaseHub props**: Destructure and exclude any non-HTML props to prevent React warnings.

## Solution: Implementation Code

Add these handlers to `vendor/cms/components/body.tsx`:

```typescript
// Table elements with responsive wrapper
table: ({ children, ...props }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableElement>) => (
  <div className="my-6 overflow-x-auto">
    <table className="min-w-full border-collapse border border-border" {...props}>
      {children}
    </table>
  </div>
),
thead: ({ children, ...props }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="bg-muted" {...props}>{children}</thead>
),
tbody: ({ children, ...props }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className="divide-y divide-border" {...props}>{children}</tbody>
),
tr: ({ children, ...props }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className="border-b border-border" {...props}>{children}</tr>
),
th: ({ children, ...props }: { children?: ReactNode } & React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className="px-4 py-3 text-left text-sm font-semibold border border-border" {...props}>
    {children}
  </th>
),
td: ({ children, ...props }: { children?: ReactNode } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className="px-4 py-3 text-sm border border-border" {...props}>
    {children}
  </td>
),
```

## Detailed Findings

### Finding 1: BaseHub RichText is Render-Agnostic
**Question**: Why don't tables render by default?
**Finding**: The RichText component is designed to be framework-agnostic and customizable. It doesn't include default renderers for all HTML elements.
**Source**: [BaseHub Documentation](https://docs.basehub.com/templates-and-examples/examples-and-guides/custom-components-in-rich-text)
**Relevance**: Explains the architectural decision behind requiring explicit handlers.

### Finding 2: Tiptap/ProseMirror Under the Hood
**Question**: What technology does BaseHub use for rich text?
**Finding**: BaseHub uses Tiptap (built on ProseMirror) for rich text editing, which requires explicit node renderers.
**Source**: [Tiptap Table Extension](https://tiptap.dev/docs/editor/extensions/nodes/table)
**Relevance**: Understanding the underlying tech explains the component architecture.

### Finding 3: Pattern Validation
**Question**: Is this the standard approach?
**Finding**: Projects like next-forge use the same pattern - custom component handlers for all elements.
**Source**: [Next-Forge CMS Package](https://www.next-forge.com/packages/cms/components)
**Relevance**: Confirms this is the intended usage pattern.

## Risk Assessment

### Low Priority
- **TypeScript typing issues**: BaseHub's types may not perfectly match the actual props passed. Use `@ts-expect-error` or type assertions as needed.

### Minimal Risk
- **Styling consistency**: Table styles should match your design system. Consider using Tailwind prose classes or custom theme tokens.

## Open Questions

Areas that need further investigation:
- **Complex tables**: How does BaseHub handle colspan/rowspan? Testing required.
- **Table captions**: Does BaseHub support `<caption>` elements? May need handler.

## Sources

### Official Documentation
- [BaseHub Custom Components in Rich Text](https://docs.basehub.com/templates-and-examples/examples-and-guides/custom-components-in-rich-text) - BaseHub, 2024
- [BaseHub Rich Text Primitive](https://docs.basehub.com/blocks/primitives/rich-text) - BaseHub, 2024

### Implementation Examples
- [Next-Forge CMS Components](https://www.next-forge.com/packages/cms/components) - Hayden Bleasel, 2024
- [Tiptap Table Extension](https://tiptap.dev/docs/editor/extensions/nodes/table) - Tiptap, 2024

### Issue Reports
- [Next-Forge GitHub Issue #513](https://github.com/haydenbleasel/next-forge/issues/513) - Props warning issue

### Underlying Technology
- [BaseHub Changelog](https://github.com/basehub-ai/basehub/blob/main/packages/basehub/CHANGELOG.md) - Migration notes

---

**Last Updated**: 2025-12-18
**Confidence Level**: High - Based on official documentation and verified implementation patterns
**Next Steps**: Add table handlers to `vendor/cms/components/body.tsx`
