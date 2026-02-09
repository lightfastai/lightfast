# Footer Grid Layout Rework Implementation Plan

## Overview

Rework the footer component (`apps/www/src/components/app-footer.tsx`) to center the right-side navigation content using nested grids instead of fixed-width columns. This improves visual balance by distributing nav columns more evenly across the available space.

## Current State Analysis

**File**: `apps/www/src/components/app-footer.tsx`

The current implementation uses:
- Main content: `grid-cols-[1fr_140px_140px_140px]` (line 25)
- Bottom bar: Same grid structure (line 116)

**Issues:**
1. Fixed 140px columns push nav links to the far right edge
2. No flexibility for centering nav content within the right half
3. Bottom bar legal links (`col-span-2` on line 123) don't align well with nav columns above
4. "Built in Melbourne" sits alone in the last column

### Key Discoveries:
- Main footer grid: `app-footer.tsx:25-113`
- Bottom bar grid: `app-footer.tsx:116-148`
- Logo uses `col-span-2` on mobile, `col-span-1` on desktop (line 27)
- The Lissajous grid section (lines 151-193) is separate and unchanged by this rework

## Desired End State

After implementation:
1. Logo/copyright occupies the left half of the footer
2. Nav columns (Product, Resources, Connect) are evenly distributed across the right half
3. Bottom bar legal links align with the first nav column above
4. "Built in Melbourne" aligns with the last nav column (Connect)
5. Mobile layout stacks all elements vertically (unchanged behavior)

**Verification:**
- Visual inspection shows nav columns centered in right half, not pushed to far edge
- Bottom bar elements align with their corresponding columns above
- Mobile breakpoint maintains stacked layout

## What We're NOT Doing

- Changing the Lissajous grid section at the bottom
- Modifying mobile-specific styles beyond grid inheritance
- Changing any link destinations, text content, or styling
- Adjusting padding/margins of the outer container

## Implementation Approach

Replace the current 4-column grid with a 2-column outer grid, then nest a 3-column grid inside the right section. This gives 50% width to the logo/copyright and distributes the remaining 50% evenly across the three nav columns.

---

## Phase 1: Main Content Grid Rework

### Overview
Convert the main footer content from a 4-column fixed-width grid to a 2-column layout with a nested 3-column grid for nav sections.

### Changes Required:

#### 1. Main Content Grid Structure
**File**: `apps/www/src/components/app-footer.tsx`
**Lines**: 25-113

**Before:**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 pt-16 pb-32">
  {/* Logo - first column */}
  <div className="col-span-2 lg:col-span-1">
    ...
  </div>

  {/* Product Column */}
  <div className="flex flex-col gap-3">
    ...
  </div>

  {/* Resources Column */}
  <div className="flex flex-col gap-3">
    ...
  </div>

  {/* Connect Column */}
  <div className="flex flex-col gap-3">
    ...
  </div>
</div>
```

**After:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-16 pb-32">
  {/* Logo - left column */}
  <div>
    <NextLink href="/" aria-label="Lightfast">
      <Icons.logoShort className="h-4 w-auto text-foreground" />
    </NextLink>
  </div>

  {/* Nav columns - right column with nested 3-column grid */}
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
    {/* Product Column */}
    <div className="flex flex-col gap-3">
      ...
    </div>

    {/* Resources Column */}
    <div className="flex flex-col gap-3">
      ...
    </div>

    {/* Connect Column */}
    <div className="flex flex-col gap-3">
      ...
    </div>
  </div>
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm --filter @lightfast/www build`

#### Manual Verification:
- [x] Desktop (lg+): Logo on left, 3 nav columns evenly distributed on right
- [x] Tablet/Medium: Nav columns should be 2x2 grid or similar responsive layout
- [x] Mobile: All elements stack vertically
- [x] No visual regression in nav link styling or spacing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the layout looks correct before proceeding to Phase 2.

---

## Phase 2: Bottom Bar Grid Rework

### Overview
Apply the same 2-column + nested 3-column pattern to the bottom bar for proper alignment with the main content above.

### Changes Required:

#### 1. Bottom Bar Grid Structure
**File**: `apps/www/src/components/app-footer.tsx`
**Lines**: 116-148

**Before:**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px] gap-8 lg:gap-12 py-6">
  {/* Copyright - first column */}
  <p className="text-muted-foreground text-sm col-span-2 lg:col-span-1">
    © {siteConfig.name} {new Date().getFullYear()}
  </p>

  {/* Legal Links - aligns with Product column */}
  <nav className="flex items-center gap-6 col-span-2">
    <NextLink ...>Contact</NextLink>
    <NextLink ...>Privacy</NextLink>
    <NextLink ...>Terms</NextLink>
  </nav>

  {/* Location - aligns with Connect column */}
  <p className="text-muted-foreground text-sm text-right">
    Built in Melbourne
  </p>
</div>
```

**After:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 py-6">
  {/* Copyright - left column */}
  <p className="text-muted-foreground text-sm">
    © {siteConfig.name} {new Date().getFullYear()}
  </p>

  {/* Right column with nested 3-column grid */}
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
    {/* Col 1: Legal links (aligns with Product nav above) */}
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 col-span-2 lg:col-span-1">
      <NextLink
        href={`mailto:${emailConfig.hello}`}
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        Contact
      </NextLink>
      <NextLink
        href="/legal/privacy"
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        Privacy
      </NextLink>
      <NextLink
        href="/legal/terms"
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        Terms
      </NextLink>
    </nav>

    {/* Col 2: Empty spacer (aligns with Resources nav above) */}
    <div className="hidden lg:block" />

    {/* Col 3: Location (aligns with Connect nav above) */}
    <p className="text-muted-foreground text-sm lg:text-right">
      Built in Melbourne
    </p>
  </div>
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm --filter @lightfast/www build`

#### Manual Verification:
- [ ] Desktop: Legal links align under Product column, "Built in Melbourne" aligns under Connect column
- [ ] Mobile: Copyright, legal links, and location stack appropriately
- [ ] No visual regression in link styling or hover states

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before finalizing.

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev server: `pnpm dev:www`
2. Navigate to homepage and scroll to footer
3. Resize browser from mobile (< 1024px) to desktop (>= 1024px)
4. Verify:
   - Logo stays on left half at desktop width
   - Nav columns are evenly spaced in right half
   - Bottom bar elements align with corresponding columns above
   - All links are clickable and functional
   - Hover states work correctly

### Responsive Breakpoints to Test:
- Mobile: 375px, 414px
- Tablet: 768px
- Desktop: 1024px, 1280px, 1440px

## Performance Considerations

None - this is a CSS-only change with no impact on JavaScript bundle size or runtime performance.

## References

- Research document: `thoughts/shared/research/2026-01-30-footer-grid-layout-rework.md`
- Current footer implementation: `apps/www/src/components/app-footer.tsx:25-148`
- Similar grid patterns: `apps/www/src/components/feature-showcase.tsx:34-61`
