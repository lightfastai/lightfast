---
date: 2026-01-31T12:07:35+11:00
researcher: Claude
git_commit: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Hydration mismatch in NavigationMenu, Sheet, and GridSection components"
tags: [research, codebase, hydration, radix-ui, navigation, grid-section, ssr]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Hydration Mismatch in NavigationMenu, Sheet, and GridSection Components

**Date**: 2026-01-31T12:07:35+11:00
**Researcher**: Claude
**Git Commit**: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question

Investigate the hydration mismatch error occurring in the www app involving:
1. Radix UI NavigationMenu components (different trigger/control IDs between server and client)
2. Radix UI Sheet components (different aria-controls IDs)
3. GridSection component (different style tag content due to useId)

## Summary

The hydration mismatch occurs because Radix UI components generate unique IDs using React's `useId` hook internally, and the GridSection component also uses `useId` for scoped styles. The mismatched IDs in the error trace show:

- **NavigationMenu**: `radix-_R_p6itqbmamlb_-trigger-...` vs `radix-_R_69kneitimlb_-trigger-...`
- **Sheet**: `radix-_R_m6itqbmamlb_` vs `radix-_R_5hkneitimlb_`
- **GridSection**: `grid_R_159bn5raitqbmamlb_` vs `grid_R_9aatpeqkneitimlb_`

These ID mismatches indicate that the React component tree is being rendered in a different order or context between server and client, causing `useId` to generate different values.

## Detailed Findings

### 1. GridSection Component

**Location**: `apps/www/src/components/grid-section.tsx`

**Implementation**:
- Line 1: Marked as `"use client"` directive
- Line 4: Imports `useId` from React
- Line 152: Generates unique ID: `const gridId = useId().replace(/:/g, "-")`
- Lines 237-246: Uses ID in inline `<style>` tag for scoped responsive CSS
- Line 249: Binds ID to element: `id={`grid${gridId}`}`

**Style Tag Output** (lines 237-246):
```tsx
<style>{`
  #grid${gridId} {
    grid-template-columns: repeat(${mobileCols}, 1fr);
  }
  @media (min-width: 768px) {
    #grid${gridId} {
      grid-template-columns: repeat(${cols}, 1fr);
    }
  }
`}</style>
```

**Usage Locations**:
- `apps/www/src/components/lissajous-hero.tsx:84-123` (client component)
- `apps/www/src/components/app-footer.tsx:165` (client component)
- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:775` (server component importing client component)

### 2. Radix UI NavigationMenu

**Wrapper Component**: `packages/ui/src/components/ui/navigation-menu.tsx`
- Line 2: Imports `@radix-ui/react-navigation-menu`
- Lines 8-30: NavigationMenu root with custom `viewport` prop
- Lines 65-83: NavigationMenuTrigger with chevron icon

**Usage in AppNavbarV2**: `apps/www/src/components/app-navbar-v2.tsx`
- Lines 37-62: Resources dropdown menu
- Line 37: Uses `viewport={false}` to disable portal viewport

**Usage in AppNavMenu**: `apps/www/src/components/app-nav-menu.tsx`
- Lines 23-46: Features dropdown
- Lines 49-81: Resources dropdown
- Both use `viewport={false}`

**Radix Internal ID Generation**:
Radix NavigationMenu internally uses `useId` to generate unique IDs for:
- Trigger elements (`id="radix-...-trigger-..."`)
- Content elements (`aria-controls="radix-...-content-..."`)

### 3. Radix UI Sheet (Dialog)

**Wrapper Component**: `packages/ui/src/components/ui/sheet.tsx`
- Line 4: Imports `@radix-ui/react-dialog`
- Line 141: Exports `SheetPrimitive` for direct primitive access

**Usage in AppMobileNav**: `apps/www/src/components/app-mobile-nav.tsx`
- Line 23: Uses `useState` for controlled open/close state
- Line 26: Sheet root component
- Lines 27-36: SheetTrigger with Menu icon
- Line 37: SheetPrimitive.Portal
- Line 38: SheetPrimitive.Overlay
- Line 39: SheetPrimitive.Content

**Radix Internal ID Generation**:
Radix Dialog internally uses `useId` to generate IDs for:
- Dialog content (`aria-controls="radix-..."`)
- Accessible labelledby references

### 4. MarketingLayout Structure

**Location**: `apps/www/src/app/(app)/(marketing)/layout.tsx`

**Component Hierarchy**:
```
MarketingLayout (Server Component)
├── AppNavbarV2 (Server Component)
│   ├── NavigationMenu with Resources dropdown (Client - Radix)
│   └── AppMobileNav (Client Component)
│       └── Sheet (Client - Radix Dialog)
├── Main Content (children)
└── AppFooter (Client Component)
    └── GridSection (Client Component)
```

### 5. Landing Page Component Tree

**Location**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

**Component Hierarchy**:
```
HomePage (Server Component)
└── LissajousHero (Client Component)
    └── GridSection (Client Component)
        ├── <style> with useId-generated selector
        └── <section id={gridId}>
```

## Code References

### GridSection useId Implementation
- `apps/www/src/components/grid-section.tsx:4` - useId import
- `apps/www/src/components/grid-section.tsx:152` - ID generation
- `apps/www/src/components/grid-section.tsx:237-246` - Inline style tag
- `apps/www/src/components/grid-section.tsx:249` - Element ID binding

### NavigationMenu Components
- `packages/ui/src/components/ui/navigation-menu.tsx:2` - Radix import
- `packages/ui/src/components/ui/navigation-menu.tsx:65-83` - Trigger with internal useId
- `apps/www/src/components/app-navbar-v2.tsx:37-62` - Resources dropdown usage

### Sheet Components
- `packages/ui/src/components/ui/sheet.tsx:4` - Radix Dialog import
- `apps/www/src/components/app-mobile-nav.tsx:26-157` - Sheet implementation
- `apps/www/src/components/app-mobile-nav.tsx:27-36` - SheetTrigger with internal useId

### Layout Components
- `apps/www/src/app/(app)/(marketing)/layout.tsx:14` - AppNavbarV2 render
- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:775` - GridSection usage

## Architecture Documentation

### Client/Server Boundary Pattern

The www app uses Next.js 15 App Router with a clear client/server boundary:

1. **Server Components** (default):
   - `apps/www/src/app/(app)/(marketing)/layout.tsx`
   - `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

2. **Client Components** (marked with `"use client"`):
   - `apps/www/src/components/grid-section.tsx`
   - `apps/www/src/components/lissajous-hero.tsx`
   - `apps/www/src/components/app-mobile-nav.tsx`
   - `apps/www/src/components/app-nav-menu.tsx`
   - `apps/www/src/components/app-footer.tsx`

### Radix UI ID Generation Pattern

Radix UI components use React's `useId` hook internally to generate unique, stable IDs for accessibility attributes. These IDs are designed to be consistent between SSR and client hydration when the React tree structure is identical.

### Scoped Styles Pattern

GridSection uses a pattern of inline `<style>` tags with `useId`-generated selectors to create component-scoped responsive CSS without external stylesheets or CSS-in-JS libraries.

## Historical Context (from thoughts/)

No relevant historical research documents were found in the thoughts/ directory related to this specific hydration issue.

## Related Research

- No prior research documents exist for this specific topic

## Open Questions

1. What is causing the React component tree to render in a different order between server and client?
2. Are there any conditional rendering patterns that could cause component tree differences?
3. Is there a Suspense boundary or dynamic import affecting component render order?
4. Could the microfrontend architecture be affecting hydration consistency?
