# Delete `resourceMeta` Dead Code Pipeline

## Overview

Remove the `resourceMeta` / `resourceMetaSchema` pipeline — a dead code path left behind after the ID-as-SoT refactor (commit `e62b3523c`). Data flows from UI adapters through tRPC to `buildProviderConfig`, where it is silently discarded. Zero behaviour change.

## Current State Analysis

The `resourceMetaSchema` mechanism was designed to feed mutable display fields (`fullName`, `key`, `slug`) into `providerConfig`. The "strip mutable display fields" refactor removed all consumers inside `buildProviderConfig`, but left the source pipeline intact:

```
adapters.ts (metadata: { fullName }) → tRPC (z.record().optional()) → buildProviderConfig → /dev/null
```

### Key Discoveries:
- All four `buildProviderConfig` implementations destructure only what they need — none reference `metadata`: `github/index.ts:264`, `linear/index.ts:211`, `sentry/index.ts:112`, `vercel/index.ts:100`
- `PROVIDER_RESOURCE_META` and `ProviderResourceMeta` have zero consumers outside `console-providers` internal files (`registry.ts:148-157`, `index.ts:233,243`, `registry.typetest.ts:146-164`)
- The tRPC input uses `z.record(z.string(), z.string()).optional().default({})` — a completely open record that doesn't even reference `resourceMetaSchema` (`workspace.ts:1139`)
- The `.optional()` markers on schema fields are vestigial — the UI always sends the values, but nothing reads them

## Desired End State

- `resourceMetaSchema` field removed from `ProviderDefinition` interface and `defineProvider` generic params
- `metadata` parameter removed from `buildProviderConfig` contract
- Per-provider `resourceMetaSchema` definitions deleted
- `PROVIDER_RESOURCE_META` and `ProviderResourceMeta` deleted from registry
- `metadata` field removed from tRPC `bulkLinkResources` input schema
- `metadata` removed from UI adapter `buildLinkResources` return types
- Type tests for `ProviderResourceMeta` deleted
- All existing tests pass, typecheck passes, lint passes

### Verification:
```bash
pnpm typecheck
pnpm lint
cd packages/console-providers && pnpm test
```

## What We're NOT Doing

- NOT adding a cache layer for display data (that's a separate future concern)
- NOT changing the `buildLinkResources` interface beyond removing `metadata` — `resourceId` and `resourceName` stay
- NOT modifying the DB schema — no `resourceMeta` column exists
- NOT touching `providerConfig` shapes — they are already correct (IDs only)

## Implementation Approach

Single phase — all changes are mechanical deletions with no behaviour change. The dependency order is: types first (define.ts), then providers, then registry, then consumers (tRPC + UI).

## Phase 1: Delete `resourceMeta` Pipeline

### Overview
Remove the entire dead code path in dependency order: interface → providers → registry → exports → tRPC → UI adapters → type tests.

### Changes Required:

#### 1. Remove `TResourceMetaSchema` from `ProviderDefinition`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Remove `TResourceMetaSchema` generic parameter, the `resourceMetaSchema` field, and `metadata` from `buildProviderConfig` params.

Remove from interface (line 105):
```ts
// DELETE: TResourceMetaSchema extends z.ZodObject = z.ZodObject,
```

Remove from interface body (lines 115-116):
```ts
// DELETE:
// /** Zod schema for extra resource fields sent during bulk-link (beyond resourceId + resourceName). */
// readonly resourceMetaSchema: TResourceMetaSchema;
```

Remove from `buildProviderConfig` params (lines 137-138):
```ts
// DELETE:
// /** Raw metadata from the API request (provider-specific optional fields). */
// metadata: Record<string, unknown>;
```

Remove from `defineProvider` function generic params (line 159):
```ts
// DELETE: TResourceMetaSchema extends z.ZodObject = z.ZodObject,
```

Update the function parameter type and return type to remove `TResourceMetaSchema` from all generic argument lists (lines 162, 164-165).

#### 2. Remove `resourceMetaSchema` from provider definitions
**File**: `packages/console-providers/src/providers/github/index.ts`
**Change**: Delete line 118: `resourceMetaSchema: z.object({ fullName: z.string().optional() }),`

**File**: `packages/console-providers/src/providers/linear/index.ts`
**Change**: Delete line 155: `resourceMetaSchema: z.object({ key: z.string().optional() }),`

**File**: `packages/console-providers/src/providers/sentry/index.ts`
**Change**: Delete line 83: `resourceMetaSchema: z.object({ slug: z.string().optional() }),`

**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Change**: Delete line 62: `resourceMetaSchema: z.object({}),`

#### 3. Remove `PROVIDER_RESOURCE_META` and `ProviderResourceMeta` from registry
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Delete lines 140-157 (the `PROVIDER_RESOURCE_META` constant and `ProviderResourceMeta` type), and the section comment on line 140.

#### 4. Remove re-exports from package index
**File**: `packages/console-providers/src/index.ts`
**Changes**: Remove `PROVIDER_RESOURCE_META` from the value export (line 233) and `ProviderResourceMeta` from the type export (line 243).

#### 5. Remove `metadata` from tRPC input schema and `buildProviderConfig` call
**File**: `api/console/src/router/org/workspace.ts`
**Changes**:
- Delete `metadata` from the `bulkLinkResources` input schema (line 1139):
  ```ts
  // DELETE: metadata: z.record(z.string(), z.string()).optional().default({}),
  ```
- Delete `metadata: resource.metadata,` from the `buildProviderConfig` call (line 1228)

#### 6. Remove `metadata` from UI adapter interface and implementations
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
**Changes**:
- Remove `metadata?: Record<string, string>;` from `buildLinkResources` return type (line 44)
- GitHub adapter (line 91): remove `metadata: { fullName: r.fullName },`
- Linear adapter (line 172): remove `metadata: { key: t.key },`
- Sentry adapter (line 208): remove `metadata: { slug: p.slug },`
- Vercel adapter: no change needed (already doesn't send metadata)

#### 7. Remove type tests for `ProviderResourceMeta`
**File**: `packages/console-providers/src/registry.typetest.ts`
**Changes**:
- Remove the `ProviderResourceMeta` import from line 3
- Delete the entire `describe("ProviderResourceMeta", ...)` block (lines 146-164)

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (gateway errors confirmed pre-existing)
- [x] Linting passes: `pnpm lint` (console-providers changed files clean; other failures confirmed pre-existing)
- [x] console-providers tests pass: `cd packages/console-providers && pnpm test` (178/178 passed)
- [x] No remaining references to `resourceMetaSchema`, `PROVIDER_RESOURCE_META`, or `ProviderResourceMeta` in source files (excluding thoughts/)

#### Manual Verification:
- [x] Bulk-link flow works in the UI (connect a GitHub repo, link resources) — confirms zero behaviour change

**Implementation Note**: This is a single-phase plan. All changes are mechanical deletions. After automated verification passes, pause for manual confirmation of the bulk-link flow.

---

## Testing Strategy

### Automated:
- Existing `registry.typetest.ts` tests continue to pass (minus the deleted `ProviderResourceMeta` block)
- `pnpm typecheck` across the monorepo confirms no broken imports or type references
- `pnpm lint` confirms no unused imports remain

### Manual:
1. Navigate to Sources → New → connect a GitHub installation
2. Select repositories and click "Link"
3. Verify the integration record is created with correct `providerConfig` (stable IDs only)

## Performance Considerations

None — this is pure dead code removal. No runtime paths change.

## Migration Notes

None — no DB schema changes, no stored data affected. The `metadata` field was never persisted.

## References

- Research: `thoughts/shared/research/2026-03-07-resource-meta-evaluation.md`
- ID-as-SoT commit: `e62b3523c` (strip mutable display fields from providerConfig)
- ID-as-SoT design: `thoughts/shared/plans/2026-03-07-provider-config-schema-symmetry.md`
