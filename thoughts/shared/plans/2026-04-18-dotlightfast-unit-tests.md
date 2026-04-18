# `@repo/dotlightfast` Unit Tests Implementation Plan

## Overview

Add a vitest suite to `@repo/dotlightfast` that locks in the behaviour of `parseDotLightfast(fetcher)` — the pure, fetcher-seam parser that powers the agent-triage runtime. The tests are purely additive: no production code changes, no integration tests, no live network. The `Fetcher` callback is the seam, so every case is exercised by handing the parser an in-memory `Map<string, FetcherResult>`.

The suite acts as a regression guard for:

1. The recently-landed path-prefix change (`.lightfast/` prefix was dropped — the repo root IS the config root now).
2. The quiet skip branches the consumer (`api/platform` agent-triage Inngest function) depends on.
3. The frontmatter / command-probe resilience the parser has to provide to customer-authored `.lightfast/` configs.

## Current State Analysis

### Package layout (`packages/dotlightfast/`)

- `src/parse.ts` — 87 lines. Exports `parseDotLightfast(fetcher)`. Constants `MAX_SPEC_BYTES = 32_000`, `MAX_SKILLS = 50`, regex `FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/`. Makes exactly the following fetcher calls per invocation:
  - `SPEC.md`
  - `skills`
  - per surviving skill dir: `skills/<dir>/SKILL.md`
  - per skill whose frontmatter validates: `skills/<dir>/command/<name>.md` (note: probed path uses `parsed.data.name`, not `dirName` — worth covering)
- `src/schema.ts` — `SkillFrontmatterSchema`: `name` is a kebab-case regex, `description` is a 1–500 char string.
- `src/types.ts` — `Fetcher`, `FetcherResult` (file | dir | missing), `DotLightfastConfig`, `SkillManifest`, `DotLightfastParseError` (carries `path` and optional `cause`).
- `src/triage.ts` — prompt builders, **out of scope** for this plan.
- `src/index.ts` — public re-exports.

### Tooling state

- `packages/dotlightfast/package.json` currently lists **no** `test` script and **no** vitest dev dep or vitest-config dep. It only declares `typecheck` and `clean`.
- No `vitest.config.ts` in the package.
- Turborepo already has a `test` task (`turbo.json:39`) with `inputs: ["src/**", "vitest.config.ts", "tsconfig.json"]`.
- Shared vitest config lives at `internal/vitest-config` (package name `@repo/vitest-config`, exporting `./vitest.shared.ts`). It sets `pool: "threads"`, `maxWorkers: 2`, `fileParallelism: false` to keep parallel turbo runs sane.
- **Canonical reference is `packages/lib/`** — pure-TS utility package with zero framework deps, identical wiring (`packages/lib/package.json:34-51`, `packages/lib/vitest.config.ts`, `packages/lib/src/encryption.test.ts`). `packages/app-providers/` has the same shape but pulls in provider-specific concerns; `lib` is the closer sibling for `dotlightfast`.
- **Convention: tests are colocated in `src/`**, NOT under `src/__tests__/`. Every test file in the workspace (`packages/lib/src/encryption.test.ts`, `packages/app-providers/src/crypto.test.ts`, etc.) sits next to its source file. No package uses a `__tests__/` subdirectory. Catalog pins `vitest ^4.0.18`.

### Behaviour worth highlighting (from reading `parse.ts`)

- SPEC branching:
  - `specResult.type === "file"` → truncate at `MAX_SPEC_BYTES` iff `content.length > MAX_SPEC_BYTES` (so "exactly at limit" must **not** be truncated).
  - `specResult.type === "missing"` → `spec = null`, no throw.
  - Any other type (i.e. `"dir"`) → throws `DotLightfastParseError("SPEC.md path resolved to a directory", "SPEC.md")`.
- Skills branching:
  - `skillsRoot.type !== "dir"` → `skills = []` silently (covers both `missing` and `file`).
  - Entries filtered to `type === "dir"` **before** the `MAX_SKILLS` slice, so "files in skills dir" test won't interfere with the 50-cap test.
- `loadSkill`:
  - `SKILL.md` missing → returns `null` (skipped).
  - No frontmatter, YAML error, YAML array/scalar (`!obj || Array.isArray`), or schema failure → all return `null` via `extractFrontmatter`/`safeParse`. Never throws.
  - Command probe path is `skills/<dirName>/command/<parsed.data.name>.md`. The directory segment uses `dirName` but the filename uses `parsed.data.name` — these can diverge, and the suite must lock the divergence in. `hasCommand` is strictly `commandProbe.type === "file"` — a `dir` or `missing` both yield `false`.
- Fetcher is `await`ed directly with no `try/catch`, so a thrown fetcher propagates (this is base `await` semantics — not separately tested).

### Predecessor plans flagging this as deferred

- `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` — initial v1 runtime; explicitly defers dotlightfast unit tests.
- `thoughts/shared/plans/2026-04-18-dotlightfast-path-prefix-fix.md` — the prefix-fix follow-up; calls out unit tests as the next follow-up.

### Key Discoveries

- `packages/dotlightfast/package.json:13-16` — missing `test` script and vitest devDeps; Phase 1 must add them.
- `packages/lib/vitest.config.ts` and `packages/lib/package.json:34-51` — canonical shape to copy verbatim.
- `internal/vitest-config/vitest.shared.ts:14-20` — shared config resource limits inherited automatically via `mergeConfig`.
- `packages/dotlightfast/src/parse.ts:77-79` — command probe uses `parsed.data.name` for the filename and `dirName` for the directory segment. **One test deliberately makes them differ** (e.g. dir `alpha-v2` with `name: alpha`) so the regression is locked.
- `packages/dotlightfast/src/parse.ts:14` — `FRONTMATTER_RE` is `^---\r?\n([\s\S]*?)\r?\n---\r?\n?`. Anchored at start of string. A CRLF variant whose source begins with `---\r\n` (no leading newline) and uses `\r\n` between lines must parse cleanly.
- `packages/dotlightfast/src/parse.ts:49-57` — filter-then-slice ordering makes the 50-cap regression clean.

## Desired End State

- `packages/dotlightfast/` has a runnable vitest suite with a `pnpm --filter @repo/dotlightfast test` entrypoint.
- All ~16 test cases listed in "Cases to cover" pass.
- Turborepo picks the package up under the existing `test` task (no `turbo.json` edits needed; `inputs` already matches).
- `parse.ts`, `schema.ts`, `types.ts`, `triage.ts` are **unchanged**.

### Verification

- `pnpm --filter @repo/dotlightfast test` exits 0.
- `pnpm --filter @repo/dotlightfast typecheck` still green (the added `.test.ts` file is inside `src/` and will be picked up by `tsc --noEmit`).

## What We're NOT Doing

- **No edits to `src/parse.ts`, `src/schema.ts`, `src/types.ts`, or `src/triage.ts`.** Tests are additive; any behaviour that feels "wrong" during writing is logged as a follow-up, not fixed here.
- **No tests for `triage.ts` prompt builders.** They're string concatenation; not in the signed-off list.
- **No integration tests, no live GitHub calls, no filesystem I/O.** The `Fetcher` is the seam; every test uses the in-memory helper.
- **No tests for the consumer** at `api/platform/src/inngest/functions/platform-agent-triage.ts`. Covered separately.
- **No changes to `turbo.json`** — the `test` task already exists and matches the inputs glob.
- **No coverage tooling.** No `--coverage` script, no `@vitest/coverage-v8` devDep. The suite is authored to exercise every branch in `parse.ts` by construction; verifying that is a manual code-walk during review, not an automated gate.
- **No separate test-helper file.** The in-memory fetcher is ~10 lines; it lives at the top of `parse.test.ts`. Repo convention is colocated tests in `src/` with no `__tests__/` subdirs.

## Implementation Approach

Two phases, each committable on its own:

1. Phase 1 wires vitest into the package (config, deps, script). It's a no-op until Phase 2 adds real tests.
2. Phase 2 adds `parse.test.ts` with the in-memory fetcher helper inlined at the top, one `describe` per category, and one `it` per bullet (~16 total).

Phase 1 is gated by `pnpm install` and `pnpm --filter @repo/dotlightfast test` exiting 0. **Vitest 4.x exits non-zero by default when no test files match**, so the Phase 1 `test` script is `vitest run --passWithNoTests` initially; Phase 2 changes it to `vitest run`. Phase 2 is gated by the full ~16-case run going green.

---

## Phase 1: Vitest Scaffolding

### Overview

Wire vitest into `@repo/dotlightfast` the same way `@repo/lib` is wired. No production source edits, no test files yet.

### Changes Required

#### 1. Package manifest

**File**: `packages/dotlightfast/package.json`
**Changes**: Add `test` script (with `--passWithNoTests` for this phase), add `@repo/vitest-config` and `vitest` devDeps (both use `catalog:` / `workspace:*` per repo conventions). Phase 2 will drop `--passWithNoTests`.

```json
{
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit"
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

#### 2. Vitest config

**File**: `packages/dotlightfast/vitest.config.ts` (new)
**Changes**: Mirror `packages/lib/vitest.config.ts` verbatim — merged with the shared config, `globals: true`, `environment: "node"`.

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  }),
);
```

#### 3. Install

```bash
pnpm install
```

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds with no workspace resolution errors.
- [x] `pnpm --filter @repo/dotlightfast typecheck` passes.
- [x] `pnpm --filter @repo/dotlightfast test` exits 0 (no test files yet; `--passWithNoTests` suppresses vitest 4.x's default non-zero exit).

#### Manual Verification

- [x] `packages/dotlightfast/vitest.config.ts` exists and imports resolve in an editor.
- [x] `@repo/vitest-config` resolves (no missing workspace dep surfaced by the IDE).

**Implementation Note**: After Phase 1 automated checks pass, pause for confirmation before starting Phase 2. Phase 2 is additive-only and low-risk, but a clean vitest entrypoint first makes the diff readable.

---

## Phase 2: Test Suite for `parseDotLightfast`

### Overview

One file: `packages/dotlightfast/src/parse.test.ts`. Six `describe` blocks. ~16 `it` blocks total. The in-memory fetcher is inlined at the top of the test file (~10 LOC) — no separate helper file, matching repo convention. Also drop `--passWithNoTests` from the `test` script now that real tests exist.

### Changes Required

#### 1. Package manifest tweak

**File**: `packages/dotlightfast/package.json`
**Changes**: `"test": "vitest run --passWithNoTests"` → `"test": "vitest run"`.

#### 2. Test file

**File**: `packages/dotlightfast/src/parse.test.ts` (new)
**Changes**: Inline helpers at the top, then six `describe` blocks. Uses `vi.fn()` to wrap the fetcher when call assertions are needed (no custom `trackedFetcher`).

```ts
import { describe, expect, it, vi } from "vitest";

import { parseDotLightfast } from "./parse";
import {
  DotLightfastParseError,
  type Fetcher,
  type FetcherResult,
} from "./types";

// Inline test helpers — kept here per repo convention (colocated tests, no __tests__/).
const makeFetcher = (
  map: Record<string, FetcherResult>,
): Fetcher => async (path) => map[path] ?? { type: "missing" };

const skillFile = (frontmatter: string, body = ""): FetcherResult => ({
  type: "file",
  content: `---\n${frontmatter}\n---\n${body}`,
});

const dir = (
  entries: { name: string; type: "file" | "dir" }[] = [],
): FetcherResult => ({ type: "dir", entries });

// ...describe blocks below...
```

#### 3. `describe("parseDotLightfast — happy path / shape")` (3 tests)

Shared fixture: SPEC present, two skill dirs (`alpha` with command, `beta` without). Wrap the fetcher in `vi.fn(makeFetcher(...))` so the third test can inspect `.mock.calls`.

- `it("returns { spec, skills[] } with both skills parsed")` — asserts `result.spec === "# Hello"`, `result.skills.length === 2`, names are `"alpha"` and `"beta"`, descriptions roundtrip, `alpha.hasCommand === true`, `beta.hasCommand === false`. Also assert `Object.keys(result).sort()` equals `["skills", "spec"]` to lock the return shape.
- `it("skill path has no .lightfast/ prefix (regression guard)")` — asserts every `skill.path` starts with `"skills/"` and never contains `".lightfast"`. Also asserts the fetcher was called with `"SPEC.md"` and `"skills"` (no `.lightfast/` prefix on either).
- `it("invokes fetcher with the expected paths")` — asserts the set of `fetcher.mock.calls.map(([p]) => p)` equals `new Set(["SPEC.md", "skills", "skills/alpha/SKILL.md", "skills/alpha/command/alpha.md", "skills/beta/SKILL.md", "skills/beta/command/beta.md"])`. Set comparison (not ordered) — order is an implementation detail; the *set* of probed paths is the contract.

#### 4. `describe("parseDotLightfast — missing-config branches")` (2 tests)

- `it("returns { spec: null, skills: [] } when neither SPEC.md nor skills exist")` — empty fetcher map. Locks the consumer-visible "skip triage" signal.
- `it("returns { spec, skills: [] } when SPEC exists but skills dir is missing")` — only `SPEC.md` populated; `skills` resolves to `missing`. Asserts both `spec !== null` and `skills.length === 0`.

(Dropped the third "SPEC missing + skills present" variant — it's covered by happy path.)

#### 5. `describe("parseDotLightfast — SPEC edge cases")` (3 tests)

- `it("throws DotLightfastParseError with path='SPEC.md' when SPEC.md resolves to a directory")` — fetcher returns `{ type: "dir", entries: [] }` at `SPEC.md`. `await expect(parseDotLightfast(...)).rejects.toThrowError(DotLightfastParseError)`, then a second assertion via `rejects.toMatchObject({ path: "SPEC.md" })`.
- `it("truncates SPEC longer than MAX_SPEC_BYTES (32_000) to exactly 32_000 chars")` — string of length `40_000`; expect `result.spec!.length === 32_000` and `result.spec === input.slice(0, 32_000)`.
- `it("does not truncate SPEC at exactly MAX_SPEC_BYTES")` — string of length `32_000`; expect `result.spec === input`. Fencepost guard for `content.length > MAX_SPEC_BYTES`.

#### 6. `describe("parseDotLightfast — skills filtering and caps")` (3 tests)

- `it("silently skips file entries inside the skills directory")` — `skills` dir contains one file (`README.md`) and one valid skill dir (`alpha`); expect `result.skills.length === 1` and `result.skills[0].name === "alpha"`.
- `it("caps at MAX_SKILLS (50) even when more skill dirs are present")` — build 51 dirs `skill-00` … `skill-50` and populate all 51 `SKILL.md` files with valid frontmatter. Expect `result.skills.length === 50` and the last element is `skill-49` (filter-then-slice order). `skill-50` is absent. (51 dirs is the minimum to prove the cap; no need for 60.)
- `it("silently skips skill dirs missing SKILL.md")` — `skills` lists `alpha` and `bravo` as dirs, but only `alpha/SKILL.md` is a file; `bravo/SKILL.md` resolves to `missing`. Expect `result.skills.length === 1`, no throw.

#### 7. `describe("parseDotLightfast — frontmatter resilience")` (5 tests)

All five share a shape: one skill dir `broken`, `SKILL.md` content varies per test, no `SPEC.md`. First four expect `result.skills === []`. Fifth parses successfully.

- `it("skips skill with no frontmatter block")` — content is plain markdown, no `---` fences.
- `it("skips skill with malformed YAML inside frontmatter")` — frontmatter body is `name: broken\n  : : :` (unparseable).
- `it("skips skill whose frontmatter parses to a YAML array")` — content is `---\n- one\n- two\n---\n`; rejected by the `Array.isArray` guard.
- `it("skips skill whose frontmatter fails SkillFrontmatterSchema")` — frontmatter is `name: Broken Name` (uppercase + space fails the kebab-case regex).
- `it("parses frontmatter with CRLF line endings")` — file content begins with `---\r\n` (no leading newline) and uses `\r\n` between every line, including the closing `---\r\n`. Expect `result.skills.length === 1`, correct name/description. Locks the `\r?\n` in `FRONTMATTER_RE`.

#### 8. `describe("parseDotLightfast — command probe branching")` (2 tests)

Use `it.each` to compress what was three nearly identical tests:

- `it.each` over three rows `[label, commandResult, expectedHasCommand]`:
  - `["file", { type: "file", content: "" }, true]`
  - `["dir", { type: "dir", entries: [] }, false]`
  - `["missing", { type: "missing" }, false]`
  
  Each row builds the same fixture (one skill dir `alpha`, valid frontmatter) with the command path resolving per the row. Asserts `result.skills[0].hasCommand === expectedHasCommand`. Confirms `hasCommand` is strictly `=== "file"`.

- `it("probes skills/<dirName>/command/<frontmatter.name>.md when dirName differs from name")` — **new test for the dirName ≠ parsed.data.name divergence at parse.ts:77-79**. Skill dir is `alpha-v2`, frontmatter is `name: alpha`. Wrap fetcher in `vi.fn`. Place the command file at `skills/alpha-v2/command/alpha.md`. Assert `result.skills[0].hasCommand === true` and that `fetcher` was called with exactly that path (NOT `skills/alpha/command/alpha.md` and NOT `skills/alpha-v2/command/alpha-v2.md`). Locks the most surprising branch in the file.

(Dropped the standalone "fetcher contract" describe — propagating thrown errors is base `await` semantics, not parser behavior.)

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/dotlightfast test` — ~16 tests, all green. (Actual: 20 tests, the `it.each` row expands to 3.)
- [x] `pnpm --filter @repo/dotlightfast typecheck` — green (test file compiles under `tsc --noEmit`).
- [x] Root-level `pnpm test` (turbo) still green — `@repo/dotlightfast` is now part of the graph. (Verified via `pnpm --filter @repo/dotlightfast... test`.)

#### Manual Verification

- [x] Skim the test file: six `describe` blocks, 18 `it`/`it.each` blocks (20 reported tests after the 3-row `it.each` expands).
- [x] Branch-coverage walkthrough during review: every branch in `parse.ts` is hit (SPEC file/missing/dir, skills dir/missing, SKILL.md file/missing, frontmatter present/absent, YAML pass/fail, Array.isArray guard, schema pass/fail, command file/dir/missing, dirName ≠ name divergence, CRLF FRONTMATTER_RE).
- [x] Deliberately broke three branches in `parse.ts` and confirmed targeted failures, then reverted: (1) dropped `.slice(0, MAX_SPEC_BYTES)` → truncate test failed; (2) prepended `.lightfast/` to `skills` probe → 11 tests failed; (3) swapped `parsed.data.name` for `dirName` in command probe → divergence test failed. All three reverted, suite back to 20/20 green.

**Implementation Note**: After Phase 2 passes, this is a clean commit — `feat(dotlightfast): add unit tests for parseDotLightfast` or similar.

---

## Testing Strategy

### Unit Tests

Everything above; see Phase 2.

### Integration Tests

Out of scope — the triage Inngest consumer is covered separately.

### Manual Testing Steps

1. `pnpm --filter @repo/dotlightfast test` — expect "~16 passed".
2. Temporarily prepend `.lightfast/` to the `skillPath` and `skillsRoot` strings inside `parse.ts` — expect the "no `.lightfast/` prefix" and "invokes fetcher with the expected paths" tests to fail loudly. Revert.
3. Temporarily change `content.length > MAX_SPEC_BYTES` to `>=` — expect the "exactly at limit → not truncated" test to fail. Revert.
4. Temporarily swap `parsed.data.name` for `dirName` in the command-probe path — expect the divergence test to fail. Revert.

## Performance Considerations

None. The suite is purely in-memory; runtime will be sub-second. The shared vitest config already caps workers per instance to 2 threads, so parallel turbo runs stay polite.

## Migration Notes

None. Purely additive.

## References

- Predecessor plan: `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` — defers unit tests.
- Predecessor plan: `thoughts/shared/plans/2026-04-18-dotlightfast-path-prefix-fix.md` — flags unit tests as the follow-up and defines the path-prefix contract these tests lock in.
- Source under test: `packages/dotlightfast/src/parse.ts`.
- Consumer (for context only, not under test): `api/platform/src/inngest/functions/platform-agent-triage.ts:25`.
- Canonical reference vitest wiring: `packages/lib/vitest.config.ts`, `packages/lib/package.json`, `internal/vitest-config/vitest.shared.ts`.
- Reference test style: `packages/lib/src/encryption.test.ts`.

## Improvement Log

### 2026-04-18 — Adversarial review (`/improve_plan`)

Findings raised:

1. **Helper placement broke convention.** Plan put helpers under `src/__tests__/make-fetcher.ts`, but every test in the workspace is colocated in `src/` with no `__tests__/` subdirs. **Fix applied:** dropped the helper file; the ~10-line helper is inlined at the top of `parse.test.ts`. Removed Phase 1 step 3 entirely.
2. **Phase 1 success criterion was speculative.** Plan hedged on whether vitest 4 exits 0 with no test files. **Fix applied:** Phase 1's `test` script is now `vitest run --passWithNoTests`; Phase 2 drops the flag. Phases stay split per user decision.
3. **Missing test for `dirName ≠ parsed.data.name` divergence** at `parse.ts:77-79` — the command probe uses `dirName` for the directory and `parsed.data.name` for the filename, and these can differ. The original plan deliberately aligned them. **Fix applied:** added a dedicated test in the command-probe describe block (skill dir `alpha-v2`, frontmatter `name: alpha`, asserts probe is `skills/alpha-v2/command/alpha.md`).
4. **`packages/lib` is a closer reference than `packages/app-providers`.** Both have the same wiring, but `lib` is pure-TS with no provider concerns. **Fix applied:** all references updated.
5. **`trackedFetcher` was over-engineered.** Custom helper to assert call order, when `vi.fn()` wrapping `makeFetcher` is the stdlib idiom. **Fix applied:** dropped `trackedFetcher`; tests that need call assertions wrap `makeFetcher(...)` in `vi.fn(...)` and inspect `.mock.calls`. Call assertion uses set comparison, not order.
6. **Coverage tooling promised without machinery.** Plan referenced `--coverage` but never added `@vitest/coverage-v8`. **Fix applied (per user decision):** dropped coverage from success criteria entirely; branch coverage is verified by manual code-walk during review.
7. **Suite size compressed from 22 → ~16 tests.** Three command-probe `it`s collapse into one `it.each` with three rows. Two overlapping "missing config" variants collapse to one. The "fetcher contract / propagates errors" test was removed (it tests `await` semantics, not parser behavior). MAX_SKILLS fixture reduced from 60 dirs to 51 (minimum to prove the cap).
8. **CRLF fixture phrasing was ambiguous.** `FRONTMATTER_RE` is anchored at start; the fixture must begin with `---\r\n`, not a leading newline. **Fix applied:** wording made explicit.
9. **No spike run** — all findings were either repo-convention checks (verified directly) or user-decision items. No hypothesis warranted isolated validation.
