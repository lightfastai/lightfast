# Relicense Lightfast from FSL to Apache 2.0 + MIT Implementation Plan

## Overview

Drop the Functional Source License (FSL-1.1-ALv2) and fully commit to open source. The platform (everything currently FSL) moves to Apache 2.0. SDKs and shared libraries stay MIT. Kill `LICENSING.md` — per-package `LICENSE` files + SPDX `license` fields in `package.json` carry the full story. Add DCO enforcement so contributors grant rights via `Signed-off-by:` with zero paperwork.

## Current State Analysis

The repo is already a hybrid license:

- **FSL-1.1-ALv2** — root `LICENSE` (the text of FSL with Apache 2.0 as the 2-year future grant), `LICENSING.md` (the explanatory matrix), `CONTRIBUTING.md:217` (contributor grant clause), `README.md:7` (badge) and `README.md:233-237` (License section), plus **24 `package.json` files** declaring `"license": "FSL-1.1-Apache-2.0"`.
- **MIT** — `core/*` (the published SDKs: lightfast, ai-sdk, cli, mcp), all `vendor/*`, `packages/ui`, `packages/lib`, `packages/prompt-engine`, `packages/dotlightfast`, `packages/email`. These have correct `package.json` license fields but **only `core/ai-sdk/LICENSE` actually exists on disk** — the other three published `core/*` packages are shipping npm tarballs without bundled license text.

Contributors per `git log`: effectively solo (Jeevan + bots). No CLA relicensing risk — the copyright holder is making the decision unilaterally.

No SPDX headers in source files. No FSL references in `apps/www` content legal pages (`privacy.mdx`, `terms.mdx`) — those are company terms, separate from software license, and do not need to be touched.

No existing DCO enforcement in `.github/workflows/` (5 workflows present: `ci.yml`, `ci-core.yml`, `release.yml`, `verify-changeset.yml`, `db-migrate.yml`).

## Desired End State

- `/LICENSE` is the Apache License 2.0 text with `Copyright 2025 Lightfast Pty Ltd` applied via the standard `APPENDIX` notice.
- `/LICENSING.md` does not exist.
- `core/lightfast/LICENSE`, `core/cli/LICENSE`, `core/mcp/LICENSE` exist as MIT text files (matching the style of the existing `core/ai-sdk/LICENSE`).
- Every `package.json` that previously said `"license": "FSL-1.1-Apache-2.0"` now says `"license": "Apache-2.0"` (SPDX identifier). 24 files.
- `README.md` badge shows Apache-2.0; License section rewritten to reflect the split.
- `CONTRIBUTING.md` removes the FSL clause and adds a DCO clause.
- `.github/workflows/dco.yml` enforces `Signed-off-by:` on PR commits, OR the [DCO GitHub App](https://github.com/apps/dco) is installed on the org (user's admin decision at apply time).
- `rg -F "FSL"` and `rg -F "Functional Source"` return zero results outside of `thoughts/`, `node_modules/`, and historical git log.
- GitHub's repo sidebar displays "Apache-2.0" as the detected license.
- `pnpm install && pnpm typecheck` pass; platform and app builds succeed.

### Key Discoveries

- `core/ai-sdk/LICENSE` (`/Users/jeevanpillay/Code/@lightfastai/lightfast/core/ai-sdk/LICENSE:1-22`) is the canonical MIT template we mirror for the other three `core/*` packages.
- GitHub detects repo license from the root `LICENSE` file via the [licensee](https://github.com/licensee/licensee) ruby library — replacing the file text is sufficient; no repo setting change required.
- SPDX identifier `Apache-2.0` is what goes in `package.json`. Not `Apache 2.0`, not `Apache License 2.0`. npm and OSS scanners match on the exact SPDX string.
- Apache 2.0's license text includes an `APPENDIX` at the end with the standard boilerplate for applying it to new work. This is where the copyright line goes — NOT in the body of the license itself (which must be reproduced verbatim).

## What We're NOT Doing

- **No `TRADEMARK.md`** — decided against. Revisit separately if the brand needs protection later.
- **No `LICENSE` files in `vendor/*` or library-shaped `packages/*`** — `package.json` `license` field is sufficient for internal packages; explicit user decision to skip.
- **No changelog entry, blog post, or Discord/Twitter announcement in this plan** — separate editorial effort.
- **No changes to `apps/www` legal pages** (`privacy.mdx`, `terms.mdx`) — they don't reference the software license; verified by grep.
- **No SPDX headers added to source files** — the `package.json` `license` field and the repo `LICENSE` file cover OSI/SPDX requirements. File-level SPDX is an optional hygiene pass for later.
- **No CLA (Contributor License Agreement)** — DCO is the lower-friction Apache-ecosystem default. CLA is heavier paperwork we don't need.
- **No rewrite of historical FSL-licensed releases** — previously-tagged versions stay FSL forever (it's in the commit history and the published artifacts). The relicense applies from the next commit onward.
- **No changes to `SECURITY.md`, `RELEASE.md`, or `SPEC.md`** — they don't mention the license.

## Implementation Approach

Mechanical changes in six small phases. No logic risk — all text substitution + file moves. Each phase independently verifiable.

Ordering: root license first (the foundational change), then `core/*` MIT files (so no MIT package ships without a LICENSE after the cutover), then the `package.json` sweep, then the docs + DCO plumbing.

---

## Phase 1: Root License + LICENSING.md Removal

### Overview

Replace FSL text with Apache 2.0 text at `/LICENSE`. Delete `/LICENSING.md`.

### Changes Required

#### 1. Replace `/LICENSE`

**File**: `/LICENSE`
**Changes**: Full file rewrite. Use the canonical Apache 2.0 text from https://www.apache.org/licenses/LICENSE-2.0.txt verbatim. Fill the `APPENDIX` boilerplate with Lightfast's copyright line.

Template (the last ~10 lines of the Apache 2.0 file, after the main terms):

```
   Copyright 2025 Lightfast Pty Ltd

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

The body of the license (lines above the appendix) must be copied verbatim from Apache's canonical source. Do not paraphrase.

#### 2. Delete `/LICENSING.md`

**File**: `/LICENSING.md`
**Changes**: Delete the file. `git rm LICENSING.md`.

### Success Criteria

#### Automated Verification

- [x] `test -f /LICENSE && head -2 /LICENSE | grep -q "Apache License"` passes
- [x] `test ! -f /LICENSING.md` passes
- [x] `rg -F "Functional Source License" /LICENSE` returns no matches
- [x] `rg -F "FSL-1.1-ALv2" /LICENSE` returns no matches

#### Manual Verification

- [ ] GitHub repo sidebar shows "Apache-2.0" as detected license (visible after push; may take a few minutes for GitHub's license detection cache)
- [ ] Opening `/LICENSE` in the GitHub UI displays the green "Apache License 2.0" info banner above the file

**Implementation Note**: Pause after this phase for human confirmation that GitHub's detected license updated correctly before proceeding.

---

## Phase 2: MIT LICENSE Files for `core/*`

### Overview

Create MIT `LICENSE` files for the three published SDK packages that are missing them. The MIT text matches `core/ai-sdk/LICENSE` verbatim except for package-specific copyright (actually — the copyright line is identical too: `Copyright (c) 2025 Lightfast Pty Ltd`).

### Changes Required

#### 1. Create `core/lightfast/LICENSE`

**File**: `core/lightfast/LICENSE`
**Changes**: New file. Copy content from `core/ai-sdk/LICENSE` verbatim (MIT License with `Copyright (c) 2025 Lightfast Pty Ltd`).

#### 2. Create `core/cli/LICENSE`

**File**: `core/cli/LICENSE`
**Changes**: New file. Same content as `core/ai-sdk/LICENSE`.

#### 3. Create `core/mcp/LICENSE`

**File**: `core/mcp/LICENSE`
**Changes**: New file. Same content as `core/ai-sdk/LICENSE`.

### Success Criteria

#### Automated Verification

- [x] `test -f core/lightfast/LICENSE && test -f core/cli/LICENSE && test -f core/mcp/LICENSE` passes
- [x] All four `core/*/LICENSE` files are byte-identical: `md5 core/ai-sdk/LICENSE core/lightfast/LICENSE core/cli/LICENSE core/mcp/LICENSE` produces four identical hashes
- [x] Dry-run `npm pack` in each `core/*` package includes `LICENSE` in the tarball: `cd core/lightfast && npm pack --dry-run 2>&1 | grep LICENSE`

#### Manual Verification

- [ ] After the next release, a published tarball on npm contains the `LICENSE` file (verify via `npm view lightfast dist.tarball` and unpacking, or `unpkg.com/lightfast/LICENSE`)

---

## Phase 3: `package.json` License Field Sweep

### Overview

Change 24 `package.json` files from `"license": "FSL-1.1-Apache-2.0"` to `"license": "Apache-2.0"`. This is a pure string substitution with no other changes.

### Changes Required

#### 1. All 24 files

**Files**:
- `apps/app/package.json`
- `apps/www/package.json`
- `apps/platform/package.json`
- `api/app/package.json`
- `api/platform/package.json`
- `db/app/package.json`
- `internal/typescript/package.json`
- `internal/vitest-config/package.json`
- `packages/app-ai/package.json`
- `packages/app-ai-types/package.json`
- `packages/app-api-key/package.json`
- `packages/app-embed/package.json`
- `packages/app-octokit-github/package.json`
- `packages/app-pinecone/package.json`
- `packages/app-providers/package.json`
- `packages/app-rerank/package.json`
- `packages/app-remotion/package.json`
- `packages/app-reserved-names/package.json`
- `packages/app-test-data/package.json`
- `packages/app-trpc/package.json`
- `packages/app-upstash-realtime/package.json`
- `packages/app-validation/package.json`
- `packages/platform-trpc/package.json`
- `packages/webhook-schemas/package.json`

**Changes**: In each file, replace `"license": "FSL-1.1-Apache-2.0"` with `"license": "Apache-2.0"`. Line number varies per file (see the `Grep` output in the research — for example `apps/app/package.json:3`, `api/app/package.json:33`).

Suggested one-shot sed (verify file list first, then run):

```bash
rg -l '"license": "FSL-1.1-Apache-2.0"' --glob '!node_modules' \
  | xargs sed -i '' 's/"license": "FSL-1.1-Apache-2.0"/"license": "Apache-2.0"/'
```

(On Linux CI, drop the `''` after `-i`.)

### Success Criteria

#### Automated Verification

- [x] `rg -F '"FSL-1.1-Apache-2.0"' --glob '!node_modules' --glob '!thoughts'` returns zero results
- [x] `rg -c '"license": "Apache-2.0"' --glob '**/package.json' --glob '!node_modules'` returns at least 24
- [x] `pnpm install` succeeds (validates all `package.json` files are still valid JSON)
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` and `pnpm build:platform` succeed

#### Manual Verification

- [ ] Spot-check 3 files via `git diff` to confirm only the license line changed

---

## Phase 4: README.md + CONTRIBUTING.md

### Overview

Rewrite the License section of `README.md` and the contributor license clause of `CONTRIBUTING.md`. Update the README badge.

### Changes Required

#### 1. `README.md` — badge

**File**: `README.md`
**Lines**: 7
**Changes**: Replace
```
[![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-orange.svg)](LICENSE)
```
with
```
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
```

#### 2. `README.md` — License section

**File**: `README.md`
**Lines**: 231–237 (the `## License` section)
**Changes**: Replace the current three-paragraph FSL description with:

```markdown
## License

Lightfast is open source:

- **Platform** (apps, API routers, database, internal packages): [Apache License 2.0](LICENSE).
- **SDKs and shared libraries** (`core/*`, `vendor/*`, UI kit, shared utilities): MIT License (see each package's `LICENSE` file or `package.json`).

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/) via `Signed-off-by:` on commits. See [CONTRIBUTING.md](CONTRIBUTING.md).
```

Delete the line referencing `LICENSING.md` (it no longer exists).

#### 3. `CONTRIBUTING.md` — license clause

**File**: `CONTRIBUTING.md`
**Lines**: 215–218 (the `## License` section, currently: *"By contributing to Lightfast, you agree that your contributions will be licensed under the Functional Source License..."*)
**Changes**: Replace with:

```markdown
## License

Lightfast is Apache 2.0 for the platform and MIT for the SDKs and shared libraries. By contributing, you agree that your contribution is licensed under the same license as the file(s) you are modifying (as declared by the nearest `package.json` `license` field, or the repository-root `LICENSE` if none applies).

### Developer Certificate of Origin (DCO)

All commits must be signed off per the [Developer Certificate of Origin](https://developercertificate.org/). Add `Signed-off-by: Your Name <your.email@example.com>` to every commit:

\`\`\`bash
git commit -s -m "your commit message"
\`\`\`

The `-s` flag adds the trailer automatically using your `git config user.name` and `user.email`. PRs without DCO sign-off on every commit will be blocked by automation.
```

(Use a real triple-backtick in the actual file — escaping in this plan only.)

### Success Criteria

#### Automated Verification

- [x] `rg -F "FSL" README.md CONTRIBUTING.md` returns zero results
- [x] `rg -F "Functional Source" README.md CONTRIBUTING.md` returns zero results
- [x] `rg -F "LICENSING.md" README.md` returns zero results
- [ ] README badge link is valid: the shields.io URL resolves (can check via `curl -sI | head -1`)

#### Manual Verification

- [ ] GitHub-rendered README shows the new blue Apache 2.0 badge at the top
- [ ] The License section in the rendered README reads cleanly and accurately describes the split
- [ ] `CONTRIBUTING.md` License section renders correctly with the DCO instructions

---

## Phase 5: DCO Enforcement

### Overview

Block PRs without `Signed-off-by:` trailers on every commit. Two paths; pick one at apply time.

### Option A (preferred, zero-code): DCO GitHub App

**Action**: Install the [DCO GitHub App](https://github.com/apps/dco) on the `lightfastai` GitHub org, scoped to the `lightfast` repo (or all repos).

- Adds a required status check `DCO` to every PR.
- Handles re-checks automatically when commits are amended.
- Zero code, zero maintenance, used by Kubernetes and most Apache-ecosystem repos.

**Follow-up**: In the repo settings, add `DCO` to the list of required status checks on the `main` branch protection rule.

### Option B (fallback, if App is not desired): GitHub Action

**File**: `.github/workflows/dco.yml` (new)
**Changes**: New file.

```yaml
name: DCO

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

jobs:
  dco:
    name: DCO check
    runs-on: ubuntu-latest
    steps:
      - name: Check DCO sign-off
        uses: tim-actions/dco@master
```

Add `DCO check` to required status checks on `main`.

### Changes Required

At plan-apply time, pick A or B. Default: **A**. Only write the workflow file if A is rejected.

### Success Criteria

#### Automated Verification

- [ ] (Option A) DCO App status check appears on a test PR — verified by opening a dummy PR without sign-off and confirming the status goes red
- [ ] (Option B) `.github/workflows/dco.yml` exists and is valid YAML: `yq eval '.' .github/workflows/dco.yml > /dev/null`

#### Manual Verification

- [ ] A commit without `Signed-off-by:` triggers a failing DCO check on the PR
- [ ] A commit with `Signed-off-by:` (via `git commit -s`) passes the DCO check
- [ ] The `main` branch protection rule requires the `DCO` / `DCO check` status before merge

---

## Phase 6: Final Sweep + Verification

### Overview

Confirm nothing still references FSL. Run the full test/typecheck/build matrix.

### Changes Required

No source changes. This is a verification-only phase.

### Success Criteria

#### Automated Verification

- [x] `rg -F "FSL" --glob '!node_modules' --glob '!thoughts' --glob '!.git'` returns zero results
- [x] `rg -F "Functional Source" --glob '!node_modules' --glob '!thoughts' --glob '!.git'` returns zero results
- [x] `rg -F "FSL-1.1-ALv2" --glob '!node_modules' --glob '!thoughts' --glob '!.git'` returns zero results
- [x] `rg -F "FSL-1.1-Apache-2.0" --glob '!node_modules' --glob '!thoughts' --glob '!.git'` returns zero results
- [x] `rg -F "fsl.software" --glob '!node_modules' --glob '!thoughts' --glob '!.git'` returns zero results
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

#### Manual Verification

- [ ] GitHub repo sidebar shows "Apache-2.0"
- [ ] `/LICENSE` renders with GitHub's "Apache License 2.0" banner
- [ ] README badge renders the new Apache 2.0 blue badge
- [ ] `apps/www/src/content/legal/{privacy,terms}.mdx` contain no stale FSL references (re-verified even though current grep shows none)
- [ ] No broken internal links to `LICENSING.md` anywhere in docs or content
- [ ] A test PR with a properly signed-off commit merges cleanly; a PR without sign-off is blocked

---

## Testing Strategy

### Automated

- `pnpm install && pnpm typecheck && pnpm check && pnpm build:app && pnpm build:platform` — confirms no package manifests broke.
- `rg -F "FSL"` sweeps after every phase.
- `md5` hash check on the four `core/*/LICENSE` files to confirm they're identical.
- `npm pack --dry-run` in each `core/*` to confirm `LICENSE` ships in the tarball.

### Manual

- GitHub license detection (visual, ~5 min after push to main).
- README badge render.
- DCO check on a dummy PR (one with sign-off, one without).
- npm publication test (next release of `core/*` contains LICENSE in tarball — verify after first post-relicense publish).

## Performance Considerations

None. Pure text and metadata changes.

## Migration Notes

- **Pre-existing released versions (FSL)**: Any release tagged before this change remains FSL-1.1-ALv2 forever. The FSL → Apache 2.0 2-year auto-conversion clause in those tagged versions is still in effect, but since we're relicensing going forward, those legacy versions will simply convert on schedule and no one will care.
- **Published npm packages**: `core/*` packages are already MIT in their `package.json`. The only change for them is that the tarball now ships a physical `LICENSE` file (previously only `core/ai-sdk` did). No semver bump required — this is a metadata fix, not a breaking change. Publish on next natural release.
- **Open PRs at the time of relicense**: Existing PR authors did not sign off under DCO. Option: require sign-off on their next push (rebase with `-s`), or grandfather existing PRs with a manual override. Recommend requiring sign-off — it's one command.
- **Branch protection**: The `DCO` (or `DCO check`) status check must be added to the `main` branch protection rule manually via GitHub settings or via the GitHub API. Not something we can commit to the repo.

## References

- FSL canonical text: https://fsl.software
- Apache License 2.0 canonical text: https://www.apache.org/licenses/LICENSE-2.0.txt
- Developer Certificate of Origin: https://developercertificate.org/
- DCO GitHub App: https://github.com/apps/dco
- SPDX identifier registry: https://spdx.org/licenses/
- Existing MIT template in repo: `core/ai-sdk/LICENSE`
- Current root license: `LICENSE` (FSL-1.1-ALv2)
- Current license matrix: `LICENSING.md` (to be deleted)
- Contributor clause under FSL: `CONTRIBUTING.md:215-218`
- Research conversation: (this plan's session)
