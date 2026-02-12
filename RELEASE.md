# Release Process

This document explains how to release the Lightfast SDK (`lightfast`) and MCP server (`@lightfastai/mcp`) packages to npm.

## Overview

**Published Packages:**
- [`lightfast`](https://www.npmjs.com/package/lightfast) - TypeScript SDK for Lightfast Memory API
- [`@lightfastai/mcp`](https://www.npmjs.com/package/@lightfastai/mcp) - Model Context Protocol server

**Release Strategy:**
- Both packages use **fixed versioning** - they always release together with the same version
- Currently in **prerelease mode** (`alpha`) for weekly alpha releases
- All releases are **fully automated** via GitHub Actions using Changesets

## The Correct Release Workflow

### Step 1: Make Code Changes

Work on your feature or bug fix in `core/lightfast/` or `core/mcp/`:

```bash
# Make your changes
vim core/lightfast/src/client.ts

# Test locally
pnpm --filter lightfast test
pnpm turbo build --filter lightfast --filter @lightfastai/mcp
```

### Step 2: Create a Changeset

**IMPORTANT:** Do NOT manually edit `package.json` versions or `CHANGELOG.md` files!

```bash
# Create a changeset
pnpm changeset
```

**Interactive Prompts:**
1. **Which packages changed?** → Select `lightfast` and `@lightfastai/mcp` (BOTH must be selected due to fixed versioning)
2. **What kind of change?**
   - `patch` - Bug fixes, minor updates (alpha.4 → alpha.5)
   - `minor` - New features (alpha.4 → 0.2.0-alpha.0)
   - `major` - Breaking changes (alpha.4 → 1.0.0-alpha.0)
3. **Summary** → Write a clear description

**Example changeset** (`.changeset/random-words.md`):
```markdown
---
"lightfast": patch
"@lightfastai/mcp": patch
---

Add graph traversal methods to SDK and MCP server

Adds new `traverseGraph()` and `getRelatedObservations()` methods for exploring memory graphs.
```

### Step 3: Commit and Push

```bash
git add .changeset/random-words.md
git commit -m "chore: add changeset for graph traversal"
git push
```

### Step 4: Automated Release Process

**GitHub Actions automatically handles everything:**

1. **`.github/workflows/release.yml` triggers** (on push to main with `.changeset/` changes)

2. **Changesets creates a "Version Packages (alpha)" PR** that:
   - Bumps versions in `package.json` files (e.g., `0.1.0-alpha.4` → `0.1.0-alpha.5`)
   - Updates `CHANGELOG.md` files with new entries
   - Deletes consumed `.changeset/*.md` files
   - Updates `.changeset/pre.json` tracking

3. **Review the PR** - Check the version bump and changelog entries are correct

4. **Merge the PR** - This triggers the publish step

5. **Changesets automatically publishes** to npm:
   - Builds both packages
   - Runs tests
   - Publishes to npm with provenance
   - Pushes git tags (e.g., `lightfast@0.1.0-alpha.5`)

**Installation:**
```bash
npm install lightfast@alpha
npm install @lightfastai/mcp@alpha
```

## Why This Workflow?

### ❌ Don't Do This (Manual Publishing)

```bash
# BAD - Don't manually bump versions
vim core/lightfast/package.json  # Change "0.1.0-alpha.4" → "0.1.0-alpha.5"
pnpm changeset version           # Manually consume changesets
git push
pnpm turbo build --filter lightfast --filter @lightfastai/mcp
npm publish --tag alpha          # Manual publish
```

**Problems:**
- `.changeset/*.md` files don't get deleted (stale changesets)
- `CHANGELOG.md` files don't get updated
- `.changeset/pre.json` tracking gets out of sync
- Git tags don't get pushed
- npm provenance missing
- Easy to forget steps or make mistakes

### ✅ Do This (Automated Via PR)

```bash
# GOOD - Let Changesets handle everything
pnpm changeset                   # Create changeset
git push                         # Push changeset
# Wait for "Version Packages" PR
# Review PR, then merge it
# Changesets automatically publishes
```

**Benefits:**
- Consistent version bumps
- Automatic CHANGELOG updates
- Changesets properly consumed and deleted
- Git tags automatically pushed
- npm provenance included
- No manual steps = no mistakes

## Configuration Files

### `.changeset/config.json`

```json
{
  "fixed": [["lightfast", "@lightfastai/mcp"]],
  "updateInternalDependencies": "patch"
}
```

- **`fixed`** - Both packages always version together
- **`updateInternalDependencies`** - Auto-updates workspace dependencies

### `.changeset/pre.json`

```json
{
  "mode": "pre",
  "tag": "alpha",
  "changesets": []
}
```

- **`mode: "pre"`** - In prerelease mode
- **`tag: "alpha"`** - Publishes with `@alpha` tag
- **`changesets: []`** - Tracks unconsumed changesets

**Created by:** `pnpm changeset pre enter alpha`
**Removed by:** `pnpm changeset pre exit`

## Package Configuration

Both packages use `workspace:*` for internal dependencies:

**`core/mcp/package.json`:**
```json
{
  "dependencies": {
    "lightfast": "workspace:*"
  }
}
```

**What happens on publish:**
- **Development:** `workspace:*` → resolves to local `../lightfast`
- **Published:** Changesets converts to `^0.1.0-alpha.5` automatically

This enables:
- Testing MCP with local SDK changes
- No lockfile sync issues
- Smart version resolution on publish

## GitHub Actions Workflows

### `.github/workflows/release.yml`

**Triggers:**
- Push to `main` with changes to `.changeset/**`
- Manual workflow dispatch

**Jobs:**
1. Build packages
2. Run tests
3. Use `changesets/action`:
   - **If changesets exist** → Create/update "Version Packages (alpha)" PR
   - **If "Version Packages" PR merged** → Publish to npm

**Environment:**
- `GITHUB_TOKEN` - Creates PRs, pushes tags
- `NODE_AUTH_TOKEN` - Publishes to npm
- `NPM_CONFIG_PROVENANCE=true` - Enables signed attestations

### `.github/workflows/verify-changeset.yml`

**Triggers:** PRs that modify `.changeset/*.md` files

**Validates:**
- Changeset mentions `lightfast` or `@lightfastai/mcp`
- Uses valid version type (`patch`, `minor`, `major`)
- Includes summary description

## Semantic Versioning in Prerelease

**In alpha mode (0.1.0-alpha.X):**

| Bump Type | Current | Next | Use Case |
|-----------|---------|------|----------|
| `patch` | 0.1.0-alpha.4 | 0.1.0-alpha.5 | Bug fixes, small updates |
| `minor` | 0.1.0-alpha.4 | 0.2.0-alpha.0 | New features |
| `major` | 0.1.0-alpha.4 | 1.0.0-alpha.0 | Breaking changes |

**Most common:** Use `patch` for weekly alpha releases.

## Graduating to Stable

When ready for production release:

### 1. Exit Prerelease Mode

```bash
pnpm changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit prerelease mode"
git push
```

### 2. Create Stable Changeset

```bash
pnpm changeset
# Choose: patch (0.1.0) | minor (0.2.0) | major (1.0.0)
git push
```

### 3. Merge Version Packages PR

This will publish with `@latest` tag:
```bash
npm install lightfast@latest
npm install @lightfastai/mcp@latest
```

## Alpha to Beta Transition

### When to Move to Beta

**Alpha (current):**
- Breaking changes allowed in both API endpoints and SDK
- Weekly releases expected
- `/v1/` API can change freely

**Beta (planned):**
- `/v1/` API contract frozen - no breaking changes to HTTP endpoints
- Only additive changes (new optional fields, new endpoints)
- SDK can still have breaking changes (class renames, defaults)
- Signifies API is stabilizing for 1.0 release

### How to Transition

```bash
# 1. Exit alpha prerelease
pnpm changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit alpha prerelease"
git push

# 2. Enter beta prerelease
pnpm changeset pre enter beta
git add .changeset/pre.json
git commit -m "chore: enter beta prerelease"
git push

# 3. Create changeset for first beta
pnpm changeset
# Choose patch to go from 0.1.0-alpha.N → 0.1.0-beta.0
git push
```

**Installation after beta:**
```bash
npm install lightfast@beta
npm install @lightfastai/mcp@beta
```

### User Communication During Alpha/Beta

**What users see automatically:**
- CHANGELOG.md entries (via changeset summaries)
- GitHub Releases (auto-created on publish)
- npm version bumps

**What requires manual notification:**
- Slack/Discord announcements (via Pylon + Lightfast integration)
- Migration guides for breaking changes (add to changeset summaries)
- Deprecation notices (use `npm deprecate` command)

**For breaking changes, include migration steps in changesets:**
```markdown
---
"lightfast": major
"@lightfastai/mcp": major
---

## Breaking: Renamed `mode` to `rerankMode`

### Migration
\`\`\`typescript
// Before
client.search({ query: "...", mode: "balanced" })

// After
client.search({ query: "...", rerankMode: "balanced" })
\`\`\`
```

## Troubleshooting

### "Version Packages" PR has conflicts

**Fix:** Close the PR. Changesets will create a fresh one on next push.

### Changesets still in `.changeset/` after publish

**Cause:** Versions were manually bumped instead of using the PR flow.

**Fix:**
```bash
# 1. Manually update CHANGELOGs
vim core/lightfast/CHANGELOG.md   # Add missing entries
vim core/mcp/CHANGELOG.md          # Add missing entries

# 2. Delete stale changesets
rm .changeset/old-changeset.md

# 3. Update pre.json tracking
vim .changeset/pre.json            # Remove consumed changesets from array

# 4. Commit
git add . && git commit -m "chore: sync changesets system" && git push
```

### npm publish fails with 403

**Error:** `403 You cannot publish over previously published versions`

**Cause:** Version already exists on npm.

**Fix:** Bump version again with a new changeset.

### Lockfile out of sync

**Error:** `ERR_PNPM_OUTDATED_LOCKFILE`

**Cause:** MCP dependency not using `workspace:*` protocol.

**Fix:** Ensure `core/mcp/package.json` uses:
```json
{
  "dependencies": {
    "lightfast": "workspace:*"
  }
}
```

## Commands Reference

```bash
# Changesets
pnpm changeset                    # Create new changeset
pnpm changeset pre enter alpha    # Enter alpha prerelease mode
pnpm changeset pre exit           # Exit prerelease mode

# Build & Test
pnpm turbo build --filter lightfast --filter @lightfastai/mcp
pnpm --filter lightfast test
pnpm lint && pnpm typecheck

# npm
npm view lightfast versions       # List all published versions
npm view lightfast dist-tags      # Show dist tags (latest, alpha)
npm install lightfast@alpha       # Install alpha version

# GitHub
gh workflow run release.yml       # Manually trigger release
gh pr list --label "Version Packages"  # View version PRs
```

## Release Checklist

Before merging "Version Packages" PR:

- [ ] Version bump is correct (patch/minor/major)
- [ ] CHANGELOG entries are accurate
- [ ] Changeset files will be deleted
- [ ] Tests passing in CI
- [ ] Build successful

After merge (automatic):

- [ ] Packages published to npm
- [ ] Git tags pushed
- [ ] Changeset files deleted from `.changeset/`

## Current Status

**Version:** `0.1.0-alpha.4`
**Mode:** Prerelease (alpha)
**Fixed Versioning:** Both packages version together
**Next Release:** `0.1.0-alpha.5` (when next changeset merged)

## Support

- **Changesets docs**: https://github.com/changesets/changesets
- **npm publishing**: https://docs.npmjs.com/cli/v10/commands/npm-publish
- **GitHub Actions**: https://docs.github.com/en/actions
