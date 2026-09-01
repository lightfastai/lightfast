# Retire Private Apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the private `apps/app` and `apps/mcp` products without creating a replacement hosted backend, retain the public packages and supporting data/tooling layers, and provide a local-only TanStack Start example built from `@repo/ui-v2`.

**Architecture:** The tracked private application trees and their exclusive launch/deployment helpers are deleted. Surviving SDK, MCP, CLI, desktop, API, DB, eval, and E2E packages become explicitly configurable at their own boundaries, while the root developer entrypoint starts only a local example and Storybook through Portless. Public website links stay intact because `lightfastai/www` owns that separate public surface.

**Tech Stack:** pnpm 11 workspaces, Turborepo, TypeScript, React 19, TanStack Start/Router, Vite, Vitest, Portless, Changesets.

---

## File structure and boundaries

- Delete tracked `apps/app/**` and `apps/mcp/**`; do not touch ignored files in those paths and do not touch any Vercel project.
- Create `apps/example/**` as a local-only TanStack Start application. It has no `vercel.json`, `.vercel`, microfrontend configuration, hosted endpoint, auth provider, database, queues, or production deployment contract.
- Keep `api/app`, `db/app`, `ai`, `e2e`, connectors, emulators, `apps/desktop`, `packages/ui-v2`, `core/mcp`, `core/lightfast`, and `core/cli` buildable/configurable.
- Keep `https://lightfast.ai` when it identifies the public website, documentation, metadata homepage, email assets, or fixture data. Remove it only when it is an implicit API, OAuth, MCP, CLI, or desktop backend.
- Preserve all production providers and production identities. Repository changes must not unlink, delete, rotate, revoke, deploy, cut over, merge, or alter domains.

### Task 1: Retire the private applications and add the local example

**Files:**
- Delete: `apps/app/**`
- Delete: `apps/mcp/**`
- Create: `apps/example/package.json`
- Create: `apps/example/vite.config.ts`
- Create: `apps/example/tsconfig.json`
- Create: `apps/example/turbo.json`
- Create: `apps/example/postcss.config.mjs`
- Create: `apps/example/src/router.tsx`
- Create: `apps/example/src/start.ts`
- Create: `apps/example/src/routes/__root.tsx`
- Create: `apps/example/src/routes/index.tsx`
- Create: `apps/example/src/styles.css`
- Create: `apps/example/README.md`
- Generate: `apps/example/src/routeTree.gen.ts`
- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `knip.json`
- Modify: `pnpm-workspace.yaml`
- Delete: `patches/@vercel__microfrontends@2.3.2.patch`

- [x] **Step 1: Remove the exact tracked private app trees**

Resolve the deletion set only from Git, then remove those tracked paths. Do not run clean commands and do not delete ignored files:

```bash
git ls-files apps/app apps/mcp
git rm -r -- apps/app apps/mcp
```

Expected: only tracked files under the two approved directories are staged as deleted.

- [x] **Step 2: Create the local example package and workspace configuration**

Use package name `@lightfast/example`, `portless: "example.lightfast"`, and these scripts:

```json
{
  "build": "vite build",
    "clean": "git clean -xdf .cache .tanstack .turbo dist node_modules src/routeTree.gen.ts",
  "dev": "portless run vite dev",
  "typecheck": "tsc --noEmit"
}
```

Declare `@repo/ui-v2` with `workspace:*`; declare React and TanStack packages with workspace catalogs. Configure `tanstackStart()` before `react()` and pass Portless `HOST`, `PORT`, and `PORTLESS_URL` into Vite's server/HMR options. Extend the root TypeScript configuration and map `@repo/ui-v2/*` to `../../packages/ui-v2/src/*`.

- [x] **Step 3: Create the minimal Start router and shared-UI page**

The router factory must register its inferred type:

```tsx
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

The root document must render `<HeadContent />`, `<Outlet />`, and `<Scripts />`, and import `styles.css`. The index route must import `Logo`, `Button`, and `Card` primitives from `@repo/ui-v2` and explain that the example is local-only and has no production backend.

- [x] **Step 4: Replace the root developer entrypoint**

Change root scripts to:

```json
{
  "build:example": "turbo run build -F @lightfast/example",
  "dev": "portless proxy start && turbo run dev -F @lightfast/example -F @lightfast/storybook --continue"
}
```

Remove `build:app`, `build:mcp`, and the retired root `_inngest`, `_qstash`, and emulator launch helpers. Remove their root-task entries from `turbo.json`. Replace Knip's `apps/app` and `apps/mcp` entries with an `apps/example` entry covering `src/router.tsx`, `src/start.ts`, `src/routes/**/*.tsx`, and `vite.config.ts`.

Remove the `@vercel/microfrontends` patched-dependency registration and its patch file because the deleted private app was its only workspace consumer.
Exclude `apps/app` and `apps/mcp` from the workspace glob so preserved ignored local files in those directories are not treated as package directories.

- [x] **Step 5: Generate and build the route tree**

Run:

```bash
pnpm --filter @lightfast/example build
pnpm --filter @lightfast/example typecheck
```

Expected: Vite generates `src/routeTree.gen.ts`; both commands exit 0.

### Task 2: Remove implicit hosted client backends

**Files:**
- Modify: `core/lightfast/src/__tests__/client.test.ts`
- Modify: `core/lightfast/src/index.ts`
- Modify: `core/lightfast/README.md`
- Create: `core/mcp/src/config.ts`
- Create: `core/mcp/src/__tests__/config.test.ts`
- Modify: `core/mcp/src/index.ts`
- Modify: `core/mcp/README.md`
- Create: `core/cli/src/__tests__/auth-config.test.ts`
- Modify: `core/cli/src/auth/config.ts`
- Modify: `core/cli/README.md`
- Modify: `apps/desktop/src/__tests__/main-app-origin.test.ts`
- Modify: `apps/desktop/src/main/app-origin.ts`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/.env.example`
- Modify: `apps/desktop/README.md`
- Modify: `apps/desktop/test/e2e/boot.spec.ts`
- Create: `.changeset/require-explicit-client-endpoints.md`

- [x] **Step 1: Make the SDK base URL required**

First change SDK tests so every API-key validation call supplies `{ baseUrl: "https://example.test" }`, then add an explicit compile-time expectation that `LightfastOptions["baseUrl"]` is `string`. Run the SDK test and confirm it fails while `baseUrl` remains optional.

Implement:

```ts
export interface LightfastOptions {
  /** Base URL of the Lightfast-compatible API. */
  baseUrl: string;
  fetch?: typeof fetch;
}

export function createLightfast(
  apiKey: string,
  options: LightfastOptions
): LightfastClient {
  const normalizedBase = normalizeBaseUrl(options.baseUrl);
  // existing client implementation remains unchanged
}
```

Add README usage showing `createLightfast("lf_...", { baseUrl: process.env.LIGHTFAST_API_URL! })`. Run `pnpm --filter lightfast test` and `pnpm --filter lightfast typecheck`.

- [x] **Step 2: Require both MCP environment variables through a testable seam**

Write tests for this public configuration behavior:

```ts
expect(() => getLightfastMcpConfig({ LIGHTFAST_API_KEY: "lf_test" })).toThrow(
  /LIGHTFAST_API_URL/
);
expect(
  getLightfastMcpConfig({
    LIGHTFAST_API_KEY: "lf_test",
    LIGHTFAST_API_URL: "https://api.example.test",
  })
).toEqual({ apiKey: "lf_test", baseUrl: "https://api.example.test" });
```

Implement `getLightfastMcpConfig(env)` in `core/mcp/src/config.ts`, use it from `src/index.ts`, and always call `createLightfast(apiKey, { baseUrl })`. Remove the hosted OAuth section from the MCP README and document both required variables. Run MCP tests and typecheck.

- [x] **Step 3: Require the CLI app URL at use time**

Add a module-mocked config test proving a missing `LIGHTFAST_APP_URL` throws a clear error and a configured URL has one trailing slash removed. Then remove `DEFAULT_APP_URL` and implement:

```ts
export function getAppUrl(): string {
  const appUrl = cliEnv.LIGHTFAST_APP_URL;
  if (!appUrl) {
    throw new Error(
      "LIGHTFAST_APP_URL is required for Lightfast login and backend commands."
    );
  }
  return appUrl.replace(/\/$/, "");
}
```

Change the README environment table from “override/default” wording to “required for login and backend commands.” Run CLI tests and typecheck.

- [x] **Step 4: Require desktop `APP_URL` for every build flavor**

Replace the production-default test with tests that `dev` and `prod` both return the explicit `APP_URL` origin and both throw when it is absent. Remove `PRODUCTION_APP_ORIGIN` and branch-independent fallback behavior from `app-origin.ts`; retain `buildFlavorSchema.parse()` and URL-origin validation. Change desktop scripts to load a package-local `.env.local` without injecting Portless:

```json
{
  "dev": "pnpm with-env electron-forge start",
  "with-env": "dotenv -e ./.env.local --"
}
```

Document `APP_URL` as required in `.env.example` and explain in the README that the caller chooses the backend; the desktop package does not infer a local or production endpoint. Run the focused desktop origin test and desktop typecheck.
Make the desktop E2E smoke test require `APP_URL` instead of discovering the retired Portless aggregate.

- [x] **Step 5: Record the public breaking configuration change**

Create a Changeset with `minor` releases for `lightfast`, `@lightfastai/mcp`, and `@lightfastai/cli`, stating that callers must now configure their backend explicitly and that no hosted default is supplied.

### Task 3: Relocate surviving environment and contract boundaries

**Files:**
- Modify: `ai/package.json`
- Modify: `ai/evals/triage-env.ts`
- Modify: `api/app/package.json`
- Modify: `api/app/src/__tests__/app-setup-contract-source.test.ts`
- Modify: `db/app/package.json`
- Modify: `db/CLAUDE.md`
- Modify: `e2e/package.json`
- Modify: `.agents/skills/lightfast-local-infra/references/env-files.md`
- Modify: `.agents/skills/lightfast-local-infra/references/planetscale.md`
- Modify: `.agents/skills/lightfast-local-infra/references/upstash.md`
- Modify: `.agents/skills/lightfast-local-infra/lib/write-env.mjs`
- Modify: `.agents/skills/planetscale-drizzle/SKILL.md`
- Modify: `packages/app-encryption/ENCRYPTION.md`
- Modify: `packages/app-validation/src/forms/account-form.ts`
- Modify: `packages/app-validation/src/forms/team-form.ts`

- [x] **Step 1: Make every surviving package load its own ignored env file**

Use these exact package-local chains:

```text
ai:       dotenv -e ./.env.local --
api/app:  dotenv -e ./.env.overrides.local -e ./.env.local --
db/app:   dotenv -e ./.env.overrides.local -e ./.env.local --
e2e:      dotenv -e ./.env.local --
desktop:  dotenv -e ./.env.local --
```

Remove `with-env:vercel` scripts from API and DB, and retain `with-env` / `with-env:local` as equivalent package-local chains. Update the AI eval error to tell operators to create `ai/.env.local`; do not pull or copy secrets as part of this change.

- [x] **Step 2: Preserve the org-setup boundary test without the retired app**

Rename the first API test to “keeps org setup schemas in api-contract.” Remove reads of `apps/app/package.json` and scans of `apps/app/src`; retain assertions that the old package is absent, API has no old dependency, `packages/api-contract/src/index.ts` exports `org-setup`, and no remaining API/API-contract source imports the old package.

- [x] **Step 3: Update local-infrastructure target files**

Change the env reference so PlanetScale credentials are written to both:

```text
api/app/.env.overrides.local
db/app/.env.overrides.local
```

Change Upstash credentials to target only:

```text
api/app/.env.overrides.local
```

Validation prints key names only. Update the PlanetScale/Upstash runbooks and the helper's usage comment to match. Update the PlanetScale Drizzle skill to identify both package-local DB credential files. Do not read, generate, or move any secret values during this repository edit.

- [x] **Step 4: Remove stale consumer comments and encryption docs**

State that `api/app` validates `ENCRYPTION_KEY`; remove comments whose only examples are deleted UI files. Preserve all actual schemas and runtime code.

### Task 4: Clean active tooling, CI, docs, and exclusive assets

**Files:**
- Delete: `scripts/cloud/setup.sh`
- Delete: `scripts/cloud/dev.sh`
- Delete: `scripts/verify-react-compiler.mjs`
- Modify: `.github/workflows/ci-core.yml`
- Modify: `.coderabbit.yaml`
- Modify: `.codex/config.toml`
- Modify: `.claude/commands/validate_plan.md`
- Modify: `.agents/skills/autofix/SKILL.md`
- Modify: `.agents/skills/loop-on-ci/SKILL.md`
- Modify: `packages/app-reserved-names/src/__tests__/route-coverage.test.ts`
- Modify: `packages/app-reserved-names/README.md`
- Modify: `packages/remotion/src/manifest.ts`
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CONTEXT.md`

- [x] **Step 1: Delete private-app-exclusive scripts and config**

Delete the cloud hydration scripts (they link only the retired Vercel projects) and the React compiler verifier (it reads only `apps/app/.next`). Remove the repository MCP server entry pointing to `https://mcp.lightfast.ai/mcp`; this edits only checked-in local configuration and does not stop any hosted server.

- [x] **Step 2: Remove dead CI and review paths**

Delete the two `apps/app/src/app/(api)/api/v1/**` trigger entries from `ci-core.yml`. Replace CodeRabbit's `apps/app/**` path guidance with `apps/example/**` guidance for TanStack Start, shared UI imports, and the local-only/no-production-config boundary. Remove retired microfrontend config paths from CI/autofix release-sensitive filters and change plan validation examples to `build:example` plus package-specific builds.

- [x] **Step 3: Preserve reserved website names without filesystem coupling**

Replace route discovery with a static `deployedMarketingNames` contract and assert every name remains reserved. Delete all filesystem and microfrontend parser helpers. Update the README to explain that the stable public names are a local contract and do not read another repository.

- [x] **Step 4: Remove remotion destinations owned only by the retired app**

Delete the favicon, Apple touch, and Android icon compositions whose only destination is `apps/app/public`, plus the ICO post-process entry. Preserve general logo and social-banner renders under `apps/remotion/out`.

- [x] **Step 5: Rewrite active repository guidance**

Document this current shape:

```text
local root dev: example.lightfast + storybook.lightfast through Portless
public website: external lightfastai/www repository
backend packages: api/app and db/app, with no hosted default supplied here
clients: SDK/MCP/CLI/desktop require explicit endpoint configuration
production providers: preserved and managed separately from this retirement PR
```

Do not rewrite historical design documents, reports, plans, changelog entries, public website links, fixtures, email links, or package homepage metadata.

### Task 5: Refresh, verify, commit, push, and open the PR

**Files:**
- Modify: `pnpm-lock.yaml`
- Verify: all changed and retained package surfaces

- [x] **Step 1: Refresh the workspace lockfile**

Run:

```bash
pnpm install
pnpm install --frozen-lockfile
```

Expected: deleted importers disappear, `apps/example` appears, and the frozen install exits 0.

- [x] **Step 2: Run focused verification**

Run:

```bash
pnpm --filter @lightfast/example build
pnpm --filter @lightfast/example typecheck
pnpm --filter lightfast test
pnpm --filter lightfast typecheck
pnpm --filter @lightfastai/mcp test
pnpm --filter @lightfastai/mcp typecheck
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
pnpm --filter @lightfast/desktop test -- src/__tests__/main-app-origin.test.ts
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @repo/app-reserved-names test
pnpm --filter @api/app test -- src/__tests__/app-setup-contract-source.test.ts
```

Expected: every command exits 0 with no failed test.

- [x] **Step 3: Run repository verification**

Run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm lint:ws
pnpm verify:public-api
```

Expected: all commands exit 0.

- [x] **Step 4: Audit scope and stale active references**

Confirm `apps/example` has no production config and audit active files while excluding historical plans/specs/reports/changelogs and valid website links:

```bash
find apps/example -maxdepth 2 \( -name vercel.json -o -name .vercel -o -name microfrontends.json \) -print
git grep -n -E 'apps/(app|mcp)|@lightfast/(app|mcp)|build:(app|mcp)|mcp\.lightfast\.ai' -- ':!docs/superpowers/**' ':!thoughts/**' ':!**/CHANGELOG.md'
git diff --check
git status --short
```

Expected: no production config under the example, no unintended active references, no whitespace errors, and only in-scope changes.

- [ ] **Step 5: Commit from the managed detached worktree**

Create reviewable commits without attaching or moving the branch checked out in the preserved `00b0` worktree:

```bash
git add -A
git commit -m "refactor: retire private app surfaces"
```

Record the exact commit ID with `git rev-parse HEAD`.

- [ ] **Step 6: Push and create a PR without merging**

Push the detached commit explicitly:

```bash
git push origin HEAD:feat/retire-app-mcp
gh pr create --base main --head feat/retire-app-mcp \
  --title "refactor: retire private app surfaces" \
  --body "Retires the tracked private app and hosted MCP application surfaces, adds a local-only TanStack Start example, and requires explicit endpoints for retained clients. R0 backup item: tnexig2acheiv44f5ss46ayg6a. Verification and preserved-boundary details are recorded in the final task handoff. No production provider, domain, deployment, credential, queue, Sentry, deletion, or merge effects are included."
```

The PR body must state the R0 item identity, repository scope, explicit endpoint changes, verification evidence, preserved providers/worktrees, and that merge/provider effects remain approval-gated. Do not merge.

## Self-review

- Spec coverage: every requested retirement, preservation boundary, client compatibility change, local example, active tooling cleanup, test, push, and PR action maps to a task above.
- Placeholder scan: the plan contains no deferred implementation steps; hosted provider actions are explicitly excluded rather than deferred as repository work.
- Type consistency: `baseUrl`, `LIGHTFAST_API_URL`, `LIGHTFAST_APP_URL`, and `APP_URL` are the exact existing names used by each surviving client boundary.
- Scope consistency: public website URLs and independent packages remain; only implicit backend defaults and tracked private-app-exclusive files are removed.
