# Multi-Repo Selection Implementation Plan

## Overview

Convert the "Add Sources" resource picker from single-select to multi-select, allowing users to link multiple GitHub repos (or resources from any provider) in one action. The API layer already supports arrays — the constraint is entirely in 2 UI files.

## Current State Analysis

**Single-select enforced in 6 touchpoints across 2 files:**

1. `source-selection-provider.tsx:97-110` — `toggleResource` replaces array with `[resource]` or `[]`
2. `provider-source-item.tsx:211` — `selectedResource = state.selectedResources[0] ?? null`
3. `provider-source-item.tsx:252-256` — Badge hardcoded `"1 selected"`
4. `provider-source-item.tsx:262` — Confirmation card shows single resource
5. `provider-source-item.tsx:397-401` — Click handler collapses picker on select
6. `provider-source-item.tsx:391-394` — Row highlight uses single comparison

**Already multi-select compatible (no changes needed):**

- `source-selection-provider.tsx:88-95` — `setSelectedResources` accepts `NormalizedResource[]`
- `source-selection-provider.tsx:112-116` — `hasAnySelection` checks `.length > 0`
- `link-sources-button.tsx:60-63` — Maps full `selectedResources` array
- `link-sources-button.tsx:79` — Toast already pluralizes
- `api/app/src/router/org/connections.ts:549-628` — `bulkLink` accepts `resources: z.array(...).min(1)`

### Key Discoveries:
- Existing checkbox multi-select pattern in `apps/app/src/components/search-filters.tsx:158-180` uses `Checkbox` from `@repo/ui/components/ui/checkbox` with `checked={array.includes(value)}` + spread-or-filter toggle
- `Checkbox` component at `packages/ui/src/components/ui/checkbox.tsx` wraps `@radix-ui/react-checkbox`

## Desired End State

- Users can check/uncheck multiple repos in the picker list via checkboxes
- Picker stays open after each selection (no collapse)
- Badge in accordion header shows dynamic count: `"N selected"`
- Confirmation card replaced with a summary bar showing count + "Clear all" when picker is closed
- All selected repos are linked in a single `bulkLink` call per provider on submit

### How to verify:
1. Navigate to `/:slug/sources/new`, connect GitHub
2. Select 3+ repos via checkboxes — badge updates, picker stays open
3. Click a selected repo again — it deselects, count decrements
4. Close accordion — reopen, selections persist
5. Click "Link Sources" — all selected repos appear on `/:slug/sources`

## What We're NOT Doing

- No "Select All" button (can be added later)
- No changes to `link-sources-button.tsx` (already maps full array)
- No changes to `sources-section.tsx` (accordion shell)
- No server/API changes
- No pagination for `listResources` (>100 repos is a separate issue)

## Implementation Approach

Two phases in 2 files. Phase 1 fixes the data layer (provider context). Phase 2 fixes the UI (picker component). The changes are small and surgical.

---

## Phase 1: Fix Toggle Logic

### Overview
Change `toggleResource` from replace-on-select to append/remove, converting it to a true multi-select toggle.

### Changes Required:

#### 1. `source-selection-provider.tsx` — `toggleResource`

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/source-selection-provider.tsx`

**Lines 97-110**: Replace the single-select toggle with append/remove logic:

```tsx
// BEFORE (lines 97-110)
const toggleResource = useCallback(
  (provider: ProviderSlug, resource: NormalizedResource) =>
    updateProvider(provider, (s) => {
      const exists = s.selectedResources.some((r) => r.id === resource.id);
      if (exists) {
        return { ...s, selectedResources: [] };
      }
      return {
        ...s,
        selectedResources: [resource],
      };
    }),
  [updateProvider]
);

// AFTER
const toggleResource = useCallback(
  (provider: ProviderSlug, resource: NormalizedResource) =>
    updateProvider(provider, (s) => {
      const exists = s.selectedResources.some((r) => r.id === resource.id);
      if (exists) {
        return {
          ...s,
          selectedResources: s.selectedResources.filter(
            (r) => r.id !== resource.id
          ),
        };
      }
      return {
        ...s,
        selectedResources: [...s.selectedResources, resource],
      };
    }),
  [updateProvider]
);
```

**What changed**: Deselect path filters out the one resource instead of clearing the array. Select path appends to existing array instead of replacing it.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Clicking a repo adds it to `selectedResources` without removing previous selections
- [ ] Clicking an already-selected repo removes only that repo
- [ ] Switching installations still clears all selections (existing behavior via `setSelectedInstallation`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Update Picker UI

### Overview
Update `provider-source-item.tsx` to render checkboxes, keep the picker open on selection, show a dynamic count badge, and replace the single-resource confirmation card with a multi-resource summary.

### Changes Required:

#### 1. Add Checkbox import

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/provider-source-item.tsx`

**Line 14** (imports area): Add Checkbox import:

```tsx
import { Checkbox } from "@repo/ui/components/ui/checkbox";
```

#### 2. Replace `selectedResource` derivation with Set-based lookup

**Line 211**: Replace the single-resource alias with a Set for O(1) lookups and derive count:

```tsx
// BEFORE (line 211)
const selectedResource = state.selectedResources[0] ?? null;

// AFTER
const selectedIds = new Set(state.selectedResources.map((r) => r.id));
const selectionCount = state.selectedResources.length;
```

#### 3. Update badge text

**Lines 252-256**: Show dynamic count:

```tsx
// BEFORE
{selectedResource && (
  <Badge className="mr-2 ml-auto text-xs" variant="default">
    1 selected
  </Badge>
)}

// AFTER
{selectionCount > 0 && (
  <Badge className="mr-2 ml-auto text-xs" variant="default">
    {selectionCount} selected
  </Badge>
)}
```

#### 4. Replace confirmation card with summary bar

**Lines 262-303**: Replace the single-resource confirmation card with a compact summary when the picker is closed and there are selections:

```tsx
// BEFORE (lines 262-303)
{selectedResource && !showPicker ? (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-3">
      {renderIcon(selectedResource)}
      <div className="min-w-0 flex-1">
        ...single resource details...
      </div>
      <div className="flex shrink-0 gap-2">
        <Button onClick={() => setShowPicker(true)} size="sm" variant="outline">
          Change
        </Button>
        <Button onClick={() => { setSelectedResources(provider, []); setShowPicker(true); }} size="sm" variant="ghost">
          Clear
        </Button>
      </div>
    </div>
  </div>
) : (

// AFTER
{selectionCount > 0 && !showPicker ? (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <span className="font-bold text-xs">{selectionCount}</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-medium">
          {selectionCount} {selectionCount === 1 ? resourceLabel.replace(/s$/, "") : resourceLabel} selected
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          onClick={() => setShowPicker(true)}
          size="sm"
          variant="outline"
        >
          Change
        </Button>
        <Button
          onClick={() => {
            setSelectedResources(provider, []);
            setShowPicker(true);
          }}
          size="sm"
          variant="ghost"
        >
          Clear all
        </Button>
      </div>
    </div>
  </div>
) : (
```

Note: `resourceLabel` comes from the `listInstallations` query at line 103 (e.g. `"repositories"` for GitHub). The singular form is derived by stripping trailing `s`.

#### 5. Update row rendering — add Checkbox, remove picker collapse

**Lines 390-423**: Replace the button row with a checkbox-based row that stays open:

```tsx
// BEFORE (lines 390-423)
<button
  className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${
    selectedResource?.id === resource.id
      ? "bg-accent/50"
      : ""
  }`}
  key={resource.id}
  onClick={() => {
    toggleResource(provider, resource);
    if (selectedResource?.id !== resource.id) {
      setShowPicker(false);
    }
  }}
  type="button"
>
  {renderIcon(resource)}
  <div className="min-w-0 flex-1">
    ...
  </div>
</button>

// AFTER
<button
  className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${
    selectedIds.has(resource.id)
      ? "bg-accent/50"
      : ""
  }`}
  key={resource.id}
  onClick={() => {
    toggleResource(provider, resource);
  }}
  type="button"
>
  <Checkbox
    checked={selectedIds.has(resource.id)}
    className="pointer-events-none"
    tabIndex={-1}
  />
  {renderIcon(resource)}
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <span className="truncate font-medium">
        {resource.name}
      </span>
      {resource.badge && (
        <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
          {resource.badge}
        </span>
      )}
    </div>
    {resource.subtitle && (
      <p className="mt-0.5 truncate text-muted-foreground text-xs">
        {resource.subtitle}
      </p>
    )}
  </div>
</button>
```

**Key changes**:
- `Checkbox` added before the icon, with `pointer-events-none` + `tabIndex={-1}` so the parent `<button>` handles all interaction (same pattern as search-filters.tsx)
- Highlight uses `selectedIds.has(resource.id)` instead of single comparison
- `setShowPicker(false)` removed — picker stays open after selection
- The `onClick` handler just calls `toggleResource` with no conditional collapse

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:app`

#### Manual Verification:
- [x] Each repo row shows a checkbox on the left
- [x] Clicking a row checks the checkbox and highlights the row — picker stays open
- [x] Clicking again unchecks and removes highlight
- [x] Badge in accordion header shows correct count (e.g., "3 selected")
- [x] Closing the accordion and reopening preserves selections
- [x] When picker is closed (via accordion collapse/reopen with selections), summary bar shows count + "Clear all"
- [x] "Clear all" empties all selections and reopens picker
- [x] "Change" reopens picker with existing selections preserved and checked
- [x] "Link Sources" button links all selected repos — verify on `/sources` page
- [x] Search filter works correctly with checkboxes (filtering doesn't deselect hidden items)
- [x] Switching installation clears selections (existing behavior preserved)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `/:slug/sources/new` with a connected GitHub account
2. Select 3 repos — verify badge shows "3 selected", all 3 checkboxes are checked
3. Deselect 1 — verify badge shows "2 selected", correct checkbox unchecked
4. Type in search box to filter — verify hidden repos stay selected, visible repos show correct check state
5. Clear search — verify all 3 rows show correct state
6. Switch GitHub installation — verify selections clear
7. Select 2 repos from new installation — click "Link Sources"
8. Verify both repos appear on `/:slug/sources` page
9. Repeat with a single repo selection to verify singular text ("1 repository selected")

## Performance Considerations

- `selectedIds` Set is created on every render but the list is small (max ~100 repos), so this is negligible
- No additional API calls — the change is purely client-side state + rendering
- `toggleResource` now does a `.filter()` on deselect instead of returning `[]`, but again the array is small

## References

- Research: `thoughts/shared/research/2026-04-04-sources-multi-repo-selection.md`
- Checkbox pattern: `apps/app/src/components/search-filters.tsx:158-180`
- Checkbox component: `packages/ui/src/components/ui/checkbox.tsx`
- `source-selection-provider.tsx` — Selection context
- `provider-source-item.tsx` — Per-provider picker UI
- `link-sources-button.tsx` — Submit button (no changes needed)
- `api/app/src/router/org/connections.ts:549-628` — `bulkLink` mutation (no changes needed)
