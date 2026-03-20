---
date: 2026-03-20T00:00:00+00:00
researcher: claude
git_commit: d49910e665a44b242233d903e96be2a16e5a11bd
branch: feat/memory-service-consolidation
repository: lightfast
topic: "Full codebase rename: console→app and memory→platform across all layers"
tags: [plan, rename, monorepo, turborepo, apps, api, db, packages]
status: complete
last_updated: 2026-03-20
last_updated_note: "Expanded to full codebase scope: api/, db/, packages/console-*, packages/memory-trpc"
---

# Full Codebase Rename: `console` → `app` and `memory` → `platform`

## Overview

Rename every directory and package that carries `console` or `memory` in its name, across all four layers of the monorepo: `apps/`, `api/`, `db/`, and `packages/`. The `apps/` layer is already complete.

## Current State

**Already done (`apps/` layer):**
- `apps/app/` exists, package name `@lightfast/app` ✓
- `apps/platform/` exists, package name `@lightfast/platform` ✓

**Still to do (verified on filesystem 2026-03-20):**

| Layer | From | To |
|-------|------|----|
| `api/` | `api/console` (`@api/app`) | `api/app` (`@api/app`) |
| `api/` | `api/memory` (`@api/platform`) | `api/platform` (`@api/platform`) |
| `db/` | `db/console` (`@db/app`) | `db/app` (`@db/app`) |
| `packages/` | `packages/console-ai` (`@repo/console-ai`) | `packages/app-ai` (`@repo/app-ai`) |
| `packages/` | `packages/console-ai-types` (`@repo/app-ai-types`) | `packages/app-ai-types` (`@repo/app-ai-types`) |
| `packages/` | `packages/console-api-key` (`@repo/app-api-key`) | `packages/app-api-key` (`@repo/app-api-key`) |
| `packages/` | `packages/console-auth-middleware` (`@repo/app-auth-middleware`) | `packages/app-auth-middleware` (`@repo/app-auth-middleware`) |
| `packages/` | `packages/console-clerk-cache` (`@repo/app-clerk-cache`) | `packages/app-clerk-cache` (`@repo/app-clerk-cache`) |
| `packages/` | `packages/console-clerk-m2m` (`@repo/app-clerk-m2m`) | `packages/app-clerk-m2m` (`@repo/app-clerk-m2m`) |
| `packages/` | `packages/console-config` (`@repo/app-config`) | `packages/app-config` (`@repo/app-config`) |
| `packages/` | `packages/console-embed` (`@repo/app-embed`) | `packages/app-embed` (`@repo/app-embed`) |
| `packages/` | `packages/console-octokit-github` (`@repo/app-octokit-github`) | `packages/app-octokit-github` (`@repo/app-octokit-github`) |
| `packages/` | `packages/console-openapi` (`@repo/app-openapi`) | `packages/app-openapi` (`@repo/app-openapi`) |
| `packages/` | `packages/console-pinecone` (`@repo/app-pinecone`) | `packages/app-pinecone` (`@repo/app-pinecone`) |
| `packages/` | `packages/console-providers` (`@repo/app-providers`) | `packages/app-providers` (`@repo/app-providers`) |
| `packages/` | `packages/console-remotion` (`@repo/app-remotion`) | `packages/app-remotion` (`@repo/app-remotion`) |
| `packages/` | `packages/console-rerank` (`@repo/app-rerank`) | `packages/app-rerank` (`@repo/app-rerank`) |
| `packages/` | `packages/console-reserved-names` (`@repo/app-reserved-names`) | `packages/app-reserved-names` (`@repo/app-reserved-names`) |
| `packages/` | `packages/console-test-data` (`@repo/app-test-data`) | `packages/app-test-data` (`@repo/app-test-data`) |
| `packages/` | `packages/console-test-db` (`@repo/app-test-db`) | `packages/app-test-db` (`@repo/app-test-db`) |
| `packages/` | `packages/console-trpc` (`@repo/app-trpc`) | `packages/app-trpc` (`@repo/app-trpc`) |
| `packages/` | `packages/console-upstash-realtime` (`@repo/app-upstash-realtime`) | `packages/app-upstash-realtime` (`@repo/app-upstash-realtime`) |
| `packages/` | `packages/console-validation` (`@repo/app-validation`) | `packages/app-validation` (`@repo/app-validation`) |
| `packages/` | `packages/console-vercel` (`@repo/app-vercel`) | `packages/app-vercel` (`@repo/app-vercel`) |
| `packages/` | `packages/console-workspace-cache` (`@repo/app-workspace-cache`) | `packages/app-workspace-cache` (`@repo/app-workspace-cache`) |
| `packages/` | `packages/memory-trpc` (`@repo/platform-trpc`) | `packages/platform-trpc` (`@repo/platform-trpc`) |

**26 directory renames + hundreds of source/config file reference updates.**

## Desired End State

- No directory or package name in the repo contains `console` or `memory` (except in string literals that refer to the actual browser console or human memory)
- All TypeScript imports, workspace deps, turbo configs, changeset configs, and tsconfig path aliases use the new names
- `pnpm check`, `pnpm typecheck`, `pnpm build:app`, `pnpm build:platform` all pass

## What We're NOT Doing

- Renaming the `worktrees/console-db-deploy/` worktree (worktrees are ephemeral, not part of the main codebase)
- Renaming string literals in comments that reference "browser console" or similar unrelated uses
- Changing the Vercel project IDs or Vercel dashboard project names
- Renaming the `core/` directory or any `vendor/` packages
- Changing `@lightfast/app` or `@lightfast/platform` (already done)

## Implementation Approach

Three steps in strict order:

1. **Update all `package.json` `"name"` fields** (26 files) — establishes the new package identities
2. **Bulk find-and-replace all references** across every source, config, and doc file — handles imports, deps, turbo config, tsconfig aliases, changeset in one sweep
3. **`git mv` all directories** — makes the filesystem match; follows the reference updates so git sees renames

Running `pnpm install` after all moves regenerates `pnpm-lock.yaml` with the new workspace paths.

---

## Phase 1: Update All `package.json` `"name"` Fields

### Overview
Update the `"name"` field in every package that is being renamed. Do NOT touch `"dependencies"` or `"devDependencies"` yet — those are handled by the bulk replace in Phase 2.

### Changes Required

**`api/console/package.json`** — `"name": "@api/app"` → `"name": "@api/app"`

**`api/memory/package.json`** — `"name": "@api/platform"` → `"name": "@api/platform"`

**`db/console/package.json`** — `"name": "@db/app"` → `"name": "@db/app"`

**All 22 `packages/console-*/package.json` files** (exact name changes):

| File | Old name | New name |
|------|----------|----------|
| `packages/console-ai/package.json` | `@repo/console-ai` | `@repo/app-ai` |
| `packages/console-ai-types/package.json` | `@repo/app-ai-types` | `@repo/app-ai-types` |
| `packages/console-api-key/package.json` | `@repo/app-api-key` | `@repo/app-api-key` |
| `packages/console-auth-middleware/package.json` | `@repo/app-auth-middleware` | `@repo/app-auth-middleware` |
| `packages/console-clerk-cache/package.json` | `@repo/app-clerk-cache` | `@repo/app-clerk-cache` |
| `packages/console-clerk-m2m/package.json` | `@repo/app-clerk-m2m` | `@repo/app-clerk-m2m` |
| `packages/console-config/package.json` | `@repo/app-config` | `@repo/app-config` |
| `packages/console-embed/package.json` | `@repo/app-embed` | `@repo/app-embed` |
| `packages/console-octokit-github/package.json` | `@repo/app-octokit-github` | `@repo/app-octokit-github` |
| `packages/console-openapi/package.json` | `@repo/app-openapi` | `@repo/app-openapi` |
| `packages/console-pinecone/package.json` | `@repo/app-pinecone` | `@repo/app-pinecone` |
| `packages/console-providers/package.json` | `@repo/app-providers` | `@repo/app-providers` |
| `packages/console-remotion/package.json` | `@repo/app-remotion` | `@repo/app-remotion` |
| `packages/console-rerank/package.json` | `@repo/app-rerank` | `@repo/app-rerank` |
| `packages/console-reserved-names/package.json` | `@repo/app-reserved-names` | `@repo/app-reserved-names` |
| `packages/console-test-data/package.json` | `@repo/app-test-data` | `@repo/app-test-data` |
| `packages/console-test-db/package.json` | `@repo/app-test-db` | `@repo/app-test-db` |
| `packages/console-trpc/package.json` | `@repo/app-trpc` | `@repo/app-trpc` |
| `packages/console-upstash-realtime/package.json` | `@repo/app-upstash-realtime` | `@repo/app-upstash-realtime` |
| `packages/console-validation/package.json` | `@repo/app-validation` | `@repo/app-validation` |
| `packages/console-vercel/package.json` | `@repo/app-vercel` | `@repo/app-vercel` |
| `packages/console-workspace-cache/package.json` | `@repo/app-workspace-cache` | `@repo/app-workspace-cache` |
| `packages/memory-trpc/package.json` | `@repo/platform-trpc` | `@repo/platform-trpc` |

### Success Criteria

#### Automated Verification
- [x] `grep -r '"@api/console"\\|"@api/memory"\\|"@db/console"\\|"@repo/console-\\|"@repo/memory-trpc"' --include="package.json" api/ db/ packages/ | grep '"name"'` returns no results

---

## Phase 2: Bulk Find-and-Replace All References

### Overview
One `find | xargs sed` sweep across every `.ts`, `.tsx`, `.json`, `.md`, `.yaml` file (excluding `node_modules`, `.turbo`, `.git`, `pnpm-lock.yaml`, `worktrees/`). This handles:
- TypeScript `import` / `import type` statements
- `package.json` `dependencies` / `devDependencies` / `peerDependencies` values
- `turbo.json` `with` arrays and task references
- `tsconfig.json` `paths` aliases
- `.changeset/pre.json` `initialVersions` keys
- `knip.json` `ignoreDependencies` arrays
- `CLAUDE.md` and all other documentation

### The Command

Run from the repo root:

```bash
find . -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.turbo/*" \
  -not -path "*/.git/*" \
  -not -path "*/worktrees/*" \
  -not -name "pnpm-lock.yaml" \
  | xargs sed -i '' \
    -e 's|@repo/app-ai-types|@repo/app-ai-types|g' \
    -e 's|@repo/console-ai\b|@repo/app-ai|g' \
    -e 's|@repo/app-api-key|@repo/app-api-key|g' \
    -e 's|@repo/app-auth-middleware|@repo/app-auth-middleware|g' \
    -e 's|@repo/app-clerk-cache|@repo/app-clerk-cache|g' \
    -e 's|@repo/app-clerk-m2m|@repo/app-clerk-m2m|g' \
    -e 's|@repo/app-config|@repo/app-config|g' \
    -e 's|@repo/app-embed|@repo/app-embed|g' \
    -e 's|@repo/app-octokit-github|@repo/app-octokit-github|g' \
    -e 's|@repo/app-openapi|@repo/app-openapi|g' \
    -e 's|@repo/app-pinecone|@repo/app-pinecone|g' \
    -e 's|@repo/app-providers|@repo/app-providers|g' \
    -e 's|@repo/app-remotion|@repo/app-remotion|g' \
    -e 's|@repo/app-rerank|@repo/app-rerank|g' \
    -e 's|@repo/app-reserved-names|@repo/app-reserved-names|g' \
    -e 's|@repo/app-test-data|@repo/app-test-data|g' \
    -e 's|@repo/app-test-db|@repo/app-test-db|g' \
    -e 's|@repo/app-trpc|@repo/app-trpc|g' \
    -e 's|@repo/app-upstash-realtime|@repo/app-upstash-realtime|g' \
    -e 's|@repo/app-validation|@repo/app-validation|g' \
    -e 's|@repo/app-vercel|@repo/app-vercel|g' \
    -e 's|@repo/app-workspace-cache|@repo/app-workspace-cache|g' \
    -e 's|@repo/platform-trpc|@repo/platform-trpc|g' \
    -e 's|@api/app|@api/app|g' \
    -e 's|@api/platform|@api/platform|g' \
    -e 's|@db/app|@db/app|g'
```

**Pattern ordering notes:**
- `@repo/app-ai-types` is listed before `@repo/console-ai` to prevent partial match clobbering (longer pattern first)
- `@repo/console-ai\b` uses word boundary so it doesn't match `console-ai-types` residuals
- All `@repo/console-*` variants are listed before `@api/app` to avoid any cross-pattern contamination

### Manual follow-up after bulk replace

#### `apps/platform/tsconfig.json` — path alias key AND value
The tsconfig `paths` entry has the old name in both key and source path. After the bulk replace updates `@api/platform` → `@api/platform`, also verify the source path is correct:

```json
// Before (after bulk replace, key is fixed but check the path value):
"@api/platform/*": ["../../api/memory/src/*"]

// Should be:
"@api/platform/*": ["../../api/platform/src/*"]
```

> The bulk replace changes `api/memory` in paths/strings too, so this should auto-resolve. Verify manually after running.

#### Root `package.json` — `remotion` and `db` scripts
Verify these two scripts updated correctly (they reference `@repo/app-remotion` and `@db/app`):
```json
"remotion:studio": "pnpm --filter @repo/app-remotion studio",
"remotion:render": "pnpm --filter @repo/app-remotion render:gif",
"db:generate": "pnpm --filter @db/app db:generate",
"db:migrate": "pnpm --filter @db/app db:migrate",
```

### Success Criteria

#### Automated Verification
- [ ] `grep -rn "@api/app\|@api/platform\|@db/app\|@repo/console-\|@repo/platform-trpc" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yaml" . --exclude-dir=node_modules --exclude-dir=worktrees` returns zero results
- [ ] `grep -n "api/memory/src" apps/platform/tsconfig.json` returns no results (path updated)

---

## Phase 3: Execute All Directory Renames

### Overview
`git mv` all 26 directories. Run from repo root.

### Commands

```bash
# API layer (2 renames)
git mv api/console api/app
git mv api/memory api/platform

# DB layer (1 rename)
git mv db/console db/app

# Packages — console-* (22 renames)
git mv packages/console-ai packages/app-ai
git mv packages/console-ai-types packages/app-ai-types
git mv packages/console-api-key packages/app-api-key
git mv packages/console-auth-middleware packages/app-auth-middleware
git mv packages/console-clerk-cache packages/app-clerk-cache
git mv packages/console-clerk-m2m packages/app-clerk-m2m
git mv packages/console-config packages/app-config
git mv packages/console-embed packages/app-embed
git mv packages/console-octokit-github packages/app-octokit-github
git mv packages/console-openapi packages/app-openapi
git mv packages/console-pinecone packages/app-pinecone
git mv packages/console-providers packages/app-providers
git mv packages/console-remotion packages/app-remotion
git mv packages/console-rerank packages/app-rerank
git mv packages/console-reserved-names packages/app-reserved-names
git mv packages/console-test-data packages/app-test-data
git mv packages/console-test-db packages/app-test-db
git mv packages/console-trpc packages/app-trpc
git mv packages/console-upstash-realtime packages/app-upstash-realtime
git mv packages/console-validation packages/app-validation
git mv packages/console-vercel packages/app-vercel
git mv packages/console-workspace-cache packages/app-workspace-cache

# Packages — memory-trpc (1 rename)
git mv packages/memory-trpc packages/platform-trpc
```

### Post-rename: regenerate lockfile

```bash
pnpm install
```

### Success Criteria

#### Automated Verification
- [ ] `ls api/` shows `app/` and `platform/` (no `console/` or `memory/`)
- [ ] `ls db/` shows `app/` (no `console/`)
- [ ] `ls packages/ | grep -E "^console-|^memory-trpc"` returns nothing
- [ ] `pnpm install` exits 0 with no unresolved workspace packages
- [ ] `git status` shows all moves as renames (`R` status), not deletes+adds

---

## Phase 4: Build Verification

### Commands

```bash
pnpm check
pnpm typecheck
pnpm build:app
pnpm build:platform
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm check` exits 0 (no biome/lint errors)
- [ ] `pnpm typecheck` exits 0 (no TypeScript errors across all packages)
- [ ] `pnpm build:app` exits 0
- [ ] `pnpm build:platform` exits 0

#### Manual Verification
- [ ] `pnpm dev:app` starts the app on port 4107
- [ ] `pnpm dev:platform` starts the platform service on port 4112
- [ ] `pnpm dev:full` starts all three services together

**Implementation Note**: Pause after Phase 4 automated checks pass for manual dev server confirmation.

---

## Testing Strategy

### Automated
- `pnpm check` — biome across all workspaces
- `pnpm typecheck` — TypeScript, catches any missed import renames
- `pnpm build:app` + `pnpm build:platform` — production builds catch tree-shaking issues

### Manual
1. Start dev server, verify no module-not-found errors in terminal
2. Load the app in browser, verify no runtime errors
3. Run a migration dry-run to confirm `@db/app` resolves: `pnpm db:generate`

## Migration Notes

- **`pnpm-lock.yaml`** is fully regenerated by `pnpm install` — never manually edit it
- **Git rename tracking**: `git mv` ensures git tracks renames properly. If git shows files as delete+add instead of rename after commit, that is cosmetic only and does not affect builds
- **Worktrees**: `worktrees/console-db-deploy/` is excluded from the bulk sed. If that worktree needs to be updated, it should be done separately
- **Vercel project IDs** in `.vercel/repo.json` are stable GUIDs — the `directory` pointer was already updated when `apps/console` became `apps/app`

## Complete Package Name Mapping Reference

| Old name | New name | Layer |
|----------|----------|-------|
| `@lightfast/console` | `@lightfast/app` | apps/ ✓ done |
| `@lightfast/memory` | `@lightfast/platform` | apps/ ✓ done |
| `@api/app` | `@api/app` | api/ |
| `@api/platform` | `@api/platform` | api/ |
| `@db/app` | `@db/app` | db/ |
| `@repo/console-ai` | `@repo/app-ai` | packages/ |
| `@repo/app-ai-types` | `@repo/app-ai-types` | packages/ |
| `@repo/app-api-key` | `@repo/app-api-key` | packages/ |
| `@repo/app-auth-middleware` | `@repo/app-auth-middleware` | packages/ |
| `@repo/app-clerk-cache` | `@repo/app-clerk-cache` | packages/ |
| `@repo/app-clerk-m2m` | `@repo/app-clerk-m2m` | packages/ |
| `@repo/app-config` | `@repo/app-config` | packages/ |
| `@repo/app-embed` | `@repo/app-embed` | packages/ |
| `@repo/app-octokit-github` | `@repo/app-octokit-github` | packages/ |
| `@repo/app-openapi` | `@repo/app-openapi` | packages/ |
| `@repo/app-pinecone` | `@repo/app-pinecone` | packages/ |
| `@repo/app-providers` | `@repo/app-providers` | packages/ |
| `@repo/app-remotion` | `@repo/app-remotion` | packages/ |
| `@repo/app-rerank` | `@repo/app-rerank` | packages/ |
| `@repo/app-reserved-names` | `@repo/app-reserved-names` | packages/ |
| `@repo/app-test-data` | `@repo/app-test-data` | packages/ |
| `@repo/app-test-db` | `@repo/app-test-db` | packages/ |
| `@repo/app-trpc` | `@repo/app-trpc` | packages/ |
| `@repo/app-upstash-realtime` | `@repo/app-upstash-realtime` | packages/ |
| `@repo/app-validation` | `@repo/app-validation` | packages/ |
| `@repo/app-vercel` | `@repo/app-vercel` | packages/ |
| `@repo/app-workspace-cache` | `@repo/app-workspace-cache` | packages/ |
| `@repo/platform-trpc` | `@repo/platform-trpc` | packages/ |
