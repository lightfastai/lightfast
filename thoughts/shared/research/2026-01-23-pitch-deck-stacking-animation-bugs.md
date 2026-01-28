---
date: 2026-01-23T10:30:00+11:00
researcher: Claude
git_commit: 68cddbf9097f3fb649238e967ba2df8533024b40
branch: main
repository: lightfast
topic: "Pitch Deck Scroll-Stacking Animation Bug Analysis"
tags: [research, codebase, pitch-deck, animation, framer-motion, bugs]
status: complete
last_updated: 2026-01-23
last_updated_by: Claude
---

# Research: Pitch Deck Scroll-Stacking Animation Bug Analysis

**Date**: 2026-01-23T10:30:00+11:00
**Researcher**: Claude
**Git Commit**: 68cddbf9097f3fb649238e967ba2df8533024b40
**Branch**: main
**Repository**: lightfast

## Research Question

Investigate bugs in the pitch deck page scroll-stacking animation where slides appear to slide below previous slides instead of stacking on top, compared to the reference implementation at https://flabbergast.agency/pitch-deck/.

## Summary

The Lightfast pitch deck implementation has a fundamental z-index and animation direction issue. In the reference Flabbergast implementation, new slides emerge **from below** and stack **on top of** previous slides, pushing older slides up and scaling them down. In the current Lightfast implementation, slides are incorrectly appearing **below** the current slide and the z-index calculation causes chaotic ordering at certain scroll positions.

## Detailed Findings

### Reference Implementation: Flabbergast Agency

**URL**: https://flabbergast.agency/pitch-deck/

**Observed Behavior**:
1. First slide (red "FLABBERGAST") displays at full size
2. As user scrolls, the NEXT slide emerges from BELOW the viewport
3. The next slide moves UP and covers the previous slide
4. Previous slides scale down (≈95% → 90% → 85%) and move UP (negative Y translate)
5. Previous slides remain visible as thin strips at the TOP of the viewport
6. Maximum 3 slides visible simultaneously
7. The 4th slide causes the oldest slide to fade out completely

**Key Animation Properties (from visual observation)**:
- New slide: starts at `translateY(100%)` (below viewport), animates to `translateY(0%)`
- Previous slide: animates from `translateY(0%)` to `translateY(-30px)` with `scale(0.95)`
- Older slides: continue shrinking and moving up
- z-index: NEW slides have HIGHER z-index than OLD slides

### Current Implementation: Lightfast

**Location**: `apps/www/src/components/pitch-deck/pitch-deck.tsx:139-216`

**Observed Bugs**:

#### Bug 1: Slides Appear Below Instead of On Top
When scrolling, the next slide visually appears BELOW the current slide (at the bottom of the viewport) but does not correctly layer ON TOP of the current slide.

**Root Cause**: The z-index calculation at line 187-191:
```typescript
const zIndex = useTransform(
  scrollProgress,
  [slideStart, slideEnd, slideEnd + 0.01],
  [totalSlides - index, totalSlides - index, totalSlides - index - 1]
);
```

This gives slide 0 (first slide) a z-index of 8, and slide 1 a z-index of 7. This means the FIRST slide always has a higher z-index than subsequent slides, which is the OPPOSITE of what's needed. New slides should have HIGHER z-index to appear ON TOP.

#### Bug 2: Content Bleeding Through
At certain scroll positions, content from slide N+1 bleeds through at the bottom of slide N. This was observed when slide 3 content ("AI agents can't access the context...") appeared at the bottom while slide 2 was supposed to be active.

**Root Cause**: The opacity animation at lines 175-185 fades slides in too early (at `slideStart - 0.2`) before the z-index properly transitions, causing overlapping visibility.

#### Bug 3: Chaotic Slide Ordering
At certain scroll positions (around scrollY 1800-2800), the first slide reappears on top of later slides, creating a confusing visual effect.

**Root Cause**: The z-index transition points don't align properly with the visual position of slides. The z-index drops at `slideEnd + 0.01` which may not sync with when the slide visually moves behind.

#### Bug 4: Missing Stacking Effect
Previous slides don't accumulate at the top of the viewport like in Flabbergast. Instead, they simply disappear or appear in wrong positions.

**Root Cause**: The y-transform values at lines 148-159 use negative percentages (`"-2%"` to `"-5%"`) which is too subtle and doesn't create visible stacking at the top.

### Technical Analysis

**Current Animation Values** (`pitch-deck.tsx:148-185`):
```typescript
// Y transform - slides go from 100% (below) to 0% (center) to -5% (above)
y: ["100%", "0%", "-2%", "-4%", "-5%", "-5%"]

// Scale - starts at 1, shrinks to 0.88
scale: [1, 1, 0.96, 0.92, 0.88, 0.88]

// Opacity - fades in from 0 to 1, stays at 1, fades out to 0
opacity: [0, 1, 1, 1, 0]

// Z-index - decreases as slide gets older (INCORRECT)
zIndex: [totalSlides - index, totalSlides - index, totalSlides - index - 1]
```

**Expected Animation Values** (based on Flabbergast):
```typescript
// Y transform - new slides emerge from 100%, current at 0%, stacked slides at -30px to -60px
y: ["100%", "0%", "-30px", "-50px", "-60px"]

// Scale - similar but applied to stacked slides
scale: [1, 1, 0.95, 0.90, 0.85]

// Opacity - maintain visibility longer, only fade at 3+ slides back
opacity: [0, 1, 1, 0.8, 0.5, 0]

// Z-index - NEWER slides should have HIGHER z-index (INVERTED)
zIndex: [index, index, index - 1]  // OR use actual numbers that increase
```

### Key Difference: Z-Index Direction

| Implementation | Slide 0 z-index | Slide 1 z-index | Slide 2 z-index | Result |
|---------------|-----------------|-----------------|-----------------|--------|
| Flabbergast   | Lower (1)       | Higher (2)      | Highest (3)     | New slides on top ✓ |
| Lightfast     | Highest (8)     | Lower (7)       | Even lower (6)  | Old slides on top ✗ |

## Code References

- Main pitch deck component: `apps/www/src/components/pitch-deck/pitch-deck.tsx:139-216`
- Z-index calculation: `apps/www/src/components/pitch-deck/pitch-deck.tsx:187-191`
- Y transform values: `apps/www/src/components/pitch-deck/pitch-deck.tsx:148-159`
- Scale transform: `apps/www/src/components/pitch-deck/pitch-deck.tsx:161-172`
- Opacity transform: `apps/www/src/components/pitch-deck/pitch-deck.tsx:175-185`
- Slide data: `apps/www/src/components/pitch-deck/pitch-deck-data.ts:1-98`
- Implementation plan: `thoughts/shared/plans/2026-01-22-pitch-deck-page.md`

## Architecture Documentation

The pitch deck uses framer-motion's `useScroll` and `useTransform` hooks to create scroll-linked animations:

1. **Container Setup**: A tall container (`height: (slides + 1) * 100vh`) creates scrollable space
2. **Sticky Viewport**: A `sticky` positioned viewport keeps the slide area fixed during scroll
3. **Scroll Progress**: `useScroll` tracks progress from 0 to 1 as user scrolls
4. **Transform Mapping**: Each slide maps scroll progress to y, scale, opacity, and zIndex values

## Historical Context (from thoughts/)

- Implementation plan: `thoughts/shared/plans/2026-01-22-pitch-deck-page.md`
  - Defines expected animation mechanics (lines 56-70)
  - States FRONT should be `scale(1) translateY(0) opacity(1)`
  - States MID-BACK should be `scale(0.95) translateY(-30px) opacity(0.8)`
  - States FAR-BACK should be `scale(0.90) translateY(-50px) opacity(0.5)`
  - States GONE should be `scale(0.85) translateY(-60px) opacity(0)`

The plan's expected values don't match the current implementation values.

## Related Research

- N/A (first research on this topic)

## Open Questions

1. Should the y-transform use pixels (`-30px`) instead of percentages (`-2%`) for more consistent stacking visual?
2. Should z-index be dynamically calculated based on current scroll position rather than static slide index?
3. Is framer-motion's `useTransform` interpolation causing timing issues between properties (z-index vs y vs opacity)?
