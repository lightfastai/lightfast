---
date: 2026-01-28T05:39:00Z
researcher: Claude
git_commit: ff65906b78caead1463061e06a84630bc364f7a6
branch: feat/pitch-deck-page
repository: lightfast
topic: "Pitch Deck PDF Export - Converting from PNG/ZIP to Single PDF"
tags: [research, codebase, pitch-deck, pdf-export, html2canvas, jspdf]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck PDF Export - Converting from PNG/ZIP to Single PDF

**Date**: 2026-01-28T05:39:00Z
**Researcher**: Claude
**Git Commit**: ff65906b78caead1463061e06a84630bc364f7a6
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question

How to convert the current pitch deck export from individual PNG images in a ZIP file to a single PDF with multiple pages (one slide per page)?

## Summary

The pitch deck export system currently uses **html2canvas-pro** to capture slides as PNG images and **JSZip** to bundle them into a downloadable ZIP file. Converting to PDF export requires replacing JSZip with **jsPDF** (or similar), adding each captured canvas as a page to a single PDF document rather than as separate PNG files in a ZIP.

## Detailed Findings

### Current Export Implementation

The export system is located at `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts`.

**Dependencies currently installed:**
- `html2canvas-pro: ^1.6.6` - Captures HTML elements as canvas
- `jszip: ^3.10.1` - Creates ZIP archives (to be replaced)

**Export Flow:**
1. Creates an off-screen container at 1920x1080 pixels
2. Uses ReactDOM to render each slide via `CaptureSlide` component
3. Captures each slide using `html2canvas`
4. Converts canvas to PNG blob
5. Adds each PNG to a JSZip instance
6. Downloads the final ZIP file

**Key code structure:**

```typescript
// Current implementation (export-slides.ts:27-106)
export async function exportSlidesToZip(options: ExportOptions = {}): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();

  // ... off-screen rendering setup ...

  for (const [i, slide] of PITCH_SLIDES.entries()) {
    // 1. Render slide with React
    flushSync(() => {
      root.render(createElement(CaptureSlide, { slide, width, height }));
    });

    // 2. Capture as canvas
    const canvas = await html2canvas(slideElement, { width, height, ... });

    // 3. Convert to PNG blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => { ... }, "image/png", 1.0);
    });

    // 4. Add to ZIP
    zip.file(`slide-${slideNumber}-${slide.id}.png`, blob);
  }

  // 5. Download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${filename}.zip`);
}
```

### Components Involved

| File | Role |
|------|------|
| `_lib/export-slides.ts:1-122` | Export logic - iterates slides, captures canvas, bundles ZIP |
| `_components/capture-slide.tsx:1-36` | Static slide renderer for screenshot capture (no animations) |
| `_components/download-button.tsx:1-45` | UI button that triggers `exportSlidesToZip()` |
| `~/config/pitch-deck-data.ts:1-98` | 8 slides in `PITCH_SLIDES` array |
| `_components/slide-content/index.ts` | Re-exports `TitleSlideContent` and `ContentSlideContent` |

### CaptureSlide Component

The `CaptureSlide` component (`capture-slide.tsx:18-36`) is specifically designed for static screenshot capture:

```typescript
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

Key characteristics:
- Accepts explicit `width` and `height` props (default 1920x1080)
- Uses `variant="fixed"` for static rendering (no responsive scaling)
- No animations or scroll-driven transforms
- Already optimized for canvas capture

### What Needs to Change for PDF Export

**Remove:**
- `jszip` dependency
- ZIP file creation logic

**Add:**
- `jspdf` dependency (or similar PDF library)
- PDF document creation with page dimensions matching slide aspect ratio
- Add each canvas as a new page instead of as a ZIP entry

**Code changes required in `export-slides.ts`:**

1. **Import change**: Replace `JSZip` with `jsPDF`
2. **Document initialization**: Create PDF with 16:9 page dimensions
3. **Loop modification**: Instead of `zip.file()`, use `pdf.addImage()` and `pdf.addPage()`
4. **Download change**: Replace `zip.generateAsync()` with `pdf.save()` or `pdf.output()`

### Slide Data

The `PITCH_SLIDES` array contains 8 slides total:
1. Title slide (`id: "title"`) - red background
2. Intro slide (`id: "intro"`) - cream background
3. Problem slide (`id: "problem"`) - cream background
4. Solution slide (`id: "solution"`) - cream background
5. Traction slide (`id: "traction"`) - cream background
6. Team slide (`id: "team"`) - cream background
7. Ask slide (`id: "ask"`) - cream background
8. Vision slide (`id: "vision"`) - red background

All slides use 16:9 aspect ratio (1920x1080 for export).

### Export Options Interface

Current options in `export-slides.ts:11-15`:

```typescript
export interface ExportOptions {
  width?: number;   // Default: 1920
  height?: number;  // Default: 1080
  filename?: string; // Default: "lightfast-pitch-deck"
}
```

These options work equally well for PDF export - just change the file extension from `.zip` to `.pdf`.

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:1-122` - Main export logic
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:27-106` - `exportSlidesToZip` function
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:31` - JSZip instantiation (to remove)
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:98` - Adding PNG to ZIP (to replace)
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:105-106` - ZIP generation (to replace)
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx:18-36` - Static slide component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx:16` - Calls `exportSlidesToZip()`
- `apps/www/src/config/pitch-deck-data.ts:1-98` - 8 slide definitions
- `apps/www/package.json:54` - html2canvas-pro dependency
- `apps/www/package.json:56` - jszip dependency (to remove)

## Architecture Documentation

**Current export pipeline:**
```
DownloadButton.onClick()
    → exportSlidesToZip()
        → for each slide in PITCH_SLIDES:
            → React.render(CaptureSlide)
            → html2canvas() → Canvas
            → canvas.toBlob() → PNG Blob
            → zip.file() → Add to ZIP
        → zip.generateAsync() → ZIP Blob
        → downloadBlob() → Browser download
```

**Target PDF export pipeline:**
```
DownloadButton.onClick()
    → exportSlidesToPdf()
        → new jsPDF() → PDF Document
        → for each slide in PITCH_SLIDES:
            → React.render(CaptureSlide)
            → html2canvas() → Canvas
            → pdf.addImage(canvas)
            → pdf.addPage() (if not last slide)
        → pdf.save() or pdf.output() → Browser download
```

## Historical Context (from thoughts/)

Previous research document `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export.md` evaluated PDF generation approaches:
- Recommended server-side Puppeteer/Playwright for best CSS preservation
- Client-side html2canvas + jsPDF noted as an option (image-based, no text selection)
- Current implementation chose client-side html2canvas for simplicity

The existing html2canvas approach can be adapted to PDF output without changing the capture mechanism - only the bundling format changes from ZIP to PDF.

## Open Questions

1. Should the function be renamed from `exportSlidesToZip` to `exportSlidesToPdf`?
2. Should the old ZIP export remain available as an alternative?
3. What PDF compression settings should be used to balance quality vs file size?
