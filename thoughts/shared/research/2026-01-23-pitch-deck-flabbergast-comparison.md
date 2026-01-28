---
date: 2026-01-23T17:45:00+11:00
researcher: Claude
git_commit: 68cddbf9
branch: main
repository: lightfast
topic: "Pitch Deck Slide Sizing: Flabbergast vs Lightfast Comparison"
tags: [research, codebase, pitch-deck, css, layout, flabbergast]
status: complete
last_updated: 2026-01-23
last_updated_by: Claude
---

# Research: Pitch Deck Slide Sizing - Flabbergast vs Lightfast Comparison

**Date**: 2026-01-23T17:45:00+11:00
**Researcher**: Claude
**Git Commit**: 68cddbf9
**Branch**: main
**Repository**: lightfast

## Research Question

Compare the Lightfast pitch deck implementation with Flabbergast's pitch deck (https://flabbergast.agency/pitch-deck/) to identify exact CSS dimensions and spacing differences for both slide view and grid view.

## Summary

The Flabbergast pitch deck uses significantly different dimensions than the current Lightfast implementation. Key differences:

| Property | Flabbergast | Lightfast Current |
|----------|-------------|-------------------|
| **Slide View Width** | 70vw | 90vw (mobile) / 70vw (desktop) |
| **Slide View Aspect Ratio** | 16:9 (1.7778) | 4:3 (mobile) / 16:9 (desktop) |
| **Slide Margins (horizontal)** | 15vw each side | Variable (centered) |
| **Border Radius** | 15px | rounded-xl/2xl (12px/16px) |
| **Grid Columns** | 4 | 4 |
| **Grid Thumbnail Width** | ~15.76vw | ~20% scale of full slide |
| **Grid Gap** | ~10px (~0.56vw) | 25% row height |

## Detailed Findings

### Flabbergast Slide View Dimensions

From browser inspection at 1780x957 viewport:

```
Slide Container (.c-pitch-slider__item-inner):
- Width: 1245.88px (69.99vw ≈ 70vw)
- Height: 700.80px (73.23vh)
- Aspect Ratio: 1.7778 (exactly 16:9)
- Left Position: 267px (15.00% from left edge)
- Right Margin: 267px (15.00vw)
- Top Position: 128px (13.38vh from top)
- Border Radius: 15.04px
- Position: absolute
```

The slide is **centered horizontally** with equal 15vw margins on each side (15vw + 70vw + 15vw = 100vw).

### Flabbergast Grid View Dimensions

When scrolled to bottom, slides animate into a 4-column grid:

```
Grid Thumbnail Dimensions:
- Width: 280.59px (15.76vw)
- Height: 157.88px (16.50vh)
- Aspect Ratio: 1.7772 (maintains 16:9)

Grid Layout:
- Columns: 4
- Horizontal Gap: ~10px (0.56vw)
- Vertical Gap: ~10px (1.03vh)
- Left Margin: ~17.64% (first column starts at ~314px)
- Total Grid Width: ~1466px (82.36% of viewport)

Grid Positioning (first row):
- Column 1: left 17.64%
- Column 2: left 33.96%
- Column 3: left 50.28%
- Column 4: left 66.60%
```

### Lightfast Current Implementation

From `apps/www/src/components/pitch-deck/pitch-deck.tsx`:

```typescript
// Slide container (line 119):
<div className="relative w-[90vw] sm:w-[70vw] mx-auto aspect-[4/3] sm:aspect-[16/9] overflow-visible">

// Individual slide (line 313-314):
<div className={cn(
  "w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl",
  ...
)}>
```

**Issues identified:**

1. **Mobile uses 4:3 aspect ratio** - Flabbergast uses 16:9 at all sizes
2. **Mobile uses 90vw width** - Flabbergast uses 70vw consistently
3. **Border radius uses Tailwind classes** - Should be explicit 15px
4. **No explicit horizontal margins** - Uses `mx-auto` centering instead of fixed 15vw margins

### Grid View Configuration (Lightfast)

```typescript
// Grid configuration (lines 9-51):
const GRID_COLUMNS = 4;
const thumbnailScale = 0.2;  // 20% of full size

// Column positions: 20%, 40%, 60%, 80%
const startX = 20;
const endX = 80;
const columnSpacing = (endX - startX) / (GRID_COLUMNS - 1);  // = 20

// Row positioning: 25% between row centers
const rowHeight = 25;
```

**Issues identified:**

1. **Thumbnail scale too small** - Uses 0.2 (20%) vs Flabbergast's ~22.5% (15.76vw / 70vw)
2. **Column positions wrong** - Lightfast: 20%, 40%, 60%, 80% vs Flabbergast: ~17.64%, ~33.96%, ~50.28%, ~66.60%
3. **Grid gap not explicit** - Uses percentage-based spacing instead of fixed 10px gaps

### Layout Architecture Comparison

**Flabbergast:**
- Full-width page layout
- Slides centered with fixed 15vw margins
- Progress indicators on right side
- Sticky slide container during scroll
- Smooth animation to grid on scroll end

**Lightfast (Current):**
- Split layout with 30% left column (founder note) and 70% right column (slides)
- Slides in right column use 90vw/70vw of that 70% column
- Progress indicator on right
- Similar scroll-based stacking animation

## Code References

- `apps/www/src/components/pitch-deck/pitch-deck.tsx:9-51` - Grid configuration
- `apps/www/src/components/pitch-deck/pitch-deck.tsx:119` - Slide container sizing
- `apps/www/src/components/pitch-deck/pitch-deck.tsx:313-314` - Individual slide styling
- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:41-73` - Split layout (30%/70%)

## Recommended Changes for 1:1 Match

### Slide View Changes

1. **Remove responsive aspect ratio switching** - Use 16:9 always
2. **Use fixed 70vw width** - Remove 90vw mobile variant
3. **Set explicit border radius** - `rounded-[15px]` instead of `rounded-xl/2xl`
4. **Consider removing split layout** - Flabbergast uses full-width centered slides

### Grid View Changes

1. **Update thumbnail scale** - From 0.2 to ~0.225 (or calculate as 15.76vw / 70vw)
2. **Update column positions** - From 20/40/60/80% to match Flabbergast's spacing
3. **Add explicit gap** - ~10px between grid items
4. **Adjust grid container margins** - ~17.6% left margin to match

### CSS Values to Match Flabbergast

```css
/* Slide View */
.slide-container {
  width: 70vw;
  aspect-ratio: 16/9;
  margin-left: 15vw;
  margin-right: 15vw;
  border-radius: 15px;
}

/* Grid View */
.grid-container {
  /* 4 columns, each ~15.76vw wide with ~10px gaps */
  display: grid;
  grid-template-columns: repeat(4, 15.76vw);
  gap: 10px;
  margin-left: 17.64%;
}
```

## Architecture Documentation

The Lightfast pitch deck uses a scroll-driven animation approach with Framer Motion:
- `useScroll` hook tracks scroll progress
- Each slide has transform values calculated from scroll position
- Slides stack behind each other as user scrolls (scale down, translate up)
- Grid view triggered when scroll exceeds 92% threshold
- Grid animation uses CSS transforms with staggered delays

The Flabbergast implementation appears similar but with:
- Different scroll trigger points
- CSS-based grid layout rather than calculated positions
- Potentially using GSAP or similar for animations (based on class naming convention)

## Historical Context (from thoughts/)

Related research found:
- `thoughts/shared/plans/2026-01-23-pitch-deck-animation-improvements.md` - Animation improvement plans
- `thoughts/shared/research/2026-01-23-pitch-deck-animation-improvements.md` - Animation research
- `thoughts/shared/research/2026-01-23-pitch-deck-stacking-animation-bugs.md` - Bug documentation

## Open Questions

1. Should the split layout (30% founder note / 70% slides) be maintained or should Lightfast adopt Flabbergast's full-width centered approach?
2. Are the exact grid column positions intentional in Flabbergast or derived from CSS grid auto-placement?
3. Should mobile breakpoints maintain the same 70vw width or have responsive adjustments?
