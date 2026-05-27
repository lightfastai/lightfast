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

## Verify

```bash
pnpm --filter @db/app db:migrate
pnpm --filter @db/app db:studio -- --help
```

If the password is lost or rotated, rerun this runbook to mint and write a new
branch password.
