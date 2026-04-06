---
date: 2026-04-04T12:00:00+08:00
researcher: claude
git_commit: fa1b286aa7e05f9dafbcd8081e720eecf4f1b7cd
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Provider connections setup: sources pages and multi-repo GitHub selection"
tags: [research, codebase, sources, github, connections, multi-select, resource-picker]
status: complete
last_updated: 2026-04-04
---

# Research: Provider Connections Setup — Sources Pages & Multi-Repo GitHub Selection

**Date**: 2026-04-04
**Git Commit**: fa1b286aa
**Branch**: refactor/drop-workspace-abstraction

## Research Question

How does the provider connections setup work in the sources pages (`sources/page.tsx` and `sources/new/page.tsx`)? What needs to change to allow adding multiple GitHub repos at once?

## Summary

The "Add Sources" flow at `/:slug/sources/new` uses a React context (`SourceSelectionProvider`) to manage selection state per provider. Currently, `toggleResource` enforces **single-select** — clicking a repo replaces any existing selection with that one repo, then collapses the picker to show a confirmation card. The downstream `bulkLink` tRPC mutation already accepts an array of resources and iterates them server-side, so the API layer requires no changes. The constraint is entirely in the UI: six specific touchpoints in two components enforce one-resource-at-a-time behavior.

## Detailed Findings

### 1. Sources Page (`sources/page.tsx`)

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx`

Server component that lists installed sources. Prefetches `connections.generic.listInstallations` for every provider in `PROVIDER_DISPLAY` (line 24-28) and `connections.resources.list` (line 30). Renders two main sections:
- `<InstalledSources>` (9 cols) — accordion of linked resources grouped by provider
- `<LatestIntegrations>` (3 cols) — static sidebar showing upcoming integrations

### 2. Add Sources Page (`sources/new/page.tsx`)

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/page.tsx`

Server component wrapping `<SourceSelectionProvider>` → `<SourcesSection>` + `<LinkSourcesButton>`. Prefetches the same queries as the main sources page, skipping `comingSoon` providers.

### 3. SourceSelectionProvider — Selection State

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/source-selection-provider.tsx`

State: `Map<ProviderSlug, ProviderSelectionState>` (line 48-50).

Each `ProviderSelectionState` (lines 11-15):
```ts
{
  installations: NormalizedInstallation[]
  selectedInstallation: NormalizedInstallation | null
  selectedResources: NormalizedResource[]
}
```

Key functions:
- `toggleResource` (lines 97-110) — **Single-select enforced here.** If resource exists in array, returns `[]`. Otherwise returns `[resource]`. Never appends.
- `setSelectedInstallation` (lines 78-86) — Resets `selectedResources` to `[]` when installation changes.
- `setSelectedResources` (lines 88-95) — Direct setter, accepts any `NormalizedResource[]`.
- `hasAnySelection` (lines 112-116) — Scans all providers, returns `true` if any has `selectedResources.length > 0`.

### 4. SourcesSection — Accordion Shell

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/sources-section.tsx`

Renders `<Accordion type="multiple">` iterating `PROVIDER_DISPLAY` keys. Providers with `comingSoon: true` get a disabled row. Currently only `github` reaches the active path via `<ProviderSourceItem>`.

### 5. ProviderSourceItem — Per-Provider Picker

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/provider-source-item.tsx`

**tRPC queries:**
- `connections.generic.listInstallations` (line 97-101) — fetches connected installations
- `connections.generic.listResources` (lines 152-176) — fetches resources for selected installation. For GitHub (`installationMode: "multi"`), uses single `useQuery` scoped to selected installation.

**UI states:**
1. **No connection** (lines 444-461) — Shows "Connect GitHub" button
2. **Connected, picker open** (lines 304-441) — Installation dropdown + search + scrollable repo list (`max-h-[260px]`)
3. **Connected, repo selected, picker closed** (lines 262-303) — Confirmation card with "Change" and "Clear" buttons

**Repo list rendering** (lines 388-426):
- Each repo is a `<button>` showing icon + `resource.name` + optional badge + optional subtitle
- Selected repo highlighted with `bg-accent/50`
- On click (lines 397-401): calls `toggleResource`, then `setShowPicker(false)` if selecting a new repo — **immediately collapses the picker**

**Badge in accordion header** (lines 252-256):
```tsx
{selectedResource && (
  <Badge>1 selected</Badge>
)}
```
Uses `selectedResource` (line 211: `state.selectedResources[0] ?? null`) — only reads the first element.

**GitHub-specific OAuth:** `customConnectUrl` at line 81 redirects to `https://github.com/apps/${NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target` for GitHub App installation flow.

### 6. LinkSourcesButton — Submit Action

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx`

**`handleLinkSources`** (lines 46-88):
1. Iterates all provider keys
2. Skips providers with no `selectedResources` or no `selectedInstallation`
3. Fires `linkMutation.mutateAsync({ provider, gwInstallationId, resources: [...] })` per provider
4. Runs all mutations via `Promise.allSettled` (line 68)
5. Shows success toast, invalidates cache, navigates to `/:slug/sources`

**The `resources` mapping at lines 60-63 already maps the full `selectedResources` array** — no changes needed here for multi-select.

### 7. bulkLink tRPC Mutation (Server)

**File:** `api/app/src/router/org/connections.ts:549-628`

**Input schema:**
```ts
z.object({
  provider: sourceTypeSchema,
  gwInstallationId: z.string().min(1),
  resources: z.array(z.object({
    resourceId: z.string(),
    resourceName: z.string().optional(),
  })).min(1)
})
```

**Handler:**
1. Verifies `gwInstallationId` belongs to org (lines 566-583)
2. Resolves provider definition and builds `providerConfig` (lines 586-599)
3. Iterates `input.resources` sequentially, running `INSERT INTO orgIntegrations ON CONFLICT DO UPDATE` per resource (lines 603-624)
4. Returns `{ created: number, reactivated: number }`

The API already accepts multiple resources. The sequential `for...of` loop handles them one at a time (not batched SQL), but functionally supports N resources per call.

### 8. GitHub Provider Definition

**File:** `packages/app-providers/src/providers/github/index.ts`

- `installationMode: "multi"` (line 282) — UI shows installation dropdown
- `resourceLabel: "repositories"` (line 283)
- `listResources` (lines 308-320) — calls `list-installation-repos?per_page=100`, maps each repo to `NormalizedResource`:
  - `id`: `String(r.id)` (numeric GitHub repo ID)
  - `name`: `r.full_name ?? r.name` (e.g., `"owner/repo-name"`)
  - `subtitle`: `r.description ?? null`
  - `badge`: `r.private ? "Private" : null`
- `defaultSyncEvents`: `["pull_request", "issues"]` (line 226)
- `buildProviderConfig` (lines 229-235): produces `{ provider: "github", type: "repository", sync: { events: [...], autoSync: true } }`

### 9. Database Tables

**`lightfast_gateway_installations`** (`db/app/src/schema/tables/gateway-installations.ts`):
- One row per OAuth connection per provider per org
- Unique on `(provider, externalId)` (line 74)
- Key columns: `id`, `provider`, `externalId`, `orgId`, `status`, `providerAccountInfo`, `backfillConfig`

**`lightfast_org_integrations`** (`db/app/src/schema/tables/org-integrations.ts`):
- One row per linked resource within an installation
- Unique on `(installationId, providerResourceId)` (line 99) — conflict target for bulkLink upsert
- Key columns: `id`, `clerkOrgId`, `installationId`, `provider`, `providerConfig`, `providerResourceId`, `status`, `documentCount`

**Relationship:**
```
Org (Clerk)
  └─ gatewayInstallations (one per GitHub App install)
       └─ orgIntegrations (one per repo)
```

### 10. Installed Sources Display

**File:** `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/installed-sources.tsx`

Resources are grouped by provider into accordion sections. Each resource renders as a `<Collapsible>` row with:
- Display name resolved live from `listResources` by matching `providerResourceId` (lines 220-222)
- Status indicator (amber for `awaiting_config`, green otherwise)
- Expandable settings form and optional `lightfast.yml` banner

## Single-Select Touchpoints (Changes Required for Multi-Select)

| File | Line(s) | What | Current Behavior |
|---|---|---|---|
| `source-selection-provider.tsx` | 97-110 | `toggleResource` | Replaces array with `[resource]` or `[]` — never appends |
| `provider-source-item.tsx` | 211 | `selectedResource` | `state.selectedResources[0] ?? null` — reads only first |
| `provider-source-item.tsx` | 252-256 | Badge text | Hardcoded `"1 selected"` |
| `provider-source-item.tsx` | 262 | Confirmation card condition | `selectedResource && !showPicker` — shows single resource card |
| `provider-source-item.tsx` | 399-401 | Click handler | Collapses picker on select: `setShowPicker(false)` |
| `provider-source-item.tsx` | 391-394 | Row highlight | `selectedResource?.id === resource.id` — single comparison |

**Already multi-select compatible (no changes needed):**

| File | Line(s) | What | Why |
|---|---|---|---|
| `source-selection-provider.tsx` | 88-95 | `setSelectedResources` | Accepts full `NormalizedResource[]` |
| `source-selection-provider.tsx` | 112-116 | `hasAnySelection` | Checks `selectedResources.length > 0` |
| `link-sources-button.tsx` | 60-63 | `resources` mapping | Maps full `selectedResources` array |
| `link-sources-button.tsx` | 70-75 | Total count | Sums `created + reactivated` across all results |
| `link-sources-button.tsx` | 79 | Toast text | Already uses `${totalLinked} source${totalLinked === 1 ? "" : "s"}` |
| `api/app/src/router/org/connections.ts` | 549-628 | `bulkLink` mutation | Accepts `resources: z.array(...).min(1)`, iterates all |

## Code References

- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx` — Main sources page
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/page.tsx` — Add sources page
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/source-selection-provider.tsx` — Selection context with `toggleResource` single-select logic
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/provider-source-item.tsx` — Per-provider picker with repo list, confirmation card, badge
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx` — Submit button, already maps full `selectedResources` array
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/sources-section.tsx` — Accordion shell
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/installed-sources.tsx` — Installed sources display
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/latest-integrations.tsx` — Static sidebar widget
- `api/app/src/router/org/connections.ts:549-628` — `bulkLink` mutation (already supports arrays)
- `api/app/src/router/org/connections.ts:632-688` — `listInstallations` query
- `api/app/src/router/org/connections.ts:690-759` — `listResources` query
- `packages/app-providers/src/providers/github/index.ts:308-320` — `listResources` maps repos to `NormalizedResource`
- `packages/app-providers/src/providers/github/index.ts:282-284` — `installationMode: "multi"`, `resourceLabel: "repositories"`
- `packages/app-providers/src/client/display.ts:52-59` — GitHub display entry
- `db/app/src/schema/tables/org-integrations.ts` — `lightfast_org_integrations` table
- `db/app/src/schema/tables/gateway-installations.ts` — `lightfast_gateway_installations` table

## Architecture Documentation

### Data Flow — Add Sources Submission

```
SourceSelectionProvider (Map<ProviderSlug, { installations, selectedInstallation, selectedResources }>)
  └─ ProviderSourceItem (per provider)
       ├─ listInstallations → installation dropdown (GitHub: multi mode)
       ├─ listResources → flat repo list with search
       └─ toggleResource → updates selectedResources in context
  └─ LinkSourcesButton
       ├─ Iterates all providers with selections
       ├─ Fires bulkLink per provider (resources: selectedResources[])
       ├─ Promise.allSettled → count linked
       └─ Invalidate cache → navigate to /sources
```

### Provider Resource Discovery

```
GitHub App Install (gatewayInstallations row)
  └─ listResources → GET /installation/repositories?per_page=100
       └─ NormalizedResource per repo: { id: repoId, name: "owner/repo", badge: "Private"|null }
```

### Resource Persistence

```
bulkLink({ provider, gwInstallationId, resources: [{ resourceId, resourceName }] })
  └─ for each resource:
       INSERT INTO orgIntegrations (installationId, provider, providerResourceId, providerConfig, ...)
       ON CONFLICT (installationId, providerResourceId) DO UPDATE SET status = 'active'
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-04-gateway-resources-orgintegrations-consolidation.md` — Documents the consolidation of `gatewayResources` into `orgIntegrations`, including the `bulkLink` route as a consumer
- `thoughts/shared/plans/2026-04-04-consolidate-gateway-resources-into-org-integrations.md` — Implementation plan for the consolidation, including GitHub-specific resource name resolution and Sources page regression checklist

## Related Research

- `thoughts/shared/research/2026-04-04-proxy-schema-blast-radius.md` — Proxy redesign analysis, covers multi-installation resolution for GitHub

## Open Questions

- The `list-installation-repos` endpoint uses `per_page=100` without pagination — orgs with >100 repos will only see the first 100
- No Inngest workflow is triggered on `bulkLink` — backfill must be triggered separately after linking
- The `reactivated` counter in `bulkLink` is always 0 (line 627) even when rows are conflict-updated back to active
