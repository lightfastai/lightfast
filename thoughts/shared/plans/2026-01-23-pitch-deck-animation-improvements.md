# Pitch Deck Animation Improvements Implementation Plan

## Overview

Implement two animation improvements for the pitch deck page at `/pitch-deck`:

1. **Remove fade-in effect**: Slides should scroll into view from below without opacity animation during entry
2. **Grid overview effect**: After the last slide, an additional scroll triggers all slides to animate into a 4-column grid layout with clickable thumbnails

## Current State Analysis

The pitch deck uses framer-motion scroll-linked animations with a sticky container pattern. Currently:

- **File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
- **Slides**: 7 total (from `PITCH_SLIDES` array)
- **Container height**: `(PITCH_SLIDES.length + 1) * 100vh` = 800vh
- **Animation**: Slides fade in (opacity 0→1) while emerging from below (y: 100%→0%)

### Key Discoveries:

- Opacity animation at `pitch-deck.tsx:180-190` causes fade-in from `slideStart - 0.1` to `slideStart`
- Y-transform at `pitch-deck.tsx:150-161` starts at 100% which should be below viewport
- The `+ 1` in container height already provides extra scroll space after the last slide
- No grid view functionality exists currently

## Desired End State

### No Fade-In Entry:
- Slides positioned completely below viewport (y > 100%) before their scroll range
- Opacity remains at 1 during entire entry animation
- Slides scroll smoothly into view without any opacity change
- Opacity only fades when slides are 2+ positions behind (exit animation)

### Grid Overview:
- Scrolling past the last slide triggers a transition to grid view
- All 7 slides animate into a 4-column responsive grid (4+3 layout)
- Animation is staggered from last slide to first (reverse order), ~50ms between each
- Each grid thumbnail is clickable and jumps directly to that slide's scroll position
- Grid fits within viewport with appropriate gaps and padding

### Verification:
- Scroll through presentation: no fade-in visible during slide entry
- Scroll past last slide: grid view animates in with staggered effect
- Click any grid thumbnail: page scrolls directly to that slide
- Scroll back up from grid view: returns to normal presentation mode

## What We're NOT Doing

- Changing slide content or data structure
- Modifying the navbar component
- Adding a manual toggle button for grid view (auto-trigger only)
- Implementing reverse animation when exiting grid view (direct scroll instead)
- Adding mobile-specific grid layouts (will use same 4-column, CSS handles responsive sizing)

## Implementation Approach

1. Adjust opacity keyframes to remove fade-in during entry, keeping fade-out for exit
2. Add state management for grid view mode based on scroll progress threshold
3. Calculate grid positions dynamically based on viewport and slide count
4. Use framer-motion variants with staggered delays for grid transition
5. Add click handlers on grid items that scroll to the appropriate position

---

## Phase 1: Remove Fade-In Effect

### Overview
Modify the opacity animation so slides maintain full opacity during entry, only fading when exiting (2+ slides behind).

### Changes Required:

#### 1. Update opacity transform keyframes
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 180-190

**Current code:**
```typescript
const opacity = useTransform(
  scrollProgress,
  [
    slideStart - 0.1,   // Start fade in (aligned with z-index transition)
    slideStart,         // Fully visible
    slideEnd + 0.15,    // Stay visible while stacked (1 behind)
    slideEnd + 0.25,    // Start fading (2 behind)
    slideEnd + 0.35,    // Fully hidden (3+ behind)
  ],
  [0, 1, 1, 0.6, 0]
);
```

**New code:**
```typescript
// Opacity: NO fade-in during entry (stays at 1), only fade when 2+ slides behind
const opacity = useTransform(
  scrollProgress,
  [
    slideStart - 0.15,  // Before visible (still below viewport)
    slideStart,         // Fully visible (no change - already at 1)
    slideEnd + 0.15,    // Stay visible while stacked (1 behind)
    slideEnd + 0.25,    // Start fading (2 behind)
    slideEnd + 0.35,    // Fully hidden (3+ behind)
  ],
  [1, 1, 1, 0.6, 0]     // Start at 1, no fade-in
);
```

**Explanation:**
- Changed first opacity value from `0` to `1` - slides are fully opaque before entering
- Slides remain at opacity 1 until they are 2+ slides behind
- The y-transform (100% → 0%) handles the visual entry, not opacity

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint` (pre-existing errors in other files)

#### Manual Verification:
- [ ] Scroll slowly through presentation - slides scroll into view without fading
- [ ] Previous slides still fade out when 2+ slides behind
- [ ] No visual glitches at slide transition boundaries

**Implementation Note**: After completing this phase, verify the fade-in is removed before proceeding.

---

## Phase 2: Add Grid View State Management

### Overview
Add state and scroll detection to trigger grid view mode when scroll progress exceeds a threshold (past the last slide).

### Changes Required:

#### 1. Add state and scroll threshold detection
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Location**: Inside `PitchDeck` component, after line 14

**Add imports:**
```typescript
import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
```

**Add state and threshold detection:**
```typescript
export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Grid view state - triggers when scrolled past last slide
  const [isGridView, setIsGridView] = useState(false);

  // Grid view threshold: last slide ends at (totalSlides) / (totalSlides + 1)
  // For 7 slides with +1 extra: 7/8 = 0.875
  // Trigger grid when scroll exceeds ~0.92 (in the extra scroll space)
  const GRID_THRESHOLD = 0.92;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const shouldBeGrid = latest >= GRID_THRESHOLD;
    if (shouldBeGrid !== isGridView) {
      setIsGridView(shouldBeGrid);
    }
  });

  // ... rest of component
```

#### 2. Update container height for grid view scroll space
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 47-49

The existing `+ 1` provides enough scroll space. No change needed here, but verify:
```typescript
style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
// For 7 slides: 800vh total, last slide occupies 700-787.5vh, grid triggers at ~736vh
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] Add `console.log(isGridView)` temporarily - verify it toggles at correct scroll position
- [ ] Scrolling past last slide sets `isGridView` to true
- [ ] Scrolling back sets `isGridView` to false

**Implementation Note**: After completing this phase, verify state toggles correctly before proceeding.

---

## Phase 3: Implement Grid Position Calculations

### Overview
Create a utility to calculate grid positions for each slide based on a 4-column layout.

### Changes Required:

#### 1. Add grid position calculation function
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Location**: Before the `PitchDeck` component

```typescript
// Grid configuration
const GRID_COLUMNS = 4;
const GRID_GAP = 16; // px

interface GridPosition {
  x: number;  // percentage from left
  y: number;  // percentage from top
  scale: number;
}

function calculateGridPositions(totalSlides: number): GridPosition[] {
  const rows = Math.ceil(totalSlides / GRID_COLUMNS);
  const positions: GridPosition[] = [];

  // Calculate thumbnail scale to fit grid in viewport
  // Each thumbnail should be roughly 20-22% of viewport width (for 4 columns with gaps)
  const thumbnailScale = 0.22;

  for (let i = 0; i < totalSlides; i++) {
    const col = i % GRID_COLUMNS;
    const row = Math.floor(i / GRID_COLUMNS);

    // Calculate percentage positions
    // Distribute across ~90% of width, centered
    const xPercent = 5 + (col * 23); // 5% margin + 23% per column (including gap)

    // Distribute across viewport height with padding
    const totalGridHeight = rows * 25; // Each row ~25% of viewport
    const yOffset = (100 - totalGridHeight) / 2; // Center vertically
    const yPercent = yOffset + (row * 25);

    positions.push({
      x: xPercent,
      y: yPercent,
      scale: thumbnailScale,
    });
  }

  return positions;
}

// Pre-calculate grid positions
const GRID_POSITIONS = calculateGridPositions(PITCH_SLIDES.length);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] Add `console.log(GRID_POSITIONS)` - verify positions are reasonable percentages
- [ ] Positions should create a 4-column layout (first row: indices 0-3, second row: indices 4-6)

**Implementation Note**: After completing this phase, verify positions look correct before proceeding.

---

## Phase 4: Animate Grid Transition

### Overview
Modify `PitchSlide` component to animate between normal scroll position and grid position based on `isGridView` state. Animation should be staggered from last slide to first.

### Changes Required:

#### 1. Pass isGridView to PitchSlide
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 57-65

```typescript
{PITCH_SLIDES.map((slide, index) => (
  <PitchSlide
    key={slide.id}
    slide={slide}
    index={index}
    totalSlides={PITCH_SLIDES.length}
    scrollProgress={scrollYProgress}
    isGridView={isGridView}
    gridPosition={GRID_POSITIONS[index]}
  />
))}
```

#### 2. Update PitchSlideProps interface
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 132-137

```typescript
interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
  gridPosition: GridPosition;
}
```

#### 3. Modify PitchSlide to handle grid view animation
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 139-223

Replace the `PitchSlide` function with:

```typescript
function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
  gridPosition,
}: PitchSlideProps) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  // Normal scroll-based transforms
  const scrollY = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    ["100%", "0%", "-30px", "-50px", "-60px", "-60px"]
  );

  const scrollScale = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    [1, 1, 0.95, 0.9, 0.85, 0.85]
  );

  const scrollOpacity = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd + 0.15,
      slideEnd + 0.25,
      slideEnd + 0.35,
    ],
    [1, 1, 1, 0.6, 0]
  );

  const scrollZIndex = useTransform(
    scrollProgress,
    [slideStart - 0.1, slideStart, slideEnd],
    [index, index + 1, index + 1]
  );

  // Stagger delay: last slide animates first (reverse order)
  // 50ms between each slide
  const staggerDelay = (totalSlides - 1 - index) * 0.05;

  // Grid view animation variants
  const gridVariants = {
    scroll: {
      x: "0%",
      y: scrollY,
      scale: scrollScale,
      opacity: scrollOpacity,
      zIndex: scrollZIndex,
    },
    grid: {
      x: `${gridPosition.x}%`,
      y: `${gridPosition.y}%`,
      scale: gridPosition.scale,
      opacity: 1,
      zIndex: totalSlides - index, // Ensure proper stacking in grid
      transition: {
        duration: 0.4,
        delay: staggerDelay,
        ease: [0.25, 0.1, 0.25, 1], // Smooth ease-out
      },
    },
  };

  return (
    <motion.article
      variants={gridVariants}
      animate={isGridView ? "grid" : "scroll"}
      style={
        !isGridView
          ? {
              y: scrollY,
              scale: scrollScale,
              opacity: scrollOpacity,
              zIndex: scrollZIndex,
            }
          : undefined
      }
      className="absolute inset-0 will-change-transform origin-top-left"
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      <div
        className={cn(
          "w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl",
          slide.bgColor
        )}
      >
        <div className="relative h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>
    </motion.article>
  );
}
```

**Note**: The variants approach with scroll MotionValues is complex. A simpler approach is to use `animate` prop directly:

#### 3b. Alternative: Simpler grid animation approach

```typescript
function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
  gridPosition,
}: PitchSlideProps) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  // Scroll-based transforms (used when NOT in grid view)
  const y = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    ["100%", "0%", "-30px", "-50px", "-60px", "-60px"]
  );

  const scale = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    [1, 1, 0.95, 0.9, 0.85, 0.85]
  );

  const opacity = useTransform(
    scrollProgress,
    [
      slideStart - 0.15,
      slideStart,
      slideEnd + 0.15,
      slideEnd + 0.25,
      slideEnd + 0.35,
    ],
    [1, 1, 1, 0.6, 0]
  );

  const zIndex = useTransform(
    scrollProgress,
    [slideStart - 0.1, slideStart, slideEnd],
    [index, index + 1, index + 1]
  );

  // Stagger delay: last slide animates first
  const staggerDelay = (totalSlides - 1 - index) * 0.05;

  return (
    <motion.article
      style={
        !isGridView
          ? { y, scale, opacity, zIndex }
          : undefined
      }
      animate={
        isGridView
          ? {
              x: `calc(${gridPosition.x}vw - 50%)`,
              y: `calc(${gridPosition.y}vh - 50%)`,
              scale: gridPosition.scale,
              opacity: 1,
              zIndex: totalSlides - index,
            }
          : undefined
      }
      transition={
        isGridView
          ? {
              duration: 0.4,
              delay: staggerDelay,
              ease: [0.25, 0.1, 0.25, 1],
            }
          : { duration: 0 }
      }
      className={cn(
        "absolute will-change-transform",
        isGridView ? "origin-center" : "inset-0 origin-top-left"
      )}
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      <div
        className={cn(
          "w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl",
          isGridView && "cursor-pointer hover:ring-2 hover:ring-white/50",
          slide.bgColor
        )}
      >
        <div className="relative h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>
    </motion.article>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter www typecheck`
- [ ] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] Scroll past last slide: slides animate into grid layout
- [ ] Animation is staggered (last slide moves first, then second-to-last, etc.)
- [ ] Grid layout shows 4 columns with proper spacing
- [ ] Scroll back up: slides return to normal presentation mode

**Implementation Note**: The grid positioning may need fine-tuning. Adjust `gridPosition` calculations in Phase 3 if slides don't align properly.

---

## Phase 5: Add Click Navigation

### Overview
Add click handlers to grid thumbnails that navigate directly to that slide's scroll position.

### Changes Required:

#### 1. Add click handler to PitchSlide
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Location**: Inside `PitchSlide` component

```typescript
// Add inside PitchSlide function
const handleGridClick = () => {
  if (!isGridView) return;

  // Calculate scroll position for this slide
  // Each slide occupies 100vh, so slide N starts at N * 100vh
  const scrollTarget = index * window.innerHeight;

  window.scrollTo({
    top: scrollTarget,
    behavior: "smooth",
  });
};
```

#### 2. Update the slide wrapper to handle clicks
```typescript
return (
  <motion.article
    // ... existing props
    onClick={handleGridClick}
    className={cn(
      "absolute will-change-transform",
      isGridView ? "origin-center cursor-pointer" : "inset-0 origin-top-left"
    )}
    // ... rest
  >
```

#### 3. Add hover effect for grid items
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`

Update the inner div to show hover state in grid view:
```typescript
<div
  className={cn(
    "w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transition-all",
    isGridView && "hover:ring-4 hover:ring-white/30 hover:shadow-3xl",
    slide.bgColor
  )}
>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter www typecheck`
- [ ] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] In grid view, hovering a slide shows visual feedback (ring/shadow)
- [ ] Clicking a slide in grid view scrolls to that slide
- [ ] After clicking, presentation returns to normal scroll mode at the correct slide
- [ ] Cursor changes to pointer in grid view

**Implementation Note**: After completing this phase, all functionality should be working.

---

## Phase 6: Final Verification & Polish

### Overview
End-to-end testing and any visual adjustments needed.

### Testing Checklist:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint` (pre-existing errors in other files)
- [x] Dev server runs: `pnpm dev:www`
- [ ] Build succeeds: `pnpm --filter www build`

#### Manual Verification - No Fade-In:
- [ ] Scroll slowly from top - first slide visible immediately
- [ ] Each subsequent slide scrolls into view without fading
- [ ] Slides still fade when 2+ positions behind

#### Manual Verification - Grid View:
- [ ] Scroll past last slide - grid view triggers
- [ ] All 7 slides visible in 4+3 grid layout
- [ ] Stagger animation visible (last slide first)
- [ ] Animation duration feels natural (~400ms per slide, ~350ms total stagger)
- [ ] Grid is centered in viewport
- [ ] Adequate spacing between thumbnails

#### Manual Verification - Navigation:
- [ ] Click any grid thumbnail - navigates to that slide
- [ ] Navigation is smooth (not jarring)
- [ ] After navigation, back in normal presentation mode
- [ ] Keyboard navigation still works (arrow keys, home/end)

#### Manual Verification - Edge Cases:
- [ ] Rapid scrolling doesn't break grid transition
- [ ] Scroll up immediately after grid triggers - returns cleanly
- [ ] Grid view works on mobile viewport sizes
- [ ] Progress indicator still functions correctly

### Potential Polish Items (if needed):
- Adjust grid gap/spacing for better visual balance
- Fine-tune stagger timing (faster/slower)
- Add subtle scale on hover for grid items
- Adjust grid thumbnail size for different viewport widths

---

## Testing Strategy

### Unit Tests:
- Not required (framer-motion scroll animations are difficult to unit test)

### Integration Tests:
- Not required for this visual enhancement

### Manual Testing Steps:
1. Navigate to `http://localhost:4101/pitch-deck`
2. Scroll slowly through entire presentation, verify no fade-in
3. Continue scrolling past last slide, verify grid appears
4. Watch for staggered animation (last slide animates first)
5. Click each grid thumbnail, verify navigation works
6. Test keyboard navigation (arrow keys, home, end)
7. Test on mobile viewport (Chrome DevTools)
8. Test rapid scrolling scenarios

## Performance Considerations

- Grid positions pre-calculated (not computed per frame)
- `will-change-transform` retained for GPU acceleration
- Stagger delay is minimal (50ms × 6 = 300ms total)
- No additional DOM elements in grid view (same slides, different positions)
- `transition: { duration: 0 }` when not in grid view to prevent animation conflicts

## Migration Notes

N/A - Feature addition, no data migration required.

## References

- Research: `thoughts/shared/research/2026-01-23-pitch-deck-animation-improvements.md`
- Previous bug fix: `thoughts/shared/plans/2026-01-23-pitch-deck-animation-bug-fix.md`
- Current implementation: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
- Slide data: `apps/www/src/components/pitch-deck/pitch-deck-data.ts`
- Reference inspiration: https://flabbergast.agency/pitch-deck/
