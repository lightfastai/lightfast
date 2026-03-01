# Sentry Catalog Consolidation

## Overview

Add `@sentry/core`, `@sentry/nextjs`, and `@sentry/profiling-node` to the pnpm workspace catalog and update all package.json files that currently pin `^10.20.0` to use `catalog:` references instead.

## Current State Analysis

Three `@sentry/*` packages are duplicated across the monorepo at `^10.20.0` with no catalog entry:

| Package | Occurrences | Files |
|---------|------------|-------|
| `@sentry/core` | 6 | `api/console`, `api/chat`, `apps/backfill`, `apps/gateway`, `apps/connections`, `apps/chat` |
| `@sentry/nextjs` | 7 | `vendor/next`, `vendor/observability`, `apps/console`, `apps/auth`, `apps/docs`, `apps/www`, `apps/chat` |
| `@sentry/profiling-node` | 1 | `apps/chat` |

The `@inngest/middleware-sentry` is already cataloged (line 53 of `pnpm-workspace.yaml`).

## Desired End State

All `@sentry/*` direct dependencies use `catalog:` references. Version is controlled from a single location in `pnpm-workspace.yaml`.

## What We're NOT Doing

- Not upgrading the Sentry version (staying at `^10.20.0`)
- Not touching `@sentry/cli` (only appears in `onlyBuiltDependencies`, not a direct dep)
- Not modifying any application code — only `pnpm-workspace.yaml` and `package.json` files

## Phase 1: Add Catalog Entries and Update References

### Changes Required:

#### 1. Add catalog entries to `pnpm-workspace.yaml`

**File**: `pnpm-workspace.yaml`
**Changes**: Add three entries to the `catalog:` section (after the existing `@inngest/middleware-sentry` entry at line 53)

```yaml
  '@sentry/core': ^10.20.0
  '@sentry/nextjs': ^10.20.0
  '@sentry/profiling-node': ^10.20.0
```

#### 2. Update `@sentry/core` references (6 files)

Replace `"@sentry/core": "^10.20.0"` with `"@sentry/core": "catalog:"` in:

- `api/console/package.json` (line 64)
- `api/chat/package.json` (line 38)
- `apps/backfill/package.json` (line 25)
- `apps/gateway/package.json` (line 27)
- `apps/connections/package.json` (line 30)
- `apps/chat/package.json` (line 46)

#### 3. Update `@sentry/nextjs` references (7 files)

Replace `"@sentry/nextjs": "^10.20.0"` with `"@sentry/nextjs": "catalog:"` in:

- `vendor/next/package.json` (line 40)
- `vendor/observability/package.json` (line 42)
- `apps/console/package.json` (line 59)
- `apps/auth/package.json` (line 28)
- `apps/docs/package.json` (line 31)
- `apps/www/package.json` (line 34)
- `apps/chat/package.json` (line 47)

#### 4. Update `@sentry/profiling-node` reference (1 file)

Replace `"@sentry/profiling-node": "^10.20.0"` with `"@sentry/profiling-node": "catalog:"` in:

- `apps/chat/package.json` (line 48)

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors (lockfile regenerates cleanly)
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] No remaining hardcoded `@sentry/core`, `@sentry/nextjs`, or `@sentry/profiling-node` versions in any `package.json` (verify with `grep -r '"@sentry/' --include='package.json'` — all should show `"catalog:"`)

#### Manual Verification:
- [ ] None required — this is a purely mechanical dependency management change with no runtime behavior change
