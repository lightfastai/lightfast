---
date: 2026-01-28T04:57:35Z
researcher: Claude
git_commit: ff65906b78caead1463061e06a84630bc364f7a6
branch: feat/pitch-deck-page
repository: lightfast
topic: "Pitch Deck Slide Rendering Architecture - Shared Component Solution Design"
tags: [research, codebase, pitch-deck, component-architecture, html2canvas, react-rendering]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck Slide Rendering Architecture - Shared Component Solution Design

**Date**: 2026-01-28T04:57:35Z
**Researcher**: Claude
**Git Commit**: ff65906b78caead1463061e06a84630bc364f7a6
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question

Research the pitch-deck slide rendering architecture to design a shared component solution:
1. How are slides currently rendered with Framer Motion vs static export?
2. What patterns exist for ReactDOM.createRoot rendering for capture/export?
3. How can shared content components be wrapped differently for different contexts?
4. How should export-slides.ts use ReactDOM instead of raw HTML strings?

## Summary

The pitch deck currently has **three separate implementations** of slide content rendering:

1. **`pitch-deck.tsx`**: `SlideContent` component with Framer Motion scroll animations
2. **`capture-slide.tsx`**: `TitleSlideContent`/`ContentSlideContent` with static React rendering
3. **`export-slides.ts`**: `createTitleSlideHTML`/`createContentSlideHTML` with raw HTML strings

This violates DRY principles - slide content is defined three times with slightly different styling. The solution is to create a **single source of truth** for slide content that can be wrapped differently for each context.

**Key finding**: The codebase does NOT currently use `ReactDOM.createRoot` for off-screen rendering. The export utility uses raw HTML strings with inline styles because:
1. html2canvas doesn't process Tailwind classes reliably in off-screen containers
2. Inline styles guarantee consistent capture regardless of CSS loading
3. Raw HTML avoids React rendering lifecycle complexity

However, a ReactDOM-based approach IS viable using `flushSync` to ensure synchronous rendering before capture.

## Detailed Findings

### Current Implementation Analysis

#### 1. Animated Slides (`pitch-deck.tsx:355-409`)

The main presentation uses `SlideContent` which renders slide content inside a `motion.article` wrapper with scroll-driven transforms:

```typescript
function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  switch (slide.type) {
    case "title":
      return (
        <>
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, white 1px, transparent 1px)...`,
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative flex-1 flex items-center justify-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white tracking-tight">
              {slide.title}
            </h1>
          </div>
          <p className="relative text-xs sm:text-sm text-center text-white/70">
            {slide.subtitle}
          </p>
        </>
      );
    case "content":
      return (/* content structure */);
  }
}
```

**Key characteristics**:
- Responsive Tailwind classes (`text-3xl sm:text-4xl md:text-5xl lg:text-6xl`)
- Fragment return (`<>...</>`) - expects parent to provide container styling
- Used in both `PitchSlide` (animated) and `GridSlideItem` (scaled thumbnail)

#### 2. Static Capture Component (`capture-slide.tsx:17-92`)

A separate React component designed for screenshot capture:

```typescript
export const CaptureSlide = forwardRef<HTMLDivElement, CaptureSlideProps>(
  function CaptureSlide({ slide, width = 1920, height = 1080 }, ref) {
    return (
      <div
        ref={ref}
        style={{ width, height }}
        className={cn("relative overflow-hidden", slide.bgColor)}
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

function TitleSlideContent({ slide }) {
  return (
    <>
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: `...`, backgroundSize: "60px 60px" }}
      />
      <div className="relative h-full flex flex-col justify-between p-16">
        <h1 className="text-8xl font-bold text-center text-white tracking-tight">
          {slide.title}
        </h1>
      </div>
    </>
  );
}
```

**Key characteristics**:
- Fixed dimensions via props (`width = 1920, height = 1080`)
- Fixed font sizes (`text-8xl`, `text-5xl`) - no responsive breakpoints
- Uses `forwardRef` for direct DOM access
- **Currently NOT used** in the export flow

#### 3. Raw HTML Export (`export-slides.ts:79-218`)

The export utility creates slides using raw HTML strings with inline styles:

```typescript
function createSlideElement(slide, width, height): HTMLDivElement {
  const element = document.createElement("div");
  element.style.cssText = `width: ${width}px; height: ${height}px; position: relative; overflow: hidden;`;

  // Parse bgColor from Tailwind format
  const bgColor = slide.bgColor.replace("bg-[", "").replace("]", "");
  element.style.backgroundColor = bgColor;

  if (slide.type === "title") {
    element.innerHTML = createTitleSlideHTML(slide, width);
  } else {
    element.innerHTML = createContentSlideHTML(slide);
  }
  return element;
}

function createTitleSlideHTML(slide, _width): string {
  return `
    <div style="position: absolute; inset: 0; opacity: 0.1;
      background-image: linear-gradient(...);
      background-size: 60px 60px;">
    </div>
    <div style="position: relative; height: 100%; display: flex; flex-direction: column;
      justify-content: space-between; padding: 64px;">
      <h1 style="font-size: 96px; font-weight: bold; text-align: center;
        color: white; letter-spacing: -0.025em;
        font-family: system-ui, -apple-system, sans-serif;">
        ${slide.title}
      </h1>
    </div>
  `;
}
```

**Key characteristics**:
- All inline styles (no Tailwind)
- Manually parses Tailwind `bg-[#hex]` syntax
- Uses system fonts (Tailwind's default font not available)
- Template literals for HTML generation

### Why Raw HTML Was Chosen for Export

The current implementation uses raw HTML for several reasons:

1. **Off-screen CSS isolation**: When elements are positioned at `left: -9999px`, the browser may not fully compute CSS:
   - Tailwind classes need to be in a style sheet that's already parsed
   - Custom CSS properties may not resolve correctly
   - Computed styles can differ from on-screen rendering

2. **html2canvas limitations**:
   - Reads computed styles at capture time
   - Can miss styles from dynamically loaded CSS
   - Background images/gradients need inline styles for reliability

3. **Avoiding React lifecycle**: Raw HTML avoids:
   - React hydration issues
   - useEffect timing problems
   - State updates during capture

### Patterns for ReactDOM Rendering to Off-Screen Container

While the codebase doesn't currently use this pattern, here's how it could work:

```typescript
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

function renderSlideToDOM(slide, container) {
  const root = createRoot(container);

  // flushSync ensures synchronous rendering before capture
  flushSync(() => {
    root.render(<CaptureSlide slide={slide} width={1920} height={1080} />);
  });

  // Now the DOM is ready for html2canvas
  return container.firstElementChild;
}
```

**Important**: `flushSync` is required because:
- React batches updates and renders asynchronously
- Without it, `html2canvas` might capture before React finishes
- It forces React to complete rendering before the next line executes

### Shared Content Component Patterns in Codebase

The codebase has examples of content/wrapper separation:

**Pattern 1: Chat Artifacts with `isInline` prop**
```typescript
// Same component adapts via prop
<artifactDefinition.content
  isInline={false}  // Full viewer: header, actions, chrome
  // vs
  isInline={true}   // Inline: minimal, embedded
/>
```

**Pattern 2: Markdown inline vs block**
```typescript
function code({ inline, className, children }) {
  if (inline) {
    return <code className="bg-muted/50 rounded-md px-1 py-0.5">{children}</code>;
  }
  return <CodeBlock language={lang}>{children}</CodeBlock>;
}
```

**Pattern 3: Pitch deck GridSlideItem scaling**
```typescript
// Same SlideContent, but scaled down 25%
<div className="w-[400%] h-[400%] origin-top-left" style={{ transform: "scale(0.25)" }}>
  <SlideContent slide={slide} />
</div>
```

### Slide Data Structure (`pitch-deck-data.ts`)

```typescript
export const PITCH_SLIDES = [
  {
    id: "title",
    type: "title" as const,
    title: "LIGHTFAST",
    subtitle: "Pitch deck 2026 —",
    bgColor: "bg-[#8B3A3A]",
  },
  {
    id: "intro",
    type: "content" as const,
    title: "Hi, we are Lightfast.",
    leftText: "HERE'S HOW WE GOT FROM 0 TO 30",
    rightText: [
      "The memory layer for software teams.",
      "We help engineering teams search...",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // ... 8 slides total
] as const;
```

Two slide types with discriminated union:
- `title`: `title`, `subtitle`, `bgColor`
- `content`: `title`, `leftText`, `rightText[]`, `bgColor`, `textColor`

## Proposed Shared Component Architecture

### File Structure

```
apps/www/src/app/(app)/(internal)/pitch-deck/
├── _components/
│   ├── slide-content/
│   │   ├── index.ts              # Exports all content components
│   │   ├── title-slide.tsx       # TitleSlideContent
│   │   └── content-slide.tsx     # ContentSlideContent
│   ├── pitch-deck.tsx            # Uses SlideContent with motion wrappers
│   ├── capture-slide.tsx         # Uses SlideContent statically
│   └── download-button.tsx       # Triggers export
├── _lib/
│   └── export-slides.ts          # Uses ReactDOM to render CaptureSlide
└── page.tsx
```

### Shared Content Components

```typescript
// slide-content/title-slide.tsx
interface TitleSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "title" }>;
  variant?: 'responsive' | 'fixed';  // 'responsive' for web, 'fixed' for capture
}

export function TitleSlideContent({ slide, variant = 'responsive' }: TitleSlideContentProps) {
  const headingClass = variant === 'fixed'
    ? 'text-8xl'
    : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl';

  return (
    <>
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
        <h1 className={cn(
          "font-bold text-center text-white tracking-tight",
          headingClass
        )}>
          {slide.title}
        </h1>
      </div>
      <p className={cn(
        "relative text-center text-white/70",
        variant === 'fixed' ? 'text-lg' : 'text-xs sm:text-sm'
      )}>
        {slide.subtitle}
      </p>
    </>
  );
}
```

### Updated CaptureSlide

```typescript
// capture-slide.tsx
import { TitleSlideContent, ContentSlideContent } from './slide-content';

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

### Updated export-slides.ts with ReactDOM

```typescript
// export-slides.ts
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { PITCH_SLIDES } from '~/config/pitch-deck-data';
import { CaptureSlide } from '../_components/capture-slide';

export async function exportSlidesToZip(options: ExportOptions = {}): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();

  // Create off-screen container
  const container = document.createElement('div');
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

  // Create a wrapper for React rendering
  const renderContainer = document.createElement('div');
  container.appendChild(renderContainer);

  const root = createRoot(renderContainer);

  try {
    for (const [i, slide] of PITCH_SLIDES.entries()) {
      // Render slide using React
      flushSync(() => {
        root.render(<CaptureSlide slide={slide} width={width} height={height} />);
      });

      // Wait for fonts/images to load
      await new Promise((resolve) => setTimeout(resolve, 100));

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
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
      });

      const slideNumber = String(i + 1).padStart(2, '0');
      zip.file(`slide-${slideNumber}-${slide.id}.png`, blob);
    }

    // Clean up React root
    root.unmount();

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${filename}.zip`);
  } finally {
    document.body.removeChild(container);
  }
}
```

### Potential Issues with ReactDOM Approach

1. **Tailwind CSS in off-screen container**:
   - Tailwind classes need to already be in the document's stylesheets
   - The pitch-deck page's CSS is loaded, so classes should work
   - If issues occur, may need to force Tailwind to generate all required classes

2. **Font loading**:
   - The 100ms delay may not be enough for custom fonts
   - Consider using `document.fonts.ready` promise:
   ```typescript
   await document.fonts.ready;
   ```

3. **Background color parsing**:
   - `slide.bgColor` is in Tailwind format (`bg-[#8B3A3A]`)
   - The Tailwind class should work if CSS is loaded
   - Current raw HTML approach manually parses this

4. **Memory cleanup**:
   - Must call `root.unmount()` to prevent memory leaks
   - Current implementation cleans up in `finally` block

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:355-409` - SlideContent (animated)
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:274-353` - PitchSlide with motion wrapper
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:147-198` - GridSlideItem with scale wrapper
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/capture-slide.tsx:17-92` - CaptureSlide (static)
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:79-218` - Raw HTML generation
- `apps/www/src/config/pitch-deck-data.ts:1-98` - Slide data structure

## Architecture Documentation

### Current Architecture (Three Sources of Truth)

```
PITCH_SLIDES data
     │
     ├──▶ pitch-deck.tsx::SlideContent
     │         ↓
     │    motion.article wrapper (scroll animations)
     │
     ├──▶ capture-slide.tsx::TitleSlideContent/ContentSlideContent
     │         ↓
     │    CaptureSlide with forwardRef (UNUSED)
     │
     └──▶ export-slides.ts::createTitleSlideHTML/createContentSlideHTML
               ↓
          Raw HTML strings with inline styles
               ↓
          html2canvas capture
```

### Proposed Architecture (Single Source of Truth)

```
PITCH_SLIDES data
     │
     └──▶ slide-content/TitleSlideContent, ContentSlideContent
               │
               ├──▶ pitch-deck.tsx
               │         ↓
               │    motion.article wrapper + variant="responsive"
               │
               ├──▶ capture-slide.tsx
               │         ↓
               │    Static wrapper + variant="fixed"
               │
               └──▶ export-slides.ts
                         ↓
                    ReactDOM.createRoot + flushSync
                         ↓
                    html2canvas capture
```

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-01-28-pitch-deck-screenshot-export.md` - Original implementation plan that chose raw HTML approach
- `thoughts/shared/research/2026-01-28-pitch-deck-pdf-export.md` - Research on PDF alternatives, noting html2canvas limitations

## Open Questions

1. **Should we keep the raw HTML fallback?** The ReactDOM approach may have edge cases with CSS loading. Keeping raw HTML as a fallback could provide robustness.

2. **Variant prop vs separate components?** The `variant` prop approach is more DRY but adds complexity. Alternatively, keep separate `ResponsiveTitleSlide` and `FixedTitleSlide` components.

3. **Font loading reliability**: Is the 100ms delay sufficient, or should we use `document.fonts.ready`?

4. **Test coverage**: How to test off-screen React rendering? May need e2e tests with Playwright.
