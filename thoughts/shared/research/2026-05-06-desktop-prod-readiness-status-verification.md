---
date: 2026-05-06T12:43:35+10:00
researcher: claude
git_commit: ab634170e1eafdbb4e89fbd2255819cbe53178e3
branch: main
topic: "apps/desktop production-readiness: verification of Codex-gap Status Tracker"
tags: [research, desktop, electron, production, codex-gap-verification, sparkle, signing, sentry, ci]
status: superseded-by-dry-run-2026-05-06
superseded_by: thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md
last_updated: 2026-05-06
based_on:
  - thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
  - thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md
  - thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md
---

# Research: `apps/desktop` Production-Readiness — Status Tracker Verification

**Date**: 2026-05-06T12:43:35+10:00
**Git Commit**: ab634170e1eafdbb4e89fbd2255819cbe53178e3
**Branch**: main

## Research Question

For the Status Tracker in `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`, double-check item-by-item what was actually done vs not done — to figure out what still blocks a production release of `apps/desktop`.

## Summary

Every "DONE" / "DROPPED" claim in the Status Tracker is verified true in the current tree. The two items marked **IN PROGRESS** at the time of writing (sourcemap upload, multi-arch CI, version/feed/buildNumber stamping) all landed via PR #621 (merge `aef1d3240`, 2026-04-24) and are now in `main`. The release pipeline (`.github/workflows/desktop-release.yml`) is fully wired but **inert** — it activates on the first `@lightfast/desktop@*` git tag.

After PR #621 landed, an additional `unsigned-beta-distribution` track shipped (PR #637, merged 2026-05-06): a `signingMode: "ad-hoc" | "developer-id"` enum was threaded through `package.json` → schema → build-info → forge config → updater → Sentry, so the workflow can ship an ad-hoc-signed `.dmg` while Apple Developer enrollment is in flight. The auto-updater is **deliberately disabled** when `signingMode === "ad-hoc"` (`apps/desktop/src/main/updater.ts:87-89`) because Squirrel.Mac requires the new build to satisfy the running app's Designated Requirement, and ad-hoc DRs are content-bound.

What remains to ship the first signed v0.1.0:
1. **Phase A (external setup)** — 8 Apple secrets + 2 Sentry secrets + 2 Sentry vars not yet provisioned in repo settings. Until they are, the workflow runs in ad-hoc mode (no notarization, no auto-update).
2. **Two carry-over items inside the codesign config** — see §Gaps/Risks below.
3. **Branch protection** for `Desktop CI / Typecheck + package (unsigned)`.
4. **First end-to-end dry run** — cut `@lightfast/desktop@0.1.0-rc.1` and verify codesign / notarize / attestation / Sparkle JSON feed end-to-end.

Everything else in the Status Tracker that was marked DEFERRED or RELEASE remains intentionally out of scope for v0.1.0.

> **Update 2026-05-06 (post-dry-run).** This document is **superseded** by the rc.1 → rc.4 dry-run, captured at [`thoughts/shared/2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md`](../2026-05-06-desktop-rc1-ad-hoc-dry-run-report.md). Of the seven gaps listed in §"Gaps / Risks Still Blocking Prod" below: **G-2** (osxSign kebab-case) closed by PR #638; **G-3** (inherit plist `disable-library-validation`) closed by PR #638; **G-5** (first-release dry run) closed by rc.4 cut at `ac986f9a9` (workflow run [`25423025160`](https://github.com/lightfastai/lightfast/actions/runs/25423025160)); **G-7** (deep-link audit) closed in dry-run plan Phase 1. **G-1** is now Apple-half only — Sentry secrets fully provisioned. **G-4** and **G-6** unchanged. Seven additional gates surfaced and closed during the dry-run (PRs #639–#643); the gap research at [`2026-04-23-codex-vs-lightfast-desktop-production-gap.md`](2026-04-23-codex-vs-lightfast-desktop-production-gap.md) §"Status Update 2026-05-06 (post-dry-run)" enumerates them as G-8…G-14. The §"Open Questions" at the bottom of this doc are also resolved by the dry-run except for the Sparkle public-key follow-up.

## Verification Method

For each row in the Status Tracker:
1. Read the current file the original finding cited.
2. If the finding said something was added/removed/renamed, confirm presence/absence by direct file read or `grep`.
3. Cross-reference against the PR #621 plan (`thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`) which records what shipped per phase.
4. Note any state that has changed since the PR #621 merge (PRs #630, #637, and the unsigned-beta-distribution work).

## Item-by-Item Verification

Legend: ✅ verified done · ❎ verified not done (intentional) · ⚠️ residual gap · ➕ new since original tracker

### §1 — Auto-update: Sparkle + Ed25519

| Original status | Verification |
|---|---|
| RELEASE (deferred past v0.1.0) | ❎ Unchanged. `apps/desktop/src/main/updater.ts:1-130` still uses Electron's built-in `autoUpdater` (Squirrel.Mac under the hood). No `sparkle.node` native addon, no Ed25519 signature path, no Windows MSIX backend. Single `setFeedURL({url})` with `${arch}` template (`updater.ts:28-30`). |
| ➕ New: ad-hoc signing kill-switch | `updater.ts:87-89` — when `build.signingMode === "ad-hoc"`, `initUpdater()` returns early. Documented inline: ad-hoc DRs are content-bound, so swap-in always fails. Beta users reinstall manually. |

### §2 — Logging, Sentry, source maps, crash reporter

| Original status | Verification |
|---|---|
| **On-disk logging** — DEFERRED | ❎ Unchanged. No file logger anywhere in `apps/desktop/src/main/`. `index.ts:170-173` still `console.error`s renderer errors. |
| **Sentry tags + RewriteFrames** — DONE | ✅ Verified at `apps/desktop/src/main/sentry.ts:14-57`. Module-scoped `SESSION_ID = randomUUID()`, `rewriteFramesIntegration({ root: app.getAppPath(), prefix: "app:///" })`, `dist: build.buildNumber`, tags `sessionId / bundle / host / signingMode`. The `signingMode` tag is new since the original tracker (added with the ad-hoc-signing work). |
| **Source-map upload** — was IN PROGRESS | ✅ **NOW DONE.** `apps/desktop/scripts/upload-sourcemaps.mjs` exists (63 lines). `pnpm sourcemaps:upload` script in `package.json:13`. `@sentry/cli ^2.39.1` in devDependencies (`package.json:31`). Uploads both `.vite/build` and `.vite/renderer/main_window` with `--url-prefix "app:///"` matching `rewriteFramesIntegration`. Called from `desktop-release.yml:162-164`. Workflow inert until Sentry secrets land. |
| **Crash reporter** — DEFERRED | ❎ Unchanged. No explicit `crashReporter.start()`. `@sentry/electron`'s built-in Crashpad integration is what runs. |

### §3 — Persistent SQLite storage

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Unchanged. Three flat-file stores still: `settings.json` (zod-validated), `window-state.json` (debounced), `auth.bin` (safeStorage). No SQLite, no migration framework. |

### §4 — Worker / utility process tier

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Unchanged. No `Worker` / `utilityProcess` / `child_process.spawn` anywhere in `apps/desktop/src/main/`. |

### §5 — Windows MSIX + Linux makers

| Original status | Verification |
|---|---|
| RELEASE | ❎ Unchanged. `forge.config.ts:96-103` declares only `MakerSquirrel` (win32, dormant), `MakerZIP` + `MakerDMG` (darwin). No `maker-deb`, `maker-rpm`, `maker-msix`. |

### §6 — Multi-arch + universal binary

| Original status | Verification |
|---|---|
| **Multi-arch arm64+x64** — was IN PROGRESS | ✅ **NOW DONE.** `desktop-release.yml:79-82`: `strategy.matrix.arch: [arm64, x64]`, `fail-fast: false`. Each arch runs `pnpm exec electron-forge publish --arch=${matrix.arch} --platform=darwin` on `macos-14`. |
| **Universal binary** — DEFERRED | ❎ Unchanged. No `@electron/universal`. Two separate per-arch artifacts. |

### §7 — Per-surface preload isolation

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Unchanged. Single `src/preload/preload.ts`. `forge.config.ts:115-118` has one preload entry. |

### §8 — Menu + renderer i18n

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Unchanged. Only `src/main/locales/en.json`. No renderer i18n framework. |

### §9 — Dev/test tooling

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Mostly unchanged: still no Playwright harness, `devtools:reset`, third-party-notices generator, native-rebuild scripts. |
| ➕ Sentry CLI now wired | `@sentry/cli` is now both a devDep (`package.json:31`) and consumed by `scripts/upload-sourcemaps.mjs` + `desktop-release.yml`. |
| ➕ `clean` script added | `package.json:8` — `rm -rf out .vite .cache`. |

### §10 — Deep-link routing

| Original status | Verification |
|---|---|
| DEFERRED | ❎ The deep-link surface is **gone entirely**, not deferred. `src/main/protocol.ts` deleted (confirmed: not in `apps/desktop/src/main/` listing). `index.ts` has no `onDeepLink` handler. `CFBundleURLTypes` not in `forge.config.ts:81-92` extendInfo. OAuth now uses a loopback HTTP server inside `auth-flow.ts` instead. |
| ➕ New custom URL scheme work | Commit `b30d99975` added a custom-URL-scheme + PKCE sign-in flow track. Worth re-checking whether this re-introduces a deep-link consumer; `grep` finds no `setAsDefaultProtocolClient` in `apps/desktop/src/main/` today. |

### §11 — Entitlements diet

| Original status | Verification |
|---|---|
| **Main plist trim** — DONE | ✅ Verified `apps/desktop/build/entitlements.mac.plist` has 5 keys: `allow-jit`, `allow-unsigned-executable-memory`, `device.audio-input`, `network.client`, `files.user-selected.read-write`. The three flagged keys (`disable-library-validation`, `device.camera`, `network.server`) are gone. `NSCameraUsageDescription` is gone from `forge.config.ts` extendInfo (only `NSMicrophoneUsageDescription` + `NSAudioCaptureUsageDescription` remain, `forge.config.ts:88-91`). |
| **Inherit plist** — not addressed by original quick-wins plan | ⚠️ **Residual gap.** `apps/desktop/build/entitlements.mac.inherit.plist` (used by helper bundles via `entitlements-inherit` in `forge.config.ts:29-32`) still carries `com.apple.security.cs.disable-library-validation` (line 9-10). Codex carries this in neither its main nor its helper entitlements. The original tracker said "both apps use identical entitlements across all four helpers" — that statement was about parity, not about whether this key is needed; the inherit plist was simply not touched by the quick-wins phase. Decide whether to drop it from inherit too. |

### §12 — Info.plist hygiene

| Original status | Verification |
|---|---|
| **NSQuitAlwaysKeepsWindows / LSMinimumSystemVersion / MallocNanoZone** — DONE | ✅ Verified `forge.config.ts:81-92` extendInfo: `LSMinimumSystemVersion: "12.0"`, `NSQuitAlwaysKeepsWindows: false`, `LSEnvironment: { MallocNanoZone: "0" }`. Plus `LSApplicationCategoryType`, `NSHighResolutionCapable: true`, `NSSupportsAutomaticGraphicsSwitching: true`, microphone + audio capture usage descriptions. |
| **NSAppTransportSecurity / CFBundleDocumentTypes / SUPublicEDKey / ElectronAsarIntegrity / NSPrincipalClass** — DEFERRED/RELEASE/auto | ❎ Unchanged. Not applicable, release-only, or auto-set by Forge. |

### §13 — Build metadata placeholders

| Original status | Verification |
|---|---|
| **Non-empty `version` / `buildNumber` / `sparkleFeedUrl`** — was IN PROGRESS | ✅ **NOW WIRED.** `package.json:3,69-71` deliberately retains placeholder values (`version: "0.0.0"`, `buildFlavor: "dev"`, `buildNumber: "1"`, `sparkleFeedUrl: ""`) because `desktop-release.yml:113-129` stamps them at build time via `npm pkg set` — the workflow source of truth, not the file. Stamping inert until first tag push. |
| **`sparklePublicKey`** — DROPPED | ✅ Verified absent from `package.json`, `src/env/main.ts`, `src/main/build-info.ts`, `src/shared/ipc.ts` (`BuildInfoSnapshot`). Cross-checked via `grep -rn "sparklePublicKey"` — no matches. |
| ➕ **`signingMode`** field added | New `signingMode: "ad-hoc"` placeholder in `package.json:72`. Schema in `src/shared/build-info-schema.ts:6-7,15`. CI flips it to `developer-id` when `APPLE_SIGNING_IDENTITY` is present (`desktop-release.yml:120-124`). Threaded into Sentry tags + updater gate. |
| ➕ **`sentryDsn` baking** | Resolved differently than the original plan suggested (`npm pkg set`). Now baked at Vite-define time via custom token `__SENTRY_DSN__` (`vite.main.config.ts:5`), consumed in `src/env/main.ts:4-32`. Sentry's official guidance is to avoid `process.env.*` replacement in Vite define — custom token avoids the conflict. |

### §14 — Dead / unwired IPC + features

| Original status | Verification |
|---|---|
| **`showContextMenu` IPC** — DONE | ✅ Verified absent from `src/shared/ipc.ts:5-27` — no such channel name. `grep` shows zero matches across `apps/desktop/src/`. |
| **`silentRefresh`** — DONE | ✅ Verified absent from `src/main/auth-flow.ts` (whole file is the loopback HTTP server rewrite, 135 lines, no `silentRefresh` / `REFRESH_TIMEOUT_MS`). |
| **Deep-link `console.log`** — DONE | ✅ Verified absent. `src/main/index.ts` has no `onDeepLink` handler at all (search `app.on("open-url"` etc. — none). |

### §15 — Notifications / dock badge / sound

| Original status | Verification |
|---|---|
| DEFERRED | ❎ Unchanged. No `Notification` usage, no `setBadgeCount`, no sound assets in `src/main/assets/`. |

## What's New Since the Original Tracker

The Status Tracker was last updated 2026-04-24. Between then and now (2026-05-06), three substantive bodies of work landed on `main` that intersect with prod-readiness:

### N-1. Pre-release batch (PR #621, merge `aef1d3240`, 2026-04-24)

Phases B–F of `2026-04-23-desktop-pre-release-batch.md`. Closed every IN PROGRESS row in §2/§6/§13 plus the contributor-ergonomics items.

Concrete artifacts on disk:
- `apps/desktop/src/env/main.ts` + `apps/desktop/src/env/renderer.ts` — t3-env layers, build-fail-fast (replaced silent-fail `parseRuntimeEnv`)
- `apps/desktop/scripts/upload-sourcemaps.mjs` — `sentry-cli` driver
- `apps/desktop/.env.example` — 21-line template (Sentry, Sparkle, app-origin, debug port, validation skip)
- `.github/workflows/desktop-release.yml` — renamed from `.disabled`, tag trigger `@lightfast/desktop@*`
- `.github/workflows/desktop-ci.yml` — typecheck + unsigned `electron-forge package` on `macos-14`, paths-filtered
- `.changeset/config.json:10` — `"ignore": ["@lightfast/desktop"]`
- `package.json:8` — `clean` script (`rm -rf out .vite .cache`)
- Removal of `LIGHTFAST_DESKTOP_RELEASE_REPO` indirection — `forge.config.ts:62-68` now hardcodes `repository: { owner: "lightfastai", name: "lightfast" }`

PR notes (`shipped_pr: https://github.com/lightfastai/lightfast/pull/621`): "15/15 checks passed, including CodeQL + CodeRabbit review."

### N-2. Unsigned beta distribution (PR #637, merge `ab634170e`, 2026-05-06)

Reframes "first release" so we can ship before Apple enrollment completes. Adds the `signingMode` enum and threads it everywhere. Recent commits on `main`:

- `5080d508a` feat(desktop): ad-hoc signing fallback + signingMode threading
- `f4bc6e522` feat(desktop): gate updater on ad-hoc signingMode + Sentry tag
- `583ca03b0` ci(desktop-release): gate Apple steps + auto-derive prerelease
- `dcb61c858` docs(desktop): unsigned beta install instructions + plan/research/handoff

Effects:
- `forge.config.ts:14-49` has two-branch `osxSign`: full developer-id config when `APPLE_SIGNING_IDENTITY + APPLE_TEAM_ID` are set, else ad-hoc fallback (`identity: "-"`, `identityValidation: false`, `optionsForFile: () => ({ hardenedRuntime: false })`, `preAutoEntitlements: false`).
- `desktop-release.yml:120-124` flips `signingMode` based on whether `APPLE_SIGNING_IDENTITY` exists.
- `desktop-release.yml:32-40` auto-derives `prerelease=true` from any hyphen-suffix in the tag (`-rc.N`, `-beta.N`, `-alpha.N`).
- `apps/desktop/README.md:5-30` documents the "App cannot verify" first-launch dialog and the "Open Anyway" path for beta users.
- `updater.ts:87-89` — disable updater entirely when `signingMode === "ad-hoc"` so a content-bound DR can't break swap-in.

### N-3. Floating settings panel + custom URL scheme work (mid-flight)

Merge commits visible in `git log`: `2565270fa` (settings panel), `b30d99975` (custom URL scheme + PKCE). Not part of the Codex-gap tracker but touches surface area the tracker covered. The new "custom URL scheme" path is worth re-auditing — original §10 noted protocol.ts was deleted; need to confirm the new scheme work doesn't reintroduce an unwired deep-link handler in main.

## Gaps / Risks Still Blocking Prod

These are the items I would flag before cutting `@lightfast/desktop@0.1.0-rc.1`:

### G-1. Apple Developer enrollment + Sentry secrets (Phase A)

**Severity**: Hard blocker for signed release; soft blocker for any release (workflow runs in ad-hoc mode without secrets, which we now support).

Repo settings → Secrets and variables → Actions needs:
- 8 Apple secrets: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_CERT_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`, `KEYCHAIN_PASSWORD`
- 2 Sentry secrets: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- 2 Sentry vars: `SENTRY_ORG`, `SENTRY_PROJECT`

Status: not yet provisioned (per `pre-release-batch.md` "Left for a human" section).

### G-2. `osxSign` kebab-case keys silently dropped by `@electron/osx-sign@1.3.3`

**Severity**: Will fail signed-build path on first Apple-secrets exercise.

`apps/desktop/forge.config.ts:14-49` has an in-source TODO:
> kebab-case keys below are silently dropped by @electron/osx-sign@1.3.3 (camelCase only). Notarization will fail when secrets land. Rename to camelCase + move per-file ones into `optionsForFile` before exercising the dev-id path.

Affected keys: `"hardened-runtime"`, `"gatekeeper-assess"`, `"entitlements-inherit"`, `"signature-flags"`. Need to become `hardenedRuntime`, `gatekeeperAssess`, etc., and per-file ones into `optionsForFile`.

### G-3. `entitlements.mac.inherit.plist` still has `disable-library-validation`

**Severity**: Inconsistency with the main-plist trim; not strictly a blocker.

Main plist was trimmed; helper-process inherit plist was not. Codex carries `disable-library-validation` in neither. Decide whether to drop from inherit too — if any helper bundle (GPU/Renderer/Plugin) needs unsigned dylib loading, keep it; if not, remove for surface-area parity with Codex.

### G-4. Branch protection for `Desktop CI`

**Severity**: Soft — typecheck + unsigned package run today on every desktop PR but aren't a required check.

Repo Settings → Branches → main → required status checks: add `Desktop CI / Typecheck + package (unsigned)`. Not automatable from code (UI only).

### G-5. First-release dry run

**Severity**: Process gate.

After G-1 + G-2 land, cut `@lightfast/desktop@0.1.0-rc.1` and verify: codesign, notarize, attestation (`actions/attest-build-provenance@v2`), Sparkle JSON feed (`latest-mac-{arm64,x64}.json`), and Sentry release (sourcemaps queryable via `sentry-cli releases info`).

### G-6. Auto-updater is disabled for ad-hoc builds

**Severity**: By design. Beta users reinstall manually until G-1 + G-2 unblock the signed path.

`apps/desktop/src/main/updater.ts:87-89` returns early when `signingMode === "ad-hoc"`. Documented in `README.md:24-29`. This is the intentional consequence of N-2.

### G-7. Verify §10 deep-link removal still holds after N-3

**Severity**: Low — likely fine but should be checked.

Commit `b30d99975` added a custom URL scheme + PKCE flow. `grep` for `setAsDefaultProtocolClient` in `apps/desktop/src/main/` returns nothing today, so the scheme is registered elsewhere or removed. Worth a 5-minute re-audit to confirm there isn't a partially-wired deep-link handler.

## Code References

- `apps/desktop/forge.config.ts:14-49` — two-branch osxSign (developer-id / ad-hoc fallback) + the kebab-case TODO
- `apps/desktop/forge.config.ts:81-92` — extendInfo (Info.plist hygiene)
- `apps/desktop/forge.config.ts:127-135` — FusesPlugin V1 (six fuses unchanged)
- `apps/desktop/build/entitlements.mac.plist` — 5-key trimmed main plist
- `apps/desktop/build/entitlements.mac.inherit.plist:9-10` — inherit plist still has `disable-library-validation`
- `apps/desktop/package.json:7-15` — scripts (`dev`, `package`, `make`, `publish`, `sourcemaps:upload`, `typecheck`, `clean`, `with-env`)
- `apps/desktop/package.json:69-72` — placeholders (`buildFlavor: "dev"`, `buildNumber: "1"`, `sparkleFeedUrl: ""`, `signingMode: "ad-hoc"`)
- `apps/desktop/src/env/main.ts:1-32` — t3-env main-process env layer
- `apps/desktop/src/main/sentry.ts:14-57` — Sentry init with rewrite-frames + signingMode tag
- `apps/desktop/src/main/build-info.ts:7-21` — build-info caching, reads package.json fields
- `apps/desktop/src/main/updater.ts:87-89` — ad-hoc updater kill-switch
- `apps/desktop/src/main/auth-flow.ts:1-135` — loopback HTTP server (replaces deleted protocol.ts)
- `apps/desktop/src/shared/build-info-schema.ts:6-15` — `signingModeSchema` enum + `buildInfoSchema`
- `apps/desktop/src/shared/ipc.ts:5-27` — IPC channels (no `showContextMenu`)
- `apps/desktop/scripts/upload-sourcemaps.mjs:1-63` — sentry-cli driver
- `apps/desktop/.env.example` — 21-line contributor template
- `apps/desktop/vite.main.config.ts:4-6` — `__SENTRY_DSN__` define
- `apps/desktop/README.md:5-30` — beta install instructions
- `.github/workflows/desktop-release.yml:1-196` — full release pipeline
- `.github/workflows/desktop-ci.yml:1-58` — paths-filtered desktop CI
- `.changeset/config.json:10` — `"ignore": ["@lightfast/desktop"]`
- `pnpm-workspace.yaml:88` — `@sentry/cli` in `onlyBuiltDependencies`

## Architecture Documentation

### Release pipeline as it exists today

```
git tag @lightfast/desktop@<v> && git push
  └─ desktop-release.yml fires
       ├─ prepare (ubuntu)
       │    - parse tag → version + auto-derive prerelease (any hyphen-suffix)
       │    - gh release create --draft (with --prerelease if applicable)
       │      auto-generated notes from previous matching tag (or hand-written
       │      one-liner for the first tag)
       └─ build (matrix arm64 × x64, macos-14)
            - npm version + stamp buildFlavor=prod, buildNumber=$GITHUB_RUN_NUMBER,
              sparkleFeedUrl, signingMode (developer-id if APPLE_SIGNING_IDENTITY
              else ad-hoc)
            - import Apple cert + write notarize key (only if APPLE_SIGNING_IDENTITY)
            - electron-forge publish --arch=<arch> --platform=darwin
              → uploads .zip + .dmg to draft release
            - sourcemaps:upload → Sentry releases new + upload-sourcemaps + finalize
            - actions/attest-build-provenance@v2 on out/make/**/*.zip
       └─ finalize (ubuntu)
            - generate-update-feed.mjs → latest-mac-{arm64,x64}.json on release
            - gh release edit --draft=false
```

Concurrency: `desktop-release-${{ github.ref }}`, `cancel-in-progress: true`.

### Per-PR CI for desktop

`.github/workflows/desktop-ci.yml` — triggers on PR + push-to-main when any of `apps/desktop/**`, `packages/{app-trpc,ui,lib}/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/desktop-ci.yml` changes. Runs `pnpm --filter @lightfast/desktop typecheck` then `pnpm --filter @lightfast/desktop package` (unsigned) on `macos-14`. Not yet a required status check.

`.github/workflows/ci.yml:54` continues to catch desktop via `pnpm turbo typecheck --affected --continue`.

### Build-time identity flow

```
package.json placeholders (version=0.0.0, buildFlavor=dev, buildNumber=1, sparkleFeedUrl="", signingMode=ad-hoc)
                              │
            CI tag-trigger ───┴──→ npm pkg set: version, buildFlavor=prod, buildNumber=$RUN_NUMBER,
                                                  sparkleFeedUrl=…, signingMode=(dev-id|ad-hoc)
                              │
            Vite define ──────┴──→ __SENTRY_DSN__ = JSON.stringify(process.env.SENTRY_DSN ?? "")
                              │
            Forge bundle ─────┴──→ .vite/build/bootstrap.js  (DSN inlined; identifiers stamped)
                              │
            sourcemaps:upload ┴──→ Sentry release `${name}@${version}+${buildNumber}`
                                                                                       │
                                  (matches sentry.ts release id format)                ▼
                              ┌─ Forge package + osx-sign + osx-notarize (if dev-id) ──┘
                              │
                              ▼
                      .dmg + .zip → GitHub release
                              │
                              ▼
                    generate-update-feed.mjs
                              │
                              ▼
              latest-mac-{arm64,x64}.json → consumed by autoUpdater
                                            (ONLY when signingMode != "ad-hoc";
                                             see updater.ts:87-89)
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` — original gap analysis + Status Tracker. All "DONE"/"DROPPED" items verified true 2026-05-06.
- `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md` — phases 1–4 (entitlements / Info.plist / Sentry / dead code). Per `pre-release-batch.md` Status section, all four landed before PR #621.
- `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` — phases B–F. `status: shipped (phases B–F)`, `shipped_pr: #621`, `merge_commit: aef1d3240`, `shipped_at: 2026-04-24`. Phase A (Apple + Sentry secrets) explicitly "Left for a human."
- Recent merges visible in `git log`: PR #637 (`ab634170e`, unsigned beta distribution), PR #630 (`7f2910544`, portless runtime batch), PR #622 (`476d898d1`, deps upgrade).

## Related Research

- `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` (the document being verified)
- `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md`
- `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`
- `thoughts/shared/plans/2026-04-23-desktop-clerk-trpc-wiring.md`

## Open Questions

1. **Inherit plist (G-3)**: Drop `disable-library-validation` from `entitlements.mac.inherit.plist` for surface-area parity with Codex, or keep it because some Electron helper actually loads unsigned dylibs? Needs a test on a notarized build to know for sure.
2. **osxSign kebab-case (G-2)**: Should the camelCase rename land speculatively now (before Apple secrets), or be bundled with the first signed-tag dry run? Pre-fixing is cheap but unverifiable until secrets exist; bundling saves a round-trip.
3. **Custom URL scheme audit (G-7)**: Did `b30d99975` add a `setAsDefaultProtocolClient` call that's now hidden under a different module name, or was it purely about the renderer-side PKCE flow?
4. **First-release version**: `0.1.0-rc.1` (per pre-release plan) or jump straight to `0.1.0`? RC route exercises the prerelease-detection logic in `desktop-release.yml:32-40` end-to-end.
5. **Sparkle public-key adoption**: Currently dropped (§13). When (if) Sparkle-native is adopted post-v0.1.0, it'll need to be re-introduced — worth tracking as a follow-up so the field doesn't get re-added without a corresponding consumer.
