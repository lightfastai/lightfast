# Remove Pitch Deck Grid Transition Animations

## Overview

Remove all animated transitions between the scroll-driven stacking view and the grid view in the pitch deck. The grid view itself remains, but switching between states happens instantly (no staggered entry, no two-phase exit animation).

## Current State Analysis

The pitch deck desktop experience has two modes:
1. **Scroll mode**: Slides stack on top of each other as user scrolls
2. **Grid mode**: All slides shown as thumbnails in a 4-column grid

Currently, transitions between these modes are animated:
- **Entry**: Slides animate from stacked positions to grid positions with stagger delays and easing
- **Exit**: Two-phase animation — slides animate from grid to stacked positions, then view switches to scroll mode at the correct position

### Key Files:
- `pitch-deck/_components/pitch-deck.tsx` — Main component with all transition logic
- `pitch-deck/_lib/animation-utils.ts` — Grid calculations + animation constants
- `pitch-deck/_lib/animation-utils.test.ts` — Tests for animation utilities
- `pitch-deck/_components/pitch-deck-context.tsx` — Context with `isGridView` state

## Desired End State

When `isGridView` toggles:
- **Entering grid**: Slides instantly appear in grid positions (no stagger, no easing, no duration)
- **Exiting grid**: Instantly switch to scroll mode at the clicked slide (no two-phase animation)

## What We're NOT Doing

- Not removing the grid view itself
- Not changing grid layout (4 columns, gaps, dimensions)
- Not changing the scroll-driven stacking animations
- Not changing the mobile experience
- Not changing the preface sidebar behavior

## Implementation Approach

Remove animation duration/delay/easing from grid transitions and eliminate the two-phase exit mechanism entirely.

## Phase 1: Remove Grid Animation Code

### Overview
Strip animation timing from grid transitions and simplify the exit-grid flow.

### Changes Required:

#### 1. `pitch-deck/_components/pitch-deck.tsx`

**Remove `exitTargetSlide` state and two-phase exit logic:**
- Remove `exitTargetSlide` state (line 49)
- Remove `isTransitioningRef` (line 47)
- Simplify `exitGridToSlide()` — instead of the two-phase setTimeout approach, just immediately set `isGridView(false)` and scroll to the target slide
- Remove the `isTransitioningRef.current` guard in the scroll handler (line 59)
- Remove `exitTargetSlide` prop drilling through `SlideContainer` → `PitchSlide`

**Simplify `PitchSlide` animation target:**
- Remove the three-state animation logic (`isExiting` branch)
- For grid mode: set `animate` target with `duration: 0` (instant snap) instead of `GRID_SLIDE_DURATION` with stagger
- Remove `staggerDelay` calculation
- Remove `prefersReducedMotion` state (no longer needed since there's no animation to reduce)

**Simplify `SlideContainer`:**
- Remove `exitTargetSlide` prop

#### 2. `pitch-deck/_lib/animation-utils.ts`

**Remove grid-animation-only exports:**
- `getStackedPosition()` — only used for exit animation
- `getStaggerDelay()` — only used for stagger timing
- `GRID_SLIDE_DURATION` — animation duration constant

**Keep:**
- All grid layout functions (`getGridDimensions`, `getGridPosition`, `GRID_COLS`, `GRID_GAP`, `GRID_ROW_GAP`)
- All scroll-driven functions (`getSlideYKeyframes`, `getSlideScaleKeyframes`, etc.)
- `shouldBeGridView()` and thresholds
- `getSlideIndexFromProgress`, `getScrollTargetForSlide`

#### 3. `pitch-deck/_lib/animation-utils.test.ts`

**Remove tests for deleted functions:**
- `getStaggerDelay` describe block
- `shouldBeGridView` tests remain (function still used)
- Grid dimension/position tests remain

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter www typecheck`
- [ ] Tests pass: run animation-utils tests
- [ ] No unused imports or variables

#### Manual Verification:
- [ ] Scrolling past threshold instantly shows grid (no stagger animation)
- [ ] Clicking a grid item instantly returns to scroll mode at correct slide
- [ ] Scroll-driven stacking animations still work correctly
- [ ] Scroll indicator and navigation controls still appear/disappear correctly
- [ ] Mobile view unaffected

## References

- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.ts`
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.test.ts`
