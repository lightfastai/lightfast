# Core Packages Upgrade — Phase C (Knip Cleanup + Override Drift) Implementation Plan

## Overview

Close out the core-infra hygiene work started in Phase A (catalog alignment + patch/minor sweep) and Phase B (`pnpm.overrides` audit) by sweeping the two remaining loose ends:

1. The React-family override pins drifted one patch behind the `catalogs.react19` floor during Phase A's patch sweep and never caught up.
2. Knip has accumulated 6 truly unused direct deps, 2 unused catalog entries, 3 dead source files, and several config hints. None of this was in scope for Phase A or B.

No major version bumps. No further changes to the security-pin block of `pnpm.overrides` — Phase B closed that.

## Current State Analysis

Phase A synchronized `catalogs.react19` to `react/react-dom ^19.2.5`, but `pnpm.overrides` for the same packages stayed at `^19.2.4`. Because pnpm applies overrides *after* catalog resolution, this means a transitive React pull — any dep that declares `react` outside the workspace catalog — currently resolves to `^19.2.4`, one patch behind what workspace packages get. Not a correctness issue, but a deliberate-React-19 pin that is quietly lagging the catalog.

On the knip side, `pnpm knip --no-exit-code` on the current `main` reports:

- 8 flagged unused dependencies — 6 are truly unused (verified by grep across each package's `src/`), 2 are false positives in `packages/webhook-schemas` where the CLI scripts aren't declared as knip entries.
- 5 flagged unused files — 3 are truly dead (only referenced in their own JSDoc comments), 1 is a CLI entry (`packages/webhook-schemas/src/capture.ts`), 1 is a cross-workspace import (`api/platform/src/lib/oauth/callback.ts`) via a subpath (`@api/platform/lib/oauth/callback`) that the `exports` map in `api/platform/package.json` does not declare — the import resolves at runtime via pnpm hoisting but knip cannot trace it.
- 2 unused catalog entries (`@electric-sql/pglite`, `neverthrow`).
- 1 unused devDependency (`@repo/app-api-contract` in `apps/www`).
- 1 unresolved import (`next` inside `internal/typescript/nextjs.json` — the TS-plugin name, not an actual JS import).
- 4 configuration hints (redundant `vitest.shared.ts` entry pattern; unnecessary `@vitest/coverage-v8` ignore; suggestions to unignore `.agents/**` and `.claude/**`).

The `.agents/**` and `.claude/**` ignore hints are false positives — those paths contain agent worktrees and tool-specific artifacts that should stay outside knip's scope. Will not act on those two hints.

Phase A and Phase B are already merged on `main` (see commit history of 2026-04-19). This plan assumes that baseline.

## Desired End State

- `pnpm.overrides` React pins (`react`, `react-dom`, `@types/react`, `@types/react-dom`) match `catalogs.react19` exactly. No drift between override and catalog.
- `pnpm knip --no-exit-code` reports zero unused dependencies, zero unused catalog entries, zero truly-unused files. The remaining "unused exports/types" findings are out of scope (code cleanup, not infra).
- `packages/webhook-schemas` CLI scripts (`capture`, `validate`, `report`) are declared as knip entries; their `@db/app` and `drizzle-orm` dependencies stop being flagged.
- `api/platform/src/lib/oauth/callback.ts` is either declared as a knip entry or exported via `api/platform/package.json` — knip reports it as reachable, not unused.
- `pnpm install && pnpm typecheck && pnpm test && pnpm build:app && pnpm build:platform && pnpm build:www` all pass.

### Key Discoveries:

- `package.json:56-59` — overrides `react ^19.2.4` / `react-dom ^19.2.4` / `@types/react ^19.2.14` / `@types/react-dom ^19.2.3` vs catalog `react ^19.2.5` / `react-dom ^19.2.5` / `@types/react ^19.2.14` / `@types/react-dom ^19.2.3` — drift on two of four.
- `api/platform/src/lib/oauth/callback.ts:155` — `processOAuthCallback` is imported by `apps/platform/src/app/api/connect/[provider]/callback/route.ts:12` via `@api/platform/lib/oauth/callback`, a subpath not listed in `api/platform/package.json:7-28` exports map. Resolution works via pnpm hoisting but is fragile.
- `apps/platform/src/lib/internal-caller.ts:10` — exports `platform` but no file imports from `@/lib/internal-caller`; only self-reference is the JSDoc sample (`grep "internal-caller"` returns the file itself).
- `api/platform/src/inngest/platform.ts:16` — exports `platform` but no file imports from `../platform` inside `api/platform`; the only reference is the JSDoc sample.
- `packages/app-validation/src/schemas/api/common.ts` — zero references anywhere in the workspace.
- `packages/webhook-schemas/package.json:10-12` — `capture`, `validate`, `report` scripts run `tsx src/*.ts` but `knip.json` has no entry pattern for these files, so knip flags their dependencies and the files themselves.
- `knip.json:11` — `ignoreDependencies: ["@vendor/lib", "@vitest/expect", "zustand"]` in `apps/app`; `@vitest/expect` entry at root `knip.json:101` is redundant with knip's new vitest plugin detection.
- `knip.json:88` — `internal/vitest-config` entry includes `vitest.shared.ts` which knip's config plugin already picks up automatically.
- `knip.json:99` — global `ignoreDependencies` for `@vitest/coverage-v8` is no longer needed (vitest plugin handles it).
- Catalog-only entries `@electric-sql/pglite` (pnpm-workspace.yaml:16) and `neverthrow` (pnpm-workspace.yaml:46) — no `catalog:` consumer anywhere (`grep -rn '"@electric-sql/pglite"' apps packages vendor core db api` and `grep -rn '"neverthrow"' .` both empty).
- Truly unused direct deps confirmed via grep: `@sentry/core` in `api/app/package.json:47` and `api/platform/package.json:45`; `redis` in `core/ai-sdk/package.json:79`; `@modelcontextprotocol/sdk` in `core/mcp/package.json:49`; `zod` in `packages/app-ai/package.json:20`; `@sentry/nextjs` in `vendor/observability/package.json:67`; `@repo/app-api-contract` in `apps/www/package.json:66`.

## What We're NOT Doing

- **Major version bumps.** Deferred — continuing the deferred list from Phase A (`ai 5→6`, `@ai-sdk/* *→latest`, `inngest 3→4`, `typescript 5→6`, `framer-motion 11→12`, `recharts 2→3`, `redis 4→5`, etc.).
- **Re-opening the `pnpm.overrides` security-pin block.** Phase B is authoritative. The 8 security pins (`tar`, `basic-ftp`, `undici`, `lodash`, `lodash-es`, `@opentelemetry/api`, `path-to-regexp`, `fast-xml-parser`) stay as Phase B left them.
- **Unused exports/types cleanup.** Knip reports 12 unused exports and 7 unused exported types — these are code cleanup inside `src/`, not infra hygiene. Separate PR.
- **Changing `.agents/**` and `.claude/**` knip ignore.** False-positive hint — those paths host agent worktrees and tool artifacts; keep them ignored.
- **Restructuring knip.json.** No reorganization of workspace blocks; only additions/removals for the specific issues above.
- **`api/platform` exports-map restructure.** The `api/platform/src/lib/oauth/callback.ts` cross-workspace import works today via pnpm hoisting. Fixing the exports map is a bigger change (potentially affects other `lib/*` imports not yet audited). Prefer the cheaper fix — add to knip entry config.
- **CI changes.** `pnpm knip` is not wired into CI today; wiring it is out of scope for this plan.

## Implementation Approach

Five phases, one commit each, merged between so bisect stays useful. Each phase is independently revertible.

1. **Sync React override pins** — four single-character version bumps in `package.json`.
2. **Remove unused direct dependencies** — six package.json edits.
3. **Remove unused catalog entries** — two lines out of `pnpm-workspace.yaml`.
4. **Delete truly unused source files** — three file deletions.
5. **Knip configuration hygiene** — add CLI entries, remove redundant ignores, handle `api/platform/lib/oauth/callback.ts` and the `next` TS-plugin false positive.

After each phase: `pnpm install`, `SKIP_ENV_VALIDATION=true pnpm typecheck`, `SKIP_ENV_VALIDATION=true pnpm test`, and `pnpm knip --no-exit-code` to confirm the targeted finding cleared.

---

## Phase 1: Sync React Override Pins to Catalog

### Overview

Bring the four React-family overrides in `pnpm.overrides` up to match the `catalogs.react19` floors set by Phase A. Lockfile diff should be small — transitive React pulls (if any) move from `19.2.4` → `19.2.5`.

### Changes Required:

#### 1. Update React override versions

**File**: `package.json`
**Changes**: Lines 56-59 — raise `react` and `react-dom` to `^19.2.5` to match catalog. `@types/react` and `@types/react-dom` already match (verify no change needed).

```jsonc
"pnpm": {
  "overrides": {
    "react": "^19.2.5",            // was ^19.2.4 — match catalogs.react19
    "react-dom": "^19.2.5",        // was ^19.2.4 — match catalogs.react19
    "@types/react": "^19.2.14",    // unchanged — already matches
    "@types/react-dom": "^19.2.3", // unchanged — already matches
    // ... rest of overrides block unchanged (Phase B state)
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `pnpm-lock.yaml` diff: only React-family version strings change (19.2.4 → 19.2.5 on transitive paths, if any); no other deps move
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes

#### Manual Verification:

- [ ] `pnpm dev:app` boots; app home page renders without hydration errors
- [x] Confirm via `pnpm list react -r --depth 0` that every resolution is `19.2.5` (single line expected)

**Implementation Note**: After Phase 1 passes, commit and pause for human confirmation before Phase 2.

---

## Phase 2: Remove Unused Direct Dependencies

### Overview

Delete six dependency entries across five package.json files that knip flagged and grep confirmed have zero imports in their package's `src/`.

### Changes Required:

#### 1. Remove `@sentry/core` from api/app

**File**: `api/app/package.json`
**Changes**: Line 47 — delete `"@sentry/core": "catalog:"` from `dependencies`.

#### 2. Remove `@sentry/core` from api/platform

**File**: `api/platform/package.json`
**Changes**: Line 45 — delete `"@sentry/core": "catalog:"` from `dependencies`.

#### 3. ~~Remove `redis` from core/ai-sdk~~ — **KEEP**

Per user direction during implementation: `redis` is a runtime requirement of the internal (this workspace hit MODULE_NOT_FOUND previously when `redis` was dropped). Leave the entry in place; knip will continue to flag it — acceptable.

#### 4. ~~Remove `@modelcontextprotocol/sdk` from core/mcp~~ — **KEEP**

Verified during implementation: `core/mcp` is published as the `@lightfastai/mcp` npm package (`bin: lightfast-mcp`). Its tsup build (`core/mcp/tsup.config.ts:12`) marks `@modelcontextprotocol/sdk` as `external`, and the bundled `dist/index.mjs` contains unbundled imports from `@modelcontextprotocol/sdk/server/{mcp,stdio}.js` that originate from `@vendor/mcp`'s re-exports. Dropping the `dependencies` entry would break `npm install -g @lightfastai/mcp` at runtime. Knip flags it because grep misses vendor-re-exported peer-style deps; acceptable.

#### 5. Remove `zod` from packages/app-ai

**File**: `packages/app-ai/package.json`
**Changes**: Line 20 — delete `"zod": "catalog:"` from `dependencies`.

#### 6. Remove `@sentry/nextjs` from vendor/observability

**File**: `vendor/observability/package.json`
**Changes**: Line 67 — delete `"@sentry/nextjs": "catalog:"` from `dependencies`.

#### 7. Remove `@repo/app-api-contract` from apps/www devDependencies

**File**: `apps/www/package.json`
**Changes**: Line 66 — delete `"@repo/app-api-contract": "workspace:*"` from `devDependencies`.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `pnpm knip --no-exit-code` no longer lists the 5 intended entries (2 deferred: `redis` and `@modelcontextprotocol/sdk` kept as documented above)
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (53 turbo tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (12 turbo tasks)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `pnpm build:www` succeeds
- [x] `pnpm lint:ws` (sherif) reports no new issues (postinstall)

#### Manual Verification:

- [ ] `pnpm dev:app` boots; home page renders (sentry-wrapped error boundary still works because `@sentry/nextjs` remains in each app — only the unused transitive `@sentry/core` in api/app and api/platform was removed)
- [ ] `pnpm dev:www` boots and `/docs` renders
- [ ] `pnpm dev:platform` boots

**Implementation Note**: After Phase 2 passes, commit and pause for human confirmation before Phase 3.

---

## Phase 3: Remove Unused Catalog Entries

### Overview

Two catalog entries declared in `pnpm-workspace.yaml` have zero `catalog:` consumers anywhere. Remove them.

### Changes Required:

#### 1. Remove unused catalog entries

**File**: `pnpm-workspace.yaml`
**Changes**: Lines 16 and 46 — delete the two entries.

```yaml
# Remove from the `catalog:` block:
  '@electric-sql/pglite': ^0.3.15   # DELETE — no catalog: consumer
  neverthrow: ^8.2.0                 # DELETE — no catalog: consumer
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `pnpm knip --no-exit-code` no longer reports `Unused catalog entries`
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes

#### Manual Verification:

- [x] `pnpm list @electric-sql/pglite -r` reports no resolutions
- [x] `pnpm list neverthrow -r` reports no workspace consumers

**Implementation Note**: After Phase 3 passes, commit and pause for human confirmation before Phase 4.

---

## Phase 4: Delete Truly Unused Source Files

### Overview

Three source files knip flagged are genuinely dead — the only references to them are in their own JSDoc comments. Delete them.

### Changes Required:

#### 1. Delete apps/platform internal tRPC caller (unused)

**File**: `apps/platform/src/lib/internal-caller.ts`
**Action**: Delete. The file exports `platform = createInternalCaller("route")` but no file in `apps/platform/src` imports from `@/lib/internal-caller`.

#### 2. Delete api/platform Inngest tRPC caller (unused)

**File**: `api/platform/src/inngest/platform.ts`
**Action**: Delete. Exports `platform = createInternalCaller("inngest")` but no Inngest function imports from `../platform`.

#### 3. Delete unused validation schema

**File**: `packages/app-validation/src/schemas/api/common.ts`
**Action**: Delete. Zero references in the workspace (`grep -rn "api/common" packages/app-validation` returns nothing).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm knip --no-exit-code` no longer lists these three files under `Unused files` (remaining 2: targets of Phase 5 config)
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds

#### Manual Verification:

- [ ] `pnpm dev:platform` boots; OAuth callback route at `/api/connect/github/callback` still reachable (the kept file is `api/platform/src/lib/oauth/callback.ts`, not the deleted `inngest/platform.ts`)

**Implementation Note**: After Phase 4 passes, commit and pause for human confirmation before Phase 5.

---

## Phase 5: Knip Configuration Hygiene

### Overview

Update `knip.json` to (a) include the real CLI entries for `packages/webhook-schemas`, (b) declare the cross-workspace `api/platform/src/lib/oauth/callback.ts` as an entry so knip stops flagging it, (c) handle the `next` TS-plugin false positive in `internal/typescript/nextjs.json`, (d) remove redundant ignore entries, and (e) drop the redundant `vitest.shared.ts` entry pattern.

### Changes Required:

#### 1. Add CLI entries for `packages/webhook-schemas`

**File**: `knip.json`
**Changes**: Add a workspace block for `packages/webhook-schemas` listing the three CLI scripts as entries. This resolves the `@db/app` and `drizzle-orm` false positives (consumed from `capture.ts`, not currently declared as an entry).

```jsonc
"packages/webhook-schemas": {
  "entry": ["src/capture.ts"],
  "project": ["src/**/*.ts"]
}
```

**Implementation note**: Only `capture.ts` needs manual declaration — it runs via `pnpm with-env tsx src/capture.ts` which knip can't parse. `validate.ts` and `report.ts` are invoked directly via `tsx --conditions react-server src/*.ts`, which knip's script-parser auto-detects. Adding all three caused knip to emit `redundant entry pattern` hints for the auto-detected pair.

#### 2. Declare `api/platform` OAuth callback entry

**File**: `knip.json`
**Changes**: Replace the existing generic `api/*` block (line 22-24) with a more specific `api/platform` block that declares the cross-workspace entry. Keep `api/app` covered by a generic `api/app` block.

```jsonc
"api/app": {
  "project": ["src/**/*.ts"]
},
"api/platform": {
  "entry": ["src/lib/oauth/callback.ts"],
  "project": ["src/**/*.ts"]
}
```

Rationale: the `api/platform/src/lib/oauth/callback.ts` module is imported from `apps/platform` via `@api/platform/lib/oauth/callback` — a subpath not declared in `api/platform/package.json` `exports`. Resolution works through pnpm hoisting but knip can't trace it. Listing the file as a knip entry is cheaper than refactoring the exports map (which risks exposing other internal `lib/*` paths we don't intend to publish).

#### 3. Handle `next` TS-plugin false positive

**File**: `knip.json`
**Changes**: Add `next` to the `internal/typescript` workspace `ignoreDependencies` so knip stops reporting the `{ "name": "next" }` TS-plugin reference in `internal/typescript/nextjs.json` as an unresolved import.

```jsonc
"internal/typescript": {
  "entry": ["base.json"],
  "ignoreDependencies": ["next"]
}
```

#### 4. Drop redundant `@vitest/coverage-v8` ignore

**File**: `knip.json`
**Changes**: Line 101 — remove `@vitest/coverage-v8` from the root `ignoreDependencies` array (knip's vitest plugin now handles it).

```jsonc
"ignoreDependencies": [
  "tailwindcss",
  "@tailwindcss/postcss",
  "@tailwindcss/typography",
  "postcss",
  "autoprefixer",
  "import-in-the-middle",
  "require-in-the-middle"
  // removed: "@vitest/coverage-v8"
]
```

#### 5. Remove redundant `vitest.shared.ts` entry

**File**: `knip.json`
**Changes**: Line 87-89 — remove the redundant `entry: ["vitest.shared.ts"]` line from the `internal/vitest-config` block (the vitest plugin picks it up automatically).

```jsonc
"internal/vitest-config": {}   // entry line removed; knip's vitest plugin auto-detects vitest.shared.ts
```

Or delete the workspace entry entirely if the block is now empty.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm knip --no-exit-code` reports:
  - Zero `Unused files`
  - Zero `Unused dependencies` (except the 2 documented-KEEP entries from Phase 2: `redis`, `@modelcontextprotocol/sdk`)
  - Zero `Unused devDependencies`
  - Zero `Unused catalog entries`
  - Zero `Unresolved imports`
  - Zero `Configuration hints` except the two `.agents/**` / `.claude/**` hints we explicitly keep
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (53 turbo tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (12 turbo tasks)
- [x] `pnpm build:app` / `pnpm build:platform` / `pnpm build:www` all succeed

#### Manual Verification:

- [ ] `pnpm dev:full` boots; app home, `/docs`, `/sign-in`, and platform `/api/...` endpoints respond
- [ ] OAuth callback still works end-to-end: `pnpm dev:full`, trigger a provider connect flow, confirm `apps/platform/src/app/api/connect/[provider]/callback/route.ts` imports resolve at runtime (the import that knip couldn't trace)

**Implementation Note**: After Phase 5 passes, Phase C is complete. No Phase D — the remaining core-package work is the deferred-majors plan (per Phase A and Phase B references).

---

## Testing Strategy

### Unit Tests:

- `pnpm test` after each phase. No test-visible behavior change expected — this plan is purely dependency/config hygiene. The only nontrivial risk is in Phase 2, where removing an "unused" dep could uncover a dynamic or stringified import that grep missed. If a test fails after Phase 2, revert the specific dep removal and investigate.

### Integration Tests:

- OAuth callback flow (Phase 5 affects knip config but exercises the real cross-workspace import): `pnpm dev:full`, start a provider connect, confirm the callback redirect resolves correctly.
- tRPC prefetch-then-hydrate (Phase 1 touches React): dashboard page renders without hydration errors.

### Manual Testing Steps:

1. After Phase 1: `pnpm dev:app` → load `http://localhost:3024` → confirm no hydration errors in console.
2. After Phase 2: `pnpm dev:full` → trigger a handled Sentry error in app and in platform → confirm event reaches Sentry (ensures sentry wrapping is intact despite `@sentry/core` removal from api packages).
3. After Phase 4: `pnpm dev:platform` → hit `/api/connect/github/callback?state=invalid` → confirm 400 response with `invalid_or_expired_state` body (confirms `processOAuthCallback` still resolves through the knip-entry path).
4. After Phase 5: `pnpm knip --no-exit-code` → confirm the remaining output is only the two ignored-path hints we intentionally keep.

## Performance Considerations

No expected performance impact. Lockfile diff in Phase 1 is at most a patch bump on transitive React; everything else is dev-time / install-time hygiene.

## Migration Notes

No data migrations. No schema changes. Rollback is `git revert` of the offending phase commit + `pnpm install`.

## References

- Phase A plan (predecessor, merged): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-a.md`
- Phase B plan (predecessor, merged): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-b.md`
- Knip baseline: `pnpm knip --no-exit-code` on `main` as of 2026-04-19
- Cross-workspace import needing knip entry declaration: `apps/platform/src/app/api/connect/[provider]/callback/route.ts:12` importing from `@api/platform/lib/oauth/callback` (subpath not in `api/platform/package.json:7-28` exports map)
- Catalog drift: `package.json:56-57` vs `pnpm-workspace.yaml:59-60`
- Deferred follow-ups: deferred-majors plan (not yet written); unused exports / unused exported types cleanup (separate PR from this plan).
