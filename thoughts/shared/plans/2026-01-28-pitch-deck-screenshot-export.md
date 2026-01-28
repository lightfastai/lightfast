# Pitch Deck Screenshot Export Implementation Plan

## Overview

Add functionality to capture all pitch deck slides as PNG images and download them as a ZIP file. Users click a download button, slides are rendered statically (bypassing scroll animations), captured at 1920x1080 (16:9), and bundled into a downloadable ZIP.

## Current State Analysis

The pitch deck at `apps/www/src/app/(app)/(internal)/pitch-deck/` consists of:
- 8 slides defined in `~/config/pitch-deck-data.ts`
- Scroll-driven Framer Motion animations in `pitch-deck.tsx`
- 16:9 aspect ratio containers (`aspect-[16/9]`, `max-w-[1200px]`)
- Two slide types: "title" (red `#8B3A3A`) and "content" (cream `#F5F5F0`)

**Key constraint:** Slides use scroll-based transforms (y, scale, opacity) - we need to render them statically for capture.

### Key Discoveries:
- No existing screenshot/export utilities in the codebase
- Download pattern exists in `@repo/ui/components/ai-elements/code-block.tsx:27-38` (Blob + URL.createObjectURL)
- html2canvas and JSZip not currently installed

## Desired End State

- A "Download" button in the pitch deck header (right side, next to CONTACT)
- Clicking triggers capture of all 8 slides as PNG images
- Images captured at 1920x1080 resolution (true 16:9)
- All slides bundled into `lightfast-pitch-deck.zip`
- Loading state shown during capture (~2-3 seconds)

### Verification:
- Button visible in pitch deck header
- Clicking downloads a ZIP containing 8 PNG files
- Each image is exactly 1920x1080 pixels
- All slide content (text, backgrounds, gradients) rendered correctly

## What We're NOT Doing

- Server-side PDF generation (Puppeteer/Playwright)
- Print stylesheet / window.print() approach
- Individual slide download (only ZIP bundle)
- Customizable resolution/format options
- Preserving animations in output (static capture only)

## Implementation Approach

Use `html2canvas` to capture DOM elements as canvas images, then bundle with `jszip` for download. Create a hidden "capture container" that renders slides statically (no animations) at the target resolution.

## Phase 1: Install Dependencies

### Overview
Add required npm packages to apps/www.

### Changes Required:

#### 1. Install packages
**Command**: Run from `apps/www/`
```bash
pnpm add html2canvas jszip
```

### Success Criteria:

#### Automated Verification:
- [x] Packages appear in `apps/www/package.json` dependencies
- [x] `pnpm install` completes without errors
- [x] TypeScript recognizes imports: `import html2canvas from 'html2canvas'`

---

## Phase 2: Create Static Slide Component

### Overview
Create a component that renders a single slide without animations, designed for screenshot capture at a specific resolution.

### Changes Required:

#### 1. Create capture slide component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx`

```tsx
"use client";

import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";

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
        className={cn(
          "relative overflow-hidden",
          slide.bgColor
        )}
      >
        {slide.type === "title" ? (
          <TitleSlideContent slide={slide} />
        ) : (
          <ContentSlideContent slide={slide} />
        )}
      </div>
    );
  }
);

function TitleSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
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
      <div className="relative h-full flex flex-col justify-between p-16">
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-8xl font-bold text-center text-white tracking-tight">
            {slide.title}
          </h1>
        </div>
        <p className="text-lg text-center text-white/70">
          {slide.subtitle}
        </p>
      </div>
    </>
  );
}

function ContentSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  if (slide.type !== "content") return null;

  return (
    <div className="h-full p-16 flex flex-col justify-between">
      <h2 className="text-5xl font-light text-neutral-900">
        {slide.title}
      </h2>
      <div className="flex-1 flex flex-col justify-end">
        <div className="grid grid-cols-2 gap-16">
          <p className="text-base uppercase tracking-wider text-neutral-500">
            {slide.leftText}
          </p>
          <div className="space-y-6">
            {slide.rightText.map((text, i) => (
              <p
                key={i}
                className="text-xl border-b border-neutral-300 pb-4 text-neutral-700"
              >
                {text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Component exports correctly

---

## Phase 3: Create Export Utility

### Overview
Create a utility function that captures all slides and bundles them into a ZIP file.

### Changes Required:

#### 1. Create export utility
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`

```tsx
"use client";

import html2canvas from "html2canvas";
import JSZip from "jszip";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";

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
 * Creates a temporary off-screen container for rendering.
 */
export async function exportSlidesToZip(
  options: ExportOptions = {}
): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();

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

  try {
    for (let i = 0; i < PITCH_SLIDES.length; i++) {
      const slide = PITCH_SLIDES[i];

      // Render slide to container
      const slideElement = createSlideElement(slide, width, height);
      container.innerHTML = "";
      container.appendChild(slideElement);

      // Wait for fonts/images to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capture as canvas
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

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${filename}.zip`);
  } finally {
    document.body.removeChild(container);
  }
}

function createSlideElement(
  slide: (typeof PITCH_SLIDES)[number],
  width: number,
  height: number
): HTMLDivElement {
  const element = document.createElement("div");
  element.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    position: relative;
    overflow: hidden;
  `;

  // Apply background color
  const bgColor = slide.bgColor.replace("bg-[", "").replace("]", "");
  if (bgColor.startsWith("#")) {
    element.style.backgroundColor = bgColor;
  } else if (bgColor === "bg-[#8B3A3A]") {
    element.style.backgroundColor = "#8B3A3A";
  } else if (bgColor === "bg-[#F5F5F0]") {
    element.style.backgroundColor = "#F5F5F0";
  }

  // Create content based on slide type
  if (slide.type === "title") {
    element.innerHTML = createTitleSlideHTML(slide, width);
  } else {
    element.innerHTML = createContentSlideHTML(slide);
  }

  return element;
}

function createTitleSlideHTML(
  slide: (typeof PITCH_SLIDES)[number],
  width: number
): string {
  // Grid line count based on width
  const gridSize = 60;

  return `
    <div style="
      position: absolute;
      inset: 0;
      opacity: 0.1;
      background-image:
        linear-gradient(to right, white 1px, transparent 1px),
        linear-gradient(to bottom, white 1px, transparent 1px);
      background-size: ${gridSize}px ${gridSize}px;
    "></div>
    <div style="
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px;
    ">
      <div style="
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <h1 style="
          font-size: 96px;
          font-weight: bold;
          text-align: center;
          color: white;
          letter-spacing: -0.025em;
          font-family: system-ui, -apple-system, sans-serif;
        ">${slide.title}</h1>
      </div>
      <p style="
        font-size: 18px;
        text-align: center;
        color: rgba(255, 255, 255, 0.7);
        font-family: system-ui, -apple-system, sans-serif;
      ">${slide.subtitle || ""}</p>
    </div>
  `;
}

function createContentSlideHTML(
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "content" }>
): string {
  const rightTextItems = slide.rightText
    .map(
      (text) => `
      <p style="
        font-size: 24px;
        border-bottom: 1px solid #d4d4d4;
        padding-bottom: 16px;
        color: #404040;
        font-family: system-ui, -apple-system, sans-serif;
      ">${text}</p>
    `
    )
    .join("");

  return `
    <div style="
      height: 100%;
      padding: 64px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    ">
      <h2 style="
        font-size: 56px;
        font-weight: 300;
        color: #171717;
        font-family: system-ui, -apple-system, sans-serif;
      ">${slide.title}</h2>
      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      ">
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
        ">
          <p style="
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #737373;
            font-family: system-ui, -apple-system, sans-serif;
          ">${slide.leftText}</p>
          <div style="display: flex; flex-direction: column; gap: 24px;">
            ${rightTextItems}
          </div>
        </div>
      </div>
    </div>
  `;
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
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] No lint errors: `pnpm lint`

---

## Phase 4: Add Download Button to Header

### Overview
Add a download button to the pitch deck header that triggers the export functionality with loading state.

### Changes Required:

#### 1. Create download button component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { exportSlidesToZip } from "../_lib/export-slides";

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportSlidesToZip();
    } catch (error) {
      console.error("Failed to export slides:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={isExporting}
      className="text-sm text-foreground hover:text-muted-foreground transition-colors"
    >
      {isExporting ? (
        <>
          <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Icons.download className="mr-2 h-4 w-4" />
          Download
        </>
      )}
    </Button>
  );
}
```

#### 2. Update layout to include download button
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`
**Changes**: Add DownloadButton import and render in header

```tsx
// Add import at top
import { DownloadButton } from "./_components/download-button";

// Update the right section of the header (around line 40-47)
// Replace:
<div className="md:justify-self-end">
  <a
    href="mailto:jp@lightfast.ai"
    className="text-sm text-foreground hover:text-muted-foreground transition-colors"
  >
    CONTACT
  </a>
</div>

// With:
<div className="flex items-center gap-4 md:justify-self-end">
  <DownloadButton />
  <a
    href="mailto:jp@lightfast.ai"
    className="text-sm text-foreground hover:text-muted-foreground transition-colors"
  >
    CONTACT
  </a>
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Download button visible in pitch deck header
- [ ] Button shows loading state when clicked
- [ ] ZIP file downloads successfully
- [ ] ZIP contains 8 PNG files named `slide-01-title.png`, `slide-02-intro.png`, etc.
- [ ] Each image is 1920x1080 pixels
- [ ] Slide content (text, colors, grid pattern) renders correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the export works correctly before considering the feature complete.

---

## Phase 5: Verify Download Icon Exists

### Overview
Ensure the download icon is available in the Icons component. If not, add it.

### Changes Required:

#### 1. Check Icons component
**File**: `packages/ui/src/components/icons.tsx`
**Action**: Verify `Icons.download` and `Icons.loader` exist. If `download` is missing, add:

```tsx
// Inside the Icons object
download: (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
),
```

Or if using lucide-react:
```tsx
import { Download, Loader2 } from "lucide-react";

// In Icons object
download: Download,
loader: Loader2,
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] No missing icon errors

---

## Testing Strategy

### Unit Tests:
- Export utility function can be tested by mocking html2canvas and JSZip
- Test that ZIP contains correct number of files with expected names

### Manual Testing Steps:
1. Navigate to `/pitch-deck`
2. Click the "Download" button in the header
3. Verify loading state appears ("Exporting...")
4. Verify ZIP file downloads after ~2-3 seconds
5. Open ZIP and verify:
   - 8 PNG files present
   - Files named correctly (slide-01-title.png, slide-02-intro.png, etc.)
   - Open each image - verify 1920x1080 resolution
   - Verify content matches the slides (text, colors, layout)
6. Test on different browsers (Chrome, Safari, Firefox)

## Performance Considerations

- Each slide capture takes ~200-300ms
- Total export time: ~2-3 seconds for 8 slides
- Off-screen rendering prevents UI jank
- Memory usage: ~50MB peak during capture (cleaned up after)

## Dependencies Added

```json
{
  "html2canvas": "^1.4.1",
  "jszip": "^3.10.1"
}
```

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export.md`
- Pitch deck component: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:16-123`
- Slide data: `apps/www/src/config/pitch-deck-data.ts:1-98`
- Download utility pattern: `@repo/ui/components/ai-elements/code-block.tsx:27-38`
