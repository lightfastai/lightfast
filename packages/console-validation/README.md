# @repo/console-validation

Centralized validation schemas for the Lightfast Console application.

## Overview

This package provides a single source of truth for all validation logic in the console app, including:

- **Primitives**: Reusable Zod schemas for common patterns (IDs, slugs, names, timestamps)
- **Domain Schemas**: Complete validation for business entities (workspaces, organizations, stores, jobs)
- **Form Schemas**: Client-side validation for React Hook Form
- **Database Integration**: Drizzle-generated schemas with custom refinements

## Installation

```bash
pnpm add @repo/console-validation
```

## Usage

### Primitives

```typescript
import {
  clerkOrgSlugSchema,
  workspaceNameSchema,
  nanoidSchema,
} from "@repo/console-validation/primitives";

// Validate a workspace name
const result = workspaceNameSchema.safeParse("my-workspace");
```

### Domain Schemas

```typescript
import {
  workspaceCreateInputSchema,
  type WorkspaceCreateInput,
} from "@repo/console-validation/schemas";

// Use in tRPC procedure
create: protectedProcedure
  .input(workspaceCreateInputSchema)
  .mutation(async ({ input }) => {
    // input is type-safe!
  });
```

### Form Schemas

```typescript
import {
  workspaceFormSchema,
  type WorkspaceFormValues,
} from "@repo/console-validation/forms";

// Use with React Hook Form
const form = useForm<WorkspaceFormValues>({
  resolver: zodResolver(workspaceFormSchema),
});
```

### Database Schemas

```typescript
import {
  insertWorkspaceSchema,
  selectWorkspaceSchema,
} from "@repo/console-validation/database";

// Use for database operations
const newWorkspace = insertWorkspaceSchema.parse(data);
await db.insert(workspaces).values(newWorkspace);
```

### Constants

```typescript
import {
  WORKSPACE_NAME,
  NAMING_ERRORS,
  validateWorkspaceName,
} from "@repo/console-validation/constants";

// Use constants for manual validation
if (name.length > WORKSPACE_NAME.MAX_LENGTH) {
  throw new Error(NAMING_ERRORS.WORKSPACE_MAX_LENGTH);
}

// Or use helper function
const result = validateWorkspaceName(name);
if (!result.valid) {
  console.error(result.error);
}
```

## Architecture

```
@repo/console-validation/
├── primitives/      # Reusable Zod schemas (IDs, slugs, names)
├── schemas/         # Domain-specific validation (workspace, org, store)
├── forms/           # Client-side form schemas
├── database/        # Drizzle-generated + refined schemas
└── constants/       # Re-exported from @db/console (naming rules)
```

## Benefits

- **DRY**: Define validation once, use everywhere
- **Type-Safe**: Full TypeScript inference from primitives to forms
- **Maintainable**: Update rules in one place, applies across app
- **Testable**: Isolated validation logic for unit testing
- **Tree-Shakeable**: Import only what you need

## Migration from Old Pattern

**Before:**
```typescript
// Duplicated across form files and tRPC routers
const workspaceNameSchema = z
  .string()
  .min(WORKSPACE_NAME.MIN_LENGTH)
  .max(WORKSPACE_NAME.MAX_LENGTH)
  .regex(WORKSPACE_NAME.PATTERN);
```

**After:**
```typescript
import { workspaceNameSchema } from "@repo/console-validation/primitives";
```

## Contributing

When adding new validation rules:

1. Check if a primitive exists (IDs, slugs, names)
2. If not, add to `primitives/` directory
3. Compose primitives into domain schemas in `schemas/`
4. Add form schemas to `forms/` for client-side validation
5. Export from appropriate `index.ts` files

## Related Packages

- `@db/console` - Database schema definitions (Drizzle)
- `@repo/console-webhooks` - Webhook verification
- `@repo/console-oauth` - OAuth state management
- `@repo/console-auth-middleware` - Authorization helpers
