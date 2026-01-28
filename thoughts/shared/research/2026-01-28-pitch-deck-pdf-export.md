---
date: 2026-01-28T03:56:31Z
researcher: Claude
git_commit: ff65906b78caead1463061e06a84630bc364f7a6
branch: feat/pitch-deck-page
repository: lightfast
topic: "PDF Export for Pitch Deck - Library Options and CSS Preservation"
tags: [research, codebase, pitch-deck, pdf-generation, html-to-pdf, css-preservation]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: PDF Export for Pitch Deck - Library Options and CSS Preservation

**Date**: 2026-01-28T03:56:31Z
**Researcher**: Claude
**Git Commit**: ff65906b78caead1463061e06a84630bc364f7a6
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question

How to add a PDF download button to the pitch deck page that retains CSS + HTML styling correctly?

## Summary

The pitch deck at `apps/www/src/app/(app)/(internal)/pitch-deck/` uses Framer Motion scroll animations, Tailwind CSS (including custom gradients, backdrop blur, shadows), and a 16:9 aspect ratio slide design. The codebase currently has **no PDF generation capabilities** - no libraries installed, no print stylesheets, and no export functionality.

For generating a PDF that preserves CSS styling, **server-side rendering with Puppeteer or Playwright** is the recommended approach. Both provide excellent CSS preservation for Tailwind classes, gradients, and shadows. The main caveat is that **backdrop-filter: blur()** effects are not supported in any PDF generator and would need workarounds.

## Detailed Findings

### Current Pitch Deck Implementation

The pitch deck component structure:

| File | Purpose |
|------|---------|
| `page.tsx:14-20` | Entry point, renders `<PitchDeck />` |
| `_components/pitch-deck.tsx:16-123` | Main presentation with scroll-driven animations |
| `_components/pitch-deck-context.tsx` | State management for grid view and preface |
| `_components/pitch-deck-layout-content.tsx:10-75` | Layout with collapsible preface sidebar |
| `_components/pitch-deck-navbar.tsx:21-48` | Navigation menu |
| `~/config/pitch-deck-data.ts:1-98` | 8 slides with title/content types |

**Key styling features used:**
- Tailwind CSS utility classes throughout
- Custom background colors (`bg-[#8B3A3A]`, `bg-[#F5F5F0]`)
- Grid patterns with CSS linear-gradient (lines 364-368)
- Backdrop blur effects (`backdrop-blur-sm` on line 133)
- Shadow effects (`shadow-2xl`, `shadow-lg`)
- 16:9 aspect ratio (`aspect-[16/9]` on lines 82, 179, 343)
- Framer Motion animations (would capture as static snapshots)

### Existing Codebase Patterns

**No PDF generation exists.** However, there are relevant patterns:

1. **Download utility** (`@repo/ui/components/ai-elements/code-block.tsx:27-38`):
```typescript
const save = (filename: string, data: string, mimeType = "text/plain") => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

2. **Playwright already installed** (`packages/ai-tools/package.json:26-30`):
```json
{
  "playwright": "^1.54.1",
  "playwright-core": "^1.54.1"
}
```
Used for Browserbase/Stagehand browser automation, not PDF generation.

### PDF Generation Approaches

#### Option 1: Puppeteer (Server-Side) - RECOMMENDED

**How it works**: Launches headless Chromium, renders the page, generates PDF via Chrome DevTools Protocol.

**CSS Preservation**: Excellent - uses real Chrome rendering engine
- Tailwind classes: Perfect support
- Gradients: Works with `printBackground: true`
- Shadows: Works with `-webkit-print-color-adjust: exact`
- Backdrop blur: **NOT SUPPORTED** (stripped in all PDF generators)

**Pros**:
- Vector-based PDF with selectable text
- Small file size (~200-500KB for 8 slides)
- Automatic multi-page handling
- Best CSS fidelity

**Cons**:
- Large dependency (~300MB with Chromium)
- Requires serverless setup (use `@sparticuz/chromium` for Vercel)
- 1-3 second startup overhead

**Implementation for 16:9 slides**:
```typescript
// apps/www/src/app/api/pitch-deck/pdf/route.ts
import puppeteer from 'puppeteer';

export async function GET() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://lightfast.ai/pitch-deck', {
    waitUntil: 'networkidle0',
  });

  // Each slide as separate page
  const pdf = await page.pdf({
    width: '1920px',
    height: '1080px',
    printBackground: true,
    preferCSSPageSize: false,
  });

  await browser.close();

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="lightfast-pitch-deck.pdf"',
    },
  });
}
```

#### Option 2: Playwright (Server-Side)

**Same quality as Puppeteer** with better TypeScript support and more active maintenance.

Already partially installed in the monorepo (`packages/ai-tools`), but not configured for PDF generation.

**Pros over Puppeteer**:
- Better API design
- First-class TypeScript support
- More active development

**Implementation**:
```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.pdf({ path: 'deck.pdf', width: '1920px', height: '1080px', printBackground: true });
```

#### Option 3: Browser Print API (Client-Side)

**How it works**: Uses native `window.print()` with CSS `@media print` rules.

**Pros**:
- Zero dependencies
- Best CSS preservation (native browser)
- Instant performance

**Cons**:
- Requires user interaction (print dialog)
- Cannot customize filename programmatically
- User must select "Save as PDF"

**Implementation**:
```css
/* Add to pitch deck styles */
@media print {
  @page {
    size: 1920px 1080px;
    margin: 0;
  }

  .sticky { position: relative !important; }
  nav, .no-print { display: none !important; }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
```

```typescript
// Download button
<button onClick={() => window.print()}>
  Download PDF
</button>
```

#### Option 4: html2canvas + jsPDF (Client-Side)

**How it works**: Captures HTML as canvas image, embeds in PDF.

**Pros**:
- No server required
- Simple API

**Cons**:
- Image-based (no text selection)
- Large file size (5-8MB for 8 slides)
- Memory intensive (can crash browser)
- Performance: 5-30 seconds for multi-page

**NOT RECOMMENDED** for this use case due to file size and quality concerns.

### CSS Preservation Specifics

| Feature | Puppeteer/Playwright | Browser Print | html2canvas |
|---------|---------------------|---------------|-------------|
| Tailwind classes | Perfect | Excellent | Good (compiled) |
| Custom gradients | Yes (`printBackground`) | Yes | Yes |
| box-shadow | Yes | Yes | Yes |
| backdrop-blur | **NO** | **NO** | **NO** |
| Custom fonts | Yes (wait for load) | Yes | Yes |
| 16:9 aspect ratio | Yes | Yes | Yes |
| Framer Motion | Static snapshot | Static snapshot | Static snapshot |

**Critical: Backdrop blur workaround needed**

The pitch deck uses `backdrop-blur-sm` on line 133 for the grid view overlay. Options:
1. Replace with solid semi-transparent background for PDF
2. Pre-render blurred background as image
3. Accept visual difference in PDF

### Recommended Approach

**For the pitch deck specifically:**

1. **Primary**: Puppeteer server-side API route
   - Best quality/size ratio
   - Programmatic download (no print dialog)
   - Can be triggered from a download button

2. **Fallback**: Browser print API
   - Add print stylesheet as enhancement
   - Works without server infrastructure

**Button placement suggestion**: Add to `PitchDeckNavbar` component alongside existing menu.

### Implementation Considerations

1. **Vercel deployment**: Use `@sparticuz/chromium` package for serverless Puppeteer
2. **Slide pagination**: Need to create separate "print version" that renders all slides statically
3. **Animation handling**: Disable Framer Motion for PDF capture
4. **Preface sidebar**: Should probably be excluded from PDF or rendered as cover page

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx:14-20` - Entry point
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:16-123` - Main component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:133` - Backdrop blur usage
- `apps/www/src/config/pitch-deck-data.ts:1-98` - Slide data (8 slides)
- `packages/ui/src/components/ai-elements/code-block.tsx:27-38` - Download utility pattern
- `packages/ai-tools/package.json:26-30` - Existing Playwright installation

## Architecture Documentation

The pitch deck uses a scroll-driven animation pattern where:
1. Container height is `(slides.length + 1) * 100vh` for scroll space
2. Slides are positioned absolutely with `sticky` viewport
3. Scroll progress drives transforms (y, scale, opacity, zIndex)
4. Grid view triggers at 92% scroll progress

For PDF generation, this architecture requires:
- Static rendering of each slide sequentially
- Bypassing scroll-based transforms
- Direct access to slide data from `PITCH_SLIDES` config

## Open Questions

1. Should the founder preface (left sidebar) be included in the PDF?
2. What filename format is preferred? (e.g., `lightfast-pitch-deck-2026.pdf`)
3. Should PDF generation happen on-demand or be pre-generated/cached?
4. Is the backdrop blur effect on grid view critical for PDF, or acceptable to remove?
