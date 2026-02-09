# Release Process

This document explains how to release the Lightfast SDK (`lightfast`) and MCP server (`@lightfastai/mcp`) packages to npm.

## Overview

We use [Changesets](https://github.com/changesets/changesets) for version management and automated npm publishing through GitHub Actions.

**Published Packages:**
- [`lightfast`](https://www.npmjs.com/package/lightfast) - TypeScript SDK for Lightfast Memory API
- [`@lightfastai/mcp`](https://www.npmjs.com/package/@lightfastai/mcp) - Model Context Protocol server

**Release Strategy:**
- Both packages are released together with the same version number (fixed versioning)
- Alpha/beta releases are tagged with `@alpha` or `@beta` on npm
- Stable releases are tagged with `@latest` on npm

## Prerequisites

**Required GitHub Secrets:**
- `LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN` - GitHub PAT with `repo` and `workflow` scopes
- `LIGHTFAST_RELEASE_BOT_NPM_TOKEN` - npm automation token with publish access to both packages

**Local Setup:**
```bash
# Install dependencies
pnpm install

# Build packages to verify
pnpm turbo build --filter lightfast --filter @lightfastai/mcp

# Run tests
pnpm --filter lightfast test
```

## Release Workflows

### Alpha/Beta Releases (Prerelease Mode)

Use prerelease mode for alpha or beta testing releases.

#### 1. Enter Prerelease Mode

```bash
# Enter alpha prerelease mode
pnpm changeset pre enter alpha

# Or for beta
pnpm changeset pre enter beta

# Commit and push
git add .changeset/pre.json
git commit -m "chore: enter alpha prerelease mode"
git push
```

This creates `.changeset/pre.json` which locks the repository into prerelease mode.

#### 2. Create a Changeset

```bash
pnpm changeset
```

**Interactive Prompts:**
1. **Which packages changed?** → Select `lightfast` and `@lightfastai/mcp` (both must be selected)
2. **What kind of change?** → Choose bump type:
   - `patch` - Bug fixes, minor updates (alpha.1 → alpha.2)
   - `minor` - New features (alpha.1 → alpha.1.1)
   - `major` - Breaking changes (alpha.1 → alpha.2.0)
3. **Summary** → Write a description of changes

**Example changeset file** (`.changeset/random-words.md`):
```markdown
---
"lightfast": patch
"@lightfastai/mcp": patch
---

Add graph traversal and related observation methods to SDK and MCP server
```

#### 3. Commit and Push

```bash
git add .changeset/
git commit -m "chore: add changeset for [feature name]"
git push
```

#### 4. Automated Release

**GitHub Actions automatically:**
1. Triggers `.github/workflows/release.yml` workflow
2. Creates/updates a "Version Packages (alpha)" PR
3. PR updates:
   - Bumps versions in `package.json` (e.g., `0.1.0-alpha.1` → `0.1.0-alpha.2`)
   - Generates `CHANGELOG.md` entries
   - Deletes consumed changeset files

**To publish:**
1. Review the "Version Packages" PR
2. Merge the PR
3. GitHub Actions automatically publishes both packages to npm with `@alpha` tag

**Published as:**
```bash
npm install lightfast@alpha
npm install @lightfastai/mcp@alpha
```

#### 5. Exit Prerelease Mode

When ready to graduate to stable:

```bash
pnpm changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit prerelease mode"
git push
```

### Stable Releases

For production-ready releases:

#### 1. Ensure NOT in Prerelease Mode

Check if `.changeset/pre.json` exists:
```bash
# If it exists, exit prerelease mode
pnpm changeset pre exit
```

#### 2. Create a Changeset

```bash
pnpm changeset
```

Choose version bump:
- `patch` - 0.1.0 → 0.1.1 (bug fixes)
- `minor` - 0.1.0 → 0.2.0 (new features)
- `major` - 0.1.0 → 1.0.0 (breaking changes)

#### 3. Commit and Push

```bash
git add .changeset/
git commit -m "chore: add changeset for v[version]"
git push
```

#### 4. Merge Version Packages PR

GitHub Actions creates a "Version Packages" PR. When merged, packages are published with `@latest` tag:

```bash
npm install lightfast@latest
npm install @lightfastai/mcp@latest
```

## Manual Publishing (Emergency)

If GitHub Actions fails, you can publish manually:

### Local Setup

```bash
# Set npm token
npm config set //registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN

# Verify login
npm whoami
# Should output: lightfast-release-bot
```

### Build and Publish

```bash
# Build both packages
pnpm turbo build --filter lightfast --filter @lightfastai/mcp

# Publish lightfast
cd core/lightfast
npm publish --tag alpha --access public

# Publish MCP server
cd ../mcp
npm publish --tag alpha --access public

# Push git tags (created by changesets)
git push --follow-tags
```

## Version Strategies

### Fixed Versioning

Both packages always release together with the same version number. This is configured in `.changeset/config.json`:

```json
{
  "fixed": [["lightfast", "@lightfastai/mcp"]]
}
```

**Why?** The MCP server depends on the SDK, so they should stay in sync.

### Semantic Versioning

We follow [semver](https://semver.org/):

- **Patch** (0.1.0 → 0.1.1): Backward-compatible bug fixes
- **Minor** (0.1.0 → 0.2.0): Backward-compatible new features
- **Major** (0.1.0 → 1.0.0): Breaking changes

**In prerelease:**
- `patch` bumps prerelease number: 0.1.0-alpha.1 → 0.1.0-alpha.2
- `minor` bumps minor and resets prerelease: 0.1.0-alpha.1 → 0.1.1-alpha.0
- `major` bumps major and resets prerelease: 0.1.0-alpha.1 → 0.2.0-alpha.0

## GitHub Actions Workflows

### `.github/workflows/release.yml`

**Triggers:**
- Push to `main` with changes to `.changeset/**`
- Manual workflow dispatch

**Steps:**
1. Checkout code
2. Install dependencies
3. Build packages: `pnpm turbo build --filter lightfast --filter @lightfastai/mcp`
4. Run tests: `pnpm --filter lightfast test`
5. Run `changesets/action`:
   - If changesets exist → Create/update Version Packages PR
   - If versions changed but no changesets → Publish to npm

**Environment Variables:**
- `GITHUB_TOKEN` - Creates PRs and pushes tags
- `NODE_AUTH_TOKEN` - Publishes to npm with provenance
- `NPM_CONFIG_PROVENANCE=true` - Enables npm provenance attestations

### `.github/workflows/verify-changeset.yml`

Validates changesets in PRs:
- Checks that changesets mention `lightfast` or `@lightfastai/mcp`
- Enforces valid version types (patch, minor, major)
- Requires summary description

### `.github/workflows/ci.yml`

Runs on changes to `core/lightfast/**` or `core/mcp/**`:
- Lints code
- Type checks
- Runs tests
- Builds packages
- Verifies build outputs

## Configuration Files

### `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["lightfast", "@lightfastai/mcp"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Key settings:**
- `fixed`: Both packages version together
- `access: "public"`: Packages are publicly accessible on npm
- `baseBranch: "main"`: PRs target main branch
- `ignore`: Packages to exclude from releases

### Package Configurations

**lightfast** (`core/lightfast/package.json`):
```json
{
  "name": "lightfast",
  "version": "0.1.0-alpha.1",
  "publishConfig": {
    "tag": "latest",
    "access": "public"
  }
}
```

**@lightfastai/mcp** (`core/mcp/package.json`):
```json
{
  "name": "@lightfastai/mcp",
  "version": "0.1.0-alpha.1",
  "publishConfig": {
    "tag": "latest",
    "access": "public"
  }
}
```

## Troubleshooting

### Changeset validation fails

**Error:** `Some errors occurred when validating the changesets config`

**Cause:** Packages in `ignore` list that other packages depend on

**Fix:** Remove from ignore list or add all dependent packages to ignore

### npm publish fails with 403 Forbidden

**Error:** `403 You cannot publish over the previously published versions`

**Cause:** Version already exists on npm

**Fix:**
1. Check published versions: `npm view lightfast versions`
2. Bump version in changeset or skip publish if already done

### npm publish fails with E404 Not Found

**Error:** `404 Not Found - PUT https://registry.npmjs.org/@lightfastai/mcp`

**Cause:** npm token expired or lacks permissions

**Fix:**
1. Generate new npm automation token at https://www.npmjs.com/settings/tokens
2. Update GitHub secret: `gh secret set LIGHTFAST_RELEASE_BOT_NPM_TOKEN`
3. Ensure token has access to `@lightfastai` organization

### GitHub Actions checkout fails

**Error:** `could not read Username for 'https://github.com': terminal prompts disabled`

**Cause:** `LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN` missing or invalid

**Fix:**
1. Generate new GitHub PAT with `repo` and `workflow` scopes
2. Update GitHub secret: `gh secret set LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN`

### Packages fail to build

**Error:** Build errors in CI

**Fix:**
```bash
# Clean and reinstall
pnpm clean:workspaces && pnpm install

# Build locally
pnpm turbo build --filter lightfast --filter @lightfastai/mcp

# Check for errors
pnpm --filter lightfast typecheck
pnpm --filter @lightfastai/mcp typecheck
```

### Version Packages PR conflicts

**Error:** PR has merge conflicts

**Fix:**
1. Close the PR (don't merge)
2. Changesets will create a fresh PR on next push
3. Or manually resolve conflicts and push

## Release Checklist

Before releasing:

- [ ] All tests passing: `pnpm --filter lightfast test`
- [ ] Builds successfully: `pnpm turbo build --filter lightfast --filter @lightfastai/mcp`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm lint`
- [ ] CHANGELOG entries are accurate
- [ ] Version numbers are correct
- [ ] Git tags created (after publish)
- [ ] npm packages accessible: `npm view lightfast@VERSION`

## Commands Reference

```bash
# Changesets
pnpm changeset                    # Create new changeset
pnpm changeset pre enter alpha    # Enter alpha prerelease mode
pnpm changeset pre exit           # Exit prerelease mode
pnpm version-packages             # Consume changesets, bump versions
pnpm release                      # Publish to npm (manual)

# Build & Test
pnpm turbo build --filter lightfast --filter @lightfastai/mcp
pnpm --filter lightfast test
pnpm lint && pnpm typecheck

# npm
npm view lightfast versions       # List all published versions
npm view lightfast dist-tags      # Show dist tags (latest, alpha, beta)
npm install lightfast@alpha       # Install alpha version
npm install lightfast@latest      # Install latest stable

# GitHub
gh workflow run release.yml       # Manually trigger release workflow
gh run list --workflow=release.yml --limit 5  # View recent runs
gh secret set SECRET_NAME         # Update GitHub secret
```

## Support

For issues or questions:
- **Changesets docs**: https://github.com/changesets/changesets
- **npm publishing**: https://docs.npmjs.com/cli/v10/commands/npm-publish
- **GitHub Actions**: https://docs.github.com/en/actions

## History

- **2026-02-09**: Initial alpha.1 release of both packages
- **2026-02-09**: Entered prerelease mode for weekly alpha releases
