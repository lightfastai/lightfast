# Remotion Runner Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/remotion` the Remotion runner and make `packages/remotion` a reusable composition package with an intrinsic catalog.

**Architecture:** `@repo/remotion` exports composition source plus intrinsic composition definitions. `@lightfast/remotion` owns Remotion Studio, `registerRoot`, CSS, webpack configuration, render targets, output distribution, and post-processing. The app joins package-owned composition ids with app-owned render policy.

**Tech Stack:** pnpm 11, Turborepo, TypeScript, React 19, Remotion 4, Tailwind 4, `@vendor/remotion`.

---

## Scope

This plan fixes the runner/package ownership model only. It does not add the
Paper MCP compositions. After this plan lands, the Paper MCP migration should
add `brilliant-mist-logo-square-clearspace-dark` and
`brand-partnership-clearspace-dark` as package-owned compositions plus
app-owned render targets.

## File Structure

- Create `packages/remotion/src/catalog.ts`: intrinsic composition catalog with
  component references, dimensions, default props, fps, and duration.
- Modify `packages/remotion/src/index.ts`: export the catalog and catalog types
  only.
- Move `packages/remotion/src/Root.tsx` to `apps/remotion/src/Root.tsx`: the
  app-owned Remotion root reads the package catalog.
- Move `packages/remotion/src/styles.css` to `apps/remotion/src/styles.css`:
  runner-owned Tailwind and UI CSS imports.
- Move `packages/remotion/src/webpack-override.ts` to
  `apps/remotion/src/webpack-override.ts`: runner-owned CSS bundling setup.
- Create `apps/remotion/src/render-targets.ts`: output formats, destinations,
  render profiles, poster frames, and post-processing.
- Modify `apps/remotion/src/render.ts`: consume the package catalog and local
  render targets.
- Modify `apps/remotion/src/index.ts`: import local CSS and register local root.
- Modify `apps/remotion/remotion.config.ts`: use local webpack override.
- Modify `apps/remotion/package.json`: make `dev` start Remotion Studio.
- Modify `packages/remotion/package.json`: remove CSS exports and runner
  dependencies.

## Task 1: Add The Package-Owned Intrinsic Catalog

**Files:**
- Create: `packages/remotion/src/catalog.ts`
- Modify: `packages/remotion/src/index.ts`

- [ ] **Step 1: Confirm the worktree**

Run:

```bash
git status --short
```

Expected: unrelated user changes may exist outside Remotion and docs. Do not
stage or revert unrelated files.

- [ ] **Step 2: Create `packages/remotion/src/catalog.ts`**

Create `packages/remotion/src/catalog.ts` with this content:

```ts
import type React from "react";
import { BlogFeaturedBase } from "./compositions/blog-featured-base";
import { BlogFeaturedConcentric } from "./compositions/blog-featured-concentric";
import { BlogFeaturedCross } from "./compositions/blog-featured-cross";
import { BlogFeaturedDuo } from "./compositions/blog-featured-duo";
import { BlogFeaturedGhost } from "./compositions/blog-featured-ghost";
import { BlogFeaturedLissajous } from "./compositions/blog-featured-lissajous";
import { BlogFeaturedRule } from "./compositions/blog-featured-rule";
import { BlogFeaturedTrail } from "./compositions/blog-featured-trail";
import { BlogWhyWeBuiltFeatured } from "./compositions/blog-why-we-built-featured";
import { BrandGeometry } from "./compositions/brand-geometry";
import { ChangelogV010Events } from "./compositions/changelog-v010-events";
import { ChangelogV010Featured } from "./compositions/changelog-v010-featured";
import { ChangelogV010SdkMcp } from "./compositions/changelog-v010-sdk-mcp";
import { ChangelogV010Sources } from "./compositions/changelog-v010-sources";
import { PeopleEmpty, SignalsEmpty } from "./compositions/empty-states";
import { GitHubBanner } from "./compositions/github-banner";
import { LandingHero } from "./compositions/landing-hero";
import { LinkedInBanner } from "./compositions/linkedin-banner";
import { Logo } from "./compositions/logo";
import { TwitterBanner } from "./compositions/twitter-banner";

export type RemotionCompositionComponent = React.FC<Record<string, unknown>>;

interface BaseCompositionDefinition {
  component: RemotionCompositionComponent;
  defaultProps?: Record<string, unknown>;
  height: number;
  width: number;
}

export interface RemotionStillDefinition extends BaseCompositionDefinition {
  type: "still";
}

export interface RemotionVideoDefinition extends BaseCompositionDefinition {
  durationInFrames: number;
  fps: number;
  type: "video";
}

export type RemotionCompositionDefinition =
  | RemotionStillDefinition
  | RemotionVideoDefinition;

export type RemotionCompositionCatalog = Record<
  string,
  RemotionCompositionDefinition
>;

const LOGO_BASE_MARK_SIZE = 56;
const logoAssetScale = (targetMarkSize: number) =>
  targetMarkSize / LOGO_BASE_MARK_SIZE;

export const remotionCompositionCatalog = {
  "brand-geometry": {
    type: "still",
    component: BrandGeometry,
    width: 1600,
    height: 900,
    defaultProps: {},
  },
  "signals-empty": {
    type: "still",
    component: SignalsEmpty,
    width: 1280,
    height: 760,
    defaultProps: {},
  },
  "people-empty": {
    type: "still",
    component: PeopleEmpty,
    width: 1280,
    height: 760,
    defaultProps: {},
  },
  "blog-featured-concentric": {
    type: "still",
    component: BlogFeaturedConcentric,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-lissajous": {
    type: "still",
    component: BlogFeaturedLissajous,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-base": {
    type: "still",
    component: BlogFeaturedBase,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-rule": {
    type: "still",
    component: BlogFeaturedRule,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-trail": {
    type: "still",
    component: BlogFeaturedTrail,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-ghost": {
    type: "still",
    component: BlogFeaturedGhost,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-cross": {
    type: "still",
    component: BlogFeaturedCross,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-featured-duo": {
    type: "still",
    component: BlogFeaturedDuo,
    width: 1200,
    height: 630,
    defaultProps: {},
  },
  "blog-why-we-built-featured": {
    type: "still",
    component: BlogWhyWeBuiltFeatured,
    width: 1200,
    height: 675,
    defaultProps: {},
  },
  "changelog-v010-featured": {
    type: "still",
    component: ChangelogV010Featured,
    width: 1200,
    height: 675,
    defaultProps: {},
  },
  "changelog-v010-events": {
    type: "still",
    component: ChangelogV010Events,
    width: 1200,
    height: 675,
    defaultProps: {},
  },
  "changelog-v010-sources": {
    type: "still",
    component: ChangelogV010Sources,
    width: 1200,
    height: 675,
    defaultProps: {},
  },
  "changelog-v010-sdk-mcp": {
    type: "still",
    component: ChangelogV010SdkMcp,
    width: 1200,
    height: 675,
    defaultProps: {},
  },
  "landing-hero": {
    type: "video",
    component: LandingHero,
    width: 1920,
    height: 1280,
    fps: 30,
    durationInFrames: 300,
    defaultProps: {},
  },
  "logo-favicon-16": {
    type: "still",
    component: Logo,
    width: 16,
    height: 16,
    defaultProps: { assetScale: logoAssetScale(16) },
  },
  "logo-favicon-32": {
    type: "still",
    component: Logo,
    width: 32,
    height: 32,
    defaultProps: { assetScale: logoAssetScale(32) },
  },
  "logo-favicon-48": {
    type: "still",
    component: Logo,
    width: 48,
    height: 48,
    defaultProps: { assetScale: logoAssetScale(48) },
  },
  "logo-apple-touch": {
    type: "still",
    component: Logo,
    width: 180,
    height: 180,
    defaultProps: { assetScale: logoAssetScale(128) },
  },
  "logo-android-192": {
    type: "still",
    component: Logo,
    width: 192,
    height: 192,
    defaultProps: { assetScale: logoAssetScale(128) },
  },
  "logo-android-512": {
    type: "still",
    component: Logo,
    width: 512,
    height: 512,
    defaultProps: { assetScale: logoAssetScale(256) },
  },
  "logo-1024": {
    type: "still",
    component: Logo,
    width: 1024,
    height: 1024,
    defaultProps: { assetScale: logoAssetScale(512) },
  },
  "linkedin-banner": {
    type: "still",
    component: LinkedInBanner,
    width: 1584,
    height: 396,
    defaultProps: {},
  },
  "twitter-banner": {
    type: "still",
    component: TwitterBanner,
    width: 1500,
    height: 500,
    defaultProps: {},
  },
  "github-banner": {
    type: "still",
    component: GitHubBanner,
    width: 1280,
    height: 640,
    defaultProps: {},
  },
} satisfies RemotionCompositionCatalog;

export function getRemotionStillDefinitions(): [
  string,
  RemotionStillDefinition,
][] {
  return Object.entries(remotionCompositionCatalog).filter(
    (entry): entry is [string, RemotionStillDefinition] =>
      entry[1].type === "still"
  );
}

export function getRemotionVideoDefinitions(): [
  string,
  RemotionVideoDefinition,
][] {
  return Object.entries(remotionCompositionCatalog).filter(
    (entry): entry is [string, RemotionVideoDefinition] =>
      entry[1].type === "video"
  );
}
```

- [ ] **Step 3: Export the catalog without removing the old runner exports yet**

Replace `packages/remotion/src/index.ts` with:

```ts
export {
  getRemotionStillDefinitions,
  getRemotionVideoDefinitions,
  remotionCompositionCatalog,
  type RemotionCompositionCatalog,
  type RemotionCompositionComponent,
  type RemotionCompositionDefinition,
  type RemotionStillDefinition,
  type RemotionVideoDefinition,
} from "./catalog";
export { RemotionRoot } from "./Root";
export {
  getStills,
  getVideos,
  MANIFEST,
  type CompositionEntry,
  type CompositionManifest,
} from "./manifest";
export { enableCssLoaders } from "./webpack-override";
```

Expected: the package exposes the new catalog while the current app runner still
works.

- [ ] **Step 4: Run package typecheck**

Run:

```bash
pnpm --filter @repo/remotion typecheck
```

Expected: PASS. If TypeScript rejects a component assignment in `catalog.ts`,
use a local cast on the specific component value:

```ts
component: Logo as RemotionCompositionComponent,
```

- [ ] **Step 5: Commit the catalog checkpoint**

Run:

```bash
git add packages/remotion/src/catalog.ts packages/remotion/src/index.ts
git commit -m "refactor(remotion): add intrinsic composition catalog"
```

Expected: commit succeeds and unrelated files remain unstaged.

## Task 2: Move Remotion Root, CSS, And Webpack Config Into The Runner

**Files:**
- Move: `packages/remotion/src/Root.tsx` -> `apps/remotion/src/Root.tsx`
- Move: `packages/remotion/src/styles.css` -> `apps/remotion/src/styles.css`
- Move: `packages/remotion/src/webpack-override.ts` -> `apps/remotion/src/webpack-override.ts`
- Modify: `apps/remotion/src/index.ts`
- Modify: `apps/remotion/remotion.config.ts`
- Modify: `apps/remotion/package.json`

- [ ] **Step 1: Move runner-owned files**

Run:

```bash
git mv packages/remotion/src/Root.tsx apps/remotion/src/Root.tsx
git mv packages/remotion/src/styles.css apps/remotion/src/styles.css
git mv packages/remotion/src/webpack-override.ts apps/remotion/src/webpack-override.ts
```

Expected: files are staged as renames. Do not stage generated output.

- [ ] **Step 2: Replace the app-owned Remotion root**

Replace `apps/remotion/src/Root.tsx` with:

```tsx
// biome-ignore lint/style/useFilenamingConvention: Remotion requires PascalCase entry point

import {
  remotionCompositionCatalog,
  type RemotionCompositionComponent,
} from "@repo/remotion";
import { Composition, Still } from "@vendor/remotion";

const withDarkTheme = (
  Component: RemotionCompositionComponent
): RemotionCompositionComponent => {
  const DarkThemedComposition: RemotionCompositionComponent = (props) => (
    <div className="dark" style={{ height: "100%", width: "100%" }}>
      <Component {...props} />
    </div>
  );

  DarkThemedComposition.displayName = `DarkThemed(${
    Component.displayName ?? Component.name ?? "Composition"
  })`;

  return DarkThemedComposition;
};

export const RemotionRoot = () => (
  <>
    {Object.entries(remotionCompositionCatalog).map(([id, entry]) => {
      const Component = withDarkTheme(entry.component);

      if (entry.type === "video") {
        return (
          <Composition
            component={Component}
            defaultProps={entry.defaultProps}
            durationInFrames={entry.durationInFrames}
            fps={entry.fps}
            height={entry.height}
            id={id}
            key={id}
            width={entry.width}
          />
        );
      }

      return (
        <Still
          component={Component}
          defaultProps={entry.defaultProps}
          height={entry.height}
          id={id}
          key={id}
          width={entry.width}
        />
      );
    })}
  </>
);
```

- [ ] **Step 3: Replace the runner CSS**

Replace `apps/remotion/src/styles.css` with:

```css
@import "tailwindcss/index.css";
@import "@repo/ui-v2/fonts.css";
@import "@repo/ui-v2/shadcn.css";
@import "@repo/ui-v2/theme.css";

@source "./**/*.{ts,tsx}";
@source "../../../packages/remotion/src/**/*.{ts,tsx}";
```

Expected: Tailwind scans runner files and reusable composition files.

- [ ] **Step 4: Keep the webpack override local to the runner**

Leave `apps/remotion/src/webpack-override.ts` with this content:

```ts
import type { WebpackOverrideFn } from "@vendor/remotion/bundler";

export const enableCssLoaders: WebpackOverrideFn = (currentConfig) => ({
  ...currentConfig,
  module: {
    ...currentConfig.module,
    rules: [
      ...(currentConfig.module?.rules ?? []).filter((rule) => {
        if (
          rule &&
          typeof rule === "object" &&
          "test" in rule &&
          rule.test instanceof RegExp
        ) {
          return !rule.test.test(".css");
        }
        return true;
      }),
      {
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: { "@tailwindcss/postcss": {} },
              },
            },
          },
        ],
      },
    ],
  },
});
```

- [ ] **Step 5: Replace the Remotion entrypoint**

Replace `apps/remotion/src/index.ts` with:

```ts
import "./styles.css";
import { registerRoot } from "@vendor/remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

- [ ] **Step 6: Point Remotion config at the local webpack override**

Replace `apps/remotion/remotion.config.ts` with:

```ts
import { Config } from "@remotion/cli/config";
import { enableCssLoaders } from "./src/webpack-override";

Config.setEntryPoint("src/index.ts");
Config.setOverwriteOutput(true);
Config.setPublicDir("../../apps/www/public");
Config.overrideWebpackConfig(enableCssLoaders);
```

- [ ] **Step 7: Make the app `dev` script start Remotion Studio**

Replace `apps/remotion/package.json` with:

```json
{
  "name": "@lightfast/remotion",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo out node_modules",
    "dev": "remotion studio src/index.ts",
    "studio": "remotion studio src/index.ts",
    "typecheck": "tsc --noEmit",
    "watch": "tsx src/watch.ts",
    "render:all": "tsx src/render.ts",
    "render:video": "tsx src/render.ts --only video",
    "render:stills": "tsx src/render.ts --only stills"
  },
  "dependencies": {
    "@repo/remotion": "workspace:*",
    "@repo/ui-v2": "workspace:*",
    "@vendor/remotion": "workspace:*",
    "react": "catalog:react19",
    "react-dom": "catalog:react19"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.448",
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "catalog:tailwind4",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "css-loader": "^7.1.4",
    "postcss": "catalog:tailwind4",
    "postcss-loader": "^8.1.1",
    "style-loader": "^4.0.0",
    "tailwindcss": "catalog:tailwind4",
    "tsx": "^4.21.0",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 8: Do not typecheck yet**

Expected: the app may still fail typecheck until render policy moves out of the
package in Task 3.

## Task 3: Move Render Policy Into The Runner

**Files:**
- Create: `apps/remotion/src/render-targets.ts`
- Modify: `apps/remotion/src/render.ts`
- Modify: `apps/remotion/src/watch.ts`

- [ ] **Step 1: Create app-owned render targets**

Create `apps/remotion/src/render-targets.ts` with this content:

```ts
import type { RenderMediaOptions } from "@vendor/remotion/renderer";

export interface OutputTarget {
  dest: string;
  filename?: string;
  format: "png" | "webp" | "webm";
  frame?: number;
  scale?: number;
}

export interface CompositionRenderTarget {
  outputs: OutputTarget[];
  renderProfile?: Pick<
    RenderMediaOptions,
    | "codec"
    | "imageFormat"
    | "scale"
    | "everyNthFrame"
    | "numberOfGifLoops"
    | "colorSpace"
    | "ffmpegOverride"
  >;
}

export interface PostProcessTarget {
  dests: string[];
  filename: string;
  sources: string[];
  type: "ico";
}

export type RemotionRenderTargets = Record<string, CompositionRenderTarget>;

export const remotionRenderTargets = {
  "brand-geometry": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/brand",
        filename: "brand-geometry.png",
        scale: 2,
      },
    ],
  },
  "signals-empty": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/empty-states",
        filename: "signals-empty.png",
        scale: 2,
      },
    ],
  },
  "people-empty": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/empty-states",
        filename: "people-empty.png",
        scale: 2,
      },
    ],
  },
  "blog-featured-concentric": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-concentric.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-concentric.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-lissajous": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-lissajous.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-lissajous.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-base": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-base.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-base.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-rule": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-rule.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-rule.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-trail": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-trail.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-trail.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-ghost": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-ghost.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-ghost.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-cross": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-cross.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-cross.webp",
        scale: 2,
      },
    ],
  },
  "blog-featured-duo": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-duo.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/remotion/out/featured",
        filename: "blog-featured-duo.webp",
        scale: 2,
      },
    ],
  },
  "blog-why-we-built-featured": {
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
  "changelog-v010-featured": {
    outputs: [
      {
        format: "png",
        dest: "apps/www/public/images/changelog",
        filename: "v010-featured.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/www/public/images/changelog",
        filename: "v010-featured.webp",
        scale: 2,
      },
    ],
  },
  "changelog-v010-events": {
    outputs: [
      {
        format: "png",
        dest: "apps/www/public/images/changelog",
        filename: "v010-events.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/www/public/images/changelog",
        filename: "v010-events.webp",
        scale: 2,
      },
    ],
  },
  "changelog-v010-sources": {
    outputs: [
      {
        format: "png",
        dest: "apps/www/public/images/changelog",
        filename: "v010-sources.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/www/public/images/changelog",
        filename: "v010-sources.webp",
        scale: 2,
      },
    ],
  },
  "changelog-v010-sdk-mcp": {
    outputs: [
      {
        format: "png",
        dest: "apps/www/public/images/changelog",
        filename: "v010-sdk-mcp.png",
        scale: 2,
      },
      {
        format: "webp",
        dest: "apps/www/public/images/changelog",
        filename: "v010-sdk-mcp.webp",
        scale: 2,
      },
    ],
  },
  "landing-hero": {
    renderProfile: {
      codec: "vp9",
      imageFormat: "png",
      scale: 2,
      colorSpace: "bt709",
      ffmpegOverride: ({ args }) =>
        args.map((arg, index, allArgs) => {
          if (
            index > 0 &&
            allArgs[index - 1] === "-color_range" &&
            arg === "tv"
          ) {
            return "pc";
          }
          if (typeof arg === "string" && arg.includes("range=limited")) {
            return arg.replace(/range=limited/g, "range=full");
          }
          return arg;
        }),
    },
    outputs: [
      {
        format: "webm",
        dest: "apps/www/public/images",
        filename: "landing-hero.webm",
      },
      {
        format: "webp",
        dest: "apps/www/public/images",
        filename: "landing-hero-poster.webp",
        frame: 150,
        scale: 1,
      },
    ],
  },
  "logo-favicon-16": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "favicon-16x16.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "favicon-16x16.png",
      },
    ],
  },
  "logo-favicon-32": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "favicon-32x32.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "favicon-32x32.png",
      },
    ],
  },
  "logo-favicon-48": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "favicon-48x48.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "favicon-48x48.png",
      },
    ],
  },
  "logo-apple-touch": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "apple-touch-icon.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "apple-touch-icon.png",
      },
    ],
  },
  "logo-android-192": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "android-chrome-192x192.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "android-chrome-192x192.png",
      },
    ],
  },
  "logo-android-512": {
    outputs: [
      {
        format: "png",
        dest: "apps/app/public",
        filename: "android-chrome-512x512.png",
      },
      {
        format: "png",
        dest: "apps/www/public",
        filename: "android-chrome-512x512.png",
      },
    ],
  },
  "logo-1024": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/logos",
        filename: "logo-1024.png",
      },
    ],
  },
  "linkedin-banner": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/logos",
        filename: "linkedin-banner.png",
      },
    ],
  },
  "twitter-banner": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/logos",
        filename: "twitter-banner.png",
      },
    ],
  },
  "github-banner": {
    outputs: [
      {
        format: "png",
        dest: "apps/remotion/out/logos",
        filename: "github-banner.png",
        scale: 2,
      },
      {
        format: "png",
        dest: "apps/www/public/images",
        filename: "github-banner.png",
        scale: 2,
      },
    ],
  },
} satisfies RemotionRenderTargets;

export const postProcessTargets: PostProcessTarget[] = [
  {
    type: "ico",
    sources: ["logo-favicon-16", "logo-favicon-32", "logo-favicon-48"],
    filename: "favicon.ico",
    dests: ["apps/app/public", "apps/www/public"],
  },
];
```

- [ ] **Step 2: Replace `apps/remotion/src/render.ts` imports**

Replace the import block at the top of `apps/remotion/src/render.ts` with:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  remotionCompositionCatalog,
  type RemotionStillDefinition,
  type RemotionVideoDefinition,
} from "@repo/remotion";
import { bundle } from "@vendor/remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@vendor/remotion/renderer";
import {
  postProcessTargets,
  remotionRenderTargets,
  type CompositionRenderTarget,
} from "./render-targets";
import { enableCssLoaders } from "./webpack-override";
```

- [ ] **Step 3: Add render target validation helpers**

Add these helpers above `async function main()` in `apps/remotion/src/render.ts`:

```ts
type StillRenderEntry = [string, RemotionStillDefinition, CompositionRenderTarget];
type VideoRenderEntry = [string, RemotionVideoDefinition, CompositionRenderTarget];

function getStillRenderEntries(): StillRenderEntry[] {
  const entries: StillRenderEntry[] = [];

  for (const [id, target] of Object.entries(remotionRenderTargets)) {
    const definition = remotionCompositionCatalog[id];

    if (!definition) {
      throw new Error(`Render target "${id}" has no package catalog entry`);
    }

    if (definition.type === "still") {
      entries.push([id, definition, target]);
    }
  }

  return entries;
}

function getVideoRenderEntries(): VideoRenderEntry[] {
  const entries: VideoRenderEntry[] = [];

  for (const [id, target] of Object.entries(remotionRenderTargets)) {
    const definition = remotionCompositionCatalog[id];

    if (!definition) {
      throw new Error(`Render target "${id}" has no package catalog entry`);
    }

    if (definition.type === "video") {
      entries.push([id, definition, target]);
    }
  }

  return entries;
}

function validatePostProcessTargets() {
  for (const target of postProcessTargets) {
    for (const sourceId of target.sources) {
      const definition = remotionCompositionCatalog[sourceId];
      if (!definition || definition.type !== "still") {
        throw new Error(
          `Post-process source "${sourceId}" is not a still composition`
        );
      }
      if (!remotionRenderTargets[sourceId]?.outputs[0]) {
        throw new Error(
          `Post-process source "${sourceId}" has no render output`
        );
      }
    }
  }
}
```

- [ ] **Step 4: Update render loops to use catalog plus render targets**

In `apps/remotion/src/render.ts`, replace the video loop:

```ts
for (const [id, entry] of getVideos()) {
```

with:

```ts
for (const [id, definition, target] of getVideoRenderEntries()) {
```

In that loop, replace every `entry.outputs` with `target.outputs`, every
`entry.width` with `definition.width`, every `entry.height` with
`definition.height`, every `entry.fps` with `definition.fps`, and
`...entry.renderProfile` with `...(target.renderProfile ?? {})`.

Then replace the still loop:

```ts
for (const [id, entry] of getStills()) {
```

with:

```ts
for (const [id, definition, target] of getStillRenderEntries()) {
```

In that loop, replace every `entry.outputs` with `target.outputs`,
`entry.width` with `definition.width`, and `entry.height` with
`definition.height`.

- [ ] **Step 5: Update post-processing in `render.ts`**

Replace this block:

```ts
for (const pp of MANIFEST.postProcess) {
```

with:

```ts
validatePostProcessTargets();

for (const pp of postProcessTargets) {
```

Inside the `pp.sources.map` callback, replace the current manifest lookup with:

```ts
const output = remotionRenderTargets[sourceId]?.outputs[0];
if (!output) {
  throw new Error(`ICO source "${sourceId}" has no rendered output`);
}
const filename = output.filename ?? `${sourceId}.png`;
const filePath = path.join(tmpDir, filename);
return fs.readFile(filePath);
```

At the end of `main()`, replace:

```ts
const totalCompositions = Object.keys(MANIFEST.compositions).length;
```

with:

```ts
const totalCompositions = Object.keys(remotionCompositionCatalog).length;
```

- [ ] **Step 6: Verify render script no longer imports package runner policy**

Run:

```bash
rg -n "MANIFEST|getStills|getVideos|enableCssLoaders" apps/remotion/src/render.ts
```

Expected: only `enableCssLoaders` appears, imported from
`./webpack-override`. `MANIFEST`, `getStills`, and `getVideos` do not appear.

- [ ] **Step 7: Keep watch as an explicit render watcher**

Leave `apps/remotion/src/watch.ts` in place, but confirm it still calls the app
runner script:

```bash
rg -n "pnpm --filter @lightfast/remotion render:video" apps/remotion/src/watch.ts
```

Expected: one match.

## Task 4: Remove Runner Surface From The Package

**Files:**
- Delete: `packages/remotion/src/manifest.ts`
- Modify: `packages/remotion/src/index.ts`
- Modify: `packages/remotion/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Delete the old mixed manifest**

Run:

```bash
git rm packages/remotion/src/manifest.ts
```

Expected: the manifest is removed because intrinsic metadata now lives in
`catalog.ts` and render policy lives in `apps/remotion/src/render-targets.ts`.

- [ ] **Step 2: Replace the package public interface**

Replace `packages/remotion/src/index.ts` with:

```ts
export {
  getRemotionStillDefinitions,
  getRemotionVideoDefinitions,
  remotionCompositionCatalog,
  type RemotionCompositionCatalog,
  type RemotionCompositionComponent,
  type RemotionCompositionDefinition,
  type RemotionStillDefinition,
  type RemotionVideoDefinition,
} from "./catalog";
```

- [ ] **Step 3: Replace `packages/remotion/package.json`**

Replace `packages/remotion/package.json` with:

```json
{
  "name": "@repo/remotion",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/ui-v2": "workspace:*",
    "@vendor/remotion": "workspace:*",
    "clsx": "catalog:",
    "react": "catalog:react19",
    "tailwind-merge": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 4: Update the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` reflects the package dependency cleanup.

- [ ] **Step 5: Verify package has no runner files**

Run:

```bash
rg -n "registerRoot|RemotionRoot|enableCssLoaders|remotion.config|OutputTarget|postProcess|renderProfile|apps/remotion/out|apps/www/public|apps/app/public" packages/remotion/src packages/remotion/package.json
```

Expected: no matches, except composition source may contain ordinary Remotion
imports such as `AbsoluteFill`, `useCurrentFrame`, or `staticFile`.

- [ ] **Step 6: Verify app owns runner files**

Run:

```bash
rg -n "registerRoot|RemotionRoot|enableCssLoaders|postProcessTargets|remotionRenderTargets" apps/remotion/src apps/remotion/remotion.config.ts
```

Expected: matches are all under `apps/remotion`.

## Task 5: Validate The Runner Boundary

**Files:**
- Read: `apps/remotion/package.json`
- Read: `packages/remotion/package.json`
- Read: `apps/remotion/src/index.ts`
- Read: `apps/remotion/src/Root.tsx`
- Read: `apps/remotion/src/render.ts`
- Read: `apps/remotion/src/render-targets.ts`
- Read: `packages/remotion/src/catalog.ts`

- [ ] **Step 1: Run focused typechecks**

Run:

```bash
pnpm --filter @repo/remotion typecheck
pnpm --filter @lightfast/remotion typecheck
```

Expected: both commands pass.

- [ ] **Step 2: Run a still render smoke test**

Run:

```bash
pnpm --filter @lightfast/remotion render:stills -- --id brand-geometry
```

Expected: the render succeeds and writes
`apps/remotion/out/brand/brand-geometry.png`.

- [ ] **Step 3: Verify `dev` points to Studio**

Run:

```bash
pnpm --filter @lightfast/remotion dev --help
```

Expected: Remotion Studio CLI help appears or the command starts the Studio
server. Stop it with `Ctrl+C` if it starts a persistent process.

- [ ] **Step 4: Verify root helper scripts still delegate to the runner**

Run:

```bash
rg -n "remotion:(studio|render).*@lightfast/remotion" package.json
```

Expected: root helper scripts point at `@lightfast/remotion`.

- [ ] **Step 5: Run stale reference checks**

Run:

```bash
rg -n "@repo/remotion/styles.css|packages/remotion/src/Root|packages/remotion/src/styles|packages/remotion/src/webpack|packages/remotion/src/manifest|enableCssLoaders.*@repo/remotion|MANIFEST|getStills|getVideos" apps/remotion packages/remotion package.json knip.json
```

Expected: no matches in live implementation or workspace configuration files.

- [ ] **Step 6: Commit the boundary fix**

Run:

```bash
git add apps/remotion packages/remotion package.json knip.json pnpm-lock.yaml docs/superpowers/plans/2026-06-23-remotion-runner-boundary.md
git commit -m "refactor(remotion): move runner policy into app"
```

Expected: commit succeeds. If `package.json` or `knip.json` has no changes, omit
it from `git add`.

## Task 6: Prepare The Paper MCP Follow-Up

**Files:**
- Read: `docs/superpowers/specs/2026-06-23-remotion-runner-split-design.md`
- Read: `packages/remotion/src/catalog.ts`
- Read: `apps/remotion/src/render-targets.ts`

- [ ] **Step 1: Confirm the follow-up location**

Run:

```bash
rg -n "Paper MCP|brilliant-mist-logo-square-clearspace-dark|brand-partnership-clearspace-dark" docs/superpowers/specs/2026-06-23-remotion-runner-split-design.md
```

Expected: the corrected spec says Paper MCP compositions belong in
`packages/remotion` and their output destinations belong in `apps/remotion`.

- [ ] **Step 2: Leave a clean handoff note in the final response**

In the final response, state:

```text
The runner boundary is ready for the Paper MCP composition migration. Add the two Paper-derived stills in packages/remotion, then add their output targets in apps/remotion/src/render-targets.ts.
```

Expected: no new code is added for Paper MCP in this plan.
