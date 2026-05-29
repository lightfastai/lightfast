# Release Process

This repo publishes three npm packages from `core/`:

- [`lightfast`](https://www.npmjs.com/package/lightfast) - TypeScript SDK for the Lightfast Platform API
- [`@lightfastai/mcp`](https://www.npmjs.com/package/@lightfastai/mcp) - Model Context Protocol server
- [`@lightfastai/cli`](https://www.npmjs.com/package/@lightfastai/cli) - Lightfast command-line tools

## Release Tracks

### SDK + MCP

`lightfast` and `@lightfastai/mcp` are one fixed release unit.

- Workflow: `.github/workflows/publish-sdk-mcp.yml`
- npm tag: `latest`
- Versioning: root Changesets, fixed together in `.changeset/config.json`
- Rule: a changeset for either package must include both packages
- Guardrail: the workflow rejects `@lightfastai/cli` changesets

The repo is not in Changesets prerelease mode. The next Version Packages PR promotes SDK/MCP from the checked-in `0.2.1` burned-version baseline to stable `0.3.0`.

### CLI

`@lightfastai/cli` is independent from SDK/MCP.

- Workflow: `.github/workflows/publish-cli.yml`
- npm tag: `latest`
- Versioning: manual `core/cli/package.json` and `core/cli/CHANGELOG.md` changes through a normal PR
- Rule: do not create CLI changesets
- Guardrail: the workflow rejects prerelease versions, already-published versions, and CLI changesets

## SDK + MCP Stable Promotion

Use this once to put SDK/MCP on the npm `latest` tag at `0.3.0`.

1. Merge the release automation PR.
2. In npm trusted publishing, configure both packages to trust `.github/workflows/publish-sdk-mcp.yml`.
3. Let `Publish SDK + MCP` run on `main`. It should open or update the Version Packages PR.
4. Review the Version Packages PR before queueing it:
   - `lightfast` and `@lightfastai/mcp` versions are both `0.3.0`.
   - Neither version contains a prerelease suffix.
   - Both package manifests have `publishConfig.tag` set to `latest`.
   - No `@lightfastai/cli` version or changelog change is present.
5. Merge the Version Packages PR through merge queue.
6. Confirm `Publish SDK + MCP` publishes both packages to npm `latest`.

Verify npm:

```bash
npm view lightfast@latest version
npm view @lightfastai/mcp@latest version
npm view lightfast dist-tags
npm view @lightfastai/mcp dist-tags
```

Smoke-test the SDK from a clean temporary project:

```bash
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npm init -y
npm install lightfast@latest
node -e "import('lightfast').then(m => console.log(typeof m.createLightfast, m.VERSION))"
```

Expected output:

```text
function 0.3.0
```

Smoke-test the MCP binary without an API key:

```bash
npm exec --yes --package @lightfastai/mcp@latest -- lightfast-mcp
```

Expected output with non-zero exit:

```text
LIGHTFAST_API_KEY environment variable is required
```

If a bound `lf_` key is available, run the optional live API smoke:

```bash
LIGHTFAST_E2E_API_KEY=lf_... LIGHTFAST_E2E_APP_URL=https://app.lightfast.localhost pnpm --filter @lightfast/e2e sdk
```

## Routine SDK + MCP Releases

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
- Core build/test passes. Merge queue verifies CLI build output as repo health, but CLI is not part of the SDK/MCP release unit.
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

When the changeset lands on `main`, `.github/workflows/publish-sdk-mcp.yml` creates or updates the Version Packages PR. Review the generated versions and changelogs, then merge that PR to publish.

Before queueing the Version Packages PR, confirm:

- `lightfast` and `@lightfastai/mcp` versions match.
- No changeset or generated version/changelog change for `@lightfastai/cli` is present.
- Changelogs accurately describe the SDK/MCP change.
- No private workspace package is included in packed manifests.
- Changesets output is formatted by `pnpm check`.

Release PRs created by `GITHUB_TOKEN` may not trigger required PR checks. If checks do not appear, push a no-op or formatting commit to the release branch, or replace `GITHUB_TOKEN` with an approved release bot token/App that is allowed to trigger workflows.

Merge the Version Packages PR through merge queue. The merge to `main` triggers `.github/workflows/publish-sdk-mcp.yml` again.

### 6. Publish SDK + MCP

After the Version Packages PR merges, `Publish SDK + MCP` runs on `main`.

The workflow:

1. Installs with `pnpm install --frozen-lockfile`.
2. Rejects changesets that include `@lightfastai/cli`.
3. Builds `lightfast` and `@lightfastai/mcp`.
4. Tests the contract, SDK, and MCP package surfaces.
5. Packs `core/lightfast` and `core/mcp`.
6. Validates tarball manifests to catch private workspace dependency leaks.
7. Publishes unpublished stable packages with `pnpm changeset publish`.
8. Verifies `lightfast@latest` and `@lightfastai/mcp@latest` resolve to the same stable version.

SDK/MCP publishing uses npm trusted publishing through GitHub Actions OIDC. Configure npm trusted publisher automation for both packages:

- Package: `lightfast`
- Package: `@lightfastai/mcp`
- Repository: `lightfastai/lightfast`
- Workflow file: `.github/workflows/publish-sdk-mcp.yml`

## CLI Workflow

Use `.github/workflows/publish-cli.yml` for CLI releases after a normal PR updates `core/cli/package.json` and `core/cli/CHANGELOG.md`.

Do not:

- Add a `.changeset/*.md` entry for `@lightfastai/cli`.
- Use `.github/workflows/publish-sdk-mcp.yml` for CLI.
- Run `pnpm changeset publish` for CLI.

### 1. Prepare the CLI Release PR

Update:

- `core/cli/package.json`
- `core/cli/CHANGELOG.md`

Before opening the PR, run:

```bash
pnpm --filter @lightfastai/cli build
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
```

Pack and inspect the tarball:

```bash
SCRATCH=$(mktemp -d)
pnpm --dir core/cli pack --pack-destination "$SCRATCH"
CLI_TARBALL="$(find "$SCRATCH" -name 'lightfastai-cli-*.tgz' -print -quit)"
tar -tzf "$CLI_TARBALL"
tar -xzOf "$CLI_TARBALL" package/package.json | jq '{name, version, bin, files, dependencies, publishConfig}'
npm exec --yes --package "$CLI_TARBALL" -- lightfast --version
npm exec --yes --package "$CLI_TARBALL" -- lightfast --help
```

### 2. Publish CLI

After the CLI release PR merges to `main`, run `Publish CLI` manually with the expected version from `core/cli/package.json`.

The workflow:

1. Rejects prerelease CLI versions.
2. Rejects versions that already exist on npm.
3. Rejects CLI changesets.
4. Builds, tests, and typechecks `@lightfastai/cli`.
5. Packs `core/cli`.
6. Validates the packed manifest and file list.
7. Smoke-runs `lightfast --version` and `lightfast --help` from the tarball.
8. Publishes that exact tarball to npm `latest` with provenance.
9. Verifies `@lightfastai/cli@latest`.

### 3. Verify CLI

```bash
npm view @lightfastai/cli version
npm view @lightfastai/cli dist-tags
npm exec --yes --package @lightfastai/cli@latest -- lightfast --version
npm exec --yes --package @lightfastai/cli@latest -- lightfast --help
npm exec --yes --package @lightfastai/cli@latest -- lightfast whoami
```

`whoami` should fail cleanly when no session exists:

```text
Not signed in. Run `lightfast login`.
```

## Package Validation

### SDK + MCP

- `core/lightfast/package.json` must not include private workspace runtime dependencies.
- `core/mcp/package.json` must not include private workspace runtime dependencies.
- The SDK packed manifest should only expose approved `@orpc/*` runtime dependencies.
- The MCP packed manifest should only expose `@modelcontextprotocol/sdk` as a runtime dependency.
- Neither SDK nor MCP stable package versions may contain a prerelease suffix.

### CLI

- `core/cli/package.json` should not have runtime `dependencies`.
- `core/cli/tsup.config.ts` should bundle CLI runtime libraries with `noExternal`.
- The packed tarball must include `dist/bin.mjs`, `README.md`, `LICENSE`, and `package.json`.
- The packed tarball must not include source maps because maps expose bundled internal source content.
- The packed tarball must not include `src/`.
- `dist/bin.mjs` must start with `#!/usr/bin/env node` and be executable.
- The packed manifest must not include private workspace packages or unresolved `workspace:` / `catalog:` ranges.

## Troubleshooting

### SDK/MCP latest still points at an alpha

Do not repair this by moving `latest` to another alpha. Publish the stable SDK/MCP Version Packages PR through `.github/workflows/publish-sdk-mcp.yml`. After stable publish, verify:

```bash
npm view lightfast@latest version
npm view @lightfastai/mcp@latest version
```

### SDK/MCP stable publish is rejected

If the Version Packages PR is not producing stable `latest` package manifests, inspect:

```bash
jq '{name, version, publishConfig}' core/lightfast/package.json core/mcp/package.json
```

### SDK/MCP npm publish fails

If the log says `No NPM_TOKEN found, but OIDC is available`, the workflow is using npm trusted publishing. A registry `404` during publish usually means npm does not consider the workflow authorized for that package.

Confirm npm trusted publisher settings:

- Repository: `lightfastai/lightfast`
- Workflow file: `.github/workflows/publish-sdk-mcp.yml`
- Packages: `lightfast`, `@lightfastai/mcp`

### CLI publish fails with an already-published version

Do not retry with the same version. Bump `core/cli/package.json`, update `core/cli/CHANGELOG.md`, rerun validation, and publish the new version after approval.

### CLI tarball contains `@repo/*` dependencies

Move private workspace packages from `dependencies` to `devDependencies` and bundle them through `tsup` `noExternal`.

### CLI tarball contains `catalog:` or `workspace:` ranges

Use `pnpm pack`, not `npm pack`, for local validation. `pnpm pack` understands workspace and catalog protocols.

## Command Reference

```bash
# SDK/MCP
pnpm verify:orpc
pnpm changeset
pnpm turbo run build --filter lightfast --filter @lightfastai/mcp
pnpm publish:sdk-mcp

# CLI
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
pnpm --filter @lightfastai/cli build
SCRATCH=$(mktemp -d)
pnpm --dir core/cli pack --pack-destination "$SCRATCH"

# npm inspection
npm view lightfast dist-tags
npm view @lightfastai/mcp dist-tags
npm view @lightfastai/cli dist-tags
```
