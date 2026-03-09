---
date: 2026-03-08T00:00:00+00:00
researcher: claude-sonnet-4-6
git_commit: ff3c3402b
branch: main
repository: lightfast
topic: "Full surface area of ESLint/Prettier/TypeScript config — what changes for Biome migration"
tags: [research, codebase, biome, eslint, prettier, typescript, linting, migration, internal, turbo]
status: complete
last_updated: 2026-03-08
last_updated_by: claude-sonnet-4-6
---

# Research: Linting & TypeCheck Migration — Full Surface Area

**Date**: 2026-03-08
**Git Commit**: ff3c3402b
**Branch**: main

## Research Question

What are all the files and references that need to change across `internal/`, apps, packages, CLAUDE.md, `.claude/agents/`, and `.claude/skills/` when migrating from ESLint+Prettier to Biome?

---

## Summary

The monorepo has a clean 3-package `internal/` tooling layer consumed by **67+ workspace packages**. The ESLint+Prettier config surface is large but highly uniform — nearly all per-package customization is handled via 5 patterns of `eslint.config.js`. TypeScript typecheck is **already optimally configured** (incremental, tsbuildinfo in Turbo outputs, skipLibCheck). The `.claude/` directory has no ESLint/Prettier-specific references to update. CLAUDE.md mentions `pnpm lint && pnpm typecheck` but no tool-specific details.

---

## Detailed Findings

### 1. `internal/` — The Three Config Packages

All tooling config flows through 3 internal packages. These would be the primary replacement targets.

#### `internal/eslint/` → `@repo/eslint-config`
- **Version**: `0.3.0`
- **Exports**: `./base`, `./react`, `./nextjs`, `./hono`
- **Key rules in `base.js`**:
  - `typescript-eslint` recommended + `recommendedTypeChecked` + `stylisticTypeChecked`
  - `@typescript-eslint/no-unused-vars` (error, `_`-prefix ignored)
  - `@typescript-eslint/consistent-type-imports` (warn, prefer top-level)
  - `@typescript-eslint/no-misused-promises` (error)
  - `@typescript-eslint/no-unnecessary-condition` (error)
  - `@typescript-eslint/no-non-null-assertion` (error)
  - `import/consistent-type-specifier-style` (error)
  - `no-restricted-syntax` — warns on `export *`
  - `parserOptions: { projectService: true }` — **type-aware linting enabled**
  - `restrictEnvAccess` export — blocks `process.env` outside `~/env.ts`
- **Notable**: Uses `eslint-plugin-react-compiler` in `apps/console` only (not in the shared config)
- **Files**: `base.js`, `react.js`, `nextjs.js`, `hono.js`, `types.d.ts`, `tsconfig.json`, `turbo.json`

#### `internal/prettier/` → `@repo/prettier-config`
- **Version**: `0.1.0`
- **Plugins**: `@ianvs/prettier-plugin-sort-imports`, `prettier-plugin-tailwindcss`
- **Tailwind**: References `packages/ui/tailwind.config.ts` at runtime
- **tailwindFunctions**: `["cn", "cva"]`
- **Import order**: react → next → third-party → @dahlia/@repo/@vendor → relative
- **Files**: `index.js`, `tsconfig.json`, `turbo.json`

#### `internal/typescript/` → `@repo/typescript-config`
- **Already optimally configured** — no changes needed for typecheck performance
- `base.json` already has:
  - `"incremental": true`
  - `"tsBuildInfoFile": "${configDir}/.cache/tsbuildinfo.json"`
  - `"skipLibCheck": true`
  - `"strict": true`, `"noUncheckedIndexedAccess": true`
- 5 variants: `base.json`, `nextjs.json`, `hono.json`, `react-library.json`, `internal-package.json`
- **Not yet set**: `"assumeChangesOnlyAffectDirectDependencies": true` (additional speedup, low-risk addition)

---

### 2. Root `package.json` — Scripts & Dependencies

**Scripts that reference ESLint/Prettier** (`package.json`):
```json
"format":     "turbo run format --continue -- --cache --cache-location .cache/.prettiercache"
"format:fix": "turbo run format --continue -- --cache --cache-location .cache/.prettiercache --write"
"lint":       "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --cache --cache-location .cache/.eslintcache"
"lint:fix":   "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --cache --cache-location .cache/.eslintcache --fix"
"lint:ws":    "pnpm dlx sherif@latest"
"typecheck":  "SKIP_ENV_VALIDATION=true turbo run typecheck"
```

**Root devDependencies to change**:
- `"@repo/prettier-config": "workspace:*"` → remove
- `"prettier": "catalog:"` → remove
- `"typescript-eslint": "^8.56.1"` → remove
- Add: `"@biomejs/biome": "catalog:"` (new)

**Root `"prettier"` field**: `"prettier": "@repo/prettier-config"` → remove

---

### 3. Root `turbo.json` — Task Pipeline

**Current `typecheck` task** (`turbo.json:62-66`) — **already correct**:
```json
"typecheck": {
  "dependsOn": ["^build", "transit"],
  "outputs": [".cache/tsbuildinfo.json"],
  "env": []
}
```
`.tsbuildinfo` is already tracked in Turbo outputs. No change needed.

**Current `lint` task** (`turbo.json:47-51`) — needs updating for Biome:
```json
"lint": {
  "dependsOn": ["^build", "transit"],
  "outputs": [".cache/.eslintcache"],
  "env": []
}
```
→ `outputs` changes to Biome cache path (e.g., `".cache/biome-cache"` or removed if Biome doesn't cache per-package)

**Current `format` task** (`turbo.json:40-43`) — needs updating:
```json
"format": {
  "outputs": [".cache/.prettiercache"],
  "outputLogs": "new-only"
}
```
→ Biome handles both lint + format in a single command; may collapse `lint` + `format` into one task

---

### 4. `pnpm-workspace.yaml` — Catalog

Catalog entries to change:
```yaml
# Remove:
eslint: ^9.23.0
prettier: ^3.8.1
typescript-eslint: ^8.56.1

# Add:
"@biomejs/biome": "^2.x.x"   # (version TBD based on latest stable)
```

---

### 5. Per-Package Files (67+ packages)

#### `eslint.config.js` — 67 files to delete/replace

All follow one of 5 patterns:

| Pattern | Count | Packages |
|---|---|---|
| **A**: Base only | ~45 | Most `packages/console-*`, `vendor/*`, `api/console`, `db/console`, `apps/auth` |
| **B**: Base + React | 3 | `packages/ui`, `packages/og`, `packages/console-remotion` |
| **C**: Base + React + Next + restrictEnvAccess | 2 | `apps/www`, `apps/docs` |
| **D**: Base + React Compiler plugin | 1 | `apps/console` |
| **E**: Hono | 3 | `apps/relay`, `apps/gateway`, `apps/backfill` |

For Biome migration: all 67 `eslint.config.js` files are **deleted**. A single root `biome.json` replaces them.

#### Per-package `package.json` — 67 files to update

Each package needs:
- Remove `devDependencies`: `eslint`, `prettier`, `@repo/eslint-config`, `@repo/prettier-config`
- Remove script: `"lint": "eslint"` → `"lint": "biome lint ."` (or handled at root level only)
- Remove script: `"format": "prettier --check ."` → `"format": "biome format ."` (or root level)
- Remove: `"prettier": "@repo/prettier-config"` field (where present)

#### Per-package `tsconfig.json` — **no changes needed**
All tsconfigs extend `@repo/typescript-config` which already has incremental + tsbuildinfo. No migration work here.

---

### 6. New File: Root `biome.json`

A new `biome.json` at the monorepo root replaces all 67 `eslint.config.js` files. Key sections to configure:

**Rules to map from ESLint → Biome**:
- `@typescript-eslint/no-unused-vars` → `biome: noUnusedVariables` (with `_` prefix ignore)
- `@typescript-eslint/consistent-type-imports` → `biome: useImportType`
- `@typescript-eslint/no-non-null-assertion` → `biome: noNonNullAssertion`
- `import/consistent-type-specifier-style` → covered by `useImportType`
- `no-restricted-syntax` (export *) → `biome: noExportAll` (available in v2)
- `restrictEnvAccess` (custom rule blocking `process.env`) → Biome `noProcessEnv` rule or custom GritQL pattern

**Rules NOT directly available in Biome v2** (~75-85% coverage):
- `@typescript-eslint/no-misused-promises` → Biome v2 has `noFloatingPromises` (partial coverage)
- `@typescript-eslint/no-unnecessary-condition` → Available in Biome v2 type-aware mode
- `eslint-plugin-react-compiler` → **Not available in Biome** — needs separate `react-compiler` check
- `@next/eslint-plugin-next` → **Not available in Biome** — needs separate Next.js lint pass or rule subset
- `eslint-plugin-turbo` → **Not available in Biome** — `turbo/no-undeclared-env-vars` rule

**Coverage gap implications**:
- React Compiler enforcement (`apps/console`) → needs separate step
- Next.js core web vitals rules (`apps/www`, `apps/docs`) → needs separate step or removal
- Turbo env var checking → may need custom GritQL or separate validation
- `restrictEnvAccess` (custom `process.env` blocking) → needs GritQL custom rule in Biome v2

---

### 7. `internal/` Package Changes

#### Delete: `internal/eslint/`
The entire directory and its pnpm workspace entry. Remove from `pnpm-workspace.yaml` packages list.

#### Delete: `internal/prettier/`
The entire directory and its pnpm workspace entry.

#### Add: `internal/biome/` (optional)
If a shared Biome config is needed across multiple contexts (e.g., different rule sets for Hono vs Next.js apps), a new `internal/biome/` package can export a `biome.json` fragment. However, Biome's `overrides` array in a single root `biome.json` can handle this without a separate package.

#### Keep unchanged: `internal/typescript/`
No changes needed. TypeScript config is already optimally configured.

---

### 8. CLAUDE.md

Current reference at `CLAUDE.md:81`:
```bash
pnpm lint && pnpm typecheck
```
After migration, this remains valid — the command names stay the same (`pnpm lint` and `pnpm typecheck`). The only difference is the underlying tool. **No functional change needed** unless the workflow description should mention Biome explicitly.

---

### 9. `.claude/agents/` — No ESLint/Prettier References

All 15 agent markdown files in `.claude/agents/` are general-purpose research/analysis agents:
- `blog-agent-tester.md`, `blog-brief-planner.md`, `blog-writer.md`
- `codebase-analyze-github.md`, `codebase-analyzer.md`, `codebase-locator.md`, `codebase-pattern-finder.md`
- `connector-manager.md`, `debug-browser.md`, `github-action-runner.md`
- `math-extractor.md`, `technical-writer.md`, `thoughts-analyzer.md`, `thoughts-locator.md`
- `web-search-researcher.md`

None reference ESLint, Prettier, or Biome. **No changes needed.**

---

### 10. `.claude/skills/` — No ESLint/Prettier References

All 8 skills in `.claude/skills/`:
- `blog-writer`, `changelog-writer`, `frontend-design`, `react-doctor`
- `remotion-best-practices`, `seo`, `turborepo`, `vercel-react-best-practices`

The `turborepo` skill covers Turborepo task configuration. The `react-doctor` skill checks React code quality. Neither hardcodes ESLint/Prettier assumptions. **No changes needed.**

---

## Migration Work Summary

### High-effort (many files, mechanical)

| Task | Files | Effort |
|---|---|---|
| Delete all `eslint.config.js` files | 67 | Automated `find` + delete |
| Remove ESLint/Prettier deps from all `package.json` | 67 | Script via `jq` or `pnpm` |
| Remove `prettier` field from all `package.json` | ~45 | Script |
| Update `lint`/`format` scripts in all `package.json` | 67 | Script |

### Low-effort (central config files)

| Task | Files | Effort |
|---|---|---|
| Create root `biome.json` | 1 | Manual — rule mapping |
| Delete `internal/eslint/` | 1 dir (~7 files) | `rm -rf` |
| Delete `internal/prettier/` | 1 dir (~4 files) | `rm -rf` |
| Update root `package.json` scripts + deps | 1 | Manual |
| Update `pnpm-workspace.yaml` catalog | 1 | Manual |
| Update root `turbo.json` tasks | 1 | Manual |

### Gaps requiring separate handling post-migration

| Capability | Current tool | Biome v2 coverage | Resolution |
|---|---|---|---|
| React Compiler rules | `eslint-plugin-react-compiler` | Not available | Separate `react-compiler` CLI step in CI |
| Next.js core-web-vitals | `@next/eslint-plugin-next` | Not available | `next lint` as separate CI step (already built into Next.js) |
| Turbo env var checking | `eslint-plugin-turbo` | Not available | Remove or GritQL custom rule |
| `process.env` restriction | Custom `restrictEnvAccess` | Partial via `noProcessEnv` | Biome v2 `noProcessEnv` or GritQL |
| `no-misused-promises` full coverage | `@typescript-eslint` | ~75-85% via Biome type inference | Accept gap or run `typescript-eslint` separately |
| Import sort order | `@ianvs/prettier-plugin-sort-imports` | Biome organizeImports (less configurable) | Accept simplified order or `perfectionist` plugin |

---

## TypeCheck — Already Optimized (No Migration Needed)

The typecheck stack is already configured correctly:
- `internal/typescript/base.json`: `"incremental": true`, `"tsBuildInfoFile": "${configDir}/.cache/tsbuildinfo.json"`, `"skipLibCheck": true`
- `turbo.json`: `"outputs": [".cache/tsbuildinfo.json"]` for both `build` and `typecheck` tasks
- Remote cache hits restore `.tsbuildinfo`, enabling incremental type checking even in CI

**One remaining optimization** (not yet applied):
```json
// internal/typescript/base.json — add:
"assumeChangesOnlyAffectDirectDependencies": true
```
This reduces TypeScript's re-check scope further for monorepo changes. Tradeoff: slightly less thorough (won't catch transitive type changes across 3+ package hops) — acceptable for most monorepo workflows.

---

## Code References

- `internal/eslint/base.js` — Core ESLint rules, `restrictEnvAccess` export
- `internal/eslint/hono.js` — Hono config + `honoTestOverrides` for test files
- `internal/eslint/nextjs.js` — Next.js plugin rules
- `internal/eslint/react.js` — React + hooks rules
- `internal/prettier/index.js` — Import sort order + Tailwind class sorting
- `internal/typescript/base.json` — Root tsconfig (already incremental + tsbuildinfo)
- `turbo.json:47-66` — lint + typecheck task definitions (typecheck already has tsbuildinfo in outputs)
- `apps/console/eslint.config.js` — Only package using `eslint-plugin-react-compiler`
- `apps/www/eslint.config.js`, `apps/docs/eslint.config.js` — Only packages using `nextjs` config + `restrictEnvAccess`
- `apps/relay/eslint.config.js`, `apps/gateway/eslint.config.js`, `apps/backfill/eslint.config.js` — Hono pattern

---

## Related Research

- `thoughts/shared/research/2026-03-08-web-analysis-linting-typecheck-speed-optimization.md` — Benchmark data, tool comparisons, and strategic recommendations
