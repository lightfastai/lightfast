# Generic Provider UI — Eliminate Adapter Layer via `ProviderDefinition.resourcePicker`

## Overview

Replace the 6-file hardcoded adapter layer in `sources/new/_components/` with two generic tRPC procedures driven by a new `resourcePicker` section on `ProviderDefinition`. Server-side normalization means the client receives `NormalizedInstallation[]` / `NormalizedResource[]` directly — no per-provider adapter code on the client.

## Current State Analysis

The `sources/new` page has a **6-file adapter layer** that bridges 4 provider-specific tRPC sub-routers to a single generic rendering layer:

- `adapters.ts` — 4 hardcoded `ProviderConnectAdapter` objects (~225 lines)
- `provider-source-item.tsx` — generic rendering component (already provider-agnostic except one `merged` mode hack at line 180)
- `source-selection-provider.tsx` — React context holding per-provider selection state including `rawSelectedResources` (provider-specific objects kept solely for `buildLinkResources`)
- `link-sources-button.tsx` — iterates providers, calls `adapter.buildLinkResources(rawSelectedResources)` to produce `{ resourceId, resourceName }[]`
- `sources-section.tsx` — iterates `ORDERED_ADAPTERS` to render accordion items
- `sources-section-loading.tsx` — hardcoded 4-row skeleton

Each adapter calls **two** provider-specific tRPC procedures:
1. **Connection/list** — `github.list`, `vercel.list`, `linear.get`, `sentry.get`
2. **Resources** — `github.repositories`, `vercel.listProjects`, `linear.listTeams`, `sentry.listProjects`

These 8 tRPC procedures are consumed **only** by `adapters.ts` (confirmed by codebase search — no other consumers in `apps/console/src`, `api/console/src`, or `packages/integration-tests/`). They can be replaced.

### Key Discoveries:
- Rendering layer (`provider-source-item.tsx`) is already 100% generic — never touches provider-specific fields
- `bulkLinkResources` mutation is already provider-agnostic — `workspace.ts:684`
- Gateway proxy (`POST /proxy/execute`) is already generic — `connections.ts:741`
- All 4 providers' API endpoints for enrichment and resource listing already exist in `ProviderApi.endpoints` catalogs
- The `merged` mode hack in `provider-source-item.tsx:180` hardcodes `(query.data as any)?.teams ?? (query.data as any)?.projects` — this disappears with server-side normalization
- `PROVIDER_SLUGS` is at `display.ts:62`, derived from `PROVIDER_DISPLAY` (insertion order: github, vercel, linear, sentry)
- `getProvider` is at `registry.ts:121` — returns `ProviderDefinition | undefined` for plain string input
- `sourceTypeSchema` is at `registry.ts:46` — Zod enum of the 4 provider names; use for tRPC input validation
- `ProxyExecuteResponse` type already exists at `packages/console-providers/src/gateway.ts:172` — reuse it in `ResourcePickerExecuteApiFn` rather than duplicating

## Desired End State

1. `ProviderDefinition` carries a `resourcePicker` section with `installationMode`, `resourceLabel`, and normalization functions
2. Two generic tRPC procedures (`connections.generic.listInstallations`, `connections.generic.listResources`) replace 8 provider-specific ones
3. `adapters.ts` is **deleted** — `ProviderSourceItem` calls generic tRPC directly
4. `source-selection-provider.tsx` drops `rawSelectedResources` — `NormalizedResource.linkName` carries the link-time name
5. Skeleton derives row count from `PROVIDER_SLUGS.length`
6. Adding a new provider requires zero UI changes — just implement `resourcePicker` on the `ProviderDefinition`

### Verification:
- `pnpm check && pnpm typecheck` passes
- `sources/new` page renders all 4 providers, OAuth popup flow works, resource selection and linking work
- Integration test updated for generic procedures

## What We're NOT Doing

- NOT changing `github.validate`, `github.detectConfig`, or `vercel.disconnect` — these are separate features
- NOT modifying the OAuth popup flow (`use-oauth-popup.ts`) — only the query keys passed to it change
- NOT changing `bulkLinkResources` mutation — it's already generic
- NOT adding new API endpoints to any provider's catalog — all needed endpoints already exist
- NOT changing `display.ts` structure — `installationMode` and `resourceLabel` come from the tRPC response
- NOT modifying the gateway proxy

## Implementation Approach

Server-side normalization: the generic tRPC procedures call the gateway proxy using endpoint IDs from `resourcePicker`, normalize the response, and return typed `NormalizedInstallation[]` / `NormalizedResource[]`. The client receives a self-describing response (includes `installationMode`, `resourceLabel`) and renders it generically.

---

## Phase 1: Server — Types, `resourcePicker` Implementations, and Generic tRPC Procedures

### Overview
Add `ResourcePickerDef` interface and `NormalizedInstallation`/`NormalizedResource` types to `define.ts`. Implement `resourcePicker` on all 4 providers. Add two generic tRPC procedures to the connections router. Phases 1 and 2 from the original plan are merged here — the server work is a single atomic unit since `resourcePicker` implementations can't be exercised until the generic procedures exist.

### Changes Required:

#### 1. Add types and interface to `define.ts`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add normalized types + `ResourcePickerDef` interface + add `resourcePicker` to `ProviderDefinition`

```typescript
// ── Resource Picker Types (server-side normalization for sources/new UI) ─────

import type { ProxyExecuteResponse } from "./gateway";

/** Callback signature for gateway proxy calls inside resourcePicker functions.
 *  The generic tRPC procedure binds the installationId and passes this to the provider. */
export interface ResourcePickerExecuteApiFn {
  (request: {
    endpointId: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  }): Promise<ProxyExecuteResponse>;
}

export interface NormalizedInstallation {
  readonly avatarUrl?: string | null;
  readonly externalId: string;
  readonly id: string;
  readonly label: string;
}

export interface NormalizedResource {
  readonly badge?: string | null;
  readonly iconColor?: string | null;
  readonly iconLabel?: string | null;
  readonly id: string;
  /** Resource name used when linking via bulkLinkResources.
   *  Falls back to `name` when absent. Sentry uses "orgSlug/projectSlug". */
  readonly linkName?: string;
  readonly name: string;
  readonly subtitle?: string | null;
}

export type InstallationMode = "multi" | "merged" | "single";

export interface ResourcePickerDef {
  /** How installations are displayed: multi=select dropdown, merged=all fetched, single=static label */
  readonly installationMode: InstallationMode;
  /** Human label for resources, e.g. "repositories", "projects", "teams" */
  readonly resourceLabel: string;

  /** Enrich a gateway installation with display data from the provider API.
   *  Called once per installation. Should handle errors internally and return fallback data. */
  readonly enrichInstallation: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedInstallation>;

  /** List resources for a single installation, returning normalized items.
   *  Called per installation (merged mode calls this for each).
   *  Installation context is included so providers can read providerAccountInfo
   *  (e.g. Vercel needs team_id from providerAccountInfo.raw to scope the API call). */
  readonly listResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      readonly id: string;
      readonly externalId: string;
      readonly providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedResource[]>;
}
```

Add to `ProviderDefinition` interface (after `readonly backfill: BackfillDef;`):
```typescript
  /** UI resource picker configuration for sources/new — installation enrichment + resource listing */
  readonly resourcePicker: ResourcePickerDef;
```

Add to `defineProvider` accordingly (no special handling needed — it's a plain object, not lazy like `env`).

#### 2. Export new types from `index.ts`
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add exports for the new types

```typescript
export type {
  InstallationMode,
  NormalizedInstallation,
  NormalizedResource,
  ResourcePickerDef,
  ResourcePickerExecuteApiFn,
} from "./define";
```

#### 3. Implement `resourcePicker` on GitHub provider
**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: Add `resourcePicker` to the `defineProvider()` call

```typescript
resourcePicker: {
  installationMode: "multi",
  resourceLabel: "repositories",

  enrichInstallation: async (executeApi, inst) => {
    try {
      const res = await executeApi({
        endpointId: "get-app-installation",
        pathParams: { installation_id: inst.externalId },
      });
      const data = res.data as {
        account?: { login?: string; type?: string; avatar_url?: string };
      };
      return {
        id: inst.id,
        externalId: inst.externalId,
        label: data.account?.login ?? inst.externalId,
        avatarUrl: data.account?.avatar_url ?? null,
      };
    } catch {
      return {
        id: inst.id,
        externalId: inst.externalId,
        label: inst.externalId,
        avatarUrl: null,
      };
    }
  },

  listResources: async (executeApi) => {
    const res = await executeApi({
      endpointId: "list-installation-repos",
      queryParams: { per_page: "100" },
    });
    // GitHub wraps the array: { repositories: [...] }
    // See connections.ts:416 — the existing github.repositories procedure confirms this shape.
    const data = res.data as {
      repositories: Array<{
        id: number;
        name: string;
        full_name: string;
        description?: string | null;
        private?: boolean;
      }>;
    };
    return (data.repositories ?? []).map((r) => ({
      id: String(r.id),
      name: r.full_name ?? r.name,
      subtitle: r.description ?? null,
      badge: r.private ? "Private" : null,
    }));
  },
},
```

#### 4. Implement `resourcePicker` on Vercel provider
**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Changes**: Add `resourcePicker` to the `defineProvider()` call

```typescript
resourcePicker: {
  installationMode: "multi",
  resourceLabel: "projects",

  enrichInstallation: async (executeApi, inst) => {
    const info = inst.providerAccountInfo as {
      raw?: { team_id?: string; user_id?: string; configuration_id?: string };
    } | null;
    try {
      if (info?.raw?.team_id) {
        const res = await executeApi({
          endpointId: "get-team",
          pathParams: { team_id: info.raw.team_id },
        });
        const data = res.data as { slug?: string };
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: data.slug ?? info.raw.team_id,
        };
      }
      const res = await executeApi({ endpointId: "get-user" });
      const data = res.data as { user?: { username?: string } };
      return {
        id: inst.id,
        externalId: inst.externalId,
        label: data.user?.username ?? inst.externalId,
      };
    } catch {
      const fallbackLabel =
        info?.raw?.team_id ?? info?.raw?.user_id ?? inst.externalId;
      return { id: inst.id, externalId: inst.externalId, label: fallbackLabel };
    }
  },

  listResources: async (executeApi, installation) => {
    // Vercel requires teamId as a query param for team-scoped accounts.
    // See connections.ts:770-781 — the existing vercel.listProjects procedure confirms this.
    const info = installation.providerAccountInfo as {
      raw?: { team_id?: string };
    } | null;
    const queryParams: Record<string, string> = { limit: "100" };
    if (info?.raw?.team_id) queryParams.teamId = info.raw.team_id;

    const res = await executeApi({
      endpointId: "list-projects",
      queryParams,
    });
    const data = res.data as {
      projects: Array<{ id: string; name: string; framework?: string | null }>;
    };
    return data.projects.map((p) => ({
      id: String(p.id),
      name: p.name,
      badge: p.framework ?? null,
      subtitle: null,
    }));
  },
},
```

#### 5. Implement `resourcePicker` on Linear provider
**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: Add `resourcePicker` to the `defineProvider()` call

```typescript
resourcePicker: {
  installationMode: "merged",
  resourceLabel: "teams",

  enrichInstallation: async (executeApi, inst) => {
    try {
      const res = await executeApi({
        endpointId: "graphql",
        body: { query: "{ viewer { organization { name urlKey } } }" },
      });
      const data = res.data as {
        data?: { viewer?: { organization?: { name?: string } } };
      };
      return {
        id: inst.id,
        externalId: inst.externalId,
        label: data.data?.viewer?.organization?.name ?? inst.id,
      };
    } catch {
      return { id: inst.id, externalId: inst.externalId, label: inst.id };
    }
  },

  listResources: async (executeApi, _installation) => {
    const res = await executeApi({
      endpointId: "graphql",
      body: {
        query: "{ teams { nodes { id name key description color } } }",
      },
    });
    const data = res.data as {
      data?: {
        teams?: {
          nodes?: Array<{
            id: string;
            name: string;
            key: string;
            description?: string | null;
            color?: string | null;
          }>;
        };
      };
    };
    const teams = data.data?.teams?.nodes ?? [];
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      subtitle: t.description ?? null,
      badge: t.key,
      iconColor: t.color ?? null,
      iconLabel: t.key.substring(0, 2),
    }));
  },
},
```

#### 6. Implement `resourcePicker` on Sentry provider
**File**: `packages/console-providers/src/providers/sentry/index.ts`
**Changes**: Add `resourcePicker` to the `defineProvider()` call

```typescript
resourcePicker: {
  installationMode: "single",
  resourceLabel: "projects",

  enrichInstallation: async (executeApi, inst) => {
    try {
      const res = await executeApi({ endpointId: "list-organizations" });
      const orgs = res.data as Array<{ name?: string; slug?: string }>;
      const org = orgs[0];
      return {
        id: inst.id,
        externalId: inst.externalId,
        label: org?.name ?? "Sentry",
      };
    } catch {
      return { id: inst.id, externalId: inst.externalId, label: "Sentry" };
    }
  },

  listResources: async (executeApi, _installation) => {
    const res = await executeApi({ endpointId: "list-projects" });
    const projects = res.data as Array<{
      id: string;
      name: string;
      slug: string;
      platform?: string | null;
      organization?: { slug?: string };
    }>;
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.slug,
      badge: p.platform ?? null,
      linkName: `${p.organization?.slug ?? ""}/${p.slug}`,
    }));
  },
},
```

#### 7. Add generic sub-router to connections router
**File**: `api/console/src/router/org/connections.ts`
**Changes**: Add a `generic` namespace with two procedures, placed after the existing `connections.list` procedure (~line 113). Add `NormalizedInstallation`, `NormalizedResource`, `ResourcePickerExecuteApiFn` to the existing `@repo/console-providers` import line. `createGatewayClient`, `env`, `gatewayInstallations`, `TRPCError`, `and`, `eq` are already imported.

**Note on input validation**: Use `sourceTypeSchema` (not `ProviderSlug`) for the `provider` input field — `sourceTypeSchema` is derived from the server-side `PROVIDERS` registry and is already imported. `ProviderSlug` is a client-side display type; `sourceTypeSchema` is the canonical server-side validator.

```typescript
// ── Generic Resource Picker Procedures ────────────────────────────────────

generic: {
  listInstallations: orgScopedProcedure
    .input(z.object({ provider: sourceTypeSchema }))
    .query(async ({ ctx, input }) => {
      const providerDef = getProvider(input.provider);
      if (!providerDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown provider: ${input.provider}`,
        });
      }

      const installations = await ctx.db
        .select()
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, input.provider),
            eq(gatewayInstallations.status, "active")
          )
        );

      if (installations.length === 0) {
        return {
          installationMode: providerDef.resourcePicker.installationMode,
          resourceLabel: providerDef.resourcePicker.resourceLabel,
          installations: [] as NormalizedInstallation[],
        };
      }

      const gw = createGatewayClient({
        apiKey: env.GATEWAY_API_KEY,
        correlationId: crypto.randomUUID(),
        requestSource: "console:generic-list-installations",
      });

      const enriched = await Promise.all(
        installations.map(async (inst) => {
          // NOTE: gw.executeApi throws HttpError only when the gateway SERVICE
          // itself fails (network/auth). Provider-level 401s come back as
          // result.status === 401 in the ProxyExecuteResponse — they do NOT throw.
          // enrichInstallation handles its own errors internally and always returns
          // a fallback NormalizedInstallation, so no 401 handling is needed here.
          const executeApi: ResourcePickerExecuteApiFn = (request) =>
            gw.executeApi(inst.id, request);

          return providerDef.resourcePicker.enrichInstallation(executeApi, {
            id: inst.id,
            externalId: inst.externalId,
            providerAccountInfo: inst.providerAccountInfo,
          });
        })
      );

      return {
        installationMode: providerDef.resourcePicker.installationMode,
        resourceLabel: providerDef.resourcePicker.resourceLabel,
        installations: enriched,
      };
    }),

  listResources: orgScopedProcedure
    .input(
      z.object({
        provider: sourceTypeSchema,
        installationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const providerDef = getProvider(input.provider);
      if (!providerDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown provider: ${input.provider}`,
        });
      }

      // Verify org owns this installation
      const installation = await ctx.db
        .select()
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.id, input.installationId),
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, input.provider),
            eq(gatewayInstallations.status, "active")
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installation not found or not owned by this org",
        });
      }

      const gw = createGatewayClient({
        apiKey: env.GATEWAY_API_KEY,
        correlationId: crypto.randomUUID(),
        requestSource: "console:generic-list-resources",
      });

      // Wrap executeApi to detect provider-level 401s (returned as result.status,
      // NOT thrown — see connections.ts patterns for vercel.listProjects etc.).
      // If the provider returns 401, mark the installation as errored and throw.
      const executeApi: ResourcePickerExecuteApiFn = async (request) => {
        const result = await gw.executeApi(installation.id, request);
        if (result.status === 401) {
          await ctx.db
            .update(gatewayInstallations)
            .set({ status: "error" })
            .where(eq(gatewayInstallations.id, installation.id));
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Provider connection expired. Please reconnect.",
          });
        }
        return result;
      };

      const resources = await providerDef.resourcePicker.listResources(
        executeApi,
        {
          id: installation.id,
          externalId: installation.externalId,
          providerAccountInfo: installation.providerAccountInfo,
        }
      );

      return { resources };
    }),
},
```

Also add `getProvider` to the `@repo/console-providers` import line (it is likely not imported yet in this file).

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] All existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] Call `connections.generic.listInstallations({ provider: "github" })` from tRPC panel and verify it returns `{ installationMode: "multi", resourceLabel: "repositories", installations: [...] }` with correct data
- [ ] Call `connections.generic.listInstallations({ provider: "linear" })` and verify `installationMode: "merged"`
- [ ] Call `connections.generic.listResources({ provider: "github", installationId: "<valid-id>" })` and verify normalized resources returned
- [ ] Call `connections.generic.listResources({ provider: "sentry", installationId: "<valid-id>" })` and verify `linkName` is `"orgSlug/projectSlug"` format

**Implementation Note**: After completing this phase and manual verification passes for all 4 providers, proceed to Phase 2.

---

## Phase 2: Client Rewrite + Server Cleanup

### Overview
Delete `adapters.ts`. Rewrite `ProviderSourceItem` to call generic tRPC directly. Simplify the selection context to drop `rawSelectedResources`. Update the link button, skeleton, section, and page components. Then delete the now-unused provider-specific tRPC procedures and update the integration test. Client and cleanup are one atomic phase — once the client no longer calls the old procedures, they are dead code.

### Changes Required:

#### 1. Delete `adapters.ts`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
**Changes**: Delete the entire file

#### 2. Rewrite `source-selection-provider.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/source-selection-provider.tsx`
**Changes**: Import `NormalizedInstallation` and `NormalizedResource` from `@repo/console-providers`. Remove `rawSelectedResources` from `ProviderSelectionState`. Remove `rawResource` parameter from `toggleResource`. Remove the `ProviderConnectAdapter` imports.

Updated `ProviderSelectionState`:
```typescript
import type {
  NormalizedInstallation,
  NormalizedResource,
  ProviderSlug,
} from "@repo/console-providers";

interface ProviderSelectionState {
  installations: NormalizedInstallation[];
  selectedInstallation: NormalizedInstallation | null;
  selectedResources: NormalizedResource[];
}
```

Update `toggleResource` to not take `rawResource`:
```typescript
toggleResource: (provider: ProviderSlug, resource: NormalizedResource) => void;
```

Remove all `rawSelectedResources` tracking from the context implementation.

#### 3. Rewrite `provider-source-item.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/provider-source-item.tsx`
**Changes**: Replace `adapter: ProviderConnectAdapter` prop with `provider: ProviderSlug`. Call generic tRPC directly. Remove all adapter indirection and `rawResources` tracking.

Key changes:
- **Props**: `{ provider: ProviderSlug }` instead of `{ adapter: ProviderConnectAdapter }`
- **Connection query**: `trpc.connections.generic.listInstallations.queryOptions({ provider })`
- **Extract metadata**: Read `installationMode`, `resourceLabel`, `installations` from query data directly
- **Resource query**: `trpc.connections.generic.listResources.queryOptions({ provider, installationId: selectedInstallation.id })`
- **Merged mode**: `useQueries` over all installations using `trpc.connections.generic.listResources.queryOptions({ provider, installationId: inst.id })`
- **Resource extraction**: `data.resources` directly (already normalized, no `.teams ?? .projects` hack)
- **Toggle**: `toggleResource(provider, resource)` (no raw resource)
- **OAuth query keys**: `[trpc.connections.generic.listInstallations.getQueryKey({ provider }), trpc.connections.generic.listResources.getQueryKey({ provider })]` — partial key match invalidates all resource queries for that provider
- **customConnectUrl**: Inline conditional — `provider === "github" ? (data) => \`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}\` : undefined`
- **Display metadata**: Continue using `PROVIDER_DISPLAY[provider]` for `displayName`, `description`; continue using `IntegrationLogoIcons[provider]` for React SVG icon

#### 4. Update `link-sources-button.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx`
**Changes**: Remove `ADAPTERS` import. Build `resources` array directly from `NormalizedResource`:

```typescript
// Replace:
//   const resources = adapter.buildLinkResources(state.rawSelectedResources);
// With:
const resources = state.selectedResources.map((r) => ({
  resourceId: r.id,
  resourceName: r.linkName ?? r.name,
}));
```

Iterate `PROVIDER_SLUGS` instead of using `ADAPTERS[providerKey]`.

#### 5. Update `sources-section.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section.tsx`
**Changes**: Import `PROVIDER_SLUGS` from `@repo/console-providers` instead of `ORDERED_ADAPTERS` from `./adapters`. Map over `PROVIDER_SLUGS` rendering `<ProviderSourceItem provider={slug} />` instead of `<ProviderSourceItem adapter={adapter} />`.

```typescript
import { PROVIDER_SLUGS } from "@repo/console-providers";

export function SourcesSection() {
  return (
    <Accordion className="w-full rounded-lg border" type="multiple">
      {PROVIDER_SLUGS.map((slug) => (
        <ProviderSourceItem key={slug} provider={slug} />
      ))}
    </Accordion>
  );
}
```

#### 6. Update `sources-section-loading.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section-loading.tsx`
**Changes**: Derive skeleton row count from `PROVIDER_SLUGS.length` instead of hardcoding 4 rows.

```typescript
import { PROVIDER_SLUGS } from "@repo/console-providers";

export function SourcesSectionLoading() {
  return (
    <div className="w-full divide-y rounded-lg border">
      {PROVIDER_SLUGS.map((slug) => (
        <div key={slug} className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
```

#### 7. Update `page.tsx` server prefetch
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx`
**Changes**: Replace `ORDERED_ADAPTERS` import with `PROVIDER_SLUGS`. Prefetch generic procedures.

```typescript
import { PROVIDER_SLUGS } from "@repo/console-providers";

// Replace:
//   for (const adapter of ORDERED_ADAPTERS) {
//     void prefetch(adapter.getConnectionQueryOptions(orgTrpc));
//   }
// With:
for (const slug of PROVIDER_SLUGS) {
  void prefetch(
    orgTrpc.connections.generic.listInstallations.queryOptions({
      provider: slug,
    })
  );
}
```

#### 8. Delete provider-specific list/resource procedures from `connections.ts`
**File**: `api/console/src/router/org/connections.ts`
**Changes**: Remove these procedures:

| Provider | Procedure | Approx Lines |
|---|---|---|
| GitHub | `github.list` | 191–268 |
| GitHub | `github.repositories` | 359–460 |
| Vercel | `vercel.list` | 638–728 |
| Vercel | `vercel.listProjects` | 736–835 |
| Linear | `linear.get` | 873–939 |
| Linear | `linear.listTeams` | 947–1030 |
| Sentry | `sentry.get` | 1042–1110 |
| Sentry | `sentry.listProjects` | 1118–1210 |

**Keep** these procedures — they serve separate features:
- `github.validate` (~278–351)
- `github.detectConfig` (~468–625)
- `vercel.disconnect` (~840–860)

If removing all procedures from a provider's sub-router leaves it empty (Linear, Sentry), delete the entire sub-router namespace.

#### 9. Update integration test
**File**: `packages/integration-tests/src/api-console-connections.integration.test.ts`
**Changes**: Replace tests for `caller.github.list()` (lines ~575, 606, 664, 711, 745) and `caller.github.repositories()` (lines ~855, 877, 898, 928, 953) with equivalent tests for `caller.generic.listInstallations({ provider: "github" })` and `caller.generic.listResources({ provider: "github", installationId: "..." })`.

**Keep all `caller.github.validate()` tests unchanged** — `validate` is not being deleted.

#### 10. Clean up dead JSDoc references
**Files**: Check these files for JSDoc comments referencing deleted procedures and remove them:
- `packages/console-providers/src/providers/github/auth.ts` (line 12)
- `packages/console-providers/src/providers/vercel/auth.ts` (line 9)
- `packages/console-providers/src/providers/linear/auth.ts` (line 20)
- `packages/console-providers/src/providers/sentry/auth.ts` (line 9)

### Success Criteria:

#### Automated Verification:
- [x] `adapters.ts` is deleted — no file at path
- [x] No grep matches for deleted procedure names in `apps/console/src/`: `pnpm --filter console exec -- grep -r "connections\.github\.list\|connections\.github\.repositories\|connections\.vercel\.list\|connections\.vercel\.listProjects\|connections\.linear\.get\|connections\.linear\.listTeams\|connections\.sentry\.get\|connections\.sentry\.listProjects" src/`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (fixed 2 import-sort issues in Phase 2 files + pre-existing `GwInstallation` rename in debug route)
- [ ] All tests pass: `pnpm test`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Navigate to `sources/new` page — all 4 providers render in accordion
- [ ] GitHub: OAuth popup connects, installations appear in dropdown, repositories list, select a repo and link
- [ ] Vercel: Same flow — projects list with framework badges
- [ ] Linear: Merged mode — all teams from all workspaces appear in one list with colored icons
- [ ] Sentry: Single mode — projects list, linking uses `orgSlug/projectSlug` as `resourceName`
- [ ] Skeleton loading state shows correct number of rows
- [ ] GitHub "Adjust permissions" link works (customConnectUrl)
- [ ] After linking, redirects to sources list with toast showing created count
- [ ] `github.validate` still works (config file detection in connected repos)
- [ ] `vercel.disconnect` still works (disconnecting Vercel)

---

## Testing Strategy

### Unit Tests:
- Add unit tests for each provider's `resourcePicker.enrichInstallation` and `resourcePicker.listResources` functions — mock the `executeApi` function and verify normalization output
- Test `enrichInstallation` error fallback behavior (executeApi throws → returns fallback)
- Test Sentry's `linkName` computation (`"orgSlug/projectSlug"`)

### Integration Tests:
- Update existing `api-console-connections.integration.test.ts` to test generic procedures
- Test `listInstallations` returns correct `installationMode` and `resourceLabel` per provider
- Test `listResources` ownership verification (wrong org → NOT_FOUND)
- Test 401 handling marks installation as errored

### Manual Testing Steps:
1. Navigate to `sources/new` — verify all 4 providers render
2. Connect GitHub via OAuth popup — verify installations load, select an org, verify repos list
3. Select a repo and click "Link Sources" — verify toast shows count, redirect to sources list
4. Repeat for Vercel (projects), Linear (teams, merged mode), Sentry (projects, single mode)
5. Test "Adjust permissions" link for GitHub
6. Disconnect and reconnect to verify OAuth popup invalidation works

## Performance Considerations

- **No performance regression**: The generic procedures make the same gateway proxy calls as the provider-specific ones
- **Merged mode**: `listInstallations` calls `enrichInstallation` for all installations in parallel via `Promise.all` — same parallelism as current `useQueries` approach
- **Server prefetch**: `page.tsx` prefetches `listInstallations` per provider on the server — same pattern as current `adapter.getConnectionQueryOptions(orgTrpc)`

## Migration Notes

- No database migration needed
- No data migration needed
- Client-side change only affects `sources/new` page
- tRPC router change is additive in Phase 1, subtractive in Phase 2

## References

- Research: `thoughts/shared/research/2026-03-15-sources-new-generic-provider-ui.md`
- Current adapters: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
- ProviderDefinition: `packages/console-providers/src/define.ts:283`
- ProxyExecuteResponse: `packages/console-providers/src/gateway.ts:172`
- Connections router: `api/console/src/router/org/connections.ts`
- Gateway proxy: `apps/gateway/src/routes/connections.ts:741`
- `bulkLinkResources`: `api/console/src/router/org/workspace.ts:684`

## Update Log

### 2026-03-15 — Consolidated to 2 phases, fix type reuse
- **Trigger**: Efficiency review found that the original 4 phases had no independent value between Phases 1+2 or Phases 3+4
- **Changes**:
  - Merged Phases 1+2 into new Phase 1 (server work) — `resourcePicker` implementations and generic tRPC procedures are a single atomic unit
  - Merged Phases 3+4 into new Phase 2 (client rewrite + cleanup) — old procedure deletion happens immediately after client rewrite since they have zero consumers
  - `ResourcePickerExecuteApiFn` return type now reuses `ProxyExecuteResponse` from `gateway.ts:172` instead of duplicating the `{ status, data, headers }` shape
  - Added note clarifying `sourceTypeSchema` (not `ProviderSlug`) for tRPC input validation — `sourceTypeSchema` is server-side canonical; `ProviderSlug` is a client-side display type
  - Added codebase verification facts to Current State Analysis section
- **Impact on remaining work**: Same net work, 2 verification checkpoints instead of 4
