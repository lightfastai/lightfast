# Lightfast Astro Example

Static Astro port of the Lightfast v2 landing page.

## Commands

```sh
pnpm --filter @lightfast/astro-example dev
pnpm --filter @lightfast/astro-example build
pnpm --filter @lightfast/astro-example preview
pnpm --filter @lightfast/astro-example analyze
```

## Vercel

Import this app as its own Vercel project with:

- Root Directory: `apps/astro-example`
- Framework Preset: `Astro`
- Build Command: default (`pnpm build`)
- Output Directory: default (`dist`)

The app uses the official Astro Vercel adapter as a foundation for future
Vercel features while still rendering the current landing page statically.

Reference: https://docs.astro.build/en/guides/integrations-guide/vercel/
