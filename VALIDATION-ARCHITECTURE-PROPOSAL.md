# Console Validation Architecture Proposal

**Date:** 2025-01-21
**Author:** Claude
**Status:** PROPOSED

---

## Executive Summary

Consolidate all validation logic into `@repo/console-validation` package while maintaining:
- Three-layer validation (client, server, database)
- Centralized constants as single source of truth
- Full Drizzle ORM integration
- Reusable Zod schema primitives

**Benefits:**
- 📦 Single import for all validation schemas
- 🔄 DRY - no duplication between client/server schemas
- 🎯 Type-safe - full TypeScript inference
- ⚡ Performance - tree-shakeable exports
- 🧪 Testable - isolated validation logic

---

## Package Structure

```
packages/console-validation/
├── src/
│   ├── index.ts                    # Main exports
│   ├── constants/                  # Re-export from @db/console
│   │   └── index.ts               # Re-export naming.ts constants
│   ├── primitives/                 # Reusable Zod schemas
│   │   ├── ids.ts                 # ID validation (nanoid, UUID, etc.)
│   │   ├── slugs.ts               # Slug validation (org, workspace, store)
│   │   ├── names.ts               # Name validation (user-facing)
│   │   ├── timestamps.ts          # Date/time validation
│   │   └── index.ts               # Barrel export
│   ├── schemas/                    # Domain-specific schemas
│   │   ├── workspace.ts           # Workspace-related schemas
│   │   ├── organization.ts        # Organization-related schemas
│   │   ├── store.ts               # Store-related schemas
│   │   ├── api-key.ts             # API key schemas
│   │   ├── integration.ts         # Integration schemas
│   │   ├── job.ts                 # Job schemas
│   │   └── index.ts               # Barrel export
│   ├── forms/                      # Client-side form schemas
│   │   ├── workspace-form.ts      # Workspace creation/update forms
│   │   ├── team-form.ts           # Team creation/update forms
│   │   ├── integration-form.ts    # Integration connection forms
│   │   └── index.ts               # Barrel export
│   ├── database/                   # Drizzle schema integration
│   │   ├── index.ts               # Re-export all insert/select schemas
│   │   └── refine.ts              # Custom refinements for Drizzle schemas
│   └── utils/                      # Helper functions
│       ├── error-map.ts           # Zod error formatting
│       └── validation.ts          # Runtime validation helpers
├── package.json
├── tsconfig.json
└── README.md
```

---

## Implementation Details

### 1. Primitives (`src/primitives/`)

**Purpose:** Reusable Zod schemas for common validation patterns

#### `primitives/slugs.ts`

```typescript
import { z } from "zod";
import {
  CLERK_ORG_SLUG,
  WORKSPACE_NAME,
  STORE_NAME,
  NAMING_ERRORS,
} from "@db/console/constants/naming";

/**
 * Clerk Organization Slug Schema
 *
 * Validates organization slugs according to Clerk constraints:
 * - 3-39 characters
 * - Lowercase alphanumeric + hyphens
 * - Must start/end with letter or number
 * - No consecutive hyphens
 */
export const clerkOrgSlugSchema = z
  .string()
  .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
  .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
  .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
  .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
  .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
  .refine(
    (val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val),
    { message: NAMING_ERRORS.ORG_CONSECUTIVE }
  );

/**
 * Workspace Name Schema (User-Facing)
 *
 * Validates user-facing workspace names:
 * - 1-100 characters (GitHub repo naming rules)
 * - Alphanumeric + hyphens, periods, underscores
 * - URL-safe without encoding
 */
export const workspaceNameSchema = z
  .string()
  .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
  .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
  .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN);

/**
 * Workspace Slug Schema (Internal, Pinecone)
 *
 * Validates internal workspace slugs:
 * - 1-20 characters (Pinecone constraint)
 * - Lowercase alphanumeric + hyphens only
 * - No leading/trailing/consecutive hyphens
 */
export const workspaceSlugSchema = z
  .string()
  .min(1, "Workspace slug must not be empty")
  .max(20, "Workspace slug must be 20 characters or less")
  .regex(/^[a-z0-9-]+$/, "Workspace slug must be lowercase alphanumeric with hyphens")
  .refine(
    (slug) => !/^-|-$|--/.test(slug),
    "Workspace slug cannot have leading/trailing/consecutive hyphens"
  );

/**
 * Store Name Schema
 *
 * Validates store names for Pinecone index naming:
 * - 1-20 characters
 * - Lowercase alphanumeric + hyphens
 * - Must start/end with letter or number
 * - No consecutive hyphens
 */
export const storeNameSchema = z
  .string()
  .min(STORE_NAME.MIN_LENGTH, NAMING_ERRORS.STORE_MIN_LENGTH)
  .max(STORE_NAME.MAX_LENGTH, NAMING_ERRORS.STORE_MAX_LENGTH)
  .regex(STORE_NAME.PATTERN, NAMING_ERRORS.STORE_PATTERN)
  .regex(STORE_NAME.START_PATTERN, NAMING_ERRORS.STORE_START)
  .regex(STORE_NAME.END_PATTERN, NAMING_ERRORS.STORE_END)
  .refine(
    (val) => !STORE_NAME.NO_CONSECUTIVE_HYPHENS.test(val),
    { message: NAMING_ERRORS.STORE_CONSECUTIVE }
  );

/**
 * Store Slug Schema (Internal)
 *
 * Same as storeNameSchema - stores use name as slug
 */
export const storeSlugSchema = storeNameSchema;
```

#### `primitives/ids.ts`

```typescript
import { z } from "zod";

/**
 * Nanoid Schema
 *
 * Validates nanoid format (default 21 characters, URL-safe)
 * Used for: workspace IDs, job IDs, API key IDs, etc.
 */
export const nanoidSchema = z
  .string()
  .length(21, "Invalid ID format")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid ID characters");

/**
 * Clerk User ID Schema
 *
 * Validates Clerk user IDs (format: user_*)
 */
export const clerkUserIdSchema = z
  .string()
  .startsWith("user_", "Invalid user ID format");

/**
 * Clerk Organization ID Schema
 *
 * Validates Clerk organization IDs (format: org_*)
 */
export const clerkOrgIdSchema = z
  .string()
  .startsWith("org_", "Invalid organization ID format");

/**
 * GitHub Installation ID Schema
 *
 * Validates GitHub App installation IDs (numeric string)
 */
export const githubInstallationIdSchema = z
  .string()
  .regex(/^\d+$/, "Invalid GitHub installation ID");

/**
 * GitHub Repository ID Schema
 *
 * Validates GitHub repository IDs (numeric string)
 */
export const githubRepoIdSchema = z
  .string()
  .regex(/^\d+$/, "Invalid GitHub repository ID");
```

#### `primitives/names.ts`

```typescript
import { z } from "zod";

/**
 * Display Name Schema
 *
 * User-facing display names (integrations, repositories, etc.)
 * - 1-255 characters
 * - No strict pattern enforcement (allow spaces, special chars)
 */
export const displayNameSchema = z
  .string()
  .min(1, "Name must not be empty")
  .max(255, "Name must be 255 characters or less")
  .trim();

/**
 * API Key Name Schema
 *
 * API key description/label
 * - 1-100 characters
 * - Trimmed whitespace
 */
export const apiKeyNameSchema = z
  .string()
  .min(1, "API key name must not be empty")
  .max(100, "API key name must be 100 characters or less")
  .trim();

/**
 * GitHub Repository Full Name Schema
 *
 * Validates GitHub repository full name (owner/repo format)
 * - Pattern: ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$
 */
export const githubRepoFullNameSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
    "Invalid GitHub repository format (expected: owner/repo)"
  );
```

---

### 2. Domain Schemas (`src/schemas/`)

**Purpose:** Complete validation schemas for domain entities, composing primitives

#### `schemas/workspace.ts`

```typescript
import { z } from "zod";
import {
  clerkOrgIdSchema,
  clerkOrgSlugSchema,
  clerkUserIdSchema,
  nanoidSchema,
} from "../primitives/ids";
import { workspaceNameSchema, workspaceSlugSchema } from "../primitives/slugs";

/**
 * Workspace Creation Input Schema
 *
 * Used in:
 * - tRPC workspace.create procedure
 * - Client-side workspace creation form
 */
export const workspaceCreateInputSchema = z.object({
  clerkOrgId: clerkOrgIdSchema,
  workspaceName: workspaceNameSchema,
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateInputSchema>;

/**
 * Workspace Update Name Input Schema
 *
 * Used in:
 * - tRPC workspace.updateName procedure
 * - Client-side workspace settings form
 */
export const workspaceUpdateNameInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  currentName: workspaceNameSchema,
  newName: workspaceNameSchema,
});

export type WorkspaceUpdateNameInput = z.infer<typeof workspaceUpdateNameInputSchema>;

/**
 * Workspace Resolution Input Schema
 *
 * Used in:
 * - tRPC workspace.resolveFromClerkOrgSlug procedure
 * - tRPC helper: resolveWorkspaceByName()
 */
export const workspaceResolutionInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  userId: clerkUserIdSchema,
});

export type WorkspaceResolutionInput = z.infer<typeof workspaceResolutionInputSchema>;

/**
 * Workspace List Input Schema
 *
 * Used in:
 * - tRPC workspace.listByClerkOrgSlug procedure
 */
export const workspaceListInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
});

export type WorkspaceListInput = z.infer<typeof workspaceListInputSchema>;

/**
 * Workspace Statistics Input Schema
 *
 * Used in:
 * - tRPC workspace.statistics procedure
 */
export const workspaceStatisticsInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type WorkspaceStatisticsInput = z.infer<typeof workspaceStatisticsInputSchema>;
```

#### `schemas/organization.ts`

```typescript
import { z } from "zod";
import { clerkOrgIdSchema, clerkOrgSlugSchema } from "../primitives/ids";

/**
 * Organization Lookup by ID Schema
 */
export const organizationFindByIdInputSchema = z.object({
  clerkOrgId: clerkOrgIdSchema,
});

export type OrganizationFindByIdInput = z.infer<typeof organizationFindByIdInputSchema>;

/**
 * Organization Lookup by Slug Schema
 */
export const organizationFindBySlugInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
});

export type OrganizationFindBySlugInput = z.infer<typeof organizationFindBySlugInputSchema>;
```

#### `schemas/job.ts`

```typescript
import { z } from "zod";
import { nanoidSchema, clerkOrgSlugSchema } from "../primitives/ids";
import { workspaceNameSchema } from "../primitives/slugs";

/**
 * Job Status Enum
 */
export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * Job List Input Schema
 */
export const jobListInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  status: jobStatusSchema.optional(),
  repositoryId: nanoidSchema.optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type JobListInput = z.infer<typeof jobListInputSchema>;

/**
 * Job Get Input Schema
 */
export const jobGetInputSchema = z.object({
  jobId: nanoidSchema,
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type JobGetInput = z.infer<typeof jobGetInputSchema>;
```

---

### 3. Form Schemas (`src/forms/`)

**Purpose:** Client-side form validation schemas (React Hook Form)

#### `forms/workspace-form.ts`

```typescript
import { z } from "zod";
import { workspaceCreateInputSchema, workspaceUpdateNameInputSchema } from "../schemas/workspace";

/**
 * Workspace Creation Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/new/page.tsx
 */
export const workspaceFormSchema = workspaceCreateInputSchema.extend({
  // Add any additional client-side-only fields here
  // For example, confirmation checkboxes, terms acceptance, etc.
});

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

/**
 * Workspace Settings Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/[slug]/[workspaceName]/settings/page.tsx
 */
export const workspaceSettingsFormSchema = z.object({
  workspaceName: workspaceUpdateNameInputSchema.shape.newName,
});

export type WorkspaceSettingsFormValues = z.infer<typeof workspaceSettingsFormSchema>;
```

#### `forms/team-form.ts`

```typescript
import { z } from "zod";
import { clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Team Creation Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/account/teams/new/page.tsx
 */
export const teamFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

/**
 * Team Settings Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/[slug]/settings/page.tsx
 */
export const teamSettingsFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsFormSchema>;
```

---

### 4. Database Integration (`src/database/`)

**Purpose:** Re-export and enhance Drizzle-generated schemas

#### `database/index.ts`

```typescript
/**
 * Re-export all Drizzle-generated schemas from @db/console
 *
 * This provides a single import point for database insert/select schemas
 * while keeping the actual schema definitions in @db/console
 */

export {
  // Workspace schemas
  insertWorkspaceSchema,
  selectWorkspaceSchema,

  // Store schemas
  insertStoreSchema,
  selectStoreSchema,

  // API Key schemas
  insertApiKeySchema,
  selectApiKeySchema,

  // Connected Sources schemas
  insertConnectedSourceSchema,
  selectConnectedSourceSchema,

  // Documents schemas
  insertDocsDocumentSchema,
  selectDocsDocumentSchema,

  // Job schemas
  insertJobSchema,
  selectJobSchema,

  // Repository schemas
  insertRepositorySchema,
  selectRepositorySchema,
} from "@db/console/schema";
```

#### `database/refine.ts`

```typescript
import { z } from "zod";
import { insertWorkspaceSchema, insertStoreSchema } from "@db/console/schema";
import { workspaceNameSchema, workspaceSlugSchema } from "../primitives/slugs";
import { storeNameSchema, storeSlugSchema } from "../primitives/slugs";

/**
 * Enhanced Workspace Insert Schema
 *
 * Adds custom refinements on top of Drizzle-generated schema
 */
export const refinedInsertWorkspaceSchema = insertWorkspaceSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: workspaceNameSchema,
    slug: workspaceSlugSchema,
  });

export type RefinedInsertWorkspace = z.infer<typeof refinedInsertWorkspaceSchema>;

/**
 * Enhanced Store Insert Schema
 *
 * Adds custom refinements on top of Drizzle-generated schema
 */
export const refinedInsertStoreSchema = insertStoreSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    slug: storeSlugSchema,
  });

export type RefinedInsertStore = z.infer<typeof refinedInsertStoreSchema>;
```

---

### 5. Main Export (`src/index.ts`)

```typescript
/**
 * @repo/console-validation
 *
 * Centralized validation schemas for the Lightfast Console application
 *
 * This package provides:
 * - Primitive Zod schemas (IDs, slugs, names, timestamps)
 * - Domain-specific schemas (workspace, organization, store, job, etc.)
 * - Form validation schemas (client-side React Hook Form)
 * - Database schema integration (Drizzle ORM)
 * - Reusable validation utilities
 */

// Constants (re-export from @db/console)
export {
  CLERK_ORG_SLUG,
  WORKSPACE_NAME,
  STORE_NAME,
  NAMING_ERRORS,
  validateOrgSlug,
  validateWorkspaceName,
  validateStoreName,
} from "@db/console/constants/naming";

// Primitives
export * from "./primitives/ids";
export * from "./primitives/slugs";
export * from "./primitives/names";

// Domain Schemas
export * from "./schemas/workspace";
export * from "./schemas/organization";
export * from "./schemas/store";
export * from "./schemas/api-key";
export * from "./schemas/integration";
export * from "./schemas/job";

// Form Schemas
export * from "./forms/workspace-form";
export * from "./forms/team-form";
export * from "./forms/integration-form";

// Database Integration
export * from "./database";
export * from "./database/refine";

// Utilities
export * from "./utils/error-map";
export * from "./utils/validation";
```

---

## Usage Examples

### Before (Duplicated)

**Client-side form:**
```typescript
// apps/console/src/app/(app)/new/_components/workspace-form-schema.ts
import { z } from "zod";
import { WORKSPACE_NAME, NAMING_ERRORS } from "@db/console/constants/naming";

export const workspaceFormSchema = z.object({
  organizationId: z.string().min(1),
  workspaceName: z
    .string()
    .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
    .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
    .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
});
```

**Server-side tRPC:**
```typescript
// api/console/src/router/workspace.ts
import { z } from "zod";
import { WORKSPACE_NAME, NAMING_ERRORS } from "@db/console/constants/naming";

create: protectedProcedure
  .input(
    z.object({
      clerkOrgId: z.string(),
      workspaceName: z
        .string()
        .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
        .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
        .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
    })
  )
  .mutation(async ({ ctx, input }) => { /* ... */ })
```

### After (DRY)

**Client-side form:**
```typescript
// apps/console/src/app/(app)/new/_components/workspace-form.tsx
import { workspaceFormSchema, type WorkspaceFormValues } from "@repo/console-validation";

// That's it! No need to define the schema again
```

**Server-side tRPC:**
```typescript
// api/console/src/router/workspace.ts
import { workspaceCreateInputSchema } from "@repo/console-validation";

create: protectedProcedure
  .input(workspaceCreateInputSchema)
  .mutation(async ({ ctx, input }) => { /* ... */ })
```

---

## Migration Strategy

### Phase 1: Create Package (1 day)

1. Scaffold `@repo/console-validation` package
2. Implement primitives (IDs, slugs, names)
3. Implement domain schemas (workspace, organization, store, job)
4. Implement form schemas
5. Add to pnpm workspace

### Phase 2: Migrate tRPC Routers (1 day)

1. Update `api/console/src/router/workspace.ts` to use validation package
2. Update `api/console/src/router/organization.ts`
3. Update `api/console/src/router/stores.ts`
4. Update `api/console/src/router/jobs.ts`
5. Update remaining routers

### Phase 3: Migrate Client Forms (1 day)

1. Update workspace creation form
2. Update team creation form
3. Update workspace settings form
4. Update team settings form
5. Remove old `*-schema.ts` files

### Phase 4: Enhance Database Integration (0.5 day)

1. Add refined insert schemas with custom validations
2. Update services to use refined schemas
3. Test database inserts with enhanced validation

### Phase 5: Testing & Cleanup (0.5 day)

1. Run typecheck across all packages
2. Run builds to ensure no breaking changes
3. Test forms and API endpoints
4. Remove duplicate schema files
5. Update documentation

**Total Estimated Time:** 4 days

---

## Benefits Analysis

### Code Reduction

**Before:**
- 6 form schema files (avg 20 lines each) = 120 lines
- 20+ tRPC input schemas (avg 10 lines each) = 200 lines
- Drizzle refinements (6 tables × 10 lines) = 60 lines
- **Total:** ~380 lines of duplicated validation code

**After:**
- 1 validation package with ~300 lines (centralized, reusable)
- Form files: 1-2 imports per file = 40 lines
- tRPC routers: 1 import per procedure = 40 lines
- **Total:** ~380 lines → **80 lines** (79% reduction in consumer code)

### Type Safety Improvements

- ✅ Single source of truth for validation rules
- ✅ Automatic type inference from schemas
- ✅ Compile-time errors if schemas don't match
- ✅ Easier refactoring (change schema once, update everywhere)

### Developer Experience

- ✅ One import instead of 5-10 lines of schema definition
- ✅ Intellisense autocomplete for all schemas
- ✅ Consistent naming conventions across codebase
- ✅ Easier onboarding (check one package for all validation rules)

### Maintainability

- ✅ Update validation rule once, applies everywhere
- ✅ Clear separation of concerns (validation logic in one place)
- ✅ Easier testing (test validation package in isolation)
- ✅ Version validation rules independently

---

## Integration with Drizzle

### Current Drizzle Pattern (Keep)

```typescript
// @db/console/src/schema/tables/workspaces.ts
export const workspaces = pgTable("workspaces", { /* ... */ });

export const insertWorkspaceSchema = createInsertSchema(workspaces);
export const selectWorkspaceSchema = createSelectSchema(workspaces);
```

**This is GOOD** - Drizzle generates base schemas from database schema.

### Enhanced Pattern (Add)

```typescript
// @repo/console-validation/src/database/refine.ts
import { insertWorkspaceSchema } from "@db/console/schema";
import { workspaceNameSchema, workspaceSlugSchema } from "../primitives/slugs";

export const refinedInsertWorkspaceSchema = insertWorkspaceSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: workspaceNameSchema,  // Add custom validation
    slug: workspaceSlugSchema,   // Add custom validation
  });
```

**Benefits:**
- Keep Drizzle as source of truth for database schema
- Add business logic validation on top (naming rules, regex, etc.)
- Use refined schemas in services/routers for stricter validation
- Use base Drizzle schemas for database operations (keeps compatibility)

---

## Alternative Considered: Keep Current Architecture

**Pros:**
- Already working well
- Constants centralized in `naming.ts`
- Clear three-layer validation

**Cons:**
- Duplication across 30+ files
- Easy to miss updating a validation rule in one location
- No reusable schema primitives (rebuild patterns each time)
- Harder to maintain as app grows (more forms, more routes)

**Verdict:** Migration to `@repo/console-validation` provides significant long-term benefits for minimal short-term cost (4 days).

---

## Recommendation

✅ **Proceed with `@repo/console-validation` package**

**Why:**
1. Your codebase is already well-structured (centralized constants)
2. Migration is straightforward (mostly replacing imports)
3. Benefits compound over time (new features use package from day 1)
4. Follows existing pattern (`@repo/console-webhooks`, `@repo/console-oauth`, etc.)
5. Improves DX without sacrificing type safety or validation rigor

**Next Steps:**
1. Approve this proposal
2. Create `@repo/console-validation` package (Phase 1)
3. Migrate tRPC routers (Phase 2)
4. Migrate client forms (Phase 3)
5. Test and cleanup (Phase 4-5)

---

## Questions for Discussion

1. **Package Naming:** `@repo/console-validation` or `@repo/validation`?
2. **Database Integration:** Should we re-export Drizzle schemas or only provide refined versions?
3. **Form Utilities:** Should we include form helper functions (formatters, parsers)?
4. **Migration Timeline:** Can we allocate 4 days for this migration?
5. **Testing Strategy:** Unit tests for validation package or rely on integration tests?

---

**End of Proposal**
