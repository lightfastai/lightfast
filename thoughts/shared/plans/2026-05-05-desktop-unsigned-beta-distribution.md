---
date: 2026-05-05
owner: jp@jeevanpillay.com
branch: desktop-portless-runtime-batch
based_on: thoughts/shared/research/2026-05-05-desktop-unsigned-beta-distribution.md
related_plans:
  - thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md
status: draft
audience: solo (jp) — no other beta users at this time
---

# Desktop Unsigned/Ad-Hoc Beta Distribution Implementation Plan

## Overview

Ship a closed beta of `apps/desktop` while waiting on Apple Developer enrollment, by changing the build pipeline to fall back to **ad-hoc code signing** (`codesign --sign -`) when Apple secrets are absent. Ad-hoc avoids the unrecoverable "damaged" Gatekeeper dialog that fully-unsigned arm64 builds trigger, in exchange for a recoverable "unidentified developer" dialog the installer can bypass via System Settings → Privacy & Security.

Audience for the beta is **just me (jp)** for now. That collapses three otherwise-real concerns: no in-app "manual reinstall" banner is needed, no multi-user accounting is needed beyond a single Sentry tag, and install copy can stay minimal (README only).

## Current State Analysis

The release pipeline is **code-complete and inert**, blocked exclusively on Apple cert provisioning (per `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` Phase A status). Five surfaces would break or misbehave on a tag push without Apple secrets today:

1. **`forge.config.ts:14-30`** — `osxSign` is `undefined` when `APPLE_SIGNING_IDENTITY`/`APPLE_TEAM_ID` are empty, producing a fully-unsigned `.app`. Loads as "damaged" on arm64. No GUI bypass on macOS 15+.
2. **`.github/workflows/desktop-release.yml:100-113`** — "Import Apple signing certificate" step `base64 -d`s an empty `cert.p12`, then `security import` exits non-zero. Job aborts.
3. **`.github/workflows/desktop-release.yml:115-123`** — "Write notarize API key" silently writes a zero-byte `AuthKey_.p8` and exports `APPLE_API_KEY=<that path>` to `$GITHUB_ENV`. Could later trigger a doomed `osxNotarize` call if the other API vars happen to be non-empty.
4. **`apps/desktop/src/main/updater.ts:72-95`** — On macOS, `autoUpdater.setFeedURL` + `checkForUpdates()` instantiates `SQRLUpdater`, which **throws `NSException` in release builds when the running app has no Developer ID signature** (per Squirrel.Mac's `SQRLUpdater.m`, release-mode branch). For a fully-unsigned build the throw is guaranteed; for an ad-hoc build init succeeds but DR-check at *install* time still fails because ad-hoc DRs are content-bound (every build has a different DR). Either way the existing gates (`!app.isPackaged`, `buildFlavor === "dev"`) catch neither case.
5. **`apps/desktop/README.md:139-152`** — Documents the maintainer-facing "Required GitHub secrets" table for the signed-and-notarized path. Has no install-bypass instructions for users.

Sentry, source-map upload, GitHub Releases hosting, build provenance attestation, and `desktop-ci.yml` are all signing-independent and need no changes.

### Key Discoveries

- **`buildFlavor` is the precedent for stamped CI fields** — `desktop-release.yml:96-98` already runs `npm pkg set buildFlavor=prod buildNumber="$GITHUB_RUN_NUMBER"` and the value flows through `package.json` → `build-info.ts:14` → `buildInfoSchema` (`build-info-schema.ts:6-13`) → IPC (`ipc.ts:48-54`) → preload (`preload.ts:16-18`) → renderer (`renderer/src/main.ts:39`) → Sentry environment (`sentry.ts:23`). `signingMode` follows the schema/build-info portion of this only — main-process consumers (`updater.ts`, `sentry.ts`) read via `getBuildInfo()`, no IPC/preload/renderer threading until a renderer surface needs it (deferred per Q1 decision: no banner).
- **`SPARKLE_FEED_URL` env override already exists** (`apps/desktop/src/env/main.ts:9`, `updater.ts:35`).
- **Repo is already public** (`gh repo view → "PUBLIC"`); GitHub Releases assets work without auth tokens. The `prerelease` flag on `PublisherGithub` already exists at `forge.config.ts:47`, gated on `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true"`. The workflow does not currently set this var, so today every tag publishes as "Latest."
- **PublisherGithub does NOT update existing releases' `prerelease` flag** — confirmed by reading `node_modules/@electron-forge/publisher-github` source: when `publish()` finds an existing release by `tag_name` (including drafts), it skips straight to `uploadReleaseAsset` and never calls `updateRelease`. `prerelease: this.config.prerelease` is only sent inside the `createRelease` branch. **Implication**: setting `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE=true` alone is insufficient because the `prepare` job creates the draft *first* via `gh release create --draft --generate-notes` (no `--prerelease`). Phase 3 must pass `--prerelease` at draft creation time, not rely on the publisher config alone.
- **The renderer entry point reads `buildInfo.buildFlavor` for `data-buildFlavor`** (`renderer/src/main.ts:39,52`) — `signingMode` is intentionally NOT threaded through the IPC snapshot; the only consumers are `updater.ts` and `sentry.ts`, both main-process.
- **`auth-store.ts` persists the Clerk token at a stable userData path** (`auth-store.ts:19,21`), so a manual reinstall on cert-arrival preserves my sign-in state. No re-onboarding friction at the migration point.
- **Entitlements file is unread for path 1** — hardened-runtime is not applied to ad-hoc builds, so `build/entitlements.mac.plist` (5 keys, already trimmed) sits inert. No edits needed.

## Desired End State

After this plan ships:

1. `git tag @lightfast/desktop@0.1.0-beta.1 && git push origin @lightfast/desktop@0.1.0-beta.1` succeeds. Workflow produces an ad-hoc-signed arm64 + x64 `.zip`/`.dmg`, marked Pre-release on GitHub. No Apple steps run.
2. Downloading the `.dmg` on my Mac, dragging to Applications, double-clicking, hitting "Done" on the dialog, then clicking "Open Anyway" in System Settings → Privacy & Security launches Lightfast successfully.
3. Once running, the app does **not** crash from the updater (gate disables it on `signingMode: "ad-hoc"` defensively).
4. Sentry events from the running ad-hoc build are tagged `signingMode: ad-hoc`, so I can filter them later.
5. When Apple secrets land, the **same workflow** with no further code changes produces the signed/notarized v0.1.0 by virtue of secrets becoming non-empty — Phase A of the older plan flips to active.

### Verification

- `gh release view '@lightfast/desktop@0.1.0-beta.1' --repo lightfastai/lightfast --json isPrerelease,assets` shows `isPrerelease: true` and 6 assets (arm64+x64 zip, arm64+x64 dmg, plus the two `latest-mac-*.json` feeds).
- `codesign --display --verbose=4 /Applications/Lightfast.app | grep 'Signature='` reports `Signature=adhoc` on the installed beta.
- App boots; primary window renders; Sentry dashboard shows an event with tag `signingMode: ad-hoc` after triggering a deliberate render-time error (or just from the first launch session).

## What We're NOT Doing

- **In-app "manual reinstall required" banner.** No other users; I'll know to reinstall when v0.1.0 lands. Defer indefinitely.
- **Multi-user beta accounting / outreach copy.** No outreach.
- **Docs page on lightfast.ai/docs/desktop.** README-only for install instructions; new MDX page is scope creep.
- **Universal binary (`@electron/universal`).** Two arch matrix already works.
- **Windows / Linux ad-hoc paths.** macOS only; Windows Squirrel/SignTool gating is a separate problem and not blocking.
- **Migration tooling** beyond a Sentry tag. Manual reinstall is fine for one user.
- **A `workflow_dispatch` manual prerelease toggle.** Tag-pattern derivation (`-beta.` / `-rc.`) is sufficient.
- **Touching `osxNotarize` block** — it already correctly stays inert when `APPLE_API_KEY*` vars are empty. The workflow change just gates the keychain step, which has the side effect of leaving `APPLE_API_KEY` unset in the env, which in turn keeps `osxNotarize` undefined.
- **Anything in `apps/app`, `apps/www`, `apps/platform`, packages, or vendor abstractions.** Pure desktop-app + workflow + README.

## Implementation Approach

Four phases, in order. Phases 1 and 3 are independent of each other; Phase 2 depends on Phase 1 (uses the new `signingMode` field). Phase 4 is independent and can land any time after Phase 1 establishes the install artifact's behavior.

The updater is gated off on `signingMode: "ad-hoc"` defensively (the conservative path the research recommended). The cert switch from ad-hoc to developer-id will require manual reinstall regardless, since DRs change across signing modes — so even if ad-hoc-to-ad-hoc updates were proven to work, the v0.1.0-beta.x → v0.1.0 hop would still need a manual reinstall. A live spike to confirm ad-hoc-update behavior was considered and dropped: the result wouldn't change Phase 2 for the beta.1 ship target. Revisit post-cert if we ever want to relax the gate.

### Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Ad-hoc signing fallback + `signingMode` threading

### Overview

Two coupled changes: (1) make `forge.config.ts` produce an ad-hoc-signed app when Apple secrets are absent; (2) add a `signingMode` field to the schema and `getBuildInfo()` so the main-process consumers in Phase 2 (`updater.ts`, `sentry.ts`) can branch on it. **No IPC/preload/renderer threading** — the renderer doesn't consume `signingMode` (no banner per Q1 decision), so adding it to `BuildInfoSnapshot` is YAGNI. Add later if a renderer surface needs it.

### Changes Required

#### 1. `apps/desktop/forge.config.ts` — ad-hoc fallback

**File**: `apps/desktop/forge.config.ts`
**Changes**: Replace the `osxSign = ... : undefined` ternary so the empty-secrets path falls back to ad-hoc identity instead of unsigned.

> **Implementation note (added during execution):** The plan originally proposed `{ identity: "-" }` alone. In practice that silently produces an unsigned bundle — `@electron/osx-sign@1.3.3` defaults `identityValidation: true`, runs `security find-identity -v "-"`, finds nothing, throws "No identity found", and forge swallows the error. The bundle then crashes at launch with `SIGKILL (Code Signature Invalid)` once the FusesPlugin modifies the binary post-link. Three additional flags are required: `identityValidation: false` (so `-` is used as the literal codesign identity), `optionsForFile: () => ({ hardenedRuntime: false })` (must go through the per-file callback because `mergeOptionsForFile` only reads `hardenedRuntime` from `optionsForFile`, ignoring any top-level setting — confirmed by reading `node_modules/.../osx-sign/dist/esm/sign.js:100-127`), and `preAutoEntitlements: false` / `preEmbedProvisioningProfile: false` (neither applies meaningfully without a Developer ID). With hardened runtime left on, library validation rejects sibling frameworks at load time with "different Team IDs" because ad-hoc DRs are content-bound.

> **Latent bug discovered (out of scope, surfaced in code via comment):** The existing developer-id branch uses kebab-case keys (`hardened-runtime`, `signature-flags`, `entitlements-inherit`, `gatekeeper-assess`). `@electron/osx-sign@1.3.3` only reads camelCase. `OsxSignOptions = Omit<SignOptions, ...>` is a mapped type, and TypeScript doesn't excess-property-check across spread on mapped types — so these keys silently pass typecheck and silently get dropped at runtime. **When Phase A of the predecessor plan (`thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`) activates, notarization will fail because hardened runtime won't actually be enabled.** The fix is mechanical (rename keys to camelCase, move per-file ones into `optionsForFile`), but verifying it requires Apple secrets, so I'm flagging it inline in `forge.config.ts` rather than touching the dev-id branch in this PR. The first agent to provision the Apple secrets and exercise the dev-id path needs to apply the fix as a prerequisite.

```ts
const isDeveloperIdSigning =
  Boolean(process.env.APPLE_SIGNING_IDENTITY && process.env.APPLE_TEAM_ID);

const osxSign = isDeveloperIdSigning
  ? {
      identity: process.env.APPLE_SIGNING_IDENTITY,
      "hardened-runtime": true,
      "gatekeeper-assess": false,
      entitlements: resolve(
        import.meta.dirname,
        "build/entitlements.mac.plist"
      ),
      "entitlements-inherit": resolve(
        import.meta.dirname,
        "build/entitlements.mac.inherit.plist"
      ),
      "signature-flags": "library",
    }
  : {
      identity: "-",
      identityValidation: false,
      optionsForFile: () => ({ hardenedRuntime: false }),
      preAutoEntitlements: false,
      preEmbedProvisioningProfile: false,
    };
```

(`isDeveloperIdSigning` is inlined into the ternary directly — naming the boolean for a single-use site adds friction without clarifying anything. The explanatory comments are anchored at the branches themselves.)

Note: `osxSign` is now always truthy on darwin. The existing `...(osxSign && { osxSign })` spread at `forge.config.ts:60` continues to work (always splats now), no other change needed there.

`osxNotarize` block (`forge.config.ts:32-41`) stays exactly as-is — its env gate is independent and correctly stays inert when the Apple API vars are empty.

#### 2. `apps/desktop/package.json` — declare `signingMode` placeholder

**File**: `apps/desktop/package.json`
**Changes**: Add `"signingMode": "ad-hoc"` alongside the existing `"buildFlavor": "dev"`, `"buildNumber": "1"`, `"sparkleFeedUrl": ""` block at lines 69-71. The default in committed source is `"ad-hoc"` to match the dev-build reality (no Apple identity in dev). CI overrides to `"developer-id"` only when secrets are present (Phase 3).

```json
  "buildFlavor": "dev",
  "buildNumber": "1",
  "sparkleFeedUrl": "",
  "signingMode": "ad-hoc"
```

#### 3. `apps/desktop/src/shared/build-info-schema.ts` — extend schema

**File**: `apps/desktop/src/shared/build-info-schema.ts`
**Changes**: Add a `signingModeSchema` enum and include `signingMode` in `buildInfoSchema`.

```ts
import { z } from "zod";

export const buildFlavorSchema = z.enum(["dev", "preview", "prod"]);
export type BuildFlavor = z.infer<typeof buildFlavorSchema>;

export const signingModeSchema = z.enum(["ad-hoc", "developer-id"]);
export type SigningMode = z.infer<typeof signingModeSchema>;

export const buildInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildFlavor: buildFlavorSchema,
  buildNumber: z.string(),
  sparkleFeedUrl: z.string(),
  signingMode: signingModeSchema,
});

export type BuildInfo = z.infer<typeof buildInfoSchema>;
```

#### 4. `apps/desktop/src/main/build-info.ts` — populate from package.json

**File**: `apps/desktop/src/main/build-info.ts`
**Changes**: Add `signingMode` to the candidate object at lines 11-17. Reads from `packageJson.signingMode`.

```ts
const candidate = {
  name: packageJson.name,
  version: packageJson.version,
  buildFlavor: packageJson.buildFlavor,
  buildNumber: packageJson.buildNumber,
  sparkleFeedUrl: mainEnv.SPARKLE_FEED_URL ?? packageJson.sparkleFeedUrl,
  signingMode: packageJson.signingMode,
};
```

#### 5. `apps/desktop/src/shared/ipc.ts` — **no change**

`BuildInfoSnapshot` (lines 48-54) intentionally does not include `signingMode`. The renderer has no consumer for it. If a future banner is added, extend the snapshot then — not now.

### Success Criteria

#### Automated Verification:

- [x] `pnpm --filter @lightfast/desktop typecheck` passes (catches schema drift).
- [x] `pnpm check` passes (biome). (Pre-existing failure in unrelated untracked file `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` is from a different workstream; targeted `npx ultracite check` against the four Phase 1 files passes cleanly.)
- [x] Local ad-hoc package: `cd apps/desktop && pnpm exec electron-forge package --arch=arm64 --platform=darwin` exits 0 and produces `out/Lightfast-darwin-arm64/Lightfast.app`.
- [x] `codesign --display --verbose=4 apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app` reports `Signature=adhoc`, `Identifier=ai.lightfast.lightfast`, `flags=0x2(adhoc)` (no `linker-signed`, no `runtime`), `Sealed Resources version=2 rules=13 files=12`. `codesign --verify --deep --strict` exits 0 with all inner Frameworks validated.

#### Human Review:

- [x] Open `apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app` directly → app launches, runs for 8s+ with all 4 helper processes (main + GPU + network + renderer) alive, registers with Window Server (`lsappinfo find bundleid="ai.lightfast.lightfast"` returns ASN). The renderer's existing IPC snapshot parses cleanly (no schema validation errors in stderr). Note: launched with `LIGHTFAST_APP_ORIGIN=https://lightfast.ai` because local packages default to `buildFlavor: "dev"` which gates the origin to the env var; CI sets `buildFlavor=prod` which falls through to the production constant in `app-origin.ts:7`.

---

## Phase 2: Updater gating + Sentry tagging

### Overview

Defensively disable `initUpdater()` when `signingMode === "ad-hoc"` (see Implementation Approach above for rationale — Squirrel.Mac DR enforcement breaks ad-hoc updates and unsigned builds throw NSException at init). Add `signingMode` as a Sentry tag so the one-user beta still produces a filterable signal in the Sentry dashboard.

### Changes Required

#### 1. `apps/desktop/src/main/updater.ts` — gate on `signingMode`

**File**: `apps/desktop/src/main/updater.ts`
**Changes**: Add a third gate at lines 76-82, after the existing `app.isPackaged` and `buildFlavor === "dev"` returns. Comment includes the *why* per CLAUDE.md guidance — this is non-obvious behavior driven by Squirrel.Mac's DR check (load-bearing reason that would surprise a future reader).

```ts
export function initUpdater(): void {
  if (initialized) {
    return;
  }
  if (!app.isPackaged) {
    return;
  }
  const build = getBuildInfo();
  if (build.buildFlavor === "dev") {
    return;
  }
  // Squirrel.Mac requires the new build to satisfy the running app's
  // designated requirement. Ad-hoc DRs are content-bound — every build
  // has a different DR, so swap-in always fails. Disable updater here;
  // beta users (currently just jp) reinstall manually when v0.1.0 ships.
  if (build.signingMode === "ad-hoc") {
    return;
  }

  const feedUrl = resolveFeedUrl();
  // ... rest unchanged
```

#### 2. `apps/desktop/src/main/sentry.ts` — tag `signingMode`

**File**: `apps/desktop/src/main/sentry.ts`
**Changes**: Add `signingMode` to the `initialScope.tags` block at lines 47-52.

```ts
initialScope: {
  tags: {
    sessionId: SESSION_ID,
    bundle: "electron",
    host: "app",
    signingMode: build.signingMode,
  },
},
```

### Success Criteria

#### Automated Verification:

- [x] `pnpm --filter @lightfast/desktop typecheck` passes.
- [x] `pnpm check` passes. (Pre-existing failure in untracked `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` is unrelated; targeted `npx ultracite check` against the two Phase 2 files passes cleanly.)
- [x] Static check: `grep -n 'signingMode' apps/desktop/src/main/updater.ts` matches the new gate (line 88); `grep -n 'signingMode' apps/desktop/src/main/sentry.ts` matches the new tag (line 52).

#### Human Review:

- [x] Updater gate exercised: temporarily stamped `buildFlavor=prod` + `buildNumber=phase2-verify`, repackaged ad-hoc (`Signature=adhoc`, `flags=0x2(adhoc)`), launched the binary directly. Process tree alive past the 30s SQRLUpdater-init window (main + renderer + network helper, no SIGABRT, no NSException in stderr — only a benign "Unable to set login item" from macOS login-item perms). Confirms the new gate prevents the SQRLUpdater path. Stamping reverted post-test.
- [ ] **Sentry tag dashboard check deferred** — no `SENTRY_DSN` configured locally (`.env.example` only), so a real event can't land in the dashboard from this harness. Static path is confirmed: `sentry.ts:52` reads `build.signingMode` from the same `getBuildInfo()` value that Phase 1 verified. Worth a real-event check on the first deployed beta build with DSN populated.

---

## Phase 3: Workflow gating + prerelease auto-derivation

### Overview

Four coupled workflow changes that together let an `@lightfast/desktop@*-beta.*` tag push succeed without Apple secrets:

1. **In `prepare` job**: derive `prerelease` boolean from the tag (single source of truth — same job already parses the tag for `version`), expose as job output, and pass `--prerelease` to `gh release create` when applicable. **This is load-bearing**: PublisherGithub does not update existing releases' `prerelease` flag (verified by reading the publisher source — only sets it inside `createRelease`, never `updateRelease`). The flag must be set when the draft is first created, otherwise it stays `false` forever.
2. **In `build` job**: gate the two Apple-touching shell steps on `env.APPLE_SIGNING_IDENTITY != ''`.
3. **In `build` job**: stamp `signingMode` in the existing version-stamping step, derived from whether Apple secrets are present.
4. **In `build` job**: read `prerelease` from `needs.prepare.outputs.prerelease` and export to `$GITHUB_ENV` so `electron-forge publish`'s `forge.config.ts:47` check sees it (belt-and-suspenders for the `createRelease` fallback path).

### Changes Required

#### 1. `.github/workflows/desktop-release.yml` — derive prerelease in `prepare`, set `--prerelease` at draft creation

**File**: `.github/workflows/desktop-release.yml`
**Changes**: Extend the existing `prepare` job (lines 29-32 already parse the tag for `version`). Add a `prerelease` output and pass `--prerelease` conditionally to `gh release create`.

```yaml
  prepare:
    # ... existing
    outputs:
      version: ${{ steps.version.outputs.version }}
      tag: ${{ steps.version.outputs.tag }}
      prerelease: ${{ steps.version.outputs.prerelease }}
    steps:
      - name: Compute version + prerelease from tag
        id: version
        run: |
          tag="${{ github.ref_name }}"
          version="${tag#@lightfast/desktop@}"
          echo "tag=$tag" >> "$GITHUB_OUTPUT"
          echo "version=$version" >> "$GITHUB_OUTPUT"
          # Any hyphen-suffix (-beta.N, -rc.N, -alpha.N) is a semver prerelease.
          if [[ "$version" == *-* ]]; then
            echo "prerelease=true" >> "$GITHUB_OUTPUT"
          else
            echo "prerelease=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Create draft release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if ! gh release view "${{ steps.version.outputs.tag }}" >/dev/null 2>&1; then
            prerelease_flag=""
            if [ "${{ steps.version.outputs.prerelease }}" = "true" ]; then
              prerelease_flag="--prerelease"
            fi
            gh release create "${{ steps.version.outputs.tag }}" \
              --draft $prerelease_flag --generate-notes \
              --notes-start-tag "$(...existing logic...)"
          fi
```

The exact existing structure of the prepare job's `Create draft release` step should be preserved — only the `--prerelease` flag and the conditional are new. Keep `--generate-notes` and `--notes-start-tag` exactly as they are today.

#### 2. `.github/workflows/desktop-release.yml` — gate Apple steps in `build`

**File**: `.github/workflows/desktop-release.yml`
**Changes**: Add `if:` to both Apple-touching steps. Use `env.APPLE_SIGNING_IDENTITY` (already pulled from secrets at the job level, lines 68-71) to avoid the GitHub Actions `secrets.*` context restriction inside `if:` (secrets aren't directly accessible in step-level conditionals).

```yaml
      - name: Import Apple signing certificate
        if: env.APPLE_SIGNING_IDENTITY != ''
        env:
          APPLE_CERT_BASE64: ${{ secrets.APPLE_CERT_BASE64 }}
          APPLE_CERT_PASSWORD: ${{ secrets.APPLE_CERT_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # ... unchanged

      - name: Write notarize API key
        if: env.APPLE_SIGNING_IDENTITY != ''
        env:
          APPLE_API_KEY_CONTENT: ${{ secrets.APPLE_API_KEY_CONTENT }}
          APPLE_API_KEY_ID_SECRET: ${{ secrets.APPLE_API_KEY_ID }}
        run: |
          # ... unchanged
```

#### 3. `.github/workflows/desktop-release.yml` — stamp `signingMode` + export prerelease env

**File**: `.github/workflows/desktop-release.yml`
**Changes**: Extend the "Stamp version + feed URL in package.json" step at lines 92-98. Stamp `signingMode` based on `env.APPLE_SIGNING_IDENTITY`. Export `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE` from the prepare-job output to `$GITHUB_ENV` so subsequent steps (specifically `electron-forge publish`) see it.

```yaml
      - name: Stamp version, feed URL, signing mode, prerelease env
        working-directory: apps/desktop
        run: |
          npm version "${{ needs.prepare.outputs.version }}" --no-git-tag-version --allow-same-version
          npm pkg set buildFlavor=prod
          npm pkg set buildNumber="$GITHUB_RUN_NUMBER"
          npm pkg set sparkleFeedUrl='https://github.com/${{ github.repository }}/releases/latest/download/latest-mac-${arch}.json'
          if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
            npm pkg set signingMode=developer-id
          else
            npm pkg set signingMode=ad-hoc
          fi
          # forge.config.ts:47 reads LIGHTFAST_DESKTOP_RELEASE_PRERELEASE; the
          # value here only matters for the createRelease fallback (the prepare
          # job already set --prerelease on draft creation). Mirror it for
          # consistency.
          echo "LIGHTFAST_DESKTOP_RELEASE_PRERELEASE=${{ needs.prepare.outputs.prerelease }}" >> "$GITHUB_ENV"
```

### Success Criteria

#### Automated Verification:

- [x] YAML parses: validated with `pnpm dlx js-yaml .github/workflows/desktop-release.yml` (Python `pyyaml` not installed locally; node-side parser is equivalent for the syntax check).
- [ ] `actionlint .github/workflows/desktop-release.yml` (if installed) passes — catches `if:` syntax mistakes. _Skipped — `actionlint` not installed locally; falls back to YAML parse + grep._
- [x] Inspect rendered logic with: `grep -n -E "if: env.APPLE_SIGNING_IDENTITY|signingMode=|LIGHTFAST_DESKTOP_RELEASE_PRERELEASE|prerelease=|--prerelease" .github/workflows/desktop-release.yml`. Output: 2 `if: env.APPLE_SIGNING_IDENTITY != ''` gates (build-job lines 125, 141), 2 `signingMode=` branches in one block (lines 115/117), 1 `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE=` echo (line 122), 2 `prerelease=` outputs in `prepare` (lines 37/39 — true/false branches of one conditional), 1 `--prerelease` flag append in `gh release create` (line 58).
- [ ] **Live tag push (the actual gate test)**: `git tag @lightfast/desktop@0.1.0-beta.1 && git push origin @lightfast/desktop@0.1.0-beta.1`. The workflow runs to completion. The two Apple steps show as **skipped** in the GitHub Actions UI. The publish step succeeds. The release is undrafted as Pre-release.
- [ ] `gh release view '@lightfast/desktop@0.1.0-beta.1' --repo lightfastai/lightfast --json isPrerelease,assets | jq '.isPrerelease, (.assets | length)'` reports `true` and `>= 6` (4 binary artifacts + 2 feed JSONs minimum). **If `isPrerelease: false`**, the prepare-job `--prerelease` flag wasn't applied — verify the conditional in step 1 above. Recovery: `gh release edit '@lightfast/desktop@0.1.0-beta.1' --prerelease` flips it post-hoc, then fix the workflow for next tag.
- [ ] Download an asset and check signing: `gh release download '@lightfast/desktop@0.1.0-beta.1' --repo lightfastai/lightfast --pattern '*darwin-arm64*.zip' --dir /tmp/beta1 && unzip -q /tmp/beta1/*.zip -d /tmp/beta1-extracted && codesign --display --verbose=4 /tmp/beta1-extracted/Lightfast.app | grep Signature` reports `Signature=adhoc`. Confirms end-to-end that the workflow produced an ad-hoc-signed binary.

#### Human Review:

- [ ] Drag the downloaded `.dmg` to /Applications, double-click → see the "Apple cannot verify" dialog (not "damaged"). Confirms ad-hoc downgrades the dialog correctly on this Mac.
- [ ] Open System Settings → Privacy & Security, click "Open Anyway" for Lightfast, confirm with Touch ID → app launches. Confirms the Sequoia bypass flow works in practice.

---

## Phase 4: Install instructions (README only)

### Overview

Add a brief "Beta install (macOS)" section to `apps/desktop/README.md`. Solo-user scope, so a few lines suffice — enough that I (or a future Lightfast teammate handed this README) can install without re-deriving the Gatekeeper bypass from scratch.

### Changes Required

#### 1. `apps/desktop/README.md` — add Install section

**File**: `apps/desktop/README.md`
**Changes**: Insert a new "## Install (beta)" section before the existing "## Run" section at line 6. Reference the Pre-release on GitHub directly. Keep tone matter-of-fact; don't over-apologize for the Gatekeeper UX.

```markdown
## Install (beta)

The desktop app is currently distributed as ad-hoc-signed pre-release builds
while Apple Developer enrollment is in flight. macOS will show an "Apple cannot
verify Lightfast is free of malware" dialog on first launch — this is expected.

1. Download `Lightfast.dmg` from the latest [Pre-release](https://github.com/lightfastai/lightfast/releases?q=prerelease%3Atrue).
   Use `arm64` for Apple Silicon, `x64` for Intel.
2. Drag `Lightfast.app` to `/Applications`.
3. Double-click the app. Click **Done** on the dialog.
4. Open **System Settings → Privacy & Security**. Scroll to the Security
   section and click **Open Anyway** next to Lightfast (visible for ~1 hour
   after the blocked launch).
5. Confirm with Touch ID or your login password.

If the dialog instead reports "damaged and can't be opened", run
`xattr -cr /Applications/Lightfast.app` and try again. (This shouldn't happen
with ad-hoc builds, but is the recovery path if it does.)

When the signed v0.1.0 release ships, beta users **must reinstall manually** —
auto-update is disabled on ad-hoc builds because Squirrel.Mac requires the
new build to match the running app's designated requirement, and ad-hoc DRs
are content-bound (they change with every build).
```

### Success Criteria

#### Automated Verification:

- [ ] `grep -n 'Install (beta)' apps/desktop/README.md` matches.
- [ ] `pnpm check` passes (biome formats markdown if configured to).

#### Human Review:

- [ ] Re-read the section as if I had never installed the app before — steps 1-5 are sufficient to get from "I want to try this" to "the app is open" without referencing any other doc. No corrections needed.

---

## Testing Strategy

### Unit Tests

None — no testable units. The schema change in `build-info-schema.ts` is verified by `pnpm typecheck` propagating through every consumer.

### Integration Tests

Phase 3's "live tag push" is the integration test. Cannot be staged without burning a real tag, so it runs once at Phase 3 boundary. The test artifact is the `0.1.0-beta.1` release itself — if it goes wrong, the recovery is `gh release delete '@lightfast/desktop@0.1.0-beta.1' --yes && git tag -d @lightfast/desktop@0.1.0-beta.1 && git push --delete origin @lightfast/desktop@0.1.0-beta.1`, then fix and retry on `0.1.0-beta.2`.

### End-to-End

Phase 4's human-review step (install from the live release on my Mac) is the end-to-end check. If I can install and launch from the Pre-release, the system works end-to-end.

## Performance Considerations

None. The added gate in `updater.ts` is a no-op early return; the Sentry tag is one extra string in the init scope.

## Migration Notes

When Apple Developer enrollment completes (per `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` Phase A):

1. Provision the 8 Apple secrets per that plan's Phase A checklist.
2. Cut a new tag without `-beta.` suffix: `@lightfast/desktop@0.1.0`. The workflow auto-derives `LIGHTFAST_DESKTOP_RELEASE_PRERELEASE=false`, runs the Apple steps (now active because secrets are non-empty), and `npm pkg set signingMode=developer-id` runs in the stamp step. The published artifacts are signed and notarized; updater initializes normally on launch.
3. **Manually reinstall on my Mac** — `rm -rf /Applications/Lightfast.app` then download the v0.1.0 DMG and reinstall. Auth state at `~/Library/Application Support/Lightfast/auth.bin` (`auth-store.ts:19-21`) survives the reinstall, so no re-sign-in.
4. Subsequent v0.1.0+ updates flow through Squirrel.Mac normally.

No code changes needed at the migration point — Phase 1's `signingMode` field already supports both values, and the workflow stamps the correct value based on secret presence.

### Known follow-up: prerelease-to-prerelease updates won't work

The stamped `sparkleFeedUrl` points at `releases/latest/download/latest-mac-${arch}.json`. GitHub's `/releases/latest` endpoint **excludes prereleases**, so a hypothetical future RC-to-RC update path (e.g. `0.1.0-rc.1` → `0.1.0-rc.2`) would silently route to the prior stable release's feed. Not a beta.1 blocker (updater is gated off for ad-hoc), and not a v0.1.0 blocker (final releases are non-prerelease). But if we ever want stable-channel-isolated prereleases that auto-update, switch to a per-tag URL or maintain a `latest-prerelease-mac-*.json` shadow feed.

## References

- Original research: `thoughts/shared/research/2026-05-05-desktop-unsigned-beta-distribution.md`
- Predecessor plan (signed-path): `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` (Phase A is what unblocks the migration in this plan)
- Squirrel.Mac DR enforcement: `SQRLUpdater.m` `currentApplicationSignature` (vendored upstream)
- Apple Sequoia Gatekeeper changes: developer.apple.com/news 2024-08-06
- electron-builder ad-hoc fallback PR (April 2025): #9007 (referenced in research §1)
- Build-info threading precedent: `apps/desktop/src/shared/build-info-schema.ts:6-13` → `src/main/build-info.ts:11-18` → `src/shared/ipc.ts:48-54` → `src/preload/preload.ts:16-18` → `src/renderer/src/main.ts:23,39,52`

## Improvement Log

### 2026-05-05 adversarial review (4 changes)

1. **Dropped Phase 0 spike entirely.** The plan explicitly stated the spike result wouldn't change Phase 2's gate for v0.1.0-beta.1 (cert switch requires manual reinstall regardless), so 30+ min of manual machine work produced no shippable signal. Replaced with a defensive default in Phase 2 and a TODO in the gate's comment to revisit post-cert. **Side benefit**: also removed a methodology bug — the spike's `SPARKLE_FEED_URL=...` env was set on `electron-forge package` (build-time) but `mainEnv.SPARKLE_FEED_URL` is read at runtime via `process.env`, so the spike would have produced a false-negative when launched from Finder.
2. **Dropped IPC change for `signingMode`.** Plan originally added `signingMode` to `BuildInfoSnapshot` (`apps/desktop/src/shared/ipc.ts:48-54`). The renderer has no consumer (banner deferred indefinitely per Q1). Per YAGNI, `signingMode` now lives only in `build-info-schema.ts` and `build-info.ts`; main-process consumers (`updater.ts`, `sentry.ts`) read via `getBuildInfo()`. Smaller diff, fewer types to keep in sync.
3. **Moved tag parsing to `prepare` job.** Plan originally added a `Derive prerelease flag from tag` step inside the `build` matrix (which runs twice, once per arch). Tag parsing is now a single output of the `prepare` job (`prerelease`), consumed via `needs.prepare.outputs.prerelease`. Eliminates duplicate parsing.
4. **Spike-driven fix: `--prerelease` at draft creation.** Read `node_modules/@electron-forge/publisher-github` source — verdict REFUTED the original plan's assumption that PublisherGithub would flip an existing draft to Pre-release based on the `prerelease: true` config. The publisher's `publish()` only sends `prerelease` inside `createRelease`, never `updateRelease`. Since the `prepare` job creates the draft *first* (without `--prerelease`), the publisher would find that draft by `tag_name`, reuse it, upload assets, and leave `prerelease: false` intact. Phase 3 verification (`isPrerelease: true`) would have failed after a real tag burn. Fix: pass `--prerelease` to `gh release create --draft` in the prepare job (gated on the new `prerelease` output). The forge config flag stays as a safety net for the create path.

### Other minor edits

- Fixed env file path in Key Discoveries: was `env/main.ts:9`, now `apps/desktop/src/env/main.ts:9` (no `main/` segment in actual path).
- Dropped Phase 1's "developer-id smoke check" automated verification — depended on osx-sign behavior with a fake identity, which can pass-with-warning instead of fail. Ad-hoc check + typecheck + biome are sufficient.
- Added Migration Notes follow-up: `releases/latest/download/...` excludes prereleases, so a future prerelease-to-prerelease update channel needs a per-tag URL or shadow feed. Out of scope for this plan, flagged for future-self.

### Spike record

- **Spike**: read `@electron-forge/publisher-github@7.11.1` source to verify prerelease flag handling on existing releases.
- **Verdict**: REFUTED — `prerelease` is only sent inside `createRelease` (the catch-block fallback for the synthetic 404 from listReleases lookup). When a release already exists by `tag_name`, the publisher proceeds straight to `uploadReleaseAsset` with no metadata update. Source: `node_modules/.pnpm/@electron-forge+publisher-github@7.11.1/.../dist/PublisherGithub.js` lines 44-66.
- **Plan impact**: Phase 3 changes 2 → 4 (added prepare-job tag parsing + `--prerelease` at draft creation as the load-bearing fix). Forge config flag retained as create-path safety net.
