# Fix Workspace Unique Constraint Detection

## Overview

Update the catch block in `db/console/src/utils/workspace.ts` (lines 102–111) to detect unique constraint violations using the canonical PostgreSQL error code (`23505`) exposed by `NeonDbError.code`, instead of relying solely on fragile substring matching against `error.message`.

## Current State Analysis

The `createCustomWorkspace` function uses an optimistic insert and catches duplicate-name violations via:

```ts
// db/console/src/utils/workspace.ts:102-111
catch (error) {
  if (
    error instanceof Error &&
    (error.message.includes("unique constraint") ||
      error.message.includes("duplicate key"))
  ) {
    throw new Error(`Workspace with name "${name}" already exists`);
  }
  throw error;
}
```

This works but is fragile — if the Neon driver or PostgreSQL changes error message wording, the check silently breaks and the raw database error leaks to the user.

### Key Discoveries

- **Driver**: `@db/console` uses `@neondatabase/serverless` v1.0.2 via `drizzle-orm/neon-http` (`db/console/src/client.ts:1-2`)
- **`NeonDbError`** (exported from `@neondatabase/serverless`) extends `Error` and exposes:
  - `code: string | undefined` — PostgreSQL error code (e.g. `"23505"` for UNIQUE_VIOLATION)
  - `constraint: string | undefined` — constraint name (e.g. `"workspace_org_name_idx"`)
  - `name: "NeonDbError"`
- **Drizzle does NOT wrap errors** — the `neon-http` session calls `clientQuery` directly with no try/catch, so `NeonDbError` propagates unchanged to caller code
- **Downstream consumers** (`api/console/src/router/user/workspace.ts:287-293`, `api/console/src/router/org/workspace.ts:309-315`) catch the re-thrown `Error` by matching on `"already exists"` in the message — these remain unchanged

## Desired End State

The catch block should:
1. First check for `NeonDbError` with `error.code === "23505"` (PostgreSQL UNIQUE_VIOLATION)
2. Fall back to the existing substring checks for safety (in case the error is wrapped differently in some edge case)
3. Continue throwing the same `Error(`Workspace with name "${name}" already exists`)` so downstream consumers are unaffected

### Verification
- `pnpm typecheck` passes
- `pnpm lint` passes
- Downstream routers continue to catch the `"already exists"` error unchanged

## What We're NOT Doing

- Not changing the re-thrown error message (downstream routers depend on `"already exists"`)
- Not refactoring other catch blocks in the codebase (e.g. `api/chat/` — those use MySQL-specific codes for a different driver)
- Not adding a shared error utility — this is a single-site fix
- Not importing `NeonDbError` as a class for `instanceof` checks — using duck-typing on `.code` is simpler and avoids coupling to the driver import

## Implementation Approach

Single-phase change to one file. Use duck-typing to check for `.code === "23505"` on the caught error, with the existing substring checks as fallback.

## Phase 1: Update Catch Block

### Overview
Modify the catch block to prioritize error code detection.

### Changes Required:

#### 1. `db/console/src/utils/workspace.ts`
**File**: `db/console/src/utils/workspace.ts`
**Lines**: 102–112

Replace the catch block with:

```ts
  } catch (error) {
    // Detect unique constraint violation on (clerkOrgId, name).
    // Prefer the PostgreSQL error code exposed by NeonDbError (code "23505" = UNIQUE_VIOLATION).
    // Substring fallback retained in case the error is wrapped without a code property.
    const isUniqueViolation =
      (error instanceof Error &&
        "code" in error &&
        (error as { code: unknown }).code === "23505") ||
      (error instanceof Error &&
        (error.message.includes("unique constraint") ||
          error.message.includes("duplicate key")));

    if (isUniqueViolation) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }
    throw error;
  }
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Creating a workspace with a duplicate name returns the `"already exists"` error (not a raw DB error)
- [ ] Creating a workspace with a unique name succeeds normally

## References

- `NeonDbError` type: `db/console/node_modules/@neondatabase/serverless/index.d.ts:646-666`
- Drizzle neon-http session (no error wrapping): `node_modules/.pnpm/node_modules/drizzle-orm/neon-http/session.js:28-50`
- Downstream consumer: `api/console/src/router/user/workspace.ts:287-293`
- Downstream consumer: `api/console/src/router/org/workspace.ts:309-315`
