# ESLint + Prettier → Ultracite Migration Plan

## Overview

Migrate the entire monorepo's linting and formatting stack from ESLint + Prettier (52 per-package configs, 2 internal config packages) to Ultracite + Biome (single root `biome.jsonc`). Following next-forge's implementation 1:1.

## Current State Analysis

- **52 `eslint.config.js` files** across 5 patterns (base, react, nextjs, hono, react-compiler)
- **2 internal config packages**: `internal/eslint/` (8 files), `internal/prettier/` (4 files)
- **Per-package scripts**: every package has `"lint": "eslint"` and `"format": "prettier --check ."`
- **Root Turbo tasks**: `lint` (outputs `.cache/.eslintcache`), `format` (outputs `.cache/.prettiercache`)
- **Claude Code PostToolUse hook**: runs `npx eslint --fix` on every file edit (`.claude/settings.json:16`)
- **Catalog entries**: `eslint: ^9.23.0`, `prettier: ^3.8.1`, `typescript-eslint: ^8.56.1`
- **Public hoist**: `@ianvs/prettier-plugin-sort-imports`, `prettier-plugin-tailwindcss`
- **React Compiler**: `apps/console` uses `eslint-plugin-react-compiler` — the only package requiring it

### Key Discoveries:
- `npx react-compiler-healthcheck` works standalone (134/134 components pass) — no ESLint needed
- next-forge uses Ultracite v6.3.9 + Biome v2.3.8, root-only config, no Turbo lint tasks
- Ultracite presets: `ultracite/core`, `ultracite/react`, `ultracite/next` — covers all our rule needs
- Biome natively ignores `.gitignore`-listed paths when VCS integration is enabled (set by Ultracite preset)
- Biome's `noProcessEnv` replaces our custom `restrictEnvAccess`
- Biome's Turborepo domain replaces `eslint-plugin-turbo`

## Desired End State

A single root `biome.jsonc` extending Ultracite presets handles all linting and formatting for the entire monorepo. No per-package lint/format scripts. No ESLint or Prettier anywhere. `pnpm check` and `pnpm fix` replace `pnpm lint` and `pnpm format`.

### Verification:
```bash
pnpm check        # exits 0 — all lint + format checks pass
pnpm typecheck    # exits 0 — no type regressions
```

## What We're NOT Doing

- **Not keeping ESLint for any package** — react-compiler enforcement moves to standalone healthcheck
- **Not customizing Biome rules** beyond Ultracite defaults — accept Ultracite's opinionated preset
- **Not adding git hooks** (husky/lint-staged) — follow next-forge pattern
- **Not setting up per-package Biome configs** — single root config only
- **Not migrating TypeScript config** — already optimally configured, no changes needed
- **Not adding `restrictEnvAccess` equivalent** — Ultracite's preset handles `noProcessEnv`; t3-env validation already catches misuse at build time

## Implementation Approach

Follow next-forge's Ultracite implementation 1:1: root-only `biome.jsonc`, root-only scripts, no Turbo lint/format tasks. The migration is a clean cut — remove everything old, add everything new, run `ultracite fix` to auto-format the codebase to Biome's style.

---

## Phase 1: Install Ultracite + Create Root `biome.jsonc`

### Overview
Install Ultracite and Biome at the root, create the single config file.

### Changes Required:

#### 1. Install dependencies
```bash
pnpm add -D -E @biomejs/biome ultracite --ignore-workspace-root-check
```

This adds exact-pinned versions to root `devDependencies` (following next-forge's pattern of no semver range).

#### 2. Create root `biome.jsonc`
**File**: `biome.jsonc` (new file at monorepo root)

```jsonc
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["ultracite/core", "ultracite/react", "ultracite/next"]
}
```

Note: Biome respects `.gitignore` via Ultracite's VCS integration. Directories like `.next/`, `dist/`, `node_modules/`, `.turbo/` are already gitignored. If specific generated files need exclusion (e.g., auto-generated types), add them during Phase 5 verification:

```jsonc
{
  "files": {
    "includes": [
      "**/*",
      "!path/to/generated/file"
    ]
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `biome.jsonc` exists at monorepo root
- [ ] `npx ultracite check` runs without config errors (violations expected at this stage)
- [ ] `@biomejs/biome` and `ultracite` appear in root `package.json` devDependencies

---

## Phase 2: Update Root Configuration

### Overview
Update root `package.json` scripts, `turbo.json` tasks, Claude Code hook, and VSCode settings.

### Changes Required:

#### 1. Root `package.json` — Scripts
**File**: `package.json`

Replace lint/format scripts:
```json
// Remove:
"format": "turbo run format --continue -- --cache --cache-location .cache/.prettiercache",
"format:fix": "turbo run format --continue -- --write --cache --cache-location .cache/.prettiercache",
"lint": "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --cache --cache-location .cache/.eslintcache",
"lint:fix": "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --fix --cache --cache-location .cache/.eslintcache",

// Add:
"check": "npx ultracite@latest check",
"fix": "npx ultracite@latest fix",
```

Keep unchanged: `"lint:ws": "pnpm dlx sherif@latest"` (workspace lint is unrelated).

#### 2. Root `package.json` — devDependencies
**File**: `package.json`

Remove:
```json
"@repo/prettier-config": "workspace:*",
"prettier": "catalog:",
"typescript-eslint": "^8.56.1",
```

Remove field:
```json
"prettier": "@repo/prettier-config",
```
(line 69 — the `"prettier"` top-level field)

#### 3. `turbo.json` — Remove lint/format tasks
**File**: `turbo.json`

Remove `format` task (lines 40-43):
```json
"format": {
  "outputs": [".cache/.prettiercache"],
  "outputLogs": "new-only"
},
```

Remove `lint` task (lines 47-51):
```json
"lint": {
  "dependsOn": ["^build", "transit"],
  "outputs": [".cache/.eslintcache"],
  "env": []
},
```

Following next-forge: no Turbo tasks for linting. Ultracite runs from root directly.

#### 4. `.claude/settings.json` — Update PostToolUse hook
**File**: `.claude/settings.json`

Replace ESLint hook (line 16):
```json
// Old:
"command": "case \"$CLAUDE_TOOL_INPUT_FILE_PATH\" in *.ts|*.tsx|*.js|*.jsx) SKIP_ENV_VALIDATION=true npx eslint --fix --no-warn-ignored \"$CLAUDE_TOOL_INPUT_FILE_PATH\" 2>/dev/null ;; esac; true"

// New:
"command": "case \"$CLAUDE_TOOL_INPUT_FILE_PATH\" in *.ts|*.tsx|*.js|*.jsx) npx @biomejs/biome check --write --unsafe \"$CLAUDE_TOOL_INPUT_FILE_PATH\" 2>/dev/null ;; esac; true"
```

Uses `biome check --write --unsafe` directly (faster than going through Ultracite CLI for single-file fixes).

#### 5. `.vscode/settings.json` — Update editor settings
**File**: `.vscode/settings.json` (create if doesn't exist)

Following next-forge 1:1:
```json
{
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" },
  "[jsonc]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "editor.codeActionsOnSave": { "source.fixAll.biome": "explicit" },
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "prettier.enable": false
}
```

#### 6. `CLAUDE.md` — Update lint command reference
**File**: `CLAUDE.md`

Replace:
```bash
pnpm lint && pnpm typecheck
```
with:
```bash
pnpm check && pnpm typecheck
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm check` invokes `npx ultracite@latest check` (may report violations)
- [ ] `pnpm fix` invokes `npx ultracite@latest fix`
- [ ] `turbo.json` has no `lint` or `format` tasks
- [ ] `.claude/settings.json` hook references `biome` not `eslint`

---

## Phase 3: Delete ESLint + Prettier Infrastructure

### Overview
Remove all ESLint and Prettier config packages, config files, and catalog entries.

### Changes Required:

#### 1. Delete `internal/eslint/` directory
```bash
rm -rf internal/eslint/
```

Files removed: `base.js`, `react.js`, `nextjs.js`, `hono.js`, `types.d.ts`, `tsconfig.json`, `turbo.json`, `package.json`

#### 2. Delete `internal/prettier/` directory
```bash
rm -rf internal/prettier/
```

Files removed: `index.js`, `tsconfig.json`, `turbo.json`, `package.json`

#### 3. Delete all `eslint.config.js` files (~52 files)
```bash
find . -name "eslint.config.js" -not -path "*/node_modules/*" -delete
```

Full list of files to delete:

**Apps (7)**:
- `apps/console/eslint.config.js`
- `apps/auth/eslint.config.js`
- `apps/docs/eslint.config.js`
- `apps/www/eslint.config.js`
- `apps/relay/eslint.config.js`
- `apps/backfill/eslint.config.js`
- `apps/gateway/eslint.config.js`

**API (1)**: `api/console/eslint.config.js`

**Core (3)**: `core/lightfast/eslint.config.js`, `core/mcp/eslint.config.js`, `core/cli/eslint.config.js`

**DB (1)**: `db/console/eslint.config.js`

**Packages (~28)**: all `packages/*/eslint.config.js`

**Vendor (~12)**: all `vendor/*/eslint.config.js`

#### 4. Delete any `.eslintignore` files
```bash
find . -name ".eslintignore" -not -path "*/node_modules/*" -delete
```

#### 5. Update `pnpm-workspace.yaml` — Remove catalog entries and hoist patterns
**File**: `pnpm-workspace.yaml`

Remove from `catalog:` (lines 17-20):
```yaml
eslint: ^9.23.0
prettier: ^3.8.1
typescript-eslint: ^8.56.1
```

Remove from `publicHoistPattern:` (lines 89-90):
```yaml
- '@ianvs/prettier-plugin-sort-imports'
- prettier-plugin-tailwindcss
```

### Success Criteria:

#### Automated Verification:
- [ ] `find . -name "eslint.config.js" -not -path "*/node_modules/*" | wc -l` returns 0
- [ ] `ls internal/eslint/ 2>/dev/null` fails (directory gone)
- [ ] `ls internal/prettier/ 2>/dev/null` fails (directory gone)
- [ ] `grep -r "eslint" pnpm-workspace.yaml` returns nothing
- [ ] `grep -r "prettier" pnpm-workspace.yaml` returns nothing

---

## Phase 4: Update All Package.json Files

### Overview
Remove ESLint/Prettier devDependencies and lint/format scripts from all ~52 package.json files. Remove the `prettier` config field. Remove `eslint-plugin-react-compiler` from console.

### Changes Required:

#### 1. Remove devDependencies from all packages

Run across all workspace packages:
```bash
pnpm -r remove eslint @repo/eslint-config @repo/prettier-config prettier eslint-plugin-react-compiler
```

This removes from every package.json that has them:
- `"eslint": "catalog:"`
- `"@repo/eslint-config": "workspace:*"`
- `"@repo/prettier-config": "workspace:*"`
- `"prettier": "catalog:"`
- `"eslint-plugin-react-compiler": "19.1.0-rc.2"` (console only)

#### 2. Remove `lint` and `format` scripts from all packages

Every package currently has some combination of:
```json
"lint": "eslint",
"format": "prettier --check . --ignore-path ../../.gitignore",
```

Remove both from all packages. No per-package lint/format scripts needed — everything runs from root.

This is a scripted operation across ~52 `package.json` files. Use `jq` or manual find-replace:
```bash
# Remove lint and format scripts from all package.json files
find . -name "package.json" -not -path "*/node_modules/*" -not -path "./package.json" -exec \
  node -e "
    const fs = require('fs');
    const f = process.argv[1];
    const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (pkg.scripts) {
      delete pkg.scripts.lint;
      delete pkg.scripts.format;
    }
    delete pkg.prettier;
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
  " {} \;
```

#### 3. Remove `"prettier"` field from all packages

Packages like `packages/lib/package.json:60` have:
```json
"prettier": "@repo/prettier-config"
```

This is handled by the script in step 2 above (`delete pkg.prettier`).

### Success Criteria:

#### Automated Verification:
- [ ] `grep -r '"eslint"' */*/package.json packages/*/package.json vendor/*/package.json | grep -v node_modules` returns nothing
- [ ] `grep -r '"prettier"' */*/package.json packages/*/package.json vendor/*/package.json | grep -v node_modules` returns nothing
- [ ] `grep -r '@repo/eslint-config' */*/package.json packages/*/package.json vendor/*/package.json | grep -v node_modules` returns nothing
- [ ] `grep -r '@repo/prettier-config' */*/package.json packages/*/package.json vendor/*/package.json | grep -v node_modules` returns nothing

---

## Phase 5: Run Ultracite Fix + Verify

### Overview
Reinstall dependencies, run Ultracite auto-fix across the entire codebase, then verify everything passes.

### Changes Required:

#### 1. Reinstall dependencies
```bash
pnpm install
```

This removes orphaned ESLint/Prettier packages and installs Biome + Ultracite.

#### 2. Run Ultracite fix
```bash
npx ultracite fix
```

This auto-formats and auto-fixes the entire codebase to Biome's style. Expect a large diff — Biome's formatting differs from Prettier's (e.g., trailing commas, quote style, import ordering).

#### 3. Audit and add file exclusions

After running `ultracite fix`, check for files that shouldn't be linted/formatted:
- Auto-generated type files
- Vendored/copied code
- Template files (`.hbs`)

Add exclusions to `biome.jsonc` `files.includes` as needed:
```jsonc
{
  "files": {
    "includes": [
      "**/*",
      "!path/to/generated/file"
    ]
  }
}
```

#### 4. Run full verification
```bash
pnpm check          # lint + format — should exit 0
pnpm typecheck      # TypeScript — should exit 0
pnpm test           # tests — should exit 0
pnpm build:console  # build — should exit 0
```

#### 5. Verify Claude Code hook works
Edit any `.ts` file — the PostToolUse hook should run `biome check --write` on save.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm check` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm build:console` exits 0
- [ ] No `eslint` or `prettier` packages in `node_modules/.pnpm/` (only as transitive deps of other tools)

#### Manual Verification:
- [ ] Claude Code PostToolUse hook runs Biome on file edits
- [ ] VSCode formats files with Biome on save
- [ ] `pnpm fix` auto-fixes a deliberately introduced issue (e.g., unused import)
- [ ] `npx react-compiler-healthcheck` still passes in `apps/console`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Automated:
- `pnpm check` — all lint + format checks pass
- `pnpm typecheck` — no type regressions
- `pnpm test` — all tests pass
- `pnpm build:console` — build succeeds

### Manual:
1. Open a `.tsx` file in VSCode → verify Biome formats on save
2. Introduce an unused import → verify `pnpm check` catches it
3. Run `pnpm fix` → verify it removes the unused import
4. Edit a file via Claude Code → verify PostToolUse hook runs Biome
5. Run `npx react-compiler-healthcheck` in `apps/console` → verify 134/134 pass

---

## Performance Expectations

Based on benchmarks from research:

| Operation | ESLint + Prettier (current) | Ultracite/Biome (after) | Speedup |
|---|---|---|---|
| Lint full repo | ~8-45s | ~0.5-2s | 15-25x |
| Format full repo | ~12s | ~0.5s | 25x |
| Watch mode re-check | ~2s | ~0.08s | 26x |
| Memory usage | ~2.5GB | ~280MB | 89% reduction |
| Config files | 52 + 12 internal | 1 (`biome.jsonc`) | 64 → 1 |

---

## Migration Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Biome formatting differs from Prettier | Large diff, noisy git blame | Use `git blame --ignore-rev` for the migration commit |
| Missing ESLint rules in Biome | Potential missed bugs | Ultracite enables 287+ rules including nursery; coverage is broad |
| React Compiler enforcement gap | No continuous lint for compiler compat | babel plugin catches issues at build time; healthcheck for CI |
| Import sort order changes | Different grouping than Prettier plugin | Accept Biome's import ordering — functionally equivalent |
| `restrictEnvAccess` gap | `process.env` used outside `env.ts` | t3-env build-time validation catches misuse; Biome has `noProcessEnv` if needed |

---

## References

- next-forge implementation: `/tmp/repos/next-forge/biome.jsonc`, `/tmp/repos/next-forge/package.json`
- Research: `thoughts/shared/research/2026-03-08-linting-typecheck-migration-surface-area.md`
- Research: `thoughts/shared/research/2026-03-08-web-analysis-linting-typecheck-speed-optimization.md`
- Ultracite docs: https://docs.ultracite.ai/
- Biome docs: https://biomejs.dev/
- Turborepo Biome guide: https://turborepo.dev/docs/guides/tools/biome
