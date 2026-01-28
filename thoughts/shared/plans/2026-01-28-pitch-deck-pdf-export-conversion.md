# Pitch Deck PDF Export Conversion Implementation Plan

## Overview

Convert the pitch deck export from individual PNG images bundled in a ZIP file to a single multi-page PDF document. Each slide becomes one page in the PDF, maintaining the 16:9 aspect ratio and high visual quality.

## Current State Analysis

The export system is located at `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`.

**Current dependencies:**
- `html2canvas-pro: ^1.6.6` - Captures HTML elements as canvas (KEEP)
- `jszip: ^3.10.1` - Creates ZIP archives (REMOVE)

**Current export flow:**
1. Creates off-screen container at 1920x1080 pixels
2. Renders each slide via `CaptureSlide` component using ReactDOM
3. Captures each slide as canvas using `html2canvas`
4. Converts canvas to PNG blob
5. Adds each PNG to a JSZip instance
6. Downloads the final ZIP file

### Key Discoveries:
- `export-slides.ts:27-106` - Main export function `exportSlidesToZip()`
- `export-slides.ts:31` - JSZip instantiation point
- `export-slides.ts:98` - Adding PNG to ZIP (`zip.file()`)
- `export-slides.ts:105-106` - ZIP generation and download
- `capture-slide.tsx:18-36` - Static slide component (no changes needed)
- `download-button.tsx:16` - Calls `exportSlidesToZip()` (needs import update)
- 8 slides total in `PITCH_SLIDES` array, all 16:9 aspect ratio

## Desired End State

A single PDF file download containing all 8 pitch deck slides:
- Each slide is a separate page in the PDF
- Pages maintain 16:9 aspect ratio (1920x1080 pixels)
- High quality PNG image embedding (no JPEG artifacts)
- Clean filename: `lightfast-pitch-deck.pdf`
- Same user experience (click button, file downloads)

**Verification:**
1. Download button triggers PDF export (not ZIP)
2. PDF opens with 8 pages
3. Each page displays the corresponding slide at full quality
4. File size is reasonable (~5-8MB for 8 high-quality slides)

## What We're NOT Doing

- NOT adding server-side PDF generation (keeping client-side approach)
- NOT keeping ZIP export as fallback (replacing entirely)
- NOT changing the canvas capture mechanism (html2canvas works well)
- NOT modifying `CaptureSlide` component (already optimized)
- NOT adding JPEG compression (user chose high quality PNG)

## Implementation Approach

The conversion is straightforward - we're swapping the bundling format from ZIP to PDF while keeping the same slide capture mechanism:

1. Replace `jszip` dependency with `jspdf`
2. Rename function from `exportSlidesToZip` to `exportSlidesToPdf`
3. Replace ZIP creation with PDF document creation
4. Replace `zip.file()` calls with `pdf.addImage()` + `pdf.addPage()`
5. Replace `zip.generateAsync()` with `pdf.save()`
6. Update the download button import

---

## Phase 1: Dependency Changes

### Overview
Remove jszip, install jspdf, update imports.

### Changes Required:

#### 1. Update package.json
**File**: `apps/www/package.json`
**Changes**: Remove jszip, add jspdf

```diff
-    "jszip": "^3.10.1",
+    "jspdf": "^2.5.2",
```

#### 2. Install dependencies
Run `pnpm install` from repository root to update lockfile.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] `jspdf` is listed in `node_modules/jspdf`
- [x] `jszip` is no longer in www dependencies
- [x] TypeScript can import jsPDF: `import { jsPDF } from 'jspdf'`

---

## Phase 2: Convert Export Function

### Overview
Modify `export-slides.ts` to generate PDF instead of ZIP.

### Changes Required:

#### 1. Update export-slides.ts
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`
**Changes**: Replace JSZip with jsPDF, rename function, update export logic

```typescript
"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
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
 * Captures all slides as images and downloads as a single PDF.
 * Uses ReactDOM to render slides off-screen for consistent styling.
 */
export async function exportSlidesToPdf(
  options: ExportOptions = {}
): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };

  // Create PDF with landscape orientation matching slide aspect ratio
  // jsPDF uses points (pt) as default unit, but we can specify dimensions in px
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [width, height],
    hotfixes: ["px_scaling"],
  });

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

      // Add canvas as image to PDF
      // Use PNG format for high quality (no JPEG artifacts)
      const imgData = canvas.toDataURL("image/png", 1.0);

      // First page is already created, add new pages for subsequent slides
      if (i > 0) {
        pdf.addPage([width, height], "landscape");
      }

      // Add image at position (0, 0) with full page dimensions
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
    }

    // Clean up React root
    root.unmount();

    // Save PDF (triggers browser download)
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] ESLint passes: `pnpm --filter @lightfast/www lint`
- [x] No unused imports (jszip removed)

---

## Phase 3: Update Download Button

### Overview
Update the download button to use the new PDF export function.

### Changes Required:

#### 1. Update download-button.tsx
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx`
**Changes**: Update import and function call

```typescript
"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { exportSlidesToPdf } from "../_lib/export-slides";

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

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

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] ESLint passes: `pnpm --filter @lightfast/www lint`
- [ ] Build succeeds: `pnpm --filter @lightfast/www build:dev` (pre-existing Turbopack issue with `/_not-found` page)

#### Manual Verification:
- [x] Navigate to pitch deck page
- [x] Click "Download" button
- [x] PDF file downloads (not ZIP)
- [x] PDF contains 8 pages (one per slide)
- [x] Each page displays correctly at 16:9 aspect ratio
- [x] Visual quality matches the on-screen slides
- [x] File size is reasonable (~5-8MB)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the PDF export works correctly before considering the implementation complete.

---

## Testing Strategy

### Unit Tests:
No unit tests needed for this change - it's a straightforward library swap with the same behavior (capture slides → download file).

### Integration Tests:
Not applicable - this is a client-side browser feature.

### Manual Testing Steps:
1. Start dev server: `pnpm dev:www`
2. Navigate to `/pitch-deck`
3. Click "Download" button in navbar
4. Verify loading state appears ("Exporting...")
5. Verify PDF downloads with filename `lightfast-pitch-deck.pdf`
6. Open PDF and verify:
   - 8 pages total
   - Each page is a distinct slide
   - Colors and styling match the web version
   - No visual artifacts or compression issues
   - 16:9 aspect ratio on each page

## Performance Considerations

- **Export time**: Similar to current ZIP export (~5-10 seconds for 8 slides)
- **Memory usage**: Slightly less than ZIP since we don't need to hold all PNGs in memory
- **File size**: ~5-8MB for high-quality PNG embedding (larger than JPEG but better quality)

## Rollback Plan

If issues arise, revert the changes:
1. Remove jspdf from package.json
2. Add jszip back to package.json
3. Restore original export-slides.ts
4. Restore original download-button.tsx
5. Run `pnpm install`

## References

- Research: `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export-conversion.md`
- Original PDF export research: `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export.md`
- Current export implementation: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`
- jsPDF documentation: https://github.com/parallax/jsPDF
