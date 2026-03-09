# Extract tech-stack-detector to @lightfastai/viewsrc

## Overview

Extract `packages/tech-stack-detector` from the lightfast monorepo into a new standalone repository at `github.com/lightfastai/viewsrc`, published as `@lightfastai/viewsrc` on npm. Then remove the package from the monorepo via a branch + PR.

## Current State Analysis

### Source: `packages/tech-stack-detector/`
- **Package name**: `@repo/tech-stack-detector@0.1.0` (private)
- **Consumers in monorepo**: Zero — no code imports this package anywhere
- **knip.json**: Listed in both `ignoreWorkspaces` and `ignoreDependencies` (confirming unused)
- **Git history**: 11 commits touching this path
- **Source files**: ~20 files across `src/`, `src/tiers/`, `src/discovery/`, `src/discovery/sources/`
- **Build**: tsup → ESM with DTS and sourcemaps
- **Tests**: vitest with 4 test files (`pipeline.test.ts`, `scoring.test.ts`, `unmatched.test.ts`, `discovery/utils.test.ts`, `tiers/tier1.test.ts`, `tiers/tier2.test.ts`, `discovery/sources/link-extraction.test.ts`)
- **CLI**: `src/cli.ts` — run via `tsx src/cli.ts <url> [--skip-browser] [--json] [--deep]`

### Monorepo Dependencies to Inline
| Dependency | Current | Standalone Replacement |
|---|---|---|
| `@repo/typescript-config` (workspace:*) | Extends `internal/typescript/base.json` | Inline the tsconfig compilerOptions |
| `@types/node` (catalog:) | ^20.16.11 | Pin ^20.16.11 |
| `@vitest/coverage-v8` (catalog:) | ^4.0.18 | Pin ^4.0.18 |
| `typescript` (catalog:) | ^5.8.2 | Pin ^5.8.2 |
| `vitest` (catalog:) | ^4.0.18 | Pin ^4.0.18 |
| `vitest.shared.ts` (../../vitest.shared) | Shared pool/thread config | Inline into local vitest.config.ts |

### Key Discoveries:
- `playwright` is a full dependency (^1.58.2) used in `tiers/tier3.ts` via dynamic import — gracefully degrades if not installed
- The package has zero external package dependencies besides `playwright` — all logic is self-contained
- `registry.ts` is 2001 lines (large signature database of tool detection rules)
- The `base.json` tsconfig at `internal/typescript/base.json:1-23` uses `module: "Preserve"`, `moduleResolution: "Bundler"`, `target: "ES2022"`, `strict: true`

## Desired End State

A standalone repository at `github.com/lightfastai/viewsrc` with:

```
lightfastai/viewsrc/
├── src/
│   ├── cli.ts
│   ├── deep-detect.ts
│   ├── discovery/
│   │   ├── discover.ts
│   │   ├── index.ts
│   │   ├── sources/
│   │   │   ├── common-prefixes.ts
│   │   │   ├── ct-logs.ts
│   │   │   ├── link-extraction.ts
│   │   │   ├── link-extraction.test.ts
│   │   │   └── path-detection.ts
│   │   ├── utils.ts
│   │   └── utils.test.ts
│   ├── index.ts
│   ├── pipeline.ts
│   ├── pipeline.test.ts
│   ├── registry.ts
│   ├── scoring.ts
│   ├── scoring.test.ts
│   ├── tiers/
│   │   ├── tier1.ts
│   │   ├── tier1.test.ts
│   │   ├── tier2.ts
│   │   ├── tier2.test.ts
│   │   └── tier3.ts
│   ├── types.ts
│   ├── unmatched.ts
│   └── unmatched.test.ts
├── .gitignore
├── LICENSE
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

### Verification:
1. `pnpm install` succeeds in standalone repo
2. `pnpm build` produces `dist/` with ESM + DTS
3. `pnpm test` passes all tests
4. `pnpm typecheck` passes
5. `npx @lightfastai/viewsrc vercel.com --skip-browser --json` works
6. Monorepo `pnpm check && pnpm typecheck` pass after removal PR

## What We're NOT Doing

- Publishing to npm in this plan (separate step after repo is stable)
- Adding `@lightfastai/viewsrc` back as a dependency in the monorepo (zero consumers)
- Preserving git history (only 11 commits, fresh repo is cleaner)
- Setting up CI/CD (separate step)
- Adding README documentation (separate step)

## Implementation Approach

1. Create the standalone repo with self-contained config files (inline monorepo dependencies)
2. Copy source code as-is (no code changes)
3. Verify build, tests, and typecheck pass
4. Push to GitHub
5. Remove from monorepo in a branch + PR

---

## Phase 1: Create Standalone Repository

### Overview
Create `github.com/lightfastai/viewsrc` and set up the project scaffolding with all monorepo dependencies inlined.

### Steps:

#### 1. Create GitHub repo
```bash
gh repo create lightfastai/viewsrc --public --clone --gitignore Node
cd /tmp/repos/viewsrc
```

#### 2. Create `package.json`
**File**: `package.json`

```json
{
  "name": "@lightfastai/viewsrc",
  "description": "Detect the tech stack of any website through HTTP headers, DNS, scripts, and browser signals",
  "license": "MIT",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "bin": {
    "viewsrc": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist node_modules",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "playwright": "^1.58.2"
  },
  "devDependencies": {
    "@types/node": "^20.16.11",
    "@vitest/coverage-v8": "^4.0.18",
    "tsup": "^8.5.1",
    "tsx": "^4.21.0",
    "typescript": "^5.8.2",
    "vitest": "^4.0.18"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "keywords": [
    "tech-stack",
    "detection",
    "website",
    "scanner",
    "wappalyzer",
    "builtwith",
    "fingerprint"
  ]
}
```

Key changes from monorepo version:
- Name: `@lightfastai/viewsrc`
- `private: true` removed (will be publishable)
- `bin` field added pointing to `dist/cli.js` so `npx @lightfastai/viewsrc` works
- `files` field added to control what's published
- All `catalog:` and `workspace:*` references replaced with pinned versions
- `@repo/typescript-config` dev dependency removed (tsconfig inlined)

#### 3. Create `tsconfig.json`
**File**: `tsconfig.json`

Inline the config from `internal/typescript/base.json` with the package's own overrides:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "incremental": true,
    "tsBuildInfoFile": ".cache/tsbuildinfo.json",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "checkJs": true,
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "outDir": "dist",
    "baseUrl": "."
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

This is a direct merge of `internal/typescript/base.json` + the package's own `tsconfig.json` overrides (`outDir`, `baseUrl`). The only omission is `disableSourceOfProjectReferenceRedirect` (monorepo-specific, not needed standalone).

#### 4. Create `tsup.config.ts`
**File**: `tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

Note: `src/cli.ts` added as a second entry point so the `bin` field works.

#### 5. Create `vitest.config.ts`
**File**: `vitest.config.ts`

Inline the shared config from `vitest.shared.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 2,
      },
    },
    fileParallelism: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.config.ts",
        "src/cli.ts",
      ],
    },
  },
});
```

#### 6. Create `.gitignore`
**File**: `.gitignore`

```
node_modules/
dist/
.cache/
.turbo/
*.tsbuildinfo
```

#### 7. Create `LICENSE`
**File**: `LICENSE`

Standard MIT license with `Lightfast AI` as the copyright holder.

### Success Criteria:

#### Automated Verification:
- [x] Repo exists: `gh repo view lightfastai/viewsrc`
- [x] All config files created: `ls package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore LICENSE`

#### Manual Verification:
- [ ] Review `package.json` versions are correct
- [ ] Review `tsconfig.json` options match the monorepo base config

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 2: Copy Source Code

### Overview
Copy all source files from `packages/tech-stack-detector/src/` into the standalone repo. No code modifications needed — all imports are relative.

### Steps:

#### 1. Copy source tree
```bash
cp -r /Users/jeevanpillay/Code/@lightfastai/lightfast/packages/tech-stack-detector/src/ /tmp/repos/viewsrc/src/
```

#### 2. Update the CLI shebang
**File**: `src/cli.ts`

Add a shebang line at the top so `npx @lightfastai/viewsrc` works:

```typescript
#!/usr/bin/env node
```

This is the only code modification needed.

### Success Criteria:

#### Automated Verification:
- [x] Source tree structure matches: `find src -type f | sort`
- [x] All expected files present: `ls src/index.ts src/types.ts src/registry.ts src/pipeline.ts src/cli.ts src/deep-detect.ts src/scoring.ts src/unmatched.ts`
- [x] Tiers present: `ls src/tiers/tier1.ts src/tiers/tier2.ts src/tiers/tier3.ts`
- [x] Discovery present: `ls src/discovery/index.ts src/discovery/discover.ts src/discovery/utils.ts src/discovery/sources/`

#### Manual Verification:
- [ ] Spot-check a few files to verify content matches the monorepo source

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Verify Build, Tests & Typecheck

### Overview
Install dependencies and verify everything works in the standalone context.

### Steps:

#### 1. Install dependencies
```bash
cd /tmp/repos/viewsrc
pnpm install
```

#### 2. Run typecheck
```bash
pnpm typecheck
```

#### 3. Run build
```bash
pnpm build
```

#### 4. Run tests
```bash
pnpm test
```

#### 5. Verify CLI works
```bash
npx tsx src/cli.ts vercel.com --skip-browser --json
```

#### 6. Verify built CLI works
```bash
node dist/cli.js vercel.com --skip-browser --json
```

#### 7. Fix any issues
If typecheck/build/test fail, investigate and fix. Likely issues:
- None expected — all imports are relative and all dependencies are accounted for

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm build` produces `dist/index.js`, `dist/index.d.ts`, `dist/cli.js`
- [x] `pnpm test` — all tests pass
- [x] `node dist/cli.js vercel.com --skip-browser --json` outputs valid JSON with detected tools

#### Manual Verification:
- [ ] Review build output size is reasonable
- [ ] Review test output for any skipped/pending tests

**Implementation Note**: This phase may require iteration if issues arise. Pause after verification for manual confirmation.

---

## Phase 4: Push to GitHub

### Overview
Commit all files and push to `github.com/lightfastai/viewsrc`.

### Steps:

#### 1. Commit and push
```bash
cd /tmp/repos/viewsrc
git add -A
git commit -m "feat: initial release of @lightfastai/viewsrc

Tech stack detection for any website via HTTP headers, DNS records,
script analysis, and headless browser signals.

Extracted from lightfastai/lightfast monorepo (packages/tech-stack-detector)."

git push -u origin main
```

### Success Criteria:

#### Automated Verification:
- [x] `git push` succeeds
- [x] `gh repo view lightfastai/viewsrc --json defaultBranchRef` shows main branch

#### Manual Verification:
- [ ] Visit https://github.com/lightfastai/viewsrc and verify directory structure
- [ ] Verify files render correctly on GitHub

**Implementation Note**: Pause for manual confirmation before proceeding to monorepo cleanup.

---

## Phase 5: Remove from Monorepo (Branch + PR)

### Overview
Create a branch in the lightfast monorepo, remove `packages/tech-stack-detector/`, clean up references, and open a PR.

### Steps:

#### 1. Create branch
```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git checkout -b chore/remove-tech-stack-detector main
```

#### 2. Remove the package directory
```bash
rm -rf packages/tech-stack-detector/
```

#### 3. Update `knip.json`
**File**: `knip.json`

Remove from `ignoreWorkspaces`:
```diff
  "ignoreWorkspaces": [
-   "packages/console-remotion",
-   "packages/tech-stack-detector"
+   "packages/console-remotion"
  ],
```

Remove from `ignoreDependencies`:
```diff
  "ignoreDependencies": [
    "@repo/typescript-config",
    "@repo/prettier-config",
    "@repo/eslint-config",
    "@repo/console-remotion",
-   "@repo/tech-stack-detector",
    "tailwindcss",
```

#### 4. Run pnpm install to update lockfile
```bash
pnpm install
```

#### 5. Verify monorepo still works
```bash
pnpm check && pnpm typecheck
```

#### 6. Commit and push
```bash
git add -A
git commit -m "chore: remove tech-stack-detector (extracted to lightfastai/viewsrc)"
git push -u origin chore/remove-tech-stack-detector
```

#### 7. Create PR
```bash
gh pr create \
  --title "chore: remove tech-stack-detector" \
  --body "## Summary
- Removes \`packages/tech-stack-detector/\` — extracted to [lightfastai/viewsrc](https://github.com/lightfastai/viewsrc)
- Cleans up \`knip.json\` references (\`ignoreWorkspaces\` and \`ignoreDependencies\`)
- No code consumers existed in the monorepo — zero import changes needed

## Test plan
- [x] \`pnpm check\` passes
- [x] \`pnpm typecheck\` passes
- [x] No broken imports (package had zero consumers)"
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds after removal
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] PR created successfully

#### Manual Verification:
- [ ] PR diff only removes `packages/tech-stack-detector/` and `knip.json` entries
- [ ] No other packages are affected

---

## Testing Strategy

### Standalone Repo (`viewsrc`):
- `pnpm typecheck` — TypeScript compilation
- `pnpm build` — tsup produces ESM + DTS
- `pnpm test` — All vitest tests pass
- `node dist/cli.js <url> --skip-browser --json` — CLI produces valid output

### Monorepo (after removal):
- `pnpm check` — Biome lint passes
- `pnpm typecheck` — All remaining packages type-check

## References

- Source: `packages/tech-stack-detector/` in lightfast monorepo
- Target: `github.com/lightfastai/viewsrc`
- TypeScript base config: `internal/typescript/base.json`
- Shared vitest config: `vitest.shared.ts`
- knip.json entries: lines 148-149 (`ignoreWorkspaces`) and line 156 (`ignoreDependencies`)
