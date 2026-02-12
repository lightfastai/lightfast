---
date: 2026-02-12T10:50:53Z
researcher: Claude
git_commit: 2519b5ce1adc6052a426e85bf9b0276617950d79
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Do we still need @apps/docs/scripts/generate-api-docs.ts or can we run directly from package.json?"
tags: [research, codebase, docs, openapi, build-scripts]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: Generate API Docs Script Necessity

**Date**: 2026-02-12T10:50:53Z
**Researcher**: Claude
**Git Commit**: 2519b5ce1adc6052a426e85bf9b0276617950d79
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question

Do we still need `@apps/docs/scripts/generate-api-docs.ts`, or can we run the command directly from `@apps/docs/package.json`?

## Summary

**The script wrapper is not strictly necessary.** The core command `pnpm --filter @repo/console-openapi generate:openapi` can be run directly from `package.json` without the wrapper script. The script provides only minimal value: error handling, console logging, and CWD manipulation that is unnecessary for `pnpm --filter` commands.

**Key Findings:**
1. The script is a thin wrapper that executes a single `pnpm --filter` command
2. The CWD manipulation (`process.cwd() + "/../.."`) has no effect on execution
3. pnpm --filter automatically locates the workspace root and executes in the target package
4. This is the **only script in the entire codebase** using this pattern - all other `pnpm --filter` calls work without CWD manipulation
5. The script historically generated MDX files but now only triggers OpenAPI spec generation
6. The wrapper provides error handling and logging, but these could be achieved through other means

## Detailed Findings

### Current Script Implementation

**Location**: `apps/docs/scripts/generate-api-docs.ts:1-22`

```typescript
#!/usr/bin/env tsx

import { execSync } from "node:child_process";

async function main() {
  console.log("Generating OpenAPI spec from Zod schemas...");
  try {
    execSync("pnpm --filter @repo/console-openapi generate:openapi", {
      stdio: "inherit",
      cwd: process.cwd() + "/../..",
    });
    console.log("✅ OpenAPI spec generated successfully!");
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }

  console.log("\n✅ Using openapiSource virtual pages for API endpoints (no MDX generation needed)");
}

main();
```

**What it does:**
- Executes `pnpm --filter @repo/console-openapi generate:openapi`
- Manipulates CWD to `process.cwd() + "/../.."` (monorepo root)
- Provides error handling with exit code 1 on failure
- Logs success/failure messages to console
- Displays note about using openapiSource virtual pages

### Usage in Codebase

**Entry Points** (`apps/docs/package.json`):
- Line 11: `"prebuild": "tsx scripts/generate-api-docs.ts"` - Runs automatically before every build
- Line 19: `"generate:api-docs": "tsx scripts/generate-api-docs.ts"` - Manual invocation

**Execution Flow:**
1. User runs `pnpm build` from `apps/docs/` or repo root
2. npm/pnpm lifecycle automatically triggers `prebuild` hook
3. `prebuild` executes `tsx scripts/generate-api-docs.ts` with CWD = `apps/docs/`
4. Script changes CWD to repo root and runs `pnpm --filter`
5. pnpm locates `@repo/console-openapi` package and executes its `generate:openapi` script
6. Target script generates `packages/console-openapi/openapi.json`

**No Direct Imports:**
- No other files import or require this script
- Script is only invoked via npm/pnpm scripts as a CLI command
- Standalone executable with shebang for direct execution

### Target Package Structure

**Location**: `packages/console-openapi/`

**Package Scripts** (`packages/console-openapi/package.json:21`):
```json
"generate:openapi": "tsx scripts/generate.ts"
```

**Generation Script** (`packages/console-openapi/scripts/generate.ts:1-13`):
- Uses `__dirname` for path resolution (not `process.cwd()`)
- Writes to `../openapi.json` relative to script location
- Output: `packages/console-openapi/openapi.json`
- **CWD-independent**: Uses `__dirname`, so caller's CWD doesn't matter

### CWD Manipulation Analysis

#### Is CWD Manipulation Necessary?

**NO.** The CWD manipulation has no effect on execution behavior.

**Why pnpm --filter doesn't need CWD manipulation:**

1. **Workspace Root Auto-Detection**: pnpm --filter automatically locates the workspace root by searching parent directories for `pnpm-workspace.yaml`

2. **Target Package CWD**: pnpm --filter always sets `process.cwd()` to the target package directory (`packages/console-openapi/`) regardless of where the command is invoked from

3. **Target Script Uses __dirname**: The target script (`packages/console-openapi/scripts/generate.ts`) uses `__dirname` for path resolution, making it independent of the calling process's CWD

**Workspace Configuration** (`pnpm-workspace.yaml:6`):
```yaml
packages:
  - packages/*    # Includes console-openapi
```

**NPMRC Settings** (`.npmrc:6-8`):
```
link-workspace-packages=true
prefer-workspace-packages=true
shared-workspace-lockfile=true
```

#### Evidence from Other Usage

**This is the ONLY script using this pattern.** All other `pnpm --filter` usage in the codebase works without CWD manipulation:

**Root-level scripts** (`package.json:27-29`):
```json
"cms:types": "pnpm --filter @lightfast/www cms:types",
"cms:dev": "pnpm --filter @lightfast/www cms:dev",
"cms:analyze": "pnpm --filter @lightfast/www cms:analyze",
```
- Execute from repo root (CWD = repo root)
- No explicit CWD manipulation
- Successfully locate and execute in target packages

**Nested package scripts** (`apps/www/package.json:17-19`):
```json
"cms:types": "pnpm with-env:dev pnpm --filter @vendor/cms exec basehub generate",
"cms:dev": "pnpm with-env:dev pnpm --filter @vendor/cms exec basehub dev",
"cms:analyze": "pnpm with-env:dev pnpm --filter @vendor/cms exec basehub",
```
- Execute from `apps/www/` (CWD = `apps/www/`)
- No explicit CWD manipulation in the `pnpm --filter` calls
- Successfully locate and execute in `vendor/cms/` package

### Historical Context

#### Original Implementation (commit 2fff7210)
**"feat(docs): implement automated API documentation generation from Zod schemas"**

The script originally did more:
- Generated both OpenAPI spec AND MDX endpoint files
- Used `fumadocs-openapi`'s `generateFiles()` function
- Included AlphaBanner injection logic for generated MDX files
- Created MDX files in `./src/content/api/endpoints` directory
- Configured with `groupBy: "tag"`, `per: "operation"`, `includeDescription: true`

#### Refactored Version (commit 006554d2)
**"refactor(docs): extract OpenAPI generation to dedicated package"**

- Removed AlphaBanner injection code
- Kept both OpenAPI generation and MDX file generation
- Changed filter from `@repo/console-types` to `@repo/console-openapi`

#### Current Version (uncommitted changes)
- **Removed MDX file generation entirely**
- Only generates OpenAPI spec from Zod schemas
- Comment at line 18: "Using openapiSource virtual pages for API endpoints (no MDX generation needed)"
- Switched from generated MDX files to fumadocs-openapi virtual pages

**Evolution Summary**: The script has been simplified from a complex multi-step generator to a thin wrapper around a single command. Its current form provides minimal value beyond error handling and logging.

## Code References

- `apps/docs/scripts/generate-api-docs.ts:1-22` - Full script implementation
- `apps/docs/scripts/generate-api-docs.ts:8-11` - execSync call with CWD manipulation
- `apps/docs/package.json:11` - prebuild hook
- `apps/docs/package.json:19` - manual script command
- `packages/console-openapi/package.json:21` - generate:openapi target script
- `packages/console-openapi/scripts/generate.ts:1-13` - Actual OpenAPI generation logic
- `packages/console-openapi/scripts/generate.ts:9-10` - Uses __dirname for path resolution
- `pnpm-workspace.yaml:6` - Workspace package patterns
- `.npmrc:6-8` - Workspace configuration

## Architecture Documentation

### Current Build Pipeline

```
pnpm build (apps/docs)
    ↓
prebuild hook (package.json:11)
    ↓
tsx scripts/generate-api-docs.ts
    ↓
execSync with CWD manipulation
    ↓
pnpm --filter @repo/console-openapi generate:openapi
    ↓
packages/console-openapi/scripts/generate.ts
    ↓
packages/console-openapi/openapi.json (generated)
    ↓
next build (reads openapi.json via fumadocs-openapi)
```

### Pattern Comparison

**Current Pattern** (UNIQUE in codebase):
```typescript
execSync("pnpm --filter <package> <script>", {
  cwd: process.cwd() + "/../..",
  stdio: "inherit",
});
```

**Standard Pattern** (used everywhere else):
```json
"script-name": "pnpm --filter <package> <script>"
```

### Alternative Approaches

#### Option 1: Direct Command in package.json (Simplest)
```json
"prebuild": "pnpm --filter @repo/console-openapi generate:openapi",
"generate:api-docs": "pnpm --filter @repo/console-openapi generate:openapi"
```

**Pros:**
- Simplest solution
- Consistent with other scripts in the codebase
- No additional file to maintain
- Works from any CWD in the monorepo

**Cons:**
- Loses custom error messages and logging
- No explicit exit code handling (though pnpm propagates failures)
- Less obvious what the command is doing from package.json alone

#### Option 2: Keep Wrapper, Remove CWD Manipulation
```typescript
execSync("pnpm --filter @repo/console-openapi generate:openapi", {
  stdio: "inherit",
  // Remove cwd option entirely
});
```

**Pros:**
- Keeps error handling and logging
- Removes unnecessary CWD manipulation
- More explicit about what's happening

**Cons:**
- Still maintains separate script file
- Minimal value over direct command

#### Option 3: Enhanced Wrapper (If Keeping Script)
```typescript
execSync("pnpm --filter @repo/console-openapi generate:openapi", {
  stdio: "inherit",
});
// Add validation, timing, or other features
```

**Pros:**
- Room to add more value (validation, timing, etc.)
- Centralized place for docs-related generation logic

**Cons:**
- Only worth it if additional features are needed
- Currently provides minimal value

## Historical Context (from thoughts/)

Related planning documents:
- `thoughts/shared/plans/2026-02-12-full-schema-docs-sync.md:57` - Notes it triggers OpenAPI generation via prebuild hook
- `thoughts/shared/plans/2026-02-12-fumadocs-v10-ecosystem-upgrade.md:28` - Documents build pipeline with this script
- `thoughts/shared/plans/2026-02-12-api-docs-auto-generation.md` - Original implementation plan for automated API docs generation
- `thoughts/shared/research/2026-02-12-sdk-mcp-docs-schema-sync.md:120` - Lists as prebuild hook for docs
- `thoughts/shared/research/2026-02-12-openapi-docs-ui-customization.md:46` - Documents the old `generateFiles()` configuration

## Related Research

No directly related research documents found in `thoughts/shared/research/`.

## Conclusion

**The wrapper script is not necessary for functional reasons** - the command could be run directly from `package.json`. However, the wrapper provides:

1. **Custom logging** - Clear messages about what's being generated
2. **Error handling** - Explicit error messages and exit codes
3. **Documentation** - Comment about using openapiSource virtual pages
4. **Historical evolution** - Shows the progression from complex to simple

**The CWD manipulation is definitely unnecessary** - it's the only occurrence of this pattern in the codebase, and all other `pnpm --filter` usage works without it.

**Recommendation paths:**
- **If simplicity is prioritized**: Replace with direct command in package.json
- **If explicit error handling is valued**: Keep script but remove CWD manipulation
- **If additional features planned**: Keep script and enhance with validation, timing, or other features

The choice depends on whether the team values the explicit logging and error handling enough to maintain a separate script file, or prefers the simplicity and consistency of using direct commands like the rest of the codebase.
