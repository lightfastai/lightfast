---
date: 2026-01-30T10:30:00+08:00
researcher: Claude
git_commit: a82298d26b74c63e4d1a5be96dbc9a7a283e1541
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Dynamic Grid Line System for Reusable Sections"
tags: [research, codebase, grid-system, lissajous, components]
status: complete
last_updated: 2026-01-30
last_updated_by: Claude
---

# Research: Dynamic Grid Line System for Reusable Sections

**Date**: 2026-01-30T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: a82298d26b74c63e4d1a5be96dbc9a7a283e1541
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question

How can we convert the landing page grid line system to be more dynamic and reusable across different sections? Specifically, how could the "Read our blog" (LissajousHero) section be converted to use the grid line system, with hero text positioned on the grid and each Lissajous animation placed inside individual cells?

## Summary

The codebase currently has **no reusable grid components**. The sophisticated 9x7 grid system in the landing page (lines 254-637) is implemented inline with ~380 lines of code including extensive documentation. The LissajousHero component is a standalone 16:9 aspect ratio card with absolutely positioned text and a 5x5 grid of Lissajous curves—it is **not grid-aware**.

Two distinct grid patterns exist in the codebase:
1. **Bordered Cell Grid** - Complex double-line borders with borderless zones (hero section, footer)
2. **Interactive Hover Grid** - Simpler cells with hover transitions (CTA section, pitch deck)

To make the LissajousHero use the grid system, the component would need to be restructured to place content within addressable grid cells rather than using absolute positioning.

## Detailed Findings

### Current Grid System Implementation

The landing page grid system (`page.tsx:254-637`) provides:

#### Grid Configuration
- **Desktop**: 9 columns × 7 rows
- **Mobile**: 4 columns × 7 rows
- **Cell aspect ratio**: 1:1 (square via `aspect-square`)
- **Gap**: 8px (creates space for double-line border effect)
- **Outer border**: Single line via container `border border-border`

#### Borderless Zone System (`page.tsx:317-342`)
A `Set<string>` defines cells where internal borders are removed:
```typescript
const borderlessZone = new Set<string>([
  "1-5", "1-6", "1-7", "1-8", "1-9",  // Row 1, cols 5-9
  "2-5", "2-6", "2-7", "2-8", "2-9",  // Row 2, cols 5-9
  // ... etc
]);
```

#### Border Logic (`page.tsx:369-400`)
Each cell's borders are computed based on:
1. Edge detection (top/bottom/left/right edges have no outward border)
2. Borderless zone adjacency (no border between two cells in same zone)
3. Responsive visibility (mobile shows cols 1-4 only)

#### Content Placement Methods (documented at `page.tsx:427-573`)
1. **Single Cell**: Use `style={{ gridColumn: col, gridRow: row }}`
2. **Spanning Cells**: Use `gridColumn: "start / end"` syntax
3. **Complex Shapes**: Use `clip-path` with polygon coordinates
4. **Layered Content**: Use `z-10` to overlay on cell backgrounds

### LissajousHero Component Structure

**Location**: `apps/www/src/components/lissajous-hero.tsx`

Current implementation:
```tsx
<div className="relative w-full aspect-[16/9] bg-muted rounded-sm overflow-hidden">
  {/* Absolute positioned text - top left */}
  <div className="absolute top-8 left-8 md:top-12 md:left-12 z-10">
    <h3>Read our blog</h3>
  </div>

  {/* Absolute positioned grid - bottom right */}
  <div className="absolute right-4 bottom-4 md:right-8 md:bottom-8">
    <div className="grid grid-cols-5 gap-1 md:gap-2 lg:gap-3">
      {patterns.map((row, rowIndex) =>
        row.map((pattern, colIndex) => (
          <Lissajous key={`${rowIndex}-${colIndex}`} a={pattern.a} b={pattern.b} />
        ))
      )}
    </div>
  </div>
</div>
```

**Issues for grid integration**:
- Fixed 16:9 aspect ratio container
- Text uses absolute positioning, not grid cells
- Inner 5x5 grid is self-contained, not using parent grid system
- No awareness of bordered cell patterns

### Base Lissajous Component

**Location**: `apps/www/src/components/lissajous.tsx`

Props interface:
```typescript
interface LissajousProps {
  a?: number;           // Default: 3
  b?: number;           // Default: 2
  delta?: number;       // Default: π/2
  points?: number;      // Default: 500
  stroke?: string;      // Default: "currentColor"
  strokeWidth?: number; // Default: 1
  className?: string;
  padding?: number;     // Default: 10
}
```

This component is already suitable for placement in grid cells—it renders an SVG with `viewBox="0 0 100 100"` and accepts flexible sizing via className.

### Other Grid Patterns in Codebase

#### CTA Section Grid (`page.tsx:757-784`)
Simpler pattern with 72 hover-interactive cells:
```tsx
<div className="grid grid-cols-4 md:grid-cols-12 grid-rows-6 gap-[8px]">
  {Array.from({ length: 72 }).map((_, i) => (
    <div key={i} className="aspect-square border transition-colors hover:bg-[...overlay]" />
  ))}
</div>
```

#### Footer Grid (`app-footer.tsx:151-184`)
Single row matching hero style with Lissajous in each cell:
```tsx
<div className="grid grid-cols-4 md:grid-cols-9 gap-[8px] border border-border">
  {Array.from({ length: 9 }).map((_, colIdx) => {
    // Edge detection and border logic...
    return (
      <div key={...} className={`aspect-square ${borderClasses}`}>
        <Lissajous a={pattern.a} b={pattern.b} />
      </div>
    );
  })}
</div>
```

## Code References

- **Landing page grid system**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:254-637`
- **Borderless zone config**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:317-342`
- **Border logic**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:369-400`
- **Content placement docs**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:427-573`
- **LissajousHero component**: `apps/www/src/components/lissajous-hero.tsx`
- **Base Lissajous component**: `apps/www/src/components/lissajous.tsx`
- **CTA grid section**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:757-784`
- **Footer grid**: `apps/www/src/components/app-footer.tsx:151-184`
- **Shared grid background**: `packages/ui/src/components/lightfast-custom-grid-background.tsx` (decorative only)

## Architecture Documentation

### Grid System Core Concepts

1. **Cell Addressing**: Cells are addressed as `row-col` (1-indexed), e.g., "2-5" = row 2, column 5
2. **Double-Line Effect**: Created by 8px gap + cell borders on interior sides
3. **Borderless Zones**: Defined via Set to remove internal borders for content areas
4. **Content Overlay**: All content uses `z-10` to sit above cell backgrounds
5. **Responsive Behavior**: Desktop cols 5-9 hidden on mobile via `hidden md:block`

### Potential Extraction Points

To create a reusable `GridSection` component, extract:

1. **GridCell renderer function** - The cell generation logic with border computation
2. **BorderlessZone utility** - Accept borderless cells as props
3. **Content placement helpers** - Standard methods for spanning/clipping
4. **Configuration options** - Column/row counts, gap size, debug mode

### Design Considerations for LissajousHero Conversion

To place LissajousHero content on a grid system:

**Option A: Grid-aware LissajousHero**
- Accept grid configuration props (cols, rows, borderless zones)
- Place "Read our blog" text in specific cell(s)
- Distribute 25 Lissajous patterns across designated cells
- Let parent control overall grid structure

**Option B: Composable Grid + Content**
- Create reusable `<GridSection>` component
- Use it as container in LissajousHero
- Place content via grid positioning methods
- Text in cells 1-1 through 2-2, Lissajous in remaining cells

**Option C: Slot-based Grid**
- Grid accepts children with `data-cell` attributes
- Automatically positions children in specified cells
- Most flexible but requires more complex implementation

## Open Questions

1. **Grid dimensions**: Should the "Read our blog" section use the same 9x7 grid as hero, or a custom size (e.g., 6x5 for the 25 Lissajous patterns + text)?

2. **Responsive behavior**: How should the Lissajous patterns reorganize on mobile (4 cols)? Hide some, or wrap to more rows?

3. **Text placement**: Which cells should contain the "Read our blog" text? Should it span multiple cells or be contained in one?

4. **Border style**: Should this section use the double-line bordered style, or the simpler single-border hover style from CTA?

5. **Animation**: Should cells have hover states like CTA section, or remain static?

6. **Component API**: What props should a reusable `GridSection` expose?
   - `cols` / `rows` counts
   - `borderlessZone` configuration
   - `showDebugLabels` toggle
   - `gap` size
   - `borderStyle` variant (double-line vs single)
