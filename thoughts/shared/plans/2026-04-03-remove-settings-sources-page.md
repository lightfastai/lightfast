# Remove Legacy settings/sources Page Implementation Plan

## Overview

Delete the orphaned `settings/sources` route and its three components now that sources management has fully migrated to the top-level `[slug]/(manage)/sources/` page.

## Current State Analysis

- **Old page**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/page.tsx`
  - Uses `trpc.connections.list` (org-level connection list)
  - Composed of 3 local components in `_components/`
- **New page**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx`
  - Uses `trpc.connections.resources.list` + per-provider `listInstallations`
  - Fully replaces the old page's functionality

### Key Discoveries:
- Zero imports of `SourcesHeader`, `SourcesList`, or `SourcesListLoading` outside `settings/sources/`
- Zero references to the `settings/sources` path anywhere in the codebase (no nav links, no redirects)
- `trpc.connections.list` is still used by `apps/app/src/components/debug-panel-content.tsx` — the router endpoint must NOT be removed
- `settings/` directory retains: `_components/`, `api-keys/`, `layout.tsx`, `page.tsx` — those are unaffected

## Desired End State

The `settings/sources/` directory and all its files are deleted. The `settings/` section continues to work normally (api-keys, layout, page).

### Verification:
- Directory no longer exists
- `pnpm build:app` succeeds
- `pnpm typecheck` passes
- `pnpm check` passes

## What We're NOT Doing

- Not removing `trpc.connections.list` from the router (still used by debug panel)
- Not touching any other `settings/` pages
- Not adding redirects (no external links to this path exist)

## Implementation Approach

Single-phase deletion. No migration, no redirects needed.

## Phase 1: Delete settings/sources directory

### Changes Required:

Delete the following files:
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/page.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-header.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list-loading.tsx`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx`

### Success Criteria:

#### Automated Verification:
- [x] Files deleted: directory `settings/sources/` no longer exists
- [ ] Build passes: `pnpm build:app`
- [x] Type checking passes: `pnpm typecheck` (no sources-related errors; pre-existing record-activity.ts error is unrelated)
- [x] Linting passes: `pnpm check` (2 pre-existing format errors in app-test-data, unrelated)

#### Manual Verification:
- [ ] `/<slug>/settings` page loads and functions correctly
- [ ] `/<slug>/settings/api-keys` page loads correctly
- [ ] `/<slug>/sources` (new page) loads correctly with no regressions

## References

- New sources page: `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx`
- debug-panel-content (still uses connections.list): `apps/app/src/components/debug-panel-content.tsx:66`
