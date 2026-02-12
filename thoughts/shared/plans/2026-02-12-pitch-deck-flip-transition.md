# Pitch Deck Scroll-to-Grid FLIP Transition — Implementation Plan

## Overview

Replace the pitch deck's two separate render paths (scroll stacking + grid overlay) with a single set of DOM elements that FLIP-animate from scroll positions into a CSS grid using Framer Motion's `layout` animations. No new libraries.

## Current State Analysis

The pitch deck has **two independent render trees** for the same slide content:

1. **Scroll view** (`PitchSlide` at line 471): Absolutely positioned slides inside a sticky container. Scroll-driven `useTransform` for y/scale/opacity/zIndex. **Returns `null` when `isGridView` is true** (line 533).

2. **Grid overlay** (`GridView` at line 204 + `GridSlideItem` at line 226): A fixed overlay (`z-40`, `bg-background/95`, `backdrop-blur-sm`) with a CSS grid of separately rendered, 4x-scaled-down slide content. Wrapped in `AnimatePresence` for fade in/out.

### Key Files:
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx` — All components
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx` — `isGridView` state
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-layout-content.tsx` — Preface sidebar layout
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/motion-features.ts` — Loads `domAnimation` (needs `domMax`)
- `apps/www/src/config/pitch-deck-data.ts` — 10 slides

### Key Discoveries:
- `motion-features.ts:8-9`: Currently loads `domAnimation` which does NOT support layout animations
- `pitch-deck.tsx:533`: `if (isGridView) return null` is the core problem — removes slides from DOM
- `pitch-deck.tsx:117-118`: Sticky container is `sticky top-0 h-screen flex flex-col items-center justify-center`
- `pitch-deck.tsx:123`: Slides container is `relative w-full max-w-[1200px] aspect-[16/9] overflow-visible`
- `pitch-deck.tsx:112-116`: Scroll container height is `(PITCH_SLIDES.length + 1) * 100vh` = 1100vh
- `GridSlideItem` uses 400%/0.25 scale trick for thumbnails (line 261-264)
- Grid uses `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (line 216) — we'll standardize to 4 cols on desktop
- Grid stagger is reverse order: `(totalSlides - 1 - index) * 0.05` (line 238) — we'll change to forward order

## Desired End State

A single set of slide DOM elements that:
1. Stack with scroll-driven transforms in scroll mode (identical to current)
2. FLIP-animate into a 4-column grid when `scrollYProgress >= 0.92`
3. Reverse-animate back to scroll positions when a grid item is clicked
4. Mobile view unchanged (simple vertical scroll, no grid)

### Verification:
- Scroll through all 10 slides — behavior identical to current
- Scroll past last slide — slides animate from stacked positions into 4-col grid with stagger
- Click any grid item — slides reverse-animate back, scroll jumps to clicked slide
- Toggle preface sidebar — grid adapts to available width
- Test with `prefers-reduced-motion` — instant layout swap, no animation
- Mobile — no grid transition, vertical scroll only

## What We're NOT Doing

- No GSAP or new animation libraries
- No changes to slide content components (CustomTitleSlide, ContentSlideContent, etc.)
- No changes to mobile view
- No changes to SlideIndicator, ScrollHint, NavigationControls (they already hide in grid view)
- No changes to keyboard navigation
- No changes to pitch-deck-context.tsx (isGridView/setIsGridView API stays the same)
- No changes to pitch-deck-layout-content.tsx

## Implementation Approach

Use Framer Motion's `layout` prop on a single set of slide elements. When `isGridView` toggles:
1. The parent container switches from sticky/absolute positioning to CSS grid
2. Each slide's `m.article` has `layout` prop — Framer Motion calculates FLIP automatically
3. Scroll-driven MotionValues are frozen at transition moment, then cleared
4. Content scaling (full → thumbnail) handled via CSS transform within each slide

The key insight: we don't need to manually calculate FLIP positions. Framer Motion's `layout` prop does this automatically when the element's CSS-computed position/size changes.

---

## Phase 1: Update Motion Features Loader

### Overview
Enable layout animation support by switching from `domAnimation` to `domMax`.

### Changes Required:

#### 1. Motion features loader
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/motion-features.ts`

Replace `domAnimation` with `domMax`:

```ts
/**
 * Async loader for Framer Motion domMax features.
 * domMax includes layout animations required for FLIP transitions.
 * Bundle impact: ~15kb → ~25kb (additional ~10kb for layout engine).
 */
export const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domMax);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @apps/www typecheck`
- [x] No lint errors: `pnpm --filter @apps/www lint` (no errors in motion-features.ts)

#### Manual Verification:
- [x] Pitch deck loads without errors in browser console
- [x] Existing scroll animation still works

**Implementation Note**: This is a prerequisite for all subsequent phases.

---

## Phase 2: Unify Slide DOM — Remove Dual Render Paths

### Overview
Remove the separate GridView/GridSlideItem components and the `return null` guard in PitchSlide. Create a single slide container that switches layout mode based on `isGridView`.

### Changes Required:

#### 1. Remove GridView and GridSlideItem components
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Delete:
- `GridView` function (lines 204-223)
- `GridSlideItem` function (lines 226-281)
- The `AnimatePresence` block wrapping the grid (lines 183-198)

#### 2. Remove the `return null` guard in PitchSlide
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Delete lines 532-535:
```tsx
// DELETE THIS:
if (isGridView) {
  return null;
}
```

#### 3. Restructure the slide container
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Replace the current sticky container + absolute-positioned slides structure with a container that switches between two layout modes.

**Current structure** (lines 112-156):
```tsx
<div ref={containerRef} className="hidden lg:block relative" style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}>
  <div className="sticky top-0 h-screen flex flex-col items-center justify-center page-gutter py-16 overflow-visible">
    <div className="relative w-full max-w-[1200px] aspect-[16/9] overflow-visible">
      {PITCH_SLIDES.map(...)}  {/* absolutely positioned slides */}
    </div>
    {/* indicators, controls */}
  </div>
</div>
```

**New structure**:
```tsx
<div
  ref={containerRef}
  className="hidden lg:block relative"
  style={{ height: isGridView ? "auto" : `${(PITCH_SLIDES.length + 1) * 100}vh` }}
>
  {/* Sticky wrapper — only sticky in scroll mode */}
  <div
    className={cn(
      "flex flex-col items-center page-gutter py-16",
      isGridView
        ? "min-h-screen justify-start pt-24"
        : "sticky top-0 h-screen justify-center overflow-visible"
    )}
  >
    {/* Slide container — switches between absolute positioning and CSS grid */}
    <div
      className={cn(
        "w-full",
        isGridView
          ? "max-w-7xl grid grid-cols-4 gap-6"
          : "relative max-w-[1200px] aspect-[16/9] overflow-visible"
      )}
    >
      {PITCH_SLIDES.map((slide, index) => (
        <PitchSlide
          key={slide.id}
          slide={slide}
          index={index}
          totalSlides={PITCH_SLIDES.length}
          scrollProgress={scrollYProgress}
          isGridView={isGridView}
          onGridItemClick={() => handleGridItemClick(index)}
        />
      ))}
    </div>

    {/* Indicators and controls — unchanged */}
    <SlideIndicator ... />
    <ScrollHint ... />
    <NavigationControls ... />
  </div>
</div>
```

Key changes:
- Container height becomes `auto` in grid mode (no more 1100vh scroll space)
- Sticky wrapper loses `sticky top-0 h-screen` in grid mode, gets `min-h-screen pt-24`
- Slide container switches from `relative max-w-[1200px] aspect-[16/9]` to `max-w-7xl grid grid-cols-4 gap-6`

#### 4. Rewrite PitchSlide to handle both modes
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

```tsx
function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
  onGridItemClick,
}: PitchSlideProps & { onGridItemClick: () => void }) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  const isFirstSlide = index === 0;

  // --- Scroll-driven transforms (unchanged) ---
  const y = useTransform(
    scrollProgress,
    isFirstSlide
      ? [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3]
      : [slideStart - 0.12, slideStart - 0.08, slideStart, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
    isFirstSlide
      ? ["0%", "-30px", "-50px", "-60px", "-60px"]
      : ["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"],
  );

  const scale = useTransform(
    scrollProgress,
    isFirstSlide
      ? [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3]
      : [slideStart - 0.08, slideStart, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
    isFirstSlide ? [1, 0.95, 0.9, 0.85, 0.85] : [1, 1, 0.95, 0.9, 0.85, 0.85],
  );

  const opacity = useTransform(
    scrollProgress,
    [slideEnd + 0.15, slideEnd + 0.25, slideEnd + 0.35],
    [1, 0.6, 0],
  );

  const zIndex = useTransform(
    scrollProgress,
    [slideStart - 0.1, slideStart, slideEnd],
    [index, index + 1, index + 1],
  );

  // --- Transition state ---
  const [isAnimatingToGrid, setIsAnimatingToGrid] = useState(false);

  // Freeze scroll-driven values when entering grid mode
  useEffect(() => {
    if (isGridView) {
      setIsAnimatingToGrid(true);
    }
  }, [isGridView]);

  // Determine which styles to apply
  const scrollStyle = isGridView
    ? { y: 0, scale: 1, opacity: 1, zIndex: 1 }    // Clear transforms in grid mode
    : { y, scale, opacity, zIndex };                  // Scroll-driven in scroll mode

  // Reduced motion check
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <m.article
      layout
      style={scrollStyle}
      className={cn(
        isGridView
          ? "relative cursor-pointer group"                          // Grid: flow layout
          : "absolute inset-0 will-change-transform origin-center"  // Scroll: absolute positioned
      )}
      transition={{
        layout: {
          duration: prefersReducedMotion ? 0 : 0.6,
          delay: prefersReducedMotion ? 0 : index * 0.04,
          ease: [0.25, 0.1, 0.25, 1],
        },
      }}
      onClick={isGridView ? onGridItemClick : undefined}
      onLayoutAnimationComplete={() => setIsAnimatingToGrid(false)}
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      {/* Slide content wrapper — scales down in grid mode */}
      <div
        className={cn(
          "rounded-lg overflow-hidden shadow-2xl",
          isGridView && "rounded-sm shadow-lg transition-shadow duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-white/20",
          slide.bgColor,
        )}
        style={{
          "--foreground": "oklch(0.205 0 0)",
          aspectRatio: "16/9",
        } as React.CSSProperties}
      >
        {/* In grid mode: use 400%/0.25 scale trick for thumbnail rendering */}
        <div
          className={cn(
            "relative h-full flex flex-col justify-between",
            isGridView
              ? "w-[400%] h-[400%] origin-top-left p-6 sm:p-8 md:p-12"
              : "w-full p-6 sm:p-8 md:p-12"
          )}
          style={isGridView ? { transform: "scale(0.25)" } : undefined}
        >
          <SlideContent slide={slide} />
        </div>
      </div>

      {/* Grid title label — only in grid mode */}
      {isGridView && "gridTitle" in slide && slide.gridTitle && (
        <p className="mt-2 text-xs text-muted-foreground text-center truncate">
          {slide.gridTitle}
        </p>
      )}
    </m.article>
  );
}
```

#### 5. Update PitchSlideProps type
```tsx
interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
  onGridItemClick: () => void;
}
```

#### 6. Update handleGridItemClick to handle reverse transition
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

```tsx
const handleGridItemClick = (index: number) => {
  // First exit grid view — triggers reverse FLIP animation
  setIsGridView(false);

  // After a brief delay for the animation to start, scroll to the target slide
  // The scroll position needs to be set so that the scroll-driven transforms
  // place the clicked slide in the active position
  requestAnimationFrame(() => {
    const scrollTarget = index * window.innerHeight;
    window.scrollTo({ top: scrollTarget, behavior: "instant" });
  });
};
```

#### 7. Prevent scroll-driven grid toggle from re-triggering during reverse transition

Add a `isTransitioning` ref to prevent the scroll progress handler from immediately re-entering grid view when we programmatically scroll during the reverse transition:

```tsx
const isTransitioningRef = useRef(false);

const handleGridItemClick = (index: number) => {
  isTransitioningRef.current = true;
  setIsGridView(false);

  requestAnimationFrame(() => {
    const scrollTarget = index * window.innerHeight;
    window.scrollTo({ top: scrollTarget, behavior: "instant" });
    // Allow scroll handler to work again after scroll settles
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 100);
  });
};

// In the scroll handler:
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  // ... existing slide tracking ...

  if (isTransitioningRef.current) return;

  const shouldBeGrid = latest >= GRID_THRESHOLD;
  if (shouldBeGrid !== isGridView) {
    setIsGridView(shouldBeGrid);
  }
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @apps/www typecheck`
- [x] No lint errors: `pnpm --filter @apps/www lint` (no errors in pitch-deck.tsx)
- [x] Build succeeds: `pnpm --filter @apps/www build` (compilation successful, blog page timeout unrelated)

#### Manual Verification:
- [ ] Scrolling through slides works identically to before
- [ ] At scroll threshold (~92%), slides animate from stacked positions into 4-column grid
- [ ] Animation is staggered (first slide moves first, ~40ms between each)
- [ ] Grid items are clickable and reverse-animate back to scroll view
- [ ] Clicked slide is in view after returning from grid
- [ ] No layout shift or flash during transition
- [ ] Mobile view unchanged (no grid transition, vertical scroll only)
- [ ] Preface sidebar toggle works correctly with grid layout
- [ ] Grid items show hover effects (scale + shadow)
- [ ] Grid titles appear below slides in grid mode
- [ ] Test with `prefers-reduced-motion` enabled — instant swap, no animation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the transitions look correct before proceeding to Phase 3.

---

## Phase 3: Polish and Edge Cases

### Overview
Handle edge cases, optimize performance, and ensure smooth experience across all states.

### Changes Required:

#### 1. will-change cleanup
Add `will-change: transform` during layout animation, remove after completion:

```tsx
// In PitchSlide:
const [isLayoutAnimating, setIsLayoutAnimating] = useState(false);

useEffect(() => {
  if (isGridView) setIsLayoutAnimating(true);
}, [isGridView]);

// On the m.article:
style={{
  ...scrollStyle,
  willChange: isLayoutAnimating ? "transform" : "auto",
}}
onLayoutAnimationComplete={() => setIsLayoutAnimating(false)}
```

#### 2. Reduced motion — use a hook instead of inline check
Move the `prefers-reduced-motion` check to a proper hook/ref to avoid SSR issues:

```tsx
const prefersReducedMotion = useRef(false);

useEffect(() => {
  prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}, []);
```

#### 3. Scroll position handling on grid entry
When entering grid mode, the container height changes from 1100vh to auto. This can cause a scroll jump. Lock scroll position:

```tsx
useEffect(() => {
  if (isGridView) {
    // Scroll to top of grid view
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}, [isGridView]);
```

#### 4. Grid background overlay
The current GridView has `bg-background/95 backdrop-blur-sm`. Since we're no longer using an overlay, we need to ensure the grid mode has a proper background. The parent container's background should handle this — the page background is already `bg-background`.

If needed, add a background class to the sticky wrapper in grid mode:
```tsx
className={cn(
  "...",
  isGridView && "bg-background"
)}
```

#### 5. AnimatePresence cleanup
Remove the `AnimatePresence` import if no longer used elsewhere in the file. Check that `useScroll`, `useTransform`, `useMotionValueEvent` are still needed (they are — for scroll mode).

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @apps/www typecheck`
- [ ] Lint passes: `pnpm --filter @apps/www lint`
- [ ] Build succeeds: `pnpm --filter @apps/www build`

#### Manual Verification:
- [ ] No scroll jump when entering/exiting grid mode
- [ ] `will-change` is only applied during animation (check DevTools)
- [ ] Works correctly with `prefers-reduced-motion: reduce`
- [ ] Grid background is consistent (no transparency/blur artifacts)
- [ ] Performance: no jank during transition (check Chrome DevTools Performance tab)
- [ ] Content scaling looks smooth — no text "jumping" during FLIP
- [ ] All 10 slides render correctly in both scroll and grid modes

**Implementation Note**: After completing this phase, pause for final manual review of the complete experience.

---

## Testing Strategy

### Manual Testing Steps:
1. Load pitch deck → scroll through all 10 slides → verify identical behavior to current
2. Scroll past last slide → verify grid transition triggers at correct threshold
3. Observe staggered animation — first slide should move first
4. Click various grid items → verify reverse animation + correct scroll position
5. Toggle preface sidebar (Cmd+B) in both modes → verify layout adapts
6. Resize browser window during grid mode → verify responsive grid
7. Rapid scroll in/out of grid threshold → verify no glitching or stuck states
8. Enable `prefers-reduced-motion` → verify instant layout swap
9. Test on mobile viewport → verify no grid transition behavior
10. Check browser console for errors/warnings throughout

### Performance Testing:
- Chrome DevTools Performance recording during transition
- Verify no layout thrashing (should see only composite/paint, no reflow)
- Check GPU memory (will-change cleanup working)
- Verify `domMax` bundle size impact (~10kb additional)

## Performance Considerations

- **Bundle size**: `domMax` adds ~10kb over `domAnimation`. This is acceptable for the layout animation capability.
- **GPU memory**: `will-change: transform` is applied only during animation and cleaned up after.
- **Layout thrashing**: Framer Motion's layout animation uses `transform` and `getBoundingClientRect` — no continuous reflow.
- **Scroll performance**: Scroll-driven transforms remain MotionValues (GPU-composited), not affected by layout prop.

## References

- Framer Motion layout animations: https://www.framer.com/motion/layout-animations/
- Reference implementation: https://flabbergast.agency/pitch-deck/
- Current pitch-deck.tsx: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
