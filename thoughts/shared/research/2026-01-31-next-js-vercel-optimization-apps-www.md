---
date: 2026-01-31T00:06:41Z
researcher: Claude
git_commit: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Next.js 15/16 Vercel Deployment Optimization for apps/www"
tags: [research, next.js, vercel, optimization, performance, microfrontends, sentry, observability]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Next.js 15/16 Vercel Deployment Optimization for apps/www

**Date**: 2026-01-31T00:06:41Z
**Researcher**: Claude
**Git Commit**: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question

Full optimization of apps/www Next.js app for Vercel deployment with best practices and important caveats. All the most important things performance-wise in terms of Next.js app setup.

## Summary

The `apps/www` application is a **Next.js 16** marketing site (not TanStack Start as initially mentioned) using the App Router pattern. It's deployed on Vercel as part of a **microfrontends architecture** with three apps served through a single domain. The codebase implements comprehensive performance optimizations including:

1. **Package Import Optimization** - 10 packages configured for automatic tree-shaking
2. **Dynamic Imports** - Heavy libraries (PDF export, WebGL, animations) lazy-loaded
3. **Vendor Abstraction Layer** - All third-party integrations wrapped in composable configs
4. **Observability Stack** - Sentry + BetterStack with environment-based feature toggles
5. **Type-Safe Environment** - Composable env schemas with build-time validation
6. **Route Group Architecture** - Nested layouts for progressive UI enhancement

## Detailed Findings

### 1. Next.js Configuration (`apps/www/next.config.ts`)

#### Core Config Structure

```typescript
const wwwConfig: NextConfig = {
  reactStrictMode: true,
  images: { qualities: [10, 75, 100] },  // Required for Next.js 16
  transpilePackages: [/* 14 packages */],
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [/* 10 packages */],
  },
};

let config = withBetterStack(mergeNextConfig(vendorConfig, wwwConfig));
if (env.VERCEL) config = withSentry(config);
if (process.env.ANALYZE === "true") config = withAnalyzer(config);
export default withMicrofrontends(config, { debug: true });
```

#### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `reactStrictMode` | `true` | Development-only checks for deprecated patterns |
| `images.qualities` | `[10, 75, 100]` | **Required for Next.js 16** - explicit quality values |
| `optimizeCss` | `true` | CSS minification and deduplication |
| `transpilePackages` | 14 packages | Hot reload for workspace packages without separate builds |

#### optimizePackageImports

Transforms barrel imports to direct file imports for tree-shaking:

```
@repo/ui, jotai, lucide-react, react-confetti, framer-motion,
date-fns, class-variance-authority, clsx, tailwind-merge,
@paper-design/shaders-react
```

**Caveat**: This optimization only works when packages export from barrel files. The `@repo/ui` package uses explicit subpath exports instead.

---

### 2. Vercel Microfrontends Architecture

#### Configuration (`apps/console/microfrontends.json`)

Three apps served through single domain (lightfast.ai):

| App | Port | Routes | Role |
|-----|------|--------|------|
| `lightfast-console` | 4107 | None (catch-all) | Default/fallback app |
| `lightfast-www` | 4101 | 28 patterns | Marketing site |
| `lightfast-auth` | 4104 | 3 patterns | Authentication |

#### WWW Route Patterns

- Root: `/`
- Marketing: `/pricing`, `/changelog`, `/blog`, `/use-cases`, `/features`, `/early-access`
- Legal: `/legal/:path*`
- Assets: `/images/:path*`, `/fonts/:path*`, favicons
- API: `/api/og/search-demo`, `/api/health`

**Caveat**: The docs app (`/docs`) is **NOT** part of microfrontends - it's proxied externally via Next.js rewrites to `https://lightfast-docs.vercel.app`.

#### Development Setup

```bash
# Each app reads config from console
export VC_MICROFRONTENDS_CONFIG=../../apps/console/microfrontends.json
pnpm with-env:dev next dev --port $(microfrontends port)
```

Port 3024 acts as the proxy routing requests to appropriate apps.

---

### 3. Vendor Config Builder Pattern (`@vendor/next`)

#### Composable Config Functions

```typescript
// vendor/next/src/next-config-builder.ts
export const config: NextConfig = { /* base config */ };
export function withSentry(sourceConfig: NextConfig): NextConfig;
export function withBetterStack(sourceConfig: NextConfig): NextConfig;
export function withAnalyzer(sourceConfig: NextConfig): NextConfig;

// vendor/next/src/merge-config.ts
export function mergeNextConfig(base: NextConfig, custom: DeepPartial<NextConfig>): NextConfig;
```

#### Base Vendor Config Features

1. **PostHog Proxy Rewrites** - `/ingest/*` routes to bypass ad-blockers
2. **Health Check Rewrites** - `/health`, `/healthz` → `/api/health`
3. **Security Headers** - HSTS preload, Document-Policy for JS profiling
4. **Image Optimization** - WebP format, remote patterns for CDNs
5. **Vercel Toolbar** - Development overlay

**Caveat**: `skipTrailingSlashRedirect: true` is required for PostHog API requests to work correctly.

#### Sentry Config Highlights

```typescript
const sentryConfig = {
  tunnelRoute: "/monitoring",  // Bypass ad-blockers
  hideSourceMaps: true,
  disableLogger: true,        // Tree-shake logger statements
  automaticVercelMonitors: true,
  reactComponentAnnotation: { enabled: true },
};
```

---

### 4. Bundle Optimization Patterns

#### Dynamic Imports

| Library | Pattern | Purpose |
|---------|---------|---------|
| `unicornstudio-react` | `dynamic(..., { ssr: false })` | WebGL excluded from SSR |
| `react-confetti` | `dynamic(..., { ssr: false })` | Animation on client only |
| `html2canvas-pro`, `jspdf` | Async function import | PDF export on-demand |
| `framer-motion` | `LazyMotion features={loadMotionFeatures}` | Defer 15-18kb bundle |

#### Example: Lazy PDF Export

```typescript
// export-slides-lazy.ts
export async function exportSlidesToPdfLazy(options): Promise<void> {
  const { exportSlidesToPdf } = await import("./export-slides");
  return exportSlidesToPdf(options);
}
```

**Caveat**: The download button imports `export-slides-lazy.ts`, which only loads `export-slides.ts` (and its heavy dependencies) when clicked.

#### "use client" / "use server" Distribution

- **"use client"**: 42 files (interactive components, forms, navigation, animations)
- **"use server"**: 8 files (server actions, data fetching)

**Pattern**: Server components are default. Client directive only where interactivity required.

---

### 5. Observability Setup

#### Instrumentation Files

- `instrumentation.ts` - Server-side Sentry init (Node.js and Edge runtimes)
- `instrumentation-client.ts` - Client Sentry with Session Replay

#### Server-Side Config

```typescript
// instrumentation.ts
if (process.env.NEXT_RUNTIME === "nodejs") {
  init({ dsn, environment, tracesSampleRate: 1.0 });
}
if (process.env.NEXT_RUNTIME === "edge") {
  init({ dsn, environment, tracesSampleRate: 1.0 });
}
```

#### Client-Side Config

```typescript
// instrumentation-client.ts
init({
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: env === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [replayIntegration({ maskAllText: true, blockAllMedia: true })],
});
```

**Caveats**:
- Sentry only enabled when `env.VERCEL` is truthy (not local dev)
- Session replay masks all text and blocks all media for privacy
- 100% error replay capture, 10% general session capture in production

#### Logging

- **Production/Preview**: BetterStack via `@logtail/next`
- **Development**: Console fallback

---

### 6. Environment Configuration

#### Schema Composition

```typescript
// apps/www/src/env.ts
export const env = createEnv({
  extends: [
    vercel(),           // VERCEL_* variables
    betterstackEnv,     // Logging
    sentryEnv,          // Error tracking
    securityEnv,        // Arcjet
    emailEnv,           // Resend
    inngestEnv,         // Workflows
    posthogEnv,         // Analytics
    nextEnv,            // Next.js specific
    upstashEnv,         // Redis KV
  ],
  // ...
});
```

**Caveat**: Environment validation is skipped when:
- `process.env.CI === "true"`
- `process.env.npm_lifecycle_event === "lint"`

This prevents CI failures when not all secrets are available.

#### Loading Scripts

```json
{
  "with-env:dev": "dual run --",
  "with-env:prod": "dotenv -e ./.vercel/.env.development.local --"
}
```

**Source of truth**: `.vercel/.env.development.local` (31 variables)

---

### 7. App Router Structure

#### Layout Hierarchy

```
Root layout (fonts, providers, analytics)
└─ (app) [pass-through]
   ├─ (marketing) [navbar + fixed footer]
   │  └─ (content) [waitlist CTA]
   │     ├─ blog [RSS link]
   │     │  └─ (listing) [category nav]
   │     ├─ changelog
   │     └─ pricing
   └─ (internal)
      └─ pitch-deck [cookie-based state]
```

**Pattern**: Route groups add UI layers without affecting URL paths.

#### Key Layouts

| Layout | Purpose |
|--------|---------|
| `root/layout.tsx` | Fonts, PostHog, Vercel Analytics, Microfrontends |
| `(marketing)/layout.tsx` | Fixed navbar + footer reveal pattern |
| `(content)/layout.tsx` | Waitlist CTA at bottom |
| `(search)/layout.tsx` | Fullscreen dark mode |
| `pitch-deck/layout.tsx` | Server-side cookie read, custom nav |

#### Feed Routes

Blog and changelog have RSS/Atom/JSON feeds:
- Revalidate: 3600 seconds (1 hour)
- Content-Type headers set correctly
- Cache-Control: 1 hour

#### Static Generation

```typescript
// blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await blog.getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export const revalidate = 300; // 5 minutes
```

---

## Code References

### Configuration Files
- `apps/www/next.config.ts:23-69` - WWW-specific config
- `apps/www/next.config.ts:72-85` - Plugin composition chain
- `apps/console/microfrontends.json:11-51` - WWW route patterns
- `vendor/next/src/next-config-builder.ts:10-74` - Base vendor config
- `vendor/next/src/next-config-builder.ts:76-119` - Sentry config
- `vendor/next/src/merge-config.ts:80-149` - Config merge logic

### Instrumentation
- `apps/www/src/instrumentation.ts:1-30` - Server-side init
- `apps/www/src/instrumentation-client.ts:1-49` - Client-side init
- `vendor/observability/src/log.ts:1-13` - Conditional BetterStack/console

### Bundle Optimization
- `apps/www/src/components/unicorn-scene.tsx:6-9` - WebGL dynamic import
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides-lazy.ts:9-14` - PDF lazy load
- `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/motion-features.ts:8-9` - Framer Motion lazy

### Environment
- `apps/www/src/env.ts:16-75` - Full env schema
- `vendor/observability/src/env/sentry-env.ts:4-22` - Sentry env
- `apps/www/package.json:20-21` - Environment loading scripts

### Layouts
- `apps/www/src/app/layout.tsx:147-164` - Root provider stack
- `apps/www/src/app/(app)/(marketing)/layout.tsx:10-31` - Marketing layout
- `apps/www/src/app/global-error.tsx:19-22` - Global error capture

## Architecture Documentation

### Build Pipeline

```
1. Environment validation (~/env import side-effect)
2. Vendor config loaded (base config + security headers + rewrites)
3. WWW config merged (transpile, optimize, images)
4. BetterStack wrapper applied (always)
5. Sentry wrapper applied (Vercel only)
6. Bundle analyzer applied (ANALYZE=true only)
7. Microfrontends wrapper applied (routing)
8. Turbopack build (--turbopack flag)
```

### Request Flow

```
1. Request to lightfast.ai
2. Vercel microfrontends routes by path pattern
3. /ingest/* proxied to PostHog (bypasses ad-blockers)
4. /monitoring tunnels to Sentry (bypasses ad-blockers)
5. /health rewrites to /api/health
6. /docs proxies to external docs app
7. Unmatched routes fall through to console app
```

### Environment Flow

```
1. Vercel CLI pulls to .vercel/.env.development.local
2. dual/dotenv loads variables into process.env
3. createEnv validates with Zod schemas
4. Type-safe env object exported
5. Next.js config imports env (triggers validation)
6. Server vars available in Node.js
7. Client vars via experimental__runtimeEnv
```

## Important Caveats

### Next.js 16 Breaking Changes
- `images.qualities` is now **required** - must explicitly set quality values
- Type boundaries between Next.js 15 vendor functions and 16 config require casting

### Microfrontends Gotchas
- Docs app is **NOT** in microfrontends - uses Next.js rewrites instead
- Console app has no routing array - acts as catch-all
- Port resolution via `$(microfrontends port)` reads from package.json name field

### Sentry Configuration
- Tunnel route `/monitoring` prevents ad-blocker interference
- Session replay masks all text by default (privacy)
- Sentry only enabled on Vercel deployments, not local dev

### PostHog Integration
- Rewrites route through `/ingest/*` to bypass ad-blockers
- `skipTrailingSlashRedirect: true` required for API requests

### Bundle Optimization
- `@repo/ui` uses **explicit subpath exports**, not barrel files
- `optimizePackageImports` only helps packages with barrel exports
- Heavy libraries (PDF, WebGL) must be manually lazy-loaded

### Environment Validation
- Skipped in CI and lint contexts to prevent false failures
- Empty strings treated as undefined (`emptyStringAsUndefined: true`)
- Client vars must be in both `client` schema AND `experimental__runtimeEnv`

### Route Groups
- `(health)` separates health check from app routes (avoids middleware)
- Blog uses parallel route `(landing)` for homepage at marketing root
- Pitch deck reads cookies server-side for initial state

## Open Questions

1. **Why is docs app not in microfrontends?** - Appears to be deployed separately to `lightfast-docs.vercel.app` and proxied via rewrites
2. **Turbopack stability** - Both dev and build use `--turbopack` flag; any known issues with Next.js 16?
3. **Session replay privacy** - Is masking all text too aggressive? Could use targeted selectors instead
4. **Static generation scope** - Only blog posts use `generateStaticParams`; changelog could benefit from same pattern
