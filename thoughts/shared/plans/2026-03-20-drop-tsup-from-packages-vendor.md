# Drop tsup from packages/ and vendor/ (and db/)

## Overview

Now that the Hono microservices have been dropped and all consumers are Next.js apps, tsup is no longer needed for internal workspace packages. Next.js's bundler (Turbopack) handles TypeScript transpilation directly. We migrate all 16 tsup-using packages to the source-export pattern already used by 18+ other packages in the repo.

## Current State Analysis

**16 packages use tsup** across three directories:
- `packages/` (9): app-config, app-embed, app-pinecone, app-providers, app-reserved-names, app-rerank, app-validation, inngest, lib
- `vendor/` (6): db, embed, observability, upstash, upstash-realtime, vercel-flags
- `db/` (1): app

**Two existing tsup patterns:**

1. **Full dist** (11 packages) — both `types` and `default` exports point to `./dist/`
   - Build: `"tsup && tsc --incremental false"`
   - These need exports rewritten from `./dist/*.js` → `./src/*.ts`

2. **Hybrid** (5 packages) — `default` already points to `./src/`, only `types` from `./dist/`
   - Build: `"tsup"` (tsup generates `.d.ts`)
   - These just need tsup replaced with `tsc`

**Target pattern** (already used by `@repo/app-api-key`, `@vendor/security`, etc.):
```json
{
  "build": "tsc",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  }
}
```
- `tsc` via `internal-package.json` emits only `.d.ts` files to `dist/`
- Runtime `default` points at raw `.ts` source — bundler transpiles at app build time

### Key Discoveries:
- `internal/typescript/internal-package.json` sets `emitDeclarationOnly: true` + `outDir: "${configDir}/dist"` — tsc only emits `.d.ts`
- `@vendor/db` and `@db/app` use `noExternal: [/^@vendor\//, /^@db\//]` to bundle workspace deps — no longer needed since Next.js resolves these
- All tsup configs use `format: ["esm"]` only — no CJS consumers
- Some packages have root-level `env.ts` (not in `src/`) that need `"./env": "./env.ts"` exports

## Desired End State

- Zero `tsup.config.ts` files in `packages/`, `vendor/`, or `db/`
- Zero `tsup` in any `devDependencies` across these directories
- All packages export `"default"` from `./src/*.ts` (or root `./env.ts` for env files)
- All packages export `"types"` from `./dist/*.d.ts`
- All `"build"` scripts are `"tsc"` (using `internal-package.json` for `.d.ts` emission)
- `pnpm build:app` and `pnpm build:platform` succeed
- `pnpm typecheck` passes
- `pnpm check` passes

### Verification:
```bash
# No tsup configs remaining in scope
find packages vendor db -name "tsup.config.ts" | wc -l  # → 0

# No tsup in devDependencies in scope
grep -r '"tsup"' packages/*/package.json vendor/*/package.json db/*/package.json | wc -l  # → 0

# Build succeeds
pnpm build:app
pnpm build:platform

# Type checking passes
pnpm typecheck
```

## What We're NOT Doing

- **NOT removing tsup from `core/`** — `core/ai-sdk`, `core/cli`, `core/lightfast`, `core/mcp` are published/distributed packages that need compiled JS output
- **NOT changing `@vendor/inngest`** — already uses `tsc` (no tsup), has a different export pattern pointing to `./dist/*.js` because it fully compiles JS

## Implementation Approach

Migrate in three phases by risk level: hybrid packages first (already export from `./src/`), then full-dist packages, then the special `noExternal` packages. Each phase is independently verifiable.

---

## Phase 1: Hybrid Pattern Packages (5 packages)

### Overview
These packages already point `"default"` at `./src/`. We just remove tsup and switch the build to `tsc`.

### Packages:
1. `@repo/app-config` (`packages/app-config`)
2. `@repo/app-embed` (`packages/app-embed`)
3. `@repo/app-rerank` (`packages/app-rerank`)
4. `@repo/app-pinecone` (`packages/app-pinecone`)
5. `@vendor/embed` (`vendor/embed`)

### Changes Required per package:

#### 1. Delete `tsup.config.ts`

#### 2. Update `package.json`
- Change `"build": "tsup"` → `"build": "tsc"`
- Remove `"dev": "tsup --watch"` if present (or change to `"dev": "tsc --watch"`)
- Remove `"tsup"` from `devDependencies`

#### 3. Verify tsconfig.json extends `internal-package.json`
All 5 already extend `@repo/typescript-config/internal-package.json`, so `.d.ts` emission is already configured.

#### 4. No export changes needed
The `"default"` conditions already point at `./src/*.ts`. The `"types"` conditions already point at `./dist/*.d.ts` which tsc will continue to emit.

### Success Criteria:

#### Automated Verification:
- [x] `find packages/app-config packages/app-embed packages/app-rerank packages/app-pinecone vendor/embed -name "tsup.config.ts" | wc -l` → 0
- [x] `grep -c '"tsup"' packages/app-config/package.json packages/app-embed/package.json packages/app-rerank/package.json packages/app-pinecone/package.json vendor/embed/package.json` → all 0
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Full Dist Pattern Packages (9 packages)

### Overview
These packages export both `types` and `default` from `./dist/`. We need to rewrite exports to point `default` at `./src/*.ts` (or root `./env.ts`), keep `types` at `./dist/*.d.ts`, delete tsup, and switch build to `tsc`.

### Packages:
1. `@repo/app-reserved-names` (`packages/app-reserved-names`) — 3 entry points
2. `@repo/app-validation` (`packages/app-validation`) — 7 entry points
3. `@repo/lib` (`packages/lib`) — 6 entry points
4. `@repo/inngest` (`packages/inngest`) — 2 entry points
5. `@repo/app-providers` (`packages/app-providers`) — 3 entry points
6. `@vendor/upstash-realtime` (`vendor/upstash-realtime`) — 2 entry points
7. `@vendor/upstash` (`vendor/upstash`) — 2 entry points (includes root `env.ts`)
8. `@vendor/observability` (`vendor/observability`) — 10 entry points (includes root `env.ts` files)
9. `@vendor/vercel-flags` (`vendor/vercel-flags`) — 2 entry points (includes root `env.ts`)

### Changes Required per package:

#### 1. Delete `tsup.config.ts`

#### 2. Update `package.json`
- Change `"build": "tsup && tsc --incremental false"` → `"build": "tsc"`
- Remove `"dev": "tsup --watch"` if present (or change to `"dev": "tsc --watch"`)
- Remove `"tsup"` from `devDependencies`

#### 3. Rewrite exports

**Pattern for `src/` files:**
```json
// Before
".": {
  "types": "./dist/src/index.d.ts",
  "default": "./dist/src/index.js"
}
// After
".": {
  "types": "./dist/index.d.ts",
  "default": "./src/index.ts"
}
```

Note: tsc with `internal-package.json` emits to `dist/` mirroring `src/` structure but without the `src/` prefix in the path. So `src/index.ts` → `dist/index.d.ts` (not `dist/src/index.d.ts`). However, this depends on the `rootDir` config. Need to verify actual tsc output paths match.

**Pattern for root `env.ts` files** (upstash, vercel-flags, observability):
```json
// Before
"./env": {
  "types": "./dist/env.d.ts",
  "default": "./dist/env.js"
}
// After
"./env": {
  "types": "./dist/env.d.ts",
  "default": "./env.ts"
}
```

#### 4. Verify tsconfig.json

All 9 packages extend `@repo/typescript-config/internal-package.json`. Verify that the `include` array covers all source files (both `src/**` and root-level `env.ts` where applicable).

### Detailed Export Rewrites:

#### `@repo/app-reserved-names`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./workspace": { "types": "./dist/workspace.d.ts", "default": "./src/workspace.ts" },
"./organization": { "types": "./dist/organization.d.ts", "default": "./src/organization.ts" }
```

#### `@repo/app-validation`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./primitives": { "types": "./dist/primitives/index.d.ts", "default": "./src/primitives/index.ts" },
"./schemas": { "types": "./dist/schemas/index.d.ts", "default": "./src/schemas/index.ts" },
"./forms": { "types": "./dist/forms/index.d.ts", "default": "./src/forms/index.ts" },
"./constants": { "types": "./dist/constants/index.d.ts", "default": "./src/constants/index.ts" },
"./utils": { "types": "./dist/utils/index.d.ts", "default": "./src/utils/index.ts" },
"./schemas/api": { "types": "./dist/schemas/api/index.d.ts", "default": "./src/schemas/api/index.ts" }
```

#### `@repo/lib`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./pretty-project-name": { "types": "./dist/pretty-project-name.d.ts", "default": "./src/pretty-project-name.ts" },
"./datetime": { "types": "./dist/datetime/index.d.ts", "default": "./src/datetime/index.ts" },
"./uuid": { "types": "./dist/uuid.d.ts", "default": "./src/uuid.ts" },
"./nanoid": { "types": "./dist/nanoid.d.ts", "default": "./src/nanoid.ts" },
"./friendly-words": { "types": "./dist/friendly-words.d.ts", "default": "./src/friendly-words.ts" }
```

#### `@repo/inngest`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./client": { "types": "./dist/client.d.ts", "default": "./src/client.ts" }
```

#### `@repo/app-providers`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./client": { "types": "./dist/client.d.ts", "default": "./src/client.ts" },
"./contracts": { "types": "./dist/contracts.d.ts", "default": "./src/contracts.ts" }
```

#### `@vendor/upstash-realtime`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./client": { "types": "./dist/client.d.ts", "default": "./src/client.ts" }
```

#### `@vendor/upstash`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./env": { "types": "./dist/env.d.ts", "default": "./env.ts" }
```

#### `@vendor/vercel-flags`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./env": { "types": "./dist/env.d.ts", "default": "./env.ts" }
```

#### `@vendor/observability` (10 entry points)
Need to read the full export map and rewrite each entry. Pattern: `./dist/<path>.js` → `./src/<path>.ts` for runtime, keep `./dist/<path>.d.ts` for types. Root-level env files → `./env.ts` or `./env/<name>.ts`.

### Success Criteria:

#### Automated Verification:
- [x] `find packages/app-reserved-names packages/app-validation packages/lib packages/inngest packages/app-providers vendor/upstash-realtime vendor/upstash vendor/observability vendor/vercel-flags -name "tsup.config.ts" | wc -l` → 0
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Special Cases — `@vendor/db` and `@db/app`

### Overview
These two packages use `noExternal` in their tsup configs to bundle workspace dependencies (`@vendor/*`, `@db/*`, `@repo/*`). This was needed for the old Hono microservices which couldn't resolve workspace deps at runtime. Since all consumers are now Next.js apps (which resolve workspace deps through the bundler), `noExternal` is no longer needed.

### Packages:
1. `@vendor/db` (`vendor/db`) — `noExternal: [/^@vendor\//, /^@db\//]`
2. `@db/app` (`db/app`) — `noExternal: [/^@repo\//, /^@vendor\//, /^@db\//]`

### Changes Required:

Same as Phase 2 — delete tsup.config.ts, update build script, rewrite exports, remove tsup devDep.

#### `@vendor/db`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./env": { "types": "./dist/env.d.ts", "default": "./env.ts" }
```

#### `@db/app`
```json
".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" },
"./schema": { "types": "./dist/schema/index.d.ts", "default": "./src/schema/index.ts" },
"./client": { "types": "./dist/client.d.ts", "default": "./src/client.ts" },
"./utils": { "types": "./dist/utils/workspace.d.ts", "default": "./src/utils/workspace.ts" },
"./env": { "types": "./dist/env.d.ts", "default": "./env.ts" },
"./migrations": "./src/migrations/meta/_journal.json"
```

### Success Criteria:

#### Automated Verification:
- [x] `find vendor/db db/app -name "tsup.config.ts" | wc -l` → 0
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

#### Manual Verification:
- [ ] `pnpm dev:app` starts without errors
- [ ] `pnpm dev:platform` starts without errors
- [ ] Database queries work (the db packages are critical path)

**Implementation Note**: After completing this phase and all verification passes, proceed to Phase 4 (cleanup).

---

## Phase 4: Cleanup

### Overview
Remove tsup as a dependency from the repo and clean up dist artifacts.

### Changes Required:

#### 1. Remove tsup from pnpm catalog (if present)
Check `pnpm-workspace.yaml` for tsup in the catalog.

#### 2. Clean dist directories
```bash
# Remove old tsup-generated JS from dist/ (tsc will only generate .d.ts)
pnpm clean:workspaces
pnpm install
```

#### 3. Verify tsup is gone from lockfile
After `pnpm install`, check that tsup is no longer in `pnpm-lock.yaml` (unless `core/` still needs it).

#### 4. Update .gitignore
Verify each package's `.gitignore` (if any) still correctly ignores `dist/`.

### Success Criteria:

#### Automated Verification:
- [x] `grep -r '"tsup"' packages/*/package.json vendor/*/package.json db/*/package.json | wc -l` → 0
- [x] `find packages vendor db -name "tsup.config.ts" | wc -l` → 0
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

---

## Risk Considerations

### tsc output path structure
The `internal-package.json` sets `outDir: "${configDir}/dist"`. When tsc compiles `src/index.ts`, the `.d.ts` output path depends on whether `rootDir` is set. If tsc sees files at both `src/` and root `env.ts`, it may mirror the full directory structure (e.g., `dist/src/index.d.ts` instead of `dist/index.d.ts`). Need to verify the actual output paths match the exports we write.

**Mitigation**: After each phase, run `tsc` in a package and check the `dist/` output structure before finalizing exports.

### Transitive dependency resolution
`@vendor/db` bundled `@vendor/*` and `@db/*` via `noExternal`. Without bundling, the consuming Next.js apps must be able to resolve these transitive deps. This should work naturally in the monorepo since pnpm hoists to `node_modules/`, but verify with a build.

### `@vendor/inngest` (NOT in scope)
This package already uses `tsc` but exports from `./dist/src/*.js` (compiled JS, not source). This is a separate concern — it may need its own migration if the Hono adapter export (`./hono`) is no longer needed.

## References

- Internal tsconfig: `internal/typescript/internal-package.json`
- Example no-tsup package: `packages/app-api-key/package.json`
- Example no-tsup vendor: `vendor/security/package.json`
