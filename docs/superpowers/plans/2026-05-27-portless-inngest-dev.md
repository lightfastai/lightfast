# Portless Inngest Dev Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the local Inngest dev server behind Portless and make app/platform dev event sends target that Portless URL.

**Architecture:** Keep `pnpm dev` as the single root entrypoint and wrap only the root `_inngest` task with `portless run --name inngest.lightfast`. Continue syncing concrete app and platform `/api/inngest` serve URLs into the CLI, while app and platform Next.js dev processes receive `INNGEST_DEV=$(portless get inngest.lightfast)` through their existing `with-related-projects` script wrappers.

**Tech Stack:** pnpm, Turborepo, package.json scripts, Portless, Inngest CLI, Inngest JS SDK.

---

## Execution Notes

- Start implementation from the repository root: `/Users/jeevanpillay/Code/@lightfastai/lightfast`.
- The worktree is dirty with unrelated app/API/db/docs changes. Preserve them. Stage only the three package files changed by this plan.
- If any unrelated changes are already staged when executing the plan, do not unstage them. Use the path-limited commit command in Task 1 so only the planned package files are committed.
- Use the current runnable CLI package: `npx inngest-cli@latest`, not `npx inngest@latest`.
- Do not write `INNGEST_DEV` into any `.vercel/.env.development.local` file. It is runtime route state derived by Portless.
- Do not change Inngest function code, event names, serve paths, signing keys, production env handling, `portless.json`, or microfrontends config.
- Do not add `INNGEST_DEV` to `apps/www/package.json` in this implementation. The current concrete serve URLs are app and platform, and current event sends live under app API code.

## File Structure

- Modify: `package.json`
  - Wrap the root `_inngest` script with `portless run --name inngest.lightfast`.
  - Pass Portless-injected `HOST` and `PORT` into `inngest-cli dev`.
  - Preserve explicit `-u "$(portless get app.lightfast)/api/inngest"` and `-u "$(portless get platform.lightfast)/api/inngest"`.
- Modify: `apps/app/package.json`
  - Add `INNGEST_DEV=$(portless get inngest.lightfast)` to `scripts.with-related-projects`.
- Modify: `apps/platform/package.json`
  - Add `INNGEST_DEV=$(portless get inngest.lightfast)` to `scripts.with-related-projects`.

## Task 1: Package Script Wiring

**Files:**
- Modify: `package.json:19`
- Modify: `apps/app/package.json:18`
- Modify: `apps/platform/package.json:16`

- [ ] **Step 1: Run the script assertion and verify it fails before edits**

Run:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const root = readJson("package.json");
const app = readJson("apps/app/package.json");
const platform = readJson("apps/platform/package.json");

const expectedInngestScript =
  "portless run --name inngest.lightfast sh -c 'npx inngest-cli@latest dev --no-discovery --host \"$HOST\" --port \"$PORT\" -u \"$(portless get app.lightfast)/api/inngest\" -u \"$(portless get platform.lightfast)/api/inngest\"'";

const expectedRelatedProjects =
  "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)";

if (root.scripts._inngest !== expectedInngestScript) {
  throw new Error(`root _inngest mismatch:\n${root.scripts._inngest}`);
}

for (const [name, pkg] of [
  ["app", app],
  ["platform", platform],
]) {
  if (pkg.scripts["with-related-projects"] !== expectedRelatedProjects) {
    throw new Error(`${name} with-related-projects mismatch:\n${pkg.scripts["with-related-projects"]}`);
  }
}

console.log("Portless Inngest package scripts are wired correctly.");
NODE
```

Expected: fail with `root _inngest mismatch` because `_inngest` is not yet wrapped by Portless.

- [ ] **Step 2: Update the root Inngest script**

In `package.json`, replace only the `_inngest` script with:

```json
"_inngest": "portless run --name inngest.lightfast sh -c 'npx inngest-cli@latest dev --no-discovery --host \"$HOST\" --port \"$PORT\" -u \"$(portless get app.lightfast)/api/inngest\" -u \"$(portless get platform.lightfast)/api/inngest\"'"
```

The surrounding scripts block should keep this shape:

```json
{
  "scripts": {
    "dev": "portless proxy start && VC_MICROFRONTENDS_CONFIG_FILE_NAME=disabled-microfrontends.json turbo run dev //#_mfe //#_inngest --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue",
    "_mfe": "portless run --name lightfast sh -c 'pnpm --dir apps/app exec microfrontends proxy ./microfrontends.json --port \"$PORT\" --local-apps lightfast-app lightfast-www --local-app-url lightfast-app=$(portless get app.lightfast) --local-app-url lightfast-www=$(portless get www.lightfast)'",
    "_inngest": "portless run --name inngest.lightfast sh -c 'npx inngest-cli@latest dev --no-discovery --host \"$HOST\" --port \"$PORT\" -u \"$(portless get app.lightfast)/api/inngest\" -u \"$(portless get platform.lightfast)/api/inngest\"'"
  }
}
```

- [ ] **Step 3: Update the app dev environment wrapper**

In `apps/app/package.json`, replace only `scripts.with-related-projects` with:

```json
"with-related-projects": "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)"
```

The scripts block should keep this shape:

```json
{
  "scripts": {
    "dev": "portless run",
    "_dev": "pnpm with-related-projects pnpm with-env next dev",
    "with-env": "dotenv -e ./.vercel/.env.development.local --",
    "with-related-projects": "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)"
  }
}
```

- [ ] **Step 4: Update the platform dev environment wrapper**

In `apps/platform/package.json`, replace only `scripts.with-related-projects` with:

```json
"with-related-projects": "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)"
```

The scripts block should keep this shape:

```json
{
  "scripts": {
    "dev": "portless run",
    "_dev": "pnpm with-related-projects pnpm with-env next dev",
    "with-env": "dotenv -e ./.vercel/.env.development.local --",
    "with-related-projects": "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)"
  }
}
```

- [ ] **Step 5: Re-run the script assertion and verify it passes**

Run the same assertion from Step 1:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const root = readJson("package.json");
const app = readJson("apps/app/package.json");
const platform = readJson("apps/platform/package.json");

const expectedInngestScript =
  "portless run --name inngest.lightfast sh -c 'npx inngest-cli@latest dev --no-discovery --host \"$HOST\" --port \"$PORT\" -u \"$(portless get app.lightfast)/api/inngest\" -u \"$(portless get platform.lightfast)/api/inngest\"'";

const expectedRelatedProjects =
  "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast)";

if (root.scripts._inngest !== expectedInngestScript) {
  throw new Error(`root _inngest mismatch:\n${root.scripts._inngest}`);
}

for (const [name, pkg] of [
  ["app", app],
  ["platform", platform],
]) {
  if (pkg.scripts["with-related-projects"] !== expectedRelatedProjects) {
    throw new Error(`${name} with-related-projects mismatch:\n${pkg.scripts["with-related-projects"]}`);
  }
}

console.log("Portless Inngest package scripts are wired correctly.");
NODE
```

Expected:

```text
Portless Inngest package scripts are wired correctly.
```

- [ ] **Step 6: Verify no durable env file was changed for `INNGEST_DEV`**

Run:

```bash
rg -n "INNGEST_DEV" apps/*/.vercel/.env.development.local || true
```

Expected: no output.

- [ ] **Step 7: Commit the script wiring**

Run:

```bash
git add package.json apps/app/package.json apps/platform/package.json
git diff --cached -- package.json apps/app/package.json apps/platform/package.json
git commit -m "chore: run local inngest through portless" -- package.json apps/app/package.json apps/platform/package.json
```

Expected: commit includes only the three package script changes.

## Task 2: Local Runtime Verification

**Files:**
- No file changes.

- [ ] **Step 1: Confirm the current Inngest CLI exposes the required flags**

Run:

```bash
npx --yes inngest-cli@latest dev --help
```

Expected output includes:

```text
--host
--port
--sdk-url
--no-discovery
```

- [ ] **Step 2: Start the Portless proxy**

Run:

```bash
portless proxy start
```

Expected: the proxy is running or already running. If it reports an existing active proxy, continue.

- [ ] **Step 3: Start only the Inngest dev task**

Run in a foreground terminal:

```bash
pnpm run _inngest
```

Expected:

```text
https://inngest.lightfast.localhost
Inngest Dev Server
```

The CLI may also log sync attempts for:

```text
https://app.lightfast.localhost/api/inngest
https://platform.lightfast.localhost/api/inngest
```

Those sync attempts can fail if app and platform are not running yet. The required check in this step is that the Inngest server itself starts behind the Portless route.

- [ ] **Step 4: Verify the Portless Inngest route responds**

In another terminal while Step 3 is still running, run:

```bash
portless get inngest.lightfast
curl -k "$(portless get inngest.lightfast)/dev"
```

Expected first command:

```text
https://inngest.lightfast.localhost
```

Expected second command: JSON containing the Inngest dev server version, for example:

```json
{"version":"1.22.0-334411311"}
```

The exact version may differ.

- [ ] **Step 5: Verify the SDK uses `INNGEST_DEV` as the event base URL**

Run:

```bash
INNGEST_DEV="$(portless get inngest.lightfast)" pnpm --filter @api/app exec node --input-type=module -e "const { Inngest } = await import('inngest'); const c = new Inngest({ id: 'lightfast-test' }); console.log(c.sendEventUrl.href)"
```

Expected primary-checkout output begins with:

```text
https://inngest.lightfast.localhost/e/
```

In a secondary worktree, expected output begins with the worktree-prefixed equivalent:

```text
https://<wt>.inngest.lightfast.localhost/e/
```

- [ ] **Step 6: Stop the standalone Inngest smoke process**

Stop the foreground `pnpm run _inngest` process from Step 3 with `Ctrl-C`.

Expected: the process exits without leaving a long-running shell session for this verification.

- [ ] **Step 7: Run the full dev stack smoke test**

Run:

```bash
pnpm dev
```

Expected:

```text
https://app.lightfast.localhost
https://www.lightfast.localhost
https://platform.lightfast.localhost
https://lightfast.localhost
https://inngest.lightfast.localhost
```

Also expected: Inngest logs show sync attempts for the concrete app and platform serve URLs:

```text
https://app.lightfast.localhost/api/inngest
https://platform.lightfast.localhost/api/inngest
```

Stop `pnpm dev` with `Ctrl-C` after verifying the routes and logs.

- [ ] **Step 8: Commit verification notes only if a tracked doc is intentionally updated**

No commit is required for this task because it has no planned file changes. If execution produces useful verification notes and the user asks to persist them, add them to the spec or plan in a separate docs-only commit.

## Acceptance Checklist

- [ ] `package.json` `_inngest` starts with `portless run --name inngest.lightfast`.
- [ ] `package.json` `_inngest` passes `--host "$HOST"` and `--port "$PORT"` to `inngest-cli dev`.
- [ ] `package.json` `_inngest` still passes concrete app and platform `/api/inngest` URLs with repeated `-u` flags.
- [ ] `apps/app/package.json` `with-related-projects` includes `INNGEST_DEV=$(portless get inngest.lightfast)`.
- [ ] `apps/platform/package.json` `with-related-projects` includes `INNGEST_DEV=$(portless get inngest.lightfast)`.
- [ ] No `.vercel/.env.development.local` file contains `INNGEST_DEV`.
- [ ] `curl -k "$(portless get inngest.lightfast)/dev"` returns Inngest dev server JSON while `_inngest` is running.
- [ ] The SDK `sendEventUrl` begins with `$(portless get inngest.lightfast)/e/`.
- [ ] `pnpm dev` starts app, www, platform, aggregate MFE, and Inngest behind Portless without manually pinned Inngest ports.
