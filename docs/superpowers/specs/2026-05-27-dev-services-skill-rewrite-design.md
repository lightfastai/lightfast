# Dev Services Skill Rewrite Design

## Context

The local development environment still carries a custom service orchestration
layer from older infrastructure decisions:

- `scripts/dev-services.mjs`
- `scripts/pscale-dev.mjs`
- `scripts/with-dev-services-env.mjs`
- root `db:*`, `redis:*`, `dev:setup`, and `dev:doctor` package scripts
- the `@lightfastai/dev-services` package dependency
- transient `.lightfast/pscale/...` credential cache files

After the `lightfast.dev.json` removal, the remaining layer mostly exists to
provision or inject two kinds of values:

- PlanetScale branch credentials for `@db/app`.
- Upstash Redis REST credentials for app and platform runtime validation.

That makes the scripts part provisioning tool, part runtime env injector, and
part legacy Docker service wrapper. The shape is harder to reason about than
the underlying operations.

## Discovery

Local skill discovery with `pnpm dlx @tanstack/intent@latest list` currently
finds only tRPC intent skills in this workspace. There is no PlanetScale or
Upstash intent skill installed through TanStack Intent.

Official provider surfaces relevant to this rewrite:

- PlanetScale documents the `pscale` CLI for branch and password management.
  The CLI also ships a PlanetScale MCP server, but no official Codex skill was
  found during discovery.
- Upstash documents the `upstash` CLI and explicitly recommends installing the
  Upstash skill for agents with `npx skills add upstash/skills`.
- The local machine already has `pscale version 0.283.0` installed and
  authenticated against the `lightfast` org.
- The local machine has `upstash v0.3.0` installed, but it is not authenticated.
  Its command shape differs from the current Upstash docs, so the setup
  workflow must either standardize on a newer CLI or probe `upstash --help`
  before relying on flags.

References:

- [PlanetScale CLI docs](https://planetscale.com/docs/cli)
- [PlanetScale branch CLI docs](https://planetscale.com/docs/reference/branch)
- [PlanetScale GitHub Actions pscale branch/password examples](https://planetscale.com/docs/devops/create-branch-password-action)
- [PlanetScale CLI repository and MCP notes](https://github.com/planetscale/cli)
- [Upstash CLI docs](https://upstash.com/docs/agent-resources/cli)
- [Upstash Redis docs](https://upstash.com/docs/redis)

## Problem

The current setup has three avoidable costs:

1. Runtime scripts hide required env from the actual app env files.
2. Root package scripts expose infrastructure actions as if they are normal app
   lifecycle commands.
3. The dev-services package keeps legacy Docker/Postgres/Redis concepts alive
   even though local DB development now uses PlanetScale branches and Redis can
   be provisioned directly through Upstash.

The result is local architecture slop: useful credentials are produced by a
custom local framework instead of the provider CLIs, and every `with-env` path
has to remember the framework exists.

## Goals

- Replace the local DB/Redis provisioning scripts with a repo-local setup skill.
- Keep provider operations explicit and readable through `pscale` and `upstash`
  CLI commands.
- Persist generated credentials into ignored Vercel env files instead of
  injecting them at process startup.
- Remove the root runtime dependency on `@lightfastai/dev-services`.
- Return app package scripts to plain `dotenv` wrappers.
- Keep local dev URLs and Portless/MFE behavior outside this rewrite except
  where docs mention the deleted dev-services scripts.
- Make `db up` and `redis up` reproducible by a human or agent without reading
  repo JS scripts.
- Define the future `down` cleanup model for stale local PlanetScale and
  Upstash resources without reintroducing root package scripts.
- Document the day-1 database migration model clearly, including the parts that
  still need proof before anyone treats the pipeline as reliable.

## Non-Goals

- Do not build a new repo CLI to replace `dev-services.mjs`.
- Do not keep `.lightfast/pscale` as a second credential store.
- Do not start Docker containers for database or Redis.
- Do not redesign Portless, microfrontends, or Inngest URL sync in this spec.
- Do not introduce PlanetScale MCP as the primary provisioning path.
- Do not solve production or preview Vercel env management.
- Do not add Redis key-prefix isolation unless we choose to share one Redis DB
  across worktrees. V1 avoids that by using separate Upstash databases.
- Do not execute destructive provider deletion in this phase. This spec defines
  the target cleanup behavior, but the actual `down` runbooks must be
  implemented and tested in a follow-up.

## Decision

Move DB and Redis setup out of root runtime scripts and into a project skill:

```text
.agents/skills/lightfast-local-infra/
  SKILL.md
  references/
    planetscale.md
    upstash.md
    env-files.md
```

The skill is the runbook and decision surface. It teaches the agent how to:

- verify or install provider CLIs,
- authenticate when needed,
- compute stable local resource names,
- create or reuse PlanetScale and Upstash resources,
- write credentials into ignored Vercel env files,
- run migration and smoke checks.

The app runtime stops importing or executing the dev-services scripts. Runtime
processes only read env through `dotenv`.

## Target Model

### Env Files

The durable local env files are:

```text
apps/app/.vercel/.env.development.local
apps/platform/.vercel/.env.development.local
```

`@db/app` continues to read the app env file for migrations and Studio:

```text
db/app/package.json -> dotenv -e ../../apps/app/.vercel/.env.development.local
```

The setup skill writes:

```text
apps/app/.vercel/.env.development.local
  DATABASE_HOST
  DATABASE_USERNAME
  DATABASE_PASSWORD
  KV_REST_API_URL
  KV_REST_API_TOKEN

apps/platform/.vercel/.env.development.local
  KV_REST_API_URL
  KV_REST_API_TOKEN
```

These are the runtime keys the current code actually consumes:

- `vendor/db/src/env.ts` reads `DATABASE_HOST`, `DATABASE_USERNAME`, and
  `DATABASE_PASSWORD`. The database name is fixed as `lightfast`.
- `vendor/upstash/src/env.ts` reads `KV_REST_API_URL` and
  `KV_REST_API_TOKEN`.

Do not write provisioning metadata to app env files:

```text
PSCALE_BRANCH_NAME
PLANETSCALE_DATABASE_NAME
PLANETSCALE_ORG_NAME
PSCALE_BASE_BRANCH_NAME
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
LIGHTFAST_UPSTASH_REDIS_ID
LIGHTFAST_UPSTASH_REDIS_NAME
LIGHTFAST_UPSTASH_REDIS_REGION
```

Those values are either unused by runtime code or are only temporary inputs to
provider CLI commands. The setup skill should keep them as local shell
variables in the runbook, derive them from identity, or read them from the
human's current shell when intentionally overriding defaults. They should not
become persisted app configuration.

The skill must preserve unrelated env lines and replace only the managed keys
above.

### Identity

Resource names should remain stable per local checkout/worktree without a root
config file.

Use this identity model:

```text
project name: lightfast
root hash: first 8 hex chars of sha1(real repo root path)
worktree prefix: sanitized last git branch segment for secondary worktrees;
                 empty for primary checkout, main, master, or detached HEAD
```

Sanitization:

```text
lowercase
replace "." with "-"
replace non [a-z0-9-] with "-"
collapse repeated "-"
trim leading/trailing "-"
```

PlanetScale branch name:

```text
wt-<worktree-prefix-or-local>-<root-hash>
```

Upstash Redis database name:

```text
lightfast-<worktree-prefix-or-local>-<root-hash>
```

Both names must be truncated only if the provider rejects the full name. If
truncation is needed, keep the root hash suffix.

### PlanetScale Up

The `db up` runbook creates or reuses one PlanetScale branch for this checkout.

Runbook locals:

```text
database_name, default lightfast
org_name, optional; default current pscale org
base_branch, default main
branch_name, computed from local identity unless the human explicitly overrides
```

Flow:

1. Verify `pscale` exists with `pscale --version`.
2. Verify auth with `pscale auth check`.
3. If auth is missing, instruct the human to run `pscale auth login` in a real
   terminal. Do not attempt interactive login inside the agent shell.
4. Verify the active org with `pscale org list`; use `pscale org switch
   lightfast` only when needed and only after explaining the org change.
5. Check branch existence:

   ```bash
   pscale branch show "$database_name" "$branch_name" -f json
   ```

6. Create the branch only when missing:

   ```bash
   pscale branch create "$database_name" "$branch_name" --from "$base_branch" --wait
   ```

7. Always create a fresh branch password for the env file:

   ```bash
   pscale password create "$database_name" "$branch_name" "lightfast-<user>-<root-hash>" --role admin -f json
   ```

8. Write the returned host, username, and plain-text password to
   `apps/app/.vercel/.env.development.local` as `DATABASE_HOST`,
   `DATABASE_USERNAME`, and `DATABASE_PASSWORD`.
9. Run:

   ```bash
   pnpm --filter @db/app db:migrate
   ```

10. Verify:

    ```bash
    pnpm --filter @db/app db:studio -- --help
    ```

The branch password is not cached anywhere else. If the password is lost or
rotated, rerun the skill to mint and write a new one.

### Redis Up

The `redis up` runbook creates or reuses one Upstash Redis database for this
checkout.

Runbook locals:

```text
redis_region, default ap-southeast-2 for this repository
redis_name, computed from local identity unless the human explicitly overrides
redis_id, discovered from upstash redis list/create output
```

Flow:

1. Verify `upstash` exists with `upstash --version`.
2. Prefer the current official CLI. If the installed CLI is old enough that
   flags differ, either upgrade it or follow the local `upstash redis --help`
   output exactly.
3. Verify auth with `upstash auth whoami` for `v0.3.x` or the equivalent
   current CLI command.
4. If auth is missing, instruct the human to obtain an Upstash developer API key
   and run the documented login command. For `v0.3.x`, that is:

   ```bash
   upstash auth login --email "<email>" --api-key "<api-key>"
   ```

5. List Redis databases and search for the computed name.
6. Create the database only when missing:

   ```bash
   upstash redis create --name "$redis_name" --region "$redis_region" --json
   ```

7. Fetch the database details by ID using the local CLI's supported flag shape.
   For `v0.3.x`, that is:

   ```bash
   upstash redis get --id "$redis_id" --json
   ```

8. Write the REST URL and token to app and platform env files as
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
9. Verify the REST endpoint with a non-destructive ping through the Upstash REST
   API or CLI.

V1 uses one Upstash Redis database per checkout/worktree. That avoids adding
runtime key-prefix behavior to `@vendor/upstash` and avoids accidental key
sharing between worktrees.

### Down / Cleanup Model

`down` is the inverse lifecycle for local-only provider resources. It is a
skill runbook, not a package script. The repo should not add back root cleanup
scripts such as `pnpm db:down` or `pnpm redis:down`, or a hidden JS
orchestration layer.

The cleanup target is always the resource identity derived from the checkout:

```text
PlanetScale branch: wt-<worktree-prefix-or-local>-<root-hash>
Upstash Redis DB:  lightfast-<worktree-prefix-or-local>-<root-hash>
```

The runbook must be deliberately conservative:

1. Recompute identity from the current checkout.
2. Probe auth and provider access with the same CLI checks used by `up`.
3. Show the exact PlanetScale branch and Upstash Redis database that would be
   removed.
4. Refuse to touch protected names:
   - PlanetScale `main`, `staging`, `production`, or any branch not matching
     `^wt-[a-z0-9-]+-[0-9a-f]{8}$`.
   - Upstash databases not matching
     `^lightfast-[a-z0-9-]+-[0-9a-f]{8}$`.
5. Require explicit human confirmation before provider deletion.
6. After successful provider deletion, remove only the managed env keys from
   ignored local env files and leave unrelated env lines intact.

Managed env cleanup:

```text
apps/app/.vercel/.env.development.local
  remove DATABASE_HOST
  remove DATABASE_USERNAME
  remove DATABASE_PASSWORD
  remove KV_REST_API_URL
  remove KV_REST_API_TOKEN

apps/platform/.vercel/.env.development.local
  remove KV_REST_API_URL
  remove KV_REST_API_TOKEN
```

The cleanup helper should be a small sibling to `write-env.mjs`, for example
`remove-env.mjs`. It should parse env files line-by-line, remove exact managed
keys, preserve comments and unrelated values, and print a before/after key
summary without printing secrets.

#### PlanetScale Down

`db down` deletes only the computed local development branch.

Provider command surface from local `pscale 0.283.0`:

```bash
pscale branch show "$database_name" "$pscale_branch" --format json
pscale password list "$database_name" "$pscale_branch" --format json
pscale password delete "$database_name" "$pscale_branch" --name "$pscale_credential_name" --force
pscale branch delete "$database_name" "$pscale_branch" --force
```

Password deletion is useful when rotating or partially cleaning up, but branch
deletion is the terminal cleanup for local worktree branches. The runbook should
attempt password deletion first only for the credential name it created. If the
password is already gone, continue. If the branch is already gone, skip env
cleanup only after verifying the branch is absent and the user confirms the env
file is stale.

The runbook must never use `--delete-descendants` by default. A local worktree
branch should not have descendants; if it does, that is a separate inspection
case.

#### Redis Down

`redis down` deletes only the computed Upstash Redis database.

Provider command surface from local `upstash v0.3.0`:

```bash
upstash redis list --json
upstash redis get --id "$redis_id" --json
upstash redis delete --id "$redis_id" --json
```

The runbook should discover the database ID by exact name match, fetch details
by ID, verify the returned name still equals the computed name, then delete by
ID only after confirmation. If more than one database has the same name, abort
and require manual provider cleanup.

#### Stale Resource Sweeps

The normal path is to run `down` from the same checkout before removing a git
worktree. If the worktree was already deleted, identity can no longer be
computed safely from local filesystem state. The fallback should be a sweep
runbook that lists candidates and asks the human to choose:

```bash
pscale branch list lightfast --format json
upstash redis list --json
```

The sweep is read-only until the human gives an exact branch name and Redis ID.
It should prefer candidates that include the known branch slug and root hash,
but it must not infer deletion from name shape alone.

### Branch / Worktree Close Loop

The intended branch lifecycle is:

1. Create or enter a git worktree for the feature branch.
2. Run the `lightfast-local-infra` `db up` and `redis up` runbooks.
3. Develop against the per-worktree PlanetScale branch and per-worktree Upstash
   database.
4. Commit code, generated migrations, and tests. Provider resources are never
   the source of truth.
5. Merge or abandon the code branch.
6. Before deleting the local worktree, run the `down` runbook from that same
   worktree.
7. Remove the git worktree after provider cleanup succeeds.

Important boundary: deleting the local PlanetScale branch does not deploy
schema to production or staging. Schema changes survive only because generated
Drizzle migration files are committed to the repo. The provider branch is a
scratch target for local verification.

### Migration Model

The app database is `@db/app` on PlanetScale MySQL (Vitess) through
`@vendor/db`, `@planetscale/database`, and
`drizzle-orm/planetscale-serverless`.

Source of truth:

```text
db/app/src/schema/**            TypeScript Drizzle schema
db/app/src/migrations/**        generated SQL, snapshots, and journal
db/app/src/drizzle.config.ts    app-owned database name and tablesFilter
```

Commands:

```bash
pnpm --filter @db/app db:generate   # offline SQL generation from schema
pnpm --filter @db/app db:push       # local branch schema sync
pnpm --filter @db/app db:migrate    # apply generated migrations to a target branch
pnpm --filter @db/app db:baseline   # seed __drizzle_migrations only
pnpm --filter @db/app db:studio     # inspect env-configured branch
```

Day-1 target workflow:

1. Local feature work uses the per-worktree PlanetScale branch.
2. During iteration, use `db:push` against the worktree branch to make the live
   scratch schema match TypeScript quickly.
3. When the schema is ready, run `db:generate` and commit the generated SQL,
   snapshots, journal update, schema changes, and tests.
4. The persistent `staging` PlanetScale branch is the integration branch for
   generated migrations.
5. CI or a release operator runs `db:migrate` against `staging` credentials.
6. PlanetScale deploy requests move schema from `staging` to `main`.
7. `main` is production schema. Do not run the Drizzle migrator directly
   against `main`.

`db:baseline` exists because the current schema may already exist in
PlanetScale before Drizzle's migration journal is trustworthy. It creates or
updates `__drizzle_migrations` rows for generated migrations without executing
their SQL. It is only for bootstrapping or rebuilding the persistent `staging`
branch from a known live schema. It must not become a casual local-development
command.

Known day-1 gaps:

- The `staging` branch bootstrap and `db:baseline --through=<tag>` path need a
  real dry run against a disposable branch before anyone uses it on the shared
  integration branch.
- The current "last migration already deployed to main" tag is not formally
  recorded anywhere. The release process needs an explicit record, probably in
  a small checked-in note or release checklist, before staging rebuilds are
  safe.
- `db:migrate` against PlanetScale branch credentials passed in tests locally,
  but the complete CI path from migration execution to PlanetScale deploy
  request has not been proven in this rewrite.
- PlanetScale deploy requests move schema, not Drizzle journal rows. The
  persistent `staging` branch owns the authoritative migration journal. If
  `staging` is deleted or rebuilt, it must be baselined through the last schema
  version already present on `main`.
- Rollback and revert behavior is not specified yet. Until it is, schema
  changes should be small, forward-only, and reviewed against PlanetScale/Vitess
  safe-migration rules.

### Package Scripts

After the setup skill exists and is verified, remove script indirection:

```json
{
  "apps/app": {
    "with-env": "dotenv -e ./.vercel/.env.development.local --"
  },
  "apps/platform": {
    "with-env": "dotenv -e ./.vercel/.env.development.local --"
  },
  "db/app": {
    "with-env": "dotenv -e ../../apps/app/.vercel/.env.development.local --"
  }
}
```

Remove root scripts:

```text
dev:setup
dev:doctor
db:env
db:up
db:down
db:status
redis:url
redis:up
redis:ping
```

Keep normal application scripts:

```text
dev
db:generate
db:push
db:migrate
db:baseline
```

`pnpm dev` is the only root local-dev entrypoint. It starts the full MFE dev
stack, local Inngest, and the concrete app/www/platform hosts.

### Turborepo Env Pruning

Prune stale `passThroughEnv` entries during implementation:

- `apps/app/turbo.json` should keep `DATABASE_HOST`, `DATABASE_USERNAME`,
  `DATABASE_PASSWORD`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN`.
- `apps/platform/turbo.json` should keep `KV_REST_API_URL` and
  `KV_REST_API_TOKEN`; remove `DATABASE_HOST`, `DATABASE_USERNAME`, and
  `DATABASE_PASSWORD` unless platform starts importing `@db/app`.
- `apps/www/turbo.json` should remove `KV_REST_API_URL` and
  `KV_REST_API_TOKEN` unless www starts importing `@vendor/upstash`.

The current local `.vercel/.env.development.local` files may still contain
legacy keys such as `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`, and
platform-side `DATABASE_*`. The rewrite should not rely on them, and the setup
skill should not manage them.

### Skill Shape

`SKILL.md` should stay short and route to references:

- Trigger when the user asks to set up, repair, provision, or inspect local
  Lightfast DB/Redis infrastructure.
- First run CLI probes:

  ```bash
  command -v pscale && pscale --version
  pscale auth check
  command -v upstash && upstash --version
  upstash --help
  ```

- Then choose one reference:
  - `references/planetscale.md` for DB setup.
  - `references/upstash.md` for Redis setup.
  - `references/env-files.md` for env-file writes and validation.

The skill may include copy-pasteable shell snippets and small one-off Node
snippets for safe env-file mutation. It must not add repo runtime scripts or
package.json commands.

### Docs

Update developer docs to reflect the new boundary:

- `AGENTS.md`
- `CLAUDE.md`
- `db/app/README.md`
- `.agents/skills/lightfast-cli-doctor/SKILL.md`
- `.agents/skills/lightfast-cli-doctor/references/pscale.md`

The docs should say local DB/Redis provisioning is skill-driven. They should
not instruct developers to run `pnpm db:up`, `pnpm redis:up`, `pnpm dev:setup`,
or `pnpm dev:doctor`.

## Implementation Phases

### Phase 1: Add Setup Skill

Create `.agents/skills/lightfast-local-infra` with concise trigger guidance and
three references. The skill should support:

- `db up`
- `redis up`
- env-file verification

It should explicitly defer destructive `down` cleanup until the cleanup runbooks
are designed and tested.

### Phase 2: Prove The Runbook

Run the skill manually in this checkout:

- Verify `pscale` branch creation or reuse.
- Verify `pscale password create` output maps to the required DB env keys.
- Authenticate Upstash.
- Verify Upstash DB creation or reuse.
- Verify app and platform env files contain the required Redis keys.
- Run `pnpm --filter @db/app db:migrate`.
- Run app/platform typechecks with the script injection disabled.

### Phase 3: Remove Runtime Injection

Remove `with-dev-services-env.mjs` from app, platform, and db scripts. Then
delete the script.

Run:

```bash
pnpm --filter @db/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/platform typecheck
```

### Phase 4: Remove Dev Services Commands

Delete:

```text
scripts/dev-services.mjs
scripts/pscale-dev.mjs
```

Remove root package scripts and the `@lightfastai/dev-services` dependency.

Run:

```bash
pnpm install --lockfile-only
rg -n "dev-services|pscale-dev|with-dev-services-env|@lightfastai/dev-services|pnpm db:up|pnpm redis:up|pnpm dev:setup|pnpm dev:doctor" .
```

Expected: only the new spec/plan history should mention removed commands, or
the references should explicitly describe them as deleted legacy commands.

### Phase 5: Documentation Cleanup

Update the developer docs and doctor skill to make the setup skill the only
documented path for local DB/Redis provisioning.

Run:

```bash
pnpm check
pnpm typecheck
```

If `pnpm check` fails on unrelated dirty automation work, record that as an
unrelated pre-existing failure and verify the touched files with the narrowest
available formatter/check command.

### Future Phase 6: Add Down Runbooks

Extend `.agents/skills/lightfast-local-infra` with cleanup references:

```text
.agents/skills/lightfast-local-infra/
  references/
    planetscale-down.md
    upstash-down.md
    env-files.md
  lib/
    remove-env.mjs
```

Implementation requirements:

- Reuse `compute-identity.mjs` for default target names.
- Add exact-name provider lookups before every delete.
- Add protected-name guards for PlanetScale branches and Upstash databases.
- Require human confirmation before any provider delete command.
- Remove managed env keys only after provider cleanup succeeds or the provider
  resource is verified absent and the human confirms the env is stale.
- Keep this as skill documentation plus tiny env-file helpers; do not add root
  scripts.

Verification requirements:

```bash
node .agents/skills/lightfast-local-infra/lib/compute-identity.mjs
pscale branch show lightfast "$pscale_branch" --format json
upstash redis list --json
```

Use disposable test resources first. Do not test deletion on a real branch that
contains unmerged schema work.

### Future Phase 7: Prove Migrations

Validate the database migration pipeline separately from local infra cleanup.

Required proof:

- Identify the migration tag that matches the current `main` schema.
- Bootstrap a disposable PlanetScale branch from `main`.
- Run `db:baseline --through=<last-deployed-tag>` against that disposable
  branch and inspect `__drizzle_migrations`.
- Create a tiny reversible schema change in a throwaway branch, run
  `db:generate`, and verify the generated SQL is acceptable for Vitess.
- Run `db:migrate` against a disposable integration branch.
- Open a PlanetScale deploy request from the disposable integration branch to a
  disposable target branch, not production `main`.
- Document the exact CI/release command shape only after the dry run succeeds.

Until this phase is complete, treat the migration pipeline as specified but not
operationally proven.

## Testing And Verification

The rewrite is complete when these pass:

```bash
test ! -e scripts/dev-services.mjs
test ! -e scripts/pscale-dev.mjs
test ! -e scripts/with-dev-services-env.mjs
test ! -e scripts/inngest-portless-sync.mjs
rg -n "with-dev-services-env|@lightfastai/dev-services" package.json apps api db scripts pnpm-lock.yaml
pnpm --filter @db/app db:migrate
pnpm --filter @db/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/platform typecheck
pnpm --filter @lightfast/app test -- src/__tests__/origins.test.ts src/__tests__/cors.test.ts
```

Manual verification:

- `apps/app/.vercel/.env.development.local` contains DB and Redis credentials.
- `apps/platform/.vercel/.env.development.local` contains Redis credentials.
- `pnpm dev` starts without `with-dev-services-env.mjs`.
- Drizzle Studio reads PlanetScale credentials from the app env file.

Future `down` verification:

- A computed local PlanetScale branch can be found, shown, and deleted only
  after confirmation.
- A computed local Upstash Redis database can be found, shown, and deleted only
  after confirmation.
- Managed env keys are removed from app/platform env files without printing
  secrets and without touching unrelated keys.
- Running `down` twice is safe: the second run reports resources absent and does
  not fail after confirmation of stale env cleanup.

## Risks

- Upstash CLI command flags have changed across versions. The skill must probe
  the installed CLI and prefer upgrade guidance over guessing.
- PlanetScale password output includes the plain text password only at creation
  time. The skill must write it immediately and tell the user rerun is the
  rotation path.
- Per-worktree Upstash databases may create more provider resources than shared
  local Redis did. That is acceptable for V1 because it keeps isolation simple.
- Removing root `db:up` and `redis:up` means humans must know to invoke the
  skill. Docs and AGENTS/CLAUDE guidance must make that explicit.
- Existing unrelated dirty files can make broad verification commands fail. The
  implementation must distinguish slice failures from unrelated workspace
  failures without reverting user changes.
- Destructive cleanup is easy to get wrong. The first `down` implementation must
  be exact-name, confirmation-gated, and tested only with disposable resources.
- If a git worktree is deleted before `down`, deterministic naming is weaker
  because the root path hash may no longer be easy to recompute. The stale
  sweep path must stay read-only until a human provides exact target names.
- The migration pipeline currently mixes a local `db:push` workflow with a
  future `staging` migrator workflow. Until Phase 7 is proven, generated
  migrations should be reviewed as artifacts, not treated as evidence that the
  provider deploy path is healthy.

## Deferred Work

- `db down`: implement the PlanetScale branch/password cleanup runbook with
  protected branch guards.
- `redis down`: implement the Upstash Redis database cleanup runbook after exact
  database-name and ID confirmation.
- Stale resource sweep: list orphaned `wt-*` PlanetScale branches and
  `lightfast-*` Upstash databases for manual selection after a worktree has
  already been removed.
- Migration proof: validate `staging` baseline, `db:migrate`, and PlanetScale
  deploy requests against disposable branches.
- Release record: persist the last migration tag known to be deployed to `main`
  so `staging` rebuilds do not depend on memory.
- Optional Redis prefixing wrapper in `@vendor/upstash` if the team later wants
  shared Redis databases instead of per-worktree databases.
- Optional installation of the official Upstash skill once the team decides
  whether project-local skills should vendor provider skills or only reference
  them.
