# Remotion Architecture Overhaul — Manifest-Driven Brand Asset Pipeline

## Overview

Rearchitect `packages/app-remotion` from a collection of ad-hoc render scripts into a **manifest-driven brand asset pipeline**. A single composition manifest defines every asset — its type, dimensions, component, render profile, and output destinations. Root.tsx registration, rendering, and file distribution are all derived from this manifest. Additionally, consolidate the 4× duplicated Lissajous math into a single shared module in `@repo/ui`, and enforce all Remotion imports through `@vendor/remotion`.

## Current State Analysis

### Architecture
- 4 composition types: `landing-hero` (video), `logo` (10 still variants), `twitter-banner` (still), `github-banner` (still)
- 3 separate render scripts (`render.ts`, `render-logos.ts`, `render-lissajous.ts`) each bundling independently
- `Root.tsx` manually registers all compositions with hardcoded configs
- Outputs go to 3 different places: `apps/www/public/images/`, `out/logos/` (then manually copied), `packages/ui/src/lib/`

### Problems
1. **No single source of truth** — composition config scattered across `Root.tsx`, `LOGO_VARIANTS`, `TWITTER_BANNER_CONFIG`, `GITHUB_BANNER_CONFIG`, render profiles, and render scripts
2. **Manual copy step** — favicons/banners rendered to `out/logos/` must be manually copied to `apps/app/public/` and `apps/www/public/`
3. **Lissajous math duplicated 4×** — `logo.tsx`, `render-lissajous.ts`, `twitter-banner.tsx` (commented), `packages/og/src/brand/logo.ts`
4. **Mixed Remotion imports** — `@vendor/remotion` exists but only `logo.tsx` uses it; 20+ direct imports from `remotion`/`@remotion/*`
5. **Stale references** — root `package.json` points to non-existent `render:gif` script; `watch.ts` logs say "GIF" but renders WebM
6. **`render.ts` and `render-logos.ts` bundle separately** — two full webpack bundles of the same entry point

## Desired End State

```
packages/app-remotion/
  src/
    manifest.ts           ← Single source of truth for ALL compositions
    Root.tsx              ← Derives registration from manifest (no hardcoded configs)
    render.ts             ← Single unified render script: bundle once → render all → distribute
    watch.ts              ← Updated to use unified render
    webpack-override.ts   ← Unchanged
    styles.css            ← Unchanged
    index.ts              ← Unchanged
    compositions/
      landing-hero/       ← Unchanged (internal structure)
      logo/
        logo.tsx          ← Imports lissajous from @repo/ui/lib/brand
        index.tsx         ← Exports component only (config moved to manifest)
      twitter-banner/     ← Unchanged (intentionally black)
      github-banner/      ← Unchanged

packages/ui/src/lib/brand/
  lissajous.ts            ← Canonical Lissajous math (curves, paths, constants)
  index.ts                ← Public API

vendor/remotion/
  src/
    index.ts              ← Extended: + Still, loadFont, staticFile, type SpringConfig, etc.
    renderer.ts           ← Extended: + renderStill, type RenderMediaOptions
    bundler.ts            ← Extended: + type WebpackOverrideFn
```

### How to verify:
1. `pnpm --filter @repo/app-remotion render:all` produces all assets and distributes them to correct destinations
2. `pnpm typecheck` passes — no broken imports
3. Zero direct `from "remotion"` or `from "@remotion/*"` imports in `packages/app-remotion/src/`
4. Zero Lissajous math implementations outside `packages/ui/src/lib/brand/lissajous.ts`
5. Adding a new composition = add one entry to `manifest.ts` + create the component file

## What We're NOT Doing

- **Not changing any composition visuals** — all renders produce identical output
- **Not adding CI automation** — renders remain manual (no GitHub Actions)
- **Not refactoring the isometric math library** (`iso/`) — it's internal to landing-hero and well-structured
- **Not touching the Remotion version** — staying on `^4.0.434`
- **Not modifying consuming apps** (layout.tsx, manifest.ts, etc.) — they already reference the correct filenames

## Implementation Approach

5 phases, each independently verifiable. Each phase leaves the project in a working state.

---

## Phase 1: Brand Math Consolidation

### Overview
Extract the canonical Lissajous math into `@repo/ui/src/lib/brand/` and replace all 4 duplicated implementations.

### Changes Required:

#### 1. Create `packages/ui/src/lib/brand/lissajous.ts`
**File**: `packages/ui/src/lib/brand/lissajous.ts` (new)
**Changes**: Canonical implementation combining the best of all 4 copies

```ts
// ── Lissajous Curve Mathematics ─────────────────────────────────────
// Canonical source for the Lightfast logo curve and all derived patterns.
// Parametric form: x(t) = sin(a·t + δ), y(t) = sin(b·t)

/** Default logo curve parameters: a=3, b=2, δ=π/2 */
export const LOGO_CURVE = { a: 3, b: 2, delta: Math.PI / 2 } as const;

/** All 9 footer/brand patterns */
export const LISSAJOUS_PATTERNS = [
  { name: "circle", a: 1, b: 1, delta: Math.PI / 2 },
  { name: "figure8", a: 1, b: 2, delta: Math.PI / 2 },
  { name: "pretzel", a: 3, b: 2, delta: Math.PI / 2 },
  { name: "bow", a: 2, b: 3, delta: Math.PI / 2 },
  { name: "knot", a: 3, b: 4, delta: Math.PI / 2 },
  { name: "star", a: 5, b: 4, delta: Math.PI / 2 },
  { name: "wave", a: 1, b: 3, delta: Math.PI / 4 },
  { name: "infinity", a: 2, b: 1, delta: Math.PI / 2 },
  { name: "clover", a: 3, b: 1, delta: Math.PI / 2 },
] as const;

/**
 * Generate an SVG path for a Lissajous curve centered in a square canvas.
 * Used by: Logo component (Remotion), OG images (Satori), footer (React).
 *
 * @param size - Canvas width/height in px
 * @param padding - Fraction of size reserved as padding (0–0.5)
 * @param a - x-frequency (default: LOGO_CURVE.a)
 * @param b - y-frequency (default: LOGO_CURVE.b)
 * @param delta - phase shift (default: LOGO_CURVE.delta)
 * @param steps - number of sample points (default: 512)
 */
export function lissajousPath(
  size: number,
  padding: number,
  a = LOGO_CURVE.a,
  b = LOGO_CURVE.b,
  delta = LOGO_CURVE.delta,
  steps = 512,
): string {
  const center = size / 2;
  const radius = size * (0.5 - padding);

  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = center + radius * Math.sin(a * t + delta);
    const y = center + radius * Math.sin(b * t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * Generate an SVG path for a Lissajous curve in a normalized viewBox (0–100).
 * Used by: footer patterns, render-lissajous codegen.
 */
export function lissajousPathNormalized(
  a: number,
  b: number,
  delta: number,
  points = 500,
  padding = 10,
): string {
  const size = 100 - padding * 2;
  const pts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    const x = padding + ((Math.sin(a * t + delta) + 1) / 2) * size;
    const y = padding + ((Math.sin(b * t) + 1) / 2) * size;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

/**
 * Generate raw [x,y] points for a Lissajous curve.
 * Used by: landing-hero logo animation (needs individual points for trail effect).
 */
export function lissajousPoints(
  a = LOGO_CURVE.a,
  b = LOGO_CURVE.b,
  delta = LOGO_CURVE.delta,
  steps = 512,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    points.push([Math.sin(a * t + delta), Math.sin(b * t)]);
  }
  return points;
}
```

#### 2. Create `packages/ui/src/lib/brand/index.ts`
**File**: `packages/ui/src/lib/brand/index.ts` (new)

```ts
export {
  LISSAJOUS_PATTERNS,
  LOGO_CURVE,
  lissajousPath,
  lissajousPathNormalized,
  lissajousPoints,
} from "./lissajous";
```

#### 3. Update `packages/app-remotion/src/compositions/logo/logo.tsx`
**File**: `packages/app-remotion/src/compositions/logo/logo.tsx`
**Changes**: Remove inline `lissajousPath` function, import from `@repo/ui/lib/brand`

Replace the local constants (`A`, `B`, `DELTA`, `STEPS`) and `lissajousPath` function (lines 5–27) with:
```ts
import { lissajousPath } from "@repo/ui/lib/brand";
```

Update the `useMemo` call to use the imported function directly (same signature).

#### 4. Update `packages/og/src/brand/logo.ts`
**File**: `packages/og/src/brand/logo.ts`
**Changes**: Replace entire file with re-export

```ts
export { lissajousPath } from "@repo/ui/lib/brand";
```

#### 5. Update `packages/app-remotion/src/render-lissajous.ts`
**File**: `packages/app-remotion/src/render-lissajous.ts`
**Changes**: Replace inline `FOOTER_PATTERNS` and `computePath` with imports from `@repo/ui/lib/brand`

```ts
import { LISSAJOUS_PATTERNS, lissajousPathNormalized } from "@repo/ui/lib/brand";
```

Replace `computePath(a, b, delta)` calls with `lissajousPathNormalized(a, b, delta)`.

#### 6. Update `packages/app-remotion/src/compositions/landing-hero/sections/logo-animation.tsx`
**File**: `packages/app-remotion/src/compositions/landing-hero/sections/logo-animation.tsx`
**Changes**: Replace inline point generation with `lissajousPoints` from brand lib

Replace the module-level Lissajous point computation with:
```ts
import { lissajousPoints as computeLissajousPoints } from "@repo/ui/lib/brand";
```

#### 7. Delete auto-generated `packages/ui/src/lib/lissajous-paths.ts`
**File**: `packages/ui/src/lib/lissajous-paths.ts`
**Changes**: Delete — the `render-lissajous.ts` script will now generate from the brand lib, and the footer can import `LISSAJOUS_PATTERNS` + `lissajousPathNormalized` directly instead of using pre-baked paths.

**Wait** — the footer (`apps/www/src/app/(app)/_components/app-footer.tsx`) imports `LISSAJOUS_PATHS` from this file. We need to either:
- (a) Keep `render-lissajous.ts` generating this file but using the brand lib math, or
- (b) Update the footer to compute paths at import time from `lissajousPathNormalized`

Option (b) is cleaner — the paths are trivially fast to compute (9 patterns × 500 points = <1ms). Update the footer to:
```ts
import { LISSAJOUS_PATTERNS, lissajousPathNormalized } from "@repo/ui/lib/brand";

const LISSAJOUS_PATHS = LISSAJOUS_PATTERNS.map(({ name, a, b, delta }) => ({
  name,
  d: lissajousPathNormalized(a, b, delta),
}));
```

Then delete `packages/ui/src/lib/lissajous-paths.ts` and remove the `render:lissajous` script entirely.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] No duplicate Lissajous implementations: `grep -r "Math.sin(a \* t" packages/ vendor/ --include="*.ts" --include="*.tsx"` returns only `packages/ui/src/lib/brand/lissajous.ts`
- [ ] `pnpm --filter @repo/app-remotion render:logos` produces identical output files (byte-compare a few PNGs)
- [ ] `pnpm --filter @repo/app-remotion render:webm` completes successfully

#### Manual Verification:
- [ ] Landing hero animation looks identical in Remotion Studio (`pnpm remotion:studio`)
- [ ] Footer Lissajous patterns render correctly on the www site
- [ ] OG images generate correctly with the shared lissajousPath

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 2: Enforce @vendor/remotion

### Overview
Extend `@vendor/remotion` to re-export all Remotion APIs used across the codebase, then update every import in `packages/app-remotion/src/` to go through the vendor layer.

### Changes Required:

#### 1. Extend `vendor/remotion/src/index.ts`
**File**: `vendor/remotion/src/index.ts`
**Changes**: Add missing re-exports used by compositions

```ts
export {
  AbsoluteFill,
  Composition,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  registerRoot,
  Sequence,
  spring,
  staticFile,
  Still,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type { SpringConfig } from "remotion";
```

Added: `Still` (used by Root.tsx), `type SpringConfig` (used by timing.ts).

#### 2. Create `vendor/remotion/src/fonts.ts`
**File**: `vendor/remotion/src/fonts.ts` (new)
**Changes**: New export path for `@remotion/fonts`

```ts
export { loadFont } from "@remotion/fonts";
```

#### 3. Update `vendor/remotion/package.json`
**File**: `vendor/remotion/package.json`
**Changes**: Add `./fonts` export path, add `@remotion/fonts` dependency

Add to `exports`:
```json
"./fonts": {
  "types": "./dist/src/fonts.d.ts",
  "default": "./src/fonts.ts"
}
```

Add to `dependencies`:
```json
"@remotion/fonts": "^4.0.434"
```

#### 4. Extend `vendor/remotion/src/renderer.ts`
**File**: `vendor/remotion/src/renderer.ts`
**Changes**: Add `renderStill` and type exports

```ts
export { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
export type { RenderMediaOptions } from "@remotion/renderer";
```

#### 5. Extend `vendor/remotion/src/bundler.ts`
**File**: `vendor/remotion/src/bundler.ts`
**Changes**: Add type export

```ts
export { bundle } from "@remotion/bundler";
export type { WebpackOverrideFn } from "@remotion/bundler";
```

#### 6. Update all composition imports
**Files**: Every `.ts`/`.tsx` file in `packages/app-remotion/src/` that imports from `"remotion"` or `"@remotion/*"`

| File | `from "remotion"` → | `from "@remotion/*"` → |
|------|---------------------|------------------------|
| `index.ts` | `@vendor/remotion` | — |
| `Root.tsx` | `@vendor/remotion` | — |
| `render.ts` | — | `@vendor/remotion/bundler`, `@vendor/remotion/renderer` |
| `render-logos.ts` | — | `@vendor/remotion/bundler`, `@vendor/remotion/renderer` |
| `webpack-override.ts` | — | `@vendor/remotion/bundler` (type) |
| `landing-hero/landing-hero.tsx` | `@vendor/remotion` | — |
| `landing-hero/index.tsx` | — | `@vendor/remotion/renderer` (type) |
| `landing-hero/shared/timing.ts` | `@vendor/remotion` (type) | — |
| `landing-hero/shared/fonts.ts` | `@vendor/remotion` + `@vendor/remotion/fonts` | — |
| `landing-hero/shared/grid-lines.tsx` | `@vendor/remotion` | — |
| `landing-hero/shared/isometric-card.tsx` | `@vendor/remotion` | — |
| `landing-hero/sections/stream-events.tsx` | `@vendor/remotion` | — |
| `landing-hero/sections/ingested-data.tsx` | `@vendor/remotion` | — |
| `landing-hero/sections/logo-animation.tsx` | `@vendor/remotion` | — |
| `github-banner/github-banner.tsx` | `@vendor/remotion` + `@vendor/remotion/fonts` | — |
| `twitter-banner/twitter-banner.tsx` | `@vendor/remotion` | — |
| `twitter-banner/fonts.ts` | `@vendor/remotion` + `@vendor/remotion/fonts` | — |

#### 7. Remove direct Remotion deps from app-remotion
**File**: `packages/app-remotion/package.json`
**Changes**: Remove `remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`, `@remotion/fonts` from `dependencies`. They're provided transitively through `@vendor/remotion`. Keep only `@vendor/remotion: "workspace:*"`.

**Note**: `@remotion/cli` is needed for `npx remotion studio` — keep it as a `devDependency` only if the CLI doesn't resolve through the vendor's transitive deps. Test this.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Zero direct Remotion imports: `grep -rE 'from "(remotion|@remotion/)' packages/app-remotion/src/ --include="*.ts" --include="*.tsx"` returns empty
- [ ] `pnpm --filter @repo/app-remotion render:webm` succeeds
- [ ] `pnpm --filter @repo/app-remotion render:logos` succeeds
- [ ] Remotion Studio opens: `pnpm remotion:studio`

#### Manual Verification:
- [ ] Landing hero renders identically in Studio
- [ ] All logo variants render correctly

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Composition Manifest

### Overview
Create a typed manifest that is the **single source of truth** for every composition — its type, dimensions, component, render profile, output destinations, and post-processing steps (like ICO bundling).

### Changes Required:

#### 1. Create `packages/app-remotion/src/manifest.ts`
**File**: `packages/app-remotion/src/manifest.ts` (new)

```ts
import type { RenderMediaOptions } from "@vendor/remotion/renderer";
import type React from "react";

// ── Types ────────────────────────────────────────────────────────────

interface OutputTarget {
  /** Output format */
  format: "png" | "webp" | "webm";
  /** Destination directory (relative to monorepo root) */
  dest: string;
  /** Filename override (defaults to `${compositionId}.${format}`) */
  filename?: string;
  /** Render scale factor (default: 1) */
  scale?: number;
  /** For stills extracted from video compositions: which frame to capture */
  frame?: number;
}

interface StillComposition {
  type: "still";
  width: number;
  height: number;
  component: string;
  props?: Record<string, unknown>;
  outputs: OutputTarget[];
}

interface VideoComposition {
  type: "video";
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  renderProfile: Pick<RenderMediaOptions, "codec" | "imageFormat" | "scale" | "everyNthFrame" | "numberOfGifLoops">;
  outputs: OutputTarget[];
}

type CompositionEntry = StillComposition | VideoComposition;

interface PostProcess {
  type: "ico";
  /** Composition IDs whose outputs feed into this post-process */
  sources: string[];
  filename: string;
  /** Where to write the .ico */
  dests: string[];
}

export interface CompositionManifest {
  compositions: Record<string, CompositionEntry>;
  postProcess: PostProcess[];
}

// ── Manifest ─────────────────────────────────────────────────────────

export const MANIFEST: CompositionManifest = {
  compositions: {
    // ── Video ──────────────────────────────────────────────────────
    "landing-hero": {
      type: "video",
      width: 1920,
      height: 1280,
      fps: 30,
      durationInFrames: 301,
      renderProfile: {
        codec: "vp9",
        imageFormat: "png",
        scale: 2,
      },
      outputs: [
        { format: "webm", dest: "apps/www/public/images", filename: "landing-hero.webm" },
        { format: "webp", dest: "apps/www/public/images", filename: "landing-hero-poster.webp", frame: 150, scale: 1 },
      ],
    },

    // ── Favicons ───────────────────────────────────────────────────
    "logo-favicon-16": {
      type: "still",
      width: 16,
      height: 16,
      component: "Logo",
      props: { strokeWidth: 1 },
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "favicon-16x16.png" },
        { format: "png", dest: "apps/www/public", filename: "favicon-16x16.png" },
      ],
    },
    "logo-favicon-32": {
      type: "still",
      width: 32,
      height: 32,
      component: "Logo",
      props: { strokeWidth: 1.5 },
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "favicon-32x32.png" },
        { format: "png", dest: "apps/www/public", filename: "favicon-32x32.png" },
      ],
    },
    "logo-favicon-48": {
      type: "still",
      width: 48,
      height: 48,
      component: "Logo",
      props: { strokeWidth: 2 },
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "favicon-48x48.png" },
        { format: "png", dest: "apps/www/public", filename: "favicon-48x48.png" },
      ],
    },

    // ── Apple & Android Icons ──────────────────────────────────────
    "logo-apple-touch": {
      type: "still",
      width: 180,
      height: 180,
      component: "Logo",
      props: {},
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "apple-touch-icon.png" },
        { format: "png", dest: "apps/www/public", filename: "apple-touch-icon.png" },
      ],
    },
    "logo-android-192": {
      type: "still",
      width: 192,
      height: 192,
      component: "Logo",
      props: {},
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "android-chrome-192x192.png" },
        { format: "png", dest: "apps/www/public", filename: "android-chrome-192x192.png" },
      ],
    },
    "logo-android-512": {
      type: "still",
      width: 512,
      height: 512,
      component: "Logo",
      props: {},
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "android-chrome-512x512.png" },
        { format: "png", dest: "apps/www/public", filename: "android-chrome-512x512.png" },
      ],
    },

    // ── High-res Logomarks ─────────────────────────────────────────
    "logo-1024": {
      type: "still",
      width: 1024,
      height: 1024,
      component: "Logo",
      props: {},
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "logo-1024.png" },
      ],
    },
    "logo-1024-transparent": {
      type: "still",
      width: 1024,
      height: 1024,
      component: "Logo",
      props: { transparent: true },
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "logo-1024-transparent.png" },
      ],
    },

    // ── Social Banners ─────────────────────────────────────────────
    "logo-linkedin-banner": {
      type: "still",
      width: 1584,
      height: 396,
      component: "Logo",
      props: { strokeWidth: 0 },
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "linkedin-banner.png" },
      ],
    },
    "twitter-banner": {
      type: "still",
      width: 1500,
      height: 500,
      component: "TwitterBanner",
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "twitter-banner.png" },
      ],
    },
    "github-banner": {
      type: "still",
      width: 1280,
      height: 640,
      component: "GitHubBanner",
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "github-banner.png", scale: 2 },
      ],
    },
  },

  postProcess: [
    {
      type: "ico",
      sources: ["logo-favicon-16", "logo-favicon-32", "logo-favicon-48"],
      filename: "favicon.ico",
      dests: ["apps/app/public", "apps/www/public"],
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Get all still compositions */
export function getStills() {
  return Object.entries(MANIFEST.compositions).filter(
    (e): e is [string, StillComposition] => e[1].type === "still",
  );
}

/** Get all video compositions */
export function getVideos() {
  return Object.entries(MANIFEST.compositions).filter(
    (e): e is [string, VideoComposition] => e[1].type === "video",
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Manifest imports resolve correctly

#### Manual Verification:
- [ ] Review manifest entries match current render outputs exactly

**Implementation Note**: This phase is data-only — no behavioral changes yet. Proceed immediately to Phase 4.

---

## Phase 4: Manifest-Driven Root.tsx & Unified Render Pipeline

### Overview
Rewrite `Root.tsx` to derive all registrations from the manifest. Replace the 3 separate render scripts with a single `render.ts` that bundles once, renders everything, and auto-distributes outputs to their declared destinations.

### Changes Required:

#### 1. Rewrite `Root.tsx`
**File**: `packages/app-remotion/src/Root.tsx`
**Changes**: Derive all `<Composition>` and `<Still>` registrations from `MANIFEST`

```tsx
import { Composition, Still } from "@vendor/remotion";
import { MANIFEST } from "./manifest";

// Component registry — maps manifest component names to actual React components
import { GitHubBanner } from "./compositions/github-banner";
import { LandingHero } from "./compositions/landing-hero/landing-hero";
import { Logo } from "./compositions/logo";
import { TwitterBanner } from "./compositions/twitter-banner";

const COMPONENTS: Record<string, React.FC<any>> = {
  LandingHero,
  Logo,
  TwitterBanner,
  GitHubBanner,
};

export const RemotionRoot = () => {
  return (
    <>
      {Object.entries(MANIFEST.compositions).map(([id, entry]) => {
        const Component = COMPONENTS[entry.component ?? id];
        if (!Component) {
          throw new Error(`No component registered for composition "${id}"`);
        }

        if (entry.type === "video") {
          return (
            <Composition
              key={id}
              id={id}
              component={Component}
              width={entry.width}
              height={entry.height}
              fps={entry.fps}
              durationInFrames={entry.durationInFrames}
            />
          );
        }

        return (
          <Still
            key={id}
            id={id}
            component={Component}
            width={entry.width}
            height={entry.height}
            defaultProps={entry.props}
          />
        );
      })}
    </>
  );
};
```

**Note**: The `LandingHero` component doesn't have a `component` field in the manifest for video entries — we can add a `component` field to `VideoComposition` type as well. Or we use the convention that the component name is derived from the composition ID (pascal-cased). Simplest: add `component: string` to both types.

#### 2. Rewrite `render.ts` — Unified Render Pipeline
**File**: `packages/app-remotion/src/render.ts`
**Changes**: Complete rewrite — single entry point for all rendering

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@vendor/remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@vendor/remotion/renderer";
import { MANIFEST, getStills, getVideos } from "./manifest";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../.."); // monorepo root

/** Resolve a manifest dest path to an absolute path */
function resolveDest(dest: string, filename: string): string {
  return path.resolve(ROOT, dest, filename);
}

/** Pack multiple PNG buffers into a single .ico file */
function buildIco(pngs: Buffer[]): Buffer {
  const HEADER = 6;
  const ENTRY = 16;
  const headerBuf = Buffer.alloc(HEADER + ENTRY * pngs.length);
  headerBuf.writeUInt16LE(0, 0);
  headerBuf.writeUInt16LE(1, 2);
  headerBuf.writeUInt16LE(pngs.length, 4);

  let dataOffset = HEADER + ENTRY * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i]!;
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const off = HEADER + ENTRY * i;
    headerBuf.writeUInt8(w >= 256 ? 0 : w, off);
    headerBuf.writeUInt8(h >= 256 ? 0 : h, off + 1);
    headerBuf.writeUInt8(0, off + 2);
    headerBuf.writeUInt8(0, off + 3);
    headerBuf.writeUInt16LE(1, off + 4);
    headerBuf.writeUInt16LE(32, off + 6);
    headerBuf.writeUInt32LE(png.length, off + 8);
    headerBuf.writeUInt32LE(dataOffset, off + 12);
    dataOffset += png.length;
  }
  return Buffer.concat([headerBuf, ...pngs]);
}

/** Copy a rendered file to all its declared destinations */
async function distribute(
  sourcePath: string,
  outputs: Array<{ dest: string; filename?: string }>,
  defaultFilename: string,
) {
  for (const output of outputs) {
    const destPath = resolveDest(output.dest, output.filename ?? defaultFilename);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    if (destPath !== sourcePath) {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

// ── Filter support ───────────────────────────────────────────────────
// Usage: npx tsx src/render.ts [--only stills|video|all] [--id composition-id]
const args = process.argv.slice(2);
const onlyFlag = args.includes("--only") ? args[args.indexOf("--only") + 1] : "all";
const idFlag = args.includes("--id") ? args[args.indexOf("--id") + 1] : undefined;

async function main() {
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const tmpDir = path.resolve(__dirname, "../.cache/render");
  await fs.mkdir(tmpDir, { recursive: true });

  console.log("Bundling compositions...");
  const bundled = await bundle({
    entryPoint,
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });

  // ── Render video compositions ──────────────────────────────────
  if (onlyFlag === "all" || onlyFlag === "video") {
    for (const [id, entry] of getVideos()) {
      if (idFlag && idFlag !== id) continue;

      const composition = await selectComposition({ serveUrl: bundled, id });

      for (const output of entry.outputs) {
        const filename = output.filename ?? `${id}.${output.format}`;

        if (output.frame !== undefined) {
          // Still frame extraction from video
          const tmpPath = path.join(tmpDir, filename);
          console.log(`Rendering ${id} poster (frame ${output.frame})...`);
          await renderStill({
            composition,
            serveUrl: bundled,
            output: tmpPath,
            frame: output.frame,
            imageFormat: output.format as "webp" | "png",
            scale: output.scale ?? 1,
            overwrite: true,
          });
          await distribute(tmpPath, [output], filename);
          console.log(`  ✔ ${filename} → ${output.dest}`);
        } else {
          // Full video render
          const tmpPath = path.join(tmpDir, filename);
          console.log(`Rendering ${id} (${entry.width}×${entry.height} @ ${entry.fps}fps)...`);
          await renderMedia({
            composition,
            serveUrl: bundled,
            outputLocation: tmpPath,
            ...entry.renderProfile,
          });
          await distribute(tmpPath, [output], filename);
          console.log(`  ✔ ${filename} → ${output.dest}`);
        }
      }
    }
  }

  // ── Render still compositions ──────────────────────────────────
  if (onlyFlag === "all" || onlyFlag === "stills") {
    for (const [id, entry] of getStills()) {
      if (idFlag && idFlag !== id) continue;

      console.log(`Rendering ${id} (${entry.width}×${entry.height})...`);
      const composition = await selectComposition({ serveUrl: bundled, id });

      // Render once to tmp, then distribute to all destinations
      const firstOutput = entry.outputs[0]!;
      const filename = firstOutput.filename ?? `${id}.${firstOutput.format}`;
      const tmpPath = path.join(tmpDir, filename);
      await renderStill({
        composition,
        serveUrl: bundled,
        output: tmpPath,
        imageFormat: firstOutput.format as "png" | "webp",
        scale: firstOutput.scale ?? 1,
        overwrite: true,
      });
      await distribute(tmpPath, entry.outputs, filename);
      const dests = [...new Set(entry.outputs.map((o) => o.dest))];
      console.log(`  ✔ ${filename} → ${dests.join(", ")}`);
    }
  }

  // ── Post-processing ────────────────────────────────────────────
  for (const pp of MANIFEST.postProcess) {
    if (pp.type === "ico") {
      console.log(`Building ${pp.filename}...`);
      const pngBuffers = await Promise.all(
        pp.sources.map(async (sourceId) => {
          const entry = MANIFEST.compositions[sourceId];
          if (!entry || entry.type !== "still") {
            throw new Error(`ICO source "${sourceId}" is not a still composition`);
          }
          const output = entry.outputs[0]!;
          const filename = output.filename ?? `${sourceId}.png`;
          const filePath = path.join(tmpDir, filename);
          return fs.readFile(filePath);
        }),
      );

      const icoBuffer = buildIco(pngBuffers);
      for (const dest of pp.dests) {
        const icoPath = resolveDest(dest, pp.filename);
        await fs.mkdir(path.dirname(icoPath), { recursive: true });
        await fs.writeFile(icoPath, icoBuffer);
      }
      console.log(`  ✔ ${pp.filename} → ${pp.dests.join(", ")}`);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalCompositions = Object.keys(MANIFEST.compositions).length;
  console.log(`\n${totalCompositions} compositions rendered + distributed in ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

#### 3. Update `watch.ts`
**File**: `packages/app-remotion/src/watch.ts`
**Changes**: Fix log messages, use `--only video` flag for fast dev iteration

```ts
// Change the render command to only render video during watch (stills don't change often)
execSync("npx tsx src/render.ts --only video", { ... });
```

Fix log messages: "GIF" → "video".

#### 4. Update `package.json` scripts
**File**: `packages/app-remotion/package.json`
**Changes**: Simplify scripts

```json
{
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules out",
    "dev": "npx tsx src/watch.ts",
    "typecheck": "tsc --noEmit",
    "studio": "npx remotion studio src/index.ts",
    "render:all": "npx tsx src/render.ts",
    "render:video": "npx tsx src/render.ts --only video",
    "render:stills": "npx tsx src/render.ts --only stills"
  }
}
```

Remove: `render:webm`, `render:logos`, `render:lissajous`.
Add: `render:all`, `render:video`, `render:stills`.

#### 5. Update root `package.json`
**File**: `package.json` (root)
**Changes**: Fix stale `remotion:render` reference

```json
"remotion:render": "pnpm --filter @repo/app-remotion render:all"
```

#### 6. Delete obsolete files
- `packages/app-remotion/src/render-logos.ts` — replaced by unified render.ts
- `packages/app-remotion/src/render-lissajous.ts` — deleted in Phase 1
- `packages/app-remotion/src/compositions/logo/index.tsx` — slim down to just export the component (remove `LOGO_VARIANTS` — it's in the manifest now)
- `packages/app-remotion/src/compositions/twitter-banner/index.tsx` — slim down (remove `TWITTER_BANNER_CONFIG`)
- `packages/app-remotion/src/compositions/github-banner/index.tsx` — slim down (remove `GITHUB_BANNER_CONFIG`)
- `packages/app-remotion/src/compositions/landing-hero/index.tsx` — slim down (remove render profiles — they're in the manifest)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] `pnpm --filter @repo/app-remotion render:all` completes and distributes all files
- [ ] All expected files exist in their destinations:
  - `apps/www/public/images/landing-hero.webm`
  - `apps/www/public/images/landing-hero-poster.webp`
  - `apps/app/public/favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `favicon.ico`
  - `apps/www/public/` (same favicon set)
  - `packages/app-remotion/out/logos/logo-1024.png`, `logo-1024-transparent.png`, `linkedin-banner.png`, `twitter-banner.png`, `github-banner.png`
- [ ] `pnpm --filter @repo/app-remotion render:video` renders only the landing hero
- [ ] `pnpm --filter @repo/app-remotion render:stills` renders only stills + ICO

#### Manual Verification:
- [ ] All rendered outputs are pixel-identical to previous versions
- [ ] Remotion Studio shows all compositions correctly
- [ ] `pnpm dev:app` and `pnpm dev:www` serve correct favicons and hero video
- [ ] Watch mode (`pnpm dev` in app-remotion) detects changes and re-renders video

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 5: Cleanup & Future-Proofing

### Overview
Clean up dead code, commented-out sections, and add a simple extensibility pattern for new compositions.

### Changes Required:

#### 1. Clean up twitter-banner
**File**: `packages/app-remotion/src/compositions/twitter-banner/twitter-banner.tsx`
**Changes**: Remove all commented-out code. Keep the intentionally black banner.

```tsx
import type React from "react";
import { AbsoluteFill } from "@vendor/remotion";

export const TwitterBanner: React.FC = () => {
  return <AbsoluteFill className="bg-black" />;
};
```

Also delete `packages/app-remotion/src/compositions/twitter-banner/fonts.ts` — it's unused (all font loading was commented out).

#### 2. Clean up twitter-banner index
**File**: `packages/app-remotion/src/compositions/twitter-banner/index.tsx`
**Changes**: Export component only

```tsx
export { TwitterBanner } from "./twitter-banner";
```

#### 3. Clean up github-banner index
**File**: `packages/app-remotion/src/compositions/github-banner/index.tsx`

```tsx
export { GitHubBanner } from "./github-banner";
```

#### 4. Clean up logo index
**File**: `packages/app-remotion/src/compositions/logo/index.tsx`

```tsx
export { Logo } from "./logo";
```

#### 5. Clean up landing-hero index
**File**: `packages/app-remotion/src/compositions/landing-hero/index.tsx`
**Changes**: Delete entirely — render profiles now live in the manifest. The `LandingHero` component is imported directly from `landing-hero.tsx`.

Update `Root.tsx` import to:
```ts
import { LandingHero } from "./compositions/landing-hero/landing-hero";
```
(Already the case from Phase 4.)

#### 6. Add inline documentation to manifest
**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Add a header comment explaining how to add new compositions

```ts
/**
 * Composition Manifest — Single Source of Truth
 *
 * To add a new composition:
 * 1. Create the component in src/compositions/<name>/<name>.tsx
 * 2. Add a COMPONENTS entry in Root.tsx
 * 3. Add the composition definition here with its output targets
 * 4. Run: pnpm render:all
 *
 * The manifest drives:
 * - Root.tsx registration (Composition/Still elements)
 * - Rendering (format, scale, codec)
 * - Distribution (auto-copy to destination directories)
 * - Post-processing (favicon.ico bundling)
 */
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] `pnpm --filter @repo/app-remotion render:all` still works
- [ ] No commented-out code blocks remain in compositions

#### Manual Verification:
- [ ] Twitter banner still renders as solid black
- [ ] No visual regressions anywhere

---

## Phase 6: Composition Inheritance

### Overview
Add a base template system to the manifest. Compositions can `extend` a base, inheriting its component, props, and defaults. Derived compositions only specify what differs. This makes the social card family trivial to extend — adding a new social card is 5 lines in the manifest.

### Changes Required:

#### 1. Extend manifest types
**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Add `bases` map and `extends` field to composition entries

```ts
// ── Base Templates ───────────────────────────────────────────────────

interface BaseComposition {
  type: "still" | "video";
  component: string;
  /** Default props — merged (overridden) by derived composition's props */
  props?: Record<string, unknown>;
  /** Default output format */
  defaultFormat?: "png" | "webp" | "webm";
}

// Add to StillComposition / VideoComposition:
interface StillComposition {
  type: "still";
  /** If set, inherits component + props from the named base */
  extends?: string;
  width: number;
  height: number;
  component?: string;  // optional when extending
  props?: Record<string, unknown>;
  outputs: OutputTarget[];
}

// Add to CompositionManifest:
export interface CompositionManifest {
  bases: Record<string, BaseComposition>;
  compositions: Record<string, CompositionEntry>;
  postProcess: PostProcess[];
}
```

#### 2. Define base templates
**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Add bases for common composition families

```ts
export const MANIFEST: CompositionManifest = {
  bases: {
    /** Square logo/icon — shared by all favicon, app icon, and logomark variants */
    "logo-icon": {
      type: "still",
      component: "Logo",
      props: {},
      defaultFormat: "png",
    },
    /** Social card — dark background brand banner. Extend for each platform. */
    "social-card": {
      type: "still",
      component: "SocialCard",
      props: { showLogo: true, theme: "dark" },
      defaultFormat: "png",
    },
  },

  compositions: {
    // Favicons now inherit from "logo-icon" base
    "logo-favicon-16": {
      extends: "logo-icon",
      type: "still",
      width: 16,
      height: 16,
      props: { strokeWidth: 1 },
      outputs: [
        { format: "png", dest: "apps/app/public", filename: "favicon-16x16.png" },
        { format: "png", dest: "apps/www/public", filename: "favicon-16x16.png" },
      ],
    },
    // ... other favicon/icon variants inherit from "logo-icon"

    // Social banners can inherit from "social-card"
    "twitter-banner": {
      extends: "social-card",
      type: "still",
      width: 1500,
      height: 500,
      component: "TwitterBanner", // override component
      outputs: [
        { format: "png", dest: "packages/app-remotion/out/logos", filename: "twitter-banner.png" },
      ],
    },
    // ... rest unchanged
  },
  // ...
};
```

#### 3. Add resolution helper
**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Add `resolveComposition()` that merges base + derived

```ts
/** Resolve a composition entry, merging inherited base properties */
export function resolveComposition(id: string): CompositionEntry {
  const entry = MANIFEST.compositions[id];
  if (!entry) throw new Error(`Unknown composition: "${id}"`);

  if (!entry.extends) return entry;

  const base = MANIFEST.bases[entry.extends];
  if (!base) throw new Error(`Unknown base: "${entry.extends}" (referenced by "${id}")`);

  return {
    ...entry,
    component: entry.component ?? base.component,
    props: { ...base.props, ...entry.props },
  } as CompositionEntry;
}
```

#### 4. Update Root.tsx and render.ts
Use `resolveComposition()` instead of accessing `MANIFEST.compositions` directly, so inherited component/props are resolved.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] `pnpm --filter @repo/app-remotion render:all` produces identical outputs
- [ ] `resolveComposition("logo-favicon-16").component === "Logo"` (inherited)
- [ ] `resolveComposition("twitter-banner").component === "TwitterBanner"` (overridden)

#### Manual Verification:
- [ ] All renders identical to pre-inheritance outputs
- [ ] Remotion Studio shows all compositions correctly

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 7: Dynamic Rendering API

### Overview
Turn compositions into **templates** with typed Zod input schemas. Add an API route that renders compositions on-demand with custom props, caches results to Vercel Blob, and returns a URL. This transforms the brand system from a build tool into a **brand API** — any part of the product can programmatically generate branded assets.

### Key Design Decisions:
- **Rendering engine**: Remotion `renderStill` for on-demand stills (server-side, ~1-3s). Video rendering stays batch-only (too slow for on-demand).
- **Cache layer**: Vercel Blob for persistent storage. Cache key = `sha256(compositionId + JSON.stringify(props))`. Renders once per unique prop combination, then serves from cache forever.
- **Security**: Only compositions with `dynamic: true` in the manifest are available via the API. Props are validated against the Zod schema — no arbitrary rendering.
- **Deployment**: The API route lives in `apps/platform` (the service layer), not in the Remotion package itself. The Remotion package provides the rendering function; the API route is the consumer.

### Changes Required:

#### 1. Add Zod schemas to manifest
**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Extend types with `inputSchema` and `dynamic` flag

```ts
import { z } from "zod";

interface DynamicStillComposition extends StillComposition {
  /** Zod schema for validating dynamic input props */
  inputSchema: z.ZodType;
  /** Enable on-demand rendering via API */
  dynamic: true;
}

type CompositionEntry = StillComposition | VideoComposition | DynamicStillComposition;
```

#### 2. Create dynamic compositions
**File**: `packages/app-remotion/src/compositions/social-card/social-card.tsx` (new)
**Changes**: A flexible social card component that accepts dynamic props

```tsx
import type React from "react";
import { AbsoluteFill, staticFile } from "@vendor/remotion";
import { lissajousPath } from "@repo/ui/lib/brand";

interface SocialCardProps {
  headline: string;
  subtitle?: string;
  showLogo?: boolean;
  theme?: "dark" | "light";
}

export const SocialCard: React.FC<SocialCardProps> = ({
  headline,
  subtitle,
  showLogo = true,
  theme = "dark",
}) => {
  const bg = theme === "dark" ? "bg-black" : "bg-white";
  const text = theme === "dark" ? "text-white" : "text-black";

  return (
    <AbsoluteFill className={`${bg} flex flex-col items-center justify-center p-16`}>
      <h1 className={`${text} text-5xl font-medium tracking-tight text-center leading-tight`}
        style={{ fontFamily: '"PP Neue Montreal", system-ui, sans-serif' }}>
        {headline}
      </h1>
      {subtitle && (
        <p className={`${text} opacity-60 text-2xl mt-4 text-center`}
          style={{ fontFamily: '"PP Neue Montreal", system-ui, sans-serif' }}>
          {subtitle}
        </p>
      )}
      {showLogo && (
        <svg className="absolute bottom-8 right-8" width={40} height={40} viewBox="0 0 100 100">
          <path
            d={lissajousPath(100, 0.15)}
            fill="none"
            stroke={theme === "dark" ? "#fff" : "#000"}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      )}
    </AbsoluteFill>
  );
};
```

#### 3. Register dynamic compositions in manifest
**File**: `packages/app-remotion/src/manifest.ts`

```ts
// ── Dynamic compositions (on-demand via API) ──────────────────────
"blog-og": {
  extends: "social-card",
  type: "still",
  width: 1200,
  height: 630,
  dynamic: true,
  inputSchema: z.object({
    headline: z.string().max(100),
    subtitle: z.string().max(200).optional(),
  }),
  outputs: [], // No static outputs — rendered on-demand only
},
"changelog-og": {
  extends: "social-card",
  type: "still",
  width: 1200,
  height: 630,
  dynamic: true,
  inputSchema: z.object({
    headline: z.string().max(100),
    version: z.string().optional(),
  }),
  outputs: [], // On-demand only
},
```

#### 4. Create render function for on-demand use
**File**: `packages/app-remotion/src/render-dynamic.ts` (new)
**Changes**: Exports a function (not a script) that renders a single composition with given props

```ts
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@vendor/remotion/bundler";
import { renderStill, selectComposition } from "@vendor/remotion/renderer";
import { MANIFEST, resolveComposition } from "./manifest";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bundledUrl: string | null = null;

/** Lazily bundle once, reuse across renders */
async function ensureBundled(): Promise<string> {
  if (bundledUrl) return bundledUrl;
  bundledUrl = await bundle({
    entryPoint: path.resolve(__dirname, "index.ts"),
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });
  return bundledUrl;
}

/** Generate a cache key from composition ID + props */
export function cacheKey(compositionId: string, props: Record<string, unknown>): string {
  const payload = JSON.stringify({ id: compositionId, props }, Object.keys(props).sort());
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Render a dynamic composition on-demand.
 * Returns the path to the rendered image.
 */
export async function renderDynamic(
  compositionId: string,
  props: Record<string, unknown>,
): Promise<{ buffer: Buffer; format: "png" | "webp" }> {
  const entry = MANIFEST.compositions[compositionId];
  if (!entry || !("dynamic" in entry) || !entry.dynamic) {
    throw new Error(`Composition "${compositionId}" is not dynamic`);
  }

  // Validate props against schema
  const validated = entry.inputSchema.parse(props);
  const resolved = resolveComposition(compositionId);

  const bundled = await ensureBundled();
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: { ...resolved.props, ...validated },
  });

  const tmpPath = path.resolve(__dirname, `../.cache/dynamic/${cacheKey(compositionId, validated)}.png`);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });

  await renderStill({
    composition,
    serveUrl: bundled,
    output: tmpPath,
    imageFormat: "png",
    scale: 1,
    overwrite: true,
  });

  const buffer = await fs.readFile(tmpPath);
  return { buffer, format: "png" };
}
```

#### 5. Create API route
**File**: `apps/platform/src/app/api/brand/render/route.ts` (new)
**Changes**: API endpoint for on-demand rendering with Vercel Blob caching

```ts
import { put } from "@vercel/blob";
import { renderDynamic, cacheKey } from "@repo/app-remotion/render-dynamic";
import { MANIFEST } from "@repo/app-remotion/manifest";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const compositionId = url.searchParams.get("id");
  if (!compositionId) {
    return new Response("Missing ?id parameter", { status: 400 });
  }

  const entry = MANIFEST.compositions[compositionId];
  if (!entry || !("dynamic" in entry) || !entry.dynamic) {
    return new Response(`Composition "${compositionId}" is not dynamic`, { status: 404 });
  }

  // Parse props from query params, validate against schema
  const rawProps: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "id") rawProps[key] = value;
  }

  const key = cacheKey(compositionId, rawProps);
  const blobPath = `brand/${compositionId}/${key}.png`;

  // Check Blob cache first
  // (In production, use a cache header or Blob list check)
  try {
    const { buffer, format } = await renderDynamic(compositionId, rawProps);
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: `image/${format}`,
      addRandomSuffix: false,
    });
    return Response.redirect(blob.url, 302);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return new Response(`Invalid props: ${err.message}`, { status: 400 });
    }
    throw err;
  }
}
```

#### 6. Export render-dynamic from package
**File**: `packages/app-remotion/package.json`
**Changes**: Add export path for dynamic rendering

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
  "./render-dynamic": { "types": "./dist/render-dynamic.d.ts", "default": "./src/render-dynamic.ts" },
  "./manifest": { "types": "./dist/manifest.d.ts", "default": "./src/manifest.ts" }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] `renderDynamic("blog-og", { headline: "Test" })` returns a PNG buffer
- [ ] Invalid props rejected: `renderDynamic("blog-og", { headline: 123 })` throws ZodError
- [ ] Non-dynamic compositions rejected: `renderDynamic("logo-favicon-16", {})` throws
- [ ] Cache key is deterministic: same props = same key

#### Manual Verification:
- [ ] `GET /api/brand/render?id=blog-og&headline=Hello+World` returns a rendered PNG
- [ ] Second request with same params is served from Blob cache (fast)
- [ ] Social card looks correct with various headline/subtitle combinations
- [ ] Logo is positioned correctly at different dimensions

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 8: Visual Regression Guard

### Overview
Add an automated visual regression system that compares rendered outputs against committed baseline images. Catches unintended visual changes from code refactors, dependency updates, font changes, or Remotion version bumps. Provides `render:verify` (compare) and `render:approve` (update baselines) commands.

### Key Design Decisions:
- **Comparison method**: Pixel-by-pixel comparison using `pixelmatch` (lightweight, no native deps). For video, compare the poster frame only.
- **Baseline storage**: `packages/app-remotion/baselines/` — committed to git. Small PNG files (~50-200KB each), total ~2MB.
- **Threshold**: Configurable per-composition. Default 0.1% pixel diff tolerance (accounts for anti-aliasing variance across OS/architecture).
- **Output**: Diff images saved to `.cache/diffs/` for visual inspection. Non-zero exit code on failure for CI integration.

### Changes Required:

#### 1. Add pixelmatch dependency
**File**: `packages/app-remotion/package.json`
**Changes**: Add `pixelmatch` and `pngjs` to devDependencies

```json
"devDependencies": {
  "pixelmatch": "^6.0.0",
  "pngjs": "^7.0.0",
  "@types/pngjs": "^7.0.0"
}
```

#### 2. Create verification script
**File**: `packages/app-remotion/src/verify.ts` (new)

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { MANIFEST, getStills, getVideos, resolveComposition } from "./manifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINES_DIR = path.resolve(__dirname, "../baselines");
const DIFFS_DIR = path.resolve(__dirname, "../.cache/diffs");
const RENDER_CACHE = path.resolve(__dirname, "../.cache/render");

/** Per-composition threshold overrides (fraction of total pixels) */
const THRESHOLDS: Record<string, number> = {
  // Video poster may have slight compression differences
  "landing-hero": 0.005,
};
const DEFAULT_THRESHOLD = 0.001; // 0.1%

interface VerifyResult {
  id: string;
  filename: string;
  status: "pass" | "fail" | "new" | "missing-render";
  diffPercent?: number;
  threshold?: number;
}

function comparePngs(
  baselineBuffer: Buffer,
  renderBuffer: Buffer,
): { diffPercent: number; diffPng: Buffer } {
  const baseline = PNG.sync.read(baselineBuffer);
  const rendered = PNG.sync.read(renderBuffer);

  if (baseline.width !== rendered.width || baseline.height !== rendered.height) {
    return { diffPercent: 100, diffPng: Buffer.alloc(0) };
  }

  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(
    baseline.data,
    rendered.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }, // pixelmatch per-pixel sensitivity
  );

  const totalPixels = width * height;
  const diffPercent = (numDiffPixels / totalPixels) * 100;
  return { diffPercent, diffPng: PNG.sync.write(diff) };
}

async function main() {
  const mode = process.argv[2]; // "verify" or "approve"

  if (mode === "approve") {
    // Copy all renders from .cache/render/ to baselines/
    await fs.mkdir(BASELINES_DIR, { recursive: true });
    const files = await fs.readdir(RENDER_CACHE);
    const pngs = files.filter((f) => f.endsWith(".png") || f.endsWith(".webp"));
    for (const file of pngs) {
      await fs.copyFile(
        path.join(RENDER_CACHE, file),
        path.join(BASELINES_DIR, file),
      );
    }
    console.log(`✔ ${pngs.length} baselines updated in baselines/`);
    return;
  }

  // Default: verify mode
  await fs.mkdir(DIFFS_DIR, { recursive: true });
  const results: VerifyResult[] = [];

  // Verify all stills
  for (const [id, entry] of getStills()) {
    const resolved = resolveComposition(id);
    const filename = entry.outputs[0]?.filename ?? `${id}.png`;
    const renderPath = path.join(RENDER_CACHE, filename);
    const baselinePath = path.join(BASELINES_DIR, filename);

    try {
      await fs.access(renderPath);
    } catch {
      results.push({ id, filename, status: "missing-render" });
      continue;
    }

    try {
      await fs.access(baselinePath);
    } catch {
      results.push({ id, filename, status: "new" });
      continue;
    }

    const renderBuf = await fs.readFile(renderPath);
    const baselineBuf = await fs.readFile(baselinePath);
    const threshold = THRESHOLDS[id] ?? DEFAULT_THRESHOLD;

    // Only compare PNGs pixel-by-pixel
    if (filename.endsWith(".png")) {
      const { diffPercent, diffPng } = comparePngs(baselineBuf, renderBuf);
      const status = diffPercent <= threshold * 100 ? "pass" : "fail";
      results.push({ id, filename, status, diffPercent, threshold: threshold * 100 });

      if (status === "fail" && diffPng.length > 0) {
        await fs.writeFile(path.join(DIFFS_DIR, `${id}.diff.png`), diffPng);
      }
    } else {
      // For non-PNG (webp), compare byte equality
      const match = renderBuf.equals(baselineBuf);
      results.push({ id, filename, status: match ? "pass" : "fail", diffPercent: match ? 0 : 100 });
    }
  }

  // Verify video poster frames
  for (const [id, entry] of getVideos()) {
    for (const output of entry.outputs) {
      if (output.frame === undefined) continue; // skip full video
      const filename = output.filename ?? `${id}-poster.${output.format}`;
      const renderPath = path.join(RENDER_CACHE, filename);
      const baselinePath = path.join(BASELINES_DIR, filename);

      try {
        await fs.access(renderPath);
        await fs.access(baselinePath);
      } catch {
        results.push({ id, filename, status: "new" });
        continue;
      }

      const renderBuf = await fs.readFile(renderPath);
      const baselineBuf = await fs.readFile(baselinePath);
      const match = renderBuf.equals(baselineBuf);
      results.push({ id, filename, status: match ? "pass" : "fail", diffPercent: match ? 0 : 100 });
    }
  }

  // Report
  console.log("\nVisual Regression Report\n");
  let failures = 0;
  for (const r of results) {
    const icon = r.status === "pass" ? "✔" : r.status === "new" ? "●" : r.status === "missing-render" ? "?" : "✘";
    const detail = r.diffPercent !== undefined ? ` (${r.diffPercent.toFixed(3)}% diff, threshold: ${r.threshold?.toFixed(1)}%)` : "";
    console.log(`  ${icon} ${r.filename}  ${r.status}${detail}`);
    if (r.status === "fail") failures++;
  }

  if (failures > 0) {
    console.log(`\n✘ ${failures} composition(s) exceeded visual threshold`);
    console.log(`  Diff images saved to: .cache/diffs/`);
    console.log(`  Run 'pnpm render:approve' to update baselines`);
    process.exit(1);
  }

  const newCount = results.filter((r) => r.status === "new").length;
  if (newCount > 0) {
    console.log(`\n● ${newCount} new composition(s) without baselines`);
    console.log(`  Run 'pnpm render:approve' to create initial baselines`);
  }

  console.log(`\n✔ All ${results.length - newCount} compositions within threshold`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

#### 3. Add scripts
**File**: `packages/app-remotion/package.json`
**Changes**: Add verify and approve scripts

```json
"render:verify": "npx tsx src/render.ts && npx tsx src/verify.ts verify",
"render:approve": "npx tsx src/verify.ts approve"
```

#### 4. Add baselines directory
Create `packages/app-remotion/baselines/.gitkeep` and add `baselines/` to the repo.

After the first successful render, run `pnpm render:approve` to populate initial baselines.

#### 5. Add to .gitignore
**File**: `packages/app-remotion/.gitignore` (create if needed)

```
.cache/
```

Baselines are committed; cache/diffs are not.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] `pnpm --filter @repo/app-remotion render:verify` exits 0 when outputs match baselines
- [ ] `pnpm --filter @repo/app-remotion render:verify` exits 1 when a composition changes (test by temporarily modifying a component)
- [ ] Diff images generated in `.cache/diffs/` for failing compositions
- [ ] `pnpm --filter @repo/app-remotion render:approve` copies renders to baselines

#### Manual Verification:
- [ ] Diff PNG visually highlights the changed region
- [ ] Approve flow works: make intentional change → verify fails → approve → verify passes

**Implementation Note**: After completing this phase, run `pnpm render:approve` to establish initial baselines for all compositions.

---

## Testing Strategy

### Automated:
- `pnpm typecheck` — validates all import paths and type alignment
- `pnpm check` — linting consistency
- Render scripts (`render:all`, `render:video`, `render:stills`) — end-to-end pipeline validation
- `render:verify` — visual regression against committed baselines
- Grep audits for direct Remotion imports and duplicate Lissajous implementations

### Manual:
- Remotion Studio (`pnpm remotion:studio`) — visual verification of all compositions
- Byte-compare logo PNGs before/after to ensure render parity
- Dev server verification (`pnpm dev:www`) — hero video, favicons, footer patterns
- Dynamic API test — render blog-og with various headlines via browser

## Performance Considerations

- **Single bundle**: The unified render.ts bundles once instead of twice (current `render.ts` + `render-logos.ts`). Saves ~15-30s of webpack bundling.
- **Temp dir caching**: Renders go to `.cache/render/` first, then distribute. This avoids partial writes to destination directories.
- **`--only` flags**: Watch mode only re-renders video (the thing that actually changes during dev). Stills are stable.
- **Lissajous compute vs pre-bake**: Moving from pre-generated `lissajous-paths.ts` to runtime computation adds <1ms. Negligible.
- **Dynamic rendering**: First render ~1-3s (Remotion `renderStill`). Cached in Vercel Blob — subsequent requests are a 302 redirect (~50ms).
- **Visual regression**: `pixelmatch` comparison is fast (~10ms per image). The bottleneck is the render, not the comparison.
- **Inheritance resolution**: `resolveComposition()` is a simple object merge — zero performance impact.

## Architecture Summary

```
                    ┌─────────────────────────────────┐
                    │         manifest.ts              │
                    │   Single Source of Truth         │
                    │                                  │
                    │  bases: { logo-icon, social-card }│
                    │  compositions: { 14 entries }    │
                    │  postProcess: [ ico ]            │
                    │  inputSchemas: { blog-og, ... }  │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │ Root.tsx  │   │ render.ts│   │render-dynamic│
        │          │   │          │   │    .ts       │
        │ Derives  │   │ Bundle   │   │ On-demand    │
        │ <Still>  │   │ once →   │   │ render +     │
        │ <Comp>   │   │ render   │   │ Blob cache   │
        │ from     │   │ all →    │   │              │
        │ manifest │   │ distrib  │   │ Zod-validated│
        └──────────┘   └────┬─────┘   └──────┬───────┘
                             │                │
                    ┌────────┴─────┐    ┌─────┴────────┐
                    │  verify.ts   │    │ API route     │
                    │              │    │ /api/brand/   │
                    │ pixelmatch   │    │  render       │
                    │ baselines/   │    │              │
                    │ .cache/diffs │    │ GET ?id=...  │
                    └──────────────┘    └──────────────┘
```

## References

- Current package: `packages/app-remotion/`
- Vendor abstraction: `vendor/remotion/`
- OG package (affected): `packages/og/src/brand/logo.ts`
- Footer (affected): `apps/www/src/app/(app)/_components/app-footer.tsx`
- Landing page (consumer): `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
- Favicon metadata (consumer): `apps/app/src/app/layout.tsx`, `apps/www/src/app/layout.tsx`
- Dynamic render API target: `apps/platform/src/app/api/brand/render/route.ts`
