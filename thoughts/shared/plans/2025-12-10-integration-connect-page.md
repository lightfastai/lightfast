# Integration Connect Page Implementation Plan

## Overview

Build a dedicated `/[slug]/[workspaceName]/sources/connect` page that provides a single-page flow for connecting new integrations (GitHub repositories, Vercel projects) to a workspace. The page follows the `/new` workspace creation pattern with numbered sections, server component prefetching, and client islands for interactivity.

## Current State Analysis

### Existing Infrastructure

The codebase already has solid foundations:

1. **Database Architecture**: Two-table design with `userSources` (OAuth connections) and `workspaceIntegrations` (workspace-linked resources)
2. **OAuth Flows**: Complete GitHub and Vercel OAuth implementations
3. **UI Components**: `VercelProjectSelector` modal, `IntegrationIcons`, shadcn components
4. **tRPC Routes**: `userSources.github.get`, `userSources.vercel.get`, `workspace.integrations.bulkLinkVercelProjects`

### What's Missing

1. **Connect Page**: No dedicated marketplace-style page for adding integrations
2. **GitHub Repo Selector**: No modal equivalent to `VercelProjectSelector` for GitHub
3. **Bulk GitHub Linking**: No `bulkLinkGitHubRepositories` tRPC mutation
4. **Provider Selection UI**: No tab/card selector for choosing providers

### Key Files Referenced

- `apps/console/src/app/(app)/(user)/new/page.tsx` - Pattern to follow
- `apps/console/src/components/integrations/vercel-project-selector.tsx` - Modal pattern
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/page.tsx` - Parent page
- `api/console/src/router/user/user-sources.ts` - User source queries
- `api/console/src/router/org/workspace.ts` - Workspace integration mutations

## Desired End State

A fully functional `/sources/connect` page where users can:

1. Select a provider (GitHub or Vercel) via clickable cards
2. Connect their OAuth account if not already connected
3. Select multiple repositories/projects from a searchable list
4. Connect selected resources to their workspace in one action
5. See success feedback and navigate back to sources list

### Verification Criteria

- Navigating to `/sources/connect` shows provider selection
- URL updates to `?provider=github` or `?provider=vercel` when switching
- OAuth redirect returns to connect page with `&connected=true`
- Already-connected resources show "Connected" badge and are disabled
- Bulk connect creates `workspaceIntegrations` records
- Success redirects to `/sources` with connected resources visible

## What We're NOT Doing

- **No marketplace catalog**: This is a simple connect flow, not a full marketplace with categories/search
- **No integration details drawer**: Users don't need permission previews for our first-party integrations
- **No Linear/Slack/Notion implementation**: Only "Coming Soon" cards, no actual OAuth flows
- **No sync configuration**: Using default sync settings, no advanced config UI
- **No waitlist for coming soon**: Just static "Coming Soon" badge

## Implementation Approach

Follow the `/new` page pattern exactly:
1. Server component with `prefetch()` for user sources
2. `<HydrateClient>` wrapper for data transfer
3. Form provider context for shared state
4. `nuqs` for URL state (`?provider=github|vercel`)
5. Client islands for interactive sections
6. Numbered sections with clear visual hierarchy

---

## Phase 1: Page Foundation

### Overview

Create the base page structure with server component, prefetching, and layout matching the `/new` page pattern.

### Changes Required

#### 1. Create Connect Page Directory Structure

**Files to create:**
```
apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/
├── page.tsx
└── _components/
    ├── connect-header.tsx
    ├── connect-form-provider.tsx
    ├── connect-initializer.tsx
    └── connect-loading.tsx
```

#### 2. Server Component Page

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/page.tsx`

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, userTrpc } from "@repo/console-trpc/server";
import { ConnectHeader } from "./_components/connect-header";
import { ConnectInitializer } from "./_components/connect-initializer";
import { ConnectLoading } from "./_components/connect-loading";

/**
 * Integration Connect Page
 *
 * Single-page flow for connecting new integrations to workspace.
 * Follows /new workspace creation pattern:
 * - Server component with prefetch
 * - nuqs for URL state (provider selection)
 * - Client islands for interactive sections
 */
export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ provider?: string; connected?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { provider = "github", connected } = await searchParams;

  // Prefetch user sources for both providers (no waterfall)
  prefetch(userTrpc.userSources.github.get.queryOptions());
  prefetch(userTrpc.userSources.vercel.get.queryOptions());

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="min-h-full flex items-start justify-center py-12">
        <div className="w-full max-w-3xl px-6">
          {/* Static Header */}
          <ConnectHeader />

          <HydrateClient>
            <Suspense fallback={<ConnectLoading />}>
              <ConnectInitializer
                initialProvider={provider as "github" | "vercel"}
                initialConnected={connected === "true"}
                clerkOrgSlug={slug}
                workspaceName={workspaceName}
              />
            </Suspense>
          </HydrateClient>
        </div>
      </div>
    </div>
  );
}
```

#### 3. Static Header Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-header.tsx`

```tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function ConnectHeader() {
  return (
    <div className="mb-8">
      <Link
        href="../sources"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Sources
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Connect Integration</h1>
      <p className="text-muted-foreground mt-2">
        Add a new source to your workspace
      </p>
    </div>
  );
}
```

#### 4. Form Provider Context

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-form-provider.tsx`

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SelectedResource {
  id: string;
  name: string;
  fullName?: string; // For GitHub repos: "owner/repo"
}

interface ConnectFormContextValue {
  // Provider state
  provider: "github" | "vercel";
  setProvider: (provider: "github" | "vercel") => void;

  // Connection state
  isConnected: boolean;
  userSourceId: string | null;

  // GitHub-specific
  selectedInstallationId: string | null;
  setSelectedInstallationId: (id: string | null) => void;

  // Resource selection
  selectedResources: SelectedResource[];
  setSelectedResources: (resources: SelectedResource[]) => void;

  // Workspace context
  clerkOrgSlug: string;
  workspaceName: string;
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
}

const ConnectFormContext = createContext<ConnectFormContextValue | null>(null);

export function ConnectFormProvider({
  children,
  initialProvider,
  clerkOrgSlug,
  workspaceName,
}: {
  children: ReactNode;
  initialProvider: "github" | "vercel";
  clerkOrgSlug: string;
  workspaceName: string;
}) {
  const [provider, setProvider] = useState<"github" | "vercel">(initialProvider);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Connection state will be derived from queries in child components
  const value: ConnectFormContextValue = {
    provider,
    setProvider,
    isConnected: false, // Will be overridden by child components
    userSourceId: null, // Will be set by child components
    selectedInstallationId,
    setSelectedInstallationId,
    selectedResources,
    setSelectedResources,
    clerkOrgSlug,
    workspaceName,
    workspaceId,
    setWorkspaceId,
  };

  return (
    <ConnectFormContext.Provider value={value}>
      {children}
    </ConnectFormContext.Provider>
  );
}

export function useConnectForm() {
  const context = useContext(ConnectFormContext);
  if (!context) {
    throw new Error("useConnectForm must be used within ConnectFormProvider");
  }
  return context;
}
```

#### 5. Loading Skeleton

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-loading.tsx`

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function ConnectLoading() {
  return (
    <div className="space-y-8">
      {/* Section 1: Provider Selection */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-24 w-40" />
            <Skeleton className="h-24 w-40" />
            <Skeleton className="h-24 w-40" />
          </div>
        </div>
      </div>

      {/* Section 2: Connect Account */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>

      {/* Section 3: Select Resources */}
      <div className="flex gap-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] Page renders at `/[slug]/[workspaceName]/sources/connect`: `pnpm dev:console` and navigate
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] Server component prefetches both user sources (check network tab)

#### Manual Verification:
- [ ] Back link navigates to `/sources`
- [ ] Header displays "Connect Integration" title
- [ ] Loading skeleton appears briefly before content

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Provider Selection

### Overview

Implement the provider selector UI with clickable cards for GitHub, Vercel, and "Coming Soon" placeholders. Use `nuqs` to sync selection with URL.

### Changes Required

#### 1. nuqs URL State Hook

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/use-connect-params.ts`

```tsx
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

const providers = ["github", "vercel"] as const;
export type Provider = (typeof providers)[number];

export function useConnectParams() {
  const [provider, setProvider] = useQueryState(
    "provider",
    parseAsStringLiteral(providers).withDefault("github").withOptions({
      shallow: true,
      history: "push",
    })
  );

  const [connected, setConnected] = useQueryState(
    "connected",
    parseAsStringLiteral(["true"] as const).withOptions({
      shallow: true,
    })
  );

  return {
    provider,
    setProvider,
    connected: connected === "true",
    clearConnected: () => setConnected(null),
  };
}
```

#### 2. Provider Selector Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/provider-selector.tsx`

```tsx
"use client";

import { IntegrationIcons } from "@repo/ui/integration-icons";
import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";
import { useConnectParams, type Provider } from "./use-connect-params";

interface ProviderOption {
  id: Provider | "coming_soon";
  name: string;
  description: string;
  icon: keyof typeof IntegrationIcons;
  status: "available" | "coming_soon";
}

const providers: ProviderOption[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories",
    icon: "github",
    status: "available",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Connect projects",
    icon: "vercel",
    status: "available",
  },
];

const comingSoon: ProviderOption[] = [
  {
    id: "coming_soon",
    name: "Linear",
    description: "Coming soon",
    icon: "linear",
    status: "coming_soon",
  },
  {
    id: "coming_soon",
    name: "Slack",
    description: "Coming soon",
    icon: "slack",
    status: "coming_soon",
  },
  {
    id: "coming_soon",
    name: "Notion",
    description: "Coming soon",
    icon: "notion",
    status: "coming_soon",
  },
];

export function ProviderSelector() {
  const { provider, setProvider } = useConnectParams();

  return (
    <div className="flex flex-wrap gap-3">
      {providers.map((option) => {
        const Icon = IntegrationIcons[option.icon];
        const isSelected = provider === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setProvider(option.id as Provider)}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all min-w-[120px]",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4 text-primary" />
              </div>
            )}
            <Icon className="h-8 w-8 mb-2" />
            <span className="font-medium text-sm">{option.name}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}

      {/* Coming Soon */}
      {comingSoon.map((option, index) => {
        const Icon = IntegrationIcons[option.icon];

        return (
          <div
            key={`${option.name}-${index}`}
            className="relative flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-border/50 min-w-[120px] opacity-50 cursor-not-allowed"
          >
            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Soon
            </span>
            <Icon className="h-8 w-8 mb-2" />
            <span className="font-medium text-sm">{option.name}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

#### 3. Connect Initializer (Updated)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-initializer.tsx`

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { ConnectFormProvider } from "./connect-form-provider";
import { useConnectParams } from "./use-connect-params";
import { ProviderSelector } from "./provider-selector";
import { GitHubConnector } from "./github-connector";
import { VercelConnector } from "./vercel-connector";
import { ResourcePicker } from "./resource-picker";
import { ConnectButton } from "./connect-button";

interface ConnectInitializerProps {
  initialProvider: "github" | "vercel";
  initialConnected: boolean;
  clerkOrgSlug: string;
  workspaceName: string;
}

export function ConnectInitializer({
  initialProvider,
  initialConnected,
  clerkOrgSlug,
  workspaceName,
}: ConnectInitializerProps) {
  const { provider, clearConnected } = useConnectParams();

  // Clear connected param after reading
  useEffect(() => {
    if (initialConnected) {
      clearConnected();
    }
  }, [initialConnected, clearConnected]);

  return (
    <ConnectFormProvider
      initialProvider={initialProvider}
      clerkOrgSlug={clerkOrgSlug}
      workspaceName={workspaceName}
    >
      <div className="space-y-8">
        {/* Section 1: Select Provider */}
        <Section number={1} title="Select Provider">
          <ProviderSelector />
        </Section>

        {/* Section 2: Connect Account */}
        <Section number={2} title="Connect Account">
          {provider === "github" ? (
            <GitHubConnector autoOpen={initialConnected} />
          ) : (
            <VercelConnector autoOpen={initialConnected} />
          )}
        </Section>

        {/* Section 3: Select Resources */}
        <Section number={3} title="Select Resources">
          <ResourcePicker />
        </Section>
      </div>

      {/* Footer with action button */}
      <ConnectButton />
    </ConnectFormProvider>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
        {number}
      </div>
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] Provider cards display with icons
- [ ] Clicking GitHub card shows checkmark and updates URL to `?provider=github`
- [ ] Clicking Vercel card shows checkmark and updates URL to `?provider=vercel`
- [ ] Coming Soon cards are visually disabled
- [ ] URL param persists on page refresh

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: GitHub Connector

### Overview

Implement the GitHub connector section that shows OAuth status, installation selector, and triggers the repository selector modal.

### Changes Required

#### 1. GitHub Connector Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/github-connector.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Check, ExternalLink } from "lucide-react";
import { useConnectForm } from "./connect-form-provider";
import { GitHubRepoSelector } from "@/components/integrations/github-repo-selector";

interface GitHubConnectorProps {
  autoOpen?: boolean;
}

export function GitHubConnector({ autoOpen = false }: GitHubConnectorProps) {
  const trpc = useTRPC();
  const {
    setSelectedInstallationId,
    selectedInstallationId,
    clerkOrgSlug,
    workspaceName,
  } = useConnectForm();

  const [showRepoSelector, setShowRepoSelector] = useState(false);

  // Fetch GitHub connection status (prefetched on server)
  const { data: githubSource, refetch } = useSuspenseQuery({
    ...trpc.userSources.github.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isConnected = !!githubSource?.id;
  const installations = githubSource?.installations ?? [];

  // Auto-select first installation
  useEffect(() => {
    if (installations.length > 0 && !selectedInstallationId) {
      setSelectedInstallationId(installations[0].id);
    }
  }, [installations, selectedInstallationId, setSelectedInstallationId]);

  // Auto-open repo selector after OAuth return
  useEffect(() => {
    if (autoOpen && isConnected && installations.length > 0) {
      setShowRepoSelector(true);
    }
  }, [autoOpen, isConnected, installations.length]);

  const handleConnectGitHub = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const currentPath = `/${clerkOrgSlug}/${workspaceName}/sources/connect?provider=github&connected=true`;
    const popup = window.open(
      `/api/github/install-app?redirect=${encodeURIComponent(currentPath)}`,
      "github-install",
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    // Poll for popup close
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        void refetch();
      }
    }, 500);
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <IntegrationIcons.github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Connect your GitHub account to select repositories
        </p>
        <Button onClick={handleConnectGitHub}>
          <IntegrationIcons.github className="h-4 w-4 mr-2" />
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Status */}
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>Connected to GitHub</span>
      </div>

      {/* Installation Selector */}
      {installations.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">GitHub Installation</label>
          <Select
            value={selectedInstallationId ?? undefined}
            onValueChange={setSelectedInstallationId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select installation" />
            </SelectTrigger>
            <SelectContent>
              {installations.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  <div className="flex items-center gap-2">
                    <img
                      src={inst.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded"
                    />
                    <span>{inst.accountLogin}</span>
                    <span className="text-xs text-muted-foreground">
                      ({inst.accountType})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {installations.length === 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <img
            src={installations[0].avatarUrl}
            alt=""
            className="h-5 w-5 rounded"
          />
          <span>{installations[0].accountLogin}</span>
        </div>
      )}

      {installations.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>
            No GitHub App installations found.{" "}
            <button
              onClick={handleConnectGitHub}
              className="underline hover:no-underline"
            >
              Install the GitHub App
            </button>{" "}
            to access your repositories.
          </p>
        </div>
      )}

      {/* Select Repos Button */}
      {selectedInstallationId && (
        <Button
          variant="outline"
          onClick={() => setShowRepoSelector(true)}
          className="w-full"
        >
          Select Repositories
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      )}

      {/* Repo Selector Modal */}
      {githubSource && selectedInstallationId && (
        <GitHubRepoSelector
          open={showRepoSelector}
          onOpenChange={setShowRepoSelector}
          userSourceId={githubSource.id}
          installationId={selectedInstallationId}
          clerkOrgSlug={clerkOrgSlug}
          workspaceName={workspaceName}
        />
      )}
    </div>
  );
}
```

#### 2. GitHub Repo Selector Modal

**File**: `apps/console/src/components/integrations/github-repo-selector.tsx`

```tsx
"use client";

import { useState } from "react";
import { useTRPC } from "@repo/console-trpc/react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Loader2, RefreshCw, Search, Lock, Globe } from "lucide-react";

interface GitHubRepoSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userSourceId: string;
  installationId: string;
  clerkOrgSlug: string;
  workspaceName: string;
  connectedRepoIds?: Set<string>;
  onSelect?: (repos: Array<{ id: string; name: string; fullName: string }>) => void;
}

export function GitHubRepoSelector({
  open,
  onOpenChange,
  userSourceId,
  installationId,
  clerkOrgSlug,
  workspaceName,
  connectedRepoIds = new Set(),
  onSelect,
}: GitHubRepoSelectorProps) {
  const trpc = useTRPC();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch repositories
  const {
    data: repos,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.userSources.github.repositories.queryOptions({
      integrationId: userSourceId,
      installationId,
    }),
    enabled: open,
  });

  // Filter repos by search
  const filteredRepos = repos?.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (repoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!filteredRepos) return;
    const unconnectedIds = filteredRepos
      .filter((r) => !connectedRepoIds.has(r.id))
      .map((r) => r.id);
    setSelectedIds(new Set(unconnectedIds));
  };

  const handleConfirm = () => {
    if (!repos || !onSelect) return;
    const selectedRepos = repos
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, fullName: r.fullName }));
    onSelect(selectedRepos);
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const unconnectedCount =
    filteredRepos?.filter((r) => !connectedRepoIds.has(r.id)).length ?? 0;
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <IntegrationIcons.github className="h-5 w-5" />
              Select Repositories
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <DialogDescription>
            Choose repositories to connect to &quot;{workspaceName}&quot;
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load repositories</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : filteredRepos?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No repositories match your search"
                : "No repositories found"}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select All Header */}
              {unconnectedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    {unconnectedCount} repositor
                    {unconnectedCount === 1 ? "y" : "ies"} available
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedCount === unconnectedCount}
                  >
                    Select All
                  </Button>
                </div>
              )}

              {/* Repository List */}
              {filteredRepos?.map((repo) => {
                const isConnected = connectedRepoIds.has(repo.id);
                return (
                  <label
                    key={repo.id}
                    className={`flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer ${
                      isConnected ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isConnected || selectedIds.has(repo.id)}
                      disabled={isConnected}
                      onCheckedChange={() => handleToggle(repo.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {repo.fullName}
                        </span>
                        {repo.isPrivate ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                        {isConnected && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Connected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {repo.language && <span>{repo.language}</span>}
                        {repo.stargazersCount > 0 && (
                          <span>{repo.stargazersCount} stars</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Select {selectedCount} Repositor{selectedCount === 1 ? "y" : "ies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] When not connected, shows "Connect GitHub" button
- [ ] Clicking connect opens OAuth popup
- [ ] After OAuth, shows "Connected to GitHub" status
- [ ] Installation dropdown appears if multiple installations
- [ ] "Select Repositories" button opens modal
- [ ] Repositories load with search and checkboxes
- [ ] Already-connected repos show "Connected" badge

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Vercel Connector

### Overview

Implement the Vercel connector section, reusing the existing `VercelProjectSelector` component.

### Changes Required

#### 1. Vercel Connector Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/vercel-connector.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Check, ExternalLink } from "lucide-react";
import { useConnectForm } from "./connect-form-provider";
import { VercelProjectSelector } from "@/components/integrations/vercel-project-selector";

interface VercelConnectorProps {
  autoOpen?: boolean;
}

export function VercelConnector({ autoOpen = false }: VercelConnectorProps) {
  const trpc = useTRPC();
  const { clerkOrgSlug, workspaceName, workspaceId, setWorkspaceId } =
    useConnectForm();

  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Fetch Vercel connection status (prefetched on server)
  const { data: vercelSource, refetch } = useSuspenseQuery({
    ...trpc.userSources.vercel.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch workspace to get ID
  const { data: workspace } = useSuspenseQuery({
    ...trpc.workspaceAccess.getBySlug.queryOptions({
      clerkOrgSlug,
      workspaceName,
    }),
  });

  // Set workspace ID in context
  useEffect(() => {
    if (workspace?.id) {
      setWorkspaceId(workspace.id);
    }
  }, [workspace?.id, setWorkspaceId]);

  const isConnected = !!vercelSource?.id;

  // Auto-open project selector after OAuth return
  useEffect(() => {
    if (autoOpen && isConnected) {
      setShowProjectSelector(true);
    }
  }, [autoOpen, isConnected]);

  const handleConnectVercel = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const currentPath = `/${clerkOrgSlug}/${workspaceName}/sources/connect?provider=vercel&connected=true`;
    const popup = window.open(
      `/api/vercel/authorize?redirect=${encodeURIComponent(currentPath)}`,
      "vercel-authorize",
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    // Poll for popup close
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        void refetch();
      }
    }, 500);
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <IntegrationIcons.vercel className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Connect your Vercel account to select projects
        </p>
        <Button onClick={handleConnectVercel}>
          <IntegrationIcons.vercel className="h-4 w-4 mr-2" />
          Connect Vercel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Status */}
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>
          Connected to Vercel
          {vercelSource.teamSlug && ` (${vercelSource.teamSlug})`}
        </span>
      </div>

      {/* Select Projects Button */}
      <Button
        variant="outline"
        onClick={() => setShowProjectSelector(true)}
        className="w-full"
      >
        Select Projects
        <ExternalLink className="h-4 w-4 ml-2" />
      </Button>

      {/* Project Selector Modal */}
      {vercelSource && workspaceId && (
        <VercelProjectSelector
          open={showProjectSelector}
          onOpenChange={setShowProjectSelector}
          userSourceId={vercelSource.id}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      )}
    </div>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] When not connected, shows "Connect Vercel" button
- [ ] Clicking connect opens OAuth popup
- [ ] After OAuth, shows "Connected to Vercel" status with team name
- [ ] "Select Projects" button opens existing VercelProjectSelector
- [ ] Projects can be selected and connected

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Resource Picker & Connect Button

### Overview

Implement the resource picker display (shows selected repos/projects) and the final connect button.

### Changes Required

#### 1. Resource Picker Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/resource-picker.tsx`

```tsx
"use client";

import { useConnectForm } from "./connect-form-provider";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export function ResourcePicker() {
  const { provider, selectedResources, setSelectedResources } = useConnectForm();

  if (selectedResources.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground">
        <p>
          {provider === "github"
            ? "Select repositories from the section above"
            : "Select projects from the section above"}
        </p>
      </div>
    );
  }

  const handleRemove = (id: string) => {
    setSelectedResources(selectedResources.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-2">
        {selectedResources.length}{" "}
        {provider === "github" ? "repositor" : "project"}
        {selectedResources.length === 1 ? "y" : "ies"} selected
      </div>

      <div className="rounded-lg border border-border divide-y">
        {selectedResources.map((resource) => (
          <div
            key={resource.id}
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-3">
              {provider === "github" ? (
                <IntegrationIcons.github className="h-5 w-5" />
              ) : (
                <IntegrationIcons.vercel className="h-5 w-5" />
              )}
              <span className="font-medium">
                {resource.fullName ?? resource.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleRemove(resource.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 2. Connect Button Component

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-button.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@repo/console-trpc/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConnectForm } from "./connect-form-provider";

export function ConnectButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const {
    provider,
    selectedResources,
    workspaceId,
    userSourceId,
    selectedInstallationId,
    clerkOrgSlug,
    workspaceName,
  } = useConnectForm();

  // GitHub bulk link mutation
  const githubMutation = useMutation({
    ...trpc.workspace.integrations.bulkLinkGitHubRepositories.mutationOptions(),
    onSuccess: (result) => {
      const count = result.created + result.reactivated;
      toast.success(`Connected ${count} repositor${count === 1 ? "y" : "ies"}`);
      router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to connect repositories");
    },
  });

  // Vercel bulk link mutation
  const vercelMutation = useMutation({
    ...trpc.workspace.integrations.bulkLinkVercelProjects.mutationOptions(),
    onSuccess: (result) => {
      const count = result.created + result.reactivated;
      toast.success(`Connected ${count} project${count === 1 ? "" : "s"}`);
      router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to connect projects");
    },
  });

  const isPending = githubMutation.isPending || vercelMutation.isPending;
  const isDisabled =
    selectedResources.length === 0 || !workspaceId || isPending;

  const handleConnect = () => {
    if (!workspaceId) return;

    if (provider === "github" && userSourceId && selectedInstallationId) {
      githubMutation.mutate({
        workspaceId,
        userSourceId,
        installationId: selectedInstallationId,
        repositories: selectedResources.map((r) => ({
          repoId: r.id,
          repoFullName: r.fullName ?? r.name,
        })),
      });
    } else if (provider === "vercel" && userSourceId) {
      vercelMutation.mutate({
        workspaceId,
        userSourceId,
        projects: selectedResources.map((r) => ({
          projectId: r.id,
          projectName: r.name,
        })),
      });
    }
  };

  const resourceLabel =
    provider === "github"
      ? `Repositor${selectedResources.length === 1 ? "y" : "ies"}`
      : `Project${selectedResources.length === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t">
      <Button
        variant="outline"
        onClick={() => router.push(`/${clerkOrgSlug}/${workspaceName}/sources`)}
      >
        Cancel
      </Button>
      <Button onClick={handleConnect} disabled={isDisabled}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          `Connect ${selectedResources.length} ${resourceLabel}`
        )}
      </Button>
    </div>
  );
}
```

#### 3. Add Bulk GitHub Link Mutation (tRPC)

**File**: `api/console/src/router/org/workspace.ts`

Add this procedure alongside the existing `bulkLinkVercelProjects`:

```typescript
bulkLinkGitHubRepositories: orgScopedProcedure
  .input(
    z.object({
      workspaceId: z.string(),
      userSourceId: z.string(),
      installationId: z.string(),
      repositories: z
        .array(
          z.object({
            repoId: z.string(),
            repoFullName: z.string(),
          })
        )
        .min(1)
        .max(50),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // 1. Verify workspace access
    const workspace = await ctx.db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, input.workspaceId),
    });

    if (!workspace || workspace.clerkOrgId !== ctx.auth.orgId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    // 2. Verify user source ownership
    const source = await ctx.db.query.userSources.findFirst({
      where: and(
        eq(userSources.id, input.userSourceId),
        eq(userSources.userId, ctx.auth.userId)
      ),
    });

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User source not found",
      });
    }

    // Verify it's a GitHub source with the installation
    const metadata = source.providerMetadata as { provider: string; installations?: Array<{ id: string }> };
    if (metadata.provider !== "github") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User source is not a GitHub connection",
      });
    }

    const installation = metadata.installations?.find(
      (i) => i.id === input.installationId
    );
    if (!installation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Installation not found",
      });
    }

    // 3. Get existing connections
    const existing = await ctx.db.query.workspaceIntegrations.findMany({
      where: and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.userSourceId, input.userSourceId)
      ),
    });

    const existingMap = new Map(
      existing.map((e) => [e.providerResourceId, e])
    );

    // 4. Categorize repositories
    const toCreate: typeof input.repositories = [];
    const toReactivate: string[] = [];
    const alreadyActive: string[] = [];

    for (const repo of input.repositories) {
      const existingIntegration = existingMap.get(repo.repoId);
      if (!existingIntegration) {
        toCreate.push(repo);
      } else if (!existingIntegration.isActive) {
        toReactivate.push(existingIntegration.id);
      } else {
        alreadyActive.push(repo.repoId);
      }
    }

    const now = new Date().toISOString();

    // 5. Reactivate inactive integrations
    if (toReactivate.length > 0) {
      await ctx.db
        .update(workspaceIntegrations)
        .set({ isActive: true, updatedAt: now })
        .where(inArray(workspaceIntegrations.id, toReactivate));
    }

    // 6. Create new integrations
    if (toCreate.length > 0) {
      const integrations = toCreate.map((repo) => ({
        workspaceId: input.workspaceId,
        userSourceId: input.userSourceId,
        connectedBy: ctx.auth.userId,
        providerResourceId: repo.repoId,
        sourceConfig: {
          provider: "github" as const,
          type: "repository" as const,
          installationId: input.installationId,
          repoId: repo.repoId,
          repoFullName: repo.repoFullName,
          repoName: repo.repoFullName.split("/")[1],
          defaultBranch: "main",
          isPrivate: false,
          isArchived: false,
          sync: {
            branches: ["main"],
            paths: ["**/*"],
            events: ["push", "pull_request"],
            autoSync: true,
          },
        },
        isActive: true,
        connectedAt: now,
      }));

      await ctx.db.insert(workspaceIntegrations).values(integrations);
    }

    return {
      created: toCreate.length,
      reactivated: toReactivate.length,
      skipped: alreadyActive.length,
    };
  }),
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`
- [ ] tRPC types regenerate: `pnpm --filter @api/console build`

#### Manual Verification:
- [ ] Selected resources appear in Section 3
- [ ] Resources can be removed with X button
- [ ] Connect button shows correct count and label
- [ ] Connect button disabled when no resources selected
- [ ] GitHub: Clicking connect creates workspace integrations
- [ ] Vercel: Clicking connect creates workspace integrations
- [ ] Success toast appears after connect
- [ ] Redirects to /sources after connect
- [ ] Connected resources appear in sources list

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Phase 6: Wire Up Selectors to Form Context

### Overview

Update the GitHub and Vercel connectors to update the form context when resources are selected in the modals.

### Changes Required

#### 1. Update GitHubConnector

Add `onSelect` callback to `GitHubRepoSelector` that updates form context:

```tsx
// In github-connector.tsx
<GitHubRepoSelector
  // ... existing props
  onSelect={(repos) => {
    setSelectedResources(
      repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.fullName,
      }))
    );
  }}
/>
```

#### 2. Update VercelProjectSelector

The existing `VercelProjectSelector` connects directly via mutation. For the connect page flow, we need to either:

**Option A**: Modify `VercelProjectSelector` to accept an `onSelect` callback (similar to GitHub)
**Option B**: Keep the existing behavior where Vercel projects connect immediately via the modal

**Recommendation**: Use Option B for now - the `VercelProjectSelector` already handles the full flow including the mutation. The connect page can simply trigger the modal and let it handle everything, then navigate back to sources on success via the `onSuccess` callback.

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`

#### Manual Verification:
- [ ] GitHub: Selecting repos in modal updates Section 3
- [ ] Vercel: Modal connects directly and redirects to /sources
- [ ] Full end-to-end flow works for both providers

---

## Testing Strategy

### Unit Tests

Not required for this implementation - focus on integration testing.

### Integration Tests

Not required for initial implementation.

### Manual Testing Steps

1. **GitHub Flow (Not Connected)**:
   - Navigate to `/sources/connect?provider=github`
   - Click "Connect GitHub" button
   - Complete OAuth flow in popup
   - Verify return to connect page with connected status
   - Select repositories from modal
   - Click "Connect X Repositories"
   - Verify redirect to /sources with connected repos

2. **GitHub Flow (Already Connected)**:
   - Navigate to `/sources/connect?provider=github`
   - Verify "Connected to GitHub" status shows
   - Click "Select Repositories"
   - Verify modal shows available repos
   - Verify already-connected repos are disabled

3. **Vercel Flow (Not Connected)**:
   - Navigate to `/sources/connect?provider=vercel`
   - Click "Connect Vercel" button
   - Complete OAuth flow in popup
   - Verify return to connect page with connected status
   - Select projects from modal
   - Verify redirect to /sources with connected projects

4. **Provider Switching**:
   - Navigate to `/sources/connect`
   - Click GitHub card, verify URL updates
   - Click Vercel card, verify URL updates
   - Refresh page, verify correct provider selected

5. **Edge Cases**:
   - No repositories in installation
   - No projects in Vercel account
   - OAuth popup blocked
   - Network error during connect

## Performance Considerations

- **Prefetch**: Both user sources prefetched on server for instant load
- **Suspense**: Loading states for async sections
- **nuqs shallow routing**: No full page reload on provider switch
- **Query caching**: React Query caches repo/project lists

## Migration Notes

No database migrations required - using existing tables.

## References

- Research document: `thoughts/shared/research/2025-12-10-integration-marketplace-console.md`
- `/new` page pattern: `apps/console/src/app/(app)/(user)/new/page.tsx`
- `VercelProjectSelector`: `apps/console/src/components/integrations/vercel-project-selector.tsx`
- User sources router: `api/console/src/router/user/user-sources.ts`
- Workspace integrations: `api/console/src/router/org/workspace.ts`
