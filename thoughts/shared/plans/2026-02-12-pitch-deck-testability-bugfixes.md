# Pitch Deck Animation: Testability Extraction & Bug Fixes

## Overview

Extract all inline animation calculations from React components into pure, unit-testable functions, and fix three identified bugs: incorrect scroll target calculation, rapid grid threshold oscillation, and broken keyboard navigation in grid mode. Also unify the duplicated slide content dispatcher.

## Current State Analysis

All animation math is inlined inside React component bodies in `pitch-deck.tsx` (650 lines). This makes the logic impossible to unit test without rendering components. Three bugs were identified in the deep-debug research (`thoughts/shared/research/2026-02-12-pitch-deck-animation-deep-debug.md`):

1. `exitGridToSlide` uses `index * window.innerHeight` but total scroll height is `(slides + 1) * 100vh`, so each slide maps to `scrollHeight / (slides + 1)` pixels
2. No hysteresis on grid threshold — rapid scroll around 0.92 toggles grid view repeatedly
3. Keyboard arrow keys still scroll in grid mode instead of being disabled

### Key Discoveries:
- Animation transforms are pure functions of `(index, totalSlides, scrollProgress)` — `pitch-deck.tsx:497-545`
- Grid position is a pure function of `(index, containerWidth, gridCols, gaps)` — `pitch-deck.tsx:547-553`
- `SlideContent` dispatcher at `pitch-deck.tsx:628-649` is duplicated in `capture-slide.tsx:27-53`
- 10 slides defined in `apps/www/src/config/pitch-deck-data.ts`

## Desired End State

- A new `_lib/animation-utils.ts` file containing all animation calculation logic as exported pure functions
- Each function is independently unit-testable with a corresponding test file
- `pitch-deck.tsx` imports and calls these functions instead of inline calculations
- The three identified bugs are fixed
- A shared `resolveSlideComponent` function eliminates the duplicated dispatcher

### Verification:
- All extracted functions have unit tests
- `pnpm typecheck` passes
- `pnpm lint` passes
- Manual: pitch deck scroll, grid transition, keyboard nav, and grid-click-to-slide all work correctly

## What We're NOT Doing

- No base slide component / composability refactor (out of scope)
- No `React.memo` optimization (separate concern)
- No changes to mobile layout
- No changes to slide content components themselves
- No changes to PDF export logic beyond using the shared dispatcher

## Implementation Approach

Extract-then-fix: first move calculations out (Phase 1), then fix bugs in the extracted functions (Phases 2-4), then unify the dispatcher (Phase 5). This order ensures bug fixes are applied to clean, testable code.

---

## Phase 1: Extract Animation Calculations into Pure Functions

### Overview
Create `_lib/animation-utils.ts` with all animation math extracted from `pitch-deck.tsx`. Update `pitch-deck.tsx` to import and use these functions.

### Changes Required:

#### 1. New file: `_lib/animation-utils.ts`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.ts`

```typescript
// --- Grid layout constants ---
export const GRID_COLS = 4;
export const GRID_GAP = 24; // px
export const GRID_ROW_GAP = 32; // px

export const GRID_ENTER_THRESHOLD = 0.92;

/**
 * Scroll-driven Y transform keyframes for a slide.
 */
export function getSlideYKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: string[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  const isFirst = index === 0;

  if (isFirst) {
    return {
      input: [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
      output: ["0%", "-30px", "-50px", "-60px", "-60px"],
    };
  }

  return {
    input: [
      slideStart - 0.12,
      slideStart - 0.08,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    output: ["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"],
  };
}

/**
 * Scroll-driven scale transform keyframes for a slide.
 */
export function getSlideScaleKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  const isFirst = index === 0;

  if (isFirst) {
    return {
      input: [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
      output: [1, 0.95, 0.9, 0.85, 0.85],
    };
  }

  return {
    input: [
      slideStart - 0.08,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    output: [1, 1, 0.95, 0.9, 0.85, 0.85],
  };
}

/**
 * Scroll-driven opacity transform keyframes for a slide.
 */
export function getSlideOpacityKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideEnd + 0.15, slideEnd + 0.25, slideEnd + 0.35],
    output: [1, 0.6, 0],
  };
}

/**
 * Scroll-driven z-index transform keyframes for a slide.
 */
export function getSlideZIndexKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.1, slideStart, slideEnd],
    output: [index, index + 1, index + 1],
  };
}

/**
 * Indicator line opacity keyframes.
 */
export function getIndicatorOpacityKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    output: [0.3, 1, 1, 0.3],
  };
}

/**
 * Indicator line width keyframes.
 */
export function getIndicatorWidthKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    output: [24, 40, 40, 24],
  };
}

/**
 * Calculate grid thumbnail dimensions from container width.
 */
export function getGridDimensions(containerWidth: number) {
  const thumbWidth =
    containerWidth > 0
      ? (containerWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS
      : 0;
  const thumbHeight = thumbWidth * (9 / 16);
  const gridScale = containerWidth > 0 ? thumbWidth / containerWidth : 0.25;
  const rowHeight = thumbHeight + GRID_ROW_GAP;
  return { thumbWidth, thumbHeight, gridScale, rowHeight };
}

/**
 * Calculate grid position for a slide at the given index.
 */
export function getGridPosition(
  index: number,
  thumbWidth: number,
  rowHeight: number,
) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: col * (thumbWidth + GRID_GAP),
    y: row * rowHeight,
  };
}

/**
 * Determine which slide is active based on scroll progress.
 */
export function getSlideIndexFromProgress(
  progress: number,
  totalSlides: number,
): number {
  return Math.min(Math.floor(progress * totalSlides), totalSlides - 1);
}

/**
 * Calculate the correct scroll target for a given slide index.
 * Total scroll height = (totalSlides + 1) * viewport, so each slide
 * maps to scrollHeight / (totalSlides + 1) pixels of scroll.
 */
export function getScrollTargetForSlide(
  index: number,
  totalSlides: number,
  scrollHeight: number,
): number {
  const scrollPerSlide = scrollHeight / (totalSlides + 1);
  return index * scrollPerSlide;
}

/**
 * Reverse stagger delay: last card animates first.
 */
export function getStaggerDelay(index: number, totalSlides: number): number {
  return (totalSlides - 1 - index) * 0.05;
}
```

#### 2. Update `pitch-deck.tsx`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

**Changes**:
- Remove `GRID_COLS`, `GRID_GAP`, `GRID_ROW_GAP` constants (moved to animation-utils)
- Import all functions from `animation-utils.ts`
- Replace inline calculations in `PitchSlide` with calls to `getSlideYKeyframes`, `getSlideScaleKeyframes`, `getSlideOpacityKeyframes`, `getSlideZIndexKeyframes`, `getGridPosition`, `getStaggerDelay`
- Replace inline calculations in `SlideContainer` with `getGridDimensions`
- Replace inline calculations in `IndicatorLine` with `getIndicatorOpacityKeyframes`, `getIndicatorWidthKeyframes`
- Replace `Math.min(Math.floor(...))` in `useMotionValueEvent` with `getSlideIndexFromProgress`
- Replace `GRID_THRESHOLD` with `GRID_ENTER_THRESHOLD` import

Example for `PitchSlide`:
```typescript
function PitchSlide({ slide, index, totalSlides, scrollProgress, isGridView, ... }: PitchSlideProps) {
  const yKf = getSlideYKeyframes(index, totalSlides);
  const scaleKf = getSlideScaleKeyframes(index, totalSlides);
  const opacityKf = getSlideOpacityKeyframes(index, totalSlides);
  const zIndexKf = getSlideZIndexKeyframes(index, totalSlides);

  const y = useTransform(scrollProgress, yKf.input, yKf.output);
  const scale = useTransform(scrollProgress, scaleKf.input, scaleKf.output);
  const opacity = useTransform(scrollProgress, opacityKf.input, opacityKf.output);
  const zIndex = useTransform(scrollProgress, zIndexKf.input, zIndexKf.output);

  const { x: gridX, y: gridY } = getGridPosition(index, thumbWidth, rowHeight);
  const staggerDelay = getStaggerDelay(index, totalSlides);
  // ... rest unchanged
}
```

Example for `SlideContainer`:
```typescript
function SlideContainer({ isGridView, scrollYProgress, onGridItemClick }: ...) {
  // ...
  const { thumbWidth, thumbHeight, gridScale, rowHeight } = getGridDimensions(containerWidth);
  const totalRows = Math.ceil(PITCH_SLIDES.length / GRID_COLS);
  // ...
}
```

Example for `IndicatorLine`:
```typescript
function IndicatorLine({ index, totalSlides, scrollProgress, onClick }: ...) {
  const opacityKf = getIndicatorOpacityKeyframes(index, totalSlides);
  const widthKf = getIndicatorWidthKeyframes(index, totalSlides);

  const opacity = useTransform(scrollProgress, opacityKf.input, opacityKf.output);
  const width = useTransform(scrollProgress, widthKf.input, widthKf.output);
  // ...
}
```

#### 3. New test file: `_lib/animation-utils.test.ts`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.test.ts`

Unit tests covering:
- `getSlideYKeyframes`: first slide vs other slides, correct input/output lengths
- `getSlideScaleKeyframes`: first slide vs other slides, values monotonically decrease
- `getSlideOpacityKeyframes`: fades from 1 to 0
- `getSlideZIndexKeyframes`: z-index increases at slideStart
- `getIndicatorOpacityKeyframes`/`getIndicatorWidthKeyframes`: symmetric fade patterns
- `getGridDimensions`: correct thumb sizing, gridScale = thumbWidth/containerWidth, handles containerWidth=0
- `getGridPosition`: col/row layout for indices 0-9 with 4 columns
- `getSlideIndexFromProgress`: boundary values (0, 0.5, 0.99, 1.0), clamping
- `getScrollTargetForSlide`: correct division by (totalSlides + 1)
- `getStaggerDelay`: reverse order, first slide gets max delay

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] Unit tests pass for all extracted functions

#### Manual Verification:
- [ ] Scroll-driven stacking animation works identically to before
- [ ] Grid transition at threshold works correctly
- [ ] Indicator lines animate correctly during scroll
- [ ] Grid positions are correct (4 columns, proper spacing)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Fix `exitGridToSlide` Scroll Target Calculation

### Overview
The current formula `index * window.innerHeight` is incorrect. The container height is `(PITCH_SLIDES.length + 1) * 100vh`, so each slide maps to `scrollHeight / (totalSlides + 1)` pixels.

### Changes Required:

#### 1. Update `exitGridToSlide` in `pitch-deck.tsx`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Replace in `exitGridToSlide`:
```typescript
// Before:
const scrollTarget = index * window.innerHeight;

// After:
const scrollTarget = getScrollTargetForSlide(
  index,
  PITCH_SLIDES.length,
  document.documentElement.scrollHeight,
);
```

Also fix the same issue in `handlePrevSlide` and `handleNextSlide`:
```typescript
const handlePrevSlide = () => {
  if (currentSlide > 0) {
    const scrollTarget = getScrollTargetForSlide(
      currentSlide - 1,
      PITCH_SLIDES.length,
      document.documentElement.scrollHeight,
    );
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }
};

const handleNextSlide = () => {
  if (currentSlide < PITCH_SLIDES.length - 1) {
    const scrollTarget = getScrollTargetForSlide(
      currentSlide + 1,
      PITCH_SLIDES.length,
      document.documentElement.scrollHeight,
    );
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }
};
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] Unit test for `getScrollTargetForSlide` validates the formula

#### Manual Verification:
- [ ] Clicking a grid thumbnail scrolls to the correct slide (not offset)
- [ ] Prev/Next navigation buttons land on the correct slide
- [ ] Last slide click doesn't overshoot

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Add Grid Threshold Hysteresis

### Overview
Add hysteresis to prevent rapid grid view toggling when scrolling near the threshold. Enter grid at 0.92, exit only below 0.88.

### Changes Required:

#### 1. Add exit threshold constant to `animation-utils.ts`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.ts`

```typescript
export const GRID_ENTER_THRESHOLD = 0.92;
export const GRID_EXIT_THRESHOLD = 0.88;

/**
 * Determine if grid view should be active, with hysteresis.
 * Enter grid at GRID_ENTER_THRESHOLD, exit only below GRID_EXIT_THRESHOLD.
 */
export function shouldBeGridView(
  progress: number,
  currentlyGrid: boolean,
): boolean {
  if (currentlyGrid) {
    return progress >= GRID_EXIT_THRESHOLD;
  }
  return progress >= GRID_ENTER_THRESHOLD;
}
```

#### 2. Update grid toggle logic in `pitch-deck.tsx`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Replace in `useMotionValueEvent`:
```typescript
// Before:
const shouldBeGrid = latest >= GRID_THRESHOLD;
if (shouldBeGrid !== isGridView) {
  setIsGridView(shouldBeGrid);
}

// After:
const nextGridState = shouldBeGridView(latest, isGridView);
if (nextGridState !== isGridView) {
  setIsGridView(nextGridState);
}
```

Remove the inline `GRID_THRESHOLD` constant.

#### 3. Add unit tests
- `shouldBeGridView(0.93, false)` → `true` (enters grid)
- `shouldBeGridView(0.90, true)` → `true` (stays in grid — above exit threshold)
- `shouldBeGridView(0.87, true)` → `false` (exits grid — below exit threshold)
- `shouldBeGridView(0.90, false)` → `false` (stays out — below enter threshold)

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] Unit tests pass for `shouldBeGridView`

#### Manual Verification:
- [ ] Slow scroll near threshold doesn't cause flickering between modes
- [ ] Grid still enters reliably when scrolling past threshold
- [ ] Scrolling backward from grid exits cleanly

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Fix Keyboard Navigation in Grid Mode

### Overview
Arrow keys currently trigger `window.scrollBy` in grid mode, which has no useful effect. Disable keyboard scroll navigation when in grid mode.

### Changes Required:

#### 1. Update keyboard handler in `pitch-deck.tsx`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Disable scroll-based keyboard navigation in grid mode
    if (isGridView) return;

    const scrollAmount = window.innerHeight;

    if (e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      window.scrollBy({ top: scrollAmount, behavior: "smooth" });
    }
    // ... rest unchanged
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [isGridView]);
```

Note: `isGridView` is added to the dependency array so the handler re-attaches when the mode changes.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes

#### Manual Verification:
- [ ] Arrow keys scroll slides in stack mode
- [ ] Arrow keys do nothing in grid mode (no unexpected scroll behavior)
- [ ] Home/End keys work correctly in stack mode

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Unify Slide Content Dispatcher

### Overview
Extract the slide type → component mapping into a shared function used by both `SlideContent` (in `pitch-deck.tsx`) and `CaptureSlide` (in `capture-slide.tsx`).

### Changes Required:

#### 1. Create shared dispatcher in slide-content barrel
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/index.ts`

Add export:
```typescript
export { resolveSlideComponent } from "./resolve-slide-component";
```

#### 2. New file: `resolve-slide-component.ts`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/resolve-slide-component.ts`

```typescript
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { ContentSlideContent } from "./content-slide-content";
import { CustomTitleSlide } from "./custom-title-slide";
import { CustomClosingSlide } from "./custom-closing-slide";
import { ShowcaseSlideContent } from "./showcase-slide-content";
import { ColumnsSlideContent } from "./columns-slide-content";

type Slide = (typeof PITCH_SLIDES)[number];
type Variant = "responsive" | "fixed";

/**
 * Resolves a slide data object to its corresponding React component and props.
 * Used by both the interactive pitch deck and the PDF capture renderer.
 */
export function resolveSlideComponent(
  slide: Slide,
  variant: Variant,
): React.ReactElement | null {
  if (slide.type === "title" && slide.id === "title") {
    return CustomTitleSlide({ slide, variant });
  }
  if (slide.type === "title" && slide.id === "vision") {
    return CustomClosingSlide({ slide, variant });
  }
  switch (slide.type) {
    case "content":
      return ContentSlideContent({ slide, variant });
    case "showcase":
      return ShowcaseSlideContent({ slide, variant });
    case "columns":
      return ColumnsSlideContent({ slide, variant });
    default:
      return null;
  }
}
```

#### 3. Update `pitch-deck.tsx` SlideContent
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

```typescript
import { resolveSlideComponent } from "./slide-content";

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  return resolveSlideComponent(slide, "responsive");
}
```

Remove the direct imports of individual slide content components from `pitch-deck.tsx` (they're now imported through `resolveSlideComponent`).

#### 4. Update `capture-slide.tsx`
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx`

```typescript
import { resolveSlideComponent } from "./slide-content";

export const CaptureSlide = forwardRef<HTMLDivElement, CaptureSlideProps>(
  function CaptureSlide({ slide, width = 1920, height = 1080 }, ref) {
    return (
      <div
        ref={ref}
        style={{ width, height, "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
        className={cn(
          "relative overflow-hidden font-sans antialiased",
          slide.bgColor
        )}
      >
        <div className="relative h-full p-16 flex flex-col justify-between">
          {resolveSlideComponent(slide, "fixed")}
        </div>
      </div>
    );
  }
);
```

Remove the direct imports of individual slide content components from `capture-slide.tsx`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] All 10 slides render correctly in scroll mode
- [ ] All 10 slides render correctly in grid mode
- [ ] PDF export still produces correct slides (if testable)

---

## Testing Strategy

### Unit Tests (`_lib/animation-utils.test.ts`):
- All keyframe functions: correct lengths, boundary values, monotonicity
- Grid dimensions: math correctness, zero-width handling
- Grid positions: 4-column layout for indices 0-9
- `getSlideIndexFromProgress`: clamping at boundaries
- `getScrollTargetForSlide`: correct `/(totalSlides + 1)` division
- `shouldBeGridView`: all four quadrants of the hysteresis

### Manual Testing Steps:
1. Scroll through all 10 slides — stacking animation smooth
2. Scroll past threshold — grid transition fires once (no flicker)
3. Hover slowly around threshold — no oscillation
4. Click grid thumbnail — scrolls to correct slide position
5. Use prev/next buttons — lands precisely on each slide
6. Press arrow keys in stack mode — scrolls one slide
7. Press arrow keys in grid mode — nothing happens
8. Scroll backward in grid mode — returns to last slide smoothly

## Performance Considerations

No performance changes expected — this is a pure refactor of calculation logic. The number of `useTransform` calls and React renders remains identical.

## References

- Deep debug research: `thoughts/shared/research/2026-02-12-pitch-deck-animation-deep-debug.md`
- FLIP transition plan: `thoughts/shared/plans/2026-02-12-pitch-deck-flip-transition.md`
- Core file: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- Capture file: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx`
- Slide data: `apps/www/src/config/pitch-deck-data.ts`
