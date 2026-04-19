# Split `@repo/lib`: extract encryption → `@repo/app-encryption`, relocate the rest → `@vendor/lib`, stabilize flaky timing test

## Overview

Every PR since the `packages` / `vendor` boundary rules landed fails `CI / Quality` because `@vendor/observability` imports `nanoid` from `@repo/lib`, and `@repo/lib` is tagged `packages` (denied for vendors). Additionally, a timing-based unit test in `core/ai-sdk` flakes on fast GitHub runners.

Rather than moving `@repo/lib` wholesale into `vendor/` (prior plan revision), we **split it along its actual cohesion seam**: encryption primitives (`encrypt`/`decrypt`/`generateEncryptionKey`) become a dedicated `@repo/app-encryption` package tagged `packages`, and the remaining zero-coupling helpers (nanoid, uuid, datetime, friendly-words, pretty-project-name, DomainError) relocate to `vendor/lib` as `@vendor/lib` tagged `vendor`. This honors the boundary tags (security-critical crypto stays in the `packages` tier; ID/datetime helpers move to the vendor tier where observability can legally depend on them) without papering over the grab-bag shape that made the violation possible in the first place.

## Current State Analysis

### Failure 1: `CI / Quality` — turbo boundaries (blocks "CI Success")

- `pnpm turbo boundaries` reports 4 violations in CI — all rooted in a single import:
  - `vendor/observability/src/trpc.ts:3` → `import { nanoid } from "@repo/lib"` (used at `trpc.ts:96` to generate a per-request correlation ID)
- `packages/lib/turbo.json:3` tags `@repo/lib` as `packages`.
- `turbo.json:91-93` denies `packages` as dependencies of anything tagged `vendor`.
- `@vendor/mcp`, `@vendor/next`, `@vendor/pinecone` all fail transitively because they depend on `@vendor/observability`.
- Seen on both recent PRs: #603 (`chore(deps): core packages upgrade — phase A`), #604 (`chore: relicense to apache 2`); both were merged with the failure unresolved.

### Failure 2: `Core CI / Test` — flaky timing assertion (hit #603, passed #604)

- `core/ai-sdk/src/core/primitives/tool.test.ts:149`: `expect(end - start).toBeGreaterThanOrEqual(10)` with `setTimeout(resolve, 10)` received `9` on a fast CI runner.
- The preceding assertion (`expect(result).toEqual({ completed: true, sessionId: "async-session" })`) already proves the async execution path ran — the timing check adds no coverage, only flake.

### Key Discoveries (verified against source, not inherited from prior plan draft)

- `packages/lib/src/index.ts` exports 7 logical surfaces: `formatMySqlDateTime` (datetime), `encrypt`/`decrypt`/`generateEncryptionKey`/`EncryptionError`/`DecryptionError` (encryption), `DomainError`/`isDomainError`/`DomainErrorOptions` (errors), `nanoid` (nanoid), `uuidv4` (uuid). `friendly-words` and `pretty-project-name` are exposed only as subpath exports (`@repo/lib/friendly-words`, `@repo/lib/pretty-project-name`) and are not re-exported from the root.
- **Import-site census** (grep `from "@repo/lib"` across `*.ts`/`*.tsx`, main tree only):
  - `nanoid` imported by **16 files**: `vendor/observability/src/trpc.ts`, `packages/app-api-key/src/crypto.ts`, `packages/app-test-data/src/cli/seed-integrations.ts`, 11 × `db/app/src/schema/tables/*.ts`, `api/platform/src/lib/oauth/authorize.ts`, `api/platform/src/inngest/functions/health-check.ts`.
  - `encrypt`/`decrypt` imported by **5 files** (all in `api/*`): `api/app/src/lib/token-vault.ts`, `api/platform/src/lib/token-helpers.ts`, `api/platform/src/lib/token-store.ts`, `api/platform/src/inngest/functions/connection-lifecycle.ts`, `api/platform/src/inngest/functions/token-refresh.ts`.
  - `uuidv4`, `DomainError`/`isDomainError`, `formatMySqlDateTime`, `friendly-words`, `pretty-project-name`: **zero external import sites** (dead code at the import boundary). The datetime/friendly/uuid modules do not even appear in any `import { … } from "@repo/lib"` call; they either survive as latent surface or via subpath-import that was never wired.
- `packages/lib/src/encryption.ts` has no intra-package imports — it is fully self-contained (Web Crypto API only, 232 lines). Safe to extract without touching the rest of `packages/lib`.
- `packages/lib/src/errors.ts` is fully self-contained (generic `DomainError` base class, 64 lines). Ships to `@vendor/lib` alongside the rest.
- `@repo/lib` runtime dependencies: `joyful ^1.1.1`, `nanoid` (catalog), `uuid ^11.1.0`. `joyful` is only used by `pretty-project-name.ts` (which has no external callers), and `uuid` is only used by `uuid.ts` (which has no external callers). After the split, `@vendor/lib` can technically drop `joyful` and `uuid` as dead-weight deps — flagged as an optional clean-up, not required to fix CI.
- Boundary rules (`turbo.json:88-104`):
  - `vendor` → DENY deps on: `packages`, `data`, `api`, `app`.
  - `internal` → DENY deps on everything below the tooling tier.
  - `app` (as dependent) → DENY dependents from: `vendor`, `packages`, `data`, `api`, `core`, `internal`.
  - **No rule** denies `packages` / `data` / `api` / `app` → `vendor`. `packages/*` already depends on `vendor/*` in multiple existing places (`packages/app-rerank`, `packages/ui`, `packages/app-embed`, `packages/app-pinecone`, `packages/app-upstash-realtime`, etc.), so `packages → @vendor/lib` is a well-trodden path.
- `pnpm-workspace.yaml:7` already globs `vendor/*`. No workspace config change needed for the move.
- Naming precedent: `@vendor/seo` (`vendor/seo/package.json`) is an existing vendor package that is NOT a third-party SDK wrapper — it's a pure utility. So `@vendor/lib` as a utility layer fits existing convention. `packages/app-*` is the established prefix for app-tier utility packages; `@repo/app-encryption` fits alongside `@repo/app-api-key`, `@repo/app-providers`, etc.

### What we considered and rejected

- **Minimal fix (one-line import swap)**: Add `"nanoid": "catalog:"` to `vendor/observability/package.json` and change `import { nanoid } from "@repo/lib"` → `import { nanoid } from "nanoid"`. Ships CI green in ~4 lines of diff. **Rejected** because it leaves the underlying grab-bag (`@repo/lib` with crypto + id-gen + errors + datetime sharing a single import surface and package tag) unresolved, and the next vendor-on-utility import will hit the same wall.
- **Wholesale move** (`packages/lib` → `vendor/lib` as-is): Rejected — promotes security-critical encryption utilities into the `vendor` tier without reason. Vendor-tier code is "consumable by everything" — encryption at rest for tokens is tied to the application's security model, not a pure utility.

## Desired End State

- `pnpm turbo boundaries` returns 0 violations on main.
- `pnpm --filter @lightfastai/ai-sdk test` passes deterministically across 5 consecutive runs.
- `@repo/app-encryption` exists at `packages/app-encryption/`, tagged `packages`, owning `encrypt`/`decrypt`/`generateEncryptionKey`/`EncryptionError`/`DecryptionError` + the `ENCRYPTION.md` doc + the existing `encryption.test.ts` suite.
- `@vendor/lib` exists at `vendor/lib/`, tagged `vendor`, owning nanoid/uuidv4/formatMySqlDateTime/DomainError/friendly-words/pretty-project-name.
- `@repo/lib` no longer exists in the workspace.
- All 5 encryption call-sites import from `@repo/app-encryption`.
- All 16 nanoid call-sites import from `@vendor/lib`.

### How to Verify

1. `pnpm turbo boundaries` exits 0.
2. `pnpm check && pnpm typecheck` exits 0.
3. `pnpm --filter @lightfastai/ai-sdk test --run` passes 5 consecutive runs.
4. `grep -rn "from \"@repo/lib\"" --include='*.ts' --include='*.tsx' .` returns 0 matches (excluding `thoughts/` historical docs).
5. `pnpm build:app && pnpm build:platform` succeed.

## What We're NOT Doing

- **Not** pruning the dead-code modules (`uuid.ts`, `datetime/`, `friendly-words.ts`, `pretty-project-name.ts`) or dead deps (`joyful`, `uuid`) inside `@vendor/lib`. They move as-is. A follow-up pass can delete what's unused once this lands; bundling it here widens blast radius.
- **Not** fixing the 4 stale-`dist/` boundary warnings that only appear locally (`@vendor/observability` missing `@t3-oss/env-core`/`@logtail/edge` devDeps, `@repo/app-remotion` missing `@remotion/bundler`). CI runs boundaries without prior build caches in those paths, so they do not block CI today. Out of scope.
- **Not** introducing a new tag (`foundation`, `shared`). Using existing `packages` + `vendor` tags is sufficient once the split lands.
- **Not** converting the timing test to fake timers. Dropping the assertion is sufficient — the completion assertion already covers the async path.
- **Not** touching git history on merged PRs (#603, #604). Failures carry forward until this plan lands.

## Implementation Approach

Three phases, each independently verifiable and revertable:

1. **Phase 1** carves the encryption module out of `@repo/lib` into `@repo/app-encryption`. Encryption consumers are rewritten. `@repo/lib` keeps serving the rest. Boundaries still fail at the end of Phase 1 (nanoid in `vendor/observability` is still cross-tier) — Phase 1 is pure prep.
2. **Phase 2** renames + relocates the (encryption-free) `@repo/lib` to `@vendor/lib`. Retags. Rewrites 16 nanoid consumers + 7 `package.json` dep entries + 2 `next.config.ts` + `knip.json` + `.changeset/pre.json`. This is the phase that turns CI green.
3. **Phase 3** drops the flaky timing assertion. Independent of the migration so it can be bisected separately if the rename surfaces a regression.

Use `git mv` for the directory move so history is preserved. Use `pnpm install` to regenerate the lockfile; do not hand-edit it.

---

## Phase 1: Extract encryption → `@repo/app-encryption`

### Overview

Create a new workspace package `packages/app-encryption/` that owns the encryption primitives. Rewrite the 5 encryption consumers. Remove encryption from `@repo/lib`'s surface. Phase 1 leaves `@repo/lib` in place — the boundary violation in `vendor/observability` persists until Phase 2.

### Changes Required

#### 1. Create `packages/app-encryption/`

Mirror the layout of `packages/app-api-key/` (similarly-scoped, tagged `packages`, single-purpose utility package). Files to create:

- `packages/app-encryption/package.json`:
  ```json
  {
    "name": "@repo/app-encryption",
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
      "test": "vitest run",
      "typecheck": "tsc --noEmit"
    },
    "dependencies": {},
    "devDependencies": {
      "@repo/typescript-config": "workspace:*",
      "@repo/vitest-config": "workspace:*",
      "@types/node": "catalog:",
      "typescript": "catalog:",
      "vitest": "catalog:"
    }
  }
  ```
  Note: no runtime deps — `encryption.ts` uses Web Crypto only.

- `packages/app-encryption/turbo.json`:
  ```json
  {
    "extends": ["//"],
    "tags": ["packages"],
    "tasks": {}
  }
  ```

- `packages/app-encryption/tsconfig.json` — copy from `packages/lib/tsconfig.json`.

- `packages/app-encryption/src/index.ts`:
  ```ts
  export {
    DecryptionError,
    decrypt,
    EncryptionError,
    encrypt,
    generateEncryptionKey,
  } from "./encryption";
  ```

- `packages/app-encryption/src/encryption.ts` — **move** from `packages/lib/src/encryption.ts` via `git mv`.
- `packages/app-encryption/src/encryption.test.ts` — **move** from `packages/lib/src/encryption.test.ts` via `git mv`.
- `packages/app-encryption/ENCRYPTION.md` — **move** from `packages/lib/ENCRYPTION.md` via `git mv`. Update the doc's `import { ... } from "@repo/lib"` example to `@repo/app-encryption`.

#### 2. Remove encryption exports from `@repo/lib`

**File**: `packages/lib/src/index.ts`
**Change**: Delete lines 2–8 (the `encryption` re-exports block). Keep the remaining lines (`datetime`, `errors`, `nanoid`, `uuid`).

#### 3. Rewrite encryption consumers (5 files)

Add `"@repo/app-encryption": "workspace:*"` to each consumer's `package.json` and update imports:

| File | Old import | New import |
|---|---|---|
| `api/app/src/lib/token-vault.ts:3` | `import { decrypt } from "@repo/lib";` | `import { decrypt } from "@repo/app-encryption";` |
| `api/platform/src/lib/token-helpers.ts:4` | `import { decrypt } from "@repo/lib";` | `import { decrypt } from "@repo/app-encryption";` |
| `api/platform/src/lib/token-store.ts:4` | `import { encrypt } from "@repo/lib";` | `import { encrypt } from "@repo/app-encryption";` |
| `api/platform/src/inngest/functions/connection-lifecycle.ts:23` | `import { decrypt } from "@repo/lib";` | `import { decrypt } from "@repo/app-encryption";` |
| `api/platform/src/inngest/functions/token-refresh.ts:15` | `import { decrypt } from "@repo/lib";` | `import { decrypt } from "@repo/app-encryption";` |

Consumer `package.json` updates: `api/app/package.json`, `api/platform/package.json`. Each already declares `"@repo/lib": "workspace:*"` — leave that in place for Phase 1 (still used for nanoid-bearing files until Phase 2). Add `"@repo/app-encryption": "workspace:*"` alongside.

#### 4. Regenerate the lockfile

```bash
pnpm install
```

### Success Criteria

#### Automated Verification

- [x] `ls packages/app-encryption/package.json` exists.
- [x] `packages/app-encryption/package.json` has `"name": "@repo/app-encryption"` and tag `packages` in its `turbo.json`.
- [x] `git log --follow packages/app-encryption/src/encryption.ts` shows history from `packages/lib/src/encryption.ts`.
- [x] `grep -rn 'encrypt\|decrypt' --include='*.ts' --include='*.tsx' | grep '@repo/lib'` returns 0 results.
- [x] `pnpm install` completes cleanly.
- [x] `pnpm --filter @repo/app-encryption test` passes (the moved `encryption.test.ts` still runs).
- [x] `pnpm check` and `pnpm typecheck` exit 0.

#### Manual Verification

- [x] Inspect `packages/lib/src/index.ts` — only datetime, errors, nanoid, uuid exports remain.

**Note**: `pnpm turbo boundaries` is still expected to fail at the end of Phase 1 — the `@vendor/observability` → `@repo/lib` nanoid edge remains. Do not gate Phase 1 on boundary pass.

---

## Phase 2: Rename `@repo/lib` → `@vendor/lib` and relocate

### Overview

`@repo/lib` at this point contains only zero-coupling utilities (nanoid, uuid, datetime, errors, friendly-words, pretty-project-name). Move the directory, rename the package, retag it `vendor`, and rewrite the 16 remaining nanoid consumers. This is the phase that turns CI green.

### Changes Required

#### 1. Move the directory

```bash
git mv packages/lib vendor/lib
```

#### 2. Rename and retag the package

**File**: `vendor/lib/package.json` (post-move path)
**Changes**: Update `"name": "@repo/lib"` → `"name": "@vendor/lib"`. Leave `version`, `exports`, scripts, deps untouched.

**File**: `vendor/lib/turbo.json`
**Changes**: Replace tag `packages` → `vendor`:
```json
{
  "extends": ["//"],
  "tags": ["vendor"],
  "tasks": {}
}
```

#### 3. Rewrite source imports (16 files)

Replace `from "@repo/lib"` → `from "@vendor/lib"` in every consumer (all import `nanoid` only):

- `vendor/observability/src/trpc.ts:3` *(the original boundary violator; now vendor-on-vendor, permitted)*
- `packages/app-api-key/src/crypto.ts:11`
- `packages/app-test-data/src/cli/seed-integrations.ts:15`
- `api/platform/src/lib/oauth/authorize.ts:9`
- `api/platform/src/inngest/functions/health-check.ts:16`
- `db/app/src/schema/tables/gateway-installations.ts:4`
- `db/app/src/schema/tables/gateway-tokens.ts:1`
- `db/app/src/schema/tables/gateway-webhook-deliveries.ts:1`
- `db/app/src/schema/tables/gateway-lifecycle-log.ts:1`
- `db/app/src/schema/tables/gateway-backfill-runs.ts:1`
- `db/app/src/schema/tables/org-api-keys.ts:1`
- `db/app/src/schema/tables/org-integrations.ts:3`
- `db/app/src/schema/tables/org-events.ts:2`
- `db/app/src/schema/tables/org-entities.ts:2`
- `db/app/src/schema/tables/org-entity-edges.ts:1`
- `db/app/src/schema/tables/org-repo-indexes.ts:1`

Verify nothing missed:
```bash
grep -rn 'from "@repo/lib' --include='*.ts' --include='*.tsx' .
```
Expect 0 matches at end of Phase 2.

#### 4. Rewrite consumer `package.json` dep entries

Replace `"@repo/lib": "workspace:*"` → `"@vendor/lib": "workspace:*"` in:

- `vendor/observability/package.json`
- `packages/app-api-key/package.json`
- `packages/app-test-data/package.json`
- `db/app/package.json`
- `api/app/package.json`
- `api/platform/package.json`
- `apps/app/package.json`
- `apps/platform/package.json`

Re-verify exhaustiveness: `grep -l '"@repo/lib"' **/package.json`. Run this command to generate the list; do not rely on the list above being frozen correct.

#### 5. Next.js config string arrays

**File**: `apps/app/next.config.ts`
**Change**: Replace both `@repo/lib` occurrences (in `transpilePackages`, lines 35 and 63) with `@vendor/lib`.

**File**: `apps/platform/next.config.ts`
**Change**: Replace `@repo/lib` in `transpilePackages` (line 13) and `experimental.optimizePackageImports` (line 21) with `@vendor/lib`.

#### 6. Root config files

**File**: `knip.json` — replace `@repo/lib` → `@vendor/lib`.
**File**: `.changeset/pre.json` — replace `@repo/lib` → `@vendor/lib` in the changeset pre-release state.

#### 7. Regenerate the lockfile

```bash
pnpm install
```

### Success Criteria

#### Automated Verification

- [x] `grep -rn '@repo/lib' --include='*.ts' --include='*.tsx' --include='*.json' .` returns 0 results (excluding `thoughts/**/*.md` historical docs).
- [x] `pnpm install` completes with no peer-dep or resolution errors.
- [x] `pnpm turbo boundaries` exits 0 (or only the out-of-scope stale-`dist/` warnings noted above).
- [x] `pnpm check` exits 0.
- [x] `pnpm typecheck` exits 0.
- [x] `pnpm build:app` exits 0.
- [x] `pnpm build:platform` exits 0.
- [x] `git log --follow vendor/lib/package.json` shows history from the old `packages/lib/` path.

#### Manual Verification

- [ ] `pnpm dev:app` boots; homepage loads without module-resolution errors.
- [ ] `pnpm dev:platform` boots on port 4112; health check responds.
- [ ] `pnpm --filter @db/app db:studio` opens and shows schemas correctly (confirms `db/app/src/schema/tables/*.ts` import rewrites didn't corrupt schema files).

**Pause-and-confirm**: after Phase 2 automated verification passes, stop and get human confirmation before proceeding to Phase 3.

---

## Phase 3: Stabilize Flaky Timing Test

### Overview

Remove the timing-based assertion in the `should handle async execution` test. The completion assertion already covers the async execution path.

### Changes Required

**File**: `core/ai-sdk/src/core/primitives/tool.test.ts`
**Change**: At line 149, remove `expect(end - start).toBeGreaterThanOrEqual(10);` along with the now-unused `start` (line 138) and `end` (line 143).

Before (lines 137–149):

```ts
const tool = toolFactory(context);
const start = Date.now();
const result = await tool.execute?.(
  { delay: 10 },
  { toolCallId: "test", messages: [] }
);
const end = Date.now();

expect(result).toEqual({
  completed: true,
  sessionId: "async-session",
});
expect(end - start).toBeGreaterThanOrEqual(10);
```

After:

```ts
const tool = toolFactory(context);
const result = await tool.execute?.(
  { delay: 10 },
  { toolCallId: "test", messages: [] }
);

expect(result).toEqual({
  completed: true,
  sessionId: "async-session",
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfastai/ai-sdk test` passes.
- [x] Loop 5 runs to confirm determinism: `for i in 1 2 3 4 5; do pnpm --filter @lightfastai/ai-sdk test --run || break; done` all pass.

#### Manual Verification

- [ ] N/A — test-only change.

---

## Testing Strategy

### Unit Tests

- The extracted `packages/app-encryption/src/encryption.test.ts` (moved from `packages/lib/src/encryption.test.ts`) must continue to pass under the new package name.
- `core/ai-sdk/src/core/primitives/tool.test.ts` must pass deterministically.

### Integration Tests

- `pnpm build:app` and `pnpm build:platform` exercise the full import graph through Next.js compilation.

### Manual Testing Steps

1. `pnpm install` at repo root.
2. `pnpm turbo boundaries` — expect 0 issues.
3. `pnpm check && pnpm typecheck` from root.
4. `pnpm dev:app` — verify boot.
5. `pnpm dev:platform` — verify boot + port 4112 response.
6. Open a draft PR; confirm `CI / Quality`, `CI Success`, `Core CI / Test` all green.

## Performance Considerations

- No runtime performance change. Same code under new names.
- `apps/platform/next.config.ts` already lists `@repo/lib` under `optimizePackageImports`; preserving the hint under `@vendor/lib` keeps bundle optimization unchanged. `@repo/app-encryption` is small and does not need a similar hint.

## Migration Notes

- No data migration. No API contract change. Packages are `private: true`; no external consumers.
- Split and rename land in a single commit/PR so no intermediate state is tolerated on `main`.

## References

- Failing CI run (PR #603, boundaries): https://github.com/lightfastai/lightfast/actions/runs/24619392239/job/71987148246
- Failing CI run (PR #603, flaky test): https://github.com/lightfastai/lightfast/actions/runs/24619392256/job/71987148290
- Failing CI run (PR #604, boundaries): https://github.com/lightfastai/lightfast/actions/runs/24619645052/job/71987842376
- Boundary rule source: `turbo.json:88-105`
- Precedent for non-SDK utility in `vendor/`: `vendor/seo/package.json` (`@vendor/seo`).
- Precedent for single-purpose `packages/app-*` utility: `packages/app-api-key/package.json` (`@repo/app-api-key`).
- Flaky test source: `core/ai-sdk/src/core/primitives/tool.test.ts:120-150`

---

## Improvement Log

### 2026-04-19 — Adversarial review (improve_plan)

**Findings raised against the prior draft:**

1. *Critical*: Prior draft proposed a 36-file migration (`packages/lib` → `vendor/lib` wholesale) to fix a 1-line import. Even the minimal 2-file fix (add `nanoid` dep to `@vendor/observability`, switch the import) would close the CI failure.
2. *Critical*: Prior draft described `@repo/lib` as a "zero-dep pure utility" — overlooked that it also exports `encrypt`/`decrypt`/`generateEncryptionKey` security primitives, which do not semantically belong in the `vendor` tier.
3. *High*: Prior draft ignored cohesion — `nanoid` callers (11 `db/*` schema files) and `encrypt`/`decrypt` callers (5 `api/*` token flows) are entirely disjoint import surfaces. Moving the grab-bag as one unit bakes in the wrong shape.
4. *High*: Prior draft's claim "21 source-file imports" was accurate in count but mixed domains. Verified breakdown: 16 nanoid-only + 5 encrypt/decrypt-only + 0 for the other 5 exports (`uuidv4`, `DomainError`, `formatMySqlDateTime`, `friendly-words`, `pretty-project-name` have zero external consumers — latent dead code).
5. *Improvement*: Added precedent citations (`@vendor/seo` for non-SDK vendor utility; `@repo/app-api-key` for single-purpose `packages/app-*` pattern).
6. *Improvement*: Removed Phase 1's "workspace in broken state" hand-off. New Phase 1 leaves the workspace resolvable at all times.

**User decision (via AskUserQuestion):**

- **Approach**: Split the package. Extract encryption into a new `packages/*` (now `@repo/app-encryption`), migrate the rest to `@vendor/lib`. Rejected both "minimal fix" (short-term only) and "wholesale move" (ignores cohesion).
- **nanoid alphabet**: Preserved via the existing `customAlphabet` export in `@vendor/lib` — no consumer behavior change. (Question was framed against the minimal-fix path; resolved automatically by the split path.)

**What changed in the plan:**

- Restructured phases from "move → rename → fix test" to "extract encryption → relocate rest → fix test".
- Added verified import-site census (16 nanoid + 5 encrypt/decrypt + 0 for the rest), replacing the prior hand-waved count.
- Added dead-code note under "What We're NOT Doing" — flagged `uuid.ts`, `datetime/`, `friendly-words.ts`, `pretty-project-name.ts` as unused externally; deferred pruning to a follow-up.
- Added explicit "what we rejected and why" section to preserve the decision trail for future readers.
- Corrected boundary-rule framing: no rule denies `packages → vendor`, and `packages/*` already depends on `vendor/*` in several existing places (cited), so the split does not introduce a novel coupling direction.
