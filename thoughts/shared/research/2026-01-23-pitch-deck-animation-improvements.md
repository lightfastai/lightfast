---
date: 2026-01-23T11:32:00+11:00
researcher: Claude
git_commit: 68cddbf9097f3fb649238e967ba2df8533024b40
branch: main
repository: lightfast
topic: "Pitch Deck Animation Improvements - No Fade-In & Grid Overview Effect"
tags: [research, codebase, pitch-deck, animation, framer-motion, scroll, grid-view]
status: complete
last_updated: 2026-01-23
last_updated_by: Claude
---

# Research: Pitch Deck Animation Improvements

**Date**: 2026-01-23T11:32:00+11:00
**Researcher**: Claude
**Git Commit**: 68cddbf9097f3fb649238e967ba2df8533024b40
**Branch**: main
**Repository**: lightfast

## Research Question

Two improvements requested for the pitch deck page at `/pitch-deck`:

1. **Remove fade-in effect**: Currently slides fade in during scroll transitions. The user wants slides positioned BELOW the viewport so they scroll into view without needing opacity animation. Reference: https://flabbergast.agency/pitch-deck/

2. **Grid overview effect**: At the final slide, an additional scroll should trigger an animation where all slides arrange into a grid view (like image 1 provided). Each slide thumbnail should be clickable to navigate to that slide. The animation should place slides one-by-one very fast, starting from the last slide to the first.

## Summary

### Current Implementation

The pitch deck uses framer-motion scroll-linked animations with a sticky container pattern:

**File Structure:**
- Page: `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx`
- Main component: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
- Slide data: `apps/www/src/components/pitch-deck/pitch-deck-data.ts`
- Navbar: `apps/www/src/components/pitch-deck/pitch-deck-navbar.tsx`

**Current Animation Mechanics** (`pitch-deck.tsx:139-216`):

| Property | Current Value | Behavior |
|----------|---------------|----------|
| Y transform | `["100%", "0%", "-30px", "-50px", "-60px", "-60px"]` | Slides emerge from below viewport |
| Opacity | `[0, 1, 1, 0.6, 0]` | Fade-in at `slideStart - 0.1` |
| Scale | `[1, 1, 0.95, 0.90, 0.85, 0.85]` | Shrink when stacked |
| Z-index | `[index, index + 1, index + 1]` | Newer slides on top |

### Issue 1: Fade-In Effect

**Current behavior**: Slides start with `opacity: 0` at scroll position `slideStart - 0.1` and fade to `opacity: 1` at `slideStart`. This creates a visible fade-in effect.

**Root cause**: The opacity animation is used to hide slides that are positioned WITHIN the viewport. Lines 180-189:
```typescript
const opacity = useTransform(
  scrollProgress,
  [
    slideStart - 0.1,   // Start fade in
    slideStart,         // Fully visible
    slideEnd + 0.15,    // Stay visible while stacked
    slideEnd + 0.25,    // Start fading
    slideEnd + 0.35,    // Fully hidden
  ],
  [0, 1, 1, 0.6, 0]
);
```

**Solution approach**: Instead of using opacity to hide upcoming slides, position them completely BELOW the viewport using a larger Y offset that keeps them out of view. Then opacity can remain at 1 during entry.

The y-transform currently starts at `100%` which should already be below viewport, but the transition timing (`slideStart - 0.15` to `slideStart`) may cause the slide to become visible before it reaches the viewport edge.

**Required changes**:
1. Extend the y-transform so slides start further below (e.g., `120%` or `150%`)
2. Adjust timing so slides reach `0%` exactly as they should be visible
3. Set opacity to `1` for the entire entry animation (only fade on exit when stacked)

### Issue 2: Grid Overview Effect

**Reference**: Flabbergast pitch deck final state (and user-provided screenshot showing 4x3 grid of slides)

**Requirements**:
1. After the last slide, an additional scroll triggers the grid view
2. All slides animate into a grid layout
3. Animation is fast and sequential (last slide → first slide)
4. Each slide thumbnail is clickable → navigates to that slide

**Implementation approach**:

The current container height is calculated as:
```typescript
style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
```

The `+ 1` already provides extra scroll space after the last slide. This can be used to trigger the grid transition.

**Grid layout calculation**:
- For 8 slides: 4 columns × 2 rows
- Grid gap: ~16px or similar
- Each slide maintains aspect ratio (16:10 or 4:3)
- Total grid fits within viewport

**Animation algorithm (last-to-first)**:
```typescript
// Pseudo-code for staggered animation
const staggerDelay = 50; // ms between each slide
slides.forEach((slide, index) => {
  const reverseIndex = totalSlides - 1 - index;
  setTimeout(() => {
    animateToGridPosition(slide, gridPosition[index]);
  }, reverseIndex * staggerDelay);
});
```

**Grid position calculation**:
```typescript
// For 8 slides in 4x2 grid
const columns = 4;
const rows = Math.ceil(totalSlides / columns);
const gridPositions = slides.map((_, index) => ({
  column: index % columns,
  row: Math.floor(index / columns),
}));
```

## Detailed Findings

### Current Slide Animation Flow

**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx:139-223`

```
Scroll Progress: 0% -------- 12.5% -------- 25% -------- ... -------- 100%
                 |              |              |                        |
Slide 0 (idx 0): [FRONT]    [STACKING]    [BEHIND]                  [GONE]
Slide 1 (idx 1): [BELOW]     [FRONT]     [STACKING]                [BEHIND]
Slide 2 (idx 2): [BELOW]     [BELOW]      [FRONT]                 [STACKING]
...
Slide 7 (idx 7): [BELOW]     [BELOW]     [BELOW]                   [FRONT]
```

Each slide occupies `1/totalSlides` (12.5% for 8 slides) of scroll progress.

### Y Transform Keyframes (lines 150-161)

| Scroll Position | Y Value | Visual State |
|-----------------|---------|--------------|
| `slideStart - 0.15` | `100%` | Below viewport |
| `slideStart` | `0%` | Centered (active) |
| `slideEnd` | `-30px` | Stacking (1 behind) |
| `slideEnd + 0.1` | `-50px` | Further back (2 behind) |
| `slideEnd + 0.2` | `-60px` | Even further (3 behind) |
| `slideEnd + 0.3` | `-60px` | Maintains position |

### Opacity Keyframes (lines 180-189)

| Scroll Position | Opacity | Visual State |
|-----------------|---------|--------------|
| `slideStart - 0.1` | `0` | Invisible (approaching) |
| `slideStart` | `1` | Fully visible |
| `slideEnd + 0.15` | `1` | Still visible (1 behind) |
| `slideEnd + 0.25` | `0.6` | Fading (2 behind) |
| `slideEnd + 0.35` | `0` | Gone (3+ behind) |

### Container Structure (lines 43-75)

```tsx
<main aria-label="Pitch Deck Presentation">
  <div ref={containerRef} style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}>
    {/* Scroll container - provides scrollable space */}

    <div className="sticky top-0 h-screen ...">
      {/* Sticky viewport - stays fixed during scroll */}

      <div className="relative w-full max-w-5xl mx-auto ...">
        {/* Slide container - positions slides */}

        {PITCH_SLIDES.map((slide, index) => (
          <PitchSlide ... />
        ))}
      </div>

      <SlideIndicator ... />
    </div>
  </div>
</main>
```

### Slide Data Structure (lines 1-98 of pitch-deck-data.ts)

```typescript
export const PITCH_SLIDES = [
  { id: "title", type: "title", title: "LIGHTFAST", bgColor: "bg-[#8B3A3A]" },
  { id: "intro", type: "content", title: "Hi, we are Lightfast.", ... },
  { id: "problem", type: "content", title: "The Problem.", ... },
  { id: "solution", type: "content", title: "Our Solution.", ... },
  { id: "traction", type: "content", title: "Early Traction.", ... },
  { id: "team", type: "content", title: "The Team.", ... },
  { id: "ask", type: "content", title: "The Ask.", ... },
  { id: "vision", type: "title", title: "Every team deserves...", bgColor: "bg-[#8B3A3A]" },
] as const; // 8 slides total
```

## Code References

- Main pitch deck component: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
- Y transform calculation: `apps/www/src/components/pitch-deck/pitch-deck.tsx:150-161`
- Opacity transform: `apps/www/src/components/pitch-deck/pitch-deck.tsx:180-189`
- Scale transform: `apps/www/src/components/pitch-deck/pitch-deck.tsx:165-176`
- Z-index calculation: `apps/www/src/components/pitch-deck/pitch-deck.tsx:195-199`
- Slide data: `apps/www/src/components/pitch-deck/pitch-deck-data.ts:1-98`
- Page route: `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx`
- Navbar component: `apps/www/src/components/pitch-deck/pitch-deck-navbar.tsx`

## Architecture Documentation

### Animation Framework

The pitch deck uses **framer-motion** scroll animations:

1. `useScroll()` - Tracks scroll progress (0-1) within the container
2. `useTransform()` - Maps scroll progress to CSS properties (y, scale, opacity, zIndex)

The sticky container pattern keeps the slide viewport fixed while the parent container scrolls, creating the illusion of slides stacking.

### State Management

Currently stateless - all animation is declarative based on scroll position. For the grid view feature, state will need to be added:

```typescript
// Potential state needed
const [isGridView, setIsGridView] = useState(false);
const [activeSlide, setActiveSlide] = useState(0);
```

### Grid View Implementation Notes

For the grid overview effect, the implementation needs to:

1. **Detect end-of-deck scroll**: When `scrollProgress` reaches near 1.0, begin grid transition
2. **Switch animation modes**: From scroll-linked transforms to grid positions
3. **Calculate grid positions**: Based on viewport size and number of slides
4. **Animate sequentially**: Use staggered delays from last to first slide
5. **Handle click navigation**: Each grid item scrolls to that slide's position

## Historical Context (from thoughts/)

- Previous bug fix plan: `thoughts/shared/plans/2026-01-23-pitch-deck-animation-bug-fix.md`
  - Fixed z-index direction (newer slides on top)
  - Updated y-transform to pixel values
  - Aligned opacity timing with z-index transitions

- Original implementation plan: `thoughts/shared/plans/2026-01-22-pitch-deck-page.md`
  - Defined animation mechanics and keyframe expectations
  - Established 3-slide visibility maximum
  - Defined position states: FRONT, MID-BACK, FAR-BACK, GONE

- Bug analysis research: `thoughts/shared/research/2026-01-23-pitch-deck-stacking-animation-bugs.md`
  - Identified z-index inversion issue
  - Documented content bleed-through from opacity timing

## Related Research

- `thoughts/shared/research/2026-01-23-pitch-deck-stacking-animation-bugs.md` - Previous animation bug analysis
- `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md` - Original VC pitch deck research

## Open Questions

1. **Grid layout dimensions**: Should it be 4x2 for 8 slides, or adaptive based on slide count?
2. **Transition trigger**: Should grid view trigger automatically at end of scroll, or require explicit action?
3. **Mobile grid**: How should the grid layout adapt for mobile viewports? (2x4 instead of 4x2?)
4. **Reverse animation**: When clicking a slide in grid view, should it animate back through the stacking sequence or jump directly?
5. **Y-offset for no-fade**: What exact Y offset ensures slides are completely hidden below viewport? Need to test with `120%`, `150%`, etc.
