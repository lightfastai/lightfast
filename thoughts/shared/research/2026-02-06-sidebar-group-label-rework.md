---
date: 2026-02-06T05:23:57+0000
researcher: claude
git_commit: f17aeb87bd8bcd301d811ba7a9b5d15df668aabb
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Rework app-sidebar.tsx: Move Ask Lightfast + Search to top, group Sources/Jobs/Settings under Manage"
tags: [research, codebase, sidebar, console, ui-components]
status: complete
last_updated: 2026-02-06
last_updated_by: claude
---

# Research: Rework Console App Sidebar Layout

**Date**: 2026-02-06T05:23:57+0000
**Researcher**: claude
**Git Commit**: f17aeb87bd8bcd301d811ba7a9b5d15df668aabb
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

How to rework `apps/console/src/components/app-sidebar.tsx` to:
1. Place "Ask Lightfast" and "Search" at the top (no section title)
2. Group "Sources", "Jobs", "Settings" under a "Manage" section label

Using the primitives available in `packages/ui/src/components/ui/sidebar.tsx`.

## Summary

The current console sidebar uses a single flat `SidebarGroup` without labels. The UI sidebar primitives already support labeled groups via `SidebarGroupLabel`. The rework requires splitting `getWorkspaceNavItems` into two separate data sources and rendering two `SidebarGroup` components - one without a label for the primary items (Ask Lightfast, Search), and one with `SidebarGroupLabel` for the "Manage" section (Sources, Jobs, Settings).

## Detailed Findings

### Current Implementation

**File**: `apps/console/src/components/app-sidebar.tsx:27-53`

The workspace navigation is built by `getWorkspaceNavItems()` which returns a flat array of 5 items:

```typescript
function getWorkspaceNavItems(orgSlug: string, workspaceName: string): NavItem[] {
  return [
    { title: "Ask Lightfast", href: `/${orgSlug}/${workspaceName}` },
    { title: "Search", href: `/${orgSlug}/${workspaceName}/search` },
    { title: "Sources", href: `/${orgSlug}/${workspaceName}/sources` },
    { title: "Jobs", href: `/${orgSlug}/${workspaceName}/jobs` },
    { title: "Settings", href: `/${orgSlug}/${workspaceName}/settings` },
  ];
}
```

These are rendered in a single `SidebarGroup > SidebarGroupContent > SidebarMenu` at lines 107-129.

### Available UI Primitives

**File**: `packages/ui/src/components/ui/sidebar.tsx`

Key components for the rework:

| Component | Location | Purpose |
|-----------|----------|---------|
| `SidebarGroup` | :394-403 | Container with `p-2` padding, flex column |
| `SidebarGroupLabel` | :405-425 | Section heading - `text-xs font-medium`, auto-hides when collapsed |
| `SidebarGroupContent` | :451-463 | Content wrapper with `text-sm` |
| `SidebarMenu` | :465-474 | `<ul>` with `gap-1` between items |
| `SidebarMenuItem` | :476-485 | `<li>` wrapper |
| `SidebarMenuButton` | :509-557 | Button/link with active state styling |

`SidebarGroupLabel` needs to be added to the import statement in `app-sidebar.tsx` (currently not imported).

### Existing Patterns for Labeled Groups in Codebase

Three patterns exist:

1. **Docs sidebar** (`apps/docs/src/components/docs-marketing-sidebar.tsx:69-112`): Uses `SidebarGroupLabel` with `text-xs text-muted-foreground px-0` for documentation categories.

2. **Chat session groups** (`apps/chat/src/components/sidebar/components/session-group.tsx:16-32`): Uses `SidebarGroupLabel` with `text-2xs font-normal text-muted-foreground` for time-based session categories ("Today", "Last 7 Days").

3. **Console sidebar** (`apps/console/src/components/app-sidebar.tsx:107-129`): Currently uses `SidebarGroup` WITHOUT a label - single flat group.

### Target Structure

Split the workspace items into two groups:

**Group 1 - Primary (no label)**: Ask Lightfast, Search
**Group 2 - "Manage" (with SidebarGroupLabel)**: Sources, Jobs, Settings

Target JSX:

```tsx
<Sidebar variant="inset" collapsible="none">
  <SidebarContent>
    {/* Primary navigation - no label */}
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {primaryNavItems.map(...)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>

    {/* Manage section - with label */}
    <SidebarGroup>
      <SidebarGroupLabel>Manage</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {manageNavItems.map(...)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
```

### Import Changes Required

Current imports at line 6-14 need `SidebarGroupLabel` added:
```typescript
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,  // ← ADD
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@repo/ui/components/ui/sidebar";
```

### Data Structure Changes

Replace single `getWorkspaceNavItems` with two functions:

```typescript
function getWorkspacePrimaryItems(orgSlug: string, workspaceName: string): NavItem[] {
  return [
    { title: "Ask Lightfast", href: `/${orgSlug}/${workspaceName}` },
    { title: "Search", href: `/${orgSlug}/${workspaceName}/search` },
  ];
}

function getWorkspaceManageItems(orgSlug: string, workspaceName: string): NavItem[] {
  return [
    { title: "Sources", href: `/${orgSlug}/${workspaceName}/sources` },
    { title: "Jobs", href: `/${orgSlug}/${workspaceName}/jobs` },
    { title: "Settings", href: `/${orgSlug}/${workspaceName}/settings` },
  ];
}
```

The org-level navigation (`getOrgNavItems`) remains unchanged since it only has 2 items (Workspaces, Settings).

### SidebarGroupLabel Default Styling

From `packages/ui/src/components/ui/sidebar.tsx:416-421`:
```
text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium
```
- 70% opacity foreground color
- Height: h-8 (32px)
- Text: text-xs (12px) font-medium (500)
- Padding: px-2 (8px horizontal)
- Auto-hides when sidebar collapses: `group-data-[collapsible=icon]:opacity-0`

## Code References

- `apps/console/src/components/app-sidebar.tsx:6-14` - Current imports (need SidebarGroupLabel)
- `apps/console/src/components/app-sidebar.tsx:27-53` - getWorkspaceNavItems to split
- `apps/console/src/components/app-sidebar.tsx:103-132` - Render section to restructure
- `packages/ui/src/components/ui/sidebar.tsx:394-403` - SidebarGroup base component
- `packages/ui/src/components/ui/sidebar.tsx:405-425` - SidebarGroupLabel base component
- `packages/ui/src/components/ui/sidebar.tsx:451-463` - SidebarGroupContent base component
- `apps/docs/src/components/docs-marketing-sidebar.tsx:69-112` - Reference pattern with labels
- `apps/chat/src/components/sidebar/components/session-group.tsx:16-32` - Reference pattern with labels

## Architecture Documentation

The sidebar system follows a composable pattern:
- `SidebarProvider` wraps the entire layout (handles state, mobile, keyboard shortcuts)
- `Sidebar` is the container (supports variants: sidebar, floating, inset)
- `SidebarContent` is the scrollable body
- `SidebarGroup` creates visual sections (with optional `SidebarGroupLabel`)
- `SidebarMenu > SidebarMenuItem > SidebarMenuButton` renders individual links

The console sidebar uses `collapsible="none"` (always visible) and `variant="inset"` (placed inside content area with padding).
