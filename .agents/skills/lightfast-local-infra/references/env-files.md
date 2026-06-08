# Env Files

The setup skill writes durable local runtime credentials to ignored local
override env files. Vercel-pulled env files remain owned by `vercel pull` and
must not store generated local DB/Redis credentials.

## Target Files

```text
apps/app/.env.overrides.local
```

`@db/app` reads the app env files through:

```bash
dotenv -e ../../apps/app/.env.overrides.local -e ../../apps/app/.vercel/.env.development.local --
```

`dotenv-cli` keeps the first value it sees, so local override files must be
loaded before `.vercel/.env.development.local`.

Package scripts expose both forms:

```text
with-env:local   local override file, then Vercel-pulled env file
with-env:vercel  Vercel-pulled env file only
with-env         same local override chain as with-env:local
```

## Managed Keys

App:

```text
DATABASE_HOST
DATABASE_USERNAME
DATABASE_PASSWORD
KV_REST_API_URL
KV_REST_API_TOKEN
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
  --file apps/app/.env.overrides.local \
  --set DATABASE_HOST --set DATABASE_USERNAME --set DATABASE_PASSWORD
```

For Redis credentials (after `references/upstash.md`):

```bash
KV_REST_API_URL="$kv_rest_api_url" \
KV_REST_API_TOKEN="$kv_rest_api_token" \
node .agents/skills/lightfast-local-infra/lib/write-env.mjs \
  --file apps/app/.env.overrides.local \
  --set KV_REST_API_URL --set KV_REST_API_TOKEN
```

## Verification

Print key names only:

```bash
for file in apps/app/.env.overrides.local; do
  echo "$file"
  awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$file" | sort
done
```

Expected managed keys:

```bash
for key in DATABASE_HOST DATABASE_USERNAME DATABASE_PASSWORD KV_REST_API_URL KV_REST_API_TOKEN; do
  grep -q "^$key=" apps/app/.env.overrides.local
done
```
