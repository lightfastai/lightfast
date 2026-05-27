# Upstash Redis Up

`redis up` creates or reuses one Upstash Redis database for this checkout and
writes REST credentials to the app and platform env files.

## Inputs

Defaults:

```text
redis_region=ap-southeast-2
redis_name=lightfast-<worktree-prefix-or-local>-<root-hash>
```

Use one database per checkout/worktree. Do not add Redis key-prefix isolation in
runtime code for this V1 setup.

## Compute Identity

```bash
redis_region=${redis_region:-ap-southeast-2}

eval "$(
node <<'NODE'
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const realRoot = realpathSync(root);
const rootHash = createHash("sha1").update(realRoot).digest("hex").slice(0, 8);
const branch = execFileSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).trim();
const worktreeOutput = execFileSync("git", ["worktree", "list", "--porcelain"], {
  encoding: "utf8",
});
const worktrees = worktreeOutput
  .split(/\n(?=worktree )/)
  .map((chunk) => chunk.match(/^worktree (.+)$/m)?.[1])
  .filter(Boolean)
  .map((path) => realpathSync(path));
const primary = worktrees[0] ?? realRoot;
const lastSegment = branch.split("/").filter(Boolean).at(-1) ?? "";
const sanitized = lastSegment
  .toLowerCase()
  .replace(/\./g, "-")
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");
const isPrimary = realRoot === primary;
const prefix =
  !branch || branch === "main" || branch === "master" || isPrimary
    ? "local"
    : sanitized || "local";
const redisName = `lightfast-${prefix}-${rootHash}`
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

console.log(`redis_name=${redisName}`);
NODE
)"
```

## Probe

```bash
command -v upstash
upstash --version
upstash auth whoami
upstash redis --help
```

For `upstash v0.3.x`, login is:

```bash
upstash auth login --email "<email>" --api-key "<api-key>"
```

If a newer CLI changes flags, follow the installed `upstash --help` and
`upstash redis --help` output instead of guessing.

## Create Or Reuse Database

For `upstash v0.3.x`:

```bash
upstash redis list --json > /tmp/lightfast-upstash-list.json

redis_id=$(REDIS_NAME="$redis_name" node <<'NODE'
const fs = require("node:fs");
const name = process.env.REDIS_NAME;
const data = JSON.parse(fs.readFileSync("/tmp/lightfast-upstash-list.json", "utf8"));
const list = Array.isArray(data) ? data : data.databases ?? data.data ?? [];
const match = list.find((item) => item.database_name === name || item.name === name);
console.log(match?.database_id ?? match?.id ?? "");
NODE
)

if [ -z "$redis_id" ]; then
  upstash redis create --name "$redis_name" --region "$redis_region" --json > /tmp/lightfast-upstash-create.json
  redis_id=$(node <<'NODE'
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync("/tmp/lightfast-upstash-create.json", "utf8"));
console.log(data.database_id ?? data.id ?? "");
NODE
)
fi

test -n "$redis_id"
```

Fetch details:

```bash
upstash redis get --id "$redis_id" --json > /tmp/lightfast-upstash-db.json

kv_rest_api_url=$(node <<'NODE'
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync("/tmp/lightfast-upstash-db.json", "utf8"));
let value = data.rest_url ?? data.endpoint ?? "";
if (value && !/^https?:\/\//.test(value)) value = `https://${value}`;
console.log(value);
NODE
)
kv_rest_api_token=$(node <<'NODE'
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync("/tmp/lightfast-upstash-db.json", "utf8"));
console.log(data.rest_token ?? data.token ?? data.password ?? "");
NODE
)

test -n "$kv_rest_api_url"
test -n "$kv_rest_api_token"
```

Then write app and platform env files with `references/env-files.md`.

## Verify

Use the REST API ping command. Keep the token out of command arguments and logs.

```bash
umask 077
cat > /tmp/lightfast-upstash-curl.conf <<CURL
fail
silent
show-error
max-time = 15
header = "Authorization: Bearer $kv_rest_api_token"
url = "$kv_rest_api_url/ping"
output = "/tmp/lightfast-upstash-ping.json"
CURL

curl --config /tmp/lightfast-upstash-curl.conf

node <<'NODE'
const d = require("/tmp/lightfast-upstash-ping.json");
const ok = Array.isArray(d) ? d[0] === "PONG" : d?.result === "PONG";
if (!ok) process.exit(1);
NODE
```
