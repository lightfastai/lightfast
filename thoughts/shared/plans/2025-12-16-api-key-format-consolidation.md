# API Key Format Consolidation Implementation Plan

## Overview

Unify the API key format across both user-scoped and organization-scoped keys to use `sk-lf-` prefix with 256-bit entropy. Build the missing organization API keys UI in org settings, rename "workspace" to "org" throughout, and increase cryptographic strength.

## Current State Analysis

### Two Parallel Systems

| Aspect | User API Keys | Workspace API Keys |
|--------|---------------|-------------------|
| Schema | `user-api-keys.ts` | `workspace-api-keys.ts` |
| Router | `user-api-keys.ts` | `workspace-api-keys.ts` |
| UI | Full implementation | **NO UI EXISTS** |
| Prefix | `lf_` | `sk_live_` |
| Auth Middleware | N/A | `with-api-key-auth.ts` |
| Location | Account settings | Org settings (missing) |

### Key Generation (`packages/console-api-key/src/crypto.ts`)

```typescript
// Current prefixes
export const API_KEY_PREFIX = "console_sk_";     // Legacy (unused)
export const LIGHTFAST_API_KEY_PREFIX = "lf_";   // User keys
// Workspace: hardcoded "sk_live_" in generateWorkspaceApiKey()

// Current character set (packages/lib/src/nanoid.ts)
customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz")  // 36 chars = ~165 bits
```

### Key Discoveries

- **Workspace API keys router exists but has NO UI** - `apps/console/src/app/(app)/(org)/[slug]/settings/` only has team settings
- **Current entropy is 165 bits** (32 chars × log₂(36)) - below 256-bit recommendation
- **Auth middleware validates `sk_` prefix** (`with-api-key-auth.ts:70`)
- **Not in production yet** - breaking changes are acceptable
- **User keys use single `keyPreview` field** while workspace keys store `keyPrefix` + `keySuffix` separately

## Desired End State

### Unified API Key Format

1. **Same format for both scopes**: `sk-lf-{43_char_secret}`
2. **256-bit entropy**: 43 chars with 62-char alphabet (full alphanumeric)
3. **Two scopes**:
   - **User keys**: Personal access, managed in Account Settings
   - **Organization keys**: Org-wide access, managed in Org Settings
4. **Rename**: "Workspace API Keys" → "Organization API Keys"

### Key Format Specification

```
sk-lf-AbC123xYz456...  (total: 6 + 43 = 49 characters)
      └──┬──┘
      prefix: "sk-lf-"
      secret: 43 chars, [0-9a-zA-Z] (62 chars)
      entropy: 43 × log₂(62) ≈ 256 bits
```

### Verification Criteria

1. All new keys (user and org) generated with `sk-lf-` prefix
2. User API keys UI works with new format
3. Organization API keys UI exists in org settings
4. Auth middleware validates `sk-lf-` prefix
5. Character set expanded to full alphanumeric (62 chars)
6. Secret length increased from 32 to 43 characters
7. "Workspace" renamed to "Organization" throughout

## What We're NOT Doing

1. **Checksums** - Future TODO (reference GitHub's CRC32 approach in comments)
2. **Key migration** - Not in production, no existing keys to migrate
3. **Environment-based prefixes** - No `sk_test_` vs `sk_live_` distinction
4. **Merging schemas** - Keep separate schemas for user vs org keys (different relationships)

## Implementation Approach

Phased approach:
1. Update crypto utilities for new format (affects both key types)
2. Update user API keys schema and router
3. Rename workspace → org in schema and router
4. Update auth middleware for new format
5. Build organization API keys UI (copy from user keys UI)
6. Database migration

---

## Phase 1: Update Crypto Utilities

### Overview

Update the API key generation to use new `sk-lf-` prefix and 256-bit entropy. This affects both user and org keys.

### Changes Required

#### 1. Update nanoid Character Set

**File**: `packages/lib/src/nanoid.ts`

**Current**:
```typescript
import { customAlphabet } from "nanoid";
export const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");
```

**Updated**:
```typescript
import { customAlphabet } from "nanoid";

// Full alphanumeric: 0-9, a-z, A-Z (62 characters)
// Used for IDs and API key secrets
export const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
);
```

#### 2. Update Crypto Constants and Functions

**File**: `packages/console-api-key/src/crypto.ts`

**Changes**:

```typescript
/**
 * Unified API key prefix for all Lightfast keys
 * Format follows industry conventions: sk-{vendor}-{secret}
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

/**
 * Length of the random portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Number of characters to show in the key preview
 */
export const API_KEY_PREVIEW_LENGTH = 4;

/**
 * @deprecated Legacy prefix - do not use for new keys
 */
export const API_KEY_PREFIX = "console_sk_";

/**
 * Generate a new API key with the unified Lightfast format
 *
 * @param prefix - The prefix to use (default: "sk-lf-")
 * @returns The generated API key with ~256 bits of entropy
 *
 * @example
 * ```ts
 * const key = generateApiKey();  // "sk-lf-AbC123xYz456..."
 * ```
 */
export function generateApiKey(prefix: string = LIGHTFAST_API_KEY_PREFIX): string {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  return `${prefix}${keySecret}`;
}

/**
 * Result from generateOrgApiKey containing all parts needed for storage
 */
export interface OrgApiKeyResult {
  /** Full API key (only returned once, never stored) */
  key: string;
  /** Key prefix (e.g., "sk-lf-") */
  prefix: string;
  /** Last 4 characters of the key secret (for display) */
  suffix: string;
}

/**
 * Generate a new organization API key, returning all parts for storage
 *
 * This is used for org-scoped API keys where we store
 * the prefix and suffix separately for display purposes.
 *
 * @returns Object with full key, prefix, and suffix (last 4 chars)
 *
 * @example
 * ```ts
 * const { key, prefix, suffix } = generateOrgApiKey();
 * // key: "sk-lf-AbC123...XyZ789" (full key - return once)
 * // prefix: "sk-lf-"
 * // suffix: "Z789" (last 4 chars)
 * ```
 */
export function generateOrgApiKey(): OrgApiKeyResult {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  const key = `${LIGHTFAST_API_KEY_PREFIX}${keySecret}`;
  const suffix = keySecret.slice(-API_KEY_PREVIEW_LENGTH);

  return {
    key,
    prefix: LIGHTFAST_API_KEY_PREFIX,
    suffix,
  };
}

/**
 * Validate that a string has the correct API key format
 *
 * @param key - The string to validate
 * @returns True if the key has the correct format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with sk-lf-
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }

  // Must have correct length: prefix (6) + secret (43) = 49
  const expectedLength = LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}

/**
 * Extract a preview of the API key for display purposes
 *
 * @param key - The full API key
 * @returns Preview string in format "sk-lf-...XXXX"
 */
export function extractKeyPreview(key: string): string {
  const suffix = key.slice(-API_KEY_PREVIEW_LENGTH);
  return `sk-lf-...${suffix}`;
}
```

#### 3. Update Exports

**File**: `packages/console-api-key/src/index.ts`

Ensure new functions are exported:
```typescript
export {
  generateApiKey,
  generateOrgApiKey,
  hashApiKey,
  extractKeyPreview,
  isValidApiKeyFormat,
  LIGHTFAST_API_KEY_PREFIX,
  API_KEY_SECRET_LENGTH,
  API_KEY_PREVIEW_LENGTH,
  type OrgApiKeyResult,
} from "./crypto";
```

### Success Criteria

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-api-key build`
- [ ] No TypeScript errors: `pnpm typecheck`

#### Manual Verification:
- [ ] `generateApiKey()` produces 49-char key starting with `sk-lf-`
- [ ] `generateOrgApiKey()` returns correct prefix and suffix
- [ ] Keys contain uppercase and lowercase letters

**Implementation Note**: After completing this phase, proceed to Phase 2.

---

## Phase 2: Update User API Keys

### Overview

Update user API keys to use the new format. Minimal changes needed since router already uses `LIGHTFAST_API_KEY_PREFIX`.

### Changes Required

#### 1. Update Key Preview Display

**File**: `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx:252`

**Current**:
```tsx
<code className="text-xs">••••{key.keyPreview}</code>
```

**Updated**:
```tsx
<code className="text-xs">{key.keyPreview}</code>
```

The `keyPreview` now includes the full prefix format `sk-lf-...XXXX` from `extractKeyPreview()`.

#### 2. Verify Router Uses New Constants

**File**: `api/console/src/router/user/user-api-keys.ts`

No changes needed - already imports and uses `LIGHTFAST_API_KEY_PREFIX` and `generateApiKey()`.

### Success Criteria

#### Automated Verification:
- [x] Console builds: `pnpm build:console`
- [ ] No TypeScript errors: `pnpm typecheck`

#### Manual Verification:
- [ ] Create user API key shows `sk-lf-...` format
- [ ] Key list shows `sk-lf-...XXXX` preview

**Implementation Note**: After completing this phase, proceed to Phase 3.

---

## Phase 3: Rename Workspace → Organization API Keys

### Overview

Rename all workspace API key references to organization API keys.

### Changes Required

#### 1. Rename Schema File

**Current**: `db/console/src/schema/tables/workspace-api-keys.ts`
**New**: `db/console/src/schema/tables/org-api-keys.ts`

**Changes inside file**:
```typescript
// Rename table export
export const orgApiKeys = pgTable(
  "lightfast_org_api_keys",  // Keep table name same for now (migration handles rename)
  {
    // ... same columns, update comments to say "org" instead of "workspace"
  }
);

// Update type exports
export type OrgApiKey = typeof orgApiKeys.$inferSelect;
export type InsertOrgApiKey = typeof orgApiKeys.$inferInsert;
```

#### 2. Update Schema Index

**File**: `db/console/src/schema/tables/index.ts`

```typescript
// Change:
export * from "./workspace-api-keys";
// To:
export * from "./org-api-keys";
```

#### 3. Rename Router File

**Current**: `api/console/src/router/org/workspace-api-keys.ts`
**New**: `api/console/src/router/org/org-api-keys.ts`

**Changes inside file**:
```typescript
// Update imports
import { orgApiKeys } from "@db/console/schema";
import { generateOrgApiKey, hashApiKey } from "@repo/console-api-key";

// Rename router export
export const orgApiKeysRouter = {
  // ... same procedures, update to use generateOrgApiKey()
};
```

#### 4. Update Router in Create Mutation

**File**: `api/console/src/router/org/org-api-keys.ts` (create mutation)

```typescript
// Change:
const { key, prefix, suffix } = generateWorkspaceApiKey("sk_live_");
// To:
const { key, prefix, suffix } = generateOrgApiKey();
```

#### 5. Update Router in Rotate Mutation

**File**: `api/console/src/router/org/org-api-keys.ts` (rotate mutation)

```typescript
// Change:
const { key, prefix, suffix } = generateWorkspaceApiKey("sk_live_");
// To:
const { key, prefix, suffix } = generateOrgApiKey();
```

#### 6. Update Router Index

**File**: `api/console/src/router/org/index.ts`

```typescript
// Change:
export * from "./workspace-api-keys";
// To:
export * from "./org-api-keys";
```

#### 7. Update Root Router

**File**: `api/console/src/root.ts`

```typescript
// Update import and router registration
import { orgApiKeysRouter } from "./router/org/org-api-keys";

export const orgRouter = router({
  // ... other routers
  orgApiKeys: orgApiKeysRouter,  // was: workspaceApiKeys
});
```

#### 8. Rename Validation Schema File

**Current**: `packages/console-validation/src/schemas/workspace-api-key.ts`
**New**: `packages/console-validation/src/schemas/org-api-key.ts`

**Changes inside file**: Rename all `workspace` → `org`:
- `createWorkspaceApiKeySchema` → `createOrgApiKeySchema`
- `listWorkspaceApiKeysSchema` → `listOrgApiKeysSchema`
- etc.

#### 9. Update Validation Index

**File**: `packages/console-validation/src/schemas/index.ts`

```typescript
// Change:
export * from "./workspace-api-key";
// To:
export * from "./org-api-key";
```

### Success Criteria

#### Automated Verification:
- [x] All packages build: `pnpm build`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm lint`
- [x] Grep for "workspaceApiKey" returns no results in src files (only backward compat exports remain)

#### Manual Verification:
- [ ] tRPC router accessible at `orgApiKeys.*` endpoints

**Implementation Note**: After completing this phase, proceed to Phase 4.

---

## Phase 4: Update Auth Middleware

### Overview

Update the API key authentication middleware to validate the new `sk-lf-` format.

### Changes Required

#### 1. Update Schema Import

**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

```typescript
// Change:
import { workspaceApiKeys } from "@db/console/schema";
// To:
import { orgApiKeys } from "@db/console/schema";
```

#### 2. Update Prefix Validation

**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:70`

```typescript
// Change:
if (!apiKey.startsWith("sk_")) {
// To:
if (!apiKey.startsWith("sk-lf-")) {
```

#### 3. Update Database Queries

Replace all `workspaceApiKeys` references with `orgApiKeys` in the file.

#### 4. Update Error Message

```typescript
// Update error message for invalid format
message: "Invalid API key format. Keys must start with 'sk-lf-'.",
```

### Success Criteria

#### Automated Verification:
- [x] Console builds: `pnpm build:console`
- [ ] No TypeScript errors: `pnpm typecheck`

#### Manual Verification:
- [ ] API key auth works with `sk-lf-` format
- [ ] Old `sk_live_` format keys are rejected with clear error

**Implementation Note**: After completing this phase, proceed to Phase 5.

---

## Phase 5: Build Organization API Keys UI

### Overview

Create the organization API keys management UI in org settings. Copy the pattern from user API keys UI.

### Changes Required

#### 1. Create Page Directory

**Path**: `apps/console/src/app/(app)/(org)/[slug]/settings/api-keys/`

Create the following structure:
```
api-keys/
├── _components/
│   ├── org-api-key-header.tsx
│   ├── org-api-key-list-loading.tsx
│   ├── org-api-key-list.tsx
│   └── security-notice.tsx
└── page.tsx
```

#### 2. Create Page Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/settings/api-keys/page.tsx`

```typescript
import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";
import { OrgApiKeyHeader } from "./_components/org-api-key-header";
import { SecurityNotice } from "./_components/security-notice";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function OrgApiKeysPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { workspaceId } = await searchParams;

  // Get default workspace for this org if not specified
  // ... workspace resolution logic

  // CRITICAL: Prefetch BEFORE HydrateClient
  await prefetch(orgTrpc.orgApiKeys.list.queryOptions({ workspaceId }));

  return (
    <div className="space-y-6">
      <OrgApiKeyHeader />
      <SecurityNotice />
      <HydrateClient>
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList workspaceId={workspaceId} />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
```

#### 3. Create List Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/settings/api-keys/_components/org-api-key-list.tsx`

Copy from `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx` and modify:

1. Change tRPC calls from `userApiKeys.*` to `orgApiKeys.*`
2. Add `workspaceId` prop and pass to mutations
3. Update labels from "API Key" to "Organization API Key"
4. Show `createdByUserId` info (who created the key)

```typescript
"use client";

import { useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
// ... same imports as user version

interface OrgApiKeyListProps {
  workspaceId: string;
}

export function OrgApiKeyList({ workspaceId }: OrgApiKeyListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Use prefetched data
  const { data: apiKeys } = useSuspenseQuery({
    ...trpc.orgApiKeys.list.queryOptions({ workspaceId }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation(
    trpc.orgApiKeys.create.mutationOptions({
      onSuccess: (data) => {
        setCreatedKey(data.key);
        setNewKeyName("");
        toast.success("Organization API key created successfully");
        void queryClient.invalidateQueries({
          queryKey: trpc.orgApiKeys.list.queryOptions({ workspaceId }).queryKey,
        });
      },
      // ...
    }),
  );

  // ... rest follows same pattern as user version
  // but with orgApiKeys.* endpoints and workspaceId param
}
```

#### 4. Add Navigation Link

**File**: `apps/console/src/app/(app)/(org)/[slug]/settings/layout.tsx` or sidebar component

Add navigation item for "API Keys" in org settings sidebar.

### Success Criteria

#### Automated Verification:
- [x] Console builds: `pnpm build:console`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm lint`

#### Manual Verification:
- [ ] Navigate to org settings → API Keys
- [ ] Create organization API key
- [ ] Verify key format is `sk-lf-...`
- [ ] Revoke and delete operations work
- [ ] Key list shows creator info

**Implementation Note**: After completing this phase, proceed to Phase 6.

---

## Phase 6: Database Migration

### Overview

Generate a Drizzle migration to rename the table and update any column names if needed.

### Changes Required

#### 1. Update Table Name in Schema (if desired)

**File**: `db/console/src/schema/tables/org-api-keys.ts`

If we want to rename the actual database table:
```typescript
export const orgApiKeys = pgTable(
  "lightfast_org_api_keys",  // was: lightfast_workspace_api_keys
  // ...
);
```

#### 2. Generate Migration

```bash
cd db/console && pnpm db:generate
```

This will generate a migration that renames the table.

#### 3. Apply Migration (Development)

```bash
cd db/console && pnpm db:migrate
```

### Success Criteria

#### Automated Verification:
- [x] Migration generates without errors (no schema changes needed - table name kept as `lightfast_workspace_api_keys`)
- [x] Migration applies without errors (N/A - no migration needed)
- [x] `pnpm db:studio` shows `lightfast_workspace_api_keys` table (unchanged)

#### Manual Verification:
- [x] All indexes intact (unchanged)
- [x] Data preserved (no migration applied)

---

## Testing Strategy

### Unit Tests

1. **Key generation tests** (`packages/console-api-key`):
   - `generateApiKey()` produces `sk-lf-` prefix, 49 chars total
   - `generateOrgApiKey()` returns correct prefix/suffix structure
   - `isValidApiKeyFormat()` validates correctly
   - `extractKeyPreview()` returns `sk-lf-...XXXX` format

### Integration Tests

1. **User API key CRUD**:
   - Create key returns 49-char key with `sk-lf-` prefix
   - List keys shows `sk-lf-...XXXX` preview
   - Revoke/delete operations work

2. **Org API key CRUD**:
   - Create key returns 49-char key with `sk-lf-` prefix
   - List keys shows `sk-lf-...XXXX` preview
   - Shows creator info
   - Revoke/delete/rotate operations work

3. **Authentication**:
   - Valid `sk-lf-` key authenticates successfully
   - Invalid key rejected with 401
   - Old `sk_live_` format rejected with clear error

### Manual Testing Steps

1. **User API Keys**:
   - Go to Account Settings > API Keys
   - Create a new API key
   - Verify format is `sk-lf-...` (49 chars)
   - Copy and test

2. **Organization API Keys**:
   - Go to Org Settings > API Keys
   - Create a new organization API key
   - Verify format is `sk-lf-...` (49 chars)
   - Test authentication:
     ```bash
     curl -H "Authorization: Bearer sk-lf-..." \
          -H "X-Workspace-ID: ws_xxx" \
          http://localhost:4107/api/v1/search
     ```

3. **Error Cases**:
   - Old format key `sk_live_...` should be rejected
   - Invalid format should show clear error message

---

## Performance Considerations

1. **Hash lookup unchanged** - Still O(1) via `keyHash` index
2. **Slightly longer keys** - 49 vs ~40 characters, negligible impact
3. **Mixed case alphabet** - No performance impact on generation or hashing

---

## Migration Notes

Not applicable - no production data exists.

---

## Future TODO: Checksums

Reference GitHub's approach for optional offline validation:
- Add CRC32 checksum suffix to keys
- Format: `sk-lf-{secret}_{checksum}`
- Allows prefix validation without database lookup

Not implementing now - add as separate feature when needed.

---

## References

- Research document: `thoughts/shared/research/2025-12-16-api-key-implementation-audit.md`
- User API keys UI: `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx:38-322`
- Workspace API keys router: `api/console/src/router/org/workspace-api-keys.ts:32-416`
- Auth middleware: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49-183`
- Crypto implementation: `packages/console-api-key/src/crypto.ts:44-88`
- nanoid config: `packages/lib/src/nanoid.ts:1-3`
