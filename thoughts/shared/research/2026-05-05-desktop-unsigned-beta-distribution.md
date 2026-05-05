---
date: 2026-05-05
researcher: claude
git_commit: 2565270fac554cc02769ba6012eeb7c2cd9ae5d6
branch: desktop-portless-runtime-batch
topic: "apps/desktop unsigned-beta distribution path while waiting on Apple Developer enrollment"
tags: [research, desktop, electron, release, beta, gatekeeper, ad-hoc-signing, squirrel-mac, distribution]
status: complete
last_updated: 2026-05-05
---

# Research: apps/desktop unsigned-beta distribution path

**Date**: 2026-05-05
**Git Commit**: 2565270fac554cc02769ba6012eeb7c2cd9ae5d6
**Branch**: desktop-portless-runtime-batch

## Research Question

Apple Developer enrollment is in flight (likely 1–2 weeks for the org account). We want to ship a closed beta of `apps/desktop` *now* — the "dirty path 1" — while waiting for the cert. What is the full setup needed: build mechanics, distribution, install UX, auto-update behavior, and the migration story when the signed v0.1.0 lands?

## Summary

The cheapest beta is **not** a fully unsigned build — that produces an unrecoverable "damaged and can't be opened" error on Apple Silicon (the majority audience). The shippable path is an **ad-hoc-signed** build (`codesign --sign -`), which downgrades the dialog to the recoverable "unidentified developer" flow that users can bypass via System Settings → Privacy & Security. This is a hard finding from `Squirrel.Mac`'s source and electron-builder's recently-merged ARM64 fallback (PR #9007, April 2025).

What changes from the existing pipeline:

1. **`forge.config.ts`** — needs an ad-hoc fallback (`identity: "-"`) when `APPLE_SIGNING_IDENTITY` is absent. Today, missing-cert produces a fully-unsigned `.app` (the "damaged" path).
2. **`desktop-release.yml`** — two unconditional shell steps (Import Apple cert, Write notarize key) hard-fail when secrets are empty. Each needs a step-level `if:` gate. Also: notarization (`osxNotarize`) must remain disabled for ad-hoc builds.
3. **`apps/desktop/src/main/updater.ts`** — `initUpdater()` invokes `autoUpdater.setFeedURL` + `checkForUpdates()`, which on macOS instantiates `SQRLUpdater`. **`SQRLUpdater.init` throws `NSException` in release builds when the running app has no Developer ID signature**, crashing the app. The updater must be disabled on ad-hoc/unsigned builds — gated on a new build-info field (e.g., `signingMode: "developer-id" | "ad-hoc"`).
4. **Install copy** — README + GitHub release notes need a Sequoia-correct install flow. Right-click → Open is **dead** on macOS 15.0+; instructions must use System Settings → Privacy & Security → "Open Anyway". An `xattr -cr` fallback is needed for users on macOS 15.1 (where the GUI bypass briefly regressed) and as a power-user shortcut.
5. **Auto-update is non-functional for the beta**. Beta users will need to **manually reinstall** when the signed v0.1.0 ships — Squirrel.Mac refuses to swap binaries when the new build's designated requirement doesn't match the running app's. There is no graceful in-app migration path.
6. **Tag/version convention**: keep `@lightfast/desktop@0.1.0-beta.<n>` (the workflow's prerelease handling already exists via `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE`).

Sentry source-map upload, GitHub Releases hosting, attest-build-provenance, and the `desktop-ci.yml` typecheck job are unaffected — they have zero dependency on signing.

## Detailed Findings

### 1. Build mechanics — what `forge.config.ts` produces today

`apps/desktop/forge.config.ts:14-30` gates `osxSign` on `APPLE_SIGNING_IDENTITY && APPLE_TEAM_ID`. When both are empty, `osxSign` is `undefined`, electron-forge skips signing, and the resulting `.app` carries **no signature at all** — not even ad-hoc.

This is the failure mode that triggers macOS's "damaged" dialog on Apple Silicon (per electron-builder PR #9007 commentary, April 2025): on arm64, macOS requires *some* valid signature on every Mach-O. With nothing, the loader treats the binary as structurally invalid and reports "damaged and can't be opened" — and there is no GUI bypass for "damaged" on macOS 15+. The Apple Support flow (Settings → Privacy & Security → "Open Anyway") only handles the "unidentified developer" dialog, which requires a valid (even if untrusted) signature.

The fix is an **ad-hoc fallback**: when no Developer ID is present, sign with `identity: "-"`. Ad-hoc signing produces a content-bound signature that satisfies the loader's signature-presence requirement without claiming any identity. It is free, requires no Apple Developer account, and downgrades the user-facing dialog to the recoverable "Apple cannot verify this app" flow.

The `osxNotarize` block (`forge.config.ts:32-41`) gates on a separate set of vars (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`) and remains correctly absent for an ad-hoc build (notarization needs a real Developer ID).

### 2. Workflow gating — `desktop-release.yml` failure surface

The workflow has exactly **two** unconditional shell steps that hard-fail when Apple secrets are empty:

| Lines | Step | Behavior with empty secrets |
|---|---|---|
| 100–113 | "Import Apple signing certificate" | `security import` on a zero-byte `cert.p12` fails non-zero ("Unable to decode the file"); job aborts |
| 115–123 | "Write notarize API key" | Silently writes a zero-byte `AuthKey_.p8` and exports `APPLE_API_KEY=<that path>` to `$GITHUB_ENV` |

The remaining steps are signing-agnostic:

- "Stamp version + feed URL" (lines 92–98) — touches `package.json`, no Apple deps
- "Publish (forge)" (line 127) — `osxSign`/`osxNotarize` are env-gated inside `forge.config.ts`; unsigned/ad-hoc passes straight through
- "Upload source maps to Sentry" (line 131) — guards on Sentry vars only (`scripts/upload-sourcemaps.mjs:13-19`)
- "Attest build provenance" (line 133) — operates on `.zip`s; provenance attestation is independent of code signing
- `finalize` job — `scripts/generate-update-feed.mjs` reads `gh release view` assets; no signing dependency

Net: gating the two Apple-touching steps with `if: ${{ secrets.APPLE_SIGNING_IDENTITY != '' }}` (or routing through a `workflow_dispatch` boolean) is the entire workflow change. No structural rewrite needed.

One subtle behavior note: `osxNotarize` (`forge.config.ts:32-41`) requires `APPLE_API_KEY` to be a truthy string. The "Write notarize API key" step always sets `APPLE_API_KEY` to a path *even when secrets are empty* (the path becomes `$HOME/.private_keys/AuthKey_.p8`, which is a zero-byte file). If that step is gated off but somehow `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are non-empty, `osxNotarize` could be assigned and forge would try (and fail) to notarize. The cleanest behavior is to gate both Apple steps on a single condition.

### 3. Auto-update — Squirrel.Mac's hard signature requirement

This is the most surprising finding for path 1.

`apps/desktop/src/main/updater.ts:72-123` (`initUpdater()`) calls `autoUpdater.setFeedURL` then `autoUpdater.checkForUpdates()` 10 seconds after launch. Electron's `autoUpdater` on macOS is backed by Squirrel.Mac. From `Squirrel.Mac/Squirrel/SQRLUpdater.m`:

```objc
_signature = [SQRLCodeSignature currentApplicationSignature:&error];
if (_signature == nil) {
#if DEBUG
    NSLog(@"Could not get code signature for running application, application updates are disabled: %@", error);
    return nil;
#else
    @throw [NSException exceptionWithName:NSInternalInconsistencyException 
        reason:@"Could not get code signature for running application" 
        userInfo:exceptionInfo];
#endif
}
```

In a release build (which is what `electron-forge publish` produces), `SQRLUpdater.init` **throws an uncaught `NSException`** if `SecCodeCopyDesignatedRequirement` cannot extract a designated requirement from the running app. From Apple's docs: "No designated requirement can be obtained from unsigned code." For a fully unsigned app, the throw is guaranteed.

Ad-hoc signing **does** produce a designated requirement (Apple TN3127), so `SQRLUpdater.init` would not throw. But the same source code (`SQRLInstaller.m`) validates an incoming update against the running app's DR using `SecStaticCodeCheckValidityWithErrors`. Ad-hoc DRs are *content-bound* — every new build has different content and produces a different DR. So ad-hoc-to-ad-hoc Squirrel updates are **logically expected to fail** at the DR check, even though the updater initializes cleanly. (This is a high-confidence inference from Apple Code Signing Guide + Squirrel source; no authoritative empirical test was found in the web research.)

Practical implication for path 1: **disable `initUpdater()` entirely** on the beta build, regardless of whether we ship unsigned or ad-hoc. The current gates at `updater.ts:76-80` are:
- `if (!app.isPackaged) return;`
- `if (build.buildFlavor === "dev") return;`

Neither catches a packaged-prod build that is ad-hoc-signed. A new gate is needed — most cleanly, a new `signingMode` or `unsigned: boolean` field on the build-info snapshot (`apps/desktop/src/main/build-info.ts`), populated from `package.json` at CI stamping time.

### 4. User-facing install UX on macOS 15+

The Sequoia (macOS 15.0) Gatekeeper rules are materially different from prior versions. From Apple Developer News (2024-08-06): "users will no longer be able to Control-click to override Gatekeeper when opening software that isn't signed correctly or notarized."

The current consumer-supported flow (Apple Support `mh40616`):

1. Open the `.dmg`, drag `Lightfast.app` to Applications.
2. Double-click `Lightfast.app`. Dialog: "Apple cannot verify Lightfast is free of malware that may harm your Mac." Click **Done**.
3. Open System Settings → Privacy & Security. Scroll to the Security section.
4. Click **Open Anyway** next to Lightfast (button visible for ~1 hour after the blocked launch).
5. Confirm with Touch ID / login password.

This flow only works when the dialog is the "unverified" variant — which requires the app to be at least ad-hoc signed (per §1).

A `xattr -cr /Applications/Lightfast.app` fallback covers two edge cases:
- Users on macOS 15.1 hit a brief regression where "Open Anyway" did not appear (resolved in 15.2 per the OSnews + HN reporting).
- Users who somehow get a fully-unsigned build (e.g., direct download of an asset that was uploaded before the ad-hoc fallback landed) and see the "damaged" dialog.

Real-world copy benchmarks from the web research:
- **msg-reader** (Tauri, Dec 2025) — dropped right-click instructions entirely after Sequoia, leads with `xattr -cr` for the "damaged" case.
- **Zen Browser** (Electron, ad-hoc signed) — frames it as "macOS doesn't recognize the developer," not malware.
- **OpenGoat** (Tauri, April 2026) — explicitly chose unsigned over ad-hoc; instructions still reference right-click → Open, which is wrong for Sequoia.
- **Zed** (signed/notarized) — README still references right-click → Open as "Method 1." Outdated for Sequoia.

The dominant tone pattern across these projects: brief explanation it's Apple's security system (not malware), no excessive apology, numbered steps. **No project found mentions a "we'll get our cert before public launch" expectation-setting message** — that pattern is open for us to define.

### 5. Distribution channel for a 10–100 user beta

The web research found no equivalent of TestFlight for non-App-Store macOS. The dominant pattern:

- **Public or unlisted GitHub Release** with `.dmg` (and optionally `.zip`) attached. The repo is already public (`gh repo view` → `"PUBLIC"`), and `desktop-release.yml` already creates a draft release that the `finalize` job undrafts.
- **Discord / Slack** as the *announcement* and *support* channel — not the distribution. Sharing `.dmg` files via DM doesn't scale and loses provenance.
- For a "private beta" feel without a cert, the existing workflow already supports `prerelease: process.env.LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true"` (`forge.config.ts:47`). A `0.1.0-beta.1` tag with that env set produces a GitHub release marked "Pre-release," which is hidden from the default "Latest" view but still publicly downloadable.

### 6. Migration: unsigned/ad-hoc beta → signed v0.1.0

Squirrel.Mac issue #160 (maintainer): "For an update to be considered valid it must meet the designated requirement of the current version… If you've changed the certificate your application is signed by it is likely now not meeting the designated requirement of the old versions."

The maintainer documents a "pivot update" trick (one transitional build signed with the old cert that expands the DR to include the new cert), but that requires the *old* identity to exist. For unsigned-or-ad-hoc → Developer ID, there is no pivot path because the old identity cannot sign anything verifiable.

Consensus: beta users need to **manually reinstall** when the signed v0.1.0 lands. The mitigation is an in-app banner / notification telling them so. Possible mechanisms (none implemented today):
- Read the published `latest-mac-{arch}.json` from the renderer, compare versions, surface a "Manually update required — please download v0.1.0" banner with a link to the GitHub release page.
- Pin the beta to a fixed version range and have the loopback callback page check the desktop's reported version.
- Send a Sentry breadcrumb tagged `signingMode: "ad-hoc"` so we can see who's still on the unsigned build after v0.1.0 ships.

Volume estimate: if the beta has, e.g., 50 users and 80% upgrade within a week, that's ~10 lingering installs to nudge through email/Discord. Tractable.

### 7. Tag/version convention and prerelease handling

The existing `forge.config.ts:43-49` honors `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true"` to mark the GitHub release as a prerelease. The `desktop-release.yml` workflow does **not** currently set this env (it's absent from the job-level `env:` block at lines 66-75), so today every tag publishes as "Latest." Setting it via the tag pattern (e.g., any `*-beta.*` tag implies prerelease) is one line in the prepare job.

Tag naming stays `@lightfast/desktop@0.1.0-beta.<n>` to match existing convention (`thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` "Phase A" + `verify-changeset.yml` interaction).

### 8. Sentry / source maps — unaffected

`apps/desktop/src/main/sentry.ts` and `scripts/upload-sourcemaps.mjs` have zero dependency on signing. The DSN bake (`vite.main.config.ts:5` `__SENTRY_DSN__`) and `sentry-cli releases` flow operate on the JS bundle, which is built before signing. Beta builds should ship with `SENTRY_DSN` populated so we get crash data — Apple cert delays don't affect this.

## Code References

### Build / signing
- `apps/desktop/forge.config.ts:14-30` — `osxSign` env gate (currently produces fully-unsigned when missing)
- `apps/desktop/forge.config.ts:32-41` — `osxNotarize` env gate (correct for path 1; stays inert)
- `apps/desktop/forge.config.ts:43-49` — `PublisherGithub` with `prerelease` toggle on `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE`

### Workflow gating surfaces
- `.github/workflows/desktop-release.yml:100-113` — Apple cert import (hard-fails on empty)
- `.github/workflows/desktop-release.yml:115-123` — Notarize key write (silently produces zero-byte `.p8`)
- `.github/workflows/desktop-release.yml:127` — `electron-forge publish` (signing-agnostic; respects forge config gates)
- `.github/workflows/desktop-release.yml:131` — Sentry source-map upload (signing-independent)
- `.github/workflows/desktop-release.yml:133-136` — Build provenance attestation (signing-independent)

### Auto-updater
- `apps/desktop/src/main/updater.ts:72-95` — `initUpdater()` enters `setFeedURL` regardless of signing
- `apps/desktop/src/main/updater.ts:76-82` — Existing gates: `app.isPackaged` and `buildFlavor === "dev"` (neither catches packaged-prod-ad-hoc)
- `apps/desktop/src/main/build-info.ts:7-20` — `BuildInfo` source for adding a `signingMode` field

### Install / docs
- `apps/desktop/README.md:139-152` — Current "Required GitHub secrets" table assumes Developer ID; needs a beta sibling section

### Migration
- `apps/desktop/src/main/auth-store.ts:50-65` — Token persisted via `safeStorage`; survives reinstall to the same `userData` path
- `apps/desktop/scripts/generate-update-feed.mjs:46-55` — Feed shape `{url, name, notes, pub_date}`; readable from renderer for self-update banner

## Architecture Documentation

### Three signing modes that matter for this app

| Mode | Identity | Gatekeeper UX | Squirrel.Mac auto-update | Setup cost |
|---|---|---|---|---|
| **Unsigned** | none | "damaged and can't be opened" (no GUI bypass on arm64) | Hard crash on `SQRLUpdater.init` (NSException) | $0 |
| **Ad-hoc** | `"-"` | "unidentified developer" / "Apple cannot verify" — recoverable via Settings → Privacy & Security | Initializes cleanly; **DR mismatch on every new build, so updates fail** | $0 |
| **Developer ID + notarized** | real cert | Silent first launch (with quarantine ticket) | Works | $99/yr + enrollment time |

Path 1 = ad-hoc. Path 2 = Developer ID + notarized.

### What changes are localized vs cross-cutting

Localized (single-file, isolated):
- `forge.config.ts:14-30` — add ad-hoc fallback object
- `desktop-release.yml:100-123` — add `if:` to two steps
- `package.json` — add a `signingMode` field (stamped at CI like `buildFlavor`)
- `apps/desktop/src/shared/build-info-schema.ts` — add `signingMode` enum

Cross-cutting:
- `updater.ts:72-95` + `build-info.ts:7-20` — add `signingMode === "ad-hoc"` gate (both files)
- `README.md` (apps/desktop + repo-root) + GitHub release notes template — install-bypass instructions
- (Optional) renderer banner reading the update feed and prompting manual reinstall when versions diverge — touches main IPC + a new renderer component

### Squirrel.Mac DR check is the load-bearing constraint

Every other concern (Gatekeeper, notarization, hardened runtime) has a known workaround. The DR-mismatch behavior is enforced in C inside the Squirrel framework with no public override. This is why "ad-hoc beta with auto-update" is *not* a real option — only "ad-hoc beta with manual reinstall on cert-arrival" is.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` — load-bearing source for Phase A (the 12 GitHub secrets/vars). Phase A is what's blocked. Path 1 specifically defers Phase A's Apple side.
- `thoughts/shared/research/2026-05-05-desktop-prod-readiness.md` — paired research doc; concluded "code-complete, blocked on credentials." This doc supplements with the "what credentials do we *not* need" inversion.
- `thoughts/shared/plans/2026-04-23-desktop-codex-gap-quick-wins.md` — Phase 1-4 quick wins (entitlements, env stamping, Sentry plumbing). All shipped; entitlements file is correct for hardened-runtime — but on a fully-unsigned build hardened runtime doesn't apply, so the entitlements file is unread for path 1.
- `thoughts/shared/plans/2026-05-04-pr630-test-plan-execution.md` — referenced unsigned/Gatekeeper bypass during a test execution. Not yet read in this research; worth a follow-up if it includes an existing bypass UX recipe.
- `thoughts/shared/plans/2026-04-24-desktop-deps-major-upgrade.md` — Electron/Forge major bumps. Distribution-adjacent; not load-bearing for path 1.

## Related Research

- `thoughts/shared/research/2026-05-05-desktop-prod-readiness.md` — the path-2 (signed) view; this doc is the path-1 complement
- `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md` — gap analysis driving the prod-readiness work

## Open Questions

1. **Ad-hoc-to-ad-hoc Squirrel updates — empirical confirmation.** The web research's logical analysis (DRs are content-bound for ad-hoc, so each new build has a different DR, so the DR-match check fails) is high-confidence but unverified by an authoritative test. Worth a 30-minute spike: build an ad-hoc `0.1.0-beta.1`, ship a `0.1.0-beta.2` to a feed, observe the update behavior. If it works, path 1 gains in-band updates and the migration story simplifies dramatically. If it doesn't, this doc's "manual reinstall" plan stands.

2. **macOS 16 / Tahoe Gatekeeper changes.** Tahoe is in beta as of May 2026. No announced changes to "Open Anyway" path in the public release notes, but the LaunchServices security fix ("An app may bypass Gatekeeper checks") indicates Apple is closing bypass loopholes. If Tahoe ships with stricter rules before our v0.1.0, path 1 may need re-evaluation.

3. **In-app "manual reinstall required" banner — implement now or after?** The renderer-side banner that detects a published version mismatch and prompts a download requires touching the main IPC and adding a renderer component. It's not blocking the beta — beta users can be told via Discord / email — but it's the most user-friendly path. Decision is: ship beta without and add the banner before the cert lands, or include it in the beta from day 1.

4. **Beta participant accounting.** Want a way to count how many users are on the ad-hoc build at v0.1.0 ship time, to size the manual-reinstall outreach effort. Easiest: tag Sentry events with `signingMode: "ad-hoc"` and read the count off Sentry's dashboard. Adds a one-line Sentry context.

5. **Install copy ownership.** Where does the canonical install-bypass instruction live — `apps/desktop/README.md`, the GitHub release body template, the lightfast.ai/desktop landing page, or all three? `apps/desktop/README.md:139-152` already has a "Required GitHub secrets" table aimed at maintainers — install instructions for users belong somewhere user-facing. Worth picking before writing the copy.
