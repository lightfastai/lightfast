# Remotion Runner Split Design

## Context

Lightfast currently keeps Remotion source and runnable tooling together in
`packages/app-remotion`. That package owns compositions, the manifest, Remotion
Studio, render/watch scripts, output routing, and Remotion config. This differs
from the React Email setup, where `apps/email` is a thin workbench over reusable
templates in `packages/email`.

The Remotion migration should follow the same boundary: app packages run tools,
repo packages own reusable source.

## Goals

- Move the Remotion runner to `apps/remotion`.
- Move reusable Remotion compositions to `packages/remotion`.
- Rename the reusable package from `@repo/app-remotion` to `@repo/remotion`.
- Add future Paper MCP migrations as package-owned compositions rendered through
  the app runner.
- Keep brand geometry and logo math sourced from `@repo/ui-v2` so rendered
  assets stay aligned with the product UI brand primitives.

## Non-Goals

- Do not redesign existing rendered assets as part of the runner split.
- Do not make Remotion part of the root `pnpm dev` service graph.
- Do not import Remotion into shared UI packages.
- Do not change the `@vendor/remotion` third-party wrapper except where import
  paths require normal maintenance.

## Architecture

`apps/remotion` will be a private runner package named `@lightfast/remotion`.
It owns:

- Remotion CLI scripts such as `studio`, `render:all`, `render:video`, and
  `render:stills`.
- `remotion.config.ts`.
- The Remotion registration entrypoint that calls `registerRoot`.
- Render/watch scripts and output distribution.
- Local generated output under `apps/remotion/out` unless an output is meant to
  be copied into an app public directory.

`packages/remotion` will be a private reusable package named `@repo/remotion`.
It owns:

- The composition manifest.
- All existing Remotion compositions currently under `packages/app-remotion`.
- Shared composition helpers, CSS, and the component registry data needed by the
  runner.
- New Paper MCP-derived brand compositions:
  `brilliant-mist-logo-square-clearspace-dark` and
  `brand-partnership-clearspace-dark`.

`@vendor/remotion` remains the sole third-party Remotion abstraction. Remotion
source imports `@vendor/remotion` rather than Remotion packages directly.

## Data Flow

1. A developer runs `pnpm --filter @lightfast/remotion studio` or a root helper
   such as `pnpm remotion:studio`.
2. `apps/remotion` loads the root component and render scripts.
3. The root component consumes exports from `@repo/remotion`, including the
   manifest and registered composition components.
4. `@repo/remotion` compositions render using shared brand primitives from
   `@repo/ui-v2`.
5. Render outputs are written to `apps/remotion/out` for local artifacts and
   copied to app public directories only for canonical runtime assets such as
   favicons or social images.

## Migration Plan

1. Create `apps/remotion` with the runner package metadata, Remotion config, and
   scripts modeled after `apps/email`.
2. Rename `packages/app-remotion` to `packages/remotion` and update its package
   name to `@repo/remotion`.
3. Move runner-only files from the package into `apps/remotion`, leaving reusable
   compositions and manifest code in `packages/remotion`.
4. Update root scripts, package imports, `knip`, and output paths from
   `packages/app-remotion` to the new package/app locations.
5. Run typecheck and focused Remotion render validation for at least one still.
6. Add the Paper MCP brand compositions after the runner/package boundary is
   stable.

## Paper MCP Brand Compositions

The Paper MCP designs should become first-class Remotion stills, not ad hoc
export scripts. Their dimensions, dark background color, clearspace math, and
partnership spacing should be encoded as composition props or constants in
`packages/remotion`.

The brand logo itself should continue to use `@repo/ui-v2` logo primitives and
metrics, including `DOT_MATRIX_PATH`, `getLogoMetrics`, and related constants.
Only layout-specific presentation belongs in the Remotion composition.

## Testing And Verification

- `pnpm --filter @repo/remotion typecheck`
- `pnpm --filter @lightfast/remotion typecheck`
- `pnpm remotion:studio` starts against the app runner.
- `pnpm remotion:render -- --id <known-still>` or the equivalent package script
  renders a representative still.
- Confirm generated assets land in `apps/remotion/out` or the intended public
  directory.

## Risks

- Remotion entrypoints are path-sensitive, so moving the runner can break
  public-dir or CSS loader resolution.
- Output path churn can accidentally move generated assets away from where apps
  expect them.
- Package rename churn can leave stale references in root scripts, `knip`, or
  the lockfile.

These risks are contained by moving the runner boundary first, validating one
existing still, and only then adding the new Paper MCP-derived compositions.
