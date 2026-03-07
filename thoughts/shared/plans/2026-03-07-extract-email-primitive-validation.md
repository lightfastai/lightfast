# Extract Email Validation Primitive

## Overview

Extract a reusable `emailSchema` Zod primitive from `forms/auth-form.ts` into `primitives/emails.ts`, delete the form file, and update all consumers in `packages/console-validation` and `apps/auth` to use the new primitive.

## Current State Analysis

The email validation `z.string().email("Please enter a valid email address")` is duplicated in 5 locations:

| File | Schema | Notes |
|---|---|---|
| `packages/console-validation/src/forms/auth-form.ts` | `authEmailFormSchema` | `z.object({ email })` — consumed by auth app |
| `packages/console-validation/src/forms/early-access-form.ts` | `earlyAccessFormSchema` | Adds `.min(1).toLowerCase().trim()` |
| `apps/auth/.../sign-up-password.tsx:21-24` | `signUpPasswordSchema` | Inline, also has password field |
| `apps/chat/.../sign-in-email-input.tsx:21-23` | `emailSchema` | Inline (out of scope) |
| `apps/chat/.../sign-up-email-input.tsx:21-23` | `emailSchema` | Inline (out of scope) |

### Key Discoveries:
- Primitives are field-level schemas; forms are composed `z.object` schemas — `slugs.ts:39` (`clerkOrgSlugSchema`) and `names.ts:27` (`displayNameSchema`) are the pattern to follow
- `forms/auth-form.ts` is re-exported from both `forms/index.ts:10` and `src/index.ts:130` — both barrel files need updating
- `apps/chat` does NOT depend on `@repo/console-validation` — out of scope
- `apps/auth` already depends on `@repo/console-validation` via `@repo/console-validation/forms`

## Desired End State

- A single `emailSchema` primitive in `primitives/emails.ts` as the source of truth for email field validation
- `forms/auth-form.ts` deleted — consumers define trivial `z.object({ email: emailSchema })` inline
- `early-access-form.ts` composes `emailSchema` with additional transforms
- `apps/auth` sign-up-password uses the primitive for its email field
- No breaking exports — `authEmailFormSchema` was only consumed by 2 files in `apps/auth`, both updated

### Verification:
- `pnpm typecheck` passes across monorepo
- `pnpm lint` passes
- Auth app sign-in/sign-up flows work (manual)

## What We're NOT Doing

- Updating `apps/chat` inline schemas (no `@repo/console-validation` dependency)
- Adding a `passwordSchema` primitive (separate concern)
- Changing the `earlyAccessFormSchema` API surface (just composing differently internally)

## Implementation Approach

Single phase — this is a small, low-risk refactor with no data model or API changes.

## Phase 1: Extract Primitive & Update Consumers

### Overview
Create the email primitive, delete `auth-form.ts`, update all barrel exports, and update consumer files.

### Changes Required:

#### 1. Create `primitives/emails.ts`
**File**: `packages/console-validation/src/primitives/emails.ts` (new)
**Changes**: New file with `emailSchema` primitive

```typescript
/**
 * Email Validation Primitives
 *
 * Reusable Zod schema for validating email addresses.
 */

import { z } from "zod";

/**
 * Email Schema
 *
 * Validates email address format.
 *
 * Used in: Auth forms, early access form, sign-up flows
 *
 * @example
 * ```typescript
 * emailSchema.parse("user@example.com"); // Valid
 * emailSchema.parse("invalid");          // Invalid
 * ```
 */
export const emailSchema = z
  .string()
  .email("Please enter a valid email address");
```

#### 2. Export from `primitives/index.ts`
**File**: `packages/console-validation/src/primitives/index.ts`
**Changes**: Add `export * from "./emails";`

#### 3. Delete `forms/auth-form.ts`
**File**: `packages/console-validation/src/forms/auth-form.ts`
**Changes**: Delete entirely

#### 4. Update `forms/index.ts`
**File**: `packages/console-validation/src/forms/index.ts`
**Changes**: Remove `export * from "./auth-form";`

#### 5. Update `src/index.ts`
**File**: `packages/console-validation/src/index.ts`
**Changes**: Replace `export * from "./forms/auth-form";` with `export * from "./primitives/emails";` (already covered by primitives barrel, but maintains explicit re-export pattern used for other primitives at lines 51-53)

#### 6. Update `forms/early-access-form.ts`
**File**: `packages/console-validation/src/forms/early-access-form.ts`
**Changes**: Compose `emailSchema` primitive instead of inline `z.string().email()`

```typescript
import { z } from "zod";
import { emailSchema } from "../primitives/emails";

export const earlyAccessFormSchema = z.object({
	email: emailSchema
		.min(1, "Email is required")
		.toLowerCase()
		.trim(),
	companySize: z
		.string()
		.min(1, "Company size is required"),
	sources: z
		.array(z.string())
		.min(1, "Please select at least one data source"),
});

export type EarlyAccessFormValues = z.infer<typeof earlyAccessFormSchema>;
```

#### 7. Update `apps/auth` sign-in-email-input.tsx
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-in-email-input.tsx`
**Changes**: Replace `authEmailFormSchema` import with inline definition using `emailSchema` primitive

```diff
- import { authEmailFormSchema } from "@repo/console-validation/forms";
- import type { AuthEmailFormValues } from "@repo/console-validation/forms";
+ import { emailSchema } from "@repo/console-validation/primitives";
+
+ const authEmailFormSchema = z.object({
+ 	email: emailSchema,
+ });
+ type AuthEmailFormValues = z.infer<typeof authEmailFormSchema>;
```

Note: This file already imports `z` indirectly via `@hookform/resolvers/zod`. Need to add `import { z } from "zod";` if not already present. Checking the file — it does NOT import `z` directly, so we need to add it.

#### 8. Update `apps/auth` sign-up-email-input.tsx
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-email-input.tsx`
**Changes**: Same pattern as sign-in-email-input.tsx

```diff
- import { authEmailFormSchema } from "@repo/console-validation/forms";
- import type { AuthEmailFormValues } from "@repo/console-validation/forms";
+ import { emailSchema } from "@repo/console-validation/primitives";
+
+ const authEmailFormSchema = z.object({
+ 	email: emailSchema,
+ });
+ type AuthEmailFormValues = z.infer<typeof authEmailFormSchema>;
```

Note: This file also does NOT import `z` directly — need to add `import { z } from "zod";`.

#### 9. Update `apps/auth` sign-up-password.tsx
**File**: `apps/auth/src/app/(app)/(auth)/_components/sign-up-password.tsx`
**Changes**: Use `emailSchema` primitive for the email field in the password form schema

```diff
+ import { emailSchema } from "@repo/console-validation/primitives";
+
  const signUpPasswordSchema = z.object({
- 	email: z.string().email("Please enter a valid email address"),
+ 	email: emailSchema,
  	password: z.string().min(8, "Password must be at least 8 characters"),
  });
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] `primitives/emails.ts` exists and exports `emailSchema`
- [ ] `forms/auth-form.ts` no longer exists
- [ ] No remaining imports of `authEmailFormSchema` from `@repo/console-validation/forms`
- [ ] No remaining imports of `AuthEmailFormValues` from `@repo/console-validation/forms`

#### Manual Verification:
- [ ] Auth app sign-in email flow works (`pnpm dev:auth`, enter email on sign-in page)
- [ ] Auth app sign-up email flow works (enter email on sign-up page)
- [ ] Auth app sign-up password flow works (enter email + password)
- [ ] Early access form on www site validates email correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

## References

- Existing primitive pattern: `packages/console-validation/src/primitives/slugs.ts:39` (`clerkOrgSlugSchema`)
- Form composing primitive: `packages/console-validation/src/forms/team-form.ts:9` (imports `clerkOrgSlugSchema`)
- Auth app consumers: `apps/auth/src/app/(app)/(auth)/_components/sign-{in,up}-email-input.tsx`
