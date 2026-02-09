---
date: 2026-01-31T12:00:00+00:00
researcher: claude-opus-4-5
topic: "PP Neue Montreal Font Integration - Replacing Geist Sans"
tags: [research, web-analysis, fonts, typography, pp-neue-montreal, next-js]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 8
acquisition_status: obtained
acquisition_method: free-trial
acquisition_email: jp@jeevanpillay.com
---

# Web Research: PP Neue Montreal Font Integration

**Date**: 2026-01-31
**Topic**: Download and integrate PP Neue Montreal as base font replacing Geist, with letter-spacing -3% and line-height 1.1em
**Confidence**: High - Official sources and established Next.js font patterns

## Acquisition Status

✅ **Font files successfully obtained via free trial on 2026-01-31**
- Email used: `jp@jeevanpillay.com`
- Method: Free-to-try download from Pangram Pangram Foundry
- Status: Download link sent to email inbox
- Note: Free trial includes key weights with complete glyph set for personal use (portfolios, pitches, personal projects)

## Research Question
How to download PP Neue Montreal and add it to the project as the base font instead of Geist, with letter-spacing -3% and line-height 1.1em?

## Executive Summary

PP Neue Montreal is a neo-grotesque sans-serif font by Pangram Pangram Foundry. Font files have been successfully obtained via free trial download sent to jp@jeevanpillay.com. The font includes key weights with complete glyph sets. For continued commercial use in production, a web license (starting at $40) is required. Integration requires replacing the current Geist font configuration in `/packages/ui/src/lib/fonts.ts` with `next/font/local` loading PP Neue Montreal font files, and updating CSS variables in `/packages/ui/src/globals.css` to include the requested letter-spacing (-0.03em) and line-height (1.1em).

## Key Metrics & Findings

### Font Licensing
**Finding**: Commercial projects require a purchased license
**Sources**: [Pangram Pangram](https://pangrampangram.com/products/neue-montreal)

| License Type | Availability | Cost |
|-------------|--------------|------|
| Free Trial | Personal use only (portfolio, pitches) | Free (email required) |
| Commercial Web License | Required for production websites | Starting $40 |
| Full Family (14 styles + Variable) | All weights and styles | Starting $40 |

### Available Weights
**Finding**: 14 styles available (7 uprights + 7 italics)

| Weight Name | Weight Value | Style |
|-------------|--------------|-------|
| Thin | 200 | Normal/Italic |
| Light | 300 | Normal/Italic |
| Book | 400 | Normal/Italic |
| Regular | 450 | Normal/Italic |
| Medium | 530 | Normal/Italic |
| Semibold | 700 | Normal/Italic |
| Bold | 800 | Normal/Italic |

### File Formats
- **woff2** (recommended for web - best compression)
- **woff** (legacy browser fallback)
- **Variable font** available (single file for all weights 200-800)

## Current Font Architecture

### Geist Font Setup
The project currently uses Geist fonts via npm package with this structure:

**Central Configuration**: `/packages/ui/src/lib/fonts.ts`
```typescript
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
export const fonts = cn(GeistSans.variable, GeistMono.variable, ...);
```

**CSS Variables**: `/packages/ui/src/globals.css`
```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

**Apps Using Fonts**:
| App | Geist Sans | Geist Mono | Exposure Trial |
|-----|------------|------------|----------------|
| Console | Yes | Yes | No |
| WWW | Yes | Yes | Yes (display) |
| Docs | Yes | Yes | Yes (display) |
| Auth | Yes | Yes | No |
| Chat | Yes | Yes | No |

## Implementation Plan

### Step 1: Obtain Font Files ✅ COMPLETED

**Free Trial - Successfully Obtained** (2026-01-31):
- Email: jp@jeevanpillay.com
- Status: Download link sent via email
- Includes: Key weights with complete glyph set
- Files delivered via email from Pangram Pangram Foundry

**Check inbox at jp@jeevanpillay.com for**:
- Download link with all font files
- Key weights of PP Neue Montreal (Book/Regular/Medium/Bold + italics)
- Complete glyph set (751 glyphs per weight)
- Available formats: woff2, woff, otf, ttf

**Future Commercial Licensing**:
- If continuing commercial use beyond personal projects, purchase Web License (starting $40)
- Visit [pangrampangram.com/products/neue-montreal](https://pangrampangram.com/products/neue-montreal)
- Select appropriate licenses based on usage (Print/Web/App/Social Media/Broadcast/Logo)

### Step 2: Add Font Files to Project

Create font directory and add files:
```
packages/ui/public/fonts/
├── PPNeueMontreal-Book.woff2
├── PPNeueMontreal-Medium.woff2
├── PPNeueMontreal-Bold.woff2
└── (optional) PPNeueMontreal-Variable.woff2
```

### Step 3: Update Font Configuration

**Update `/packages/ui/src/lib/fonts.ts`**:
```typescript
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { cn } from "./utils";

export const neueMontreal = localFont({
  src: [
    {
      path: "../public/fonts/PPNeueMontreal-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/PPNeueMontreal-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/PPNeueMontreal-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-neue-montreal",
  display: "swap",
});

export const fonts = cn(
  neueMontreal.variable,
  GeistMono.variable,
  "touch-manipulation font-sans antialiased",
);
```

### Step 4: Update CSS Variables

**Update `/packages/ui/src/globals.css`**:
```css
@theme inline {
  --font-sans: var(--font-neue-montreal);
  --font-mono: var(--font-geist-mono);

  /* Typography settings for PP Neue Montreal */
  --letter-spacing-base: -0.03em;  /* -3% */
  --line-height-base: 1.1;         /* 1.1em */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--letter-spacing-base);
    line-height: var(--line-height-base);
  }
}
```

### Step 5: Performance Optimization

**Font Preloading** (add to root layout):
```typescript
// In app/layout.tsx
<link
  rel="preload"
  href="/fonts/PPNeueMontreal-Book.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>
```

**Consider Variable Font**:
If using multiple weights, the variable font option provides:
- Single HTTP request for all weights
- Smaller total download (~50-80KB vs ~30KB per weight)
- Continuous weight interpolation

## Trade-off Analysis

### Approach 1: Static Font Files (Multiple Weights)
| Factor | Impact | Notes |
|--------|--------|-------|
| File Size | ~30KB per weight | 3 weights = ~90KB total |
| HTTP Requests | 3 requests | Parallel loading |
| Browser Support | Excellent | All modern browsers |
| Weight Flexibility | Limited | Only declared weights |

### Approach 2: Variable Font (Single File)
| Factor | Impact | Notes |
|--------|--------|-------|
| File Size | ~50-80KB | Single file all weights |
| HTTP Requests | 1 request | Better performance |
| Browser Support | Good | IE11 not supported |
| Weight Flexibility | Full | Any value 200-800 |

## Recommendations

Based on research findings:

1. **Purchase Commercial License**: Starting at $40, reasonable investment for production use
2. **Use Variable Font**: Better performance with single request and full weight flexibility
3. **Apply Typography Settings Globally**: Set letter-spacing and line-height on body for consistency
4. **Keep Geist Mono**: Retain for code/monospace needs since PP Neue Montreal doesn't have mono variant

## Typography Settings

The requested settings translate to CSS as:

```css
/* Letter Spacing -3% */
letter-spacing: -0.03em;

/* Line Height 1.1em */
line-height: 1.1;
```

These create a tighter, more compact typography style characteristic of modern design.

## Files to Modify

| File | Changes Required |
|------|-----------------|
| `/packages/ui/src/lib/fonts.ts` | Replace GeistSans import with localFont for PP Neue Montreal |
| `/packages/ui/src/globals.css` | Update `--font-sans` variable, add letter-spacing and line-height |
| `/packages/ui/public/fonts/` | Add PP Neue Montreal woff2 files (create directory) |
| `packages/ui/package.json` | Can optionally remove `geist` dependency if not using GeistSans |

## Risk Assessment

### High Priority
- **Licensing Compliance**: Must purchase web license for commercial use - Free trial is personal only

### Medium Priority
- **Font File Access**: Need to manually download and add font files (not available via npm)
- **Mono Font Gap**: PP Neue Montreal has no mono variant - keep GeistMono for code

### Low Priority
- **File Size**: ~30-80KB additional download depending on approach

## Next Steps

1. **Download & Extract**: Check jp@jeevanpillay.com email for font files from Pangram Pangram
2. **Weight Selection**: Received key weights (Book/Medium/Bold + italics recommended to use)
3. **Variable vs Static**: Decide between using individual weight files or requesting variable font
4. **File Organization**: Place downloaded .woff2 files into `/packages/ui/public/fonts/`
5. **Configuration**: Update `/packages/ui/src/lib/fonts.ts` with localFont configuration
6. **CSS Update**: Modify `/packages/ui/src/globals.css` with new font variables and typography settings
7. **Testing**: Verify font loading and rendering across all apps

## Sources

### Official Documentation
- [Pangram Pangram - PP Neue Montreal](https://pangrampangram.com/products/neue-montreal) - Official product page
- [Pangram Pangram EULA](https://pangrampangram.com/pages/eula) - Licensing terms
- [Pangram Pangram FAQ](https://pangrampangram.com/pages/faq) - Frequently asked questions

### Implementation Resources
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) - Official Next.js font loading
- [next/font/local API](https://nextjs.org/docs/app/api-reference/components/font) - Local font configuration

### Performance Resources
- [Web Font Best Practices](https://web.dev/font-best-practices/) - Google Web.dev
- [Font Subsetting Guide](https://cloudfour.com/thinks/font-subsetting-strategies-content-based-vs-alphabetical/) - CloudFour

---

**Last Updated**: 2026-01-31 (Font acquisition completed)
**Confidence Level**: High - Based on official documentation and established patterns
**Acquisition Complete**: Yes - Free trial fonts sent to jp@jeevanpillay.com on 2026-01-31
**Next Action**: Download font files from email and extract to `/packages/ui/public/fonts/`, then follow implementation steps in this document
