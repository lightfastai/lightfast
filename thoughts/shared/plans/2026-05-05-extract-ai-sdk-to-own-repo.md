# Extract `core/ai-sdk` Into Its Own Repo Implementation Plan

## Overview

Move `@lightfastai/ai-sdk` (currently at `core/ai-sdk/` in this monorepo) into a new standalone GitHub repository (`lightfastai/ai-sdk`), publish a fresh `0.3.0` from that repo, switch the three in-repo consumers from `workspace:*` to the published version, then delete `core/ai-sdk/` and all of its references from the monorepo.

## Current State Analysis

`core/ai-sdk/` is already shaped as a publishable npm package (`@lightfastai/ai-sdk@0.2.1`, ESM-only, multi-entry tsup build, exports map, `.npmignore`, README, CHANGELOG). Despite that, the package has effectively been orphaned in this repo's release pipeline:

- `release.yml:50` only builds `lightfast`, `@lightfastai/mcp`, `@lightfastai/cli` — never `@lightfastai/ai-sdk`.
- `verify-changeset.yml:51` actively rejects changesets that don't mention those three names — so no changeset can be authored for ai-sdk through this repo.
- `ci-core.yml` typechecks/builds/tests only those three.
- `.changeset/pre.json:8` lists `@lightfastai/ai-sdk: 0.2.1` in `initialVersions`, but the rest of the pipeline ignores it.

Net effect: npm has v0.2.1 frozen since the initial release, while the in-repo source has continued to evolve via `workspace:*` linkage to its three consumers. Extraction is the right move — there is no integration value left in keeping it here.

### Workspace coupling (the only things blocking a clean split):

- **`@vendor/observability/error/next`** — used at `core/ai-sdk/src/core/primitives/agent.ts:1` for `parseError`. The whole helper is 12 lines (`vendor/observability/src/error/next.ts:1-12`) and has no transitive deps. **Inline it.**
- **`@repo/typescript-config`** (devDep) — only consumes `compiled-package.json`, which extends `internal/typescript/base.json`. Both files are short and self-contained. **Copy them in.**
- **`@repo/vitest-config`** (devDep) — single file at `internal/vitest-config/vitest.shared.ts`, 21 lines of resource-limit config. **Copy it in.**

### External (npm) deps stay the same:

- Runtime: `@upstash/redis ^1.37.0`, `ai 5.0.52`, `redis ^4.7.0`, `resumable-stream ^2.2.12`, `uuid ^14.0.0`, `zod` (catalog → `^4.3.6`).
- Dev: `tsup ^8.5.1`, `vitest ^4.1.4`, `@vitest/coverage-v8 ^4.1.4`, `@vitest/ui ^4.1.4`, `@types/node` (catalog → `^24.9.1`), `@types/uuid ^11.0.0`, `typescript` (catalog → `^5.9.2`).
- **Keep `redis ^4.7.0`** — no source file imports `redis` directly (only `@upstash/redis` at `src/core/memory/adapters/redis.ts:1`), but `resumable-stream@2.2.12` does a runtime `require("redis")` from its redis adapter subpath. Vitest's import-time module resolution loads it during test collection (e.g. `context-injection.test.ts` doesn't mock `resumable-stream`), and dropping it breaks the test suite. Verified by spike: removing `redis` causes `Cannot find module 'redis'` during vitest collection.

### In-repo consumers to migrate (3, all on `workspace:*`):

| File | Imports | Surface |
|---|---|---|
| `apps/app/package.json:26` | `@lightfastai/ai-sdk/agent`, `@lightfastai/ai-sdk/server/adapters/fetch`, `@lightfastai/ai-sdk/memory` | `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`, `apps/app/src/ai/runtime/memory.ts:1` |
| `packages/app-ai/package.json:17` | `@lightfastai/ai-sdk/tool` | `packages/app-ai/src/org-search.ts:1` |
| `packages/app-ai-types/package.json:18` | `@lightfastai/ai-sdk/server/adapters/types` | `packages/app-ai-types/src/index.ts:1` |

### Other in-repo references to clean up:

- `.changeset/pre.json:8` — `initialVersions` entry for `@lightfastai/ai-sdk`.
- `knip.json:32-35` — `core/ai-sdk` workspace block.
- `.coderabbit.yaml:130-135` — `path: "core/ai-sdk/**"` review instructions.
- `pnpm-workspace.yaml` — `core/*` glob stays (still needs to match `core/cli`, `core/lightfast`, `core/mcp`); just the directory disappears.
- `pnpm-lock.yaml` — regenerated automatically.
- No CI workflow references `core/ai-sdk` directly; nothing to remove from `ci-core.yml`, `release.yml`, `verify-changeset.yml`, `ci.yml`.

### Decisions captured (from planning conversation):

1. New repo: `github.com/lightfastai/ai-sdk`. npm name stays `@lightfastai/ai-sdk`.
2. Strategy A — publish `0.3.0` from the new repo, then switch consumers from `workspace:*` to `^0.3.0`.
3. Preserve git history with `git filter-repo --path core/ai-sdk/ --path-rename core/ai-sdk/:`.
4. Version bump on extraction: `0.2.1 → 0.3.0` (minor — no API change, but a meaningful publishing milestone).
5. Extract the directory as-is and delete it after migration. (`.npmignore` excludes `src/core/v2/` and `src/v2/` but those don't exist on disk.)

## Desired End State

- `github.com/lightfastai/ai-sdk` exists, contains the full git history of `core/ai-sdk/`, builds and tests on its own CI, publishes via changesets to npm.
- `@lightfastai/ai-sdk@0.3.0` is on npm, source map and `.d.ts` parity verified.
- This repo's `apps/app`, `packages/app-ai`, `packages/app-ai-types` depend on `@lightfastai/ai-sdk@^0.3.0` from npm; `pnpm install` and `pnpm typecheck` succeed.
- `core/ai-sdk/` no longer exists in this repo. `pre.json`, `knip.json`, `.coderabbit.yaml` no longer reference it. `pnpm dev:app` and `apps/app/src/app/(api)/v1/answer/[...v]/route.ts` continue to function unchanged.

### Verify with:

```bash
test ! -d core/ai-sdk
grep -r "@lightfastai/ai-sdk" apps packages | grep -v node_modules | grep -v "0.3"  # should be empty
grep -r "core/ai-sdk\|@lightfastai/ai-sdk" .changeset .github knip.json .coderabbit.yaml  # should be empty
pnpm install --frozen-lockfile && pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types
```

## What We're NOT Doing

- **No API changes** to `@lightfastai/ai-sdk`. Public surface is identical to v0.2.1 plus whatever has accumulated in src since.
- **No re-running of the v2 carve-out.** `.npmignore` already excludes `src/core/v2/` and `src/v2/`; those directories don't exist on disk. Take it as-is.
- **No replacement for `@vendor/observability` beyond `parseError`.** Don't pull in logging or Sentry into the new repo.
- **No move of `lightfast`, `@lightfastai/mcp`, `@lightfastai/cli`.** Those stay in this monorepo and continue to publish from `release.yml`.
- **No change to `apps/app` business logic.** The only edits are dependency-version bumps in `package.json`.
- **No archive-and-restart approach.** History preservation is required.

## Implementation Approach

Four sequential phases with explicit halts for human review at each boundary. The risk-ordering is: (1) prove the new repo can build and publish a working artifact; (2) prove that artifact is interchangeable with the workspace version inside this repo; (3) only then delete the in-repo source. Doing (3) first would force a broken tree in this repo while the new repo gets set up.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Setup — Branch into a new worktree

### Overview

All in-monorepo edits for this extraction (Phase 3's consumer migration and Phase 4's directory removal) happen in a dedicated worktree off `main`. This isolates the work from the currently active branch (`desktop-portless-runtime-batch`), keeps `pnpm install` lockfile decisions scoped to this work, and gives a clean branch to PR from.

The new-repo bootstrap (Phase 1) and the npm publish (Phase 2) happen elsewhere — in a throwaway clone at `/tmp/ai-sdk-extract` and then the new GitHub repo (`github.com/lightfastai/ai-sdk`). Those steps don't touch this monorepo's working tree, so they don't need this worktree.

### Changes Required:

#### 1. Create the worktree off `origin/main`

```bash
# From this monorepo's root
git fetch origin main
git worktree add ../lightfast-extract-ai-sdk -b extract/ai-sdk-to-own-repo origin/main
cd ../lightfast-extract-ai-sdk
```

Branch name: `extract/ai-sdk-to-own-repo` — scope is clear from the slug, prefix matches feature-branch convention.

#### 2. Install dependencies in the worktree

```bash
pnpm install
```

Confirms the worktree resolves cleanly off `main` before any edits land.

#### 3. Confirm starting state

```bash
git status                       # expect: clean
git branch --show-current        # expect: extract/ai-sdk-to-own-repo
git rev-parse origin/main        # record this SHA — it's the merge base
pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types
# expect: exit 0 — baseline before any consumer migration
```

#### 4. Prereq check for tools used in later phases

```bash
which git-filter-repo            # Phase 1 — install via `brew install git-filter-repo` if missing
which gh && gh auth status       # Phase 1 — must be logged in to lightfastai org
npm whoami                       # Phase 2 — must have publish access to @lightfastai scope
```

### Success Criteria:

#### Automated Verification:

- [ ] `git worktree list` shows `../lightfast-extract-ai-sdk` on branch `extract/ai-sdk-to-own-repo`.
- [ ] `pnpm install --frozen-lockfile` succeeds in the worktree (no drift from `main`).
- [ ] Baseline `pnpm turbo typecheck` for the three consumer workspaces exits 0 — confirms the worktree compiles before any changes.
- [ ] `git-filter-repo`, `gh` (authenticated), `npm` (authenticated as a publisher of `@lightfastai/*`) are all present.

#### Human Review:

- [ ] User confirms intent to land Phases 3 and 4 against this branch (Phases 1 and 2 happen outside this monorepo).

---

## Phase 1: Bootstrap the new repo with extracted history [DONE]

### Overview

Create `github.com/lightfastai/ai-sdk`, seed it with `core/ai-sdk/`'s history via `git filter-repo`, decouple from monorepo workspace deps, set up its own build/test/release CI, and verify it builds locally. **Do not publish yet.**

### Changes Required:

#### 1. Create the new GitHub repo

**Action**: Create empty `github.com/lightfastai/ai-sdk` (private during setup, can flip to public on first release). No template, no README — `git filter-repo` will populate it.

#### 2. Extract history with git filter-repo

**Where**: A throwaway local clone of `lightfastai/lightfast`, NOT this working tree.

**Prereq**: `git filter-repo` is a separate tool, not bundled with git. Install with `brew install git-filter-repo` (macOS) or `pip install git-filter-repo`.

**Commands**:
```bash
# Fresh clone — filter-repo refuses to operate on a non-fresh clone
git clone https://github.com/lightfastai/lightfast.git /tmp/ai-sdk-extract
cd /tmp/ai-sdk-extract

# Extract only core/ai-sdk/ and rewrite paths to repo root
git filter-repo --path core/ai-sdk/ --path-rename core/ai-sdk/:

# Verify: the working tree should now contain only what was under core/ai-sdk/
ls  # expect: package.json, src/, README.md, CHANGELOG.md, etc.

# CHANGELOG.md is carried as-is by filter-repo. Leave it; changesets will append new entries on top.

# Point at the new remote
git remote add origin git@github.com:lightfastai/ai-sdk.git
git push -u origin main
```

#### 3. Inline `parseError` and drop `@vendor/observability`

**Files**: `src/core/primitives/agent.ts` AND `tsup.config.ts` (in the new repo)

**Changes**:
- Replace `import { parseError } from "@vendor/observability/error/next";` with a local helper.

```ts
// At top of agent.ts (or extract to src/core/lib/parse-error.ts if other files end up needing it)
const parseError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return (error as { message: string }).message;
  }
  if (typeof error === "string") return error;
  return String(error);
};
```

- **Also remove `"@vendor/observability"` from `tsup.config.ts`'s `external` array** (currently around lines 35-42). Leaving it externalized after the dep is gone produces a stale config artifact and a dangling reference to a package that no longer exists.

**Rationale**: 12-line trivial helper, no value in pulling `@vendor/observability` into the new repo just for this. Verify there are no other `@vendor/*` imports anywhere in `src/`. Spike-confirmed: the inlined helper is byte-equivalent semantically and the build/test suite passes after removing the dep + external entry.

#### 4. Inline tsconfig and vitest configs

**Files to create in the new repo**:

- `tsconfig.base.json` — copy of `internal/typescript/base.json` from this repo.
- `tsconfig.json` — replace `"extends": "@repo/typescript-config/compiled-package.json"` with a local extends chain. The `compiled-package` layer is 7 lines; merge it directly into `tsconfig.json` so there's only one config file:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "noEmit": false,
    "outDir": "./dist",
    "types": ["node"],
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "examples"]
}
```

- `tsconfig.build.json` — keep as-is, already self-contained relative to `tsconfig.json`.
- `vitest.config.ts` — drop `@repo/vitest-config` dependency, inline the resource-limit settings:

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    maxWorkers: 2,
    fileParallelism: false,
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.spec.ts", "**/*.config.ts"],
    },
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
  },
  resolve: {
    alias: { "~": resolve(import.meta.dirname, "./src") },
  },
});
```

#### 5. Update `package.json`

**File**: `package.json` (in the new repo)

**Changes**:
- `"version": "0.2.1"` → `"version": "0.3.0"`
- Remove `"@vendor/observability": "workspace:*"` from `dependencies`.
- Remove `"@repo/typescript-config": "workspace:*"` and `"@repo/vitest-config": "workspace:*"` from `devDependencies`.
- Replace `"zod": "catalog:"` with `"zod": "^4.3.6"` (resolved from this repo's `pnpm-workspace.yaml:58`).
- Replace `"@types/node": "catalog:"` with `"@types/node": "^24.9.1"`.
- Replace `"typescript": "catalog:"` with `"typescript": "^5.9.2"`.
- **Keep `"redis": "^4.7.0"`** — `resumable-stream`'s redis adapter does a runtime `require("redis")`, and vitest collection imports it transitively. Spike confirmed dropping this breaks `pnpm test`.
- Confirm `"repository.url"` still points to `github.com/lightfastai/lightfast.git` — change to `github.com/lightfastai/ai-sdk.git` and drop the `directory` field.
- Add `"keywords"` if desired (already present); add `engines.node` (already present at `>=18`).
- Add `"files": ["dist"]` (replaces `.npmignore`-driven publish with an explicit allowlist — cleaner for a standalone repo).
- Add `"publishConfig": { "tag": "latest", "access": "public" }` — matches the convention of `core/mcp` and `core/cli` in the monorepo, and makes the npm tag/access intent explicit at the package level instead of relying solely on `.changeset/config.json`.
- **Delete `.npmignore` entirely** once `"files": ["dist"]` is in place. The current `.npmignore` excludes paths that don't exist (`src/core/v2/`, `src/v2/`) and duplicates what `files` now declares — leaving both is exactly the kind of duplication that rots silently.

#### 6. Set up CI in the new repo

**Files to create**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.changeset/config.json`, `.changeset/README.md`.

**`ci.yml`** — quality + build + test on PR/push to main:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
```

**`release.yml`** — modeled on this repo's `release.yml:1-103` but scoped to a single package:

```yaml
name: Release
on:
  push:
    branches: [main]
    paths:
      - '.changeset/**'
      - '.github/workflows/release.yml'
  workflow_dispatch:
concurrency: ${{ github.workflow }}-${{ github.ref }}
jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm changeset publish --dry-run
      - id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm changeset publish
          setupGitUser: false
        env:
          GITHUB_TOKEN: ${{ secrets.LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.LIGHTFAST_RELEASE_BOT_NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

**`.changeset/config.json`**:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Secrets required on the new repo**: `LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN`, `LIGHTFAST_RELEASE_BOT_NPM_TOKEN`. Copy from this repo's GitHub Environments / Settings → Secrets.

#### 7. Add a release changeset for 0.3.0

**File**: `.changeset/extract-from-monorepo.md`

```md
---
"@lightfastai/ai-sdk": minor
---

Extract `@lightfastai/ai-sdk` into its own repository. No public API changes; this is a packaging/governance milestone. Future development happens at github.com/lightfastai/ai-sdk.
```

#### 8. Smoke build locally

**Commands** (in the new repo):

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
ls dist/  # expect: index.mjs, agent.mjs, tool.mjs, server/, memory/, cache.mjs, client/, plus .d.ts and .map
```

### Success Criteria:

#### Automated Verification:

- [x] `git filter-repo` produces a tree where `package.json` sits at root and history shows commits like the original `core/ai-sdk/` history. (66 commits preserved.)
- [x] In the new repo: `pnpm install` succeeds with no `workspace:*` references and no catalog references.
- [x] `pnpm typecheck` passes (no missing `@vendor/*` or `@repo/*` modules).
- [x] `pnpm build` produces `dist/` with all entry points listed in `package.json:25-65` (`./`, `./client`, `./agent`, `./tool`, `./server/adapters/fetch`, `./server/adapters/types`, `./memory`, `./memory/adapters/in-memory`, `./memory/adapters/redis`, `./cache`).
- [x] `pnpm test` passes (149 tests across 9 files).
- [x] `pnpm changeset status` confirms `@lightfastai/ai-sdk` would be bumped at minor (`0.3.0`). **Plan correction**: `pnpm changeset publish --dry-run` is not a real flag in `@changesets/cli@2.31.0`; the equivalent validation is `pnpm changeset status`. `release.yml` was updated to reflect this.
- [x] `grep -r "@vendor\|@repo\|workspace:\*\|catalog:" .` in the new repo returns nothing (excluding node_modules / dist / pnpm-lock.yaml).
- [x] CI workflow `.github/workflows/ci.yml` runs green on `main` of the new repo (49s end-to-end).

#### Human Review:

- [ ] Open the new repo on GitHub; confirm `git log --oneline | head -20` shows real ai-sdk commit messages, not a single squashed "initial commit".
- [ ] Open `package.json` in the new repo and confirm: version is `0.3.0`, repository URL is `github.com/lightfastai/ai-sdk.git`, no `directory` field, no workspace/catalog references.
- [ ] Open `dist/index.d.ts` in the new repo and confirm public types resolve (no `@vendor/*` references in declarations).

#### Phase 1 implementation deltas (vs. plan-as-written)

- **`pnpm changeset publish --dry-run` does not exist** as a CLI flag in `@changesets/cli@2.31.0`. Replaced with `pnpm changeset status` everywhere it appeared (local smoke + `release.yml`).
- **Added `@changesets/cli@^2.31.0` to devDependencies** of the new repo. The plan listed it implicitly (CI invokes `pnpm changeset publish` / `version`), but the standalone repo cannot rely on a monorepo-root devDep.
- **Pinned `packageManager: "pnpm@10.32.1"` in package.json**. `pnpm/action-setup@v4` requires either a `version` workflow input or `packageManager` in `package.json`; without it CI fails immediately. Pin matches the monorepo of origin.
- **Removed `turbo.json` from the extracted tree**. The original `extends: ["//"]` references the root monorepo turbo config and is non-functional standalone. Package scripts (`pnpm build`/`test`) invoke `tsup`/`vitest` directly without turbo.
- **Added a standalone `.gitignore`**. The monorepo's root `.gitignore` was not carried by `git filter-repo` (it lived above `core/ai-sdk/`); the standalone repo needs its own.
- **Bootstrap landed in two commits**: (1) the main extract+bootstrap commit, (2) a small follow-up `ci: pin pnpm version via packageManager field` after the first CI run failed on missing `packageManager`. Kept rather than amend+force-push to preserve the audit trail.

---

## Phase 2: Publish `0.3.0` from the new repo [DONE — direct local publish]

### Phase 2 outcome (2026-05-05)

- **`v0.2.1` was never on npm** — `npm view @lightfastai/ai-sdk@0.2.1` returned 404. The provenance-continuity concern from §0 was moot; this was effectively a first publish.
- **Skipped the changeset CI flow for the bootstrap** and published `0.3.0` directly from `/tmp/ai-sdk-extract` via `npm publish`. Trade-off: no provenance attestation on `0.3.0`. Future CI-driven releases via `release.yml` will carry provenance.
- The pre-publish bootstrap had created BOTH `package.json: "0.3.0"` and a queued `minor` changeset, which together would have driven `0.3.0 → 0.4.0` on the next `changeset version` run. Resolved by deleting the changeset before publish and prepending a `0.3.0` entry directly to `CHANGELOG.md`.
- **Tarball**: 35 files, 62 KB packed. `dist/**` + `package.json` + `README.md` + `LICENSE` + `CHANGELOG.md`. `files: ["dist", "CHANGELOG.md"]` was added because npm doesn't auto-include `CHANGELOG.md` even when a `files` allowlist is present.
- **Smoke install** verified: all five subpaths consumed by this monorepo resolve from npm (`/agent`, `/tool`, `/server/adapters/fetch`, `/server/adapters/types`, `/memory`). `server/adapters/types` exports zero runtime symbols by design (types-only).
- **Tagging**: `v0.3.0` tag pushed. The initial `git push --follow-tags` accidentally carried over stale monorepo release tags (`@lightfastai/mcp@0.1.0-alpha.*`, `lightfast@0.1.0-alpha.*`) that filter-repo had brought into the new repo's history. Cleaned up — only `v0.3.0` and the historical `@lightfastai/ai-sdk@0.2.1` tag remain on the new repo.

### Overview

Cut the first release from the new repo. This is the riskiest external-facing step — once on npm, `0.3.0` cannot be unpublished after 72 hours.

### Changes Required:

#### 0. Verify provenance continuity BEFORE first publish

`v0.2.1` was published from this monorepo with `NPM_CONFIG_PROVENANCE: true`. If the first publish from the new repo doesn't carry forward the attestation, the npm package page silently loses its provenance badge — a worse trust signal than v0.2.1 had.

```bash
npm view @lightfastai/ai-sdk@0.2.1 --json | jq '.dist.attestations'
# expect: a non-null object with provenance attestation metadata
```

If `v0.2.1` had attestations, the new repo's `release.yml` MUST publish with `NPM_CONFIG_PROVENANCE: true` and `id-token: write` (already in the template above) on the very first release. If it didn't, this concern is moot — but check explicitly so you don't regress quietly.

#### 1. Land Phase 1's changes on `main` of the new repo

Push everything from Phase 1, run CI, get green.

#### 2. Trigger the release workflow

The changeset bot opens a "Version Packages" PR (because there's a pending changeset). Merge that PR → `release.yml` re-runs and `pnpm changeset publish` pushes `@lightfastai/ai-sdk@0.3.0` to npm with provenance.

#### 3. Verify the published artifact

**Commands** (anywhere):

```bash
npm view @lightfastai/ai-sdk@0.3.0
npm view @lightfastai/ai-sdk@0.3.0 dist.tarball  # tarball URL

# Smoke-install in a scratch dir — exercise EVERY subpath consumed in this repo,
# not just /agent. Subpath resolution bugs in the exports map (missing dist file,
# wrong .d.ts path) only surface when you actually import the path.
mkdir /tmp/ai-sdk-smoke && cd /tmp/ai-sdk-smoke
npm init -y
npm install @lightfastai/ai-sdk@0.3.0 ai zod @upstash/redis resumable-stream uuid
node --input-type=module -e "
  Promise.all([
    import('@lightfastai/ai-sdk/agent'),
    import('@lightfastai/ai-sdk/tool'),
    import('@lightfastai/ai-sdk/server/adapters/fetch'),
    import('@lightfastai/ai-sdk/server/adapters/types'),
    import('@lightfastai/ai-sdk/memory'),
  ]).then(mods => mods.forEach(m => console.log(Object.keys(m))));
"
# expect: 5 lines, each a non-empty array of exports.
# Specifically: agent must include 'createAgent'; tool must include 'createTool';
# server/adapters/fetch must include 'fetchRequestHandler'; memory must include 'Memory'.
```

### Success Criteria:

#### Automated Verification:

- [ ] `npm view @lightfastai/ai-sdk version` returns `0.3.0`.
- [ ] `npm view @lightfastai/ai-sdk@0.3.0 dist.tarball` returns a tarball URL on `registry.npmjs.org`.
- [ ] The smoke-install snippet above prints a non-empty export list.
- [ ] The `release.yml` workflow run on the new repo shows a green "Create Release Pull Request or Publish to npm" step with `published: true`.
- [ ] The release was published with `NPM_CONFIG_PROVENANCE: true` (visible on the npm package page).

#### Human Review:

- [ ] On https://www.npmjs.com/package/@lightfastai/ai-sdk, confirm `0.3.0` appears with provenance attestation visible.
- [ ] Open the GitHub release on `lightfastai/ai-sdk` and confirm changelog entry mentions extraction from monorepo.

---

## Phase 3: Migrate in-repo consumers from `workspace:*` to `^0.3.0` [DONE]

### Overview

Switch `apps/app`, `packages/app-ai`, `packages/app-ai-types` to consume the published `@lightfastai/ai-sdk@^0.3.0`. **Do not delete `core/ai-sdk/` yet** — keeping it allows fast rollback if the published artifact has a regression we missed.

### Changes Required:

#### 1. Update `apps/app/package.json`

**File**: `apps/app/package.json`
**Change**: line 26.

```diff
-    "@lightfastai/ai-sdk": "workspace:*",
+    "@lightfastai/ai-sdk": "^0.3.0",
```

#### 2. Update `packages/app-ai/package.json`

**File**: `packages/app-ai/package.json`
**Change**: line 17.

```diff
-    "@lightfastai/ai-sdk": "workspace:*",
+    "@lightfastai/ai-sdk": "^0.3.0",
```

#### 3. Update `packages/app-ai-types/package.json`

**File**: `packages/app-ai-types/package.json`
**Change**: line 18.

```diff
-    "@lightfastai/ai-sdk": "workspace:*",
+    "@lightfastai/ai-sdk": "^0.3.0",
```

#### 4. Reinstall and regenerate lockfile

```bash
pnpm install
git diff pnpm-lock.yaml | head -100  # sanity check the resolution
```

#### 5. Verify everything still typechecks and tests

```bash
pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types
pnpm turbo test --filter=@lightfast/app
pnpm turbo build --filter=@lightfast/app
```

#### 6. (Optional) Quick runtime smoke

Start the app and hit the answer route:

```bash
pnpm dev:app > /tmp/console-dev.log 2>&1 &
# wait for it to boot
curl -X POST http://localhost:4107/api/v1/answer/answer-v1/test-session \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"ping"}]}'
pkill -f "next dev"
```

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm install --frozen-lockfile` succeeds after lockfile regeneration.
- [ ] `grep -r "\"@lightfastai/ai-sdk\": \"workspace:" apps packages` returns nothing.
- [ ] `pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types` exits 0.
- [ ] `pnpm turbo test --filter=@lightfast/app` exits 0.
- [ ] `pnpm turbo build --filter=@lightfast/app` exits 0.
- [ ] `pnpm-lock.yaml` resolves `@lightfastai/ai-sdk@0.3.0` from `registry.npmjs.org`, not `link:core/ai-sdk`.

#### Human Review:

- [ ] Open `apps/app/src/app/(api)/v1/answer/[...v]/route.ts` in an editor; "Go to definition" on `createAgent` jumps into `node_modules/@lightfastai/ai-sdk/dist/agent.d.ts`, not `core/ai-sdk/src/...`.
- [ ] Run the curl smoke above; the answer endpoint streams a response without errors in `/tmp/console-dev.log`.

---

## Phase 4: Remove `core/ai-sdk/` and dangling references [DONE]

### Phase 3 + 4 outcome (2026-05-05)

- Landed in PR #634 on `lightfastai/lightfast` from branch `extract/ai-sdk-to-own-repo` (committed in the worktree at `/Users/jeevanpillay/Code/@lightfastai/lightfast-extract-ai-sdk`).
- Split into two commits per the rollback-granularity rationale: `Switch ai-sdk consumers from workspace:* to npm ^0.3.0` (Phase 3, +26/-70) and `Remove core/ai-sdk and dangling references` (Phase 4, -8205).
- Lockfile resolves `@lightfastai/ai-sdk@0.3.0` from `registry.npmjs.org` with the published sha512 integrity hash. No `core/ai-sdk:` workspace block in the lockfile, no `link:core/ai-sdk` references.
- Verified: `pnpm install --frozen-lockfile` ✓, `turbo typecheck` for the three consumers ✓, `turbo test --filter=@lightfast/app` ✓ (60 tests), `turbo boundaries` ✓ (0 issues across 925 files / 53 packages), `pnpm knip` no `core/ai-sdk` warnings.
- **Known caveat (pre-existing on main, not a Phase 3/4 regression)**: `pnpm turbo build --filter=@lightfast/app` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `@lightfastai/related-projects/related-projects`. The exports map declares `./related-projects` as ESM-only (no `default`/`require` condition), so Next.js's CJS-style `next.config.ts` loader chokes. Reproduces with no Phase 3/4 changes applied. All 18 published versions of `@lightfastai/related-projects` ship the same broken map. The active branch (`portless-proxy-rename-and-tightening`) sidesteps this by switching to `@lightfastai/dev-proxy/projects`. Out of scope for this PR.

### Overview

Now that consumers resolve from npm, delete the in-repo source and the few config blocks that still mention it. After this phase, no trace of `core/ai-sdk` remains in the monorepo.

### Changes Required:

#### 1. Delete the directory

```bash
git rm -r core/ai-sdk
```

`pnpm-workspace.yaml`'s `core/*` glob stays (it still matches `core/cli`, `core/lightfast`, `core/mcp`).

#### 2. Update `.changeset/pre.json`

**File**: `.changeset/pre.json`
**Change**: remove line 8 (`"@lightfastai/ai-sdk": "0.2.1",`).

#### 3. Update `knip.json`

**File**: `knip.json`
**Change**: remove the `"core/ai-sdk"` workspace entry (lines 32-35).

```diff
-    "core/ai-sdk": {
-      "entry": ["src/core/memory/adapters/*.ts", "src/core/test-utils/*.ts"],
-      "project": ["src/**/*.ts"]
-    },
```

#### 4. Update `.coderabbit.yaml`

**File**: `.coderabbit.yaml`
**Change**: remove the `core/ai-sdk/**` review-instructions block (lines 130-135).

```diff
-    - path: "core/ai-sdk/**"
-      instructions: |
-        Core AI SDK package (@lightfastai/ai-sdk). Review for:
-        - Public API surface stability — breaking changes need justification
-        - Test coverage for primitives (agent, tool, server)
-        - Proper error handling and types
```

#### 5. Reinstall and verify nothing breaks

```bash
pnpm install
pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types
pnpm knip   # should not flag any newly-broken workspace
pnpm turbo boundaries
```

#### 6. Update README/docs that reference the in-repo path (if any)

Already verified: no `apps/`, `scripts/`, or `packages/` files reference `core/ai-sdk` outside of `package.json` workspace deps (Phase 3 covered those). The `thoughts/` directory has historical research that mentions it — leave those as-is; they're snapshots of the past.

### Success Criteria:

#### Automated Verification:

- [ ] `test ! -d core/ai-sdk` succeeds.
- [ ] `grep -rn "core/ai-sdk\|@lightfastai/ai-sdk" .changeset .github knip.json .coderabbit.yaml pnpm-workspace.yaml` returns no matches.
- [ ] `grep -rn "\"@lightfastai/ai-sdk\":" apps packages | grep -v "\\^0.3"` returns no matches (only `^0.3.x` references remain).
- [ ] `pnpm install --frozen-lockfile` succeeds (lockfile is consistent after directory removal).
- [ ] `pnpm turbo typecheck --filter=@lightfast/app --filter=@repo/app-ai --filter=@repo/app-ai-types` exits 0.
- [ ] `pnpm knip` runs cleanly with respect to `core/ai-sdk` (no "missing workspace" warnings).
- [ ] `pnpm turbo boundaries` exits 0.
- [ ] CI on the resulting PR is green: `ci.yml` (quality + boundaries + knip), `ci-core.yml` still passes (it never touched ai-sdk), `verify-changeset.yml` doesn't apply (no changesets being added).

#### Human Review:

- [ ] In a fresh shell: `pnpm dev:app > /tmp/console-dev.log 2>&1 &` then hit the curl smoke from Phase 3 step 6 → endpoint streams successfully, no module-not-found errors in the log.
- [ ] `git log --stat -1` on the cleanup commit shows the deletion of `core/ai-sdk/**`, edits to `.changeset/pre.json`, `knip.json`, `.coderabbit.yaml`, and the three consumer `package.json` files (if not already split into a previous commit).

---

## Testing Strategy

### Unit Tests:

- **In the new repo (Phase 1)**: existing vitest suite under `src/core/**/*.test.ts` — must pass without modification. These were already passing in the monorepo with `@vendor/observability` available; the only behavioral change is the inlined `parseError`, which has byte-identical semantics to the original.
- **In this repo (Phase 3)**: `apps/app`'s vitest suite continues to pass against the npm version.

### Integration Tests:

- The Phase 3 curl smoke against `apps/app/src/app/(api)/v1/answer/[...v]/route.ts` exercises the full path: `createAgent` from `/agent`, `fetchRequestHandler` from `/server/adapters/fetch`, `Memory` type from `/memory` — the three sub-paths actually used in production.
- Repeat the same smoke at the end of Phase 4 to confirm directory removal didn't introduce a stale resolution somewhere.

### Manual Verification:

- The Phase 2 npm smoke-install proves the published tarball is self-contained (resolves with only its declared dependencies, no phantom `@vendor/*` lookups).

## Performance Considerations

None. This is a packaging change — runtime code paths are identical. Build time in this repo decreases marginally (one fewer workspace package to typecheck/build). The new repo's CI runs in under 5 minutes (typecheck + build + ~30 vitest files).

## Migration Notes

- **For external users**: this is invisible. Same npm name, same exports, same import paths.
- **For internal consumers (apps/app, packages/app-ai, packages/app-ai-types)**: they switch from instant workspace linking to npm resolution. Future ai-sdk changes now require: PR to `lightfastai/ai-sdk` → merge → release → version bump in this repo. Lose: same-day iteration. Gain: a clean public package boundary and the ability to consume ai-sdk from outside this monorepo.
- **Rollback**: until Phase 4 lands, rolling back is trivial — flip the three `^0.3.0` entries back to `workspace:*` and re-run `pnpm install`. After Phase 4, rollback requires `git revert` of the deletion commit (history is preserved, so this is safe).
- **Existing v0.2.1 on npm**: untouched. v0.3.0 supersedes it without conflict.

## References

- Source directory: `core/ai-sdk/` (this repo, branch `desktop-portless-runtime-batch`)
- New repo: `github.com/lightfastai/ai-sdk` (to be created in Phase 1)
- Existing release pattern modeled on: `.github/workflows/release.yml:1-103`
- Existing CI pattern modeled on: `.github/workflows/ci-core.yml:1-144`
- The single workspace coupling to break: `core/ai-sdk/src/core/primitives/agent.ts:1` → `vendor/observability/src/error/next.ts:1-12`
- Consumers to migrate: `apps/app/package.json:26`, `packages/app-ai/package.json:17`, `packages/app-ai-types/package.json:18`
- Cleanup targets: `.changeset/pre.json:8`, `knip.json:32-35`, `.coderabbit.yaml:130-135`

---

## Improvement Log

### 2026-05-05 — Adversarial review pass

Spike-validated Phase 1 in an isolated worktree (inline `parseError`, drop `@vendor/observability` from deps + tsup external, replace `catalog:` with explicit versions, inline `tsconfig.base.json` + `vitest.config.ts`, then `pnpm install --ignore-workspace && pnpm typecheck && pnpm build && pnpm test`). Verdict: **PARTIAL** — the decoupling works as designed, but the plan had one wrong claim that would have broken the test suite.

**Spike key finding (CRITICAL plan correction):** Dropping `redis ^4.7.0` is wrong. `resumable-stream@2.2.12` does a runtime `require("redis")` from its redis adapter subpath, and vitest's import-time module resolution loads it during test collection (e.g. `context-injection.test.ts` does not mock `resumable-stream`). Removing `redis` causes `Cannot find module 'redis'` at vitest collection time. The plan originally claimed `redis` was unused based on a `from "redis"` source grep, which missed the transitive runtime dep through `resumable-stream`. **Updated**: keep `redis ^4.7.0` in `dependencies`.

**Other changes from review:**

- **Critical — `tsup.config.ts` external list**: added explicit step in Phase 1 §3 to remove `"@vendor/observability"` from the `external` array. The original plan inlined `parseError` and dropped the package.json dep but left tsup's external entry pointing at a now-nonexistent package.
- **High — provenance continuity**: added Phase 2 §0 to verify `npm view @lightfastai/ai-sdk@0.2.1 --json | jq .dist.attestations` before the first 0.3.0 publish, so the new repo doesn't silently lose the attestation badge that v0.2.1 carried.
- **High — Phase 2 smoke install**: expanded from importing only `/agent` to importing all five subpaths consumers actually depend on (`/agent`, `/tool`, `/server/adapters/fetch`, `/server/adapters/types`, `/memory`). Subpath resolution bugs in published exports maps only surface when the path is actually imported.
- **Improvement — `publishConfig`**: added `"publishConfig": { "tag": "latest", "access": "public" }` to the new repo's `package.json` to match the convention of `core/mcp` and `core/cli`.
- **Improvement — `.npmignore` deletion**: changed "Optional: delete .npmignore" to a hard delete once `"files": ["dist"]` is in place. The current `.npmignore` excludes paths that don't exist on disk and duplicates what `files` declares.
- **Improvement — `git filter-repo` prereq**: added install note (`brew install git-filter-repo` / `pip install git-filter-repo`).
- **Improvement — CHANGELOG.md**: explicitly noted that filter-repo carries it forward as-is and changesets appends from there.

**Confirmed (no changes needed):**

- Only one cross-workspace import in `core/ai-sdk/src` (`@vendor/observability/error/next` in `agent.ts:1`).
- Three consumers, exactly as listed; subpaths used: `/agent`, `/server/adapters/fetch`, `/server/adapters/types`, `/tool`, `/memory`.
- `parseError` inlining is byte-equivalent semantically.
- `pnpm-workspace.yaml` lives at monorepo root, not under `core/ai-sdk/`, so `git filter-repo --path core/ai-sdk/` won't carry it.
- `@lightfastai/dev-*` family is the established precedent for "external on npm, consumed via catalog/range" in this pnpm setup.
- `@lightfastai/ai-sdk` is not in the `fixed: [["lightfast", "@lightfastai/mcp"]]` group in `.changeset/config.json`, so extraction doesn't fracture a fixed group.
- `verify-changeset.yml:51` hardcodes `lightfast|@lightfastai/mcp|@lightfastai/cli` — ai-sdk is genuinely orphaned in the existing pipeline.

**Decisions (user, 2026-05-05):**
- Phase 3 and Phase 4 stay split (rollback granularity).
- Consumer dep range: `^0.3.0` (npm 0.x rule resolves to `>=0.3.0 <0.4.0`).
