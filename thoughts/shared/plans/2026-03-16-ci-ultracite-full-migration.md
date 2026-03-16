---
date: 2026-03-16T00:00:00+11:00
researcher: claude
git_commit: 1abc02b4e7c7d38eccdfd10ee18a1c6804450778
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Fix CI/CD failures — full ultracite/biome migration"
tags: [ci, biome, ultracite, eslint, lint, quality]
status: complete
last_updated: 2026-03-16
---

# CI/CD Fix: Full Ultracite/Biome Migration Implementation Plan

## Overview

Two CI jobs are failing on PR #454. The root cause is that both CI workflows invoke `pnpm turbo lint typecheck`, but no `lint` task exists in `turbo.json` and no workspace package defines a `"lint"` script — because the repo already migrated linting to ultracite/biome (`pnpm check`), but the CI workflows were never updated. A secondary test failure exists because a refactor removed `includeContext`/`includeHighlights` from the SDK client but left the test assertion unchanged.

This plan completes the ultracite migration: update CI to use `pnpm check`, purge all ESLint remnants, and fix the stale test.

## Current State Analysis

### CI Failures (as of 2026-03-16)
- **`CI` workflow / `quality` job**: `pnpm turbo lint typecheck --affected --continue` → `Could not find task 'lint' in project`
- **`Core CI` workflow / `quality` job**: `pnpm turbo lint typecheck --filter=lightfast ...` → same error
- **`Core CI` workflow / `test` job**: `should apply default parameters` → `AssertionError: expected { query, limit, offset, mode } to deeply equal { query, limit, offset, mode, includeContext: true, includeHighlights: true }`

### Root Causes
1. `turbo.json` has no `lint` task. No workspace package has a `"lint"` script. Linting is handled exclusively by `pnpm check` (`npx ultracite@latest check` → `biome check --no-errors-on-unmatched ./`) at the monorepo root.
2. Commit `83e8af7d8` removed `includeContext`/`includeHighlights` from `client.ts` and `types.ts` as part of the entity-type refactor, but `client.test.ts` was not updated.

### ESLint Remnants to Purge
| File | What remains |
|---|---|
| `apps/gateway/eslint.config.js` | Entire file — imports non-existent `@repo/eslint-config/hono` |
| `packages/console-trpc/package.json` | `"eslintConfig": { "extends": "@repo/eslint-config/base" }` field |
| `packages/console-clerk-m2m/package.json` | `"eslintConfig": { "extends": "@repo/eslint-config/base" }` field |
| `.changeset/pre.json` | `"@repo/eslint-config": "0.3.0"` in `initialVersions` |

## Desired End State

- Both `CI` and `Core CI` GitHub Actions workflows pass on PR #454
- `pnpm turbo lint` no longer appears anywhere in CI — replaced by `pnpm check`
- No ESLint config files, fields, or package references exist outside `node_modules/`
- `core/lightfast/src/client.test.ts` assertion matches the current `search()` implementation
- `pnpm check` is the single source of truth for linting in CI

### Verification
- PR #454 CI checks turn green: Quality (both workflows) and Test
- `grep -r "eslint" --include="*.json" --include="*.js" --include="*.ts" --exclude-dir=node_modules .` returns no results outside `node_modules/`

## What We're NOT Doing

- Adding per-package `lint` scripts (biome operates on the whole monorepo from root — per-package lint is anti-pattern for biome)
- Adding a `lint` task to `turbo.json` (unnecessary; biome is not per-package)
- Adding `includeContext`/`includeHighlights` back to the SDK client (they were removed intentionally; the canonical `SearchRequestSchema` doesn't have them)
- Modifying the `biome.jsonc` configuration
- Running `pnpm install` or touching the lockfile (no dependency changes)

## Implementation Approach

Three targeted changes in a single commit:
1. Fix CI workflow commands (2 files)
2. Remove ESLint remnants (4 files)
3. Fix stale test assertion (1 file)

---

## Phase 1: Fix CI Workflows

### Overview
Replace `pnpm turbo lint typecheck` with `pnpm check && pnpm turbo typecheck` in both workflow files. `pnpm check` runs biome across the full monorepo. `pnpm turbo typecheck` remains per-package via turbo (unchanged behavior).

### Changes Required

#### 1. `.github/workflows/ci.yml`
**File**: `.github/workflows/ci.yml`
**Line 43**: Replace lint+typecheck step

```yaml
# Before:
- name: Lint and type check affected packages
  env:
    SKIP_ENV_VALIDATION: "true"
    TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
  run: pnpm turbo lint typecheck --affected --continue

# After:
- name: Lint (biome)
  run: pnpm check

- name: Type check affected packages
  env:
    SKIP_ENV_VALIDATION: "true"
    TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
  run: pnpm turbo typecheck --affected --continue
```

#### 2. `.github/workflows/ci-core.yml`
**File**: `.github/workflows/ci-core.yml`
**Line 42**: Replace lint+typecheck step

```yaml
# Before:
- name: Lint and type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo lint typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue

# After:
- name: Lint (biome)
  run: pnpm check

- name: Type check packages
  env:
    SKIP_ENV_VALIDATION: "true"
  run: pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli --continue
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm check` exits 0 locally
- [ ] `pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli` exits 0

---

## Phase 2: Remove ESLint Remnants

### Overview
Delete the orphaned gateway ESLint config and remove inline `"eslintConfig"` fields from two package.json files. Also clean the changeset pre.json.

### Changes Required

#### 1. Delete `apps/gateway/eslint.config.js`
**Action**: Delete file entirely. It imports from `@repo/eslint-config/hono` which does not exist. No script in `apps/gateway/package.json` invokes it.

#### 2. `packages/console-trpc/package.json`
**Action**: Remove the `"eslintConfig"` field:
```json
// Remove this entire field:
"eslintConfig": {
  "extends": "@repo/eslint-config/base"
}
```

#### 3. `packages/console-clerk-m2m/package.json`
**Action**: Remove the `"eslintConfig"` field:
```json
// Remove this entire field:
"eslintConfig": {
  "extends": "@repo/eslint-config/base"
}
```

#### 4. `.changeset/pre.json`
**Action**: Remove `"@repo/eslint-config": "0.3.0"` from the `"initialVersions"` object.

### Success Criteria

#### Automated Verification
- [ ] `grep -r "eslint" --include="*.json" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=tmp --exclude-dir=worktrees .` returns no matches

---

## Phase 3: Fix Stale Test Assertion

### Overview
`core/lightfast/src/client.test.ts:104-111` asserts the search request body contains `includeContext: true` and `includeHighlights: true`. These were removed from `client.ts` in commit `83e8af7d8` when the canonical `SearchRequestSchema` (which never had them) replaced the old `V1SearchRequest` type. Update the test to match the current implementation.

### Changes Required

#### `core/lightfast/src/client.test.ts`
**File**: `core/lightfast/src/client.test.ts`
**Lines 104-111**: Update the `toEqual` assertion

```typescript
// Before:
expect(body).toEqual({
  query: "test",
  limit: 10,
  offset: 0,
  mode: "balanced",
  includeContext: true,
  includeHighlights: true,
});

// After:
expect(body).toEqual({
  query: "test",
  limit: 10,
  offset: 0,
  mode: "balanced",
});
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm --filter lightfast test` passes with 29/29 tests

---

## Testing Strategy

### Automated
```bash
# Verify lint passes
pnpm check

# Verify core package typechecks
pnpm turbo typecheck --filter=lightfast --filter=@lightfastai/mcp --filter=@lightfastai/cli

# Verify test suite
pnpm --filter lightfast test

# Verify no ESLint remnants
grep -r "eslint" --include="*.json" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=tmp --exclude-dir=worktrees . | grep -v ".changeset"
```

### Manual
- [ ] Push branch and verify PR #454 CI checks turn green (Quality + Test on both workflows)

## References

- PR #454: `feat/backfill-depth-entitytypes-run-tracking`
- CI failure logs: run `23124885552` (Core CI), run `23124885563` (CI)
- `client.ts` refactor: commit `83e8af7d8`
- Canonical search schema: `packages/console-validation/src/schemas/api/search.ts`
