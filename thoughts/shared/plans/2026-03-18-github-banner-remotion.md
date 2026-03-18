# GitHub Banner — Remotion Still Composition

## Overview

Create a minimal GitHub banner (social preview / README hero image) in `packages/console-remotion/`. Black background, centered tagline "Superintelligence layer for founders". No logo mark, no mono font — just clean sans-serif text on black.

## Current State Analysis

- **Twitter banner exists** at `src/compositions/twitter-banner/` — 1500x500, currently renders a blank black `AbsoluteFill` (all content commented out)
- **Fonts available**: Geist Medium (500) in `public/fonts/`, loaded via `@remotion/fonts`
- **Render pipeline**: `render-logos.ts` already renders all stills (logos + Twitter banner) in a single bundle pass
- **Root.tsx** registers all compositions as `<Still>` or `<Composition>`

### Key Discoveries:
- Font loading pattern: `delayRender`/`continueRender` with `ensureFontsLoaded()` — see `landing-hero.tsx:30-39`
- Tailwind CSS v4 is wired via custom webpack override (`webpack-override.ts`)
- Twitter banner already has a `fonts.ts` that loads PP Neue Montreal Bold, Geist Medium, and PP Supply Sans Regular

## Desired End State

A new `github-banner` Still composition that renders a PNG:
- **Dimensions**: 1280×640 (2:1 aspect ratio — GitHub social preview standard)
- **Render scale**: 2 (outputs 2560×1280 for high-DPI, scales down crisply to 830-1012px display width)
- **Design**: Black background, white Geist sans-serif text "Superintelligence layer for founders" dead center
- **Output**: `github-banner.png` in `out/logos/`
- **File size**: Under 1MB (black + white minimal design will be well under)

### Verification:
- Composition visible and renders correctly in Remotion Studio (`pnpm studio`)
- `pnpm render:logos` outputs `github-banner.png`
- Image displays correctly when embedded in a README `![banner](url)`

## What We're NOT Doing

- No Lissajous logo mark — text only
- No mono font — sans-serif (Geist) only
- Not animating this — it's a `Still`, not a `Composition`
- Not changing the existing Twitter banner
- Not adding new fonts — using Geist Medium already available
- Not creating a separate render script — reusing `render-logos.ts`

## Implementation Approach

Single phase — add a new Still composition following the exact pattern of the existing Twitter banner, but with actual rendered content.

## Phase 1: GitHub Banner Composition

### Overview
Create the composition, register it, and wire it into the render pipeline.

### Changes Required:

#### 1. New composition directory
**File**: `packages/console-remotion/src/compositions/github-banner/index.tsx`

```tsx
export { GitHubBanner } from "./github-banner";

export const GITHUB_BANNER_CONFIG = {
  id: "github-banner",
  width: 1280,
  height: 640,
  filename: "github-banner.png",
} as const;
```

#### 2. Banner component
**File**: `packages/console-remotion/src/compositions/github-banner/github-banner.tsx`

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// ── Font loading ───────────────────────────────────────────────────────
let fontsLoaded = false;
const ensureFontsLoaded = async () => {
  if (fontsLoaded) return;
  await loadFont({
    family: "Geist",
    url: staticFile("fonts/Geist-Medium.woff2"),
    weight: "500",
  });
  fontsLoaded = true;
};

// ── Component ──────────────────────────────────────────────────────────
export const GitHubBanner: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
          fontWeight: 500,
          fontSize: 48,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          textAlign: "center",
        }}
      >
        Superintelligence layer for founders
      </div>
    </AbsoluteFill>
  );
};
```

#### 3. Register in Root.tsx
**File**: `packages/console-remotion/src/Root.tsx`

Add import and `<Still>` registration alongside the existing Twitter banner:

```tsx
import {
  GITHUB_BANNER_CONFIG,
  GitHubBanner,
} from "./compositions/github-banner";

// Inside RemotionRoot, after the TwitterBanner Still:
<Still
  component={GitHubBanner}
  height={GITHUB_BANNER_CONFIG.height}
  id={GITHUB_BANNER_CONFIG.id}
  width={GITHUB_BANNER_CONFIG.width}
/>
```

#### 4. Wire into render pipeline
**File**: `packages/console-remotion/src/render-logos.ts`

Add import and render step after the Twitter banner render block:

```tsx
import { GITHUB_BANNER_CONFIG } from "./compositions/github-banner";

// After Twitter banner render (after line 94):
console.log(
  `Rendering ${GITHUB_BANNER_CONFIG.id} (${GITHUB_BANNER_CONFIG.width}×${GITHUB_BANNER_CONFIG.height})...`
);
const githubComp = await selectComposition({
  serveUrl: bundled,
  id: GITHUB_BANNER_CONFIG.id,
});
await renderStill({
  composition: githubComp,
  serveUrl: bundled,
  output: path.join(outputDir, GITHUB_BANNER_CONFIG.filename),
  imageFormat: "png",
  scale: 2,
});
console.log(`  → ${GITHUB_BANNER_CONFIG.filename}`);
```

Note: `scale: 2` outputs a 2560×1280 PNG for high-DPI while keeping the composition coordinates at 1280×640.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Remotion Studio launches and shows the composition: `cd packages/console-remotion && pnpm studio`

#### Manual Verification:
- [ ] Banner renders correctly in Remotion Studio — black background, white text centered
- [ ] `cd packages/console-remotion && pnpm render:logos` outputs `out/logos/github-banner.png`
- [ ] Output PNG is under 1MB
- [ ] Image looks crisp when embedded in a markdown file at ~960px display width
- [ ] Text is readable, spacing feels balanced

**Implementation Note**: This is a single-phase plan. After all automated verification passes, render the banner and visually confirm the output before considering it complete.

## Design Notes

- **Font**: Geist Medium 500 (sans-serif) — matches the existing brand system (`styles.css:6`)
- **No logo mark** — text only, maximum minimalism
- **No mono font** — clean sans-serif only
- **Colors**: Pure black `#000000` background, pure white `#ffffff` text
- **Font size**: 48px at 1280px width = ~3.75% of width, readable when scaled down to 830-1012px
- **Letter spacing**: `-0.02em` for tighter tracking at display sizes

## References

- Existing Twitter banner: `packages/console-remotion/src/compositions/twitter-banner/`
- Font loading pattern: `packages/console-remotion/src/compositions/landing-hero/shared/fonts.ts`
- Render pipeline: `packages/console-remotion/src/render-logos.ts`
