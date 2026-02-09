---
date: 2026-02-09T19:00:00-08:00
researcher: architect-agent
topic: "Turborepo Pipeline Optimization"
tags: [research, architecture, build-optimization, turborepo, ci-cd, caching, pipeline]
status: complete
based_on:
  - 2026-02-09-console-build-codebase-deep-dive.md
  - 2026-02-09-web-analysis-next-js-15-config-optimization.md
priority: HIGH
estimated_impact: "50-80% cache hit improvement, 30-50% faster local builds"
---

# Optimization Strategy: Turborepo Pipeline Optimization

## Executive Summary

The Turborepo configuration has several anti-patterns that reduce cache effectiveness and slow down builds: 112 global environment variables (instead of per-task), lint/typecheck sequentially blocked by `^build`, docs build cache disabled, and CI workflows that suppress lint/typecheck failures. Fixing these issues can improve cache hit rates by 50-80% and reduce local build times by 30-50% through better parallelism and improved cache granularity.

## Current State (from Codebase Analysis)

### Root `turbo.json` Anti-Patterns

#### 1. Global Environment Variable Explosion

**File**: `turbo.json:67-179`

**Problem**: 112+ environment variables declared in `globalEnv`. Every variable change invalidates ALL task caches across ALL packages.

```json
"globalEnv": [
  "POSTGRES_URL",
  "DATABASE_HOST",
  "CLERK_SECRET_KEY",
  "ANTHROPIC_API_KEY",
  "PINECONE_API_KEY",
  // ... 107 more variables
]
```

**Impact**: If ANY of these 112 variables changes (even one irrelevant to the current task), every cached build artifact is invalidated. This means:
- Rotating a single API key invalidates all caches
- Adding a new env var forces full rebuild
- Remote cache hit rate severely reduced

#### 2. Lint/Typecheck Blocked by Build

**File**: `turbo.json:33-39`

```json
"lint": {
  "dependsOn": ["^build"],
  "outputs": [".cache/.eslintcache"]
},
"typecheck": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json"]
}
```

**Problem**: Both `lint` and `typecheck` depend on `^build` (all upstream package builds). This means:
- Lint can't start until ALL dependencies are built
- Typecheck can't start until ALL dependencies are built
- They run sequentially AFTER a full build, not in parallel

#### 3. Docs Build Cache Disabled

**File**: `apps/docs/turbo.json:7`

```json
"build": {
  "dependsOn": ["^build"],
  "cache": false,
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**Problem**: Every docs build is fully recompiled, even if nothing changed. No benefit from Turbo caching.

#### 4. `turbo-ignore` - Already Implemented (No Action Needed)

All 5 apps already have `vercel.json` with `"ignoreCommand": "npx turbo-ignore"`. This is correctly configured and prevents unnecessary Vercel builds when app code hasn't changed.

#### 5. CI Suppresses Lint/Typecheck Failures

**File**: `.github/workflows/ci.yml:64`

```yaml
pnpm --filter lightfast lint || echo "⚠️ Linting issues found..."
```

Lint and typecheck failures are silently suppressed - only build failures block CI.

#### 6. Root Build Task Missing `.next/**` Outputs

**File**: `turbo.json:6-8`

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json", "dist/**"]
}
```

**Problem**: Next.js apps output to `.next/`, not `dist/`. While per-app `turbo.json` files (console, www, chat, auth) override this with `.next/**`, any package that inherits from root without its own override won't cache Next.js builds. Additionally, the per-app configs confirm JIT (Just-In-Time) packages with no build step are common - these packages skip build entirely, and the root `dist/**` output is only relevant for the few packages that actually compile.

#### 7. Missing Task-Level Environment Variables

No task in `turbo.json` declares its own `env` key. All environment dependencies are global, making it impossible to know which tasks actually need which variables.

## Proposed Solution

### Phase 1: Migrate Global Env to Task-Level Env

**What**: Move environment variables from `globalEnv` to task-specific `env` configurations

**Why**: Each task should only depend on the environment variables it actually uses. This dramatically improves cache hit rates.

**How**:

**Before** (`turbo.json`):
```json
{
  "globalEnv": [
    "POSTGRES_URL", "DATABASE_HOST", "CLERK_SECRET_KEY",
    // ... 109 more
  ],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

**After** (`turbo.json`):
```json
{
  "globalEnv": [
    // ONLY truly global variables
    "NODE_ENV",
    "CI"
  ],
  "globalPassThroughEnv": [
    "SKIP_ENV_VALIDATION",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "npm_lifecycle_event",
    "ENVIRONMENT",
    "DEBUG",
    "PORT"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json", "dist/**"],
      "env": [
        // Only env vars that affect build output
        "NEXT_PUBLIC_*",
        "SENTRY_*",
        "VERCEL_ENV"
      ]
    },
    "lint": {
      "outputs": [".cache/.eslintcache"],
      "env": []  // Lint doesn't depend on env vars
    },
    "typecheck": {
      "outputs": [".cache/tsbuildinfo.json"],
      "env": []  // Typecheck doesn't depend on env vars
    }
  }
}
```

Per-app `turbo.json` files can add their specific env vars:
```json
// apps/console/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "env": [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SENTRY_DSN",
        "NEXT_PUBLIC_POSTHOG_HOST",
        "NEXT_PUBLIC_POSTHOG_KEY",
        "NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN",
        "NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY",
        "NEXT_PUBLIC_GITHUB_APP_SLUG",
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_VERCEL_ENV",
        "NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG",
        "SENTRY_AUTH_TOKEN",
        "SENTRY_ORG",
        "SENTRY_PROJECT"
      ],
      "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
    }
  }
}
```

**Expected Impact**: 50-80% improvement in cache hit rates
**Risk**: Medium - requires careful audit of which tasks need which variables

### Phase 2: Unblock Lint and Typecheck from Build

**What**: Remove `^build` dependency from `lint` and `typecheck` tasks, enabling parallel execution

**Why**: Lint (ESLint) and typecheck (tsc) don't need built artifacts - they work on source TypeScript files. The `^build` dependency forces them to wait for the entire build graph to complete.

**How**:

**Before**:
```json
"lint": {
  "dependsOn": ["^build"],
  "outputs": [".cache/.eslintcache"]
},
"typecheck": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json"]
}
```

**After**:
```json
"lint": {
  "dependsOn": [],
  "outputs": [".cache/.eslintcache"]
},
"typecheck": {
  "dependsOn": [],
  "outputs": [".cache/tsbuildinfo.json"]
}
```

This allows Turbo to run `build`, `lint`, and `typecheck` in parallel:

```
Before: build (all deps) → lint → typecheck (sequential)
After:  build ─┐
        lint  ─┤ (parallel)
        typecheck ─┘
```

**Caveat**: If packages use path aliases that resolve to build outputs (`dist/`), typecheck might fail. Test this change and if needed, only remove `^build` from `lint` (which definitely doesn't need it).

**Expected Impact**: 30-50% reduction in CI pipeline time
**Risk**: Medium - typecheck may need build artifacts for some packages. Test incrementally.

### Phase 3: Add Transit Nodes for Quality Tasks

**What**: Create a `check` transit task that runs lint + typecheck in parallel, separate from build

**Why**: Transit nodes allow grouping related tasks without creating unnecessary dependencies.

**How**:

```json
// turbo.json
{
  "tasks": {
    "//#check": {
      "dependsOn": ["lint", "typecheck"],
      "outputs": []
    }
  }
}
```

```json
// package.json
{
  "scripts": {
    "check": "turbo run lint typecheck --parallel"
  }
}
```

**Expected Impact**: Clean separation of build vs quality tasks
**Risk**: Low - additive change

### Phase 4: Enable Docs Caching

**What**: Remove `cache: false` from docs build task

**Why**: Docs builds are deterministic - same inputs produce same outputs. Disabling cache forces full rebuilds on every run.

**How**:

**Before** (`apps/docs/turbo.json`):
```json
"build": {
  "dependsOn": ["^build"],
  "cache": false,
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**After**:
```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

If cache was disabled due to CMS content (dynamic at build time), add the CMS token to env:
```json
"build": {
  "dependsOn": ["^build"],
  "env": ["BASEHUB_TOKEN"],
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**Expected Impact**: Docs rebuilds only when content or code changes
**Risk**: Low - if cache causes stale content issues, the CMS token env var handles it

### Phase 5: Fix CI Lint/Typecheck Suppression

**What**: Make lint and typecheck failures block CI

**Why**: Currently failures are silently swallowed, allowing broken code to merge.

**How**:

**Before** (`.github/workflows/ci.yml:64`):
```yaml
pnpm --filter lightfast lint || echo "⚠️ Linting issues found..."
```

**After**:
```yaml
pnpm --filter lightfast lint
```

Or, if you want a warning stage but still fail:
```yaml
- name: Lint
  run: pnpm --filter lightfast lint
  continue-on-error: false
```

**Expected Impact**: Catches code quality issues before merge
**Risk**: May block PRs that currently pass - run lint locally first to assess scope

### Phase 6: Optimize CI with `--affected`

**What**: Use Turbo's `--affected` flag in CI to only build/test changed packages

**Why**: Currently CI runs all tasks on `lightfast` and `@lightfastai/mcp` regardless of what changed.

**How**:

```yaml
# .github/workflows/ci.yml
- name: Build
  run: pnpm turbo build --affected

- name: Lint
  run: pnpm turbo lint --affected

- name: Typecheck
  run: pnpm turbo typecheck --affected
```

**Expected Impact**: 50-70% faster CI runs when only a few packages change
**Risk**: Low - `--affected` uses git diff to determine scope

## Code Examples

### Optimized Root `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json", "dist/**"],
      "env": ["NEXT_PUBLIC_*", "SENTRY_*", "VERCEL_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": [],
      "outputs": [".cache/.eslintcache"]
    },
    "typecheck": {
      "dependsOn": [],
      "outputs": [".cache/tsbuildinfo.json"]
    },
    "format": {
      "outputs": [".cache/.prettiercache"],
      "outputLogs": "new-only"
    },
    "clean": { "cache": false },
    "migrate": { "cache": false },
    "migrate:generate": { "cache": false }
  },
  "globalEnv": ["NODE_ENV", "CI"],
  "globalPassThroughEnv": [
    "SKIP_ENV_VALIDATION",
    "VERCEL", "VERCEL_ENV", "VERCEL_URL",
    "npm_lifecycle_event",
    "ENVIRONMENT", "DEBUG", "PORT"
  ]
}
```

### Optimized Console `turbo.json`

```json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SENTRY_DSN",
        "NEXT_PUBLIC_POSTHOG_HOST",
        "NEXT_PUBLIC_POSTHOG_KEY",
        "NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN",
        "NEXT_PUBLIC_BETTER_STACK_INGESTING_URL",
        "NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY",
        "NEXT_PUBLIC_GITHUB_APP_SLUG",
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_VERCEL_ENV",
        "NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG",
        "SENTRY_AUTH_TOKEN",
        "SENTRY_ORG",
        "SENTRY_PROJECT"
      ],
      "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
    },
    "dev": {
      "persistent": true
    }
  }
}
```

## Implementation Checklist

- [ ] **Phase 1** (2-3 hours): Audit which tasks need which env vars
- [ ] **Phase 1** (1 hour): Migrate globalEnv to per-task env
- [ ] **Phase 1** (30 min): Test that builds still pass with scoped env
- [ ] **Phase 2** (15 min): Remove `^build` from lint task
- [ ] **Phase 2** (30 min): Test typecheck without `^build`, add back if needed
- [ ] **Phase 3** (15 min): Add transit `check` task
- [ ] **Phase 4** (5 min): Remove `cache: false` from docs build
- [ ] **Phase 5** (15 min): Remove lint/typecheck error suppression in CI
- [ ] **Phase 5** (30 min): Fix any pre-existing lint/typecheck errors
- [ ] **Phase 6** (15 min): Add `--affected` to CI pipeline

## Success Metrics

- **CI pipeline time**: Measure total CI duration before/after
- **Cache hit rate**: Monitor Turbo cache hit/miss ratio in CI logs
- **Vercel build frequency**: Count deploys per week before/after turbo-ignore
- **Developer feedback**: Are `pnpm lint` and `pnpm typecheck` noticeably faster?

### Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| CI pipeline time | Baseline | -40-60% | Parallel lint/typecheck + affected |
| Cache hit rate | Low (global env) | High (scoped env) | 50-80% improvement |
| Unnecessary Vercel builds | Already handled | Already handled | turbo-ignore on all apps (already implemented) |
| Lint/typecheck wait | After full build | Immediate | No build dependency |

## Trade-offs

| Factor | Before | After | Notes |
|--------|--------|-------|-------|
| Config complexity | Simple (all global) | More granular | Per-task env requires audit |
| Cache correctness | Over-invalidated | Precise | Better but needs testing |
| CI strictness | Permissive | Strict | Lint failures now block |
| Parallel execution | Sequential | Parallel | Faster but uses more CPU |
| Vercel builds | Already optimized | Already optimized | turbo-ignore already configured |

## References

- Codebase findings: `turbo.json:1-192` - 112 global env vars, sequential lint/typecheck
- CI workflow: `.github/workflows/ci.yml:64` - suppressed lint failures
- Docs cache: `apps/docs/turbo.json:7` - `cache: false`
- turbo-ignore: All 5 apps already have `vercel.json` with `turbo-ignore` configured (no action needed)
- Turborepo best practices: task-level env, `--affected`, transit nodes
- External research: Turbopack benchmarks, CI optimization strategies
