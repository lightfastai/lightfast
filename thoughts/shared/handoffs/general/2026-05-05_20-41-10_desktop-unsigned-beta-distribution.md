---
date: 2026-05-05T20:41:10+1000
researcher: Jeevan Pillay
git_commit: c74eaf3cf29d5dbecc7dfef61b14a16ed2239fc7
branch: portless-proxy-rename-and-tightening
repository: lightfast
topic: "Desktop unsigned beta distribution — Phase 2 done, Phase 3 partly applied, tag-burn paused on CORS blocker"
tags: [handoff, desktop, electron, release-workflow, cors, gatekeeper]
status: complete
last_updated: 2026-05-05
last_updated_by: Jeevan Pillay
type: handoff
---

# Handoff: desktop unsigned beta distribution — paused on CORS blocker before tag burn

## Task(s)

Implementing `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md`.

- **Phase 1 (ad-hoc fallback + `signingMode` schema/build-info threading)** — plan checkboxes claim complete, **but source not present in current working tree** (see "Critical state mismatch" below).
- **Phase 2 (updater gate on `signingMode === "ad-hoc"` + Sentry tag)** — plan checkboxes claim complete, source not present in current working tree.
- **Phase 3 (workflow gating + prerelease auto-derivation + signingMode stamp)** — plan checkboxes show YAML/grep static checks done. Only one piece of source survives: a release-notes safety branch in `.github/workflows/desktop-release.yml`. The four core Phase 3 edits (prerelease output, `--prerelease` at draft creation, signingMode stamp, Apple-step `if:` gating) are not in the working tree.
- **Phase 4 (README install instructions)** — not started.
- **Pre-flight readiness audit** — completed; surfaced one hard blocker (CORS) and two minor open items (Clerk JWT template, release-notes blast radius).

## Plan State

Plan: `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md`.

- Current phase per plan checkboxes: Phase 3 paused at the live tag-burn boundary.
- Actual current phase per source state: Phases 1, 2, and 3 mostly need to be re-applied (only the Phase 3 release-notes else-branch survives). Plan checkbox state is **stale relative to source**.
- Blocked items:
  - Live tag push (Phase 3) — blocked on CORS fix below.
  - README install instructions (Phase 4) — not blocked, just not started.
- Deferred verification: Sentry-dashboard tag check (no local DSN; flagged on first deployed beta build).

## Critical State Mismatch

The plan file in `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md` shows Phase 1 fully ticked and Phase 2 / Phase 3 partially ticked, but the corresponding source changes are **not present** in the current working tree on `portless-proxy-rename-and-tightening`:

- `apps/desktop/src/shared/build-info-schema.ts` — has no `signingModeSchema` enum, no `signingMode` field on `buildInfoSchema`. Phase 1 schema work missing.
- `apps/desktop/src/main/build-info.ts` — no `signingMode` reference. Phase 1 wiring missing.
- `apps/desktop/package.json` — no `signingMode` field; `buildFlavor: "dev"`. Phase 1 default-stamp missing.
- `apps/desktop/src/main/updater.ts` — no `signingMode === "ad-hoc"` gate. Phase 2 missing.
- `apps/desktop/src/main/sentry.ts` — `initialScope.tags` has only `sessionId` / `bundle` / `host`. Phase 2 missing.
- `apps/desktop/forge.config.ts` — modified on this branch but only for an unrelated bundle-ID rename (`ai.lightfast.desktop` → `ai.lightfast.lightfast`). The Phase 1 ad-hoc fallback (`identityValidation: false`, `optionsForFile: () => ({ hardenedRuntime: false })`, etc.) is missing.
- `.github/workflows/desktop-release.yml` — only modification is the release-notes else-branch (lines 41-50 of working tree). The four core Phase 3 edits are missing.

`desktop-portless-runtime-batch` (the original branch at session start, now at commit `dcd58acc7`) **also does not contain the Phase 1/2/3 source work** — confirmed by `git show desktop-portless-runtime-batch:apps/desktop/src/shared/build-info-schema.ts`. Most likely the work was lost via a branch switch + restore at some point.

The next agent should treat Phase 1, 2, and most of Phase 3 as **needing re-implementation**, then re-run automated verification before re-checking the plan boxes.

## Critical References

- Plan: `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md` (treat checkboxes as aspirational until source is re-applied)
- Predecessor plan (signed path / Apple-cert provisioning): `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md`
- Research basis: `thoughts/shared/research/2026-05-05-desktop-unsigned-beta-distribution.md`
- tRPC CORS handler under audit: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
- Desktop renderer loader: `apps/desktop/src/main/windows/factory.ts` (uses `BrowserWindow.loadFile` in packaged mode → `file://` → `Origin: null`)

## Recent Changes

All changes uncommitted.

- `.github/workflows/desktop-release.yml` (working tree, ~6-line diff vs HEAD): adds an `else` branch in the `Create draft release if missing` step so that when no prior `@lightfast/desktop@*` tag exists, `gh release create` uses `--notes "Initial Lightfast desktop beta..."` instead of `--generate-notes`. Avoids dumping all 5,394 commits into the public release page on the first beta tag. The four other Phase 3 edits (prerelease output, `--prerelease` at draft creation, signingMode stamp, Apple-step gating) are **not** in the working tree.
- `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md` (working tree, modified earlier in session): Phase 2 + Phase 3 verification checkboxes ticked, including the manual updater-gate runtime check from a prod-stamped local ad-hoc build. **These checkboxes are stale relative to source state** — Phase 2 source isn't applied right now.
- `apps/desktop/forge.config.ts` (working tree): unrelated bundle-ID rename `ai.lightfast.desktop` → `ai.lightfast.lightfast`. Not part of this plan.

No commits made during this session.

## Verification

| Check | Status | Notes |
|---|---|---|
| `pnpm --filter @lightfast/desktop typecheck` | passed | run during Phase 2 work, when source was present. Will need to re-pass after re-applying Phase 1/2 source. |
| `npx ultracite check` on Phase 2 files | passed | targeted; root `pnpm check` has a pre-existing unrelated failure in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs`. |
| Updater-gate live runtime check | passed | repackaged ad-hoc with `buildFlavor=prod`, launched binary, alive 30 s+ past the SQRLUpdater init window with no NSException. Source for the gate is no longer in the tree, so this evidence is provisional pending re-apply. |
| Sentry-tag dashboard check | deferred | no local `SENTRY_DSN` configured; flag for first deployed beta. |
| Bundle audit (Phase 2 ad-hoc package) | passed | extracted `app.asar`, no `.map` files, no Sentry tokens, no Clerk keys, no `/Users/...` filesystem path leaks, URL inventory limited to public docs + `https://lightfast.ai`. The audited artifact is at `apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app` but is now stale relative to the source tree (which lacks the Phase 1/2 changes that built it). |
| YAML parse on workflow | passed | `pnpm dlx js-yaml`. |
| `actionlint` on workflow | skipped | not installed locally. |
| Live tag push | not run | gated on CORS fix. |

## Debug Evidence

- **runtime block**: launched the prod-stamped ad-hoc package directly (`./Lightfast.app/Contents/MacOS/Lightfast`); 30 s of stderr was clean except a benign `Unable to set login item: Operation not permitted` from macOS login-item perms. No `NSException`, no `SIGABRT`, no Squirrel.Mac panic. Confirmed the would-be Phase 2 updater gate prevents `SQRLUpdater.init` from being reached. (Provisional — source was reverted after the test.)
- **observability block**: skipped — no `SENTRY_DSN` configured locally to validate the tag flow end-to-end.
- **No browser/inngest/db/sdk debug needed.**

## Learnings

- **CORS hard blocker for the packaged beta** (uncovered during readiness audit): `apps/desktop/src/main/windows/factory.ts` `loadRenderer()` calls `BrowserWindow.loadFile(...)` in packaged mode, producing a `file://` page. Chromium sends `Origin: null` on cross-origin fetches from `file://` (Fetch spec: opaque origin → `null` serialization). The prod allowlist in `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` admits exactly `Set { "https://lightfast.ai" }`; the `localhost:*` carve-out is gated on `NODE_ENV === "development"`. There is **no packaged-desktop carve-out**. As-is, every tRPC call from the published beta will be CORS-blocked by the browser before reaching the server. Two fix shapes:
  - **(a) quick**: admit `Origin: null` in prod when a desktop marker is present (e.g., a `User-Agent` substring like `Electron/Lightfast` or a custom `X-Lightfast-Desktop: 1` header). Bearer-token auth is already enforced, so the marginal risk is low.
  - **(b) proper**: register a custom `app://` protocol in main, switch the loader to `loadURL("app://lightfast/index.html")`, configure Vite renderer for that base, add `"app://lightfast"` to the prod allowlist.
  Plan-level oversight; original plan and research did not address this.

- **Clerk JWT template**: `lightfast-desktop` is hardcoded in `apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/_components/desktop-auth-client.tsx`. It must exist in the **production** Clerk dashboard (with the expected `org_id` claim). Not verifiable from the codebase; must be checked in the Clerk dashboard before publish.

- **Release notes blast radius**: with no prior `@lightfast/desktop@*` tag, plain `--generate-notes` would pull every commit since repo init (~5,394 commits, including alarming-looking env-var renames like `MEMORY_API_KEY`, `SERVICE_JWT_SECRET`, `MXBAI_API_KEY`, `COHERE_API_KEY` — env-var *names* added to turbo passthroughs, not actual secrets, but readable as sloppiness on a public release page). The release-notes else-branch in the working tree fixes this for the first beta only; subsequent betas get normal autogenerated notes via `$prev`.

- **PublisherGithub does not update prerelease flag on existing releases** (verified by reading `node_modules/@electron-forge/publisher-github` source during plan): `prerelease: this.config.prerelease` is only sent inside `createRelease`; `updateRelease` never mentions it. The workflow's `prepare` job creates the draft *first* with `gh release create`, so `--prerelease` must be passed at that step, not relied on via the publisher config alone. This is the load-bearing reason for the Phase 3 prepare-job edit.

- **Sentry source maps**: confirmed not bundled in the asar — the `Upload source maps to Sentry` workflow step uses `@sentry/cli` which does not write `.map` files into the published asset. Verified by extracting `app.asar` and `find … -name '*.map'` returning empty.

- **`out/Lightfast-darwin-arm64/Lightfast.app` is stale**: built during Phase 2 verification with `buildFlavor=prod buildNumber=phase2-verify` stamped temporarily. `package.json` was restored to dev defaults afterward, but the artifact in `out/` reflects the prod stamping. Safe to delete with `rm -rf apps/desktop/out` — gitignored.

## Artifacts

- Plan (working tree, modified): `thoughts/shared/plans/2026-05-05-desktop-unsigned-beta-distribution.md`
- Workflow (working tree, modified): `.github/workflows/desktop-release.yml` (only the release-notes else-branch fix)
- Stale build artifact (gitignored, safe to delete): `apps/desktop/out/Lightfast-darwin-arm64/Lightfast.app`
- This handoff: `thoughts/shared/handoffs/general/2026-05-05_20-41-10_desktop-unsigned-beta-distribution.md`

## Action Items & Next Steps

In priority order:

1. **Decide branch strategy first** — current branch `portless-proxy-rename-and-tightening` is unrelated to this plan's scope. Either move the work to a fresh `desktop-unsigned-beta` branch off main, or stash the unrelated dirty files and re-apply on the original `desktop-portless-runtime-batch`. Capture the decision before re-applying any source changes; otherwise the diff will be polluted by the bundle-ID rename and other unrelated changes already on this branch.

2. **Re-apply Phase 1 source** (per plan §"Phase 1: Ad-hoc signing fallback + `signingMode` threading"): forge.config.ts ad-hoc fallback (with the `identityValidation: false` etc. flags from the plan's "Implementation note added during execution"), package.json `signingMode: "ad-hoc"` default, schema enum, build-info wiring. Verify with `pnpm --filter @lightfast/desktop typecheck` and an ad-hoc package + `codesign --display --verbose=4`.

3. **Re-apply Phase 2 source** (per plan §"Phase 2: Updater gating + Sentry tagging"): updater.ts gate with the Squirrel.Mac DR rationale comment; sentry.ts `signingMode: build.signingMode` tag.

4. **Resolve the CORS blocker** (the load-bearing tag-burn pre-req). Recommend approach (a) for the first beta — small change in `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` to admit `Origin: null` when a `User-Agent` substring or `X-Lightfast-Desktop` header is present, plus a header-set in the renderer's tRPC client. Verify locally by packaging and observing a successful tRPC call from the renderer's devtools.

5. **Re-apply Phase 3 workflow source** (the four core edits — prerelease output, `--prerelease` at draft creation, signingMode stamping, Apple-step `if:` gating). The release-notes else-branch already in the working tree should stay.

6. **Confirm the `lightfast-desktop` JWT template exists in the production Clerk dashboard** with the expected `org_id` claim. If it doesn't, create it before the tag burn.

7. **Phase 4** — add the README install instructions per plan §"Phase 4: Install instructions (README only)".

8. **Tag burn** — `git tag @lightfast/desktop@0.1.0-beta.1 && git push origin @lightfast/desktop@0.1.0-beta.1`. Watch the workflow run; both Apple steps should show as `Skipped` in the GitHub Actions UI. Verify with `gh release view ... --json isPrerelease,assets`.

9. **Manual install test on this Mac** — DMG drag, "Apple cannot verify" dialog, System Settings → Privacy & Security → Open Anyway. Then sign in and confirm at least one tRPC call lands successfully against prod.

## Other Notes

- **Authorization scope**: live tag push is destructive (creates a public Pre-release on a public repo, burns the tag). Plan calls it the "actual gate test." Recovery if it fails: `gh release delete '@lightfast/desktop@0.1.0-beta.1' --yes && git tag -d @lightfast/desktop@0.1.0-beta.1 && git push --delete origin @lightfast/desktop@0.1.0-beta.1`, fix workflow, retry on `0.1.0-beta.2`.
- **Apple cert path** is documented in the predecessor plan `thoughts/shared/plans/2026-04-23-desktop-pre-release-batch.md` Phase A. Once Apple secrets land, the workflow auto-flips to `signingMode=developer-id` (no code change needed once Phase 3 source is in place). The plan also flags a latent kebab-case → camelCase bug in `forge.config.ts`'s developer-id branch (`hardened-runtime`, `signature-flags`, etc. silently dropped at runtime by `@electron/osx-sign@1.3.3`); fix needed at cert-arrival, not now.
- **`apps/desktop/out/`** can be deleted at any time — gitignored and now stale.
- **Untracked `.agents/skills/lightfast-desktop-signin/`** has a pre-existing biome lint failure (`for...of` style) flagged in earlier `pnpm check` runs — unrelated to this plan, do not block on it.
- **Branch noise on the working tree**: many unrelated untracked dirs (`.agents/skills/lightfast-aeo`, `lightfast-changelog`, `lightfast-db`, etc.), assorted thought docs, plans for other initiatives, and `outputs/`. The only files relevant to this handoff are the workflow, the plan, and (when re-applied) the four desktop source files.
- **The branch the work was originally being done on (`desktop-portless-runtime-batch`) is also missing the Phase 1/2/3 source** — confirmed by `git show desktop-portless-runtime-batch:apps/desktop/src/shared/build-info-schema.ts`. Don't go fishing for it there.
