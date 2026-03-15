---
date: 2026-03-15T00:00:00+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "sources/new UI — current adapter pattern vs. general-purpose ProviderDefinition approach"
tags: [research, codebase, sources, providers, ui, adapters, trpc, console-providers]
status: complete
last_updated: 2026-03-15
---

# Research: `sources/new` UI — Current Adapter Pattern vs. General-Purpose `ProviderDefinition`

**Date**: 2026-03-15
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

What is the exact current implementation of `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/`?
What does `packages/console-providers/src/define.ts` provide today that a re-implementation could use?
What is the gap between the two and what would a general-purpose, provider-agnostic UI need?

---

## Summary

The `_components/` folder is a **6-file adapter layer** that bridges provider-specific tRPC sub-namespaces
(`connections.github.*`, `connections.vercel.*`, etc.) to a single generic accordion UI.
Every provider is hardcoded at 4 levels: the adapter object, the context state type, the tRPC queries, and the loading skeleton.

`packages/console-providers` already has a `ProviderDefinition` interface (`define.ts`) plus a client-safe
`PROVIDER_DISPLAY` record (`display.ts`) with `displayName`, `description`, and `IconDef` (SVG path data).
The `ProviderDefinition` does **not** currently carry any UI-specific resource-listing metadata.
The gap is entirely on the **tRPC side**: each provider has its own bespoke query shape for listing
installations and resources. A generic UI would need a generic tRPC contract for both.

---

## Detailed Findings

### 1. File Inventory — `_components/`

| File | Role |
|---|---|
| `adapters.ts` | Provider adapter registry — hardcoded for 4 providers |
| `sources-section.tsx` | Renders `<Accordion>` iterating `ORDERED_ADAPTERS` |
| `provider-source-item.tsx` | Per-provider accordion item — queries, state, rendering |
| `source-selection-provider.tsx` | React context — selection state keyed by `ProviderName` |
| `link-sources-button.tsx` | "Link Sources" CTA — reads context, fires `bulkLinkResources` mutation |
| `sources-section-loading.tsx` | **Hardcoded 4-row skeleton** (GitHub/Vercel/Linear/Sentry comments in JSX) |

---

### 2. `ProviderConnectAdapter` Interface (`adapters.ts:26-51`)

```ts
export interface ProviderConnectAdapter {
  provider: ProviderName;
  installationMode: "multi" | "merged" | "single";
  resourceLabel: string;

  getConnectionQueryOptions: (trpc: any) => any;
  extractInstallations: (data: unknown) => NormalizedInstallation[];

  getResourceQueryOptions: (trpc, installationId, externalId) => any;
  extractResources: (data: unknown) => NormalizedResource[];

  buildLinkResources: (rawResources: unknown[]) => Array<{resourceId, resourceName}>;
  customConnectUrl?: (data: { url: string; state: string }) => string;
  resourceQueryKeys: readonly (readonly unknown[])[];
}
```

Four hardcoded instances: `githubAdapter`, `vercelAdapter`, `linearAdapter`, `sentryAdapter`.
The registry is: `ADAPTERS: Record<ProviderName, ProviderConnectAdapter>` (`adapters.ts:217`).
Ordered list: `ORDERED_ADAPTERS = PROVIDER_SLUGS.map(key => ADAPTERS[key])` (`adapters.ts:224`).

---

### 3. `installationMode` — Three Shapes (`adapters.ts:55-213`)

| Mode | Providers | Behavior |
|---|---|---|
| `"multi"` | GitHub, Vercel | Multiple installations; renders a `<Select>` to pick one; single resource query per selected installation |
| `"merged"` | Linear | Multiple installations exist but resources are fetched for ALL and merged into one flat list (`useQueries`) |
| `"single"` | Sentry | Single installation row; no select UI shown |

---

### 4. Provider-Specific tRPC Routes Called by Adapters

Each adapter calls **two** provider-specific tRPC procedures:

#### GitHub (`adapters.ts:55-101`)
- **Connection**: `trpc.connections.github.list` → returns `{ installations: [{ gwInstallationId, id, accountLogin, avatarUrl }] }`
- **Resources**: `trpc.connections.github.repositories({ integrationId, installationId })` → returns array of repos

#### Vercel (`adapters.ts:105-138`)
- **Connection**: `trpc.connections.vercel.list` → returns `{ installations: [{ id, accountLogin }] }`
- **Resources**: `trpc.connections.vercel.listProjects({ installationId })` → returns `{ projects: [...] }`

#### Linear (`adapters.ts:142-176`)
- **Connection**: `trpc.connections.linear.get` → returns array of connections
- **Resources**: `trpc.connections.linear.listTeams({ installationId })` → returns `{ teams: [{ id, name, description, key, color }] }`

#### Sentry (`adapters.ts:180-213`)
- **Connection**: `trpc.connections.sentry.get` → returns single object or null
- **Resources**: `trpc.connections.sentry.listProjects({ installationId })` → returns `{ projects: [{ id, name, slug, platform }] }`

Each `extractInstallations()` and `extractResources()` normalizes these different shapes into
`NormalizedInstallation` and `NormalizedResource` respectively.

---

### 5. `NormalizedInstallation` / `NormalizedResource` (`adapters.ts:6-20`)

```ts
interface NormalizedInstallation {
  avatarUrl?: string | null;
  externalId: string;
  id: string;
  label: string;
}

interface NormalizedResource {
  badge?: string | null;
  iconColor?: string | null;
  iconLabel?: string | null;
  id: string;
  name: string;
  subtitle?: string | null;
}
```

These are the only shapes the rendering layer (`provider-source-item.tsx`) ever touches.
All provider-specific fields are erased here.

---

### 6. `ProviderSourceItem` Component (`provider-source-item.tsx:33-460`)

Key behaviors:
- `PROVIDER_DISPLAY[provider]` for `displayName`, `description` (`provider-source-item.tsx:35`)
- `IntegrationLogoIcons[provider]` from `@repo/ui/integration-icons` for React SVG icon (`provider-source-item.tsx:36`)
- `useOAuthPopup({ provider, queryKeysToInvalidate })` — OAuth popup flow (`provider-source-item.tsx:54`)
- `useSuspenseQuery(connectionQueryOpts)` — prefetched on server (`provider-source-item.tsx:83`)
- `useQuery` / `useQueries` — resource fetching, mode-dependent (`provider-source-item.tsx:138-160`)
- Raw resources are tracked alongside normalized resources so `buildLinkResources` can reconstruct provider-specific fields for the mutation (`provider-source-item.tsx:163-200`)

The raw resource tracking (`rawResources` array parallel to `allResources`) is a key detail:
the normalized `NormalizedResource` strips provider fields, but `buildLinkResources` needs them
(e.g., Sentry needs `organizationSlug/slug` for `resourceName`). See `adapters.ts:208-212`.

---

### 7. `SourceSelectionProvider` Context (`source-selection-provider.tsx`)

Holds per-provider state map: `Map<ProviderName, ProviderSelectionState>`.

```ts
interface ProviderSelectionState {
  installations: NormalizedInstallation[];
  selectedInstallation: NormalizedInstallation | null;
  selectedResources: NormalizedResource[];
  rawSelectedResources: unknown[];  // provider-specific fields for buildLinkResources
}
```

Toggle behavior: selecting an already-selected resource deselects it (single-select per provider, `source-selection-provider.tsx:112-122`).

---

### 8. `LinkSourcesButton` — Mutation Contract (`link-sources-button.tsx`)

Calls `trpc.workspace.integrations.bulkLinkResources` per provider:
```ts
{
  provider: providerKey,
  workspaceId: string,
  gwInstallationId: installation.id,
  resources: Array<{ resourceId: string; resourceName: string }>
}
```

This mutation is provider-agnostic already. The `resourceId` / `resourceName` shape is the same
regardless of provider.

---

### 9. Server Prefetch (`page.tsx`)

The server page (`page.tsx:17-27`) iterates `ORDERED_ADAPTERS` to prefetch connection queries,
which means it also depends on the adapter layer to know which tRPC procedures to warm.

---

### 10. What `packages/console-providers` Provides Today

#### `display.ts` — Client-safe display metadata
```ts
PROVIDER_DISPLAY = {
  github: { name, displayName, description, icon: { d, viewBox } },
  vercel: { ... },
  linear: { ... },
  sentry: { ... },
}
```
`IconDef = { d: string; viewBox: string }` — SVG path + viewBox.
`PROVIDER_SLUGS` — ordered array of keys.

The current UI uses `IntegrationLogoIcons[provider]` from `@repo/ui/integration-icons` (React components), not `IconDef` directly.

#### `registry.ts` — `PROVIDERS` object
Each entry is a full `ProviderDefinition` with:
- `name`, `displayName`, `description`
- `categories` record — `{ label, description, type: "observation" | "sync+observation" }`
- `defaultSyncEvents` — ordered list of default category keys
- `backfill.supportedEntityTypes` / `backfill.defaultEntityTypes`
- `buildProviderConfig({ resourceId, resourceName, ... })` — builds provider JSONB config

**What `ProviderDefinition` does NOT carry today:**
- `installationMode` — not defined
- `resourceLabel` — not defined (e.g., "repositories", "projects", "teams")
- Resource listing / installation listing functions
- UI-specific normalization of API responses

---

### 11. The Gap — What a Generic UI Needs

The current adapter pattern fills a gap between the bespoke tRPC sub-routers
(`connections.github.*`, `connections.vercel.*`) and the generic rendering layer.

For the UI to become fully general-purpose driven by `ProviderDefinition`, one of these is needed:

**Option A — Generic tRPC contract (server side):**
Replace the four provider-specific connection/resource sub-routers with two generic procedures:
- `connections.listInstallations({ provider })` → `NormalizedInstallation[]`
- `connections.listResources({ provider, installationId })` → `NormalizedResource[]`

Plus add to `ProviderDefinition`:
- `installationMode: "multi" | "merged" | "single"`
- `resourceLabel: string`
- `customConnectUrl?: (data) => string` (GitHub-specific today)

**Option B — Extend `ProviderDefinition` with display-layer resource metadata:**
Add a new optional section (e.g., `resourcePicker`) to `ProviderDefinition` in `define.ts`:
```ts
resourcePicker?: {
  installationMode: "multi" | "merged" | "single";
  resourceLabel: string;
  customConnectUrl?: (data: { url: string; state: string }) => string;
}
```

Then move the normalization logic from the per-provider adapter into the `ProviderDefinition` itself.
The tRPC layer would still need to be genericized.

---

### 12. Provider-Specific tRPC Details — `connections.ts` (server)

The generic `connections.list` (`connections.ts:82-113`) already exists and returns all active
installations across providers — but only has `id`, `sourceType`, `isActive`, `connectedAt`, `lastSyncAt`.
The provider-specific sub-routers do extra API calls (via gateway proxy) to enrich this with
display data (account login, avatar URL, team name, etc.).

For GitHub: enriches via `get-app-installation` gateway proxy endpoint.
For Vercel: enriches via `get-user` or team lookup.
For Linear: enriches via Linear GraphQL `organization { name }`.
For Sentry: enriches via Sentry org API.

These API enrichment calls are what make per-provider routes hard to genericize without
adding a generic "get installation display info" endpoint to the gateway, or caching this
info in `gatewayInstallations.providerAccountInfo`.

---

## Code References

- `apps/console/src/app/.../sources/new/_components/adapters.ts:26` — `ProviderConnectAdapter` interface
- `apps/console/src/app/.../sources/new/_components/adapters.ts:55-213` — 4 hardcoded adapters
- `apps/console/src/app/.../sources/new/_components/adapters.ts:217-224` — `ADAPTERS` registry + `ORDERED_ADAPTERS`
- `apps/console/src/app/.../sources/new/_components/provider-source-item.tsx:33` — `ProviderSourceItem` component
- `apps/console/src/app/.../sources/new/_components/source-selection-provider.tsx:8` — `ProviderSelectionState`
- `apps/console/src/app/.../sources/new/_components/link-sources-button.tsx:43` — `bulkLinkResources` mutation
- `apps/console/src/app/.../sources/new/page.tsx:17` — server prefetch loop over adapters
- `apps/console/src/app/.../sources/new/_components/sources-section-loading.tsx` — hardcoded 4-provider skeleton
- `packages/console-providers/src/display.ts:16` — `PROVIDER_DISPLAY` + `IconDef`
- `packages/console-providers/src/display.ts:57-62` — `ProviderSlug` type + `PROVIDER_SLUGS`
- `packages/console-providers/src/registry.ts:27` — `PROVIDERS` object
- `packages/console-providers/src/define.ts:283` — `ProviderDefinition` interface
- `apps/console/src/hooks/use-oauth-popup.ts:25` — `useOAuthPopup` hook
- `api/console/src/router/org/connections.ts:82` — generic `connections.list`
- `api/console/src/router/org/connections.ts:184` — `connections.github` sub-router
- `api/console/src/router/org/connections.ts:863` — `connections.linear` sub-router

---

## Architecture Documentation

### Current Data Flow

```
page.tsx (server)
  → iterates ORDERED_ADAPTERS
  → calls prefetch(adapter.getConnectionQueryOptions(orgTrpc)) per provider
  → HydrateClient wraps SourceSelectionProvider + SourcesSection + LinkSourcesButton

SourcesSection
  → maps ORDERED_ADAPTERS → <ProviderSourceItem adapter={adapter} />

ProviderSourceItem
  → adapter.getConnectionQueryOptions → useSuspenseQuery (hydrated)
  → adapter.extractInstallations(data) → NormalizedInstallation[]
  → if mode=multi: adapter.getResourceQueryOptions per selected installation → useQuery
  → if mode=merged: adapter.getResourceQueryOptions per all installations → useQueries
  → adapter.extractResources(data) → NormalizedResource[]
  → useOAuthPopup for OAuth popup flow
  → renders accordion item

LinkSourcesButton
  → reads SourceSelectionContext per provider
  → adapter.buildLinkResources(rawResources) → { resourceId, resourceName }[]
  → trpc.workspace.integrations.bulkLinkResources mutation
```

### tRPC → UI Normalization

The **only** coupling to provider-specific fields is in:
1. `extractInstallations` — maps provider-specific connection data → `NormalizedInstallation`
2. `extractResources` — maps provider-specific resource data → `NormalizedResource`
3. `buildLinkResources` — maps raw resources → `{ resourceId, resourceName }` for mutation

The rendering layer (`provider-source-item.tsx`) is already 100% generic — it never touches
provider-specific fields. All provider knowledge is encapsulated in the adapter.

### Icon Rendering

`provider-source-item.tsx` uses `IntegrationLogoIcons[provider]` from `@repo/ui/integration-icons`.
`display.ts` carries `IconDef = { d, viewBox }` (SVG path data) but is not used by the current UI.
A generic re-implementation could render SVG icons directly from `PROVIDER_DISPLAY[provider].icon`
instead of importing the `@repo/ui` component map.

---

## Open Questions

1. **Generic tRPC contract**: Should `connections.listInstallations(provider)` and
   `connections.listResources(provider, installationId)` be added as generic procedures,
   or should provider-specific sub-routers remain and the adapters just get moved into `ProviderDefinition`?

2. **`installationMode` in `ProviderDefinition`**: The mode is currently purely adapter knowledge.
   Moving it into `ProviderDefinition` (or a display-layer extension) would allow the generic UI
   to drive rendering without any adapter.

3. **GitHub `customConnectUrl`**: The GitHub "Adjust permissions" URL uses `NEXT_PUBLIC_GITHUB_APP_SLUG`
   from `process.env` client-side (`adapters.ts:98`). This would need to come from
   `ProviderDefinition` (or provider config) in a generic approach.

4. **Enriched installation display info**: The provider-specific tRPC routes make extra API calls
   (gateway proxy) to fetch account login / avatar. A generic route needs to handle this enrichment,
   either via a generic gateway endpoint or by caching more in `gatewayInstallations.providerAccountInfo`.

5. **`resourceQueryKeys` for invalidation**: Currently hardcoded per adapter for `useOAuthPopup`.
   A generic approach would derive these from the provider key automatically.
