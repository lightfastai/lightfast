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

## Keys Not Managed

Do not add or update these during setup:

```text
DATABASE_NAME
DATABASE_PORT
PSCALE_BRANCH_NAME
PLANETSCALE_DATABASE_NAME
PLANETSCALE_ORG_NAME
PSCALE_BASE_BRANCH_NAME
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
LIGHTFAST_UPSTASH_REDIS_ID
LIGHTFAST_UPSTASH_REDIS_NAME
LIGHTFAST_UPSTASH_REDIS_REGION
KV_REST_API_READ_ONLY_TOKEN
KV_URL
REDIS_URL
```

Existing copies may remain from older setups. Leave unrelated or legacy keys
alone unless the human explicitly asks to prune local secrets.

## Safe Write Helper

Write values with environment variables so shell history does not capture the
secret values in command arguments.

For database credentials:

```bash
DATABASE_HOST="$database_host" \
DATABASE_USERNAME="$database_username" \
DATABASE_PASSWORD="$database_password" \
node <<'NODE'
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const file = "apps/app/.vercel/.env.development.local";
const updates = {
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
};

for (const [key, value] of Object.entries(updates)) {
  if (!value) throw new Error(`${key} is required`);
}

function setEnv(filePath, next) {
  let lines = [];
  try {
    lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  } catch {
    lines = [];
  }

  const seen = new Set();
  const out = lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      if (!match || !(match[1] in next)) return line;
      seen.add(match[1]);
      return `${match[1]}=${JSON.stringify(next[match[1]])}`;
    });

  for (const [key, value] of Object.entries(next)) {
    if (!seen.has(key)) out.push(`${key}=${JSON.stringify(value)}`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${out.join("\n")}\n`, { mode: 0o600 });
}

setEnv(file, updates);
NODE
```

For Redis credentials:

```bash
KV_REST_API_URL="$kv_rest_api_url" \
KV_REST_API_TOKEN="$kv_rest_api_token" \
node <<'NODE'
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const files = [
  "apps/app/.vercel/.env.development.local",
  "apps/platform/.vercel/.env.development.local",
];
const updates = {
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
};

for (const [key, value] of Object.entries(updates)) {
  if (!value) throw new Error(`${key} is required`);
}

function setEnv(filePath, next) {
  let lines = [];
  try {
    lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  } catch {
    lines = [];
  }

  const seen = new Set();
  const out = lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      if (!match || !(match[1] in next)) return line;
      seen.add(match[1]);
      return `${match[1]}=${JSON.stringify(next[match[1]])}`;
    });

  for (const [key, value] of Object.entries(next)) {
    if (!seen.has(key)) out.push(`${key}=${JSON.stringify(value)}`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${out.join("\n")}\n`, { mode: 0o600 });
}

for (const file of files) setEnv(file, updates);
NODE
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
