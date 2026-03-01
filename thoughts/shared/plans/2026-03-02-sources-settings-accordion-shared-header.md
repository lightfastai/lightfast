# Sources Settings Accordion + Shared User Header

## Overview

Two changes:
1. **Sources settings page**: Replace the GitHub-only flat list with an accordion showing all 4 providers (GitHub, Vercel, Linear, Sentry), matching the pattern from the new workspace page
2. **Shared user header**: Create a `(user)/layout.tsx` that provides the navigation header (TeamSwitcher, notifications, user dropdown) to all `(user)` pages

## Current State Analysis

### Sources Settings Page
- `sources-list.tsx:134` hardcodes `allSources` to `["github"]` only
- Uses `connections.list` endpoint (returns all providers)
- Has inline OAuth popup logic (duplicated from what `useOAuthPopup` hook does better)
- Flat row-based UI with connect/disconnect

### Layout Hierarchy
```
(app)/layout.tsx → div.flex-1.flex.overflow-hidden
  └── (user)/ [NO layout.tsx exists]
      ├── new/layout.tsx → NewPageHeader + centered max-w-2xl content
      ├── account/settings/layout.tsx → "Settings" h1 + sidebar, overflow-auto
      ├── account/teams/new/page.tsx → centered form (no header)
      └── cli/auth/page.tsx → redirect page (no header)
```

### Key Discoveries
- `useOAuthPopup` hook at `new/_components/use-oauth-popup.ts` handles OAuth for all 4 providers with BroadcastChannel + postMessage fallback — currently scoped to `/new` but should be shared
- `IntegrationLogoIcons` from `@repo/ui/integration-icons` provides SVG icons for all 4 providers
- `connections.list` returns `{ id, sourceType, isActive, connectedAt, lastSyncAt }[]` — sufficient for settings accordion
- The settings layout has `overflow-auto` on its outer div — must be removed when parent handles scrolling

## Desired End State

- Sources settings page shows an accordion with all 4 providers (GitHub, Vercel, Linear, Sentry), each with connect/disconnect
- All `(user)` pages have a sticky navigation header with TeamSwitcher, notifications, and user dropdown
- `useOAuthPopup` hook is shared, not duplicated

### Verification:
1. Navigate to `/account/settings/sources` — see 4-provider accordion with connect/disconnect for each
2. Navigate to `/new` — header still present, sources accordion still works
3. Navigate to `/account/settings/general` — header now present
4. Navigate to `/account/teams/new` — header now present
5. Navigate to `/cli/auth` — header present, auth redirect still works

## What We're NOT Doing

- Not adding repo/project/team pickers to the settings page (that's workspace-specific)
- Not changing the new workspace page's source items
- Not adding provider-specific prefetches to settings page (`connections.list` is sufficient)
- Not refactoring the new workspace source items to share with settings

## Implementation Approach

Phase 1 handles the shared layout (foundational), Phase 2 handles the sources accordion (feature).

---

## Phase 1: Shared User Layout + Header

### Overview
Move the `NewPageHeader` to a shared location, create `(user)/layout.tsx`, and adjust child layouts to avoid nested scrolling.

### Changes Required:

#### 1. Move and rename header component
**File**: `apps/console/src/components/user-page-header.tsx` (NEW)
**Changes**: Move content from `new/_components/new-page-header.tsx` to shared location. Rename `NewPageHeader` → `UserPageHeader`.

```tsx
"use client";

import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";
import { TeamSwitcher } from "~/components/team-switcher";

export function UserPageHeader() {
  return (
    <div className="sticky top-0 z-10 h-14 flex items-center px-4 bg-background border-b border-border md:border-b-0 md:bg-transparent">
      <TeamSwitcher mode="account" />
      <div className="flex items-center gap-3 ml-auto">
        <NotificationsTrigger />
        <UserDropdownMenu />
      </div>
    </div>
  );
}
```

#### 2. Delete old header file
**File**: `apps/console/src/app/(app)/(user)/new/_components/new-page-header.tsx` (DELETE)

#### 3. Create shared (user) layout
**File**: `apps/console/src/app/(app)/(user)/layout.tsx` (NEW)
**Changes**: Provides header + scrollable content area for all (user) pages.

```tsx
import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1 flex flex-col bg-background">
      <UserPageHeader />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
```

#### 4. Simplify new workspace layout
**File**: `apps/console/src/app/(app)/(user)/new/layout.tsx`
**Changes**: Remove header (now in parent) and outer scroll wrapper (parent handles it). Keep content centering + bottom spacer.

```tsx
export default function NewWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4">
        {children}
      </div>
      <div aria-hidden className="shrink-0 h-16 md:h-20" />
    </>
  );
}
```

#### 5. Adjust settings layout
**File**: `apps/console/src/app/(app)/(user)/account/settings/layout.tsx`
**Changes**: Remove `overflow-auto`, `h-full`, `min-h-0` from outer div — parent `(user)/layout.tsx` handles scrolling.

```tsx
import { AccountSettingsSidebar } from "~/components/account-settings-sidebar";

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 pb-16">
        {/* Header */}
        <div className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        </div>

        <div className="flex gap-12">
          {/* Left Sidebar Navigation */}
          <AccountSettingsSidebar />

          {/* Main Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
```

#### 6. Adjust CLI auth page
**File**: `apps/console/src/app/(app)/(user)/cli/auth/page.tsx`
**Changes**: Replace `min-h-screen` with `min-h-full` so centering works within the scroll container.

Replace all 3 occurrences of `min-h-screen` with `min-h-full`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] `/new` page: Header visible, page scrolls correctly, workspace creation works
- [ ] `/account/settings/general`: Header visible at top, settings content scrolls correctly
- [ ] `/account/settings/sources`: Header visible, sources list still renders
- [ ] `/account/teams/new`: Header visible, team creation form centered
- [ ] `/cli/auth?port=3000&state=test`: Header visible, auth flow still works
- [ ] Header is sticky on scroll for all pages
- [ ] No nested scrollbars anywhere

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Sources Settings Accordion

### Overview
Replace the GitHub-only flat list with an accordion showing all 4 providers with connect/disconnect functionality.

### Changes Required:

#### 1. Move useOAuthPopup to shared hooks
**File**: `apps/console/src/hooks/use-oauth-popup.ts` (NEW — move from `new/_components/use-oauth-popup.ts`)
**Changes**: Move the file to a shared hooks directory. No code changes needed — the hook is already generic.

#### 2. Update new page source items to import from shared location
**Files**:
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/linear-source-item.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/sentry-source-item.tsx`

**Changes**: Update import path from `"./use-oauth-popup"` to `"~/hooks/use-oauth-popup"`.

#### 3. Delete old useOAuthPopup location
**File**: `apps/console/src/app/(app)/(user)/new/_components/use-oauth-popup.ts` (DELETE)

#### 4. Rewrite sources-list as accordion
**File**: `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx`
**Changes**: Replace the flat list with an accordion UI showing all 4 providers. Uses `connections.list` for status and `useOAuthPopup` for connect flow.

```tsx
"use client";
"use no memo";

import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { showErrorToast } from "~/lib/trpc-errors";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const providers = ["github", "vercel", "linear", "sentry"] as const;
type Provider = (typeof providers)[number];

const providerConfig: Record<Provider, {
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
}> = {
  github: { name: "GitHub", icon: IntegrationLogoIcons.github, description: "Connect your GitHub repositories" },
  vercel: { name: "Vercel", icon: IntegrationLogoIcons.vercel, description: "Connect your Vercel projects" },
  linear: { name: "Linear", icon: IntegrationLogoIcons.linear, description: "Connect your Linear workspace" },
  sentry: { name: "Sentry", icon: IntegrationLogoIcons.sentry, description: "Connect your Sentry projects" },
};

function SourceItem({ provider }: { provider: Provider }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const config = providerConfig[provider];
  const Icon = config.icon;

  const { data: integrations } = useSuspenseQuery({
    ...trpc.connections.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const connection = integrations.find(
    (i) => i.sourceType === provider && i.isActive,
  );

  const { handleConnect } = useOAuthPopup({
    provider,
    queryKeysToInvalidate: [trpc.connections.list.queryOptions().queryKey],
  });

  const disconnectMutation = useMutation(
    trpc.connections.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(`${config.name} disconnected`);
        void queryClient.invalidateQueries({
          queryKey: trpc.connections.list.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        showErrorToast(error, `Failed to disconnect ${config.name}`);
      },
    }),
  );

  const handleDisconnect = () => {
    if (connection && window.confirm(`Disconnect ${config.name}? This will remove access to all resources connected through this integration.`)) {
      disconnectMutation.mutate({ integrationId: connection.id });
    }
  };

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-medium">{config.name}</span>
          <Badge variant={connection ? "secondary" : "outline"} className="text-xs">
            {connection ? "Connected" : "Not connected"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {connection ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connected {formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true })}
              {connection.lastSyncAt && (
                <> · Last used {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}</>
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
            <Button variant="outline" size="sm" onClick={handleConnect}>
              Connect
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function SourcesList() {
  return (
    <Accordion type="multiple" className="w-full rounded-lg border">
      {providers.map((provider) => (
        <SourceItem key={provider} provider={provider} />
      ))}
    </Accordion>
  );
}
```

#### 5. Update sources-list-loading skeleton
**File**: `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list-loading.tsx`
**Changes**: Match accordion skeleton pattern (similar to `sources-section-loading.tsx` from new page).

```tsx
export function SourcesListLoading() {
  return (
    <div className="w-full rounded-lg border divide-y">
      {[1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted animate-pulse rounded" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-4 w-4 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Sources settings page shows 4 provider accordion items
- [ ] Each item shows "Connected" or "Not connected" badge
- [ ] Clicking "Connect" on any provider opens OAuth popup
- [ ] After OAuth completes, badge updates to "Connected"
- [ ] Clicking "Disconnect" shows confirmation and removes connection
- [ ] `/new` page still works correctly (source items use shared `useOAuthPopup` hook)
- [ ] Accordion expands/collapses correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. **Phase 1**: Navigate to all `(user)` pages, verify header appears and scrolling works
3. **Phase 2**: Test connect/disconnect for each provider on sources settings page
4. **Regression**: Create a new workspace via `/new` to verify source selection still works

## References

- Current sources list: `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx`
- New workspace sources: `apps/console/src/app/(app)/(user)/new/_components/sources-section.tsx`
- OAuth popup hook: `apps/console/src/app/(app)/(user)/new/_components/use-oauth-popup.ts`
- Integration icons: `packages/ui/src/components/integration-icons.tsx`
- Connections router: `api/console/src/router/org/connections.ts`
