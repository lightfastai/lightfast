# Fix Turbo Typecheck Output Warnings

## Overview

Remove unnecessary `tsBuildInfoFile` overrides from 7 packages that point to `dist/` instead of the expected `.cache/tsbuildinfo.json`, causing Turborepo warnings about missing output files for the `typecheck` task.

## Current State Analysis

The base TypeScript config (`internal/typescript/base.json:14`) correctly sets:
```json
"tsBuildInfoFile": "${configDir}/.cache/tsbuildinfo.json"
```

The root `turbo.json:62-66` expects typecheck outputs at:
```json
"typecheck": {
  "outputs": [".cache/tsbuildinfo.json"]
}
```

These align. However, 7 packages override `tsBuildInfoFile` to `dist/.tsbuildinfo.json`, breaking the alignment and causing Turbo to warn about missing output files.

### Why the override is safe to remove

All affected packages use one of:
- `tsup && tsc --incremental false` for build (the `--incremental false` flag prevents `.tsbuildinfo` from being written, so the path is irrelevant)
- `tsup` only for build (doesn't run tsc at all)

The `tsBuildInfoFile` only matters for the `typecheck` task (`tsc --noEmit`), where TypeScript 5.x writes `.tsbuildinfo` even with `--noEmit` when `incremental: true` is set. Removing the override lets it default to `.cache/tsbuildinfo.json`, matching Turbo's expected output.

### Key Discoveries:
- `internal/typescript/base.json:14` — default `tsBuildInfoFile` is `.cache/tsbuildinfo.json`
- `internal/typescript/internal-package.json:8` — sets `noEmit: false` for declaration emit during build
- `turbo.json:64` — expects `.cache/tsbuildinfo.json` as typecheck output
- Only `vendor/pinecone/tsconfig.json` correctly uses `.cache/tsbuildinfo.json` among packages that set it explicitly

## Desired End State

All packages inherit `tsBuildInfoFile` from base.json (pointing to `.cache/tsbuildinfo.json`), and running `pnpm typecheck` produces zero Turbo warnings about missing output files.

### Verification:
```bash
pnpm typecheck 2>&1 | grep "no output files"
# Should return empty (no warnings)
```

## What We're NOT Doing

- Changing the root turbo.json typecheck task definition
- Modifying any package's typecheck script command
- Changing the base TypeScript config
- Altering build behavior (build uses `--incremental false`, unaffected)

## Implementation Approach

Simple tsconfig.json edits across 7 packages — remove the `tsBuildInfoFile` line that overrides the base config default.

## Phase 1: Remove tsBuildInfoFile Overrides

### Overview
Remove the `tsBuildInfoFile` override from all 7 affected packages' tsconfig.json files.

### Changes Required:

#### 1. `db/console/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {},
  "include": ["env.ts", "src"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2. `core/ai-sdk/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "./dist/.tsbuildinfo"`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "include": ["src/**/*"],
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "types": ["node"],
    "lib": ["ES2022", "DOM"]
  },
  "exclude": ["node_modules", "dist", "examples"]
}
```

#### 3. `vendor/vercel-flags/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "paths": {
      "~/env": ["./env.ts"]
    }
  },
  "include": ["env.ts", "src"],
  "exclude": ["node_modules", "dist"]
}
```

#### 4. `vendor/upstash/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

#### 5. `vendor/qstash/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

#### 6. `vendor/db/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

#### 7. `vendor/upstash-workflow/tsconfig.json`
**Remove**: `"tsBuildInfoFile": "dist/.tsbuildinfo.json"`

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes with no warnings: `pnpm typecheck 2>&1 | grep -c "no output files"` returns `0`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build still works: `pnpm build:console`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Confirm `.cache/tsbuildinfo.json` is generated in the affected packages after typecheck
- [ ] Confirm `dist/` output from build is unchanged

## References

- Base TypeScript config: `internal/typescript/base.json:14`
- Root turbo config: `turbo.json:62-66`
- Working example: `vendor/pinecone/tsconfig.json:4`
