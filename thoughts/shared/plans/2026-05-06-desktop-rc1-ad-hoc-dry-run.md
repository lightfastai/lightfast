---
date: 2026-05-06
owner: jp@jeevanpillay.com
branch: main
based_on:
  - thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md
  - thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md
  - thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md
status: draft
---

# Desktop `0.1.0-rc.1` Ad-Hoc Dry-Run + Codesign Pre-Fixes

## Overview

Three things, in order: (1) append a 2026-05-06 status update to the original Codex-gap research file so the Status Tracker reflects today's reality (PR #621 + PR #637 landed; G-7 closed); (2) pre-fix the two known codesign correctness gaps (G-2 osxSign kebab-case keys; G-3 helper-inherit plist `disable-library-validation`) so the first signed cut doesn't ping-pong back to the codebase; (3) provision Sentry secrets only and cut `@lightfast/desktop@0.1.0-rc.1` in ad-hoc mode to exercise the entire release pipeline (~90% of it) before Apple Developer enrollment unblocks.

This plan does **not** touch Apple Developer setup. The ad-hoc fallback added by PR #637 (`forge.config.ts:14-49` + `desktop-release.yml:120-124`) is the explicit Apple-blocked path and we use it.

## Current State Analysis

Verified against `main` at `ab634170e`:

- PR #621 shipped Phases B–F of `2026-04-23-desktop-pre-release-batch.md`: env layer, source-map upload, signed-release workflow, desktop CI, contributor ergonomics. Workflow is wired but inert until first tag.
- PR #637 shipped the unsigned-beta-distribution track: `signingMode: "ad-hoc" | "developer-id"` enum threaded through `package.json:72`, `src/shared/build-info-schema.ts:6-7,15`, build-info, Sentry tags, updater (gated off when ad-hoc, `updater.ts:87-89`), and the workflow (auto-flips signing mode based on whether `APPLE_SIGNING_IDENTITY` exists; auto-derives `prerelease=true` from any `-rc.N`/`-beta.N`/`-alpha.N` suffix).
- Verification doc enumerates 7 gaps. G-7 (deep-link removal still holds after the custom-URL-scheme work in `b30d99975`) is verified **closed** — `grep` for `setAsDefaultProtocolClient`, `onDeepLink`, `open-url` across `apps/desktop/src/` returns zero matches; `protocol.ts` is gone.
- Two code-side gaps remain that are cheap to land independently of Apple:
  - **G-2** (`forge.config.ts:14-49` developer-id branch): `"hardened-runtime"`, `"gatekeeper-assess"`, `"entitlements-inherit"`, `"signature-flags"` are kebab-case and silently dropped by `@electron/osx-sign@1.3.3` (camelCase only). The in-source TODO already names this. Notarization will fail on first signed build until renamed.
  - **G-3** (`entitlements.mac.inherit.plist:9-10`): main plist was trimmed in PR #614 to drop `com.apple.security.cs.disable-library-validation`, but the helper-process inherit plist (used by GPU/Renderer/Plugin helpers via `entitlements-inherit` in `forge.config.ts:29-32`) still carries it. Codex carries it in neither.
- One pipeline gap: Sentry isn't provisioned yet, so even an ad-hoc tag would publish without symbolicated stack traces or a Sentry release.

### Key Discoveries

- The pipeline is fully self-contained on the ad-hoc path: `desktop-release.yml:120-124` flips `signingMode` based on `APPLE_SIGNING_IDENTITY` presence; the "Import Apple signing certificate" step at `desktop-release.yml:126` and "Write notarize API key" step are guarded by `if: env.APPLE_SIGNING_IDENTITY != ''`. With Apple secrets absent, the workflow runs end-to-end without touching codesign or notarization.
- Sentry secrets are independent of Apple. Provisioning only the 2 Sentry secrets + 2 Sentry vars unblocks symbolicated stacks now; doing so before Apple lands means rc.1 already has working observability when the first signed cut happens.
- `desktop-release.yml:32-40` auto-detects prerelease from any hyphen-suffix in the tag, so `0.1.0-rc.1` → `--prerelease` flag at draft creation. No workflow change needed for the rc cadence.
- The `pnpm package` command exercises Forge's full sign path on ad-hoc — verified locally that the current `forge.config.ts:43-49` ad-hoc fallback (`identity: "-"`, `identityValidation: false`, `optionsForFile: () => ({ hardenedRuntime: false })`) produces a launchable `.app`. Pre-fixing G-2 in the developer-id branch must not regress the ad-hoc branch.

## Desired End State

1. The Codex-gap research at `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` carries an appended `## Status Update 2026-05-06` section that closes G-7 and explicitly lists G-1, G-2, G-3, G-4, G-5, G-6 as the remaining gates. Prior Status Tracker rows are unchanged (preserves historical truth of what was thought on 2026-04-24).
2. `apps/desktop/forge.config.ts:14-49` developer-id branch uses camelCase keys throughout; per-file options live inside `optionsForFile`. The ad-hoc fallback branch is unchanged. The in-source TODO is removed.
3. `apps/desktop/build/entitlements.mac.inherit.plist` no longer carries `com.apple.security.cs.disable-library-validation`.
4. Sentry repo settings carry: secrets `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`; variables `SENTRY_ORG`, `SENTRY_PROJECT`.
5. `git tag @lightfast/desktop@0.1.0-rc.1 && git push origin '@lightfast/desktop@0.1.0-rc.1'` fires `desktop-release.yml`. Outcome:
   - Workflow run is green (`prepare`, `build` matrix on arm64 + x64, `finalize`).
   - Draft GitHub release (prerelease) carries 6 assets: arm64 + x64 × (`.zip`, `.dmg`) plus `latest-mac-arm64.json` and `latest-mac-x64.json`.
   - Sentry release `@lightfast/desktop@0.1.0-rc.1+<runNumber>` exists with sourcemaps for both `.vite/build` and `.vite/renderer/main_window` uploaded.
   - Build provenance attestation present on `out/make/**/*.zip`.
6. The arm64 `.dmg` boots from a clean `/Applications` install via the documented "Open Anyway" path (per `apps/desktop/README.md:5-30`). Renderer signs in successfully via the loopback callback. A test-thrown error in main lands in Sentry with a fully symbolicated stack (file path + line number resolves back to `apps/desktop/src/...`).

## What We're NOT Doing

- Provisioning Apple Developer Program / App Store Connect API key. Out of scope; blocked.
- Cutting `@lightfast/desktop@0.1.0` (without `-rc.N`). The first non-rc cut is a separate decision after rc.1 + Apple.
- File-backed structured logger (graduating §2 of the Codex-gap research from DEFERRED). Punted to a follow-up; revisit when a beta user hits something Sentry doesn't surface.
- Help menu "Check for updates" item. Punted; README already documents the manual reinstall path for ad-hoc beta.
- Branch protection for `Desktop CI / Typecheck + package (unsigned)` — repo Settings UI, not automatable from code. Tracked as G-4; not in this plan.
- Any change to `updater.ts:87-89` ad-hoc kill-switch. The auto-updater stays disabled on ad-hoc by design.
- Sparkle-native, Linux makers, Windows MSIX, universal binary, SQLite, worker tier — all explicitly DEFERRED in the original tracker, unchanged here.

## Implementation Approach

Strict ordering on Phase 1 → Phase 2 → Phase 3a → Phase 3b. Phase 2 is independent of Phase 3 in principle (codesign pre-fix doesn't depend on Sentry), but landing them as separate commits keeps the rc.1 tag clean: tag a commit that has both pre-fix + Sentry secrets so the dry-run validates them simultaneously.

Each phase is a halt point. After Phase 2 lands and CI is green, halt for human go-ahead before provisioning Sentry. After Sentry secrets land, halt for human go-ahead before cutting the rc tag (because the tag triggers a real GitHub Actions run that publishes a draft release).

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Research file status update

### Overview

Append a `## Status Update 2026-05-06` section to `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`. Append-only — no edits to prior rows. The new section summarizes:
- N-1 (PR #621, `aef1d3240`, 2026-04-24): pre-release-batch phases B–F.
- N-2 (PR #637, `ab634170e`, 2026-05-06): unsigned-beta-distribution + `signingMode` enum.
- N-3 mid-flight items (`2565270fa` floating settings, `b30d99975` custom URL scheme + PKCE).
- G-7 closed (no `setAsDefaultProtocolClient` / `onDeepLink` / `open-url` references in `apps/desktop/src/`).
- G-1..G-6 standing as the gates for first-class signed v0.1.0.

### Changes Required

#### 1. `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`

**File**: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`
**Changes**: Append a new top-level section after the existing `## Status Update 2026-04-24` section. Update frontmatter `last_updated: 2026-05-06` and `last_updated_note` to reflect the new state. Add a `verifications:` field referencing `2026-05-06-desktop-prod-readiness-status-verification.md`.

The appended section:

```markdown
## Status Update 2026-05-06

Verification pass logged at [`thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md`](2026-05-06-desktop-prod-readiness-status-verification.md). Every prior **DONE** / **DROPPED** Status Tracker row remains true. The three rows previously **IN PROGRESS** all landed.

### What landed since 2026-04-24

- **PR #621** (`aef1d3240`, 2026-04-24) — pre-release-batch phases B–F. Closes IN PROGRESS rows in §2 (Sentry source-map upload), §6 (multi-arch matrix), §13 (build-metadata stamping). Source artifacts: `apps/desktop/src/env/{main,renderer}.ts`, `apps/desktop/scripts/upload-sourcemaps.mjs`, `.github/workflows/desktop-{release,ci}.yml`, `apps/desktop/.env.example`, `apps/desktop/package.json` `clean` script, `.changeset/config.json` ignore.
- **PR #637** (`ab634170e`, 2026-05-06) — unsigned-beta-distribution. Adds a `signingMode: "ad-hoc" | "developer-id"` enum threaded through `apps/desktop/package.json:72`, `apps/desktop/src/shared/build-info-schema.ts:6-7,15`, build-info, Sentry tags, updater. `forge.config.ts:14-49` carries a two-branch osxSign (developer-id when `APPLE_SIGNING_IDENTITY` + `APPLE_TEAM_ID` set, else ad-hoc fallback `identity: "-"`). `desktop-release.yml:32-40` auto-derives `prerelease=true` from any hyphen-suffix in the tag; `desktop-release.yml:120-124` flips `signingMode` based on whether `APPLE_SIGNING_IDENTITY` exists. `apps/desktop/src/main/updater.ts:87-89` disables the auto-updater entirely when `signingMode === "ad-hoc"` (Squirrel.Mac requires the new build to satisfy the running app's Designated Requirement; ad-hoc DRs are content-bound).
- **Mid-flight** — `2565270fa` (floating settings panel), `b30d99975` (custom URL scheme + PKCE). The custom-URL-scheme work does **not** reintroduce a deep-link handler in main: `grep` for `setAsDefaultProtocolClient`, `onDeepLink`, `open-url` across `apps/desktop/src/` returns zero matches. The deletion of `protocol.ts` and the lack of `CFBundleURLTypes` in `forge.config.ts:81-92` extendInfo both still hold. **§10 deep-link surface is genuinely gone.**

### Tracker rows state at 2026-05-06

| § | Finding | Prior state | Current state |
|---|---|---|---|
| 2 | Source-map upload / `@sentry/cli` | IN PROGRESS | **DONE** (PR #621) |
| 6 | Multi-arch arm64+x64 | IN PROGRESS | **DONE** (PR #621) |
| 13 | Non-empty version / buildNumber / sparkleFeedUrl | IN PROGRESS | **DONE** (PR #621 — workflow stamps via `npm pkg set`; placeholders in `package.json` are intentional) |
| 13 | `signingMode` (new) | n/a | **DONE** (PR #637) |
| 10 | Deep-link `console.log` / dispatcher | DEFERRED | **N/A** — surface removed; was never reintroduced |

All other DEFERRED / RELEASE rows from the 2026-04-24 tracker remain unchanged.

### Remaining gates for first-class signed v0.1.0

- **G-1** — Apple Developer enrollment + Sentry secrets. External, partially blocked (Apple). Sentry can land independently.
- **G-2** — `forge.config.ts:14-49` osxSign developer-id branch uses kebab-case keys silently dropped by `@electron/osx-sign@1.3.3`. Will fail signed-build path on first try. Pre-fix is cheap but unverifiable until Apple secrets exist.
- **G-3** — `apps/desktop/build/entitlements.mac.inherit.plist:9-10` still carries `com.apple.security.cs.disable-library-validation`. Codex carries it in neither main nor inherit plist.
- **G-4** — Branch protection for `Desktop CI / Typecheck + package (unsigned)` (UI-only, not automatable from code).
- **G-5** — First end-to-end dry run: cut `@lightfast/desktop@0.1.0-rc.1`. Can be run in ad-hoc mode now without Apple — exercises ~90% of the pipeline (matrix, Forge ad-hoc fallback, Sentry release + sourcemaps, attestation, Sparkle JSON feed). Codesign + notarize remain unverified until Apple lands.
- **G-6** — Auto-updater is intentionally disabled when `signingMode === "ad-hoc"`. Beta users reinstall manually until the first signed cut.

G-7 from the verification doc (custom URL scheme audit) is **closed** — verified above.

### Recommended order to clear the gates

1. Pre-fix G-2 + G-3 in code (cheap, lands without Apple).
2. Provision Sentry only (G-1 partial). Defers Apple to its own dependency chain.
3. Cut `@lightfast/desktop@0.1.0-rc.1` ad-hoc dry-run (G-5 partial). Validates everything except codesign + notarize.
4. When Apple unblocks: provision the remaining 8 secrets, cut `@lightfast/desktop@0.1.0-rc.2` (signed), verify codesign + notarize + stapled ticket. Promote to `@lightfast/desktop@0.1.0`.
5. Branch protection (G-4) — repo Settings UI. Do this after rc.1 to confirm `Desktop CI` is the right check name to require.
```

### Success Criteria

#### Automated Verification:
- [x] `grep -c "Status Update 2026-05-06" thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` → `1`
- [x] `grep -c "Status Update 2026-04-24" thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` → `1` (ensures the prior section was preserved, not overwritten)
- [x] `head -20 thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md | grep "last_updated: 2026-05-06"` → match
- [x] `git diff --stat ...` — N/A: file is untracked in main, so a tracked-diff is not meaningful. Manually inspected: prior body unchanged; frontmatter `last_updated`/`last_updated_note` updated + `verifications:` field added; new `## Status Update 2026-05-06` section appended.

#### Human Review:
- [ ] Open the file → confirm new section renders correctly in your markdown viewer; the row table is legible

---

## Phase 2: Codesign pre-fix (G-2 + G-3)

### Overview

Two file edits. Both are mechanical and verifiable today (the developer-id branch isn't reachable in CI without Apple secrets, but TypeScript still type-checks; ad-hoc-mode `pnpm package` still succeeds because the ad-hoc branch is untouched).

### Changes Required

#### 1. `apps/desktop/forge.config.ts` — osxSign camelCase rename

**File**: `apps/desktop/forge.config.ts`
**Changes**: Lines 14–49. Rename kebab-case keys in the developer-id branch to the camelCase forms `@electron/osx-sign@1.3.3` actually consumes. `hardened-runtime`, `gatekeeper-assess`, `signature-flags` are per-file options that must move into `optionsForFile`; `entitlements-inherit` is a top-level option (`entitlementsInherit`). Remove the in-source TODO. Leave the ad-hoc fallback branch (lines 35–49) untouched.

```ts
const osxSign =
  process.env.APPLE_SIGNING_IDENTITY && process.env.APPLE_TEAM_ID
    ? {
        identity: process.env.APPLE_SIGNING_IDENTITY,
        entitlements: resolve(
          import.meta.dirname,
          "build/entitlements.mac.plist"
        ),
        entitlementsInherit: resolve(
          import.meta.dirname,
          "build/entitlements.mac.inherit.plist"
        ),
        optionsForFile: () => ({
          hardenedRuntime: true,
          gatekeeperAssess: false,
          signatureFlags: "library",
        }),
      }
    : // Ad-hoc fallback used while waiting on Apple Developer enrollment.
      // identity:"-" alone produces an unsigned bundle: osx-sign defaults
      // identityValidation:true, runs `security find-identity -v -`, finds
      // nothing, throws, forge swallows. Bundle then SIGKILLs at launch
      // (Code Signature Invalid) once FusesPlugin patches the binary.
      // hardenedRuntime must go through optionsForFile — mergeOptionsForFile
      // ignores top-level hardenedRuntime. Library validation rejects sibling
      // frameworks under hardened runtime because ad-hoc DRs are content-bound.
      {
        identity: "-",
        identityValidation: false,
        optionsForFile: () => ({ hardenedRuntime: false }),
        preAutoEntitlements: false,
        preEmbedProvisioningProfile: false,
      };
```

The "Why" comment on the ad-hoc branch is unchanged. The TODO comment on the developer-id branch is dropped because the work is done.

#### 2. `apps/desktop/build/entitlements.mac.inherit.plist` — drop disable-library-validation

**File**: `apps/desktop/build/entitlements.mac.inherit.plist`
**Changes**: Remove the `com.apple.security.cs.disable-library-validation` key + value (lines 9–10). The remaining three keys (`allow-jit`, `allow-unsigned-executable-memory`, `inherit`) match Codex's helper entitlements.

Final file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.inherit</key>
  <true/>
</dict>
</plist>
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/desktop typecheck` passes
- [x] `pnpm check` — biome is clean on the two changed files (`pnpm exec biome check apps/desktop/forge.config.ts apps/desktop/build/entitlements.mac.inherit.plist` → no fixes). The `pnpm check` aggregate fails on 10 pre-existing errors in files this phase does not touch (`apps/desktop/src/main/windows/factory.ts`, `apps/desktop/src/main/__tests__/auth-flow.test.ts`, `apps/desktop/src/main/__tests__/protocol.test.ts`, plus a few app/api desktop test/route files); confirmed pre-existing by stashing and re-running on branch HEAD.
- [x] `pnpm --filter @lightfast/desktop package` succeeded locally with `APPLE_SIGNING_IDENTITY` unset; produced `apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app` with `codesign -d -v` reporting `Signature=adhoc` (ad-hoc branch untouched, ad-hoc fallback is the executed path).
- [x] `grep -c "disable-library-validation" apps/desktop/build/entitlements.mac.inherit.plist` → `0`
- [x] `grep -c '"hardened-runtime"\|"gatekeeper-assess"\|"signature-flags"\|"entitlements-inherit"' apps/desktop/forge.config.ts` → `0`
- [x] `grep -c "TODO(apple-cert)" apps/desktop/forge.config.ts` → `0`
- [x] `grep -c "entitlementsInherit\|optionsForFile" apps/desktop/forge.config.ts` → `4` (developer-id branch: `entitlementsInherit` + `optionsForFile`; ad-hoc branch: `optionsForFile`; plus one comment mention — all ≥ 2)
- [ ] Desktop CI green on the PR (typecheck + unsigned `electron-forge package` on macos-14) — pending PR open

#### Human Review:
- [ ] Open the produced `.app` from `apps/desktop/out/Lightfast-darwin-<arch>/Lightfast.app` → double-click → main window appears (smoke that ad-hoc branch still works)

---

## Phase 3a: Sentry provisioning (human, no code)

### Overview

Provision the Sentry-side resources only. This is Phase A's Sentry subset from `2026-04-23-desktop-pre-release-batch.md`, intentionally separated from Apple. Apple is blocked; Sentry isn't.

### Changes Required

No code. Repo Settings + Sentry UI work.

#### Sentry org

1. In Sentry, create an Electron project named exactly `lightfast-desktop` under the existing Lightfast org. Capture the DSN.
2. Settings → Developer Settings → Auth Tokens. Create an org auth token with `project:releases` scope. Capture the token.

#### Repo settings — Secrets and variables → Actions

Add these **secrets**:
- `SENTRY_DSN` — DSN from Sentry project (public identifier, but storing as a secret keeps it out of git history)
- `SENTRY_AUTH_TOKEN` — auth token from step 2

Add these **variables** (Variables tab, not Secrets):
- `SENTRY_ORG` — Sentry org slug (e.g. `lightfast`)
- `SENTRY_PROJECT` — `lightfast-desktop`

### Success Criteria

#### Automated Verification:
- [ ] `gh secret list --repo lightfastai/lightfast | grep -E '^SENTRY_DSN\s|^SENTRY_AUTH_TOKEN\s'` → both lines present
- [ ] `gh variable list --repo lightfastai/lightfast | grep -E '^SENTRY_ORG\s|^SENTRY_PROJECT\s'` → both lines present

#### Human Review:
- [ ] Visit the Sentry org → confirm `lightfast-desktop` project visible
- [ ] Visit `github.com/lightfastai/lightfast/settings/secrets/actions` → confirm both secrets + both variables present (this duplicates the gh checks above but the GitHub UI shows the values were saved correctly)

**Stop here for human confirmation that Phase 3a is complete before cutting the rc.1 tag in Phase 3b.**

---

## Phase 3b: `0.1.0-rc.1` ad-hoc dry-run

### Overview

Cut the first desktop release tag in ad-hoc mode. This is the end-to-end dry-run for everything except codesign + notarize. Validates: tag trigger, prerelease auto-derivation (`-rc.1` suffix → `--prerelease`), arm64 + x64 matrix on macos-14, Forge's ad-hoc fallback, Sentry release creation + sourcemap upload + finalize, build provenance attestation, Sparkle JSON feed generation, draft → undraft (since prerelease=true the release stays in the prerelease list).

### Changes Required

No code changes. Tag + push + monitor.

#### 1. Cut the tag from `main` after Phase 2 merges

```bash
# From a clean checkout of main, with the Phase 2 PR already merged.
git checkout main
git pull origin main
git tag @lightfast/desktop@0.1.0-rc.1
git push origin '@lightfast/desktop@0.1.0-rc.1'
```

#### 2. Monitor the workflow

```bash
gh run watch --repo lightfastai/lightfast
# Or:
gh run list --workflow="Release desktop" --repo lightfastai/lightfast --limit 5
```

Expected jobs (per `desktop-release.yml`):
- `prepare` (ubuntu) — creates draft release with `--prerelease` flag (because `-rc.1` matches `*-*`).
- `build (arm64)` and `build (x64)` (macos-14, parallel) — `npm version` stamping, ad-hoc Forge publish (skips the Apple cert + notarize key steps because `env.APPLE_SIGNING_IDENTITY == ''`), `pnpm sourcemaps:upload`, `actions/attest-build-provenance@v2`.
- `finalize` (ubuntu) — `node apps/desktop/scripts/generate-update-feed.mjs` writes `latest-mac-{arm64,x64}.json` and uploads to the release; `gh release edit --draft=false` undrafts.

#### 3. Manual smoke-test of the resulting `.dmg`

Download the arm64 `.dmg` from the released assets. Install via the documented "Open Anyway" path (`apps/desktop/README.md:5-30`). Confirm:
- App opens.
- Sign-in via the loopback callback works.
- A test error thrown intentionally in main (one-off `throw new Error("rc1 sentry smoke")` in `index.ts` is **not** required — instead trigger an error from an existing surface, e.g. force a renderer crash via the devtools).
- Sentry UI shows a fresh issue under release `@lightfast/desktop@0.1.0-rc.1+<runNumber>` with a fully symbolicated stack (file path resolves back to `apps/desktop/src/...`, line numbers point at the right source).

### Success Criteria

#### Automated Verification:
- [ ] `gh run list --workflow="Release desktop" --repo lightfastai/lightfast --limit 1 --json conclusion --jq '.[0].conclusion'` → `success`
- [ ] `gh release view '@lightfast/desktop@0.1.0-rc.1' --repo lightfastai/lightfast --json isPrerelease,isDraft --jq '.isPrerelease,.isDraft'` → `true\nfalse` (prerelease, undrafted)
- [ ] `gh release view '@lightfast/desktop@0.1.0-rc.1' --repo lightfastai/lightfast --json assets --jq '[.assets[].name] | sort'` includes the 6 expected names: 2× `.zip` (arm64/x64), 2× `.dmg` (arm64/x64), `latest-mac-arm64.json`, `latest-mac-x64.json`
- [ ] `pnpm --filter @lightfast/desktop exec sentry-cli releases info '@lightfast/desktop@0.1.0-rc.1+<runNumber>' --org "$SENTRY_ORG" --project "$SENTRY_PROJECT"` (run locally with the auth token exported) reports the release with sourcemaps uploaded for both bundles
- [ ] `gh attestation verify --repo lightfastai/lightfast <downloaded-zip-path>` succeeds for both arm64 and x64 zips

#### Human Review:
- [ ] Download arm64 `.dmg` → install via "Open Anyway" → main window appears → primary nav renders
- [ ] Sign in via the loopback callback → `account.get` tRPC call succeeds (renderer shows authenticated state)
- [ ] Force a renderer error (e.g. via devtools `throw new Error("rc1 smoke")`) → Sentry UI shows the issue under release `@lightfast/desktop@0.1.0-rc.1+<runNumber>` with file/line resolving back to `apps/desktop/src/...` (proves rewriteFrames + sourcemaps + release matching all work end-to-end)
- [ ] Confirm `signingMode: "ad-hoc"` Sentry tag is present on the issue (proves the new tag from PR #637 is wired into the workflow output)
- [ ] Confirm the auto-updater stays silent in the running app (proves the `updater.ts:87-89` ad-hoc kill-switch is doing its job in a real packaged build, not just locally)

---

## Testing Strategy

### Local checks (before Phase 2 PR opens):
- `pnpm --filter @lightfast/desktop typecheck`
- `pnpm check`
- `pnpm --filter @lightfast/desktop package` — must produce a launchable ad-hoc `.app` (regression test for the unchanged ad-hoc branch)

### CI checks (Phase 2 PR):
- `Desktop CI / Typecheck + package (unsigned)` (paths-filtered, runs on macos-14)
- Root `ci.yml` typecheck (`turbo typecheck --affected`) catches via the desktop filter

### End-to-end checks (Phase 3b):
- The `desktop-release.yml` run itself is the integration test. All three jobs must be green; all six assets present; Sentry release populated; attestation verifiable.

## Performance Considerations

None applicable. Codesign config changes don't affect runtime performance; entitlements changes don't affect the ad-hoc path. The rc.1 dry-run is a one-shot operation.

## Migration Notes

None. The `signingMode` enum already exists; no schema changes. No user-data migration. Beta users on the current ad-hoc dmg can stay on it; rc.1 is a fresh installation per the README's "manual reinstall" guidance for ad-hoc beta.

## References

- Verification: `thoughts/shared/research/2026-05-06-desktop-prod-readiness-status-verification.md`
- Original gap research: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`
- Pre-release batch plan (PR #621): `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`
- Quick-wins plan: `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md`
- Code:
  - `apps/desktop/forge.config.ts:14-49` — osxSign two-branch config (G-2 target)
  - `apps/desktop/build/entitlements.mac.inherit.plist:9-10` — disable-library-validation (G-3 target)
  - `apps/desktop/src/main/updater.ts:87-89` — ad-hoc updater kill-switch (must remain untouched)
  - `.github/workflows/desktop-release.yml:32-40,120-124` — prerelease auto-detection + signingMode flip
  - `apps/desktop/scripts/upload-sourcemaps.mjs` — Sentry release driver (called from workflow)
  - `apps/desktop/README.md:5-30` — beta install / "Open Anyway" instructions (used in Phase 3b smoke test)
