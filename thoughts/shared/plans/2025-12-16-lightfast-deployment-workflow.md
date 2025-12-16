---
date: 2025-12-16T16:30:00+11:00
author: Claude
git_commit: 85e1827464d0588643d09cc5aeb054e39ab5b677
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Lightfast Dual-Package Deployment Workflow"
tags: [plan, deployment, ci, release, versioning, github-actions, dual-package]
status: draft
last_updated: 2025-12-16
last_updated_by: Claude
---

# Lightfast Dual-Package Deployment Workflow Implementation Plan

## Overview

Implement synchronized publishing workflow for `lightfast` and `@lightfastai/mcp` packages. Both packages will always share the same version number and publish together, ensuring users always have compatible versions.

## Current State Analysis

**Packages:**
- `lightfast` @ `0.1.0-alpha.1` - Neural Memory SDK (core)
- `@lightfastai/mcp` @ `0.1.0-alpha.1` - MCP Server (depends on `lightfast` via `workspace:*`)

**Current Gaps:**
1. CI only validates `core/lightfast/` changes, ignores `core/mcp/`
2. Release workflow only builds/tests `lightfast`
3. Changeset config has no version synchronization (`fixed: []`)
4. Verify-changeset only accepts `lightfast` package name

### Key Discoveries:
- CI workflow is already clean (no legacy compiler references): `.github/workflows/ci.yml`
- Release workflow is already clean: `.github/workflows/release.yml`
- MCP depends on `lightfast` via `workspace:*`: `core/mcp/package.json:52`
- Both packages already at matching versions: `0.1.0-alpha.1`
- Both packages have `publishConfig.tag: "latest"` (keeping as-is per user decision)

## Desired End State

After implementation:
1. Both packages always have identical version numbers (via `fixed` config)
2. CI validates both packages on PRs (lint, typecheck, build)
3. Release workflow builds both packages before publishing
4. Changesets can mention either package, both get bumped together
5. npm publish order: `lightfast` first, then `@lightfastai/mcp` (automatic via dependency graph)

### Verification:
```bash
# After implementation, verify synchronized versions
pnpm changeset status  # Shows both packages at same version

# Verify CI change detection
grep "core/mcp" .github/workflows/ci.yml  # Should find mcp path

# Verify fixed config
jq '.fixed' .changeset/config.json  # Should show both packages
```

## What We're NOT Doing

- Adding tests to `core/mcp/` (scaffold later)
- Changing `publishConfig.tag` from `"latest"` to `"alpha"`
- Adding canary release channel
- Adding integration tests between packages

## Implementation Approach

Three phases:
1. Configure changeset version synchronization (foundation)
2. Update CI workflow to validate both packages
3. Update release workflow and verify-changeset for dual-package publishing

---

## Phase 1: Changeset Configuration

### Overview
Configure changesets to synchronize versions between `lightfast` and `@lightfastai/mcp` using the `fixed` array.

### Changes Required:

#### 1. Update Changeset Config
**File**: `.changeset/config.json`
**Changes**: Add fixed array to synchronize package versions

**Before**:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**After**:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["lightfast", "@lightfastai/mcp"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### Success Criteria:

#### Automated Verification:
- [x] Config is valid JSON: `cat .changeset/config.json | jq .`
- [x] Fixed array contains both packages: `jq '.fixed[0]' .changeset/config.json`

#### Manual Verification:
- [ ] Run `pnpm changeset` and verify it shows both packages in the fixed group

---

## Phase 2: CI Workflow Updates

### Overview
Update CI to detect changes in `core/mcp/` and validate both packages (lint, typecheck, build).

### Changes Required:

#### 1. Update Change Detection
**File**: `.github/workflows/ci.yml`
**Lines**: 29-33
**Changes**: Add `core/mcp/**` to change detection paths

**Before**:
```yaml
          filters: |
            lightfast-core:
              - 'core/lightfast/**'
              - 'pnpm-lock.yaml'
              - '.github/workflows/ci.yml'
```

**After**:
```yaml
          filters: |
            lightfast-core:
              - 'core/lightfast/**'
              - 'core/mcp/**'
              - 'pnpm-lock.yaml'
              - '.github/workflows/ci.yml'
```

#### 2. Update Lint Job
**File**: `.github/workflows/ci.yml`
**Lines**: 59-60
**Changes**: Lint both packages

**Before**:
```yaml
      - name: Lint lightfast
        run: pnpm --filter lightfast lint || echo "⚠️ Linting issues found but not blocking CI"
```

**After**:
```yaml
      - name: Lint packages
        run: |
          pnpm --filter lightfast lint || echo "⚠️ Linting issues found in lightfast but not blocking CI"
          pnpm --filter @lightfastai/mcp lint || echo "⚠️ Linting issues found in @lightfastai/mcp but not blocking CI"
```

#### 3. Update Typecheck Job
**File**: `.github/workflows/ci.yml`
**Lines**: 86-87
**Changes**: Typecheck both packages

**Before**:
```yaml
      - name: Type check lightfast
        run: pnpm --filter lightfast typecheck || echo "⚠️ Type errors found but not blocking CI"
```

**After**:
```yaml
      - name: Type check packages
        run: |
          pnpm --filter lightfast typecheck || echo "⚠️ Type errors found in lightfast but not blocking CI"
          pnpm --filter @lightfastai/mcp typecheck || echo "⚠️ Type errors found in @lightfastai/mcp but not blocking CI"
```

#### 4. Update Build Job
**File**: `.github/workflows/ci.yml`
**Lines**: 141-148
**Changes**: Build both packages, verify both outputs

**Before**:
```yaml
      - name: Build lightfast
        run: pnpm --filter lightfast build

      - name: Check build outputs
        run: |
          echo "📦 Build outputs:"
          ls -la core/lightfast/dist/
          echo "✅ Build completed successfully"
```

**After**:
```yaml
      - name: Build packages
        run: pnpm turbo build --filter lightfast --filter @lightfastai/mcp

      - name: Check build outputs
        run: |
          echo "📦 lightfast build outputs:"
          ls -la core/lightfast/dist/
          echo ""
          echo "📦 @lightfastai/mcp build outputs:"
          ls -la core/mcp/dist/
          echo "✅ All builds completed successfully"
```

### Success Criteria:

#### Automated Verification:
- [x] CI workflow is valid YAML: `yq e '.' .github/workflows/ci.yml > /dev/null`
- [x] Change detection includes mcp: `grep -q "core/mcp/" .github/workflows/ci.yml`
- [x] Lint step includes mcp filter: `grep -q "@lightfastai/mcp lint" .github/workflows/ci.yml`
- [x] Typecheck step includes mcp filter: `grep -q "@lightfastai/mcp typecheck" .github/workflows/ci.yml`
- [x] Build step uses turbo with both filters: `grep -q "turbo build --filter lightfast --filter @lightfastai/mcp" .github/workflows/ci.yml`

#### Manual Verification:
- [ ] Create a test PR with changes to `core/mcp/` and verify CI runs

---

## Phase 3: Release Workflow & Verify Changeset Updates

### Overview
Update release workflow to build both packages, and update verify-changeset to accept either package name.

### Changes Required:

#### 1. Update Release Build Step
**File**: `.github/workflows/release.yml`
**Lines**: 49-50
**Changes**: Build both packages using turbo

**Before**:
```yaml
      - name: Build packages
        run: pnpm --filter lightfast build
```

**After**:
```yaml
      - name: Build packages
        run: pnpm turbo build --filter lightfast --filter @lightfastai/mcp
```

#### 2. Release Test Step
**File**: `.github/workflows/release.yml`
**Lines**: 52-53
**Note**: Keep testing only `lightfast` since `@lightfastai/mcp` has no tests yet

**No change needed** - current:
```yaml
      - name: Run tests
        run: pnpm --filter lightfast test
```

#### 3. Update Verify Changeset Validation
**File**: `.github/workflows/verify-changeset.yml`
**Lines**: 50-59
**Changes**: Accept either `lightfast` OR `@lightfastai/mcp` in changesets

**Before** (lines 50-54):
```yaml
            # Check if it mentions lightfast
            if ! grep -q "lightfast" "$file"; then
              echo "::error::Changeset $file must include lightfast package"
              exit 1
            fi
```

**After**:
```yaml
            # Check if it mentions lightfast or @lightfastai/mcp
            if ! grep -qE "(\"lightfast\"|\"@lightfastai/mcp\")" "$file"; then
              echo "::error::Changeset $file must include lightfast or @lightfastai/mcp package"
              exit 1
            fi
```

**Before** (lines 56-59):
```yaml
            # Check for valid version types
            if ! grep -E "^\"lightfast\": (patch|minor|major)$" "$file"; then
              echo "::error::Changeset $file must use patch, minor, or major for lightfast"
              exit 1
            fi
```

**After**:
```yaml
            # Check for valid version types
            if ! grep -E "^\"(lightfast|@lightfastai/mcp)\": (patch|minor|major)$" "$file"; then
              echo "::error::Changeset $file must use patch, minor, or major for lightfast or @lightfastai/mcp"
              exit 1
            fi
```

### Success Criteria:

#### Automated Verification:
- [x] Release workflow is valid YAML: `yq e '.' .github/workflows/release.yml > /dev/null`
- [x] Release build uses turbo with both filters: `grep -q "turbo build --filter lightfast --filter @lightfastai/mcp" .github/workflows/release.yml`
- [x] Verify-changeset accepts either package: `grep -qE "@lightfastai/mcp" .github/workflows/verify-changeset.yml`

#### Manual Verification:
- [ ] Create a test changeset for `@lightfastai/mcp` and verify it passes validation
- [ ] Run `pnpm changeset` locally, select `@lightfastai/mcp`, verify both packages shown as bumped

---

## Testing Strategy

### Unit Tests:
- No new tests needed - workflow changes only

### Integration Tests:
- N/A - relying on GitHub Actions workflow execution

### Manual Testing Steps:
1. Create a changeset selecting only `@lightfastai/mcp` with patch bump
2. Run `pnpm changeset status` - verify both packages show as needing release
3. Create test PR - verify CI runs lint/typecheck/build for both packages
4. (Optional) Test release flow in a branch with `workflow_dispatch`

## Publish Order (Automatic)

Changesets + pnpm handle publish order automatically based on dependency graph:

```
1. lightfast@X.Y.Z publishes first (no dependencies)
2. @lightfastai/mcp@X.Y.Z publishes second
   - workspace:* → "X.Y.Z" during publish
```

## Performance Considerations

- CI adds lint/typecheck/build for MCP package - minor increase in runtime
- Turbo caching will minimize rebuild time when only one package changes

## Migration Notes

N/A - No data migration needed. These are infrastructure changes only.

## References

- Research document: `thoughts/shared/research/2025-12-16-lightfast-deployment-workflow.md`
- Versioning strategy: `thoughts/shared/research/2025-12-16-pre-v1-versioning-strategy.md`
- Changeset fixed docs: https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md
- Current CI workflow: `.github/workflows/ci.yml`
- Current release workflow: `.github/workflows/release.yml`
- Current verify-changeset: `.github/workflows/verify-changeset.yml`
