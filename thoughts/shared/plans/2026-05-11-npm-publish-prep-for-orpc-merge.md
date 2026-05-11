# npm Publish Prep for oRPC Merge Implementation Plan

## Overview

Harden the `lightfast` + `@lightfastai/mcp` npm publish pipeline so merging `feat/orpc-public-api-and-lib-rework` cuts a clean `0.1.0-alpha.6` release. Companion plan to `thoughts/shared/plans/2026-05-10-orpc-public-api-and-api-lib-rework.md` — that plan deliberately deferred publishing ("No npm publish in this plan", line 74). This plan picks it up: fixes four publish blockers, proves the published artifacts work in a fresh Node env via pack-and-install, and adds the changeset that triggers the release.

## Current State Analysis

Verified on branch `feat/orpc-public-api-and-lib-rework` at HEAD (`23a0084f0`).

- **Blocker 1 — private workspace package leaked into runtime deps.** `core/lightfast/package.json:42-47` declares `"@repo/api-contract": "workspace:*"` in `dependencies`. `core/mcp/package.json:49-53` declares both `"@repo/api-contract": "workspace:*"` and `"lightfast": "workspace:*"` in `dependencies`. The `@repo/api-contract` package (`packages/api-contract/package.json:3`) is `private: true` and has never been published to npm. tsup `noExternal` bundles its source into the published `dist/index.mjs` at build time (`core/lightfast/tsup.config.ts:12-17`, `core/mcp/tsup.config.ts:13`), so the runtime dep is both redundant and broken.
  - `pnpm publish` rewrites `workspace:*` to the local version (`"0.1.0"`) at publish time — that version doesn't exist on npm, so `npm install lightfast` 404s.
  - `npm pack` does NOT rewrite — I confirmed by running `cd core/lightfast && npm pack --pack-destination /tmp` and inspecting the tarball's `package.json`: `"@repo/api-contract": "workspace:*"` survives literally, which `npm install` also rejects (invalid version range).
- **Blocker 2 — release.yml `--dry-run` step fails on every run.** `.github/workflows/release.yml:67-70` runs `pnpm changeset publish --dry-run`. `@changesets/cli@2.31.0` `publish` accepts only `[--tag <name>] [--otp <code>] [--no-git-tag]` (confirmed via `pnpm changeset publish --help`). The flag has never been valid for `publish`. The last 5 `Release lightfast` runs on `main` all `completed failure` with `Unknown flag for publish: --dry-run` (verified via `gh run list --workflow=release.yml --limit=5` and `gh run view 25492012758 --log`). No publishes have happened via CI since at least 2026-04-24.
- **Blocker 3 — `core/lightfast` has no `files` field.** `cd core/lightfast && npm pack --dry-run` shows 19 files including `.cache/tsbuildinfo.json`, `.turbo/turbo-*.log`, the entire `src/` tree (including `src/__tests__/integration/`), `tsup.config.ts`, `vitest.config.ts`, `turbo.json`, `tsconfig.json`. `core/mcp/package.json:39-41` has `"files": ["dist"]` and packs cleanly (6 files).
- **Blocker 4 — alpha pre-releases are tagged `latest`.** Both `core/lightfast/package.json:5-8` and `core/mcp/package.json:5-8` set `"publishConfig": { "tag": "latest", "access": "public" }`. `npm view lightfast dist-tags` shows `latest: 0.1.0-alpha.5`. Anyone running `npm install lightfast` (no tag) gets alpha. The `.changeset/pre.json:2-3` already declares `mode: "pre", tag: "alpha"`, so the version-suffix side of pre-mode is correct — only the dist-tag side is wrong.
- **No active changesets.** `.changeset/` contains only `config.json`, `pre.json`, `README.md`. Merging this branch as-is would not trigger any version bump or publish — `changesets/action` only opens a Version PR when at least one changeset exists.
- **Release workflow test filter is narrow.** `.github/workflows/release.yml:54-57` runs `pnpm turbo test --filter=lightfast` only. `@lightfastai/mcp` tests don't run in the release path.
- **ci-core.yml has no test step.** `.github/workflows/ci-core.yml:53-57` runs `typecheck` but not `test` for core packages. Per-PR test coverage on `core/lightfast` and `core/mcp` is absent today.
- **Fixed pair already wired.** `.changeset/config.json:5` declares `"fixed": [["lightfast", "@lightfastai/mcp"]]` — any changeset must list both at the same bump level, and they always publish at the same version. `verify-changeset.yml` enforces the changeset format.

## Desired End State

After this plan ships and the resulting Version PR merges:

- `Release lightfast` workflow completes green on every merge to `main`.
- `npm view lightfast version` → `0.1.0-alpha.6`; `npm view @lightfastai/mcp version` → `0.1.0-alpha.6`.
- `npm view lightfast dist-tags` → `alpha: 0.1.0-alpha.6`, `latest: 0.1.0-alpha.5` (untouched legacy — see Migration Notes).
- Published `lightfast` tarball contains exactly `dist/`, `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json` — no `src/`, no `.cache/`, no `tsup.config.ts`. Manifest's `dependencies` lists only `@orpc/client`, `@orpc/contract`, `@orpc/openapi-client` (no `@repo/*`, no `workspace:*`).
- Published `@lightfastai/mcp` tarball contains the same shape (`dist/`, `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`). Manifest's `dependencies` lists only `@modelcontextprotocol/sdk`.
- `npm install lightfast@alpha` into a fresh Node 22 project works; `createLightfast(apiKey, { baseUrl }).system.health()` returns `{ status: "ok", timestamp, version }`.
- `npx @lightfastai/mcp@alpha` (with `LIGHTFAST_API_KEY` set) starts a stdio MCP server that exposes `lightfast_system_health` via `tools/list`.

### Verification

- `gh run view <post-version-PR-merge-run-id> --log` shows the `Release lightfast` workflow green.
- `tar -xzOf <lightfast-tarball> package/package.json | jq '.dependencies | keys'` returns only `@orpc/*` keys.
- `tar -xzOf <mcp-tarball> package/package.json | jq '.dependencies | keys'` returns only `["@modelcontextprotocol/sdk"]`.
- `npm install` of either tarball into a `npm init -y` scratch project succeeds, and `node -e "import('lightfast').then(m => console.log(typeof m.createLightfast))"` prints `function`.

### Key Discoveries

- `@repo/api-contract` is `private: true` (`packages/api-contract/package.json:3`) and bundled at build time via tsup `noExternal` on both consumers. Moving it from `dependencies` to `devDependencies` is necessary AND safe: the published `dist/index.mjs` carries the source bundled, and the dev-side workspace resolution still works because tsup runs at build time (which happens before publish).
- `lightfast` (the SDK package) is bundled into `@lightfastai/mcp/dist/index.mjs` the same way — `core/mcp/tsup.config.ts:13` has it in `noExternal`. Same logic: move to `devDependencies` to avoid a redundant runtime resolution and shrink the user-facing install footprint.
- `npm pack --dry-run` validates a package can be built into a tarball without uploading — drop-in replacement for the broken `changeset publish --dry-run`. It surfaces invalid `workspace:*` entries (they survive untouched, which the inspection then catches).
- `changeset publish` reads each package's `publishConfig.tag` to decide which dist-tag to publish to. Setting it to `"alpha"` on both packages keeps `latest` untouched when alpha versions publish — matches the `.changeset/pre.json:2-3` pre-mode intent. (Changesets does NOT auto-use `pre.tag` for dist-tag — that field controls version-suffix naming only.)
- `core/mcp/package.json:39-41` has `"files": ["dist"]` but is missing `CHANGELOG.md` from the publish manifest. npm auto-includes `package.json`, `README*`, `LICENSE*` but NOT `CHANGELOG*` — confirmed by inspecting the existing `@lightfastai/mcp-0.1.0-alpha.5` pack output (no CHANGELOG.md in tarball). Both packages should explicitly include `CHANGELOG.md`.
- `npm pack` runs in the package directory and uses local `package.json` as-is. Running `npm pack --dry-run` after manifest edits is sufficient to validate the published shape — no full build required for the manifest assertions, though a full build IS required before any actual publish so `dist/` exists.
- `.changeset/pre.json:2-3` is in `mode: "pre", tag: "alpha"` with `initialVersions` already listing both packages at `0.1.0-alpha.1`. Adding a `minor` changeset on top of `alpha.5` produces `alpha.6` (the pre-release counter increments regardless of bump kind while in pre-mode).
- The release workflow's "Verify published versions match" step (`release.yml:84-106`) uses `npm view <pkg> version` which returns the `latest`-tagged version. After our `publishConfig.tag` change, fresh alpha publishes won't update `latest`, so the assertion would compare stale legacy versions on both packages. Fix in Phase 2 to query `npm view <pkg>@alpha version` instead.
- `NPM_CONFIG_PROVENANCE: true` (`release.yml:82`) requires `id-token: write` permission (already set, `release.yml:24`) and a public source repository (yes). Provenance attestation will work for both packages.

## What We're NOT Doing

- **Not exiting changeset pre-mode.** `pnpm changeset pre exit` graduates out of alpha; deliberately deferred until the SDK + MCP surfaces are stable. Alpha cadence continues.
- **Not changing `@lightfastai/cli` publish setup.** Different package, out of scope for this PR. Still listed in `core-ci.yml` typecheck filter and in `release.yml` test filter; unchanged.
- **Not modifying the `fixed: [["lightfast", "@lightfastai/mcp"]]` pair.** The lockstep guarantee stays.
- **Not publishing `@repo/api-contract` to npm.** Stays `private: true`. The contract source ships bundled inside the SDK and MCP `dist/index.mjs`.
- **Not touching `engines.node: ">=18"` on the published packages.** Broader compatibility for npm consumers is the right default; the monorepo's `>=22` is for development tooling, not the published lib.
- **Not adding integration tests to CI.** Phase 3 of the oRPC plan documented `LIGHTFAST_RUN_INTEGRATION=1` as the gate; running it in CI requires dev containers (Postgres + Redis) and is out of scope here.
- **Not retroactively cleaning up the existing `latest` tag on npm.** `npm view lightfast dist-tags` currently shows `latest: 0.1.0-alpha.5`. Leaving it untouched means consumers who installed `lightfast@latest` keep getting `alpha.5`; new alpha installs use `lightfast@alpha`. Manually re-tagging is out-of-band and flagged in Migration Notes.
- **Not adding a `prepublishOnly` script.** The workflow builds explicitly before `changeset publish`. Adding `prepublishOnly` would duplicate the build for local `npm publish` use cases that aren't happening today.

## Implementation Approach

Four phases. Phase 1 and Phase 2 are independent (manifest changes vs. workflow changes); they're sequential here only so the user can verify each side cleanly. Phase 3 depends on Phase 1 (needs corrected manifests to pack). Phase 4 depends on everything else.

Phase 3 is the load-bearing validation: pack the packages, install the tarballs into a fresh `/tmp` project, exercise the SDK and MCP binary against a real local dev server. If this passes, the artifacts that ship to npm will work for the first external user.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Package manifests + tarball hygiene

### Overview

Move the private workspace packages (`@repo/api-contract`, `lightfast`) out of runtime `dependencies` and into `devDependencies` for both core packages. Add the missing `files` entries. Change `publishConfig.tag` from `"latest"` to `"alpha"`. All four blockers (1, 3, 4) in the manifests are addressed here.

### Changes Required

#### 1. `core/lightfast/package.json`

**File**: `core/lightfast/package.json`

**Changes**:
- Move `"@repo/api-contract": "workspace:*"` from `dependencies` to `devDependencies`.
- Add `"files": ["dist", "CHANGELOG.md"]` (npm auto-includes `package.json`, `README.md`, `LICENSE`).
- Change `publishConfig.tag` from `"latest"` to `"alpha"`.

Resulting shape (relevant fields):

```json
{
  "publishConfig": {
    "tag": "alpha",
    "access": "public"
  },
  "files": ["dist", "CHANGELOG.md"],
  "dependencies": {
    "@orpc/client": "^1.14.2",
    "@orpc/contract": "^1.14.2",
    "@orpc/openapi-client": "^1.14.2"
  },
  "devDependencies": {
    "@db/app": "workspace:*",
    "@repo/api-contract": "workspace:*",
    "@repo/app-api-key": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "@vitest/coverage-v8": "^4.1.4",
    "drizzle-orm": "catalog:",
    "tsup": "^8.5.1",
    "typescript": "catalog:",
    "vitest": "^4.1.4"
  }
}
```

#### 2. `core/mcp/package.json`

**File**: `core/mcp/package.json`

**Changes**:
- Move `"@repo/api-contract": "workspace:*"` and `"lightfast": "workspace:*"` from `dependencies` to `devDependencies`.
- Update `files` from `["dist"]` to `["dist", "CHANGELOG.md"]`.
- Change `publishConfig.tag` from `"latest"` to `"alpha"`.

Resulting shape (relevant fields):

```json
{
  "publishConfig": {
    "tag": "alpha",
    "access": "public"
  },
  "files": ["dist", "CHANGELOG.md"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0"
  },
  "devDependencies": {
    "@repo/api-contract": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "@vendor/mcp": "workspace:*",
    "lightfast": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

#### 3. Lockfile + build verification

After the manifest edits:

```bash
pnpm install
pnpm --filter lightfast clean
pnpm --filter @lightfastai/mcp clean
pnpm --filter lightfast build
pnpm --filter @lightfastai/mcp build
pnpm --filter lightfast test
pnpm --filter @lightfastai/mcp test
pnpm typecheck
```

The builds must still bundle `@repo/api-contract` (and `lightfast` for MCP) via tsup `noExternal`. Bundle sizes should match the oRPC plan's recorded values: lightfast ~564 KB, mcp ~1.06 MB.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds; `pnpm-lock.yaml` updates reflect the dep moves (`@repo/api-contract` no longer appears under `core/lightfast`'s `dependencies` block in the lockfile).
- [x] `pnpm --filter lightfast build` produces `core/lightfast/dist/index.mjs` of comparable size (~564 KB).
- [x] `pnpm --filter @lightfastai/mcp build` produces `core/mcp/dist/index.mjs` of comparable size (~1.06 MB).
- [x] `pnpm --filter lightfast test` passes (unit tests; integration tests stay gated).
- [x] `pnpm --filter @lightfastai/mcp test` passes.
- [x] `pnpm typecheck` at repo root passes.
- [x] `cd core/lightfast && npm pack --dry-run 2>&1 | grep -E "^npm notice [0-9]+\\.[0-9]+(k|M)?B" | wc -l` shows ≤7 files (was 19).
- [x] `cd core/lightfast && npm pack --dry-run --json | jq -r '.[0].files[].path' | grep -E "src/|tsup.config|vitest.config|tsconfig|turbo.json|\\.cache|\\.turbo" | wc -l` returns `0`.
- [x] `cd core/mcp && npm pack --dry-run --json | jq -r '.[0].files[].path' | sort` returns exactly `CHANGELOG.md`, `LICENSE`, `README.md`, `dist/index.d.ts`, `dist/index.mjs`, `dist/index.mjs.map`, `package.json`.
- [x] Pack both tarballs and inspect manifests:
  ```bash
  SCRATCH=$(mktemp -d)
  (cd core/lightfast && npm pack --pack-destination "$SCRATCH")
  (cd core/mcp && npm pack --pack-destination "$SCRATCH")
  tar -xzOf "$SCRATCH"/lightfast-*.tgz package/package.json | jq '.dependencies | keys | sort'
  # Expected: ["@orpc/client", "@orpc/contract", "@orpc/openapi-client"]
  tar -xzOf "$SCRATCH"/lightfastai-mcp-*.tgz package/package.json | jq '.dependencies | keys | sort'
  # Expected: ["@modelcontextprotocol/sdk"]
  ```
  Both assertions must hold (no `@repo/*`, no `workspace:*` in `.dependencies`).
- [x] `git grep -l '"@repo/api-contract": "workspace:\\*"' core/lightfast/package.json core/mcp/package.json` returns matches only in their respective `devDependencies` blocks (verified by surrounding context).

#### Human Review

- [x] Open `core/lightfast/package.json` → confirm `@repo/api-contract` is under `devDependencies`, `files: ["dist", "CHANGELOG.md"]` is present, `publishConfig.tag` is `"alpha"`.
- [x] Open `core/mcp/package.json` → confirm `lightfast` and `@repo/api-contract` are under `devDependencies`, only `@modelcontextprotocol/sdk` remains in `dependencies`, `files` includes `CHANGELOG.md`, `publishConfig.tag` is `"alpha"`.
- [x] Run `cd core/lightfast && npm pack --pack-destination /tmp && tar -tzf /tmp/lightfast-*.tgz | sort` → eyeball the file list; confirm no `src/`, no config files, no `.cache`/`.turbo`.

---

## Phase 2: CI workflows

### Overview

Replace the broken `pnpm changeset publish --dry-run` step in `release.yml` with `npm pack --dry-run` per package. Add `@lightfastai/mcp` to the release workflow's test filter. Fix the "Verify published versions match" step to query the `@alpha` dist-tag (not `latest`, which now stays pinned to legacy versions). Add a test step to `ci-core.yml` so PRs catch regressions in the core packages.

### Changes Required

#### 1. `.github/workflows/release.yml`

**File**: `.github/workflows/release.yml`

**Changes**:

Replace the "Dry-run publish to validate packages" step (lines 66-70):

```yaml
      - name: Validate package tarballs
        run: |
          echo "Packing tarballs to validate manifests..."
          SCRATCH=$(mktemp -d)
          (cd core/lightfast && npm pack --pack-destination "$SCRATCH")
          (cd core/mcp && npm pack --pack-destination "$SCRATCH")
          echo "Inspecting lightfast manifest..."
          tar -xzOf "$SCRATCH"/lightfast-*.tgz package/package.json | jq -e '.dependencies | keys | all(. as $k | $k | startswith("@orpc/"))' \
            || (echo "❌ lightfast has unexpected runtime deps"; tar -xzOf "$SCRATCH"/lightfast-*.tgz package/package.json | jq '.dependencies'; exit 1)
          echo "Inspecting @lightfastai/mcp manifest..."
          tar -xzOf "$SCRATCH"/lightfastai-mcp-*.tgz package/package.json | jq -e '.dependencies | keys == ["@modelcontextprotocol/sdk"]' \
            || (echo "❌ @lightfastai/mcp has unexpected runtime deps"; tar -xzOf "$SCRATCH"/lightfastai-mcp-*.tgz package/package.json | jq '.dependencies'; exit 1)
          echo "✅ Tarball manifests valid"
```

Update the "Run tests" step (lines 54-57) to include `@lightfastai/mcp`:

```yaml
      - name: Run tests
        env:
          SKIP_ENV_VALIDATION: "true"
        run: pnpm turbo test --filter=lightfast --filter=@lightfastai/mcp --summarize
```

Update the "Verify published versions match" step (lines 84-106) to query the `alpha` dist-tag (since `publishConfig.tag` is now `alpha`):

```yaml
      - name: Verify published versions match
        if: steps.changesets.outputs.published == 'true'
        run: |
          echo "Verifying both packages published successfully to alpha tag..."
          sleep 10

          LIGHTFAST_VERSION=$(npm view lightfast@alpha version)
          MCP_VERSION=$(npm view @lightfastai/mcp@alpha version)
          CLI_VERSION=$(npm view @lightfastai/cli@alpha version 2>/dev/null || echo "not-published")

          echo "lightfast@alpha: $LIGHTFAST_VERSION"
          echo "@lightfastai/mcp@alpha: $MCP_VERSION"
          echo "@lightfastai/cli@alpha: $CLI_VERSION"

          if [ "$LIGHTFAST_VERSION" != "$MCP_VERSION" ]; then
            echo "❌ ERROR: Version drift detected on alpha tag!"
            echo "lightfast@$LIGHTFAST_VERSION != @lightfastai/mcp@$MCP_VERSION"
            echo "Manual intervention required - publish the missing package"
            exit 1
          fi

          echo "✅ Both packages at $LIGHTFAST_VERSION on alpha tag"
```

#### 2. `.github/workflows/ci-core.yml`

**File**: `.github/workflows/ci-core.yml`

**Changes**: Add a test step after the existing "Type check affected core packages" step:

```yaml
      - name: Test affected core packages
        env:
          SKIP_ENV_VALIDATION: "true"
          TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: pnpm turbo test --affected --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue --summarize
```

(The existing "Cache report" step stays at the end.)

### Success Criteria

#### Automated Verification

- [x] `actionlint .github/workflows/release.yml .github/workflows/ci-core.yml` (if installed) reports no errors. Otherwise: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); yaml.safe_load(open('.github/workflows/ci-core.yml'))"` succeeds. *(used ruby `YAML.load_file` fallback — both parse cleanly.)*
- [x] `grep -c "changeset publish --dry-run" .github/workflows/release.yml` returns `0`.
- [x] `grep -c "@lightfastai/mcp" .github/workflows/release.yml` returns ≥ 1 in the test step. *(returns 7 — test filter + tarball validation step.)*
- [x] `grep -c "npm view lightfast@alpha" .github/workflows/release.yml` returns ≥ 1. *(returns 1.)*
- [x] `grep -c "turbo test --affected" .github/workflows/ci-core.yml` returns ≥ 1. *(returns 1.)*
- [ ] After pushing the branch: `gh pr checks` shows `Core CI / core-ci` step "Test affected core packages" running (and green). *(deferred — requires push to remote; verify after Phase 4 merge.)*

#### Human Review

- [x] Open `.github/workflows/release.yml` → confirm the `--dry-run` step is replaced with the `npm pack` validation, test filter includes both packages, and the verify-published step queries `@alpha`.
- [x] Open `.github/workflows/ci-core.yml` → confirm the test step is added after typecheck.
- [ ] After pushing, open the PR's Core CI run on GitHub → confirm the new test step ran and was green (both `lightfast` and `@lightfastai/mcp` test suites executed). *(deferred — requires push.)*

---

## Phase 3: End-to-end publish smoke test

### Overview

Pack both core packages from a clean build, install the resulting tarballs into a fresh `/tmp` Node project as if a real user ran `npm install`, and exercise the SDK + MCP binary against a running local dev server. This is the load-bearing test: it catches `workspace:*` leakage, bundle gaps, bin-permission issues, and CORS/route problems that unit tests miss.

No source changes in this phase — only verification commands. They live in the plan as a runbook the user (and future readers) can replay.

### Changes Required

#### Pre-requisites

- `pnpm db:up && pnpm redis:up` — dev containers running.
- `pnpm dev:app` running in a separate terminal at the main worktree (so `https://app.lightfast.localhost/api/v1/system/health` is reachable).
- A test `sk-lf-` API key inserted into the dev DB. Easiest path: open `pnpm db:studio` (port 4983), insert a row into `org_api_keys` mirroring the integration setup at `core/lightfast/src/__tests__/integration/setup.ts:33-50`. Or reuse one from the existing CLI flow.

#### Runbook

```bash
# 1. Clean rebuild from current branch state
pnpm --filter lightfast clean
pnpm --filter @lightfastai/mcp clean
pnpm install
pnpm --filter lightfast build
pnpm --filter @lightfastai/mcp build

# 2. Pack both packages into a scratch dir
SCRATCH=$(mktemp -d)
(cd core/lightfast && npm pack --pack-destination "$SCRATCH")
(cd core/mcp && npm pack --pack-destination "$SCRATCH")
ls -lh "$SCRATCH"

# 3. Inspect packed manifests
echo "=== lightfast manifest ==="
tar -xzOf "$SCRATCH"/lightfast-*.tgz package/package.json | jq '.dependencies'
echo "=== @lightfastai/mcp manifest ==="
tar -xzOf "$SCRATCH"/lightfastai-mcp-*.tgz package/package.json | jq '.dependencies'

# 4. Install into a fresh Node project
PUBLISH_TEST=$(mktemp -d)
cd "$PUBLISH_TEST"
npm init -y >/dev/null
npm install "$SCRATCH"/lightfast-*.tgz "$SCRATCH"/lightfastai-mcp-*.tgz

# 5. Confirm installed package.json has only public deps
cat node_modules/lightfast/package.json | jq '.dependencies'
cat node_modules/@lightfastai/mcp/package.json | jq '.dependencies'

# 6. SDK round-trip against local dev server
cat > test-sdk.mjs <<'EOF'
import { createLightfast } from "lightfast";
const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) { console.error("LIGHTFAST_API_KEY required"); process.exit(1); }
const lf = createLightfast(apiKey, { baseUrl: "https://app.lightfast.localhost" });
const result = await lf.system.health();
console.log("system.health response:", result);
if (result.status !== "ok") { console.error("Unexpected status"); process.exit(1); }
EOF
LIGHTFAST_API_KEY=sk-lf-<your-test-key> node test-sdk.mjs

# 7. MCP binary smoke (stdio handshake)
cat > test-mcp.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}'
  echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  sleep 1
) | LIGHTFAST_API_KEY=$LIGHTFAST_API_KEY LIGHTFAST_API_URL=https://app.lightfast.localhost \
  node_modules/.bin/lightfast-mcp 2>/dev/null | head -3
EOF
chmod +x test-mcp.sh
LIGHTFAST_API_KEY=sk-lf-<your-test-key> ./test-mcp.sh

# 8. Cleanup
cd /
rm -rf "$SCRATCH" "$PUBLISH_TEST"
```

### Success Criteria

#### Automated Verification

- [x] Step 1-2 succeeds (build + pack produce two `.tgz` files). *(lightfast 235K, mcp 449K.)*
- [x] Step 3 output: lightfast manifest's `dependencies` is exactly `{ "@orpc/client": "...", "@orpc/contract": "...", "@orpc/openapi-client": "..." }`; mcp's is exactly `{ "@modelcontextprotocol/sdk": "..." }`. No `@repo/*`, no `workspace:*`.
- [x] Step 4 succeeds: `npm install` of both tarballs completes without errors. `node_modules/lightfast/dist/index.mjs` and `node_modules/@lightfastai/mcp/dist/index.mjs` exist. *(105 packages, 0 vulnerabilities.)*
- [x] Step 5 output mirrors step 3 (installed manifests match packed manifests). *(`createLightfast` resolves as `function`, `VERSION` is `0.1.0-alpha.5`.)*

#### Human Review

- [x] Step 6 output: `system.health response: { status: 'ok', timestamp: '2026-05-11T...', version: '...' }`. Confirms the published SDK bundle + transport work end-to-end. *(`system.health response: { "status": "ok", "timestamp": "2026-05-11T04:03:17.829Z", "version": "0.1.0" }`.)*
- [x] Step 7 output: a JSON-RPC response on stdout that includes a `tools` array with one entry whose `name` is `lightfast_system_health` and whose `inputSchema` / `description` are non-empty. *(tools/list returned exactly one tool, `lightfast_system_health`, with non-empty description, `inputSchema` (`{type: "object", properties: {}}`) and a full `outputSchema`.)*
- [x] Inspecting `node_modules/lightfast/package.json` and `node_modules/@lightfastai/mcp/package.json` from step 5 → no `@repo/*` or `workspace:*` keys appear anywhere in `dependencies` or `peerDependencies`.

---

## Phase 4: Changeset + merge prep

### Overview

Add the changeset that bumps `lightfast` + `@lightfastai/mcp` to `0.1.0-alpha.6`. Run `pnpm changeset version` locally to verify pre-mode handles the bump correctly (then revert — only the changeset `.md` ships in the PR). Document the post-merge verification checklist so the user can confirm the publish completed cleanly.

### Changes Required

#### 1. `.changeset/orpc-public-api.md` (NEW)

**File**: `.changeset/orpc-public-api.md`

```markdown
---
"lightfast": minor
"@lightfastai/mcp": minor
---

Adopt oRPC for the public SDK and MCP surfaces.

- SDK (`lightfast`): `createLightfast(apiKey, options)` now returns a typed `RouterClient<Contract>` constructed via `@orpc/openapi-client/fetch`. Calls hit the new `/api/v1/*` REST surface on `apps/app`. The `LightfastClient` class is removed — it's now a type alias to `RouterClient<Contract>`. Breaking change for any consumer using `new LightfastClient(...)`.
- MCP (`@lightfastai/mcp`): The server auto-registers tools from `@repo/api-contract`. First exposed tool: `lightfast_system_health` (GET `/api/v1/system/health`). Adding procedures to the contract auto-registers them as MCP tools — no `core/mcp` changes required.
- Publish hygiene: `@repo/api-contract` is bundled into the published `dist/` via tsup `noExternal`. Moved from `dependencies` to `devDependencies` to keep the published manifest free of private workspace references. `lightfast` (in MCP) moved the same way. `publishConfig.tag` changed from `"latest"` to `"alpha"` so pre-release versions no longer claim the default install slot.

Requires: `LIGHTFAST_API_KEY` (`sk-lf-` org API key) to authenticate. Optional: `LIGHTFAST_API_URL` to point at non-prod environments.
```

The changeset uses `minor` bump because the SDK is a breaking change for consumers (class → factory) — even in pre-mode where the suffix counter increments either way, recording intent matters for the eventual stable cut.

#### 2. Local dry-run of `pnpm changeset version` (verification only — revert after)

Run from repo root **after** all Phase 1-3 changes are committed locally:

```bash
# Sanity check: status shows the new changeset
pnpm changeset status

# Expected output mentions:
#   lightfast: 0.1.0-alpha.5 → 0.1.0-alpha.6
#   @lightfastai/mcp: 0.1.0-alpha.5 → 0.1.0-alpha.6

# Apply the version bump locally (mutates package.json + CHANGELOG.md)
pnpm changeset version

# Inspect the diff
git status
git diff core/lightfast/package.json core/mcp/package.json
git diff core/lightfast/CHANGELOG.md core/mcp/CHANGELOG.md

# Expected mutations:
#   - core/lightfast/package.json: "version": "0.1.0-alpha.5" → "0.1.0-alpha.6"
#   - core/mcp/package.json: "version": "0.1.0-alpha.5" → "0.1.0-alpha.6"
#   - core/lightfast/CHANGELOG.md: new entry at the top
#   - core/mcp/CHANGELOG.md: new entry at the top
#   - .changeset/pre.json: changesets array gains "orpc-public-api"
#   - .changeset/orpc-public-api.md: deleted (consumed)

# Revert everything except the changeset file
git restore core/lightfast/package.json core/mcp/package.json
git restore core/lightfast/CHANGELOG.md core/mcp/CHANGELOG.md
git restore .changeset/pre.json
# Restore the consumed changeset .md file
git checkout HEAD -- .changeset/orpc-public-api.md 2>/dev/null || \
  git restore --source=$(git rev-parse HEAD) -- .changeset/orpc-public-api.md
# (If the file was uncommitted before, recreate it from the spec in §1.)

# Confirm final state: only the new .md is in the working tree
git status
```

The actual version bump happens via `changesets/action` in `release.yml` after this PR merges. The local dry-run is purely to confirm pre-mode handles the bump shape correctly (suffix increments to `alpha.6` rather than producing a non-alpha version).

#### 3. Update the predecessor plan's improvement log

**File**: `thoughts/shared/plans/2026-05-10-orpc-public-api-and-api-lib-rework.md`

**Changes**: Append to the existing `## Improvement Log` section (after "Phase 3 implementation deltas (2026-05-11)"):

```markdown
### Publish system follow-up (2026-05-11)

The "No npm publish in this plan" note (line 74) is being followed by `thoughts/shared/plans/2026-05-11-npm-publish-prep-for-orpc-merge.md`, which fixes four publish blockers discovered while preparing the merge:

1. `@repo/api-contract` (private workspace package) appeared as a runtime dep on the published SDK and MCP packages — would have produced unresolvable `workspace:*` or literal `0.1.0` references on npm.
2. `.github/workflows/release.yml`'s dry-run validation step used a `--dry-run` flag that doesn't exist on `pnpm changeset publish` — every release run since at least 2026-04-24 failed at this step.
3. `core/lightfast/package.json` had no `files` field — tarball included `src/`, `.cache/`, `.turbo/`, config files.
4. `publishConfig.tag: "latest"` on alpha pre-releases pinned `latest` to alpha versions, so `npm install lightfast` defaulted to alpha.

Both packages will publish as `0.1.0-alpha.6` to the `alpha` dist-tag when that plan's changeset merges.
```

### Success Criteria

#### Automated Verification

- [x] `.changeset/orpc-public-api.md` exists with `"lightfast": minor` and `"@lightfastai/mcp": minor`.
- [x] `pnpm changeset status` succeeds and reports both packages bumping from `0.1.0-alpha.5` to `0.1.0-alpha.6`.
- [ ] `verify-changeset.yml` passes when CI runs (asserts the changeset references at least one of the three publishable packages and uses a valid bump kind). *(deferred — runs on push.)*

#### Human Review

- [x] Open `.changeset/orpc-public-api.md` → confirm both packages are listed at `minor` (fixed pair requires both at the same level) and the summary captures the breaking SDK change.
- [x] Run the local `pnpm changeset version` dry-run (§2) → confirm version bumps to `alpha.6` cleanly, CHANGELOG entries are generated, then `git restore` reverts everything except the changeset `.md`. *(verified: both packages bumped to `0.1.0-alpha.6`, CHANGELOG entries generated, then reverted package.json, CHANGELOG.md, and pre.json.)*
- [x] Re-read the post-merge verification checklist (below) — confirm it matches the planned cut.

### Post-merge verification checklist

After this PR merges to `main`:

1. **First Release run (on this PR's merge commit)** — `Release lightfast` workflow runs against `main`. Expected behavior:
   - "Validate package tarballs" step: green (Phase 2 fix).
   - "Run tests" step: green for `lightfast` and `@lightfastai/mcp` (Phase 2 filter widening).
   - `changesets/action` step: detects the new changeset, opens a "Version Packages" PR. **No publish yet.**

2. **Review the Version Packages PR**:
   - `core/lightfast/package.json` version: `0.1.0-alpha.5` → `0.1.0-alpha.6`.
   - `core/mcp/package.json` version: `0.1.0-alpha.5` → `0.1.0-alpha.6`.
   - `CHANGELOG.md` updated for both with the changeset summary.
   - `.changeset/orpc-public-api.md` deleted.
   - `.changeset/pre.json` `changesets` array updated.

3. **Merge the Version Packages PR.**

4. **Second Release run (on the Version PR's merge commit)** — `Release lightfast` runs again. Expected behavior:
   - "Build packages" step: builds with the new `package.json` version, so `__SDK_VERSION__` injects `0.1.0-alpha.6`.
   - "Validate package tarballs" step: green; manifest assertions confirm no `@repo/*` runtime deps.
   - `changesets/action` step: no more changesets, so it runs `pnpm changeset publish` → uploads both tarballs to npm.
   - "Verify published versions match" step: `npm view lightfast@alpha version` and `npm view @lightfastai/mcp@alpha version` both return `0.1.0-alpha.6`.

5. **Verify on npm**:
   ```bash
   npm view lightfast version       # → 0.1.0-alpha.6 (the 'latest' tag — unchanged from alpha.5 unless legacy 0.2.x kept it there)
   npm view lightfast@alpha version # → 0.1.0-alpha.6
   npm view lightfast dist-tags     # → alpha: 0.1.0-alpha.6, latest: <prior value>
   npm view @lightfastai/mcp@alpha version  # → 0.1.0-alpha.6
   ```

6. **Public-npm smoke test** (optional but recommended):
   ```bash
   mkdir /tmp/post-publish-smoke && cd /tmp/post-publish-smoke
   npm init -y
   npm install lightfast@alpha @lightfastai/mcp@alpha
   cat node_modules/lightfast/package.json | jq '.dependencies'
   # Expected: only @orpc/* keys — confirms the published artifact carries no @repo/* deps.
   node -e "import('lightfast').then(m => console.log(typeof m.createLightfast, m.VERSION))"
   # Expected: function 0.1.0-alpha.6
   ```

---

## Testing Strategy

### Unit Tests

- Phase 1 success criteria require `pnpm --filter lightfast test` and `pnpm --filter @lightfastai/mcp test` to pass. These cover the SDK key-validation + mocked-fetch tests and the MCP `registerContractTools` registration test (from the oRPC plan's Phase 3).

### Integration Tests

- `core/lightfast/src/__tests__/integration/system-health.test.ts` stays gated by `LIGHTFAST_RUN_INTEGRATION=1`. Not part of CI; can be exercised manually before Phase 3's smoke test if desired.

### End-to-end (Phase 3)

The pack-and-install runbook IS the integration test for the publish system. It catches:
- `workspace:*` protocol leakage (npm install fails immediately on private deps).
- Bundle completeness (SDK call fails to find a symbol if a tsup `noExternal` entry was dropped).
- Bin shebang / permissions (the `lightfast-mcp` binary fails to execute if tsup's `#!/usr/bin/env node` banner or npm's auto-chmod broke).
- Route mounting + CORS (a 401/404 from the dev server instead of a JSON body means the oRPC route or the auth middleware is misconfigured).

## Performance Considerations

- The `npm pack --dry-run` validation in `release.yml` adds ~5s to the workflow. Negligible.
- Adding the test step to `ci-core.yml` adds ~30-60s per PR that touches `core/`. Acceptable for the safety net.
- Phase 3's manual validation runbook takes ~5min including dev server boot. One-time cost per major publish-system change; doesn't repeat per PR.
- Bundle sizes after Phase 1 are unchanged (tsup `noExternal` already pulled the contract source in regardless of dep position).

## Migration Notes

- **`latest` dist-tag stays pinned to legacy versions.** Before this plan: `npm view lightfast dist-tags` → `latest: 0.1.0-alpha.5` (because `publishConfig.tag: "latest"` forced alphas onto `latest`). After this plan + first publish: `latest: 0.1.0-alpha.5` (unchanged — `alpha.6` only updates the `alpha` tag). Consumers running `npm install lightfast` (no tag) keep getting `alpha.5` until a stable release explicitly takes the `latest` tag (via `publishConfig.tag: "latest"` on a non-alpha version OR a manual `npm dist-tag add lightfast@<v> latest`).
  - To prevent users from getting stale `alpha.5` indefinitely, consider manually removing the `latest` tag once after the first new publish: `npm dist-tag rm lightfast latest && npm dist-tag rm @lightfastai/mcp latest`. This is out-of-band (requires npm login + ownership) and is **not part of this plan** — flag for the user.
  - Alternative: leave `latest: 0.1.0-alpha.5` as a "frozen snapshot" until ready to graduate out of pre-mode and cut a real `latest`.
- **SDK breaking change.** `LightfastClient` is no longer a class. Consumers using `new LightfastClient(...)` must switch to `createLightfast(...)`. Captured in the changeset summary. Since the SDK is still alpha (per `.changeset/pre.json:2-3`) and the class previously had no methods (per the oRPC plan's Current State Analysis), downstream impact is expected to be zero.
- **MCP tool surface.** The published `@lightfastai/mcp@0.1.0-alpha.5` registered no tools (per the predecessor plan). `0.1.0-alpha.6` registers `lightfast_system_health`. Any existing MCP-client configs that pointed at the old binary will now see one tool appear; no breakage, additive behavior.
- **No DB migration. No tRPC migration.** Both `(trpc)` mount and the public-API surface are unaffected by this plan (handled by the oRPC plan).

## References

- Predecessor plan: `thoughts/shared/plans/2026-05-10-orpc-public-api-and-api-lib-rework.md` (Phase 3 implementation deltas explicitly defer publish; this plan picks it up).
- Release workflow: `.github/workflows/release.yml`
- Verify-changeset workflow: `.github/workflows/verify-changeset.yml`
- Core CI workflow: `.github/workflows/ci-core.yml`
- Changeset config: `.changeset/config.json` (fixed pair `[lightfast, @lightfastai/mcp]`, pre-mode declared in `.changeset/pre.json:2-3`).
- Latest failed release run (proving the `--dry-run` bug): https://github.com/lightfastai/lightfast/actions/runs/25492012758
- npm packages:
  - `lightfast`: https://www.npmjs.com/package/lightfast (current `latest`: `0.1.0-alpha.5`).
  - `@lightfastai/mcp`: https://www.npmjs.com/package/@lightfastai/mcp (current `latest`: `0.1.0-alpha.5`).
- tsup `noExternal` bundling: `core/lightfast/tsup.config.ts:12-17`, `core/mcp/tsup.config.ts:13`.
- Fixed pair config: `.changeset/config.json:5`.
- Integration test setup (referenced for the test API key shape): `core/lightfast/src/__tests__/integration/setup.ts:33-50`.
