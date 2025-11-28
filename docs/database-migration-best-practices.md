# Database Migration Best Practices - Industry Standards

This document summarizes industry best practices from leading companies and experts (Martin Fowler, Prisma, Vercel, LaunchDarkly, and others) for database migrations in production.

## TL;DR - What We Implement

✅ **Our current approach matches industry standards:**
- Run migrations in build step (Vercel best practice)
- Use Drizzle's `generate` + `migrate` workflow
- Migrations are version-controlled
- Production-only execution

⚠️ **What we MUST do (developer responsibility):**
- Write backward-compatible migrations
- Use expand-contract pattern for breaking changes
- Test migrations locally first

## Industry Consensus: Three Core Patterns

### 1. **Expand-Contract Pattern** (Martin Fowler / Prisma)

**The gold standard for zero-downtime migrations.**

#### The Three Phases

**Phase 1: EXPAND**
- Add new schema alongside old schema
- New columns should be nullable or have defaults
- Old code continues working, ignores new fields

**Phase 2: MIGRATE**
- Deploy code that writes to BOTH old and new schemas
- Backfill historical data
- Gradually shift reads from old to new
- Monitor and validate

**Phase 3: CONTRACT**
- Stop writing to old schema
- Remove old code references
- Drop old columns/tables

#### Seven-Step Process (Prisma's Detailed Guide)

1. **Deploy new schema** (new columns nullable or with defaults)
2. **Expand interface** (dual writes to old + new)
3. **Migrate existing data** (backfill new columns)
4. **Test new interface** (parallel queries)
5. **Cut reads over** (read from new, still dual write)
6. **Discontinue old writes** (write only to new)
7. **Remove old structure** (drop old columns)

#### Example: Renaming a Column

```sql
-- ❌ WRONG: Direct rename (breaks old code)
ALTER TABLE users RENAME COLUMN name TO full_name;

-- ✅ RIGHT: Expand-Contract
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Step 2: Backfill data
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Deploy code that writes to both columns...
-- Wait for all instances to update...

-- Step 3: Make new column non-nullable
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Deploy code that only uses full_name...
-- Wait for all instances to update...

-- Step 4: Drop old column
ALTER TABLE users DROP COLUMN name;
```

### 2. **Build-Time Migrations** (Vercel / Railway Best Practice)

**Run migrations as part of your build command.**

```json
// package.json
{
  "scripts": {
    "vercel-build": "npm run db:migrate && next build"
  }
}
```

**Why this works:**
- ✅ Guaranteed order: DB updated before code deployed
- ✅ Automated: No manual steps
- ✅ Atomic: Build fails if migration fails
- ✅ Audit trail: Migration logs in deployment logs

**Vercel's official recommendation:**
> "The best practice for Vercel Postgres is to run migrations as part of your build command. Every successful deployment corresponds to a fully migrated database."

### 3. **Version-Controlled Migrations** (Drizzle / Prisma / Industry Standard)

**Generate SQL files from schema changes.**

```bash
# 1. Edit schema
vim db/schema/users.ts

# 2. Generate migration SQL
pnpm db:generate
# Creates: migrations/0001_add_email.sql

# 3. Review generated SQL
cat migrations/0001_add_email.sql

# 4. Commit to git
git add migrations/
git commit -m "add email column"

# 5. Deploy (migrations run automatically)
git push
```

**Benefits:**
- ✅ Reviewable in PRs
- ✅ Rollback-friendly (git revert)
- ✅ Audit trail (git history)
- ✅ Team collaboration (shared migration history)

## What Industry Leaders Say

### Martin Fowler (ThoughtWorks)

> "Most database refactorings follow the parallel change pattern, where the migrate phase is the transition period between the original and the new schema."

**Key principle:** Never make breaking changes directly. Always use parallel change (expand-contract).

### LaunchDarkly

> "Split feature deployment into multiple phases and deploy them one by one, waiting for each phase to deploy completely before moving to the next one."

**Three best practices:**
1. Make schema changes backward compatible
2. Deploy schema changes before code changes
3. Use feature flags to control rollout

### Vercel

> "For a seamless user experience, aim for non-breaking schema changes (like adding a new column) or use an incremental migration strategy."

**Recommendation:** Run migrations in build step, use environment variables per deployment.

### Drizzle ORM Team

> "Never modify history manually - always use Drizzle's built-in migration tools. Do not delete migrations if they are already used in production."

**Best practices:**
- Keep migrations atomic
- Use timestamps in filenames
- Never edit applied migrations
- Commit migrations to version control

## Common Patterns by Change Type

### Adding a Column

```typescript
// ✅ SAFE: Nullable or with default
export const users = pgTable("users", {
  email: text("email"),                    // Nullable
  createdAt: timestamp("created_at").defaultNow(), // Has default
});
```

### Making Column Required

```typescript
// Phase 1: Add optional
export const users = pgTable("users", {
  email: text("email"),
});
// Deploy, backfill data, wait...

// Phase 2: Make required (separate PR, weeks later)
export const users = pgTable("users", {
  email: text("email").notNull(),
});
```

### Removing a Column

```typescript
// Phase 1: Stop using in code
// Deploy code that doesn't reference old column
// Wait for all instances...

// Phase 2: Drop column (separate PR)
export const users = pgTable("users", {
  // Removed: oldColumn
});
```

### Renaming a Table

```typescript
// Phase 1: Create new table, dual write
export const newUsers = pgTable("new_users", { ... });
// Code writes to both tables

// Phase 2: Migrate data
// Backfill new_users from users

// Phase 3: Switch reads
// Code reads from new_users

// Phase 4: Drop old table
// DROP TABLE users;
```

## Anti-Patterns (What NOT to Do)

### ❌ Don't: Synchronous Deployments

```bash
# BAD: Deploy code and migrations together
git push
# Code and DB out of sync during deployment
```

### ❌ Don't: Manual Migration Steps

```bash
# BAD: Require manual migration after deploy
ssh production
npm run migrate
```

### ❌ Don't: Breaking Changes Without Transition

```sql
-- BAD: Immediate breaking change
ALTER TABLE users DROP COLUMN legacy_field;
-- Breaks running code instantly!
```

### ❌ Don't: Edit Applied Migrations

```bash
# BAD: Modify migration after it's run in production
vim migrations/0001_initial.sql
# Breaks migration history and team workflows
```

## Our Implementation vs Industry Standards

| Practice | Industry Standard | Our Implementation | Status |
|----------|------------------|-------------------|--------|
| **Run migrations in build** | ✅ Recommended (Vercel) | ✅ Pre-build script | ✅ Good |
| **Version-controlled migrations** | ✅ Required (Drizzle) | ✅ Git-tracked | ✅ Good |
| **Atomic migrations** | ✅ Critical | ✅ Drizzle handles | ✅ Good |
| **Production-only execution** | ✅ Best practice | ✅ VERCEL_ENV check | ✅ Good |
| **Expand-contract pattern** | ✅ Required for zero-downtime | ⚠️ Developer responsibility | ⚠️ **Document** |
| **Backward-compatible changes** | ✅ Critical | ⚠️ Developer responsibility | ⚠️ **Document** |
| **Dual-write transition** | ✅ For breaking changes | ⚠️ Developer responsibility | ⚠️ **Document** |

## Recommended Workflow

### For Simple Changes (Add Column)

```bash
# 1. Add optional column in schema
export const users = pgTable("users", {
  email: text("email"),  // Nullable
});

# 2. Generate migration
pnpm db:generate

# 3. Test locally
pnpm db:migrate

# 4. Commit and push
git add .
git commit -m "add email column"
git push

# 5. Vercel automatically:
#    - Runs migration
#    - Builds app
#    - Deploys
```

### For Breaking Changes (Rename Column)

```bash
# PR 1: Add new column
export const users = pgTable("users", {
  name: text("name"),           // Keep old
  full_name: text("full_name"), // Add new
});
# Deploy → both columns exist

# PR 2: Update code to use both
// Code writes to both name and full_name
// Deploy → dual writes

# PR 3: Switch reads
// Code reads from full_name
// Deploy → reads switched

# PR 4: Remove old column
export const users = pgTable("users", {
  full_name: text("full_name"), // Only new
});
# Deploy → old column dropped
```

## Key Takeaways

1. **Always use backward-compatible migrations** - Old code must work with new schema
2. **Run migrations in build step** - Guarantees correct order
3. **Use expand-contract for breaking changes** - Split into multiple deployments
4. **Version control everything** - Migrations are code, treat them as such
5. **Test locally first** - Never test migrations in production
6. **One migration per deployment** - Easier to debug and rollback
7. **Never edit applied migrations** - History is immutable

## Resources

- [Martin Fowler: Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- [Prisma: Expand-Contract Pattern](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern)
- [LaunchDarkly: Zero-Downtime Migrations](https://launchdarkly.com/blog/3-best-practices-for-zero-downtime-database-migrations/)
- [Vercel: Migration Best Practices](https://www.hrekov.com/blog/vercel-migrations)
- [Drizzle: Migration Best Practices](https://app.studyraid.com/en/read/11288/352164/migration-best-practices)

## Conclusion

**Our implementation is solid** - we run migrations in the build step, use version control, and execute only in production.

**The critical piece is developer education** - writing backward-compatible migrations and using expand-contract for breaking changes. This is standard industry practice and cannot be automated away.

The documentation we've created aligns perfectly with industry best practices! 🎯
