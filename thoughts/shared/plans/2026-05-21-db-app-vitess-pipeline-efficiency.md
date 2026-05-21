# `@db/app` PlanetScale Pipeline & Schema Efficiency Plan

## Overview

The Postgres → PlanetScale MySQL migration (the `2026-05-08` plan) is complete: `@db/app`
runs the single `drizzle-orm/planetscale-serverless` driver, `@vendor/db` is MySQL-only, and
the schema is one live table (`lightfast_org_source_control_bindings`) already deployed to the
PlanetScale `main` branch. The stack is on the latest stable versions (drizzle-orm `0.45.2`,
drizzle-kit `0.31.10`, `@planetscale/database` `1.20.1`).

This plan makes two targeted upgrades, in priority order:

1. **Migration & deploy pipeline** — fix a confirmed defect where the CI migration flow
   cannot survive PlanetScale branch semantics, and rebuild it on a persistent-branch model.
2. **Schema design correctness** — timestamp precision, `ON UPDATE` safety, and principled
   column sizing, shipped as an incremental `0001` migration (no history reset).

It explicitly does **not** touch the ORM version, runtime query caching, sharding, or
read-replica routing — read replicas and sharding readiness are deferred to a future plan
(see Improvement Log).

## Current State Analysis

### What exists

- **Driver / client** — `db/app/src/client.ts:5-12` builds `db` via `createDatabase()` from
  `@vendor/db` (`vendor/db/src/planetscale.ts:35-40`). Single HTTP driver, same path in dev
  and prod.
- **Schema** — one table, `db/app/src/schema/tables/org-source-control-bindings.ts:46-168`.
  `bigint` autoincrement PK, eight `varchar` columns, four `timestamp` columns, one `json`,
  four indexes. No foreign keys. Repository helpers in `db/app/src/utils/org-binding.ts`.
- **Migrations** — exactly one, `db/app/src/migrations/0000_pretty_justin_hammer.sql`, with
  `meta/_journal.json` (entry `0000_pretty_justin_hammer`, `when: 1779344894261`). **Already
  merged to the PlanetScale `main` branch** (user-confirmed).
- **Runtime migrator** — `db/app/src/migrate.ts` (committed in `af42b630a`): calls `migrate()`
  from `drizzle-orm/planetscale-serverless/migrator` over the HTTP driver.
- **CI workflow** — `.github/workflows/db-migrate.yml`: `workflow_dispatch`, creates an
  ephemeral `db-<run-id>` branch from `main`, runs migrations via `pnpm db:migrate`, opens +
  deploys a deploy request, deletes the branch password.
- **Local dev** — per-worktree `wt-<hash>` PlanetScale branches via `scripts/pscale-dev.mjs`
  + `scripts/dev-services.mjs pscale` subcommand; credentials cached under `.lightfast/`.
- **Baseline for this plan** — all of the above is already **committed** on the current
  branch (`feat/pscale-mysql`, tip `af42b630a`): `migrate.ts`, `db:migrate` =
  `with-env tsx ./src/migrate.ts`, `db-migrate.yml` running `pnpm db:migrate`, the
  `lightfast-db` skill rewritten for MySQL, and the `mysql`/`vitess`/`planetscale-drizzle`
  skills vendored. This plan modifies that committed baseline — there is no uncommitted
  in-progress work to fold in.

### The confirmed pipeline defect

`drizzle-orm`'s MySQL migrator (`drizzle-orm/mysql-core/dialect.js:29-56`) decides what to
apply purely from rows in the `__drizzle_migrations` **data** table: it reads the latest row
and applies every migration whose `folderMillis` is greater. An empty table → it replays
**all** migrations, starting with `0000`.

A PlanetScale deploy request merges **schema, not data**. When `0000` merged to `main`, the
`__drizzle_migrations` *table* was created on `main` but its *rows* never transferred —
**`main`'s `__drizzle_migrations` is empty**. Every CI branch created `from main` therefore
inherits an empty journal *and* the already-existing `lightfast_org_source_control_bindings`
table. On the next run `migrate()` sees an empty journal, replays `0000`
(`CREATE TABLE` — no `IF NOT EXISTS`), and **fails: table already exists**.

It worked exactly once, because `main` was empty that time. The currently committed
`migrate.ts` and `db-migrate.yml → pnpm db:migrate` do not address this — and the
`pnpm db:migrate` change additionally breaks CI a second way (see below).

### Secondary defects found

- **`pnpm db:migrate` is unrunnable in CI.** `db:migrate` resolves to
  `pnpm with-env tsx ./src/migrate.ts`; `with-env` → `scripts/with-dev-services-env.mjs` →
  `resolveDevPscaleConfig()`, which **throws** when the `.lightfast/` credential cache is
  absent (`scripts/pscale-dev.mjs:40-45`). `localServiceResolverEnv()`
  (`with-dev-services-env.mjs:87-100`) strips the `DATABASE_*` vars CI sets via `$GITHUB_ENV`
  before resolving. The committed `db-migrate.yml` `run: pnpm db:migrate` cannot succeed.
- **`db:generate` needs a provisioned branch it never uses.** `db:generate` is
  `with-env`-wrapped, and `drizzle.config.ts` → `createDrizzleConfig` throws via
  `requiredCredential` (`vendor/db/src/utils/create-drizzle-config.ts:43-48`) when
  `DATABASE_HOST` is empty — even though `drizzle-kit generate` never connects to a database.
- **Footgun scripts.** `db:push` (`drizzle-kit push`) and `db:introspect` exist in
  `db/app/package.json:34,38`. `introspect` is meaningless for an owned schema; `push` needs
  a clear, scoped role.
- **Schema correctness gaps** — `varchar(191)` is the legacy MySQL 5.6 utf8mb4 index-prefix
  cap, arbitrary on Vitess/MySQL 8; the four `timestamp` columns have no fractional-second
  precision (`fsp`) despite `mode: "string"` storing millisecond ISO strings; `updated_at`
  is purely app-maintained with no `ON UPDATE` safety net.

### Key Discoveries

- drizzle MySQL `migrate()` skip logic compares only `created_at`
  (`drizzle-orm/mysql-core/dialect.js:43-52`): a journal seeded with a row whose `created_at`
  equals `0000`'s `when` (`1779344894261`) makes `migrate()` skip `0000` and apply `0001+`.
- PlanetScale branches are schema-only copies and deploy requests merge schema-only — so
  `__drizzle_migrations` *rows* never propagate. A file-based runtime migrator only works
  against a branch whose journal is **never reset**.
- `drizzle-kit generate` does not open a DB connection — it diffs schema source against
  `meta/*_snapshot.json`. It can run fully offline given `dialect`/`schema`/`out`.
- The stack is already on the latest stable releases; the only newer drizzle-orm is
  `1.0.0-rc.4` (a pre-release), explicitly out of scope.

## Desired End State

After this plan:

1. **A persistent `staging` PlanetScale branch** holds an authoritative, never-reset
   `__drizzle_migrations` journal. CI runs `migrate()` against `staging`, then opens and
   deploys a `staging → main` deploy request. `migrate()` never runs against `main`; CI never
   creates ephemeral migration branches.
2. **Local dev applies schema via `drizzle-kit push`** to the ephemeral per-worktree
   `wt-<hash>` branch — diff-based, branch-safe, no journal bookkeeping.
3. `pnpm --filter @db/app db:generate` runs with **no provisioned branch** and is covered by
   a CI drift check that fails when schema source changes without a regenerated migration.
4. The schema carries **millisecond timestamp precision**, an `ON UPDATE` safety net on
   `updated_at`, and **principled, named column lengths** — shipped as an incremental
   `0001_*.sql` (migration history intact, `0000` untouched).
5. `pnpm typecheck` and `pnpm check` pass across the monorepo.

### Verification

- `pscale branch list lightfast` shows a long-lived `staging` branch alongside `main`.
- `pscale shell lightfast staging --execute "SELECT COUNT(*) FROM __drizzle_migrations"`
  returns a stable, monotonically growing count across deploys (never reset to 0).
- A second `db-migrate.yml` run after the first **succeeds** — the defect's reproduction.
- `pnpm --filter @db/app db:generate` on a clean tree, with no `.lightfast/` cache, produces
  no diff.
- After Phase 2, `SHOW CREATE TABLE lightfast_org_source_control_bindings` on `main` shows
  `timestamp(3)`, `ON UPDATE CURRENT_TIMESTAMP(3)` on `updated_at`, and the new varchar
  lengths.

## What We're NOT Doing

- **Not resetting migration history.** `0000_pretty_justin_hammer.sql` and its snapshot stay;
  schema changes ship as an incremental `0001`.
- **Not wiring the Upstash query cache** (`$cache` / `cache/upstash`) — runtime query
  efficiency was descoped.
- **Not adopting drizzle-orm `1.0.0-rc.x`** — staying on stable `0.45.2`.
- **Not sharding the keyspace, and not wiring read replicas.** Both are deferred to a future
  plan — there is no replica to test against and no current scale pressure (see Improvement
  Log).
- **Not migrating data.** The binding table is treated as effectively empty (pre-launch).
- **Not adding `mysql2`** anywhere — it would route drizzle-kit migrations over TCP and
  break PlanetScale. Load-bearing omission.
- **Not changing the env shape** — the split `DATABASE_HOST/USERNAME/PASSWORD/NAME` stays and
  no new env vars are added.
- **Not converting `varchar` columns to MySQL `ENUM`** — the repo's `varchar(...).$type<>()`
  pattern is retained (provider widens to GitLab/Bitbucket without DDL).
- **Not auto-triggering `db-migrate.yml` on push** — it stays a guarded `workflow_dispatch`.

## Implementation Approach

**Three-tier branch model.** `main` (production, deploy-requests only) ← `staging`
(persistent integration branch, the one place `migrate()` runs) ← `wt-<hash>` (ephemeral
per-worktree dev branches, `push`-applied). The file-based runtime migrator is correct *only*
against a branch whose journal is never reset — so it is confined to the single persistent
`staging` branch. Local dev, which constantly recreates `wt-<hash>` branches, uses the
diff-based `drizzle-kit push` that needs no journal.

**Pipeline before schema.** Phase 1 must land first so the Phase 2 `0001` migration flows
through a working pipeline. Phase 2's `0001` then doubles as the first real exercise of the
rebuilt pipeline.

**Incremental, prod-safe schema change.** The binding table is live on `main`. `0001` is a
set of `ALTER TABLE ... MODIFY COLUMN` statements applied via PlanetScale's online-DDL deploy
request. The only data-risk is shrinking `varchar` columns; Phase 2 gates that on a
`MAX(LENGTH())` pre-check against `main`.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient —
the next phase starts only on user go-ahead.

---

## Phase 1: Migration & deploy pipeline (persistent-branch model)

### Overview

Rebuild the schema-deploy pipeline around a persistent `staging` branch, fix both CI defects,
scope `push` to local dev, make `db:generate` branch-free, and add drift detection.

### Changes Required

#### 1.1 Bootstrap the persistent `staging` branch (one-time, operational)

Not scripted into a phase artifact — a one-time operator step, documented in `db/CLAUDE.md`
(see 1.8). Run once, by a developer with `pscale` auth:

1. `pscale branch create lightfast staging --from main --wait` — `staging` now mirrors
   `main`'s schema (the binding table + an empty `__drizzle_migrations`).
2. Mint a temporary password: `pscale password create lightfast staging bootstrap -f json`.
3. Seed the journal with the new `db:baseline` helper (1.6):
   `DATABASE_HOST=… DATABASE_USERNAME=… DATABASE_PASSWORD=… pnpm --filter @db/app db:baseline`.
   It ensures `__drizzle_migrations` exists and inserts the `0000` row (`created_at =
   1779344894261`, `hash =` sha256 of `0000_pretty_justin_hammer.sql`).
4. `pscale password delete lightfast staging <id> --force`.

After this, `staging`'s journal is authoritative and is never reset again. If `staging` ever
has to be rebuilt, repeat steps 1–4 but run
`pnpm --filter @db/app db:baseline -- --through=<last-deployed-tag>` in step 3 (note the `=`
in `--through=`, and the `--` so pnpm forwards the flag to the script).

#### 1.2 Add `db:baseline` — `db/app/src/baseline.ts`

**File**: `db/app/src/baseline.ts` (new)
**Changes**: a small script that seeds `__drizzle_migrations` so `migrate()` treats
already-deployed migrations as applied. Reuses `@vendor/db` for the connection and the same
hashing as `drizzle-orm`'s `readMigrationFiles` (`sha256` of each `.sql` file).

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createDatabase } from "@vendor/db";
import { sql } from "@vendor/db";
import { env } from "./env";

const MIGRATIONS_DIR = "./src/migrations";
const through = process.argv.find((a) => a.startsWith("--through="))?.split("=")[1];

const db = createDatabase({
  host: env.DATABASE_HOST,
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
});

const journal = JSON.parse(
  readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, "utf8"),
) as { entries: { tag: string; when: number }[] };

const entries = through
  ? journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === through) + 1)
  : journal.entries;

await db.execute(sql`
  create table if not exists \`__drizzle_migrations\` (
    id serial primary key, hash text not null, created_at bigint
  )
`);

for (const entry of entries) {
  const file = readFileSync(`${MIGRATIONS_DIR}/${entry.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(file).digest("hex");
  // Idempotent: skip if a row with this created_at already exists.
  const existing = await db.execute(
    sql`select 1 from \`__drizzle_migrations\` where created_at = ${entry.when} limit 1`,
  );
  if (existing.rows.length === 0) {
    await db.execute(
      sql`insert into \`__drizzle_migrations\` (\`hash\`, \`created_at\`)
          values (${hash}, ${entry.when})`,
    );
  }
}

console.log(`Baseline complete: ${entries.length} migration(s) marked applied.`);
```

**Spike-verified (see Improvement Log).** drizzle's `migrate()` skip condition is
`Number(latest.created_at) < folderMillis` — strict `<`, `folderMillis` = the journal `when`,
only the single latest row (`order by created_at desc limit 1`) is consulted, and `hash` is
never read for the skip. So `created_at` **must** be seeded exactly equal to `when`
(`when − 1` would replay `0000`); the real sha256 is written only for auditability since the
column is `NOT NULL`. The `__drizzle_migrations` DDL above (`id serial primary key, hash text
not null, created_at bigint`) matches the shape drizzle's own `create table if not exists`
expects.

Register in `db/app/package.json`: `"db:baseline": "tsx ./src/baseline.ts"` (raw — caller
supplies `DATABASE_*`, same convention as `db:migrate` after 1.4).

#### 1.3 Rewrite `.github/workflows/db-migrate.yml`

**File**: `.github/workflows/db-migrate.yml`
**Changes**:

- Drop the `branch` `workflow_dispatch` input and the "Resolve PlanetScale branch" step —
  the target is always `staging`. Set `PSCALE_BRANCH_NAME: staging` in the job `env`.
- Replace "Create or reuse PlanetScale branch" with an **assertion** step: `pscale branch
  show lightfast staging` — if absent, fail with `"staging branch missing — run the one-time
  bootstrap (db/CLAUDE.md)"`. CI never creates `staging`.
- "Run migrations on branch": `working-directory: db/app`, `run: pnpm db:migrate`. After 1.4
  `db:migrate` is raw `tsx ./src/migrate.ts` with **no** `with-env` wrapper, so CI's
  `DATABASE_*` from `$GITHUB_ENV` is consumed directly by `migrate.ts` → `./env`. (Depends on
  1.4, same phase.)
- **A no-op `migrate()` is not a failure.** When `migrate()` applies nothing (the Phase 1
  verification run, or any re-run with no pending migration), `staging` and `main` are
  schema-identical and there is nothing to deploy. The "Open deploy request" step must treat
  "no schema changes" as a clean skip (guard on the command output/exit), not a job failure
  — the schema-lint and deploy steps then skip too.
- After "Open deploy request", add a **schema-lint gate**: `pscale deploy-request show
  lightfast staging -f json` — inspect the lint/deployability fields; if lint errors are
  reported, fail the job printing them before any deploy. (Confirm exact JSON field names
  against `pscale deploy-request show --help` during execution.)
- "Deploy schema changes": `pscale deploy-request deploy lightfast staging --wait` (unchanged
  shape).
- Keep "Create branch password" / "Delete branch password (`if: always()`)" for `staging`.
- **Remove** any branch-delete step — `staging` is persistent.
- Keep `concurrency: { group: db-migration, cancel-in-progress: false }`.

#### 1.4 Split local vs CI apply paths — `db/app/package.json`

**File**: `db/app/package.json` (`scripts`)
**Changes**:

```jsonc
{
  "db:push":     "pnpm with-env drizzle-kit push --config=./src/drizzle.config.ts",
  "db:generate": "SKIP_ENV_VALIDATION=1 drizzle-kit generate --config=./src/drizzle.config.ts",
  "db:migrate":  "tsx ./src/migrate.ts",
  "db:baseline": "tsx ./src/baseline.ts",
  "db:studio":   "pnpm with-env drizzle-kit studio --config=./src/drizzle.config.ts"
  // remove: "db:introspect"
}
```

- `db:migrate` / `db:baseline` — raw, no `with-env`; the caller (CI, or an operator) supplies
  `DATABASE_*`. These target `staging`, never a local worktree branch.
- `db:push` — keeps `with-env` (resolves the local `wt-<hash>` credentials). This is the
  **local** apply path.
- `db:generate` — drops `with-env` and runs offline with `SKIP_ENV_VALIDATION=1`. Needs the
  `createDrizzleConfig` change in 1.5.
- `db:introspect` — removed (meaningless for an owned schema).

#### 1.5 Make `createDrizzleConfig` credential-optional — `@vendor/db`

**File**: `vendor/db/src/utils/create-drizzle-config.ts`
**Changes**: `drizzle-kit generate` ignores `dbCredentials`. Stop throwing when credentials
are absent; omit `dbCredentials` entirely instead. `migrate`/`push`/`studio` still fail
clearly at connect time when creds are missing — which is correct, they need a branch.

```ts
export const createDrizzleConfig = (opts: {
  host?: string; username?: string; password?: string;
  database?: string; port?: number; schema: string; out: string;
}): Config => {
  const database =
    (opts.database?.trim() === "" ? undefined : opts.database) ?? "lightfast";
  const host = stripQuotes(opts.host);
  const username = stripQuotes(opts.username);
  const password = stripQuotes(opts.password);

  const hasCredentials = Boolean(host && username && password);

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    ...(hasCredentials
      ? {
          dbCredentials: {
            database,
            host: host!,
            password: password!,
            user: username!,
            ...(opts.port ? { port: opts.port } : {}),
          },
        }
      : {}),
    verbose: true,
    strict: true,
    tablesFilter: ["lightfast_*"],
  } satisfies Config;
};

function stripQuotes(value: string | undefined) {
  return value?.replace(/^["']|["']$/g, "");
}
```

`requiredCredential` is deleted. `db/app/src/drizzle.config.ts` is unchanged — it already
passes `env.DATABASE_*`, which are `undefined` under `SKIP_ENV_VALIDATION=1`.

#### 1.6 Harden `db/app/src/migrate.ts`

**File**: `db/app/src/migrate.ts`
**Changes**: keep it short; add a redacted target log and an explicit failure path.

```ts
import { createDatabase } from "@vendor/db";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";
import { env } from "./env";

const db = createDatabase({
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  username: env.DATABASE_USERNAME,
});

console.log(`Applying migrations against ${env.DATABASE_HOST} ...`);

try {
  await migrate(db, { migrationsFolder: "./src/migrations" });
  console.log("Drizzle migrations applied.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
```

#### 1.7 Update root `package.json` and `dev:setup`

**File**: `package.json` (root, `scripts`)
**Changes**:

- `dev:setup`: `node scripts/dev-services.mjs setup && pnpm db:push` (was `&& pnpm db:migrate`)
  — a fresh worktree branch is `push`-applied, not `migrate()`-applied.
- Add `db:push`: `pnpm --filter @db/app db:push`.
- Keep `db:migrate`: `pnpm --filter @db/app db:migrate` — now raw; documented as the
  CI/operator path against `staging`, requiring exported `DATABASE_*`.
- Add `db:baseline`: `pnpm --filter @db/app db:baseline`.

`scripts/dev-services.mjs` `handleSetup` (`:58`) is unchanged — it provisions the worktree
branch + Redis; the migrate→push swap is entirely in the root `dev:setup` chain.

#### 1.8 Protect `staging` from deletion — `scripts/pscale-dev.mjs`

**File**: `scripts/pscale-dev.mjs` — `deleteDevPscaleBranch` (`:84-88`)
**Changes**: extend the refusal guard so `db:down` (and worktree teardown) can never delete
`staging`.

```js
const PROTECTED_BRANCHES = new Set(["main", "staging"]);
// ...
if (identity.branchName === identity.baseBranch || PROTECTED_BRANCHES.has(identity.branchName)) {
  throw new Error(`Refusing to delete protected PlanetScale branch "${identity.branchName}".`);
}
```

#### 1.9 CI drift check — `.github/workflows/db-check.yml`

**File**: `.github/workflows/db-check.yml` (new)
**Changes**: a lightweight PR check that fails when schema source changed without a
regenerated migration. Self-contained so it needs no knowledge of the main CI workflow. Use
whatever `runs-on` label the other current workflows use (`ubuntu-latest` today — match it if
the Depot-runner migration has landed).

```yaml
name: DB Schema Drift
on:
  pull_request:
    paths: ["db/app/**"]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Regenerate migrations
        run: pnpm --filter @db/app db:generate
      - name: Assert no uncommitted migration drift
        run: |
          # `git diff` is blind to untracked files; a freshly generated 000N_*.sql /
          # snapshot would slip past it. `git add -N` marks new files intent-to-add so
          # the diff sees them — this is the primary drift case the check exists to catch.
          git add -N db/app/src/migrations
          git diff --exit-code db/app/src/migrations
```

#### 1.10 Documentation

**File**: `db/CLAUDE.md`
**Changes**: add a "Branch model & deploy pipeline" section — the three tiers (`main` /
`staging` / `wt-<hash>`), the one-time `staging` bootstrap (1.1), the rule that `migrate()`
only ever runs against `staging`, that local dev uses `db:push`, and how to rebuild
`staging` with `db:baseline -- --through=<tag>` if it is ever lost.

**File**: `.agents/skills/planetscale-drizzle/SKILL.md` — update the "Migrations" row of the
conventions table: `db:generate` (offline) → `db:push` to a worktree branch locally; CI runs
`db:migrate` against `staging` then a `staging → main` deploy request.

### Success Criteria

#### Automated Verification

- [ ] `cd db/app && SKIP_ENV_VALIDATION=1 pnpm db:generate` succeeds with no `.lightfast/`
      cache present and produces no diff on a clean tree.
- [ ] `pnpm --filter @vendor/db typecheck` and `pnpm --filter @db/app typecheck` pass.
- [ ] `pnpm check` passes for the changed workflow/script files.
- [ ] `grep -n "db:introspect" db/app/package.json` returns nothing.
- [ ] `actionlint .github/workflows/db-migrate.yml .github/workflows/db-check.yml` reports no
      errors (or YAML parses cleanly if `actionlint` is unavailable).
- [ ] `pscale shell lightfast staging --execute "SELECT COUNT(*) FROM __drizzle_migrations"`
      returns `1` after the 1.1 bootstrap.

#### Human Review

- [ ] In the PlanetScale dashboard, confirm a `staging` branch exists and lists the binding
      table → bootstrap succeeded.
- [ ] Trigger `db-migrate.yml` with `confirm=migrate` → observe it asserts `staging` exists,
      runs `db:migrate` (`tsx src/migrate.ts`) against `staging`, and `migrate()` **skips
      `0000`** (journal already seeded) with no "table already exists" error. With no schema
      change pending at end of Phase 1, the `staging → main` deploy request is an empty/no-op
      diff — that is expected here; the deploy-request + deploy path is exercised for real by
      Phase 2's `0001`.
- [ ] Re-run `db-migrate.yml` a **second time** → `migrate()` still skips `0000` cleanly (the
      defect's reproduction — the pre-fix pipeline failed here on the second run). — TODO:
      automate via a scheduled idempotency smoke run.

---

## Phase 2: Schema correctness pass (incremental `0001`)

### Overview

Apply timestamp precision, an `ON UPDATE` safety net, and principled column sizing to
`org-source-control-bindings.ts`, then generate and deploy `0001` through the Phase 1
pipeline. `0000` and its snapshot are untouched.

### Changes Required

#### 2.1 Pre-flight: column-length safety check (operational)

Before editing the schema, confirm no live `main` data exceeds the planned shrink targets.
Via `pscale shell lightfast main` or the `lightfast-db` skill:

```sql
SELECT
  MAX(LENGTH(clerk_org_id))           AS clerk_org_id,
  MAX(LENGTH(active_clerk_org_id))    AS active_clerk_org_id,
  MAX(LENGTH(connected_by_user_id))   AS connected_by_user_id,
  MAX(LENGTH(provider))               AS provider,
  MAX(LENGTH(provider_account_id))    AS provider_account_id,
  MAX(LENGTH(provider_account_login)) AS provider_account_login,
  MAX(LENGTH(provider_installation_id)) AS provider_installation_id,
  MAX(LENGTH(status))                 AS status
FROM lightfast_org_source_control_bindings;
```

Every result must be below its target length (2.2). If any is not, raise the target for that
column and re-confirm. (The table is pre-launch — expect all-`NULL` / zero.)

#### 2.2 Edit `db/app/src/schema/tables/org-source-control-bindings.ts`

**File**: `db/app/src/schema/tables/org-source-control-bindings.ts`
**Changes**:

Introduce named length constants at the top of the file so column sizes are intentional and
self-documenting rather than the cargo-culted `191`:

```ts
/** Clerk identifiers (org / user ids) — short, ASCII, prefix + 27-char base. */
const CLERK_ID_LENGTH = 64;
/** External provider-side identifiers — vary across GitHub / GitLab / Bitbucket. */
const PROVIDER_REF_LENGTH = 128;
/** Short controlled-vocabulary codes (provider name, lifecycle status). */
const CODE_LENGTH = 32;
```

Apply them and the timestamp changes:

- `clerk_org_id`, `active_clerk_org_id`, `connected_by_user_id` → `varchar(…, { length:
  CLERK_ID_LENGTH })`.
- `provider`, `status` → `varchar(…, { length: CODE_LENGTH })`.
- `provider_account_id`, `provider_account_login`, `provider_installation_id` →
  `varchar(…, { length: PROVIDER_REF_LENGTH })`.
- All four `timestamp` columns (`connected_at`, `revoked_at`, `created_at`, `updated_at`) →
  add `fsp: 3`, e.g. `timestamp("connected_at", { mode: "string", fsp: 3 })`.
- `CURRENT_TIMESTAMP` defaults → `CURRENT_TIMESTAMP(3)`:
  `.default(sql\`CURRENT_TIMESTAMP(3)\`)`.
- `updated_at` → add `.onUpdateNow()` (emits `ON UPDATE CURRENT_TIMESTAMP(3)`) as a
  DB-level safety net. The existing app-side `updatedAt: now` writes in
  `db/app/src/utils/org-binding.ts:155,168` stay — an explicit value still wins; `onUpdateNow`
  only covers writes that forget.

Final `updated_at`:

```ts
updatedAt: timestamp("updated_at", { mode: "string", fsp: 3 })
  .default(sql`CURRENT_TIMESTAMP(3)`)
  .onUpdateNow()
  .notNull(),
```

#### 2.3 Generate `0001`

**Action**: `cd db/app && SKIP_ENV_VALIDATION=1 pnpm db:generate`.

Produces `db/app/src/migrations/0001_<name>.sql` (a set of `ALTER TABLE … MODIFY COLUMN`
statements), updates `meta/_journal.json`, and writes `meta/0001_snapshot.json`. Do not
hand-edit — if the output is wrong, fix the schema source and regenerate.

#### 2.4 Apply `0001`

- **Local**: `pnpm db:up` (worktree branch) then `pnpm db:push` → applies the `0001` deltas
  to `wt-<hash>`; verify with `pnpm db:studio`.
- **Production**: merge the `0001` files, then run `db-migrate.yml` (`confirm=migrate`) →
  `migrate()` applies `0001` to `staging` → `staging → main` deploy request → deploy.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @db/app db:generate` produces exactly one new `0001_*.sql` + one
      `meta/0001_snapshot.json`; a re-run yields no further diff.
- [ ] `pnpm --filter @db/app typecheck` and `pnpm --filter @api/app typecheck` pass.
- [ ] `pnpm --filter @api/app test` passes (binding-helper tests in
      `api/app/src/__tests__/org-binding-helpers.test.ts`).
- [ ] After deploy, `pscale shell lightfast main --execute "SHOW CREATE TABLE
      lightfast_org_source_control_bindings"` shows `timestamp(3)` on all four timestamps,
      `ON UPDATE CURRENT_TIMESTAMP(3)` on `updated_at`, and the new varchar lengths.

#### Human Review

- [ ] Open `0001_*.sql` — confirm every statement is `ALTER TABLE … MODIFY COLUMN` (no
      `DROP` / `ADD` for the resized columns, which would signal a destructive diff). — TODO:
      automate via a generated-SQL assertion test.
- [ ] In the PlanetScale deploy-request UI, confirm the schema diff lints clean and the
      deploy completes via online DDL.
- [ ] Exercise the binding flow (org bind → revoke) against a `wt-<hash>` branch in
      `pnpm db:studio`; confirm `updated_at` advances with millisecond precision on update.

---

## Testing Strategy

### Unit / Type Tests

- `@vendor/db` typecheck — exercises the `createDrizzleConfig` credential-optional change.
- `@db/app` typecheck — exercises the resized schema and unchanged `Database` type.
- `@api/app` typecheck + `pnpm --filter @api/app test` — exercises every binding-helper
  consumer after the schema change.

### Integration Tests

- No new DB-touching tests. The drift check (1.9) is the new automated guard.
- The `db-migrate.yml` second-run success (Phase 1 human review) is the integration proof
  that the pipeline defect is fixed.

### End-to-End

- Phase 2 deploy-request flow (`staging → main`) is the end-to-end exercise of the rebuilt
  pipeline carrying a real `0001` migration.

## Performance Considerations

- The persistent-branch model adds no per-query cost — it changes only how schema reaches the
  database. Runtime query latency (the HTTP-driver round-trip tax) is unchanged and out of
  scope.
- `timestamp(3)` adds 2 bytes per timestamp column (8 bytes total/row across the four
  columns) for millisecond precision — negligible, and it makes timestamp ordering
  deterministic.

## Migration Notes

- **`0001` alters a live `main` table.** `timestamp` → `timestamp(3)` and the `ON UPDATE`
  addition are non-blocking online-DDL changes. `varchar` shrinks require a table copy
  (handled by PlanetScale online DDL); the only real risk is data truncation, gated by the
  2.1 `MAX(LENGTH())` pre-check.
- **`__drizzle_migrations` lives on `main` too**, as an inert empty bookkeeping table (a
  byproduct of deploy requests merging schema). It is never read on `main` and is harmless.
- **`staging` is a stateful singleton.** Its journal is authoritative and must never be
  reset. It is protected from `db:down` (1.8); if it is ever lost, rebuild via 1.1 +
  `db:baseline -- --through=<last-deployed-tag>`.
- **`staging` must stay ≥ `main`.** The model assumes `main` changes *only* via
  `staging → main` deploy requests. Any out-of-band change to `main` (a hotfix applied
  directly, a deploy-request revert on `main` not mirrored to `staging`) leaves `staging`
  behind, and the next `staging → main` deploy request would try to revert it. If `main` is
  ever changed outside this pipeline, re-create `staging` from `main` (1.1).
- **Rollback.** Phase 1 is reversible by reverting the workflow/script commits (the `staging`
  branch can stay — it is harmless if unused). Phase 2's `0001` is reverted via a PlanetScale
  deploy-request revert within the revert window, or a forward `0002`.

## References

- Confirmed defect: `drizzle-orm/mysql-core/dialect.js:29-56` (migrate skip logic)
- Runtime migrator: `drizzle-orm/planetscale-serverless/migrator.js`
- Current migrator: `db/app/src/migrate.ts`
- CI workflow: `.github/workflows/db-migrate.yml`
- Branch automation: `scripts/pscale-dev.mjs:40-45,84-129`; dev-services env injection:
  `scripts/with-dev-services-env.mjs:48-100`
- drizzle config factory: `vendor/db/src/utils/create-drizzle-config.ts:3-48`
- PlanetScale factory: `vendor/db/src/planetscale.ts:22-49`
- Schema: `db/app/src/schema/tables/org-source-control-bindings.ts:46-168`
- Migration journal: `db/app/src/migrations/meta/_journal.json` (`0000`, `when 1779344894261`)
- Predecessor plan (completed migration): `thoughts/shared/plans/2026-05-08-db-app-rework-planetscale-mysql.md`
- Local-dev decision context: `thoughts/shared/research/2026-05-10-db-app-planetscale-local-dev-decision.md`
- Engine guidance: the `mysql` and `vitess` skills.

## Improvement Log

### 2026-05-21 — adversarial review (`/improve_plan`)

**Spike — CONFIRMED.** Validated the linchpin of Phase 1 against the installed
`drizzle-orm@0.45.2`: a network-free harness wired a real `MySqlDialect` to a fake
`MySqlSession` and ran `migrate()` under four seed conditions. The skip condition is
`Number(latest.created_at) < migration.folderMillis` — strict `<`, `folderMillis` = the
journal `when`, single latest row via `order by created_at desc limit 1`, `hash` never read
for the skip. Empty table → `0000` replays; seeded `created_at = 1779344894261` → `0000`
skipped and `0001` applied; seeded `when − 1` → `0000` replays. `db:baseline` as written
(seeds `created_at = entry.when`, real sha256, DDL `id serial primary key, hash text not
null, created_at bigint`) is correct; caveats folded into 1.2.

**Critical fixes**
- **1.9 drift check was blind to the drift it guards.** `git diff --exit-code` ignores
  untracked files, so a newly generated `000N_*.sql` / snapshot would pass silently — the
  most common drift case. Now `git add -N db/app/src/migrations` before the diff.
- **`db:baseline --through` flag mismatch.** `baseline.ts` parses `--through=` (equals); 1.1,
  1.10 and Migration Notes wrote it space-separated, which `String.startsWith("--through=")`
  never matches → it would silently baseline *all* migrations. Aligned every reference on
  `pnpm --filter @db/app db:baseline -- --through=<tag>`.

**High fixes**
- **1.3 contradicted 1.4 on `db:migrate`.** 1.3 said CI runs `pnpm exec tsx ./src/migrate.ts`
  "**not** `pnpm db:migrate`" to skip `with-env` — but 1.4 already removes `with-env` from
  `db:migrate`. Reconciled 1.3 to `run: pnpm db:migrate`.
- **Phase 1 verification was not executable.** At end of Phase 1 there is no schema change,
  so the `staging → main` deploy request has an empty diff. Rewrote the Phase 1 human-review
  items to expect a no-op deploy request; added a "no-op `migrate()` is not a failure" bullet
  to 1.3; full deploy-request + deploy verification now belongs to Phase 2.
- **Stale "Current State".** `migrate.ts` and the `db:migrate` / `db-migrate.yml` changes
  were described as "in-progress (uncommitted) on `feat/upgrade-pnpm-11`" — they are
  committed (`af42b630a`, branch `feat/pscale-mysql`). Corrected the baseline framing.

**Scope decisions (user)**
- **Kept the `migrate()` + persistent-`staging` design.** The simpler pure-`drizzle-kit
  push`-in-CI alternative was considered and rejected: versioned `000N_*.sql` files are
  wanted as reviewable PR artifacts and the drift check depends on them. Trade-off accepted —
  `staging` is a stateful singleton; added the "`staging` must stay ≥ `main`" invariant to
  Migration Notes.
- **Dropped Phase 3 entirely** (read-replica wiring *and* the Vitess-posture docs). The
  replica code was inert and unverifiable — its own success criteria only proved it did
  nothing — and engine depth already lives in the `vitess` / `mysql` skills. Read replicas
  and sharding readiness are deferred to a future plan, to be done when there is a real
  replica to wire and test against.

**Minor**
- Performance: `timestamp(3)` is +2 bytes/column (MySQL fsp 3–4), not +1.
- 1.9: `runs-on` should match whatever label the other current workflows use (Depot vs
  `ubuntu-latest`).
