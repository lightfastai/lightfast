# Console Database Deployment Guide

This document explains how to deploy schema changes from the console database to production using GitHub Actions.

## Overview

Since PlanetScale Postgres doesn't yet support deploy requests (like their MySQL offering), we use a manually-triggered GitHub Actions workflow to safely apply Drizzle migrations to the production database.

## Workflow: Deploy Console Database Schema

**Location:** `.github/workflows/deploy-console-db.yml`

### Features

✅ **Manual trigger only** - No accidental deployments
✅ **Dry run mode** - Preview changes before applying
✅ **Confirmation required** - Must type "DEPLOY" for production
✅ **Safety checks** - Validates inputs before deployment
✅ **Deployment summary** - Shows what happened after execution

## Prerequisites

### 1. GitHub Secrets

Add this secret to your repository (`Settings` → `Secrets and variables` → `Actions`):

```
CONSOLE_DATABASE_URL
```

The value should be your PlanetScale Postgres production connection string:
```
postgres://user:password@host.aws-us-east-1.psdb.cloud/database?sslmode=verify-full
```

### 2. GitHub Environment (Optional)

For additional protection, create a `production` environment:
1. Go to `Settings` → `Environments` → `New environment`
2. Name it `production`
3. Add protection rules:
   - Required reviewers (recommended)
   - Deployment branch rules

## Usage

### Step 1: Preview Changes (Dry Run)

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **"Deploy Console Database Schema"** workflow
4. Click **"Run workflow"** button
5. Configure:
   - **Dry run**: ✓ (checked)
   - **Confirm**: (leave empty)
6. Click **"Run workflow"**

This will:
- Show current schema files
- List pending migration files
- **NOT apply any changes**

### Step 2: Review the Dry Run

1. Wait for workflow to complete
2. Check the deployment summary
3. Review migration files that would be applied
4. Verify this matches your expectations

### Step 3: Deploy to Production

1. Run workflow again with:
   - **Dry run**: ☐ (unchecked)
   - **Confirm**: `DEPLOY` (type exactly)
2. Click **"Run workflow"**

This will:
- Apply migrations using `pnpm db:migrate`
- Show deployment summary
- Report success or failure

## Development Workflow

### Local Development

```bash
# 1. Make schema changes
cd db/console
# Edit files in src/schema/

# 2. Generate migration
pnpm db:generate

# 3. Apply to dev branch
pnpm db:migrate

# 4. Test thoroughly
# ... run tests, verify changes ...

# 5. Commit migration files
git add src/schema/ src/migrations/
git commit -m "feat(db): add new table for feature X"
git push
```

### Production Deployment

```bash
# After PR is merged to main:

# 1. Go to GitHub Actions
# 2. Run "Deploy Console Database Schema" workflow
# 3. First: dry_run=true (preview)
# 4. Then: dry_run=false, confirm=DEPLOY (apply)
```

## Migration File Structure

```
db/console/
├── src/
│   ├── schema/              # Schema definitions
│   │   ├── index.ts
│   │   ├── users.ts
│   │   └── workspaces.ts
│   └── migrations/          # Generated migration files
│       ├── 0000_initial.sql
│       ├── 0001_add_users.sql
│       └── meta/            # Migration metadata
│           └── _journal.json
```

## Important Notes

### ⚠️ Never Manually Edit Migration Files

Always use `pnpm db:generate` to create migrations. Manual edits can cause issues.

See: `db/CLAUDE.md` for migration rules.

### ⚠️ PlanetScale Postgres Limitations

Unlike PlanetScale MySQL:
- ❌ No automatic deploy requests
- ❌ No schema diffing between branches
- ❌ No automatic rollback
- ✅ Manual migrations via this workflow

### ⚠️ Deployment is Irreversible

Once migrations are applied:
- They cannot be automatically rolled back
- You must create a new migration to undo changes
- Test thoroughly before deploying!

## Troubleshooting

### "Production deployment requires confirmation"

**Cause:** You didn't type "DEPLOY" in the confirm field

**Solution:** Run again with `confirm: DEPLOY` (case-sensitive)

### "Cannot connect to database"

**Cause:** `CONSOLE_DATABASE_URL` secret is missing or invalid

**Solution:**
1. Check secret exists: `Settings` → `Secrets` → `CONSOLE_DATABASE_URL`
2. Verify connection string format is correct
3. Test connection locally with the same URL

### "Migration files not found"

**Cause:** No pending migrations exist

**Solution:**
1. Generate migrations: `cd db/console && pnpm db:generate`
2. Commit migration files to git
3. Push to GitHub

### Workflow fails with permission errors

**Cause:** GitHub Actions doesn't have permission to access secrets

**Solution:**
1. Verify secret is in correct location (repository or environment)
2. Check environment protection rules aren't blocking

## Best Practices

### 1. Always Dry Run First
Never deploy directly to production. Always preview first.

### 2. Small, Incremental Changes
Deploy one feature at a time. Easier to debug if something goes wrong.

### 3. Test Locally
Apply migrations to your local dev database before deploying.

### 4. Version Control Everything
All schema changes and migrations should be in git.

### 5. Communicate with Team
Let the team know when you're deploying database changes.

## Future Improvements

When PlanetScale Postgres supports deploy requests:
- Automatic schema diffing
- Branch-to-main merging
- Automatic rollback support
- Web UI for deployments

Until then, this workflow provides a safe, controlled deployment process.

## Questions?

- **Schema changes:** See `db/CLAUDE.md`
- **Drizzle ORM:** See `db/console/package.json` for commands
- **Workflow issues:** Check GitHub Actions logs
