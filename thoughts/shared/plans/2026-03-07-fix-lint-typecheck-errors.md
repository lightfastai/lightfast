# Fix All Lint & TypeCheck Errors — Implementation Plan

## Overview

Fix all 178 lint errors and 2 typecheck errors across 4 failing turbo tasks: `@lightfast/gateway#build`, `@lightfast/gateway#typecheck`, `@api/console#lint`, `@lightfast/console#lint`, and `@repo/integration-tests#lint`. The `@lightfast/www` and `@lightfast/chat` typecheck failures are cascading from the gateway build failure — they pass individually.

## Current State Analysis

### TypeCheck Errors (2 errors)
- `apps/gateway/src/middleware/auth.ts:8` — TS7030: Not all code paths return a value
- `apps/gateway/src/middleware/tenant.ts:19` — TS7030: Not all code paths return a value

Both middleware functions return `c.json(...)` in error branches but have bare `await next()` in the success path. TypeScript sees inconsistent return types.

### Lint Errors (178 total)

| Package | Errors | Files |
|---------|--------|-------|
| `@api/console` | 2 | `workspace.ts` |
| `@lightfast/console` | 171 | 5 files in sources/new/, 1 in debug/ |
| `@repo/integration-tests` | 5 | 3 test files |

### Key Discoveries:
- `workspace.ts:35` — unused `ProviderName` type import
- `workspace.ts:879` — unused `projectName` destructured variable
- `adapters.ts` — 80+ errors from pervasive `as any` casts in adapter implementations
- `provider-source-item.tsx` — 20+ errors from `any` propagation + non-null assertions
- `link-sources-button.tsx:59` — `Promise.allSettled` on non-narrowed `filter(Boolean)` result
- `page.tsx:18` — unsafe argument to `prefetch()` (cascading from adapter `any` return)
- `context.ts:23` — unnecessary `??` operator (TypeScript already narrows)
- Integration tests — `cancelBackfillService` import from `@gateway/urls` no longer exists (removed during gateway-service-clients refactor, now inline in `connection-teardown.ts`)

## Desired End State

- `pnpm lint` passes with 0 errors
- `pnpm typecheck` passes with 0 errors
- All `any` casts in the adapter pattern replaced with proper types using `RouterOutputs`
- `cancelBackfillService` re-exported from `apps/gateway/src/lib/urls.ts`

### Verification:
```bash
pnpm lint && pnpm typecheck
```

## What We're NOT Doing

- Refactoring the adapter pattern architecture (just typing it properly)
- Changing the `connection-teardown.ts` workflow to use the re-exported function
- Adding new test coverage
- Fixing warnings (only errors)

## Implementation Approach

Type the adapter pattern using `RouterOutputs` from `@repo/console-trpc/types` for data shapes and `TRPCQueryOptions` from `@trpc/tanstack-react-query` for query option return types. Add an `extractRawResources` method to eliminate ad-hoc `any` casts in the component. Use the same `ReturnType<TRPCQueryOptions<any>>` pattern already established by `prefetch()` in `packages/console-trpc/src/server.tsx:146`.

---

## Phase 1: Gateway TypeCheck Fixes

### Overview
Fix 2 TS7030 errors in gateway middleware by adding `return` before `await next()`.

### Changes Required:

#### 1. Auth Middleware
**File**: `apps/gateway/src/middleware/auth.ts:21`
**Changes**: Add `return` before `await next()` so all paths return consistently.

```typescript
// Before:
  await next();

// After:
  return next();
```

#### 2. Tenant Middleware
**File**: `apps/gateway/src/middleware/tenant.ts:31`
**Changes**: Add `return` before `await next()`.

```typescript
// Before:
  await next();

// After:
  return next();
```

### Success Criteria:

#### Automated Verification:
- [ ] Gateway builds successfully: `pnpm build:gateway`
- [ ] Type checking passes: `pnpm typecheck`

---

## Phase 2: API Console Lint Fixes

### Overview
Fix 2 unused variable errors in `workspace.ts`.

### Changes Required:

#### 1. Remove Unused Import
**File**: `api/console/src/router/org/workspace.ts:35`
**Changes**: Remove `ProviderName` from the type import (only `SourceType` is used elsewhere).

```typescript
// Before:
import type { ProviderName, SourceType } from "@repo/console-providers";

// After:
import type { SourceType } from "@repo/console-providers";
```

#### 2. Remove Unused Destructured Variable
**File**: `api/console/src/router/org/workspace.ts:879`
**Changes**: Remove `projectName` from destructuring.

```typescript
// Before:
const { workspaceId, projectId, projectName, installationId } = input;

// After:
const { workspaceId, projectId, installationId } = input;
```

### Success Criteria:

#### Automated Verification:
- [ ] API console lint passes: `cd api/console && pnpm lint`

---

## Phase 3: Console Adapter Type Safety

### Overview
Replace all `any` casts in the adapter pattern with proper types. This eliminates 171 lint errors across 5 files.

### Changes Required:

#### 1. Type the Adapter Interface
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
**Changes**:

Add proper type imports and define typed aliases:

```typescript
import type { TRPCOptionsProxy, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import type { OrgRouter } from "@api/console";
import type { RouterOutputs } from "@repo/console-trpc/types";

// tRPC proxy type — accepts both useTRPC() and orgTrpc
type TRPCProxy = TRPCOptionsProxy<OrgRouter>;

// Query options return type (same pattern as prefetch() in server.tsx)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryOpts = ReturnType<TRPCQueryOptions<any>>;

// ── Connection output types ──
type GitHubListOutput = NonNullable<RouterOutputs["connections"]["github"]["list"]>;
type VercelListOutput = RouterOutputs["connections"]["vercel"]["list"];
type LinearGetOutput = RouterOutputs["connections"]["linear"]["get"];
type SentryGetOutput = RouterOutputs["connections"]["sentry"]["get"];

// ── Resource output types ──
type GitHubReposOutput = RouterOutputs["connections"]["github"]["repositories"];
type VercelProjectsOutput = RouterOutputs["connections"]["vercel"]["listProjects"];
type LinearTeamsOutput = RouterOutputs["connections"]["linear"]["listTeams"];
type SentryProjectsOutput = RouterOutputs["connections"]["sentry"]["listProjects"];
```

Update the `ProviderConnectAdapter` interface:

```typescript
export interface ProviderConnectAdapter {
  provider: ProviderName;
  installationMode: InstallationMode;
  resourceLabel: string;
  resourceQueryKeys: readonly (readonly unknown[])[];

  getConnectionQueryOptions: (trpc: TRPCProxy) => QueryOpts;
  extractInstallations: (data: unknown) => NormalizedInstallation[];
  getResourceQueryOptions: (trpc: TRPCProxy, installationId: string, externalId: string) => QueryOpts;
  extractResources: (data: unknown) => NormalizedResource[];
  /** Extract raw resource items from query data for buildLinkResources. */
  extractRawResources: (data: unknown) => Record<string, unknown>[];
  buildLinkResources: (rawResources: unknown[]) => {
    resourceId: string;
    resourceName: string;
  }[];
  customConnectUrl?: (data: { url: string; state: string }) => string;
}
```

**Key new method**: `extractRawResources` replaces the ad-hoc `(data as any)?.teams ?? (data as any)?.projects` logic in `provider-source-item.tsx`.

#### 2. Type Each Adapter Implementation
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
**Changes**: Replace every `as any` with typed casts.

**GitHub adapter** — cast to `GitHubListOutput`, `GitHubReposOutput`:
```typescript
const githubAdapter: ProviderConnectAdapter = {
  // ...existing fields unchanged...

  getConnectionQueryOptions: (trpc) =>
    trpc.connections.github.list.queryOptions(),

  extractInstallations: (data) => {
    const d = data as GitHubListOutput | null;
    if (!d) return [];
    return d.installations.map((inst) => ({
      id: inst.gwInstallationId,
      externalId: inst.id,
      label: inst.accountLogin,
      avatarUrl: inst.avatarUrl,
    }));
  },

  getResourceQueryOptions: (trpc, installationId, externalId) =>
    trpc.connections.github.repositories.queryOptions({
      integrationId: installationId,
      installationId: externalId,
    }),

  extractResources: (data) =>
    ((data as GitHubReposOutput) ?? []).map((repo) => ({
      id: repo.id,
      name: repo.name,
      subtitle: repo.description,
      badge: repo.isPrivate ? "Private" : null,
    })),

  extractRawResources: (data) =>
    ((data as GitHubReposOutput) ?? []).map((r) => ({ ...r })),

  buildLinkResources: (rawResources) =>
    (rawResources as { id: string; name: string }[]).map((r) => ({
      resourceId: r.id,
      resourceName: r.name,
    })),

  customConnectUrl: (data) => {
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
    return `https://github.com/apps/${slug}/installations/select_target?state=${data.state}`;
  },
};
```

**Vercel adapter** — cast to `VercelListOutput`, `VercelProjectsOutput`:
```typescript
extractInstallations: (data) => {
  const d = data as VercelListOutput;
  return (d?.installations ?? []).map((inst) => ({
    id: inst.id,
    externalId: inst.id,
    label: inst.accountLogin,
  }));
},

extractResources: (data) => {
  const d = data as VercelProjectsOutput;
  return (d?.projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    badge: p.framework,
  }));
},

extractRawResources: (data) => {
  const d = data as VercelProjectsOutput;
  return (d?.projects ?? []).map((p) => ({ ...p }));
},

buildLinkResources: (rawResources) =>
  (rawResources as { id: string; name: string }[]).map((p) => ({
    resourceId: p.id,
    resourceName: p.name,
  })),
```

**Linear adapter** — cast to `LinearGetOutput`, `LinearTeamsOutput`:
```typescript
extractInstallations: (data) =>
  ((data as LinearGetOutput) ?? []).map((conn) => ({
    id: conn.id,
    externalId: conn.id,
    label: conn.organizationName ?? conn.id,
  })),

extractResources: (data) => {
  const d = data as LinearTeamsOutput;
  return (d?.teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    subtitle: t.description,
    badge: t.key,
    iconColor: t.color,
    iconLabel: t.key,
  }));
},

extractRawResources: (data) => {
  const d = data as LinearTeamsOutput;
  return (d?.teams ?? []).map((t) => ({ ...t }));
},

buildLinkResources: (rawResources) =>
  (rawResources as { id: string; name: string }[]).map((t) => ({
    resourceId: t.id,
    resourceName: t.name,
  })),
```

**Sentry adapter** — cast to `SentryGetOutput`, `SentryProjectsOutput`:
```typescript
extractInstallations: (data) => {
  const d = data as SentryGetOutput;
  if (!d) return [];
  return [{ id: d.id, externalId: d.id, label: "Sentry" }];
},

extractResources: (data) => {
  const d = data as SentryProjectsOutput;
  return (d?.projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.slug,
    badge: p.platform,
  }));
},

extractRawResources: (data) => {
  const d = data as SentryProjectsOutput;
  return (d?.projects ?? []).map((p) => ({ ...p }));
},

buildLinkResources: (rawResources) =>
  (rawResources as { id: string; name: string }[]).map((p) => ({
    resourceId: p.id,
    resourceName: p.name,
  })),
```

#### 3. Fix provider-source-item.tsx
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/provider-source-item.tsx`
**Changes**:

**Remove non-null assertions and unnecessary conditionals:**

Line 70-75 — Fix `openCustomUrl` always-truthy check and `customConnectUrl!` assertion:
```typescript
// Before:
const handleAdjustPermissions =
  adapter.customConnectUrl && openCustomUrl
    ? () => {
        installationIdsBeforeRef.current = new Set(state.installations.map((i) => i.id));
        void openCustomUrl(adapter.customConnectUrl!);
      }
    : null;

// After:
const { customConnectUrl } = adapter;
const handleAdjustPermissions = customConnectUrl
  ? () => {
      installationIdsBeforeRef.current = new Set(state.installations.map((i) => i.id));
      void openCustomUrl(customConnectUrl);
    }
  : null;
```

Line 113-114 — Fix `selectedInstallation!.id` non-null assertion:
```typescript
// Before:
const stillExists = state.selectedInstallation
  ? installations.some((inst) => inst.id === state.selectedInstallation!.id)
  : false;

// After:
const selectedId = state.selectedInstallation?.id;
const stillExists = selectedId
  ? installations.some((inst) => inst.id === selectedId)
  : false;
```

Line 159-161 — Fix unnecessary `?? null`:
```typescript
// Before:
resourcesError =
  mergedResourceQueries.every((q) => q.error) && mergedResourceQueries.length > 0
    ? ((mergedResourceQueries[0]?.error as Error) ?? null)
    : null;

// After:
resourcesError =
  mergedResourceQueries.every((q) => q.error) && mergedResourceQueries.length > 0
    ? (mergedResourceQueries[0]?.error ?? null)
    : null;
```

Note: If this still flags `no-unnecessary-condition`, the fallback is to restructure as:
```typescript
const firstError = mergedResourceQueries[0]?.error;
resourcesError = mergedResourceQueries.every((q) => q.error) && firstError ? firstError : null;
```

Lines 167-171 — Replace `any` casts with `extractRawResources`:
```typescript
// Before:
const raw =
  (query.data as any)?.teams ?? (query.data as any)?.projects ?? [];
for (let j = 0; j < normalized.length; j++) {
  allResources.push(normalized[j]!);
  rawResources.push({ ...(raw[j] as object), _installationId: installations[i]!.id });
}

// After:
const raw = adapter.extractRawResources(query.data);
for (let j = 0; j < normalized.length; j++) {
  const resource = normalized[j];
  const rawItem = raw[j];
  const instId = installations[i]?.id;
  if (resource && rawItem && instId) {
    allResources.push(resource);
    rawResources.push({ ...rawItem, _installationId: instId });
  }
}
```

Lines 180-183 — Replace `any` cast with `extractRawResources`:
```typescript
// Before:
const data = singleResourceQuery.data as any;
rawResources = Array.isArray(data)
  ? data
  : (data?.projects ?? data?.teams ?? []);

// After:
rawResources = adapter.extractRawResources(singleResourceQuery.data);
```

#### 4. Fix link-sources-button.tsx
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx`
**Changes**: Fix `await-thenable` by using `flatMap` instead of `map + filter(Boolean)`.

```typescript
// Before:
const mutations = PROVIDER_SLUGS.map((providerKey) => {
  const state = getState(providerKey);
  if (state.selectedResources.length === 0) return null;
  const installation = state.selectedInstallation;
  if (!installation) return null;
  const adapter = ADAPTERS[providerKey];
  return linkMutation.mutateAsync({
    provider: providerKey,
    workspaceId,
    gwInstallationId: installation.id,
    resources: adapter.buildLinkResources(state.rawSelectedResources),
  });
}).filter(Boolean);

const results = await Promise.allSettled(mutations);

// After:
const mutations = PROVIDER_SLUGS.flatMap((providerKey) => {
  const state = getState(providerKey);
  if (state.selectedResources.length === 0) return [];
  const installation = state.selectedInstallation;
  if (!installation) return [];
  const adapter = ADAPTERS[providerKey];
  return [linkMutation.mutateAsync({
    provider: providerKey,
    workspaceId,
    gwInstallationId: installation.id,
    resources: adapter.buildLinkResources(state.rawSelectedResources),
  })];
});

const results = await Promise.allSettled(mutations);
```

#### 5. Fix context.ts
**File**: `apps/console/src/app/api/debug/inject-event/_lib/context.ts:20-23`
**Changes**: The `??` is flagged as unnecessary because TypeScript narrows `cfg.sourceType` to match `provider` in the switch case (making `c` never null). Remove the `?? fallback` pattern and access `cfg` properties directly using type assertion.

```typescript
// Before:
case "github": {
  const c = cfg.sourceType === "github" ? cfg : null;
  return `Generate a realistic GitHub webhook payload.
Repo ID: ${c?.repoId ?? "567890123"}
Account: ${installation.externalId ?? "acme"}
${action ? `Action: ${action}` : ""}${contextLine}`;
}

// After:
case "github": {
  const c = cfg as Extract<typeof cfg, { sourceType: "github" }>;
  return `Generate a realistic GitHub webhook payload.
Repo ID: ${c.repoId}
Account: ${installation.externalId ?? "acme"}
${action ? `Action: ${action}` : ""}${contextLine}`;
}
```

Apply the same pattern to vercel, linear, and sentry cases.

### Success Criteria:

#### Automated Verification:
- [ ] Console lint passes: `cd apps/console && pnpm lint`
- [ ] Console typecheck passes: `cd apps/console && pnpm typecheck`
- [ ] Console builds: `pnpm build:console`

#### Manual Verification:
- [ ] Sources/new page loads correctly in dev
- [ ] OAuth connect flow still works for at least one provider
- [ ] Resource selection and linking works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration Test Fixes

### Overview
Fix 5 `no-unsafe-call` errors by re-exporting `cancelBackfillService` from `apps/gateway/src/lib/urls.ts` (where the tests import it from via the `@gateway/urls` tsconfig path alias).

### Changes Required:

#### 1. Add cancelBackfillService to gateway URLs
**File**: `apps/gateway/src/lib/urls.ts`
**Changes**: Add the function that was removed during the gateway-service-clients refactor. This function uses QStash to publish a cancel message to the backfill service.

```typescript
import { backfillUrl } from "@repo/gateway-service-clients";
import { getQStashClient } from "@vendor/qstash";

/**
 * Cancel a running backfill for the given installation.
 * Publishes a cancel message via QStash to the backfill service.
 *
 * Used by connection-teardown workflow and integration tests.
 */
export async function cancelBackfillService({
  installationId,
}: {
  installationId: string;
}): Promise<void> {
  const qstash = getQStashClient();
  await qstash.publishJSON({
    url: `${backfillUrl}/trigger/cancel`,
    headers: {
      "X-API-Key": env.GATEWAY_API_KEY,
    },
    body: { installationId },
    retries: 3,
    deduplicationId: `backfill-cancel:${installationId}`,
  });
}
```

Note: The `retries` and `deduplicationId` match the inline implementation in `connection-teardown.ts:41-48`.

### Success Criteria:

#### Automated Verification:
- [ ] Integration tests lint passes: `cd packages/integration-tests && pnpm lint`
- [ ] Gateway builds: `pnpm build:gateway`

---

## Final Verification

After all phases complete:

```bash
pnpm lint       # Should pass with 0 errors
pnpm typecheck  # Should pass with 0 errors
```

## Testing Strategy

### Automated:
- `pnpm lint` — validates all lint rules pass
- `pnpm typecheck` — validates all types resolve
- `pnpm build:gateway` — validates gateway compiles
- `pnpm build:console` — validates console bundles

### Manual Testing Steps:
1. Navigate to sources/new page in console dev
2. Verify OAuth connect popup works for GitHub
3. Verify resource list loads after connection
4. Verify resource selection and linking works
5. Verify the "Adjust permissions" link works for GitHub

## Performance Considerations

No performance impact — all changes are type-level or simple code adjustments.

## References

- `packages/console-trpc/src/server.tsx:144-158` — `prefetch()` function using `ReturnType<TRPCQueryOptions<any>>` pattern
- `packages/console-trpc/src/types.ts:26` — `RouterOutputs` type definition
- `api/console/src/router/org/connections.ts` — ground truth for all connection query return types
- `apps/gateway/src/workflows/connection-teardown.ts:38-53` — inline cancel logic to match
