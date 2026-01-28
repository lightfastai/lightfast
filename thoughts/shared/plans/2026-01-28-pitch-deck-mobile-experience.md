# Pitch Deck Mobile Experience Implementation Plan

## Overview

Implement a mobile-optimized pitch deck experience that addresses the core problem: 16:9 slides render too small on mobile portrait screens (~210px height on a 375px phone). The solution provides a vertical scroll layout with tap-to-expand functionality, prominent PDF download, and a fullscreen landscape option.

## Current State Analysis

### Key Files
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx` - Main scroll-based presentation
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx` - Context with `isMobile` state
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx` - Icon-only download button
- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx` - Layout with header
- `packages/ui/src/hooks/use-mobile.tsx` - Mobile detection at 1024px breakpoint

### Current Mobile Behavior
- Slides maintain 16:9 aspect ratio at all sizes (`pitch-deck.tsx:118`)
- On 375px mobile: slides render at ~210px height (very small)
- Scroll-based navigation uses `window.innerHeight` for slide transitions
- Download button is a small icon in the header
- `isMobile` already available via `usePitchDeck()` context

### Key Discoveries
- `useIsMobile()` returns `!!isMobile` which is `false` during SSR/initial render (`use-mobile.tsx:20`)
- The pitch deck has 10 slides defined in `PITCH_SLIDES` array
- Existing Sheet component from `@repo/ui/components/ui/sheet` can be used for tap-to-expand
- Drawer component exists at `packages/ui/src/components/ui/drawer.tsx` (Vaul-based) - better for mobile bottom sheets

## Desired End State

On mobile devices (< 1024px):
1. Slides display in a vertical scrollable list (not scroll-animated)
2. Each slide maintains 16:9 aspect ratio but stacks vertically with spacing
3. Tapping a slide opens a bottom sheet showing the slide at larger scale
4. A sticky bottom bar shows "Download PDF" and "View Full Screen" buttons
5. "View Full Screen" opens a modal prompting user to rotate to landscape
6. PDF download button shows text label (not just icon)

### Verification
- On mobile viewport (< 1024px), vertical scroll layout appears
- Tapping any slide opens bottom sheet with larger slide view
- Bottom bar is visible and functional
- "View Full Screen" shows landscape prompt modal
- Desktop experience (>= 1024px) remains unchanged

## What We're NOT Doing

- Portrait-optimized slide content layouts (Phase 3 from research)
- Swipe-based carousel navigation
- Analytics tracking for mobile vs desktop
- Pre-generated static PDF hosting
- Automatic orientation lock

## Implementation Approach

Conditionally render a completely different mobile experience based on `isMobile` from context. The mobile version will be simpler: no scroll animations, no grid view trigger, just a clean vertical list with interactive features.

---

## Phase 1: Mobile Vertical Scroll Layout

### Overview
Replace the scroll-based animation system with a simple vertical stack when on mobile.

### Changes Required

#### 1. Create Mobile Pitch Deck Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-mobile.tsx`
**Changes**: New component for mobile vertical scroll layout

```tsx
"use client";

import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";
import { MobileSlideSheet } from "./mobile-slide-sheet";
import { MobileBottomBar } from "./mobile-bottom-bar";

export function PitchDeckMobile() {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);

  return (
    <main aria-label="Pitch Deck Presentation" className="pb-20">
      {/* Vertical scroll container */}
      <div className="space-y-6 px-4 pt-20">
        {PITCH_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setSelectedSlideIndex(index)}
            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            aria-label={`View slide ${index + 1}: ${slide.title}`}
          >
            <div
              className={cn(
                "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg",
                slide.bgColor
              )}
              style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
            >
              <div className="relative h-full p-4 flex flex-col justify-between">
                <MobileSlideContent slide={slide} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tap-to-expand sheet */}
      <MobileSlideSheet
        slideIndex={selectedSlideIndex}
        onClose={() => setSelectedSlideIndex(null)}
      />

      {/* Sticky bottom bar */}
      <MobileBottomBar />
    </main>
  );
}

function MobileSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  if (slide.type === "title" && slide.id === "title") {
    return <CustomTitleSlide slide={slide} variant="responsive" />;
  }

  if (slide.type === "title" && slide.id === "vision") {
    return <CustomClosingSlide slide={slide} variant="responsive" />;
  }

  switch (slide.type) {
    case "content":
      return <ContentSlideContent slide={slide} variant="responsive" />;
    case "showcase":
      return <ShowcaseSlideContent slide={slide} variant="responsive" />;
    case "columns":
      return <ColumnsSlideContent slide={slide} variant="responsive" />;
    default:
      return null;
  }
}
```

#### 2. Update Main Pitch Deck to Conditionally Render
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
**Changes**: Import mobile component and conditionally render based on `isMobile`

At the top of the `PitchDeck` function, add:

```tsx
import { usePitchDeck } from "./pitch-deck-context";
import { PitchDeckMobile } from "./pitch-deck-mobile";

export function PitchDeck() {
  const { isMobile } = usePitchDeck();

  // Render mobile-optimized layout on mobile devices
  if (isMobile) {
    return <PitchDeckMobile />;
  }

  // ... existing desktop implementation
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (for new files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification
- [ ] On mobile viewport (< 1024px), slides display vertically
- [ ] Each slide maintains 16:9 aspect ratio
- [ ] Slides have appropriate spacing between them
- [ ] Scrolling is smooth native scroll (no animations)
- [ ] Desktop viewport (>= 1024px) shows original scroll-animated experience

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Tap-to-Expand Bottom Sheet

### Overview
Create a bottom sheet that opens when tapping a slide, showing it at larger scale with the ability to navigate between slides.

### Changes Required

#### 1. Create Mobile Slide Sheet Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/mobile-slide-sheet.tsx`
**Changes**: New component using Vaul drawer for bottom sheet

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@repo/ui/components/ui/drawer";
import { Button } from "@repo/ui/components/ui/button";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";

interface MobileSlideSheetProps {
  slideIndex: number | null;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export function MobileSlideSheet({
  slideIndex,
  onClose,
  onNavigate,
}: MobileSlideSheetProps) {
  const isOpen = slideIndex !== null;
  const slide = slideIndex !== null ? PITCH_SLIDES[slideIndex] : null;

  const handlePrev = useCallback(() => {
    if (slideIndex !== null && slideIndex > 0) {
      onNavigate?.(slideIndex - 1);
    }
  }, [slideIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (slideIndex !== null && slideIndex < PITCH_SLIDES.length - 1) {
      onNavigate?.(slideIndex + 1);
    }
  }, [slideIndex, onNavigate]);

  // Keyboard navigation within sheet
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] outline-none">
        <DrawerTitle className="sr-only">
          {slide ? `Slide ${slideIndex! + 1}: ${slide.title}` : "Slide viewer"}
        </DrawerTitle>

        {/* Header with close and navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            {slideIndex !== null ? slideIndex + 1 : 0} / {PITCH_SLIDES.length}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={slideIndex === 0}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={slideIndex === PITCH_SLIDES.length - 1}
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Slide content - scrollable with pinch-to-zoom via touch-action */}
        <div className="flex-1 overflow-auto p-4 touch-pan-x touch-pan-y touch-pinch-zoom">
          {slide && (
            <div
              className={cn(
                "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg",
                slide.bgColor
              )}
              style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
            >
              <div className="relative h-full p-6 flex flex-col justify-between">
                <SheetSlideContent slide={slide} />
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SheetSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  if (slide.type === "title" && slide.id === "title") {
    return <CustomTitleSlide slide={slide} variant="responsive" />;
  }

  if (slide.type === "title" && slide.id === "vision") {
    return <CustomClosingSlide slide={slide} variant="responsive" />;
  }

  switch (slide.type) {
    case "content":
      return <ContentSlideContent slide={slide} variant="responsive" />;
    case "showcase":
      return <ShowcaseSlideContent slide={slide} variant="responsive" />;
    case "columns":
      return <ColumnsSlideContent slide={slide} variant="responsive" />;
    default:
      return null;
  }
}
```

#### 2. Update Mobile Pitch Deck to Support Navigation
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-mobile.tsx`
**Changes**: Add `onNavigate` callback to allow sheet to change slides

Update the `MobileSlideSheet` usage:

```tsx
<MobileSlideSheet
  slideIndex={selectedSlideIndex}
  onClose={() => setSelectedSlideIndex(null)}
  onNavigate={setSelectedSlideIndex}
/>
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (for new files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification
- [ ] Tapping a slide opens the bottom sheet
- [ ] Sheet shows the slide at larger scale (fills most of viewport width)
- [ ] Left/right navigation buttons work correctly
- [ ] Keyboard arrows navigate between slides when sheet is open
- [ ] Escape or close button dismisses the sheet
- [ ] Slide counter shows correct position (e.g., "3 / 10")
- [ ] Cannot navigate past first or last slide (buttons disabled)
- [ ] Pinch-to-zoom works on the slide content

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Mobile Bottom Bar with Download & Fullscreen

### Overview
Create a sticky bottom bar with prominent PDF download and "View Full Screen" buttons.

### Changes Required

#### 1. Create Mobile Bottom Bar Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/mobile-bottom-bar.tsx`
**Changes**: New component for sticky bottom actions

```tsx
"use client";

import { useState } from "react";
import { Download, Loader2, Maximize } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { exportSlidesToPdf } from "../_lib/export-slides";
import { LandscapePromptModal } from "./landscape-prompt-modal";

export function MobileBottomBar() {
  const [isExporting, setIsExporting] = useState(false);
  const [showLandscapePrompt, setShowLandscapePrompt] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportSlidesToPdf();
    } catch (error) {
      console.error("Failed to export slides:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t safe-area-bottom">
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 max-w-[160px]"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowLandscapePrompt(true)}
            className="flex-1 max-w-[160px]"
          >
            <Maximize className="h-4 w-4 mr-2" />
            Full Screen
          </Button>
        </div>
      </div>

      <LandscapePromptModal
        open={showLandscapePrompt}
        onOpenChange={setShowLandscapePrompt}
      />
    </>
  );
}
```

#### 2. Create Landscape Prompt Modal Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/landscape-prompt-modal.tsx`
**Changes**: New modal prompting user to rotate device

```tsx
"use client";

import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";

interface LandscapePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandscapePromptModal({
  open,
  onOpenChange,
}: LandscapePromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <RotateCcw className="h-6 w-6 text-muted-foreground animate-pulse" />
          </div>
          <DialogTitle>Rotate for Full Screen</DialogTitle>
          <DialogDescription className="text-center">
            Turn your device to landscape orientation for the best viewing experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Continue in Portrait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. Add Safe Area Padding Utility
**File**: `apps/www/src/app/globals.css` (or equivalent)
**Changes**: Add utility class for safe area inset (for iPhone notch/home indicator)

```css
/* Add to your global CSS */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

Note: Check if this utility already exists in the codebase. If using Tailwind, you may need to add it to the config or use inline styles.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (for new files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification
- [ ] Bottom bar is visible and fixed at the bottom on mobile
- [ ] "Download PDF" button triggers PDF export and download
- [ ] Loading spinner shows during PDF generation
- [ ] "Full Screen" button opens the landscape prompt modal
- [ ] Modal can be dismissed by tapping "Continue in Portrait"
- [ ] Bottom bar respects safe area insets (no overlap with iPhone home indicator)
- [ ] Vertical scroll content has enough bottom padding to not be hidden by bottom bar

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Polish & Integration

### Overview
Final integration, cleanup, and edge case handling.

### Changes Required

#### 1. Hide Desktop-Only Elements on Mobile
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
**Changes**: Ensure navigation controls, scroll hint, and slide indicator don't render on mobile

Already handled by the conditional render at the top of the component - the desktop `PitchDeck` component only renders when `!isMobile`.

#### 2. Ensure Header Download Button Works on Both
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx`
**Changes**: No changes needed - keep the icon-only button in header for desktop, mobile bottom bar provides the prominent version

#### 3. Update Mobile Pitch Deck Scroll Offset
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-mobile.tsx`
**Changes**: Ensure proper spacing for header and bottom bar

Update the container padding:

```tsx
<div className="space-y-6 px-4 pt-20 pb-24">
```

The `pt-20` accounts for the fixed header, and `pb-24` ensures the last slide isn't hidden behind the bottom bar.

#### 4. Handle SSR/Hydration Mismatch
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
**Changes**: Prevent hydration mismatch by not rendering mobile-specific content during SSR

The `useIsMobile()` hook returns `false` during SSR (since `!!undefined` is `false`). This means the desktop version always renders first, then switches to mobile on hydration. This could cause a flash.

Option A: Accept the brief flash (simpler)
Option B: Use a loading skeleton until hydration completes

For now, use Option A. If the flash is noticeable, we can address it later.

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (for new files)
- [x] Build succeeds: `pnpm build:www`
- [x] No console errors on page load (verified via browser testing)

#### Manual Verification
- [ ] Desktop experience unchanged (scroll animations, grid view, etc.)
- [ ] Mobile experience shows vertical scroll layout
- [ ] Resizing browser window from desktop to mobile switches layouts
- [ ] No visible hydration flash or it's minimal
- [ ] All interactive elements have proper focus states
- [ ] Screen reader announces slide information correctly

---

## Testing Strategy

### Manual Testing Steps

1. **Mobile Vertical Scroll**
   - Open pitch deck on mobile viewport (375px)
   - Verify slides stack vertically
   - Scroll through all 10 slides
   - Verify 16:9 aspect ratio maintained

2. **Tap-to-Expand**
   - Tap on slide 3
   - Verify sheet opens with slide 3
   - Navigate to slide 4 using right arrow
   - Navigate back to slide 3 using left arrow
   - Verify disabled state at slide 1 (no left) and slide 10 (no right)
   - Close sheet using X or swipe down

3. **Bottom Bar Actions**
   - Tap "Download PDF"
   - Verify loading spinner appears
   - Verify PDF downloads
   - Tap "Full Screen"
   - Verify landscape prompt modal appears
   - Dismiss modal

4. **Desktop Unchanged**
   - Open pitch deck on desktop viewport (1440px)
   - Verify scroll-based animations work
   - Verify grid view triggers at 92% scroll
   - Verify keyboard navigation (arrows, space, etc.)

5. **Responsive Breakpoint**
   - Open browser DevTools
   - Resize from 1200px to 900px
   - Verify layout switches at 1024px breakpoint

## Performance Considerations

- Mobile vertical scroll uses native scrolling (no JS scroll listeners)
- Sheet uses Vaul drawer with CSS transforms (hardware accelerated)
- PDF export runs in background with loading state
- No additional bundle size for mobile (uses existing components)

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-mobile-solutions.md`
- Mobile breakpoint: `packages/ui/src/hooks/use-mobile.tsx:3`
- PDF export: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`
- Drawer component: `packages/ui/src/components/ui/drawer.tsx`
