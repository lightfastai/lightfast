# Collapse `@vendor/lib` to `nanoid`-only (Phase D.2) Implementation Plan

## Overview

Delete the four zero-consumer modules in `@vendor/lib` (`errors.ts`, `uuid.ts`, `datetime/`, `pretty-project-name.ts`) and reduce the package to a thin `nanoid` vendor shim — its only load-bearing export. Insert this deletion as **new Phase D.2** in the active Phase D plan (`thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md`), renumbering existing D.2–D.8 upward by one and trimming the (new) D.4 uuid-bump scope that targeted `vendor/lib/package.json`. Mirrors the `joyful`/`friendly-words.ts` deletion pattern already shipped in D.1 (commit `ec5dcf5ef`), extended across the full zero-consumer surface.

## Current State Analysis

`@vendor/lib` is the renamed successor of the former `@repo/lib` grab-bag. Direct file reads + repo-wide grep (research: `thoughts/shared/research/2026-04-19-vendor-lib-errors-usage.md`) confirm the import-boundary state:

**Load-bearing (keep):**

- `vendor/lib/src/nanoid.ts` (7 lines) — 16 source importers, all via `from "@vendor/lib"` root barrel. See `api/platform/src/lib/oauth/authorize.ts:9`, `vendor/observability/src/trpc.ts:13`, `packages/app-api-key/src/crypto.ts:11`, + 13 `db/app/src/schema/tables/*.ts` files.

**Zero-consumer (delete):**

- `vendor/lib/src/errors.ts` (64 lines) — defines `DomainError`, `DomainErrorOptions`, `isDomainError`. Repo-wide grep returns matches only inside `errors.ts` itself, `index.ts:2-3` (re-export), and `thoughts/` docs.
- `vendor/lib/src/uuid.ts` (3 lines) — wraps `uuid.v4` as `uuidv4`. The identifier `uuidv4` does appear in `core/ai-sdk/src/core/server/runtime.ts:8` and README — **but both via `import { v4 as uuidv4 } from "uuid"` direct import**, not through `@vendor/lib`. The `@vendor/lib`-exported `uuidv4` has zero importers.
- `vendor/lib/src/datetime/index.ts` (3 lines) — exports `formatMySqlDateTime`. Grep for `formatMySqlDateTime` returns only its definition + the `index.ts:1` re-export.
- `vendor/lib/src/pretty-project-name.ts` (200 lines) — exports `generatePrettyProjectName`. Grep returns only the definition line; no imports of `@vendor/lib/pretty-project-name` anywhere.

**Wiring:**

- `vendor/lib/src/index.ts` (5 lines) currently re-exports `formatMySqlDateTime`, `DomainError`/`isDomainError`/`DomainErrorOptions`, `nanoid`, `uuidv4`. Four of five lines are dead.
- `vendor/lib/package.json:7-28` declares four subpath exports (`./pretty-project-name`, `./datetime`, `./uuid`, `./nanoid`) plus the root `.`. Zero importers use any subpath (all 16 consumers use the root barrel).
- `vendor/lib/package.json` runtime deps: `nanoid` (catalog) + `uuid ^11.1.0`. Only `nanoid` is load-bearing after deletion; `uuid` disappears with `uuid.ts`.
- `vendor/lib/package.json` devDeps: `@types/uuid ^10.0.0` — load-bearing only for `uuid.ts`; disappears with it.
- No test file exists for any of the four dead modules (`vendor/lib/src/**/*.test.ts` glob is empty).

**Interaction with in-flight Phase D work:**

- Phase D.1 (commit `ec5dcf5ef`) — already merged the analogous `joyful`/`friendly-words.ts` deletion pattern. Done.
- Phase D.3 ("API-Change Majors" in the current plan, which becomes **D.4** after this insertion) is planned to bump `uuid 11→13` and `@types/uuid 10→11` in **both** `vendor/lib/package.json` (lines 42, 48) and `core/ai-sdk/package.json` (lines 81, 88). Inserting this collapse as D.2 drops those deps from `vendor/lib/package.json` entirely — so the (new) D.4 uuid section must be trimmed to only edit `core/ai-sdk/package.json`.

**Stale artifact:**

- `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md` — narrow plan from a prior session covering only the `DomainError` trio. Superseded by this broader plan; delete as part of implementation.

## Desired End State

- `vendor/lib/src/` contains only `index.ts` + `nanoid.ts`.
- `vendor/lib/src/index.ts` is a single-line barrel: `export { nanoid } from "./nanoid";`.
- `vendor/lib/package.json` exports map has a single `.` entry (no subpaths); runtime deps narrow to `nanoid` only; `uuid` + `@types/uuid` removed.
- `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md` has a new Phase 2 section for this collapse; existing Phase 2–8 renumbered to 3–9; the (new) Phase 4 uuid-bump section no longer references `vendor/lib/package.json`.
- `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md` is removed (superseded).
- `pnpm install && SKIP_ENV_VALIDATION=true pnpm typecheck && SKIP_ENV_VALIDATION=true pnpm test && pnpm knip --no-exit-code && pnpm build:app && pnpm build:platform && pnpm build:www` all pass.
- `pnpm-lock.yaml` diff shows `uuid@11.1.0` and `@types/uuid@10.0.0` dropped from the `vendor/lib` subgraph; no other dep changes.
- All 16 existing `from "@vendor/lib"` importers of `nanoid` continue to resolve and build without source edits.

### Key Discoveries

- `vendor/lib/src/errors.ts:1-64` — entire surface to delete; self-contained, only extends built-in `Error`.
- `vendor/lib/src/uuid.ts:1-3` — thin wrapper `import { v4 as uuidv4 } from "uuid"; export { uuidv4 };`. Deletion drops the `uuid` + `@types/uuid` deps automatically.
- `vendor/lib/src/datetime/index.ts:1-3` — single 1-line helper; leaf dir will be empty after removal, so delete the `datetime/` directory itself.
- `vendor/lib/src/pretty-project-name.ts:1-200` — entire file; imports `./nanoid` internally, so deletion does not orphan `nanoid.ts`.
- `vendor/lib/src/index.ts:1-5` — current barrel; collapses to 1 load-bearing line.
- `vendor/lib/package.json:7-28` — exports map; collapses to 4 lines (just the `.` entry). `package.json:35-44` deps/devDeps — `uuid` + `@types/uuid` removed.
- `vendor/lib/src/pretty-project-name.ts:49` — `import { nanoid } from "./nanoid"` is *internal*; removing `pretty-project-name.ts` does not affect external consumers of `nanoid`.
- All 16 `from "@vendor/lib"` consumers in the main tree import `{ nanoid }` only — verified by full-tree grep. Zero edits needed outside `vendor/lib/`.
- Phase D.1 precedent — commit `ec5dcf5ef` deleted `vendor/lib/src/friendly-words.ts` + its package.json subpath export + its `joyful` dep using the same pattern. This plan applies the same pattern to four more modules in one commit.

## What We're NOT Doing

- **Removing `nanoid`.** 16 load-bearing consumers; it is the entire reason `@vendor/lib` exists after this collapse.
- **Renaming or relocating `@vendor/lib`.** The package name, directory, and `vendor` tag stay. Future work can consider re-homing `nanoid` into its own vendor package if useful, but not in this plan.
- **Providing replacements for the deleted modules.** No consumer is asking for `DomainError`, `formatMySqlDateTime`, `uuidv4` (via `@vendor/lib`), or `generatePrettyProjectName`. They are deleted, not relocated. If a future feature needs any of them, it can be added at that time co-located with its consumer.
- **Editing any of the 16 `@vendor/lib` consumer files.** They import `{ nanoid }` and will continue to.
- **Changing `core/ai-sdk/src/core/server/runtime.ts`.** It uses `import { v4 as uuidv4 } from "uuid"` directly — unchanged by this plan.
- **Adding tests.** No tests exist for the deleted modules; no new tests are warranted for deletion.
- **CI / knip wiring.** Out of scope; Phase D explicitly declared knip a manual check.
- **Adding subpath exports to the new minimal `vendor/lib/package.json`.** The existing 16 consumers all use the root barrel. A `./nanoid` subpath has zero users; drop it along with the rest.

## Implementation Approach

Single commit, single revert unit. Six source-file operations + one `package.json` edit + two planning-doc edits:

1. Delete `vendor/lib/src/errors.ts`.
2. Delete `vendor/lib/src/uuid.ts`.
3. Delete `vendor/lib/src/datetime/index.ts` + the now-empty `vendor/lib/src/datetime/` directory.
4. Delete `vendor/lib/src/pretty-project-name.ts`.
5. Collapse `vendor/lib/src/index.ts` to a single `nanoid` re-export.
6. Trim `vendor/lib/package.json` — drop 3 subpath exports, drop `uuid` + `@types/uuid`.
7. Edit `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md` — insert new Phase 2, renumber Phase 2–8 → 3–9, trim the new Phase 4 uuid scope.
8. Delete the superseded narrow plan file `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md`.

Zero consumer edits. The verification suite is a defensive sanity pass, not a diagnostic surface — typecheck across 52 turbo tasks catches any accidentally-imported symbol.

---

## Phase 1: Collapse `@vendor/lib` and renumber Phase D

### Overview

Single commit. No phasing needed beyond this — the scope is too small and too tightly coupled to split further.

### Changes Required:

#### 1. Delete the four dead source modules

**Files to delete:**

```bash
rm vendor/lib/src/errors.ts
rm vendor/lib/src/uuid.ts
rm vendor/lib/src/datetime/index.ts
rmdir vendor/lib/src/datetime      # now empty
rm vendor/lib/src/pretty-project-name.ts
```

After this step, `vendor/lib/src/` contains only `index.ts` and `nanoid.ts`.

#### 2. Collapse the barrel

**File**: `vendor/lib/src/index.ts`
**Changes**: Replace the 5-line barrel with a single `nanoid` re-export.

Before:

```ts
export { formatMySqlDateTime } from "./datetime";
export type { DomainErrorOptions } from "./errors";
export { DomainError, isDomainError } from "./errors";
export { nanoid } from "./nanoid";
export { uuidv4 } from "./uuid";
```

After:

```ts
export { nanoid } from "./nanoid";
```

#### 3. Trim `vendor/lib/package.json`

**File**: `vendor/lib/package.json`
**Changes**: Drop three subpath exports (`./pretty-project-name`, `./datetime`, `./uuid`) and the `./nanoid` subpath (vestigial, zero importers); drop `uuid` prod dep; drop `@types/uuid` devDep.

Before:

```jsonc
{
  "name": "@vendor/lib",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./pretty-project-name": {
      "types": "./src/pretty-project-name.ts",
      "default": "./src/pretty-project-name.ts"
    },
    "./datetime": {
      "types": "./src/datetime/index.ts",
      "default": "./src/datetime/index.ts"
    },
    "./uuid": {
      "types": "./src/uuid.ts",
      "default": "./src/uuid.ts"
    },
    "./nanoid": {
      "types": "./src/nanoid.ts",
      "default": "./src/nanoid.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nanoid": "catalog:",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/uuid": "^10.0.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

After:

```jsonc
{
  "name": "@vendor/lib",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "nanoid": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

#### 4. Edit the Phase D plan — insert new Phase 2 and renumber

**File**: `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md`

Four categories of edit. Be careful with global find-replace — the Improvement Log (lines ~700–725) is historical and must not be renumbered.

**4a. Update the Overview commit count.**

Overview (line 5): change the phrase `roughly 29 dependency changes grouped into seven bisect-friendly commits` → `roughly 29 dependency changes grouped into eight bisect-friendly commits` (adding the collapse sub-phase).

**4b. Update the Implementation Approach list.**

Implementation Approach section (lines 62–74): insert a new step as item **2** and renumber the existing items 2–7 → 3–8.

New step 2 text:

> 2. **Collapse `@vendor/lib` dead surface** — delete `errors.ts`, `uuid.ts`, `datetime/`, `pretty-project-name.ts`; drop matching subpath exports and `uuid`/`@types/uuid` deps. Runs before dep bumps so the subsequent uuid bump targets `core/ai-sdk` only.

Update the summary line at line 74 from `Phase 8 is the final verification gate; no code changes.` → `Phase 9 is the final verification gate; no code changes.`

**4c. Insert the new Phase 2 section.**

After the existing Phase 1's `**Implementation Note**` block (current line ~177, right before the `---` separator that precedes `## Phase 2: Drop-in CLI/Type Majors`), insert the following block:

````markdown
---

## Phase 2: Collapse `@vendor/lib` dead surface

### Overview

See standalone plan: `thoughts/shared/plans/2026-04-19-collapse-vendor-lib-to-nanoid.md`. Deletes four zero-consumer modules (`errors.ts`, `uuid.ts`, `datetime/`, `pretty-project-name.ts`), their re-exports, their subpath export entries, and the `uuid`/`@types/uuid` deps. `@vendor/lib` reduces to a `nanoid`-only vendor shim. Zero consumer edits — all 16 importers pull `nanoid` from the root barrel and are unaffected.

### Changes Required:

See the standalone plan. Summary: 6 file ops in `vendor/lib/` + 1 `package.json` trim.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm install` succeeds; lockfile diff drops `uuid@11.1.0` + `@types/uuid@10.0.0` from the `vendor/lib` subgraph with no other dep changes
- [ ] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52 turbo tasks)
- [ ] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [ ] `pnpm knip --no-exit-code` reports no new findings vs the Phase D baseline
- [ ] `pnpm lint:ws` reports no new issues
- [ ] Repo-wide grep for `DomainError`, `isDomainError`, `DomainErrorOptions`, `formatMySqlDateTime`, `generatePrettyProjectName` returns hits only inside `thoughts/` docs

#### Manual Verification:

- [ ] `pnpm dev:full` boots all three apps; no new warnings in `/tmp/console-dev.log`
- [ ] Exercise any `nanoid()` code path (e.g. create a row that uses `db/app/src/schema/tables/org-entities.ts`'s nanoid default) — confirm unchanged behaviour

**Implementation Note**: After Phase 2 passes, commit and pause for human confirmation before Phase 3.

---
````

(The inserted `---` at the top of the block pairs with the existing `---` already above the old Phase 2 header; remove the old one if duplication results. Resulting file should have exactly one `---` between the new Phase 2 and the renumbered Phase 3.)

**4d. Renumber existing phase headers and internal references.**

Apply these header renames in file order. Use Read + Edit, not global replace, because "Phase N" also appears in the Improvement Log (historical — leave alone) and in prose cross-references.

| Old header                                    | New header                                    |
|-----------------------------------------------|-----------------------------------------------|
| `## Phase 2: Drop-in CLI/Type Majors`         | `## Phase 3: Drop-in CLI/Type Majors`         |
| `## Phase 3: API-Change Majors`               | `## Phase 4: API-Change Majors`               |
| `## Phase 4: Remove Dead IITM/RITM Pins`      | `## Phase 5: Remove Dead IITM/RITM Pins`      |
| `## Phase 5: Arcjet + Nosecone GA`            | `## Phase 6: Arcjet + Nosecone GA`            |
| `## Phase 6: Shiki 4 Ecosystem`               | `## Phase 7: Shiki 4 Ecosystem`               |
| `## Phase 7: lucide-react 1.x`                | `## Phase 8: lucide-react 1.x`                |
| `## Phase 8: Final Verification & Audit …`    | `## Phase 9: Final Verification & Audit …`    |

Internal prose references to renumber (search and update in forward pass, stop at the `## Improvement Log` heading):

- Each `**Implementation Note**: After Phase N passes, commit and pause for human confirmation before Phase N+1.` — update both numbers.
- The summary line in the **Implementation Approach** section: `Phase 8 is the final verification gate` → `Phase 9 is the final verification gate` (already covered in 4b).
- Inside the (new) Phase 9 "Overview" paragraph: `All Phase 1-7 automated checks` → `All Phase 1-8 automated checks` (Success Criteria bullet under Phase 9).

**Do not change:**
- Anything under `## Improvement Log` — historical references to old Phase numbers (Phase 6 (shiki), Phase 7 (lucide-react), Phase 4 (IITM/RITM), Phase 5 (Arcjet), Phase 3 dotenv-cli) must remain as-written so the log's authority stays intact.

**4e. Trim the (new) Phase 4 uuid scope.**

Inside the renamed `## Phase 4: API-Change Majors` section — specifically the `#### 1. uuid 11 → 13 + @types/uuid 10 → 11` subsection:

- **Remove** the `vendor/lib/package.json` edit block (current lines ~266-272):

  ```
  **File**: `vendor/lib/package.json`
  **Changes**: Lines 42, 48.

  ```jsonc
  "uuid": "^13.0.0",         // was ^11.1.0 — ESM-only, browser exports default
  "@types/uuid": "^11.0.0"   // was ^10.0.0 — clears deprecation
  ```
  ```

- **Keep** the `core/ai-sdk/package.json` edit block.
- **Update** the call-sites prose sentence (current line ~282) from `Call sites (vendor/lib/src/uuid.ts:1, core/ai-sdk/src/core/server/runtime.ts:8) use standard named imports — no code change needed.` → `Call site (core/ai-sdk/src/core/server/runtime.ts:8) uses a standard named import — no code change needed.`
- **Update** the Overview sentence (current line ~259) from `Five packages across three sub-bumps with small but real migration work.` → `Four packages across three sub-bumps with small but real migration work.`
- **Update** the Automated Verification bullet (current line ~338) from `pnpm list uuid -r --depth 0 shows uuid@13.x across all workspaces (no leftover 11.x from transitive)` → `pnpm list uuid -r --depth 0 shows uuid@13.x for core/ai-sdk with no leftover 11.x from transitive (vendor/lib no longer declares uuid after Phase 2)`.

#### 5. Delete the superseded narrow plan

**File**: `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md`
**Action**: Delete. This plan is now superseded by the broader `2026-04-19-collapse-vendor-lib-to-nanoid.md`.

```bash
rm thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md
```

### Success Criteria:

#### Automated Verification:

- [ ] `vendor/lib/src/errors.ts`, `vendor/lib/src/uuid.ts`, `vendor/lib/src/pretty-project-name.ts` do not exist
- [ ] `vendor/lib/src/datetime/` directory does not exist
- [ ] `vendor/lib/src/index.ts` contains exactly one non-blank line: `export { nanoid } from "./nanoid";`
- [ ] `vendor/lib/package.json` `exports` block has a single `.` entry; runtime `dependencies` block lists `nanoid` only; devDeps do not list `@types/uuid`
- [ ] `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md` does not exist
- [ ] `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md` contains a `## Phase 2: Collapse \`@vendor/lib\` dead surface` header and a `## Phase 9: Final Verification & Audit Snapshot` header (confirming both the insertion and the renumber)
- [ ] `pnpm install` succeeds with no lockfile conflicts
- [ ] `pnpm-lock.yaml` diff: `uuid@11.1.0` and `@types/uuid@10.0.0` disappear from the `vendor/lib` subgraph; all other deps unchanged
- [ ] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52 turbo tasks)
- [ ] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [ ] `pnpm knip --no-exit-code` reports no new findings vs Phase D baseline; `unresolved imports` count unchanged
- [ ] `pnpm lint:ws` reports no new issues
- [ ] `pnpm build:app` succeeds
- [ ] `pnpm build:platform` succeeds
- [ ] `pnpm build:www` succeeds
- [ ] Repo-wide grep (`rg -t ts -t tsx 'DomainError|isDomainError|DomainErrorOptions|formatMySqlDateTime|generatePrettyProjectName' apps api db packages vendor core`) returns zero source-file hits
- [ ] Repo-wide grep (`rg -t ts -t tsx 'from ["\x27]@vendor/lib/(pretty-project-name|datetime|uuid|nanoid)["\x27]' apps api db packages vendor core`) returns zero hits (confirms no code used the subpaths we're removing)

#### Manual Verification:

- [ ] `pnpm dev:full` boots; `/tmp/console-dev.log` shows no new warnings or module-resolution errors
- [ ] `http://localhost:3024` (app), `http://localhost:3024/docs` (www via microfrontends), `http://localhost:4112` (platform direct) all render without console errors
- [ ] Exercise one `nanoid` code path (e.g. create an API key via `packages/app-api-key/src/crypto.ts:11` or hit an endpoint that generates an id via one of the `db/app/src/schema/tables/*.ts` default generators) — confirm unchanged behaviour
- [ ] Skim the renumbered Phase D plan top-to-bottom — confirm no stale `Phase N` references outside the Improvement Log

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual verification before opening the PR. Commit message should reference the Phase D position explicitly, e.g. `chore(deps): phase D.2 — collapse @vendor/lib to nanoid-only`.

---

## Testing Strategy

### Unit Tests

Nothing to add. The deleted surface has no tests (`vendor/lib/src/**/*.test.ts` glob empty), and the one remaining module (`nanoid.ts`, 7 lines) is a thin wrapper around `customAlphabet` whose behaviour is already exercised implicitly by the 16 consumers.

### Integration Tests

The full `pnpm typecheck` across 52 turbo tasks is the integration surface. Any in-tree consumer that imported one of the four deleted symbols (none do per grep, but belt-and-braces) would fail at compile time.

The `pnpm build:app`, `pnpm build:platform`, `pnpm build:www` trio catches the bundler-level resolution of `from "@vendor/lib"` imports across all app surfaces.

### Manual Testing Steps

1. Branch from the current Phase D branch: work continues on `chore/core-packages-upgrade-phase-d` (no new branch).
2. Apply the eight file operations in order (six file-ops in `vendor/lib/` + Phase D plan edits + stale-plan deletion).
3. Run the full automated verification list.
4. Boot `pnpm dev:full`; load the three URLs; confirm no regressions.
5. Exercise one `nanoid()` code path end-to-end.
6. Commit as `chore(deps): phase D.2 — collapse @vendor/lib to nanoid-only`.
7. Continue with Phase D.3 (ex-D.2, "Drop-in CLI/Type Majors") on the same branch.

## Performance Considerations

None. Deleting 270 lines of source across four unused modules has no runtime impact. Bundle size in production builds should be unchanged (tree-shaking already dropped these symbols for every consumer). TypeScript server memory drops marginally (`vendor/lib` typecheck graph is two modules instead of six). `pnpm install` becomes ~2 MB lighter on disk (one fewer `uuid` package tree).

## Migration Notes

No data migration. No schema change. Rollback is `git revert <commit>` + `pnpm install` — the dep removal reverses cleanly.

If a future feature needs `DomainError`, `formatMySqlDateTime`, `uuidv4` (via a shared vendor path), or `generatePrettyProjectName`, it should be added at that time, co-located with its first consumer or promoted to a dedicated package — rather than revived from this deletion. The git history and this plan document the original surface if reference is needed.

## References

- Research: `thoughts/shared/research/2026-04-19-vendor-lib-errors-usage.md` — usage audit that established the `DomainError` zero-consumer claim; line 99 extends the zero-consumer list to the remaining four surfaces.
- Phase D plan (to be edited): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md`. Line anchors referenced above were accurate at time of writing; re-verify before editing if the plan has been touched since.
- Phase D.1 precedent: commit `ec5dcf5ef chore(deps): phase D.1 — hygiene bumps + joyful deletion` — direct analog for this plan's pattern applied to the `joyful`/`friendly-words.ts` surface.
- Superseded narrow plan (to be deleted): `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md`.
- Original migration context: `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md` — documents the `@repo/lib` → `@vendor/lib` rehoming that carried all four dead modules forward verbatim; line 422 confirms the zero-consumer count for the full set.
- Files touched:
  - `vendor/lib/src/errors.ts` — delete.
  - `vendor/lib/src/uuid.ts` — delete.
  - `vendor/lib/src/datetime/index.ts` — delete; remove empty parent dir.
  - `vendor/lib/src/pretty-project-name.ts` — delete.
  - `vendor/lib/src/index.ts` — collapse to 1 line.
  - `vendor/lib/package.json` — trim exports map + drop `uuid` / `@types/uuid` deps.
  - `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md` — insert new Phase 2, renumber Phase 2→9, trim (new) Phase 4 uuid scope.
  - `thoughts/shared/plans/2026-04-19-delete-vendor-lib-errors.md` — delete.
