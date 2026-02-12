# Sidebar Group Label Rework Implementation Plan

## Overview

Rework the console app sidebar (`app-sidebar.tsx`) to visually separate primary navigation items (Ask Lightfast, Search) from management items (Sources, Jobs, Settings) using `SidebarGroupLabel` to create a "Manage" section header.

## Current State Analysis

The sidebar renders all 5 workspace nav items in a single flat `SidebarGroup` without any section labels. All items are returned from a single `getWorkspaceNavItems()` function.

**File**: `apps/console/src/components/app-sidebar.tsx`
- Lines 6-14: Imports (missing `SidebarGroupLabel`)
- Lines 27-53: Single `getWorkspaceNavItems()` returns flat array of 5 items
- Lines 107-129: Single `SidebarGroup` renders all items

## Desired End State

The workspace sidebar has two visual groups:
1. **Primary group** (no label): "Ask Lightfast" and "Search" at the top
2. **Manage group** (with "Manage" label): "Sources", "Jobs", "Settings"

The org-level sidebar (Workspaces, Settings) remains unchanged.

## What We're NOT Doing

- Not changing org-level navigation
- Not changing any styling beyond the default `SidebarGroupLabel` styles
- Not modifying the sidebar layout/variant/collapsible settings
- Not adding icons or other visual changes

## Phase 1: Split Navigation and Add Group Label

### Overview
Split the workspace navigation into two data sources and render them as two separate `SidebarGroup` components, with the second group having a "Manage" label.

### Changes Required:

#### 1. Add `SidebarGroupLabel` to imports
**File**: `apps/console/src/components/app-sidebar.tsx:6-14`

```diff
 import {
   Sidebar,
   SidebarContent,
   SidebarGroup,
   SidebarGroupContent,
+  SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuItem,
   SidebarMenuButton,
 } from "@repo/ui/components/ui/sidebar";
```

#### 2. Replace `getWorkspaceNavItems` with two functions
**File**: `apps/console/src/components/app-sidebar.tsx:27-53`

Replace the single function with:

```typescript
function getWorkspacePrimaryItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Ask Lightfast",
      href: `/${orgSlug}/${workspaceName}`,
    },
    {
      title: "Search",
      href: `/${orgSlug}/${workspaceName}/search`,
    },
  ];
}

function getWorkspaceManageItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Sources",
      href: `/${orgSlug}/${workspaceName}/sources`,
    },
    {
      title: "Jobs",
      href: `/${orgSlug}/${workspaceName}/jobs`,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/${workspaceName}/settings`,
    },
  ];
}
```

#### 3. Update the component to use split navigation
**File**: `apps/console/src/components/app-sidebar.tsx`

In the `AppSidebar` component, replace the single `mainNavItems` variable with two variables for workspace context, and render two `SidebarGroup` components when in workspace view.

When in workspace context:
- `primaryItems` = `getWorkspacePrimaryItems(orgSlug, workspaceName)`
- `manageItems` = `getWorkspaceManageItems(orgSlug, workspaceName)`
- Render two groups: first without label, second with `<SidebarGroupLabel>Manage</SidebarGroupLabel>`

When in org context (unchanged):
- Single group with `getOrgNavItems(orgSlug)`, no label

#### 4. Helper function for rendering nav items
Extract the repeated menu item rendering into a helper to avoid duplication:

```typescript
function renderNavItems(items: NavItem[], pathname: string) {
  return items.map((item) => {
    const isActive =
      item.title === "Settings"
        ? pathname.startsWith(item.href)
        : pathname === item.href;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.href} prefetch={true}>
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Component compiles successfully (verified via tsc)

#### Manual Verification:
- [ ] Workspace sidebar shows "Ask Lightfast" and "Search" at top without a section label
- [ ] "Manage" label appears above "Sources", "Jobs", "Settings"
- [ ] Org-level sidebar (Workspaces, Settings) still renders correctly without labels
- [ ] Active state highlighting still works correctly for all nav items
- [ ] Settings active state still matches on subpages

## References

- Research: `thoughts/shared/research/2026-02-06-sidebar-group-label-rework.md`
- Current implementation: `apps/console/src/components/app-sidebar.tsx`
- SidebarGroupLabel primitive: `packages/ui/src/components/ui/sidebar.tsx:405-425`
- Reference pattern (docs): `apps/docs/src/components/docs-marketing-sidebar.tsx:69-112`
- Reference pattern (chat): `apps/chat/src/components/sidebar/components/session-group.tsx:16-32`
