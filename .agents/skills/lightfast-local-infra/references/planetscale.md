# PlanetScale Up

`db up` creates or reuses a PlanetScale branch for this checkout and writes a
fresh branch password to the app env file.

## Inputs

Defaults:

```text
database_name=lightfast
base_branch=main
org_name=current pscale org
branch_name=wt-<worktree-prefix-or-local>-<root-hash>
```

Only override these as shell locals for the current run. Do not persist them to
app env files.

## Compute Identity

```bash
eval "$(node .claude/skills/lightfast-local-infra/lib/compute-identity.mjs)"
```

This sets `database_name`, `base_branch`, `pscale_branch`, and
`pscale_credential_name` (plus `redis_name`, unused here).

## Probe Remediation

`SKILL.md` already ran the basic probes. If auth is missing, ask the human:

```bash
pscale auth login
```

If the current org is not `lightfast`:

```bash
pscale org switch lightfast
```

## Create Or Reuse Branch

```bash
if ! pscale branch show "$database_name" "$pscale_branch" --format json >/tmp/lightfast-pscale-branch.json 2>/tmp/lightfast-pscale-branch.err; then
  if rg -i "database .*does not exist" /tmp/lightfast-pscale-branch.err >/dev/null; then
    cat /tmp/lightfast-pscale-branch.err
    exit 1
  fi

  pscale branch create "$database_name" "$pscale_branch" --from "$base_branch" --wait
fi
```

## Mint Password

PlanetScale shows the plain-text password only once. Write it to the env file
immediately.

```bash
pscale password create "$database_name" "$pscale_branch" "$pscale_credential_name" --role admin --format json > /tmp/lightfast-pscale-password.json

database_host=$(node -e 'const d=require("/tmp/lightfast-pscale-password.json"); console.log(d.access_host_url ?? d.host ?? "")')
database_username=$(node -e 'const d=require("/tmp/lightfast-pscale-password.json"); console.log(d.username ?? d.user ?? "")')
database_password=$(node -e 'const d=require("/tmp/lightfast-pscale-password.json"); console.log(d.plain_text ?? d.password ?? "")')

test -n "$database_host" && test -n "$database_username" && test -n "$database_password"
```

Then write the app env file with `references/env-files.md`.

## Baseline Inherited Schema

A branch created from `main` may inherit app tables without matching rows in
`__drizzle_migrations`. In that state, the migration runner tries to replay
`0000` against existing tables. Detect the state after the env file contains the
fresh branch credentials:

```bash
schema_state=$(
  cd db/app &&
    pnpm with-env node --input-type=module <<'NODE'
import { connect } from "@planetscale/database";

const conn = connect({
  host: process.env.DATABASE_HOST,
  password: process.env.DATABASE_PASSWORD,
  username: process.env.DATABASE_USERNAME,
});

const tableResult = await conn.execute("show tables");
const tables = tableResult.rows
  .map((row) => Object.values(row)[0])
  .filter((name) => typeof name === "string");

const hasAppTables = tables.some((name) => name !== "__drizzle_migrations");
let migrationCount = 0;

if (tables.includes("__drizzle_migrations")) {
  const migrationResult = await conn.execute(
    "select count(*) as count from __drizzle_migrations"
  );
  migrationCount = Number(migrationResult.rows[0]?.count ?? 0);
}

console.log(hasAppTables && migrationCount === 0 ? "baseline" : "migrate");
NODE
)

if [ "$schema_state" = "baseline" ]; then
  pnpm --filter @db/app db:baseline
fi
```

`db:baseline` marks the repository migrations as applied. Run it only when the
branch already contains the app schema and the migration journal is empty.

## Verify

```bash
pnpm --filter @db/app db:migrate
pnpm --filter @db/app db:studio -- --help
```

If the password is lost or rotated, rerun this runbook to mint and write a new
branch password.
