# Env Files

The setup skill writes durable local runtime credentials to ignored local
override env files. Vercel-pulled env files remain owned by `vercel pull` and
must not store generated local DB/Redis credentials.

## Target Files

```text
api/app/.env.overrides.local
db/app/.env.overrides.local
```

Each package loads its own local files through:

```bash
dotenv -e ./.env.overrides.local -e ./.env.local --
```

`dotenv-cli` keeps the first value it sees, so local override files must be
loaded before the package's `.env.local`.

Package scripts expose both forms:

```text
with-env:local   local override file, then package-local env file
with-env         same local override chain as with-env:local
```

## Managed Keys

API:

```text
DATABASE_HOST
DATABASE_USERNAME
DATABASE_PASSWORD
KV_REST_API_URL
KV_REST_API_TOKEN
```

Database tooling:

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
  --file api/app/.env.overrides.local \
  --file db/app/.env.overrides.local \
  --set DATABASE_HOST --set DATABASE_USERNAME --set DATABASE_PASSWORD
```

For Redis credentials (after `references/upstash.md`):

```bash
KV_REST_API_URL="$kv_rest_api_url" \
KV_REST_API_TOKEN="$kv_rest_api_token" \
node .agents/skills/lightfast-local-infra/lib/write-env.mjs \
  --file api/app/.env.overrides.local \
  --set KV_REST_API_URL --set KV_REST_API_TOKEN
```

## Verification

Print key names only:

```bash
for file in api/app/.env.overrides.local db/app/.env.overrides.local; do
  echo "$file"
  awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$file" | sort
done
```

Expected managed keys:

```bash
for file in api/app/.env.overrides.local db/app/.env.overrides.local; do
  for key in DATABASE_HOST DATABASE_USERNAME DATABASE_PASSWORD; do
    grep -q "^$key=\"\?.\+" "$file" || exit 1
  done
done

for key in KV_REST_API_URL KV_REST_API_TOKEN; do
  grep -q "^$key=\"\?.\+" api/app/.env.overrides.local || exit 1
done
```

`e2e/.env.local` and `ai/.env.local` are separately managed operator inputs.
The local-infra helper does not copy broader application, E2E, or AI provider
credentials into those files.
