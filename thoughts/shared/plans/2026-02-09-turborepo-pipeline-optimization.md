---
date: 2026-02-09T19:30:00-08:00
author: claude-opus-4.6
topic: "Turborepo Pipeline Optimization"
tags: [implementation-plan, build-optimization, turborepo, ci-cd, caching, pipeline]
status: draft
based_on:
  - thoughts/shared/research/2026-02-09-console-optimization-turborepo.md
priority: HIGH
estimated_impact: "50-80% cache hit improvement, 30-50% faster local builds"
---

# Turborepo Pipeline Optimization Implementation Plan

## Overview

Optimize Turborepo configuration to improve cache effectiveness and build performance by: (1) migrating 112 global environment variables to task-level scope, (2) unblocking lint/typecheck from sequential build dependency, (3) enabling docs caching, (4) enforcing code quality in CI, and (5) using `--affected` flag for faster CI runs.

## Current State Analysis

### Global Environment Explosion
**File:** `turbo.json:67-179`

112 environment variables declared in `globalEnv`, causing all task caches to invalidate when any single variable changes:
- Database: 4 vars (POSTGRES_URL, DATABASE_HOST, etc.)
- Clerk: 14 vars (keys, URLs, M2M tokens)
- Sentry: 9 vars (DSN, org, project, auth)
- GitHub: 8 vars (client ID/secret, webhook, app credentials)
- AI & Embeddings: 4 vars (Anthropic, OpenAI, Cohere, Pinecone)
- Plus 73 more across BetterStack, Inngest, Knock, storage, analytics, etc.

**Impact:** Rotating a single API key invalidates ALL cached builds across the monorepo.

### Sequential Lint/Typecheck
**Files:** `turbo.json:33-39`

Both `lint` and `typecheck` depend on `^build`:
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

**Impact:** Running `pnpm lint` or `pnpm typecheck` locally waits for full dependency build first. CI already parallelizes these as separate jobs, so the main benefit is for local development.

### Docs Build Cache Disabled
**File:** `apps/docs/turbo.json:7`

```json
"build": {
  "dependsOn": ["^build"],
  "cache": false,
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**Impact:** Docs rebuild fully every time, even with no changes.

### CI Quality Suppression
**Files:** `.github/workflows/ci.yml:64-65, 95-96`

```yaml
pnpm --filter lightfast lint || echo "⚠️ Linting issues found..."
pnpm --filter lightfast typecheck || echo "⚠️ Type errors found..."
```

**Impact:** Lint and typecheck failures are swallowed. The `ci-success` job checks result status but these jobs always succeed, making the check unreliable.

### CI Turbo Usage
**File:** `.github/workflows/ci.yml:155`

Only build uses turbo explicitly: `pnpm turbo build --filter lightfast --filter @lightfastai/mcp`

Lint/typecheck use `pnpm --filter` directly, missing out on turbo's task caching and `--affected` optimization.

## Desired End State

After implementation:
1. **Task-scoped environment variables** — Each task depends only on env vars it uses
2. **Parallel lint/typecheck** — No artificial `^build` dependency for local runs
3. **Docs caching enabled** — Docs rebuild only when content/code changes
4. **CI quality enforcement** — Lint/typecheck failures block PRs
5. **Optimized CI runs** — Use `pnpm turbo --affected` for all quality tasks

### Verification:
- Run `pnpm lint` locally and confirm it starts immediately (no build wait)
- Change unrelated env var, run `pnpm turbo build`, confirm cache hit
- CI fails when lint/typecheck have errors
- CI skips unaffected packages when only 1-2 packages change

## What We're NOT Doing

- **Transit nodes** — Not adding `//#check` task (adds complexity with minimal benefit)
- **Remote caching setup** — Assumes Vercel remote cache is already configured
- **Rewriting CI workflow** — Keeping existing job structure, only fixing suppression and adding `--affected`
- **turbo-ignore** — Already implemented in all 5 apps' `vercel.json`

## Implementation Approach

**Strategy:** Incremental, testable phases. Each phase includes automated verification before proceeding. Start with highest-impact (globalEnv migration), then improve parallelism, then enforce quality.

**Risk mitigation:** Test each phase independently. If removing `^build` from typecheck causes issues (path aliases to `dist/`), only remove it from `lint`.

---

## Phase 1: Migrate Global Env to Task-Level Env

### Overview
Move 112 environment variables from `globalEnv` to task-specific `env` configurations. Keep only truly global variables (NODE_ENV, CI) in `globalEnv`.

### Changes Required

#### 1. Root `turbo.json` — Global Env Reduction
**File:** `turbo.json:67-179`

**Before:**
```json
{
  "globalEnv": [
    "POSTGRES_URL",
    "DATABASE_HOST",
    "CLERK_SECRET_KEY",
    "ANTHROPIC_API_KEY",
    // ... 108 more variables
  ]
}
```

**After:**
```json
{
  "globalEnv": [
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
  ]
}
```

**Reasoning:** Only variables that affect ALL tasks should be global. Node environment and CI context are universal. PassThrough vars are framework/platform variables that should be available but don't affect cache invalidation.

#### 2. Root `turbo.json` — Build Task Env
**File:** `turbo.json:5-8`

**Add to build task:**
```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json", "dist/**"],
  "env": [
    "NEXT_PUBLIC_*",
    "SENTRY_*",
    "VERCEL_ENV"
  ]
}
```

**Reasoning:** Build tasks only need public env vars (bundled into client), Sentry config (for sourcemaps), and deployment env. Wildcard patterns capture all variants (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_POSTHOG_KEY, etc.).

#### 3. Root `turbo.json` — Lint/Typecheck Tasks
**File:** `turbo.json:33-40`

**Add empty env arrays:**
```json
"lint": {
  "dependsOn": ["^build"],
  "outputs": [".cache/.eslintcache"],
  "env": []
},
"typecheck": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json"],
  "env": []
}
```

**Reasoning:** Lint and typecheck analyze source code, not runtime environment. They don't need any env vars for cache invalidation.

#### 4. Per-App Overrides — Console Build
**File:** `apps/console/turbo.json:6-9`

**After:**
```json
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
}
```

**Reasoning:** Console app uses specific public env vars. List them explicitly rather than relying on wildcard to ensure proper cache invalidation when these specific vars change.

#### 5. Per-App Overrides — Other Apps
**Files:** `apps/www/turbo.json`, `apps/auth/turbo.json`, `apps/chat/turbo.json`, `apps/docs/turbo.json`

**Pattern to follow:**
```json
"build": {
  "dependsOn": ["^build"],
  "env": [
    // List only NEXT_PUBLIC_* and SENTRY_* vars used by this specific app
    // Check each app's .env.development.local and source code
  ],
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**Action required:** Audit each app's actual env usage:
1. Read `apps/<app>/.vercel/.env.development.local`
2. Grep for `process.env` in `apps/<app>/src/**`
3. Extract only NEXT_PUBLIC_* and SENTRY_* vars
4. Add to per-app turbo.json

### Success Criteria

#### Automated Verification:
- [ ] All packages build successfully: `pnpm turbo build`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] CI build job passes: push to test branch and verify CI

#### Manual Verification:
- [ ] Test cache invalidation: Change an unrelated env var (e.g., BRAINTRUST_API_KEY) and run `pnpm turbo build --filter @lightfast/console`. Should see cache hit.
- [ ] Test cache invalidation: Change a console-specific env var (e.g., NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) and run `pnpm turbo build --filter @lightfast/console`. Should see cache miss.
- [ ] Test global cache: Change NODE_ENV and run `pnpm turbo build`. All tasks should cache miss (expected).

**Implementation Note:** After completing this phase and all automated verification passes, test the manual cache invalidation scenarios before proceeding to Phase 2.

---

## Phase 2: Unblock Lint and Typecheck from Build

### Overview
Remove `^build` dependency from `lint` and `typecheck` tasks to enable parallel execution. ESLint and tsc work on source TypeScript files, not compiled artifacts.

### Changes Required

#### 1. Root `turbo.json` — Remove Build Dependency
**File:** `turbo.json:33-40`

**Before:**
```json
"lint": {
  "dependsOn": ["^build"],
  "outputs": [".cache/.eslintcache"],
  "env": []
},
"typecheck": {
  "dependsOn": ["^build"],
  "outputs": [".cache/tsbuildinfo.json"],
  "env": []
}
```

**After:**
```json
"lint": {
  "dependsOn": [],
  "outputs": [".cache/.eslintcache"],
  "env": []
},
"typecheck": {
  "dependsOn": [],
  "outputs": [".cache/tsbuildinfo.json"],
  "env": []
}
```

**Reasoning:** Lint analyzes source code style, typecheck analyzes TypeScript types. Neither needs built artifacts. If packages use path aliases to `dist/`, typecheck might fail — in that case, only remove `^build` from `lint` and keep it for `typecheck`.

### Success Criteria

#### Automated Verification:
- [ ] Lint runs successfully without build: `pnpm turbo lint`
- [ ] Typecheck runs successfully without build: `pnpm turbo typecheck`
- [ ] Both run in parallel: `pnpm turbo lint typecheck --parallel` (check logs for concurrent execution)

#### Manual Verification:
- [ ] Time `pnpm lint` before and after. Should be 30-50% faster without waiting for build.
- [ ] If typecheck fails with module resolution errors, revert typecheck to use `"dependsOn": ["^build"]` and only keep lint unblocked.

**Implementation Note:** After automated verification passes, test the timing improvement. If typecheck has issues, partially roll back that task only.

---

## Phase 3: Enable Docs Build Caching

### Overview
Remove `cache: false` from docs build task to leverage Turbo's caching. Docs builds are deterministic — same inputs produce same outputs.

### Changes Required

#### 1. Docs `turbo.json` — Enable Caching
**File:** `apps/docs/turbo.json:7`

**Before:**
```json
"build": {
  "dependsOn": ["^build"],
  "cache": false,
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**After:**
```json
"build": {
  "dependsOn": ["^build"],
  "env": [
    "BASEHUB_TOKEN",
    "BASEHUB_ADMIN_TOKEN"
  ],
  "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
}
```

**Reasoning:** If cache was disabled due to CMS content (Basehub) fetched at build time, adding the CMS token to `env` ensures cache invalidates when content changes. Removing `cache: false` allows caching when content hasn't changed.

### Success Criteria

#### Automated Verification:
- [ ] Docs build succeeds: `pnpm turbo build --filter @lightfast/docs`
- [ ] Second build hits cache: Run build twice, verify "cache hit" in logs

#### Manual Verification:
- [ ] Verify CMS content updates trigger rebuild: Change something in Basehub, run build, should see cache miss
- [ ] Verify code-only changes trigger rebuild: Edit a docs page component, should see cache miss
- [ ] Verify no changes hit cache: Run build twice with no changes, should see cache hit on second run

**Implementation Note:** After automated verification, test the CMS content change scenario to ensure cache invalidates correctly.

---

## Phase 4: Fix CI Lint/Typecheck Suppression

### Overview
Remove error suppression from lint and typecheck jobs in CI to enforce code quality. Currently failures are swallowed with `|| echo` pattern.

### Changes Required

#### 1. CI Workflow — Lint Job
**File:** `.github/workflows/ci.yml:60-65`

**Before:**
```yaml
- name: Lint packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast lint || echo "⚠️ Linting issues found in lightfast but not blocking CI"
    pnpm --filter @lightfastai/mcp lint || echo "⚠️ Linting issues found in @lightfastai/mcp but not blocking CI"
```

**After:**
```yaml
- name: Lint packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast lint
    pnpm --filter @lightfastai/mcp lint
```

**Reasoning:** Lint failures should block CI. Remove `|| echo` to let errors propagate and fail the job.

#### 2. CI Workflow — Typecheck Job
**File:** `.github/workflows/ci.yml:91-96`

**Before:**
```yaml
- name: Type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast typecheck || echo "⚠️ Type errors found in lightfast but not blocking CI"
    pnpm --filter @lightfastai/mcp typecheck || echo "⚠️ Type errors found in @lightfastai/mcp but not blocking CI"
```

**After:**
```yaml
- name: Type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast typecheck
    pnpm --filter @lightfastai/mcp typecheck
```

**Reasoning:** Typecheck failures should block CI. Remove `|| echo` to let errors propagate and fail the job.

#### 3. Fix Pre-existing Issues
**Action required before enabling enforcement:**

1. Run lint locally: `pnpm --filter lightfast lint && pnpm --filter @lightfastai/mcp lint`
2. Fix any lint errors found
3. Run typecheck locally: `pnpm --filter lightfast typecheck && pnpm --filter @lightfastai/mcp typecheck`
4. Fix any type errors found
5. Commit fixes before updating CI workflow

### Success Criteria

#### Automated Verification:
- [ ] Lint passes locally on main: `pnpm --filter lightfast lint && pnpm --filter @lightfastai/mcp lint`
- [ ] Typecheck passes locally on main: `pnpm --filter lightfast typecheck && pnpm --filter @lightfastai/mcp typecheck`
- [ ] CI lint job passes: Push to test branch, verify lint job succeeds
- [ ] CI typecheck job passes: Push to test branch, verify typecheck job succeeds

#### Manual Verification:
- [ ] Test enforcement: Introduce a lint error (e.g., unused variable) and push to test branch. CI lint job should fail.
- [ ] Test enforcement: Introduce a type error (e.g., wrong type annotation) and push to test branch. CI typecheck job should fail.
- [ ] Revert test errors and verify CI passes again

**Implementation Note:** Fix all pre-existing lint/typecheck issues locally BEFORE updating the CI workflow. This prevents immediately broken CI.

---

## Phase 5: Optimize CI with `--affected` and Turbo

### Overview
Use Turbo's `--affected` flag and replace `pnpm --filter` with `pnpm turbo` for lint/typecheck to leverage task caching and skip unaffected packages.

### Changes Required

#### 1. CI Workflow — Lint Job
**File:** `.github/workflows/ci.yml:60-65`

**Before:**
```yaml
- name: Lint packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast lint
    pnpm --filter @lightfastai/mcp lint
```

**After:**
```yaml
- name: Lint packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo lint --affected
```

**Reasoning:** `--affected` uses git diff to determine which packages changed and only runs lint on those + their dependents. More efficient than hardcoded filters.

#### 2. CI Workflow — Typecheck Job
**File:** `.github/workflows/ci.yml:91-96`

**Before:**
```yaml
- name: Type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: |
    pnpm --filter lightfast typecheck
    pnpm --filter @lightfastai/mcp typecheck
```

**After:**
```yaml
- name: Type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo typecheck --affected
```

**Reasoning:** Same as lint — only typecheck affected packages.

#### 3. CI Workflow — Build Job
**File:** `.github/workflows/ci.yml:152-155`

**Before:**
```yaml
- name: Build packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo build --filter lightfast --filter @lightfastai/mcp
```

**After:**
```yaml
- name: Build packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo build --affected
```

**Reasoning:** Already using turbo, just add `--affected` flag.

#### 4. Keep Path Filter for Job Triggering
**File:** `.github/workflows/ci.yml:25-34`

**Do NOT change** the `dorny/paths-filter` action. It's still useful for skipping entire workflow when no relevant files changed. `--affected` optimizes within the workflow.

### Success Criteria

#### Automated Verification:
- [ ] CI runs successfully with `--affected`: Push test change to main
- [ ] Verify affected detection: Check CI logs to confirm only changed packages ran

#### Manual Verification:
- [ ] Test unaffected skip: Change only `apps/www/src/app/page.tsx` and push. Verify CI skips `lightfast` and `@lightfastai/mcp` packages.
- [ ] Test core change: Change `core/lightfast/src/client.ts` and push. Verify CI runs lint/typecheck/build for `lightfast`.
- [ ] Test full run: Change `pnpm-lock.yaml` and push. Verify CI runs all packages (lockfile change affects all).

**Implementation Note:** After implementing, test with changes to different areas of the monorepo to verify affected detection works correctly.

---

## Testing Strategy

### Unit Tests
No new unit tests required — this is infrastructure optimization.

### Integration Tests
- **Cache hit rate:** Monitor turbo cache logs before/after Phase 1
- **Parallel execution:** Verify `pnpm turbo lint typecheck --parallel` shows concurrent runs after Phase 2
- **CI timing:** Compare CI duration before/after Phase 5 using GitHub Actions timing data

### Manual Testing Steps

#### Phase 1 (Global Env Migration):
1. Identify baseline: Run `pnpm turbo build` twice, note cache hits
2. Change unrelated env var: `export BRAINTRUST_API_KEY=new-value`
3. Run `pnpm turbo build` again, verify cache hits (should invalidate before Phase 1, hit after)
4. Change relevant env var: `export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=new-value`
5. Run `pnpm turbo build --filter @lightfast/console`, verify cache miss (should invalidate)

#### Phase 2 (Unblock Lint/Typecheck):
1. Time baseline: `time pnpm lint` (should wait for build first)
2. After changes: `time pnpm lint` (should start immediately)
3. Compare times, expect 30-50% improvement

#### Phase 4 (CI Enforcement):
1. Create test branch with lint error
2. Push and verify CI fails at lint job
3. Fix error and verify CI passes

#### Phase 5 (Affected):
1. Change only `apps/www` code
2. Check CI logs for which packages ran lint/typecheck/build
3. Verify `lightfast` and `@lightfastai/mcp` were skipped

## Performance Considerations

### Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Cache hit rate | Low (global env) | High (scoped env) | 50-80% improvement |
| Local lint time | Waits for build | Immediate | 30-50% faster |
| CI when 1 package changes | All packages | Affected only | 50-70% faster |
| Docs rebuild | Always full | Only on changes | Near-instant on cache hit |

### Monitoring

After deployment, track:
- Turbo cache hit/miss ratio in CI logs
- CI job duration trends (GitHub Actions UI)
- Developer feedback on local build times
- Vercel deployment frequency (should remain low due to existing turbo-ignore)

## Migration Notes

### Rollback Plan

Each phase is independently revertable:
- **Phase 1:** Restore `globalEnv` array in `turbo.json`
- **Phase 2:** Add back `"dependsOn": ["^build"]` to lint/typecheck
- **Phase 3:** Add back `"cache": false` to docs build
- **Phase 4:** Restore `|| echo` pattern in CI
- **Phase 5:** Remove `--affected` flag from CI commands

### Backward Compatibility

No breaking changes — all optimizations are transparent to package code. Scripts in `package.json` remain unchanged.

### Team Communication

Before Phase 4 (CI enforcement):
1. Announce upcoming change in team channel
2. Ask developers to run `pnpm lint && pnpm typecheck` locally
3. Fix any pre-existing issues before updating CI
4. Schedule change for after all open PRs are merged

## References

- Original research: `thoughts/shared/research/2026-02-09-console-optimization-turborepo.md`
- Turborepo docs: https://turbo.build/repo/docs/core-concepts/caching
- Current config: `turbo.json:1-192`
- CI workflow: `.github/workflows/ci.yml:1-182`
- Per-app configs: `apps/{auth,chat,console,docs,www}/turbo.json`
