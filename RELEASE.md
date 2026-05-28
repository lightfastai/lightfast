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

### 1. Make Changes

Work in `core/lightfast/` and/or `core/mcp/`.

```bash
pnpm --filter lightfast test
pnpm --filter @lightfastai/mcp test
pnpm turbo run build --filter lightfast --filter @lightfastai/mcp
```

### 2. Create a Changeset

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

### 3. Merge the Version Packages PR

When the changeset lands on `main`, `.github/workflows/release.yml` creates or updates the Version Packages PR. Review the generated versions and changelogs, then merge that PR to publish.

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

### CLI tarball contains `@repo/*` dependencies

Move private workspace packages from `dependencies` to `devDependencies` and bundle them through `tsup` `noExternal`.

### CLI tarball contains `catalog:` or `workspace:` ranges

Use `pnpm pack`, not `npm pack`, for local validation. `pnpm pack` understands workspace and catalog protocols.

### CLI publish fails with an already-published version

Do not retry with the same version. Bump `core/cli/package.json`, update `core/cli/CHANGELOG.md`, rerun validation, and publish the new version after approval.

### SDK/MCP alpha tags drift

Check live npm tags:

```bash
npm view lightfast dist-tags
npm view @lightfastai/mcp dist-tags
```

Repair tags explicitly only after confirming the intended version:

```bash
npm dist-tag add lightfast@<version> alpha
npm dist-tag add @lightfastai/mcp@<version> alpha
```

## Command Reference

```bash
# SDK/MCP
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
