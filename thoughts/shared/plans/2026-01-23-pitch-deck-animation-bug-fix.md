# Pitch Deck Stacking Animation Bug Fix

## Overview

Fix the pitch deck scroll-stacking animation bugs where slides appear below previous slides instead of stacking on top. The current implementation has an inverted z-index system and animation values that don't match the reference implementation at https://flabbergast.agency/pitch-deck/.

## Current State Analysis

The pitch deck page exists at `/pitch-deck` with a scroll-driven card stacking animation using framer-motion. However, four bugs prevent proper visual stacking:

1. **Z-index inversion**: New slides appear behind instead of on top
2. **Opacity timing**: Slides fade in too early, causing content bleed-through
3. **Chaotic ordering**: Z-index transitions don't align with visual position
4. **Missing stacking effect**: Y-transform values are too subtle to create visible stacking

### Key Discoveries:

- Z-index calculation at `pitch-deck.tsx:187-191` gives slide 0 z-index 8, slide 1 z-index 7, etc. - **backwards**
- Y-transform uses percentages (`-2%` to `-5%`) instead of pixels (`-30px` to `-60px`)
- Opacity fades in at `slideStart - 0.2` before z-index properly transitions
- Reference implementation shows new slides should have HIGHER z-index

## Desired End State

A scroll-stacking animation where:
1. New slides emerge from below (100% y) and stack ON TOP of previous slides
2. Previous slides scale down and move up with visible stacking at viewport top
3. Maximum 3 slides visible simultaneously
4. Smooth transitions with no content bleed-through or chaotic ordering

### Verification:
- Scroll down: new slides cover previous slides (not appear behind)
- Previous slides visible as scaled-down strips at top of viewport
- No content bleeding through at scroll transitions
- Animation matches Flabbergast reference behavior

## What We're NOT Doing

- Changing slide content or data structure
- Modifying the navbar or page layout
- Adding new features (progress indicator, keyboard nav already exist)
- Changing the overall architecture (sticky container, useScroll, useTransform)

## Implementation Approach

Modify the animation values in `PitchSlide` component to:
1. Invert z-index so newer slides have higher values
2. Use pixel-based y-transforms for consistent stacking visual
3. Align opacity transitions with z-index changes to prevent bleed-through

---

## Phase 1: Fix Z-Index Direction

### Overview
Invert the z-index calculation so newer slides (higher index) have higher z-index values, causing them to stack on top of older slides.

### Changes Required:

#### 1. Invert z-index calculation
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 187-191

**Current code:**
```typescript
const zIndex = useTransform(
  scrollProgress,
  [slideStart, slideEnd, slideEnd + 0.01],
  [totalSlides - index, totalSlides - index, totalSlides - index - 1]
);
```

**New code:**
```typescript
// Z-index: newer slides (higher index) should have HIGHER z-index to stack on top
// When slide becomes active, it gets highest z-index (index + 1)
// Base z-index increases with index, so slide 7 > slide 6 > slide 5, etc.
const zIndex = useTransform(
  scrollProgress,
  [slideStart - 0.1, slideStart, slideEnd],
  [index, index + 1, index + 1]
);
```

**Explanation:**
- Before the slide is active (`slideStart - 0.1`): z-index = `index` (lower, behind active slide)
- When slide becomes active (`slideStart` to `slideEnd`): z-index = `index + 1` (highest for this slide)
- This ensures slide 1 (index 1, z-index 2) stacks on top of slide 0 (index 0, z-index 1)

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [x] Scrolling down: new slides appear ON TOP of previous slides
- [x] No chaotic reordering at any scroll position

**Implementation Note**: After completing this phase, verify the z-index fix before proceeding. The stacking direction should now be correct, though timing may still need adjustment.

---

## Phase 2: Adjust Y-Transform Values

### Overview
Change y-transform from subtle percentages to pixel values that create visible stacking strips at the top of the viewport, matching the Flabbergast reference.

### Changes Required:

#### 1. Update y-transform values
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 148-159

**Current code:**
```typescript
const y = useTransform(
  scrollProgress,
  [
    slideStart - 0.2,
    slideStart,
    slideEnd,
    slideEnd + 0.1,
    slideEnd + 0.2,
    slideEnd + 0.3,
  ],
  ["100%", "0%", "-2%", "-4%", "-5%", "-5%"]
);
```

**New code:**
```typescript
// Y transform: slides emerge from below (100%), settle at center (0),
// then move up and stack at top (-30px, -50px, -60px) as newer slides arrive
const y = useTransform(
  scrollProgress,
  [
    slideStart - 0.15,  // Start emerging
    slideStart,         // Fully visible
    slideEnd,           // Start stacking
    slideEnd + 0.1,     // Continue stacking
    slideEnd + 0.2,     // Further back
    slideEnd + 0.3,     // Final position before fade
  ],
  ["100%", "0%", "-30px", "-50px", "-60px", "-60px"]
);
```

**Explanation:**
- Pixel values (`-30px`, `-50px`, `-60px`) create consistent visual stacking regardless of viewport size
- Values match the original implementation plan expectations
- Slides accumulate at the top of the viewport as visible strips

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [x] Previous slides visible as stacked strips at top of viewport
- [x] Stacking effect is noticeable and matches Flabbergast reference

**Implementation Note**: After completing this phase, the stacking visual should be more pronounced. Proceed to Phase 3 for timing alignment.

---

## Phase 3: Align Animation Timing

### Overview
Synchronize opacity transitions with z-index and y-position changes to prevent content bleed-through during scroll transitions.

### Changes Required:

#### 1. Update opacity transition timing
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 175-185

**Current code:**
```typescript
const opacity = useTransform(
  scrollProgress,
  [
    slideStart - 0.2,
    slideStart - 0.05,
    slideStart,
    slideEnd + 0.25,
    slideEnd + 0.3,
  ],
  [0, 1, 1, 1, 0]
);
```

**New code:**
```typescript
// Opacity: fade in quickly as slide arrives, maintain visibility while stacked,
// fade out only when 3+ slides behind (matching Flabbergast behavior)
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

**Explanation:**
- Fade-in starts at `slideStart - 0.1` to align with z-index transition at `slideStart - 0.1`
- Maintains visibility longer (`slideEnd + 0.15`) so stacked slides remain visible
- Gradual fade to 0.6 opacity before fully hidden
- Maximum ~3 slides visible at once (current, 1 behind at full opacity, 2 behind fading)

#### 2. Adjust scale values for better visual hierarchy
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Lines**: 161-172

**Current code:**
```typescript
const scale = useTransform(
  scrollProgress,
  [
    slideStart - 0.2,
    slideStart,
    slideEnd,
    slideEnd + 0.1,
    slideEnd + 0.2,
    slideEnd + 0.3,
  ],
  [1, 1, 0.96, 0.92, 0.88, 0.88]
);
```

**New code:**
```typescript
// Scale: maintain full size when active, shrink progressively when stacked
// Values from implementation plan: 0.95 → 0.90 → 0.85
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
  [1, 1, 0.95, 0.90, 0.85, 0.85]
);
```

**Explanation:**
- Scale values now match the original implementation plan expectations
- More noticeable size reduction creates clearer visual hierarchy
- Aligned with y-transform keyframe timing

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [x] No content bleeding through at any scroll position
- [x] Smooth transitions between slides
- [x] Maximum 3 slides visible at any time
- [x] Stacked slides have clear visual hierarchy (size and opacity)

**Implementation Note**: After completing this phase, all animation bugs should be resolved.

---

## Phase 4: Final Verification

### Overview
Complete end-to-end testing against the Flabbergast reference implementation.

### Testing Checklist:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`
- [x] Dev server runs: `pnpm dev:www`

#### Manual Verification (compare to https://flabbergast.agency/pitch-deck/):
- [x] First slide displays at full size
- [x] Scrolling down: next slide emerges from BELOW and covers previous slide
- [x] Previous slides scale down and move UP (visible as strips at top)
- [x] Maximum 3 slides visible simultaneously
- [x] 4th slide causes oldest slide to fade out completely
- [x] Reverse scrolling (scroll up) works identically in reverse
- [x] No content bleeding through at any scroll position
- [x] No chaotic slide reordering at any scroll position
- [x] Animation is smooth (60fps, no jank)
- [x] Works on mobile viewport (Chrome DevTools device mode)

---

## Testing Strategy

### Unit Tests:
- Not required (framer-motion scroll animations are difficult to unit test)

### Integration Tests:
- Not required for this visual bug fix

### Manual Testing Steps:
1. Navigate to `http://localhost:4101/pitch-deck`
2. Scroll slowly from top to bottom
3. Verify each slide stacks correctly on top of previous
4. Scroll back to top and verify reverse animation
5. Compare side-by-side with Flabbergast reference
6. Test rapid scrolling for any visual glitches
7. Test on mobile viewport sizes

## Performance Considerations

- All changes maintain `will-change-transform` on animated elements
- No additional DOM elements or complexity added
- Z-index values remain small integers (0-8 range)
- Animation keyframes aligned to reduce interpolation calculations

## Migration Notes

N/A - Bug fix only, no data migration required.

## References

- Bug analysis: `thoughts/shared/research/2026-01-23-pitch-deck-stacking-animation-bugs.md`
- Original implementation plan: `thoughts/shared/plans/2026-01-22-pitch-deck-page.md`
- Reference implementation: https://flabbergast.agency/pitch-deck/
- Current implementation: `apps/www/src/components/pitch-deck/pitch-deck.tsx:139-216`
