---
date: 2025-12-12T14:30:00+08:00
researcher: Claude
git_commit: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
branch: feat/memory-layer-foundation
repository: lightfast
topic: "/new route Maximum update depth exceeded error analysis"
tags: [research, codebase, infinite-loop, react, nuqs, state-management]
status: complete
last_updated: 2025-12-12
last_updated_by: Claude
---

# Research: /new Route Maximum Update Depth Exceeded Error

**Date**: 2025-12-12T14:30:00+08:00
**Researcher**: Claude
**Git Commit**: 474e7bd3eb28682238c2f046dda1c1a28ba18b2e
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

User reports accessing `http://localhost:3024/new?teamSlug=lightfast` triggers "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops."

## Summary

The `/new` route implements workspace creation with URL state management via nuqs. The component tree involves multiple layers of state synchronization between:
- URL query parameters (teamSlug, workspaceName) via nuqs
- React Hook Form state (organizationId, workspaceName)
- Context state (selectedRepositories, userSourceId, installations, selectedInstallation)
- tRPC query cache (organizations list, GitHub user source)

The current implementation contains several useEffect hooks that synchronize state across these layers, which can create circular update patterns.

## Detailed Findings

### Component Hierarchy

```
/new/page.tsx (Server Component)
├── WorkspaceHeader (Server Component)
└── HydrateClient
    └── NewWorkspaceInitializer (Client - reads cache, sets initial form values)
        └── WorkspaceFormProvider (Client - React Hook Form + Context)
            ├── OrganizationSelector (Client - useSuspenseQuery + nuqs setTeamSlug)
            ├── WorkspaceNameInput (Client - useEffect URL sync)
            ├── Suspense
            │   └── GitHubConnector (Client - 3 useEffect hooks)
            │       └── RepositoryPicker
            └── CreateWorkspaceButton
```

### URL State Management (`use-workspace-search-params.ts:12-29`)

```typescript
export function useWorkspaceSearchParams() {
  const [teamSlug, setTeamSlug] = useQueryState(
    "teamSlug",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  const [workspaceName, setWorkspaceName] = useQueryState(
    "workspaceName",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  return { teamSlug, setTeamSlug, workspaceName, setWorkspaceName };
}
```

The nuqs library manages URL query parameters. `shallow: true` prevents full page navigation on updates.

### State Synchronization Points

#### 1. WorkspaceNameInput URL Sync (`workspace-name-input.tsx:37-41`)

```typescript
// Initialize from URL on mount
useEffect(() => {
  if (urlWorkspaceName && !workspaceName) {
    form.setValue("workspaceName", urlWorkspaceName, { shouldValidate: true });
  }
}, [urlWorkspaceName, workspaceName, form]);
```

**Dependencies**: `[urlWorkspaceName, workspaceName, form]`
**State Updates**: Calls `form.setValue()` which triggers form re-render
**Condition**: Only runs if URL has value AND form is empty

#### 2. OrganizationSelector URL Update (`organization-selector.tsx:44-51`)

```typescript
const handleOrgChange = (orgId: string) => {
  const selectedOrg = organizations.find((org) => org.id === orgId);
  if (selectedOrg) {
    void setTeamSlug(selectedOrg.slug);
  }
};

// Called on Select onValueChange
field.onChange(value);  // Updates form state
handleOrgChange(value); // Updates URL state
```

**Trigger**: User selects organization OR form value changes
**State Updates**: Both form state AND URL state updated together

#### 3. GitHubConnector Effect 1 (`github-connector.tsx:41-44`)

```typescript
useEffect(() => {
  const id = githubUserSource?.id ?? null;
  setUserSourceId(id);
}, [githubUserSource?.id, setUserSourceId]);
```

**Dependencies**: `[githubUserSource?.id, setUserSourceId]`
**State Updates**: Updates context state

#### 4. GitHubConnector Effect 2 (`github-connector.tsx:47-49`)

```typescript
useEffect(() => {
  setInstallations(installations);
}, [installations, setInstallations]);
```

**Dependencies**: `[installations, setInstallations]`
**State Updates**: Updates context state with derived array

#### 5. GitHubConnector Effect 3 (`github-connector.tsx:55-75`)

```typescript
useEffect(() => {
  if (installations.length === 0) {
    if (selectedInstallation !== null) {
      setSelectedInstallation(null);
    }
  } else {
    const currentSelectionStillExists = selectedInstallation
      ? installations.some((inst) => inst.id === selectedInstallation.id)
      : false;

    if (!currentSelectionStillExists) {
      const firstInstall = installations[0];
      if (firstInstall) {
        setSelectedInstallation(firstInstall);
      }
    }
  }
}, [installations, selectedInstallation, setSelectedInstallation]);
```

**Dependencies**: `[installations, selectedInstallation, setSelectedInstallation]`
**State Updates**: Conditionally sets `selectedInstallation`

### NewWorkspaceInitializer Initialization (`new-workspace-initializer.tsx:45-59`)

```typescript
// Determine initial organization ID
let initialOrgId: string | undefined;

if (teamSlugHint) {
  const org = organizations.find((o) => o.slug === teamSlugHint);
  if (org) {
    initialOrgId = org.id;
  }
}

// Fallback: pick the most recent organization (first in list)
if (!initialOrgId && organizations.length > 0) {
  initialOrgId = organizations[0]?.id;
}
```

This component:
1. Reads `teamSlugHint` from server-side searchParams
2. Queries organization list via useSuspenseQuery
3. Resolves `teamSlugHint` to `orgId`
4. Passes `initialOrgId` to `WorkspaceFormProvider`

### WorkspaceFormProvider Initial Values (`workspace-form-provider.tsx:66-73`)

```typescript
const form = useForm<WorkspaceFormValues>({
  resolver: zodResolver(workspaceFormSchema),
  defaultValues: {
    organizationId: initialOrgId ?? "",
    workspaceName: initialWorkspaceName ?? "",
  },
  mode: "onChange", // Validate on change for real-time feedback
});
```

Form is initialized with:
- `organizationId` from resolved `teamSlugHint`
- `workspaceName` from URL parameter

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       URL Query Parameters                       │
│              ?teamSlug=lightfast&workspaceName=...              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NewWorkspaceInitializer                        │
│  - Reads searchParams from RSC                                  │
│  - Queries organizations via useSuspenseQuery                   │
│  - Resolves teamSlug → orgId                                    │
│  - Passes initialOrgId to WorkspaceFormProvider                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WorkspaceFormProvider                         │
│  - Creates React Hook Form with defaultValues                   │
│  - Creates Context for GitHub state                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ OrganizationSel │  │ WorkspaceNameIn │  │ GitHubConnector │
│ - useSuspenseQu │  │ - useEffect URL │  │ - 3 useEffects  │
│ - setTeamSlug() │  │   sync          │  │   for state     │
│   on change     │  │ - setUrlWorksp  │  │   sync          │
└─────────────────┘  │   aceName()     │  └─────────────────┘
                     └─────────────────┘
```

## Code References

- `apps/console/src/app/(app)/(user)/new/page.tsx:46-126` - Server component entry point
- `apps/console/src/app/(app)/(user)/new/_components/use-workspace-search-params.ts:12-29` - nuqs URL state hook
- `apps/console/src/app/(app)/(user)/new/_components/new-workspace-initializer.tsx:30-69` - Form initialization from URL
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx:56-111` - Form context provider
- `apps/console/src/app/(app)/(user)/new/_components/organization-selector.tsx:32-105` - Organization dropdown with URL sync
- `apps/console/src/app/(app)/(user)/new/_components/workspace-name-input.tsx:29-106` - Name input with URL sync
- `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx:18-129` - GitHub connector with 3 effects

## Architecture Documentation

### State Management Layers

| Layer | Technology | Components |
|-------|-----------|------------|
| URL State | nuqs (`useQueryState`) | teamSlug, workspaceName |
| Form State | React Hook Form | organizationId, workspaceName |
| Context State | React Context | selectedRepositories, userSourceId, installations, selectedInstallation |
| Query Cache | TanStack Query | organizations list, GitHub user source |

### Synchronization Pattern

The current architecture synchronizes state bidirectionally:
1. URL → Form (via useEffect in WorkspaceNameInput)
2. Form → URL (via handleOrgChange in OrganizationSelector)
3. Query → Context (via 3 useEffects in GitHubConnector)

### nuqs Configuration

- `shallow: true` - Client-side navigation without server round-trip
- `parseAsString.withDefault("")` - Default to empty string if param missing

### React Hook Form Configuration

- `mode: "onChange"` - Validates on every change, triggering re-renders

## Open Questions

1. What is the exact sequence of state updates when accessing `/new?teamSlug=lightfast`?
2. Does `mode: "onChange"` in React Hook Form contribute to excessive re-renders?
3. Are the nuqs `shallow: true` updates being processed synchronously or batched?
4. Does the `installations` array reference change on every render (causing Effect 2 to run repeatedly)?
5. Is there a race condition between the initial form defaultValues and the useEffect URL sync?
