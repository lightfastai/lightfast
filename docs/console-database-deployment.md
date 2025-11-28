# Console Database Deployment Guide

## Overview

The console app uses **automatic pre-build migrations** to ensure database schema is always synchronized with deployed code. Migrations run automatically before every production build on Vercel.

## How It Works

```
1. Code merged to main branch
2. Vercel starts deployment
3. ✅ Pre-build script runs migrations FIRST
4. Next.js app builds (with updated schema)
5. Deployment completes
```

This prevents the classic race condition where code deploys before schema updates.

## Architecture

### Files

- **`apps/console/scripts/pre-build-migrate.sh`** - Pre-build migration script
- **`apps/console/package.json`** - Build command runs `db:migrate:safe` first
- **`apps/console/vercel.json`** - Provides database credentials at build time
- **`db/console/src/migrations/`** - Generated migration files (Drizzle)

### Build Flow

```bash
# Production build command
pnpm build:prod

# Expands to:
pnpm db:migrate:safe && pnpm with-env:prod next build --turbopack

# Which runs:
bash scripts/pre-build-migrate.sh  # Runs migrations
pnpm with-env:prod next build      # Then builds app
```

## Prerequisites

### Vercel Environment Variables

Add these secrets to your Vercel project (`Settings` → `Environment Variables`):

**Production:**
```
DATABASE_HOST       = your-db.aws-us-east-1.psdb.cloud
DATABASE_USERNAME   = your-username
DATABASE_PASSWORD   = your-password
```

**Important:** These must be available at **build time**, not just runtime.

### How to Add Secrets

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable:
   - **Name**: `DATABASE_HOST`
   - **Value**: `your-db.aws-us-east-1.psdb.cloud`
   - **Environment**: Production (check)
   - **Expose to builds**: ✅ (required!)
3. Repeat for `DATABASE_USERNAME` and `DATABASE_PASSWORD`

## Development Workflow

### Local Development

```bash
# 1. Make schema changes
cd db/console
# Edit files in src/schema/

# 2. Generate migration
pnpm db:generate

# 3. Apply to dev database
pnpm db:migrate

# 4. Test locally
cd ../../apps/console
pnpm dev

# 5. Commit migration files
git add db/console/src/schema/ db/console/src/migrations/
git commit -m "feat(db): add new workspace settings table"
```

### Production Deployment

```bash
# 1. Push to main (or merge PR)
git push origin main

# 2. Vercel automatically:
#    - Runs pre-build migration script
#    - Applies pending migrations
#    - Builds app with updated schema
#    - Deploys

# 3. Monitor deployment
# Check Vercel deployment logs for migration output
```

## Migration Script Behavior

### Safety Checks

The pre-build script (`scripts/pre-build-migrate.sh`) includes multiple safety checks:

**1. Environment Check**
```bash
# Skips if not production
if [ "$VERCEL_ENV" != "production" ]; then
  echo "Skipping migrations for non-production deployment"
  exit 0
fi
```

**2. Credentials Check**
```bash
# Skips if database credentials missing
if [ -z "$DATABASE_HOST" ]; then
  echo "Skipping migrations (likely local development)"
  exit 0
fi
```

**3. Migration Files Check**
```bash
# Skips if no migrations exist
if [ ! -d "src/migrations" ]; then
  echo "No migrations directory - skipping"
  exit 0
fi
```

### What Gets Logged

During Vercel builds, you'll see:

```
🗃️  Pre-Build Migration Script
================================
🌍 Environment: Production
📍 Running migrations for console database...

📋 Found 3 migration file(s)

🚀 Applying migrations...
✅ Migrations applied successfully!

================================
✅ Pre-build migration complete
```

## Troubleshooting

### Build Fails: "Database credentials not set"

**Cause:** Database environment variables not configured in Vercel

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Ensure `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` exist
3. **Check "Expose to builds"** is enabled
4. Redeploy

### Build Fails: "Migration failed"

**Cause:** Migration has syntax error or schema conflict

**Solution:**
1. Check Vercel build logs for specific error
2. Test migration locally:
   ```bash
   cd db/console
   pnpm db:migrate
   ```
3. Fix migration, commit, redeploy

### Migrations Run on Preview Deployments

**Current behavior:** Migrations only run on `VERCEL_ENV=production`

**To enable for preview:**
```bash
# Edit scripts/pre-build-migrate.sh
if [ "$VERCEL_ENV" != "production" ] && [ "$VERCEL_ENV" != "preview" ]; then
  echo "Skipping migrations for $VERCEL_ENV"
  exit 0
fi
```

### How to Roll Back a Migration

**Option 1: Create Reverse Migration**
```bash
# Create new migration that undoes changes
cd db/console
# Edit schema to revert changes
pnpm db:generate
git commit -m "revert(db): rollback workspace settings table"
git push
```

**Option 2: Revert Commit**
```bash
git revert <commit-hash>
git push
# Vercel redeploys with reverted schema
```

## ⚠️ Critical: Build Failures After Migration

### The Problem

**If the build fails AFTER migrations run:**

```
1. ✅ Migrations run (database schema updated)
2. ❌ Next.js build fails (TypeScript error, missing env, etc.)
3. ❌ Deployment aborted
4. 🔥 OLD CODE + NEW SCHEMA = Production broken
```

### The Solution: Backward-Compatible Migrations

**Always write migrations that work with BOTH old and new code.**

#### ✅ Expand-Contract Pattern (Safe)

**Phase 1: Expand (add column with default)**
```sql
-- Migration 1: Add optional column
ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';
```
- Deploy this migration
- Old code continues working (ignores new column)
- New code can start using new column

**Phase 2: Contract (make required, later)**
```sql
-- Migration 2: Make column required (weeks later, after all code updated)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

#### ❌ Breaking Changes (Dangerous)

```sql
-- ❌ BAD: Add required column immediately
ALTER TABLE users ADD COLUMN email TEXT NOT NULL;
-- If build fails, old code crashes trying to INSERT!

-- ❌ BAD: Drop column
ALTER TABLE users DROP COLUMN legacy_field;
-- If build fails, old code crashes trying to SELECT!

-- ❌ BAD: Rename column
ALTER TABLE users RENAME COLUMN name TO full_name;
-- If build fails, old code can't find 'name'!
```

### Migration Safety Checklist

Before deploying any migration, ask:

- [ ] **Can old code run with this schema change?**
- [ ] **Does this add optional fields (not required)?**
- [ ] **Does this preserve existing columns?**
- [ ] **Have I tested locally with current production code?**

If any answer is "No", use the expand-contract pattern!

### Example: Safe Column Addition

```typescript
// Migration: Add email column (optional)
ALTER TABLE users ADD COLUMN email TEXT;

// Old code (still deployed): Works fine, ignores email
db.insert(users).values({ name: "Alice" });

// New code (after deploy): Can use email
db.insert(users).values({ name: "Alice", email: "alice@example.com" });

// Later migration: Make required (only after all code updated)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

### What If Build Still Fails?

**Options:**

1. **Quick fix the build** (preferred)
   - Fix TypeScript error
   - Add missing env var
   - Redeploy immediately

2. **Revert the PR** (if unfixable quickly)
   ```bash
   git revert HEAD
   git push
   # Vercel redeploys, but migration already ran
   # Need a new migration to undo schema changes
   ```

3. **Manual schema rollback** (last resort)
   ```bash
   # Connect to production database
   psql $DATABASE_URL
   # Manually run reverse migration
   ALTER TABLE users DROP COLUMN email;
   ```

**Prevention is better than cure - always use backward-compatible migrations!**

## Best Practices

### 1. Test Migrations Locally First

Always apply and test migrations on your local database before pushing:

```bash
cd db/console
pnpm db:generate
pnpm db:migrate
# Test the app with new schema
cd ../../apps/console
pnpm dev
```

### 2. Small, Incremental Changes

Deploy one migration at a time:
- ✅ Add column → deploy → add logic using column
- ❌ Add column + drop column + rename table in one migration

### 3. Backward Compatible Migrations

When possible, make changes backward compatible:

```bash
# ✅ Good: Add column (old code still works)
ALTER TABLE users ADD COLUMN email TEXT;

# ❌ Risky: Remove column (breaks old code)
ALTER TABLE users DROP COLUMN name;
```

### 4. Monitor Deployment Logs

Always check Vercel deployment logs to verify migrations succeeded:
- Build logs show migration output
- Look for "✅ Migrations applied successfully!"

### 5. Use Drizzle, Don't Hand-Write SQL

Always use `pnpm db:generate` to create migrations:
```bash
# ✅ Good
cd db/console
pnpm db:generate

# ❌ Bad
vim db/console/src/migrations/0001_manual.sql
```

See: `db/CLAUDE.md` for migration rules.

## Migration File Structure

```
db/console/
├── src/
│   ├── schema/              # Schema definitions (source of truth)
│   │   ├── index.ts         # Re-exports all schemas
│   │   ├── workspaces.ts    # Workspace table schema
│   │   └── users.ts         # User table schema
│   └── migrations/          # Generated migrations (auto-created)
│       ├── 0000_initial.sql
│       ├── 0001_add_workspaces.sql
│       └── meta/
│           └── _journal.json  # Migration history
```

## Environment Variables Reference

### Build-Time (Required for Migrations)

```bash
DATABASE_HOST       # PlanetScale Postgres host
DATABASE_USERNAME   # Database username
DATABASE_PASSWORD   # Database password
VERCEL_ENV          # Auto-set by Vercel (production/preview/development)
```

### Runtime (App Execution)

Same credentials, but used by the running app (not migrations).

## Deployment Timeline

```
Time    Event
-----   -----
T+0s    Code pushed to main
T+5s    Vercel deployment triggered
T+10s   Dependencies installed
T+15s   ✅ Pre-build migrations run
T+20s   Next.js build starts
T+60s   Build completes
T+65s   Deployment live
```

Migrations happen **before** the build, ensuring schema is ready when code runs.

## FAQs

### Q: What if migrations take too long?

**A:** Vercel has a 15-minute build timeout. If migrations exceed this:
1. Batch migrations into smaller sets
2. Run long migrations manually via `pnpm db:migrate` before deploying

### Q: Can I skip migrations for a deployment?

**A:** Yes, but not recommended. To skip:
```bash
# Temporarily disable in vercel.json
{
  "build": {
    "env": {
      "SKIP_MIGRATIONS": "true"
    }
  }
}
```

### Q: Do migrations run on every build?

**A:** Drizzle migrations are idempotent - they track which migrations have run and skip duplicates. So yes, the script runs on every build, but only new migrations actually execute.

### Q: What about rollbacks?

**A:** Create a new migration that reverses changes. There's no automatic rollback because:
- Migrations may have already run
- Data changes can't always be reversed
- New migration provides audit trail

## Summary

**Key Points:**
- ✅ Migrations run automatically before every production build
- ✅ No manual deployment steps needed
- ✅ Schema always synchronized with code
- ✅ Safety checks prevent accidental runs
- ✅ Drizzle handles migration tracking

**Setup Required:**
1. Add database credentials to Vercel (build-time)
2. Generate migrations with `pnpm db:generate`
3. Commit migrations to git
4. Push to main - automatic deployment

**Result:**
Zero-downtime deployments with guaranteed schema/code consistency.
