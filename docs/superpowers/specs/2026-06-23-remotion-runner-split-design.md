# Remotion Runner Boundary Design

## Context

Lightfast uses Remotion to generate brand, marketing, favicon, social, and
motion assets. The desired shape mirrors the React Email setup:

- `apps/email` runs the React Email workbench.
- `packages/email` owns reusable email templates.

Remotion should follow the same ownership model. `apps/remotion` is the runner.
`packages/remotion` is the reusable composition package.

The current split still leaks runner concerns into `packages/remotion`.
`packages/remotion` currently exports a Remotion root, global CSS, a webpack
override, and a manifest that mixes intrinsic composition metadata with output
distribution policy. That makes the package shallow: callers must understand
nearly as much runner implementation detail as the runner itself.

## Goals

- Make `apps/remotion` the only Remotion runner package.
- Make `pnpm dev --filter @lightfast/remotion` start Remotion Studio.
- Keep `packages/remotion` focused on reusable composition source and intrinsic
  composition metadata.
- Move runner-only files out of `packages/remotion`.
- Split composition identity from render/distribution policy.
- Prepare a clean place for the Paper MCP-derived brand compositions:
  `brilliant-mist-logo-square-clearspace-dark` and
  `brand-partnership-clearspace-dark`.

## Non-Goals

- Do not redesign existing assets as part of this boundary fix.
- Do not make Remotion part of the root `pnpm dev` service graph.
- Do not import Remotion runner tooling into shared UI packages.
- Do not make `packages/remotion` a public package.
- Do not change `@vendor/remotion` except for normal import maintenance.

## Options Considered

### Option A: Package Owns Everything Except CLI Scripts

`packages/remotion` keeps `Root.tsx`, CSS, webpack config, and the full manifest.
`apps/remotion` only calls the Remotion CLI.

This is close to the current implementation, but it keeps runner knowledge in
the package. The package remains hard to reason about because it owns reusable
composition source and app-specific runtime policy at the same time.

### Option B: App Owns All Catalog And Render Policy

`packages/remotion` exports only React composition modules. `apps/remotion` owns
all composition registration data, sizes, default props, outputs, and render
settings.

This makes the package very clean, but it pushes intrinsic facts about reusable
compositions into the runner. A second runner or test harness would have to
rediscover each composition's dimensions and default props.

### Option C: Split Intrinsic Catalog From Render Policy

`packages/remotion` owns reusable composition modules and an intrinsic
composition catalog. `apps/remotion` owns the Remotion root, CSS, webpack
override, dev server, render scripts, output targets, render profiles, and
post-processing.

This is the recommended design. The package interface stays small and reusable,
while the runner keeps all environment-specific behavior local.

## Chosen Architecture

`apps/remotion` is a private app runner named `@lightfast/remotion`. It owns:

- `package.json` runner scripts.
- `dev`, which starts Remotion Studio with `remotion studio src/index.ts`.
- `studio`, if retained as an explicit alias for the same Remotion Studio
  command.
- `render:all`, `render:video`, and `render:stills`.
- `watch`, if a render-on-change loop remains useful.
- `remotion.config.ts`.
- `src/index.ts`, which calls `registerRoot`.
- `src/Root.tsx`, which maps catalog entries to Remotion `Still` and
  `Composition` nodes.
- `src/styles.css`, including Tailwind and UI package CSS imports.
- `src/webpack-override.ts`, because CSS loader setup is runner bundler config.
- `src/render.ts`, because rendering, distribution, and post-processing are
  runner behavior.
- A render manifest or render targets module containing output paths, formats,
  scales, poster frames, render profiles, and post-processing such as
  `favicon.ico` generation.
- Generated output under `apps/remotion/out`, plus deliberate copies into app
  public directories.

`packages/remotion` is a private reusable package named `@repo/remotion`. It
owns:

- Composition React modules under `src/compositions/**`.
- Shared composition helpers and visual primitives used only by Remotion
  compositions.
- An intrinsic composition catalog that describes reusable composition identity:
  composition id, React component, still/video kind, width, height, default
  props, and for videos their default fps and duration.
- Type exports needed by the runner to consume the catalog.

`packages/remotion` does not own:

- Remotion Studio or CLI scripts.
- `registerRoot`.
- A Remotion root component.
- Global runner CSS.
- Webpack or PostCSS loader overrides.
- Output destinations.
- Generated asset distribution.
- Codec/image-format/render-profile policy.
- Favicon or other post-processing.

## Package Interface

The reusable package should expose a small interface with high leverage:

```ts
export { remotionCompositionCatalog } from "./catalog";
export type {
  RemotionCompositionCatalog,
  RemotionCompositionDefinition,
} from "./catalog";
```

The catalog entries can reference component values directly, rather than string
names that require a separate component registry in the runner. This removes
one source of drift between a manifest and `Root.tsx`.

Each catalog entry should describe what the composition is. It should not
describe where outputs are written or which files are copied into other apps.

## Runner Interface

The runner consumes the package catalog and adds runtime policy:

1. `src/Root.tsx` reads `remotionCompositionCatalog`.
2. For each still entry, it renders a Remotion `Still`.
3. For each video entry, it renders a Remotion `Composition`.
4. `src/render-targets.ts` maps composition ids to output formats,
   destinations, render scale, poster-frame extraction, render profiles, and
   post-processing.
5. `src/render.ts` validates that every render target references a known
   catalog entry before rendering.

The runner is the only module that needs to know the monorepo root, app public
directories, Remotion public dir, generated output folders, or bundler
configuration.

## Data Flow

1. A developer runs `pnpm dev --filter @lightfast/remotion`.
2. Remotion Studio starts from `apps/remotion/src/index.ts`.
3. The app runner registers `apps/remotion/src/Root.tsx`.
4. The root reads reusable definitions from `@repo/remotion`.
5. Composition source renders using shared brand primitives from `@repo/ui-v2`.
6. For scripted renders, `apps/remotion/src/render.ts` bundles the app runner,
   renders selected catalog ids, and distributes outputs according to app-owned
   render targets.

## Paper MCP Brand Compositions

The Paper MCP designs become first-class reusable Remotion still compositions in
`packages/remotion`. Their intrinsic layout math belongs with the composition
source:

- canvas dimensions,
- clearspace constants,
- dark background color,
- logo or partnership geometry,
- default props.

Their output destinations belong in `apps/remotion`. The initial render target
can write PNG files to `apps/remotion/out/brand`, with copies into app public
directories added only when a runtime app needs those assets.

## Testing And Verification

- `pnpm --filter @repo/remotion typecheck`
- `pnpm --filter @lightfast/remotion typecheck`
- `pnpm dev --filter @lightfast/remotion` starts Remotion Studio.
- `pnpm --filter @lightfast/remotion render:stills -- --id brand-geometry`
  renders a known still.
- Root helper scripts, if kept, delegate to `@lightfast/remotion`.
- A focused render validates that output still lands in `apps/remotion/out` or
  the intended app public directory.

## Risks

- Remotion entrypoints are path-sensitive, so moving CSS and webpack config can
  break Studio or render bundling.
- Tailwind source scanning may need to include package composition files after
  CSS moves into the app runner.
- Splitting catalog metadata from render targets introduces an id join that
  should be validated by the render script.
- Existing docs and plans may still describe the earlier, leakier split unless
  they are updated or marked superseded.

These risks are contained by moving runner files first, validating Studio, then
validating one still render before adding the Paper MCP-derived compositions.
