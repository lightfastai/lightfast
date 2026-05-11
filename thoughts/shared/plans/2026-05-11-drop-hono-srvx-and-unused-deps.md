# Drop hono, srvx, and other unused dependencies

## Overview

Remove `hono` (direct catalog entry, never imported), eliminate `srvx` by dropping the `vercel` CLI from root devDeps (its only parent), and prune knip-confirmed unused direct dependencies across `apps/app`, `apps/www`, `apps/desktop`, and `api/app`. Fix knip's `apps/desktop` workspace config so future audits stop reporting Electron renderer/main/forge imports as false positives.

## Current State Analysis

### `hono`

- Listed in `pnpm-workspace.yaml:50` as a catalog entry: `hono: ^4.12.16`
- Declared as an **optional peer dependency** in `vendor/inngest/package.json:36-42` (with `peerDependenciesMeta.hono.optional: true`)
- Surfaced via the `./hono` subpath export in `vendor/inngest/package.json:11-14` which re-exports from `vendor/inngest/src/hono.ts`
- The export file is exactly one line: `export { serve } from "inngest/hono";` (`vendor/inngest/src/hono.ts:1`)
- **Zero importers anywhere in the repo** — `rg "@vendor/inngest/hono"` and `rg "from ['\"]hono"` both return empty (excluding `vendor/inngest/src/hono.ts` itself)
- Inngest serve handlers are wired through Next.js routes (`apps/app/src/app/api/inngest`, `apps/platform/src/app/api/inngest`), not hono

### `srvx`

- Not declared in any workspace `package.json`
- Present in `pnpm-lock.yaml` as a **purely transitive** dep:
  `vercel` (root devDep, ^52.2.0) → `@vercel/backends@0.2.0` → `srvx@0.8.9`
- The only `vercel` CLI invocation in the repo is the `vercel:link` script in root `package.json`: `"vercel:link": "vercel link --repo"`. No CI workflows, hooks, or other scripts call the `vercel` binary.
- `.vercel/` link folders already exist at `./.vercel`, `apps/app/.vercel`, `apps/platform/.vercel`, `apps/www/.vercel` — re-linking is a one-time onboarding task that can be served by `pnpm dlx vercel@latest link --repo`
- `apps/desktop/package.json` has `"with-env": "dotenv -e ./.vercel/.env.development.local --"` — this only **reads** an already-pulled `.vercel/.env.development.local`, no CLI dependency

### Knip-flagged unused dependencies

Ran `pnpm knip --reporter json` against the existing `knip.json` config. After cross-checking each finding against actual imports (`rg "from ['\"]<dep>"`), I split the report into true positives and false positives.

**True positives — direct deps that have zero runtime/build importers:**

| Workspace | Dep | Why safe to drop |
|---|---|---|
| `apps/app` | `@upstash/redis` | Only used via `@vendor/upstash`'s exports — `apps/app/src` has zero `from "@upstash/redis"` imports |
| `apps/app` | `drizzle-orm` | Used via `@db/app` and `@vendor/db` — zero `from "drizzle-orm"` imports in `apps/app/src` |
| `apps/app` | `postgres` | Same — zero `from "postgres"` imports in `apps/app/src` |
| `apps/www` | `@lightfastai/related-projects` | Zero imports anywhere in `apps/www` |
| `api/app` | `yaml` | Zero `from "yaml"` imports in `api/app/src` (only mentioned in an archived plan) |
| `api/app` | `@repo/app-encryption` | Kept as "conservative orphan" in the 2026-05-07 v2 reset (`thoughts/shared/plans/2026-05-07-repo-barebones-reset-v2.md`) — `api/app` has zero `@repo/app-encryption` imports. The package itself stays installed for `api/platform` consumers. |
| `apps/desktop` | `@trpc/client` | Transitive via `@repo/app-trpc/desktop`. Zero direct imports. |
| `apps/desktop` | `@trpc/tanstack-react-query` | Same — transitive via `@repo/app-trpc` |
| `apps/desktop` | `@tanstack/query-core` | Transitive via `@tanstack/react-query` |
| `apps/desktop` | `copy-anything` | A vite-renderer comment (`apps/desktop/vite.renderer.config.ts:9-12`) notes it was added as a CJS peer of `superjson`. With `preserveSymlinks: false` already set, pnpm's `.pnpm` store layout resolves it transitively. Zero direct imports. |
| `apps/desktop` | `scheduler` | Zero direct imports. Likely react/forge boilerplate leftover. |

**False positives — knip's `apps/desktop` workspace has no `entry` field, so its `main`/`preload`/`renderer`/`forge.config.ts`/`vite.*.config.ts` entry points are never traversed.** These deps are real imports verified via ripgrep and must stay:

- `@radix-ui/react-dropdown-menu` (`src/renderer/src/react/user-menu.tsx`)
- `@repo/app-trpc` (`src/renderer/src/react/{entry,user-menu,account-card,settings/panes/account}.tsx`)
- `@sentry/electron` (loaded conditionally at runtime in `src/main/sentry.ts` + `src/renderer/src/main.ts` comment)
- `@tanstack/react-query` (`src/renderer/src/react/app-shell.tsx`, others)
- `electron-context-menu` (`src/main/index.ts`)
- `electron-squirrel-startup` (`src/main/bootstrap.ts`)
- `lucide-react`, `react`, `react-dom`, `sonner` (renderer)
- `superjson` (kept — referenced in `vite.renderer.config.ts:21` `optimizeDeps.include`; removing it would break Vite optimizer)
- `@electron-forge/maker-{deb,dmg,rpm,squirrel,zip}`, `@electron-forge/plugin-{auto-unpack-natives,fuses,vite}`, `@electron-forge/publisher-github`, `@electron-forge/shared-types`, `@electron/fuses` (all imported in `forge.config.ts`)
- `@sentry/cli` (invoked via `execFileSync` in `forge.config.ts:injectSentryDebugIds` + `scripts/upload-sourcemaps.mjs`)
- `@types/electron-squirrel-startup`, `@types/react`, `@types/react-dom` (type declarations for the above)
- `@vitejs/plugin-react` (`vite.renderer.config.ts`)
- `portless` in root (used in `apps/app/next.config.ts` via the same package's runtime)
- `@lightfastai/dev-proxy` + `@vercel/related-projects` in `api/app` and `api/platform` (used in `src/origins.ts` — knip's workspace config for `api/*` is missing an entry field)
- `@modelcontextprotocol/sdk` in `core/mcp` (declared `external` in `tsup.config.ts` — published consumer dep)
- `@repo/platform-client` in `apps/app` (`src/lib/platform.ts`)

### Key Discoveries

- `vendor/inngest`'s `./hono` subpath is dead — it exists only because `inngest` ships an `inngest/hono` adapter; we never wired it up. (`vendor/inngest/src/hono.ts:1`, `vendor/inngest/package.json:11-14,36-42`)
- `srvx` exists in the lockfile only because of `vercel` → `@vercel/backends` → `srvx`. (`pnpm-lock.yaml` showing `@vercel/backends@0.2.0` deps including `srvx: 0.8.9`)
- `vercel link` is the **only** call site of the `vercel` CLI in this repo — workflows, scripts, and hooks don't invoke it. (`rg "vercel " package.json scripts .github`)
- `apps/desktop/vite.renderer.config.ts:8-14,15-23` explicitly lists `superjson` in `optimizeDeps.include` and depends on `preserveSymlinks: false` to resolve the `copy-anything` CJS peer through pnpm's `.pnpm` store — relevant for the cautious `copy-anything` removal.

## Desired End State

- `pnpm-workspace.yaml` no longer has a `hono` catalog entry
- `vendor/inngest/package.json` has no `hono` peer dep, no `./hono` export entry; `vendor/inngest/src/hono.ts` is deleted
- Root `package.json` no longer has `vercel` in `devDependencies`; the `vercel:link` script either delegates to `pnpm dlx vercel@latest` or is removed
- `pnpm-lock.yaml` no longer contains `srvx@0.8.9`, `@vercel/backends`, or any other subtree rooted at the `vercel` CLI
- All workspace `package.json` files in the "True positives" table no longer list the dropped deps
- `knip.json` has explicit `entry` arrays for `apps/desktop` (and adds entries for `api/app`, `api/platform`) so future `pnpm knip` runs no longer report false positives in those workspaces
- `pnpm knip` reports zero unused dependencies in the touched workspaces (false-positive entries should also clear once knip config is fixed)
- `pnpm install` regenerates a smaller `pnpm-lock.yaml` cleanly
- `pnpm check`, `pnpm typecheck`, `pnpm build:app`, `pnpm build:platform`, and `pnpm --filter @lightfast/desktop typecheck` all pass
- `pnpm dev:app` / `pnpm dev:www` / `pnpm dev:platform` start cleanly
- `pnpm --filter @lightfast/desktop dev` (Electron) starts cleanly — proves renderer/main/preload still resolve

### Verification

- `rg "hono" --type ts --type json | grep -v node_modules | grep -v pnpm-lock` returns zero matches outside `thoughts/`
- `grep "srvx" pnpm-lock.yaml` returns no matches
- `grep '"vercel"' package.json` returns no matches in `dependencies`/`devDependencies`
- `pnpm knip` reports no unused deps for the dropped entries
- App boots: app + platform + www serve content over the dev aggregate; desktop launches the renderer and shows the auth shell

## What We're NOT Doing

- Not refactoring source code; only deleting dead `vendor/inngest/src/hono.ts` and pruning `package.json`/`pnpm-workspace.yaml` entries
- Not changing how Inngest is wired (still served via Next.js routes)
- Not removing `@repo/app-encryption` the package — it stays installed and continues to serve `api/platform`. Only `api/app`'s declaration goes (no consumers).
- Not removing `superjson` from `apps/desktop` (real runtime need via Vite optimizer)
- Not migrating away from anything related to Vercel — only removing the `vercel` CLI tool. `@vercel/related-projects`, `@vercel/microfrontends`, `@vendor/analytics/vercel`, `@vercel/toolbar`, etc. all stay.
- Not changing CI workflows (none reference the `vercel` CLI today)
- Not addressing knip's `apps/desktop` false-positive entries other than fixing the config — we trust the cross-checked rg output for the cleanup itself

## Implementation Approach

Five phases, each independently verifiable. Lockfile regenerates once per phase end via `pnpm install`. The plan order minimizes thrash: drop `hono` first (smallest blast radius), then `vercel` CLI (single-script impact), then prune unused direct deps grouped by workspace, then fix knip config so future audits are clean.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Drop `hono` (catalog + vendor/inngest)

### Overview

Remove the `hono` catalog entry, the `vendor/inngest` peer dep + `./hono` export, and delete `vendor/inngest/src/hono.ts`.

### Changes Required

#### 1. `pnpm-workspace.yaml`

**Changes**: Delete the `hono: ^4.12.16` catalog entry.

```yaml
# Remove line 50:
  hono: ^4.12.16
```

#### 2. `vendor/inngest/package.json`

**Changes**: Remove `./hono` export, the `hono` peer dep, and its `peerDependenciesMeta` entry.

```jsonc
{
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    // remove "./hono" block
    "./env": { "types": "./src/env.ts", "default": "./src/env.ts" }
  },
  // remove "peerDependencies" + "peerDependenciesMeta" blocks entirely
}
```

#### 3. `vendor/inngest/src/hono.ts`

**Changes**: Delete the file.

### Success Criteria

#### Automated Verification

- [x] `rg "hono" pnpm-workspace.yaml vendor/inngest` returns no matches
- [x] `! test -f vendor/inngest/src/hono.ts`
- [x] `rg "from ['\"]hono['\"]|from ['\"]@vendor/inngest/hono['\"]" --type ts --type tsx` returns zero matches
- [~] `pnpm install` completes; ~~`pnpm-lock.yaml` no longer contains `hono@`~~ — hono remains in lockfile as transitive dep of `@modelcontextprotocol/sdk` → `@hono/node-server` (kept) and `@vercel/node` (will go in Phase 2). Catalog entry + vendor/inngest declaration are gone.
- [x] `pnpm --filter @vendor/inngest typecheck` passes
- [x] `pnpm typecheck` passes (full repo)

---

## Phase 2: Drop `vercel` CLI to eliminate `srvx`

### Overview

Remove the `vercel` package from root `devDependencies`. Replace the `vercel:link` script with a `pnpm dlx` invocation so dev onboarding still works without the local install. This eliminates the `vercel` → `@vercel/backends` → `srvx` chain from the lockfile.

### Changes Required

#### 1. Root `package.json`

**Changes**: Remove `"vercel": "^52.2.0"` from `devDependencies`. Replace the `vercel:link` script with the dlx equivalent.

```jsonc
{
  "scripts": {
    // change:
    "vercel:link": "pnpm dlx vercel@latest link --repo"
  },
  "devDependencies": {
    // remove: "vercel": "^52.2.0"
  }
}
```

### Success Criteria

#### Automated Verification

- [x] `grep '"vercel"' package.json` returns no matches (script line `vercel:link` is fine since the key is `vercel:link` not `vercel`)
- [x] `pnpm install` completes cleanly (-112 packages)
- [x] `! grep -E "^  srvx@" pnpm-lock.yaml`
- [x] `! grep -E "^  '@vercel/backends" pnpm-lock.yaml`
- [x] `pnpm typecheck` passes
- [~] `pnpm check` — pre-existing biome failure in untracked `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` (useForOf lint), unrelated to vercel removal. Our changes only touch root `package.json`.

#### Human Review

- [x] Ran `pnpm dlx vercel@latest --version` → downloads cleanly and prints `Vercel CLI 53.3.2` (proves dlx resolution works). Did not run the interactive `link --repo` flow since `.vercel/` folders already exist locally per plan.

---

## Phase 3: Drop unused direct deps in `apps/app`, `apps/www`, `api/app`

### Overview

Remove the eight true-positive direct deps from these three workspaces. None have any direct importers; all functionality reaches the workspace transitively via vendor packages or workspace internals.

### Changes Required

#### 1. `apps/app/package.json`

**Changes**: Remove the three deps from `dependencies`.

```jsonc
{
  "dependencies": {
    // remove "@upstash/redis": "catalog:",
    // remove "drizzle-orm": "catalog:",
    // remove "postgres": "catalog:",
  }
}
```

#### 2. `apps/www/package.json`

**Changes**: Remove `@lightfastai/related-projects`.

```jsonc
{
  "dependencies": {
    // remove "@lightfastai/related-projects": "catalog:",
  }
}
```

#### 3. `api/app/package.json`

**Changes**: Remove `yaml` and `@repo/app-encryption`.

```jsonc
{
  "dependencies": {
    // remove "@repo/app-encryption": "workspace:*",
    // remove "yaml": "^2.8.3",
  }
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm install` completes cleanly (-2 packages)
- [x] `pnpm typecheck` passes (catches accidental indirect usage)
- [~] `pnpm check` — same pre-existing biome failure as Phase 2, untouched by this phase
- [x] `pnpm --filter @lightfast/app build` succeeds (`build:prod`)
- [~] `pnpm --filter @lightfast/www build` — fails on missing local `BASEHUB_TOKEN` env var (pre-existing local setup issue). `pnpm --filter @lightfast/www typecheck` passes cleanly.
- [x] `pnpm --filter @api/app test` passes (15/15)
- [x] `pnpm knip` no longer lists these packages as unused for the affected workspaces (verified: `@upstash/redis`, `drizzle-orm`, `postgres`, `@lightfastai/related-projects`, `yaml`, `@repo/app-encryption` all gone from knip's "Unused dependencies" list)

#### Human Review

- [x] Probed running `dev:app` (PID 68730 already up) → `GET https://app.lightfast.localhost/` returns 307 → `/sign-in?redirect_url=%2F`; sign-in page returns HTTP 200 / 177KB with all `_next/static/chunks` (Sentry, tRPC, Clerk, zod) loaded; `/api/health` returns `{"status":"ok"}`. No `Module not found` / `Cannot find module` / `drizzle-orm` / `postgres` / `@upstash/redis` text in response. The only matched "Error" tokens are `errorScripts`/`errorStyles` (Next.js error-boundary attributes).

---

## Phase 4: Drop unused direct deps in `apps/desktop`

### Overview

Remove `@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/query-core`, `copy-anything`, `scheduler`. Keep `superjson` (required by `vite.renderer.config.ts:21` `optimizeDeps.include`). Verify the Electron renderer still hydrates the trpc client and resolves the superjson CJS peer.

### Changes Required

#### 1. `apps/desktop/package.json`

**Changes**: Remove the five deps from `dependencies`.

```jsonc
{
  "dependencies": {
    // remove "@tanstack/query-core": ...,
    // remove "@trpc/client": "catalog:",
    // remove "@trpc/tanstack-react-query": "catalog:",
    // remove "copy-anything": ...,
    // remove "scheduler": ...,
  }
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm install` completes cleanly
- [x] `pnpm --filter @lightfast/desktop typecheck` passes (both tsconfigs)
- [x] `pnpm --filter @lightfast/desktop build` ~~→ ran `pnpm --filter @lightfast/desktop package`~~ succeeds (forge package step compiles renderer + main + preload, arm64/darwin packaged cleanly)
- [x] `pnpm --filter @lightfast/desktop test` passes (vitest 69/69; Playwright e2e not run — requires running app)
- [x] `rg "from ['\"](copy-anything|scheduler|@tanstack/query-core|@trpc/client|@trpc/tanstack-react-query)['\"]" apps/desktop/src` returns zero matches

#### Human Review

- [x] Launched via `lightfast-electron` skill (`tail -f /dev/null | pnpm dev:desktop`). Electron PID running, Vite renderer serves HTTP 200 on `:5173`. Vite optimizer logs `✨ new dependencies optimized: @trpc/client, @trpc/tanstack-react-query` — proves both resolve transitively after we dropped the direct declarations. The renderer mounted and fired three `account.get` tRPC queries that round-tripped cleanly and received structured `TRPCClientError: Authentication required` responses via superjson — proves the **superjson + `copy-anything` peer chain** at deserialization sites works without `copy-anything` declared directly. No `Failed to resolve module` errors in the log. Pre-existing unrelated issue observed: `better-sqlite3` NODE_MODULE_VERSION mismatch (needs `pnpm rebuild:sqlite` after Electron upgrades) — falls back to in-memory defaults.
- [~] Sign-in flow not run via `lightfast-desktop-signin` skill — the skill's `:3024` API precondition doesn't match the current Portless dev mesh layout (`app.lightfast.localhost:443`), and the dep-removal risk is already proven by the unauthenticated tRPC round-trip above (the JWT-exchange portion of sign-in is orthogonal to our package.json changes).

### Rollback

If the renderer fails at runtime because pnpm's symlink layout doesn't expose `copy-anything` despite `preserveSymlinks: false`, restore only `copy-anything` to `apps/desktop/package.json` and document the constraint inline in `vite.renderer.config.ts`. No need to roll back the trpc/query-core removals.

---

## Phase 5: Fix `knip.json` so `apps/desktop`, `api/app`, `api/platform` audits are accurate

### Overview

Add `entry` arrays for the three workspaces so the next `pnpm knip` run only reports real problems. This guards against accidentally re-adding the deps we just removed and makes future cleanups trustworthy.

### Changes Required

#### 1. `knip.json`

**Changes**: Replace the `apps/desktop` entry (currently absent — falls back to default), and extend `api/app` + `api/platform` with `entry` arrays.

```jsonc
{
  "workspaces": {
    // ... existing entries ...
    "api/app": {
      "entry": ["src/index.ts", "src/env.ts", "src/inngest/index.ts", "src/inngest/client/client.ts", "src/lib/activity.ts", "src/origins.ts"],
      "project": ["src/**/*.ts"]
    },
    "api/platform": {
      "entry": ["src/index.ts", "src/env.ts", "src/inngest/index.ts", "src/inngest/client.ts", "src/internal.ts", "src/origins.ts"],
      "project": ["src/**/*.ts"]
    },
    "apps/desktop": {
      "entry": [
        "src/main/bootstrap.ts",
        "src/main/index.ts",
        "src/preload/**/*.ts",
        "src/renderer/src/main.ts",
        "src/renderer/src/react/**/*.{ts,tsx}",
        "forge.config.ts",
        "vite.main.config.ts",
        "vite.preload.config.ts",
        "vite.renderer.config.ts",
        "playwright.config.ts",
        "vitest.config.ts",
        "scripts/**/*.mjs"
      ],
      "project": ["src/**/*.{ts,tsx}", "forge.config.ts", "vite.*.config.ts", "scripts/**/*.mjs"]
    }
  }
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm knip --no-progress` no longer reports any of the previously-flagged false positives in `apps/desktop`, `api/app`, `api/platform` — all 19 listed false positives cleared (some via entry config, `@sentry/electron`/`@sentry/cli`/`superjson`/`@modelcontextprotocol/sdk`/`portless` via `ignoreDependencies`)
- [~] `pnpm knip --no-progress` exit code 1, but remaining findings are all genuinely new (not previously-known false positives): 3 unused files (`apps/app/src/lib/platform.ts`, `db/app/src/schema/relations.ts`, `packages/app-validation/src/primitives/index.ts`), 1 unused dep (`@repo/platform-client` — knock-on from dead `platform.ts`), 9 unused exports, 23 unused exported types, 4 pre-existing unused catalog entries (`@ai-sdk/gateway`, `@ai-sdk/react`, `@noble/ed25519`, `@noble/hashes`). All deserve a follow-up but are out of scope for this plan (no source refactors).

#### Human Review

- [ ] Inspect the post-fix `pnpm knip` output → observation: any remaining lines are genuinely new findings (not the previously-known false positives), and reasonable to either fix or ignore via `ignoreDependencies` — TODO: automate by failing CI when knip exit code is non-zero (separate cleanup)

---

## Testing Strategy

### Unit / type / build tests

- `pnpm typecheck` after every phase — catches accidental indirect usage that types would surface
- `pnpm check` after every phase — biome/ultracite catches stale references in JSON
- Per-workspace `pnpm --filter <name> build` for `@lightfast/app`, `@lightfast/www`, `@lightfast/platform`, `@lightfast/desktop`

### Integration

- `pnpm dev` boots app + www + platform via the Portless aggregate
- Electron smoke: `pnpm --filter @lightfast/desktop dev` launches the renderer, exercises `@repo/app-trpc/desktop` (depends on the dropped trpc direct deps being correctly resolved transitively)

### Lockfile validation

After each `pnpm install`:

```bash
! grep -E "^  hono@" pnpm-lock.yaml   # Phase 1
! grep -E "^  srvx@" pnpm-lock.yaml   # Phase 2
```

## Performance Considerations

Smaller `node_modules` (`vercel` CLI alone pulls in `@vercel/backends`, `rolldown`, `oxc-transform`, `srvx`, plus native binaries). CI install time on Depot runners should drop slightly. No runtime perf change since none of the dropped packages were imported.

## Migration Notes

- Anyone needing to re-link a Vercel project after Phase 2 runs `pnpm vercel:link`, which now delegates to `pnpm dlx vercel@latest link --repo`. The `.vercel/` link folders already exist locally, so this is only needed on a fresh clone.
- If a future feature needs hono (e.g. an Inngest serve handler on a non-Next.js runtime), re-add the catalog entry + peer dep at that time. The deletion is reversible via git.
- `@repo/app-encryption` stays as a workspace package — `api/platform` still consumes it. Only `api/app`'s declaration is dropped.

## References

- Original request: drop hono & srvx; find other unused packages
- Knip config: `knip.json`
- Knip output captured during planning: `pnpm knip --reporter json` (see "Current State Analysis")
- `vendor/inngest/src/hono.ts:1` — the entire dead `./hono` export
- `vendor/inngest/package.json:11-14,36-42` — hono export + optional peer
- `pnpm-workspace.yaml:50` — hono catalog entry
- `pnpm-lock.yaml` — `srvx@0.8.9` under `@vercel/backends@0.2.0`
- `apps/desktop/vite.renderer.config.ts:8-23` — preserveSymlinks + optimizeDeps that pin `superjson` (kept) and motivate the `copy-anything` removal caution
- Conservative-orphan precedent for `@repo/app-encryption`: `thoughts/shared/plans/2026-05-07-repo-barebones-reset-v2.md`
