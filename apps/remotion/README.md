# Local Remotion workspace

`@lightfast/remotion` owns the compositions, registration, manifest, shared
rendering helpers, and styles in the local `src/remotion` module. The thin
`src/index.ts`, `src/render.ts`, and `src/watch.ts` adapters own Studio
registration, local rendering/distribution, and source watching. Static assets
and fonts stay in `public`; shared UI imports still come from `@repo/ui`.

## Local commands

From the repository root:

```sh
pnpm remotion:studio
pnpm remotion:render
pnpm --filter @lightfast/remotion studio
pnpm --filter @lightfast/remotion render:all
pnpm --filter @lightfast/remotion render:video
pnpm --filter @lightfast/remotion render:stills
pnpm --filter @lightfast/remotion render:stills --id logo-1024
pnpm --filter @lightfast/remotion render:brand
pnpm --filter @lightfast/remotion dev
pnpm --filter @lightfast/remotion test
```

The watcher renders the video immediately and again when a local composition
`.ts`, `.tsx`, or `.css` file changes. Rendering keeps the existing manifest's
formats, scales, codec/profile, filenames and destinations under
`apps/remotion/out`. Temporary renders live in `.cache/render`; both locations
are local generated output, not publication targets. Studio and rendering
share the CSS override and use `public` unchanged.

## Individual dotted logo assets

Each composition below is separately selectable in Remotion Studio and can
be rendered on its own. For example:

```sh
pnpm --filter @lightfast/remotion render:brand --id brand-logo-black
pnpm --filter @lightfast/remotion render:brand --id brand-icon-16
```

Outputs stay in `apps/remotion/out/brand-assets` (ignored):

| Composition | Standalone output |
| --- | --- |
| `brand-symbol-black` | `lightfast-symbol-black.svg` |
| `brand-symbol-white` | `lightfast-symbol-white.svg` |
| `brand-logo-black` | `lightfast-logo-black.svg` |
| `brand-logo-white` | `lightfast-logo-white.svg` |
| `brand-icon-16` | `favicon-16x16.png` |
| `brand-icon-32` | `favicon-32x32.png` |
| `brand-icon-48` | `favicon-48x48.png` |
| `brand-icon-180` | `apple-touch-icon.png` |
| `brand-icon-192` | `android-chrome-192x192.png` |
| `brand-icon-512` | `android-chrome-512x512.png` |
| `brand-icon-1024` | `lightfast-symbol-1024.png` |

`pnpm --filter @lightfast/remotion render:brand` generates all these individual
files and the standard `favicon.ico` containing the exact 16/32/48px PNG
frames. An individual icon render does not rebuild ICO from stale files.
There is no contact sheet or archive. Historical media is not rendered by
this command; its compositions and output contracts remain available.

`src/brand.tsx` uses the canonical paths and lockup metrics from
`packages/ui/src/components/brand/logo.tsx`. SVG export serializes the same
component registered in Studio, without requiring installed fonts. SVGs are
transparent black/white variants; PNGs are a black symbol on an opaque white
square. The 3L exclusion zone is exactly 36 units around the 80-unit mark.
Lockup alignment uses `getLogoMetrics(80)` and `WORDMARK_LOCKUP_VIEWBOX`.
Studio composition dimensions round up to whole pixels; the SVG file retains
its exact fractional viewBox and aspect ratio.

At 16px the mark is 8.42px across with 0.84px dots, so the original circles
are visibly antialiased. No dot thickening or clearspace reduction is applied.
Use white SVGs on a contrasting dark surface and the full lockup as the
default public logo; the standalone symbol is for compact icons and favicons.
See the [public brand guidance](https://lightfast.ai/brand).

Each rendered file is checked for its format and canonical geometry; PNG
checks also cover opacity, grayscale, circle coverage and clearspace. The
standard ICO is checked against its exact PNG frames. A technical receipt in
`.cache/brand-render-receipt.json` records the generating commit, dirty-tree
flag, geometry hashes and hashes of the files rendered in that invocation.
Render from a clean committed checkout for handoff. PNG byte reproduction
requires the same Remotion/Chromium versions and platform.

Production favicon/head/manifest adoption belongs to a separate follow-up in
`lightfastai/www`. This command does not copy files to that repository or
deploy. Android outputs are ordinary icons; no maskable artwork, web manifest,
new palette or optical variant is supplied.

## Preservation checks

`src/ownership.test.ts` checks the complete historical manifest, all registrations and
default props (including the absence of schemas), local output paths, CSS
loader behavior, and hashes for every historical source and static asset.
`src/preservation.json` records the baseline from commit
`60b1a076baf1b1dd936aae0975ad163079db574c`, with the migration's composition-location
comment adjustment. The fixture stays unchanged: tests remove only the explicit
brand imports/registry entries and manifest additions before checking the
original assembly hashes and historical manifest. All historical composition
and static asset bytes remain checked, including Lissajous editorial media.
These are preservation fixtures,
not generated render outputs. Do not refresh them to hide unintended content
changes. Package-local Turbo test inputs include source, fixtures, configuration,
and public assets.
