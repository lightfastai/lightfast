---
date: 2026-01-30T12:00:00+11:00
researcher: Claude
git_commit: a82298d26b74c63e4d1a5be96dbc9a7a283e1541
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Footer Grid Layout Rework - Centering Right Side Items"
tags: [research, codebase, footer, grid-layout, css]
status: complete
last_updated: 2026-01-30
last_updated_by: Claude
---

# Research: Footer Grid Layout Rework

**Date**: 2026-01-30T12:00:00+11:00
**Researcher**: Claude
**Git Commit**: a82298d26b74c63e4d1a5be96dbc9a7a283e1541
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question
Rework `apps/www/src/components/app-footer.tsx` to:
1. Use 2-column grid to split left (logo/copyright) and right (nav links)
2. Nav links section uses 3-column grid to distribute Product, Resources, Connect evenly
3. Bottom bar uses 2-column grid (left: copyright, right: legal + location)
4. Legal section uses 3-column grid: col 1 = Contact/Privacy/Terms, col 2 = empty, col 3 = Built in Melbourne

## Summary

The current footer uses `grid-cols-[1fr_140px_140px_140px]` which pushes nav columns to the far right with fixed widths. The proposed layout uses nested grids to center the right-side content more towards the middle.

## Current Implementation

### File: `apps/www/src/components/app-footer.tsx`

**Current Main Content Grid (lines 25-113):**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 pt-16 pb-32">
  {/* Logo - col-span-2 on mobile, 1 on desktop */}
  <div className="col-span-2 lg:col-span-1">
    <Logo />
  </div>

  {/* Product, Resources, Connect - each 140px fixed width */}
  <div>Product nav...</div>
  <div>Resources nav...</div>
  <div>Connect nav...</div>
</div>
```

**Current Bottom Bar Grid (lines 116-148):**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 py-6">
  {/* Copyright - col-span-2 on mobile, 1 on desktop */}
  <p className="col-span-2 lg:col-span-1">© Lightfast 2026</p>

  {/* Legal links - col-span-2 */}
  <nav className="col-span-2">Contact | Privacy | Terms</nav>

  {/* Location - aligned right */}
  <p className="text-right">Built in Melbourne</p>
</div>
```

**Issues with Current Layout:**
- Fixed 140px columns push nav links to far right edge
- No flexibility for centering nav content
- Bottom bar legal links don't align well with nav columns above

## Proposed Implementation

### Main Content Section

Use a 2-column split (1fr + 1fr or similar), then nest a 3-column grid inside the right side:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-16 pb-32">
  {/* Left: Logo */}
  <div>
    <Logo />
  </div>

  {/* Right: Nav columns in 3-column grid */}
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
    <div>Product nav...</div>
    <div>Resources nav...</div>
    <div>Connect nav...</div>
  </div>
</div>
```

### Bottom Bar Section

Use 2-column split, with right side containing a 3-column grid for legal + location:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 py-6">
  {/* Left: Copyright */}
  <p>© Lightfast 2026</p>

  {/* Right: Legal + Location in 3-column grid */}
  <div className="grid grid-cols-3 gap-8">
    {/* Col 1: Contact, Privacy, Terms */}
    <nav className="flex flex-wrap gap-x-6 gap-y-2">
      <a>Contact</a>
      <a>Privacy</a>
      <a>Terms</a>
    </nav>

    {/* Col 2: Empty spacer */}
    <div></div>

    {/* Col 3: Built in Melbourne */}
    <p className="text-right">Built in Melbourne</p>
  </div>
</div>
```

## Related Patterns Found in Codebase

### Pattern: 3-Column Grid with col-span-2 (feature-showcase.tsx:34-61)
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
  <div>{/* 1/3 width */}</div>
  <div className="lg:col-span-2">{/* 2/3 width */}</div>
</div>
```

### Pattern: 12-Column Grid with Offset (faq-section.tsx:62-128)
```tsx
<div className="grid grid-cols-1 md:grid-cols-12 gap-8">
  <div className="md:col-span-2">{/* Left label */}</div>
  <div className="md:col-span-10 md:col-start-3">{/* Right content */}</div>
</div>
```

### Pattern: Simple 3-Column Grid (pricing/page.tsx)
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  <div>{/* Card 1 */}</div>
  <div>{/* Card 2 */}</div>
  <div>{/* Card 3 */}</div>
</div>
```

## Code References

- `apps/www/src/components/app-footer.tsx:25-113` - Main footer content grid
- `apps/www/src/components/app-footer.tsx:116-148` - Bottom bar grid
- `apps/www/src/components/feature-showcase.tsx:34-61` - 3-column split pattern
- `apps/www/src/components/faq-section.tsx:62-128` - 12-column grid pattern
- `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx:316-451` - Nested grid patterns

## Architecture Documentation

The codebase uses several grid patterns:
1. **Fixed-width columns**: `grid-cols-[1fr_140px_140px_140px]` - precise control
2. **Fractional columns**: `grid-cols-3` with `col-span-2` - flexible ratios
3. **12-column system**: `grid-cols-12` with `col-span-*` - fine-grained control
4. **Nested grids**: Outer grid for left/right split, inner grid for subdivisions

## Implementation Notes

For the footer rework:
1. Remove fixed 140px column widths
2. Use 2-column outer grid for left/right split
3. Nest 3-column grid inside right section for nav columns
4. Apply same pattern to bottom bar for alignment
5. Consider using gap utilities to control spacing between columns
6. Mobile: Stack vertically with `grid-cols-1` fallback

## Open Questions

1. Should the 2-column split be 50/50 or use different ratios (e.g., 1fr/2fr)?
2. What gap sizes work best for the nested grids?
3. Should the nav columns have min-widths to prevent wrapping on medium screens?
