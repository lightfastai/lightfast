---
date: 2026-05-06T11:27:50Z
researcher: claude
git_commit: 1bc77e573905d405c2f48fb81b0c019cab569204
branch: docs/codex-gap-status-tracker-callout
topic: "Desktop deferred-state grouping for parallel sub-worktree implementation (post rc.4)"
tags: [research, desktop, electron, planning, worktrees, deferred, codex-gap-followup]
status: complete
last_updated: 2026-05-06
parents:
  - thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
  - thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md
  - thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md
---

# Research: Desktop Deferred-State Grouping for Parallel Sub-Worktree Implementation

**Date**: 2026-05-06T11:27:50Z
**Git Commit**: 1bc77e573905d405c2f48fb81b0c019cab569204
**Branch**: docs/codex-gap-status-tracker-callout

## Research Question

Following the rc.4 ad-hoc dry-run, what's the most accretive next set of work, and how should the still-deferred items from `2026-04-23-codex-vs-lightfast-desktop-production-gap.md` be grouped so they can be parallelized across isolated git worktrees with minimal merge-conflict surface?

## Summary

The rc.4 dry-run closed the entire pre-release pipeline (G-1 Sentry half, G-2, G-3, G-5, G-7, G-8…G-14). The Apple-coupled surface (G-1 Apple half, G-4 branch protection on signed cut, G-6 auto-updater enable, §1 Sparkle-native auto-update) is now **FULL DEFER** in the parent doc — all gated on Apple Developer enrollment. **This doc deliberately excludes Apple-blocked work.** Everything proposed below lands without Apple.

The non-Apple deferred items split cleanly into **subsystem-aligned worktree groups**. Three are independent enough to run as parallel worktrees today (Tier 1, zero pairwise file conflict); two are single-worktree follow-ons (Tier 2); three are product-decision-gated (Tier 3). The accretive next batch (Tier 1) is **Observability tier 2** (file logger + Sentry vendor wrap + SDK bump), **Linux makers + CI matrix** (deb/rpm), and **Dev/test tooling** (Playwright Electron CDP + devtools:reset + 3p-notices). They share zero load-bearing files and can ship in any order.

One factual drift surfaced during verification: the parent doc's 2026-05-06 update states the deep-link surface "was never reintroduced" (`§10`, post-dry-run table). This is no longer true — PR #627 (`d4f0cb4b2`, merged 2026-05-06) reintroduced `apps/desktop/src/main/protocol.ts` (79 lines, `setAsDefaultProtocolClient`, `open-url`, `second-instance`) and `forge.config.ts:133-138` `CFBundleURLTypes` for the PKCE custom URL scheme `lightfast://`. The grep that backed the doc's claim ran before #627 merged. Doc cleanup is in flight on this branch (`docs/codex-gap-status-tracker-callout`, PR #649 open).

## Recent PR Survey (since the rc.4 cut)

Verified against `gh pr list --state merged --limit 30` and `git log`.

| PR | Date | Branch | Effect on deferred state |
|---|---|---|---|
| #649 (open) | 2026-05-06 | `docs/codex-gap-status-tracker-callout` | Doc-only — Status Tracker post-dry-run callout. No code change. |
| #648 | 2026-05-06 | `ci/desktop-release-title-format` | CI polish — uses `@lightfast/desktop@<version>` package-style release title. Closes a small workflow ergonomic. |
| #647 | 2026-05-06 | `docs/codex-gap-doc-cleanup` | Doc-only — refresh the parent gap doc post-dry-run. |
| #646 | 2026-05-06 | `fix/desktop-portless-ca-injection` | Dev-only — auto-injects `NODE_EXTRA_CA_CERTS` for Portless TLS trust during local PKCE exchange. New small surface (`apps/desktop/scripts/with-desktop-env.mjs` likely). Confirms the dev TLS path is now stable. |
| #645 | 2026-05-06 | `docs/sentry-bridge-correction` | Doc + small refactor — corrects Bug F diagnosis (renderer SDK was never broken; v10 carrier path differs from v8/v9). Also routes Sentry import through `@vendor/observability` (`435a837d5`). |
| #644 | 2026-05-06 | `docs/desktop-rc1-dryrun-report` | Doc-only — dry-run final report at `thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md`. |
| #643 | 2026-05-06 | `feat/desktop-renderer-error-bridge` | Code — bridges renderer errors to main Sentry SDK via `IpcChannels.rendererError`. Closes G-12. |
| #642, #641, #640, #639, #638 | 2026-05-06 | (rc dry-run fixes) | Code — closed G-8…G-14. Documented in parent doc §"New gates surfaced". |
| #637 | 2026-05-06 | `desktop-unsigned-beta-distribution` | Code — `signingMode` enum, ad-hoc fallback in osxSign, updater kill-switch. Pre-rc.1 baseline. |

**No new deferred-list reductions since rc.4 land.** PRs #644-#649 are doc-only or small CI/dev fixes; none expand the desktop product surface. The deferred grid in the parent doc Status Tracker is intact apart from G-2/G-3/G-5/G-7/G-8…G-14 closures already recorded.

## Verified Current State of Deferred Items (non-Apple-blocked only)

Each row checked against tree at commit `1bc77e573905d405c2f48fb81b0c019cab569204` via Grep + file reads. "Status" reflects what's literally in the tree right now. Apple-blocked rows (Sparkle-native auto-update §1, signed-build gates G-1/G-4/G-6) are tracked in the parent doc's FULL DEFER section and intentionally excluded here.

| # | Item | Status | Evidence |
|---|---|---|---|
| 2 | File-backed structured logger | absent | no `electron-log`/`pino`/`winston`/`fs.appendFile` under `src/main/` |
| 3 | SQLite persistent storage | absent | no `better-sqlite3`/`sqlite`/`drizzle-orm` in `apps/desktop/package.json`; three flat-JSON stores remain (`settings-store.ts`, `window-state.json`, `auth.bin`) |
| 4 | Worker / utilityProcess tier | absent | no `utilityProcess`/`Worker(`/`worker_threads`/`child_process.spawn`/`fork` under `src/main/` |
| 5 | Linux deb/rpm makers | absent | `forge.config.ts:88-97` declares only `MakerSquirrel`, `MakerZIP`, `MakerDMG`. Windows MSIX with code-signing left to a separate Windows-EV-cert track (parallel external blocker, not addressed here). |
| 6 | Universal binary merge | absent (intentional — two artifacts) | no `@electron/universal`; per-arch matrix in `desktop-release.yml` |
| 7 | Per-surface preload isolation | absent | `src/preload/preload.ts` is the only preload; `forge.config.ts` has one preload entry |
| 8 | Menu + renderer i18n beyond `en` | absent | only `src/main/locales/en.json` (29 keys); no `react-intl`/`i18next`/`lingui` in renderer |
| 9 | Dev/test tooling (Playwright + devtools:reset + 3p-notices) | absent | `vitest` present (3 main-process tests), `@playwright/test` not in devDeps; `apps/desktop/scripts/` contains only `generate-update-feed.mjs` + `upload-sourcemaps.mjs` |
| 10 | Deep-link URL→route dispatcher | **partially present** (PKCE-only) | `src/main/protocol.ts` reintroduced by PR #627; handles `lightfast://auth/callback` for PKCE; no general route table — see Drift §below |
| 11 | Entitlements diet (main + inherit plists) | done | `entitlements.mac.plist` (5 keys), `entitlements.mac.inherit.plist` (3 keys, `disable-library-validation` removed by PR #638) |
| 12 | Info.plist hygiene | done | `forge.config.ts:67-78` carries `NSQuitAlwaysKeepsWindows=false`, `LSMinimumSystemVersion=12.0`, `MallocNanoZone=0` |
| 13 | Build-metadata stamping | done | workflow stamps `version`/`buildNumber`/`sparkleFeedUrl`/`sentryDsn` via `npm pkg set`; `package.json` placeholders intentional |
| 14 | Notifications / dock badge / sound | absent | no `new Notification(`/`setBadgeCount(`/`app.dock.bounce`/sound assets under `src/` |
| 15 | `@sentry/electron` 7.13.0 bump | absent | `apps/desktop/package.json:50` pins `^7.11.0`; the v10-vs-v7 carrier path was orthogonal — see parent doc Bug F correction |
| 16 | `LIGHTFAST_REMOTE_DEBUG_PORT` honored in packaged builds | gated off | `bootstrap.ts` `if (!app.isPackaged)` — intentional security hardening per dry-run report |

### Drift from parent doc (post-rc.4)

The parent doc's 2026-05-06 update §10 says:

> **§10 deep-link surface is genuinely gone.**

That statement was true at the time of writing (the grep ran before PR #627 merged). PR #627 (`d4f0cb4b2`, merged 2026-05-06) reintroduced the surface for PKCE auth:
- `apps/desktop/src/main/protocol.ts:30-35` — `app.setAsDefaultProtocolClient(scheme)` (`lightfast` packaged, `lightfast-dev` dev)
- `apps/desktop/src/main/protocol.ts:55-68` — `open-url` (macOS) and `second-instance` (Win/Linux) listeners
- `apps/desktop/src/main/protocol.ts:6,40-43` — `Set<ProtocolUrlListener>` dispatch
- `apps/desktop/forge.config.ts:133-138` — `CFBundleURLTypes` registers the `lightfast` scheme
- `apps/desktop/src/main/__tests__/protocol.test.ts` — 3 vitest test files cover dispatch order + first-launch handler attach

The reintroduced surface is **single-purpose** (`auth-flow.ts:132` is the only consumer; `auth-flow.test.ts:225` exercises `lightfast://auth/callback`). The general "URL → renderer route" dispatcher described in the parent doc §10 is still absent — there's no route table beyond auth callback. So §10's broader gap is unchanged in spirit, but the literal "the surface is gone" claim needs updating.

## Canonical Still-Deferred List (post rc.4)

Two cohorts:

### Cohort A — feature/platform deferrals (parent doc §1-15, non-Apple-blocked)
- File-backed logger
- SQLite persistent storage
- Worker / utilityProcess tier
- Linux deb/rpm makers
- Universal binary (or "two-artifact" continued policy)
- Per-surface preload isolation
- i18n beyond `en` (menu + renderer)
- Dev/test tooling (Playwright Electron CDP, devtools:reset, 3p-notices, metadata-probe, native-rebuild scripts)
- Notifications + dock badge + sound
- General deep-link route table (auth callback already handled)
- Crash reporter explicit `crashReporter.start()` policy decision (currently relies on `@sentry/electron`'s implicit Crashpad init)

### Cohort B — small follow-ups surfaced by the dry-run
- Bump `@sentry/electron` 7.11.0 → 7.13.0 (catalog or per-package)
- Add `@vendor/observability/sentry-electron-renderer` re-export to enforce vendor-abstraction policy on the renderer
- Doc fix: parent §10 "deep-link surface is genuinely gone" needs to be updated to "single-purpose PKCE callback only; general dispatcher still absent"
- Renderer `installErrorBoundary` comment carries inaccurate "renderer SDK was broken" rationale (cosmetic)
- `gh attestation list` cross-repo flag invalid — doc, not code

### Excluded — Apple-blocked (FULL DEFER, see parent doc)
- §1 Sparkle-native + Ed25519 auto-update — depends on signed mac builds
- Windows MSIX with code-signing — parallel external (Windows EV cert) blocker; out of scope for this doc
- G-1 Apple half — 8 secrets pending Apple Developer enrollment
- G-4 Branch protection (post-signed-cut policy)
- G-6 Auto-updater enable on signed cut

## Worktree Group Proposal

Each group below is sized for **one isolated git worktree** with a self-contained branch. The "files touched" column is the conflict-surface fingerprint — two groups whose fingerprints overlap on the same line range will conflict on rebase. Groups are arranged so Tier 1 has zero pairwise conflict-surface overlap.

### Tier 1 — parallelizable, accretive, no external blocker

#### W1 — Observability tier 2: file logger + Sentry vendor wrap + SDK bump — **LANDED 2026-05-07**

> **Status:** landed via PR #655 (one shot, no follow-ups). Adds `apps/desktop/src/main/logger.ts` (105 LOC) + `__tests__/logger.test.ts` (165 LOC), routes 9 main-process `console.*` sites through it, adds `vendor/observability/src/sentry-electron-renderer.ts` re-export with subpath export, bumps `@sentry/electron` 7.11→7.13 in catalog. All CI green (Desktop CI mac+ubuntu, Core CI, CodeQL, Quality, Vercel ×3); CodeRabbit clean ("no actionable comments"); branch deleted on merge.
>
> Three scope deltas vs original W1 plan: (1) call-site swaps landed in `settings-store, auth-store, auth-flow, index, bootstrap` — `window-state` and `sentry.ts` were untouched, while `auth-flow` and `bootstrap` got added. (2) The renderer wrap shipped as a single re-export file inside `vendor/observability` (with a subpath export), not as a separate `vendor/observability/sentry-electron-renderer/` package. (3) A 165-LOC logger test suite was added that wasn't in the original scope (positive add). Status Tracker row 2 ("On-disk logging") and the W1 plan file's phase checkboxes remain unupdated on origin/main — punted to a future batched close-out PR.
>
> **Post-merge E2E verification (2026-05-07):** all 4 plan manual-review items confirmed — (a) dev-mode `pnpm dev:desktop` boot wrote launch log at `~/Library/Logs/Lightfast Dev/2026/05/07/desktop-<pid>-<HHMMSSsss>.log` with valid JSON line containing `ts/level/pid/message`; (b) corrupting `~/Library/Application Support/Lightfast Dev/auth.bin` with 128 random bytes triggered `[auth-store] failed to load; purging Error: ... safeStorage.decryptString` at next boot, with auth.bin purged confirming the full catch path ran (logger.error → captureException → purgePersisted); (c) `pnpm --filter @lightfast/desktop package` produced `Lightfast.app` arm64 darwin which on launch wrote `~/Library/Logs/Lightfast/2026/05/07/desktop-<pid>-<HHMMSSsss>.log` (capital L, no Dev suffix — confirms `bootstrap.ts:11` `app.isPackaged ? "Lightfast" : "Lightfast Dev"` switch); (d) gap-doc §10 paragraphs read coherently with surrounding context. Worktree at `.claude/worktrees/desktop-observability-tier2` removed; remote `feat/desktop-observability-tier2` auto-deleted by GitHub on merge.

**Why first:** Highest information-yield per LOC. The dry-run exposed how reliant we are on Sentry to see anything; a local file log is the floor under that. Vendor-wrapping the renderer SDK closes the last bare `@sentry/electron` import and removes a future-friction point. SDK bump is a 30-line diff that pulls in upstream renderer-SDK fixes from 7.12.x.

**Scope:**
- Add `apps/desktop/src/main/logger.ts` — date-partitioned per-launch log file at `~/Library/Logs/com.lightfast.desktop/YYYY/MM/DD/desktop-<pid>-<HHMMSS>.log` (or platform-equivalent), structured JSON lines, size cap per file
- Replace bare `console.error`/`console.warn` call sites in `src/main/` (settings-store, auth-store, window-state, sentry, index) with logger calls that ALSO forward to Sentry via existing wrapper
- Add `vendor/observability/sentry-electron-renderer/` package (mirror of existing `sentry-electron-main` and `sentry-browser` wraps) and migrate `src/renderer/src/main.ts` to use it
- Bump `@sentry/electron` 7.11.0 → 7.13.0 (catalog if shared, else per-package)
- Update parent research doc §10 drift correction (single-purpose deep-link, not zero)

**Files touched:**
```
apps/desktop/src/main/logger.ts                              (new)
apps/desktop/src/main/sentry.ts                              (logger forward)
apps/desktop/src/main/{settings-store,auth-store,window-state,index}.ts  (call-site swaps)
apps/desktop/src/renderer/src/main.ts                        (vendor renderer wrap)
apps/desktop/package.json                                    (sentry version)
vendor/observability/sentry-electron-renderer/               (new package)
vendor/observability/package.json                            (export path)
pnpm-lock.yaml                                               (regen)
thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md  (§10 correction)
```

**Conflict surface vs other groups:** clean. `forge.config.ts` not touched. `src/preload/preload.ts` not touched.

**Verifiable:** packaged build writes one log file per launch; Sentry events still flow; renderer error boundary still captures.

---

#### W3 — Linux makers + CI matrix — **LANDED 2026-05-07**

> **Status:** landed. PR #650 added the makers + CI matrix + release leg + `.dmg` attestation extension; PR #652 fixed the `MakerDeb`/`MakerRpm` `bin: "lightfast"` default that surfaced on the rc.5 dry-run. Validated end-to-end on `@lightfast/desktop@0.1.0-rc.6` — all 6 jobs green, 10 release assets (4 mac binaries + 2 mac feeds + 4 Linux binaries), attestations verify.
>
> Two scope deltas vs. original W3 plan: (1) `generate-update-feed.mjs` was **not** extended — Linux Sparkle is FULL DEFER per §1, so emitting `latest-linux-*.json` would bake in a guess at the future Sparkle consumer's contract. (2) Linux uses an arch matrix `[ubuntu-22.04, ubuntu-22.04-arm]` for x64+arm64 (not just a single `ubuntu-22.04` leg).

**Why now:** Linux distribution is unblocked today (no signing required for v0.x; package signing optional later). The makers are dormant config, not code; the CI matrix is well-understood. Lands without touching any runtime code in `src/`. Windows MSIX is **excluded** — its code-signing path is its own external (Windows EV cert) blocker and is tracked separately.

**Scope:**
- Add `@electron-forge/maker-deb`, `@electron-forge/maker-rpm` to `apps/desktop/devDependencies`
- `forge.config.ts:88-97` makers array: gain `MakerDeb`, `MakerRpm` (Linux-only)
- `desktop-release.yml` job matrix: gain `os: ubuntu-22.04` leg alongside existing `macos-14`
- `desktop-ci.yml` matrix: parallel — unsigned package on Linux to catch regressions
- `generate-update-feed.mjs` extension: emit `latest-linux-{arm64,x64}.json`
- Document the explicit "two-arch artifacts, no universal-binary merge" policy in `apps/desktop/README.md`

**Files touched:**
```
apps/desktop/forge.config.ts                                 (makers array section only)
apps/desktop/package.json                                    (devDeps for makers)
.github/workflows/desktop-release.yml                        (matrix expansion)
.github/workflows/desktop-ci.yml                             (matrix expansion)
apps/desktop/scripts/generate-update-feed.mjs                (linux feed entries)
apps/desktop/README.md                                       (Linux distribution notes)
pnpm-lock.yaml                                               (regen)
```

**Conflict surface vs W1:** zero (no `src/`, no `package.json` deps overlap — sentry is in deps, makers in devDeps).
**Conflict surface vs W4 (preload split):** narrow — both touch `forge.config.ts` but different sections (W3 = makers array, W4 = `plugins`/`VitePlugin.build` array). Merge order matters but resolution is mechanical.

**Verifiable:** `pnpm make --platform=linux` succeeds locally; `desktop-ci.yml` green on a no-op PR with the matrix.

**Out of scope:** Windows MSIX + Windows code-signing (separate external-blocker track); Sparkle-native auto-update on Linux (tracked under §1 FULL DEFER in parent doc — Linux Sparkle is moot until macOS Sparkle lands).

---

#### W5 — Dev/test tooling: Playwright Electron CDP + devtools:reset + 3p-notices — **LANDED 2026-05-07**

> **Status:** landed via PR #656 (admin-override regular merge to satisfy the `required_linear_history` rule given two internal `Merge origin/main` commits picked up while W1 and W3 landed mid-flight). Eleven commits collapsed into merge `4d789eccec`: 6 phase commits + 2 main-into-W5 merges + 3 post-PR fixes (offline-CI e2e, biome cleanup, macOS-scoping after W3 added the Linux matrix leg). All CI green: Desktop CI mac (2m26s) + ubuntu-22.04 (1m21s) + Quality (biome) + CodeQL + Test + Build + Vercel ×3; CodeRabbit review completed clean.
>
> Four scope deltas vs original W5 plan: (1) Phase 4 e2e steps scoped to `if: runner.os == 'macOS'` because W3's matrix added an `ubuntu-22.04` leg between W5's plan and merge — Linux Electron e2e needs Xvfb / system deps W5 didn't plan for. (2) Phase 2's `boot.spec.ts` initially tracked both `pageerror` and `console.error`; the latter caught inevitable offline-CI tRPC `account.get ERR_CONNECTION_REFUSED` and made the spec fail in 5s flat — dropped `console.error` tracking, kept `pageerror` (uncaught renderer exceptions, the actual smoke). (3) Phase 4's `playwright.config.ts` had to gain an `html` reporter alongside `line` so `Upload Playwright report on failure` had a non-empty `playwright-report/` to upload. (4) Phase 5 used `gh release upload --clobber` rather than `softprops/action-gh-release` to match the workflow's existing gh-CLI idiom (`gh release create` in `prepare`, `gh release edit` in `finalize`); also added pnpm/node setup to `finalize` because `notices:generate` needs `pnpm licenses ls` and the job previously had no install step.
>
> **Post-merge verification (2026-05-07):**
> - **Phase 4 (CI e2e) — green path:** PR #656's final run had Desktop CI macos-14 ✓ in 2m26s with the new `E2E (Playwright Electron)` step reporting `1 passed (2.4s)`; full job comfortably under the 10-min budget.
> - **Phase 4 — failure path:** PR #656's _first_ run failed naturally on the offline-CI defect; `Upload Playwright report on failure` step ran (✓), confirming wiring. PR #657 (`chore/desktop-ci-e2e-failure-verify`, draft `expect(false).toBe(true)`) produced a 541 KB `playwright-report/index.html` artifact, downloaded + verified before being closed + branch deleted.
> - **Phase 5 (release notices):** cut throwaway tag `@lightfast/desktop@0.1.0-test.1` from main post-merge → `Release desktop` run 25472386865 finished in ~4 min (prepare 13s, 4 build legs 2m39s–3m39s parallel, finalize 36s). Final undrafted release listed `THIRD_PARTY_NOTICES.txt` (17286 bytes) alongside 4 macOS binaries (.dmg + .zip × arm64/x64), 4 Linux binaries (.deb + .rpm × arm64/x64), and 2 `latest-mac-*.json` update feeds. All four anchor entries (`@sentry/electron@7.13.0`, `react@19.2.5`, `lucide-react@1.8.0`, `sonner@2.0.7`) confirmed present in the published file. Tag + release deleted via `gh release delete --cleanup-tag`. (`@sentry/electron@7.13.0` matches the post-W1 catalog state — useful end-to-end sanity that W1 + W5 compose correctly.)
>
> Worktree at `.claude/worktrees/feat-desktop-dev-test-tooling` removed; remote `feat/desktop-dev-test-tooling` auto-deleted by GitHub on merge; local branches `feat/desktop-dev-test-tooling` and the throwaway `chore/desktop-ci-e2e-failure-verify` also deleted. Plan + Improvement Log live at `thoughts/shared/plans/2026-05-06-desktop-w5-dev-test-tooling.md` (still untracked in primary checkout).

**Why now:** Pure-additive, isolated to `apps/desktop/scripts/` and `apps/desktop/test/e2e/`. No runtime code touched. Pays back the next time we hit a renderer regression that vitest can't catch.

**Scope:**
- `apps/desktop/scripts/playwright-electron-cdp.mjs` — Codex-pattern CDP harness
- `apps/desktop/scripts/devtools-reset.mjs` — clears extensions + Service Worker + Code Cache from userData
- `apps/desktop/scripts/generate-third-party-notices.mjs` — pnpm-aware license aggregator
- `apps/desktop/scripts/metadata-probe.mjs` — reads `buildFlavor`/`buildNumber`/`signingMode` for CI gating
- `apps/desktop/test/e2e/` — minimal Playwright fixture covering "boot → primary window paints → quit"
- `apps/desktop/package.json` scripts: `test:e2e`, `devtools:reset`, `notices:generate`, `metadata-probe`
- devDeps: `@playwright/test`, `playwright`, `license-checker-rseidelsohn` (or equivalent)
- `apps/desktop/.gitignore`: ignore `THIRD_PARTY_NOTICES.txt`-generated outputs if checked-in policy is "regenerate at release"

**Files touched:**
```
apps/desktop/scripts/{playwright-electron-cdp,devtools-reset,generate-third-party-notices,metadata-probe}.mjs  (all new)
apps/desktop/test/e2e/                                       (new)
apps/desktop/package.json                                    (scripts + devDeps)
apps/desktop/.gitignore                                      (notices output)
pnpm-lock.yaml                                               (regen)
```

**Conflict surface vs W1:** narrow — both touch `apps/desktop/package.json`; W1 touches `dependencies`+sentry version, W5 touches `devDependencies`+`scripts`. Different keys; trivial three-way merge.
**Conflict surface vs W3:** narrow — same as above; W3 touches makers in devDeps, W5 touches Playwright in devDeps. Different blocks of devDeps; trivial merge.

**Verifiable:** `pnpm test:e2e` runs to green; `pnpm devtools:reset` clears the userData subdirs; `pnpm notices:generate` produces a deterministic `THIRD_PARTY_NOTICES.txt`.

---

### Tier 2 — single worktrees, run after Tier 1 (or in parallel if reviewers can absorb)

#### W2 — SQLite persistence + native-rebuild infra

**Gates:** wants W5's `metadata-probe` script for native-build CI gating; otherwise standalone. Best landed second.

**Scope:**
- Add `better-sqlite3` to `dependencies` (or eval `node:sqlite` if Node 22 native binding is sufficient)
- Add `apps/desktop/scripts/rebuild-sqlite.mjs` — Codex-pattern targeted rebuild against the pinned Electron ABI
- `forge.config.ts:86` `rebuildConfig: {}` → populated config
- `apps/desktop/src/main/db/` (new) — initial wrapper with filename-versioned schema (e.g., `app.db_v1`), pragma-pin, exclusive-mode connection
- Migrate `settings-store.ts` to SQLite-backed (or maintain dual-write during transition; recommend single switchover with one-time JSON-to-SQLite import on next boot)
- `package.json` scripts: `rebuild:sqlite`, possibly `rebuild` umbrella
- `pnpm-workspace.yaml` `onlyBuiltDependencies`: add `better-sqlite3` (mirror existing `@sentry/cli` entry)

**Files touched:**
```
apps/desktop/src/main/db/                                    (new module tree)
apps/desktop/src/main/settings-store.ts                      (refactor; back-compat import)
apps/desktop/forge.config.ts:86                              (rebuildConfig)
apps/desktop/scripts/rebuild-sqlite.mjs                      (new)
apps/desktop/package.json                                    (deps + scripts)
pnpm-workspace.yaml                                          (onlyBuiltDependencies)
pnpm-lock.yaml                                               (regen)
```

**Conflict surface vs W3:** narrow `forge.config.ts`. W3 touches makers, W2 touches `rebuildConfig: {}`; different blocks. Trivial merge.

**Verifiable:** `settings.json` content survives migration; native rebuild step lights up in CI.

---

#### W4 — Per-surface preload isolation scaffolding — **LANDED 2026-05-07**

> **Status:** landed via PR #658 (one shot, admin-merged after all 16 CI checks green; branch protection wanted a human review approval and the change was self-reviewed). Splits `apps/desktop/src/preload/preload.ts` into a flat `build-bridge.ts` + three per-kind entries (`primary.ts`, `settings.ts`, `hud.ts`); `forge.config.ts` declares three preload `build[]` entries against a single shared `vite.preload.config.ts`; `factory.ts` resolves the right bundle per `WindowKind` via a `preloadFileFor()` switch and the legacy `--window-kind=` argv flag is removed. Surface scope unchanged — every kind exposes the identical 15-key `LightfastBridge`. Three Vite warnings (`inlineDynamicImports option is deprecated, please use codeSplitting: false instead`) appear during `electron-forge package` — upstream `electron-forge`/`plugin-vite` issue, not in our config. CI: Desktop CI mac+ubuntu, Build, Test, Quality (×2), Typecheck, CodeQL, Vercel ×3 all green; CodeRabbit review clean apart from one ⚠️ Docstring Coverage 0.00% pre-merge warning intentionally unaddressed (project style is no docstrings unless WHY is non-obvious — same convention the legacy `preload.ts` and surrounding `apps/desktop/src/` followed). Worktree at `worktrees/desktop-W4-preload-isolation` removed; remote `feat/desktop-preload-isolation` deleted on merge.
>
> Four scope deltas vs original W4 plan: (1) the `_shared/` subfolder was dropped — shared bridge module landed flat at `apps/desktop/src/preload/build-bridge.ts`. With one shared file, a subfolder added depth without payoff and would have introduced a new repo convention with no precedent in `apps/desktop/src/`. (2) New `apps/desktop/src/shared/window-globals.ts` lifts `BRIDGE_GLOBAL` ("lightfastBridge") and `WINDOW_KIND_GLOBAL` ("codexWindowType") into typed `as const` exports — preload writes through them, renderer (`main.ts`, `entry.tsx`) reads through them. Same single-source-of-truth spirit as `IpcChannels` in `src/shared/ipc.ts`; not in original plan, added during `/improve_plan` review. (3) `vite.preload.config.ts` collapsed to a 13-line shared form with no `lib` block — spike confirmed `plugin-vite`'s preload framework config sets `build.rollupOptions.input` from each forge `build[].entry` directly and emits via `output.entryFileNames: '[name].js'`, so per-kind config wrappers and a factory function (which the original plan considered) are unnecessary. (4) The `additionalArguments: --window-kind=<kind>` argv injection was removed entirely; each preload encodes its kind at compile time via `exposePreload(kind)`, eliminating the only `process.argv` consumer in the preload tree.
>
> **Verification (post-merge state mirrored from PR #658 test plan):** `pnpm typecheck` 52/52, `pnpm check` 1104 files clean, `pnpm --filter @lightfast/desktop test` 45/45, packaged build emits `bootstrap.js` + `primary.js` + `settings.js` + `hud.js` (no `preload.js`); each preload bundle ends with its own kind-tagged ``exposePreload(`<kind>`)`` invocation, sizes 2885–2895 bytes (within ~0.3%). Dev three-window CDP smoke (Playwright Electron CDP via the W5 harness preview): each window reports 15-key bridge, matching alphabetical key set, correct `codexWindowType`, correct `dataset.windowKind`, correct kind-branched React mount (primary → AppShell + UserMenu, settings → SettingsWindow only, HUD → AppShell with HUD-visible content CSS-gated by `data-kind-hud` selectors, preserved origin/main behavior). Packaged-mode sanity: `Lightfast.app` from `out/Lightfast-darwin-arm64/` launched via `with-desktop-env.mjs`, full Electron process tree stable (main + GPU + network + renderer), primary window mounted, `Cmd-,` triggered `preloadFileFor("settings")` resolving `settings.js` from the asar and a settings window mounted at 720×640. Renderer-internals smoke against the packaged build was not exercised because packaged builds gate `LIGHTFAST_REMOTE_DEBUG_PORT` behind `!app.isPackaged` (`bootstrap.ts:17`) — full packaged-mode automation graduates with W5's Playwright Electron CDP harness.

**Gates (historical, pre-land):** wanted a real second-surface consumer to justify the split. Could be triggered by:
- Adding an in-app browser/web-view surface
- Adding a third-party plugin host
- Trust boundary for the HUD window

If no consumer is pending, this group was a slot-holder; the merge cost of doing it later was identical to doing it now. Decided to claim the slot ahead of any consumer to remove a future-friction point and keep `forge.config.ts` / `vite.preload.config.ts` from churning twice.

**Scope:**
- Split `src/preload/preload.ts` into per-window-kind preloads (`primary.ts`, `settings.ts`, `hud.ts`)
- Lift shared bridge code into `src/preload/_shared/`
- `vite.preload.config.ts` → multi-entry build config
- `forge.config.ts` `VitePlugin.build` array → multiple preload entries
- `src/main/windows/factory.ts` → kind-resolved `webPreferences.preload` path

**Files touched:**
```
apps/desktop/src/preload/{primary,settings,hud}.ts           (new; split from preload.ts)
apps/desktop/src/preload/_shared/                            (new)
apps/desktop/vite.preload.config.ts                          (multi-entry)
apps/desktop/forge.config.ts                                 (plugins.VitePlugin.build)
apps/desktop/src/main/windows/factory.ts                     (per-kind preload)
```

**Conflict surface vs W3:** as noted — narrow `forge.config.ts`. Land W3 before W4 to minimize.
**Conflict surface vs W6 (notifications):** notifications add an IPC channel that all preloads need to expose. If W4 lands first, W6 just adds the channel to each new preload; if W6 lands first, W4 carries the IPC across the split.

---

### Tier 3 — product- or release-gated, defer until a consumer arrives

#### W6 — Notifications + dock badge

**Gate:** product UX decision on what events warrant a notification vs an in-app toast. Today there's a `sonner` toaster wired in renderer (`apps/desktop/package.json:62`), so the answer "system notifications for X events, in-app for Y" needs a product call.

**Sketch scope:**
- `src/main/notifications.ts` — `Notification` API wrapper with permission-elision (Electron auto-grants on macOS, asks once on Win)
- `src/main/dock-badge.ts` — `app.dock.setBadge(count)` wrapper; macOS only
- `src/shared/ipc.ts` — `IpcChannels.{showNotification,setBadge}`
- `src/preload/preload.ts` (or per-kind preloads if W4 first) — channel exposure
- Optional `build/notification.wav` asset

#### W7 — Worker / utilityProcess tier

**Gate:** workload demand. No current consumer needs this. Sketch only — `vite.worker.config.ts`, `src/main/worker/example.ts`, `forge.config.ts` worker entry.

#### W8 — i18n (menu + renderer)

**Gate:** product decision on supported locales and renderer i18n framework. Sketch only — `src/main/locales/{de,fr,pt,ja,zh}.json`, renderer `react-intl` or `lingui` wrap.

> Sparkle-native + Ed25519 auto-update is **FULL DEFER** (parent doc §1) — depends on signed mac builds. Out of scope for this doc.

---

## Tier 1 Suggested Worktree Layout

```
~/Code/@lightfastai/
  lightfast/                         (main worktree, current branch)
  worktrees/
    desktop-W1-observability-tier-2/ (branch: feat/desktop-observability-tier2)
    desktop-W3-linux-makers/         (branch: feat/desktop-linux-makers)
    desktop-W5-dev-test-tooling/     (branch: feat/desktop-dev-test-tooling)
```

Created via:
```bash
git worktree add -b feat/desktop-observability-tier2  ../worktrees/desktop-W1-observability-tier-2  main
git worktree add -b feat/desktop-linux-makers          ../worktrees/desktop-W3-linux-makers          main
git worktree add -b feat/desktop-dev-test-tooling      ../worktrees/desktop-W5-dev-test-tooling      main
```

Each worktree gets one TaskCreate-style scope hand-off (the W# section of this doc is verbatim usable as the implementer brief). Conflict resolution at merge:

| pair | overlap | resolution |
|---|---|---|
| W1 ↔ W3 | none | clean |
| W1 ↔ W5 | `apps/desktop/package.json` (deps vs devDeps blocks) | trivial 3-way |
| W3 ↔ W5 | `apps/desktop/package.json` (devDeps blocks) | trivial 3-way |
| W1 ↔ W3 ↔ W5 | `pnpm-lock.yaml` | regen on final merge |

## Code References

- `apps/desktop/src/main/updater.ts:1,87-89` — Electron built-in updater + ad-hoc kill-switch
- `apps/desktop/src/main/sentry.ts` — Sentry init, currently single SDK in main with renderer bridge
- `apps/desktop/src/main/protocol.ts:30-68` — reintroduced PKCE deep-link surface (PR #627)
- `apps/desktop/forge.config.ts:14-49` — osxSign developer-id/ad-hoc branch
- `apps/desktop/forge.config.ts:86` — `rebuildConfig: {}` (empty; W2 target)
- `apps/desktop/forge.config.ts:88-97` — makers array (3 entries; W3 target)
- `apps/desktop/forge.config.ts:133-138` — CFBundleURLTypes (lightfast scheme)
- `apps/desktop/forge.config.ts:155-174` — VitePlugin entries (one preload, one renderer; W4 target)
- `apps/desktop/package.json:50` — `@sentry/electron` ^7.11.0 (W1 bump target)
- `apps/desktop/package.json:67-68` — empty `sparkleFeedUrl` placeholder + `signingMode: "ad-hoc"`
- `apps/desktop/scripts/` — only `generate-update-feed.mjs`, `upload-sourcemaps.mjs` (W5 target dir)
- `apps/desktop/src/main/locales/en.json` — only locale (29 keys; W8 target)
- `apps/desktop/src/preload/preload.ts` — single preload (W4 split target)
- `pnpm-workspace.yaml:82` — `@sentry/cli` in `onlyBuiltDependencies` (W2 will mirror for `better-sqlite3`)

## Architecture Documentation

The deferred items split along two orthogonal axes:

**Axis 1 — runtime tier:**
- *Boot & shell:* deep-link, single-instance, fuses, plists, entitlements (all done)
- *Persistence:* settings, window-state, auth (flat-JSON; W2 escalates to SQLite)
- *Observability:* Sentry main + renderer bridge (W1 adds file-log floor + vendor wrap)
- *Heavy work:* worker tier (W7 future)

**Axis 2 — distribution surface:**
- *Build & sign:* osxSign + notarize + hardenedRuntime (done; Apple-coupled rows tracked separately as FULL DEFER); Linux deb/rpm makers (W3)
- *Updater:* Electron Squirrel.Mac wired (ad-hoc gated). Sparkle-native + Ed25519 is **FULL DEFER** (parent §1).
- *Tooling:* CI matrix, scripts, test (W3 + W5)

Tier 1 (W1, W3, W5) advances the runtime-tier *floor* (observability), distribution *breadth* (multi-OS), and tooling *coverage* (testing) without changing the product surface area. Tier 2 (W2, W4) escalates persistence and trust isolation; Tier 3 is product-decision gated.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` — parent doc; identifies all 15 gap areas
- `thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md` — pre-dry-run verification, superseded by dry-run report
- `thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md` — rc.1 → rc.4 final report; documents the 7 surfaced bugs (G-8 → G-14)
- `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md` — Phases 1-4 (entitlements, plist, Sentry tags, dead-code) — landed
- `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` — Phases A-F — landed via PR #621
- `thoughts/shared/plans/2026-05-06-desktop-rc1-ad-hoc-dry-run.md` — Phases 1-3 — landed via PRs #638-#643
- `thoughts/shared/research/2026-05-05-desktop-prod-readiness.md` — earlier readiness pass

## Related Research

- `thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md` — recently-fixed Portless TLS exchange (PR #646)
- `thoughts/shared/research/2026-04-25-desktop-signin-agent-browser-workaround.md` — sign-in workaround context

## Open Questions

1. **W6 product decision** — what desktop-app event types warrant a system notification vs a `sonner` in-app toast? (Blocks W6 specification.)
2. **W8 i18n policy** — policy on supported locales for v1.x; renderer framework choice (react-intl vs lingui vs none). (Blocks W8 specification.)
3. **Cohort B small follow-ups** — bundle the four small items (Sentry bump, vendor renderer wrap, doc §10 fix, comment cleanup) into W1, or split into a separate "tidy" worktree? Recommendation: bundle into W1 since the vendor-wrap and bump are load-bearing for the file-logger commit.
4. **W2 settings migration policy** — when migrating `settings.json` → SQLite-backed store, do we ship a one-shot migrator or maintain dual-write through one minor release? (One-shot is simpler; dual-write reduces user data risk.)
5. **Windows distribution timing** — Windows MSIX is excluded from W3 (separate external-blocker track). When that work is in scope, does it require a Windows EV cert chain analogous to Apple's, or is unsigned Windows acceptable for early cuts? (Decision deferred until Apple unblocks and the platform priorities reshape.)

## Recommendation for "What to Run Next"

> **Update 2026-05-07:** Tier 1 (W1, W3, W5) is fully landed. The recommendation below is preserved as the original sequencing argument; for current sequencing, see the per-section **LANDED** banners on W1, W3, and W5. **W2 is now unblocked** — `apps/desktop/scripts/metadata-probe.mjs` ships on main as of W5, satisfying W2's only declared gate.

If parallelism budget is three worktrees:
- **W1** (Observability tier 2 + small follow-ups bundled) — biggest information-yield delta
- **W3** (Linux makers + CI matrix) — biggest distribution delta available without Apple; isolated from W1
- **W5** (Dev/test tooling) — biggest future-debugging delta; isolated from both

If parallelism budget is one worktree: **W1** first. The file-logger lifts the floor that everything else stands on, and the Sentry vendor wrap + bump are the cheapest remaining cohort-B follow-ups in the dry-run report.

If a fourth slot opens up: **W2** after W5 (W2 wants W5's `metadata-probe` for native-build CI gating).
