---
date: 2026-02-09T19:00:00-08:00
researcher: architect-agent
topic: "Build Performance Strategy"
tags: [research, architecture, build-optimization, build-performance, turbopack, ci, monitoring]
status: complete
based_on:
  - 2026-02-09-console-build-codebase-deep-dive.md
  - 2026-02-09-web-analysis-next-js-15-config-optimization.md
priority: MEDIUM
estimated_impact: "30-50% faster builds, continuous performance visibility"
---

# Optimization Strategy: Build Performance

## Executive Summary

This document outlines a holistic build performance strategy covering Turbopack optimization, bundle monitoring, CI improvements, and deployment options. Console **already uses Turbopack for both dev and production builds** (`--turbo`/`--turbopack` flags in `apps/console/package.json`), so the focus is on optimizing the existing Turbopack setup (especially fixing disabled scope hoisting), validating bundle quality against Webpack, and establishing continuous monitoring. Note: Console is built by Vercel on deploy, not in GitHub Actions CI (which only covers `core/lightfast` and `core/mcp`).

## Current State (from Codebase Analysis)

### Build Pipeline Overview

```
pnpm build:console
  → turbo run build -F @lightfast/console
    → ^build (all 26 transpiled packages)
    → next build (console app)
      → SWC compilation
      → Route generation
      → Bundle optimization
      → Sentry source map upload
```

### Current Build Characteristics

| Aspect | Current State | Notes |
|--------|--------------|-------|
| Bundler | **Turbopack** (production!) | `build:prod` uses `--turbopack` flag |
| Compiler | SWC | Fast, default since Next.js 13 |
| Dev server | Turbopack | `dev` uses `--turbo` flag |
| Cache | Turbo remote cache (Vercel) | `teamId` configured in `.turbo/config.json` |
| Source maps | Sentry upload | `widenClientFileUpload` in production only |
| CSS | `optimizeCss: true` | Lightning CSS-based optimization |
| Scope hoisting | **Disabled (`false`)** | **Active bundle size regression in production** |
| Parallel tasks | Limited | Lint/typecheck blocked by `^build` |
| Build outputs | **Missing `.next/**`** | Root `turbo.json` only has `dist/**` |

**Critical finding**: The root `turbo.json` build task has `outputs: [".cache/tsbuildinfo.json", "dist/**"]` but Next.js apps output to `.next/`, not `dist/`. The per-app `turbo.json` files do have `.next/**` in outputs, but this means the root-level build task won't cache Next.js builds for apps that don't have their own `turbo.json`.

### CI Pipeline Scope

**Important**: The existing CI workflow (`.github/workflows/ci.yml`) only runs on changes to `core/lightfast/**` and `core/mcp/**` (via `dorny/paths-filter`). **Console is NOT built in CI** - Vercel builds console directly on deploy via `turbo-ignore`. The CI pipeline only covers the core packages (`lightfast` and `@lightfastai/mcp`).

Current CI steps for core packages:
1. Change detection (paths-filter on `core/**`) → ~30s
2. Lint `lightfast` → depends on cache
3. Typecheck `lightfast` + `@lightfastai/mcp` → depends on cache
4. Test `lightfast` → depends on cache
5. Build `lightfast` + `@lightfastai/mcp` → full build
6. CI success check → ~5s

**Key bottleneck**: Steps 2-4 all wait for build completion due to `^build` dependency.

**Note on console builds**: Console builds happen exclusively through Vercel deployments, not through GitHub Actions CI. Any CI optimizations for console would require a NEW workflow.

### Build Configuration Inconsistencies

| App | Next.js Version | Turbopack | Scope Hoisting | Sentry | Bundle Analyzer |
|-----|----------------|-----------|----------------|--------|-----------------|
| Console | 15 | **Yes (dev + prod)** | **Disabled** | Always | Available, not wired |
| WWW | 16 | No | Default | Conditional (Vercel) | Wired |
| Chat | 15 | No | Default | Always | Not available |
| Auth | - | - | - | - | - |

## Proposed Solution

### Phase 1: Establish Build Performance Baseline

**What**: Set up comprehensive build performance measurement before making any changes

**Why**: Without baseline data, optimization impact can't be measured. "You can't improve what you don't measure."

**How**:

```bash
# 1. Measure full build time
time pnpm build:console 2>&1 | tee /tmp/build-baseline.log

# 2. Measure with bundle analysis
ANALYZE=true time pnpm build:console 2>&1 | tee /tmp/build-analyze.log

# 3. Extract key metrics from build output
# - Total build time
# - Route generation time
# - Bundle sizes (from next build output)
# - Number of static vs dynamic routes
# - Shared chunks size

# 4. Save baseline report
cat > thoughts/shared/research/build-baseline-$(date +%Y-%m-%d).md << EOF
# Build Performance Baseline - $(date +%Y-%m-%d)
## Full Build: $(grep 'real' /tmp/build-times.txt)
## Routes: $(grep 'Route' /tmp/build-baseline.log | wc -l)
## First Load JS: $(grep 'First Load JS' /tmp/build-baseline.log)
EOF
```

**Expected Impact**: Establishes measurement framework
**Risk**: None - measurement only

### Phase 2: Bundle Size Monitoring Setup

**What**: Implement automated bundle size tracking in CI

**Why**: Catch bundle regressions before they ship to production. Every PR should show bundle impact.

**How**:

Option A: Use `@next/bundle-analyzer` output in CI:
```yaml
# .github/workflows/ci.yml - add after build step
- name: Bundle Size Report
  if: github.event_name == 'pull_request'
  run: |
    ANALYZE=true pnpm build:console
    # Extract sizes from .next/analyze/client.html
    echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
    echo "| Route | Size | First Load JS |" >> $GITHUB_STEP_SUMMARY
    echo "|-------|------|--------------|" >> $GITHUB_STEP_SUMMARY
    # Parse next build output for route sizes
```

Option B: Use `size-limit` for specific packages:
```json
// apps/console/package.json
{
  "size-limit": [
    {
      "path": ".next/static/**/*.js",
      "limit": "500 KB"
    }
  ]
}
```

Option C: Vercel's built-in bundle analysis (if available in plan):
- Vercel automatically tracks bundle sizes per deployment
- Compare PR deployments against production

**Expected Impact**: Prevents bundle regressions
**Risk**: None - monitoring only

### Phase 3: Turbopack Already in Use - Focus on Optimization

**What**: Console already uses Turbopack for both dev AND production. Focus on optimizing Turbopack config.

**Current state**: Both dev and production builds already use Turbopack:
```json
// apps/console/package.json
"build:prod": "pnpm with-env:prod next build --turbopack",
"dev": "... next dev --port $(microfrontends port) --turbo"
```

**Key optimization**: Fix `turbopackScopeHoisting: false` (see Next.js Config doc). Since Turbopack is the production bundler, this is actively causing larger bundles.

**Testing Strategy**:
1. Build with current config, record bundle sizes
2. Enable scope hoisting (remove `turbopackScopeHoisting: false`)
3. Build again, compare bundle sizes
4. If scope hoisting causes issues, document specific errors and file upstream

**Expected Impact**: 5-15% bundle size reduction from scope hoisting alone
**Risk**: Medium - scope hoisting bugs in Turbopack may have been the reason it was disabled

### Phase 4: Evaluate Turbopack vs Webpack Bundle Sizes

**What**: Since Turbopack is already used for production, compare against Webpack to validate the choice

**Why**: External research showed Next.js 15.5 had +72% bundle size regression with Turbopack in some cases. The console is already using Turbopack - we should validate this isn't hurting bundle sizes.

**How**:

```bash
# Step 1: Build with current Turbopack config (baseline)
ANALYZE=true time pnpm build:console 2>&1 | tee /tmp/build-turbopack.log

# Step 2: Temporarily remove --turbopack and build with Webpack
# Edit apps/console/package.json: remove --turbopack from build:prod
ANALYZE=true time pnpm build:console 2>&1 | tee /tmp/build-webpack.log

# Step 3: Compare
# - Build time difference
# - Bundle size per route
# - Shared chunks size
# - Total JS size
```

**Decision Matrix**:
| Outcome | Action |
|---------|--------|
| Turbopack smaller or equal | Keep Turbopack (current) |
| Turbopack <10% larger but faster | Keep Turbopack, monitor |
| Turbopack >10% larger | Switch to Webpack for production |
| Turbopack much slower | Switch to Webpack for production |

**Expected Impact**: Validates current bundler choice
**Risk**: Low - comparison only, no permanent changes

### Phase 5: CI Pipeline Optimization

**Important scope clarification**: The existing `.github/workflows/ci.yml` only runs for `core/lightfast` and `core/mcp` changes (via `dorny/paths-filter` on `core/**`). Console is built by Vercel on deploy, not in CI. The optimizations below apply to two scenarios:

#### 5a: Optimize existing core CI with `--affected`

The existing CI can benefit from `--affected` to skip unchanged core packages:
```yaml
# .github/workflows/ci.yml - optimize existing core pipeline
- name: Build affected core packages
  run: pnpm turbo build --affected --filter=lightfast --filter=@lightfastai/mcp
```

#### 5b: (PROPOSAL) New Console CI Workflow

If console CI is desired (for pre-merge validation beyond Vercel preview deploys), create a new workflow:
```yaml
# .github/workflows/console-ci.yml (NEW - does not exist today)
name: Console CI
on:
  pull_request:
    paths:
      - 'apps/console/**'
      - 'packages/console-*/**'
      - 'packages/ui/**'
      - 'vendor/**'
      - 'api/**'
      - 'db/**'

jobs:
  console-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install
      - name: Build console
        run: pnpm build:console
        env:
          SKIP_ENV_VALIDATION: true
      - name: Bundle size report
        run: |
          ANALYZE=true pnpm build:console
          echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
```

**Note**: This is a PROPOSAL for a new workflow. Currently, console builds happen only through Vercel.

#### 5c: Remote cache in CI (already configured)

Remote cache is already configured (`.turbo/config.json` has `teamId`). Verify it's active in CI:
```yaml
- name: Verify Turbo Remote Cache
  run: |
    echo "TURBO_TOKEN=${{ secrets.TURBO_TOKEN }}" >> $GITHUB_ENV
    echo "TURBO_TEAM=${{ secrets.TURBO_TEAM }}" >> $GITHUB_ENV
```

**Expected Impact**: 20-40% faster core CI; console CI would be net-new coverage
**Risk**: Low for core optimization; medium for new console CI (requires env setup)

### Phase 6: Build Time Benchmarking Automation

**What**: Create a script that benchmarks build performance and outputs a report

**Why**: Regular benchmarking catches regressions early and tracks improvement over time.

**How**:

```bash
#!/bin/bash
# scripts/benchmark-build.sh

echo "## Build Performance Benchmark - $(date)"
echo ""

# Clean build
pnpm clean:workspaces
echo "### Clean Build"
time pnpm build:console 2>&1 | tail -20

# Cached build (no changes)
echo ""
echo "### Cached Build (no changes)"
time pnpm build:console 2>&1 | tail -5

# Incremental build (touch one file)
echo ""
echo "### Incremental Build (single file change)"
touch apps/console/src/app/layout.tsx
time pnpm build:console 2>&1 | tail -5

echo ""
echo "### Bundle Sizes"
# Extract from next build output
grep -E "(First Load|Route)" /tmp/build-output.log
```

Run quarterly or before/after major optimizations.

**Expected Impact**: Long-term performance tracking
**Risk**: None - measurement only

### Phase 7: Deployment Optimization (Future)

**What**: Evaluate standalone output mode for potential Docker/self-hosted deployment

**Current Deployment**: Vercel (optimizes automatically)

**Why Standalone Matters**: If Lightfast ever needs:
- Self-hosted enterprise deployment
- Docker-based deployment
- Edge deployment on non-Vercel platforms

**How** (if needed):
```typescript
// next.config.ts
output: 'standalone',
```

```dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
CMD ["node", "server.js"]
```

**Decision**: **SKIP for now** - Vercel handles deployment optimization. Revisit if deployment strategy changes.

## Code Examples

### Bundle Size CI Check (GitHub Actions)

```yaml
# .github/workflows/bundle-check.yml
name: Bundle Size Check
on:
  pull_request:
    paths:
      - 'apps/console/**'
      - 'packages/**'

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install

      - name: Build and analyze
        run: ANALYZE=true pnpm build:console
        env:
          SKIP_ENV_VALIDATION: true

      - name: Report bundle sizes
        run: |
          echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
          # Parse next build output for sizes
```

### Dev Performance Monitoring Script

```bash
#!/bin/bash
# scripts/dev-perf.sh
# Measure dev server startup time

echo "Starting dev server with Turbopack..."
START=$(date +%s%N)

timeout 60 pnpm dev:console --turbo 2>&1 | while read line; do
  if echo "$line" | grep -q "Ready in"; then
    END=$(date +%s%N)
    ELAPSED=$(( (END - START) / 1000000 ))
    echo "Dev server ready in ${ELAPSED}ms"
    break
  fi
done
```

## Implementation Checklist

- [ ] **Phase 1** (30 min): Run baseline build measurements (Turbopack, current config)
- [ ] **Phase 1** (15 min): Document current build times and bundle sizes
- [ ] **Phase 2** (1 hour): Set up bundle size reporting (local tooling first)
- [ ] **Phase 3** (30 min): Test scope hoisting fix (`turbopackScopeHoisting` removal)
- [ ] **Phase 3** (30 min): Compare bundle sizes with/without scope hoisting
- [ ] **Phase 4** (1 hour): Compare Turbopack vs Webpack production bundle sizes
- [ ] **Phase 4** (30 min): Make bundler decision based on comparison data
- [ ] **Phase 5a** (15 min): Add `--affected` to existing core CI
- [ ] **Phase 5b** (optional): Propose new console CI workflow if needed
- [ ] **Phase 5c** (15 min): Verify remote cache is active in CI
- [ ] **Phase 6** (30 min): Create benchmarking script
- [ ] **Ongoing**: Run benchmarks quarterly

## Success Metrics

- **Build time**: Target 30-50% reduction from baseline
- **CI time**: Target 40-60% reduction
- **Dev startup**: Target <5s with Turbopack
- **HMR latency**: Target <200ms with Turbopack
- **Bundle regression**: Zero unintentional increases (caught by CI)

### Measurement Framework

| Metric | How to Measure | Frequency | Target |
|--------|---------------|-----------|--------|
| Full build time | `time pnpm build:console` | Every PR | <60s |
| Incremental build | Touch file → build | Weekly | <15s |
| Dev startup | Time to "Ready" | Weekly | <5s |
| HMR | Time to reflect change | Weekly | <200ms |
| Bundle size | `ANALYZE=true` build | Every PR | No regressions |
| CI total time | GitHub Actions duration | Every PR | <5 min |

## Trade-offs

| Factor | Before | After | Notes |
|--------|--------|-------|-------|
| Build visibility | None | Full | Bundle analyzer + CI reporting |
| Dev speed | Turbopack | Turbopack (optimized) | Scope hoisting fix |
| Core CI speed | Sequential | Parallel + affected | 20-40% faster |
| Production bundler | Turbopack (scope hoisting OFF) | Turbopack (scope hoisting ON) or Webpack | Depends on comparison |
| Measurement overhead | None | Minimal | Local tooling + optional CI |
| Maintenance | Low | Low-Medium | Scripts and CI to maintain |

## Implementation Priority

```
Week 1: Phase 1 (baseline) + Phase 2 (monitoring)
         ↓
Week 2: Phase 3 (scope hoisting fix) + Phase 4 (Turbopack vs Webpack comparison)
         ↓
Week 3: Phase 5 (core CI optimization) + Phase 6 (benchmarking)
         ↓
Future:  Phase 7 (standalone) - only if deployment needs change
```

## Cross-References to Other Optimization Documents

This strategy works best in combination with:

1. **Barrel File Elimination** (`2026-02-09-console-optimization-barrel-files.md`): Reduces module count → faster builds
2. **Next.js Config** (`2026-02-09-console-optimization-nextjs-config.md`): Scope hoisting + React Compiler → smaller/faster builds
3. **Turborepo Pipeline** (`2026-02-09-console-optimization-turborepo.md`): Parallel execution + scoped env → faster CI
4. **Bundle Size** (`2026-02-09-console-optimization-bundle-size.md`): Dynamic imports → smaller initial bundles

**Combined Expected Impact**: 50-75% faster builds, 30-85% smaller bundles

## References

- Codebase findings: `turbo.json:1-192`, `.github/workflows/ci.yml:1-182`
- Remote cache: `.turbo/config.json` (Vercel team configured)
- Current config inconsistencies: Console (Next 15), WWW (Next 16), scope hoisting disabled
- External research: Turbopack 76.7% faster dev, 18.8% faster production, +72% bundle risk
- CI current state: Sequential jobs, no `--affected`, lint failures suppressed
