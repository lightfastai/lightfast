# Merge main into feat/backfill-depth-entitytypes-run-tracking

## Overview

Merge 109 commits from `main` into `feat/backfill-depth-entitytypes-run-tracking` (117 commits). The branches diverged at `7d2f303e5` ("fix(backfill): disable backfill notifications until production-ready"). There are **334 conflicts** across the codebase, but they fall into well-defined categories that can be resolved systematically.

## Current State Analysis

### What main did since divergence:
1. **Removed chat app entirely** (`chore: remove chat app and dependencies from monorepo`)
2. **Massive dependency cleanup** — knip-driven removal of ~100+ unused deps across all packages
3. **Removed packages**: `@repo/ai`, `@repo/url-utils`, `@repo/ai-tools`, zombie packages, ai-sdk v2
4. **Clerk Core 3 upgrade** — rerouted all `@clerk/*` imports through `@vendor/clerk`
5. **Vitest v3 → v4 upgrade**
6. **ESLint + Prettier → Ultracite (Biome)** migration — massive formatting/linting changes
7. **Auth overhaul** — server-actions architecture, nuqs URL state, Playwright E2E tests, early-access moved from www to auth
8. **Tech-stack-detector extracted** to external repo
9. **Minor/patch version bumps** across all packages
10. **gitignored `.claude/settings.local.json`**

### What the feature branch did since divergence:
1. **Backfill pipeline** — depth, entityTypes, holdForReplay, run tracking, gap-aware history
2. **`@repo/console-providers` package** — massive provider consolidation (replaced gateway-types, console-types)
3. **Event type system overhaul** — Zod-based schemas, PreTransform prefix, derived types
4. **Relay refactoring** — middleware chain, inline workflows, removed fan-out flag
5. **Gateway refactoring** — shared service clients, validated env modules, discriminated unions
6. **Crypto consolidation** — `@noble/hashes`, deleted duplicate modules, migrated JWT to `jose`
7. **Console UI** — events page, sources/new page, glass card styling, removed dead components
8. **DB restructure** — workspace-events, dropped webhook-payloads, backfill_runs table
9. **Zod v4 migration** (native, not v3 compat)
10. **CLI** — login/listen/logout commands, SSE streaming
11. **TypeScript strictness** — `noImplicitReturns`, `noFallthroughCasesInSwitch`

## Conflict Analysis

### 334 total conflicts by type:
- **195 content conflicts** — both sides modified the same file
- **133 modify/delete conflicts** — one side deleted a file the other modified
  - 43 files deleted in main, modified in feature (mostly chat app, auth components, ai-sdk v2)
  - 90 files deleted in feature, modified in main (mostly dead components, old source items, old dispatch/ingress)
- **6 rename conflicts** — scripts moved to different paths

### Conflicts by area (top 10):
| Area | Count | Primary Cause |
|------|-------|---------------|
| `apps/console` | 56 | UI overhaul (feat) vs dep cleanup + biome (main) |
| `apps/relay` | 30 | Middleware refactor (feat) vs dep cleanup + biome (main) |
| `apps/gateway` | 22 | Provider migration (feat) vs dep cleanup + biome (main) |
| `api/console` | 19 | Neural workflows + backfill (feat) vs dep cleanup (main) |
| `packages/console-types` | 12 | Event type overhaul (feat) vs cleanup (main) |
| `packages/console-webhooks` | 11 | Pipeline simplification (feat) vs cleanup (main) |
| `db/console` | 11 | Schema restructure (feat) vs cleanup (main) |
| `apps/backfill` | 11 | Pipeline changes (feat) vs dep cleanup (main) |
| `packages/console-test-data` | 10 | Schema changes (feat) vs cleanup (main) |
| `apps/chat` | 9 | Chat modifications (feat) vs chat deletion (main) |

## What We're NOT Doing

- We are NOT rebasing the feature branch (too many commits, too risky)
- We are NOT cherry-picking individual commits
- We are NOT creating a new branch from scratch
- We are NOT trying to resolve all conflicts in one sitting without verification

## Merge Strategy: Phased Merge with Category-Based Resolution

The approach: `git merge main` from the feature branch, then resolve conflicts in batches by category, verifying after each batch.

---

## Pre-Merge: Create Safety Net

### Steps:
1. Push feature branch to remote (ensure backup exists)
2. Create a backup branch: `git branch backup/feat-backfill-pre-merge feat/backfill-depth-entitytypes-run-tracking`
3. Checkout feature branch: `git checkout feat/backfill-depth-entitytypes-run-tracking`
4. Start the merge: `git merge main` (this will stop at conflicts)

### Success Criteria:
#### Automated Verification:
- [ ] Backup branch exists: `git branch | grep backup/feat-backfill-pre-merge`
- [ ] Merge is in progress: `git status` shows "You have unmerged paths"

---

## Phase 1: Auto-Resolve Delete-vs-Modify Conflicts (~133 files)

These are the easiest — one side deleted a file, the other modified it. The resolution strategy is clear for each case.

### 1A: Files deleted in main, modified in feature (43 files)

**Rule: Accept main's deletion** for files that are genuinely gone from the project. The feature branch's modifications to these files are obsolete.

| Category | Files | Resolution |
|----------|-------|------------|
| Chat app (removed from monorepo) | `api/chat/*`, `apps/chat/*`, `db/chat/*`, `packages/chat-*/*` | **Delete** — chat was extracted |
| Auth email input components | `apps/auth/src/app/(app)/(auth)/_components/sign-*-email-input.tsx` | **Delete** — auth was overhauled with server-actions |
| ai-sdk v2 | `core/ai-sdk/src/core/v2/*` | **Delete** — v2 was removed |
| Early access (moved to auth) | `apps/www/src/components/early-access-*` | **Delete** — moved to auth app |
| `.claude/settings.local.json` | 1 file | **Delete** — now gitignored |

```bash
# Accept main's deletions for all 43 files
git rm api/chat/ apps/chat/ db/chat/ packages/chat-*/ \
  core/ai-sdk/src/core/v2/ \
  apps/auth/src/app/\(app\)/\(auth\)/_components/sign-*-email-input.tsx \
  apps/www/src/components/early-access-* \
  .claude/settings.local.json
```

### 1B: Files deleted in feature, modified in main (90 files)

**Rule: Accept feature's deletion** for files that the feature branch intentionally removed as part of refactoring.

| Category | Files | Resolution |
|----------|-------|------------|
| Old console components (dead code) | `apps/console/src/components/{activity-timeline,dashboard-*,metrics-*,workspace-*,stores-*,system-health-*,connected-sources-*,lightfast-config-*,performance-*}.tsx` | **Delete** — feature cleaned these up |
| Old source items (replaced by generic) | `apps/console/src/app/(app)/(user)/new/_components/{github,linear,sentry,vercel}-source-item.tsx`, `sources-section*.tsx` | **Delete** — unified into provider-source-item |
| Old ingress webhooks (moved to relay) | `apps/console/src/app/api/webhooks/ingress/*` | **Delete** — moved to relay service |
| Old gateway crypto/jwt | `apps/gateway/src/lib/{crypto,github-jwt}.ts`, `apps/backfill/src/lib/crypto.ts` | **Delete** — consolidated into shared crypto |
| Old backfill files | `api/console/src/lib/backfill.{ts,test.ts}`, `apps/backfill/src/workflows/workflow-contracts.test.ts` | **Delete** — refactored |
| Old console page/components | `insights/page.tsx`, `event-settings.tsx` | **Delete** — restructured |
| Old relay/gateway provider impls | Various `providers/impl/*` files | **Delete** — migrated to console-providers |
| Old packages | Various files from deleted/consolidated packages | **Delete** |

```bash
# Accept feature's deletions for all 90 files
# (full list at merge time — use `git checkout feat/backfill-depth-entitytypes-run-tracking -- <file>`
#  which will fail for deleted files, then `git rm <file>`)
```

### 1C: Rename conflicts (6 files)

| File | Main | Feature | Resolution |
|------|------|---------|------------|
| `afk-ralph.sh` | → `scripts/afk-ralph.sh` | → `scripts/afk-many.sh` | Keep **both** in `scripts/` |

### Success Criteria:
#### Automated Verification:
- [ ] No more modify/delete or rename conflicts: `git diff --name-only --diff-filter=U | wc -l` shows only content conflicts remaining
- [ ] Remaining conflicts are ~195 (content-only)

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 2: Resolve package.json and Config Conflicts (~30 files)

These are mostly additive/subtractive dependency changes that need careful merging.

### 2A: Root config files
- `package.json` — merge scripts from both sides
- `pnpm-workspace.yaml` — feature may reference packages main removed (chat, ai-tools, etc.)
- `pnpm-lock.yaml` — **DO NOT manually resolve**; delete and regenerate after all other conflicts
- `turbo.json` — merge task definitions

**Strategy for pnpm-lock.yaml**: Accept either side, then run `pnpm install` at the end to regenerate.

### 2B: App/package package.json files (~20 files)
- `api/console/package.json` — merge dep lists, remove chat references
- `apps/console/package.json` — merge new UI deps (feat) with dep cleanup (main) and Biome (main)
- `apps/auth/package.json` — take main's auth overhaul + feature's deps
- `apps/backfill/package.json` — take feature's backfill additions + main's cleanup
- `apps/relay/package.json` — take feature's relay refactor + main's cleanup
- `apps/gateway/package.json` — take feature's gateway refactor + main's cleanup
- Various `packages/*/package.json` — mostly dep version bumps from main

**Resolution rule**:
1. Take feature branch's structural changes (new deps it needs)
2. Apply main's deletions (removed deps are truly unused)
3. Use main's version numbers (they're newer: vitest v4, Clerk Core 3, etc.)
4. Remove references to deleted packages (chat, ai-tools, url-utils, etc.)

### 2C: tsconfig files
- Mostly formatting (Biome) — take main's formatting

### 2D: Next.js / Hono configs
- `apps/console/next.config.ts` — merge both sides' changes

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm install` succeeds without errors
- [ ] No references to removed packages in any package.json: `grep -r "@repo/ai-tools\|@repo/url-utils\|apps/chat\|db/chat\|api/chat" */package.json`

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Resolve Source Code Content Conflicts (~165 files)

### 3A: Biome formatting conflicts (estimated ~80 files)

Main migrated from ESLint+Prettier to Biome. Many files will have formatting-only conflicts (quotes, semicolons, trailing commas, import ordering).

**Strategy**: For files where the feature branch has substantive changes and main only has formatting:
1. Take the feature branch version
2. Run `pnpm check --write` to apply Biome formatting

For files where both have substantive changes, resolve content first, then format.

### 3B: Core business logic — Backfill pipeline (11 files)
- `apps/backfill/src/env.ts` — merge feature's backfill env with main's ENABLE_BACKFILL flag
- `apps/backfill/src/routes/trigger.ts` — feature refactored this substantially
- `apps/backfill/src/workflows/backfill-orchestrator.{ts,test.ts}` — feature branch is authoritative
- `apps/backfill/src/workflows/entity-worker.{ts,test.ts}` — feature branch is authoritative
- `apps/backfill/src/workflows/step-replay.test.ts` — feature branch is authoritative
- `apps/backfill/src/sentry-init.ts` — merge both improvements

**Resolution rule**: Feature branch is authoritative for backfill business logic. Apply main's dep/version changes on top.

### 3C: Core business logic — API/tRPC routers (7 files)
- `api/console/src/router/m2m/sources.ts`
- `api/console/src/router/org/{connections,contents,search,workspace}.ts`
- `api/console/src/router/user/workspace.ts`
- `api/console/src/inngest/client/client.ts`

**Resolution rule**: Feature branch is authoritative for router logic. Main may have import path changes (Biome, Clerk migration) that need to be layered on.

### 3D: Core business logic — Neural/Inngest workflows (7 files)
- `api/console/src/inngest/workflow/neural/{actor-resolution,entity-extraction-patterns,llm-entity-extraction-workflow,observation-capture,relationship-detection,scoring}.ts`
- `api/console/src/inngest/workflow/processing/process-documents.ts`

**Resolution rule**: Feature branch is authoritative. Main likely only has formatting changes.

### 3E: Console UI (56 files)
- Feature branch overhauled many pages
- Main did formatting (Biome) + dep cleanup + Clerk Core 3 import changes

**Strategy**:
1. Take feature branch versions for substantively changed files
2. Apply main's `@vendor/clerk` import pattern
3. Run Biome formatting pass

### 3F: Relay service (30 files)
- Feature branch did major refactor (middleware chain, inline workflows, provider migration)
- Main did dep cleanup + formatting

**Resolution rule**: Feature branch is authoritative. Layer main's formatting.

### 3G: Gateway service (22 files)
- Feature branch migrated providers, env, crypto
- Main did dep cleanup + formatting

**Resolution rule**: Feature branch is authoritative. Layer main's formatting.

### 3H: Packages (console-types, console-webhooks, console-providers, etc.) (~40 files)
- Feature branch created/heavily modified these as part of provider consolidation
- Main mostly did dep cleanup, some formatting

**Resolution rule**: Feature branch is authoritative for package contents. Reconcile `package.json` deps with main's cleanup.

### 3I: Vendor packages (~15 files)
- `vendor/upstash-workflow/*` — feature simplified, main cleaned deps
- `vendor/db/*`, `vendor/observability/*` — small changes both sides

**Resolution rule**: Take feature's structural changes + main's dep cleanup.

### 3J: Misc files
- `.claude/commands/create_plan.md` — take main's version (newer)
- `scripts/afk-*.sh` — merge renames

### Success Criteria:
#### Automated Verification:
- [ ] No remaining merge conflict markers: `grep -r "<<<<<<< HEAD" --include="*.ts" --include="*.tsx" --include="*.json" .`
- [ ] `git diff --name-only --diff-filter=U` returns empty (no unmerged files)

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 4: Post-Merge Verification

### 4A: Regenerate lockfile
```bash
rm pnpm-lock.yaml
pnpm install
```

### 4B: Type checking
```bash
pnpm typecheck
```
Expect failures from:
- Import paths that changed (console-types → console-providers)
- Removed packages still referenced
- Clerk Core 3 API changes

### 4C: Lint
```bash
pnpm check
```
Run `pnpm check --write` to auto-fix formatting issues.

### 4D: Build critical apps
```bash
pnpm build:console
pnpm build:relay
pnpm build:gateway
pnpm build:backfill
```

### 4E: Tests
```bash
pnpm test
```

### 4F: Database
```bash
cd db/console && pnpm db:generate
```
Verify no schema drift.

### Success Criteria:
#### Automated Verification:
- [ ] `pnpm install` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm check` passes (after `--write` fix)
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm build:relay` succeeds
- [ ] `pnpm build:gateway` succeeds
- [ ] `pnpm build:backfill` succeeds
- [ ] `pnpm test` passes
- [ ] `pnpm db:generate` produces no unexpected changes

#### Manual Verification:
- [ ] `pnpm dev:app` starts without errors
- [ ] Console UI loads and displays correctly
- [ ] Auth flows work (sign-in, sign-up, early-access)
- [ ] Backfill trigger works end-to-end

**Implementation Note**: After completing Phase 4 automated verification, pause for manual testing before finalizing the merge commit.

---

## Phase 5: Finalize Merge

```bash
git add -A
git commit  # Completes the merge commit
```

---

## Risk Mitigation

1. **Backup branch** — can always `git merge --abort` or `git reset --hard backup/feat-backfill-pre-merge`
2. **Incremental resolution** — resolve by category, verify between batches
3. **pnpm-lock.yaml** — regenerate, don't manually merge
4. **Biome formatting** — run `pnpm check --write` after content resolution, don't try to merge formatting manually
5. **Type errors** — expect a fix-up phase after merge; some imports will need updating

## Estimated Effort

| Phase | Estimated Time | Difficulty |
|-------|---------------|------------|
| Pre-merge + Phase 1 (delete/modify) | 15 min | Low — mechanical |
| Phase 2 (package.json/configs) | 30 min | Medium — careful dep reconciliation |
| Phase 3 (source code) | 2-3 hours | High — requires understanding both sides |
| Phase 4 (verification & fixes) | 1-2 hours | Medium-High — chasing down type/build errors |
| Phase 5 (finalize) | 5 min | Low |
| **Total** | **~4-6 hours** | |

## Key Decision Points

1. **Chat app**: Feature branch modified chat files. Since main removed chat entirely, all chat modifications are dropped. **Any backfill-related changes in chat need to be ported to console instead.**

2. **Zod v4**: Both branches migrated to Zod v4 but possibly in different ways. Feature used native v4, main's packages also migrated. Need to verify consistency.

3. **Clerk Core 3**: Feature branch doesn't have this upgrade. After merge, all `@clerk/*` imports must go through `@vendor/clerk`.

4. **ENABLE_BACKFILL flag**: Main added `ENABLE_BACKFILL` env flag as a gating mechanism. Feature branch's backfill code should respect this flag.

## References

- Feature branch: `feat/backfill-depth-entitytypes-run-tracking`
- Main branch: `main`
- Merge base: `7d2f303e5` ("fix(backfill): disable backfill notifications until production-ready")
- Divergence: 109 commits (main) vs 117 commits (feature)
