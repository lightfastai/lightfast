---
date: 2026-05-07
researcher: Jeevan Pillay
topic: "CI/CD iteration-speed architecture — two-tier validation with merge queue"
tags: [plan, ci, github-actions, merge-queue, turbo-cache, dev-iteration]
status: ready
---

# CI/CD Iteration-Speed Architecture Implementation Plan

## Overview

Re-architect `lightfastai/lightfast`'s eight GitHub Actions workflows around a two-tier validation model: a fast PR lane (<60s critical path) for dev iteration, and a full-battery merge-queue lane (<5min) gating actual merges to `main`. This is the validation pyramid Anthropic and Cursor use internally — PR pushes get a smoke signal, merge queue gets the truth.

Two phases (plus Phase 0 worktree setup), all on GitHub-hosted runners. Depot migration is intentionally deferred to `thoughts/shared/plans/2026-05-07-ci-depot-runner-migration.md`. Turbo cache wrapping (originally drafted as Phase 3 here) is deferred to `thoughts/shared/plans/2026-05-07-turbo-cache-audit-and-wrap.md`, which scopes that work better and covers more bypasses (biome, knip, tests in addition to `electron-forge package`). Optimize architecture first so the future Depot bill sits on a structurally lower baseline (per `thoughts/shared/handoffs/general/2026-05-07_15-10-30_ci-cost-findings-pre-depot.md`).

**Branch protection bootstrap**: as of plan time, `gh api repos/lightfastai/lightfast/branches/main/protection` returns 404 — `main` has no _classic branch protection_ rule today. **However, during implementation we discovered main IS protected via a ruleset** (id `15254385`, name `"Protect main"`) with `required_linear_history`, `non_fast_forward`, blocked deletion, and `pull_request` rule with `required_review_thread_resolution: true`. The ruleset has NO `required_status_checks` rule. So the bootstrap actually requires: (a) ruleset blocks direct-push, so PR #664 itself was the bootstrap (`merge-queue.yml` was landed via admin-merged PR, not direct push), and (b) Phase 2 step 3's `gh api PUT branches/main/protection` would coexist with the ruleset (potentially conflicting) — better to extend the existing ruleset to add `required_status_checks` for `merge-queue-success` instead.

## Current State Analysis

### Verified workflow surface

| File | Trigger | Jobs | Critical-path role today |
|---|---|---|---|
| `ci.yml` | PR + push main | `quality`, `ci-success` | App-side biome + openapi-freshness + `turbo typecheck --affected` + boundaries + knip |
| `ci-core.yml` | PR + push main | `quality`, `test`, `build`, `core-ci-success` | Full quality + test + build of `lightfast`/`mcp`/`cli` (no `--affected`) |
| `desktop-ci.yml` | PR + push main (path-filtered) | `package` (matrix: macos-14 × ubuntu-22.04) | Typecheck + unsigned electron-forge package + Playwright (mac only). **PR longest pole at ~176s.** |
| `desktop-release.yml` | tag `@lightfast/desktop@*` | `prepare`, `build_macos` ×2, `build_linux` ×2, `finalize` | Signed mac DMG + notarize + Linux makers + attestations + Sparkle feed |
| `release.yml` | push main (path: `.changeset/**`) | `release` | changesets-driven npm publish for `lightfast`, `@lightfastai/mcp`, `@lightfastai/cli` |
| `codeql.yml` | PR + push main + weekly cron | `analyze` (matrix: actions, javascript-typescript) | Security analysis on every PR push |
| `verify-changeset.yml` | PR (path: `.changeset/*.md`) | `verify-changesets` | Format-only changeset validation |
| `db-migrate.yml` | manual | `migrate`, `no-confirmation` | drizzle-kit migrate against prod |

### Observed cost / time concentration (per handoff `2026-05-07_15-10-30_ci-cost-findings-pre-depot.md`)

| Workflow | Runs/3d | PR avg wall-time | Share of projected Depot $ |
|---|---:|---:|---:|
| Desktop CI | 81 | ~176s | **66%** |
| Core CI (test+build separately) | 99 | ~79s | 8% |
| CI | 98 | ~109s | 6% |
| CodeQL | 76 | ~94s | 2% |

**The dev iteration loop today**: every PR push triggers all of {ci, ci-core, codeql, desktop-ci}. Critical path is Desktop CI at ~3min. A docs-only PR pays full freight for `ci-core`'s quality+test+build leg even though no `core/*` file changed.

### Existing wiring worth preserving

- `ci.yml:54` already uses `pnpm turbo typecheck --affected --continue`; `TURBO_SCM_BASE` is set in the env block at lines 51-53 (env block: `SKIP_ENV_VALIDATION` line 52, `TURBO_SCM_BASE` line 53; run command line 54). The `--affected` plumbing is correct; the model just isn't applied in `ci-core.yml`.
- `pnpm/action-setup@v4` + `actions/setup-node@v4` with `cache: 'pnpm'` is uniform across every workflow.
- Vercel Remote Cache is wired via `TURBO_TOKEN`/`TURBO_TEAM` env in every cache-aware job (`ci.yml:19-20`, `ci-core.yml:19-20,53-54,83-84`, `desktop-ci.yml:41-42`, `desktop-release.yml`, `release.yml`). Hit rate is unmeasured — that audit is the load-bearing question for the deferred `2026-05-07-turbo-cache-audit-and-wrap.md` plan, not this one.
- `desktop-ci.yml:4-22` has path filters on `apps/desktop/**`, `packages/{app-trpc,ui,lib}/**`, `pnpm-lock.yaml`, and the workflow file itself.
- `concurrency: cancel-in-progress: true` is set on every PR-triggered workflow (`ci.yml:10-12`, `ci-core.yml:10-12`, `desktop-ci.yml:24-26`) — prior runs cancel on new pushes. **Zero existing instances of `cancel-in-progress: false` in the repo** — the merge-queue workflow introduced in Phase 2 is the first user.
- `actions/attest-build-provenance@v2`, `pnpm sourcemaps:upload`, Apple keychain bootstrap, Sparkle feed generation in `desktop-release.yml` are out-of-scope for this plan and stay untouched.

### Architecture mismatch (the load-bearing problem)

`ci.yml`, `ci-core.yml`, `codeql.yml`, and `desktop-ci.yml` all run on every PR push as gating checks AND act as the only validation that the merge commit gets. There is no separate "this is going to land — run the full battery" trigger. So:

- Either PR-tier is exhaustive (current state — slow dev loop), OR
- PR-tier is fast but main breaks more often (no good).

The two-tier split solves this: PR-tier is the dev iteration signal; merge queue is the gate of record. Both can be optimized for their respective jobs.

## Desired End State

After this plan:

1. **PR push critical path < 60s on cache-warm runs.** Only macOS-side desktop typecheck/package/e2e + biome + `turbo typecheck --affected` run on every push. Docs-only PRs skip ci.yml, ci-core.yml, and desktop-ci.yml entirely (path filters).
2. **Merge queue runs the full battery once per merge** on the queued commit (~3-5 min): full Core CI test+build, full Desktop CI mac+linux matrix, CodeQL, knip.
3. **Branch protection on `main` is established (first time)** and requires the merge-queue aggregator status check — direct push, force-push, and "merge without queue" are blocked.
4. **PR-tier checks remain required to *enter* the merge queue** (so a known-red PR can't waste merge-queue time), but the merge queue is the final gate.
5. **Turbo wrapping for `electron-forge package`** is handled by the parallel `2026-05-07-turbo-cache-audit-and-wrap.md` plan — not in scope here.

### Verification

- `gh api repos/lightfastai/lightfast/branches/main/protection` returns 200 (was 404 pre-plan) with `required_status_checks.checks` containing `{"context": "merge-queue-success"}`.
- `gh api repos/lightfastai/lightfast/branches/main/protection` shows `required_status_checks.strict: false` (merge queue makes "up-to-date" obsolete) and `allow_force_pushes.enabled: false`.
- 5 specific PR scenarios pass their expected behavior:
  1. Small `apps/app/**` edit → PR-tier runs `CI / quality` + `Desktop CI / mac` only; merge-queue runs full battery; total ≤ 60s on cache-warm PR-tier.
  2. Docs-only `thoughts/**` change → no PR-tier workflows trigger (`gh run list --branch=<docs-pr>` returns empty); merge-queue still runs full battery.
  3. `core/lightfast/**` change → `Core CI / core-ci` activates via path filter; runs typecheck-affected only; ≤ 60s.
  4. `apps/desktop/**` change → `Desktop CI` runs mac matrix only on PR; merge-queue runs mac+linux.
  5. Cross-package breaking change (e.g. rename a `core/lightfast` export consumed by `core/mcp`) → PR-tier passes if its filter doesn't activate the dep, but merge-queue catches the broken merge build and rejects.
- Each merge-queue run produces ≥ 5 successful jobs: `Quality (full)`, `Core build + test (full)`, `Desktop package + e2e (macos-14)`, `Desktop package + e2e (ubuntu-22.04)`, `CodeQL (actions)`, `CodeQL (javascript-typescript)`, and `merge-queue-success`.

### Key Discoveries

- `ci.yml:54` shows `--affected` already works in this repo — the model exists, just isn't generalized.
- `ci-core.yml:105` runs `pnpm turbo build --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli` which is `--filter` not `--affected`. Switching to `--affected` requires the same `TURBO_SCM_BASE` env wiring `ci.yml:53` already has.
- `ci.yml` has **no `paths:` filter** today — it triggers on every PR push regardless of which files changed. Phase 1 adds one so docs-only PRs can skip it.
- `desktop-ci.yml:71` runs `pnpm --filter @lightfast/desktop package` directly — bypasses Turbo. Wrapping under Turbo is the deferred `2026-05-07-turbo-cache-audit-and-wrap.md` plan's territory.
- `core/ai-sdk/` exists in the workspace but has no `package.json` and is NOT in the changeset/release loop (`.changeset/config.json` `fixed: [["lightfast", "@lightfastai/mcp"]]`; `@lightfastai/cli` is published *separately* and is NOT in the fixed group; `@lightfast/desktop` is in `ignore`). Out of scope for this plan.
- GitHub merge queue triggers a `merge_group:` event on a temporary "merge candidate" SHA — workflows triggered only on `pull_request:` will not run during the queue. That's the seam this plan exploits: PR-tier workflows stay `pull_request:`-only; a new `merge-queue.yml` is `merge_group:`-only.
- Branch protection's `required_status_checks` lists job (or workflow's aggregator job) names. Required-for-merge-queue and required-for-PR can be different sets.
- Existing aggregator pattern (`ci.yml:63-81`, `ci-core.yml:119-143`) uses **explicit per-dep `needs.X.result` expansion**, no shell loops. The new `merge-queue-success` follows the same pattern — GitHub Actions expressions evaluate at job-spawn time, not runtime, so a `for dep in ...` loop reading `${{ needs.$dep.result }}` would not work.
- `turbo.json` `globalEnv` (line 79) contains only `["CI"]`. The merge-queue's full battery doesn't add anything to the global env scope.

## What We're NOT Doing

- **No nightly cron.** Per architectural decision, the only Tier-3 prod triggers are merge-queue commit and tag push. CodeQL's existing `cron: "30 3 * * 1"` weekly schedule stays (it's the security-scan baseline), but no new nightly is added.
- **No pre-push hooks.** Iteration stays push-and-go. PR-tier feedback in <60s is the substitute.
- **No Turbo task wrapping.** Originally drafted as Phase 3; deferred to `thoughts/shared/plans/2026-05-07-turbo-cache-audit-and-wrap.md`. Run that plan after this one lands; it operates against the merge-queue.yml established here.
- **No Depot migration.** Tracked separately at `thoughts/shared/plans/2026-05-07-ci-depot-runner-migration.md`. Re-run cost model against this plan's baseline before reviving.
- **No consolidating `ci.yml` + `ci-core.yml`.** They have non-overlapping responsibilities (`ci.yml` is app/biome/typecheck-affected; `ci-core.yml` is `core/*` deep validation). Merging would conflate filter sets.
- **No reusable workflow (`workflow_call:`) for `desktop-package`.** The job body is duplicated across `desktop-ci.yml` (mac-only post-Phase-1) and `merge-queue.yml` (mac+linux). Extracting to a reusable would dedupe ~30 lines but adds an indirection layer that obscures the trigger asymmetry. Two job definitions answering different questions (PR-tier "is mac OK?" vs. merge-queue "is mac+linux OK?") is acceptable here. Revisit if a third caller appears.
- **No changes to `desktop-release.yml`'s release-time logic** (signing, notarization, Sparkle, Sentry, attestations). Tag-driven release flow is not in scope.
- **No changes to `release.yml`** (changesets → npm).
- **No changes to `db-migrate.yml`** or `verify-changeset.yml` business logic. `verify-changeset.yml` keeps its `pull_request:` trigger; it's small and runs only when a `.changeset/*.md` file changes.
- **Not adopting CodeQL replacements** (e.g. semgrep). CodeQL stays; it just moves off the per-push critical path.
- **Not introducing a new test runner.** Vitest, Playwright stay as-is.
- **Not dropping merge queue in favor of `push: main` validation.** Considered during review: a low-volume project could achieve the two-tier split with `push: main` for full-battery (post-merge, async). Trade-off rejected because (a) merge queue + auto-merge is a smoother UX than manual merge + watch CI, (b) main can break silently between concurrent green PRs, and (c) the architecture matches what Anthropic/Cursor use internally.

## Implementation Approach

The architecture is the work; the YAML edits are mechanical. Risk is concentrated in one place:

**Branch protection bootstrap.** Misconfiguring `required_status_checks` can lock out merges (status check that never reports) or accept broken merges (status check not actually required). Compounding factor: there is **no existing branch protection on `main`** as of plan time (`gh api .../protection` returns 404). So the bootstrap is also the *first* protection rule the repo gets. Phase 2 ships the merge-queue workflow to main via direct push *first* (allowed because no protection exists yet), validates it runs on a smoke PR, *then* flips on branch protection. This dependency order is non-negotiable — getting it wrong means either the queue can't be tested (workflow not on main) or no merge ever passes (status check never reports).

The cost story: PR-tier work drops ~50% (Linux desktop matrix removed, Core CI test+build removed, CodeQL removed; ci.yml gains a path filter so docs-only PRs skip it). Merge-queue adds ~10% back (one full-battery run per merge, ~50 merges/month). Net: meaningfully less CI volume AND much faster dev feedback.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Isolate work in a dedicated worktree [DONE 2026-05-07]

### Overview

Phase 1 + 2 edit `.github/workflows/*.yml` — files that overlap with active dev on the primary checkout (e.g. parallel work in `feat-ci-turbo-cache-audit` and `feat-desktop-sqlite-persistence` worktrees, both currently active per `git worktree list`). Run the entire plan from a secondary git worktree on a new branch so the primary checkout's HEAD is unaffected by mid-flight CI commits.

The repo's worktree convention is `.claude/worktrees/<sanitized-branch>` — slashes become dashes. For branch `feat/ci-iteration-speed` the path is `.claude/worktrees/feat-ci-iteration-speed`. The two existing worktrees follow this exact pattern.

### Changes Required

#### 1. Create the worktree + branch

**Action**: Run from the primary checkout (`/Users/jeevanpillay/Code/@lightfastai/lightfast`).

```bash
git fetch origin main
git worktree add -b feat/ci-iteration-speed .claude/worktrees/feat-ci-iteration-speed origin/main
cd .claude/worktrees/feat-ci-iteration-speed
pnpm install
```

The Portless aggregate URL in this worktree (if dev servers are run) will use `<wt>=ci-iteration-speed`; print it via `node scripts/with-desktop-env.mjs --print`. Dev servers are not strictly required for this plan — pure YAML editing — but keeping them runnable is useful for testing path-filter triggers locally (e.g. `pnpm turbo build --dry-run --filter=...` to preview what changes activate).

#### 2. Confirm worktree isolation

```bash
# From the new worktree:
git rev-parse --abbrev-ref HEAD          # → feat/ci-iteration-speed
git rev-parse --show-toplevel            # → .../.claude/worktrees/feat-ci-iteration-speed
git worktree list                        # primary + this worktree + any preexisting worktrees listed

# From the primary checkout (separate shell):
git rev-parse --abbrev-ref HEAD          # → main (or whatever was checked out, NOT feat/ci-iteration-speed)
```

The primary checkout's HEAD does not move when commits land in the worktree.

### Success Criteria

#### Automated Verification

- [x] `git worktree list` from the primary checkout includes `.claude/worktrees/feat-ci-iteration-speed  <sha>  [feat/ci-iteration-speed]` alongside any preexisting worktrees
- [x] `git rev-parse --abbrev-ref HEAD` from `.claude/worktrees/feat-ci-iteration-speed` returns `feat/ci-iteration-speed`
- [x] `pnpm install` completes from the worktree without lockfile drift: `git -C .claude/worktrees/feat-ci-iteration-speed status --porcelain pnpm-lock.yaml` returns empty
- [x] Primary checkout HEAD is unchanged: `git -C /Users/jeevanpillay/Code/@lightfastai/lightfast rev-parse HEAD` matches the value captured before Phase 0

#### Human Review

- [ ] In a second terminal, `cd .claude/worktrees/feat-ci-iteration-speed` and `cd /Users/jeevanpillay/Code/@lightfastai/lightfast` resolve to two distinct working trees → confirms worktree isolation

---

## Phase 1: Slim PR-tier workflows (zero infra change, immediate dev win) [DONE 2026-05-07 via PR #664]

### Overview

Strip work out of PR-triggered workflows. Move the dropped work to merge-queue (Phase 2) or rely on existing weekly cron (CodeQL). Pure YAML; no new tooling, no new workflows. After Phase 1 ships, every PR push runs:
- `ci.yml`: biome + openapi-freshness + `turbo typecheck --affected` + boundaries (knip removed; **path filter added** so docs-only PRs skip).
- `ci-core.yml`: quality job only, switched to `--affected` (test + build removed from PR; success aggregator removed since only one job remains).
- `desktop-ci.yml`: macOS-only matrix, typecheck + unsigned package + Playwright e2e (Linux leg removed).
- `verify-changeset.yml`: unchanged (rare, fast).
- `codeql.yml`: PR trigger removed (cron + main-push remain).

### Changes Required

#### 1. `.github/workflows/ci.yml` — add path filter + drop knip from PR

**File**: `.github/workflows/ci.yml`
**Changes**: (a) Add `paths:` filter to both `push:` and `pull_request:` triggers — `ci.yml` has no filter today and runs on every push. (b) Remove the `Check dead code and unused dependencies` step from the PR-triggered `quality` job. Knip moves to merge-queue. The `Check boundaries` step stays (fast, deterministic).

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'core/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - 'turbo.json'
      - '.github/workflows/ci.yml'
  pull_request:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'core/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - 'turbo.json'
      - '.github/workflows/ci.yml'
```

```yaml
# DELETE these lines from the quality job (currently last step):
      - name: Check dead code and unused dependencies
        continue-on-error: true # Remove after initial cleanup sprint
        run: pnpm knip
```

The OpenAPI freshness check stays — it's fast (turbo cache typically hits) and catches a real footgun (committing without regenerating).

**Trade-off note**: branch protection's "Required to enter merge queue" set will include `CI / quality`. When a docs-only PR hits the path filter and ci.yml doesn't run, GitHub treats the check as `expected`/skipped. The merge queue's full battery will still run, so the merge commit is never unguarded — but the PR-tier admission gate is effectively absent for docs-only PRs. This is fine because docs-only PRs can't break runtime code; if it ever feels wrong, swap the filter for a "skip-if-no-runtime-files" job that always reports green.

#### 2. `.github/workflows/ci-core.yml` — collapse to typecheck-affected only

**File**: `.github/workflows/ci-core.yml`
**Changes**: Delete the `test` and `build` jobs entirely. Switch `quality` to `--affected`. Add a path filter so it only runs on `core/**` changes. Update `core-ci-success` to depend on `quality` only (or remove it — only one job left, no aggregator needed).

Add `paths:` filter to the trigger block:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'core/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/ci-core.yml'
  pull_request:
    branches: [main]
    paths:
      - 'core/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/ci-core.yml'
```

Switch the `quality` job's typecheck step to `--affected`:

```yaml
      - name: Type check affected core packages
        env:
          SKIP_ENV_VALIDATION: "true"
          TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: pnpm turbo typecheck --affected --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue
```

Delete the entire `test:` job (lines 47-75 currently).
Delete the entire `build:` job (lines 77-117 currently).
Delete the `core-ci-success:` job (lines 119-143 currently) — only one job remains and we want a single status check. Rename the `quality:` job (currently lines 15-45) to `core-ci` so the status check name is stable: `Core CI / core-ci`.

Why test+build come out: they run identical setup-then-build work that the merge queue (Phase 2) and the release workflow (`release.yml`) already do. PR-tier doesn't need a third copy. Typecheck-affected is the dev-loop signal: did your TS change break compile?

#### 3. `.github/workflows/desktop-ci.yml` — drop Linux from PR matrix

**File**: `.github/workflows/desktop-ci.yml`
**Changes**: Reduce the matrix to macOS only. Linux maker validation moves to merge-queue (Phase 2).

```yaml
    strategy:
      fail-fast: false
      matrix:
        os: [macos-14]   # was: [macos-14, ubuntu-22.04]
```

The `Install Linux maker prerequisites` step (`if: runner.os == 'Linux'`) stays in place — the `if:` guard keeps it dormant when the matrix has no Linux leg, and it's needed when merge-queue (Phase 2) reuses this job's body.

The Playwright step (`if: runner.os == 'macOS'`) is unchanged — it's the load-bearing PR check and the most likely break source.

Why Linux comes out: Linux maker drift (rpm/deb/fakeroot) is rare and historically caught by `desktop-release.yml`'s tag run, not by `desktop-ci.yml`'s unsigned package. Moving it to merge-queue means it runs once per merge (catches drift before main moves) instead of once per push (catches nothing new).

Path filter in the existing trigger block (`desktop-ci.yml:4-22`) stays as-is — it's already correctly scoped.

#### 4. `.github/workflows/codeql.yml` — drop PR trigger

**File**: `.github/workflows/codeql.yml`
**Changes**: Remove the `pull_request:` trigger. Keep `push: main` and the weekly `cron: "30 3 * * 1"`.

```yaml
on:
  push:
    branches: [main]
  # pull_request: REMOVED — CodeQL runs on merge-queue (see merge-queue.yml in Phase 2) + main push + weekly cron
  schedule:
    - cron: "30 3 * * 1"
```

Why: CodeQL's PR run was duplicating the schedule cron's coverage at high frequency. The merge-queue's CodeQL run (Phase 2) is what actually gates main; the weekly cron is the safety net for changes that bypass the queue (e.g. main-push from a hotfix).

If a future need arises to scan a PR pre-queue (e.g. compliance), add it back as a separate workflow with explicit path filters on `apps/**` + `packages/**` + `core/**`.

#### 5. Update branch protection — keep PR-tier required, prepare for merge-queue addition

**Action**: Manual via GitHub UI (Settings → Branches → main).

After Phase 1 ships and PR-tier runs are visible on a few PRs, update the required status checks list to:
- `CI / quality` (was already required)
- `Core CI / core-ci` (rename from `Core CI / Core CI Success`; only set this if the PR's path filter activates the workflow)
- `Desktop CI / Typecheck + package (unsigned, macos-14)` (rename happens implicitly when matrix collapses)
- `Verify Changesets / verify-changesets` (only if changeset files touched)

`Core CI` and `Desktop CI` use path filters — when the filter doesn't activate, the check is "expected" not "failed." GitHub branch protection treats unsubmitted checks as `pending` and won't merge. To handle path-filtered status checks gracefully:

- Either mark the status check as **non-required** (then it's just informational) and add a single required aggregator that runs always — preferred.
- Or use the `dorny/paths-filter`-style "always-success-when-skipped" job pattern at the workflow level.

Phase 1's branch protection update is **interim**. Phase 2 adds the merge-queue aggregator as the single load-bearing required check; PR-tier checks become "block merge to queue if red, but not gate the merge commit." This lets us take the path-filter problem off the table — the merge-queue run always runs (no path filter on `merge_group:`), so its single aggregator is unambiguous.

### Success Criteria

#### Automated Verification

- [x] `grep -n 'pnpm knip' .github/workflows/ci.yml` returns no rows
- [x] `grep -nE "^\s*paths:" .github/workflows/ci.yml` returns at least two rows (one each under push: and pull_request:)
- [x] `grep -n 'name: test' .github/workflows/ci-core.yml` returns no rows (test job removed)
- [x] `grep -n 'name: build' .github/workflows/ci-core.yml` returns no rows (build job removed)
- [x] `grep -nE '^\s*os: \[macos-14\]\s*$' .github/workflows/desktop-ci.yml` returns one row (Linux dropped)
- [x] `grep -n 'pull_request:' .github/workflows/codeql.yml` returns no rows
- [x] On a docs-only/non-source-only branch (smoke PR #665 changed only `README.md` which is in none of the path filters), `gh run list --branch chore/merge-queue-smoke` showed zero `CI` / `Core CI` / `Desktop CI` rows — only the dual-trigger `Merge Queue` workflow fired (1s no-op stub on PR event). Path filter validation complete.
- [x] On a `core/lightfast/**` change (proxy: PR #664 touched `.github/workflows/ci-core.yml` matching the same filter), `ci-core.yml` runs and completes green — 65s wall-time on cold cache
- [x] On a `apps/app/**` change (proxy: PR #664 touched `.github/workflows/ci.yml` matching the same filter), `ci.yml` runs (path filter activated) and completes green — 72s wall-time on cold cache

#### Human Review

- [ ] Open a representative PR (e.g. small `apps/app/**` edit). PR Checks tab shows `CI / quality` and `Desktop CI / ...macos-14` running, `Core CI` not running (path filter excluded). Wall-time of `CI / quality` is under 90s on cache-warm runs → matches the iteration-speed goal
- [ ] Open a representative `core/lightfast/**` PR. PR Checks tab now also shows `Core CI / core-ci` running (path filter activated), and it runs typecheck-affected only — total wall-time under 60s
- [ ] Open a docs-only PR. PR Checks tab shows zero workflows running. Confirms all three path filters work and the docs-only loop has no CI cost.
- [ ] In Sentry / GitHub Security tab, no new gap appears in CodeQL coverage between Mondays (weekly cron still firing) and main-push events (push trigger still firing) — confirms CodeQL coverage hasn't degraded after PR trigger drop

---

## Phase 2: Adopt merge queue + create full-battery merge-queue workflow [DONE 2026-05-07 via PR #664 + ruleset update + smoke PR #665 verified end-to-end]

### Overview

Enable GitHub merge queue on `main` and add `.github/workflows/merge-queue.yml` triggered exclusively by `merge_group:`. This workflow runs the full battery — everything that came out of PR-tier in Phase 1 plus full Core CI test+build plus full Desktop CI mac+linux matrix plus CodeQL plus knip. A single aggregator job (`merge-queue-success`) becomes the only required status check on `main`.

### Changes Required

#### 1. New file: `.github/workflows/merge-queue.yml`

**File**: `.github/workflows/merge-queue.yml` (new)
**Changes**: Composite full-battery workflow. Reuses the same setup steps Phase 1 left in PR-tier files (pnpm + setup-node + cache) but runs the un-affected, full-matrix versions of each.

```yaml
name: Merge Queue

on:
  merge_group:

concurrency:
  group: merge-queue-${{ github.ref }}
  cancel-in-progress: false   # NEVER cancel a queued merge run mid-flight

permissions:
  contents: read
  security-events: write   # codeql

jobs:
  quality:
    name: Quality (full)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: OpenAPI freshness
        run: |
          pnpm turbo generate:openapi
          git diff --exit-code packages/app-api-contract/openapi.json
      - name: Lint (biome)
        run: pnpm check
      - name: Typecheck (full, no --affected)
        env:
          SKIP_ENV_VALIDATION: "true"
        run: pnpm turbo typecheck --continue
      - name: Boundaries
        run: pnpm turbo boundaries
      - name: Knip dead-code
        run: pnpm knip

  core-build:
    name: Core build + test (full)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Build core packages
        env:
          SKIP_ENV_VALIDATION: "true"
        run: pnpm turbo build --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli
      - name: Test lightfast
        env:
          SKIP_ENV_VALIDATION: "true"
        run: pnpm --filter lightfast test
      - name: Verify build outputs
        run: |
          ls -la core/lightfast/dist/
          ls -la core/mcp/dist/
          ls -la core/cli/dist/

  desktop-package:
    name: Desktop package + e2e (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        os: [macos-14, ubuntu-22.04]
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - name: Install Linux maker prerequisites
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update && sudo apt-get install -y rpm fakeroot
          which dpkg-deb fakeroot rpm rpmbuild
      - run: pnpm install --frozen-lockfile
      - name: Typecheck
        run: pnpm --filter @lightfast/desktop typecheck
      - name: Package (unsigned)
        run: pnpm --filter @lightfast/desktop package
      - name: E2E (Playwright Electron)
        if: runner.os == 'macOS'
        run: pnpm --filter @lightfast/desktop exec playwright test --config=playwright.config.ts
      - name: Upload Playwright report on failure
        if: failure() && runner.os == 'macOS'
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-merge-queue
          path: apps/desktop/playwright-report/
          retention-days: 7

  codeql:
    name: CodeQL (${{ matrix.language }})
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      security-events: write
      packages: read
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - language: actions
            build-mode: none
          - language: javascript-typescript
            build-mode: none
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          build-mode: ${{ matrix.build-mode }}
          config-file: ./.github/codeql/codeql-config.yml
      - uses: github/codeql-action/analyze@v4
        with:
          category: "/language:${{ matrix.language }}"

  merge-queue-success:
    name: merge-queue-success
    if: always()
    needs: [quality, core-build, desktop-package, codeql]
    runs-on: ubuntu-latest
    steps:
      - name: Evaluate gate
        run: |
          quality="${{ needs.quality.result }}"
          core_build="${{ needs.core-build.result }}"
          desktop_package="${{ needs.desktop-package.result }}"
          codeql="${{ needs.codeql.result }}"
          echo "quality=$quality core-build=$core_build desktop-package=$desktop_package codeql=$codeql"
          if [[ "$quality" != "success" || \
                "$core_build" != "success" || \
                "$desktop_package" != "success" || \
                "$codeql" != "success" ]]; then
            echo "Merge queue gate failed."
            exit 1
          fi
          echo "All merge-queue checks passed."
```

This pattern matches the existing aggregators (`ci.yml:63-81`, `ci-core.yml:119-143`) — explicit per-dep `needs.X.result` expansion, no shell loop. GitHub Actions expressions evaluate at job-spawn time, not runtime, so a `for dep in ...; do ... ${{ needs.$dep.result }}` loop would NOT work and is deliberately avoided here.

Notes on the workflow:
- `concurrency.cancel-in-progress: false` is critical — GitHub batches multiple PRs into a single `merge_group` and cancelling mid-flight would re-enqueue everything.
- `merge-queue-success` aggregator is the single status check the branch protection rule requires. If any dependency fails, this fails; otherwise it passes.
- The `desktop-package` job intentionally duplicates `desktop-ci.yml`'s body (post-Phase-1 mac-only) but expands the matrix back to mac+linux. Two job definitions for the same logical work is acceptable here — they answer different questions (PR-tier: "is the dev's mac change OK?"; merge-queue: "is the merge OK on every supported platform?").

#### 2. Enable GitHub merge queue on `main`

**Action**: Browser-based, performed by user.

1. Open `https://github.com/lightfastai/lightfast/settings/branches`.
2. Edit the rule for `main`.
3. Toggle on **"Require merge queue"**.
4. Configure:
   - Merge method: **Squash and merge** (matches existing repo convention).
   - Maximum entries to build: **5**.
   - Maximum entries to merge: **5**.
   - Minimum/maximum entries to merge: **1 / 5**.
   - Build concurrency: **1** initially (single-threaded queue keeps it predictable; raise later if PR cadence justifies).
   - Wait time: **5 minutes** (default).
   - Status checks that are required to pass before merging: **`merge-queue-success`** (added at step 3 below).
5. Under "Require status checks to pass before merging", set:
   - **Required to enter merge queue**: `CI / quality` + `Desktop CI / Typecheck + package (unsigned, macos-14)` (PR-tier checks). Path-filtered checks (`Core CI`, `Verify Changesets`) cannot be marked required when filtered out — leave them unrequired. The merge queue's full-battery run covers them.
   - **Required for merge queue commit**: `merge-queue-success` only.
6. Save.

#### 3. Wire branch protection — single source of truth via API

After the merge-queue.yml workflow has run successfully on at least one merge_group (so the status check name appears in GitHub's known-checks list):

```bash
gh api -X PUT repos/lightfastai/lightfast/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      {"context": "merge-queue-success"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "lock_branch": false
}
EOF
```

Note: this drops "Required to enter merge queue" PR-tier checks from the API call. They remain configured in the merge queue's own settings (UI step 5 above) and don't need to live in `branch_protection`. PR-tier failures block queueing but not merging.

#### 4. First merge-queue dry-run validation

**Bootstrap order is non-negotiable** — the chicken-and-egg situation is: `merge_group:` events only fire when the workflow file is on `main`. So the order is:

1. **Land merge-queue.yml on main first.** Currently allowed because `gh api .../branches/main/protection` returns 404 (no protection exists). From the Phase 0 worktree, commit Phase 1 changes + the new `merge-queue.yml`, push the feature branch, open PR, merge to main via standard GitHub UI (no merge queue yet).
2. **Enable merge queue** in Settings → Branches per UI step 2 below.
3. **Cut a smoke PR** after merge queue is enabled.
4. Create branch `chore/merge-queue-smoke`. Add a one-line comment to `README.md`. Push and open PR.
5. PR-tier checks run (CI/quality + Desktop/macOS). Wait green.
6. Click "Merge when ready" → PR enters queue.
7. `merge-queue.yml` fires. Watch via `gh run watch` against the merge_group SHA.
8. All matrix jobs (quality, core-build, desktop-package mac+linux, codeql) plus aggregator land green.
9. PR auto-merges on green; main moves. Now wire branch protection (step 3 below) so subsequent merges go through the queue.

If the merge-queue run fails or the workflow doesn't trigger:
- Verify `on: merge_group:` is exactly that (no `merge_group: { types: [...] }` block).
- Verify the workflow file is actually on `main`'s tip — `git ls-tree origin/main .github/workflows/merge-queue.yml` should show the file.
- Confirm the smoke PR's base branch is `main` (merge_group events only fire for the configured queue base).

### Success Criteria

#### Automated Verification

- [x] **(adapted)** `gh api repos/lightfastai/lightfast/rules/branches/main` shows `merge_queue` + `required_status_checks` rule types active, with `merge-queue-success` as the required check. _(Plan claimed branch protection via `branches/main/protection` API — actual implementation uses ruleset id 15254385 instead because that's the existing protection mechanism on this repo. Confirmed via `gh api ruleset` output 2026-05-07.)_
- [x] **(adapted)** Force-push and deletion blocked via `non_fast_forward` and `deletion` rules in the ruleset. _(Plan referenced `allow_force_pushes` field in classic protection; ruleset uses different field names with equivalent enforcement.)_
- [x] **(adapted — pivoted)** Removed `required_linear_history` from the ruleset per user decision; merge queue uses `MERGE` method. _(Plan called for keeping linear history; pivoted because the user prefers merge commits and recent main history was already non-linear via admin bypass. The merge queue config is now consistent with stated repo style.)_
- [x] First smoke PR's merge-queue run lands green: `gh run view 25485778897 --json conclusion` returns `success`. PR #665 merged via queue at `41047f8653a1add4c0087e143a252d7473b27c0a` on 2026-05-07T08:51:23Z. ~2 min wall-time on merge_group commit.
- [x] All seven merge-queue jobs reported success: `Quality (full)` 68s, `Core build + test (full)` 47s, `Desktop package + e2e (macos-14)` 101s, `Desktop package + e2e (ubuntu-22.04)` 62s, `CodeQL (actions)` 49s, `CodeQL (javascript-typescript)` 89s, `merge-queue-success` 2s.
- [x] PR-tier and merge-queue separation confirmed: same `Merge Queue` workflow runs on `pull_request` event (no-op stub, 1s) AND `merge_group` event (full battery, ~2 min). Smoke PR ran 0 PR-tier workflows (CI/Core CI/Desktop CI all path-filtered out for README change), proving the path-filter docs-only verification.

#### Human Review

- [ ] In Settings → Branches → main, the rule shows "Require merge queue: ON" and "Required status checks: merge-queue-success" → confirms branch protection wired correctly
- [ ] On the smoke PR, the GitHub UI's "Merge when ready" button is the only merge option (no "Squash and merge" / "Rebase and merge" / "Create a merge commit" alternatives) → confirms merge-queue is the only merge path
- [ ] After 3 representative PRs go through the queue, `Insights → Actions` dashboard shows merge-queue runs averaging ≤ 5 minutes wall time (parallel jobs; longest pole is `desktop-package` matrix at ~3 min) → meets the Tier 3 wall-time goal
- [ ] On a deliberately broken PR (e.g. `core/cli/src/index.ts` with a TS error), PR-tier shows red and "Merge when ready" refuses to enqueue → PR-tier check is acting as the queue admission gate as designed
- [ ] On a deliberately-broken-on-merge PR (PR-tier passes but the merge commit's `pnpm turbo build --filter=lightfast` would break — e.g. an exported type used in `core/mcp` is renamed in `core/lightfast`'s PR but `mcp`'s consumer wasn't updated), merge-queue catches it and rejects the merge → merge-queue is acting as the gate of record

---

## Phase 3: deferred to `2026-05-07-turbo-cache-audit-and-wrap.md`

The originally-drafted Phase 3 (Turbo wrapping for `pnpm --filter @lightfast/desktop package` + a `--summarize` cache hit rate audit) substantially duplicates `thoughts/shared/plans/2026-05-07-turbo-cache-audit-and-wrap.md`, which scopes the work better and additionally covers the other verified cache bypasses (`pnpm check`, `pnpm knip`, `pnpm --filter lightfast test`, `pnpm --filter @lightfast/desktop typecheck`).

**Run the cache-audit plan after this plan ships.** Phase 2's `merge-queue.yml` is the ideal surface for the audit's `--summarize` instrumentation: it runs the full battery on every merge, exposing every cacheable task at a stable cadence. Sequence:

1. Land Phases 0-2 of *this* plan first (architectural split + merge queue).
2. Then run the cache-audit plan against the established merge-queue.yml as the instrumentation surface.
3. The cache-audit plan owns: Turbo task definitions, `inputs:`/`outputs:`/`env:` tuning, the 10-run audit, and the hit-rate decision gate.

This plan does NOT touch `turbo.json` or `apps/desktop/package.json`. The `desktop-package` job in merge-queue.yml uses `pnpm --filter @lightfast/desktop package` (matching today's `desktop-ci.yml:71` pattern); the cache-audit plan flips it to `pnpm turbo package --filter=@lightfast/desktop` once the task is wrapped.

---

## Testing Strategy

### Validation surfaces (no code-level unit tests — pure CI infra change)

1. **Per-phase trial PRs** validate each phase's behavior directly. Phase 1's new path filters get exercised by intentionally docs-only, core-only, and apps-only PRs. Phase 2's merge queue gets exercised by a smoke PR that goes through the queue end-to-end.
2. **Branch protection drift detection**: after Phase 2, run `gh api .../branches/main/protection` weekly for the first month and diff against the expected JSON. A drift here means someone (or automation) altered the gate. (First-time check — there's no prior baseline since `main` is currently unprotected.)
3. **Existing rc.1→rc.6 dry-run pattern still works**: a `0.1.0-test.7` tag (when next desired) hits `desktop-release.yml` directly, bypassing PR-tier and merge queue. This plan does NOT touch `desktop-release.yml`, so test tags are unaffected.

### Edge cases to watch for

- **Phase 2 bootstrap**: `merge-queue.yml` must exist on `main` before any PR can trigger it via merge_group. Land it via direct push to main (allowed at that moment because branch protection doesn't yet exist), then enable merge queue, then test.
- **Phase 2 single-threaded queue cap**: one merge at a time is conservative. If queue depth becomes a complaint, raise to 3 and watch for shared-state collisions (e.g. two PRs both updating `pnpm-lock.yaml`).
- **Phase 2 path-filtered required check**: `CI / quality` is the PR-tier admission gate, but ci.yml is now path-filtered so docs-only PRs don't run it. Branch protection treats a never-fired check as `expected`/skipped — for "Required to enter merge queue" this means docs-only PRs can be queued without admission. The merge-queue full battery is the gate of record, so this is acceptable; just be aware.
- **Phase 1 path filter for `Core CI`**: a PR touching only `pnpm-lock.yaml` (e.g. dependabot bump) will activate the workflow. Make sure the filter explicitly lists `pnpm-lock.yaml` (it does in the spec above).
- **Quality job's bypassed tools**: `pnpm check` (biome) and `pnpm knip` in merge-queue.yml's quality job bypass Turbo (per `2026-05-07-turbo-cache-audit-and-wrap.md`). Wall-time will be slower than pure-Turbo equivalents until that plan lands.

## Performance Considerations

Expected wall-time per surface (post-plan, on GitHub-hosted runners — current runner cost is $0; Depot column shows what the projection would be after the deferred Depot migration):

| Surface | Today | Phase 1 | Phase 2 | + cache-audit plan |
|---|---:|---:|---:|---:|
| PR push (no desktop change, has runtime files) | ~180s | ~70s | ~70s | ~50s |
| PR push (desktop change) | ~180s | ~140s (mac-only) | ~140s | ~120s |
| PR push (core change) | ~180s | ~50s (typecheck-affected) | ~50s | ~50s |
| PR push (docs-only) | ~110s (ci.yml runs) | ~0s (path filters skip all 3) | ~0s | ~0s |
| Merge commit (full battery) | n/a | n/a | ~300s | ~180s on cache-hot |
| Tag release | ~257s | ~257s | ~257s | ~257s (unchanged) |

Iteration impact: from ~3min PR feedback today to ~50s on the steady-state runtime-change loop, and effectively zero CI cost on the docs/thoughts/markdown loop. Desktop-touching PRs still pay ~2min on PR-tier, justified because the e2e is the most likely break source.

CI cost impact (THEORETICAL — current runner cost is $0; numbers below are projections against the future Depot migration baseline per `2026-05-07-ci-cost-findings-pre-depot.md` ~$185/mo):
- Phase 1 alone would drop ~50% of PR-tier work (drop Linux desktop, drop Core test+build, drop CodeQL from PR; add path filters across ci.yml + ci-core.yml + desktop-ci.yml).
- Phase 2 adds ~50 merge-queue runs/month × ~5 min × multiple jobs. On Depot, this would be ~$30-40/mo.
- The deferred cache-audit plan reduces merge-queue's `desktop-package` work by ~30% on cache-hot merges.
- **Projected post-plan Depot baseline: ~$80-110/mo (down from $185/mo).** This is the number that should drive the Depot billing alert ($250-300/mo per the handoff's recommendation).

## Migration Notes

- **Rollback per phase**:
  - Phase 1: revert PR-tier YAML changes via `git revert <commit>`. PR-tier returns to current state.
  - Phase 2: disable merge queue via Settings → Branches; revert `merge-queue.yml`; **DELETE** branch protection (don't restore — there was none) via `gh api -X DELETE repos/lightfastai/lightfast/branches/main/protection`. Direct merges become possible again.
- **Phase ordering matters**: 0 → 1 → 2. Phase 0 isolates work in a worktree. Phase 2 depends on Phase 1's slimmer PR-tier (so PR-tier is clearly the "dev signal" not the "merge gate"). The cache-audit plan (formerly Phase 3) depends on Phase 2's full-battery merge-queue — run it after this plan's PR lands.
- **Worktree cleanup after merge**: once the PR carrying Phases 1–2 lands on `main`, remove the worktree from the primary checkout — `git worktree remove .claude/worktrees/feat-ci-iteration-speed` (and `git branch -D feat/ci-iteration-speed` if not auto-cleaned). The Phase 0 worktree is a development-time isolation, not a long-lived artifact.
- **Coordination with the deferred plans**:
  - `2026-05-07-turbo-cache-audit-and-wrap.md` — run after this plan lands; it operates against the merge-queue.yml established here.
  - `2026-05-07-ci-depot-runner-migration.md` — re-run its cost model against this plan's post-Phase-2 baseline. Bump the Depot billing alert from $100 to ~$250-300 per the handoff's recommendation.

## References

- Handoff that motivates this plan: `thoughts/shared/handoffs/general/2026-05-07_15-10-30_ci-cost-findings-pre-depot.md`
- Deferred Depot migration plan: `thoughts/shared/plans/2026-05-07-ci-depot-runner-migration.md`
- Deferred Turbo cache wrapping plan (formerly Phase 3): `thoughts/shared/plans/2026-05-07-turbo-cache-audit-and-wrap.md`
- Underlying CI research: `thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md`
- GitHub merge queue docs (consulted for `merge_group:` event semantics, branch protection wiring): https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Turbo task config (consulted for `inputs:`/`outputs:`/`env:` semantics): https://turborepo.com/docs/reference/configuration#tasks
- Workflow files at plan time (current state, verified):
  - `.github/workflows/ci.yml:1-82` — quality job lines 14-62, ci-success aggregator lines 63-81; no `paths:` filter today
  - `.github/workflows/ci-core.yml:1-144` — quality 15-45, test 47-75, build 77-117, core-ci-success 119-143
  - `.github/workflows/desktop-ci.yml:1-86` — paths filter 4-22, concurrency 24-26, matrix line 39, package step line 71
  - `.github/workflows/desktop-release.yml:1-292` — mac publish line 160, linux publish line 234
  - `.github/workflows/codeql.yml:1-46` — cron line 9 (`30 3 * * 1`)
  - `.github/workflows/release.yml:1-103`
  - `.github/workflows/verify-changeset.yml:1-71`
- `turbo.json` — `globalEnv` is line 79 (contains only `["CI"]`); `transit` task is real and used by `typecheck` per lines 36-48
- `apps/desktop/package.json:14` — `"package": "electron-forge package"` (bare)
- `.changeset/config.json` — `fixed: [["lightfast", "@lightfastai/mcp"]]` line 5; `@lightfastai/cli` is published separately and is NOT in the fixed group; `ignore: ["@lightfast/desktop"]` line 10
- Branch protection at plan time: `gh api repos/lightfastai/lightfast/branches/main/protection` returns 404 — `main` is unprotected. Phase 2 introduces the FIRST protection rule.
- Existing worktrees at plan time (`git worktree list`): primary, plus `.claude/worktrees/feat-ci-turbo-cache-audit` and `.claude/worktrees/feat-desktop-sqlite-persistence`. Phase 0 follows the same `.claude/worktrees/<sanitized-branch>` convention.

## Improvement Log

**Adversarial review on 2026-05-07** (originating plan was authored same day; review was triggered before any phase shipped):

- **Dropped Phase 3 entirely.** Originally drafted as "Bring `electron-forge package` under Turbo + audit cache hit rate." Substantially duplicated `thoughts/shared/plans/2026-05-07-turbo-cache-audit-and-wrap.md` (which scopes the work better and covers more bypasses). Replaced Phase 3 with a deferral pointer; this plan no longer touches `turbo.json` or `apps/desktop/package.json`.
- **Fixed buggy `merge-queue-success` aggregator.** Original draft had a dead `for dep in ...; do result="${{ needs.quality.result }}"; done` loop that doesn't work in GitHub Actions (expressions evaluate at job-spawn time, not runtime). Replaced with explicit per-dep `needs.X.result` expansion matching the existing pattern in `ci.yml:63-81` and `ci-core.yml:119-143`.
- **Corrected Phase 0 worktree path.** Original draft used `../lightfast-ci-iteration` which doesn't match the repo convention. Verified via `git worktree list` that the convention is `.claude/worktrees/<sanitized-branch>` (slashes → dashes); fixed to `.claude/worktrees/feat-ci-iteration-speed`.
- **Acknowledged that branch protection on `main` doesn't exist yet.** `gh api .../protection` returns 404 at plan time. Original draft read as if it were tightening existing protection; updated Overview, Implementation Approach, Phase 2 bootstrap, and Migration Notes to reflect this is the FIRST protection rule. Rollback for Phase 2 now uses `DELETE` (don't restore — nothing to restore).
- **Added `paths:` filter to ci.yml in Phase 1.** Original draft claimed docs-only PRs would hit ~30s post-Phase-1 — not achievable since ci.yml has no path filter today and would still run full setup + biome + typecheck-affected. Added a filter on `apps/**`, `packages/**`, `core/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, and the workflow file. Updated the projection table: docs-only PRs now hit ~0s (all three workflows filter out).
- **Documented the path-filtered "required check" trade-off.** When a docs-only PR's filter excludes `CI / quality`, branch protection treats the check as `expected`/skipped. Merge queue is the gate of record, so this is acceptable; called out explicitly in Phase 1 prose and Edge cases.
- **Resolved the Phase 0/Phase 2 bootstrap contradiction.** Original draft put work in a feature-branch worktree but also said "land merge-queue.yml via direct push to main." Clarified: standard PR-merge from the worktree branch lands the workflow on main first (allowed because no protection exists yet), THEN merge queue is enabled, THEN the smoke PR tests it.
- **Corrected `.changeset/config.json` claim.** Original draft conflated `@lightfastai/cli` with the fixed group; it's actually published separately. Updated Key Discoveries.
- **Reframed cost projections as theoretical.** Current runner cost is $0 (free GitHub-hosted on a public repo). Updated table header and prose to be explicit that the $185 → $80-110/mo numbers are projections against the future Depot baseline, not current cost.
- **Replaced "5 representative PRs" with 5 specific scenarios.** Original verification was unmeasurable; now lists concrete file-touch patterns (apps edit, docs-only, core change, desktop change, cross-package breaking change) with expected behavior for each.
- **Pinned line numbers to verified values.** `turbo.json globalEnv` is line 79 (was claimed as 67); `ci-core.yml` quality job starts line 15 (was claimed as ~24); `ci.yml` env block lines 51-53 not 55-57. Updated References section with verified ranges and a note that they were verified during this review.
- **Noted `cancel-in-progress: false` is novel.** Zero existing instances in the repo; the merge-queue workflow introduced in Phase 2 is the first user. Called out in Existing wiring worth preserving.

No spike was run — all changes were static fixes that did not need empirical validation.
