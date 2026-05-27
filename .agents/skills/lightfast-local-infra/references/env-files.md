# Env Files

The setup skill writes durable local runtime credentials to ignored Vercel env
files. It preserves unrelated lines and replaces only the managed keys.

## Target Files

```text
apps/app/.vercel/.env.development.local
apps/platform/.vercel/.env.development.local
```

`@db/app` reads the app env file through:

```bash
dotenv -e ../../apps/app/.vercel/.env.development.local --
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

Platform:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

Only the keys above are managed. Leave any other keys in the file alone
unless the human explicitly asks to prune local secrets.

## Safe Write Helper

Values pass through environment variables so shell history never sees secret
values. The helper preserves unrelated lines and replaces only the listed keys.

For database credentials (after `references/planetscale.md`):

```bash
DATABASE_HOST="$database_host" \
DATABASE_USERNAME="$database_username" \
DATABASE_PASSWORD="$database_password" \
node .claude/skills/lightfast-local-infra/lib/write-env.mjs \
  --file apps/app/.vercel/.env.development.local \
  --set DATABASE_HOST --set DATABASE_USERNAME --set DATABASE_PASSWORD
```

For Redis credentials (after `references/upstash.md`):

```bash
KV_REST_API_URL="$kv_rest_api_url" \
KV_REST_API_TOKEN="$kv_rest_api_token" \
node .claude/skills/lightfast-local-infra/lib/write-env.mjs \
  --file apps/app/.vercel/.env.development.local \
  --file apps/platform/.vercel/.env.development.local \
  --set KV_REST_API_URL --set KV_REST_API_TOKEN
```

## Verification

Print key names only:

```bash
for file in apps/app/.vercel/.env.development.local apps/platform/.vercel/.env.development.local; do
  echo "$file"
  awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$file" | sort
done
```

Expected managed keys:

```bash
for key in DATABASE_HOST DATABASE_USERNAME DATABASE_PASSWORD KV_REST_API_URL KV_REST_API_TOKEN; do
  grep -q "^$key=" apps/app/.vercel/.env.development.local
done

for key in KV_REST_API_URL KV_REST_API_TOKEN; do
  grep -q "^$key=" apps/platform/.vercel/.env.development.local
done
```
