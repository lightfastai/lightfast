---
date: 2026-05-07
plan_for: turbo-cache-audit-and-wrap
branch: feat/ci-turbo-cache-audit
worktree: .claude/worktrees/feat-ci-turbo-cache-audit
related_research: thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md
status: ready
---

# Turbo + Vercel Remote Cache: Audit, Verify, and Wrap Bypassed Work

## Overview

We've wired `TURBO_TOKEN`/`TURBO_TEAM` into every CI workflow but have never measured whether the remote cache is actually working. Plus several heavy CI steps invoke `pnpm`/`pnpm exec` directly — bypassing Turbo entirely so they can never benefit from caching at all. This plan installs a measurement system, fixes whatever it surfaces, and brings the bypassed work under Turbo.

End state: every PR's GitHub Actions run prints a per-task cache hit/miss table in the workflow summary, and the load-bearing CI steps (lint, knip, desktop typecheck/package, core test) all route through Turbo so they're cacheable.

## Current State Analysis

**What's wired today** (every workflow has these env vars on every job):
- `.github/workflows/ci.yml:19-20` — `quality` job
- `.github/workflows/ci-core.yml:19-20, 51-53, 81-83` — `quality` / `test` / `build`
- `.github/workflows/desktop-ci.yml:40-42` — matrix job
- `.github/workflows/desktop-release.yml` — every build job
- `.github/workflows/release.yml:14-16` *(Note: env vars NOT set on this job — see Phase 3 fix)*

**Verified bypasses** (work that runs but never touches the Turbo cache):
- `ci.yml:48` — `pnpm check` (biome via `ultracite`) — root-level direct invoke
- `ci.yml:61` — `pnpm knip` — root-level direct invoke
- `ci-core.yml:75` — `pnpm --filter lightfast test` — pnpm not turbo
- `desktop-ci.yml:65` — `pnpm --filter @lightfast/desktop typecheck` — pnpm not turbo
- `desktop-ci.yml:71` — `pnpm --filter @lightfast/desktop package` — pnpm + no turbo task exists
- `desktop-release.yml:160, 234` — `pnpm exec electron-forge publish` — pnpm + no turbo task exists
- `release.yml:54` — `pnpm --filter lightfast test` — pnpm not turbo, AND missing `TURBO_TOKEN`/`TURBO_TEAM` env entirely

**Routed through Turbo today** (these *should* benefit from cache, but hit-rate unmeasured):
- `ci.yml:41` — `pnpm turbo generate:openapi`
- `ci.yml:54` — `pnpm turbo typecheck --affected --continue`
- `ci.yml:57` — `pnpm turbo boundaries`
- `ci-core.yml:45` — `pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue`
- `ci-core.yml:105` — `pnpm turbo build --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli`
- `release.yml:49` — `pnpm turbo build --filter lightfast --filter @lightfastai/mcp --filter @lightfastai/cli`

**Root `turbo.json` task config** (`turbo.json:4-78`):
- `build`: `dependsOn: [^build]`, `outputs: [.cache/tsbuildinfo.json, dist/**, .next/**, !.next/cache/**, !.next/dev/**]`, `env: [NEXT_PUBLIC_*, SENTRY_*, VERCEL_ENV]`
- `test`: `dependsOn: [^build]`, `inputs: [src/**, vitest.config.ts, tsconfig.json]`, `outputs: []` (caches success-only)
- `typecheck`: `dependsOn: [^build, transit]`, `outputs: [.cache/tsbuildinfo.json]`, `env: []`
- `generate:openapi`: `dependsOn: [^build]`, `outputs: [openapi.json]`
- `globalEnv: [CI]` — only `CI` is hashed globally
- No `lint`, `knip`, or `package` tasks exist — those need to be added in Phase 3

**Missing turbo.json files**: `apps/desktop/` has no `turbo.json` at all (`find ... apps/desktop` confirms). Every other workspace package has one.

**Worktree convention** (`git worktree list`): `.claude/worktrees/<branch-slug>` on a `feat/...` branch (matches `.claude/worktrees/feat-desktop-sqlite-persistence`).

## Desired End State

### Specification

A new contributor opens a PR and within ~2 minutes sees, in the workflow run's Summary tab:

```
### Turbo cache report — CI / Quality

| Task                                  | Cache | Source | Time |
|---------------------------------------|-------|--------|-----:|
| @repo/...#typecheck                   | HIT   | remote | 1.2s |
| @lightfast/app#typecheck              | HIT   | remote | 0.9s |
| @lightfastai/cli#typecheck            | MISS  | —      | 4.1s |
...
Hit rate: 18/22 = 82% remote
```

Per-workflow summaries appear for `CI`, `Core CI`, `Desktop CI`. Raw `.turbo/runs/*.json` is uploaded as an artifact named `turbo-cache-<workflow>-<job>` retained 7 days.

The previously-bypassed steps are now Turbo-routed:

- `ci.yml` calls `pnpm turbo //#check` (was `pnpm check`)
- `ci.yml` calls `pnpm turbo //#knip` (was `pnpm knip`)
- `ci-core.yml` calls `pnpm turbo test --filter=lightfast` (was `pnpm --filter lightfast test`)
- `release.yml` calls `pnpm turbo test --filter=lightfast` (was `pnpm --filter lightfast test`) AND has `TURBO_TOKEN`/`TURBO_TEAM` set
- `desktop-ci.yml` calls `pnpm turbo typecheck --filter=@lightfast/desktop` and `pnpm turbo package --filter=@lightfast/desktop`
- `desktop-release.yml` is unchanged in this plan — `electron-forge publish` is left intact (caching it is risky because outputs go to GitHub Releases, not `out/**`)

### Verification (manual after final phase)

1. Open the GitHub Actions run for a no-op PR (e.g. README typo). The `CI / Quality` summary tab shows hit rate ≥ 80% remote.
2. The `Desktop CI` summary tab shows the new `package` and `typecheck` tasks appearing as cache HIT on the second run.
3. Re-run the same workflow on the same commit. Hit rate is ≥ 95% remote (warm-cache run).
4. Inspect `vercel.com/<team>/settings/turborepo-remote-cache` and confirm cache traffic increased after the rollout.

## Key Discoveries

- `globalEnv: [CI]` (`turbo.json:79`) — `CI=true` in GitHub Actions is consistent, so it doesn't poison the hash. Good.
- `globalPassThroughEnv` (`turbo.json:80-87`) — these are passed *through* without affecting the hash, so noisy values like `VERCEL_URL` won't bust cache.
- `release.yml:14-16` does NOT set `TURBO_TOKEN`/`TURBO_TEAM` env on the `release` job — every release-build is a guaranteed cache miss today, even though it runs `pnpm turbo build`. This is a one-line fix bundled into Phase 3.
- The `test` task already declares `outputs: []` — fine for cache-success-only. Don't change.
- Apps with `inputs: ["$TURBO_DEFAULT$", ".vercel/.env*"]` (`apps/app/turbo.json:55`, etc.) include `.env` files — these *aren't checked in*, but the glob is "no-match → no input" so it doesn't break hashing.
- The `transit` task (`turbo.json:36-38`) is a no-op task used to chain dependencies. No package implements it today (`grep '"transit"'` in package.json files returns nothing). It's harmless boilerplate.

## What We're NOT Doing

- **Not migrating to Depot or Blacksmith** — that's Workstream A in the research doc and is a separate plan. The two are independent.
- **Not caching `electron-forge publish`** — its side effect is uploading to GitHub Releases, which can't be reproduced from cached `out/**` files. We wrap `package` (which produces `out/**`) but leave `publish` invoked directly in `desktop-release.yml`.
- **Not adding a hash-stability gate** — explicitly chosen against. Verification is via the per-PR summary table; if hashes go unstable the hit rate drops and we notice.
- **Not adding a PR comment** — explicitly chosen against. Workflow summary + artifact only.
- **Not refactoring the `transit` task** — out of scope.
- **Not touching `codeql.yml`, `verify-changeset.yml`, or `db-migrate.yml`** — they don't run Turbo and don't need to.

## Implementation Approach

Five phases. Phase 0 sets up the worktree. Phases 1–2 install measurement and use it to fix existing routed-through-Turbo work. Phase 3 wraps the bypassed work. Phase 4 is a final cross-workflow verification pass.

The order is deliberate: install the meter (1) before doing the work (2, 3) so we have a baseline AND can see the effect of each change.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Provision worktree [DONE]

### Overview

Create an isolated worktree for the implementation work. This avoids contaminating the current `refactor/repo-barebones-reset` branch (which has uncommitted changes) and lets the implementer push a clean PR branch.

### Changes Required:

#### 1. Worktree

**Command** (run from repo root):

```bash
git fetch origin main
git worktree add .claude/worktrees/feat-ci-turbo-cache-audit -b feat/ci-turbo-cache-audit origin/main
cd .claude/worktrees/feat-ci-turbo-cache-audit
pnpm install --frozen-lockfile
```

#### 2. Verify worktree

```bash
git -C .claude/worktrees/feat-ci-turbo-cache-audit status
git -C .claude/worktrees/feat-ci-turbo-cache-audit log -1 --oneline
```

### Success Criteria:

#### Automated Verification:

- [x] Worktree directory exists: `test -d .claude/worktrees/feat-ci-turbo-cache-audit`
- [x] Branch is `feat/ci-turbo-cache-audit`: `git -C .claude/worktrees/feat-ci-turbo-cache-audit branch --show-current`
- [x] Tip matches `origin/main`: `git -C .claude/worktrees/feat-ci-turbo-cache-audit log -1 --format='%H' = git rev-parse origin/main`
- [x] `pnpm install --frozen-lockfile` succeeds in the worktree
- [x] `pnpm turbo --version` runs cleanly inside the worktree

#### Human Review:

- [ ] Open a second editor pane / terminal at `.claude/worktrees/feat-ci-turbo-cache-audit` → confirm it's a clean working tree

---

## Phase 1: Install cache-report system [DONE]

> **Implementation note (2026-05-07)**: `pnpm turbo boundaries --summarize` was rejected by Turbo 2.9.6 — `--summarize` is a `turbo run` flag, not a top-level subcommand flag. `turbo boundaries` is a separate diagnostic subcommand and never wrote to `.turbo/runs/` regardless. The plan's instruction to add `--summarize` to that line was dropped; the line stays as `pnpm turbo boundaries`. The other two `turbo run` invocations in `ci.yml` (`generate:openapi`, `typecheck`) keep `--summarize` and feed the reporter.

### Overview

Add a small reporter script that consumes `.turbo/runs/*.json` (Turbo's built-in summary output) and emits a markdown table. Wire it into every Turbo-invoking CI step. No behavior changes to the underlying tasks — pure observability.

### Changes Required:

#### 1. Reporter script

**File**: `scripts/turbo-cache-report.mjs` (new)

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const runsDir = process.argv[2] ?? '.turbo/runs';
const title = process.argv[3] ?? 'Turbo cache report';

let files = [];
try {
  files = readdirSync(runsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, mtime: statSync(join(runsDir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
} catch {
  console.log(`### ${title}\n\n_No .turbo/runs/ found — Turbo wasn't run with --summarize._`);
  process.exit(0);
}

if (files.length === 0) {
  console.log(`### ${title}\n\n_No summary files in ${runsDir}._`);
  process.exit(0);
}

// Merge tasks across every summary file. A job typically runs more than
// one `pnpm turbo …` invocation, each writing its own .turbo/runs/*.json.
// If a task ID repeats across invocations the most recent (last-mtime) wins.
const tasks = new Map();
for (const { name } of files) {
  const summary = JSON.parse(readFileSync(join(runsDir, name), 'utf8'));
  for (const t of summary.tasks ?? []) {
    const id = t.taskId ?? `${t.package}#${t.task}`;
    tasks.set(id, t);
  }
}

const rows = [...tasks.values()].map((t) => ({
  task: t.taskId ?? `${t.package}#${t.task}`,
  status: t.cache?.status ?? 'unknown',
  source: (t.cache?.source ?? '').toLowerCase() || '—',
  time: t.execution?.startTime && t.execution?.endTime
    ? `${((t.execution.endTime - t.execution.startTime) / 1000).toFixed(1)}s`
    : '—',
}));

const hits = rows.filter((r) => r.status === 'HIT').length;
const total = rows.length;
const pct = total > 0 ? Math.round((hits / total) * 100) : 0;

console.log(`### ${title}\n`);
console.log(`**Hit rate**: ${hits}/${total} = ${pct}%\n`);
console.log('| Task | Cache | Source | Time |');
console.log('|------|-------|--------|-----:|');
for (const r of rows) {
  console.log(`| \`${r.task}\` | ${r.status} | ${r.source} | ${r.time} |`);
}
```

**Notes** (verified against Turbo 2.9.6 — see Improvement Log spike):
- `pnpm turbo … --summarize` writes one `.turbo/runs/<KSUID>.json` per invocation. A job that runs multiple turbo commands produces multiple files — the script merges them all, keyed by `taskId`.
- Each task entry has `taskId` (e.g. `"@lightfastai/cli#typecheck"`), `cache: { status, source, … }`, and `execution: { startTime, endTime }` in ms epoch.
- `cache.status ∈ { HIT, MISS }`. `cache.source ∈ { LOCAL, REMOTE }` — **uppercase**; the script lowercases for display.
- Pure node, no dependencies, matches the existing `scripts/*.mjs` convention (shebang + ESM, no leading comment header).

#### 2. Reusable composite action

**File**: `.github/actions/turbo-summary/action.yml` (new)

```yaml
name: 'Turbo cache summary'
description: 'Summarize the latest .turbo/runs/*.json into the workflow summary, and upload as artifact.'
inputs:
  title:
    description: 'Title shown in the workflow summary section'
    required: true
  artifact-name:
    description: 'Artifact name (must be unique per job)'
    required: true
runs:
  using: 'composite'
  steps:
    - name: Append cache report to workflow summary
      shell: bash
      run: |
        if [ -d ".turbo/runs" ]; then
          node scripts/turbo-cache-report.mjs .turbo/runs "${{ inputs.title }}" >> "$GITHUB_STEP_SUMMARY"
        else
          echo "### ${{ inputs.title }}" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "_Turbo wasn't run with \`--summarize\` in this job — no report available._" >> "$GITHUB_STEP_SUMMARY"
        fi
    - name: Upload .turbo/runs artifact
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: ${{ inputs.artifact-name }}
        path: .turbo/runs/
        if-no-files-found: ignore
        retention-days: 7
```

#### 3. Add `--summarize` to every Turbo invocation in CI

**File**: `.github/workflows/ci.yml`
**Changes**: Add `--summarize` to the three Turbo calls in `ci.yml:41,54,57`. Add the composite action as the final step of the `quality` job.

```yaml
# ci.yml — quality job, three replacements:
- pnpm turbo generate:openapi
+ pnpm turbo generate:openapi --summarize

- pnpm turbo typecheck --affected --continue
+ pnpm turbo typecheck --affected --continue --summarize

- pnpm turbo boundaries
+ pnpm turbo boundaries --summarize

# And append at end of `quality` job steps:
+ - name: Cache report
+   if: always()
+   uses: ./.github/actions/turbo-summary
+   with:
+     title: 'Turbo cache report — CI / Quality'
+     artifact-name: turbo-cache-ci-quality
```

**File**: `.github/workflows/ci-core.yml`
**Changes**: Add `--summarize` to the two Turbo calls (`ci-core.yml:45,105`). Add composite-action step at the end of `quality` and `build` jobs.

```yaml
# Quality job:
- pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue
+ pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue --summarize

# Build job:
- pnpm turbo build --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli
+ pnpm turbo build --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --summarize

# Append to each of {quality, build}:
+ - name: Cache report
+   if: always()
+   uses: ./.github/actions/turbo-summary
+   with:
+     title: 'Turbo cache report — Core CI / <Job>'
+     artifact-name: turbo-cache-core-ci-<job>
```

(`<Job>` = `Quality` / `Build`; `<job>` = `quality` / `build`. Each artifact name must be unique.)

**File**: `.github/workflows/desktop-ci.yml`
**Changes**: No Turbo calls in this file *yet* — wait for Phase 3 to add the wrapped invocations. The composite-action step is added in Phase 3 alongside.

### Success Criteria:

#### Automated Verification:

- [x] `node scripts/turbo-cache-report.mjs .turbo/runs "Test"` runs without throwing on a fresh install (will print "no summary files" if none — exit 0)
- [x] `pnpm turbo typecheck --filter=lightfast --summarize` produces `.turbo/runs/*.json`
- [x] `node scripts/turbo-cache-report.mjs .turbo/runs "Local test"` prints a markdown table with at least one row
- [x] After running two distinct turbo invocations in the same shell (used `typecheck --filter=lightfast --summarize` + `build --filter=lightfast --summarize` since `boundaries` doesn't accept `--summarize`) the reporter table contains rows from BOTH invocations (verifies the merge logic)
- [ ] PR push triggers all three workflows (`CI`, `Core CI`) and each shows a `Turbo cache report —` section in the workflow summary _(deferred — verified after push)_

#### Human Review:

- [ ] Open the workflow run page on the PR → click "Summary" → confirm the hit/miss table is rendered for each instrumented job
- [ ] Click the artifact `turbo-cache-ci-quality` → download → confirm the JSON inside has a populated `tasks` array

---

## Phase 2: Diagnose and fix cache misses surfaced by Phase 1

### Overview

Use the Phase 1 system to read the actual hit rate. Drive a focused fix loop: each pass identifies one cache-killer, fixes it, and re-measures. Stop when the rate is acceptable.

This phase is **conditional on Phase 1 data**. If Phase 1 already shows ≥ 80% hit rate after warm-up, skip to Phase 3.

**Time-box**: cap focused investigation at one work day. If hit rate is still unfixable after a day of effort, document the unfixable causes (Step 3 below) and proceed to Phase 3 with the rate as-is — the bypassed work in Phase 3 is independently load-bearing.

### Changes Required:

#### 1. Read the Phase 1 baseline

Let the new instrumentation run for ~3-5 representative PRs (or push a few no-op commits to the worktree branch). Record the per-task hit rate from each workflow's summary into a working note.

Expected pattern of misses to investigate (in priority order):

1. **First-run miss is normal** — the cache is empty for a hash never seen before. Distinguish "first miss, then hit on retry" (healthy) from "miss every time" (broken).
2. **Hash drift across identical commits** — diagnostic: in the worktree, run twice on the same commit:
   ```bash
   pnpm turbo typecheck --filter=lightfast --dry=json > /tmp/run1.json
   pnpm turbo typecheck --filter=lightfast --dry=json > /tmp/run2.json
   diff <(jq -S '.tasks[] | {task: .taskId, hash: .hash}' /tmp/run1.json) \
        <(jq -S '.tasks[] | {task: .taskId, hash: .hash}' /tmp/run2.json)
   ```
   Any non-empty diff means a non-deterministic input. Common causes:
   - File whose content depends on time/path/env (e.g. generated codegen with timestamps)
   - Env var in `globalEnv` or task-level `env` that differs between machines
   - `.env*` glob picking up a file the developer has but CI doesn't, or vice versa
3. **Tasks declared without outputs** — `grep -A2 '"build":\|"test":\|"typecheck":' turbo.json` then audit per-package `turbo.json`. The `test` task is intentionally `outputs: []` (cache-success-only); leave it. Anything else without `outputs` writes nothing to the cache.

#### 2. Apply fixes one at a time

Each fix is a small commit with a clear message. Examples of fixes that *might* be needed (not promised; depends on what Phase 1 surfaces):

- Add a missing `outputs` declaration on a per-package task
- Pin a noisy env var to a deterministic value or remove it from `env`
- Adjust an `inputs` glob that's matching generated files
- Move a codegen step's outputs out of the source tree

Re-run the workflow after each fix; observe the hit rate moving in the summary.

#### 3. Document the fix log

**File**: `thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md` (existing — append a follow-up section)
**Changes**: Add a `## Follow-up — Cache Audit Results YYYY-MM-DD` section recording the baseline hit rate, the fixes applied, and the post-fix rate. This satisfies Open Question #1 from that doc.

### Success Criteria:

#### Automated Verification:

- [ ] On a re-run of any instrumented workflow (same commit), hit rate ≥ 95% remote
- [ ] `pnpm turbo typecheck --filter=lightfast --dry=json` produces identical hashes across two clean runs in the worktree
- [ ] No task that should cache (per the `outputs` declaration) shows `MISS` after a successful prior run

#### Human Review:

- [ ] The follow-up section in the research doc lists each fix applied → confirm it's a coherent narrative, not a kitchen-sink list
- [ ] If hit rate is still < 80% after fixes, the follow-up section explicitly names the unfixable causes (e.g. "Next.js build hashes vary because X")

---

## Phase 3: Wrap bypassed work under Turbo [DONE]

> **Implementation notes (2026-05-07)**:
> - `//#check` inputs use `biome.jsonc` (not `biome.json` as the plan listed); only `biome.jsonc` exists in this repo. `.biomeignore` is also absent. `$TURBO_DEFAULT$` covers all of those anyway.
> - `apps/desktop/turbo.json` `package` task **adds `build/**` to `inputs`** beyond what the plan listed — `apps/desktop/build/` holds entitlements + icons consumed by `electron-forge package`, so they must invalidate the cache. Plan omission caught locally.
> - `release.yml` got a `Cache report` step (the plan only specified the env-var fix and `--summarize`, but the success criterion "On a re-run of Release lightfast, `lightfast#test` and `lightfast#build` both report `HIT remote`" implies a cache-report destination — added the step for consistency with other workflows).
> - `ci-core.yml` `test` job got a `Cache report` step (Phase 1 didn't add one because test was bypassed; now that it's wrapped, the step matches `quality`/`build`).

### Overview

Five concrete wraps. Each is a small change. After each wrap, the Phase 1 instrumentation will pick up the new task in the summary on the next CI run.

### Changes Required:

#### 1. Add `//#check` and `//#knip` root-package tasks to `turbo.json`

**File**: `turbo.json`
**Changes**: Add two new root-package task definitions inside `tasks`. The `//#` prefix is Turbo's task-ID syntax for "this task is the script of the same name in the root `package.json`." Root already has `"check": "npx ultracite@latest check"` and `"knip": "knip"` — they are reused as-is, so no script changes are needed.

```json
"//#check": {
  "inputs": [
    "$TURBO_DEFAULT$",
    "biome.json",
    ".biomeignore"
  ],
  "outputs": []
},
"//#knip": {
  "inputs": [
    "$TURBO_DEFAULT$",
    "knip.json",
    "package.json",
    "pnpm-lock.yaml"
  ],
  "outputs": []
}
```

**Rationale** (each decision is deliberate):

- **`outputs: []`** — both tools are pass-or-fail. Caching success status (no files) is the right pattern.
- **No `dependsOn`** — `pnpm check` and `pnpm knip` run today **without any build prerequisite**. Adding `^build` would force every lint invocation to pull a full workspace build into its dependency graph, hurting CI on cold cache and making local `pnpm turbo //#check` painfully slow on first run. Biome and knip parse source directly; they don't need built artifacts.
- **`$TURBO_DEFAULT$` for inputs** — covers the root package's full file set, so every file type biome handles (TS/TSX/JS/JSON/JSONC/CSS/GraphQL/etc.) invalidates the cache on edit. A narrow `**/*.{ts,tsx,…}` glob would silently produce false HITs on JSON edits.
- **`knip.json` only, not `knip.config.ts`** — only `knip.json` exists in this repo (verified).
- **No workspace-level `lint`/`knip` task definitions** — no package implements those scripts, so they would be orphan config that never runs.
- **No `package.json` changes** — `pnpm check` and `pnpm knip` keep working locally, matching the plan's "developer scripts unchanged" promise.

**Caveat (verified by spike — see Improvement Log)**: Turbo only caches **exit-0** task runs. `knip` is invoked with `continue-on-error: true` precisely because this codebase routinely has unused-export findings (legitimate or not), so `knip` exits non-zero and `//#knip` will report `cache.status: MISS` on every run until the workspace is knip-clean. This is correct Turbo behavior, not a config bug. The cache report will show `//#knip` as MISS persistently — that's fine, the wrapping is still net-positive because (a) it's instrumented for the day knip findings get cleaned up, and (b) the cost of a knip MISS is identical to today's `pnpm knip`. `//#check` (biome) caches reliably as long as the lint passes.

**File**: `.github/workflows/ci.yml`
**Changes**:

```yaml
- name: Lint (biome)
- run: pnpm check
+ run: pnpm turbo //#check --summarize

- name: Check dead code and unused dependencies
  continue-on-error: true
- run: pnpm knip
+ run: pnpm turbo //#knip --summarize
```

#### 2. Wrap core test under Turbo

**File**: `.github/workflows/ci-core.yml`
**Changes**:

```yaml
- name: Test lightfast
  env:
    SKIP_ENV_VALIDATION: "true"
- run: pnpm --filter lightfast test
+ run: pnpm turbo test --filter=lightfast --summarize
```

**File**: `.github/workflows/release.yml`
**Changes** (two edits — add the env vars AND switch to turbo):

```yaml
jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    timeout-minutes: 10
+   env:
+     TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
+     TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    permissions:
      ...

# And in the steps:
- name: Run tests
  env:
    SKIP_ENV_VALIDATION: "true"
- run: pnpm --filter lightfast test
+ run: pnpm turbo test --filter=lightfast --summarize
```

#### 3. Add `apps/desktop/turbo.json` with `typecheck` and `package` tasks

**File**: `apps/desktop/turbo.json` (new)

```json
{
  "extends": ["//"],
  "tasks": {
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "scripts/**",
        "tsconfig.json",
        "tsconfig.node.json",
        "vite.main.config.ts",
        "vite.preload.config.ts",
        "vite.renderer.config.ts",
        "vitest.config.ts",
        "package.json"
      ],
      "outputs": []
    },
    "package": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "scripts/**",
        "forge.config.ts",
        "vite.main.config.ts",
        "vite.preload.config.ts",
        "vite.renderer.config.ts",
        "tsconfig.json",
        "tsconfig.node.json",
        "package.json"
      ],
      "outputs": [
        "out/**",
        ".vite/**"
      ]
    }
  }
}
```

**Note on `tags`**: the root `turbo.json` has tag-based boundaries (`turbo.json:88-104`). Before adding `"tags": ["app"]` (or any other tag) here, audit the existing boundary rules to confirm desktop fits the tag's contract. Default to no tag — if `pnpm turbo boundaries` accepts the package without a tag, leave it out and revisit only if a boundary lookup needs it.

**File**: `.github/workflows/desktop-ci.yml`
**Changes**:

```yaml
- name: Typecheck
- run: pnpm --filter @lightfast/desktop typecheck
+ run: pnpm turbo typecheck --filter=@lightfast/desktop --summarize

- name: Package (unsigned)
- run: pnpm --filter @lightfast/desktop package
+ run: pnpm turbo package --filter=@lightfast/desktop --summarize

# Append at end of steps:
+ - name: Cache report
+   if: always()
+   uses: ./.github/actions/turbo-summary
+   with:
+     title: 'Turbo cache report — Desktop CI / ${{ matrix.os }}'
+     artifact-name: turbo-cache-desktop-ci-${{ matrix.os }}
```

#### 4. Don't touch desktop-release.yml in this plan

`pnpm exec electron-forge publish` does both make+publish. Caching `make` would require either a `--skip-make` flag or running `package` separately first, then a publish-only step. Both are non-trivial and the side effect of publish (uploading to GitHub Releases) is non-cacheable. Out of scope. The Phase 3 win on desktop-release is just **inheriting the Phase 1 instrumentation if/when desktop-release ever runs Turbo** (today it doesn't — and that's intentional).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm turbo //#check --dry=json | jq '.tasks[].taskId'` shows `//#check` as a task
- [x] `pnpm turbo //#knip --dry=json | jq '.tasks[].taskId'` shows `//#knip` as a task
- [x] `pnpm turbo test --filter=lightfast --dry=json | jq '.tasks[].taskId'` shows `lightfast#test`
- [x] `pnpm turbo typecheck --filter=@lightfast/desktop --dry=json | jq '.tasks[].taskId'` shows `@lightfast/desktop#typecheck`
- [x] `pnpm turbo package --filter=@lightfast/desktop --dry=json | jq '.tasks[].taskId'` shows `@lightfast/desktop#package`
- [x] `pnpm turbo //#check --dry=json | jq '.tasks[].dependencies'` returns an empty array (verifies no `^build` regression)
- [x] After running `pnpm turbo package --filter=@lightfast/desktop` once, `apps/desktop/out/**` and `apps/desktop/.vite/**` exist
- [x] Re-running `pnpm turbo //#check --summarize` on unchanged inputs reports `cache.status: "HIT"`, `cache.source: "LOCAL"` (uppercase — Turbo 2.9.6 schema). _Note: this is contingent on biome passing; `//#knip` will report MISS as long as knip exits non-zero, since Turbo only caches exit-0 runs._
- [x] Re-running `pnpm turbo test --filter=lightfast --summarize` on the same commit reports `cache.status: "HIT"` (test exits 0)
- [x] Re-running `pnpm turbo package --filter=@lightfast/desktop --summarize` on the same commit reports `cache.status: "HIT"`
- [x] `pnpm turbo boundaries` still passes after `apps/desktop/turbo.json` is added (verifies the no-tag decision)
- [ ] PR push to the worktree branch triggers `CI`, `Core CI`, `Desktop CI` and all three show new task entries in their cache summaries _(deferred — verified after push)_

#### Human Review:

- [ ] In the workflow summary for `Desktop CI` on a re-run, the `@lightfast/desktop#package` task shows `HIT` `remote` → confirms Vercel Remote Cache picks up the new outputs
- [ ] On a re-run of `Release lightfast` (manual dispatch), `lightfast#test` and `lightfast#build` both report `HIT` `remote` → confirms the env-var fix took effect

---

## Phase 4: Final verification pass

### Overview

After everything's deployed, do a single end-to-end check across all instrumented workflows on a no-op PR to confirm the system works as a whole.

### Changes Required:

None — this phase is observation-only.

### Success Criteria:

#### Automated Verification:

- [ ] Open a no-op PR (e.g. README typo) → all four instrumented workflows (`CI`, `Core CI` × 2 jobs, `Desktop CI` × 2 jobs) show a `Turbo cache report` summary section
- [ ] Cumulative hit rate across all reports on a *re-run* of the same PR (same commit) ≥ 95% remote
- [ ] `gh run download <run-id> -n turbo-cache-ci-quality` retrieves the `.turbo/runs/*.json` artifact

#### Human Review:

- [ ] On the Vercel Remote Cache dashboard (`vercel.com/<team>/settings/turborepo-remote-cache`) the per-day cache traffic chart shows the new uploads (post-rollout) — confirms the wrapped tasks are actually populating the remote
- [ ] Wall-time of `Desktop CI` on the second run of a no-op PR is at least 60 seconds faster than the first run — confirms the cache is buying time, not just metadata

---

## Testing Strategy

### Local development

Before pushing, contributors can validate with:

```bash
# Clean slate
rm -rf .turbo/runs
# Run any wrapped task with summarize
pnpm turbo typecheck --filter=lightfast --summarize
# View the report
node scripts/turbo-cache-report.mjs .turbo/runs "Local check"
```

### Integration validation

The Phase 4 verification PR is the integration test. It exercises:
- The reporter script
- The composite action
- All five wraps from Phase 3
- Cross-workflow consistency

### Regression detection (passive)

Once landed, future PRs always see the cache report. A drop in hit rate is visible in the summary; nobody has to remember to check it.

## Performance Considerations

- **Adding `--summarize`** writes one JSON file per Turbo invocation (~10-100KB). Negligible cost.
- **The composite action** runs in <2 seconds on artifact upload + summary write.
- **Wrapping bypassed tasks** is *net positive* because the wrapped invocation either hits cache (free) or runs the same work it ran before (no slower).
- **The `release.yml` env-var fix** is the single biggest expected win: every release-build today is a cache miss, and the build is already known to be cacheable (it shares hashes with `Core CI / Build`). Post-fix, releases should hit the cache populated by the most recent main-branch CI.

## Migration Notes

- **Existing developer scripts unchanged**: `pnpm check`, `pnpm knip`, `pnpm --filter ... test` keep working locally. The CI swap to `pnpm turbo ...` doesn't force every developer to switch their muscle memory.
- **Turbo cache TTL**: Vercel Remote Cache retains entries for 30 days by default. If a task hasn't been invoked in 30 days, the next run will be a miss — that's intentional.
- **Rollback**: each phase is independent. If Phase 3's wraps cause an unexpected miss-storm, revert that workflow's diff (single file per change) and the system reverts to bypass mode while keeping the Phase 1 instrumentation.

## References

- Original research: `thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md` (Workstream B section)
- Turbo `--summarize` docs: https://turborepo.dev/docs/reference/run#--summarize
- Turbo `globalEnv` / `passThroughEnv`: https://turborepo.dev/docs/reference/configuration#globalenv
- Vercel Remote Cache dashboard: https://vercel.com/docs/monorepos/remote-caching
- Existing instrumentation scaffolds:
  - Root `turbo.json` task config: `turbo.json:4-78`
  - Per-app build env: `apps/app/turbo.json:6-62`, `apps/platform/turbo.json`, `apps/www/turbo.json`
  - Existing tag-based boundaries (don't change): `turbo.json:88-104`
- Worktree convention: `.claude/worktrees/feat-desktop-sqlite-persistence/` (existing example)

## Improvement Log

### 2026-05-07 — adversarial review (`/improve_plan`)

**Spike**: ran `pnpm turbo run typecheck --filter=@lightfastai/cli --summarize` in an isolated worktree against this repo's pinned Turbo 2.9.6 to verify the `.turbo/runs/<KSUID>.json` schema the reporter assumes. **Verdict: PARTIAL** — `tasks[].taskId`, `tasks[].cache.status`, `tasks[].execution.{startTime,endTime}` all matched. **`tasks[].cache.source` enum is uppercase** (`"LOCAL"`/`"REMOTE"`), not lowercase as the original script assumed — every report would have mis-classified the source. Each invocation produces a new file (no overwrite), validating the merge-all reporter approach.

**Critical fixes applied**:

1. **Reporter merges every `.turbo/runs/*.json` file**, not just the lex-last. The original `entries.sort().at(-1)` saw only the final invocation in a job — but `ci.yml` runs three turbo commands per quality job, so the cache report would have shown only one. Reporter now sorts files by mtime, iterates all, dedupes on `taskId`, last-write-wins.
2. **`cache.source` lowercased for display only** (after spike result above). Verification criteria updated to expect `"HIT"`/`"LOCAL"` uppercase.
3. **Renamed `//#lint` → `//#check`**. The original plan invented a new `lint` script alongside the existing `check` script. `//#` is Turbo's task-ID syntax (referenced from `turbo.json` and CLI), not a valid `package.json` script name; Turbo invokes a script literally named `check` for task `//#check`. Reusing the existing `check` script means zero `package.json` changes and preserves `pnpm check` muscle memory.
4. **Dropped orphan workspace-level `lint` and `knip` task definitions**. The original plan added both workspace-level (`"lint": {…}`, `"knip": {…}`) and root-only (`"//#lint"`, `"//#knip"`) versions in `turbo.json`. The workspace-level pair was dead config — no package implements either script — and only the `//#` versions were referenced by the workflows.
5. **Removed `dependsOn: ["^build"]` from the `//#check` and `//#knip` tasks**. Today `pnpm check` and `pnpm knip` run with zero build prerequisite. Adding `^build` would have forced a full workspace build into every lint invocation's dependency graph — a meaningful CI regression (especially on cold cache) and a bad local-dev story, all for no correctness benefit.
6. **Widened `//#check` inputs from a narrow `**/*.{ts,tsx,…}` glob to `$TURBO_DEFAULT$`**. Biome lints JSON, JSONC, CSS, GraphQL beyond JS/TS; the narrow glob would have produced false cache HITs after edits to those file types.

**High fixes applied**:

7. **Dropped `apps/desktop/turbo.json` `"tags": ["app"]`** — the root has tag-based boundaries (`turbo.json:88-104`) and the original plan asserted the tag without auditing whether desktop satisfies the contract. Added a note explaining the audit and a `pnpm turbo boundaries` verification step in Phase 3 success criteria.
8. **Removed unenforceable `actionlint` success criteria** — the repo has no actionlint config and no pre-commit hook (verified). Replaced with a check that the merge logic actually merges across multiple invocations.

**Improvements applied**:

9. **Phase 2 time-boxed to one work day** — the phase was open-ended ("depends on what Phase 1 surfaces"); Phase 3's wrapped work is independently load-bearing and shouldn't be blocked indefinitely on a hit-rate hunt.
10. **Reporter file selection switched from lex-sort to mtime** — robust across whatever filename scheme Turbo uses (currently KSUID; subject to change).
11. **Reporter style aligned to `scripts/*.mjs` convention** — dropped the leading 3-line comment header to match the existing pattern (shebang, then imports).
12. **Added a "no `^build` regression" automated verification step** in Phase 3 success criteria (`jq '.tasks[].dependencies'` must be empty for `//#check`).

### 2026-05-07 — second spike (end-to-end `//#check` + `//#knip`)

After the first round of edits, the user pushed back with "can you confirm this actually works?" — fair, since the rename to `//#check` and the dropped `^build` deps were reasoned, not tested. Ran a second spike in an isolated worktree: added `//#check` and `//#knip` to `turbo.json` exactly as Phase 3.1 prescribes, ran the tasks twice, inspected `.turbo/runs/*.json`. **Verdict: CONFIRMED**, with one nuance.

**All five structural assertions held**:
- `pnpm turbo //#check` invokes the existing root `npx ultracite@latest check` script (log: `//:check: > lightfast@ check ... > npx ultracite@latest check`).
- `pnpm turbo //#knip` invokes the existing root `knip` script.
- No workspace `build` task fires — the run summary contains exactly the two root tasks. `--dry=json` shows `dependencies: []` and `resolvedTaskDefinition.dependsOn: []`.
- Summary `taskId` values are exactly `"//#check"` and `"//#knip"` (with `package: "//"`, `task: "check"`/`task: "knip"`).
- Second run of `//#check` reports `cache.status: HIT, cache.source: LOCAL`.

**Nuance discovered (now reflected in Phase 3.1 caveat and success criteria)**: Turbo only caches exit-0 task runs. This repo's `knip` exits non-zero (legitimate unused-export findings), so `//#knip` will report `MISS` on every run regardless of input changes — that's Turbo behavior, not a config issue. `knip` is `continue-on-error: true` in CI for this exact reason, so functionally fine; it just means the cache report will persistently show `//#knip` as MISS until the workspace is knip-clean. Plan and verification criteria updated to qualify the HIT promise to `//#check`, `lightfast#test`, and `@lightfast/desktop#package` (all exit-0 by construction) rather than `//#knip`.

**Spike worktree cleaned up** after extracting evidence (`git worktree remove -f -f`).
