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
const pscaleBranch = `wt-${prefix}-${rootHash}`
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 63);
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
const credentialName = `lightfast-${process.env.USER ?? "local"}-${rootHash}-${stamp}`;

console.log(`database_name=lightfast`);
console.log(`base_branch=main`);
console.log(`pscale_branch=${pscaleBranch}`);
console.log(`pscale_credential_name=${credentialName}`);
NODE
)"
```

## Probe

```bash
command -v pscale
pscale --version
pscale auth check
pscale org list --format json
```

If auth is missing, ask the human to run this in a real terminal:

```bash
pscale auth login
```

If the current org is not `lightfast`, explain the change and run:

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

test -n "$database_host"
test -n "$database_username"
test -n "$database_password"
```

Then write the app env file with `references/env-files.md`.

## Verify

```bash
pnpm --filter @db/app db:migrate
pnpm --filter @db/app db:studio -- --help
```

If the password is lost or rotated, rerun this runbook to mint and write a new
branch password.
