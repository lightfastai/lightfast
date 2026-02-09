# Console Next.js Config Optimizations Implementation Plan

## Overview

Optimize the `apps/console/next.config.ts` to reduce bundle sizes by 10-30%, improve runtime performance by 5-15%, and enhance developer experience through HMR improvements. The plan applies proven patterns from sibling apps (www, chat) and fixes an active production regression where `turbopackScopeHoisting: false` degrades bundle quality despite Turbopack being used in production builds.

## Current State Analysis

**File**: `apps/console/next.config.ts:1-77`

The console app configuration currently:
- Uses vendor abstraction layer with Sentry and BetterStack wrappers
- Transpiles 26 internal packages
- Has `experimental.optimizeCss: true` enabled
- Only optimizes 2 packages: `@repo/ui` and `lucide-react`
- **Critical issue**: `turbopackScopeHoisting: false` at line 54 (active regression)
- Production builds use `--turbopack` flag (`package.json:9`)
- Missing bundle analyzer (despite `@vendor/next` exporting `withAnalyzer`)
- No SWC `removeConsole` option (chat app has this)
- No CSS chunking for per-route loading

### Key Discoveries:

- **Active regression**: `apps/console/next.config.ts:54` - scope hoisting disabled while using Turbopack in production, resulting in larger bundles shipping to users right now
- **WWW precedent**: `apps/www/next.config.ts:81-82` - already uses conditional `withAnalyzer` pattern
- **Chat precedent**: `apps/chat/next.config.ts:18-21` - already uses `removeConsole` with `env.NODE_ENV` check
- **Vendor tooling**: `vendor/next/src/next-config-builder.ts:129-131` - `withAnalyzer` already exported and available
- **Merge safety**: `vendor/next/src/merge-config.ts:38-66` - `mergeNextConfig` does deep merge, so `compiler` key can be added safely

## Desired End State

After completing this plan:

1. Bundle analyzer available via `ANALYZE=true pnpm build:console`
2. Scope hoisting re-enabled (or documented reason for disabling if issues found)
3. Console logs stripped in production (preserving errors/warnings)
4. 10+ heavy packages optimized (recharts, shiki, date-fns, @radix-ui/*)
5. CSS loading per-route instead of monolithic
6. Faster HMR in development with server component caching
7. Measurable improvements: 10-30% bundle reduction, 5-15% faster initial load

**Verification**: Run `ANALYZE=true pnpm build:console` and compare bundle treemaps before/after. Check First Load JS in Next.js build output.

## What We're NOT Doing

1. **React Compiler** - Adds Babel dependency and build complexity. Can revisit in separate initiative.
2. **Standalone output** - Not needed for Vercel deployments. Only relevant for Docker/self-hosted.
3. **Breaking changes** - All changes are additive or proven patterns from sibling apps.
4. **Premature optimization** - Only optimizing packages that exist as dependencies in `package.json`.

## Implementation Approach

Apply 6 incremental phases, each independently testable:
1. Add bundle analyzer for visibility
2. Fix active scope hoisting regression
3. Strip console logs in production
4. Expand package import optimizations
5. Enable CSS chunking
6. Enable HMR caching for dev

Each phase includes automated verification steps and requires passing all checks before proceeding to manual verification.

---

## Phase 1: Enable Bundle Analyzer

### Overview
Wire up the existing `withAnalyzer` export from `@vendor/next` to enable bundle analysis. This provides visibility for measuring all subsequent optimizations.

### Changes Required:

#### 1. Update imports
**File**: `apps/console/next.config.ts`
**Lines**: 6-10

```typescript
import {
  config as vendorConfig,
  withAnalyzer, // Add this import
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
```

#### 2. Apply analyzer conditionally
**File**: `apps/console/next.config.ts`
**Lines**: 76-77 (replace with)

```typescript
// Enable bundle analysis when requested (like apps/www)
let finalConfig = withMicrofrontends(config, { debug: true });

if (process.env.ANALYZE === "true") {
  finalConfig = withAnalyzer(finalConfig);
}

export default finalConfig;
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Build completes without analyzer: `pnpm build:console`
- [ ] Build completes with analyzer: `ANALYZE=true pnpm build:console`
- [ ] Analyzer generates HTML report files in `.next/analyze/`

#### Manual Verification:
- [ ] Open `.next/analyze/client.html` in browser
- [ ] Treemap displays package sizes correctly
- [ ] Can identify largest bundles (verify @repo/ui, lucide-react visible)

**Implementation Note**: After completing this phase and all automated verification passes, record baseline bundle sizes from the analyzer before proceeding to Phase 2.

---

## Phase 2: Fix turbopackScopeHoisting Regression

### Overview
Remove the explicit `turbopackScopeHoisting: false` to re-enable scope hoisting (default). This is a **critical fix** for an active production regression where the console app ships degraded bundles despite using Turbopack.

**Why this is critical**: `package.json:9` shows `build:prod` uses `--turbopack`, but `next.config.ts:54` disables scope hoisting. This means every production deployment ships larger bundles than necessary.

### Changes Required:

#### 1. Remove explicit false setting
**File**: `apps/console/next.config.ts`
**Lines**: 51-55 (modify experimental block)

**Before**:
```typescript
experimental: {
  optimizeCss: true,
  optimizePackageImports: ["@repo/ui", "lucide-react"],
  turbopackScopeHoisting: false,
},
```

**After**:
```typescript
experimental: {
  optimizeCss: true,
  optimizePackageImports: ["@repo/ui", "lucide-react"],
  // turbopackScopeHoisting removed - defaults to true for smaller bundles
},
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Production build completes: `pnpm build:console`
- [ ] Bundle analyzer runs: `ANALYZE=true pnpm build:console`
- [ ] Compare bundle sizes: First Load JS should be 5-15% smaller in build output

#### Manual Verification:
- [ ] Start production build locally: `pnpm build:console && pnpm start`
- [ ] Test critical routes: `/`, `/workspace`, `/search`
- [ ] Verify no JavaScript errors in console (especially around connector registration)
- [ ] Check `@repo/console-backfill` side effects work correctly (connector auto-registration)
- [ ] Test search functionality end-to-end (triggers most connectors)

**Implementation Note**: If runtime errors occur (especially circular dependencies or side-effect issues with connector registration), add back `turbopackScopeHoisting: false` with a documented reason:

```typescript
// KNOWN ISSUE: Scope hoisting causes runtime error in connector registration
// Affects: @repo/console-backfill side-effect imports
// Error: [specific error message]
// Tracked in: [GitHub issue URL]
// Re-evaluate after Next.js 15.1 or Turbopack stable
turbopackScopeHoisting: false,
```

Only proceed to Phase 3 after confirming no regressions.

---

## Phase 3: Strip Console Logs in Production

### Overview
Configure SWC compiler to remove `console.log/info/debug` statements in production builds while preserving `console.error` and `console.warn`. This pattern is already proven in `apps/chat/next.config.ts:18-21`.

### Changes Required:

#### 1. Add compiler configuration
**File**: `apps/console/next.config.ts`
**Lines**: 16-17 (add after `reactStrictMode`)

```typescript
mergeNextConfig(vendorConfig, {
  reactStrictMode: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  transpilePackages: [
    // ... existing packages
  ],
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Development build includes console.log: `pnpm build:dev` → check `.next` for console statements
- [ ] Production build strips console.log: `pnpm build:console` → verify `console.log` absent in bundles
- [ ] Console errors/warnings preserved: search `.next` for `console.error` and `console.warn`

#### Manual Verification:
- [ ] Add temporary `console.log("test")` to a component
- [ ] Dev mode shows logs: `pnpm dev:console` → verify log appears in browser
- [ ] Production build removes log: `pnpm build:console && pnpm start` → verify log absent
- [ ] Error logs still work: Test with deliberate error → verify `console.error` still logs

**Implementation Note**: After completing this phase, remove any temporary test console.log statements before proceeding.

---

## Phase 4: Expand optimizePackageImports

### Overview
Add heavy packages from `package.json` dependencies to the `optimizePackageImports` array. Console app has recharts (2.15.4), shiki (3.9.2), date-fns (4.1.0), and multiple @radix-ui packages that benefit from tree-shaking optimization.

### Changes Required:

#### 1. Expand optimizePackageImports array
**File**: `apps/console/next.config.ts`
**Lines**: 51-55 (modify experimental block)

```typescript
experimental: {
  optimizeCss: true,
  optimizePackageImports: [
    // UI libraries (existing)
    "@repo/ui",
    "lucide-react",

    // Console-specific heavy packages
    "@repo/lib",
    "@repo/console-types",
    "@repo/console-validation",
    "@repo/console-ai",
    "@repo/console-api-services",

    // Chart library (recharts is 2.15.4 in package.json:89)
    "recharts",

    // Syntax highlighting (shiki is 3.9.2 in package.json:91)
    "shiki",

    // Date utilities (date-fns is 4.1.0 in package.json:79)
    "date-fns",

    // Radix UI primitives (multiple @radix-ui/* in use)
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-popover",
    "@radix-ui/react-select",
    "@radix-ui/react-tabs",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-accordion",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-scroll-area",

    // Form libraries
    "react-hook-form",
    "zod",
  ],
},
```

**Rationale**: These packages are confirmed in `apps/console/package.json:21-96`. Only adding packages that exist as dependencies to avoid premature optimization.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Build completes: `pnpm build:console`
- [ ] Bundle analyzer shows improvements: `ANALYZE=true pnpm build:console`
- [ ] Compare before/after: recharts, shiki, date-fns bundles should be smaller in treemap

#### Manual Verification:
- [ ] Charts render correctly: Test any route using recharts visualizations
- [ ] Code syntax highlighting works: Test code blocks with shiki
- [ ] Date formatting correct: Test any date display using date-fns
- [ ] Radix components functional: Test dialogs, dropdowns, tooltips, etc.
- [ ] Forms work correctly: Test form validation with react-hook-form + zod

**Implementation Note**: If any package causes runtime errors after optimization (rare), remove it from the array and document the issue. Only proceed after verifying all heavy UI components work correctly.

---

## Phase 5: Enable CSS Chunking

### Overview
Enable experimental CSS chunking to load CSS per-route instead of monolithically. Console has many routes (workspace, search, jobs, settings, etc.) with Tailwind CSS - this should reduce initial CSS payload by 10-20% per route.

### Changes Required:

#### 1. Add cssChunking flag
**File**: `apps/console/next.config.ts`
**Lines**: 51-55 (add to experimental block)

```typescript
experimental: {
  optimizeCss: true,
  cssChunking: true, // Or 'strict' if CSS ordering issues appear
  optimizePackageImports: [
    // ... all packages from Phase 4
  ],
},
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Build completes: `pnpm build:console`
- [ ] CSS files generated per route: Check `.next/static/css/` for multiple files
- [ ] Bundle analyzer shows CSS breakdown: `ANALYZE=true pnpm build:console`

#### Manual Verification:
- [ ] Navigate between routes: No CSS flashing or missing styles
- [ ] Test route transitions: `/` → `/workspace` → `/search` → `/settings`
- [ ] Verify responsive design: Test mobile breakpoints on multiple routes
- [ ] Check CSS ordering: If styles appear wrong, change to `cssChunking: 'strict'`
- [ ] Test dark mode (if applicable): Ensure theme switching works correctly

**Implementation Note**: If CSS ordering issues appear (wrong specificity, missing styles), change to `cssChunking: 'strict'` which preserves import order. Only proceed after verifying all routes display correctly.

---

## Phase 6: Enable HMR Caching

### Overview
Enable `serverComponentsHmrCache` to cache `fetch()` responses across HMR refreshes in development. This is a dev-only optimization with zero production impact.

### Changes Required:

#### 1. Add HMR cache flag
**File**: `apps/console/next.config.ts`
**Lines**: 51-55 (add to experimental block)

```typescript
experimental: {
  optimizeCss: true,
  cssChunking: true,
  serverComponentsHmrCache: true, // Cache fetch() during HMR (dev-only)
  optimizePackageImports: [
    // ... all packages from Phase 4
  ],
},
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [ ] Dev server starts: `pnpm dev:console`
- [ ] HMR works correctly: Make a component change, verify hot reload
- [ ] No production impact: `pnpm build:console` completes normally

#### Manual Verification:
- [ ] Start dev server: `pnpm dev:console`
- [ ] Navigate to a route with data fetching (e.g., `/workspace`)
- [ ] Make a component change and save
- [ ] Verify HMR refreshes without refetching data (check Network tab)
- [ ] Subjective: HMR feels faster after changes
- [ ] Force refresh still fetches fresh data (cache doesn't stick incorrectly)

**Implementation Note**: This is a low-risk, dev-only optimization. If HMR behaves incorrectly (stale data, errors), remove this flag and report the issue to Next.js.

---

## Testing Strategy

### Automated Testing

**Before each phase**:
1. Run type checking: `pnpm --filter @lightfast/console typecheck`
2. Run linter: `pnpm --filter @lightfast/console lint`
3. Build successfully: `pnpm build:console`

**Bundle analysis checkpoints**:
- Baseline (before Phase 2): `ANALYZE=true pnpm build:console` → record First Load JS
- After Phase 2 (scope hoisting): Compare bundle sizes
- After Phase 4 (package optimizations): Compare package sizes in treemap
- After Phase 5 (CSS chunking): Check CSS file sizes per route
- Final comparison: Total improvement vs baseline

### Integration Testing

**Critical user flows to test after each phase**:
1. **Authentication flow**: Sign in → workspace dashboard
2. **Search functionality**: Execute search → view results → filter sources
3. **Connector management**: View connectors → add integration → test connection
4. **Jobs monitoring**: View jobs table → check job status → view job details
5. **Settings pages**: Navigate settings → update preferences → save

### Manual Performance Testing

**After Phase 2 and Phase 5 (largest impact)**:
1. Clear browser cache
2. Hard refresh on `/` route
3. Open DevTools Network tab
4. Record:
   - First Load JS size (from Next.js build output)
   - Total CSS size
   - Time to Interactive
   - Largest Contentful Paint
5. Compare before/after metrics

### Edge Case Testing

**Scope hoisting risks (Phase 2)**:
- Test all connector types (GitHub, Linear, Notion, etc.)
- Verify side-effect imports work (`@repo/console-backfill`)
- Check circular dependencies don't cause runtime errors
- Test with empty workspace (no data loaded)

**CSS chunking risks (Phase 5)**:
- Test route transitions without pre-loading
- Verify responsive breakpoints work
- Check dynamic imports don't break styles
- Test with browser extensions that modify CSS

## Performance Considerations

### Build Time Impact

**Expected**: Minimal increase (1-5%) from additional package optimizations
- `optimizePackageImports` runs at build time but parallelizes well
- `cssChunking` adds slight overhead but output is cached
- Overall build time should remain under 3 minutes for console app

**Mitigation**: If build time increases significantly (>10%), consider:
- Reducing `optimizePackageImports` list to only heaviest packages
- Using Turbopack features to parallelize better

### Runtime Performance

**Expected improvements**:
- 5-15% reduction in bundle size (scope hoisting + package optimizations)
- 10-20% reduction in initial CSS payload per route (CSS chunking)
- Faster HMR in development (server component caching)
- No runtime performance degradation from console.log removal

**Monitoring**: Compare Lighthouse scores before/after:
- Performance score (target: maintain or improve)
- First Contentful Paint (target: <1.5s)
- Time to Interactive (target: <3s)
- Total Blocking Time (target: <300ms)

### Memory Considerations

**Scope hoisting**: May slightly increase memory usage during builds due to more aggressive module combining. Should not impact production runtime.

**CSS chunking**: Reduces memory pressure by loading less CSS per route. More CSS files but smaller individual size.

## Migration Notes

No data migration needed - all changes are build-time optimizations.

**Rollback strategy**: Each phase is independently revertable by reverting the specific config changes. No breaking changes to application logic.

**Deployment approach**: Can be deployed immediately after all phases pass verification. No staged rollout needed since changes are proven patterns from sibling apps.

## References

- **Research document**: `thoughts/shared/research/2026-02-09-console-optimization-nextjs-config.md`
- **Current config**: `apps/console/next.config.ts:1-77`
- **Build scripts**: `apps/console/package.json:7-9` (shows `--turbopack` usage)
- **WWW precedent**: `apps/www/next.config.ts:81-82` (withAnalyzer pattern)
- **Chat precedent**: `apps/chat/next.config.ts:18-21` (removeConsole pattern)
- **Vendor tooling**: `vendor/next/src/next-config-builder.ts:129-131` (withAnalyzer export)
- **Merge utility**: `vendor/next/src/merge-config.ts:38-66` (deep merge safety)
- **External research**: Next.js experimental features docs, Turbopack scope hoisting, CSS chunking best practices

## Success Metrics

**Primary metrics** (measure before/after all phases):
- First Load JS: Target 10-30% reduction
- CSS payload per route: Target 10-20% reduction
- Build time: Maintain within 5% of baseline

**Secondary metrics**:
- Lighthouse Performance score: Maintain >90 or improve
- Time to Interactive: Target <3s on fast 3G
- Development HMR speed: Subjective improvement

**Qualitative**:
- No regressions in functionality
- All automated tests passing
- Production bundle analysis shows clear improvements
- Developer experience improved with faster HMR
