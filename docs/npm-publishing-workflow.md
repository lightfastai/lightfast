# NPM Publishing Workflow

Automated release workflow for `lightfast` using Changesets.

## Quick Start

### 1. Create Changeset
```bash
# After making changes to core/lightfast/
pnpm changeset
# Select: lightfast
# Choose: patch/minor/major
# Enter: changelog summary
```

### 2. Merge & Release
- Push changes → GitHub Actions creates "Version Packages" PR
- Merge that PR → Automatically publishes to npm

## Setup

### Release Bot Account
- GitHub: `lightfast-release-bot` (collaborator with write access)
- NPM: Same bot account (admin of `@lightfastai` org for new packages)

### Repository Secrets
```bash
LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN  # GitHub PAT with 'repo' + 'workflow' scopes
LIGHTFAST_RELEASE_BOT_NPM_TOKEN     # NPM automation token (not classic)
```

### Version Types
- **patch** (0.1.0 → 0.1.1): Bug fixes
- **minor** (0.1.0 → 0.2.0): New features
- **major** (0.1.0 → 1.0.0): Breaking changes

## Commands

```bash
# Development
pnpm --filter lightfast build     # Build package
pnpm --filter lightfast test      # Run tests
pnpm --filter lightfast typecheck # Type check

# Release
pnpm changeset        # Create changeset
pnpm changeset status # View pending changes
```

## Package Structure

```json
{
  "name": "lightfast",
  "version": "0.2.0",
  "exports": {
    "./agent": {
      "types": "./dist/agent.d.ts",
      "import": "./dist/agent.mjs"
    }
    // Multiple exports supported
  }
}
```

**Published:** `dist/`, `package.json`, `README.md`  
**Excluded:** `src/`, build configs, `node_modules/`

## Troubleshooting

**Release failed?**
- Check GitHub Actions logs
- Verify NODE_AUTH_TOKEN is used (not NPM_TOKEN)
- Ensure bot has npm org admin access
- Confirm workflow has `id-token: write` permission

**Version PR not created?**
- Verify changesets exist in `.changeset/`
- Check bot has repo write access
- Confirm token scopes are correct

**First-time package publish fails?**
- Bot needs admin role in npm org
- Token must be automation type
- Changeset config needs `"access": "public"`

## Workflows

### `release.yml`
Main release workflow triggered by changesets merged to main.

### `verify-changeset.yml` 
Validates changeset format and semantic versioning on PRs.

## Checklist

- [ ] Create release bot accounts (GitHub + NPM)
- [ ] Add bot to GitHub repo (write access)  
- [ ] Add bot to npm org as admin (`@lightfastai`)
- [ ] Generate NPM automation token & add to secrets
- [ ] Create changeset: `pnpm changeset`
- [ ] Merge "Version Packages" PR to release

## Notes

- Node.js 22+ required (matches package.json engine)
- Private packages need `"private": true` in package.json
- Published to: https://www.npmjs.com/package/lightfast