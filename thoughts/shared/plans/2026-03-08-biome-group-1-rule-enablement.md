# Biome Group 1 Rule Enablement — Implementation Plan

## Overview

Enable 14 Biome rules that are currently disabled in `biome.jsonc`, all having ≤3 violations each. This is the first step in progressively tightening Biome linting across the monorepo. Total work: ~19 violations across 16 files, requiring 2 auto-fixes, 6 code changes, 10 biome-ignore suppressions, and 1 file rename.

## Current State Analysis

The `biome.jsonc` has 46 rules set to `"off"`. This plan targets the 14 easiest rules (Group 1 from the research doc). Three of these rules already have **0 violations** and can be enabled for free.

### Key Discoveries:
- 3 rules have 0 violations: `useAriaPropsForRole`, `useFocusableInteractive`, `noNestedComponentDefinitions`
- `useCollapsedIf` has 2 violations that are auto-fixable via `biome check --apply`
- Most violations in `packages/tech-stack-detector/` (4 violations across 3 rules)
- Several violations are legitimate usage requiring `biome-ignore` (e.g., intentional control char regex, `eval` inside Playwright `page.evaluate`, satori namespace declaration)

## Desired End State

After this plan is complete:
- 14 rules removed from the `"off"` list in `biome.jsonc` (32 rules remaining)
- `pnpm check` passes with 0 violations for these rules
- All suppressions use `biome-ignore` with explanatory comments
- No behavioral changes to application code

### Verification:
```bash
pnpm check       # 0 lint errors
pnpm typecheck   # no type regressions
```

## What We're NOT Doing

- Enabling rules with >3 violations (Groups 2–4)
- Refactoring code beyond the minimum needed to satisfy each rule
- Changing any application behavior or UI
- Adding tests for the lint fixes

## Implementation Approach

Single PR, executed in 4 sequential phases: config change → auto-fix → manual fixes → verify.

---

## Phase 1: Enable Rules in biome.jsonc

### Overview
Remove the 14 Group 1 rules from the disabled list, then auto-fix what biome can handle.

### Changes Required:

#### 1. Update `biome.jsonc`
**File**: `biome.jsonc`
**Changes**: Remove these 14 rules from their `"off"` entries:

**a11y** — remove: `noNoninteractiveElementInteractions`, `useAriaPropsForRole`, `useFocusableInteractive`
**correctness** — remove: `noNestedComponentDefinitions`
**performance** — remove: `noAccumulatingSpread`, `noImgElement`
**security** — remove: `noGlobalEval`
**style** — remove: `noNamespace`, `noParameterAssign`, `useCollapsedIf`, `useFilenamingConvention`, `useForOf`
**suspicious** — remove: `noControlCharactersInRegex`, `noDocumentCookie`

The resulting `biome.jsonc` should have these remaining `"off"` rules:

```jsonc
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["ultracite/core", "ultracite/react", "ultracite/next"],
  "files": {
    "includes": ["**/*", "!.claude", "!apps/www/src/lib/generated"]
  },
  "linter": {
    "rules": {
      "a11y": {
        "noSvgWithoutTitle": "off",
        "useButtonType": "off",
        "useSemanticElements": "off"
      },
      "complexity": {
        "noBannedTypes": "off",
        "noExcessiveCognitiveComplexity": "off",
        "noForEach": "off",
        "noVoid": "off"
      },
      "performance": {
        "noBarrelFile": "off",
        "noNamespaceImport": "off",
        "useTopLevelRegex": "off"
      },
      "security": {
        "noDangerouslySetInnerHtml": "off"
      },
      "style": {
        "noEnum": "off",
        "noExportedImports": "off",
        "noNestedTernary": "off",
        "noNonNullAssertion": "off",
        "noParameterProperties": "off",
        "useConsistentMemberAccessibility": "off",
        "useDefaultSwitchClause": "off"
      },
      "suspicious": {
        "noAlert": "off",
        "noArrayIndexKey": "off",
        "noAssignInExpressions": "off",
        "noBitwiseOperators": "off",
        "noEmptyBlockStatements": "off",
        "noEvolvingTypes": "off",
        "noExplicitAny": "off",
        "noImplicitAnyLet": "off",
        "useAwait": "off",
        "useIterableCallbackReturn": "off"
      }
    }
  }
}
```

#### 2. Auto-fix `useCollapsedIf`
Run: `pnpm exec biome check --apply`

This auto-fixes 2 violations:
- `apps/auth/src/app/lib/clerk/error-handling.ts:86`
- `apps/console/src/app/lib/clerk/error-handling.ts:96`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm exec biome check --apply` completes without errors
- [x] Only `useCollapsedIf` violations are auto-fixed (verify with `git diff`)

**Implementation Note**: After running the auto-fix, verify the diff only touches the two expected files before proceeding.

---

## Phase 2: Add biome-ignore Suppressions (Legitimate Exceptions)

### Overview
10 violations are legitimate usage that should be suppressed with `biome-ignore` comments. Each suppression includes an explanation.

### Changes Required:

#### 1. noControlCharactersInRegex — intentional control character matching
**File**: `apps/backfill/src/workflows/backfill-orchestrator.ts:163`
**Violations**: 2 (same line)
**Reason**: The regex `/[\x00-\x1f]/g` intentionally matches control characters to escape them in CEL expressions.

```typescript
        // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters to escape them
        .replace(/[\x00-\x1f]/g, (ch) => {
```

#### 2. noImgElement — test mock + UI package without Next.js
**File**: `apps/console/src/__tests__/__mocks__/next-image.tsx:7`
**Reason**: Test mock that intentionally renders a plain `<img>` to stub next/image.

```tsx
  // biome-ignore lint/a11y/useAltText: test mock passes props through
  // biome-ignore lint/correctness/useImageSize: test mock passes props through
  // biome-ignore lint/performance/noImgElement: test mock intentionally renders plain <img>
  return <img {...props} />;
```

**File**: `packages/ui/src/components/ai-elements/prompt-input.tsx:138`
**Reason**: UI package uses plain `<img>` because it's framework-agnostic (no next/image dependency).

```tsx
          {/* biome-ignore lint/performance/noImgElement: UI package is framework-agnostic, no next/image */}
          <img
```

#### 3. noDocumentCookie — standard browser API in client component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx:58`

```typescript
    // biome-ignore lint/suspicious/noDocumentCookie: client-side cookie for pitch deck preference persistence
    document.cookie = `${PREFACE_COOKIE_NAME}=${expanded}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}`;
```

**File**: same file `:65`

```typescript
      // biome-ignore lint/suspicious/noDocumentCookie: client-side cookie for pitch deck preference persistence
      document.cookie = `${PREFACE_COOKIE_NAME}=${next}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}`;
```

#### 4. noGlobalEval — inside Playwright page.evaluate
**File**: `packages/tech-stack-detector/src/tiers/tier3.ts:85`
**Reason**: eval() runs inside browser sandbox via Playwright's page.evaluate to detect global variables.

```typescript
          return typeof eval(name) !== "undefined";
```

Change the outer `page.evaluate` call to suppress at the function level:

```typescript
    // biome-ignore lint/security/noGlobalEval: eval runs inside Playwright browser sandbox to detect globals
    const globalResults = await page.evaluate((names: string[]) => {
```

#### 5. noNamespace — satori type declaration
**File**: `packages/og/src/satori.d.ts:1`
**Reason**: Augmenting React's namespace for satori's `tw` prop requires `declare namespace`.

```typescript
// biome-ignore lint/style/noNamespace: required for satori React HTMLAttributes augmentation
declare namespace React {
```

#### 6. useForOf — CLI arg parsers with index mutation
**File**: `packages/console-test-data/src/cli/reset-demo.ts:173`
**Reason**: The `for` loop uses `args[++i]` to advance past flag values, which requires index access.

```typescript
  // biome-ignore lint/style/useForOf: requires index mutation (args[++i]) for flag parsing
  for (let i = 0; i < args.length; i++) {
```

**File**: `packages/console-test-data/src/cli/seed-integrations.ts:167`
**Same pattern**: same reason.

```typescript
  // biome-ignore lint/style/useForOf: requires index mutation (args[++i]) for flag parsing
  for (let i = 0; i < args.length; i++) {
```

#### 7. noNoninteractiveElementInteractions — event handlers on non-interactive elements
**File**: `apps/console/src/components/workspace-search.tsx:204`
**Reason**: `<div role="search">` with `onKeyDown` — the search landmark captures keyboard events for the search form.

```tsx
    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: search landmark captures keyboard events */}
    <div
      className="flex h-full flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      role="search"
    >
```

**File**: `packages/ui/src/components/ai-elements/inline-citation.tsx:86`
**Reason**: `<img>` with `onError` — this is a load error handler, not a user interaction.

```tsx
                // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is a load handler, not user interaction
                // biome-ignore lint/correctness/useImageSize: favicon thumbnails with fixed CSS dimensions
                <img
```

Wait — re-examining: the violation at `inline-citation.tsx:86:17` is on the `<img>` element. But `<img>` with `onError` shouldn't trigger `noNoninteractiveElementInteractions` since onError isn't interactive... Let me re-check whether this is actually the `<img>` or if there's a parent element. The column 17 maps to `<img` on line 86. The `onError` handler is indeed not a user interaction, so biome-ignore is appropriate.

### Success Criteria:

#### Automated Verification:
- [x] All biome-ignore comments are syntactically correct
- [x] `pnpm check` shows reduced violation count (but may still fail until Phase 3 is done)

---

## Phase 3: Code Fixes (6 Changes)

### Overview
Fix 6 violations that can be properly resolved with small code changes.

### Changes Required:

#### 1. noParameterAssign — 3 violations in tech-stack-detector

**File**: `packages/tech-stack-detector/src/deep-detect.ts:107`
```typescript
// Before:
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

// After:
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
```
Then replace all subsequent uses of `url` with `normalizedUrl` in the same function scope.

**File**: `packages/tech-stack-detector/src/pipeline.ts:24`
```typescript
// Before:
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

// After:
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
```
Then replace all subsequent uses of `url` with `normalizedUrl` in the same function scope.

**File**: `packages/tech-stack-detector/src/discovery/sources/common-prefixes.ts:30`
```typescript
// Before:
  rootDomain = rootDomain.toLowerCase();

// After:
  const normalizedDomain = rootDomain.toLowerCase();
```
Then replace all subsequent uses of `rootDomain` with `normalizedDomain` in the same function scope.

#### 2. noAccumulatingSpread — 1 violation in ai-sdk

**File**: `core/ai-sdk/src/core/primitives/cache/strategy/cline-conversation.ts:45`
```typescript
// Before:
    const userMessageIndices = messages.reduce(
      (acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
      [] as number[]
    );

// After:
    const userMessageIndices: number[] = [];
    for (const [index, msg] of messages.entries()) {
      if (msg.role === "user") {
        userMessageIndices.push(index);
      }
    }
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes with 0 violations for Group 1 rules (but may still fail until Phase 4)
- [x] `pnpm typecheck` passes — no type regressions from variable renames

---

## Phase 4: File Rename

### Overview
Fix 2 `useFilenamingConvention` violations: one file rename, one biome-ignore.

### Changes Required:

#### 1. Rename test file to kebab-case
**Current**: `core/ai-sdk/src/core/primitives/agent.buildStreamParams.test.ts`
**New**: `core/ai-sdk/src/core/primitives/agent-build-stream-params.test.ts`

```bash
git mv core/ai-sdk/src/core/primitives/agent.buildStreamParams.test.ts \
       core/ai-sdk/src/core/primitives/agent-build-stream-params.test.ts
```

No import changes needed — test files aren't imported by other modules.

#### 2. Suppress for Remotion entry point
**File**: `packages/console-remotion/src/Root.tsx`
**Reason**: Remotion requires the entry component to be named `Root.tsx` (PascalCase).

Add at the top of the file:
```tsx
// biome-ignore lint/style/useFilenamingConvention: Remotion requires PascalCase entry point
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes with 0 new violations
- [x] `pnpm typecheck` passes
- [x] Renamed test file is picked up by vitest: `pnpm --filter @lightfastai/ai-sdk test`

---

## Final Verification

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes cleanly (0 violations from the 14 newly-enabled rules)
- [x] `pnpm typecheck` passes (no regressions)
- [x] `pnpm --filter @lightfastai/ai-sdk test` passes (renamed test file runs)
- [x] `pnpm --filter @repo/tech-stack-detector typecheck` passes (variable renames are correct)

#### Manual Verification:
- [ ] `git diff biome.jsonc` shows exactly 14 rules removed from `"off"` lists
- [ ] All `biome-ignore` comments have explanatory text

**Implementation Note**: After all automated verification passes, this is ready for PR review. No manual runtime testing needed — these are lint-only changes with no behavioral impact.

---

## Summary of Changes by File

| File | Rule | Fix Type |
|---|---|---|
| `biome.jsonc` | — | Remove 14 `"off"` entries |
| `apps/auth/src/app/lib/clerk/error-handling.ts` | `useCollapsedIf` | Auto-fix |
| `apps/console/src/app/lib/clerk/error-handling.ts` | `useCollapsedIf` | Auto-fix |
| `apps/backfill/src/workflows/backfill-orchestrator.ts` | `noControlCharactersInRegex` | biome-ignore |
| `apps/console/src/__tests__/__mocks__/next-image.tsx` | `noImgElement` | biome-ignore |
| `packages/ui/src/components/ai-elements/prompt-input.tsx` | `noImgElement` | biome-ignore |
| `apps/www/.../pitch-deck-context.tsx` | `noDocumentCookie` | biome-ignore (×2) |
| `packages/tech-stack-detector/src/tiers/tier3.ts` | `noGlobalEval` | biome-ignore |
| `packages/og/src/satori.d.ts` | `noNamespace` | biome-ignore |
| `packages/console-test-data/src/cli/reset-demo.ts` | `useForOf` | biome-ignore |
| `packages/console-test-data/src/cli/seed-integrations.ts` | `useForOf` | biome-ignore |
| `apps/console/src/components/workspace-search.tsx` | `noNoninteractiveElementInteractions` | biome-ignore |
| `packages/ui/src/components/ai-elements/inline-citation.tsx` | `noNoninteractiveElementInteractions` | biome-ignore |
| `packages/tech-stack-detector/src/deep-detect.ts` | `noParameterAssign` | Code fix |
| `packages/tech-stack-detector/src/pipeline.ts` | `noParameterAssign` | Code fix |
| `packages/tech-stack-detector/src/discovery/sources/common-prefixes.ts` | `noParameterAssign` | Code fix |
| `core/ai-sdk/src/core/primitives/cache/strategy/cline-conversation.ts` | `noAccumulatingSpread` | Code fix |
| `core/ai-sdk/src/core/primitives/agent.buildStreamParams.test.ts` | `useFilenamingConvention` | Rename |
| `packages/console-remotion/src/Root.tsx` | `useFilenamingConvention` | biome-ignore |

**Totals**: 2 auto-fixes, 4 code changes, 12 biome-ignore suppressions, 1 file rename = 19 violations resolved.

## References

- Research: `thoughts/shared/research/2026-03-08-biome-rule-elimination-groups.md`
- Config: `biome.jsonc`
