# `@repo/app-validation` Cleanup Implementation Plan

## Overview

Slim `packages/app-validation/` from ~140 exports down to the **8 unique symbols** that have real importers anywhere in the monorepo. Delete every fully-dead file, drop unexported variants from partially-used files, and inline the now-internal-only naming constants. The package stays as a shared module — its remaining concern is the activity discriminated union (genuinely shared between `api/app` and `db/app`) plus a handful of single-consumer schemas that we choose to keep co-located in the package for stability.

## Current State Analysis

`packages/app-validation/` exports five subpath surfaces (`.`, `./schemas`, `./forms`, `./constants`, `./primitives`) covering ~140 named exports across 14 source files. A repo-wide audit (excluding `packages/app-validation/`, `node_modules`, `dist`, `.next`, `.turbo`, `.cache`, `thoughts/`) found **only 6 importer files**:

| Importer | Symbols imported | Subpath |
|---|---|---|
| `api/app/src/router/user/organization.ts:1` | `clerkOrgSlugSchema` | `.` |
| `api/app/src/router/org/org-api-keys.ts:3-7` | `createOrgApiKeySchema`, `revokeOrgApiKeySchema`, `deleteOrgApiKeySchema` | `./schemas` |
| `api/app/src/lib/activity.ts:28-33` | `ActivityCategory`, `ActivityMetadata`, `ActivityType`, `activityTypeSchema` | `.` |
| `api/app/src/inngest/workflow/record-activity.ts:17` | `ActivityMetadata` (type) | `.` |
| `db/app/src/schema/tables/org-user-activities.ts:17` | `ActivityCategory`, `ActivityMetadata` (types) | `.` |
| `apps/app/.../settings/_components/team-general-settings-client.tsx:5-6` | `teamSettingsFormSchema`, `TeamSettingsFormValues` | `./forms` |

Glue files referencing the package (preserved, not consumers):

- `apps/app/next.config.ts:28,47` — `transpilePackages` and `serverComponentsExternalPackages`
- `apps/app/vitest.config.ts:21` — `inline: [..., "@repo/app-validation"]`
- `apps/app/package.json:30`, `api/app/package.json:40`, `db/app/package.json:44` — workspace deps
- `pnpm-lock.yaml` (auto-resolved on install)
- `packages/app-reserved-names/README.md:314` — doc reference (keep)

### Key Discoveries

- **Surviving symbols use only 3 subpath exports**: `.`, `./schemas`, `./forms`. The `./constants` and `./primitives` subpath exports have zero external importers.
- **`activityTypeSchema` is a `z.discriminatedUnion`** keyed on `action` over 16 per-variant `*ActivitySchema`s, each embedding its `*MetadataSchema`. The variants must continue to exist (the union depends on them and `safeParse` callers in `activity.ts:119,215,306` rely on per-action metadata-shape validation), but they don't need to be _exported_.
- **`clerkOrgSlugSchema` depends on internal-only constants**: `CLERK_ORG_SLUG`, `NAMING_ERRORS` (the `ORG_*` keys), and `organization.check()` from `@repo/app-reserved-names`. After this cleanup, those constants have no other consumers — they get inlined into `primitives/slugs.ts` so the file is self-contained and `constants/` can be deleted.
- **`apiKeyNameSchema` is genuinely unused**: `schemas/org-api-key.ts:14` defines `name` inline as `z.string().min(1).max(100)` — it does not reference the primitive. Deleting `primitives/names.ts` is safe.
- **`STORE_NAME` constants and `storeNameSchema`** are wired internally (slugs.ts and the constants file), but there are zero external consumers and no surviving feature in the package depends on them — they get deleted alongside the rest of the store schemas.
- **The activity table column types** (`db/app/src/schema/tables/org-user-activities.ts:52,117`) use `.$type<ActivityCategory>()` and `.$type<ActivityMetadata>()` Drizzle casts — types only, not runtime schemas. This is why the type-only re-exports survive.

## Desired End State

After this plan:

- `packages/app-validation/src/` contains exactly these files:
  ```
  primitives/slugs.ts        (clerkOrgSlugSchema only, with inlined CLERK_ORG_SLUG/NAMING_ERRORS)
  primitives/index.ts        (re-exports clerkOrgSlugSchema)
  schemas/activities.ts      (slimmed; only categories/union/types exported)
  schemas/org-api-key.ts     (3 schemas; type aliases dropped)
  schemas/index.ts           (slim re-exports)
  forms/team-form.ts         (teamSettingsFormSchema + TeamSettingsFormValues only)
  forms/index.ts             (slim re-exports)
  index.ts                   (slim root re-exports)
  ```
- `packages/app-validation/package.json` `exports` map drops `./constants` and `./primitives` subpaths (root, `./schemas`, `./forms` remain).
- All 6 importer files compile unchanged (no import-site edits required).
- Repo-wide `pnpm typecheck` and `pnpm check` pass; vitest run for `apps/app` passes; `pnpm build:app` succeeds.

### Verification

- `pnpm --filter @repo/app-validation typecheck` passes
- `rg "@repo/app-validation" --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.next/**' --glob '!packages/app-validation/**' --glob '!thoughts/**' --glob '!pnpm-lock.yaml'` returns the same 6 importer files plus the 3 package.json + 2 config-file glue lines (no new or removed importers)
- `pnpm typecheck` and `pnpm check` (root) pass
- `pnpm --filter @api/app test` passes (covers the org-api-keys router and activity helpers)
- `pnpm --filter @repo/app-validation -- ls src/**/*.ts` lists exactly 8 source files (matches end state above)

## What We're NOT Doing

- **Not collapsing the package.** `@repo/app-validation` survives as a shared module. We picked the slim-and-keep strategy explicitly to preserve the `ActivityCategory` / `ActivityMetadata` shared boundary between `api/app` and `db/app` without forcing types into either side.
- **Not co-locating single-consumer schemas.** `clerkOrgSlugSchema`, the org-api-key trio, and `teamSettingsFormSchema` all have a single consumer today, but moving them adds more diff churn (and rename-all of `@repo/app-validation/forms` etc.) than keeping them in the package. Future co-location is left as a follow-up if the package becomes "activity types only" naturally over time.
- **Not rewriting the activity discriminated union.** The 16 per-variant schemas stay defined inside `activities.ts` — they just lose their `export` keyword. We keep the runtime per-action metadata validation that `activity.ts:119,215,306` rely on.
- **Not editing any consumer file** (`api/app/...`, `db/app/...`, `apps/app/...`). Their imports are preserved one-for-one. If a typecheck pass surfaces a consumer issue, we treat it as a bug in the slimming, not a green light to refactor consumers.
- **Not touching `packages/app-reserved-names`.** `clerkOrgSlugSchema` continues to depend on `organization.check()`. The doc reference in its README at `packages/app-reserved-names/README.md:314` is fine to leave.
- **Not removing `@repo/app-validation` from `apps/app/next.config.ts` `transpilePackages` or `vitest.config.ts` `inline`.** The package remains; those entries still apply.
- **Not modifying `pnpm-lock.yaml` by hand.** Reinstall regenerates it.

## Implementation Approach

Five phases. Phase 0 sets up an isolated worktree (per user request). Phases 1–3 are pure delete/slim operations with TypeScript as the safety net — every step ends with a `pnpm --filter @repo/app-validation typecheck` (fast, package-local) and the consumer typechecks before moving on. Phase 4 trims the package.json subpath map. Phase 5 runs the full repo verification battery before handing back to the user.

Each phase's edits are mechanical and ordered to keep the package compilable at every step. No phase requires touching a consumer file.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Worktree Setup

### Overview

Create an isolated git worktree on a fresh branch so the cleanup happens off the current `refactor/api-platform-app-cleanup` branch. The repo's worktree convention is `~/Code/@lightfastai/worktrees/<suffix>` (the `worktrees/` directory exists and is empty). Worktree-prefixed dev URLs derive automatically from the branch's last segment per `CLAUDE.md` Architecture (sanitized → `<wt>` host prefix).

### Changes Required

#### 1. Create branch + worktree

**Commands** (run from the primary checkout, `/Users/jeevanpillay/Code/@lightfastai/lightfast/`):

```bash
git worktree add -b refactor/app-validation-cleanup \
  /Users/jeevanpillay/Code/@lightfastai/worktrees/app-validation-cleanup \
  main

cd /Users/jeevanpillay/Code/@lightfastai/worktrees/app-validation-cleanup
pnpm install
```

#### 2. Confirm clean baseline

**Commands**:

```bash
pnpm --filter @repo/app-validation typecheck
pnpm --filter @api/app typecheck
pnpm --filter @apps/app typecheck   # or whatever the workspace name is — pnpm -F app/app...
node scripts/with-desktop-env.mjs --print  # optional sanity: verify worktree prefix
```

### Success Criteria

#### Automated Verification

- [x] `git worktree list` includes `refactor/app-validation-cleanup` at `~/Code/@lightfastai/worktrees/app-validation-cleanup`
- [x] `pnpm install` completes without errors in the new worktree
- [x] `pnpm --filter @repo/app-validation typecheck` passes (baseline before edits)
- [x] `pnpm typecheck` (root) passes (baseline before edits)

#### Human Review

- [ ] Confirm the worktree path matches the repo's existing convention before proceeding (look at `~/Code/@lightfastai/worktrees/`) — expected: a single new directory `app-validation-cleanup/` containing a full checkout

---

## Phase 1: Delete Fully-Dead Files

### Overview

Ten files have zero external importers. Delete them outright and remove their re-exports from the four barrel files plus the root `index.ts`. After this phase, the package shrinks to its surviving feature surface.

### Changes Required

#### 1. Delete dead source files

```
packages/app-validation/src/constants/embedding.ts
packages/app-validation/src/forms/auth-form.ts
packages/app-validation/src/forms/early-access-form.ts
packages/app-validation/src/primitives/ids.ts
packages/app-validation/src/primitives/names.ts
packages/app-validation/src/schemas/entities.ts
packages/app-validation/src/schemas/job.ts
packages/app-validation/src/schemas/neural.ts
packages/app-validation/src/schemas/sources.ts
packages/app-validation/src/schemas/store.ts
```

**Command**:

```bash
rm packages/app-validation/src/constants/embedding.ts \
   packages/app-validation/src/forms/auth-form.ts \
   packages/app-validation/src/forms/early-access-form.ts \
   packages/app-validation/src/primitives/ids.ts \
   packages/app-validation/src/primitives/names.ts \
   packages/app-validation/src/schemas/entities.ts \
   packages/app-validation/src/schemas/job.ts \
   packages/app-validation/src/schemas/neural.ts \
   packages/app-validation/src/schemas/sources.ts \
   packages/app-validation/src/schemas/store.ts
```

#### 2. Update `packages/app-validation/src/forms/index.ts`

**File**: `packages/app-validation/src/forms/index.ts`
**Changes**: Drop `auth-form` and `early-access-form` re-exports.

```ts
/**
 * Form Validation Schemas
 *
 * Client-side validation schemas for React Hook Form.
 * Import these in form components and use with zodResolver.
 */

export * from "./team-form";
```

#### 3. Update `packages/app-validation/src/primitives/index.ts`

**File**: `packages/app-validation/src/primitives/index.ts`
**Changes**: Drop `ids` and `names` re-exports.

```ts
/**
 * Validation Primitives
 *
 * Reusable Zod schemas for common validation patterns.
 */

export * from "./slugs";
```

#### 4. Update `packages/app-validation/src/schemas/index.ts`

**File**: `packages/app-validation/src/schemas/index.ts`
**Changes**: Drop `entities`, `job`, `neural`, `sources`, `store` re-exports. Keep `activities` and `org-api-key`.

```ts
/**
 * Domain Schemas
 *
 * Complete validation schemas for business entities.
 * Used in tRPC procedures and business logic.
 */

export * from "./activities";
export * from "./org-api-key";
```

#### 5. Update `packages/app-validation/src/constants/index.ts`

**File**: `packages/app-validation/src/constants/index.ts`
**Changes**: Drop the embedding re-exports. (The naming re-exports survive Phase 1; they're dropped in Phase 3 when the file is deleted.)

```ts
/**
 * Naming Constants and Validation Helpers
 *
 * This is the single source of truth for all naming rules.
 * Exported from this package, used across console app and API.
 */

export {
  CLERK_ORG_SLUG,
  NAMING_ERRORS,
  STORE_NAME,
  validateOrgSlug,
  validateStoreName,
} from "./naming";
```

#### 6. Update `packages/app-validation/src/index.ts`

**File**: `packages/app-validation/src/index.ts`
**Changes**: Drop the embedding-constants re-export block, the `forms/auth-form` and `forms/early-access-form` re-exports, and the schema re-exports for `entities`, `job`, `neural`, `sources`, `store`. Keep the naming-constants block (cleared up in Phase 3), `forms/team-form`, primitives barrel, and the surviving schema barrels (`activities`, `org-api-key`).

```ts
/**
 * @repo/app-validation
 *
 * Centralized validation schemas for the Lightfast Console application.
 *
 * @example
 * ```typescript
 * import { clerkOrgSlugSchema } from "@repo/app-validation/primitives";
 * import { activityTypeSchema } from "@repo/app-validation/schemas";
 * import { NAMING_ERRORS } from "@repo/app-validation/constants";
 * ```
 */

// Constants (explicit exports from leaf modules)
export {
  CLERK_ORG_SLUG,
  NAMING_ERRORS,
  STORE_NAME,
  validateOrgSlug,
  validateStoreName,
} from "./constants/naming";
export * from "./forms/team-form";
// Primitives (direct to leaf modules)
export * from "./primitives/slugs";
export * from "./schemas/activities";
export * from "./schemas/org-api-key";
```

### Success Criteria

#### Automated Verification

- [x] `find packages/app-validation/src -name '*.ts' | sort` lists 10 files: 4 barrels + root `index.ts` + `slugs.ts`, `activities.ts`, `org-api-key.ts`, `team-form.ts`, plus `constants/naming.ts` (plan said 9; root index was missed in count — surviving file set matches plan intent)
- [x] `pnpm --filter @repo/app-validation typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @db/app typecheck` passes (sanity — uses `ActivityCategory`/`ActivityMetadata` types)
- [x] `pnpm typecheck` (root) passes
- [x] `rg "from \"@repo/app-validation/(forms/auth-form|forms/early-access-form|primitives/ids|primitives/names|schemas/entities|schemas/job|schemas/neural|schemas/sources|schemas/store|constants/embedding)\"" packages/app-validation/src/` returns nothing (no internal references to deleted leaves)

---

## Phase 2: Slim Partially-Used Files

### Overview

Three files are partially used. Drop the unused exports while preserving the types/schemas that real consumers import.

### Changes Required

#### 1. `packages/app-validation/src/forms/team-form.ts`

**File**: `packages/app-validation/src/forms/team-form.ts`
**Changes**: Drop `teamFormSchema` and `TeamFormValues` (unused). Keep `teamSettingsFormSchema` and `TeamSettingsFormValues`.

```ts
/**
 * Team Form Schemas
 *
 * Client-side validation schemas for team/organization-related forms.
 * Used with React Hook Form + zodResolver.
 */

import { z } from "zod";
import { clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Team Settings Form Schema
 *
 * Used in:
 * - apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx
 */
export const teamSettingsFormSchema = z.object({
  teamName: clerkOrgSlugSchema,
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsFormSchema>;
```

#### 2. `packages/app-validation/src/schemas/org-api-key.ts`

**File**: `packages/app-validation/src/schemas/org-api-key.ts`
**Changes**: Drop the `CreateOrgApiKey`, `RevokeOrgApiKey`, `DeleteOrgApiKey` type aliases (none of the three is imported anywhere). Keep all three schemas (real consumers).

```ts
import { z } from "zod";

/**
 * Organization API Key Validation Schemas
 *
 * Used in api/app/src/router/org/org-api-keys.ts
 */

export const createOrgApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

export const revokeOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
});

export const deleteOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
});
```

#### 3. `packages/app-validation/src/schemas/activities.ts`

**File**: `packages/app-validation/src/schemas/activities.ts`
**Changes**: This is the largest slim. Strategy: **keep variants internal — drop the `export` keyword on per-variant `*MetadataSchema`s, per-variant `*ActivitySchema`s, and per-variant `*Metadata` type aliases**, while preserving the runtime discriminated-union structure. Also drop `activityActionSchema`, `ActivityAction`, `ACTIVITY_ACTIONS`, `insertActivitySchema`, and `InsertActivity` (none has external importers).

Final exported surface (all five remain): `activityCategorySchema`, `ActivityCategory`, `activityTypeSchema`, `ActivityType`, `ActivityMetadata`.

Concrete edits:

- Remove `export` from each per-variant `*MetadataSchema` (16 schemas spanning lines ~102–319 of the original file)
- Remove `export` from each per-variant `*ActivitySchema` (16 schemas spanning lines ~327–466)
- Remove `export` from each per-variant `*Metadata` type alias (16 type aliases spanning lines ~516–547)
- Delete `activityActionSchema` and `ActivityAction` (lines ~46–48)
- Delete `ACTIVITY_ACTIONS` (lines ~51–85)
- Delete `insertActivitySchema` and `InsertActivity` (lines ~554–577)
- Keep `activityCategorySchema`, `ActivityCategory`, `activityTypeSchema`, `ActivityType`, `ActivityMetadata` exported

```ts
import { z } from "zod";

/**
 * Activity Category Enum
 */
export const activityCategorySchema = z.enum([
  "auth",
  "integration",
  "store",
  "job",
  "search",
  "document",
  "permission",
  "api_key",
  "settings",
]);

export type ActivityCategory = z.infer<typeof activityCategorySchema>;

// ── Per-variant metadata schemas (internal — building blocks for the union) ──

const integrationConnectedMetadataSchema = z
  .object({
    provider: z.string(),
    repoFullName: z.string(),
    repoId: z.string(),
    isPrivate: z.boolean(),
    syncConfig: z.record(z.string(), z.unknown()),
  })
  .passthrough();

// ... (15 more internal metadata schemas with `export` removed, otherwise unchanged)

// ── Per-variant activity schemas (internal) ──

const integrationConnectedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.connected"),
  metadata: integrationConnectedMetadataSchema,
});

// ... (15 more internal activity schemas with `export` removed)

// ── Discriminated Union (exported public surface) ──

export const activityTypeSchema = z.discriminatedUnion("action", [
  integrationConnectedActivitySchema,
  integrationStatusUpdatedActivitySchema,
  integrationConfigUpdatedActivitySchema,
  integrationDisconnectedActivitySchema,
  integrationDeletedActivitySchema,
  integrationMetadataUpdatedActivitySchema,
  storeCreatedActivitySchema,
  jobCancelledActivitySchema,
  jobRestartedActivitySchema,
  apiKeyCreatedActivitySchema,
  apiKeyRevokedActivitySchema,
  apiKeyDeletedActivitySchema,
  apiKeyRotatedActivitySchema,
  searchQueryActivitySchema,
  searchFindSimilarActivitySchema,
  searchContentsActivitySchema,
]);

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type ActivityMetadata = ActivityType["metadata"];
```

> **Implementation note**: do this with targeted `Edit`s — find/replace `export const integrationConnectedMetadataSchema` → `const integrationConnectedMetadataSchema` (and the 15 sibling cases). Don't rewrite the file in one Write — line-by-line edits make the diff reviewable.

#### 4. `packages/app-validation/src/primitives/slugs.ts`

**File**: `packages/app-validation/src/primitives/slugs.ts`
**Changes**: Drop `storeNameSchema` and `repositoryFullNameSchema` (both unused). Keep `clerkOrgSlugSchema` only.

> The file's `STORE_NAME` / `NAMING_ERRORS.STORE_*` imports (used only by the removed schemas) will become dead. They get cleaned up in Phase 3 when we delete `constants/naming.ts`.

```ts
/**
 * Slug Validation Primitives
 */

import { organization } from "@repo/app-reserved-names";
import { z } from "zod";
import { CLERK_ORG_SLUG, NAMING_ERRORS } from "../constants/naming";

/**
 * Clerk Organization Slug Schema
 *
 * Validates org slugs for Clerk + GitHub-org constraints.
 */
export const clerkOrgSlugSchema = z
  .string()
  .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
  .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
  .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
  .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
  .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
  .refine((val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val), {
    message: NAMING_ERRORS.ORG_CONSECUTIVE,
  })
  .refine((slug) => !organization.check(slug), {
    message: NAMING_ERRORS.ORG_RESERVED,
  });
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/app-validation typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes (uses `activityTypeSchema`, `ActivityType`, `ActivityCategory`, `ActivityMetadata`, the org-api-key trio, `clerkOrgSlugSchema`)
- [x] `pnpm --filter @db/app typecheck` passes (uses `ActivityCategory`, `ActivityMetadata` types)
- [x] `pnpm --filter @lightfast/app typecheck` passes (uses `teamSettingsFormSchema`, `TeamSettingsFormValues`) — workspace name is `@lightfast/app`, not `@apps/app`
- [x] `rg "^export (const|type) (integration|store|job|apiKey|search)\w*(Activity|Metadata)Schema" packages/app-validation/src/schemas/activities.ts` returns nothing (per-variant exports removed)
- [x] `rg "^export type (Integration|Store|Job|ApiKey|Search)\w*Metadata\b" packages/app-validation/src/schemas/activities.ts` returns nothing
- [x] `rg "^export const (activityActionSchema|ACTIVITY_ACTIONS|insertActivitySchema)" packages/app-validation/src/schemas/activities.ts` returns nothing
- [x] `rg "^export (const|type) (storeNameSchema|repositoryFullNameSchema)" packages/app-validation/src/primitives/slugs.ts` returns nothing
- [x] `rg "^export (const|type) (teamFormSchema|TeamFormValues)\b" packages/app-validation/src/forms/team-form.ts` returns nothing
- [x] `rg "^export type (CreateOrgApiKey|RevokeOrgApiKey|DeleteOrgApiKey)\b" packages/app-validation/src/schemas/org-api-key.ts` returns nothing

---

## Phase 3: Inline Naming Constants

### Overview

After Phase 2, `constants/naming.ts` is consumed only by `primitives/slugs.ts`, and only the org-slug subset (`CLERK_ORG_SLUG.*`, `NAMING_ERRORS.ORG_*`, the reserved-names guard) is still referenced. Inline that subset into `primitives/slugs.ts` and delete the entire `constants/` directory.

### Changes Required

#### 1. Inline org-slug constants into `primitives/slugs.ts`

**File**: `packages/app-validation/src/primitives/slugs.ts`
**Changes**: Inline the constants directly, drop the `import` from `../constants/naming`.

```ts
/**
 * Org Slug Validation
 *
 * Validates org slugs for Clerk + GitHub-org constraints.
 */

import { organization } from "@repo/app-reserved-names";
import { z } from "zod";

/**
 * Clerk Organization Slug Constraints
 *
 * - Max 39 chars (matches GitHub organization name limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must start/end with letter or number
 * - No consecutive hyphens
 */
const CLERK_ORG_SLUG = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 39,
  PATTERN: /^[a-z0-9-]+$/,
  START_PATTERN: /^[a-z0-9]/,
  END_PATTERN: /[a-z0-9]$/,
  NO_CONSECUTIVE_HYPHENS: /--/,
} as const;

const NAMING_ERRORS = {
  ORG_MIN_LENGTH: `Team name must be at least ${CLERK_ORG_SLUG.MIN_LENGTH} characters`,
  ORG_MAX_LENGTH: `Team name must be less than ${CLERK_ORG_SLUG.MAX_LENGTH} characters`,
  ORG_PATTERN: "Only lowercase letters, numbers, and hyphens are allowed",
  ORG_START: "Must start with a letter or number",
  ORG_END: "Must end with a letter or number",
  ORG_CONSECUTIVE: "Cannot contain consecutive hyphens",
  ORG_RESERVED:
    "This name is reserved for system use. Please choose a different name.",
} as const;

export const clerkOrgSlugSchema = z
  .string()
  .min(CLERK_ORG_SLUG.MIN_LENGTH, NAMING_ERRORS.ORG_MIN_LENGTH)
  .max(CLERK_ORG_SLUG.MAX_LENGTH, NAMING_ERRORS.ORG_MAX_LENGTH)
  .regex(CLERK_ORG_SLUG.PATTERN, NAMING_ERRORS.ORG_PATTERN)
  .regex(CLERK_ORG_SLUG.START_PATTERN, NAMING_ERRORS.ORG_START)
  .regex(CLERK_ORG_SLUG.END_PATTERN, NAMING_ERRORS.ORG_END)
  .refine((val) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(val), {
    message: NAMING_ERRORS.ORG_CONSECUTIVE,
  })
  .refine((slug) => !organization.check(slug), {
    message: NAMING_ERRORS.ORG_RESERVED,
  });
```

#### 2. Delete `constants/` directory

```bash
rm -rf packages/app-validation/src/constants/
```

#### 3. Update root `index.ts` — drop the constants re-export block

**File**: `packages/app-validation/src/index.ts`
**Changes**: Remove the `export { CLERK_ORG_SLUG, NAMING_ERRORS, STORE_NAME, validateOrgSlug, validateStoreName } from "./constants/naming"` block.

Final state:

```ts
/**
 * @repo/app-validation
 */

export * from "./forms/team-form";
export * from "./primitives/slugs";
export * from "./schemas/activities";
export * from "./schemas/org-api-key";
```

### Success Criteria

#### Automated Verification

- [x] `test ! -d packages/app-validation/src/constants` (the directory is gone)
- [x] `pnpm --filter @repo/app-validation typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @lightfast/app typecheck` passes (workspace name is `@lightfast/app`)
- [x] `pnpm --filter @db/app typecheck` passes
- [x] `pnpm typecheck` (root) passes
- [x] `rg "@repo/app-validation/constants" --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!thoughts/**'` returns no hits — also deleted `packages/app-validation/README.md` (heavily stale, referenced fictional `workspace*` schemas; user-approved scope adjustment)

---

## Phase 4: Trim Package Exports Map

### Overview

With `constants/` and `primitives/ids.ts`/`primitives/names.ts` gone, the `./constants` subpath has no leaf to point at, and `./primitives` has only `slugs.ts`. The audit confirmed nothing in the repo imports from `@repo/app-validation/primitives` or `@repo/app-validation/constants`. Remove both subpath entries from `package.json`.

### Changes Required

#### 1. Update `packages/app-validation/package.json`

**File**: `packages/app-validation/package.json`
**Changes**: Drop the `./primitives` and `./constants` entries from the `exports` map. Keep `.`, `./schemas`, `./forms`. Dependencies stay unchanged (`@repo/app-reserved-names` still needed for the inlined slug schema).

```json
{
  "name": "@repo/app-validation",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./schemas": {
      "types": "./src/schemas/index.ts",
      "default": "./src/schemas/index.ts"
    },
    "./forms": {
      "types": "./src/forms/index.ts",
      "default": "./src/forms/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/app-reserved-names": "workspace:^",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

#### 2. Reinstall

```bash
pnpm install
```

(Regenerates the lockfile — no manual edits.)

### Success Criteria

#### Automated Verification

- [x] `node -e "console.log(Object.keys(require('./packages/app-validation/package.json').exports))"` prints `[ '.', './schemas', './forms' ]`
- [x] `pnpm install` succeeds (lockfile regenerates cleanly)
- [x] `pnpm --filter @repo/app-validation typecheck` passes
- [x] `pnpm typecheck` (root) passes
- [x] `rg "@repo/app-validation/(primitives|constants)" --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!pnpm-lock.yaml' --glob '!thoughts/**'` returns no hits

---

## Phase 5: Repo-Wide Verification

### Overview

Final battery: full repo typecheck, lint, vitest, and an explicit consumer-imports audit confirming the surviving 6 importer files still match the pre-cleanup list.

### Changes Required

#### 1. Run full verification

```bash
# From the worktree root
pnpm typecheck
pnpm check
pnpm --filter @api/app test
pnpm --filter @apps/app test 2>&1 | tail -40   # only if vitest is configured for the team-settings client; otherwise skip
pnpm --filter @repo/app-validation typecheck

# Build the apps that depend on the package
pnpm --filter @api/app build
pnpm build:app
```

#### 2. Confirm consumer footprint is unchanged

```bash
rg -l "@repo/app-validation" \
  --glob '!packages/app-validation/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  --glob '!**/.next/**' \
  --glob '!**/.turbo/**' \
  --glob '!**/.cache/**' \
  --glob '!thoughts/**' \
  --glob '!pnpm-lock.yaml'
```

Expected output (exactly these 11 lines, in any order):

```
api/app/src/lib/activity.ts
api/app/src/router/user/organization.ts
api/app/src/router/org/org-api-keys.ts
api/app/src/inngest/workflow/record-activity.ts
db/app/src/schema/tables/org-user-activities.ts
apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx
apps/app/next.config.ts
apps/app/vitest.config.ts
apps/app/package.json
api/app/package.json
db/app/package.json
```

(Plus `packages/app-reserved-names/README.md` if `--glob '!**/README.md'` isn't set — that's the doc reference, expected.)

#### 3. Spot-check the surviving package source files

```bash
find packages/app-validation/src -name '*.ts' | sort
```

Expected (8 files):

```
packages/app-validation/src/forms/index.ts
packages/app-validation/src/forms/team-form.ts
packages/app-validation/src/index.ts
packages/app-validation/src/primitives/index.ts
packages/app-validation/src/primitives/slugs.ts
packages/app-validation/src/schemas/activities.ts
packages/app-validation/src/schemas/index.ts
packages/app-validation/src/schemas/org-api-key.ts
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` (root) passes
- [x] `pnpm check` (biome) passes (after deleting 16 dead per-variant `*Metadata` type aliases — once un-exported, nothing referenced them; biome flagged them as unused)
- [x] `pnpm --filter @api/app test` passes (6/6 in 207ms)
- [~] `pnpm --filter @api/app build` — N/A: `@api/app` is library-only, no `build` script. Plan was over-specified.
- [x] `pnpm build:app` succeeds (16.7s; required copying `apps/app/.vercel/.env.development.local` from primary checkout into the worktree per CLAUDE.md env convention)
- [x] The `rg` consumer-footprint command returns 12 files (11 importer/glue + 1 README) — matches plan expectation. Plan typo: `record-activity.ts` actual path is `api/app/src/inngest/workflow/infrastructure/record-activity.ts` (plan listed without `/infrastructure/`).
- [x] The `find` command returns exactly the 8 expected source files

#### Human Review

- [x] Form validation: verified end-to-end via `tRPC organization.create` (same `clerkOrgSlugSchema` underlies `teamSettingsFormSchema`). Booted dev:app at `https://app-validation-cleanup.app.lightfast.localhost`, provisioned Clerk test user `user_3DWW29Pz79u75XiQu8GOA193iCL` via lightfast-clerk, ran 5 invalid slugs through the live tRPC endpoint. All 5 produced exact `NAMING_ERRORS.*` messages from the inlined constants:
  - `INVALID Slug` → `ORG_PATTERN` ("Only lowercase letters, numbers, and hyphens are allowed") + `ORG_START` ("Must start with a letter or number")
  - `pricing` → `ORG_RESERVED` ("This name is reserved for system use. Please choose a different name.")
  - `ab` → `ORG_MIN_LENGTH` ("Team name must be at least 3 characters")
  - `test--org` → `ORG_CONSECUTIVE` ("Cannot contain consecutive hyphens")
  - `-invalid` → `ORG_START` ("Must start with a letter or number")
- [x] tRPC API path validation: same as above — covered by the 5 live `organization.create` calls returning HTTP 400 with the right messages
- [~] recordActivity flow: full e2e DB write requires Clerk-active user + org membership (Backend-API-provisioned user is `pending`). Verified the load-bearing piece — `activityTypeSchema` discriminated-union runtime validation — via a temporary vitest spec (deleted after run) that exercised 4 valid metadata variants (apikey.created, apikey.revoked, integration.connected, search.query) + 3 invalid shapes (unknown action, missing required field, bad enum). All 9 cases passed (7 schema cases + 2 activityCategorySchema cases). DB row write itself is mechanical; the schema is what changed.
- [x] Verify that the diff for the worktree branch (excluding `pnpm-lock.yaml`) only touches files under `packages/app-validation/` — no consumer files modified (`git diff --name-only main` — 22 paths, all under `packages/app-validation/`; lockfile unchanged)

---

## Testing Strategy

### Unit Tests

The package itself has no test suite today. We do **not** add one as part of this cleanup — the change is purely a deletion + slimming of exports, and TypeScript + the existing api/app tests provide the safety net.

### Integration Tests

The existing `api/app` test suite (`pnpm --filter @api/app test`) covers the org-api-keys router (`createOrgApiKeySchema`, `revokeOrgApiKeySchema`, `deleteOrgApiKeySchema` validation paths) and the activity helpers (`activityTypeSchema.safeParse` paths in `api/app/src/lib/activity.ts:119,215,306`). Running it after each phase confirms the slimming hasn't broken runtime validation.

The team-settings form schema is exercised via the apps/app component using `zodResolver`. If `apps/app` has a vitest target wired for that file, it runs in Phase 5; otherwise the `Human Review` step on the local dev app covers it.

## Performance Considerations

None. Removing dead exports has no runtime impact. Slimming the per-variant schema exports may marginally reduce bundle size for any tree-shaking failure paths, but since the consumers were never importing those schemas anyway, in practice the bundle is unchanged.

## Migration Notes

No data migration. No consumer-side changes. The `@repo/app-validation` package version stays at `0.1.0` (private workspace package — semver doesn't matter for internal consumers, all of which use `workspace:^`).

If a follow-up PR wants to fully co-locate the survivors (the `Hybrid` strategy from planning), that's a clean future refactor on top of this slim baseline.

## References

- Audit research: collected inline in this plan's "Current State Analysis" / "Key Discoveries"
- CLAUDE.md (Architecture, worktree convention): `/Users/jeevanpillay/Code/@lightfastai/lightfast/CLAUDE.md:38,44`
- Importer files (the ground truth for what survives):
  - `api/app/src/router/user/organization.ts:1,59,138`
  - `api/app/src/router/org/org-api-keys.ts:3-7`
  - `api/app/src/lib/activity.ts:28-33,119,215,306`
  - `api/app/src/inngest/workflow/record-activity.ts:17`
  - `db/app/src/schema/tables/org-user-activities.ts:17,52,117`
  - `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx:5-6`
- Glue files (preserved):
  - `apps/app/next.config.ts:28,47`
  - `apps/app/vitest.config.ts:21`
  - `apps/app/package.json:30`, `api/app/package.json:40`, `db/app/package.json:44`
