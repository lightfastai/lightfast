# Pitch Deck Navigation UX Improvements

## Overview

Improve the pitch-deck navigation UX by adding a scroll hint that disappears immediately on first scroll, removing the "Back to Home" link entirely, and implementing industry-standard navigation patterns for better discoverability and accessibility.

## Current State Analysis

### Existing Navigation Controls

| Control | Location | Status |
|---------|----------|--------|
| SlideIndicator | Right edge, vertically centered | Keep - working well |
| Keyboard Navigation | Global listener | Keep - working well |
| "Back to Home" Link | Bottom center, fixed | **Remove** |
| Scroll Hint | None | **Add** |
| Next/Prev Buttons | None | **Add** (optional enhancement) |
| Slide Counter | None | **Add** (optional enhancement) |

### Key Files
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx` - Main presentation (lines 115-130 have "Back to Home")
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx` - State management

## Desired End State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header (fixed z-50)                                                          │
│ [LOGO] [⊏]          [MENU ▾]          [↓] CONTACT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐   ┌────────────────────────────────────────────┐      │
│  │                  │   │                                            │  │   │
│  │  Founder's Note  │   │                                            │  │   │
│  │  (30% width)     │   │           Slide Content                    │  ─   │
│  │                  │   │           (70% width)                      │  ─   │ ← SlideIndicator
│  │                  │   │                                            │  ─   │   (unchanged)
│  │                  │   │                                            │  │   │
│  └──────────────────┘   └────────────────────────────────────────────┘      │
│                                                                              │
│                               SCROLL                                         │ ← NEW: Scroll hint
│                                 ◇                                           │    (disappears on
│                                 ⋮                                           │     first scroll)
│                                                                              │
│                    ← prev  [3 / 10]  next →                                 │ ← OPTIONAL: Navigation
│                                                                              │    (bottom center)
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification Criteria
1. Scroll hint appears immediately on page load
2. Scroll hint disappears immediately (0.3s fade) on first scroll event
3. Scroll hint does NOT reappear when scrolling back up
4. "Back to Home" link is completely removed
5. Navigation controls (prev/next + slide counter) appear at bottom center
6. All existing keyboard navigation continues to work
7. SlideIndicator remains functional

## What We're NOT Doing

- Not adding fullscreen mode
- Not adding horizontal swipe gestures (native scroll handles vertical)
- Not adding skip-to-content links
- Not modifying the grid view functionality
- Not changing the SlideIndicator design

## Implementation Approach

Following industry patterns from Apple, Stripe, and Linear:
1. **Scroll hint**: Bottom-center positioning with animated chevron, immediate fade on scroll
2. **Optional navigation controls**: Subtle, appear on hover for desktop, always visible on mobile
3. **Accessibility**: Proper ARIA labels and keyboard support

---

## Phase 1: Remove "Back to Home" Link

### Overview
Remove the "Back to Home" link from the bottom center position. The header already provides navigation context.

### Changes Required:

#### 1. Remove Link Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
**Lines**: 115-130

**Delete this entire block:**
```tsx
{/* Back to Home */}
<motion.div
  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
  animate={{
    opacity: isGridView ? 0 : 1,
    pointerEvents: isGridView ? "none" : "auto",
  }}
  transition={{ duration: 0.2 }}
>
  <Link
    href="/"
    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
    Back to Home
  </Link>
</motion.div>
```

Also remove the `Link` import from `next/link` at line 12 (if no longer used elsewhere).

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] "Back to Home" link no longer appears at bottom center
- [ ] No visual regression in slide presentation
- [ ] Grid view still works correctly

---

## Phase 2: Add Scroll Hint Component

### Overview
Create a scroll hint that appears at the bottom center of the viewport with "SCROLL" text and an animated chevron. It disappears immediately on first scroll and never reappears.

### Changes Required:

#### 1. Create ScrollHint Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Add after the SlideIndicator component (around line 293):

```tsx
function ScrollHint({ isGridView }: { isGridView: boolean }) {
  const [hasScrolled, setHasScrolled] = useState(false);

  // Hide on first scroll - never show again
  useEffect(() => {
    if (hasScrolled) return;

    const handleScroll = () => {
      if (window.scrollY > 10) {
        setHasScrolled(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled]);

  // Don't render if user has scrolled or in grid view
  if (hasScrolled || isGridView) return null;

  return (
    <motion.div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* SCROLL text */}
      <span className="text-[10px] font-medium tracking-[0.3em] text-muted-foreground uppercase">
        Scroll
      </span>

      {/* Vertical line */}
      <div className="h-3 w-px bg-muted-foreground/50 mt-1" />

      {/* Animated diamond indicator */}
      <motion.div
        className="mt-1"
        animate={{ y: [0, 4, 0] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-2 h-2 rotate-45 border border-muted-foreground" />
      </motion.div>

      {/* Dotted line below */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="w-px h-1 bg-muted-foreground/40" />
        <div className="w-px h-1 bg-muted-foreground/30" />
        <div className="w-px h-1 bg-muted-foreground/20" />
      </div>
    </motion.div>
  );
}
```

#### 2. Add useState to React Import
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Update React import at line 3:
```tsx
import { useRef, useEffect, useState } from "react";
```

Note: The scroll hint uses a CSS diamond (rotated square with border), no icon import needed.

#### 3. Render ScrollHint in PitchDeck Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Add inside the sticky container (after SlideIndicator, where "Back to Home" was removed):

```tsx
{/* Scroll Hint - disappears on first scroll */}
<ScrollHint isGridView={isGridView} />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] "SCROLL" text with animated diamond indicator appears immediately on page load
- [ ] Vertical line and dotted trail visible below the diamond
- [ ] Diamond has subtle bounce animation (1.2s cycle)
- [ ] Hint disappears immediately (0.3s fade) when user scrolls
- [ ] Hint does NOT reappear when scrolling back up to top
- [ ] Hint is hidden when in grid view

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Add Navigation Controls

### Overview
Add subtle next/prev buttons and slide counter at bottom center. These are always visible and provide explicit navigation for users who prefer clicking over scrolling.

### Changes Required:

#### 1. Create NavigationControls Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

```tsx
function NavigationControls({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  isGridView,
}: {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  isGridView: boolean;
}) {
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === totalSlides - 1;

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{
        opacity: isGridView ? 0 : 1,
        pointerEvents: isGridView ? "none" : "auto",
      }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous slide"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {currentSlide + 1} / {totalSlides}
      </span>

      <button
        onClick={onNext}
        disabled={isLast}
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next slide"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
```

#### 2. Track Current Slide in PitchDeck
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Add state and calculation:
```tsx
const [currentSlide, setCurrentSlide] = useState(0);

// Update current slide based on scroll progress
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  const slideIndex = Math.min(
    Math.floor(latest * PITCH_SLIDES.length),
    PITCH_SLIDES.length - 1
  );
  if (slideIndex !== currentSlide) {
    setCurrentSlide(slideIndex);
  }

  // Existing grid view logic
  const shouldBeGrid = latest >= GRID_THRESHOLD;
  if (shouldBeGrid !== isGridView) {
    setIsGridView(shouldBeGrid);
  }
});
```

#### 3. Add Navigation Handlers
```tsx
const handlePrevSlide = () => {
  if (currentSlide > 0) {
    const scrollTarget = (currentSlide - 1) * window.innerHeight;
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }
};

const handleNextSlide = () => {
  if (currentSlide < PITCH_SLIDES.length - 1) {
    const scrollTarget = (currentSlide + 1) * window.innerHeight;
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }
};
```

#### 4. Add ChevronUp Import
```tsx
import { ChevronDown, ChevronUp } from "lucide-react";
```

#### 5. Render NavigationControls
Add after ScrollHint:
```tsx
{/* Navigation Controls */}
<NavigationControls
  currentSlide={currentSlide}
  totalSlides={PITCH_SLIDES.length}
  onPrev={handlePrevSlide}
  onNext={handleNextSlide}
  isGridView={isGridView}
/>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Prev/next buttons appear at bottom center
- [ ] Slide counter shows correct "X / Y" format
- [ ] Prev button disabled on first slide
- [ ] Next button disabled on last slide
- [ ] Clicking buttons navigates smoothly
- [ ] Counter updates as user scrolls
- [ ] Controls hidden in grid view

---

## Testing Strategy

### Unit Tests (if applicable):
- ScrollHint visibility state management
- Current slide calculation logic

### Manual Testing Steps:
1. Load pitch deck page fresh
2. Verify scroll hint appears with animation
3. Scroll down slightly - verify hint disappears immediately
4. Scroll back to top - verify hint does NOT reappear
5. Refresh page - verify hint appears again
6. Test keyboard navigation still works (Arrow keys, Space, Home, End)
7. Test SlideIndicator clicks still work
8. Test grid view still triggers at end
9. Test on mobile viewport

### Accessibility Testing:
- [ ] Screen reader announces slide changes (if counter added)
- [ ] Keyboard navigation works without mouse
- [ ] Focus states visible on navigation buttons
- [ ] `prefers-reduced-motion` respected (bouncing animation disabled)

## Performance Considerations

- Scroll hint uses passive event listener for scroll detection
- Animation uses `will-change-transform` implicitly via Framer Motion
- Component unmounts completely after first scroll (no hidden DOM)

## References

- Original research: `thoughts/shared/research/2026-01-28-pitch-deck-navigation-ux-analysis.md`
- Current implementation: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- Industry patterns: Apple (bottom-center scroll hints), Stripe (subtle navigation), Linear (keyboard-first)
