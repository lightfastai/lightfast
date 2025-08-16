# @lightfastai/core NPM Publishing Workflow

Complete guide for publishing `@lightfastai/core` to npm using automated release bot with Changesets.

## 🚀 Quick Start

### 1. Make Changes & Create Changeset
```bash
# Make your changes to packages/lightfast-core/
git checkout -b feature/my-awesome-feature
# ... develop your feature ...
git commit -m "feat: add awesome new feature"

# Create changeset to describe your changes
pnpm changeset
```

The CLI will prompt you:
- **Package selection**: Choose `@lightfastai/core`
- **Change type**: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
- **Summary**: Brief description for changelog

### 2. Wait for Version PR
- Push your branch and create PR
- GitHub Actions automatically creates **"Version Packages"** PR
- This PR contains version bumps and changelog updates

### 3. Release by Merging
- Review and merge the "Version Packages" PR
- GitHub Actions **immediately publishes** to npm
- Creates GitHub Release with full changelog

## 📋 Detailed Workflow

### Development Phase

```bash
# Example: Adding a new memory adapter
git checkout -b feat/postgres-memory-adapter

# 1. Add your code
# packages/lightfast-core/src/core/memory/adapters/postgres.ts

# 2. Update exports in package.json
# Add new export path for the postgres adapter

# 3. Build and test
pnpm --filter @lightfastai/core build
pnpm --filter @lightfastai/core test

# 4. Commit your changes
git add .
git commit -m "feat: add PostgreSQL memory adapter"
```

### Creating Changesets

```bash
pnpm changeset
```

**Changeset CLI Flow:**
```
🦋  Which packages would you like to include?
    ✅ @lightfastai/core

🦋  Which type of change is this for @lightfastai/core?
    ◯ patch   (bug fix - 0.1.0 → 0.1.1)
    ● minor   (new feature - 0.1.0 → 0.2.0)  
    ◯ major   (breaking change - 0.1.0 → 1.0.0)

🦋  Please enter a summary for this change
    Add PostgreSQL memory adapter with connection pooling

🦋  === Summary of changesets ===
    minor:  @lightfastai/core
    
🦋  Is this your desired changeset? (Y/n) Y
```

This creates: `.changeset/random-name-here.md`

### Version Management

**Multiple changesets accumulate:**
```bash
# Feature 1
pnpm changeset  # minor: Add PostgreSQL adapter

# Feature 2  
pnpm changeset  # patch: Fix memory leak in Redis adapter

# Feature 3
pnpm changeset  # minor: Add batch operations support
```

**Result:** Next release will be `minor` (highest precedence) with all changes in changelog.

### Release Process

1. **Automatic Version PR Creation**
   - GitHub Actions detects changesets in `.changeset/`
   - Creates PR: `chore: version packages`
   - Updates `package.json` version
   - Generates `CHANGELOG.md` entries
   - Removes consumed changeset files

2. **Manual Release Trigger**
   ```bash
   # Review the Version Packages PR, then:
   git checkout main
   git merge origin/changeset-release/main  # or merge via GitHub UI
   ```

3. **Automatic Publishing**
   - GitHub Actions builds package
   - Runs quality checks
   - Publishes to npm registry
   - Creates GitHub Release
   - Updates git tags

## 🛠️ Setup & Configuration

### Release Bot Account

**GitHub Account:** `lightfast-release-bot`
- Created dedicated account for automated releases
- Added as collaborator with write permissions

### Required Secrets

Add to GitHub repository secrets:

```bash
# LIGHTFAST_RELEASE_BOT_NPM_TOKEN: Get from npmjs.com
# 1. Login to npmjs.com with release bot account
# 2. Access Tokens → Generate New Token
# 3. Choose "Automation" type
# 4. Add to GitHub secrets with name: LIGHTFAST_RELEASE_BOT_NPM_TOKEN

# LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN: Personal Access Token
# 1. Login to GitHub as release bot account
# 2. Settings → Developer settings → Personal access tokens → Tokens (classic)
# 3. Generate new token with 'repo' and 'workflow' scopes
# 4. Add to GitHub secrets with name: LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN
```

### Changesets Configuration

**.changeset/config.json:**
```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

## 📦 Package Structure

### Build System
- **tsup**: JavaScript/TypeScript bundling for npm
- **tsc**: Type declarations generation
- **Dual format**: ESM (`.js`) + CJS (`.cjs`) + Types (`.d.ts`)

### Publishing Configuration
```json
{
  "name": "@lightfastai/core",
  "version": "0.1.0",
  "exports": {
    "./agent": {
      "types": "./dist/agent.d.ts",
      "import": "./dist/agent.js",
      "require": "./dist/agent.cjs"
    }
  }
}
```

### Files Included in Package
- `dist/` - Built JavaScript and type files
- `package.json` - Package metadata
- `README.md` - Usage documentation

### Files Excluded (.npmignore)
- `src/` - Source TypeScript files
- `src/core/v2/` - v2 code (not published)
- `tsconfig.json`, `tsup.config.ts` - Build configs
- `node_modules/`, `.turbo/` - Development artifacts

## 🎯 Best Practices

### Semantic Versioning
- **patch (0.1.0 → 0.1.1)**: Bug fixes, performance improvements
- **minor (0.1.0 → 0.2.0)**: New features, non-breaking changes
- **major (0.1.0 → 1.0.0)**: Breaking changes, API changes

### Changeset Guidelines
```bash
# Good changeset summaries:
"Add PostgreSQL memory adapter with connection pooling"
"Fix memory leak in Redis adapter cleanup"
"Support batch operations in tool execution"

# Avoid:
"Update stuff"
"Fix bug"
"Various improvements"
```

### Release Timing
- **Accumulate changes**: Don't release every tiny change
- **Batch features**: Group related features in one release
- **Friday releases**: Avoid unless critical - weekend monitoring
- **Version planning**: Coordinate breaking changes for major versions

## 🔍 Monitoring & Debugging

### Release Status
```bash
# Check current version
npm view @lightfastai/core version

# Check GitHub Actions
# https://github.com/lightfastai/lightfast/actions

# Check npm package
# https://www.npmjs.com/package/@lightfastai/core
```

### Common Issues

**Release failed?**
1. Check GitHub Actions logs
2. Verify LIGHTFAST_RELEASE_BOT_NPM_TOKEN is valid
3. Ensure package builds successfully
4. Check npm package name availability
5. Confirm bot account has npm org access

**Version PR not created?**
1. Verify changesets exist in `.changeset/`
2. Check GitHub Actions permissions
3. Ensure bot account has repo access
4. Verify LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN has correct scopes

**Build failures?**
```bash
# Test locally first:
pnpm --filter @lightfastai/core build
pnpm --filter @lightfastai/core typecheck
```

## 📋 Checklist: First Release

- [ ] Set up release bot GitHub account
- [ ] Generate LIGHTFAST_RELEASE_BOT_NPM_TOKEN and add to repo secrets
- [ ] Generate LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN and add to repo secrets
- [ ] Make changes to `packages/lightfast-core/`
- [ ] Create changeset: `pnpm changeset`
- [ ] Push changes and create PR
- [ ] Verify Version Packages PR is created
- [ ] Merge Version Packages PR
- [ ] Confirm package appears on npm
- [ ] Test installation: `npm install @lightfastai/core@latest`

## 🚀 Next Steps

1. **Complete npm setup** with release bot account
2. **Create first changeset** for existing changes
3. **Test full workflow** with initial 0.1.0 release
4. **Document v1 API** as it stabilizes
5. **Plan v1.0.0 release** timeline

---

**Questions?** Check the GitHub Actions logs or npm registry for the latest status.