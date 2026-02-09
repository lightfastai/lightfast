# Framer Motion Bundle Optimization for Pitch Deck

## Overview

Completely optimize the pitch-deck component's Framer Motion bundle size through LazyMotion implementation, async feature loading, and CSS transition conversion. This reduces the initial JavaScript bundle from ~34kb to ~4.6kb with features lazy-loaded on demand.

## Current State Analysis

### File Structure
```
pitch-deck/_components/
├── pitch-deck.tsx              # Main component (desktop + mobile, imports framer-motion)
├── pitch-deck-layout-content.tsx # Preface sidebar (imports framer-motion)
├── pitch-deck-context.tsx      # Context provider
└── ...
```

### Current Framer Motion Usage

**`pitch-deck.tsx`** (lines 4-11):
```typescript
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
```

**Components using `motion`:**
- `GridView` (line 201) - fade in/out overlay
- `GridSlideItem` (line 235) - staggered entry + hover
- `SlideIndicator` (line 289) - opacity animation
- `IndicatorLine` (line 337) - scroll-based width/opacity
- `ScrollHint` (line 367, 382) - fade + infinite animation
- `NavigationControls` (line 420) - opacity toggle
- `PitchSlide` (line 532) - scroll-driven transforms

**`pitch-deck-layout-content.tsx`** (line 3):
```typescript
import { motion } from "framer-motion";
```
- Animates preface sidebar with `x`, `opacity`, `marginLeft`, `width`

### Key Discoveries:
- Current architecture uses CSS visibility (`hidden lg:block` / `lg:hidden`) for mobile/desktop switching (`pitch-deck.tsx:111,156`)
- Framer Motion hooks (`useScroll`, `useTransform`) run even on mobile
- Mobile view at lines 156-176 is completely static - no animations needed
- All `motion` components can be replaced with `m` + LazyMotion
- Layout sidebar animations use only CSS-animatable properties

### Bundle Size Impact (Current)
| Component | Size (min+gzip) |
|-----------|-----------------|
| Full `motion` import | ~34kb |
| Total shipped to ALL users | ~34kb |

## Desired End State

After implementation:
1. Initial bundle contains only `m` component (~4.6kb)
2. Animation features (`domAnimation`) load asynchronously (~15-18kb)
3. Layout sidebar uses CSS transitions (0kb Framer Motion)
4. Total reduction: ~34kb → ~4.6kb initial + ~15kb async
5. No visual regression on any device

### Target Bundle Size
| Component | Size (min+gzip) | Loading |
|-----------|-----------------|---------|
| `m` component | ~4.6kb | Initial |
| `domAnimation` features | ~15-18kb | Async |
| Layout sidebar | 0kb | CSS only |
| **Total** | ~4.6kb initial | +15kb lazy |

### Verification:
- Bundle analyzer shows framer-motion split into chunks
- `domAnimation` loads after initial render
- No Framer Motion in `pitch-deck-layout-content.tsx`
- Visual comparison matches current behavior

## What We're NOT Doing

- **NOT using `domMax`** - Only need `domAnimation` (no drag/layout animations)
- **NOT splitting mobile/desktop** - Current CSS-based architecture is simpler
- **NOT removing scroll hooks** - They're essential for desktop experience and tree-shake well

## Implementation Approach

1. Convert `pitch-deck-layout-content.tsx` to CSS transitions (removes one FM import)
2. Create async feature loader for `domAnimation`
3. Replace all `motion` with `m` in `pitch-deck.tsx`
4. Wrap component tree with `LazyMotion`
5. Verify bundle optimization

---

## Phase 1: Convert Layout Animation to CSS

### Overview
Replace Framer Motion in `pitch-deck-layout-content.tsx` with CSS transitions. This completely removes one Framer Motion import file.

### Changes Required:

#### 1. Update `pitch-deck-layout-content.tsx`

**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-layout-content.tsx`

```typescript
"use client";

import { cn } from "@repo/ui/lib/utils";
import { usePitchDeck } from "./pitch-deck-context";

interface PitchDeckLayoutContentProps {
  children: React.ReactNode;
}

export function PitchDeckLayoutContent({ children }: PitchDeckLayoutContentProps) {
  const { prefaceExpanded } = usePitchDeck();

  return (
    <div className="flex min-h-screen">
      {/* Left Column - Founder Preface */}
      <div
        className={cn(
          "fixed top-0 left-0 w-[30%] h-screen bg-background z-30",
          "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          prefaceExpanded
            ? "translate-x-0 opacity-100"
            : "-translate-x-full opacity-0"
        )}
      >
        <div className="w-full h-full page-gutter">
          <div className="absolute top-1/2 -translate-y-1/2 left-8 md:left-16 right-8 md:right-16">
            <div className="max-w-md">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                A Note from the Founder
              </p>
              <div className="space-y-4 text-sm lg:text-base text-muted-foreground leading-relaxed">
                <p>
                  Thank you for taking the time to learn about what we&apos;re building.
                </p>
                <p>
                  This deck represents months of conversations with engineers, late nights
                  refining our vision, and a genuine belief that we can make a difference
                  in how teams work.
                </p>
                <p>
                  I&apos;d love to hear your thoughts—whether it&apos;s feedback, questions,
                  or just a conversation about where this space is heading.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm font-medium text-foreground">Jeevan Pillay</p>
                <p className="text-xs text-muted-foreground">Founder, Lightfast</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Slides */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          prefaceExpanded ? "ml-[30%] w-[70%]" : "ml-0 w-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}
```

**Key Changes:**
- Remove `import { motion } from "framer-motion"`
- Add `import { cn } from "@repo/ui/lib/utils"`
- Replace `<motion.div>` with `<div>`
- CSS classes handle all animations:
  - `transition-all duration-300` = 0.3s duration
  - `ease-[cubic-bezier(0.25,0.1,0.25,1)]` = custom easing
  - `translate-x-0` / `-translate-x-full` = x animation
  - `opacity-100` / `opacity-0` = fade
  - `ml-[30%] w-[70%]` / `ml-0 w-full` = margin/width animation

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`
- [x] No framer-motion in file: `grep "framer-motion" apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-layout-content.tsx` returns empty

#### Manual Verification:
- [x] Preface sidebar slides in/out smoothly (Cmd/Ctrl+B)
- [x] Content area width transitions smoothly
- [x] Animation timing matches previous behavior
- [x] No layout jumps or flicker

**Implementation Note**: Pause for manual verification before Phase 2.

---

## Phase 2: Create Async Feature Loader

### Overview
Create a module that dynamically imports `domAnimation` features for use with LazyMotion.

### Changes Required:

#### 1. Create `motion-features.ts`

**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/motion-features.ts`

```typescript
/**
 * Async loader for Framer Motion domAnimation features.
 * This keeps the ~15-18kb domAnimation bundle out of the initial load.
 *
 * Usage with LazyMotion:
 * <LazyMotion features={loadMotionFeatures} strict>
 */
export const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domAnimation);
```

This creates a dynamic import that Next.js will code-split into a separate chunk.

### Success Criteria:

#### Automated Verification:
- [x] File exists and exports `loadMotionFeatures`
- [x] TypeScript compiles: `pnpm typecheck`

---

## Phase 3: Implement LazyMotion + `m` Component

### Overview
Replace all `motion` imports with `m` and wrap the component tree with `LazyMotion`. This is the core optimization that reduces initial bundle from ~34kb to ~4.6kb.

### Changes Required:

#### 1. Update `pitch-deck.tsx` imports

**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Replace the import block (lines 4-11):

```typescript
// Before
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import type { MotionValue } from "framer-motion";

// After
import {
  LazyMotion,
  m,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import { loadMotionFeatures } from "../_lib/motion-features";
```

#### 2. Wrap main component with LazyMotion

Update the `PitchDeck` component return (around line 106):

```typescript
export function PitchDeck() {
  // ... existing hooks and state ...

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <main aria-label="Pitch Deck Presentation">
        {/* Desktop: Scroll-driven stacking experience */}
        <div
          ref={containerRef}
          className="hidden lg:block relative"
          style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
        >
          {/* ... rest of desktop content ... */}
        </div>

        {/* Mobile: Simple vertical scroll */}
        <div className="lg:hidden space-y-6 px-4 pt-20 pb-24">
          {/* ... mobile content ... */}
        </div>

        {/* Grid View Overlay */}
        <AnimatePresence>
          {/* ... */}
        </AnimatePresence>
      </main>
    </LazyMotion>
  );
}
```

#### 3. Replace all `motion.` with `m.`

Find and replace throughout the file:

| Line | Before | After |
|------|--------|-------|
| 201 | `<motion.div` | `<m.div` |
| 215 | `</motion.div>` | `</m.div>` |
| 235 | `<motion.div` | `<m.div` |
| 273 | `</motion.div>` | `</m.div>` |
| 289 | `<motion.div` | `<m.div` |
| 306 | `</motion.div>` | `</m.div>` |
| 337 | `<motion.button` | `<m.button` |
| 343 | (closing tag) | `</m.button>` |
| 367 | `<motion.div` | `<m.div` |
| 382 | `<motion.div` | `<m.div` |
| 399 | `</motion.div>` | `</m.div>` |
| 400 | `</motion.div>` | `</m.div>` |
| 420 | `<motion.div` | `<m.div` |
| 454 | `</motion.div>` | `</m.div>` |
| 532 | `<motion.article` | `<m.article` |
| 549 | `</motion.article>` | `</m.article>` |

**Total replacements**: 16 instances of `motion.` → `m.`

#### 4. Full updated file structure

The key sections of the updated `pitch-deck.tsx`:

```typescript
"use client";

import { useRef, useEffect, useState } from "react";
import {
  LazyMotion,
  m,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { usePitchDeck } from "./pitch-deck-context";
import { loadMotionFeatures } from "../_lib/motion-features";
// ... other imports ...

export function PitchDeck() {
  // ... hooks ...

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <main aria-label="Pitch Deck Presentation">
        {/* ... content with m. instead of motion. ... */}
      </main>
    </LazyMotion>
  );
}

// GridView uses m.div
function GridView({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm overflow-auto"
    >
      {/* ... */}
    </m.div>
  );
}

// GridSlideItem uses m.div
function GridSlideItem({ ... }) {
  return (
    <m.div
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ ... }}
      whileHover={{ scale: 1.02 }}
      // ...
    >
      {/* ... */}
    </m.div>
  );
}

// SlideIndicator uses m.div
function SlideIndicator({ ... }) {
  return (
    <m.div
      className="fixed right-6 top-1/2 ..."
      animate={{ opacity: isGridView ? 0 : 1, ... }}
    >
      {/* ... */}
    </m.div>
  );
}

// IndicatorLine uses m.button
function IndicatorLine({ ... }) {
  return (
    <m.button
      onClick={onClick}
      style={{ opacity, width }}
      // ...
    />
  );
}

// ScrollHint uses m.div
function ScrollHint({ ... }) {
  return (
    <m.div className="fixed bottom-16 ...">
      {/* ... */}
      <m.div className="mt-1" transition={{ duration: 1.2, repeat: Infinity, ... }}>
        {/* ... */}
      </m.div>
    </m.div>
  );
}

// NavigationControls uses m.div
function NavigationControls({ ... }) {
  return (
    <m.div
      className="fixed bottom-6 ..."
      animate={{ opacity: isGridView ? 0 : 1, ... }}
    >
      {/* ... */}
    </m.div>
  );
}

// PitchSlide uses m.article
function PitchSlide({ ... }) {
  return (
    <m.article
      style={{ y, scale, opacity, zIndex }}
      className="absolute inset-0 ..."
    >
      {/* ... */}
    </m.article>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`
- [x] No `motion.` imports remain: `grep "motion\." apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx` returns only type imports
- [x] `LazyMotion` is imported and used
- [x] `m` component is imported

#### Manual Verification:
- [x] Desktop scroll animations work correctly
- [x] Grid view overlay animates in/out
- [x] Grid items have staggered entry animation
- [x] Slide indicators animate with scroll
- [x] Scroll hint appears and animates
- [x] Navigation controls fade on grid view
- [x] Keyboard navigation still works
- [x] No console errors about missing features

**Implementation Note**: Pause for manual verification before Phase 4.

---

## Phase 4: Verify Bundle Optimization

### Overview
Confirm that Framer Motion is properly code-split and the initial bundle is reduced.

### Verification Steps:

#### 1. Check Build Output

```bash
cd apps/www
pnpm build
```

Look for output showing:
- Separate chunk for `domAnimation` features
- `motion-features` in a dynamic chunk

#### 2. Run Bundle Analyzer (if configured)

```bash
ANALYZE=true pnpm build
```

Or add temporarily to `next.config.ts`:
```typescript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

#### 3. Network Tab Verification

1. Open pitch deck page in Chrome DevTools
2. Go to Network tab, filter by JS
3. Reload page
4. Verify:
   - Initial bundle does NOT contain full framer-motion
   - `domAnimation` chunk loads after hydration
   - Chunk names indicate code-splitting worked

### Success Criteria:

#### Automated Verification:
- [x] Build output shows framer-motion in separate chunk
- [x] `motion-features` creates its own chunk

#### Manual Verification:
- [x] Network tab shows async chunk loading
- [x] Initial page load is faster (or same)
- [x] No animation regressions

---

## Testing Strategy

### Unit Tests:
- Existing tests should continue to pass
- No new unit tests required (this is a refactor)

### Integration Tests:
- Verify pitch deck page loads correctly
- All animations function as before

### Manual Testing Checklist:

**Desktop (≥1024px):**
1. [ ] Page loads without errors
2. [ ] First slide visible immediately
3. [ ] Scroll triggers slide transitions
4. [ ] Slides stack with scale/opacity effects
5. [ ] Scroll to end triggers grid view
6. [ ] Grid items animate in with stagger
7. [ ] Clicking grid item scrolls to slide
8. [ ] Slide indicator tracks scroll position
9. [ ] Indicator lines animate width on scroll
10. [ ] Navigation arrows work
11. [ ] Keyboard navigation works (arrows, space, home/end)
12. [ ] Preface sidebar toggles smoothly (Cmd/Ctrl+B)

**Mobile (<1024px):**
1. [ ] Page loads without errors
2. [ ] Vertical scroll view displays
3. [ ] All slides visible in scroll
4. [ ] Bottom bar visible
5. [ ] No animation glitches
6. [ ] Preface toggle works (if visible on mobile)

**Performance:**
1. [ ] Lighthouse score maintained or improved
2. [ ] No layout shift on load
3. [ ] Animations run at 60fps

## Performance Considerations

### Expected Improvements:
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial JS (framer-motion) | ~34kb | ~4.6kb | -86% |
| Async load | 0kb | ~15-18kb | Deferred |
| Layout animations | ~5kb | 0kb | -100% (CSS) |
| Time to Interactive | Baseline | Faster | Initial JS reduced |

### Why This Works:
1. **LazyMotion `strict` mode** - Enforces use of `m` component, catches mistakes
2. **Async feature loading** - `domAnimation` loads after initial render
3. **Tree-shaking** - Hooks like `useScroll`, `useTransform` are small (~1kb each)
4. **CSS transitions** - GPU-accelerated, zero JS for layout sidebar

## Migration Notes

- No data migration required
- No API changes
- No user-facing behavior changes
- Backwards compatible

## Future Enhancements (Optional)

1. **Sync feature loading** - If async causes visible delay, can switch to sync:
   ```typescript
   import { domAnimation } from "framer-motion";
   <LazyMotion features={domAnimation}>
   ```

2. **`useReducedMotion`** - Respect user's motion preferences:
   ```typescript
   const shouldReduceMotion = useReducedMotion();
   // Simplify animations when true
   ```

3. **CSS Scroll Timeline API** - Future native CSS alternative (Chrome 115+)

## References

- Research document: `thoughts/shared/research/2026-01-28-web-analysis-framer-motion-bundle-optimization.md`
- Motion LazyMotion docs: https://motion.dev/docs/react-lazy-motion
- Motion reduce bundle size: https://motion.dev/docs/react-reduce-bundle-size
- Next.js code splitting: https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading
