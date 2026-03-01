# Org-Level API Keys — Remove Workspace Scoping

## Overview

Refactor API keys from workspace-scoped to org-scoped. Currently each key is bound to a specific workspace via `workspaceId` FK, requiring workspace selection in the UI and limiting key access to a single workspace. After this change, a key authenticates the **org** and can access **all workspaces** within that org. Workspace context moves to request-level input (body params) instead of key-level binding.

## Current State Analysis

**Schema** (`db/console/src/schema/tables/org-api-keys.ts:29`):
- Table `lightfast_workspace_api_keys` has `workspaceId` varchar FK to `orgWorkspaces.id` (line 52-54)
- `clerkOrgId` is denormalized alongside workspaceId (line 59)
- Indexes: `workspaceIdIdx`, `workspaceActiveIdx` compound — both reference workspaceId

**CRUD Router** (`api/console/src/router/org/org-api-keys.ts:32`):
- `list` requires `workspaceId` input, queries by workspace
- `create` requires `workspaceId`, FK-validates workspace ownership, stores on key
- `revoke`/`delete`/`rotate` all verify workspace→org ownership in a two-step check

**Auth Layer** (`api/console/src/trpc.ts:505`):
- `verifyApiKey()` returns `{ workspaceId, userId, apiKeyId }` from DB row (line 719-723)
- `apiKeyProcedure` sets `ctx.auth.workspaceId` and validates `X-Workspace-ID` header match
- `with-api-key-auth.ts` returns `workspaceId` in `ApiKeyAuthContext`

**UI** (`apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/`):
- Page forces workspace selection via `WorkspaceSelector` component before showing keys
- `OrgApiKeyList` receives `workspaceId` as prop, passes to all mutations

### Key Discoveries:
- `recordCriticalActivity` (line 136-150 in router) inserts into `workspaceUserActivities` — workspace-scoped activity log. Key CRUD will need to either skip this or pass a null workspace.
- `db.batch()` is used for rotation (line 356) since neon-http has no transaction support
- The table is named `lightfast_workspace_api_keys` (line 30) — we keep the physical table name to avoid a rename migration; Drizzle maps it via the `orgApiKeys` variable already

## Desired End State

- API keys scoped to **org** (`clerkOrgId`), not workspace
- No `workspaceId` column in `orgApiKeys` table
- No workspace selector in API keys settings UI
- `verifyApiKey()` returns `{ orgId, userId, apiKeyId }` (orgId = clerkOrgId)
- `apiKeyProcedure` auth context: `{ type: "apiKey", orgId, userId, apiKeyId }`
- v1 REST auth (`withApiKeyAuth`) returns `{ orgId, userId, apiKeyId, clerkOrgId }`
- Downstream consumers that need workspace get it from request body/input, not auth context

### Verification:
- `pnpm db:generate` produces a clean migration dropping `workspaceId` + indexes
- `pnpm db:migrate` applies cleanly
- `pnpm typecheck` passes across all packages
- `pnpm lint` passes
- API keys page loads without workspace selector, shows all org keys
- Creating/revoking/deleting/rotating keys works without workspace context

## What We're NOT Doing

- Renaming the physical table `lightfast_workspace_api_keys` (Drizzle maps it fine)
- Updating v1 REST routes to accept workspace from body (separate task — those routes still work, they just get `orgId` instead of `workspaceId` from auth)
- Adding workspace-level permissions to keys (e.g., restricting a key to specific workspaces)
- Updating the docs site (`apps/docs/`) — separate PR
- Updating OpenAPI spec (`packages/console-openapi/`) — separate PR
- Changing client-side callers that send `X-Workspace-ID` header — separate task

## Implementation Approach

Bottom-up: schema → validation → router → auth layer → UI → cleanup. Each phase is independently verifiable.

---

## Phase 1: Database Schema Migration

### Overview
Remove `workspaceId` column and its indexes from `orgApiKeys`. Add a replacement composite index on `(clerkOrgId, isActive)`.

### Changes Required:

#### 1. Schema Table
**File**: `db/console/src/schema/tables/org-api-keys.ts`

Remove the `workspaceId` column (lines 49-54), its import of `orgWorkspaces` (line 12), and two indexes: `workspaceIdIdx` (line 140) and `workspaceActiveIdx` (lines 152-155). Add a composite index `clerkOrgActiveIdx` on `(clerkOrgId, isActive)`.

```ts
// REMOVE: import { orgWorkspaces } from "./org-workspaces";
// REMOVE: workspaceId column (lines 49-54)
// REMOVE: workspaceIdIdx index (line 140)
// REMOVE: workspaceActiveIdx index (lines 152-155)

// ADD: composite index replacing workspaceActiveIdx
clerkOrgActiveIdx: index("org_api_key_clerk_org_active_idx").on(
  table.clerkOrgId,
  table.isActive
),
```

Also remove the backward-compat exports at lines 163-169 (`workspaceApiKeys`, `WorkspaceApiKey`, `InsertWorkspaceApiKey`) — nothing should use them after this change.

#### 2. Generate Migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria:

#### Automated Verification:
- [x] `cd db/console && pnpm db:generate` produces a migration with DROP COLUMN + DROP INDEX
- [x] `cd db/console && pnpm db:migrate` applies cleanly
- [x] `pnpm typecheck` — expect type errors from downstream consumers (proceed to Phase 2)

#### Manual Verification:
- [x] Inspect generated `.sql` migration file — confirm it drops `workspace_id`, `ws_api_key_workspace_id_idx`, `ws_api_key_workspace_active_idx` and creates `org_api_key_clerk_org_active_idx`

**Implementation Note**: Type errors are expected after this phase — Phase 2 fixes them.

---

## Phase 2: Validation Schemas + tRPC Router

### Overview
Update Zod schemas to remove `workspaceId`, refactor all 5 CRUD procedures to scope by `clerkOrgId` (from `ctx.auth.orgId`) instead of `workspaceId`.

### Changes Required:

#### 1. Validation Schemas
**File**: `packages/console-validation/src/schemas/org-api-key.ts`

```ts
// createOrgApiKeySchema — remove workspaceId
export const createOrgApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

// listOrgApiKeysSchema — remove workspaceId entirely (list uses org from auth context)
// DELETE this schema — list takes no input, org comes from ctx.auth.orgId
```

Remove `listOrgApiKeysSchema` and its type export `ListOrgApiKeys`. The `list` procedure will use org context from auth, no input needed.

#### 2. tRPC Router — All 5 Procedures
**File**: `api/console/src/router/org/org-api-keys.ts`

**`list` (lines 37-82)**: Remove `workspaceId` input. Query by `clerkOrgId = ctx.auth.orgId` instead.

```ts
list: orgScopedProcedure.query(async ({ ctx }) => {
  const keys = await ctx.db
    .select({
      // same columns minus workspaceId
      publicId: orgApiKeys.publicId,
      name: orgApiKeys.name,
      keyPrefix: orgApiKeys.keyPrefix,
      keySuffix: orgApiKeys.keySuffix,
      isActive: orgApiKeys.isActive,
      expiresAt: orgApiKeys.expiresAt,
      lastUsedAt: orgApiKeys.lastUsedAt,
      createdAt: orgApiKeys.createdAt,
    })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.clerkOrgId, ctx.auth.orgId))
    .orderBy(desc(orgApiKeys.createdAt));

  return keys.map((key) => ({
    id: key.publicId,
    name: key.name,
    keyPreview: `${key.keyPrefix}...${key.keySuffix}`,
    isActive: key.isActive,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
  }));
}),
```

**`create` (lines 88-161)**: Remove `workspaceId` from input and insert. Use `ctx.auth.orgId` for `clerkOrgId`. Remove workspace ownership verification (lines 92-105).

```ts
create: orgScopedProcedure
  .input(createOrgApiKeySchema)
  .mutation(async ({ ctx, input }) => {
    const { key, prefix, suffix } = generateOrgApiKey();
    const keyHash = await hashApiKey(key);

    const [inserted] = await ctx.db
      .insert(orgApiKeys)
      .values({
        clerkOrgId: ctx.auth.orgId,
        createdByUserId: ctx.auth.userId,
        name: input.name,
        keyHash,
        keyPrefix: prefix,
        keySuffix: suffix,
        ...(input.expiresAt && {
          expiresAt: input.expiresAt.toISOString(),
        }),
      })
      .returning({ id: orgApiKeys.id, publicId: orgApiKeys.publicId });

    // ... recordCriticalActivity (see note below) ...

    return {
      id: inserted.publicId,
      key, // Full key — only returned once!
      name: input.name,
      keyPreview: `${prefix}...${suffix}`,
      expiresAt: input.expiresAt?.toISOString() ?? null,
      createdAt: new Date().toISOString(),
    };
  }),
```

**`revoke` (lines 167-236)**: Remove workspace ownership check. Verify key belongs to org via `clerkOrgId`.

```ts
// Find key and verify org ownership in one query:
const existingKey = await ctx.db
  .select()
  .from(orgApiKeys)
  .where(
    and(
      eq(orgApiKeys.publicId, input.keyId),
      eq(orgApiKeys.clerkOrgId, ctx.auth.orgId)
    )
  )
  .then((rows) => rows[0]);

if (!existingKey) throw new TRPCError({ code: "NOT_FOUND" });
if (!existingKey.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Key is already revoked" });
```

**`delete` (lines 242-304)**: Same pattern — find by `publicId` + `clerkOrgId`, hard delete.

**`rotate` (lines 310-416)**: Same pattern — find by `publicId` + `clerkOrgId`, batch revoke+insert without `workspaceId`.

#### 3. Activity Recording
The `recordCriticalActivity` calls currently include workspace context. Since keys are now org-scoped, we have two options:
- **Option A**: Remove `recordCriticalActivity` from key CRUD (simplest, activity is org-level)
- **Option B**: Keep it but without workspace reference

**Decision**: Remove `recordCriticalActivity` from key CRUD. API key management is an org-level operation; workspace-scoped activity logs are the wrong place. We can add org-level audit logging later.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-validation typecheck` passes
- [x] `pnpm --filter @api/console typecheck` passes
- [x] `pnpm --filter @api/console build` passes

#### Manual Verification:
- [ ] N/A — UI not yet updated

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Auth Layer — `apiKeyProcedure` + v1 REST Auth

### Overview
Update the API key authentication layer to return `orgId` (from `clerkOrgId`) instead of `workspaceId`. Remove `X-Workspace-ID` header validation from the API key auth path.

### Changes Required:

#### 1. `verifyApiKey` Function
**File**: `api/console/src/trpc.ts` (lines 670-724)

Change the return type from `{ workspaceId, userId, apiKeyId }` to `{ orgId, userId, apiKeyId }`:

```ts
async function verifyApiKey(key: string) {
  const hash = await hashApiKey(key);

  const [foundKey] = await db
    .select({
      clerkOrgId: orgApiKeys.clerkOrgId,
      createdByUserId: orgApiKeys.createdByUserId,
      publicId: orgApiKeys.publicId,
      isActive: orgApiKeys.isActive,
      expiresAt: orgApiKeys.expiresAt,
      id: orgApiKeys.id,
    })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.keyHash, hash), eq(orgApiKeys.isActive, true)));

  // ... same validation (not found, expired) ...

  // Non-blocking lastUsedAt update (keep as-is)

  return {
    orgId: foundKey.clerkOrgId,
    userId: foundKey.createdByUserId,
    apiKeyId: foundKey.publicId,
  };
}
```

#### 2. `apiKeyProcedure` Middleware
**File**: `api/console/src/trpc.ts` (lines 505-544)

Remove `X-Workspace-ID` header validation (lines 523-531). Set `ctx.auth` with `orgId`:

```ts
const { orgId, userId, apiKeyId } = await verifyApiKey(apiKey);

// Remove X-Workspace-ID header check entirely

return next({
  ctx: {
    ...ctx,
    auth: {
      type: "apiKey" as const,
      orgId,
      userId,
      apiKeyId,
    },
  },
});
```

Update the auth context type (around line 50) to use `orgId` instead of `workspaceId` for the `"apiKey"` type.

#### 3. v1 REST Auth — `withApiKeyAuth`
**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

Update `ApiKeyAuthContext` interface (line 15-18):
```ts
export interface ApiKeyAuthContext {
  orgId: string;      // was: workspaceId
  userId: string;
  apiKeyId: string;
  clerkOrgId: string; // same value as orgId, kept for backward compat
}
```

Remove the `X-Workspace-ID` mismatch warning (lines 146-155). Return `orgId` from `foundKey.clerkOrgId`.

#### 4. v1 REST Auth — `withDualAuth`
**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`

For the API key path (line 62-78), forward `orgId` instead of `workspaceId`. The `DualAuthContext` type needs to make `workspaceId` available from either the API key's org context or the session's header.

**Note**: The v1 routes currently expect `workspaceId` on the auth result. Since we're NOT updating v1 routes in this PR (out of scope), we need a transitional approach. For the API key path in `withDualAuth`, we should require `X-Workspace-ID` header for now (validating it belongs to the org) until v1 routes are updated to read workspace from body.

```ts
// API key path in withDualAuth
if (token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
  const apiKeyResult = await withApiKeyAuth(request, requestId);
  if (!apiKeyResult.success) return apiKeyResult;

  // For v1 routes, workspace still comes from header (temporary)
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    return { success: false, status: 400, error: "MISSING_WORKSPACE", message: "X-Workspace-ID header required" };
  }

  // TODO: validate workspaceId belongs to apiKeyResult.auth.orgId

  return {
    success: true,
    auth: {
      workspaceId,
      userId: apiKeyResult.auth.userId,
      authType: "api-key",
      apiKeyId: apiKeyResult.auth.apiKeyId,
    },
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes across all packages
- [x] `pnpm lint` passes
- [x] `pnpm --filter @api/console build` passes

#### Manual Verification:
- [x] N/A — functional testing in Phase 4

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Console UI

### Overview
Remove the workspace selector from the API keys settings page. Show all org-level keys directly. Simplify the component tree.

### Changes Required:

#### 1. Settings Page
**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/page.tsx`

Remove `searchParams`, workspace prefetch, conditional workspace selector. Prefetch org-level key list. The page becomes much simpler:

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";
import { SecurityNotice } from "./_components/security-notice";

export default async function OrgApiKeysPage() {
  prefetch(orgTrpc.orgApiKeys.list.queryOptions());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          API Keys
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Manage API keys for your organization. Keys can access all workspaces.
        </p>
      </div>
      <HydrateClient>
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList />
        </Suspense>
      </HydrateClient>
      <SecurityNotice />
    </div>
  );
}
```

#### 2. API Key List Component
**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx`

Remove `workspaceId` prop. Update query and mutations:
- `useSuspenseQuery` with `trpc.orgApiKeys.list.queryOptions()` (no workspaceId)
- `createMutation.mutate({ name })` (no workspaceId)
- All other mutations unchanged (they use `keyId`, not `workspaceId`)

#### 3. Delete Workspace Selector
**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/workspace-selector.tsx`

Delete this file entirely — no longer needed.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm build:console` passes

#### Manual Verification:
- [ ] API keys page loads without workspace selector at `/{slug}/settings/api-keys`
- [ ] Create a new API key — key is displayed once, copy works
- [ ] Key appears in the list with `sk-lf-...XXXX` preview
- [ ] Revoke a key — status changes
- [ ] Rotate a key — new key displayed, old key revoked
- [ ] Delete a key — key removed from list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 5.

---

## Phase 5: Cleanup

### Overview
Remove deprecated exports, update integration tests, clean up stale references.

### Changes Required:

#### 1. Integration Test Harness
**File**: `packages/integration-tests/src/harness.ts` (lines 378-419)

`makeApiKeyFixture` currently inserts with `workspaceId`. Remove that field, ensure `clerkOrgId` is provided:

```ts
export async function makeApiKeyFixture(db: Db, overrides: {
  clerkOrgId: string;
  createdByUserId: string;
  name?: string;
}) {
  const { key, prefix, suffix } = generateOrgApiKey();
  const keyHash = await hashApiKey(key);

  const [record] = await db
    .insert(orgApiKeys)
    .values({
      clerkOrgId: overrides.clerkOrgId,
      createdByUserId: overrides.createdByUserId,
      name: overrides.name ?? "test-key",
      keyHash,
      keyPrefix: prefix,
      keySuffix: suffix,
    })
    .returning();

  return { rawKey: key, ...record };
}
```

#### 2. Auth Middleware Package
**File**: `packages/console-auth-middleware/src/resources.ts` (lines 68-105)

`verifyApiKeyOwnership` queries `orgApiKeys` — ensure it doesn't reference `workspaceId`. It currently checks `createdByUserId` which is fine. No `workspaceId` references to remove.

#### 3. Schema Barrel Exports
**File**: `db/console/src/schema/tables/index.ts`

Remove re-exports of `workspaceApiKeys`, `WorkspaceApiKey`, `InsertWorkspaceApiKey` if they exist.

#### 4. API Key Crypto Package
**File**: `packages/console-api-key/src/crypto.ts`

Remove deprecated `generateWorkspaceApiKey` function (lines 153-158).

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes across all packages
- [x] `pnpm lint` passes
- [x] `pnpm build:console` passes
- [x] Integration tests compile (if runnable): `pnpm --filter @repo/integration-tests typecheck`

#### Manual Verification:
- [x] Confirm no remaining references to `workspaceId` in API key code paths (grep check)

---

## Testing Strategy

### Automated:
- TypeScript compilation across all affected packages
- Linting passes
- Build succeeds for console and api packages

### Manual Testing Steps:
1. Navigate to `/{slug}/settings/api-keys` — page loads showing all org keys (no workspace selector)
2. Create a key with name "Test Key" — plaintext key shown once
3. Copy the key, close dialog — key shows as `sk-lf-...XXXX` in list
4. Revoke the key — confirm dialog, key marked inactive
5. Create another key, rotate it — new key shown, old one revoked
6. Delete a revoked key — confirm dialog, key removed
7. Use a created key with `curl` against v1 API with `Authorization: Bearer sk-lf-...` and `X-Workspace-ID` header — should authenticate successfully

## Migration Notes

- The Drizzle migration will DROP the `workspace_id` column from `lightfast_workspace_api_keys`
- Any existing API keys in the database will lose their workspace binding — this is intentional
- The `clerkOrgId` column (already populated on all rows) becomes the sole scoping mechanism
- No data backfill needed — `clerkOrgId` already exists on all rows

## References

- Schema: `db/console/src/schema/tables/org-api-keys.ts`
- Router: `api/console/src/router/org/org-api-keys.ts`
- Auth: `api/console/src/trpc.ts` (apiKeyProcedure, verifyApiKey)
- v1 Auth: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
- UI Page: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/page.tsx`
- Validation: `packages/console-validation/src/schemas/org-api-key.ts`
