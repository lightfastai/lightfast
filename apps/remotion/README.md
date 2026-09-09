# Local Remotion workspace

`@lightfast/remotion` owns the compositions, registration, manifest, shared
rendering helpers, and styles in the local `src/remotion` module. The thin
`src/index.ts`, `src/render.ts`, and `src/watch.ts` adapters own Studio
registration, local rendering/distribution, and source watching. Static assets
and fonts stay in `public`; shared UI imports still come from `@repo/ui-v2`.

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
pnpm --filter @lightfast/remotion dev
pnpm --filter @lightfast/remotion test
```

The watcher renders the video immediately and again when a local composition
`.ts`, `.tsx`, or `.css` file changes. Rendering keeps the existing manifest's
formats, scales, codec/profile, filenames and destinations under
`apps/remotion/out`. Temporary renders live in `.cache/render`; both locations
are local generated output, not publication targets. Studio and rendering
share the CSS override and use `public` unchanged.

## Preservation checks

`src/ownership.test.ts` checks the complete manifest, all registrations and
default props (including the absence of schemas), local output paths, CSS
loader behavior, and hashes for every historical source and static asset.
`src/preservation.json` records the baseline from commit
`60b1a076baf1b1dd936aae0975ad163079db574c`; the sole source-text adjustment is
the manifest's composition-location comment. These are preservation fixtures,
not generated render outputs. Do not refresh them to hide unintended content
changes. Package-local Turbo test inputs include source, fixtures, configuration,
and public assets.
