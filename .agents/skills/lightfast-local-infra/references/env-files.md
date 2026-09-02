# Env Files

The setup skill writes durable local database credentials to the ignored
database override file.

## Target Files

```text
db/app/.env.overrides.local
```

Each package loads its own local files through:

```bash
dotenv -e ./.env.overrides.local -e ./.env.local --
```

`dotenv-cli` keeps the first value it sees, so local override files must be
loaded before the package's `.env.local`.

The database package exposes this command wrapper:

```text
with-env   local override file, then package-local env file
```

## Managed Keys

```text
DATABASE_HOST
DATABASE_USERNAME
DATABASE_PASSWORD
```

Only the keys above are managed. Leave any other keys in the override file
alone unless the human explicitly asks to prune local secrets.

## Safe Write Helper

Values pass through environment variables so shell history never sees secret
values. The helper preserves unrelated lines and replaces only the listed keys.

For database credentials (after `references/planetscale.md`):

```bash
DATABASE_HOST="$database_host" \
DATABASE_USERNAME="$database_username" \
DATABASE_PASSWORD="$database_password" \
node .agents/skills/lightfast-local-infra/lib/write-env.mjs \
  --file db/app/.env.overrides.local \
  --set DATABASE_HOST --set DATABASE_USERNAME --set DATABASE_PASSWORD
```

## Verification

Print key names only:

```bash
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' \
  db/app/.env.overrides.local | sort
```

Expected managed keys:

```bash
for key in DATABASE_HOST DATABASE_USERNAME DATABASE_PASSWORD; do
  grep -q "^$key=\"\?.\+" db/app/.env.overrides.local || exit 1
done
```
