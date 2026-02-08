---
date: 2026-02-08T14:12:38+1100
researcher: Claude Sonnet 4.5
git_commit: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
branch: main
repository: lightfast
topic: "Error Propagation from Database Connection Failures to Client Toast Notifications"
tags: [research, codebase, error-handling, trpc, database, validation, security]
status: complete
last_updated: 2026-02-08
last_updated_by: Claude Sonnet 4.5
---

# Research: Error Propagation from Database Connection Failures to Client Toast Notifications

**Date**: 2026-02-08T14:12:38+1100
**Researcher**: Claude Sonnet 4.5
**Git Commit**: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
**Branch**: main
**Repository**: lightfast

## Research Question

Document the complete error propagation chain when database connection failures occur during workspace creation, tracing how errors flow from the connection layer through tRPC error handling to client-side toast notifications.

## Summary

The codebase has two separate environment validation implementations: `vendor/db/env.ts` includes credential prefix validation (added in commit 3d0624e6) to prevent pscale_pw_ and pscale_api_ prefixes in DATABASE_HOST, but `db/console/env.ts` only validates that values are non-empty strings. When DATABASE_HOST contains an invalid value (like a credential prefix), errors propagate through seven distinct layers without sanitization, ultimately exposing raw DNS error messages (including credentials) in user-facing toast notifications.

The error chain is:

1. **Environment validation** (`db/console/env.ts`) - Accepts any non-empty string for DATABASE_HOST
2. **Connection string construction** (`db/console/src/client.ts:10`) - Interpolates DATABASE_HOST into postgresql://...@{HOST}:6432/...
3. **DNS failure** (Node.js) - Throws Error with hostname in message: "getaddrinfo ENOTFOUND pscale_pw_..."
4. **Router error handling** (`api/console/src/router/user/workspace.ts:320`) - Re-throws raw error
5. **tRPC error formatter** (`api/console/src/trpc.ts:244`) - Spreads error shape without sanitization
6. **HTTP handler** (`apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:92`) - Logs and returns error
7. **Client display** (`create-workspace-button.tsx:200`) - Shows error.message directly in toast

## Detailed Findings

### Layer 1: Environment Validation

#### vendor/db/env.ts (Has Validation)

**Location**: `vendor/db/env.ts:7-14`

```typescript
DATABASE_HOST: z
  .string()
  .min(1)
  .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
    message: "DATABASE_HOST should be a hostname, not a credential",
  }),
DATABASE_USERNAME: z.string().startsWith("pscale_api_"),
DATABASE_PASSWORD: z.string().startsWith("pscale_pw_"),
```

This validation:
- Rejects DATABASE_HOST values starting with credential prefixes
- Requires DATABASE_USERNAME to start with "pscale_api_"
- Requires DATABASE_PASSWORD to start with "pscale_pw_"
- Was added in commit 3d0624e6

#### db/console/env.ts (No Validation)

**Location**: `db/console/env.ts:4-16`

```typescript
export const env = createEnv({
  server: {
    DATABASE_HOST: z.string().min(1),
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

This validation:
- Only checks that values are non-empty strings
- Does NOT validate credential prefixes
- Does NOT enforce format requirements
- **This is the validation used by the console database connection**

**Key Finding**: The vendor/db validation is NOT used by db/console. The console uses its own env.ts file with weaker validation.

### Layer 2: Database Connection String Construction

**Location**: `db/console/src/client.ts:9-21`

```typescript
export function createClient() {
  const connectionString = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:6432/postgres?sslmode=verify-full`;

  const client = postgres(connectionString, {
    ssl: "require",
    max: 20,              // Match PlanetScale default_pool_size
    prepare: false,       // Required for PgBouncer transaction mode
    idle_timeout: 20,     // Serverless: close idle connections after 20s
    connect_timeout: 10,  // Fail fast on connection issues
  });

  return drizzle(client, { schema });
}
```

What happens with invalid DATABASE_HOST:
1. Environment validation at `db/console/env.ts:6` passes (only checks `.min(1)`)
2. Connection string is constructed at line 10 with the invalid value
3. If DATABASE_HOST is "pscale_pw_xyz", the connection string becomes:
   ```
   postgresql://pscale_api_xxx:pscale_pw_yyy@pscale_pw_xyz:6432/postgres?sslmode=verify-full
   ```
4. The postgres-js client attempts to connect to hostname "pscale_pw_xyz"
5. DNS resolution fails with error message containing the invalid hostname

The env values come from `db/console/env.ts`, NOT from `vendor/db/env.ts`, as shown by the import at line 3:
```typescript
import { env } from "../env";
```

### Layer 3: DNS Failure

When postgres-js attempts to connect to an invalid hostname, Node.js throws an error:

```
Error: getaddrinfo ENOTFOUND pscale_pw_xyz
```

This error:
- Contains the full hostname (which may be a credential in this case)
- Is thrown synchronously from the postgres client
- Propagates to the calling tRPC procedure

### Layer 4: Workspace Router Error Handling

**Location**: `api/console/src/router/user/workspace.ts:313-321`

```typescript
} catch (error) {
  if (error instanceof Error && error.message.includes("already exists")) {
    throw new TRPCError({
      code: "CONFLICT",
      message: error.message,
    });
  }
  throw error;
}
```

Error handling behavior:
- The catch block at line 313 catches all errors from workspace creation
- Only "already exists" errors are specifically handled (lines 314-318)
- **All other errors are re-thrown as-is at line 320**
- No sanitization occurs for database connection errors
- The raw error (with credential in the message) propagates unchanged

The workspace creation occurs at lines 146-149:
```typescript
const workspaceId = await createCustomWorkspace(
  input.clerkOrgId,
  input.workspaceName,
);
```

This function performs database operations that could fail with connection errors containing sensitive information.

### Layer 5: tRPC Error Formatter

**Location**: `api/console/src/trpc.ts:244-250`

```typescript
errorFormatter: ({ shape, error }) => ({
  ...shape,
  data: {
    ...shape.data,
    zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
  },
}),
```

Error formatter behavior:
- Spreads the existing error `shape` without modification
- Only adds Zod validation details to the `data` field
- **Does NOT sanitize error messages**
- **Does NOT filter sensitive information**
- The raw error message remains in `shape.message`

Note: There is a `handleProcedureError` utility at lines 883-906 that provides sanitization:

```typescript
export function handleProcedureError(
  error: unknown,
  context: ErrorContext,
  userMessage?: string,
): never {
  // Log error with context
  console.error(`[tRPC Error] ${context.procedure}`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Re-throw TRPCError as-is
  if (error instanceof TRPCError) {
    throw error;
  }

  // Wrap unknown errors with safe message
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: userMessage ?? "An unexpected error occurred",
    cause: error,
  });
}
```

However, the workspace router at line 320 does NOT use this utility - it just re-throws the raw error. The error formatter at line 244 also does NOT use this utility - it implements separate logic that doesn't sanitize messages.

### Layer 6: HTTP Handler Error Logging

**Location**: `apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:92-94`

```typescript
onError({ error, path }) {
  console.error(`>>> tRPC Error on 'user.${path}'`, error);
},
```

Error handling behavior:
- Logs the full error object to console at line 93
- No sanitization before logging
- Error message with credentials is written to server logs
- After logging, the error continues through tRPC's standard error handling
- The HTTP response is sent to the client with the error details

The handler configuration (lines 83-98):
```typescript
const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc/user",
    router: userRouter,
    req,
    createContext: () =>
      createUserTRPCContext({
        headers: req.headers,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on 'user.${path}'`, error);
    },
  });

  return setCorsHeaders(req, response);
};
```

### Layer 7: Client-Side Error Display

**Location**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:197-202`

```typescript
} catch (error) {
  console.error("Workspace creation failed:", error);
  toast.error("Creation failed", {
    description: error instanceof Error ? error.message : "Failed to create workspace. Please try again.",
  });
}
```

Error display behavior:
- Catches errors from the workspace creation mutation
- Logs the error to browser console at line 198
- **Extracts error message directly via `error.message` at line 200**
- **No sanitization occurs**
- Displays the raw error message to the user in a toast notification

The toast structure:
- **Title**: "Creation failed" (hardcoded)
- **Description**: The error message (unsanitized)

For a DNS error with credentials in the hostname, the user would see:
```
Title: "Creation failed"
Description: "getaddrinfo ENOTFOUND pscale_pw_..."
```

## Complete Error Propagation Chain

```
1. User submits workspace creation form
   ↓
2. db/console/env.ts validates DATABASE_HOST as non-empty string ✓
   ↓
3. db/console/src/client.ts:10 interpolates DATABASE_HOST into connection string
   postgresql://user:pass@pscale_pw_xyz:6432/postgres
   ↓
4. postgres-js attempts DNS resolution of "pscale_pw_xyz"
   ↓
5. Node.js throws Error: "getaddrinfo ENOTFOUND pscale_pw_xyz"
   ↓
6. api/console/src/router/user/workspace.ts:320 catches and re-throws error (no sanitization)
   ↓
7. api/console/src/trpc.ts:244 error formatter spreads error shape (no sanitization)
   ↓
8. apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:92 logs full error
   ↓
9. tRPC sends JSON response with error.message to client
   ↓
10. apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:200
    extracts error.message and displays in toast
   ↓
11. User sees: "Creation failed: getaddrinfo ENOTFOUND pscale_pw_xyz"
```

## Architecture Documentation

### Two Environment Validation Systems

The codebase has two separate environment validation implementations:

| File | Location | Validation Level | Used By |
|------|----------|------------------|---------|
| `vendor/db/env.ts` | `/Users/jeevanpillay/Code/@lightfastai/lightfast/vendor/db/env.ts` | Strict (credential prefix checks) | Vendor abstraction layer |
| `db/console/env.ts` | `/Users/jeevanpillay/Code/@lightfastai/lightfast/db/console/env.ts` | Basic (non-empty string) | Console database connection |

**Key Finding**: The console database connection uses its own `env.ts` file, NOT the vendor layer validation. This means the credential prefix validation added in commit 3d0624e6 doesn't protect the console app.

### Error Handling Utilities Available but Not Used

The codebase provides error handling utilities that could sanitize errors:

1. **handleProcedureError** (`api/console/src/trpc.ts:883-906`)
   - Wraps unknown errors with safe messages
   - Logs full context server-side
   - NOT used by workspace router

2. **withErrorHandling** (`api/console/src/trpc.ts:924-946`)
   - Convenience wrapper around handleProcedureError
   - NOT used by workspace creation procedure

### Error Sanitization Gap

The error formatter at `api/console/src/trpc.ts:244` does not sanitize messages. It only:
- Adds Zod validation details
- Preserves the original error message
- Does NOT filter sensitive information

This means the system relies on procedures throwing properly-formed TRPCError instances with safe messages. When raw errors are re-thrown (as at `workspace.ts:320`), they reach the client unchanged.

## Code References

### Environment Validation
- `vendor/db/env.ts:7-14` - Credential prefix validation (strict)
- `db/console/env.ts:4-16` - Basic validation (permissive)

### Database Connection
- `db/console/src/client.ts:9-21` - Connection string construction and client creation
- `db/console/src/client.ts:10` - DATABASE_HOST interpolation point

### Error Propagation
- `api/console/src/router/user/workspace.ts:313-321` - Try-catch block with raw re-throw
- `api/console/src/router/user/workspace.ts:320` - Specific line where raw error is re-thrown
- `api/console/src/trpc.ts:244-250` - Error formatter (no sanitization)
- `api/console/src/trpc.ts:883-906` - handleProcedureError utility (available but not used)
- `apps/console/src/app/(trpc)/api/trpc/user/[trpc]/route.ts:92-94` - Error logging
- `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:197-202` - Client error display

## Historical Context (from git history)

### Recent Commits Related to Database Validation

From the git status output, recent commits show work on credential prefix validation:

- **3d0624e6** - "fix(db): reject credential prefixes in DATABASE_HOST"
- **d8c824dc** - "fix(db): add PlanetScale prefix validation for credentials"

These commits added the validation to `vendor/db/env.ts` but didn't update `db/console/env.ts`, creating the validation gap documented in this research.

## Related Research

This research builds understanding for addressing the security incident where database credentials were exposed in user-facing error messages. The complete error propagation chain documents the current state before implementing fixes.

## Open Questions

1. Why does `db/console` maintain a separate `env.ts` file instead of using `vendor/db/env.ts`?
2. Should the `handleProcedureError` utility be used consistently across all routers?
3. Should the error formatter at `trpc.ts:244` implement message sanitization for INTERNAL_SERVER_ERROR?
4. Should client components distinguish between known error codes (CONFLICT, FORBIDDEN) and INTERNAL_SERVER_ERROR when displaying messages?
