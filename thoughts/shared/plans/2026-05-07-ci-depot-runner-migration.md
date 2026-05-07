# Depot CI Runner Migration Implementation Plan

## Overview

Migrate `lightfastai/lightfast`'s 8 GitHub Actions workflows from GitHub-hosted runners to Depot runners to roughly halve PR critical-path wall time (from ~3 min to ~1.5 min) and shrink the desktop release pipeline. All changes land in a single PR. The implementation is phased only as an internal checkpoint sequence — Phase 0 sets up Depot and a worktree, Phase 1 swaps Linux PR jobs (low risk), Phase 2 swaps the desktop CI macOS leg (validates the macOS toolchain on Depot), and Phase 3 swaps the release pipeline and validates with a `0.1.0-test.7` tag before merge.

## Current State Analysis

### Workflow runner inventory (verified from `.github/workflows/*.yml`)

| File | Jobs | Runners |
|---|---|---|
| `ci.yml` | `quality`, `ci-success` | both `ubuntu-latest` |
| `ci-core.yml` | `quality`, `test`, `build`, `core-ci-success` | all `ubuntu-latest` |
| `codeql.yml` | `analyze` (matrix: actions, javascript-typescript) | `ubuntu-latest` |
| `verify-changeset.yml` | `verify-changesets` | `ubuntu-latest` |
| `release.yml` | `release` | `ubuntu-latest` |
| `db-migrate.yml` | `migrate`, `no-confirmation` | both `ubuntu-latest` |
| `desktop-ci.yml` | `package` (matrix: macos-14, ubuntu-22.04) | `${{ matrix.os }}` |
| `desktop-release.yml` | `prepare`, `build_macos` (matrix: arm64,x64), `build_linux` (matrix: ubuntu-22.04, ubuntu-22.04-arm), `finalize` | mixed: `ubuntu-latest`, `macos-14`, `ubuntu-22.04`, `ubuntu-22.04-arm` |

Total `runs-on:` lines to change: 13 distinct sites across 8 files.

### Existing wiring that does NOT need to change

- `actions/checkout@v4` — runner-agnostic.
- `pnpm/action-setup@v4` and `actions/setup-node@v4` with `cache: 'pnpm'` — Depot accelerates these transparently (per https://depot.dev/docs/cache/integrations/github-actions). No workflow edits required.
- `TURBO_TOKEN` / `TURBO_TEAM` env on every cache-aware job (`ci.yml:18-20`, `ci-core.yml:18-20,51-53,81-83`, `desktop-ci.yml:40-42`, `desktop-release.yml`, `release.yml:14-16`) — Vercel Remote Cache works identically on Depot.
- `actions/attest-build-provenance@v2` (`desktop-release.yml:166-171, 236-241`) — uses GitHub OIDC, not runner identity. Will be verified end-to-end by the test tag.
- Apple keychain bootstrap (`desktop-release.yml:131-156`) — relies on `security`, `codesign`, `xcrun notarytool`, all standard tooling on Depot's bare-metal macOS image.

### Migration sensitivities (must validate before merge)

1. The macOS signing path (`desktop-release.yml:131-156`) runs on Depot's M2 image, not GitHub's M1 `macos-14`. The keychain commands are identical, but image differences sometimes surface as missing tools (e.g. older `notarytool` versions). Validated by Phase 3 test tag.
2. `actions/attest-build-provenance@v2` sigstore upload depends on outbound network from Depot's runner subnet. Should work — both Depot Linux and macOS runners have unrestricted egress per docs — but unverified on this repo until Phase 3.
3. Linux ARM (`ubuntu-22.04-arm` → `depot-ubuntu-22.04-arm-4`) used for `electron-forge publish --platform=linux --arch=arm64` (`desktop-release.yml:185, 234`). Depot's ARM runners report as `aarch64`; the Electron arm64 maker chain (`MakerDeb`, `MakerRpm`, `MakerZIP`) needs the same `dpkg-deb`, `fakeroot`, `rpm`, `rpmbuild` tools that `apt-get install -y rpm fakeroot` (`desktop-release.yml:209-213`) sets up. Phase 0 smoke confirms `uname -m` returns `aarch64`; full toolchain is validated by the Phase 3 test tag.

### Decisions taken (from clarifying questions and adversarial review)

- **Phase 0 covers Depot setup**: org creation, GitHub App install, billing alert, and a multi-label smoke workflow.
- **Uniform runner size**: `-4` suffix (4 vCPU / 16 GB / $0.008/min) on every Linux job, regardless of build-heaviness. The cost gap to `-2` is ~$5/mo at projected volume; the cognitive cost of a per-job rule outweighs it.
- **Explicit OS version pin**: prefer `depot-ubuntu-24.04` over the `depot-ubuntu-latest` alias to avoid silent OS bumps when Depot promotes the alias. Existing `ubuntu-22.04`/`ubuntu-22.04-arm` pins in the desktop matrix stay as `-22.04`/`-22.04-arm` for parity.
- **Test tag scheme**: continue `0.1.0-test.N` series; next is `0.1.0-test.7`. The successful tag is **kept** as audit trail (matches rc.1→rc.6 precedent).
- **Single PR**: all 13 `runs-on:` swaps land together; phases are implementation checkpoints.
- **Partial-migration fallback**: if Phase 3's test tag fails repeatedly with a Depot-platform issue (e.g. sigstore egress blocked from Depot mac subnet, missing notarytool path), `build_macos` reverts to `macos-14` (GitHub-hosted) for the merged PR — Linux + PR-path migration still ships.

## Desired End State

After this plan completes:

1. All 13 `runs-on:` sites in `.github/workflows/*.yml` reference Depot labels.
2. PR critical path (Desktop CI) drops from ~176s to ~90s on cache-cold runs and lower on cache-warm runs.
3. A `0.1.0-test.7` tag has executed end-to-end on Depot runners with: signed mac DMG/ZIP published, notarization succeeded, Linux x64 + arm64 makers produced .deb/.rpm/.zip, Sentry sourcemaps uploaded, attestation succeeded for all four platforms, and Sparkle feed generated.
4. A Depot billing alert is configured at $100/mo so any matrix explosion or runaway loop pages out.
5. Single PR merged to `main` with all changes.

### Verification

- `gh run list --workflow=ci.yml --limit 5` shows recent runs on Depot runner labels.
- Average wall time for `Desktop CI` (`gh api repos/lightfastai/lightfast/actions/workflows/desktop-ci.yml/runs --jq '.workflow_runs | map(.run_started_at,.updated_at)'`) is ≤ 100s on the 5 most recent runs.
- `gh release view '@lightfast/desktop@0.1.0-test.7' --json assets --jq '.assets | length'` returns ≥ 8 (mac arm64 dmg+zip, mac x64 dmg+zip, linux x64 deb+rpm+zip, linux arm64 deb+rpm+zip, plus `latest-mac-*.json` Sparkle feeds).
- Depot dashboard shows a non-zero billing alert configured.

### Key Discoveries

- Depot labels are direct swaps for GitHub-hosted labels with the same OS version (`depot-ubuntu-22.04` ↔ `ubuntu-22.04`, `depot-macos-14` ↔ `macos-14`); only `ubuntu-latest` requires picking 22.04 vs 24.04 explicitly. Per Depot docs, `ubuntu-latest` is most safely mapped to `depot-ubuntu-24.04` because GitHub's `ubuntu-latest` was promoted to 24.04 in 2024.
- `actions/setup-node` with `cache: 'pnpm'` is automatically accelerated on Depot — no `useblacksmith/cache` style swap needed.
- `desktop-ci.yml:39` matrix uses bare label syntax (`os: [macos-14, ubuntu-22.04]`) and the runner is then `runs-on: ${{ matrix.os }}` — matrix entries themselves change, no schema work required.
- `desktop-release.yml:181-185` Linux build matrix uses an `include:` block with `runner:` field (`runner: ubuntu-22.04` and `runner: ubuntu-22.04-arm`) — only those values change.
- The repo went through `rc.1` → `rc.6` test tags successfully ([memory:`feedback_release_pipeline_dryrun.md`](../../../../.claude/projects/-Users-jeevanpillay-Code--lightfastai-lightfast/memory/feedback_release_pipeline_dryrun.md)), so `0.1.0-test.7` slots into a proven validation pattern.

## What We're NOT Doing

- **Not doing Workstream B** (Turbo + Vercel Remote Cache hit-rate audit). Tracked as a separate workstream in the research doc; will get its own `/create_plan`.
- **Not changing any `actions/cache` configuration** — Depot accelerates `actions/setup-node`'s pnpm cache transparently. If any future workflow uses raw `actions/cache@v4`, that also works transparently per Depot docs.
- **Not touching Inngest, deployment, or any non-`.github/workflows/*.yml` infrastructure.**
- **Not consolidating `ci.yml` and `ci-core.yml`** even though they have overlapping responsibility. Cleanup deferred.
- **Not deleting `verify-changeset.yml` or `db-migrate.yml`** — both are kept as-is and just get runner labels swapped.
- **Not adopting Depot's separate `depot build` Docker product** — repo has no Dockerfiles, not relevant.
- **Not migrating to Blacksmith.** Decision documented in research; will not be revisited as part of this plan.
- **Not graduating CodeQL to a different scanner** — separate concern flagged in research as out of scope.

## Implementation Approach

The migration is structurally trivial — each runner swap is a one-token change to a `runs-on:` value. Risk is concentrated in two places:

1. **Phase 2 validates the macOS toolchain on Depot before Phase 3 trusts it for signing.** Phase 2 only runs the unsigned `electron-forge package` step (`desktop-ci.yml:71`) but it exercises the same Node setup, pnpm install, electron-forge resolver, native module rebuild, and macOS code path. If any of those break on Depot's M2 image, Phase 2 surfaces it without putting a real signing run at risk.

2. **Phase 3 cannot ship until a green test tag.** A `0.1.0-test.7` tag is cut from the worktree branch (with all phase 1+2+3 changes committed) before opening the PR. The PR opens only after the test tag's release run is fully green: signed binaries, notarized DMG, attestations, Sparkle feed. Any failure → fix in worktree → cut `0.1.0-test.8` → re-run.

The single-PR strategy works because phase 3's test tag exercises every changed runner before merge. If phase 3 fails, no other phase has shipped.

Runner-size mapping rule (simplified after review):

- **All Linux jobs**: `depot-ubuntu-24.04-4` (or `-22.04-4` / `-22.04-arm-4` for desktop matrix legs that pin OS version). One label class, one mental model.
- **Trivial jobs (`ci-success`, `core-ci-success`, CodeQL, `verify-changesets`, `db-migrate`)** still get `-4` even though 2 vCPU would suffice. The ~$5/mo overhead is cheaper than future workflow authors needing to make a sizing call.
- **macOS** is `depot-macos-14` — no size suffix exists for Depot mac.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Provision Depot, Configure Billing Alert + Concurrency Cap, Validate All Labels

### Overview

Set up the Depot org and GitHub App, configure billing thresholds, verify the org's concurrent-job limit, and prove all four Depot labels this plan uses (`depot-ubuntu-24.04-4`, `depot-ubuntu-22.04-4`, `depot-ubuntu-22.04-arm-4`, `depot-macos-14`) actually queue and run via a multi-leg smoke workflow. The smoke workflow stays in the repo through Phase 3 — it is committed in the same PR as the migration and removed in a follow-up cleanup commit on `main`. No production workflow edits in this phase.

### Changes Required

#### 1. Depot org + GitHub App + billing + concurrency

**Action**: Browser-based, performed by user (recorded here for plan completeness).

1. Sign up at https://depot.dev with the GitHub account that has admin access to `lightfastai`.
2. Create org `lightfastai`.
3. Install the Depot GitHub App on `lightfastai/lightfast` (and any other repos that should benefit; this plan only requires `lightfast`).
4. In Depot dashboard → **Settings → Billing**:
   - Configure soft alert at **$40/month** (matches projected $20–40 ceiling).
   - Configure hard cap at **$100/month** to halt runs if the alert is missed.
5. In Depot dashboard → **Settings → Org**, record the **concurrent job limit** for the org. The desktop release matrix runs 4 parallel jobs; with concurrent PR runs the simultaneous demand can hit ~8. The org cap must be ≥ 8 before Phase 3, or the test tag will queue.
6. Confirm the dashboard shows `lightfastai/lightfast` as a connected repo.

**Why $40 alert / $100 cap**: research-modeled monthly cost is $20–40. $40 catches an early outlier (1.5x over projection); $100 is the "something is broken" hard stop. A single-threshold $100 alert would only fire during a real incident, defeating the purpose of an early signal.

#### 2. Validate every Depot label via a multi-leg smoke workflow

**File**: `.github/workflows/depot-smoke.yml` (new, kept through Phase 3, deleted on `main` after PR merge)

```yaml
name: Depot Smoke Test
on:
  workflow_dispatch:
  push:
    paths:
      - .github/workflows/depot-smoke.yml
jobs:
  smoke:
    name: Smoke (${{ matrix.runner }})
    strategy:
      fail-fast: false
      matrix:
        runner:
          - depot-ubuntu-24.04-4
          - depot-ubuntu-22.04-4
          - depot-ubuntu-22.04-arm-4
          - depot-macos-14
    runs-on: ${{ matrix.runner }}
    steps:
      - name: Probe runner
        shell: bash
        run: |
          echo "OS: $(uname -srm)"
          echo "vCPU: $(getconf _NPROCESSORS_ONLN)"
          echo "Network: $(curl -sI https://api.github.com | head -n1)"
          # Toolchain probes scoped per-matrix leg
          if [[ "${{ matrix.runner }}" == depot-macos-* ]]; then
            xcrun --find codesign
            xcrun --find notarytool
            security list-keychains
          fi
          if [[ "${{ matrix.runner }}" == depot-ubuntu-22.04-arm* ]]; then
            uname -m  # expect aarch64
          fi
```

Run via `gh workflow run depot-smoke.yml --ref feat/ci-depot-runners`. All four legs must complete green before Phase 1 starts. The mac leg specifically verifies `notarytool` is on PATH — which is the Phase 3 risk surface — without exercising real signing.

#### 3. Branch for implementation

**Action**: A worktree is **optional** — use one only if you have concurrent in-progress work on the primary checkout that conflicts with `.github/workflows/*.yml` (unlikely). Otherwise just branch in place:

```bash
git fetch origin main
git checkout -b feat/ci-depot-runners origin/main
```

If you do prefer a worktree (e.g. you want to keep the test tag's branch isolated from the primary checkout's HEAD):

```bash
git worktree add -b feat/ci-depot-runners ../lightfast-ci-depot origin/main
```

The migration touches only `.github/workflows/*.yml` plus the smoke file — no app code, no dev servers — so the worktree convention from `CLAUDE.md` is not load-bearing here.

### Success Criteria

#### Automated Verification

- [ ] Branch exists: `git rev-parse --abbrev-ref HEAD` returns `feat/ci-depot-runners` (or worktree variant)
- [ ] Smoke workflow ran green on all four legs: `gh run list --workflow=depot-smoke.yml --limit 1 --json conclusion --jq '.[0].conclusion'` returns `success`
- [ ] Per-leg success: `gh run view <run-id> --json jobs --jq '.jobs | map({name, conclusion})'` shows `success` for each of `Smoke (depot-ubuntu-24.04-4)`, `Smoke (depot-ubuntu-22.04-4)`, `Smoke (depot-ubuntu-22.04-arm-4)`, `Smoke (depot-macos-14)`
- [ ] Mac leg confirms toolchain: smoke logs include `xcrun --find notarytool` resolving to a path

#### Human Review

- [ ] In Depot dashboard, Settings → Billing shows **$40 soft alert** and **$100 hard cap** configured → screenshot or confirm both values
- [ ] In Depot dashboard, Settings → Org records **concurrent job limit ≥ 8** → confirmed before Phase 3
- [ ] In GitHub repo settings → Integrations, Depot GitHub App appears in the "Installed GitHub Apps" list with access to `lightfastai/lightfast`
- [ ] In Depot dashboard, all four smoke runs appear with their reported runner spec (4 vCPU x64, 4 vCPU x64, 4 vCPU ARM aarch64, 8 vCPU M2 macOS)

---

## Phase 1: Swap Linux PR-path Workflows

### Overview

Replace all `ubuntu-latest` references with `depot-ubuntu-24.04-4` in the six Linux-only workflows. One label, one rule. No matrix or signing changes in this phase.

### Changes Required

#### 1. `.github/workflows/ci.yml`

**File**: `.github/workflows/ci.yml`
**Changes**: Two `runs-on:` lines.

```yaml
# line 17
  quality:
    name: Quality
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

```yaml
# line 68
  ci-success:
    name: CI Success
    if: always()
    needs: [quality]
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

#### 2. `.github/workflows/ci-core.yml`

**File**: `.github/workflows/ci-core.yml`
**Changes**: Four `runs-on:` lines.

```yaml
# line 17 — quality job
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest

# line 50 — test job
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest

# line 80 — build job
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest

# line 124 — core-ci-success
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

#### 3. `.github/workflows/codeql.yml`

**File**: `.github/workflows/codeql.yml`
**Changes**: One `runs-on:` line.

```yaml
# line 14
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

#### 4. `.github/workflows/verify-changeset.yml`

**File**: `.github/workflows/verify-changeset.yml`
**Changes**: One `runs-on:` line.

```yaml
# line 17
  verify-changesets:
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

Note: `verify-changeset.yml`'s `setup-node@v4` step has no `cache:` configured (line 25), so Depot's transparent cache acceleration is a no-op for this workflow. The migration's only speedup here comes from queue-time and slightly faster `pnpm install`. Expected delta is small (a few seconds).

#### 5. `.github/workflows/release.yml`

**File**: `.github/workflows/release.yml`
**Changes**: One `runs-on:` line.

```yaml
# line 16
  release:
    name: Release
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

Build-heavy: runs `pnpm turbo build`, `pnpm changeset publish` with provenance, `pnpm --filter lightfast test`, plus npm registry round-trip.

#### 6. `.github/workflows/db-migrate.yml`

**File**: `.github/workflows/db-migrate.yml`
**Changes**: Two `runs-on:` lines.

```yaml
# line 19 — migrate job
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest

# line 73 — no-confirmation job
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

Neither job is CPU-bound (slow path is `pnpm install --frozen-lockfile` + `drizzle-kit migrate`), but `-4` is used here too per the simplified runner-size rule.

### Success Criteria

#### Automated Verification

- [ ] All `ubuntu-latest` references in scoped files are gone: `grep -n 'ubuntu-latest' .github/workflows/{ci.yml,ci-core.yml,codeql.yml,verify-changeset.yml,release.yml,db-migrate.yml}` returns empty
- [ ] Workflow YAML still parses: `for f in ci ci-core codeql verify-changeset release db-migrate; do yq eval '.jobs' .github/workflows/$f.yml > /dev/null; done` — every file emits no error
- [ ] Push to worktree branch triggers `ci.yml` and `ci-core.yml`: `gh run list --branch feat/ci-depot-runners --limit 5` shows runs for both
- [ ] Both runs land green: `gh run view <run-id> --json conclusion --jq '.conclusion'` returns `success`

#### Human Review

- [ ] In Depot dashboard, every Linux job in this phase reports 4 vCPU / 16 GB → confirm in the per-run job spec panel (uniform sizing applied)
- [ ] In Depot dashboard, wall-time of the new `quality` job is < 80% of the last GitHub-hosted run's wall-time → expected speedup observed; if not, flag and pause before Phase 2
- [ ] CodeQL run on Depot uploads SARIF results identically (visible in repo Security → Code scanning) → no regression in CodeQL coverage

---

## Phase 2: Swap Desktop CI Matrix

### Overview

Update the `desktop-ci.yml` matrix to use Depot labels for both macOS and Linux legs. This is the first time Depot's macOS image runs in this repo. Still no signing — `desktop-ci.yml` only runs `electron-forge package` (unsigned) — so risk is bounded to "does the toolchain work."

### Changes Required

#### 1. `.github/workflows/desktop-ci.yml`

**File**: `.github/workflows/desktop-ci.yml`
**Changes**: Rename the `os` matrix variable to `runner` (Depot label values are runner labels, not OS names) and convert to `include:` form for parity with `desktop-release.yml`'s pattern. Also rename the `runs-on:` reference.

```yaml
# line 34 — runs-on
    runs-on: ${{ matrix.runner }}   # was: ${{ matrix.os }}

# line 39 — matrix
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos
            runner: depot-macos-14       # was: macos-14
          - os: linux
            runner: depot-ubuntu-22.04-4 # was: ubuntu-22.04
```

Why rename: the previous `matrix.os` value (`macos-14`) was both a runner label *and* a meaningful OS identifier; under Depot the runner label is `depot-macos-14` and the OS abstraction (`macos` / `linux`) is now a separate axis. Naming them separately makes future per-arch matrix expansion (e.g. mac arm64 vs x64) trivial.

The `if: runner.os == 'Linux'` guard on line 56 (the `apt-get install` step) still works — `runner.os` is normalized by GitHub Actions from the runner image, independent of the matrix variable name.

### Success Criteria

#### Automated Verification

- [ ] Push triggers `desktop-ci.yml`: `gh run list --workflow=desktop-ci.yml --branch feat/ci-depot-runners --limit 1`
- [ ] Both matrix legs land green: `gh run view <run-id> --json jobs --jq '.jobs[] | {name, conclusion}'` returns `success` for both `Typecheck + package (unsigned, macos)` and `Typecheck + package (unsigned, linux)` (job names use `matrix.os`, not `matrix.runner`)
- [ ] Both legs produced unsigned packages — visible in the run logs: `gh run view <run-id> --log | grep -E 'Wrote .+(zip|deb|rpm|app)'` shows non-empty output
- [ ] Wall-time of the `package` job on `depot-macos-14` is reported in `gh run view --json jobs` and is at most ~120s (research's projected ~90s with 2x runner from a 176s baseline; allow 33% headroom for cache cold)

#### Human Review

- [ ] In Depot dashboard, the macOS job reports M2 / 8 vCPU / 24 GB → confirms macOS runner spec
- [ ] No `notarytool` or `codesign` errors appear in macOS leg logs → toolchain is intact even though signing isn't exercised here (notarytool is invoked by `xcrun --check-version` paths in some forge plugins; surfacing PATH errors here would block Phase 3)
- [ ] Linux leg logs show `dpkg-deb`, `fakeroot`, `rpm`, `rpmbuild` resolved by `which` (line 60) → ARM/x64 toolchain is present on Depot's Ubuntu image

---

## Phase 3: Swap Release Pipeline + Validate via `0.1.0-test.7` Tag

### Overview

Update all `runs-on:` references in `desktop-release.yml`, then push a `@lightfast/desktop@0.1.0-test.7` tag from the worktree branch. The pipeline must produce signed mac DMG/ZIP, notarized binaries, Linux x64+arm64 makers, attestations on all four platforms, and a Sparkle feed. The PR is opened only after the tag's release run is fully green.

### Changes Required

#### 1. `.github/workflows/desktop-release.yml`

**File**: `.github/workflows/desktop-release.yml`
**Changes**: Five `runs-on:` sites across four jobs.

```yaml
# line 15 — prepare job
  prepare:
    name: Prepare draft release
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

```yaml
# line 77 — build_macos job
  build_macos:
    name: Build macOS ${{ matrix.arch }}
    needs: prepare
    runs-on: depot-macos-14   # was: macos-14
```

```yaml
# lines 181-185 — build_linux matrix
    strategy:
      fail-fast: false
      matrix:
        include:
          - arch: x64
            runner: depot-ubuntu-22.04-4   # was: ubuntu-22.04
          - arch: arm64
            runner: depot-ubuntu-22.04-arm-4   # was: ubuntu-22.04-arm
```

The job's `runs-on: ${{ matrix.runner }}` on line 176 needs no change.

```yaml
# line 246 — finalize job
  finalize:
    name: Finalize release
    needs: [prepare, build_macos, build_linux]
    runs-on: depot-ubuntu-24.04-4   # was: ubuntu-latest
```

#### 2. Cut `0.1.0-test.7` validation tag

**Action**: Run from the worktree (`../lightfast-ci-depot`), with all Phase 1+2+3 commits in place.

```bash
git tag '@lightfast/desktop@0.1.0-test.7'
git push origin '@lightfast/desktop@0.1.0-test.7'
gh run watch  # or: gh run list --workflow=desktop-release.yml --limit 1
```

The tag triggers `desktop-release.yml`. Watch the run until all jobs report `success`.

If failure: fix on the branch, push commits, cut `@lightfast/desktop@0.1.0-test.8`, repeat. Do **not** delete failed tags from the remote — they're the audit trail. Do not amend; cut a new tag.

After green test tag:

1. Inspect the draft release: `gh release view '@lightfast/desktop@0.1.0-test.7' --json assets,isPrerelease`. Assets must include all four platform binaries plus Sparkle feed JSONs.
2. **Keep** the tag and its draft release. Matches the rc.1→rc.6 dry-run precedent — the tag IS the audit trail proving Depot migration was validated end-to-end. Do not delete.

#### 3. Platform-failure fallback (read before retrying)

Some failure modes are not recoverable by a fix-and-retry-with-test.8 loop:

- **`actions/attest-build-provenance@v2` consistently fails on `depot-macos-14`** (e.g. sigstore OIDC blocked, Fulcio unreachable from Depot mac subnet) — same code path passes on `ubuntu-22.04` Depot Linux runner.
- **`xcrun notarytool submit` hangs or times out** with `notary-api.apple.com` unreachable from Depot's mac egress.
- **`codesign` fails to find a tool** (`security`, `codesign`, or notarytool itself) absent from Depot's macOS image.

If two consecutive test tags hit the same Depot-macOS-platform failure with no app-side fix available, ship a **partial migration**: leave `desktop-release.yml`'s `build_macos` job on `runs-on: macos-14` (GitHub-hosted) and proceed with the rest of the migration. Linux + PR-path speedup still ships; macOS leg gets revisited when Depot resolves the underlying issue (file a Depot support ticket with the run logs as evidence). Update the plan's "What We're NOT Doing" list and the PR description to record the carve-out.

This branch exists because: (a) the plan's projected $20–40/mo savings comes mostly from PR-path speedup, not the release pipeline; (b) holding the entire migration hostage to a single matrix leg burns more eng time than the leg saves.

#### 4. Open PR

After test tag green:

```bash
gh pr create \
  --title "ci: migrate workflows to Depot runners" \
  --base main \
  --head feat/ci-depot-runners \
  --body-file <(cat <<'EOF'
Migrates all 8 GitHub Actions workflows to Depot runners.

Validation: `@lightfast/desktop@0.1.0-test.7` tag completed end-to-end on Depot
(signed mac, notarized, Linux x64+arm64 makers, attestations, Sparkle feed).
Tag and draft release are kept as audit trail.

Includes `.github/workflows/depot-smoke.yml` (multi-label matrix smoke). To be
removed in a follow-up commit on `main` after one week of stable CI runs.

See `thoughts/shared/plans/2026-05-07-ci-depot-runner-migration.md` for the
full plan and `thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md`
for vendor analysis.
EOF
)
```

### Success Criteria

#### Automated Verification

- [ ] No `ubuntu-latest`, `ubuntu-22.04`, `ubuntu-22.04-arm`, or bare `macos-14` labels remain anywhere in `.github/workflows/`: `grep -rE '^\s*runs-on:\s*(ubuntu-latest|ubuntu-22\.04(-arm)?|macos-14)\s*$' .github/workflows/` returns empty
- [ ] No bare label values remain in matrix include blocks either: `grep -nE 'runner: (ubuntu-22\.04|ubuntu-22\.04-arm)' .github/workflows/` returns empty
- [ ] `0.1.0-test.7` release run completed green: `gh run list --workflow=desktop-release.yml --limit 1 --json conclusion --jq '.[0].conclusion'` returns `success`
- [ ] Release contains all expected assets: `gh release view '@lightfast/desktop@0.1.0-test.7' --json assets --jq '.assets | map(.name)'` includes at minimum: a `.dmg` for arm64, a `.dmg` for x64, `.zip` for both arches, `.deb` and `.rpm` for both Linux arches, and `latest-mac-arm64.json` + `latest-mac-x64.json`
- [ ] All four build attestations exist: `gh api repos/lightfastai/lightfast/attestations/sha256:<digest>` returns 200 for the digest of each released binary (run for at least one mac and one Linux artifact as smoke)
- [ ] PR opens against `main`: `gh pr list --head feat/ci-depot-runners --json url --jq '.[0].url'` returns a URL

#### Human Review

- [ ] In Depot dashboard, all four parallel build jobs (`Build macOS arm64`, `Build macOS x64`, `Build Linux x64`, `Build Linux arm64`) appear with correct runner spec — mac jobs on M2 / 8 vCPU, Linux jobs on 4 vCPU (x64) and 4 vCPU ARM (arm64)
- [ ] Open the macOS DMG locally (download from the test release page, `open <file>.dmg`, drag to Applications, launch the app, see the menu bar) → Gatekeeper doesn't block, app starts → confirms notarization survived the Depot migration — TODO: automate via headless `spctl --assess --verbose` invocation in CI
- [ ] In Sentry, the test release sourcemaps appear under the Releases panel with `0.1.0-test.7` version → confirms `pnpm sourcemaps:upload` (`desktop-release.yml:163-164`) still runs against Depot
- [ ] In repo Security → Code scanning and Security → Attestations, the four binary attestations appear → confirms OIDC + provenance survived the runner change
- [ ] Total wall-time of the release pipeline (visible at the run-summary level in GH Actions UI) is ≤ 200s (down from ~257s baseline) → expected ~127s reduction realized

---

## Testing Strategy

### Validation surfaces (no code-level unit tests — pure CI infra change)

1. **Per-phase workflow runs** verify Depot's runner image works for each kind of job (lightweight bash, turbo build, electron-forge package, electron-forge publish).
2. **Test tag** (`0.1.0-test.7`) is the integration test for the release pipeline.
3. **Post-merge observation window**: the first 5 PR runs after merge should land within projected wall-time (Phase 1 success criteria), and the next changesets-driven npm release run should also land green.

### Edge cases to watch for

- **Cache cold on first run**: Depot's transparent cache populates on first run per cache key. Phase 1's first run will be cold; subsequent runs benefit from Depot Cache. Don't conclude "Depot is slow" from one cold run — measure across at least 5 runs.
- **`actions/attest-build-provenance` rate-limiting**: sigstore has rate limits. If the test tag fails this step, reading `desktop-release.yml:166-171` carefully — if the failure mode is HTTP 429, that's not a Depot issue.
- **Depot's macOS image lacks a tool that GitHub's has**: low-probability but possible. Pre-flight `which xcrun codesign security notarytool` in Phase 2 logs would surface it; if missing, file a Depot support ticket and pause Phase 3.
- **Apple notary endpoint allowlist**: if Depot mac runners can't reach `notary-api.apple.com`, the Phase 3 publish step will hang then fail. Both Depot and Blacksmith claim unrestricted egress, but verify via the `pnpm exec electron-forge publish` log on the test tag.

## Performance Considerations

Expected wall-time per workflow (research-projected, validates during phase runs):

| Workflow | Baseline | Projected | Phase that validates |
|---|---:|---:|---|
| CI | 109s | ~55s | Phase 1 |
| Core CI | 79s | ~40s | Phase 1 |
| CodeQL | 94s | ~50s | Phase 1 |
| Desktop CI | 176s | ~90s | Phase 2 |
| Release desktop (wall) | 257s | ~130s | Phase 3 |

The test tag in Phase 3 validates *all* of these together, since the worktree branch carries every Phase 1+2+3 change. Cache-warming on the test tag also primes Depot Cache for the merge commit's first PR runs.

## Migration Notes

- **Rollback**: revert is one command per file: `git revert <commit>` on the merge commit, or hand-edit each `runs-on:` back to `ubuntu-latest`/`macos-14`/etc. No state lives on Depot's side that breaks GitHub-hosted reruns.
- **Keep GitHub-hosted labels in commit history for 30 days** as a safety net — the merge commit is the rollback artifact. After 30 clean days, no further action needed.
- **Post-merge**: file a follow-up to start `/create_plan` for Workstream B (Turbo + Vercel Remote Cache audit). Cache-aware Depot runners only help where the cache hits; Workstream B answers whether the cache is healthy.
- **Cost monitoring**: review Depot dashboard at the end of week 1 and week 4 post-merge. Confirm monthly run rate stays ≪ $100/mo soft limit; raise the alert ceiling only if expected volume rises (e.g. matrix expansion or new workflows).

## References

- Original research: `thoughts/shared/research/2026-05-07-ci-runner-upgrade-depot-vs-blacksmith.md`
- Depot runner table: https://depot.dev/docs/github-actions/runner-types
- Depot cache integration: https://depot.dev/docs/cache/integrations/github-actions
- Existing release pipeline dry-run pattern: memory `feedback_release_pipeline_dryrun.md` (rc.1 → rc.6 validation series)
- Current release-pipeline state: memory `project_desktop_release_state.md`
- Workflow files (current state):
  - `.github/workflows/ci.yml:17,68`
  - `.github/workflows/ci-core.yml:17,50,80,124`
  - `.github/workflows/codeql.yml:14`
  - `.github/workflows/verify-changeset.yml:17`
  - `.github/workflows/release.yml:16`
  - `.github/workflows/db-migrate.yml:19,73`
  - `.github/workflows/desktop-ci.yml:34,39`
  - `.github/workflows/desktop-release.yml:15,77,176,181-185,246`

## Improvement Log

### 2026-05-07 — Adversarial review pass (`/improve_plan`)

Plan reviewed against `.github/workflows/*.yml` ground truth, the companion research doc, and live Depot docs. ARM label string `depot-ubuntu-22.04-arm-4` independently verified via WebFetch of `https://depot.dev/docs/github-actions/runner-types` — no spike needed.

**Critical fixes applied**

1. **Phase 3 no longer deletes the test tag.** Original plan instructed `gh release delete` and `git push origin :refs/tags/...` after green run, which would destroy the migration's only audit artifact. Tag + draft release now kept (matches `feedback_release_pipeline_dryrun.md` rc.1→rc.6 precedent).
2. **Phase 3 platform-failure fallback added.** Original plan looped indefinitely on Depot-mac platform issues with no exit. New fallback: after two consecutive failures with no app-side fix, ship partial migration (build_macos stays on `macos-14`, rest moves to Depot).
3. **Phase 0 smoke is now a 4-leg matrix.** Original plan only validated `depot-ubuntu-24.04` before Phase 2/3 first exercised mac and ARM labels. New smoke fan-out covers `depot-ubuntu-24.04-4`, `depot-ubuntu-22.04-4`, `depot-ubuntu-22.04-arm-4`, `depot-macos-14` and includes a `notarytool`/`xcrun --find` probe. Smoke workflow now kept through Phase 3, removed in follow-up commit on `main`.

**High-priority improvements**

4. **Runner-size mapping collapsed to one rule.** Original plan used 4 distinct labels with a "build-heavy vs trivial" split saving ~$5/mo. Replaced with `-4` everywhere — one mental model, no per-job sizing decision for future workflow authors.
5. **`desktop-ci.yml` matrix variable renamed `os` → `runner` with `include:` form.** Depot label values are runner identifiers, not OS names; `matrix.os == 'depot-macos-14'` was misleading. New shape mirrors `desktop-release.yml`'s pattern and unblocks future per-arch matrix expansion.
6. **Billing alert split into $40 soft / $100 hard cap.** Original $100 single threshold would only fire during a real incident. $40 catches early outliers; $100 is the hard stop.
7. **Concurrency cap added to Phase 0 success criteria.** `desktop-release.yml`'s 4 parallel jobs plus PR runs can hit ~8 simultaneous Depot jobs. Org concurrency limit must be ≥ 8 before Phase 3.

**Minor improvements**

8. **Worktree convention demoted to optional.** Original plan mandated a worktree for Phase 0; the migration touches only `.github/workflows/*.yml` (no app code, no dev servers), so worktree adds steps without buying anything for *this* plan. Branch in place is the default.
9. **`verify-changeset.yml` cache caveat documented.** Setup-node has no `cache:` configured, so Depot's transparent acceleration is a no-op there. Migration speedup for that workflow is small by design.
10. **`depot-ubuntu-latest` alias decision recorded.** Plan now explicitly prefers `depot-ubuntu-24.04` over the alias to avoid silent OS bumps.

**Spike result**

ARM label string `depot-ubuntu-22.04-arm-4` was the highest-leverage uncertainty. Verified directly against Depot docs: ARM family uses `-arm-` (not `-arm64-`), all sizes from base through `-64` available. No code spike needed — docs confirmed.
