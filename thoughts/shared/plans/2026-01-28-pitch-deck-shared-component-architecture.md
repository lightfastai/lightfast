# Pitch Deck Shared Component Architecture Implementation Plan

## Overview

Refactor the pitch deck slide rendering to use a single source of truth for slide content, eliminating three separate implementations (animated, static capture, raw HTML export) in favor of shared components with a `variant` prop. Migrate the export utility from raw HTML strings to ReactDOM rendering with `flushSync`.

## Current State Analysis

The pitch deck has **three separate implementations** of slide content:

1. **`pitch-deck.tsx:355-409`** - `SlideContent` with responsive Tailwind classes
2. **`capture-slide.tsx:38-92`** - `TitleSlideContent`/`ContentSlideContent` with fixed sizes (currently unused by export)
3. **`export-slides.ts:112-218`** - Raw HTML strings with inline styles

This violates DRY principles and causes maintenance burden - any visual change requires updating three places.

### Key Discoveries:
- `capture-slide.tsx` exists but is NOT connected to the export flow (`export-slides.ts:79-110`)
- Export uses raw HTML because html2canvas can miss Tailwind classes in off-screen containers
- ReactDOM approach is viable using `flushSync` to ensure synchronous rendering before capture
- Current export uses `setTimeout(100ms)` for font loading - unreliable

## Desired End State

A single source of truth for slide content rendering:

```
PITCH_SLIDES data
     │
     └──▶ slide-content/TitleSlideContent, ContentSlideContent
               │
               ├──▶ pitch-deck.tsx (variant="responsive")
               │         ↓
               │    motion.article wrapper + scroll animations
               │
               ├──▶ capture-slide.tsx (variant="fixed")
               │         ↓
               │    Static wrapper for screenshots
               │
               └──▶ export-slides.ts
                         ↓
                    ReactDOM.createRoot + flushSync
                         ↓
                    html2canvas capture
```

### Verification:
- All slides render identically in presentation, grid view, and export
- Export produces correct PNG images with proper fonts and styling
- No duplicate slide content code exists
- Type safety maintained throughout

## What We're NOT Doing

- Adding new slide types or content
- Changing the visual design of slides
- Modifying the scroll animation behavior
- Adding PDF export (separate feature)
- Keeping raw HTML as fallback

## Implementation Approach

Use a `variant` prop pattern (similar to existing codebase patterns like `isInline` in chat artifacts). This provides:
- Single source of truth for content structure
- Clear separation between responsive web and fixed export contexts
- Type-safe variant selection
- Easy to extend with additional variants if needed

## Phase 1: Create Shared Slide Content Components

### Overview
Extract slide content into shared components with variant support. Create a new `slide-content/` directory following the existing component organization pattern.

### Changes Required:

#### 1. Create slide-content directory structure
**Files**:
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/index.ts`
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/title-slide-content.tsx`
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/content-slide-content.tsx`

#### 2. Create TitleSlideContent component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/title-slide-content.tsx`

```typescript
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";

export type SlideVariant = "responsive" | "fixed";

interface TitleSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "title" }>;
  variant?: SlideVariant;
}

export function TitleSlideContent({
  slide,
  variant = "responsive"
}: TitleSlideContentProps) {
  const isFixed = variant === "fixed";

  return (
    <>
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative flex-1 flex items-center justify-center">
        <h1
          className={cn(
            "font-bold text-center text-white tracking-tight",
            isFixed
              ? "text-8xl"
              : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
          )}
        >
          {slide.title}
        </h1>
      </div>
      <p
        className={cn(
          "relative text-center text-white/70",
          isFixed ? "text-lg" : "text-xs sm:text-sm"
        )}
      >
        {slide.subtitle}
      </p>
    </>
  );
}
```

#### 3. Create ContentSlideContent component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/content-slide-content.tsx`

```typescript
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface ContentSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "content" }>;
  variant?: SlideVariant;
}

export function ContentSlideContent({
  slide,
  variant = "responsive"
}: ContentSlideContentProps) {
  const isFixed = variant === "fixed";

  return (
    <>
      <h2
        className={cn(
          "font-light text-neutral-900",
          isFixed ? "text-5xl" : "text-xl sm:text-2xl md:text-3xl"
        )}
      >
        {slide.title}
      </h2>
      <div className="flex-1 flex flex-col justify-end">
        <div
          className={cn(
            "grid",
            isFixed
              ? "grid-cols-2 gap-16"
              : "grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8"
          )}
        >
          <p
            className={cn(
              "uppercase tracking-wider text-neutral-500",
              isFixed ? "text-base" : "text-[10px] sm:text-xs"
            )}
          >
            {slide.leftText}
          </p>
          <div className={cn(isFixed ? "space-y-6" : "space-y-2 sm:space-y-4")}>
            {slide.rightText.map((text, i) => (
              <p
                key={i}
                className={cn(
                  "border-b border-neutral-300 text-neutral-700",
                  isFixed ? "text-xl pb-4" : "text-xs sm:text-sm pb-2"
                )}
              >
                {text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
```

#### 4. Create barrel export
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/index.ts`

```typescript
export { TitleSlideContent, type SlideVariant } from "./title-slide-content";
export { ContentSlideContent } from "./content-slide-content";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @apps/www typecheck`
- [x] Linting passes: `pnpm --filter @apps/www lint`
- [x] Build succeeds: `pnpm --filter @apps/www build`

#### Manual Verification:
- [x] New files exist in correct locations

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Update pitch-deck.tsx to Use Shared Components

### Overview
Replace the inline `SlideContent` function with imports from the shared components.

### Changes Required:

#### 1. Update pitch-deck.tsx
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

**Add import** (after line 13):
```typescript
import { TitleSlideContent, ContentSlideContent } from "./slide-content";
```

**Replace SlideContent function** (lines 355-409):
```typescript
function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  switch (slide.type) {
    case "title":
      return <TitleSlideContent slide={slide} variant="responsive" />;
    case "content":
      return <ContentSlideContent slide={slide} variant="responsive" />;
    default:
      return null;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @apps/www typecheck`
- [x] Linting passes: `pnpm --filter @apps/www lint`
- [x] Build succeeds: `pnpm --filter @apps/www build`

#### Manual Verification:
- [ ] Navigate to pitch deck page at `/pitch-deck`
- [ ] All 8 slides render correctly with scroll animations
- [ ] Grid view shows all slides correctly scaled
- [ ] Title slides have grid pattern overlay
- [ ] Content slides have proper layout with left/right text
- [ ] Responsive sizing works on mobile/tablet/desktop viewports

**Implementation Note**: After completing this phase and all verification passes, proceed to Phase 3.

---

## Phase 3: Update capture-slide.tsx to Use Shared Components

### Overview
Replace the duplicate `TitleSlideContent` and `ContentSlideContent` in capture-slide.tsx with imports from shared components.

### Changes Required:

#### 1. Update capture-slide.tsx
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx`

**Complete file replacement**:
```typescript
"use client";

import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { TitleSlideContent, ContentSlideContent } from "./slide-content";

interface CaptureSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  width?: number;
  height?: number;
}

/**
 * Static slide component for screenshot capture.
 * Renders at exact dimensions without animations.
 */
export const CaptureSlide = forwardRef<HTMLDivElement, CaptureSlideProps>(
  function CaptureSlide({ slide, width = 1920, height = 1080 }, ref) {
    return (
      <div
        ref={ref}
        style={{ width, height }}
        className={cn("relative overflow-hidden", slide.bgColor)}
      >
        <div className="h-full p-16 flex flex-col justify-between">
          {slide.type === "title" ? (
            <TitleSlideContent slide={slide} variant="fixed" />
          ) : (
            <ContentSlideContent slide={slide} variant="fixed" />
          )}
        </div>
      </div>
    );
  }
);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @apps/www typecheck`
- [x] Linting passes: `pnpm --filter @apps/www lint`
- [x] Build succeeds: `pnpm --filter @apps/www build`

#### Manual Verification:
- [x] Component imports correctly (verified by build)

**Implementation Note**: After completing this phase and all verification passes, proceed to Phase 4.

---

## Phase 4: Migrate export-slides.ts to ReactDOM Rendering

### Overview
Replace raw HTML string generation with ReactDOM rendering using `createRoot` and `flushSync`. Use `document.fonts.ready` for reliable font loading.

### Changes Required:

#### 1. Update export-slides.ts
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`

**Complete file replacement**:
```typescript
"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { CaptureSlide } from "../_components/capture-slide";

export interface ExportOptions {
  width?: number;
  height?: number;
  filename?: string;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  width: 1920,
  height: 1080,
  filename: "lightfast-pitch-deck",
};

/**
 * Captures all slides as PNG images and downloads as ZIP.
 * Uses ReactDOM to render slides off-screen for consistent styling.
 */
export async function exportSlidesToZip(
  options: ExportOptions = {}
): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();

  // Wait for all fonts to be loaded before capturing
  await document.fonts.ready;

  // Create off-screen container for rendering
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    z-index: -1;
  `;
  document.body.appendChild(container);

  // Create wrapper for React rendering
  const renderContainer = document.createElement("div");
  container.appendChild(renderContainer);

  const root = createRoot(renderContainer);

  try {
    for (const [i, slide] of PITCH_SLIDES.entries()) {
      // Render slide using React with flushSync for synchronous rendering
      flushSync(() => {
        root.render(
          createElement(CaptureSlide, {
            slide,
            width,
            height,
          })
        );
      });

      // Small delay to ensure styles are computed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Capture as canvas
      const slideElement = renderContainer.firstElementChild as HTMLElement;
      const canvas = await html2canvas(slideElement, {
        width,
        height,
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });

      // Convert to blob and add to ZIP
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      const slideNumber = String(i + 1).padStart(2, "0");
      zip.file(`slide-${slideNumber}-${slide.id}.png`, blob);
    }

    // Clean up React root
    root.unmount();

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${filename}.zip`);
  } finally {
    document.body.removeChild(container);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @apps/www typecheck`
- [x] Linting passes: `pnpm --filter @apps/www lint`
- [x] Build succeeds: `pnpm --filter @apps/www build`

#### Manual Verification:
- [ ] Navigate to pitch deck page at `/pitch-deck`
- [ ] Click the Download button in the navbar
- [ ] ZIP file downloads successfully
- [ ] Extract ZIP and verify all 8 slides are present
- [ ] Verify slide images have correct dimensions (1920x1080)
- [ ] Verify fonts render correctly (not system fallback fonts)
- [ ] Verify title slides have grid pattern overlay
- [ ] Verify content slides have proper layout
- [ ] Verify background colors match the presentation

**Implementation Note**: This is the final phase. After all verification passes, the refactoring is complete.

---

## Testing Strategy

### Unit Tests:
Not applicable - this is a refactoring that maintains existing behavior. Visual output is the test.

### Integration Tests:
- End-to-end test with Playwright to verify export functionality (future enhancement)

### Manual Testing Steps:
1. Start dev server: `pnpm dev:www`
2. Navigate to `/pitch-deck`
3. Verify all slides render correctly
4. Test keyboard navigation (arrow keys, space, home, end)
5. Scroll to end to trigger grid view
6. Click slides in grid view to navigate
7. Click Download button
8. Verify ZIP contains 8 PNG images
9. Open images and compare to on-screen presentation

## Performance Considerations

- `document.fonts.ready` awaits before any rendering, ensuring fonts are loaded once
- `flushSync` is used intentionally for synchronous rendering - this is the correct pattern for capture scenarios
- 50ms delay after rendering allows style computation to complete
- ReactDOM root is reused for all slides (created once, render called multiple times)
- Cleanup is in `finally` block to prevent memory leaks

## Migration Notes

No data migration required. This is a pure code refactoring that maintains identical visual output.

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-shared-component-architecture.md`
- Current pitch-deck.tsx: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:355-409`
- Current capture-slide.tsx: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx:38-92`
- Current export-slides.ts: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:79-218`
- Pitch deck data: `apps/www/src/config/pitch-deck-data.ts`
