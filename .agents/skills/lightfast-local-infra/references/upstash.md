# Upstash Redis Up

`redis up` creates or reuses one Upstash Redis database for this checkout and
writes REST credentials to the app and platform local override env files.

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
eval "$(node .agents/skills/lightfast-local-infra/lib/compute-identity.mjs)"
```

This sets `redis_name` (and pscale fields that are unused here).

## Probe Remediation

`SKILL.md` already ran the basic probes. If login is needed for `upstash v0.3.x`:

```bash
upstash auth login --email "<email>" --api-key "<api-key>"
```

If a newer CLI changes flags, follow `upstash --help` and `upstash redis --help`
output instead of guessing.

## Create Or Reuse Database

```bash
upstash redis list --json > /tmp/lightfast-upstash-list.json

eval "$(node .agents/skills/lightfast-local-infra/lib/upstash-extract.mjs \
  --mode id --file /tmp/lightfast-upstash-list.json --name "$redis_name")"

if [ -z "$redis_id" ]; then
  upstash redis create --name "$redis_name" --region "$redis_region" --json > /tmp/lightfast-upstash-create.json
  eval "$(node .agents/skills/lightfast-local-infra/lib/upstash-extract.mjs \
    --mode id --file /tmp/lightfast-upstash-create.json)"
fi

test -n "$redis_id"
```

Fetch details:

```bash
upstash redis get --id "$redis_id" --json > /tmp/lightfast-upstash-db.json

eval "$(node .agents/skills/lightfast-local-infra/lib/upstash-extract.mjs \
  --mode rest --file /tmp/lightfast-upstash-db.json)"

test -n "$kv_rest_api_url" && test -n "$kv_rest_api_token"
```

Then write app and platform local override env files with
`references/env-files.md`.

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
