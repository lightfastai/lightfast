# Fix `pnpm check` Failures Implementation Plan

## Overview

`pnpm check` (runs `npx ultracite@latest check`, a Biome wrapper) reports **96 errors + 1 warning across 23 files** on `main`. The vast majority are auto-fixable formatter/style diagnostics; a small tail (~6 errors) needs manual judgment — most caused by commit `e11213c6e` which commented out three landing-page sections, orphaning imports and vars.

## Current State Analysis

- `pnpm check` → `ultracite check` (biome) — exit 1, 96 errors, 77 diagnostics truncated in default output.
- `pnpm fix` → `ultracite fix` — already wired in `package.json`, applies every "Safe fix" diagnostic in place.
- No TypeScript or test failures are in scope — `pnpm typecheck` and tests are separate pipelines (per `CLAUDE.md`).
- Error distribution (verified via `--max-diagnostics=300`):

| Rule | Count | Auto-fixable |
|---|---|---|
| `lint/style/useBlockStatements` | 29 | ✅ |
| `assist/source/organizeImports` | 11 | ✅ |
| `lint/nursery/useSortedClasses` | 8 | ✅ |
| `lint/correctness/noUnusedVariables` | 7 | 5 ✅ / 2 ⚠️ |
| `assist/source/useSortedInterfaceMembers` | 5 | ✅ |
| `lint/style/useNumericSeparators` | 3 | ✅ |
| `lint/style/noInferrableTypes` | 3 | ✅ |
| `lint/style/useForOf` | 2 | ⚠️ manual |
| `lint/correctness/noUnusedImports` | 2 | ✅ |
| `lint/style/useTemplate`, `useNumberNamespace`, `useParseIntRadix` | 3 | ✅ |
| `lint/suspicious/noMisplacedAssertion` | 1 | ⚠️ manual |
| `suppressions/unused` | 1 | ⚠️ manual |
| Formatter (whitespace/trailing commas) | ~20 files | ✅ |

## Desired End State

`pnpm check` exits 0 with no errors and no warnings. Every diagnostic above is resolved — either auto-applied by `pnpm fix` or handled by the targeted manual edits in Phase 2. Verified by: `pnpm check` returns clean.

### Key Discoveries

- `package.json:9` — `"check": "npx ultracite@latest check"`, `"fix": "npx ultracite@latest fix"`. One command fixes most issues.
- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:23,110` — `FlowField` import and `{ hash, url }` destructure both orphaned by commit `e11213c6e` (manifesto/self-driving/full-understanding sections commented out).
- `apps/www/src/app/(app)/(marketing)/(landing)/_components/isometric-hero.tsx:21-22` — `vw`/`vh` computed but unused (likely intended for a viewBox that was never wired).
- `packages/app-remotion/src/compositions/changelog-v010-events/changelog-v010-events.tsx:7-8` — `CANVAS_W`/`CANVAS_H` constants unused (composition size lives elsewhere in Remotion Root).
- `apps/www/src/lib/content-schemas.ts:89` — `IntegrationStatusSchema` declared and unused.
- `apps/www/src/lib/builders/blog.ts:70` — `// biome-ignore lint/style/noNonNullAssertion` comment no longer needed (rule no longer fires at `howToSteps!`).
- `packages/dotlightfast/src/parse.test.ts:202` — `expect(result.skills).toEqual([])` inside helper `expectSkipped` defined at `describe` level, not inside an `it()`. Legitimate helper pattern — suppress with a targeted `biome-ignore`.
- `packages/webhook-schemas/src/report.ts:40` and `packages/webhook-schemas/src/validate.ts:41` — index-only `for` loops where `i` is used solely to index `obj[i]`; safe mechanical conversion to `for (const item of obj)`.

## What We're NOT Doing

- Not disabling any Biome rules in `biome.json`/`.biomerc` (including the nursery `useSortedClasses` — eight real hits, just fix them).
- Not touching `pnpm typecheck`, tests, or build — out of scope.
- Not restoring the commented landing sections. They stay hidden; we only clean up orphaned code they leave behind.
- Not upgrading `ultracite`/Biome — we fix against the pinned version.
- Not introducing new `biome-ignore` comments except for the one genuinely overreaching rule (`noMisplacedAssertion`).
- Not touching the `thoughts/` directory (agent-authored research/plan files should not be linted by ultracite — and aren't, confirmed by diagnostic list).

## Implementation Approach

Two phases:
1. Run `pnpm fix` to clear everything marked **Safe fix** (~90 of 96 errors). Verify, then commit.
2. Manually edit the ~6 remaining diagnostics with targeted changes listed below. Verify, then commit.

Keeping the phases separate keeps the auto-fix diff reviewable in isolation from semantic edits.

---

## Phase 1: Apply `pnpm fix`

### Overview

Single-command pass that resolves every **Safe fix** diagnostic: block statements, import ordering, Tailwind class sorting, inferrable types, numeric separators, sorted interface members, and all formatter whitespace/trailing-comma issues. Also auto-removes trivially-unused imports (`noUnusedImports`) and simple unused-variable cases where deletion is safe.

### Changes Required

#### 1. Run the fixer

```bash
pnpm fix
```

Expected side effects (approximate, to spot-check in the diff):
- Imports reordered in `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`, `packages/webhook-schemas/src/validate.ts`, `vendor/clerk/src/server.ts`, etc.
- `if (x) return y;` → `if (x) { return y; }` across `packages/webhook-schemas/src/report.ts` and `validate.ts`.
- Tailwind class reordering in landing page and `faq-section.tsx`.
- Interface members alphabetized in `packages/dotlightfast/src/types.ts`, `validate.ts`, `changelog-v010-events.tsx`, `app-embed/src/utils.ts`.
- Trailing commas / line-wrap normalization across ~20 files including `packages/webhook-schemas/fixtures/**.json`.
- Simple `noInferrableTypes`, `useNumericSeparators`, `useTemplate`, `useNumberNamespace`, `useParseIntRadix` fixes.

### Success Criteria

#### Automated Verification

- [x] `pnpm check 2>&1 | grep -E "Found [0-9]+ error" | tail -1` reports ≤ 10 errors remaining (the manual tail). _Note: 31 errors remained after Phase 1; plan underestimated because codebase accumulated more diagnostics (mostly `noSubstr`) since plan was written. See Phase 2 for full list._
- [ ] `pnpm typecheck` still passes (sanity check — class/import reordering should not break types).
- [ ] `git diff --stat` shows only the files listed under "Expected side effects" (no accidental scope creep).

#### Manual Verification

- [ ] Spot-check 2–3 reordered-import files compile and behave unchanged.
- [ ] Confirm no JSON fixture payloads were semantically altered (the formatter should only touch whitespace in `packages/webhook-schemas/fixtures/**.json`).
- [ ] Confirm `apps/www` dev server still renders the landing page — run `pnpm dev:www` and hit `http://localhost:4101`.

**Implementation Note**: Pause after Phase 1 for a commit (`fix(chore): apply ultracite safe fixes`) before starting Phase 2. Keeps the mechanical vs. semantic diffs separate and easy to review.

---

## Phase 2: Manual edits for remaining diagnostics

### Overview

Six diagnostics `pnpm fix` cannot handle safely. Each has a specific, small edit.

### Changes Required

#### 1. Landing page — drop orphaned import and destructure

**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

**Changes**: Remove the `FlowField` import (line ~23 after Phase 1 reorders) and drop the unused destructure on line 110. `getLatestCommit()` can still be called for its side-effect-free behavior, but nothing reads its return value, so drop the whole `await` expression too.

Before:
```tsx
import { FlowField } from "./_components/flow-field";
// ...
export default async function HomePage() {
  const { hash, url } = await getLatestCommit();
  // Build organization entity
  const organizationEntity: Organization = { /* ... */ };
```

After:
```tsx
// (FlowField import line removed)
// ...
export default async function HomePage() {
  // Build organization entity
  const organizationEntity: Organization = { /* ... */ };
```

Also: if `getLatestCommit` becomes unused project-wide after this edit, remove the function definition itself (lines ~90-107 in current file) and its imports. Confirm with `grep -rn "getLatestCommit" apps/www/src` before deleting.

#### 2. Isometric hero — drop unused `vw`/`vh`

**File**: `apps/www/src/app/(app)/(marketing)/(landing)/_components/isometric-hero.tsx`

**Changes**: Delete lines 21-22 (`vw`, `vh`). `vx`/`vy` stay (still referenced).

```tsx
// Remove:
const vw = bounds.maxX - bounds.minX + PAD * 2;
const vh = bounds.maxY - bounds.minY + PAD * 2;
```

If `PAD` was only used by the removed lines, verify via `grep -n "PAD" isometric-hero.tsx` and drop it too.

#### 3. Remotion changelog composition — drop unused canvas constants

**File**: `packages/app-remotion/src/compositions/changelog-v010-events/changelog-v010-events.tsx`

**Changes**: Delete lines 7-8 (`CANVAS_W`, `CANVAS_H`). Before deleting, `grep -n "CANVAS_[WH]" packages/app-remotion/src` to confirm no sibling files consume them via barrel export.

#### 4. Integration schema — drop unused schema

**File**: `apps/www/src/lib/content-schemas.ts`

**Changes**: Delete the `IntegrationStatusSchema` declaration on line ~89. Confirm no external importer first: `grep -rn "IntegrationStatusSchema" apps packages`.

#### 5. Blog builder — remove stale suppression

**File**: `apps/www/src/lib/builders/blog.ts:70`

**Changes**: Delete the single line:
```ts
// biome-ignore lint/style/noNonNullAssertion: caller guards on howToSteps presence
```
Biome reports the comment has no effect — the rule no longer fires on the line below.

#### 6. dotlightfast tests — suppress over-strict `noMisplacedAssertion`

**File**: `packages/dotlightfast/src/parse.test.ts:202`

**Changes**: The `expectSkipped` helper is a legitimate test utility called from inside every `it()` in the `describe` block. Add a targeted suppression directly above line 202:

```ts
// biome-ignore lint/suspicious/noMisplacedAssertion: expectSkipped is a test helper invoked from each it()
expect(result.skills).toEqual([]);
```

#### 7. `webhook-schemas` — convert two index loops to `for-of`

**File**: `packages/webhook-schemas/src/report.ts:40` and `packages/webhook-schemas/src/validate.ts:41`

Both files have the identical pattern in `deepKeys()`:

Before:
```ts
for (let i = 0; i < obj.length; i++) {
  const item = obj[i];
  if (item !== null && typeof item === "object") {
    // ...
  }
}
```

After:
```ts
for (const item of obj) {
  if (item !== null && typeof item === "object") {
    // ...
  }
}
```

`i` is unused aside from indexing, so the conversion is mechanical and semantics-preserving.

### Success Criteria

#### Automated Verification

- [x] `pnpm check` exits 0, reports `Found 0 errors`.
- [ ] `pnpm typecheck` still passes. _Not run in worktree (no node_modules); edits are mechanical/semantics-preserving._
- [ ] `pnpm --filter @repo/webhook-schemas test` — `deepKeys` still behaves on arrays after the `for-of` conversion. _Not run in worktree; `for-of` over array is semantics-preserving._
- [ ] `pnpm --filter @lightfast/dotlightfast test` — `parse.test.ts` passes with the new suppression comment. _Not run in worktree; only added a biome-ignore comment, no code change._

#### Manual Verification

- [ ] Landing page renders identically at `http://localhost:4101` (run `pnpm dev:www`).
- [ ] Remotion compositions still render — `pnpm --filter @repo/app-remotion dev` if a preview exists; otherwise eyeball the Root config to confirm `CANVAS_W/H` were only module-local.
- [ ] `git grep` confirms none of the deleted identifiers (`FlowField`, `IntegrationStatusSchema`, `CANVAS_W`, `CANVAS_H`, `vw`, `vh`, `getLatestCommit`) are referenced elsewhere after the edits.

**Implementation Note**: Commit Phase 2 separately (`chore: resolve remaining ultracite diagnostics`). Final `pnpm check` run should be green.

---

## Testing Strategy

### Automated Checks

- `pnpm check` — primary acceptance signal.
- `pnpm typecheck` — guard against ordering/removal breaking types.
- Package-scoped tests for `webhook-schemas` and `dotlightfast` — the only areas where semantic edits land.

### Manual Testing Steps

1. Start `pnpm dev:www`; visit `/` and verify the visible sections (hero, FAQ, latest content preview) still render correctly.
2. Inspect the `git diff` for Phase 1 — confirm it is purely whitespace / reordering / brace-wrapping with no logic changes.
3. Inspect the `git diff` for Phase 2 — confirm each deletion maps 1:1 to the list above and no unrelated code was touched.

## Performance Considerations

None. Every change is syntactic cleanup or removal of dead code. The two `for-of` conversions are hot-path-neutral (index loop vs. iterator on a small array, schema-capture time only).

## Migration Notes

None — no runtime, schema, or API surface changes.

## References

- Root command: `package.json` → `"check": "npx ultracite@latest check"`, `"fix": "npx ultracite@latest fix"`
- Root-cause commit for orphaned imports: `e11213c6e chore(www): hide unfinished landing sections`
- Ultracite / Biome diagnostic docs: the error output itself links to each rule's page (e.g. `biomejs.dev/linter/#nursery`)
