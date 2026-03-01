# Workspace Sources Accordion - Implementation Plan

## Overview

Replace the GitHub-only "Source Repository" section on the `/new` workspace creation page with a multi-provider "Sources" accordion. Each provider (GitHub, Vercel) gets its own accordion item with connection status and an inline resource picker. Users can select resources across multiple providers before creating the workspace.

## Current State Analysis

### What exists:
- `/new` page has a GitHub-only Section 2 ("Source Repository") with `GitHubConnector` + `RepositoryPicker`
- `WorkspaceFormProvider` context is entirely GitHub-specific: `gwInstallationId`, `installations`, `selectedInstallation`, `selectedRepositories`
- `CreateWorkspaceButton` calls `workspace.integrations.bulkLinkGitHubRepositories` only
- `vercel.listProjects` requires `workspaceId` (doesn't exist during creation)

### What's already built:
- `connections.list` tRPC endpoint returns all active provider connections for the org
- `connections.github.get` + `connections.github.repositories` for GitHub resources
- `connections.vercel.get` + `connections.vercel.listProjects` for Vercel resources
- `workspace.integrations.bulkLinkVercelProjects` mutation exists (`api/console/src/router/org/workspace.ts:1262`)
- `IntegrationIcons` component with provider SVGs (`packages/ui/src/components/integration-icons.tsx`)
- `connections.getAuthorizeUrl` works for all providers (popup OAuth flow)
- No shadcn Accordion component installed yet

### Key Discoveries:
- `vercel.listProjects` (`api/console/src/router/org/workspace.ts:672`) requires `workspaceId` to cross-reference `workspaceIntegrations` for `isConnected` flag — needs to be optional for workspace creation flow
- GitHub needs two IDs for repo listing: `integrationId` (gwInstallations.id) + `installationId` (GitHub App installation external ID from `providerAccountInfo.installations[].id`)
- Vercel needs one ID: `installationId` (gwInstallations.id)
- Existing `VercelProjectSelector` (`src/components/integrations/vercel-project-selector.tsx`) executes the bulk-link mutation directly — not suitable for deferred selection during workspace creation

## Desired End State

Section 2 of the `/new` page shows a "Sources" accordion with:
- **GitHub accordion item**: Shows connection status. When connected, inline repo picker with installation selector, search, multi-select. When not connected, "Connect GitHub" button with popup flow.
- **Vercel accordion item**: Shows connection status. When connected, inline project picker with multi-select. When not connected, "Connect Vercel" button with popup flow.

Form state tracks selections from both providers. On "Create Workspace", the button creates the workspace then bulk-links all selected resources (repos + projects) in parallel.

### Verification:
- Navigate to `/new` → see accordion with GitHub and Vercel items
- Expand connected provider → see resource picker, select resources
- Expand unconnected provider → see "Connect" button, popup works
- Click "Create Workspace" → workspace created, all selected resources linked
- `pnpm typecheck` and `pnpm lint` pass

## What We're NOT Doing

- Adding Sentry resource picker (no resource listing endpoint exists)
- Adding Linear support
- Changing the connections service (`apps/connections`)
- Modifying the existing `GitHubRepoSelector` or `VercelProjectSelector` dialog components in `src/components/integrations/`
- Changing the `gwInstallations` schema
- Adding pagination to the Vercel project list on this page (listProjects already fetches up to 100)

## Implementation Approach

Build from the bottom up: backend adjustment first, then form state, then UI components, then page assembly.

## Phase 1: Make `vercel.listProjects` workspaceId optional

### Overview
During workspace creation, no workspace exists yet. Make `workspaceId` optional so the endpoint can list projects without cross-referencing connected status.

### Changes Required:

#### 1. Update input schema and handler
**File**: `api/console/src/router/org/workspace.ts`

At the `vercel.listProjects` procedure (~line 672):

Change input schema:
```ts
z.object({
  installationId: z.string(),
  workspaceId: z.string().optional(), // was required
  cursor: z.string().optional(),
})
```

Conditionally skip the connected-projects query (around lines 745-754):
```ts
// Only check connected status if workspaceId provided
let connectedIds = new Set<string>();
if (input.workspaceId) {
  const connected = await ctx.db.query.workspaceIntegrations.findMany({
    where: and(
      eq(workspaceIntegrations.workspaceId, input.workspaceId),
      eq(workspaceIntegrations.installationId, input.installationId),
      eq(workspaceIntegrations.isActive, true),
    ),
    columns: { providerResourceId: true },
  });
  connectedIds = new Set(connected.map((c) => c.providerResourceId));
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

---

## Phase 2: Install Accordion UI component

### Overview
Add shadcn Accordion to `@repo/ui`.

### Changes Required:

```bash
cd packages/ui && npx shadcn@latest add accordion
```

### Success Criteria:

#### Automated Verification:
- [x] File exists: `packages/ui/src/components/ui/accordion.tsx` (already existed)
- [x] Type checking passes: `pnpm typecheck`

---

## Phase 3: Generalize form state in WorkspaceFormProvider

### Overview
Replace GitHub-only state with a provider-aware structure that tracks selections for both GitHub and Vercel.

### Changes Required:

**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`

Replace the GitHub-specific state with:

```ts
// Types
export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
}

// Existing types stay: Repository, GitHubInstallation

// Context state adds Vercel fields alongside existing GitHub fields:
interface WorkspaceFormState {
  // react-hook-form (unchanged)
  // ...

  // GitHub state (existing, rename for clarity)
  gwInstallationId: string | null;
  setGwInstallationId: (id: string | null) => void;
  installations: GitHubInstallation[];
  setInstallations: (installations: GitHubInstallation[]) => void;
  selectedInstallation: GitHubInstallation | null;
  setSelectedInstallation: (inst: GitHubInstallation | null) => void;
  selectedRepositories: Repository[];
  setSelectedRepositories: (repos: Repository[]) => void;
  toggleRepository: (repo: Repository) => void;

  // Vercel state (new)
  vercelInstallationId: string | null;
  setVercelInstallationId: (id: string | null) => void;
  selectedProjects: VercelProject[];
  setSelectedProjects: (projects: VercelProject[]) => void;
  toggleProject: (project: VercelProject) => void;
}
```

Add `useState` for `vercelInstallationId` and `selectedProjects`. Add `toggleProject` helper (same pattern as `toggleRepository`).

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`

---

## Phase 4: Create Sources accordion UI

### Overview
Build the new Section 2 components: a `SourcesSection` accordion container and per-provider accordion items.

### New Files:

#### 1. `apps/console/src/app/(app)/(user)/new/_components/sources-section.tsx`

Client component. The main accordion container.

```tsx
"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { GitHubSourceItem } from "./github-source-item";
import { VercelSourceItem } from "./vercel-source-item";

export function SourcesSection() {
  const trpc = useTRPC();

  // Fetch all org connections to know which providers are connected
  const { data: githubConnection } = useSuspenseQuery({
    ...trpc.connections.github.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: vercelConnection } = useSuspenseQuery({
    ...trpc.connections.vercel.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return (
    <Accordion type="multiple" className="w-full">
      <GitHubSourceItem connection={githubConnection} />
      <VercelSourceItem connection={vercelConnection} />
    </Accordion>
  );
}
```

#### 2. `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`

Client component. GitHub accordion item with connect button or inline repo picker.

Key behavior:
- Accordion trigger shows `IntegrationIcons.github`, "GitHub", and connection status badge
- Shows selected repo count badge when repos are selected
- When NOT connected: accordion content shows "Connect GitHub" button (popup flow from current `github-connector.tsx`)
- When connected: accordion content shows installation selector dropdown + inline repo picker (adapted from current `repository-picker.tsx`)
- Selections stored in `useWorkspaceForm()` context (`selectedRepositories`)

Props: `connection` — the result of `connections.github.get` (nullable).

This component absorbs the logic currently in `github-connector.tsx` + `repository-picker.tsx`:
- Popup OAuth flow for connecting
- Installation selector
- Repo search + multi-select checkboxes
- Sync connection data to form context

#### 3. `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx`

Client component. Vercel accordion item with connect button or inline project picker.

Key behavior:
- Accordion trigger shows `IntegrationIcons.vercel`, "Vercel", and connection status badge
- Shows selected project count badge when projects are selected
- When NOT connected: accordion content shows "Connect Vercel" button (popup flow using `connections.getAuthorizeUrl({ provider: "vercel" })`)
- When connected: accordion content shows inline project picker (search + multi-select, modeled after repo picker pattern)
- Calls `connections.vercel.listProjects({ installationId, workspaceId: undefined })` (no workspace yet)
- Selections stored in `useWorkspaceForm()` context (`selectedProjects`)

Props: `connection` — the result of `connections.vercel.get` (nullable).

#### 4. `apps/console/src/app/(app)/(user)/new/_components/sources-section-loading.tsx`

Static skeleton component for the Suspense fallback. Two accordion-shaped skeleton items.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Accordion renders with GitHub and Vercel items
- [ ] Connected providers show status badge and expand to show resource picker
- [ ] Unconnected providers show "Connect" button that opens popup
- [ ] Multi-select works for both repos and projects
- [ ] Selected counts appear on accordion triggers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 5: Update page.tsx and CreateWorkspaceButton

### Overview
Wire the new Sources section into the page and update the submit handler to bulk-link both GitHub repos and Vercel projects.

### Changes Required:

#### 1. Update page.tsx
**File**: `apps/console/src/app/(app)/(user)/new/page.tsx`

- Replace imports: remove `GitHubConnector`, `GitHubConnectorLoading`; add `SourcesSection`, `SourcesSectionLoading`
- Add prefetch for `connections.vercel.get` alongside existing `connections.github.get`
- Replace Section 2 content:
  - Change heading from "Source Repository" to "Sources"
  - Change description to "Select sources to connect to this workspace"
  - Replace `<Suspense fallback={<GitHubConnectorLoading />}><GitHubConnector /></Suspense>` with `<Suspense fallback={<SourcesSectionLoading />}><SourcesSection /></Suspense>`

#### 2. Update CreateWorkspaceButton
**File**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`

- Read `vercelInstallationId` and `selectedProjects` from `useWorkspaceForm()`
- Add a `bulkLinkVercelMutation` using `trpc.workspace.integrations.bulkLinkVercelProjects`
- In `handleCreateWorkspace`, after workspace creation:
  - If `selectedRepositories.length > 0`: call `bulkLinkGitHubRepositories` (existing)
  - If `selectedProjects.length > 0`: call `bulkLinkVercelProjects` (new)
  - Run both in parallel with `Promise.allSettled`
- Update success toast to show total linked count across both providers

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`

#### Manual Verification:
- [ ] `/new` page renders Sources accordion instead of GitHub-only section
- [ ] Select GitHub repos + Vercel projects → Create Workspace → all resources linked
- [ ] Creating workspace with only GitHub repos works
- [ ] Creating workspace with only Vercel projects works
- [ ] Creating workspace with no sources works
- [ ] Error in one provider link doesn't block the other

---

## Phase 6: Cleanup

### Overview
Remove obsolete files that are now superseded by the new Sources components.

### Changes Required:

Delete these files (functionality moved into `github-source-item.tsx` and `vercel-source-item.tsx`):
- `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/github-connector-loading.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx`

### Success Criteria:

#### Automated Verification:
- [x] No remaining imports of deleted files: grep confirms
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build:console`

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev: `pnpm dev:app`
2. Navigate to `/new`
3. **No connections**: Both accordion items show "Connect" buttons
4. Connect GitHub via popup → accordion updates to show repo picker
5. Connect Vercel via popup → accordion updates to show project picker
6. Select repos from multiple GitHub installations
7. Select Vercel projects
8. Fill in org + workspace name → Create Workspace
9. Verify workspace created with all selected sources linked
10. Navigate to workspace → sources page shows linked repos and projects

## References

- Current GitHub connector: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
- Current repo picker: `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx`
- Form provider: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- Connections tRPC router: `api/console/src/router/org/connections.ts`
- Workspace integrations router: `api/console/src/router/org/workspace.ts:870`
- Integration icons: `packages/ui/src/components/integration-icons.tsx`
- Reusable selectors (reference patterns): `src/components/integrations/github-repo-selector.tsx`, `src/components/integrations/vercel-project-selector.tsx`
- gwInstallations schema: `db/console/src/schema/tables/gw-installations.ts`
- workspaceIntegrations schema: `db/console/src/schema/tables/workspace-integrations.ts`
