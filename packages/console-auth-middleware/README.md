# @repo/console-auth-middleware

Authorization middleware utilities for Console tRPC API.

This package provides security-focused utilities for:
- **Workspace Access Verification** - Validate user has access to workspace
- **Resource Ownership Verification** - Check user owns integrations, API keys, repositories
- **Tenant Isolation Helpers** - Helper functions for Drizzle tenant isolation queries

## Features

- ✅ **Dependency Injection** - Accepts DbClient as parameter (easy to mock in tests)
- ✅ **Structured Results** - Returns detailed results with clear error types
- ✅ **Type-Safe** - Full TypeScript support with comprehensive JSDoc
- ✅ **Reusable** - Designed for use in tRPC middleware and procedures
- ✅ **Security-First** - Implements authorization patterns from security review

## Installation

This is an internal workspace package. Add it to your `package.json`:

```json
{
  "dependencies": {
    "@repo/console-auth-middleware": "workspace:*"
  }
}
```

## Usage

### Workspace Access Verification

Verify user has access to a workspace and resolve workspace/org IDs:

```typescript
import { verifyWorkspaceAccess, resolveWorkspaceBySlug } from "@repo/console-auth-middleware";
import { db } from "@db/console/client";

// In a tRPC procedure
myProcedure: protectedProcedure
  .input(z.object({
    clerkOrgSlug: z.string(),
    workspaceName: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // Verify access and resolve IDs
    const result = await verifyWorkspaceAccess({
      userId: ctx.auth.userId,
      clerkOrgSlug: input.clerkOrgSlug,
      workspaceName: input.workspaceName,
      db,
    });

    if (!result.success) {
      throw new TRPCError({
        code: result.errorCode,
        message: result.error,
      });
    }

    const { workspaceId, clerkOrgId } = result.data;

    // Now use verified IDs for queries
    // ...
  });
```

### Resolve Workspace by Slug/Name

Use helper functions to resolve workspace identifiers:

```typescript
import { resolveWorkspaceBySlug, resolveWorkspaceByName } from "@repo/console-auth-middleware";

// Resolve by user-facing name (for URL routes)
const nameResult = await resolveWorkspaceByName({
  clerkOrgSlug: "acme-corp",
  workspaceName: "my-project",
  userId: "user_123",
  db,
});

// Resolve by internal slug (for internal operations)
const slugResult = await resolveWorkspaceBySlug({
  clerkOrgSlug: "acme-corp",
  workspaceSlug: "robust-chicken",
  userId: "user_123",
  db,
});
```

### Resource Ownership Verification

Verify user owns a specific resource (integration, API key, repository):

```typescript
import { verifyResourceOwnership } from "@repo/console-auth-middleware";

// Verify integration ownership
const result = await verifyResourceOwnership({
  userId: ctx.auth.userId,
  resourceId: input.integrationId,
  resourceType: "integration",
  db,
});

if (!result.success) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You don't own this integration",
  });
}

// Access the verified resource
const integration = result.data.resource;
```

### Tenant Isolation Helpers

Create Drizzle query filters for tenant isolation:

```typescript
import { createTenantFilter } from "@repo/console-auth-middleware/tenant";
import { workspaces } from "@db/console/schema";

// In a tRPC procedure
const result = await verifyWorkspaceAccess({ ... });
const { clerkOrgId } = result.data;

// Create tenant filter for queries
const filter = createTenantFilter(clerkOrgId);

// Use in Drizzle queries
const allWorkspaces = await db
  .select()
  .from(workspaces)
  .where(eq(workspaces.clerkOrgId, filter.clerkOrgId));
```

## API Reference

### Workspace Access

#### `verifyWorkspaceAccess(params)`

Verify user has access to a workspace and resolve IDs.

**Parameters:**
- `userId: string` - Clerk user ID
- `clerkOrgSlug: string` - Organization slug from URL
- `workspaceName: string` - Workspace name from URL
- `db: DbClient` - Database client instance

**Returns:** `WorkspaceAccessResult`
```typescript
{
  success: boolean;
  data?: {
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    clerkOrgId: string;
    userRole: string;
  };
  error?: string;
  errorCode?: "NOT_FOUND" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR";
}
```

#### `resolveWorkspaceByName(params)`

Resolve workspace by user-facing name.

**Parameters:**
- `clerkOrgSlug: string`
- `workspaceName: string`
- `userId: string`
- `db: DbClient`

**Returns:** `ResolveWorkspaceResult`

#### `resolveWorkspaceBySlug(params)`

Resolve workspace by internal slug (for internal operations only).

**Parameters:**
- `clerkOrgSlug: string`
- `workspaceSlug: string`
- `userId: string`
- `db: DbClient`

**Returns:** `ResolveWorkspaceResult`

### Resource Ownership

#### `verifyResourceOwnership(params)`

Verify user owns a specific resource.

**Parameters:**
- `userId: string` - Clerk user ID
- `resourceId: string` - Resource ID to verify
- `resourceType: "integration" | "apiKey" | "repository"` - Type of resource
- `db: DbClient` - Database client instance

**Returns:** `ResourceOwnershipResult`
```typescript
{
  success: boolean;
  data?: {
    authorized: boolean;
    resource?: Integration | ApiKey | Repository;
  };
  error?: string;
}
```

### Tenant Isolation

#### `createTenantFilter(clerkOrgId)`

Create Drizzle query filter for tenant isolation.

**Parameters:**
- `clerkOrgId: string` - Organization ID

**Returns:** `{ clerkOrgId: string }`

## Security Best Practices

1. **Always verify access** - Never trust user-provided IDs
2. **Use slug-based resolution** - Resolve clerkOrgSlug + workspaceName to IDs
3. **Check resource ownership** - Verify user owns resources before mutations
4. **Apply tenant filters** - Use createTenantFilter for all multi-tenant queries
5. **Handle errors gracefully** - Check result.success before accessing data

## Design Principles

- **Dependency Injection** - DbClient passed as parameter, not imported
- **Result Pattern** - All functions return { success, data?, error? }
- **Type Safety** - Full TypeScript support with discriminated unions
- **Clear Errors** - Structured error codes and messages
- **Reusable** - Works in tRPC middleware, procedures, and Inngest jobs

## Related Packages

- `@db/console` - Database schemas and client
- `@vendor/clerk` - Clerk authentication utilities
- `@repo/console-api-key` - API key crypto utilities

## Contributing

This package implements security patterns from `apps/console/SECURITY-REVIEW-2025-01-21.md`.

When adding new authorization helpers:
1. Accept DbClient as parameter (dependency injection)
2. Return structured results with clear error types
3. Include comprehensive JSDoc comments
4. Add usage examples to README
5. Update type definitions in src/types.ts

## License

Private workspace package - not for external distribution.
