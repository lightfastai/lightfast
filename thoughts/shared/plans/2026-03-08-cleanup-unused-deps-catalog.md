# Cleanup Unused Dependencies & Catalog Entries

## Overview

Remove verified unused dependencies, devDependencies, and catalog entries flagged by knip. Fix knip.json false positives so future runs are clean.

## Current State Analysis

Knip reports 11 unused deps, 78 unused devDeps, and 14 unused catalog entries. After research:
- **3 deps** are truly unused, 1 needs moving to devDeps, 7 are false positives (knip config issues)
- **9 devDeps** are truly unused, rest are false positives
- **10 catalog entries** are completely dead, 4 are bypassed (package uses pinned version instead of `catalog:`)

## What We're NOT Doing

- Removing unused files, exports, or types (separate task)
- Cleaning up the 78 devDeps that are framework false positives (tailwindcss, postcss, eslint, prettier, srvx, tsx, import-in-the-middle, require-in-the-middle, autoprefixer)
- Removing `@browserbasehq/stagehand` from `pnpm.overrides` in root package.json (only removing the catalog entry)

## Phase 1: Remove Truly Unused Dependencies

### 1a. Remove unused `dependencies`

| Package | Location | Reason |
|---------|----------|--------|
| `zod` | `db/console/package.json` | Zero imports in db/console/src/ |
| `gray-matter` | `packages/cms-workflows/package.json` | Zero imports in cms-workflows/src/ |
| `@octokit/webhooks-types` | `packages/console-test-data/package.json` | Zero imports in console-test-data/src/ |

### 1b. Move `drizzle-orm` from deps to devDeps in `apps/gateway`

Used only in test files (`vi.mock("drizzle-orm", ...)`) — belongs in devDependencies.

### 1c. Remove unused `devDependencies`

| Package | Location | Reason |
|---------|----------|--------|
| `@rollup/rollup-darwin-arm64` | `core/ai-sdk/package.json` | Redundant — rollup's optionalDeps auto-install it |
| `rollup` | `core/ai-sdk/package.json` | Redundant — tsup bundles rollup as its own dep |
| `vite` | `core/ai-sdk/package.json` | Redundant — vitest bundles vite internally |
| `nosecone` | `apps/console/package.json` | Zero imports — `@nosecone/next` in `@vendor/security` provides it |
| `@types/eslint` | `packages/ui/package.json` | Zero usage — typescript-eslint provides needed types |
| `@api/console` | `packages/integration-tests/package.json` | Tests use tsconfig path alias `@console/*` instead |
| `@lightfast/backfill` | `packages/integration-tests/package.json` | Tests use tsconfig path alias `@backfill/app` instead |
| `@lightfast/gateway` | `packages/integration-tests/package.json` | Tests use tsconfig path alias `@gateway/app` instead |
| `@lightfast/relay` | `packages/integration-tests/package.json` | Tests use tsconfig path alias `@relay/app` instead |

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` succeeds (no broken peer deps)
- [x] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [x] `pnpm --filter @db/console build` passes
- [x] `pnpm --filter @lightfast/gateway build` passes
- [x] `pnpm --filter @lightfastai/ai-sdk build` passes
- [x] `pnpm --filter @repo/ui build` passes

---

## Phase 2: Clean Up Catalog Entries

### 2a. Remove 10 dead catalog entries from `pnpm-workspace.yaml`

These have zero references in any package.json:

| Entry | Line |
|-------|------|
| `@ai-sdk/provider` | 25 |
| `@vercel/blob` | 29 |
| `@vercel/sandbox` | 31 |
| `redis` | 32 |
| `exa-js` | 34 |
| `@browserbasehq/stagehand` | 35 |
| `@clerk/elements` | 40 |
| `@clerk/themes` | 43 |
| `@sentry/profiling-node` | 54 |
| `postgres` | 60 |

### 2b. Fix 4 bypassed catalog entries

These packages exist in the catalog AND in package.json but the package.json uses a pinned version instead of `catalog:`. Two options: remove the catalog entry (if only 1 consumer) or switch the consumer to `catalog:`.

| Entry | Consumer | Action |
|-------|----------|--------|
| `@types/eslint__js` | `internal/eslint/package.json:33` (pinned `8.42.3`) | Remove catalog entry (single consumer, pinned for reason) |
| `@eslint/js` | `internal/eslint/package.json:21` (pinned `^9.37.0`) | Remove catalog entry (single consumer) |
| `turbo` | `package.json:62` (pinned `^2.8.11`) | Remove catalog entry (root-only, already ahead at `^2.8.11` vs catalog `^2.5.5`) |
| `resumable-stream` | `core/ai-sdk/package.json:79` (pinned `^2.0.0`) | Remove catalog entry (single consumer) |

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes

---

## Phase 3: Fix knip.json False Positives

Fix the knip configuration so verified false positives don't appear in future runs.

### 3a. Fix workspace patterns for packages with non-standard layouts

Several vendor packages have source files at the package root (`lib/`, `env.ts`) rather than in `src/`. The current `vendor/*` config only looks at `src/**/*.ts`.

**vendor/cms** — uses `lib/`, `components/` at root:
```json
"vendor/cms": {
  "entry": ["src/index.ts", "lib/**/*.ts", "components/**/*.tsx"],
  "project": ["src/**/*.ts", "lib/**/*.ts", "components/**/*.tsx"]
}
```

**vendor/inngest** — has `env.ts` at root:
```json
"vendor/inngest": {
  "entry": ["src/index.ts", "env.ts"],
  "project": ["src/**/*.ts", "env.ts"]
}
```

**vendor/upstash-workflow** — has `src/nextjs.ts` as additional entry:
Already covered by `src/**/*.ts` pattern. The `next` dep is a transitive runtime requirement of `@upstash/workflow/nextjs`. Add to ignoreDependencies.

### 3b. Add ignoreDependencies for legitimate but unfindable deps

These deps are real but knip can't detect them through static analysis:

**apps/gateway** — `drizzle-orm` used only in `vi.mock()`:
```json
"apps/gateway": {
  ...existing config...,
  "ignoreDependencies": ["drizzle-orm"]
}
```

**packages/og** — `react` needed for JSX transform:
```json
"packages/og": {
  "entry": ["src/index.ts"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignoreDependencies": ["react"]
}
```

**vendor/upstash-workflow** — `next` required transitively:
```json
"vendor/upstash-workflow": {
  "entry": ["src/index.ts"],
  "project": ["src/**/*.ts"],
  "ignoreDependencies": ["next"]
}
```

### 3c. Add global ignoreDependencies for framework tooling

Many devDeps are flagged because they're used by build tooling (PostCSS plugins, Tailwind, instrumentation hooks) rather than imported directly. Add these to the global `ignoreDependencies`:

```json
"ignoreDependencies": [
  ...existing...,
  "tailwindcss",
  "@tailwindcss/postcss",
  "@tailwindcss/typography",
  "postcss",
  "autoprefixer",
  "import-in-the-middle",
  "require-in-the-middle",
  "srvx",
  "tsx",
  "prettier",
  "eslint"
]
```

### 3d. Fix knip configuration hints

Remove stale ignore patterns and fix entry patterns:

1. Remove from `ignore`: `tmp/**`, `worktrees/**`, `thoughts/**` only if they don't match any files (knip says "Remove from ignore" — but these are intentional, keep them)
2. Remove stale `ignoreDependencies`: `@repo/console-remotion`, `@repo/tech-stack-detector` (knip says "Remove from ignoreDependencies" — only remove if those packages truly no longer exist)

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes
- [ ] `npx knip` shows significantly fewer false positives in deps/devDeps categories
- [ ] No regressions: all items we marked as false positives are now properly handled

---

## Testing Strategy

### Automated:
- `pnpm install` — verify no broken dep resolution
- `pnpm typecheck` — verify no missing type deps
- `pnpm lint` — verify no broken eslint configs
- `npx knip 2>&1 | grep "Unused dependencies"` — verify count drops to 0

### Manual:
- Review `npx knip` output to confirm only expected items remain
- Spot-check that `pnpm dev:console` still starts cleanly

## References

- Branch: `chore/cleanup-ai-vendor-unused-deps`
- Previous cleanup commits: `35a2e2cf7`, `1244ecb89`, `e96ae2346`
