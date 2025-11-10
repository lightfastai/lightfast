# Console UI Specification

Last Updated: 2025-11-09

---

## Overview

Console is a **minimal search interface** for team knowledge. No complex navigation, no heavy UI - just search and settings.

---

## Navigation Model

### No Horizontal Tabs

**Keep it simple:**
- Landing page = Search
- Settings link in header
- View Config button in search interface

```
┌────────────────────────────────────────────────────┐
│ [Org Switcher]    Lightfast    [Settings] [User]  │ ← Header
├────────────────────────────────────────────────────┤
│                                                    │
│               Search Interface                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Pages

### 1. Search (`/org/[slug]`) - Landing Page

**Purpose:** Search team knowledge

**Current state:** ✅ Already exists at `apps/console/src/app/(app)/org/[slug]/page.tsx`

**Keep:**
- Centered chat interface
- Repository selector in toolbar
- Clean, minimal design

**Add:**
- **"View Config" button** somewhere accessible (maybe in toolbar or top-right)
- Opens dialog showing `lightfast.yml` for selected repo

**Phase 1:**
- Search scoped to default workspace (`ws_${orgSlug}`)
- All repos in org are searchable

**Phase 2:**
- Workspace switcher in header
- Search scoped to selected workspace
- Multi-source results (GitHub + Linear + Notion)

---

### 2. Settings (`/org/[slug]/settings/*`)

**Purpose:** Configuration

**Current state:** ✅ Already exists with sidebar

**Keep existing structure:**
```
Settings
├── GitHub Integration  (existing)
└── Repositories        (existing)
```

**Phase 2 additions:**
```
Settings
├── GitHub Integration
├── Repositories
├── Workspace           (new - read-only in Phase 1, editable in Phase 2)
├── Linear Integration  (new)
└── Notion Integration  (new)
```

---

### 3. View Config Dialog (NEW)

**Purpose:** Show user their repository's `lightfast.yml` configuration

**Trigger:** Button in search interface (e.g., toolbar or top-right corner)

**Behavior:**
1. User clicks "View Config" button
2. Dialog opens showing `lightfast.yml` for currently selected repo
3. If no repo selected, show config for first repo in org
4. If repo has no config, show setup guide

**Dialog Content:**

```
┌─────────────────────────────────────────────────┐
│ Repository Configuration                    [×] │
├─────────────────────────────────────────────────┤
│ Repository: lightfastai/lightfast               │
│ Status: ✅ Configured                           │
│                                                 │
│ lightfast.yml                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ version: 1                                  │ │
│ │                                             │ │
│ │ store: lightfast-docs                       │ │
│ │ include:                                    │ │
│ │   - docs/**/*.md                            │ │
│ │   - docs/**/*.mdx                           │ │
│ │   - apps/*/README.md                        │ │
│ │                                             │ │
│ │ exclude:                                    │ │
│ │   - node_modules/**                         │ │
│ │   - dist/**                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Documents indexed: 1,234                        │
│ Last ingested: 2 hours ago                      │
│                                                 │
│ [View in GitHub] [Re-detect Config] [Close]    │
└─────────────────────────────────────────────────┘
```

**If repo is unconfigured:**

```
┌─────────────────────────────────────────────────┐
│ Repository Configuration                    [×] │
├─────────────────────────────────────────────────┤
│ Repository: acme/api                            │
│ Status: ⚠️  No lightfast.yml found              │
│                                                 │
│ This repository needs a lightfast.yml file      │
│ to be indexed.                                  │
│                                                 │
│ Create lightfast.yml in your repository root:   │
│ ┌─────────────────────────────────────────────┐ │
│ │ version: 1                                  │ │
│ │                                             │ │
│ │ store: api-docs                             │ │
│ │ include:                                    │ │
│ │   - docs/**/*.md                            │ │
│ │   - README.md                               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Copy Template] [View Setup Guide] [Close]     │
└─────────────────────────────────────────────────┘
```

**Phase 2 additions:**
```
┌─────────────────────────────────────────────────┐
│ Repository Configuration                    [×] │
├─────────────────────────────────────────────────┤
│ Repository: lightfastai/lightfast               │
│ Workspace: Platform Engineering (ws_platform)   │
│ Status: ✅ Configured                           │
│                                                 │
│ lightfast.yml                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ version: 1                                  │ │
│ │ workspace: platform  # ← Phase 2            │ │
│ │                                             │ │
│ │ store: platform-docs                        │ │
│ │ include:                                    │ │
│ │   - docs/**/*.md                            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Change Workspace ▼] [View in GitHub] [Close]  │
└─────────────────────────────────────────────────┘
```

---

## Implementation Notes

### Current State (Already Exists)

✅ Search page: `apps/console/src/app/(app)/org/[slug]/page.tsx`
✅ Search interface component: `apps/console/src/components/org-chat-interface.tsx`
✅ Settings pages: `apps/console/src/app/(app)/org/[slug]/settings/*`
✅ Settings sidebar: `apps/console/src/components/settings-sidebar.tsx`
✅ Header: `apps/console/src/components/authenticated-header.tsx`

### What Needs to Be Added

**1. View Config Button**

Add to search interface toolbar (next to repository selector):

```tsx
// apps/console/src/components/org-chat-interface.tsx

<PromptInputTools className="flex items-center gap-2">
  <PromptInputButton variant="ghost" size="sm">
    <Plus className="h-4 w-4" />
  </PromptInputButton>

  {/* Repository selector (existing) */}
  <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
    ...
  </Select>

  {/* NEW: View Config button */}
  <PromptInputButton
    variant="ghost"
    size="sm"
    onClick={() => setConfigDialogOpen(true)}
  >
    <FileCode className="h-4 w-4" />
    <span className="text-xs">Config</span>
  </PromptInputButton>
</PromptInputTools>
```

**2. Config Dialog Component**

New component: `apps/console/src/components/repository-config-dialog.tsx`

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";

interface RepositoryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
  organizationId: string;
}

export function RepositoryConfigDialog({
  open,
  onOpenChange,
  repositoryId,
  organizationId,
}: RepositoryConfigDialogProps) {
  const trpc = useTRPC();

  const { data: repo } = useSuspenseQuery({
    ...trpc.repository.get.queryOptions({
      id: repositoryId,
      organizationId,
    }),
    enabled: Boolean(repositoryId),
  });

  // Render config status, lightfast.yml content, stats
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repository Configuration</DialogTitle>
        </DialogHeader>
        {/* Config display */}
      </DialogContent>
    </Dialog>
  );
}
```

**3. Settings Link in Header**

Add to `apps/console/src/components/authenticated-header.tsx`:

```tsx
<div className="flex items-center gap-2">
  <Link href={`/org/${currentOrgSlug}/settings`}>
    <Button variant="ghost" size="sm">
      <Settings className="h-4 w-4" />
    </Button>
  </Link>
  <UserDropdownMenu />
</div>
```

---

## Workspace Handling

### Phase 1 (Current)

**No workspace UI:**
- All repos auto-assigned to `ws_${orgSlug}`
- No workspace switcher
- Search scoped to default workspace (transparent)
- Config dialog shows repo config only

**Optional:** Show workspace info in settings (read-only)
```
Settings → Workspace (read-only)
  Name: Default Workspace
  ID: ws_acme
  Repositories: 3 connected

  ℹ️  Phase 2: Multiple workspaces coming soon.
```

### Phase 2

**Workspace switcher in header:**
```
[ws_platform ▼]  Lightfast  [Settings] [User]
```

**Config dialog enhanced:**
- Shows which workspace repo is assigned to
- Button to change workspace assignment
- Shows workspace field in `lightfast.yml`

---

## Summary

### Three Things Only

1. **Search** - Landing page (already exists)
2. **Settings** - Configuration pages (already exists)
3. **View Config** - Dialog showing `lightfast.yml` (needs to be added)

### No Additional Pages

- ❌ No Knowledge/Documents page
- ❌ No Timeline/Activity page
- ❌ No Repositories page (stays in settings)
- ❌ No horizontal navigation tabs

### Minimal UI

- Keep search page clean and centered
- Keep settings with sidebar (existing pattern)
- Add one button for viewing config
- Add one dialog component for showing config

### Phase 2 Changes

When Phase 2 comes:
- Add workspace switcher to header (dropdown next to org switcher)
- Config dialog shows workspace field
- Settings adds workspace/Linear/Notion pages
- Search results show multi-source content

**But for now:** Super simple. Search + Settings + Config dialog. That's it.
