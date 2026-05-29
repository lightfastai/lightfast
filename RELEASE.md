# Release Process

This repo publishes three npm packages from `core/`:

- [`lightfast`](https://www.npmjs.com/package/lightfast) - TypeScript SDK for the Lightfast Platform API
- [`@lightfastai/mcp`](https://www.npmjs.com/package/@lightfastai/mcp) - Model Context Protocol server
- [`@lightfastai/cli`](https://www.npmjs.com/package/@lightfastai/cli) - Lightfast command-line tools

## Release Tracks

### SDK + MCP

`lightfast` and `@lightfastai/mcp` are one release unit.

- They are fixed together in `.changeset/config.json`.
- They are currently released through the root Changesets prerelease flow.
- A changeset for either package must include both packages.
- GitHub Actions creates the Version Packages PR and publishes after that PR is merged.

### CLI

`@lightfastai/cli` is independent from SDK/MCP.

- It is not in the SDK/MCP fixed version group.
- It should ship as a stable CLI package on the `latest` npm tag.
- The first CLI release is intentionally local/manual and must not happen until explicitly approved.
- After the first package is published and smoke-tested, add a dedicated CLI GitHub workflow for the second release.

Root Changesets is currently in prerelease mode, so do not add CLI to the existing root Changesets release flow unless the intent changes to alpha CLI releases.

## SDK + MCP Workflow

### 1. Make oRPC or Package Changes

Work in the oRPC contract/API surface and the public packages that consume it:

- `packages/api-contract/`
- `api/app/src/orpc/`
- `core/lightfast/`
- `vendor/mcp/`
- `core/mcp/`

Before opening a PR, run the SDK/MCP preflight:

```bash
pnpm --filter lightfast exec pwd
pnpm verify:orpc
pnpm check
git diff --check
```

`pnpm --filter lightfast exec pwd` must resolve to `core/lightfast`. The root package is `@lightfastai/workspace`, so `--filter=lightfast` targets only the public SDK package.

`pnpm verify:orpc` is required whenever oRPC routes change. It verifies the contract, API implementation, SDK, vendor MCP adapter, and published MCP package path.

### 2. Create the Implementation PR

Open a normal PR to `main`.

Expected PR behavior:

- Affected PR CI stays fast and only runs jobs for touched surfaces.
- `merge-queue-success` passes as the required branch-protection stub.
- oRPC contract/API changes trigger Core CI and include the public oRPC package test scope.

For oRPC propagation changes, inspect CI logs for:

```text
Test affected public oRPC surface
```

The package scope should include:

```text
@repo/api-contract
@api/app
lightfast
@vendor/mcp
@lightfastai/mcp
```

### 3. Merge Through Merge Queue

Add the implementation PR to GitHub merge queue. Do not admin-merge or bypass branch protection.

The `merge_group` run for `.github/workflows/merge-queue.yml` is the real gate. It must pass:

- Full quality checks: lint, typecheck, boundaries, and Knip.
- Core build/test for `lightfast`, `@lightfastai/mcp`, and CLI.
- Public oRPC package tests for `@repo/api-contract`, `@api/app`, `lightfast`, and `@lightfastai/mcp`.
- Desktop package/e2e jobs.
- CodeQL.
- `merge-queue-success`.

### 4. Create a Changeset

Do not manually edit package versions or changelogs for SDK/MCP releases.

```bash
pnpm changeset
```

Select both packages:

```markdown
---
"lightfast": patch
"@lightfastai/mcp": patch
---

Describe the SDK and MCP change.
```

### 5. Merge the Version Packages PR

When the changeset lands on `main`, `.github/workflows/release.yml` creates or updates the Version Packages PR. Review the generated versions and changelogs, then merge that PR to publish.

Before queueing the Version Packages PR, confirm:

- `lightfast` and `@lightfastai/mcp` versions match.
- `@lightfastai/cli` does not change unless explicitly intended.
- Changelogs accurately describe the SDK/MCP change.
- No private workspace package is included in packed manifests.
- `.changeset/pre.json` is formatted by `pnpm check`.

Release PRs created by `GITHUB_TOKEN` may not trigger required PR checks. If checks do not appear, push a no-op or formatting commit to the release branch, or replace `GITHUB_TOKEN` with an approved release bot token/App that is allowed to trigger workflows.

Merge the Version Packages PR through merge queue. The merge to `main` triggers `.github/workflows/release.yml` again.

### 6. Publish the SDK + MCP Alpha

After the Version Packages PR merges, `Release lightfast` runs on `main`.

The release workflow:

1. Installs with `pnpm install --frozen-lockfile`.
2. Builds publishable core packages.
3. Tests the contract, SDK, and MCP package surfaces.
4. Packs `core/lightfast` and `core/mcp`.
5. Validates tarball manifests to catch private workspace dependency leaks.
6. Publishes unpublished alpha packages with `scripts/publish-lightfast-alpha.mjs`.
7. Verifies `lightfast@alpha` and `@lightfastai/mcp@alpha` resolve to the same version.

SDK/MCP publishing uses npm trusted publishing through GitHub Actions OIDC. Configure npm trusted publisher automation for both packages before publishing:

- Package: `lightfast`
- Package: `@lightfastai/mcp`
- Repository: `lightfastai/lightfast`
- Workflow file: `.github/workflows/release.yml`

The alpha publish script intentionally uses `pnpm publish --tag alpha --access public --no-git-checks`. Changesets still creates Version Packages PRs and GitHub releases, but direct pnpm publish avoids Changesets CLI's prerelease-mode restriction on custom `--tag`.

### 7. Verify npm and Smoke-Test Published Packages

Verify npm tags:

```bash
npm view lightfast@alpha version
npm view @lightfastai/mcp@alpha version
npm view lightfast dist-tags
npm view @lightfastai/mcp dist-tags
```

Smoke-test the SDK from a clean temporary project:

```bash
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npm init -y
npm install lightfast@alpha
node -e "import('lightfast').then(m => console.log(typeof m.createLightfast, m.VERSION))"
```

Expected output:

```text
function <alpha-version>
```

Smoke-test the MCP binary without an API key:

```bash
npm exec --yes --package @lightfastai/mcp@alpha -- lightfast-mcp
```

Expected output with non-zero exit:

```text
LIGHTFAST_API_KEY environment variable is required
```

If a bound `lf_` key is available, run the optional live API smoke:

```bash
LIGHTFAST_E2E_API_KEY=lf_... LIGHTFAST_E2E_APP_URL=https://app.lightfast.localhost pnpm --filter @lightfast/e2e sdk
```

## CLI First Release Workflow

The first `@lightfastai/cli` publish is local/manual. Do not run the publish command until the release owner gives explicit approval.

### 1. Preflight

```bash
pnpm --filter @lightfastai/cli build
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
```

Pack and inspect the tarball:

```bash
SCRATCH=$(mktemp -d)
pnpm --dir core/cli pack --pack-destination "$SCRATCH"
tar -tzf "$SCRATCH"/lightfastai-cli-*.tgz
tar -xzOf "$SCRATCH"/lightfastai-cli-*.tgz package/package.json | jq '{name, version, bin, files, dependencies, publishConfig}'
npm exec --yes --package "$SCRATCH"/lightfastai-cli-*.tgz -- lightfast --version
npm exec --yes --package "$SCRATCH"/lightfastai-cli-*.tgz -- lightfast --help
```

### 2. Publish After Approval

Publish the exact tarball inspected above. This avoids repacking different contents.

```bash
npm publish "$SCRATCH"/lightfastai-cli-0.1.0.tgz --access public --tag latest
```

Local publishing will not include npm provenance. The second release workflow should publish from GitHub Actions with OIDC provenance.

### 3. Verify npm

```bash
npm view @lightfastai/cli version
npm view @lightfastai/cli dist-tags
npm exec --yes --package @lightfastai/cli -- lightfast --version
npm exec --yes --package @lightfastai/cli -- lightfast --help
npm exec --yes --package @lightfastai/cli -- lightfast whoami
```

`whoami` should fail cleanly when no session exists:

```text
Not signed in. Run `lightfast login`.
```

## CLI Second Release Workflow

After `@lightfastai/cli@0.1.0` is published and verified, add a dedicated workflow such as `.github/workflows/release-cli.yml`.

Recommended workflow shape:

1. Trigger manually with `workflow_dispatch` inputs for version bump and npm tag, or trigger on CLI release tags like `@lightfastai/cli@0.1.1`.
2. Check out the repo and install with `pnpm install --frozen-lockfile`.
3. Run `pnpm --filter @lightfastai/cli build`.
4. Run `pnpm --filter @lightfastai/cli test`.
5. Run `pnpm --filter @lightfastai/cli typecheck`.
6. Pack with `pnpm --dir core/cli pack --pack-destination "$RUNNER_TEMP/cli-pack"`.
7. Inspect the packed manifest and smoke-run `lightfast --version` plus `lightfast --help` from the tarball.
8. Publish the inspected tarball with `NPM_CONFIG_PROVENANCE=true`.
9. Verify `npm view @lightfastai/cli@latest version`.
10. Smoke-run the published package with `npm exec --yes --package @lightfastai/cli -- lightfast --version`.

Keep this workflow separate from `.github/workflows/release.yml` while SDK/MCP remain in prerelease mode.

## Package Validation

The CLI package is intended to be self-contained:

- `core/cli/package.json` should not have runtime `dependencies`.
- `core/cli/tsup.config.ts` should bundle CLI runtime libraries with `noExternal`.
- The packed tarball must include `dist/bin.mjs`, `README.md`, `LICENSE`, and `package.json`.
- The packed tarball must not include source maps because maps expose bundled internal source content.
- The packed tarball must not include `src/`.
- `dist/bin.mjs` must start with `#!/usr/bin/env node` and be executable.
- The packed manifest must not include private workspace packages or unresolved `workspace:` / `catalog:` ranges.

Run:

```bash
SCRATCH=$(mktemp -d)
pnpm --filter @lightfastai/cli build
pnpm --dir core/cli pack --pack-destination "$SCRATCH"
tar -xzOf "$SCRATCH"/lightfastai-cli-*.tgz package/package.json | jq '{name, version, bin, files, dependencies, publishConfig}'
```

## Troubleshooting

### oRPC contract coverage fails

`api/app/src/orpc/__tests__/contract-coverage.test.ts` fails when the public contract exposes a procedure that the API router does not implement. Add the API router implementation, or remove/rename the contract route if it was not intended to ship.

### SDK/MCP tarball manifest validation fails

The release workflow packs `core/lightfast` and `core/mcp` before publishing. A failure usually means a private workspace dependency, unresolved `workspace:` range, or unexpected runtime dependency leaked into a public package. Move private internals to dev dependencies, bundle them, or expose only approved public runtime dependencies.

### SDK/MCP npm publish fails

If the log says `No NPM_TOKEN found, but OIDC is available`, the workflow is using npm trusted publishing. A registry `404` during publish means npm does not consider the workflow authorized for that package or the publish command path is not using the same toolchain as the trusted-publishing path.

Use the current publish script path:

```bash
node scripts/publish-lightfast-alpha.mjs
```

Do not use `pnpm changeset publish --tag alpha` while Changesets is in prerelease mode. Changesets rejects custom tags in pre mode, so the workflow publishes with the focused pnpm shim instead.

### SDK/MCP alpha tags drift

Check live npm tags:

```bash
npm view lightfast dist-tags
npm view @lightfastai/mcp dist-tags
```

The release workflow fails if `lightfast@alpha` and `@lightfastai/mcp@alpha` resolve to different versions. Repair tags explicitly only after confirming the intended version:

```bash
npm dist-tag add lightfast@<version> alpha
npm dist-tag add @lightfastai/mcp@<version> alpha
```

An earlier failed alpha setup may leave `latest` pointing at an alpha version. Do not rely on `latest` for SDK/MCP prereleases; verify the `alpha` tag directly until a stable release intentionally repoints `latest`.

### CLI tarball contains `@repo/*` dependencies

Move private workspace packages from `dependencies` to `devDependencies` and bundle them through `tsup` `noExternal`.

### CLI tarball contains `catalog:` or `workspace:` ranges

Use `pnpm pack`, not `npm pack`, for local validation. `pnpm pack` understands workspace and catalog protocols.

### CLI publish fails with an already-published version

Do not retry with the same version. Bump `core/cli/package.json`, update `core/cli/CHANGELOG.md`, rerun validation, and publish the new version after approval.

## Command Reference

```bash
# SDK/MCP
pnpm verify:orpc
pnpm changeset
pnpm changeset pre enter alpha
pnpm changeset pre exit
pnpm turbo run build --filter lightfast --filter @lightfastai/mcp

# CLI
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
pnpm --filter @lightfastai/cli build
SCRATCH=$(mktemp -d)
pnpm --dir core/cli pack --pack-destination "$SCRATCH"

# npm inspection
npm view lightfast versions
npm view @lightfastai/mcp dist-tags
npm view @lightfastai/cli version
```
