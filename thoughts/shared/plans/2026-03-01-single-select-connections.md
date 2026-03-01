# Single-Select Connections (MVP) Implementation Plan

## Overview

Enforce single-selection for GitHub repositories and Vercel projects during workspace creation. Users pick exactly 1 repo and 1 project (or none). After selecting, the list collapses into a compact "selected card" with Change/Clear actions.

## Current State Analysis

- `GitHubSourceItem` and `VercelSourceItem` both use checkbox multi-select with "Select all / Deselect all"
- `toggleRepository` and `toggleProject` in `workspace-form-provider.tsx` append/remove from arrays
- `create-workspace-button.tsx` maps arrays into `bulkLink` mutations (already handles 0-N items)
- State types: `Repository[]` and `VercelProject[]`

### Key Files:
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx` — form state & toggles
- `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx` — GitHub picker
- `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx` — Vercel picker
- `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx` — submission (no changes needed)

## Desired End State

- Each source item has two visual states:
  1. **Picker mode**: Scrollable list of items (repos/projects) with clickable rows. Clicking a row selects it.
  2. **Selected mode**: Compact card showing the selected item name + metadata, with "Change" (re-opens picker) and "Clear" (deselects) buttons.
- `selectedRepositories` and `selectedProjects` arrays never exceed length 1.
- The accordion trigger badge shows "1 selected" or nothing.
- Submission logic unchanged — `bulkLink` receives a 0-or-1-item array.

## What We're NOT Doing

- Not changing the form state types (`Repository[]` / `VercelProject[]`) — keeping arrays for API compatibility
- Not modifying `create-workspace-button.tsx` submission logic
- Not changing the tRPC API layer or database
- Not adding validation preventing multi-select at the API level (UI-only enforcement for now)
- Not changing the OAuth connect/reconnect popup flows

## Implementation Approach

Single phase — all changes are UI-only within 3 files.

## Phase 1: Single-Select Connection Pickers

### Overview
Convert both source items from multi-select checkboxes to single-select with a selected-card confirmation view.

### Changes Required:

#### 1. `workspace-form-provider.tsx` — Single-select toggle functions

**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
**Changes**: Modify `toggleRepository` and `toggleProject` to enforce single selection.

`toggleRepository` (currently lines 73-81):
```tsx
// BEFORE: multi-select toggle
const toggleRepository = (repo: Repository) => {
  setSelectedRepositories((prev) => {
    const exists = prev.find((r) => r.id === repo.id);
    if (exists) return prev.filter((r) => r.id !== repo.id);
    return [...prev, repo];
  });
};

// AFTER: single-select — same item deselects, different item replaces
const toggleRepository = (repo: Repository) => {
  setSelectedRepositories((prev) => {
    const exists = prev.find((r) => r.id === repo.id);
    if (exists) return [];
    return [repo];
  });
};
```

`toggleProject` (currently lines 90-98):
```tsx
// BEFORE: multi-select toggle
const toggleProject = (project: VercelProject) => {
  setSelectedProjects((prev) => {
    const exists = prev.find((p) => p.id === project.id);
    if (exists) return prev.filter((p) => p.id !== project.id);
    return [...prev, project];
  });
};

// AFTER: single-select — same item deselects, different item replaces
const toggleProject = (project: VercelProject) => {
  setSelectedProjects((prev) => {
    const exists = prev.find((p) => p.id === project.id);
    if (exists) return [];
    return [project];
  });
};
```

#### 2. `github-source-item.tsx` — Single-select picker with selected card

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`
**Changes**:

1. Add `showPicker` local state (default `true`, set to `false` after selection)
2. Replace the "Selected Count & Clear" section and "Select all/Deselect all" header with nothing
3. Replace `Checkbox` with clickable rows that call `toggleRepository` and set `showPicker = false`
4. Add a "selected card" view when `selectedRepositories.length === 1 && !showPicker`:
   - Shows repo icon, name, private badge, description
   - "Change" button sets `showPicker = true`
   - "Clear" button calls `setSelectedRepositories([])`
5. Update badge in accordion trigger: show "1 selected" only when length === 1
6. Remove the `handleSelectAll` / `handleDeselectAll` functions
7. Remove the `selectedFromFiltered` computation

Selected card markup:
```tsx
{selectedRepositories.length === 1 && !showPicker ? (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        <Github className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{selectedRepositories[0].name}</span>
          {selectedRepositories[0].isPrivate && (
            <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
              Private
            </span>
          )}
        </div>
        {selectedRepositories[0].description && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {selectedRepositories[0].description}
          </p>
        )}
      </div>
    </div>
    <div className="flex gap-2 mt-3">
      <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
        Change
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setSelectedRepositories([])}>
        Clear
      </Button>
    </div>
  </div>
) : (
  /* ... existing picker list (without checkboxes, select-all, etc.) ... */
)}
```

Picker row change — replace `Checkbox` label with a simple clickable row:
```tsx
<button
  key={repo.id}
  type="button"
  className={`flex items-center gap-3 p-4 w-full text-left hover:bg-accent transition-colors cursor-pointer ${
    isSelected(repo.id) ? "bg-accent/50" : ""
  }`}
  onClick={() => {
    toggleRepository(repo);
    setShowPicker(false);
  }}
>
  {/* icon + name + badges (same as current, minus Checkbox) */}
</button>
```

#### 3. `vercel-source-item.tsx` — Single-select picker with selected card

**File**: `apps/console/src/app/(app)/(user)/new/_components/vercel-source-item.tsx`
**Changes**: Mirror the GitHub changes:

1. Add `showPicker` local state
2. Remove "Select all/Deselect all", `handleSelectAll`, `handleDeselectAll`, `selectedFromFiltered`
3. Remove `Checkbox` components — use clickable rows that call `toggleProject` + `setShowPicker(false)`
4. Add selected card view when `selectedProjects.length === 1 && !showPicker`
5. Update badge in trigger

Selected card:
```tsx
{selectedProjects.length === 1 && !showPicker ? (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        <VercelIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{selectedProjects[0].name}</span>
          {selectedProjects[0].framework && (
            <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
              {selectedProjects[0].framework}
            </span>
          )}
        </div>
      </div>
    </div>
    <div className="flex gap-2 mt-3">
      <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
        Change
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setSelectedProjects([])}>
        Clear
      </Button>
    </div>
  </div>
) : (
  /* ... existing picker list (without checkboxes, select-all, etc.) ... */
)}
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] GitHub: Clicking a repo selects it and shows selected card
- [ ] GitHub: "Change" re-opens picker, "Clear" deselects
- [ ] GitHub: Clicking a different repo in picker replaces the selection
- [ ] GitHub: Accordion trigger badge shows "1 selected" when a repo is picked
- [ ] Vercel: Same as above but for projects
- [ ] Submission: Creating a workspace with 1 repo + 1 project links both correctly
- [ ] Submission: Creating with 0 sources still works
- [ ] OAuth flows (Connect GitHub / Connect Vercel) still work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `/new`, connect GitHub if not connected
2. Open GitHub accordion → see list of repos
3. Click a repo → list collapses to selected card with Change/Clear
4. Click "Change" → list reappears, previous selection highlighted
5. Click a different repo → card updates to new selection
6. Click "Clear" → back to empty picker
7. Repeat steps 2-6 for Vercel
8. Select 1 repo + 1 project, fill in workspace name, submit
9. Verify workspace is created with both sources linked

## References

- Form provider: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- Submit handler: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`
