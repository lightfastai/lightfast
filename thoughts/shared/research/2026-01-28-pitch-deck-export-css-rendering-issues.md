---
date: 2026-01-28T05:52:52Z
researcher: Claude
git_commit: b4385768704e0d2c320ea0e741bda32066a2dc57
branch: feat/pitch-deck-page
repository: lightfast
topic: "Pitch Deck Export CSS Rendering Issues - Why PNGs Differ from Actual Slides"
tags: [research, codebase, pitch-deck, html2canvas, css-rendering, export, tailwind]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck Export CSS Rendering Issues

**Date**: 2026-01-28T05:52:52Z
**Researcher**: Claude
**Git Commit**: b4385768704e0d2c320ea0e741bda32066a2dc57
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question

Why is `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts` not correctly exporting the HTML + CSS? The output PNGs are different from the actual slide content.

## Summary

The pitch deck export system has **multiple architectural issues** causing visual discrepancies between exported PNGs and the actual rendered slides:

1. **Off-screen container isolation**: The capture container at `left: -9999px` is disconnected from the DOM context that has CSS variables and Tailwind classes resolved
2. **CSS variables not inherited**: The off-screen container doesn't inherit `:root` or `.dark` CSS custom properties (oklch colors)
3. **Tailwind class resolution**: Classes like `text-neutral-900`, `text-white/70`, `border-neutral-300` may not resolve correctly in the isolated container
4. **50ms delay insufficient**: The 50ms timeout for styles to compute may not be enough for fonts and complex layouts
5. **Font loading race condition**: Despite `document.fonts.ready`, the 50ms delay can still miss font rendering in the off-screen context

## Detailed Findings

### Current Export Architecture

The export system uses this flow:

```
export-slides.ts                 CaptureSlide.tsx              SlideContent Components
      │                               │                               │
      ▼                               ▼                               ▼
┌─────────────────┐           ┌──────────────┐              ┌────────────────────┐
│ Off-screen DIV  │──render──▶│ React render │──renders────▶│ TitleSlideContent  │
│ left: -9999px   │           │ with flushSync│              │ ContentSlideContent│
│ width: 1920px   │           └──────────────┘              └────────────────────┘
│ height: 1080px  │                                                   │
└────────┬────────┘                                                   │
         │                                                            │
         ▼                                                            ▼
┌─────────────────┐                                         ┌────────────────────┐
│ html2canvas     │◀────────────────────────────────────────│ Uses Tailwind CSS  │
│ captures DOM    │                                         │ classes & variants │
└────────┬────────┘                                         └────────────────────┘
         │
         ▼
    [PNG Blob → ZIP]
```

### File Locations and Key Code

| Component | File | Line | Purpose |
|-----------|------|------|---------|
| Export function | `_lib/export-slides.ts` | 27-110 | Main export orchestration |
| Capture slide | `_components/capture-slide.tsx` | 18-36 | Static slide wrapper |
| Title content | `_components/slide-content/title-slide-content.tsx` | 13-54 | Title slide rendering |
| Content content | `_components/slide-content/content-slide-content.tsx` | 12-62 | Content slide rendering |
| Display slides | `_components/pitch-deck.tsx` | 336-354 | Live slide with animations |

### Issue 1: Off-Screen Container CSS Isolation

**Location**: `export-slides.ts:37-46`

```typescript
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
```

The container is positioned off-screen but **still appended to `document.body`**. However:
- CSS custom properties from `:root` should be inherited
- Tailwind classes should resolve correctly since styles are in the stylesheet

**Potential issue**: The container lacks context-specific classes that might affect rendering (e.g., theme classes).

### Issue 2: CSS Variable Resolution with oklch()

**Location**: `packages/ui/src/globals.css:73-129` and `apps/www/src/styles/globals.css:6-10`

The application uses `oklch()` color format extensively:

```css
:root {
  --foreground: oklch(0.145 0 0);
  --background: oklch(1 0 0);
  /* ... */
}
```

**The export uses `html2canvas-pro`** (`export-slides.ts:6`) which **does support oklch()** colors (this was the reason for using the `-pro` fork). However, the off-screen container may not properly inherit these variables if:
- The container hierarchy doesn't include the root element styles
- The computed styles aren't properly calculated for off-screen elements

### Issue 3: Variant-Based Styling Differences

The slide content components use a `variant` prop to handle responsive vs fixed layouts:

**TitleSlideContent** (`title-slide-content.tsx:33-39`):
```tsx
<h1
  className={cn(
    "font-bold text-center text-white tracking-tight",
    isFixed
      ? "text-8xl"  // Fixed: 96px font
      : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"  // Responsive
  )}
>
```

**ContentSlideContent** (`content-slide-content.tsx:37-43`):
```tsx
<p
  className={cn(
    "uppercase tracking-wider text-neutral-500",
    isFixed ? "text-base" : "text-[10px] sm:text-xs"
  )}
>
```

The `CaptureSlide` correctly passes `variant="fixed"` to use absolute sizes. This should be correct.

### Issue 4: Tailwind Color Classes

The slide content uses these Tailwind classes:
- `text-white` / `text-white/70` - For title slides
- `text-neutral-900` / `text-neutral-700` / `text-neutral-500` - For content slides
- `border-neutral-300` - For content borders
- `bg-[#8B3A3A]` / `bg-[#F5F5F0]` - Custom background colors (inline hex)

**html2canvas limitations** (from web research):
- Tailwind v4+ uses `oklch()` colors by default
- Some opacity modifiers like `text-white/70` compile to `oklch()` or `rgba()`
- html2canvas-pro supports these, but computed styles may differ

### Issue 5: Timing and Font Loading

**Location**: `export-slides.ts:34, 68-69`

```typescript
// Wait for all fonts to be loaded before capturing
await document.fonts.ready;

// ...inside loop
// Small delay to ensure styles are computed
await new Promise((resolve) => setTimeout(resolve, 50));
```

**Potential issues**:
1. `document.fonts.ready` waits for fonts in the main document, but newly rendered React content in the off-screen container may trigger additional font loading
2. 50ms may be insufficient for:
   - CSS layout calculations at 1920x1080
   - Flexbox/grid layout resolution
   - Font rendering in the off-screen context

### Issue 6: html2canvas Configuration

**Location**: `export-slides.ts:73-80`

```typescript
const canvas = await html2canvas(slideElement, {
  width,
  height,
  scale: 1,
  useCORS: true,
  logging: false,
  backgroundColor: null,
});
```

**Current configuration analysis**:
- `scale: 1` - Captures at actual resolution (1920x1080), no upscaling for quality
- `backgroundColor: null` - Relies on element's background, doesn't force transparency
- Missing potentially helpful options:
  - `windowWidth` / `windowHeight` - Could help with layout calculations
  - `onclone` - Callback to modify the cloned DOM before capture (could inject CSS)

### Issue 7: Linear Gradient Grid Pattern

**Location**: `title-slide-content.tsx:24-31`

```tsx
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
```

**html2canvas handling**: According to research, html2canvas supports `linear-gradient()`. However:
- Complex gradients with `calc()` can fail
- This gradient is simple and should work
- The `opacity-10` class needs to resolve to `opacity: 0.1`

### Issue 8: Flexbox Layout Rendering

The content uses extensive flexbox:

```tsx
// From CaptureSlide
<div className="h-full p-16 flex flex-col justify-between">

// From ContentSlideContent
<div className="flex-1 flex flex-col justify-end">
  <div className="grid grid-cols-2 gap-16">
```

**html2canvas known issues with flexbox**:
- `flex-wrap` behavior can be incorrect
- Gaps between elements may render incorrectly
- `justify-between` may not calculate properly in off-screen context

### Comparison: Live Display vs Capture

| Aspect | Live Display (pitch-deck.tsx) | Capture (capture-slide.tsx) |
|--------|------------------------------|----------------------------|
| Container | `aspect-[16/9] max-w-[1200px]` | Fixed `1920x1080` pixels |
| Padding | `p-6 sm:p-8 md:p-12` (responsive) | `p-16` (64px fixed) |
| Position | In viewport, sticky | Off-screen at -9999px |
| Font sizes | Responsive breakpoints | Fixed sizes (`text-8xl`, `text-5xl`) |
| Animation | Framer Motion transforms | None (static) |
| CSS context | Full document cascade | Appended to body, isolated |

## Known html2canvas-pro Limitations

From web research, html2canvas-pro **does NOT support**:
- `background-blend-mode`
- `border-image`
- `box-shadow` (limited)
- `filter`
- `mix-blend-mode`
- `backdrop-filter: blur()` (explicitly not supported)
- `background-clip: text`
- `repeating-linear-gradient()`
- Complex transforms

**Currently used in slides that may fail**:
- `shadow-2xl` on the live slides (but not in capture component)
- `backdrop-blur-sm` on grid view (not in export path)

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:27-110` - Main export function
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx:18-36` - Capture component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/title-slide-content.tsx:13-54` - Title slide
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/slide-content/content-slide-content.tsx:12-62` - Content slide
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:336-354` - Live slide rendering
- `packages/ui/src/globals.css:73-165` - CSS custom properties
- `apps/www/src/styles/globals.css:6-10` - Brand colors with oklch

## Architecture Documentation

### Export Flow
1. User clicks Download button (`download-button.tsx`)
2. `exportSlidesToZip()` called (`export-slides.ts:27`)
3. Waits for fonts: `document.fonts.ready` (line 34)
4. Creates off-screen container at -9999px (lines 37-47)
5. Creates React root in container (line 53)
6. For each slide:
   - Renders `CaptureSlide` component with `flushSync` (lines 58-66)
   - Waits 50ms for styles (line 69)
   - Captures with html2canvas-pro (lines 73-80)
   - Converts to PNG blob (lines 83-95)
   - Adds to ZIP (line 98)
7. Unmounts React root (line 102)
8. Downloads ZIP file (line 106)
9. Cleans up container (line 108)

### Component Hierarchy for Capture
```
CaptureSlide (fixed dimensions, bgColor)
└── div (h-full p-16 flex flex-col justify-between)
    └── TitleSlideContent | ContentSlideContent (variant="fixed")
        └── Slide-specific content with fixed font sizes
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export.md` - Original research on PDF export options
- `thoughts/shared/plans/2026-01-28-pitch-deck-screenshot-export.md` - Implementation plan for current system

## Open Questions

1. What specific visual differences are occurring? (fonts, colors, layout, missing elements?)
2. Are the background colors (#8B3A3A, #F5F5F0) rendering correctly?
3. Is the grid pattern on title slides visible in the export?
4. Are the fonts loading correctly (Geist Sans/Mono)?
5. Has the export been tested with browser DevTools to inspect the off-screen container?
6. Does increasing the delay from 50ms to 200-500ms improve results?
7. Would using the `onclone` callback to inject CSS variables help?
