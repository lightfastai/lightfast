---
date: 2026-02-12T14:00:00+11:00
researcher: Claude
git_commit: 0f1a53a6
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Pitch Deck Animation System — Deep Debug, Performance & Architecture Analysis"
tags: [research, codebase, pitch-deck, animation, framer-motion, performance, architecture]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: Pitch Deck Animation System — Deep Debug, Performance & Architecture Analysis

**Date**: 2026-02-12T14:00:00+11:00
**Researcher**: Claude
**Git Commit**: 0f1a53a6
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

Deep debug the pitch-deck animation system: analyze performance, identify edge cases, and document the current architecture. Additionally, assess how the system can evolve toward a more maintainable/composable architecture where (1) each slide is a custom 16:9 component inheriting from a base "slide", and (2) all animation calculation logic is isolated and unit-testable.

## Summary

The pitch-deck animation system uses a **scroll-driven stacking pattern** powered by Framer Motion's `useScroll`/`useTransform` hooks, plus a **FLIP-like grid transition** using manual `animate` props with calculated grid positions. The system has 10 slides, two view modes (scroll stack + grid), and dual rendering for desktop (animated) vs mobile (static vertical). Animation calculations are currently inlined inside React components, tightly coupled to rendering, and not independently testable.

---

## 1. Architecture Overview (As-Is)

### File Map

| File | Role |
|------|------|
| `pitch-deck/page.tsx` | Next.js page, renders `<PitchDeck />` |
| `pitch-deck/layout.tsx` | Server component: reads cookie, sets up `PitchDeckProvider`, header, `PitchDeckLayoutContent` |
| `_components/pitch-deck.tsx` | **Core**: 650 lines. Contains `PitchDeck`, `SlideContainer`, `PitchSlide`, `SlideContent`, `SlideIndicator`, `IndicatorLine`, `ScrollHint`, `NavigationControls` |
| `_components/pitch-deck-context.tsx` | React context: `prefaceExpanded`, `isGridView`, `isMobile` |
| `_components/pitch-deck-layout-content.tsx` | Split layout: 30% preface sidebar + 70% slide area |
| `_components/capture-slide.tsx` | Static render for PDF export (no animations) |
| `_components/mobile-bottom-bar.tsx` | Mobile download/fullscreen controls |
| `_lib/motion-features.ts` | Lazy-loads `domMax` for Framer Motion |
| `_lib/export-slides.ts` | PDF export via html2canvas + jsPDF |
| `_lib/export-slides-lazy.ts` | Lazy wrapper for export |
| `slide-content/index.ts` | Barrel export for 6 slide content components |
| `slide-content/title-slide-content.tsx` | Generic title slide (unused directly — custom versions used instead) |
| `slide-content/custom-title-slide.tsx` | First slide: red background, 16x9 grid, centered logo |
| `slide-content/custom-closing-slide.tsx` | Last slide: contact info layout |
| `slide-content/content-slide-content.tsx` | Two-column content: left label + right text list |
| `slide-content/showcase-slide-content.tsx` | Branded color block + metadata table |
| `slide-content/columns-slide-content.tsx` | Multi-column layout (2-4 columns) |
| `config/pitch-deck-data.ts` | `PITCH_SLIDES` array: 10 slides, typed as `const` |

### Data Flow

```
PITCH_SLIDES (config) → PitchDeck (scroll tracking) → SlideContainer (measures width, computes grid layout)
                                                          → PitchSlide × 10 (scroll transforms OR grid animate)
                                                              → SlideContent (dispatches to type-specific component)
                                                                  → Custom{Title,Closing}Slide / Content / Showcase / Columns
```

### Two View Modes

1. **Scroll Stack Mode** (default): Container is `(slides + 1) * 100vh` tall. A sticky inner div pins the viewport. Each `PitchSlide` uses `useTransform` to map `scrollYProgress` to `y`, `scale`, `opacity`, `zIndex`. Slides are `absolute inset-0`, stacking via z-index.

2. **Grid Mode**: Triggered when `scrollYProgress >= 0.92`. Each slide uses `animate` prop to transition to calculated grid position (`gridX`, `gridY`) with `gridScale`. Container height becomes explicit `totalRows * rowHeight`. Reverse stagger: last card animates first.

3. **Mobile**: Simple `space-y-6` vertical layout, no animations, no grid mode.

---

## 2. Animation Calculation Logic (Detailed)

### 2.1 Scroll-Driven Transforms (`PitchSlide`, lines 497-545)

Each slide computes `slideStart = index / totalSlides` and `slideEnd = (index + 1) / totalSlides`.

**Y Transform**:
- First slide: `[0, slideEnd, +0.1, +0.2, +0.3]` → `["0%", "-30px", "-50px", "-60px", "-60px"]`
- Other slides: `[slideStart-0.12, -0.08, slideStart, slideEnd, +0.1, +0.2, +0.3]` → `["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"]`

**Scale Transform**:
- First slide: `[0, slideEnd, +0.1, +0.2, +0.3]` → `[1, 0.95, 0.9, 0.85, 0.85]`
- Other slides: `[slideStart-0.08, slideStart, slideEnd, +0.1, +0.2, +0.3]` → `[1, 1, 0.95, 0.9, 0.85, 0.85]`

**Opacity Transform** (all slides):
- `[slideEnd+0.15, +0.25, +0.35]` → `[1, 0.6, 0]`

**Z-Index Transform** (all slides):
- `[slideStart-0.1, slideStart, slideEnd]` → `[index, index+1, index+1]`

### 2.2 Grid Position Calculation (`SlideContainer`, lines 402-471)

```
GRID_COLS = 4
GRID_GAP = 24px
GRID_ROW_GAP = 32px

thumbWidth = (containerWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS
thumbHeight = thumbWidth * (9/16)
gridScale = thumbWidth / containerWidth
rowHeight = thumbHeight + GRID_ROW_GAP

For slide at index:
  col = index % GRID_COLS
  row = floor(index / GRID_COLS)
  gridX = col * (thumbWidth + GRID_GAP)
  gridY = row * rowHeight
```

Each slide animates to `{ x: gridX, y: gridY, scale: gridScale, opacity: 1, zIndex: 1 }` with `origin-top-left`.

### 2.3 Grid Title Counter-Scaling (line 616-619)

Grid titles are counter-scaled by `1/gridScale` to remain readable when the parent slide is scaled down.

### 2.4 Indicator Line Transforms (`IndicatorLine`, lines 255-289)

```
opacity: [slideStart-0.05, slideStart, slideEnd-0.05, slideEnd] → [0.3, 1, 1, 0.3]
width:   [slideStart-0.05, slideStart, slideEnd-0.05, slideEnd] → [24, 40, 40, 24]
```

---

## 3. Performance Analysis

### 3.1 What's Working Well

- **LazyMotion + domMax**: Bundle is code-split. Only loads ~25kb of Framer Motion when the pitch deck is visited.
- **Scroll-driven MotionValues**: `useTransform` creates GPU-composited animations. No React re-renders during scroll — transforms are applied directly via Framer Motion's animation loop.
- **ResizeObserver for container measurement**: Grid calculations update when container resizes.
- **`will-change-transform`** class applied only in scroll mode, not grid mode.

### 3.2 Performance Concerns

1. **10 simultaneously mounted `useTransform` calls per property**: Each of the 10 slides creates 4 `useTransform` hooks (y, scale, opacity, zIndex). That's 40 active MotionValue subscriptions during scroll. Framer Motion handles this efficiently via its internal animation loop, but it's worth noting.

2. **`useMotionValueEvent` triggers React state updates**: The `scrollYProgress` change handler at line 44 calls `setCurrentSlide()` on every scroll position change where the slide index differs. This causes React re-renders of `PitchDeck` and its children during scroll. However, since MotionValues are applied outside React's render cycle, this primarily affects the `NavigationControls` counter text.

3. **Grid mode: container height recalculated on every render**: `SlideContainer` computes `totalRows * rowHeight` inline in JSX. If `containerWidth` changes, all 10 slides re-render to receive new `gridScale`, `thumbWidth`, `rowHeight` props.

4. **No `React.memo` on `PitchSlide`**: Every state change in `PitchDeck` (currentSlide, isGridView) triggers re-render of all 10 `PitchSlide` components. The MotionValue-based scroll animations are unaffected, but React reconciliation still runs.

5. **144 grid cells in `CustomTitleSlide`**: The first slide renders 144 `<div>` elements for the grid pattern. Each has hover CSS transitions. In grid mode at small scale, these are invisible but still in the DOM.

6. **`exitGridToSlide` uses `requestAnimationFrame` + `setTimeout(100ms)`**: The transition guard `isTransitioningRef` is time-based, not animation-completion-based. If the browser is under load, 100ms might not be enough.

### 3.3 Bundle Impact

- `framer-motion` domMax: ~25kb gzipped
- `html2canvas-pro` + `jsPDF`: Lazy-loaded only on PDF export
- Slide content components: Small, no external dependencies

---

## 4. Edge Cases

### 4.1 Scroll Boundary Conditions

- **`scrollYProgress` at exactly 0 or 1**: First slide's y-transform maps `[0, slideEnd, ...]`. At progress=0, y="0%" which is correct. At progress=1.0, all slides should be stacked/hidden except potentially the last.

- **Grid threshold overlap**: `GRID_THRESHOLD = 0.92`. With 10 slides, `slideEnd` for the last slide (index 9) is `10/10 = 1.0`. The slide tracking logic `Math.floor(latest * 10)` clamps to 9 via `Math.min`. But at progress 0.92-1.0, the last slide is still "active" while grid mode triggers. This means the last slide animates from its scroll-driven position to grid position — which should work since `style` is cleared when `isGridView` is true.

- **Rapid scroll past grid threshold and back**: The `isTransitioningRef` guard only applies when exiting grid. Entering grid has no guard — so rapid oscillation around 0.92 could toggle `isGridView` multiple times in quick succession.

### 4.2 Grid-to-Scroll Transition

- **`exitGridToSlide` scrolls to `index * window.innerHeight`**: This assumes each slide occupies exactly 1 viewport height of scroll space. With `(PITCH_SLIDES.length + 1) * 100vh` total height and 10 slides, the actual scroll range per slide is `totalScrollHeight / (10 + 1)`, not `window.innerHeight`. The formula should be `index * (document.body.scrollHeight / (PITCH_SLIDES.length + 1))` or similar.

  - **Current**: `scrollTarget = index * window.innerHeight`
  - **Expected**: With 11 viewport heights total, each slide maps to `scrollHeight / 11` pixels of scroll. For 10 slides (0-9), the correct target is `index * (scrollHeight / 11)`.

  This is potentially a bug — if the page has any additional height contributors (header, padding), the targets would drift.

### 4.3 Window Resize During Grid Mode

- `containerWidth` updates via ResizeObserver → grid positions recalculate → slides re-render with new `thumbWidth`/`gridScale`. However, since grid positions are applied via `animate` prop, Framer Motion will animate to the new positions rather than snapping. This could cause visible sliding during resize.

### 4.4 Preface Sidebar Toggle

- The preface sidebar is 30% width. When toggled, the slide container width changes from 70% to 100% of viewport. In scroll mode: slides reflow within their container naturally (max-width 1200px). In grid mode: `containerWidth` updates → new grid positions calculated → slides animate to new positions. This should work but could cause brief layout animation during toggle.

### 4.5 Keyboard Navigation in Grid Mode

- Arrow keys still call `window.scrollBy({ top: scrollAmount })`. In grid mode, the container height is `auto` (not 1100vh), so scrolling might not behave as expected. The keyboard handler doesn't check `isGridView`.

### 4.6 Scroll Backward in Grid Mode

- A wheel event listener (lines 112-124) catches upward scrolls in grid mode and calls `exitGridToSlide(PITCH_SLIDES.length - 1)`. But it uses `passive: false` which blocks the main thread during scroll.

### 4.7 Mobile Detection Timing

- `useIsMobile()` returns `undefined` during SSR/hydration. The preface defaults to `defaultPrefaceExpanded` (from cookie) initially, then collapses to false when `isMobile` resolves. This could cause a layout shift on mobile.

---

## 5. Current Slide Content Architecture

### 5.1 Slide Type System

The `PITCH_SLIDES` array uses discriminated unions via `type` field:
- `"title"`: `{ title, subtitle, bgColor }`
- `"content"`: `{ title, gridTitle, leftText, rightText[], bgColor, textColor }`
- `"showcase"`: `{ title, metadata[], bgColor, textColor }`
- `"columns"`: `{ title, gridTitle, columns[], bgColor, textColor }`

`SlideContent` function (line 628) dispatches by type + id:
- `type === "title" && id === "title"` → `CustomTitleSlide`
- `type === "title" && id === "vision"` → `CustomClosingSlide`
- `type === "content"` → `ContentSlideContent`
- `type === "showcase"` → `ShowcaseSlideContent`
- `type === "columns"` → `ColumnsSlideContent`

### 5.2 Variant System

Each slide content component accepts `variant: "responsive" | "fixed"`:
- `"responsive"`: Uses responsive Tailwind classes (`text-xl sm:text-2xl md:text-3xl`)
- `"fixed"`: Uses fixed pixel sizes (`text-5xl`) — for PDF capture at 1920x1080

### 5.3 Observations on Current Composability

- **No base slide component**: Each slide type independently implements its own layout, padding, and typography. There's no shared "slide shell" that enforces 16:9, consistent padding, or common patterns.
- **Tight coupling to `PITCH_SLIDES` type**: All slide components use `Extract<(typeof PITCH_SLIDES)[number], { type: "..." }>` which couples them to the specific data structure.
- **SlideContent dispatcher is id-based**: The first and last slides are dispatched by `id` string, not by type. This means adding new custom slides requires modifying the dispatcher.
- **CaptureSlide duplicates dispatch logic**: The PDF capture component at `capture-slide.tsx` has its own copy of the slide type → component mapping.

---

## 6. Animation Logic Testability Assessment

### 6.1 What's Currently Untestable

All animation calculations are inlined inside React component bodies:

1. **Scroll transform keyframes** (PitchSlide, lines 502-545): The input/output arrays for `useTransform` are computed inline based on `index`, `totalSlides`, `slideStart`, `slideEnd`. These cannot be tested without rendering the component.

2. **Grid position calculations** (SlideContainer, lines 433-439): `thumbWidth`, `thumbHeight`, `gridScale`, `rowHeight`, `gridX`, `gridY` are computed inline. Cannot be unit-tested.

3. **Grid title counter-scaling** (PitchSlide, line 617): `1/gridScale` is inline.

4. **Indicator keyframes** (IndicatorLine, lines 266-279): Inline `useTransform` input/output arrays.

5. **Grid threshold** and **slide index from progress** (PitchDeck, lines 41-61): Business logic mixed with event handler.

### 6.2 What Could Be Extracted

All of the above are pure functions of their inputs. For example:

```typescript
// These are all pure: (inputs) → (keyframe arrays)
getSlideYKeyframes(index, totalSlides, isFirstSlide) → { input: number[], output: string[] }
getSlideScaleKeyframes(index, totalSlides, isFirstSlide) → { input: number[], output: number[] }
getSlideOpacityKeyframes(slideEnd) → { input: number[], output: number[] }
getSlideZIndexKeyframes(index, slideStart, slideEnd) → { input: number[], output: number[] }
getGridPosition(index, containerWidth, gridCols, gridGap, gridRowGap) → { x, y, scale }
getSlideIndexFromProgress(progress, totalSlides) → number
shouldEnterGridView(progress, threshold) → boolean
```

---

## 7. Code References

### Core Animation
- Scroll container setup: `_components/pitch-deck.tsx:144-149`
- Scroll-driven y transform: `_components/pitch-deck.tsx:502-518`
- Scroll-driven scale: `_components/pitch-deck.tsx:520-533`
- Scroll-driven opacity: `_components/pitch-deck.tsx:535-539`
- Scroll-driven zIndex: `_components/pitch-deck.tsx:541-545`
- Grid constants: `_components/pitch-deck.tsx:403-405`
- Grid position calculation: `_components/pitch-deck.tsx:547-553`
- Grid animate prop: `_components/pitch-deck.tsx:570-583`
- Grid threshold: `_components/pitch-deck.tsx:41`
- Slide index from progress: `_components/pitch-deck.tsx:44-51`
- Exit grid transition: `_components/pitch-deck.tsx:94-105`
- Scroll backward in grid: `_components/pitch-deck.tsx:112-124`

### Slide Content
- SlideContent dispatcher: `_components/pitch-deck.tsx:628-649`
- CaptureSlide (duplicate dispatcher): `_components/capture-slide.tsx:27-53`
- Variant type: `slide-content/title-slide-content.tsx:7`

### State Management
- PitchDeckContext: `_components/pitch-deck-context.tsx:10-22`
- Preface cookie persistence: `_components/pitch-deck-context.tsx:60-64`
- Grid view state: `_components/pitch-deck-context.tsx:51`

### Data
- PITCH_SLIDES definition: `config/pitch-deck-data.ts:1-156`
- 10 slides: title, intro, problem, solution, insight, why-now, team, validation, ask, vision

---

## 8. Historical Context (from thoughts/)

- `thoughts/shared/research/2026-01-23-pitch-deck-stacking-animation-bugs.md` — Early bug analysis: z-index inversion, content bleed-through, chaotic ordering. All fixed in current implementation.
- `thoughts/shared/research/2026-01-23-pitch-deck-animation-improvements.md` — Documented removal of fade-in effect and grid overview implementation approach.
- `thoughts/shared/plans/2026-02-12-pitch-deck-flip-transition.md` — Most recent plan: unified DOM elements, FLIP animation via manual grid position calculation (not Framer `layout` prop). This is what was implemented.
- `thoughts/shared/plans/2026-01-28-pitch-deck-shared-component-architecture.md` — Earlier plan for shared component architecture.
- `thoughts/shared/research/2026-01-28-pitch-deck-shared-component-architecture.md` — Research on shared component patterns.

---

## 9. Related Research

- `thoughts/shared/research/2026-01-23-pitch-deck-flabbergast-comparison.md`
- `thoughts/shared/plans/2026-01-23-pitch-deck-flabbergast-dimensions.md`
- `thoughts/shared/plans/2026-01-28-pitch-deck-mobile-experience.md`

---

## 10. Open Questions

1. **Grid-to-scroll scroll target calculation**: Is `index * window.innerHeight` correct, or should it account for the `+1` extra viewport in the total container height?
2. **Rapid grid threshold oscillation**: Should there be a debounce or hysteresis on the grid threshold (e.g., enter at 0.92, exit only below 0.88)?
3. **Keyboard navigation in grid mode**: Should arrow keys navigate grid items instead of scrolling?
4. **`passive: false` wheel listener**: Can the scroll-backward-in-grid handler be made passive, or does it need `preventDefault()`?
5. **144 grid cells on title slide**: Should these be virtualized or simplified when the slide is at thumbnail scale in grid mode?
