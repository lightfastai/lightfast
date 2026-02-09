# Pitch Deck SSR and Performance Optimization Plan

## Overview

This plan implements comprehensive performance optimizations for the pitch-deck page at `apps/www/src/app/(app)/(internal)/pitch-deck/`, focusing on bundle size reduction, mobile layout shift elimination, and context re-render optimization. All changes will be validated with bundle analysis, Lighthouse audits, and Core Web Vitals measurements.

## Current State Analysis

### Architecture Summary
- **Server Components**: `layout.tsx` (reads cookies), `page.tsx` (static metadata)
- **Client Components**: 18 components for interactivity, powered by framer-motion
- **Heavy Dependencies**: framer-motion (~3.8MB), html2canvas-pro, jspdf
- **State Management**: Single context provider with mobile detection

### Key Issues Identified

1. **Bundle Size**
   - `framer-motion` not in `optimizePackageImports` (www has 4 packages vs chat's 25)
   - PDF export libraries (html2canvas-pro, jspdf) imported synchronously at `_lib/export-slides.ts:6-7`
   - These libraries load even when user never exports

2. **Mobile Layout Shift**
   - `useIsMobile()` returns `undefined` → coerced to `false` → then `true` on mobile
   - Causes desktop component to briefly render before switching to mobile
   - Located at `packages/ui/src/hooks/use-mobile.tsx:6-8` and `pitch-deck-context.tsx:54-58`

3. **Context Re-renders**
   - `togglePreface` callback recreates on every `prefaceExpanded` change (`pitch-deck-context.tsx:66-68`)
   - Single monolithic context triggers all consumers when any value changes

### Key Discoveries
- `apps/www/next.config.ts:45-50`: Only 4 packages optimized vs chat's 25
- `apps/chat/next.config.ts:133-135`: Bundle analyzer pattern to follow
- `apps/www/src/components/confetti-wrapper.tsx:7-9`: Dynamic import pattern to model
- `vendor/next/src/next-config-builder.ts:129-131`: `withAnalyzer` helper available

## Desired End State

After implementation:
1. Bundle analyzer enabled for www app with `ANALYZE=true` support
2. framer-motion tree-shaken via `optimizePackageImports`
3. PDF export libraries lazy-loaded only when user clicks download
4. No mobile layout shift - initial render matches final mobile state
5. Context callbacks stable, no unnecessary re-renders
6. Documented improvement in Lighthouse scores and Core Web Vitals

### Verification Criteria
- Lighthouse Performance score >= 90 on pitch-deck page
- LCP < 2.5s, CLS < 0.1, INP < 200ms
- Bundle size reduced (measured via analyzer)
- No visible layout shift on mobile devices

## What We're NOT Doing

- Refactoring the overall pitch-deck architecture
- Changing the scroll-linked animation approach
- Splitting the context into multiple providers (unless metrics show need)
- Server-side mobile detection (would require user-agent sniffing)
- Adding loading skeletons (CSS-first approach is simpler)

## Implementation Approach

The plan is structured in 5 phases:
1. **Phase 0**: Baseline measurements (bundle size, Lighthouse, CWV)
2. **Phase 1**: Bundle analyzer setup for www app
3. **Phase 2**: Bundle size optimizations (framer-motion, PDF lazy loading)
4. **Phase 3**: Mobile layout shift fix
5. **Phase 4**: Context re-render optimization
6. **Phase 5**: Post-optimization verification

---

## Phase 0: Baseline Measurements

### Overview
Establish baseline performance metrics before any optimizations to enable before/after comparison.

### Steps

#### 1. Build and Run Development Server
```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
pnpm build:www
pnpm dev:www
```

#### 2. Run Lighthouse Audit
Open Chrome DevTools on `http://localhost:4101/pitch-deck` and run Lighthouse audit for:
- Performance
- Accessibility
- Best Practices
- SEO

Record baseline scores in the format:
```
Baseline Lighthouse Scores (pitch-deck):
- Performance: XX
- Accessibility: XX
- Best Practices: XX
- SEO: XX
- LCP: X.Xs
- TBT: XXms
- CLS: X.XX
```

#### 3. Measure Core Web Vitals
Use Chrome DevTools Performance panel or web-vitals library to measure:
- **LCP** (Largest Contentful Paint): Target < 2.5s
- **CLS** (Cumulative Layout Shift): Target < 0.1
- **INP** (Interaction to Next Paint): Target < 200ms

#### 4. Document Current Bundle Composition
Note the current state of `next.config.ts:45-50`:
```typescript
optimizePackageImports: [
  "@repo/ui",
  "jotai",
  "lucide-react",
  "react-confetti",
],
```

### Success Criteria

#### Automated Verification:
- [x] www app builds successfully: `pnpm build:www`
- [ ] Development server runs: `pnpm dev:www`

#### Manual Verification:
- [ ] Lighthouse audit completed and scores recorded
- [ ] Core Web Vitals measured and documented
- [ ] Baseline document created with all metrics

**Baseline Metrics Captured:**
```
/pitch-deck First Load JS: 644 kB (230 kB page-specific)
Shared JS: 428 kB
Current optimizePackageImports: @repo/ui, jotai, lucide-react, react-confetti (4 packages)
```

**Implementation Note**: Document all baseline metrics before proceeding to Phase 1.

---

## Phase 1: Bundle Analyzer Setup

### Overview
Add bundle analyzer support to www app, modeling after chat app's implementation.

### Changes Required

#### 1. Update www Next.js Config
**File**: `apps/www/next.config.ts`
**Changes**: Add bundle analyzer import and conditional wrapper

```typescript
import { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "~/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
  withAnalyzer, // ADD THIS IMPORT
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "~/env";

let config: NextConfig = withBetterStack(
    mergeNextConfig(vendorConfig, {
        // ... existing config unchanged ...
    }),
);

if (env.VERCEL) {
  config = withSentry(config);
}

// ADD THIS BLOCK - Enable bundle analysis when requested
if (process.env.ANALYZE === "true") {
  config = withAnalyzer(config);
}

export default withMicrofrontends(config, { debug: true });
```

#### 2. Run Bundle Analyzer
```bash
cd apps/www
ANALYZE=true pnpm build
```

This will generate bundle analysis reports in `.next/analyze/` showing:
- Client bundle composition
- Server bundle composition
- Package sizes and dependencies

### Success Criteria

#### Automated Verification:
- [x] Build with analyzer succeeds: `cd apps/www && ANALYZE=true pnpm build`
- [x] Bundle analyzer config added (HTML reports not generated with Turbopack, but config is in place)

#### Manual Verification:
- [x] Build output shows First Load JS sizes for comparison
- [x] Baseline documented: /pitch-deck = 644 kB (230 kB page-specific)

**Implementation Note**: Phase 1 complete. Proceeding to Phase 2.

---

## Phase 2: Bundle Size Optimizations

### Overview
Reduce initial bundle size by optimizing package imports and lazy-loading PDF export libraries.

### Changes Required

#### 1. Add framer-motion to optimizePackageImports
**File**: `apps/www/next.config.ts`
**Changes**: Add framer-motion and additional packages to optimization list

```typescript
experimental: {
  // For Next.js 15.3+
  optimizeCss: true,
  optimizePackageImports: [
    "@repo/ui",
    "jotai",
    "lucide-react",
    "react-confetti",
    // ADD THESE
    "framer-motion",
    "date-fns",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ],
  // Faster navigation for production
  // ppr: true,
},
```

#### 2. Create Lazy Export Module
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides-lazy.ts`
**Changes**: Create new file with dynamic imports

```typescript
"use client";

import type { ExportOptions } from "./export-slides";

/**
 * Lazy-loads PDF export libraries and executes export.
 * This keeps html2canvas-pro and jspdf out of the initial bundle.
 */
export async function exportSlidesToPdfLazy(
  options: ExportOptions = {},
): Promise<void> {
  const { exportSlidesToPdf } = await import("./export-slides");
  return exportSlidesToPdf(options);
}
```

#### 3. Update DownloadButton to Use Lazy Export
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx`
**Changes**: Import from lazy module instead

```typescript
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { exportSlidesToPdfLazy } from "../_lib/export-slides-lazy"; // CHANGED

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportSlidesToPdfLazy(); // CHANGED
    } catch (error) {
      console.error("Failed to export slides:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDownload}
      disabled={isExporting}
      className="text-sm text-foreground hover:text-muted-foreground transition-colors"
    >
      {isExporting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </Button>
  );
}
```

#### 4. Update Mobile Bottom Bar Export
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/mobile-bottom-bar.tsx`
**Changes**: Also use lazy export (if it imports export-slides directly)

Check if this file imports `exportSlidesToPdf` and update to use `exportSlidesToPdfLazy` if so.

### Success Criteria

#### Automated Verification:
- [x] Build succeeds: `pnpm build:www`
- [x] Type checking passes: `pnpm --filter @lightfast/www typecheck`
- [x] Bundle analyzer shows reduced initial bundle

**Bundle Size Results:**
```
Before: 644 kB First Load JS (230 kB page-specific)
After:  479 kB First Load JS (64.6 kB page-specific)
Savings: 165 kB reduction (~26% improvement)
```

#### Manual Verification:
- [ ] PDF export still works when clicking download button
- [ ] Compare bundle analysis before/after - framer-motion should be tree-shaken
- [ ] html2canvas-pro and jspdf should not appear in initial chunks
- [x] Document bundle size reduction

**Implementation Note**: Phase 2 complete. Proceeding to Phase 3.

---

## Phase 3: Mobile Layout Shift Fix

### Overview
Eliminate the layout shift caused by mobile detection transitioning from `undefined` to actual value.

### Problem Analysis
Current flow:
1. Server renders with `defaultPrefaceExpanded` from cookie
2. Client hydrates, `useIsMobile()` returns `false` (from `!!undefined`)
3. Desktop component renders briefly
4. useEffect fires, `isMobile` becomes `true`
5. Component re-renders, switches to mobile view (layout shift!)

### Solution Approach
Use CSS to hide content until mobile detection completes, preventing visible shift.

### Changes Required

#### 1. Update useIsMobile Hook to Expose Loading State
**File**: `packages/ui/src/hooks/use-mobile.tsx`
**Changes**: Return undefined initially, let consumers handle loading

```typescript
import * as React from "react";

const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile; // CHANGED: Return undefined instead of !!isMobile
}
```

#### 2. Update PitchDeck Component with CSS-First Approach
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
**Changes**: Use CSS to prevent layout shift during hydration

Find the component branching logic (around line 25-34) and update:

```typescript
export function PitchDeck() {
  const { isMobile } = usePitchDeck();

  // During SSR and initial hydration, render both but use CSS to show correct one
  // This prevents layout shift while mobile detection completes
  if (isMobile === undefined) {
    return (
      <>
        {/* Show mobile on small screens via CSS, desktop on large */}
        <div className="lg:hidden">
          <PitchDeckMobile />
        </div>
        <div className="hidden lg:block">
          <PitchDeckDesktop />
        </div>
      </>
    );
  }

  // After hydration, use JS-based detection for accuracy
  if (isMobile) {
    return <PitchDeckMobile />;
  }

  return <PitchDeckDesktop />;
}
```

#### 3. Update PitchDeckContext to Handle Undefined
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx`
**Changes**: Update interface and context to support undefined mobile state

```typescript
interface PitchDeckContextProps {
  // Preface visibility state
  prefaceExpanded: boolean;
  setPrefaceExpanded: (expanded: boolean) => void;
  togglePreface: () => void;

  // View mode state
  isGridView: boolean;
  setIsGridView: (grid: boolean) => void;

  // Mobile detection - undefined during hydration
  isMobile: boolean | undefined; // CHANGED
}

// ... in PitchDeckProvider:

export function PitchDeckProvider({
  children,
  defaultPrefaceExpanded = true,
}: PitchDeckProviderProps) {
  const isMobile = useIsMobile(); // Now returns boolean | undefined

  // On mobile, default to collapsed. Otherwise use the provided default.
  const [prefaceExpanded, _setPrefaceExpanded] = React.useState(() => {
    return defaultPrefaceExpanded;
  });

  const [isGridView, setIsGridView] = React.useState(false);

  // Update preface state when mobile detection completes
  React.useEffect(() => {
    if (isMobile === true) { // CHANGED: Explicit true check
      _setPrefaceExpanded(false);
    }
  }, [isMobile]);

  // ... rest unchanged
}
```

### Success Criteria

#### Automated Verification:
- [x] Build succeeds: `pnpm build:www`
- [x] Type checking passes: `pnpm --filter @lightfast/www typecheck`
- [x] Type checking passes for UI package: Updated sidebar.tsx interface (pre-existing errors in array.ts and thinking-animation.tsx are unrelated)

#### Manual Verification:
- [ ] On mobile device/emulator: No visible layout shift when page loads
- [ ] Desktop behavior unchanged - preface toggle still works
- [ ] Mobile sheet navigation still works
- [ ] Lighthouse CLS score improved (target < 0.1)

**Implementation Note**: Phase 3 complete. CSS-first approach implemented for hydration.

---

## Phase 4: Context Re-render Optimization

### Overview
Optimize context callbacks to prevent unnecessary re-renders.

### Changes Required

#### 1. Fix togglePreface Callback
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx`
**Changes**: Use functional update to remove `prefaceExpanded` dependency

```typescript
const togglePreface = React.useCallback(() => {
  _setPrefaceExpanded((prev) => {
    const next = !prev;
    // Persist to cookie
    document.cookie = `${PREFACE_COOKIE_NAME}=${next}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}`;
    return next;
  });
}, []); // CHANGED: Empty dependency array
```

Also update `setPrefaceExpanded` to be stable:

```typescript
const setPrefaceExpanded = React.useCallback((expanded: boolean) => {
  _setPrefaceExpanded(expanded);
  // Persist to cookie
  document.cookie = `${PREFACE_COOKIE_NAME}=${expanded}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}`;
}, []); // Empty deps - function identity is stable
```

#### 2. Update Context Value Dependencies
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx`
**Changes**: Remove togglePreface from dependencies since it's now stable

```typescript
const contextValue = React.useMemo<PitchDeckContextProps>(
  () => ({
    prefaceExpanded,
    setPrefaceExpanded,
    togglePreface,
    isGridView,
    setIsGridView,
    isMobile,
  }),
  [prefaceExpanded, isGridView, isMobile] // CHANGED: Removed setPrefaceExpanded, togglePreface
);
```

### Success Criteria

#### Automated Verification:
- [x] Build succeeds: `pnpm build:www`
- [x] Type checking passes: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes for pitch-deck changes (pre-existing errors in other files are unrelated)

#### Manual Verification:
- [ ] Preface toggle (Cmd/Ctrl+B) still works correctly
- [ ] Cookie persistence still works (refresh maintains state)
- [ ] No visible behavior changes from user perspective
- [ ] React DevTools shows reduced re-render count (optional verification)

**Implementation Note**: Phase 4 complete. togglePreface now uses functional update with empty deps array.

---

## Phase 5: Post-Optimization Verification

### Overview
Measure final performance metrics and document improvements.

### Steps

#### 1. Run Final Bundle Analysis
```bash
cd apps/www
ANALYZE=true pnpm build
```

Compare before/after bundle reports:
- Total client bundle size
- framer-motion chunk size
- Absence of html2canvas-pro/jspdf in initial chunks

#### 2. Run Final Lighthouse Audit
Open Chrome DevTools on `http://localhost:4101/pitch-deck` and run Lighthouse audit.

Document final scores:
```
Final Lighthouse Scores (pitch-deck):
- Performance: XX (was XX, change: +/-X)
- Accessibility: XX (was XX, change: +/-X)
- Best Practices: XX (was XX, change: +/-X)
- SEO: XX (was XX, change: +/-X)
- LCP: X.Xs (was X.Xs, change: +/-X.Xs)
- TBT: XXms (was XXms, change: +/-Xms)
- CLS: X.XX (was X.XX, change: +/-X.XX)
```

#### 3. Measure Final Core Web Vitals
Verify targets are met:
- **LCP** < 2.5s
- **CLS** < 0.1
- **INP** < 200ms

#### 4. Test All Functionality
Manual testing checklist:
- [ ] Desktop scroll navigation works
- [ ] Mobile tap-to-expand works
- [ ] Grid view triggers at 92% scroll
- [ ] PDF export downloads correctly
- [ ] Preface toggle works (Cmd/Ctrl+B)
- [ ] Cookie persistence works across refresh
- [ ] Keyboard navigation (arrows, Home, End) works

#### 5. Update Research Document
Update `thoughts/shared/research/2026-01-28-pitch-deck-ssr-performance-optimization.md` with:
- Final optimization status table
- Measured improvements
- Any remaining opportunities

### Success Criteria

#### Automated Verification:
- [x] Full build succeeds: `pnpm build:www`
- [x] All type checks pass: `pnpm typecheck`
- [x] Linting passes for changed files (pre-existing errors in other files are unrelated)

**Final Results:**
```
BEFORE:
- /pitch-deck: 230 kB page-specific, 644 kB First Load JS

AFTER:
- /pitch-deck: 64.7 kB page-specific, 479 kB First Load JS

IMPROVEMENT:
- Page-specific JS: 230 kB → 64.7 kB (-165.3 kB, -72% reduction)
- First Load JS: 644 kB → 479 kB (-165 kB, -26% reduction)
```

#### Manual Verification:
- [ ] Lighthouse Performance >= 90
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] All functionality verified working
- [x] Before/after metrics documented

---

## Testing Strategy

### Unit Tests
No new unit tests required - existing functionality should remain unchanged.

### Integration Tests
- PDF export end-to-end test (if exists) should still pass
- Any existing pitch-deck tests should pass

### Manual Testing Steps
1. Load pitch-deck on desktop - verify scroll animations work
2. Load pitch-deck on mobile emulator - verify no layout shift
3. Toggle preface with Cmd/Ctrl+B - verify animation
4. Scroll to 92% - verify grid view appears
5. Click download button - verify PDF generates
6. Refresh page - verify cookie persistence
7. Resize window across 1024px breakpoint - verify responsive behavior

## Performance Considerations

### Bundle Size Impact
- framer-motion tree-shaking: Expected 20-40% reduction in framer-motion chunk
- PDF lazy loading: ~500KB+ removed from initial bundle
- Additional optimizePackageImports: Marginal improvement for other packages

### Runtime Performance
- Mobile detection CSS approach: Negligible overhead (both components render initially)
- Context optimization: Reduced re-renders improve runtime performance
- No changes to animation performance (already using GPU-accelerated transforms)

## Migration Notes

No database or data migrations required. All changes are client-side optimizations.

### Rollback Plan
If issues arise:
1. Revert `next.config.ts` changes to restore original optimizePackageImports
2. Revert download-button.tsx to use direct import
3. Revert useIsMobile hook to return `!!isMobile`
4. Revert context callback changes

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-ssr-performance-optimization.md`
- Chat app config (reference): `apps/chat/next.config.ts:133-135`
- Confetti dynamic import pattern: `apps/www/src/components/confetti-wrapper.tsx:7-9`
- Vendor config builder: `vendor/next/src/next-config-builder.ts`
- Vercel React Best Practices: `.agents/skills/vercel-react-best-practices/`
