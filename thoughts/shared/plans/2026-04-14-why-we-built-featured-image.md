# "Why We Built Lightfast" Featured Image — Implementation Plan

## Overview

Create a dedicated featured image for the `why-we-built-lightfast.mdx` blog post by lifting the isometric box + lissajous motif from `landing-hero`'s middle section (`LogoAnimation`), stripping animation and grid scaffolding, and rendering it at `changelog-v010-featured`'s 1200×675 aspect. Replace the currently-borrowed changelog image in the blog frontmatter with the new asset.

## Current State Analysis

- `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx:30` points at `/images/changelog/v010-featured.png` — an asset owned by the v0.1.0 changelog render. Reusing it semantically couples the post to a release image.
- The landing-hero composition (`packages/app-remotion/src/compositions/landing-hero/landing-hero.tsx`) composes a 3×3 iso plane of subjects. The center subject is `LogoAnimation` (`packages/app-remotion/src/compositions/landing-hero/sections/logo-animation.tsx`) — an isometric box (172×172×18) with a lissajous curve projected on its top face, plus a comet trail animation and moving head dot. The grid background is drawn by `GridLines` inside `landing-hero.tsx:58` (the "lined effect" to drop).
- The existing still pattern to mirror is `changelog-v010-featured` at `packages/app-remotion/src/compositions/changelog-v010-featured/changelog-v010-featured.tsx`: 1200×675, `bg-card`, centered SVG, `scale: 2` render.
- Render pipeline is manifest-driven. New compositions require three touch points: create component → register in `Root.tsx` COMPONENTS → add to `MANIFEST.compositions` in `manifest.ts`. `pnpm render:all` (or `pnpm render:stills`) reads the manifest and writes outputs to the declared `dest`.
- Iso primitives (`createBox`, `facePath`, `shapeBounds`, `project`) and lissajous helpers (`lissajousPoints`, `LOGO_CURVE` from `@repo/ui/lib/brand`) are already public — the new composition reuses them directly, no new math.

## Desired End State

- A new still composition `blog-why-we-built-featured` exists in the manifest at 1200×675, rendering a centered isometric box with a static lissajous on its top face on `bg-card`, with no grid lines, no comet trail, and no head dot.
- Rendered outputs land at `apps/www/public/images/blog/why-we-built-lightfast.png` and `.webp` at `scale: 2`.
- Blog frontmatter points at the new asset; the borrowed changelog reference is gone.
- `pnpm --filter @repo/app-remotion typecheck` passes. The page `/blog/2026-03-26-why-we-built-lightfast` loads with the new featured image. The changelog's own `v010-featured.{png,webp}` is untouched and still linked from the changelog.

### Key Discoveries

- `LogoAnimation` is the exact motif requested — reusing it with the animation bits removed is a ~40-line component.
- `manifest.ts:250-270` is the pattern template: still, 1200×675, dual png+webp outputs, `scale: 2`, `dest: "apps/www/public/images/<section>"`.
- The `/images/blog/` directory does **not** yet exist under `apps/www/public/images/`. The render pipeline's dest-copy step will create it on first render (confirmed by the changelog output which co-created `/images/changelog/`).
- `bg-card` is the user-selected surface. The changelog's horizon hairline is **not** being ported — user explicitly chose "bg-card, no horizon hairline".
- Sizing: landing-hero's 172×172×18 box projects to ~298×190 visible. The user picked "~280px box, hero-like". Proposed scaled values: `BOX = {w: 220, h: 220, d: 22}`, `LISSAJOUS_RADIUS = 76` (linearly scaled from 172→220 and 60→76.7). Projected visible: ~381w × ~242h, centered in 1200×675 — reads as a clear subject without dominating the canvas.

## What We're NOT Doing

- Not adding props/variants — this is a one-off for this post, not a reusable family.
- Not porting the comet trail, head dot, or `useCurrentFrame` — still image, static path only.
- Not rendering the 3×3 grid, the other subjects (`StreamEvents`, `IngestedData`), or any `GridLines`.
- Not adding a horizon hairline (the one changelog-v010-featured draws at CY).
- Not changing `landing-hero` or `LogoAnimation` — they stay as-is; we duplicate the static bits.
- Not regenerating/replacing the changelog's own `v010-featured.png`.
- Not writing animation or frame-capture logic.

## Implementation Approach

Mirror `changelog-v010-featured` as the structural template (size, background handling, font-loading plumbing). Lift the static parts of `LogoAnimation` — box geometry, face rendering, projected lissajous path — and drop the animated parts (comet dasharray offset, head dot, `useCurrentFrame`). Scale the box up to ~1.28× so it reads as a hero subject on 1200×675. Register in manifest with output paths matching the blog post's slug. Render, update MDX frontmatter, verify on the running dev server.

---

## Phase 1: New Remotion Composition

### Overview

Create a new still composition that renders the static iso box + lissajous motif at 1200×675 on `bg-card`.

### Changes Required

#### 1. New composition component

**File**: `packages/app-remotion/src/compositions/blog-why-we-built-featured/blog-why-we-built-featured.tsx`
**Changes**: New file. Static-only adaptation of `LogoAnimation`, canvas-sized to 1200×675, centered.

```tsx
import {
  lissajousPoints as computeLissajousPoints,
  LOGO_CURVE,
} from "@repo/ui/lib/brand";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";
import type { Box3D, Vec2 } from "../landing-hero/shared/iso";
import {
  createBox,
  facePath,
  project,
  shapeBounds,
} from "../landing-hero/shared/iso";

// ── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 675;

// Scaled up from landing-hero's 172×172×18 → hero presence on 1200×675
const BOX: Box3D = { x: 0, y: 0, z: 0, w: 220, h: 220, d: 22 };
const LISSAJOUS_RADIUS = 76;
const STEPS = 512;

// ── Precomputed geometry (module scope — pure) ──────────────────────────────

const shape = createBox(BOX);
const bounds = shapeBounds(shape);

const PAD = 4;
const vx = bounds.minX - PAD;
const vy = bounds.minY - PAD;
const vw = bounds.maxX - bounds.minX + PAD * 2;
const vh = bounds.maxY - bounds.minY + PAD * 2;

const topZ = BOX.z + BOX.d;
const cx = BOX.x + BOX.w / 2;
const cy = BOX.y + BOX.h / 2;

const lissajousProjected: Vec2[] = computeLissajousPoints(
  LOGO_CURVE.a,
  LOGO_CURVE.b,
  LOGO_CURVE.delta,
  STEPS
)
  .slice(0, STEPS)
  .map(([px, py]) =>
    project(cx + LISSAJOUS_RADIUS * px, cy + LISSAJOUS_RADIUS * py, topZ)
  );

const lissajousPath = `${lissajousProjected
  .map((v, i) => `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`)
  .join(" ")} Z`;

const FACE_FILL: Record<string, string> = {
  top: "var(--background)",
  front: "var(--background)",
  right: "var(--background)",
};

// ── Component ────────────────────────────────────────────────────────────────

export const BlogWhyWeBuiltFeatured: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  const faces = useMemo(() => shape.faces, []);

  return (
    <AbsoluteFill className="bg-card">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg height={vh} viewBox={`${vx} ${vy} ${vw} ${vh}`} width={vw}>
          {faces.map((face, i) => (
            <path
              d={facePath(face)}
              fillRule="evenodd"
              key={`${face.type}-${i}`}
              strokeWidth={1}
              style={{ fill: FACE_FILL[face.type], stroke: "var(--border)" }}
            />
          ))}
          <path
            d={lissajousPath}
            fill="none"
            strokeWidth={1}
            style={{ stroke: "var(--border)" }}
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
```

#### 2. Barrel export

**File**: `packages/app-remotion/src/compositions/blog-why-we-built-featured/index.ts`
**Changes**: New file.

```ts
export { BlogWhyWeBuiltFeatured } from "./blog-why-we-built-featured";
```

#### 3. Register in Root.tsx

**File**: `packages/app-remotion/src/Root.tsx`
**Changes**: Add import + COMPONENTS entry (keep alphabetical order within existing blog-featured-* grouping).

```tsx
import { BlogWhyWeBuiltFeatured } from "./compositions/blog-why-we-built-featured";
// ...
const COMPONENTS: Record<string, React.FC<Record<string, unknown>>> = {
  BlogFeaturedBase,
  BlogFeaturedConcentric,
  BlogFeaturedCross,
  BlogFeaturedDuo,
  BlogFeaturedGhost,
  BlogFeaturedLissajous,
  BlogFeaturedRule,
  BlogFeaturedTrail,
  BlogWhyWeBuiltFeatured,
  ChangelogV010Events,
  ChangelogV010Featured,
  // ...
};
```

#### 4. Manifest entry

**File**: `packages/app-remotion/src/manifest.ts`
**Changes**: Add a new entry in the Blog Featured Images section (after `blog-featured-duo`, before the Changelog section divider).

```ts
"blog-why-we-built-featured": {
  type: "still",
  component: "BlogWhyWeBuiltFeatured",
  width: 1200,
  height: 675,
  props: {},
  outputs: [
    {
      format: "png",
      dest: "apps/www/public/images/blog",
      filename: "why-we-built-lightfast.png",
      scale: 2,
    },
    {
      format: "webp",
      dest: "apps/www/public/images/blog",
      filename: "why-we-built-lightfast.webp",
      scale: 2,
    },
  ],
},
```

### Success Criteria

#### Automated Verification

- [x] Typecheck passes: `pnpm --filter @repo/app-remotion typecheck`
- [ ] Root-level check passes: `pnpm check`

#### Manual Verification

- [ ] `pnpm --filter @repo/app-remotion studio` loads the new composition `blog-why-we-built-featured` in the Remotion Studio sidebar.
- [ ] Studio preview shows the iso box (three visible faces: top, front, right) centered on `bg-card`, with a closed lissajous path on its top face in `--border` color, no grid lines, no comet, no head dot.
- [ ] Box visibly reads as a hero subject (~400px projected width on 1200×675) — not tiny, not overflowing.

**Implementation Note**: Confirm the composition looks correct in Studio before proceeding to Phase 2.

---

## Phase 2: Render + Wire Into Blog Post

### Overview

Render the new composition to disk and point the MDX frontmatter at the new asset.

### Changes Required

#### 1. Render the still

**Command**: `pnpm --filter @repo/app-remotion render:stills`
**Expected output**:
- `apps/www/public/images/blog/why-we-built-lightfast.png` (2400×1350 px at `scale: 2`)
- `apps/www/public/images/blog/why-we-built-lightfast.webp`

(The `/images/blog/` directory will be created by the manifest's dest-copy step.)

#### 2. Update blog frontmatter

**File**: `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx`
**Changes**: Line 30 — swap the borrowed changelog path for the new asset.

```diff
-featuredImage: "/images/changelog/v010-featured.png"
+featuredImage: "/images/blog/why-we-built-lightfast.png"
```

### Success Criteria

#### Automated Verification

- [x] Both rendered files exist: `ls apps/www/public/images/blog/why-we-built-lightfast.{png,webp}`
- [ ] MDX frontmatter typecheck passes (contentlayer/fumadocs): `pnpm --filter @repo/www typecheck` (or whichever typecheck covers content schema)
- [ ] `pnpm check` still passes.

#### Manual Verification

- [ ] Open the PNG directly from the filesystem — confirm background, centered iso box, closed lissajous path, no other elements, correct 1200×675 aspect.
- [ ] Start www dev server: `pnpm dev:www`. Navigate to `/blog/2026-03-26-why-we-built-lightfast`. Featured image slot shows the new render (not the changelog image). No broken-image icon.
- [ ] Navigate to `/blog` index. The post card for this entry uses the new image if the index pulls `featuredImage`.
- [ ] Navigate to `/changelog`. The changelog v0.1.0 entry still shows its original `v010-featured.png` — confirm we did not regress the changelog image by reusing its path.
- [ ] Open graph preview: view source on the post page, confirm `og:image` / `twitter:image` meta tags resolve to the new asset.

**Implementation Note**: After Phase 2, pause for the user to confirm the image looks right on both the blog index card and the post page before considering the work done.

---

## Testing Strategy

### Unit Tests

Not applicable — this is a pure visual asset. No logic to unit-test.

### Integration Tests

Not applicable — no runtime code paths change. The composition is static geometry + static path.

### Manual Testing Steps

1. `pnpm --filter @repo/app-remotion studio` — visual check of composition isolation.
2. `pnpm --filter @repo/app-remotion render:stills` — confirm render succeeds and files land at expected paths.
3. `pnpm dev:www` — confirm the image loads on the live post page and blog index.
4. `curl -I https://<preview-deploy>/images/blog/why-we-built-lightfast.png` — confirm asset is served in production-like env (post-deploy only).

## Performance Considerations

None. Static PNG + WebP at 2400×1350 is bounded (~few hundred KB). The WebP variant already exists in the output per manifest convention — Next.js will serve whichever the client negotiates.

## Migration Notes

No migration — additive change. The old `/images/changelog/v010-featured.png` reference is simply unused by this post after the swap; the changelog still uses it.

## References

- Source motif: `packages/app-remotion/src/compositions/landing-hero/sections/logo-animation.tsx`
- Structural template: `packages/app-remotion/src/compositions/changelog-v010-featured/changelog-v010-featured.tsx`
- Manifest entry template: `packages/app-remotion/src/manifest.ts:250-270` (changelog-v010-featured)
- Iso primitives: `packages/app-remotion/src/compositions/landing-hero/shared/iso/`
- Lissajous helpers: `@repo/ui/lib/brand` → `lissajousPoints`, `LOGO_CURVE`
- Target post: `apps/www/src/content/blog/2026-03-26-why-we-built-lightfast.mdx:30`
