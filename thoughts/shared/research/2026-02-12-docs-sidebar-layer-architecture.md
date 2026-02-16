---
date: 2026-02-12T12:00:00+08:00
researcher: claude
git_commit: 236d7810
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Docs sidebar layer architecture - complete rework analysis"
tags: [research, codebase, docs, sidebar, fumadocs, ssr]
status: complete
last_updated: 2026-02-12
last_updated_by: claude
---

# Research: Docs Sidebar Layer Architecture

**Date**: 2026-02-12
**Git Commit**: 236d7810
**Branch**: feat/landing-page-grid-rework

## Research Question

Understand the full sidebar component architecture in `apps/docs` to support removing `docs-sidebar-wrapper.tsx` and reworking the sidebar layer so it remains SSR while serving both docs and API reference pages.

## Summary

The current sidebar has a **3-layer deep client component chain** where only **one layer** does meaningful work. The wrapper exists solely to use `usePathname()` to pick between two page trees, but this can be determined at the layout/route level using Next.js route segments instead — keeping everything SSR.

## Current Architecture

### Component Chain (top → bottom)

```
(docs)/layout.tsx          [SERVER]  → passes both pageTree + apiPageTree
  └─ DocsSidebarWrapper    [CLIENT]  → usePathname() to pick which tree
       └─ DocsSidebarLayout [CLIENT] → SidebarProvider, header, search, main content
            └─ DocsMarketingSidebar [CLIENT] → renders tree items, usePathname() for active state
```

### File Inventory

| File | Type | Purpose |
|------|------|---------|
| `src/app/(docs)/layout.tsx:6-11` | Server | Imports both trees, renders `DocsSidebarWrapper` |
| `src/components/docs-sidebar-wrapper.tsx` | Client | Picks tree based on `pathname.includes("/api-reference")` |
| `src/components/docs-sidebar-layout.tsx` | Client | Full page shell: `SidebarProvider`, header, search, `SidebarInset` |
| `src/components/docs-marketing-sidebar.tsx` | Client | Renders page tree navigation with active states |
| `src/components/docs-sidebar-scroll-area.tsx` | Client | Scroll area with dynamic border on scroll |

### Data Flow

1. **`source.config.ts`** — Defines two doc sources:
   - `src/content/docs` → `pageTree` (base URL `/docs`)
   - `src/content/api` → `apiPageTree` (base URL `/docs/api-reference`)

2. **`src/lib/source.ts`** — Creates fumadocs loaders, exports `pageTree` and `apiPageTree`

3. **`(docs)/layout.tsx`** — Server component, imports both trees and passes them to the wrapper

4. **`DocsSidebarWrapper`** — The component in question. It:
   - Uses `usePathname()` (forces client boundary)
   - Checks `pathname.includes("/api-reference")`
   - Passes the selected tree to `DocsSidebarLayout`

5. **`DocsSidebarLayout`** — Contains the full page layout:
   - `SidebarProvider` with `defaultOpen={true}`
   - `DocsMarketingSidebar` (left sidebar with tree nav)
   - Fixed-position `Search` component
   - `SidebarInset` with header (nav + login button) and scrollable content area

6. **`DocsMarketingSidebar`** — Renders the tree:
   - Logo in header
   - Iterates `tree.children` rendering separators, folders, and pages
   - Uses `usePathname()` again for active link state
   - Uses shadcn `Sidebar*` components

### Route Structure

```
src/app/
├── layout.tsx                           # Root: HTML, RootProvider
├── (health)/api/health/                 # Health check
├── api/search/                          # Search API
└── (docs)/
    ├── layout.tsx                       # <DocsSidebarWrapper> with both trees
    └── docs/
        ├── [[...slug]]/page.tsx         # General docs pages (uses docsSource)
        └── api-reference/
            └── [[...slug]]/page.tsx     # API reference pages (uses apiSource)
```

### Why `DocsSidebarWrapper` Exists

The wrapper's **only job** is to pick between `pageTree` and `apiPageTree` based on the URL. Both trees share the identical sidebar rendering pipeline (`DocsSidebarLayout` → `DocsMarketingSidebar`).

### Key Observation: Route-Level Tree Selection Is Possible

The route structure already separates docs from API reference:
- `/docs/[[...slug]]` → general docs
- `/docs/api-reference/[[...slug]]` → API reference

This means the tree selection can happen at the **route segment layout level** rather than via client-side pathname checking, eliminating the need for `DocsSidebarWrapper` entirely.

### All Client Boundaries

Every sidebar component is currently `"use client"`:
- `docs-sidebar-wrapper.tsx` — for `usePathname()`
- `docs-sidebar-layout.tsx` — for `SidebarProvider` (shadcn state)
- `docs-marketing-sidebar.tsx` — for `usePathname()` (active state)
- `docs-sidebar-scroll-area.tsx` — for scroll detection with `useEffect`/`useRef`/`useState`

### Consumers

- `DocsSidebarWrapper` — only imported in `src/app/(docs)/layout.tsx:2`
- `DocsSidebarLayout` — only imported in `docs-sidebar-wrapper.tsx:4`
- `DocsMarketingSidebar` — only imported in `docs-sidebar-layout.tsx:6`
- `DocsSidebarScrollArea` — only imported in `docs-marketing-sidebar.tsx:17`

## Code References

- `apps/docs/src/app/(docs)/layout.tsx:1-12` — Server layout passing both trees
- `apps/docs/src/components/docs-sidebar-wrapper.tsx:1-26` — Client wrapper (tree selection)
- `apps/docs/src/components/docs-sidebar-layout.tsx:1-77` — Client page shell
- `apps/docs/src/components/docs-marketing-sidebar.tsx:1-122` — Client tree renderer
- `apps/docs/src/components/docs-sidebar-scroll-area.tsx:1-57` — Client scroll area
- `apps/docs/src/lib/source.ts:1-25` — fumadocs loader config
- `apps/docs/source.config.ts:1-77` — MDX source definitions

## Related Research

- `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md`
