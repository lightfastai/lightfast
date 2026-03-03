# Add Sources Page (`sources/new`) Implementation Plan

## Overview

Create a dedicated `/{slug}/{workspaceName}/sources/new` page that becomes the single source of truth for connecting sources to a workspace. The workspace creation flow (`/new`) will be simplified to only handle org selection + workspace name, then redirect to `sources/new`. The existing manage sources page gets an "Add Source" button linking to this new page.

## Current State Analysis

**Workspace creation (`/new`)**: Combines workspace form (org + name) and source selection in one page. Uses `WorkspaceFormProvider` that bundles both concerns. `CreateWorkspaceButton` does two-step: create workspace, then `Promise.allSettled` bulk link all 4 providers.

**Manage sources (`/{slug}/{workspaceName}/sources`)**: Read-only. Shows installed sources grouped by provider with search/filter. `LatestIntegrations` sidebar is static. No way to add new sources after workspace creation.

### Key Discoveries:
- Source item components (`github-source-item.tsx`, etc.) are coupled to `useWorkspaceForm()` context — `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx:176`
- `WorkspaceFormProvider` bundles workspace form fields (org + name) with source selection state — needs splitting
- `bulkLink*` mutations require `workspaceId` — `api/console/src/router/org/workspace.ts:1134`
- `workspace.sources.list` resolves workspace internally but doesn't expose `workspaceId` — `api/console/src/router/org/workspace.ts:579`
- OAuth popup hook is already shared at `~/hooks/use-oauth-popup.ts`
- `(manage)/layout.tsx` provides `max-w-5xl` container — `sources/new` inherits this automatically

## Desired End State

- `/{slug}/{workspaceName}/sources/new` — full source connection flow (OAuth + resource picker + bulk link) for all 4 providers
- `/new` workspace creation — simplified to org + name, redirects to `sources/new` after creation
- `/{slug}/{workspaceName}/sources` — existing manage page with "Add Source" button linking to `sources/new`
- Single set of source picker components, owned by `sources/new`

### Verification:
1. Creating a new workspace redirects to `sources/new`, where sources can be connected
2. Navigating from manage sources to `sources/new` allows adding more sources
3. `sources/new` correctly calls `bulkLink*` and redirects to workspace dashboard
4. Skipping source addition works (user can navigate away without selecting anything)

## What We're NOT Doing

- Making the existing source settings form (event subscriptions, backfill config) editable
- Adding source removal/disconnect functionality
- Changing the `bulkLink*` mutation signatures (we'll resolve `workspaceId` client-side)
- Modifying the OAuth popup flow or connection router

## Implementation Approach

Extract source picker components from `/new/_components/` into `sources/new/_components/`, replacing the `useWorkspaceForm()` dependency with a new standalone `useSourceSelection()` context. Simplify the workspace creation flow to redirect to `sources/new`. Add navigation from the manage page.

## Phase 1: Create `sources/new` page with extracted source picker

### Overview
Create the new page and move source picker components there with a new `SourceSelectionProvider` context.

### Changes Required:

#### 1. Expose `workspaceId` from `workspace.sources.list`
**File**: `api/console/src/router/org/workspace.ts`
**Changes**: Include `workspaceId` in the response so the `sources/new` page can pass it to `bulkLink*` mutations.

The query already resolves `workspaceId` at line ~583 via `resolveWorkspaceByName`. Just include it in the return value alongside `list`.

```typescript
// In the workspace.sources.list return:
return {
  workspaceId,
  list: results.map((row) => ({ ... })),
};
```

#### 2. Create `SourceSelectionProvider`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/source-selection-provider.tsx`
**Changes**: Extract source selection state from `WorkspaceFormProvider`. This is a pure state context — no form validation needed since the workspace already exists.

Contains:
- All 4 provider selection state (GitHub repos, Vercel projects, Sentry projects, Linear teams)
- Installation tracking state (gwInstallationId, installations, selectedInstallation per provider)
- Toggle helpers (toggleRepository, toggleProject, toggleSentryProject)
- Type exports derived from `RouterOutputs`

Does NOT contain:
- `react-hook-form` / `Form` wrapper
- `organizationId` / `workspaceName` fields
- `zodResolver` / `workspaceFormSchema`

#### 3. Move source item components
**Files**: Create under `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/`:
- `github-source-item.tsx` — copy from `/new/_components/`, change `useWorkspaceForm()` → `useSourceSelection()`
- `vercel-source-item.tsx` — same refactor
- `linear-source-item.tsx` — same refactor
- `sentry-source-item.tsx` — same refactor
- `sources-section.tsx` — accordion wrapper, same structure
- `sources-section-loading.tsx` — skeleton, copy as-is

Each component's logic stays identical — only the context hook import changes.

#### 4. Create `LinkSourcesButton`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx`
**Changes**: New component that reads source selection state and calls `bulkLink*` mutations.

Responsibilities:
- Reads selection state from `useSourceSelection()`
- Receives `workspaceId`, `clerkOrgSlug`, `workspaceName` as props
- Calls 4 `bulkLink*` mutations in parallel via `Promise.allSettled` (same pattern as current `CreateWorkspaceButton`)
- Shows toast with results
- Redirects to `/${clerkOrgSlug}/${workspaceName}` on completion
- Has a "Skip" link/button that navigates directly to the workspace without linking

#### 5. Create `sources/new/page.tsx`
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx`
**Changes**: RSC page with connection prefetches.

```typescript
export default async function AddSourcesPage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  // Prefetch connection status for all 4 providers
  prefetch(orgTrpc.connections.github.list.queryOptions());
  prefetch(orgTrpc.connections.vercel.list.queryOptions());
  prefetch(orgTrpc.connections.linear.get.queryOptions());
  prefetch(orgTrpc.connections.sentry.get.queryOptions());

  // Prefetch workspace sources (gives us workspaceId + existing sources)
  prefetch(
    orgTrpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    }),
  );

  return (
    <HydrateClient>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Add Sources</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select sources to connect to this workspace
          </p>
        </div>

        <SourceSelectionProvider>
          <Suspense fallback={<SourcesSectionLoading />}>
            <SourcesSection />
          </Suspense>
          <LinkSourcesButton
            clerkOrgSlug={slug}
            workspaceName={workspaceName}
          />
        </SourceSelectionProvider>
      </div>
    </HydrateClient>
  );
}
```

The `LinkSourcesButton` component internally fetches `workspaceId` from the prefetched `workspace.sources.list` cache via `useSuspenseQuery`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] Navigate to `/{slug}/{workspaceName}/sources/new` — page renders with all 4 provider accordions
- [ ] OAuth connection flow works for each provider
- [ ] Selecting a resource and clicking "Link Sources" calls `bulkLink*` and redirects
- [ ] Clicking "Skip" navigates to workspace dashboard without linking
- [ ] Already-connected sources show resource picker immediately (no re-auth needed)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Simplify workspace creation flow

### Overview
Remove source selection from `/new` and redirect to `sources/new` after workspace creation.

### Changes Required:

#### 1. Simplify `WorkspaceFormProvider`
**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
**Changes**: Remove all source selection state. Keep only the `react-hook-form` wrapper with `organizationId` and `workspaceName`.

The context interface shrinks to just the form — no more `selectedRepositories`, `gwInstallationId`, etc. This can likely be simplified to just using `FormProvider` directly without a custom context, since there's no extra state to share.

#### 2. Simplify `CreateWorkspaceButton`
**File**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`
**Changes**: Remove all `bulkLink*` mutations. After workspace creation, redirect to `sources/new`.

```typescript
// After workspace creation succeeds:
router.push(`/${selectedOrg.slug}/${workspace.workspaceName}/sources/new`);
```

Remove: `bulkLinkMutation`, `bulkLinkVercelMutation`, `bulkLinkSentryMutation`, `bulkLinkLinearMutation`, `Promise.allSettled` block, `useWorkspaceForm()` import.

#### 3. Simplify `/new/page.tsx`
**File**: `apps/console/src/app/(app)/(user)/new/page.tsx`
**Changes**:
- Remove `SourcesSection` import and rendering (Section 2)
- Remove `SourcesSectionLoading` import
- Remove 4 connection `prefetch()` calls (lines 61-64)
- Remove Suspense boundary
- The page becomes just: header + org selector + workspace name + create button

#### 4. Clean up unused files
**Files to delete from `apps/console/src/app/(app)/(user)/new/_components/`**:
- `github-source-item.tsx`
- `vercel-source-item.tsx`
- `linear-source-item.tsx`
- `sentry-source-item.tsx`
- `sources-section.tsx`
- `sources-section-loading.tsx`

These are now owned by `sources/new/_components/`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`
- [ ] No dead imports or unused files: verify deleted files are not referenced

#### Manual Verification:
- [ ] Navigate to `/new` — page shows only org selector + workspace name + create button (no sources section)
- [ ] Creating a workspace redirects to `/{slug}/{workspaceName}/sources/new`
- [ ] The full flow works end-to-end: create workspace → select sources → link → arrive at dashboard
- [ ] Optimistic workspace sidebar update still works after creation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Add "Add Source" button to manage sources page

### Overview
Add navigation from the existing manage sources page to `sources/new`.

### Changes Required:

#### 1. Add "Add Source" button to sources page
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx`
**Changes**: Add an "Add Source" button in the header that links to `sources/new`.

```tsx
<div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
    <p className="text-sm text-muted-foreground mt-1">
      Manage integrations connected to this workspace
    </p>
  </div>
  <Button asChild size="sm">
    <Link href={`/${slug}/${workspaceName}/sources/new`}>
      <Plus className="h-4 w-4 mr-2" />
      Add Source
    </Link>
  </Button>
</div>
```

#### 2. Add empty state CTA
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx`
**Changes**: When no integrations are installed, show a CTA linking to `sources/new` instead of just "No integrations installed yet".

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] "Add Source" button visible on manage sources page
- [ ] Clicking "Add Source" navigates to `sources/new`
- [ ] Empty state shows CTA to add sources
- [ ] After adding sources, returning to manage page shows them in the list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:
1. **New workspace flow**: `/new` → create workspace → lands on `sources/new` → connect GitHub → select repo → "Link Sources" → arrives at workspace dashboard → navigate to sources → see linked repo
2. **Add source from manage page**: Existing workspace → sources page → "Add Source" → `sources/new` → connect Vercel → select project → "Link Sources" → back to sources page → see new project
3. **Skip sources**: Create workspace → `sources/new` → "Skip" → arrives at workspace dashboard with no sources
4. **OAuth from sources/new**: Open `sources/new` → click "Connect GitHub" → complete OAuth popup → repos appear → select one → link
5. **Multiple providers**: On `sources/new`, connect GitHub + Linear → select repo + team → link both → verify both appear on manage page

## Performance Considerations

- RSC prefetching pattern preserved: `sources/new/page.tsx` prefetches all 4 connection queries + workspace sources, same as `/new` did
- No client-side fetch waterfalls — all data served from RSC-prefetched cache
- Workspace creation is now faster (no bulk link step), source linking happens on a separate page load

## References

- Current workspace creation: `apps/console/src/app/(app)/(user)/new/page.tsx`
- Current manage sources: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx`
- `WorkspaceFormProvider`: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- `bulkLink*` mutations: `api/console/src/router/org/workspace.ts:1134-1692`
- `workspace.sources.list`: `api/console/src/router/org/workspace.ts:579-647`
- OAuth popup hook: `apps/console/src/hooks/use-oauth-popup.ts`
- Provider config: `apps/console/src/lib/provider-config.ts`
