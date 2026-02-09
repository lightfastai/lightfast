---
date: 2026-02-08T00:00:00-08:00
researcher: jeevan
git_commit: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
branch: main
repository: lightfast
topic: "Vercel Deployment Checks for Database Schema Validation"
tags: [research, codebase, vercel, deployment, database, schema-validation, drizzle, planetscale]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevan
---

# Research: Vercel Deployment Checks for Database Schema Validation

**Date**: 2026-02-08
**Researcher**: jeevan
**Git Commit**: dec61c9b56ff86bc64ec5b8efedf7ed134c89af2
**Branch**: main
**Repository**: lightfast

## Research Question

Can we create a Vercel deployment check that stops deployment from proceeding until it's confirmed that the db/console schema is the latest (meaning there are no discrepancies between the schema in db/console with the actual database)? Is this approach recommended?

## Summary

Yes, Vercel deployment checks can be used to validate database schema consistency before deployment. Vercel's Checks API provides a blocking mechanism that prevents production deployments from going live until custom validation passes. The codebase already has schema validation scripts in `db/console/scripts/` that can be integrated into deployment checks.

**Current State:**
- Vercel deployment configured via `vercel.json` in each app with `"ignoreCommand": "npx turbo-ignore"`
- Database migrations managed by Drizzle ORM with 28 sequential migrations
- Manual GitHub Actions workflow exists for production migrations (`db-migrate.yml`)
- Pre-build migration script exists but only runs in production (`pre-build-migrate.mjs`)
- Schema validation scripts available: `verify-tables.ts`, `apply-jobs-migration.ts`, `mark-migration-applied.ts`

**Recommendation:**
This approach is **recommended with modifications**. Instead of blocking deployment on schema validation, the safer pattern is:
1. Validate migrations are syntactically correct and compatible with Drizzle
2. Apply migrations automatically before deployment (already implemented)
3. Use blocking checks for post-deployment health verification

## Detailed Findings

### Current Vercel Deployment Configuration

**Vercel Configuration Files** (5 apps)
- `apps/console/vercel.json` - Console app (port 4107)
- `apps/www/vercel.json` - Marketing site (port 4101)
- `apps/auth/vercel.json` - Auth app
- `apps/chat/vercel.json` - Chat app (port 4106, standalone)
- `apps/docs/vercel.json` - Documentation

All share identical configuration:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx turbo-ignore"
}
```

**Microfrontends Routing**
`apps/console/microfrontends.json` routes all apps (except chat) through single domain at lightfast.ai. Console is the default app handling catch-all routes, sitemap.xml, and robots.txt.

**Build Configuration**
- Root: `turbo.json` - Turborepo orchestration with global env vars
- Per-app: `turbo.json` files for app-specific build config
- Next.js: `next.config.ts` files using `@vercel/microfrontends/next/config`

**CI/CD Workflows** (`.github/workflows/`)
- `ci.yml` - Main CI pipeline (lint, typecheck, test, build)
- `db-migrate.yml` - Manual database migration workflow with confirmation
- `release.yml` - NPM package releases
- `verify-changeset.yml` - Changeset verification

**Environment Variables**
From `turbo.json` globalEnv:
- `NEXT_PUBLIC_VERCEL_ENV` - Vercel environment (production/preview/development)
- `VERCEL_CLIENT_SECRET_ID` - OAuth client secret ID
- `VERCEL_CLIENT_INTEGRATION_SECRET` - Integration secret
- `VERCEL_REDIRECT_URI` - OAuth redirect URI

**Vercel Integration Endpoints**
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Webhook handler
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts` - OAuth callback

---

### Database Schema and Migration System

**Database Package**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/db/console`

**Configuration**
- `src/drizzle.config.ts` - Drizzle ORM configuration
- `env.ts` - Environment variable validation (DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD)
- `src/client.ts` - Database client with PlanetScale connection settings

**Schema Architecture** (19 tables)
- **User-level**: `user-api-keys`, `user-sources` (2 tables)
- **Organization-level**: `org-workspaces`, `org-api-keys`, `org-actor-identities` (3 tables)
- **Workspace-level**: Integrations, knowledge, neural network, observations, workflows (12 tables)

**Key Schema Files**
- `src/schema/index.ts` - Main schema export
- `src/schema/relations.ts` - Table relationships
- `src/schema/tables/*.ts` - 19 individual table definitions
- `src/schema/lib/id-helpers.ts` - ID generation utilities

**Migration Files** (28 sequential migrations)
- `src/migrations/0000_thick_blizzard.sql` through `0027_nasty_ezekiel_stane.sql`
- `src/migrations/meta/_journal.json` - Migration journal
- `src/migrations/meta/0000_snapshot.json` through `0027_snapshot.json` - Schema state snapshots

**Validation Scripts** (`scripts/`)
- `verify-tables.ts` - Verifies tables exist with correct indexes
- `apply-jobs-migration.ts` - Manually applies migrations when automation fails
- `mark-migration-applied.ts` - Marks migrations as applied in Drizzle tracking table

**Package Commands**
```bash
pnpm db:push       # Push schema changes directly
pnpm db:generate   # Generate new migration from schema changes
pnpm db:migrate    # Apply pending migrations
pnpm db:studio     # Open Drizzle Studio GUI
pnpm db:introspect # Introspect existing database schema
```

---

### Existing Pre-Deployment Validation Patterns

#### Pattern 1: Database Table Verification Script

**Location**: `db/console/scripts/verify-tables.ts`

```typescript
async function verifyTables() {
  // Check if lightfast_jobs exists and get count
  const [jobsResult] = await db.execute(sql`
    SELECT COUNT(*) as count FROM lightfast_jobs;
  `);
  console.log(`✓ lightfast_jobs table exists (${jobsResult.count} rows)`);

  // Check if lightfast_metrics exists and get count
  const [metricsResult] = await db.execute(sql`
    SELECT COUNT(*) as count FROM lightfast_metrics;
  `);
  console.log(`✓ lightfast_metrics table exists (${metricsResult.count} rows)`);

  // List all indexes on jobs table
  const jobsIndexes = await db.execute(sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'lightfast_jobs'
    ORDER BY indexname;
  `);
  console.log(`\n✓ lightfast_jobs has ${jobsIndexes.length} indexes:`);
}
```

**Key aspects**:
- Uses raw SQL queries via `db.execute(sql``)`
- Checks table existence by running COUNT queries
- Validates indexes with `pg_indexes` system catalog
- Exits with appropriate status codes (0 = success, 1 = failure)

---

#### Pattern 2: Pre-Build Migration Script (Current Production Pattern)

**Location**: `worktrees/console-db-deploy/apps/console/scripts/pre-build-migrate.mjs`

```javascript
// Check if we're in production build
const DATABASE_HOST = process.env.DATABASE_HOST;
const DATABASE_USERNAME = process.env.DATABASE_USERNAME;
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;

if (!DATABASE_HOST || !DATABASE_USERNAME || !DATABASE_PASSWORD) {
  console.log("⚠️  Database credentials not set");
  console.log("Skipping migrations (likely local development)");
  process.exit(0);
}

// Check if this is a Vercel production deployment
const VERCEL_ENV = process.env.VERCEL_ENV;

if (VERCEL_ENV !== "production") {
  console.log(`📝 Environment: ${VERCEL_ENV || "unknown"} (not production)`);
  console.log("Skipping migrations for non-production deployment");
  process.exit(0);
}

// Run migrations
execSync("npx drizzle-kit migrate --config=./src/drizzle.config.ts", {
  cwd: dbConsolePath,
  stdio: "inherit",
  env: { ...process.env, DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD },
});
```

**Key aspects**:
- Environment-aware (only runs in production on Vercel)
- Validates required environment variables
- Checks for migration files existence
- Uses `execSync` with `stdio: "inherit"` for live output
- Provides helpful error messages

---

#### Pattern 3: GitHub Actions Manual Migration Workflow

**Location**: `.github/workflows/db-migrate.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "migrate" to confirm'
        required: true
        type: string

concurrency:
  group: db-migration
  cancel-in-progress: false

jobs:
  migrate:
    if: github.event.inputs.confirm == 'migrate'
    steps:
      - name: Show pending migrations
        run: |
          echo "Checking for pending migrations..."
          ls -la src/migrations/*.sql | tail -10
          cat src/migrations/meta/_journal.json | tail -30

      - name: Run migrations
        run: pnpm drizzle-kit migrate --config=./src/drizzle.config.ts
```

**Key aspects**:
- Manual trigger only (`workflow_dispatch`)
- Requires explicit confirmation
- Concurrency control (only one migration at a time)
- Shows pending migrations before applying
- Uses GitHub Secrets for database credentials
- 10-minute timeout

---

#### Pattern 4: Environment Variable Validation

**Location**: `db/console/env.ts`

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_HOST: z.string().min(1),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
```

**Key aspects**:
- Uses `@t3-oss/env-nextjs` for typed environment validation
- Zod schemas for each required variable
- Validates at module load time (fails fast)
- Type-safe exports

---

#### Pattern 5: Database Client Connection Validation

**Location**: `db/console/src/client.ts`

```typescript
export function createClient() {
  const connectionString = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:6432/postgres?sslmode=verify-full`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 20,              // Match PlanetScale default_pool_size
    prepare: false,       // Required for PgBouncer transaction mode
    idle_timeout: 20,     // Serverless: close idle connections after 20s
    connect_timeout: 10,  // Fail fast on connection issues
  });

  return drizzle(client, { schema });
}
```

**Key aspects**:
- Connection pooling configured for serverless
- `prepare: false` for PgBouncer compatibility
- Timeouts configured for fast failure
- SSL required for security

---

### Vercel Checks API Documentation

**Official Documentation**: [Vercel Checks API](https://vercel.com/docs/checks)

#### Checks Lifecycle

1. Vercel triggers `deployment.created` webhook → integrators register checks
2. Integrators use Checks API to create defined checks
3. Vercel triggers `deployment.ready` webhook → checks begin execution
4. Vercel waits for all checks to receive a `conclusion`
5. Once all checks pass, aliases apply and deployment goes live

#### Types of Checks

- **Blocking Checks**: Set `blocking: true` to prevent deployment promotion
- **Non-blocking Checks**: Return test results without blocking deployment

#### REST API Endpoints

**Create a Check**:
```
POST /v1/deployments/{deploymentId}/checks
```

**Update a Check**:
```
PATCH /v1/deployments/{deploymentId}/checks/{checkId}
```

**Get All Checks**:
```
GET /v1/deployments/{deploymentId}/checks
```

**Rerequest a Failed Check**:
```
POST /v1/deployments/{deploymentId}/checks/{checkId}/rerequest
```

#### Check Request Body

```json
{
  "blocking": true,
  "name": "Database Schema Validation",
  "path": "/",
  "detailsUrl": "https://...",
  "externalId": "...",
  "rerequestable": true,
  "status": "running",
  "conclusion": "succeeded",
  "output": {}
}
```

#### Available Conclusions

- `succeeded` (non-blocking)
- `failed` (blocks if `blocking: true`)
- `canceled` (blocks if `blocking: true`)
- `neutral` (non-blocking)
- `skipped` (non-blocking)

---

### Best Practices for Database Schema Validation

From research of external documentation:

#### 1. Automatic SQL Review Components

- **Syntax Validation**: Catching SQL errors and verifying database compatibility
- **Schema Rules**: Enforcing naming conventions, data types, and constraints
- **Performance Checks**: Identifying missing indexes or inefficient queries
- **Security Policies**: Preventing unsafe operations (e.g., `DROP TABLE` in production)
- **Backward Compatibility**: Ensuring changes won't break existing applications

#### 2. Three Conditions for Trustworthy Validation

- **Validation = Production**: State must represent what production will look like
- **One Path for Changes**: Changes only from inbound batch (no out-of-band changes)
- **Know Your State**: Schema version must be precisely knowable before applying changes

#### 3. Drizzle ORM Migration Patterns

- **Prefer Additive Changes First**: Additive DDL is nearly always online and low-risk
- **Safe Renames**: Rename in stages (add new, backfill, remove old)
- **Online Backfills**: Use step functions to backfill data without blocking
- **Concurrent Indexes**: Create indexes concurrently to avoid locking
- **Idempotency**: Ensure migrations can be re-run safely
- **Validation Checks**: Run checks before applying migrations
- **Rollout Playbooks**: Document rollback procedures
- **Testing**: Test migrations on production-like datasets

#### 4. Drizzle Check Command

`drizzle-kit check` validates migration files for consistency and integrity before deployment.

---

## Code References

### Deployment Configuration
- `apps/console/vercel.json:1-4` - Vercel deployment config with turbo-ignore
- `apps/console/microfrontends.json` - Single-domain routing for 4 apps
- `turbo.json:1-50` - Global Turborepo config with Vercel env vars

### Database Schema
- `db/console/src/schema/index.ts` - Main schema export (19 tables)
- `db/console/src/schema/relations.ts` - Table relationships
- `db/console/src/migrations/meta/_journal.json` - Migration tracking (28 migrations)
- `db/console/src/drizzle.config.ts` - Drizzle ORM configuration

### Validation Scripts
- `db/console/scripts/verify-tables.ts` - Post-migration table verification
- `db/console/scripts/apply-jobs-migration.ts` - Manual migration application
- `db/console/scripts/mark-migration-applied.ts` - Migration tracking sync

### Environment Validation
- `db/console/env.ts` - Database credential validation with Zod
- `db/console/src/client.ts` - Database client with connection pooling

### CI/CD
- `.github/workflows/db-migrate.yml` - Manual production migration workflow
- `.github/workflows/ci.yml` - Main CI pipeline

### Vercel Integration
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Webhook endpoint
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts` - OAuth callback

---

## Architecture Documentation

### Current Deployment Flow

1. **Code Push** → GitHub main branch
2. **Vercel Build Trigger** → `vercel.json` with `turbo-ignore` check
3. **Build Phase** → Turborepo builds apps in parallel
4. **Pre-Build Migration** (Production only):
   - Check `VERCEL_ENV === "production"`
   - Validate database credentials exist
   - Check for migration files in `db/console/src/migrations/`
   - Run `drizzle-kit migrate`
5. **Deployment** → Vercel deploys if build succeeds
6. **Aliasing** → Production domains assigned

### Schema Management Pattern

The codebase uses **automated migrations in production** rather than blocking checks:

1. **Development**: Developers run `pnpm db:generate` to create migrations from schema changes
2. **Commit**: Migration files checked into git (`src/migrations/*.sql`)
3. **CI**: Builds validate TypeScript compiles
4. **Deployment**: Pre-build script applies migrations automatically
5. **Fallback**: Manual GitHub Actions workflow for emergency migrations

**Migration Safety**:
- Drizzle generates idempotent SQL (`CREATE TABLE IF NOT EXISTS`)
- PlanetScale connection with 10s timeout (fail fast)
- Migration journal tracks applied migrations (`_journal.json`)
- All migrations auto-generated (NEVER manual `.sql` files per `db/CLAUDE.md`)

---

## Historical Context (from thoughts/)

### Relevant Research Documents

**Vercel & Deployment**:
- `thoughts/shared/research/2026-01-31-next-js-vercel-optimization-apps-www.md` - Next.js 15/16 Vercel optimization
- `thoughts/shared/research/2026-01-31-hydration-mismatch-navigation-gridsection.md` - Hydration issues during deployment

**Database & Schema**:
- `thoughts/shared/research/2025-12-15-postgresql-optimization-security-planetscale.md` - PostgreSQL optimization and PlanetScale patterns
- `thoughts/shared/research/2025-12-16-jsonb-versioning-analysis.md` - JSONB field inventory and versioning
- `thoughts/shared/research/2025-12-10-planetscale-integration-research.md` - PlanetScale integration patterns

**Validation & Type Safety**:
- `thoughts/shared/research/2025-12-24-zod-v4-migration-breaking-changes.md` - Zod v4 schema validation changes
- `thoughts/shared/research/2026-01-31-web-analysis-t3-env-vite-setup.md` - T3 env validation setup

**Production Validation**:
- `thoughts/shared/research/2026-02-07-knock-prod-validation-architecture-design.md` - Production validation architecture
- `thoughts/shared/research/2026-02-07-knock-prod-validation-external-research.md` - Production deployment requirements

### Relevant Implementation Plans

- `thoughts/shared/plans/2025-12-16-jsonb-versioning-infrastructure.md` - JSONB versioning with migration patterns
- `thoughts/shared/plans/2025-12-17-changelog-publishedAt-complete-migration.md` - Field migration example

---

## Implementation Recommendations

### Option 1: Enhanced Pre-Build Validation (Recommended)

Enhance the existing `pre-build-migrate.mjs` script:

```javascript
// Before running migrations, validate:
1. Run `drizzle-kit check` to validate migration syntax
2. Verify migration journal is consistent
3. Check no pending schema changes (dev forgot to run db:generate)
4. Apply migrations
5. Run post-migration verification (verify-tables.ts)
```

**Pros**:
- Leverages existing patterns
- Fails fast during build (before deployment)
- No additional Vercel integration needed
- Aligns with current "apply migrations automatically" philosophy

**Cons**:
- Build failures less visible than deployment checks
- No rerequestable UI for failed checks

---

### Option 2: Vercel Checks API Integration

Create webhook handler for `deployment.created` event:

```typescript
// apps/console/src/app/(vercel)/api/vercel/deployment-checks/route.ts

export async function POST(request: Request) {
  const event = await request.json();

  if (event.type === "deployment.created") {
    // Create blocking check
    await createCheck(event.deployment.id, {
      name: "Database Schema Validation",
      blocking: true,
      status: "running",
    });

    // Trigger Inngest workflow to validate schema
    await inngest.send({
      name: "apps-console/deployment.validate-schema",
      data: { deploymentId: event.deployment.id }
    });
  }
}
```

**Pros**:
- Visible check in Vercel UI
- Rerequestable if fails
- Can validate against actual database before promotion

**Cons**:
- More complex (webhook + Inngest workflow)
- Requires OAuth2 token management
- Adds latency to deployment

---

### Option 3: GitHub Actions + Deployment Checks

Enable Vercel for GitHub and require action:

```yaml
# .github/workflows/validate-schema.yml
name: Validate Database Schema

on:
  push:
    branches: [main]
    paths:
      - 'db/console/src/schema/**'
      - 'db/console/src/migrations/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate migrations
        run: |
          cd db/console
          pnpm drizzle-kit check

      - name: Report to Vercel
        uses: vercel/repository-dispatch/actions/status@v1
        with:
          status: success
```

**Pros**:
- Native GitHub integration
- Visible in PR checks
- Can run on PR before merge

**Cons**:
- Only works with Vercel for GitHub integration
- Limited to GitHub Actions capabilities

---

## Recommended Approach

**Start with Option 1** (Enhanced Pre-Build Validation):

1. **Add pre-migration validation**:
   ```bash
   pnpm drizzle-kit check  # Validate syntax
   pnpm verify-journal     # Check journal consistency
   ```

2. **Add post-migration verification**:
   ```bash
   pnpm verify-tables      # Verify tables exist with indexes
   ```

3. **Improve error messages**:
   - Show which migration failed
   - Link to migration file in GitHub
   - Provide rollback instructions

**Then evolve to Option 2** if needed:
- Only add Vercel Checks API integration if you need:
  - Rerequestable checks in Vercel UI
  - Validation against live database before promotion
  - Blocking on post-deployment health checks

---

## Open Questions

1. **PlanetScale branch validation**: Should we validate migrations against a PlanetScale branch before production?
2. **Rollback automation**: What's the rollback strategy if a migration succeeds but breaks the app?
3. **Migration dry-run**: Should we add a dry-run mode to preview migration changes?
4. **Health checks post-deployment**: Should we add post-deployment API health checks using Vercel Checks?
5. **Schema drift detection**: How do we detect if someone makes manual schema changes outside of migrations?

---

## External Resources

### Vercel Documentation
- [Vercel Checks API](https://vercel.com/docs/checks) - Complete Checks API documentation
- [Creates a new Check - REST API](https://vercel.com/docs/rest-api/reference/endpoints/checks/creates-a-new-check) - API endpoint details
- [Deployment Integration Actions](https://vercel.com/docs/integrations/create-integration/deployment-integration-action) - Advanced integrations

### Drizzle Resources
- [Drizzle Migrations Overview](https://orm.drizzle.team/docs/migrations) - Migration fundamentals
- [Drizzle Check Command](https://orm.drizzle.team/docs/drizzle-kit-check) - Built-in validation
- [Migrations for Teams](https://orm.drizzle.team/docs/kit-migrations-for-teams) - Team workflows

### Best Practices
- [CI/CD Pipeline for Database Schema Migration](https://www.bytebase.com/blog/how-to-build-cicd-pipeline-for-database-schema-migration/) - Best practices
- [Trustworthy Database Environments](https://www.liquibase.com/blog/trustworthy-database-environments) - Validation requirements
- [8 Drizzle ORM Patterns](https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8) - Production patterns
