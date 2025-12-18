---
date: 2025-12-18T04:07:39+0000
researcher: Claude
git_commit: 49070f33d86e785c031370b87dd3b61432481ee5
branch: feat/memory-layer-foundation
repository: lightfast
topic: "MDX Components SSR Compatibility Analysis"
tags: [research, codebase, mdx-components, ssr, server-components, fumadocs]
status: complete
last_updated: 2025-12-18
last_updated_by: Claude
---

# Research: MDX Components SSR Compatibility Analysis

**Date**: 2025-12-18T04:07:39+0000
**Researcher**: Claude
**Git Commit**: 49070f33d86e785c031370b87dd3b61432481ee5
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Analyze all components used in `apps/docs/mdx-components.tsx` to determine their SSR compatibility, identifying which components are server components, client components, or hybrid.

## Summary

The `apps/docs/mdx-components.tsx` file exports MDX component overrides that are mostly SSR-compatible. The analysis reveals:

- **31 inline components**: All are server-compatible (2 async, 29 synchronous)
- **@repo/ui components**: `SSRCodeBlock` is server-only async; Accordion components are client-side
- **@/src/components**: 5 server components, 4 client components
- **fumadocs-ui**: Mixed (Tab/Tabs are client-side, APIPage is hybrid)
- **lucide-react**: Fully SSR-compatible SVG components
- **next/image & next/link**: Client components with SSR guards (hybrid rendering)

## Detailed Findings

### 1. Inline Components (defined in mdx-components.tsx)

All 31 inline components are SSR-compatible server components.

#### Async Server Components (2)

| Component | Lines | Notes |
|-----------|-------|-------|
| `code` | 76-109 | Async function, calls `SSRCodeBlock()` |
| `pre` | 112-150 | Async function, awaits `SSRCodeBlock()` |

#### Synchronous Server Components (29)

| Component | Lines | Notes |
|-----------|-------|-------|
| `img` | 50-73 | Native `<img>` with Tailwind styling |
| `strong` | 153-158 | `font-semibold` styling |
| `em` | 161-166 | `italic` styling |
| `a` | 170-183 | Conditional external link handling |
| `h1` | 186-194 | Heading with scroll margin |
| `h2` | 197-205 | Heading with scroll margin |
| `h3` | 208-216 | Heading with scroll margin |
| `h4` | 219-227 | Heading with scroll margin |
| `h5` | 230-238 | Heading with scroll margin |
| `h6` | 241-249 | Heading with scroll margin |
| `p` | 253-262 | Paragraph with leading-7 |
| `ul` | 265-273 | List with disc markers |
| `ol` | 276-284 | List with decimal markers |
| `li` | 287-296 | List item styling |
| `hr` | 299-301 | Horizontal rule |
| `blockquote` | 304-316 | Left-bordered quote |
| `table` | 319-327 | Wrapped table with overflow |
| `thead` | 329-334 | Table header with border |
| `tbody` | 337-342 | Table body styling |
| `tr` | 345-356 | Table row with hover |
| `th` | 359-370 | Table header cell |
| `td` | 373-385 | Table data cell |
| `Alert` | 388-401 | Info callout with icon |
| `FAQAccordion` | 424-442 | Wrapper for accordion (uses client Accordion) |
| `FAQItem` | 445-476 | Accordion item composition |
| `NextLink` | 479-502 | Next.js Link wrapper |
| `NextImage` | 504-537 | Next.js Image with defaults |
| `AuthLink` | 540-573 | Dynamic auth URL link |
| `WwwLink` | 577-611 | Dynamic www URL link |

---

### 2. @repo/ui Components

#### SSRCodeBlock
**File**: `packages/ui/src/components/ssr-code-block/index.tsx`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Async server component |
| "use client" | No |
| Hooks | None |
| Browser APIs | None |
| Notes | Uses Shiki for server-side syntax highlighting, includes client `SSRCodeBlockCopyButton` child |

#### SSRCodeBlockCopyButton
**File**: `packages/ui/src/components/ssr-code-block/copy-button.tsx`

| Aspect | Details |
|--------|---------|
| SSR Compatible | NO - Client component |
| "use client" | Yes (line 1) |
| Hooks | `useState`, `useRef`, `useEffect` |
| Browser APIs | `navigator.clipboard`, `window.setTimeout` |
| Notes | Child component for copy functionality |

#### Accordion Components
**File**: `packages/ui/src/components/ui/accordion.tsx`

| Aspect | Details |
|--------|---------|
| SSR Compatible | NO - Client components |
| "use client" | Yes (line 1) |
| Hooks | Radix UI internal hooks |
| Browser APIs | Radix UI internal (focus, keyboard, ARIA) |
| Components | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |

#### cn Utility
**File**: `packages/ui/src/lib/utils.ts`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Pure function |
| "use client" | No |
| Hooks | None |
| Notes | Uses clsx + twMerge for class composition |

---

### 3. @/src/components (Internal)

#### Server Components (5)

| Component | File | Notes |
|-----------|------|-------|
| `FeatureList` | `feature-list.tsx` | Pure server, renders feature list |
| `ValidationError` | `validation-error.tsx` | Pure server, error display |
| `ValidationErrorList` | `validation-error.tsx` | Pure server, error list |
| `ValidationExample` | `validation-error.tsx` | Pure server, good/bad examples |
| `NextSteps` | `next-steps.tsx` | Pure server, step cards |

#### Client Components (4)

| Component | File | "use client" | Notes |
|-----------|------|--------------|-------|
| `ApiEndpoint` | `api-endpoint.tsx` | Line 1 | Method badge + path display |
| `ApiMethod` | `api-method.tsx` | Line 1 | HTTP method badge |
| `ApiReferenceCard` | `api-reference-card.tsx` | Line 1 | API reference card |
| `ApiReferenceGrid` | `api-reference-card.tsx` | Line 1 | Grid container |

---

### 4. fumadocs-ui Components

#### defaultMdxComponents
**File**: `node_modules/fumadocs-ui/dist/mdx.js`

Mixed SSR compatibility - contains both server and client components:

| Sub-component | SSR | Notes |
|---------------|-----|-------|
| `Heading` (h1-h6) | YES | Pure server, anchor links |
| `Card/Cards` | YES | Pure server |
| `Callout` | YES | Server with forwardRef |
| `CodeBlock` | NO | Client with `useContext`, `navigator.clipboard` |
| `Image` | YES | Uses fumadocs-core/framework |
| `Link` | YES | Uses fumadocs-core/link |
| `Table` | YES | Pure server wrapper |

#### Tab, Tabs
**File**: `node_modules/fumadocs-ui/dist/components/tabs.js`

| Aspect | Details |
|--------|---------|
| SSR Compatible | NO - Client components |
| "use client" | Yes (line 1) |
| Hooks | `useState`, `useEffect`, `useMemo`, `useContext`, `useId`, `useLayoutEffect` |
| Browser APIs | `localStorage`, `sessionStorage`, `window.location.hash`, `window.history.replaceState` |
| Notes | Built on @radix-ui/react-tabs |

#### APIPage
**File**: `node_modules/fumadocs-openapi/dist/render/api-page.js`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Async server component with lazy-loaded client children |
| "use client" | No (main component) |
| Notes | Processes OpenAPI docs server-side, `ApiProvider` lazy-loads on client |

---

### 5. lucide-react Icons

**File**: `node_modules/lucide-react/dist/esm/icons/`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Pure SVG components |
| "use client" | No |
| Hooks | None (only `forwardRef`, `createElement`) |
| Browser APIs | None |
| Icons Used | `Info`, `ExternalLink` |
| Notes | Renders inline SVG with static path data |

---

### 6. Next.js Components

#### next/image
**File**: `node_modules/next/dist/client/image-component.js`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Hybrid rendering |
| "use client" | Yes (line 1) |
| Hooks | `useState`, `useEffect`, `useContext`, `useMemo`, `useRef`, `useCallback` |
| Browser APIs | `window.innerWidth`, `getBoundingClientRect()` (guarded) |
| Notes | Server renders static `<img>`, client adds optimization callbacks |

#### next/link
**File**: `node_modules/next/dist/client/link.js`

| Aspect | Details |
|--------|---------|
| SSR Compatible | YES - Hybrid rendering |
| "use client" | Yes (line 1) |
| Hooks | `useContext`, `useMemo`, `useRef`, `useCallback`, `useEffect` |
| Browser APIs | `location.replace()`, prefetch logic (guarded with `typeof window`) |
| Notes | Server renders static `<a>`, client adds prefetching |

---

## Code References

### Entry Points
- `apps/docs/mdx-components.tsx:1` - cn import
- `apps/docs/mdx-components.tsx:4-5` - Next.js Image/Link imports
- `apps/docs/mdx-components.tsx:6` - lucide-react imports
- `apps/docs/mdx-components.tsx:7-8` - fumadocs-ui imports
- `apps/docs/mdx-components.tsx:9` - SSRCodeBlock import
- `apps/docs/mdx-components.tsx:10-15` - Accordion imports
- `apps/docs/mdx-components.tsx:16-31` - Internal component imports
- `apps/docs/mdx-components.tsx:43-612` - Component definitions

### @repo/ui
- `packages/ui/src/components/ssr-code-block/index.tsx:20` - SSRCodeBlock async function
- `packages/ui/src/components/ssr-code-block/copy-button.tsx:1` - "use client"
- `packages/ui/src/components/ui/accordion.tsx:1` - "use client"
- `packages/ui/src/lib/utils.ts:5-7` - cn function

### Internal Components
- `apps/docs/src/components/feature-list.tsx` - Server component
- `apps/docs/src/components/api-endpoint.tsx:1` - "use client"
- `apps/docs/src/components/api-method.tsx:1` - "use client"
- `apps/docs/src/components/api-reference-card.tsx:1` - "use client"
- `apps/docs/src/components/validation-error.tsx` - Server component
- `apps/docs/src/components/next-steps.tsx` - Server component

### External Packages
- `node_modules/fumadocs-ui/dist/components/tabs.js:1` - "use client"
- `node_modules/fumadocs-ui/dist/components/codeblock.js:1` - "use client"
- `node_modules/next/dist/client/link.js:1` - "use client"
- `node_modules/next/dist/client/image-component.js:1` - "use client"

---

## Component SSR Summary Table

| Category | Total | Server | Client | Hybrid |
|----------|-------|--------|--------|--------|
| Inline components | 31 | 31 | 0 | 0 |
| @repo/ui | 6 | 2 | 4 | 0 |
| @/src/components | 9 | 5 | 4 | 0 |
| fumadocs-ui | 10+ | 5 | 4 | 1 |
| lucide-react | 2 | 2 | 0 | 0 |
| Next.js | 2 | 0 | 0 | 2 |

**Legend**:
- **Server**: No "use client", no hooks, no browser APIs
- **Client**: Has "use client" directive
- **Hybrid**: Client component with SSR guards (renders static HTML server-side)

---

## Architecture Documentation

### Rendering Strategy

The MDX components follow a tiered rendering strategy:

1. **Pure Server Components** - Typography, layout, static content
2. **Async Server Components** - Code blocks with syntax highlighting
3. **Client Components** - Interactive elements (tabs, accordions, copy buttons)
4. **Hybrid Components** - Next.js primitives (Image, Link)

### Client Component Boundary

Client components in this codebase are isolated to:
- Interactive UI elements (accordions, tabs)
- Copy-to-clipboard functionality
- Navigation optimization (prefetching)
- Persistence features (localStorage for tabs)

The main MDX content renders server-side, with client components hydrating for interactivity.

---

## Open Questions

1. Should `ApiEndpoint`, `ApiMethod`, `ApiReferenceCard`, and `ApiReferenceGrid` be converted to server components since they don't use client hooks?
2. Should `FAQAccordion` and `FAQItem` document their dependency on client Accordion components?
3. Consider whether fumadocs-ui's `CodeBlock` should be replaced with `SSRCodeBlock` for consistency?
