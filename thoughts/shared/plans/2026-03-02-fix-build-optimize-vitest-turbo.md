# Fix Build Failure & Optimize Vitest/Turbo Test System

## Overview

Fix the `@lightfast/www` build failure caused by vitest type resolution, and optimize the vitest/turbo test pipeline for faster, cacheable test runs.

## Current State Analysis

### Build Failure
The `pnpm build` fails on `@lightfast/www` with:
```
../../vitest.shared.ts:1:30
Type error: Cannot find module 'vitest/config' or its corresponding type declarations.
```

**Root cause chain:**
1. `vitest.shared.ts` (monorepo root) imports `vitest/config` — but `vitest` is NOT in root `package.json` devDependencies
2. Each Next.js app's `tsconfig.json` includes `"."` which picks up `vitest.config.ts`
3. Next.js build type-checking follows `vitest.config.ts` → `../../vitest.shared.ts` → can't resolve `vitest/config` from root
4. This was introduced in commit `b881b0a5d` (perf(test): optimize vitest CPU usage)

### Test Pipeline
- `turbo.json` test task has `"cache": false` — all 12 test packages re-run on every `pnpm test` even with zero code changes
- `apps/www` has `vitest.config.ts` + 1 test file but no `test` script in `package.json`
- `apps/chat` has 1 test file but no `test` script
- `core/mcp` has a test script but 0 test files
- The shared config (`vitest.shared.ts`) already optimizes CPU well: threads pool, maxThreads: 2, fileParallelism: false

### Key Discoveries:
- `vitest.shared.ts:1` — imports `vitest/config` which is unresolvable from root
- Root `package.json:59-71` — has `vite` but NOT `vitest` in devDependencies
- `apps/www/tsconfig.json:16` — `"include": ["."]` picks up vitest.config.ts during build
- `apps/console/tsconfig.json:14` — same pattern but build succeeds (likely turbo cache)
- `turbo.json:52-56` — test task has `"cache": false`
- 11 packages have actual test files; 12 have test scripts

## Desired End State

1. `pnpm build` succeeds cleanly for all apps
2. Test configs don't interfere with Next.js build type-checking
3. `pnpm test` / `turbo run test` caches results and skips unchanged packages
4. All packages with test files have working test scripts; no orphan configs

### Verification:
- `pnpm build` → all 4 app builds pass (console, www, docs, chat)
- `pnpm test` → runs tests, second identical run is fully cached
- `pnpm typecheck` → passes

## What We're NOT Doing

- Changing the vitest shared config CPU optimization strategy (it's already good)
- Adding new test files or test infrastructure
- Modifying test scripts for packages that don't need them
- Changing how integration tests work

## Implementation Approach

Two phases: fix the build first (critical), then optimize test caching (improvement).

---

## Phase 1: Fix the Build Failure

### Overview
Resolve the vitest/config type resolution error by (a) adding vitest to root devDependencies, and (b) excluding vitest configs from Next.js app tsconfigs.

### Changes Required:

#### 1. Add vitest to root devDependencies
**File**: `package.json`
**Changes**: Add `vitest` to root devDependencies so `vitest.shared.ts` can resolve its import from the root directory.

```json
"devDependencies": {
    ...
    "vitest": "^3.2.4",
    ...
}
```

Then run `pnpm install` to hoist it.

#### 2. Exclude vitest configs from Next.js app tsconfigs
**Files**: All Next.js app tsconfigs that have `vitest.config.ts` siblings:
- `apps/www/tsconfig.json`
- `apps/console/tsconfig.json`
- `apps/chat/tsconfig.json` (if it has vitest.config.ts — verify)
- `apps/connections/tsconfig.json`
- `apps/backfill/tsconfig.json`
- `apps/gateway/tsconfig.json`

**Changes**: Add `vitest.config.ts` to the `exclude` array to prevent Next.js build type-checking from following vitest imports.

```json
{
  "exclude": ["node_modules", "vitest.config.ts"]
}
```

Note: Only modify tsconfigs for packages that have a `vitest.config.ts` file.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds after adding vitest to root
- [x] `pnpm build` succeeds — all apps compile cleanly
- [x] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (pre-existing ESLint failures in backfill/connections/console/gateway unrelated to our changes)

#### Manual Verification:
- [x] Confirm the www build output shows "Compiled successfully"
- [x] Confirm no new warnings introduced

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Optimize Vitest/Turbo Test System

### Overview
Enable turbo test caching and clean up orphan test configs for a faster, more efficient test pipeline.

### Changes Required:

#### 1. Enable test caching in turbo.json
**File**: `turbo.json`
**Changes**: Remove `"cache": false` from the test task and add proper inputs so turbo can cache test results.

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": [
    "src/**",
    "vitest.config.ts",
    "tsconfig.json"
  ],
  "outputs": [],
  "env": []
}
```

Key decisions:
- `inputs`: Only re-run tests when source files or test config changes. Turborepo defaults to all non-gitignored files, but explicit `src/**` is clearer.
- `outputs: []`: Tests don't produce cacheable artifacts, but turbo still caches the pass/fail status.
- Removing `"cache": false` enables caching — turbo will skip test tasks when inputs haven't changed.

#### 2. Add test script to `apps/www`
**File**: `apps/www/package.json`
**Changes**: Add `"test": "vitest run"` since it has both a vitest.config.ts and a test file (`src/app/(app)/(internal)/pitch-deck/_lib/animation-utils.test.ts`).

#### 3. Remove vitest config from `apps/www` if test script isn't needed
**Alternative to #2**: If the www test file is trivial/unused, remove both `vitest.config.ts` and the `vitest` devDependency from www instead. This is a judgment call — ask user.

#### 4. Clean up `core/mcp` test script
**File**: `core/mcp/package.json`
**Changes**: Verify `core/mcp` has 0 test files. If confirmed, remove the `test` script to avoid running vitest with no tests (wastes time even if fast).

### Success Criteria:

#### Automated Verification:
- [x] `pnpm test` runs successfully on first execution
- [x] `pnpm test` on second identical run shows all tasks as CACHED: `turbo run test --dry` shows cache HIT (64/75 tasks cached)
- [x] `pnpm build` still passes after all changes
- [x] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (pre-existing failures unrelated to our changes)

#### Manual Verification:
- [x] Confirm turbo test output shows "FULL TURBO" on cached runs
- [x] Verify that modifying a test file in one package triggers only that package's tests to re-run

---

## Testing Strategy

### Build Verification:
- Run `pnpm build` — all 4 app builds must succeed
- Run `pnpm build:www` specifically to confirm the fix

### Test Cache Verification:
1. `pnpm test` — first run, all tests execute
2. `pnpm test` — second run, all should be cached
3. Touch a test file in one package, run `pnpm test` — only that package re-runs

### Regression Check:
- `pnpm typecheck` and `pnpm lint` pass to ensure no type/lint regressions

## Performance Considerations

- Enabling test caching should dramatically reduce CI time for PRs that don't touch test-related code
- The 11 vitest instances × 2 threads = 22 threads model from the shared config remains optimal
- No performance regression expected from the tsconfig exclusions

## References

- Build failure commit: `b881b0a5d` (perf(test): optimize vitest CPU usage)
- Root vitest config: `vitest.shared.ts`
- Turbo test pipeline: `turbo.json:52-56`
- Related plan: `thoughts/shared/plans/2026-03-01-github-connections-e2e-testing.md`
