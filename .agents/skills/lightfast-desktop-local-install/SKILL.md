---
name: lightfast-desktop-local-install
description: |
  Build and install the Lightfast desktop app locally as a daily-driver,
  bypassing the CI tag-burn / GitHub Releases pipeline. Triggers when the
  user asks to install, refresh, rebuild, or update their local Lightfast
  desktop app, or wants a prod-stamped `Lightfast.app` in `/Applications`
  without publishing to GitHub. The artifact this skill produces is
  functionally equivalent to what the `desktop-release.yml` workflow would
  ship for an ad-hoc beta — same `Signature=adhoc`, same bundle ID, same
  `signingMode=ad-hoc` runtime gates — but skips Sentry source-map upload,
  build provenance attestation, and the GitHub release artifact. macOS arm64
  only.
---

# Lightfast Desktop Local Install Skill

Runbook for producing a prod-stamped, ad-hoc-signed `Lightfast.app` from
the local workspace and installing it to `/Applications`. Use this any time
you want to update your daily-driver desktop app without going through the
release workflow — e.g. after pulling main, after a desktop-touching PR
merges, or when you just want to test what shipped today.

## When to use

You want a working `/Applications/Lightfast.app` and you don't need the
artifact to live on GitHub Releases. Specifically:

- **Solo or hand-installed beta.** Audience is just you (or a teammate
  you'll hand the `.app` to over Slack/AirDrop). No need for the tag-burn
  Pre-release page.
- **Quick post-merge refresh.** Main has new desktop work, you want it
  installed in 90 seconds without waiting for CI.
- **Pre-tag dry run.** You want to see what a real ad-hoc release will
  look like before burning a tag.

If the audience is "anyone else with the URL", use the tag-burn flow
instead (`git tag @lightfast/desktop@<version> && git push origin <tag>`)
— that path adds Sentry source maps, build attestation, and a hosted
artifact, none of which this skill produces.

## Why this skill exists

The `desktop-release.yml` workflow is the canonical path for shipping
desktop builds, but it's overkill for solo use. The Phase 1 + Phase 2
work merged in #637 (commit `ab634170e`) made local prod-packaged
ad-hoc bundles viable:

- **Phase 1** added the ad-hoc fallback in `forge.config.ts` with the
  four supporting flags (`identityValidation: false`,
  `optionsForFile: () => ({ hardenedRuntime: false })`, etc.) so the
  bundle isn't `SIGKILL`'d at launch by `FusesPlugin` post-link patching.
- **Phase 2** added `if (build.signingMode === "ad-hoc") return;` to
  `initUpdater()` so `SQRLUpdater.init` is never called on an ad-hoc
  bundle. Squirrel.Mac requires the new build to satisfy the running
  app's designated requirement; ad-hoc DRs are content-bound, so any
  swap-in fails — the gate prevents the `NSException` that would
  otherwise crash the app on prod-stamped launch.

Without those, a local `electron-forge package` produced either an
unsigned bundle (Gatekeeper "damaged" dialog, no recovery on macOS 15+)
or a prod-stamped bundle that crashed on the 10-second SQRLUpdater
timer. With them, the local build matches what CI would publish.

## Build and install

From repo root:

```bash
# 1. Stamp prod + a meaningful buildNumber. "local" tags Sentry releases
#    as @lightfast/desktop@<version>+local, distinguishing them from CI
#    builds (which use $GITHUB_RUN_NUMBER).
cd apps/desktop
npm pkg set buildFlavor=prod buildNumber=local

# 2. Package. arm64 is the default for Apple Silicon; pass --arch=x64
#    instead if you need an Intel build.
pnpm exec electron-forge package --arch=arm64 --platform=darwin
cd ../..

# 3. Verify ad-hoc signature. Expect Signature=adhoc, flags=0x2(adhoc),
#    Identifier=ai.lightfast.lightfast. If anything else, abort.
codesign --display --verbose=4 \
  apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app \
  | grep -E "Signature|flags|Identifier"
codesign --verify --deep --strict \
  apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app

# 4. Install. Quit any running instance first (Cmd+Q on the dock icon
#    or kill the process); cp will fail on a running binary.
rm -rf /Applications/Lightfast.app
cp -R apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app /Applications/

# 5. Restore package.json so the working tree stays clean. The committed
#    defaults are buildFlavor=dev / buildNumber=1.
cd apps/desktop
npm pkg set buildFlavor=dev buildNumber=1
cd ../..

# 6. Clean the build output. out/ is gitignored but stale artifacts can
#    confuse a follow-up smoke test.
rm -rf apps/desktop/out
```

## First-launch Gatekeeper dance

Ad-hoc-signed apps trigger macOS's "Apple cannot verify Lightfast is
free of malware" dialog on first launch. This is expected — the bundle
is signed, just not by a Developer ID Apple recognizes.

1. Double-click `Lightfast.app` in `/Applications`.
2. Click **Done** on the dialog (no Cancel/OK trick needed).
3. Open **System Settings → Privacy & Security**, scroll to the Security
   section, click **Open Anyway** next to Lightfast (visible for ~1 hour
   after the blocked launch).
4. Confirm with Touch ID or your login password.

Subsequent launches go straight through with no dialog.

If the dialog instead reports "damaged and can't be opened", run
`xattr -cr /Applications/Lightfast.app` and retry. This shouldn't happen
with ad-hoc builds (it's the unsigned-bundle failure mode), but is the
recovery path if it does.

## Verification (optional smoke test)

If you want to confirm the Phase 2 updater gate before relying on the
install:

```bash
# Launch directly via the executable, capture stderr.
/Applications/Lightfast.app/Contents/MacOS/Lightfast \
  > /dev/null 2> /tmp/lightfast-launch.log &
LIGHTFAST_PID=$!

# Wait past the 10-second SQRLUpdater timer window. If the gate is
# working, the process stays alive past it; if not, you'd see
# NSException / SIGABRT in the log here.
sleep 30

ps -p $LIGHTFAST_PID -o pid,etime,stat,command   # should still be alive
lsappinfo find bundleid="ai.lightfast.lightfast" # should print an ASN
grep -iE 'NSException|SIGABRT|Squirrel' /tmp/lightfast-launch.log \
  || echo "(clean stderr)"

# Kill when done.
kill $LIGHTFAST_PID
```

A benign `Unable to set login item: Operation not permitted` is fine —
that's macOS denying the login-item entitlement, unrelated to the
updater path.

## Boundaries

- **macOS arm64 only.** The skill uses `--arch=arm64` and assumes
  Apple Silicon. For Intel hardware swap to `--arch=x64`. Linux and
  Windows local-install are out of scope.
- **Not a substitute for tag-burn for distribution.** The local build
  doesn't upload source maps to Sentry — prod crash stack traces in
  the Sentry dashboard will be unmapped against the obfuscated bundle.
  This matters once there's more than one user.
- **No auto-update.** The Phase 2 gate disables `SQRLUpdater` on ad-hoc
  builds (Squirrel.Mac DR enforcement). When a new daily-driver lands,
  re-run this skill manually — the running app won't notice.
- **Bundle ID is `ai.lightfast.lightfast`.** Earlier dev builds used
  `ai.lightfast.desktop`; if a stale install of that lingers, macOS
  treats it as a different app. Remove it explicitly:
  `rm -rf /Applications/Lightfast.app` before the `cp` (this skill's
  step 4 already does this). User-data paths (`~/Library/Application
  Support/Lightfast/`, including the persisted Clerk auth token) are
  unchanged across installs of the same bundle ID.
- **Doesn't start the API mesh.** The installed app expects production
  `https://lightfast.ai` to be reachable for tRPC + Clerk auth. If
  you're testing against a local backend, set `LIGHTFAST_APP_ORIGIN`
  via the desktop env file or use the dev flow (`pnpm dev:desktop` +
  the `lightfast-electron` skill) instead.
