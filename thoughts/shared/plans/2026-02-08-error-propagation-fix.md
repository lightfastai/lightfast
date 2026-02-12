# Error Propagation Fix: Database Credential Leak Prevention

## Overview

Fix the error propagation chain that allows database credentials to leak from DNS failures to user-facing toast notifications. Three layers of defense-in-depth: (1) prevent bad credentials at validation, (2) sanitize errors server-side, (3) sanitize error display client-side.

## Current State Analysis

### The Incident Chain
When `DATABASE_HOST` is misconfigured with a credential value (e.g., `pscale_pw_abc123`):
1. `db/console/env.ts:6` validates only `z.string().min(1)` - passes
2. `db/console/src/client.ts:10` interpolates into `postgresql://...@pscale_pw_abc123:6432/...`
3. Node.js DNS throws `Error: getaddrinfo ENOTFOUND pscale_pw_abc123`
4. `workspace.ts:320` re-throws raw error
5. `trpc.ts:244` error formatter passes message through
6. `create-workspace-button.tsx:200` displays `error.message` in toast

### Key Discoveries
- `vendor/db/env.ts:7-14` already has correct validation with `.refine()` and `.startsWith()` checks
- `db/console/env.ts:6-8` and `db/chat/env.ts:7-9` both lack these checks
- 6 router catch blocks re-throw raw errors (Pattern B from research)
- 16 client locations across 10 components display `error.message` unsafely
- Chat app has comprehensive `trpc-errors.ts` at `apps/chat/src/lib/trpc-errors.ts` we can model after
- `handleProcedureError` utility exists at `api/console/src/trpc.ts:883` but is unused

## Desired End State

After this plan is complete:
1. Environment validation catches credential misconfiguration at startup with clear error messages
2. The tRPC error formatter sanitizes `INTERNAL_SERVER_ERROR` messages in production, replacing raw messages with generic safe text
3. All client components use code-aware error display that only shows `error.message` for known safe codes (CONFLICT, BAD_REQUEST, etc.) and shows generic messages for INTERNAL_SERVER_ERROR

### Verification:
- All 3 database env.ts files have credential prefix validation
- Error formatter in production returns "An unexpected error occurred" for INTERNAL_SERVER_ERROR
- No client component displays `error.message` directly without checking error code first
- `pnpm build:console` passes
- `pnpm lint && pnpm typecheck` pass

## What We're NOT Doing

- Not refactoring all routers to use `handleProcedureError` (good improvement but separate effort)
- Not changing the org-scoped tRPC route handler (only touching the error formatter which is shared)
- Not adding structured server-side logging/monitoring (separate concern)

## Implementation Approach

Defense-in-depth strategy: fix at three layers so any single layer failing doesn't expose credentials.

---

## Phase 1: Fix Database Environment Validation

### Overview
Apply PlanetScale credential prefix validation to `db/console/env.ts` and `db/chat/env.ts`, matching the pattern already established in `vendor/db/env.ts`.

### Changes Required:

#### 1. Console Database Env
**File**: `db/console/env.ts`
**Changes**: Add credential prefix validation to match `vendor/db/env.ts`

```typescript
export const env = createEnv({
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
        message: "DATABASE_HOST should be a hostname, not a credential",
      }),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
```

**Note**: We only add the `.refine()` check on DATABASE_HOST (the critical one that caused the incident). We do NOT add `.startsWith("pscale_api_")` to USERNAME or `.startsWith("pscale_pw_")` to PASSWORD because `db/console` uses PostgreSQL via PgBouncer (not PlanetScale SDK directly), and the credential format may differ between environments.

#### 2. Chat Database Env
**File**: `db/chat/env.ts`
**Changes**: Same DATABASE_HOST validation

```typescript
export const env = createEnv({
  shared: {},
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
        message: "DATABASE_HOST should be a hostname, not a credential",
      }),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @db/console build` passes
- [x] `pnpm --filter @db/chat build` passes
- [x] `pnpm typecheck` passes (db/console and db/chat pass; pre-existing ai-sdk failures unrelated to changes)
- [x] `pnpm lint` passes (db/console passes; db/chat has pre-existing ESLint config issue)

#### Manual Verification:
- [ ] Setting `DATABASE_HOST=pscale_pw_test` and running the app produces a clear validation error at startup
- [ ] Normal `DATABASE_HOST` values (e.g., `aws.connect.psdb.cloud`) pass validation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Sanitize tRPC Error Formatter

### Overview
Add production-mode error sanitization to the tRPC error formatter at `api/console/src/trpc.ts:244`. When running in production, replace raw error messages for `INTERNAL_SERVER_ERROR` with a generic safe message. Preserve messages for known-safe codes (CONFLICT, BAD_REQUEST, etc.) where procedures intentionally set user-facing messages.

### Changes Required:

#### 1. Error Formatter
**File**: `api/console/src/trpc.ts`
**Location**: Lines 242-251 (tRPC initialization)
**Changes**: Add message sanitization for INTERNAL_SERVER_ERROR in production

```typescript
const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<typeof createUserTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    // In production, sanitize INTERNAL_SERVER_ERROR messages to prevent credential leaks.
    // Procedures that throw TRPCError with specific codes (CONFLICT, BAD_REQUEST, etc.)
    // intentionally set user-facing messages, so those are preserved.
    const shouldSanitize =
      isProduction && error.code === "INTERNAL_SERVER_ERROR";

    return {
      ...shape,
      message: shouldSanitize ? "An unexpected error occurred" : shape.message,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});
```

**Why this works**:
- `error.code` is the tRPC error code string (e.g., "INTERNAL_SERVER_ERROR", "CONFLICT")
- When a procedure throws `new TRPCError({ code: "CONFLICT", message: "..." })`, the code is "CONFLICT" and the message is preserved
- When a procedure does `throw error` (raw re-throw), tRPC wraps it as INTERNAL_SERVER_ERROR with the raw error message - this is what we sanitize
- In development, all messages pass through for debugging
- This is a single-point fix that protects ALL procedures, not just workspace.create

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/console build` passes
- [x] `pnpm typecheck` passes (api/console)
- [x] `pnpm lint` passes (pre-existing lint errors in other files unrelated to trpc.ts changes)

#### Manual Verification:
- [ ] In development: raw error messages still visible (for debugging)
- [ ] CONFLICT errors still show their specific messages (e.g., "Workspace already exists")
- [ ] FORBIDDEN errors still show their specific messages (e.g., "Access denied")

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Sanitize Client-Side Error Display

### Overview
Create a `trpc-errors.ts` utility for the console app (modeled after `apps/chat/src/lib/trpc-errors.ts`) and update all 10 affected components to use code-aware error display. For errors with known-safe codes (CONFLICT, FORBIDDEN, BAD_REQUEST), show the server message. For INTERNAL_SERVER_ERROR, show a generic message.

### Changes Required:

#### 1. Create Console tRPC Error Utilities
**File**: `apps/console/src/lib/trpc-errors.ts` (new file)
**Changes**: Create error utilities modeled after `apps/chat/src/lib/trpc-errors.ts`

```typescript
import type { TRPCClientError } from "@trpc/client";
import { toast } from "@repo/ui/components/ui/sonner";
import type { ConsoleAppRouter } from "@api/console";

/**
 * TRPC error codes - matches server-side codes
 */
type TRPCErrorCode =
  | "PARSE_ERROR"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "TIMEOUT";

/**
 * Error codes where the server message is safe to display to users.
 * These are codes where procedures intentionally set user-facing messages
 * (e.g., "Workspace already exists" for CONFLICT).
 */
const SAFE_MESSAGE_CODES: ReadonlySet<TRPCErrorCode> = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "TOO_MANY_REQUESTS",
]);

/**
 * Type guard to check if an error is a TRPCClientError
 */
export function isTRPCClientError(
  error: unknown
): error is TRPCClientError<ConsoleAppRouter> {
  return error instanceof Error && error.name === "TRPCClientError";
}

/**
 * Extract the TRPC error code from an error
 */
export function getTRPCErrorCode(error: unknown): TRPCErrorCode | null {
  if (!isTRPCClientError(error)) {
    return null;
  }

  if (error.data?.code && typeof error.data.code === "string") {
    return error.data.code as TRPCErrorCode;
  }

  return null;
}

/**
 * Get a safe error message for display to users.
 *
 * For known-safe codes (CONFLICT, BAD_REQUEST, etc.), returns the server message.
 * For INTERNAL_SERVER_ERROR or unknown errors, returns a generic message.
 */
export function getSafeErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (!isTRPCClientError(error)) {
    return fallback;
  }

  const code = getTRPCErrorCode(error);

  if (code && SAFE_MESSAGE_CODES.has(code) && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * Show an error toast with safe message handling.
 *
 * For known-safe error codes, displays the server message.
 * For INTERNAL_SERVER_ERROR, displays a generic message.
 */
export function showErrorToast(
  error: unknown,
  title: string,
  fallback?: string
): void {
  toast.error(title, {
    description: getSafeErrorMessage(error, fallback),
  });
}
```

**Why this approach vs copying the full chat trpc-errors.ts**:
- The chat version is 447 lines with many unused helpers
- Console needs a minimal, focused utility
- `getSafeErrorMessage` and `showErrorToast` cover all 16 usage sites
- Easy to extend later if needed

#### 2. Update Affected Components

All 10 components follow the same migration pattern. Replace direct `error.message` usage with `getSafeErrorMessage(error)` or `showErrorToast(error, title)`.

**File**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`
**Lines**: 197-202

Before:
```typescript
} catch (error) {
  console.error("Workspace creation failed:", error);
  toast.error("Creation failed", {
    description: error instanceof Error ? error.message : "Failed to create workspace. Please try again.",
  });
}
```

After:
```typescript
} catch (error) {
  console.error("Workspace creation failed:", error);
  showErrorToast(error, "Creation failed", "Failed to create workspace. Please try again.");
}
```

**File**: `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx`
**Lines**: 64-66, 78-80, 92-94

Before:
```typescript
onError: (error) => {
  toast.error(error.message || "Failed to create API key");
},
```

After:
```typescript
onError: (error) => {
  showErrorToast(error, "Failed to create API key");
},
```

(Same pattern for revoke and delete handlers)

**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx`
**Lines**: 69-71, 83-85, 97-99, 112-114

Same pattern: replace `toast.error(error.message || "...")` with `showErrorToast(error, "...")`

**File**: `apps/console/src/components/jobs-table.tsx`
**Line**: 125-128

Before:
```typescript
onError: (error) => {
  toast.error("Failed to restart job", {
    description: error.message,
  });
},
```

After:
```typescript
onError: (error) => {
  showErrorToast(error, "Failed to restart job");
},
```

**File**: `apps/console/src/app/(app)/(user)/account/(manage)/settings/sources/_components/sources-list.tsx`
**Line**: 59-61

Replace `toast.error(error.message || "...")` with `showErrorToast(error, "...")`

**File**: `apps/console/src/components/integrations/vercel-project-selector.tsx`
**Line**: 67-69

Replace `toast.error(error.message || "...")` with `showErrorToast(error, "...")`

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/connect-button.tsx`
**Lines**: 32-34, 45-47

Replace both `toast.error(error.message || "...")` with `showErrorToast(error, "...")`

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/_components/workspace-general-settings-client.tsx`
**Line**: 126-149 (the onError within mutation)

Before:
```typescript
toast.error("Failed to update workspace name", {
  description: err.message || "Please try again.",
});
```

After:
```typescript
showErrorToast(err, "Failed to update workspace name", "Please try again.");
```

**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx`
**Line**: 69-73

Before:
```typescript
toast.error("Failed to update team name", {
  description: err.message || "Please try again.",
});
```

After:
```typescript
showErrorToast(err, "Failed to update team name", "Please try again.");
```

**File**: `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx`
**Line**: 69-79

Before:
```typescript
toast.error(err.message || "Failed to create team. Please try again.");
```

After:
```typescript
showErrorToast(err, "Failed to create team", "Failed to create team. Please try again.");
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build:console` passes
- [x] `pnpm typecheck` passes (apps/console)
- [x] `pnpm lint` passes (apps/console)
- [x] No remaining instances of `error.message` used directly in toast calls - all replaced with showErrorToast()

#### Manual Verification:
- [ ] Workspace creation with duplicate name shows: "Creation failed" with "Workspace already exists" (CONFLICT message preserved)
- [ ] Internal server errors show: generic "An unexpected error occurred" message (not raw error)
- [ ] All toast notifications still appear and are user-friendly

**Implementation Note**: After completing this phase and all verification passes, the fix is complete.

---

## Testing Strategy

### Unit Tests:
- No new unit tests needed - changes are validation rules and error message formatting

### Integration Tests:
- Not applicable - these are configuration and display changes

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Create a workspace with a duplicate name - should see CONFLICT message preserved
3. Verify all toast errors show user-friendly messages
4. Check that env validation rejects `DATABASE_HOST=pscale_pw_test` at startup

## Performance Considerations

None - all changes are in error paths and validation (startup-only).

## Migration Notes

No data migration needed. All changes are code-only:
- Environment validation changes take effect on next server start
- Error formatter changes take effect immediately
- Client component changes take effect on next deployment

## References

- Research document: `thoughts/shared/research/2026-02-08-error-propagation-database-to-client.md`
- Chat app error utilities (model): `apps/chat/src/lib/trpc-errors.ts`
- Vendor db validation (pattern): `vendor/db/env.ts:7-14`
- tRPC error formatter: `api/console/src/trpc.ts:242-251`
- handleProcedureError utility: `api/console/src/trpc.ts:883-906`
