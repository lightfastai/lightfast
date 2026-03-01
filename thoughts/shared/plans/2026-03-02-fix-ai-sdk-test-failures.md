# Fix @lightfastai/ai-sdk Test Failures — NoMessagesError Validation

## Overview

Fix 2 failing tests in `core/ai-sdk/src/core/primitives/agent.buildStreamParams.test.ts` caused by a validation gap in `Agent.buildStreamParams()` that fails to catch `null`/`undefined` messages.

## Current State Analysis

The validation at `core/ai-sdk/src/core/primitives/agent.ts:169` uses optional chaining:

```ts
if (messages?.length === 0) {
    throw new NoMessagesError();
}
```

When `messages` is `null` or `undefined`, `messages?.length` evaluates to `undefined` — not `0` — so the guard is skipped. The null/undefined messages then reach `convertToModelMessages()` (line 270), which throws a `TypeError` that gets caught and re-thrown as `MessageConversionError`.

The tests correctly expect `NoMessagesError` for null/undefined input. The source code has the bug.

## Desired End State

- All 149 tests pass (0 failures)
- `buildStreamParams()` throws `NoMessagesError` for empty, null, and undefined messages

## What We're NOT Doing

- No changes to `NoMessagesError` or any error class
- No changes to any test files — the tests are correct
- No refactoring of surrounding code

## Implementation Approach

Single-line fix to the validation guard.

## Phase 1: Fix Messages Validation

### Changes Required:

**File**: `core/ai-sdk/src/core/primitives/agent.ts`
**Line**: 169
**Change**: Replace optional chaining check with a falsy-or-empty check

```ts
// Before:
if (messages?.length === 0) {

// After:
if (!messages || messages.length === 0) {
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `cd core/ai-sdk && pnpm test` (149/149 passing, 0 failures)
- [x] Type checking passes: `pnpm --filter @lightfastai/ai-sdk typecheck`

#### Manual Verification:
- None needed — this is a pure validation fix fully covered by existing tests.

## References

- Failing tests: `core/ai-sdk/src/core/primitives/agent.buildStreamParams.test.ts:478-508`
- Source bug: `core/ai-sdk/src/core/primitives/agent.ts:169`
