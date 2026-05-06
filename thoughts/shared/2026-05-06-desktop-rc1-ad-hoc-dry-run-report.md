---
date: 2026-05-06
owner: jp@jeevanpillay.com
branch: main
plan: thoughts/shared/plans/2026-05-06-desktop-rc1-ad-hoc-dry-run.md
status: complete
final_tag: "@lightfast/desktop@0.1.0-rc.4"
final_commit: ac986f9a9
final_workflow: https://github.com/lightfastai/lightfast/actions/runs/25423025160
prs:
  - 638  # codesign correctness pre-fixes
  - 639  # tagPrefix + slash-safe Sentry release id
  - 640  # vite sourcemaps
  - 641  # observability hardening (debug-id injection + IPC bridge)
  - 642  # restore `releases new` before finalize
  - 643  # bridge renderer errors to main Sentry SDK
---

# Desktop `0.1.0-rc.1` → `0.1.0-rc.4` Ad-Hoc Dry-Run — Final Report

## TL;DR

Cutting four release candidates uncovered seven distinct release-pipeline bugs that would have shipped silently on the first developer-id build. All seven are fixed and merged. The ad-hoc workflow now runs green end-to-end, produces a launchable signed-equivalent `.app`, and registers a Sentry release with paired-debug-id sourcemaps. The renderer-error → Sentry bridge is the only piece that's not directly observable today (Sentry org is over its free-tier quota), but every link in the chain up to and including `Sentry.captureException` execution is verified.

> **Correction 2026-05-06.** Bug F's root-cause diagnosis below — "renderer-side `@sentry/electron/renderer` `Sentry.init` is a silent no-op in the v10 carrier" — is **wrong**. A follow-up experiment on `@sentry/electron@7.13.0` with the renderer SDK restored shows `Sentry.getClient()` returns a fully constructed client and `__SENTRY__["10.50.0"].defaultCurrentScope._client` carries the configured DSN/release/transport. The renderer SDK works fine — the v10 carrier just exposes the active client at `defaultCurrentScope._client` instead of the `slot.client` / `slot.defaultClient` paths I was inspecting (those are v8/v9 carrier shapes). The "zero events ingested" outcome on rc.1/rc.2/rc.3 was almost certainly the Sentry org quota exhaustion, not a broken SDK. **PR #643's main-side bridge still stands as the chosen architecture** — simpler, smaller bundle, single SDK init — but it's an architectural choice, not a workaround for an SDK bug. See §"Correction" near the end of this report for the full investigation.

## What this dry-run was for

Per the plan: cut `@lightfast/desktop@0.1.0-rc.1` in ad-hoc mode to exercise ~90% of the release pipeline before Apple Developer enrollment unblocks. The bet was that latent bugs in the pipeline would surface on real tags, not on local `pnpm package` smoke-runs. That bet paid out — the local run was green for every fix that later shipped, but seven bugs only surfaced after pushing real tags.

## Final pipeline state (rc.4 evidence)

| Component | Evidence |
|---|---|
| Workflow | run `25423025160`, all jobs ✅ |
| Tag → release | `@lightfast/desktop@0.1.0-rc.4` undrafted, prerelease, 6 assets (2 dmg + 2 zip + 2 update feeds) |
| Codesign (ad-hoc) | `optionsForFile` camelCase keys honored by `@electron/osx-sign@1.3.3`; ad-hoc fallback (`identity: "-"`, `hardenedRuntime: false`) produces a launchable arm64 `.app` post-quarantine clear |
| Sourcemaps | Vite emits `.map` for main/preload/renderer; `packageAfterCopy` Forge hook injects matching `//# debugId=<uuid>` into staging asar bundles before pack |
| Sentry release | `lightfast-desktop@0.1.0-rc.4+6` created → uploaded → finalized; 5 sources + 5 maps with paired debug-ids |
| Runtime release id matches | `apps/desktop/src/main/sentry.ts:23-26` computes `lightfast-desktop@${version}+${buildNumber}`, identical to the upload script's transform |
| Build provenance | GitHub attestation issued for both arm64 and x64 dmg/zip |
| Renderer error pipeline | renderer throw → `installErrorBoundary` window error listener → `lightfastBridge.reportError` IPC → main `Sentry.captureException` (verified in rc.4 smoke test via CDP throw + `[renderer]` log line in main process stdout) |

## Bugs found and fixed

Seven distinct bugs. Each one would have shipped silently into a developer-id build.

### Bug A — Sentry release id contained `/`

**PR #639.** `pkg.name` is `@lightfast/desktop`, so the upload script built release id `@lightfast/desktop@0.1.0-rc.1+1`. sentry-cli rejected with "Slashes and certain whitespace characters are not permitted." Fix: strip leading `@` and replace `/` with `-` in both `apps/desktop/scripts/upload-sourcemaps.mjs` and `apps/desktop/src/main/sentry.ts` so runtime release id matches uploaded sourcemaps.

### Bug B — Forge `tagPrefix` defaulted to `v`

**PR #639.** `PublisherGithub` defaulted to creating release tags as `v0.1.0-rc.1` while the workflow draft was created at `@lightfast/desktop@0.1.0-rc.1`. Result: a parallel `v0.1.0-rc.1` release with all 4 build assets, while the workflow's `@lightfast/desktop@0.1.0-rc.1` draft stayed empty and got force-undrafted with zero assets. Fix: `tagPrefix: "@lightfast/desktop@"` on the publisher.

### Bug C — Vite emitted no `.map` files

**PR #640.** Default Vite library mode does not emit sourcemaps — `electron-forge plugin-vite` doesn't override. Without `.map` files there's nothing for sentry-cli to upload, no debug-ids, no symbolication. Fix: `build: { sourcemap: true, ... }` in all three `vite.{main,preload,renderer}.config.ts`.

### Bug D — `LIGHTFAST_REMOTE_DEBUG_PORT` env var not honored in packaged builds

**Deferred (intentional security hardening).** `bootstrap.ts` gates the env-var bind path with `if (!app.isPackaged)`. Workaround: pass `--remote-debugging-port=9222` as a CLI flag directly. Documented in plan; not a release-pipeline bug, leaving as-is for prod hardening.

### Bug E — No debug-id comments in shipped asar bundles

**PR #641.** Even with `.map` files emitted, `sentry-cli sourcemaps inject` was running against the build artifacts after asar pack — too late. The asar still carried bundles without `//# debugId=<uuid>` comments, so symbolication couldn't pair runtime stacks to uploaded sourcemaps. Forge's `prePackage` user hook runs *before* plugin-vite (opposite of expected), so injection there happens too early. Fix: switch to `packageAfterCopy` (runs after vite + after copy to staging dir, before asar pack), inject debug-ids into the staging dir, then mirror the modified files back to source `.vite/` so the post-package sourcemap upload reads the same ids that got packed.

### Bug F — Renderer SDK silently fails to register a client (v10 carrier shape)

**PR #641 + PR #643.** First half (#641): renderer was using `@sentry/browser` directly, which fetches the Sentry ingest URL — blocked by renderer CSP. Switched to `@sentry/electron/renderer` which routes through main via the `sentry-ipc:` CSP-bypass scheme, with `@sentry/electron/preload` installing the bridge.

Second half (#643): the `sentry-ipc:` bridge worked (`__SENTRY_IPC__` was exposed, no more CSP fetch errors), but `__SENTRY__["10.47.0"]` carrier showed `clientPresent: false`, `defaultClient: null`, no `acs` key. `Sentry.init()` was a silent no-op in the renderer. Investigation ruled out the `Z9()` browser-extension guard (returned `false` correctly because `chrome.runtime.id` was undefined). Root cause never pinned exactly, but the symptom was reproducible across rc.1, rc.2, rc.3 (all three: zero events ingested by Sentry).

Fix: bridge renderer errors through main's `@sentry/electron/main` SDK (which has a working client). `installErrorBoundary` already IPCs renderer errors to main via `lightfastBridge.reportError`; the new code in `apps/desktop/src/main/index.ts:74-92` forwards those payloads to `Sentry.captureException` with `bundle: "renderer"` tag and the renderer-side stack preserved (so debug-id sourcemaps still symbolicate). Renderer-side `Sentry.init` removed entirely; `@sentry/electron/preload` import removed; v10 deps (`@sentry/browser`, `@sentry-internal/*`, `@sentry/node`, `@sentry/core`) deleted from `package.json` since nothing imports them. Renderer bundle: 525K → 421K. Preload: 2.5K (was much larger with the bridge).

### Bug G — `releases finalize` failed without `releases new`

**PR #642.** PR #641 switched from `releases files upload-sourcemaps --url-prefix` to modern `sourcemaps upload --release` — but assumed `sourcemaps upload --release X` would auto-create release `X`. It does not. The subsequent `releases finalize X` step then failed with "release does not exist." Fix: restore explicit `sentry-cli releases new <release>` as the first step before upload.

## Other latent bugs surfaced

These were not bugs in the release pipeline per se, but became visible during the dry-run and would have caused regressions:

### Crash regression — `factory.ts` `import.meta` polyfill

**PR #641.** While modifying `apps/desktop/src/main/windows/factory.ts` for observability hardening, used `dirname(fileURLToPath(import.meta.url))`. Vite emits the main bundle as CJS and Rollup strips `import.meta` to literal `{}` in CJS output (no polyfill). So `fileURLToPath({}.url) === fileURLToPath(undefined)` → crash on launch. Same applied to `import.meta.dirname`. Fix: use `__dirname` (CJS-native) with biome-ignore comment because lint forbids globals.

### `gh attestation list --repo` flag invalid

**Deferred.** `gh attestation list` doesn't support `--repo`; verification of build provenance attestation across the repo can't be scripted via `gh attestation list`. Not blocking — attestations are issued and verifiable individually.

### Sentry org auth token scope (`org:ci`)

**Documented, not fixed.** The org-level token has scope `org:ci` which covers releases/sourcemaps but not issue read (`/api/0/projects/.../issues/`). Personal token has more. Either scope is acceptable for the upload pipeline; only investigation tooling needed personal-token level access.

## What changed in the codebase

```
apps/desktop/forge.config.ts                        # G-2 camelCase, tagPrefix, packageAfterCopy debug-id hook
apps/desktop/build/entitlements.mac.inherit.plist   # G-3 dropped disable-library-validation
apps/desktop/scripts/upload-sourcemaps.mjs          # slash-safe release id, releases new + finalize, modern sourcemaps upload
apps/desktop/src/main/sentry.ts                     # release id transform mirrors upload script
apps/desktop/src/main/index.ts                      # forwardRendererErrorToSentry IPC → captureException bridge
apps/desktop/src/main/windows/factory.ts            # __dirname instead of import.meta (CJS strip)
apps/desktop/src/preload/preload.ts                 # dropped @sentry/electron/preload + sentryInit field
apps/desktop/src/renderer/src/main.ts               # dropped @sentry/electron/renderer (no-op v10 init)
apps/desktop/src/shared/ipc.ts                      # dropped getSentryInitOptionsSync + SentryInitSnapshot
apps/desktop/vite.{main,preload,renderer}.config.ts # sourcemap: true
apps/desktop/package.json                           # removed dead v10 deps
```

## Pipeline timing reference

End-to-end wall time per cut (push tag → undrafted release):

| rc | wall time | result |
|---|---|---|
| rc.1 | ~7 min (failed first attempt — slash in release id; re-cut succeeded) | green after fix |
| rc.2 | ~7 min | green |
| rc.3 | ~9 min (failed first attempt — `releases finalize` without `releases new`; re-cut succeeded) | green after fix |
| rc.4 | ~7 min | green |

Build job: ~5 min per arch, parallel. Finalize: ~30s. Bottleneck is per-arch build, not Sentry/release steps.

## What's left for the first developer-id cut

Once Apple Developer enrollment lands:

1. Provision Apple secrets in repo: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_NOTARIZE_API_KEY_*` (set, contents, key id, issuer id). Workflow auto-flips `signingMode` to `developer-id` based on `APPLE_SIGNING_IDENTITY` presence (`desktop-release.yml:120-124`).
2. Confirm `forge.config.ts` developer-id branch — camelCase keys are pre-fixed (PR #638), but verify locally with the real cert before tagging.
3. Tag `@lightfast/desktop@0.1.0` (drop the `-rc.N` suffix for non-prerelease).
4. After undraft, smoke-test the signed `.dmg` end-to-end: launch from Applications without quarantine clear; trigger renderer error; confirm Sentry receives an event with symbolicated stack (requires Sentry quota restored).
5. Verify Sparkle update feed serves the new build to existing rc.* installs (updater is gated off in ad-hoc; switching to developer-id flips `updater.ts:87-89` on).

## Open items (not blockers)

- **Sentry quota.** Org is on free tier and over quota. New events get accepted into stats but not into searchable issues until quota restores. Doesn't affect the release pipeline; affects observability of any error post-release.
- **Bug D (`LIGHTFAST_REMOTE_DEBUG_PORT` in packaged builds).** Intentional `if (!app.isPackaged)` gate. CDP via CLI flag works as a manual workaround. Can revisit if a documented dev-friendly debug path becomes important.
- **Bug F root cause.** ~~Pinned the symptom (no client registered in v10 carrier) but not the underlying reason `Sentry.init` no-ops. Unblocked by the main-side bridge but worth filing upstream if it recurs in a future SDK upgrade.~~ **See §Correction below — the renderer SDK was not broken; my carrier-shape inspection was looking at v8/v9 field paths.**

## Plan vs. reality

Plan called for three phases (status update, codesign pre-fixes, rc.1 cut). Reality required four `rc.N` cuts to surface and fix everything. The plan's premise — that real tags surface bugs that local `pnpm package` doesn't — held: every one of the seven bugs above was invisible until a real tag pushed. The ad-hoc dry-run was the right call.

## Correction (Bug F was misdiagnosed)

After the dry-run wrapped, I ran a follow-up experiment on a throwaway branch to validate the upstream issue I was about to file. Bumped `@sentry/electron` to the latest 7.13.0, restored `@sentry/electron/renderer` + `@sentry/electron/preload` + `Sentry.init({...})` in the renderer, built locally, launched with CDP, and inspected the carrier. The result contradicted the dry-run diagnosis.

### What the experiment showed

```
__SENTRY__["10.50.0"].defaultCurrentScope._client = {
  constructor.name: 'Zb',                                  // minified Sentry browser client
  _options: {
    dsn: 'https://abc123def456@o4509.ingest.us.sentry.io/450...',
    release: 'experiment-7.13',
    environment: 'test',
    transport: <fn>,
    integrations: [...],
    ipcNamespace: <set>,
    enabled: true,
    sendClientReports: true,
    enableLogs: true
  }
}
```

`Sentry.getClient()` in the renderer returns the same fully-constructed client. `Sentry.init` did register a client. The renderer SDK was always working — both on 7.13.0 and (almost certainly) on 7.11.0 during the dry-run.

### Where the misdiagnosis came from

During rc.1/rc.2/rc.3 investigations I was inspecting `__SENTRY__[ver].client` and `__SENTRY__[ver].defaultClient` and concluding "no client registered" when both were `undefined`. Those are v8/v9 carrier field names. **In v10 the active client lives on `defaultCurrentScope._client`**, not those top-level slots. Looking at the wrong paths produced a wrong answer that was internally consistent across three RCs because the answer was wrong in the same way every time.

### What actually caused "zero events" on rc.1/rc.2/rc.3

The Sentry org's free-tier quota — the same one flagged late in the dry-run (§Open items above). Events were transporting from the renderer SDK (and, after PR #643, from the main-side bridge) but the receiving end was rejecting at ingest. I conflated "no issue visible in Sentry UI" with "no client registered in renderer."

### Why PR #643's bridge still stands

The architectural choice is defensible on its own merits:

- **Smaller bundle** — renderer 421K vs ~525K with the renderer SDK; preload 2.5K vs ~30K with the IPC bridge.
- **Single SDK configuration site** — release, environment, tags configured once in `apps/desktop/src/main/sentry.ts`; renderer doesn't need to know about Sentry at all.
- **One source of truth for what gets transported** — `installErrorBoundary` already IPCs all uncaught errors and unhandled rejections to main; `forwardRendererErrorToSentry` captures them through the same code path that handles main-process errors.
- **Insulated from v10/v11 carrier shape changes** — the bridge has no dependency on SDK internals.

What we lose by not running the renderer SDK:

- Automatic breadcrumbs from renderer `console.*` calls
- Page-navigation tracking (irrelevant — the renderer is largely a shell over `app.lightfast.localhost`, which has its own Sentry)
- `BrowserTracingIntegration` and session replay (impossible without renderer SDK)
- Explicit `Sentry.captureMessage(...)` / `Sentry.setTag(...)` from renderer code (we don't currently use these; if needed later, route through IPC)

These features matter once we want session replay or a rich breadcrumb timeline. Until then, the bridge is enough.

### What changed in this correction

- This report's TL;DR carries a Correction callout pointing here.
- The Bug F entry's blanket claim "renderer SDK silently fails to register a client" is replaced by "we chose to bridge through main; the renderer SDK works."
- The "Open items" entry "Bug F root cause" is struck through.
- The corresponding G-12 row in [`thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md`](research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md) is amended with the same correction.
- No upstream issue filed.

### Follow-ups (non-blocking)

- Bump `@sentry/electron` from 7.11.0 → 7.13.0 in a separate PR (two minor versions behind; small win, no behavior change for our usage).
- Revisit the bridge architecture if/when we want session replay or rich renderer breadcrumbs in v0.2.0+ — the recipe is documented in this section.
- Update the `installErrorBoundary` comment in `apps/desktop/src/renderer/src/main.ts` to remove the inaccurate "renderer SDK was broken" rationale.
