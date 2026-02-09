---
date: 2026-02-09T19:00:00-08:00
researcher: architect-agent
topic: "Next.js Config Optimizations"
tags: [research, architecture, build-optimization, next-js, config, react-compiler, swc]
status: complete
based_on:
  - 2026-02-09-console-build-codebase-deep-dive.md
  - 2026-02-09-web-analysis-next-js-15-config-optimization.md
priority: HIGH
estimated_impact: "10-30% bundle reduction, 5-15% runtime improvement"
---

# Optimization Strategy: Next.js Config Optimizations

## Executive Summary

The current `apps/console/next.config.ts` uses a vendor abstraction layer (`@vendor/next`) with Sentry and BetterStack wrappers. While it already enables `optimizeCss` and basic `optimizePackageImports`, several high-impact configurations are missing: React Compiler, bundle analyzer integration, SWC production optimizations, `cssChunking`, and the `turbopackScopeHoisting` flag is explicitly disabled without clear justification. This document proposes specific additions to the Next.js configuration with testing strategies for each.

## Current State (from Codebase Analysis)

### Current Configuration Stack

```
withMicrofrontends(
  withSentry(
    withBetterStack(
      mergeNextConfig(vendorConfig, appConfig)
    )
  )
)
```

**Vendor base config** (`vendor/next/src/next-config-builder.ts`):
- Image optimization: WebP only, CDN remote patterns
- PostHog analytics proxy rewrites
- Security headers (HSTS, document-policy)
- `skipTrailingSlashRedirect: true`

**App-specific config** (`apps/console/next.config.ts`):
- `reactStrictMode: true`
- `transpilePackages`: 26 internal packages
- `experimental.optimizeCss: true`
- `experimental.optimizePackageImports`: `["@repo/ui", "lucide-react"]`
- `experimental.turbopackScopeHoisting: false` (WHY?)
- Docs rewrites

### Critical Discovery: Console Already Uses Turbopack for Production

The codebase deep dive revealed that `apps/console/package.json` build scripts use `--turbopack`:
```json
"build:prod": "pnpm with-env:prod next build --turbopack",
"dev": "... next dev --port $(microfrontends port) --turbo",
```

This means `turbopackScopeHoisting: false` is **actively degrading production bundle sizes** since Turbopack is the production bundler. Fixing this is even more critical than initially assessed.

### What's Missing

| Feature | Status | Impact |
|---------|--------|--------|
| React Compiler | Not enabled | 5-15% runtime improvement |
| Bundle analyzer | Available in vendor but not wired | Visibility into optimization |
| `cssChunking` | Not enabled | Per-route CSS loading |
| SWC `removeConsole` | Not enabled (chat app has it) | Bundle size reduction |
| `turbopackScopeHoisting` | Explicitly disabled (`false`) | **Active bundle size regression** |
| `serverComponentsHmrCache` | Not enabled | Faster HMR in dev |
| Standalone output | Not configured | Docker deployment optimization |
| Missing `optimizePackageImports` | `recharts`, `shiki`, `date-fns`, `@radix-ui/*` missing | Heavy libs not optimized |

### Vendor Bundle Analyzer (Already Available!)

The `@vendor/next` package already exports `withAnalyzer` (`vendor/next/src/next-config-builder.ts:129-131`) which wraps `@next/bundle-analyzer`. The WWW app already uses it conditionally (`apps/www/next.config.ts:81-82`), but the console app doesn't.

## Proposed Solution

### Phase 1: Enable Bundle Analyzer (Prerequisite)

**What**: Wire up the existing `withAnalyzer` from `@vendor/next`

**Why**: Without bundle analysis data, all other optimizations are guesswork. The vendor package already has `@next/bundle-analyzer` as a dependency - it just needs to be connected.

**How**:

```typescript
// apps/console/next.config.ts
import {
  config as vendorConfig,
  withAnalyzer, // Already exported!
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";

// Wrap the final config conditionally
let finalConfig = withMicrofrontends(config, { debug: true });

if (process.env.ANALYZE === "true") {
  finalConfig = withAnalyzer(finalConfig);
}

export default finalConfig;
```

**Usage**:
```bash
ANALYZE=true pnpm build:console
```

**Expected Impact**: Zero runtime impact - development tooling only
**Risk**: None - conditional, dev-only

### Phase 2: Fix `turbopackScopeHoisting: false` (CRITICAL - Active Production Regression)

**Priority**: **CRITICAL** - This is actively degrading production bundle quality RIGHT NOW.

**What**: Remove `turbopackScopeHoisting: false` to re-enable scope hoisting (the default)

**Why**: Scope hoisting is a **critical** bundler optimization that combines modules into fewer function scopes, reducing:
- Function call overhead
- Module wrapper boilerplate
- Bundle size (typically 5-15% reduction)

Since the console **already uses Turbopack for production builds** (`build:prod` uses `--turbopack`), `turbopackScopeHoisting: false` at `apps/console/next.config.ts:54` means scope hoisting is **disabled in every production deployment**. This is actively shipping larger bundles to users. It was likely set during early Turbopack adoption when scope hoisting had bugs, but should be re-evaluated immediately.

**How**:

Step 1: Enable bundle analyzer first (Phase 1 prerequisite) to measure impact

Step 2: Record baseline bundle sizes with scope hoisting OFF:
```bash
ANALYZE=true pnpm build:console  # Baseline with turbopackScopeHoisting: false
```

Step 3: Remove the explicit `false`:
```typescript
experimental: {
  optimizeCss: true,
  optimizePackageImports: ["@repo/ui", "lucide-react"],
  // turbopackScopeHoisting: false, // REMOVED - re-enable default (true)
}
```

Step 4: Build again and compare:
```bash
ANALYZE=true pnpm build:console  # Compare with scope hoisting enabled
```

Step 5: Run the production build locally and test critical routes for runtime errors

Step 6: If scope hoisting causes runtime errors, add back with a documented reason:
```typescript
// KNOWN ISSUE: turbopackScopeHoisting disabled due to [specific runtime error]
// Affects: [specific module/component]
// Tracked in: [issue URL]
// Re-evaluate after Next.js [version]
turbopackScopeHoisting: false,
```

**Expected Impact**: 5-15% production bundle size reduction
**Risk**: Medium - scope hoisting can cause issues with certain module patterns (circular dependencies, side effects). The existence of `@repo/console-backfill` with side-effect imports is a potential concern. Test thoroughly, especially around connector registration.

### Phase 3: Enable SWC `removeConsole` for Production

**What**: Configure SWC compiler to strip console.log statements in production builds

**Why**: Console statements add to bundle size and can leak sensitive information in production. The chat app already uses this (`apps/chat/next.config.ts:20-21`), but console app doesn't.

**How**:

```typescript
// apps/console/next.config.ts - add to mergeNextConfig second argument
mergeNextConfig(vendorConfig, {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  transpilePackages: [...],
  experimental: {...},
})
```

**Expected Impact**: 1-3% bundle reduction, cleaner production output
**Risk**: Low - preserves `console.error` and `console.warn` for debugging

### Phase 4: Enable `cssChunking`

**What**: Enable experimental CSS chunking for per-route CSS loading

**Why**: Currently, CSS is bundled monolithically. With `cssChunking`, each route loads only its required CSS, reducing initial payload.

**How**:

```typescript
experimental: {
  optimizeCss: true,
  cssChunking: true, // Or 'strict' for import order preservation
  // ...
}
```

**When to use `cssChunking` vs `inlineCss`**:
- `cssChunking`: Better for apps with many routes (console has many) - loads CSS per route
- `inlineCss`: Better for small CSS bundles - eliminates CSS network requests but bloats HTML
- Console uses Tailwind CSS (atomic, relatively small) but has many routes → `cssChunking` is the better choice

**Expected Impact**: 10-20% reduction in initial CSS payload per route
**Risk**: Low - experimental but well-tested. Use `'strict'` if CSS ordering issues appear.

### Phase 5: Test React Compiler (Opt-in Mode)

**What**: Enable React Compiler in annotation mode for selective optimization

**Why**: React Compiler provides automatic memoization that eliminates the need for manual `useMemo`, `useCallback`, and `memo`. Real-world feedback shows 5-15% runtime improvements for large apps.

**How**:

Step 1: Install dependency:
```bash
cd apps/console && pnpm add -D babel-plugin-react-compiler
```

Step 2: Configure in opt-in mode:
```typescript
experimental: {
  reactCompiler: {
    compilationMode: 'annotation', // Only compile files with 'use memo' directive
  },
}
```

Step 3: Test on a complex component:
```typescript
// apps/console/src/components/jobs-table.tsx
'use memo'; // Opt this file into React Compiler

// Component code remains unchanged - compiler auto-memoizes
```

Step 4: Profile with React DevTools to validate improvement

**Trade-off**: React Compiler requires Babel plugin, which is slower than pure SWC. However, Next.js's custom SWC plugin only applies the compiler to files with JSX/hooks, minimizing the overhead.

**Expected Impact**: 5-15% runtime performance improvement on compiled components
**Risk**: Medium - experimental feature. Start with `annotation` mode to limit blast radius.

### Phase 6: Enable `serverComponentsHmrCache`

**What**: Enable HMR caching for Server Components in development

**Why**: Caches `fetch()` responses across HMR refreshes in development, reducing unnecessary API calls during development.

**How**:

```typescript
experimental: {
  serverComponentsHmrCache: true,
}
```

**Expected Impact**: Faster HMR in development (no production impact)
**Risk**: None - dev-only feature

### Phase 7: Evaluate Standalone Output

**What**: Consider `output: 'standalone'` for deployment optimization

**Why**: Standalone mode uses `@vercel/nft` to trace only necessary files, producing minimal deployments. However, Lightfast deploys on Vercel (not Docker), so this may not be beneficial.

**How** (if Docker deployment is ever needed):
```typescript
output: 'standalone',
```

**Decision**: **SKIP for now** - Vercel handles optimization automatically. Only enable if moving to Docker/self-hosted deployment.

**Risk**: N/A - not recommended for current Vercel deployment

## Code Examples

### Complete Proposed next.config.ts

```typescript
import { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "./src/env";

import {
  config as vendorConfig,
  withAnalyzer,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";
import { getDocsUrl } from "@repo/app-urls";

const config: NextConfig = withSentry(
  withBetterStack(
    mergeNextConfig(vendorConfig, {
      reactStrictMode: true,
      // Phase 3: Strip console.log in production
      compiler: {
        removeConsole: process.env.NODE_ENV === "production"
          ? { exclude: ["error", "warn"] }
          : false,
      },
      transpilePackages: [
        // ... existing 26 packages ...
      ],
      experimental: {
        optimizeCss: true,
        // Phase 4: Per-route CSS loading
        cssChunking: true,
        // Phase 1 (from barrel-files doc): Expanded package list
        optimizePackageImports: [
          "@repo/ui",
          "lucide-react",
          "@repo/lib",
          "@repo/console-types",
          "@repo/console-validation",
          "@repo/console-config",
          // ... see barrel-files doc for full list
        ],
        // Phase 2: Scope hoisting re-enabled (default)
        // turbopackScopeHoisting removed - defaults to true

        // Phase 5: React Compiler (opt-in mode)
        // reactCompiler: { compilationMode: 'annotation' },

        // Phase 6: HMR caching for dev
        serverComponentsHmrCache: true,
      },
      async rewrites() {
        // ... existing docs rewrites ...
      },
    }),
  ),
);

// Phase 1: Bundle analysis support
let finalConfig = withMicrofrontends(config, { debug: true });
if (process.env.ANALYZE === "true") {
  finalConfig = withAnalyzer(finalConfig);
}

export default finalConfig;
```

## Implementation Checklist

- [ ] **Phase 1** (15 min): Wire up `withAnalyzer` from `@vendor/next`
- [ ] **Phase 1** (15 min): Run `ANALYZE=true pnpm build:console` for baseline
- [ ] **Phase 2** (30 min): Remove `turbopackScopeHoisting: false`, test build
- [ ] **Phase 2** (30 min): Compare bundle sizes with analyzer
- [ ] **Phase 3** (15 min): Add `removeConsole` compiler option
- [ ] **Phase 4** (15 min): Enable `cssChunking: true`
- [ ] **Phase 5** (1 hour): Install and test React Compiler in annotation mode
- [ ] **Phase 5** (30 min): Profile a complex component with React DevTools
- [ ] **Phase 6** (5 min): Enable `serverComponentsHmrCache`
- [ ] **Final** (30 min): Full build + bundle comparison

## Success Metrics

- **Bundle size per route**: Measured via `@next/bundle-analyzer` treemap
- **First-load JS**: Track shared chunks size (current unknown, target: <200KB)
- **Build time**: `time pnpm build:console` before/after
- **Lighthouse score**: Performance audit on key routes
- **HMR speed**: Subjective dev experience improvement (Phase 6)

## Trade-offs

| Factor | Before | After | Notes |
|--------|--------|-------|-------|
| Build complexity | Simple | Moderate | More config options to maintain |
| Bundle size | Unoptimized | 10-30% smaller | Cumulative effect of all phases |
| Runtime performance | Manual memoization | Auto-memoized | React Compiler handles it |
| CSS loading | Monolithic | Per-route | `cssChunking` splits CSS |
| Console logs | In production | Stripped | Cleaner, smaller production builds |
| Dev HMR | Full refetch | Cached | `serverComponentsHmrCache` |
| Build time | Baseline | -5-10% | Scope hoisting + fewer modules |

## References

- Codebase findings: `apps/console/next.config.ts:1-76`, `vendor/next/src/next-config-builder.ts:1-140`
- Vendor analyzer: `vendor/next/src/next-config-builder.ts:129-131` (already available)
- Chat app precedent: `apps/chat/next.config.ts:20-21` (removeConsole already used)
- WWW app precedent: `apps/www/next.config.ts:81-82` (withAnalyzer conditionally applied)
- External research: React Compiler 5-15% improvement, CSS chunking per-route optimization
- turbopackScopeHoisting concern: `apps/console/next.config.ts:54` - disabled without documented reason
