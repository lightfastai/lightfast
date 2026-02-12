# Dynamic GridSection Component Implementation Plan

## Overview

Create a reusable `<GridSection>` component that encapsulates the sophisticated grid system currently implemented inline in the landing page (~380 lines). This component will support double-line borders, borderless zones, content overlays, and cell content rendering—enabling consistent grid-based layouts across the landing page hero, LissajousHero, footer, and CTA sections.

## Current State Analysis

### Existing Implementations
1. **Hero Grid** (`page.tsx:263-637`): 9x7 grid with borderless zones, complex L-shape overlays via clip-path, ~380 lines
2. **Footer Grid** (`app-footer.tsx:152-193`): 1x9 grid with Lissajous patterns in cells, ~40 lines
3. **CTA Grid** (`page.tsx:757-784`): 6x12 interactive grid with hover states, ~30 lines

### Code Duplication
- Border computation logic duplicated between hero and footer
- Cell generation loops repeated in all three
- Responsive visibility logic (`hidden md:block`) repeated
- Edge detection patterns identical

### LissajousHero Gap
Currently uses absolute positioning and fixed 16:9 aspect ratio—not grid-aware.

## Desired End State

A `<GridSection>` component in `apps/www/src/components/grid-section.tsx` that:

1. **Renders configurable grids** with 1:1 aspect-square cells
2. **Supports three border variants**: `double-line` (hero/footer), `simple` (CTA), `none`
3. **Handles borderless zones** via cell address Set
4. **Accepts cell content** via render function for per-cell customization
5. **Enables content overlays** as children positioned via grid coordinates
6. **Provides debug mode** with cell coordinate labels
7. **Is fully responsive** with mobile column configuration

### Verification
- Landing page hero refactored to use `<GridSection>` with identical visual output
- Footer refactored to use `<GridSection>` with identical visual output
- LissajousHero converted to grid-aware layout using `<GridSection>`
- All existing visual tests pass (if any)
- Lighthouse performance score unchanged or improved

## What We're NOT Doing

- Extracting non-aspect-square grids (platform-access-cards, feature-visuals-tabs, etc.)
- Creating a generic CSS Grid utility (this is specifically for the bordered cell pattern)
- Adding animation/transition capabilities beyond existing hover states
- Supporting non-rectangular cell shapes (clip-path stays in consuming components)

## Implementation Approach

Create the component with a composable API:
- Grid container handles cell generation and border computation
- Cell content via render prop for flexibility
- Children used for overlay content with grid positioning
- Variants handle common configurations (hero, footer, cta)

## Phase 1: Create GridSection Component

### Overview
Build the core `<GridSection>` component with all configuration options.

### Changes Required:

#### 1. Create GridSection Component
**File**: `apps/www/src/components/grid-section.tsx` (new file)

```tsx
"use client";

import { type ReactNode, useMemo } from "react";
import { cn } from "@repo/ui/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface GridSectionProps {
  /** Number of rows */
  rows: number;
  /** Number of columns (desktop) */
  cols: number;
  /** Number of columns on mobile (default: 4) */
  mobileCols?: number;
  /** Gap between cells (default: "8px") */
  gap?: string;
  /** Border variant */
  borderVariant?: "double-line" | "simple" | "none";
  /** Border color class (default: "border-border") */
  borderColorClass?: string;
  /** Show outer container border (default: true) */
  outerBorder?: boolean;
  /** Cell background class (default: "bg-background") */
  cellBackground?: string;
  /** Set of cell addresses "row-col" to make borderless */
  borderlessZone?: Set<string>;
  /** Enable interactive hover states */
  interactive?: boolean;
  /** Hover background class when interactive */
  hoverClass?: string;
  /** Show debug coordinate labels */
  showLabels?: boolean;
  /** Render function for cell content */
  renderCell?: (row: number, col: number) => ReactNode;
  /** Additional className for container */
  className?: string;
  /** Children rendered as overlays (use grid positioning) */
  children?: ReactNode;
}

// ============================================================================
// BORDER COMPUTATION
// ============================================================================

interface BorderConfig {
  row: number;
  col: number;
  totalRows: number;
  totalCols: number;
  mobileCols: number;
  borderlessZone: Set<string>;
  borderColorClass: string;
}

function computeDoubleBorders(config: BorderConfig): string {
  const {
    row,
    col,
    totalRows,
    totalCols,
    mobileCols,
    borderlessZone,
    borderColorClass,
  } = config;

  const isInZone = (r: number, c: number) => borderlessZone.has(`${r}-${c}`);
  const inZone = isInZone(row, col);
  const aboveInZone = isInZone(row - 1, col);
  const belowInZone = isInZone(row + 1, col);
  const leftInZone = isInZone(row, col - 1);
  const rightInZone = isInZone(row, col + 1);

  const isTopEdge = row === 1;
  const isBottomEdge = row === totalRows;
  const isLeftEdge = col === 1;
  const isRightEdgeDesktop = col === totalCols;
  const isRightEdgeMobile = col === mobileCols;

  const classes: string[] = [];

  // Top border
  if (!isTopEdge && !(inZone && aboveInZone)) {
    classes.push(`border-t ${borderColorClass.replace("border-", "border-t-")}`);
  }

  // Bottom border
  if (!isBottomEdge && !(inZone && belowInZone)) {
    classes.push(`border-b ${borderColorClass.replace("border-", "border-b-")}`);
  }

  // Left border
  if (!isLeftEdge && !(inZone && leftInZone)) {
    classes.push(`border-l ${borderColorClass.replace("border-", "border-l-")}`);
  }

  // Right border (responsive)
  if (col <= mobileCols) {
    if (!isRightEdgeMobile && !(inZone && rightInZone)) {
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    }
    if (isRightEdgeMobile && !isRightEdgeDesktop && !(inZone && rightInZone)) {
      classes.push(`md:border-r md:${borderColorClass.replace("border-", "border-r-")}`);
    }
  } else {
    if (!isRightEdgeDesktop && !(inZone && rightInZone)) {
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    }
  }

  return classes.join(" ");
}

function computeSimpleBorders(borderColorClass: string): string {
  return `border ${borderColorClass}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GridSection({
  rows,
  cols,
  mobileCols = 4,
  gap = "8px",
  borderVariant = "double-line",
  borderColorClass = "border-border",
  outerBorder = true,
  cellBackground = "bg-background",
  borderlessZone = new Set<string>(),
  interactive = false,
  hoverClass = "",
  showLabels = false,
  renderCell,
  className,
  children,
}: GridSectionProps) {
  // Generate cells
  const cells = useMemo(() => {
    const result: ReactNode[] = [];

    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      const row = rowIdx + 1; // 1-indexed

      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const col = colIdx + 1; // 1-indexed
        const isMobileVisible = col <= mobileCols;

        // Compute border classes based on variant
        let borderClasses = "";
        if (borderVariant === "double-line") {
          borderClasses = computeDoubleBorders({
            row,
            col,
            totalRows: rows,
            totalCols: cols,
            mobileCols,
            borderlessZone,
            borderColorClass,
          });
        } else if (borderVariant === "simple") {
          borderClasses = computeSimpleBorders(borderColorClass);
        }

        // Visibility class
        const visibilityClass = !isMobileVisible
          ? showLabels
            ? "hidden md:flex"
            : "hidden md:block"
          : "";

        // Interactive class
        const interactiveClass = interactive
          ? `transition-colors duration-1000 hover:duration-75 ${hoverClass}`
          : "";

        result.push(
          <div
            key={`cell-${row}-${col}`}
            data-cell={`${row}-${col}`}
            className={cn(
              cellBackground,
              "aspect-square",
              borderClasses,
              visibilityClass,
              interactiveClass,
              showLabels && "flex items-center justify-center"
            )}
            style={{ gridRow: row, gridColumn: col }}
          >
            {showLabels && (
              <span className="text-xs text-muted-foreground/50 font-mono">
                {row}-{col}
              </span>
            )}
            {renderCell?.(row, col)}
          </div>
        );
      }
    }

    return result;
  }, [
    rows,
    cols,
    mobileCols,
    borderVariant,
    borderColorClass,
    cellBackground,
    borderlessZone,
    interactive,
    hoverClass,
    showLabels,
    renderCell,
  ]);

  return (
    <section
      className={cn(
        "relative w-full grid content-start",
        outerBorder && `border ${borderColorClass}`,
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${mobileCols}, 1fr)`,
        gap,
      }}
    >
      {/* Responsive columns via CSS custom property approach won't work easily,
          so we use a style tag for md breakpoint */}
      <style jsx>{`
        @media (min-width: 768px) {
          section {
            grid-template-columns: repeat(${cols}, 1fr);
          }
        }
      `}</style>

      {/* Grid cells */}
      {cells}

      {/* Content overlays (children) */}
      {children}
    </section>
  );
}

// ============================================================================
// CONVENIENCE VARIANTS
// ============================================================================

/** Pre-configured variant matching the landing page hero grid */
export function HeroGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant">
) {
  return (
    <GridSection
      rows={7}
      cols={9}
      borderVariant="double-line"
      {...props}
    />
  );
}

/** Pre-configured variant matching the footer grid */
export function FooterGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant">
) {
  return (
    <GridSection
      rows={1}
      cols={9}
      borderVariant="double-line"
      {...props}
    />
  );
}

/** Pre-configured variant matching the CTA grid */
export function CTAGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant" | "interactive">
) {
  return (
    <GridSection
      rows={6}
      cols={12}
      borderVariant="simple"
      interactive
      outerBorder
      {...props}
    />
  );
}
```

**Note on styled-jsx**: If styled-jsx is not available, we'll use a different approach—either a wrapper div with responsive classes or CSS variables with Tailwind arbitrary values.

#### 2. Add barrel export
**File**: `apps/www/src/components/index.ts` (if exists, otherwise skip)

```tsx
export * from "./grid-section";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @app/www typecheck`
- [x] Linting passes: `pnpm --filter @app/www lint`
- [ ] Component renders without runtime errors (verify in dev server)

#### Manual Verification:
- [ ] Create a test page at `/unicorn-test` to render GridSection with debug labels
- [ ] Verify cells render correctly with expected borders
- [ ] Verify mobile responsiveness (4 cols on small screens)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Refactor Footer to Use GridSection

### Overview
Replace the inline footer grid implementation with GridSection to validate the component works for the simplest use case.

### Changes Required:

#### 1. Update AppFooter Component
**File**: `apps/www/src/components/app-footer.tsx`

Replace lines 152-193 with:

```tsx
import { GridSection } from "./grid-section";
import { Lissajous } from "./lissajous";

// In the component, replace the grid section with:
<div className="w-full py-16 px-8 md:px-16 lg:px-24">
  <GridSection
    rows={1}
    cols={9}
    borderVariant="double-line"
    renderCell={(row, col) => {
      const pattern = FOOTER_PATTERNS[col - 1]; // 1-indexed to 0-indexed
      if (!pattern) return null;
      return (
        <div className="flex items-center justify-center p-4 w-full h-full">
          <Lissajous
            a={pattern.a}
            b={pattern.b}
            delta={pattern.delta}
            className="w-full h-full"
            stroke="var(--border)"
            strokeWidth={1.5}
          />
        </div>
      );
    }}
  />
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @app/www typecheck`
- [x] Linting passes: `pnpm --filter @app/www lint`

#### Manual Verification:
- [ ] Footer grid visually identical to before refactor
- [ ] Lissajous patterns render in each cell
- [ ] Mobile view shows 4 columns correctly
- [ ] Double-line borders visible between cells

**Implementation Note**: Pause here for visual regression check.

---

## Phase 3: Convert LissajousHero to Grid-Aware Layout

### Overview
Restructure LissajousHero to use GridSection, placing "Read our blog" text in designated cells and distributing Lissajous patterns across the remaining cells.

### Design Decision
- **Grid size**: 7 columns × 5 rows (matches 5x5 Lissajous + text area)
- **Text placement**: Rows 1-2, columns 1-2 (4 cells, borderless zone)
- **Lissajous placement**: Remaining cells in rows 1-5, cols 3-7

### Changes Required:

#### 1. Update LissajousHero Component
**File**: `apps/www/src/components/lissajous-hero.tsx`

```tsx
import { GridSection } from "./grid-section";
import { Lissajous } from "./lissajous";

export function LissajousHero() {
  // 5x5 grid of lissajous patterns (same as before)
  const patterns = [
    [{ a: 1, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 3 }, { a: 3, b: 4 }, { a: 3, b: 5 }],
    [{ a: 1, b: 4 }, { a: 2, b: 5 }, { a: 3, b: 2 }, { a: 4, b: 3 }, { a: 5, b: 4 }],
    [{ a: 2, b: 1 }, { a: 3, b: 1 }, { a: 4, b: 1 }, { a: 5, b: 2 }, { a: 4, b: 5 }],
    [{ a: 5, b: 3 }, { a: 3, b: 7 }, { a: 5, b: 6 }, { a: 7, b: 4 }, { a: 5, b: 7 }],
    [{ a: 7, b: 5 }, { a: 4, b: 7 }, { a: 6, b: 5 }, { a: 7, b: 6 }, { a: 8, b: 7 }],
  ];

  // Text occupies rows 1-2, cols 1-2 (borderless zone)
  const borderlessZone = new Set<string>([
    "1-1", "1-2",
    "2-1", "2-2",
  ]);

  // Map grid position to pattern (cols 3-7 contain Lissajous)
  const getPattern = (row: number, col: number) => {
    if (col < 3) return null; // Text zone
    const patternRow = row - 1; // 0-indexed
    const patternCol = col - 3; // Cols 3-7 → indices 0-4
    return patterns[patternRow]?.[patternCol] ?? null;
  };

  return (
    <div className="relative w-full bg-muted rounded-sm overflow-hidden">
      <GridSection
        rows={5}
        cols={7}
        mobileCols={4}
        borderVariant="double-line"
        borderColorClass="border-border/50"
        outerBorder={false}
        cellBackground="bg-transparent"
        borderlessZone={borderlessZone}
        renderCell={(row, col) => {
          const pattern = getPattern(row, col);
          if (!pattern) return null;
          return (
            <div className="flex items-center justify-center p-2 w-full h-full">
              <Lissajous
                a={pattern.a}
                b={pattern.b}
                strokeWidth={0.8}
                className="w-full h-full text-foreground"
              />
            </div>
          );
        }}
      >
        {/* Text overlay - positioned in grid */}
        <div
          className="z-10 flex items-start p-8 md:p-12"
          style={{
            gridColumn: "1 / 3",
            gridRow: "1 / 3",
          }}
        >
          <h3 className="text-2xl md:text-4xl lg:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-foreground">
            Read our
            <br />
            blog
          </h3>
        </div>
      </GridSection>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @app/www typecheck`
- [x] Linting passes: `pnpm --filter @app/www lint`

#### Manual Verification:
- [ ] LissajousHero renders with grid-based layout
- [ ] "Read our blog" text appears in top-left area
- [ ] Lissajous patterns fill remaining cells
- [ ] Mobile view shows appropriate columns (4 cols)
- [ ] Grid lines visible between Lissajous cells
- [ ] Text area has no internal grid lines (borderless zone works)

**Implementation Note**: Pause here for visual review. The design may need iteration on:
- Cell padding for Lissajous curves
- Border color/weight
- Text positioning within cells

---

## Phase 4: Refactor Landing Page Hero Grid (Optional)

### Overview
Replace the 380-line inline hero grid implementation with GridSection. This phase is optional—only proceed if the simpler use cases work correctly.

### Changes Required:

#### 1. Update Landing Page
**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

Replace lines 252-637 with approximately:

```tsx
{!DISABLE_HERO_GRID && (
  <GridSection
    rows={7}
    cols={9}
    borderVariant="double-line"
    showLabels={SHOW_GRID_LABELS}
    className="max-w-7xl mx-auto"
  >
    {/* Hero text overlay */}
    <div
      className="z-10 flex items-center relative"
      style={{ gridColumn: "1 / 5", gridRow: 2 }}
    >
      {/* Corner accents and h1 content */}
    </div>

    {/* Unicorn scene overlay with clip-path */}
    <div
      className="z-10 hidden md:block overflow-hidden relative"
      style={{
        gridColumn: "4 / 10",
        gridRow: "1 / 7",
        clipPath: "polygon(...)",
      }}
    >
      <UnicornScene ... />
    </div>
  </GridSection>
)}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @app/www typecheck`
- [ ] Linting passes: `pnpm --filter @app/www lint`

#### Manual Verification:
- [ ] Hero grid renders identically to before (when `DISABLE_HERO_GRID = false`)
- [ ] Content overlays (text, Unicorn scene) positioned correctly
- [ ] Clip-path L-shape renders correctly
- [ ] Mobile view shows 4 columns
- [ ] Debug labels work when enabled

---

## Phase 5: Refactor CTA Grid (Optional)

### Overview
Replace the CTA grid with GridSection to demonstrate the interactive variant.

### Changes Required:

#### 1. Update CTA Section
**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

Replace lines 757-784 with:

```tsx
<section className="relative w-full h-fit p-4 bg-[var(--pitch-deck-red)] overflow-hidden">
  <GridSection
    rows={6}
    cols={12}
    borderVariant="simple"
    borderColorClass="border-[var(--pitch-deck-red-overlay)]/30"
    cellBackground="bg-transparent"
    interactive
    hoverClass="hover:bg-[var(--pitch-deck-red-overlay)]"
  />

  {/* Centered content - absolute positioned over grid */}
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 pointer-events-none">
    {/* Logo and text */}
  </div>
</section>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @app/www typecheck`
- [x] Linting passes: `pnpm --filter @app/www lint` (pre-existing errors in file, none from this change)

#### Manual Verification:
- [ ] CTA grid renders with red overlay styling
- [ ] Hover states work on individual cells
- [ ] Transition timing matches original (1000ms default, 75ms hover)
- [ ] Content centered over grid

---

## Testing Strategy

### Unit Tests
- GridSection renders correct number of cells for given rows/cols
- Border computation produces expected classes for edge cells
- Borderless zone removes borders between specified cells
- Mobile columns hide correctly

### Integration Tests
- Full page render without hydration errors
- Grid responsive behavior at different breakpoints

### Manual Testing Steps
1. Navigate to landing page, verify footer grid looks correct
2. Scroll to LissajousHero section, verify grid-based layout
3. Resize browser to test responsive breakpoints
4. Enable `SHOW_GRID_LABELS` flag and verify coordinate display
5. Compare screenshots before/after refactor for visual regression

## Performance Considerations

- Cell generation uses `useMemo` to avoid recalculation on re-renders
- Border computation is O(1) per cell, total O(rows × cols)
- No additional runtime dependencies
- CSS-only responsive behavior (no JS breakpoint detection)

## Migration Notes

- Footer and LissajousHero can be migrated independently
- Landing page hero grid migration is optional and can be deferred
- Existing `DISABLE_HERO_GRID` and `SHOW_GRID_LABELS` flags preserved
- No breaking changes to public component APIs

## Open Questions Resolved

1. **Grid dimensions for LissajousHero**: 7x5 grid (text in cols 1-2, Lissajous in cols 3-7)
2. **Border style**: Double-line with lighter border color (`border-border/50`)
3. **Responsive behavior**: Mobile shows 4 columns, Lissajous patterns in cols 3-4 visible
4. **Text placement**: Rows 1-2, cols 1-2 as borderless zone with overlay positioning

## References

- Research document: `thoughts/shared/research/2026-01-30-dynamic-grid-line-system.md`
- Landing page grid: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:254-637`
- Footer grid: `apps/www/src/components/app-footer.tsx:152-193`
- LissajousHero: `apps/www/src/components/lissajous-hero.tsx`
- Base Lissajous: `apps/www/src/components/lissajous.tsx`
