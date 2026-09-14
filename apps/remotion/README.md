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

## Dotted public asset pack

`pnpm --filter @lightfast/remotion render:brand` renders only the eight brand
compositions, exports four SVGs, packs the three current favicon frames into
ICO, verifies the actual output pixels and formats, and writes a portable ZIP.
It does not render the historical media. All files stay in
`apps/remotion/out/brand-pack` (ignored); the command has no website-copy or
deployment step.

| Output | Use |
| --- | --- |
| `lightfast-symbol-black.svg`, `lightfast-symbol-white.svg` | Transparent symbol, compact icons |
| `lightfast-logo-black.svg`, `lightfast-logo-white.svg` | Transparent full lockup, default public logo |
| `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` | Native favicon sizes |
| `favicon.ico` | Exact 16/32/48 PNG frames |
| `apple-touch-icon.png` | 180px opaque icon |
| `android-chrome-192x192.png`, `android-chrome-512x512.png` | Ordinary Android icons, not maskable |
| `lightfast-symbol-1024.png` | High-resolution symbol |
| `preview.png` | Actual files, native small pixels plus nearest-neighbor enlargements |
| `manifest.json`, `README.txt`, `lightfast-brand-pack.zip` | Source/checksum receipt, usage notes, portable pack |

`src/brand.tsx` imports the canonical paths and lockup metrics from
`packages/ui/src/components/brand/logo.tsx`. It does not duplicate paths or
depend on installed fonts. SVGs use exact black/white; PNGs use a black symbol
on an opaque white square. The public 3L exclusion zone is derived from the
12-unit dot pitch: 36 units around the 80-unit mark. Lockup alignment uses
`getLogoMetrics(80)` and `WORDMARK_LOCKUP_VIEWBOX` unchanged.

At 16px, that padding leaves an 8.42px mark with 0.84px dots, so the original
circles are visibly antialiased. This pack does not thicken dots or reduce
clearspace. Use white SVGs on a contrasting dark surface and preserve the
supplied aspect ratio and exclusion zone. See the
[public brand guidance](https://lightfast.ai/brand).

The receipt records the source commit, whether the source tree was dirty,
geometry hashes, and SHA-256 hashes of all 13 image assets. For a release-ready
handoff, render from a clean committed checkout and require
`sourceTreeDirty: false`. PNG byte reproduction requires the same Remotion
and Chromium versions/platform; the ZIP uses fixed metadata and sorted files.
The command verifies PNG size, opacity, grayscale, circle coverage and 3L
bounds; SVG source fidelity; ICO frame byte identity; and populated preview
panels before writing the archive. Inspect `preview.png` before adoption.

`--id brand-preview` rerenders its seven icon dependencies and the complete
pack. An individual icon render does not repack ICO from stale frames.
Unknown IDs, modes and incompatible filters fail before rendering.

The production favicon/head/manifest rollout remains a separate follow-up in
`lightfastai/www`; this pack does not change that repository or live site.
No maskable artwork, web manifest, new palette, or optical variant is supplied.

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
