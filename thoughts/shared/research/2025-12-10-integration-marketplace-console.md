---
date: 2025-12-10T00:00:00+00:00
researcher: Claude
git_commit: 0239e1ff2aebc03c84449d9c038166359698f3bc
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Integration Connect Page - /sources/connect"
tags: [research, integrations, marketplace, UI, UX, console, nuqs, sources]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
last_updated_note: "Refined to /sources/connect route with nuqs + /new page pattern"
---

# Research: Integration Marketplace Console Page

**Date**: 2025-12-10
**Researcher**: Claude
**Git Commit**: 0239e1ff2aebc03c84449d9c038166359698f3bc
**Branch**: docs/neural-memory-analysis
**Repository**: lightfast

## Research Question

How should we structure a new integration marketplace/console page similar to Vercel's integration marketplace for initial connection flows?

## Summary

This research analyzes both the existing codebase infrastructure and industry best practices for integration marketplaces. The codebase already has a solid foundation with a two-table architecture (`userSources` + `workspaceIntegrations`), OAuth flows, and the `VercelProjectSelector` component. The recommended approach is to create a dedicated marketplace discovery page that builds on these existing patterns while incorporating UX best practices from Vercel, Slack, GitHub, and Linear.

---

## Detailed Findings

### 1. Existing Codebase Infrastructure

#### Database Architecture

The codebase implements a **two-table integration architecture**:

**User Sources** (`db/console/src/schema/tables/user-sources.ts`):
- Stores user-level OAuth connections (GitHub, Vercel)
- Encrypted access tokens with `providerMetadata` JSONB column
- Supports GitHub App installations and Vercel team/project associations

**Workspace Integrations** (`db/console/src/schema/tables/workspace-integrations.ts`):
- Links specific resources (repos, projects) to workspaces
- `sourceConfig` JSONB with discriminated union by provider
- `providerResourceId` indexed for O(1) webhook routing

```
┌─────────────────────────────────────────────────────────────────┐
│ USER LEVEL: lightfast_user_sources                              │
│ ├─ userId, provider, accessToken (encrypted)                   │
│ └─ providerMetadata: { installations, teamId, configId }       │
│                         │                                       │
│                         ▼ FK                                    │
│ WORKSPACE LEVEL: lightfast_workspace_integrations               │
│ ├─ workspaceId, userSourceId, connectedBy                      │
│ └─ sourceConfig: { provider, type, repoId/projectId, sync }    │
└─────────────────────────────────────────────────────────────────┘
```

#### Existing Integration Pages

| Page | Route | Purpose |
|------|-------|---------|
| User Sources Settings | `/account/settings/sources` | Personal OAuth connections |
| Workspace Sources | `/[slug]/[workspaceName]/sources` | Connected workspace resources |

#### Key UI Components

1. **VercelProjectSelector** (`apps/console/src/components/integrations/vercel-project-selector.tsx`)
   - Modal for multi-select project linking
   - Checkbox list with "Connected" badges
   - Select All, refresh, loading states

2. **InstalledSources** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx`)
   - URL-based filtering with `nuqs`
   - Provider icons, status badges, sync timestamps
   - Auto-opens Vercel selector after OAuth

3. **LatestIntegrations** (`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/latest-integrations.tsx`)
   - Static sidebar with upcoming integrations
   - Hardcoded: Vercel, PostHog, Slack, PlanetScale

4. **IntegrationIcons** (`packages/ui/src/components/integration-icons.tsx`)
   - 15+ brand icons: GitHub, Vercel, Slack, Linear, Notion, etc.

#### OAuth Implementation

**GitHub Flow** (`apps/console/src/app/(github)/api/github/`):
- `/authorize-user/route.ts` → GitHub OAuth authorization
- `/user-authorized/route.ts` → Callback with token exchange

**Vercel Flow** (`apps/console/src/app/(vercel)/api/vercel/`):
- `/authorize/route.ts` → Vercel OAuth authorization
- `/callback/route.ts` → Callback with `configurationId` capture

---

### 2. Console App Page Patterns

#### Route Group Structure

```
apps/console/src/app/
├── (app)/                    # Main authenticated app
│   ├── (org)/               # Org-scoped (sidebar, workspace)
│   │   └── [slug]/[workspaceName]/sources/
│   └── (user)/              # User-scoped (account settings)
│       └── account/settings/sources/
├── (github)/                # GitHub OAuth routes
├── (vercel)/                # Vercel OAuth routes
└── (trpc)/                  # tRPC API routes
```

#### Standard Page Pattern

```tsx
// Server Component with tRPC prefetch
export default async function Page({ params }) {
  const { slug, workspaceName } = await params;

  // 1. Server-side prefetch
  prefetch(orgTrpc.workspace.sources.list.queryOptions({
    clerkOrgSlug: slug,
    workspaceName,
  }));

  // 2. HydrateClient for server-to-client data transfer
  return (
    <HydrateClient>
      <Suspense fallback={<Skeleton />}>
        <ClientComponent slug={slug} workspaceName={workspaceName} />
      </Suspense>
    </HydrateClient>
  );
}
```

#### Component Organization

```
sources/
├── page.tsx                      # Server component
└── _components/
    ├── installed-sources.tsx     # Client component ("use client")
    └── latest-integrations.tsx   # Server or client component
```

---

### 3. Industry Best Practices (Vercel, Slack, GitHub, Linear)

#### Discovery & Browsing Patterns

| Platform | Layout | Categories | Search | Social Proof |
|----------|--------|------------|--------|--------------|
| Vercel | Grid cards | Tabs | Yes | Install counts |
| Slack | Grid cards | Multi-faceted | Autocomplete | Ratings, reviews |
| GitHub | Grid cards | Type segments | Yes | Verified badges |
| Linear | Clean grid | Tabs | Minimal | None (curated) |

#### Card Design Anatomy

```
┌─────────────────────────────────────────┐
│ [Logo 64x64]  Integration Name    ★4.8  │
│               by Publisher              │
│                                         │
│ One-line description that explains      │
│ what this integration does...           │
│                                         │
│ [Free] [Verified]     1.2k installs     │
│                                         │
│                          [Connect →]    │
└─────────────────────────────────────────┘
```

#### Connection Status Indicators

```
○ Not connected      (Gray/neutral)
◐ Connecting...      (Animated spinner)
● Connected          (Green checkmark)
⚠ Needs attention    (Yellow warning)
× Disconnected       (Red error)
```

#### Installation Flow Best Practices

```
1. DISCOVERY
   User browses marketplace or searches

2. DETAIL VIEW
   Modal/drawer shows: description, permissions, screenshots

3. PERMISSION PREVIEW
   Show scopes BEFORE OAuth redirect (builds trust)

4. OAUTH AUTHORIZATION
   Redirect to provider consent screen

5. RESOURCE SELECTION
   Multi-select projects/repos to connect

6. CONFIGURATION
   Sync settings, event types, filters

7. CONFIRMATION
   Success toast + immediate visibility in list
```

---

### 4. Recommended Page Structure

#### Route: `/[slug]/[workspaceName]/sources/connect`

A single-page connection flow nested under sources with `nuqs` for URL state:
- `/sources` → View connected sources
- `/sources/connect` → Add new integrations
- `/sources/connect?provider=github` → Deep-link to GitHub tab
- `/sources/connect?provider=vercel` → Deep-link to Vercel tab

#### URL Parameters (nuqs)

```typescript
// nuqs parameter definitions
const provider = parseAsStringLiteral(['github', 'vercel'] as const)
  .withDefault('github');

// URL examples:
// /sources/connect                    → GitHub tab (default)
// /sources/connect?provider=vercel    → Vercel tab
// /sources/connect?provider=github&connected=true → Post-OAuth return
```

#### Page Layout (Based on `/new` Pattern)

Single-page flow with numbered sections and provider selector (tabs controlled by `nuqs`):

```
┌─────────────────────────────────────────────────────────────────┐
│  Connect Integration                                            │
│  Add a new source to your workspace                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ①  Select Provider                                         │
│  │                                                              │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │
│  │  │ [GitHub]       │ │ [Vercel]       │ │ [More...]      │   │
│  │  │ ● Selected     │ │                │ │ Coming Soon    │   │
│  │  └────────────────┘ └────────────────┘ └────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ②  Connect Account                                         │
│  │                                                              │
│  │  ┌─────────────────────────────────────────────────────┐    │
│  │  │ [GitHub Logo]                                       │    │
│  │  │                                                     │    │
│  │  │ Connect your GitHub account to select repositories  │    │
│  │  │                                                     │    │
│  │  │              [Connect GitHub]                       │    │
│  │  └─────────────────────────────────────────────────────┘    │
│  │                                                              │
│  │  --- OR if already connected: ---                           │
│  │                                                              │
│  │  ✓ Connected as @username                                   │
│  │    3 installations available                                │
│  │                                                              │
│  │  Installation: [lightfastai ▼]                              │
│  │                                                              │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ③  Select Resources                                        │
│  │                                                              │
│  │  ┌─────────────────────────────────────────────────────┐    │
│  │  │ [Search repositories...]                            │    │
│  │  ├─────────────────────────────────────────────────────┤    │
│  │  │ ☑ lightfastai/lightfast     Private    ★ 42        │    │
│  │  │ ☑ lightfastai/sdk           Private    ★ 12        │    │
│  │  │ ☐ lightfastai/docs          Public     ★ 8         │    │
│  │  │ ☐ lightfastai/examples      Public     ★ 5         │    │
│  │  └─────────────────────────────────────────────────────┘    │
│  │                                                              │
│  │  2 repositories selected                                    │
│  │                                                              │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐
│  │                                                              │
│  │  [Cancel]                    [Connect 2 Repositories →]     │
│  │                                                              │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

#### Provider Selector States

```typescript
// Provider options with status
const providers = [
  { id: 'github', name: 'GitHub', status: 'available', icon: 'github' },
  { id: 'vercel', name: 'Vercel', status: 'available', icon: 'vercel' },
  { id: 'linear', name: 'Linear', status: 'coming_soon', icon: 'linear' },
  { id: 'slack', name: 'Slack', status: 'coming_soon', icon: 'slack' },
  { id: 'notion', name: 'Notion', status: 'coming_soon', icon: 'notion' },
];

// Card states based on selection + connection
type ProviderCardState =
  | { selected: false }                    // Gray, clickable
  | { selected: true, connected: false }   // Highlighted, show connect CTA
  | { selected: true, connected: true }    // Highlighted, show resource picker
  | { status: 'coming_soon' }              // Disabled, "Coming Soon" badge
```

#### Example page.tsx Implementation

```tsx
// apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/page.tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, userTrpc } from "@repo/console-trpc/server";
import { ConnectHeader } from "./_components/connect-header";
import { ConnectInitializer } from "./_components/connect-initializer";
import { ProviderSelector } from "./_components/provider-selector";
import { GitHubConnector } from "./_components/github-connector";
import { VercelConnector } from "./_components/vercel-connector";
import { ConnectButton } from "./_components/connect-button";
import { ConnectorLoading } from "./_components/connector-loading";

/**
 * Connect Integration Page
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
  searchParams: Promise<{ provider?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { provider = "github" } = await searchParams;

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
            {/* Initialize from URL params */}
            <ConnectInitializer
              initialProvider={provider}
              clerkOrgSlug={slug}
              workspaceName={workspaceName}
            >
              <div className="space-y-8">
                {/* Section 1: Provider Selection */}
                <Section number={1} title="Select Provider">
                  <ProviderSelector />
                </Section>

                {/* Section 2: Connect Account (conditional on provider) */}
                <Section number={2} title="Connect Account">
                  <Suspense fallback={<ConnectorLoading />}>
                    {provider === "github" && <GitHubConnector />}
                    {provider === "vercel" && <VercelConnector />}
                  </Suspense>
                </Section>

                {/* Section 3: Select Resources (shows when connected) */}
                <Section number={3} title="Select Resources">
                  <ResourcePicker provider={provider} />
                </Section>
              </div>

              {/* Footer with action button */}
              <ConnectButton />
            </ConnectInitializer>
          </HydrateClient>
        </div>
      </div>
    </div>
  );
}

// Reusable section component (matches /new pattern)
function Section({ number, title, children }) {
  return (
    <div className="flex gap-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
        {number}
      </div>
      <div className="flex-1 space-y-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

---

### 5. Component Architecture (Following `/new` Page Pattern)

The `/new` workspace creation page provides an excellent template:
- Server component with `prefetch()` for user sources
- `HydrateClient` for server-to-client data transfer
- Form provider context for shared state
- `nuqs` for URL parameter persistence
- Numbered sections with client islands

#### File Structure

```
apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/
├── page.tsx                          # Server component with prefetch
└── _components/
    ├── connect-header.tsx            # Static header (server component)
    ├── connect-form-provider.tsx     # Form context + shared state
    ├── connect-initializer.tsx       # Init from URL params (nuqs)
    ├── provider-selector.tsx         # Tabs: GitHub | Vercel | Coming Soon
    ├── github-connector.tsx          # GitHub OAuth + repo selection
    ├── vercel-connector.tsx          # Vercel OAuth + project selection
    ├── resource-picker.tsx           # Multi-select repos/projects
    └── connect-button.tsx            # Final "Connect X resources" CTA

apps/console/src/components/integrations/
├── vercel-project-selector.tsx       # Existing (reuse)
├── github-repo-selector.tsx          # New (similar pattern)
└── connection-status-badge.tsx       # Reusable status component
```

#### Data Model

```typescript
// Integration catalog (static + dynamic)
interface Integration {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: keyof typeof IntegrationIcons;
  category: 'development' | 'communication' | 'analytics' | 'data';
  status: 'available' | 'coming_soon' | 'beta';
  features: string[];
  docsUrl?: string;
}

// User's connection state (from DB)
interface ConnectionState {
  integrationSlug: string;
  isConnected: boolean;
  userSourceId?: string;
  resourceCount: number;
  lastSyncAt?: Date;
  syncStatus?: 'pending' | 'syncing' | 'completed' | 'failed';
}

// Combined for UI
interface IntegrationWithState extends Integration {
  connection?: ConnectionState;
}
```

#### tRPC Routes

```typescript
// New routes needed
orgTrpc.workspace.integrations.catalog       // Get all available integrations
orgTrpc.workspace.integrations.connections   // Get user's connections
orgTrpc.workspace.integrations.connect       // Initiate OAuth flow
orgTrpc.workspace.integrations.disconnect    // Remove connection
orgTrpc.workspace.integrations.configure     // Update sync settings
```

---

### 6. UX Flow Recommendations

#### First-Time User Experience

1. **Empty State**: Show featured integrations with "Get Started" CTA
2. **Guided Tour**: Highlight GitHub/Vercel as recommended first connections
3. **Quick Wins**: After first connection, show immediate value (e.g., "3 repos indexed!")

#### Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER CONNECTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. BROWSE MARKETPLACE                                          │
│     User opens /integrations page                               │
│     Views grid of available integrations                        │
│                                                                 │
│  2. SELECT INTEGRATION                                          │
│     Clicks integration card                                     │
│     Detail drawer slides in from right                          │
│                                                                 │
│  3. REVIEW PERMISSIONS                                          │
│     Shows what the integration can access                       │
│     "This integration will be able to..."                       │
│                                                                 │
│  4. INITIATE OAUTH                                              │
│     Clicks "Connect" button                                     │
│     Redirects to provider OAuth consent                         │
│                                                                 │
│  5. RETURN & SELECT RESOURCES                                   │
│     Callback redirects to integrations page                     │
│     Auto-opens resource selector modal                          │
│     (e.g., VercelProjectSelector, GitHubRepoSelector)           │
│                                                                 │
│  6. CONFIGURE SYNC                                              │
│     Select which events to sync                                 │
│     Choose branches, paths, filters                             │
│                                                                 │
│  7. CONFIRMATION                                                │
│     Success toast: "Connected! Syncing 5 repositories..."       │
│     Card updates to show "Connected" status                     │
│     Resources appear in workspace sources list                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Status Management

```typescript
// Card states
type CardState =
  | { status: 'available'; action: 'Connect' }
  | { status: 'connecting'; action: 'Connecting...' }
  | { status: 'connected'; action: 'Configure'; resourceCount: number }
  | { status: 'error'; action: 'Reconnect'; error: string }
  | { status: 'coming_soon'; action: 'Request' };
```

---

## Code References

### Existing Implementation
- `db/console/src/schema/tables/user-sources.ts` - User OAuth storage
- `db/console/src/schema/tables/workspace-integrations.ts` - Workspace resource links
- `apps/console/src/components/integrations/vercel-project-selector.tsx` - Project selector modal
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx` - Sources list
- `api/console/src/router/user/user-sources.ts` - User sources tRPC routes
- `api/console/src/router/org/workspace.ts:862-1054` - Workspace integrations routes
- `packages/ui/src/components/integration-icons.tsx` - Brand icons

### OAuth Routes
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts`
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`

### UI Components
- `packages/ui/src/components/ui/` - 51 shadcn components
- `apps/console/src/components/app-sidebar.tsx` - Main navigation

---

## Architecture Documentation

### Current Patterns Used

1. **Server/Client Split**: Server components for prefetch, client islands for interactivity
2. **tRPC Prefetching**: `prefetch()` → `<HydrateClient>` → `useSuspenseQuery`
3. **URL State**: `nuqs` for shareable filtered views
4. **Soft Deletes**: `isActive: false` for audit trail
5. **Token Encryption**: AES-256-GCM via `@repo/lib/encryption`
6. **Discriminated Unions**: JSONB columns with `provider` discriminator

### Recommended New Patterns

1. **Integration Catalog**: Static catalog merged with dynamic connection state
2. **Resource Selectors**: Modal pattern (like VercelProjectSelector) for each provider
3. **Drawer Detail View**: Slide-over for integration details without full navigation
4. **Status Polling**: React Query with refetch interval for sync progress

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-10-clerk-integration-research.md` - Clerk NOT viable (no third-party marketplace)
- `thoughts/shared/research/2025-12-10-planetscale-integration-research.md` - PlanetScale IS viable (webhooks + OAuth)
- `thoughts/shared/research/vercel-integration/multi-project-flow-audit.md` - Current Vercel implementation gaps
- `thoughts/shared/plans/2025-12-10-vercel-multi-project-flow.md` - Vercel selector implementation plan

---

## Related Research

- [Vercel Integration Documentation](https://vercel.com/docs/integrations)
- [GitHub Marketplace](https://github.com/marketplace)
- [Slack App Directory](https://slack.com/apps)
- [Linear Integrations](https://linear.app/integrations)

---

## Open Questions

1. ~~**Routing Decision**: Should marketplace be at `/integrations` (new) or enhance existing `/sources`?~~ **RESOLVED**: Use `/sources/connect` to keep marketplace discovery within the sources section
2. **Category Taxonomy**: What categories make sense? (Development, Communication, Analytics, Data)
3. **Coming Soon Handling**: How to handle "Request" for unavailable integrations? (Waitlist? Upvotes?)
4. **Permission Levels**: Should workspace admins control which integrations members can connect?
5. **Billing Integration**: Will some integrations be premium/paid features?

---

## Implementation Priority

### Phase 1: Foundation
1. Create `/integrations` page with grid layout
2. Implement integration catalog data structure
3. Add search and category filters
4. Connect existing GitHub/Vercel OAuth flows

### Phase 2: Polish
1. Add detail drawer/modal views
2. Implement GitHubRepoSelector (similar to VercelProjectSelector)
3. Add status indicators and sync progress
4. Empty states and onboarding

### Phase 3: Expansion
1. Add more integrations (Linear, Slack, Notion)
2. Implement "Coming Soon" waitlist
3. Add settings/configuration per integration
4. Analytics on integration usage
