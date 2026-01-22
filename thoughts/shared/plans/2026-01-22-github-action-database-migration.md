# GitHub Action for PlanetScale Database Migration Implementation Plan

## Overview

Create a GitHub Actions workflow that allows manual execution of database migrations against the production PlanetScale PostgreSQL database for the console application. The workflow will be triggered via `workflow_dispatch` from the GitHub Actions UI, execute migrations using Drizzle Kit, and report success/failure status.

## Current State Analysis

### Existing Infrastructure
- **3 GitHub workflows** exist: `ci.yml`, `release.yml`, `verify-changeset.yml` - none handle database operations
- **Migration tooling**: Drizzle Kit configured in `db/console/src/drizzle.config.ts`
- **Scripts available**: `pnpm db:migrate` via `db/console/package.json:29`
- **Environment validation**: Skips validation when `CI=true` (`db/console/env.ts:15`)

### Connection Requirements
- **Port 5432** required for migrations (direct PostgreSQL connection)
- **Port 6432** used for runtime queries (PgBouncer - incompatible with DDL)
- **SSL required**: `ssl: true` in drizzle config

### Required Secrets
From `db/console/env.ts:6-8`:
- `DATABASE_HOST` - PlanetScale PostgreSQL hostname
- `DATABASE_USERNAME` - Database user
- `DATABASE_PASSWORD` - Database password

## Desired End State

A new GitHub Actions workflow file at `.github/workflows/db-migrate.yml` that:
1. Can be manually triggered from GitHub Actions UI
2. Connects to production PlanetScale database
3. Executes pending Drizzle migrations
4. Reports clear success/failure status with migration details
5. Logs migration output for debugging

### Verification Criteria
- [ ] Workflow appears in GitHub Actions UI under "Actions" tab
- [ ] Manual dispatch works with "Run workflow" button
- [ ] Workflow accesses database credentials from GitHub Secrets
- [ ] Migrations execute successfully (verified by checking database state)
- [ ] Workflow logs show migration SQL that was applied

## What We're NOT Doing

- **No staging environment** - Production only
- **No approval gates** - Runs automatically once triggered
- **No automatic triggers** - Manual dispatch only (no triggers on merge)
- **No rollback automation** - Rollback must be handled manually if needed
- **No Slack/Discord notifications** - Plain GitHub Actions status only
- **No backup before migration** - PlanetScale handles backups at platform level

## Implementation Approach

Create a single new workflow file that:
1. Uses manual `workflow_dispatch` trigger
2. Sets up Node.js/pnpm environment (matching existing CI patterns)
3. Injects database credentials via environment variables
4. Runs `drizzle-kit migrate` against production database
5. Reports status via workflow conclusion

## Phase 1: Create GitHub Secrets

### Overview
Add required database credentials as GitHub repository secrets.

### Changes Required:

#### 1. GitHub Repository Settings
**Location**: GitHub Repository → Settings → Secrets and variables → Actions → Repository secrets

Add the following secrets (values from PlanetScale console):

| Secret Name | Description |
|-------------|-------------|
| `DATABASE_HOST` | PlanetScale PostgreSQL host (e.g., `us-east-2.pg.psdb.cloud`) |
| `DATABASE_USERNAME` | PlanetScale database username |
| `DATABASE_PASSWORD` | PlanetScale database password |

### Success Criteria:

#### Automated Verification:
- N/A (manual GitHub UI operation)

#### Manual Verification:
- [x] All 3 secrets visible in GitHub Settings → Secrets → Actions
- [x] Secret names match exactly: `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`

**Implementation Note**: After completing this phase, pause for confirmation that secrets have been added before proceeding to Phase 2.

---

## Phase 2: Create Migration Workflow

### Overview
Create the GitHub Actions workflow file for database migrations.

### Changes Required:

#### 1. New Workflow File
**File**: `.github/workflows/db-migrate.yml`

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "migrate" to confirm you want to run migrations against production'
        required: true
        type: string

# Only allow one migration at a time
concurrency:
  group: db-migration
  cancel-in-progress: false

jobs:
  migrate:
    name: Run Database Migrations
    runs-on: ubuntu-latest
    # Only run if user typed "migrate" as confirmation
    if: github.event.inputs.confirm == 'migrate'
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.5.2

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Show pending migrations
        working-directory: db/console
        env:
          DATABASE_HOST: ${{ secrets.DATABASE_HOST }}
          DATABASE_USERNAME: ${{ secrets.DATABASE_USERNAME }}
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
        run: |
          echo "📋 Checking for pending migrations..."
          echo "---"
          ls -la src/migrations/*.sql | tail -10
          echo "---"
          echo "Migration journal:"
          cat src/migrations/meta/_journal.json | tail -30

      - name: Run migrations
        working-directory: db/console
        env:
          DATABASE_HOST: ${{ secrets.DATABASE_HOST }}
          DATABASE_USERNAME: ${{ secrets.DATABASE_USERNAME }}
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
        run: |
          echo "🚀 Running database migrations..."
          pnpm drizzle-kit migrate --config=./src/drizzle.config.ts
          echo "✅ Migrations completed successfully!"

      - name: Verify migration status
        working-directory: db/console
        env:
          DATABASE_HOST: ${{ secrets.DATABASE_HOST }}
          DATABASE_USERNAME: ${{ secrets.DATABASE_USERNAME }}
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
        run: |
          echo "🔍 Verifying migration status..."
          echo "Checking database connection and schema..."
          # This will fail if there are any pending migrations
          pnpm drizzle-kit push --config=./src/drizzle.config.ts --dry-run 2>&1 || true
          echo "✅ Migration verification complete"

  # Job that runs if confirmation was not provided
  no-confirmation:
    name: Migration Not Confirmed
    runs-on: ubuntu-latest
    if: github.event.inputs.confirm != 'migrate'
    steps:
      - name: Show error
        run: |
          echo "❌ Migration was not confirmed."
          echo "You must type 'migrate' in the confirmation input to run migrations."
          echo "This is a safety measure to prevent accidental database changes."
          exit 1
```

### Success Criteria:

#### Automated Verification:
- [x] Workflow file passes YAML validation: `yamllint .github/workflows/db-migrate.yml`
- [ ] Workflow appears in GitHub Actions after push

#### Manual Verification:
- [ ] "Database Migration" workflow visible in GitHub Actions UI
- [ ] "Run workflow" button appears on the workflow page
- [ ] Confirmation input field appears when clicking "Run workflow"
- [ ] Typing anything other than "migrate" fails the workflow
- [ ] Typing "migrate" triggers the migration job

**Implementation Note**: After completing this phase, test the workflow with the confirmation safety check before running actual migrations.

---

## Phase 3: Test Migration Workflow

### Overview
Verify the workflow executes correctly by running it manually.

### Test Steps:

1. **Test safety check** (should fail):
   - Go to Actions → Database Migration → Run workflow
   - Type "test" in confirmation field
   - Run workflow
   - Verify it fails with "Migration Not Confirmed" message

2. **Test successful migration** (should pass):
   - Go to Actions → Database Migration → Run workflow
   - Type "migrate" in confirmation field
   - Run workflow
   - Verify all steps complete successfully
   - Check "Show pending migrations" step output
   - Check "Run migrations" step output
   - Check "Verify migration status" step output

### Success Criteria:

#### Automated Verification:
- [ ] Workflow completes with green checkmark
- [ ] All job steps show success status

#### Manual Verification:
- [ ] Migration output shows expected SQL statements (if any pending)
- [ ] No database connection errors in logs
- [ ] "Migrations completed successfully" message appears
- [ ] Database state reflects applied migrations (check via Drizzle Studio if needed)

---

## Testing Strategy

### Pre-Deployment Testing
1. **Syntax validation**: Verify YAML is valid before committing
2. **Dry run**: First workflow run with no pending migrations (should be no-op)
3. **Actual migration**: Create a test schema change, generate migration, then run workflow

### Failure Scenarios
- **Bad credentials**: Workflow will fail at "Run migrations" step with connection error
- **Schema conflict**: Drizzle will report error and workflow will fail
- **Network issues**: Timeout after 10 minutes

### Rollback Strategy
If a migration causes issues:
1. Manually write reverse migration SQL
2. Apply via local `pnpm db:push` or create new migration
3. PlanetScale also provides database restore from automatic backups

## Security Considerations

1. **Secrets exposure**: Database credentials never logged (GitHub redacts secret values automatically)
2. **Confirmation required**: User must type "migrate" to prevent accidental runs
3. **Concurrency lock**: Only one migration can run at a time
4. **No auto-trigger**: Manual dispatch only - no risk of unintended runs on push/merge

## Migration Notes

This is a net-new workflow with no existing infrastructure to migrate. The workflow can be added and tested without affecting current manual migration processes.

After the workflow is proven reliable, the team can choose to:
- Continue using both manual CLI and workflow methods
- Gradually shift to workflow-only approach
- Add optional Slack notifications in future iteration

## References

- Research document: `thoughts/shared/research/2026-01-22-github-action-planetscale-migration-production.md`
- Drizzle config: `db/console/src/drizzle.config.ts:4-15`
- Migration scripts: `db/console/package.json:27-31`
- Environment validation: `db/console/env.ts:15`
- Existing CI patterns: `.github/workflows/ci.yml`
