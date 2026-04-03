# Drop Workspace Abstraction — Cleanup Plan

## Overview

Addresses the remaining gaps from the `drop-workspace-abstraction` refactor (research: `thoughts/shared/research/2026-04-03-drop-workspace-abstraction-gap-analysis.md`). The core migration is functionally complete. This plan covers dead code, stale comments, naming inconsistencies, and the medium-severity SDK header bug.

## Current State Analysis

The drop-workspace-abstraction refactor completed all 6 phases. Remaining items fall into three categories:

1. **Dead code** — workspace functions that still exist but are unreachable (not exported, no callers)
2. **Naming inconsistencies** — files and types that still carry "workspace" names but operate on org-scoped data
3. **SDK header bug** — `core/lightfast/src/client.ts` still sends `X-Workspace-ID` header; the server now expects `X-Org-ID`

### Key discoveries:
- `db/app/src/utils/workspace-names.ts:18` — `generateWorkspaceName()`, `generateRandomSlug()`, `validateWorkspaceSlug()` defined but not exported from `db/app/src/index.ts` (only `generateStoreSlug` / `validateStoreSlug` are); also `WORKSPACE_SLUG_MAX_LENGTH` is dead
- `core/lightfast/src/types.ts:119` — `workspaceId: string` field in `LightfastConfig`; `client.ts:54,72` stores and sends it as `X-Workspace-ID: this.workspaceId` at line 239
- `apps/app/src/components/workspace-search.tsx:58` — `WorkspaceSearch` component, `WorkspaceSearchProps` (line 48); internally uses `X-Org-ID` correctly
- `apps/app/src/components/use-workspace-search-params.ts:26` — `useWorkspaceSearchParams` hook; functional, name only
- `packages/app-embed/src/utils.ts:102` — `WorkspaceEmbeddingConfig` interface; `createEmbeddingProviderForWorkspace` at line 143; called from `api/platform/src/inngest/functions/memory-entity-embed.ts:185`
- `packages/prompt-engine/src/types.ts:60` — `UserContext.workspace` field (holds org-level data: name, description, repos, integrations)
- Stale comments in `activity.ts`, `layout.tsx`, `with-api-key-auth.ts`

## Desired End State

All workspace-specific identifiers removed from non-SDK internal code. SDK updated to use `orgId` / `X-Org-ID`. No callers broken.

Verify with:
- `pnpm typecheck` passes across all packages
- `pnpm check` passes
- Search for `workspaceId` across `core/lightfast/src/` returns zero results
- Search for `WorkspaceEmbeddingConfig` returns zero results
- Search for `workspace-search` filename returns zero results

## What We're NOT Doing

- The 3 missing tRPC procedures (`connections.resources.updateEvents`, `linkVercelProject`, `unlinkVercelProject`) — no UI callers, removing dead feature surface is out of scope
- Renaming `workspace.event` Upstash Realtime channel name — it's a semantic event label, not a workspace scoping mechanism
- Marketing/docs copy changes in `apps/www/`
- Renaming `packages/app-auth-middleware/src/workspace.ts` file — file still re-exports `verifyOrgAccess`; safe naming artifact, not worth the rename churn
- Renaming `workspace` field in AI tool names (`workspaceSearch`, `workspaceContents`, etc.) in `packages/app-ai` — semantic query tool labels

---

## Phase 1 — Dead Code Removal & Stale Comments

### Overview

Remove unreachable workspace functions from `workspace-names.ts`. Clean stale workspace references from JSDoc and inline comments. No functional code changes.

### Changes Required

#### 1. `db/app/src/utils/workspace-names.ts`

Remove the three dead workspace functions and the `WORKSPACE_SLUG_MAX_LENGTH` constant (only used by those functions). Keep `STORE_SLUG_MAX_LENGTH`, `generateStoreSlug`, and `validateStoreSlug` intact.

**File**: `db/app/src/utils/workspace-names.ts`

Remove lines 1–71 (everything before `generateStoreSlug`):
- `WORKSPACE_SLUG_MAX_LENGTH` constant (line 7)
- `generateWorkspaceName()` (lines 18–25)
- `generateRandomSlug()` (lines 38–49)
- `validateWorkspaceSlug()` (lines 55–71)

The file header comment at lines 3–6 refers to "workspace/store slug generation" — update to "store slug generation" after removing workspace content.

Result after edit:

```typescript
import { friendlyWords } from "@repo/lib/friendly-words";

/**
 * Minimal constants for store slug generation
 * Full validation constants are in @repo/app-validation
 */
const STORE_SLUG_MAX_LENGTH = 20; // Pinecone constraint

/**
 * Generate a Pinecone-compliant store slug
 * Sanitizes user input to meet Pinecone constraints
 */
export function generateStoreSlug(name: string): string {
  // ... unchanged
}

/**
 * Validate a store slug meets Pinecone constraints
 */
export function validateStoreSlug(slug: string): boolean {
  // ... unchanged
}
```

#### 2. `api/app/src/lib/activity.ts`

Update stale comments at:
- Line 66: `/** Workspace ID */` → `/** Org ID */`
- Lines 44–58 JSDoc example: replace `entityType: "workspace"`, `entityId: "ws_123"`, `category: "workspace"` with `entityType: "org"`, `entityId: "org_xxx"`, `category: "org"`
- Lines 193–207 JSDoc `@example`: replace `category: "workspace"`, `action: "workspace.updated"`, `entityType: "workspace"`, `entityId: clerkOrgId` with `category: "org"`, `action: "org.updated"`, `entityType: "org"`

#### 3. `apps/app/src/app/(app)/(org)/[slug]/layout.tsx`

Line 21: change stale comment from:
```
* 2. Prefetches workspace list via user-scoped endpoint (allows pending users)
```
to:
```
* 2. Validates org access and sets up org context
```

#### 4. `apps/app/src/app/(api)/lib/with-api-key-auth.ts`

Update stale JSDoc block (lines 39–48):
- Line 39: `* Verify workspace-scoped API key` → `* Verify org-scoped API key`
- Line 44: remove/replace `* The workspace is determined by the key binding, NOT by X-Workspace-ID header.` → `* The org is determined by the key binding.`
- Line 45: remove `* This prevents unauthorized access to other workspaces.` → `* This prevents unauthorized access to other orgs.`
- Line 47: `* @returns AuthResult with workspace context from the key binding` → `* @returns AuthResult with org context from the key binding`

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes: `pnpm --filter @db/app typecheck && pnpm --filter @api/app typecheck`
- [x] `pnpm check` passes: `pnpm check`
- [x] `generateWorkspaceName` not found: `grep -r "generateWorkspaceName" db/app/src/` returns nothing
- [x] `validateWorkspaceSlug` not found: `grep -r "validateWorkspaceSlug" db/app/src/` returns nothing

#### Manual Verification:
- [ ] `db/app/src/utils/workspace-names.ts` contains only `generateStoreSlug` and `validateStoreSlug`

---

## Phase 2 — Naming Consistency: Search Component & Hook

### Overview

Rename `workspace-search.tsx` → `org-search.tsx`, `use-workspace-search-params.ts` → `use-org-search-params.ts`. Update all component names, type names, and imports.

### Changes Required

#### 1. Rename files

```
apps/app/src/components/workspace-search.tsx → apps/app/src/components/org-search.tsx
apps/app/src/components/use-workspace-search-params.ts → apps/app/src/components/use-org-search-params.ts
```

#### 2. `apps/app/src/components/org-search.tsx` (renamed from `workspace-search.tsx`)

- Import: `useWorkspaceSearchParams` → `useOrgSearchParams` (from `./use-org-search-params`)
- Interface: `WorkspaceSearchProps` → `OrgSearchProps`
- Component: `WorkspaceSearch` → `OrgSearch`
- Component: `WorkspaceSearchSkeleton` → `OrgSearchSkeleton`
- Export names updated accordingly

#### 3. `apps/app/src/components/use-org-search-params.ts` (renamed from `use-workspace-search-params.ts`)

- Function: `useWorkspaceSearchParams` → `useOrgSearchParams`
- Export updated accordingly

#### 4. Find and update all import sites

Search `apps/app/src/` for:
- `workspace-search` (filename references in imports)
- `WorkspaceSearch` (component name)
- `WorkspaceSearchSkeleton` (loading state)
- `useWorkspaceSearchParams` (hook name)
- `WorkspaceSearchProps` (type)

Update each import to use the new names.

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes: `pnpm --filter @app/app typecheck`
- [x] `pnpm check` passes: `pnpm check`
- [x] No old references remain: `grep -r "WorkspaceSearch\|workspace-search\|useWorkspaceSearchParams" apps/app/src/` returns nothing

#### Manual Verification:
- [ ] Search page loads and functions correctly in the browser

---

## Phase 3 — Naming Consistency: Embed Types & Prompt-Engine Field

### Overview

Rename `WorkspaceEmbeddingConfig` → `OrgEmbeddingConfig` and `createEmbeddingProviderForWorkspace` → `createEmbeddingProviderForOrg` in `@repo/app-embed`. Update the call site in `memory-entity-embed.ts`. Rename `workspace` field → `org` in `packages/prompt-engine/src/types.ts`.

### Changes Required

#### 1. `packages/app-embed/src/utils.ts`

- Interface `WorkspaceEmbeddingConfig` (line 102) → `OrgEmbeddingConfig`
- Update JSDoc: "Workspace configuration" → "Org configuration"; "Workspace ID for error messages" → "Org ID for error messages"
- Function `createEmbeddingProviderForWorkspace` (line 143) → `createEmbeddingProviderForOrg`
- Parameter name `workspace: WorkspaceEmbeddingConfig` → `org: OrgEmbeddingConfig`
- Update JSDoc examples in the function (line ~137): replace "workspace" references

#### 2. `packages/app-embed/src/index.ts`

Update re-exports (lines 20, 25):
```typescript
// Before
createEmbeddingProviderForWorkspace,
type WorkspaceEmbeddingConfig,

// After
createEmbeddingProviderForOrg,
type OrgEmbeddingConfig,
```

#### 3. `api/platform/src/inngest/functions/memory-entity-embed.ts`

Update call site (lines 185–195):
```typescript
// Before
const { createEmbeddingProviderForWorkspace } = await import("@repo/app-embed");
const embeddingProvider = createEmbeddingProviderForWorkspace(
  { id: clerkOrgId, embeddingModel: ..., embeddingDim: ... },
  { inputType: "search_document" }
);

// After
const { createEmbeddingProviderForOrg } = await import("@repo/app-embed");
const embeddingProvider = createEmbeddingProviderForOrg(
  { id: clerkOrgId, embeddingModel: ..., embeddingDim: ... },
  { inputType: "search_document" }
);
```

#### 4. `packages/prompt-engine/src/types.ts`

Update `UserContext` interface (lines 59–67):
```typescript
// Before
/** User context — workspace info (future: preferences, activity) */
export interface UserContext {
  workspace?: {
    name: string;
    description?: string;
    repos: string[];
    integrations: string[];
  };
}

// After
/** User context — org info (future: preferences, activity) */
export interface UserContext {
  org?: {
    name: string;
    description?: string;
    repos: string[];
    integrations: string[];
  };
}
```

Then find and update all callers of `UserContext.workspace` across the codebase (likely in `apps/app/src/ai/prompts/sections/workspace-context.ts` and `packages/prompt-engine/src/`).

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes: `pnpm --filter @repo/app-embed typecheck && pnpm --filter @api/platform typecheck && pnpm --filter @repo/prompt-engine typecheck`
- [x] `pnpm check` passes: `pnpm check`
- [x] No old names remain: `grep -r "WorkspaceEmbeddingConfig\|createEmbeddingProviderForWorkspace\|UserContext.*workspace" packages/ api/` returns nothing

#### Manual Verification:
- [ ] Ingest pipeline runs an embed step successfully (check Inngest dashboard or local trigger)

---

## Phase 4 — SDK: `workspaceId` → `orgId`, `X-Workspace-ID` → `X-Org-ID`

### Overview

Update the public SDK (`core/lightfast/src/`) to use `orgId` and `X-Org-ID`. This is the only medium-severity gap: external SDK consumers calling `/search` would send the wrong header today.

**Note**: This is a breaking change to the public SDK interface. The `workspaceId` field in `LightfastConfig` must be renamed to `orgId`. Existing consumers must update their instantiation.

### Changes Required

#### 1. `core/lightfast/src/types.ts`

Update `LightfastConfig` interface (lines 97–120):
```typescript
export interface LightfastConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  /**
   * Org ID to scope API requests.
   * Required for all query operations.
   */
  orgId: string;
}
```

Remove: `workspaceId: string` (line 119)

#### 2. `core/lightfast/src/client.ts`

- Private field `workspaceId` (line 54) → `orgId`
- Constructor validation `if (!config.workspaceId)` (line 67) → `if (!config.orgId)`
- Assignment `this.workspaceId = config.workspaceId` (line 72) → `this.orgId = config.orgId`
- Header `"X-Workspace-ID": this.workspaceId` (line 239) → `"X-Org-ID": this.orgId`

Also update JSDoc examples in the class (if any reference `workspaceId`).

### Success Criteria

#### Automated Verification:
- [x] `pnpm typecheck` passes: `pnpm --filter lightfast typecheck`
- [x] `pnpm check` passes: `pnpm check`
- [x] No `workspaceId` in SDK: `grep -r "workspaceId" core/lightfast/src/` returns nothing
- [x] No `X-Workspace-ID` in SDK: `grep -r "X-Workspace-ID" core/lightfast/src/` returns nothing

#### Manual Verification:
- [ ] Verify `X-Org-ID` header is visible in network requests when using the SDK against local dev

**Implementation Note**: This is the only external-facing change. After completing Phase 4, pause for confirmation that any internal usage of the SDK (e.g., examples, test scripts) has been updated before marking complete.

---

## Testing Strategy

### Automated:
- `pnpm typecheck` at root to catch all cross-package type errors after each phase
- `pnpm check` (Biome lint/format) after each phase

### Manual:
- After Phase 2: Load the search page in the app, verify it renders and searches correctly
- After Phase 3: Trigger a memory embed Inngest function (or check the last run in the Inngest dashboard)
- After Phase 4: Instantiate the SDK locally with `orgId`, verify `X-Org-ID` header sent

## References

- Gap analysis: `thoughts/shared/research/2026-04-03-drop-workspace-abstraction-gap-analysis.md`
- Original plan: `thoughts/shared/plans/2026-04-03-drop-workspace-abstraction.md`
- `core/lightfast/src/client.ts:239` — `X-Workspace-ID` header
- `core/lightfast/src/types.ts:119` — `workspaceId` in `LightfastConfig`
- `packages/app-embed/src/utils.ts:102,143` — `WorkspaceEmbeddingConfig`, `createEmbeddingProviderForWorkspace`
- `api/platform/src/inngest/functions/memory-entity-embed.ts:185` — call site
- `apps/app/src/components/workspace-search.tsx:58` — `WorkspaceSearch` component
- `packages/prompt-engine/src/types.ts:61` — `UserContext.workspace` field
