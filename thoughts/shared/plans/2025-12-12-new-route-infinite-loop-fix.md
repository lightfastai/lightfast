# Fix /new Route Infinite Loop Implementation Plan

## Overview

Fix the "Maximum update depth exceeded" error on the `/new` workspace creation route by stabilizing referential integrity in the GitHub connector component and adding proper equality guards to prevent cascading re-renders.

## Current State Analysis

### Root Cause
The infinite loop originates in `github-connector.tsx` due to **referential instability**:

1. **Line 38**: `const installations = githubUserSource?.installations ?? []` creates a new array reference on every render
2. **Lines 46-49**: Effect calls `setInstallations(installations)` without checking if value changed
3. **Lines 51-75**: Effect calls `setSelectedInstallation(installations[0])` comparing by reference, not ID

### Loop Sequence
1. Component renders → `installations` gets new array reference
2. Effect 2 sees "changed" `installations` → calls `setInstallations()`
3. Context update triggers all consumers to re-render
4. GitHub connector re-renders → Step 1 repeats
5. **Infinite loop established**

### Key Discoveries
- `github-connector.tsx:38` - Array derivation creates new reference each render
- `github-connector.tsx:46-49` - Effect lacks equality check
- `github-connector.tsx:69-71` - Selection uses reference comparison, not ID
- `workspace-form-provider.tsx:76-79` - Context setters trigger cascading re-renders
- Existing patterns in `workspace-name-input.tsx` correctly use guard conditions

## Desired End State

After implementation:
1. The `/new` route loads without "Maximum update depth exceeded" error
2. URL parameters (`?teamSlug=lightfast`) correctly pre-fill the form
3. GitHub installations load and display correctly
4. Form-URL bidirectional sync works without loops
5. No console warnings about excessive re-renders

### Verification
- Navigate to `http://localhost:3024/new?teamSlug=lightfast` - page loads without error
- Select different organization - URL updates, form syncs
- Type workspace name - URL updates after debounce
- GitHub installations dropdown works correctly

## What We're NOT Doing

- Refactoring the entire form architecture
- Changing the nuqs library or React Hook Form setup
- Adding new features or UI changes
- Modifying the server component or data fetching patterns
- Changing the tRPC queries or mutations

## Implementation Approach

Surgical fixes to `github-connector.tsx` to stabilize references and add equality guards. No architectural changes needed - the existing patterns in other components are correct.

---

## Phase 1: Stabilize Array Reference with useMemo

### Overview
Memoize the `installations` derivation to prevent new array references on every render.

### Changes Required

#### 1. Add useMemo for installations derivation
**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
**Changes**: Replace direct derivation with memoized version

**Before** (line 38):
```typescript
const installations = githubUserSource?.installations ?? [];
```

**After**:
```typescript
const installations = useMemo(
  () => githubUserSource?.installations ?? [],
  [githubUserSource?.installations]
);
```

**Import**: Ensure `useMemo` is imported from React (likely already imported).

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [x] Navigate to `/new` - should still show infinite loop (this phase alone won't fix it)
- [x] Confirm no new TypeScript errors in IDE

**Implementation Note**: This phase alone won't fix the loop - it stabilizes the reference but Effect 2 still needs guards.

---

## Phase 2: Add Equality Guards to Effects

### Overview
Add equality checks before context updates to prevent unnecessary state changes.

### Changes Required

#### 1. Guard Effect 2 (installations sync)
**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
**Changes**: Add deep equality check before updating context

**Before** (lines 46-49):
```typescript
useEffect(() => {
  setInstallations(installations);
}, [installations, setInstallations]);
```

**After**:
```typescript
useEffect(() => {
  // Only update if installations actually changed (by ID comparison)
  setInstallations((prev) => {
    const prevIds = prev.map((i) => i.id).join(",");
    const newIds = installations.map((i) => i.id).join(",");
    if (prevIds === newIds) {
      return prev; // No change, keep previous reference
    }
    return installations;
  });
}, [installations, setInstallations]);
```

**Note**: This requires changing `setInstallations` in the context to accept a function updater, OR we can use a simpler approach with a ref to track previous value.

**Alternative (simpler, no context changes)**:
```typescript
const prevInstallationsRef = useRef<typeof installations>([]);

useEffect(() => {
  const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
  const newIds = installations.map((i) => i.id).join(",");

  if (prevIds !== newIds) {
    setInstallations(installations);
    prevInstallationsRef.current = installations;
  }
}, [installations, setInstallations]);
```

#### 2. Guard Effect 3 (installation selection)
**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
**Changes**: Compare by ID instead of reference

**Before** (lines 51-75):
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

**After**:
```typescript
useEffect(() => {
  if (installations.length === 0) {
    if (selectedInstallation !== null) {
      setSelectedInstallation(null);
    }
    return;
  }

  // Check if current selection still exists
  const currentSelectionStillExists = selectedInstallation
    ? installations.some((inst) => inst.id === selectedInstallation.id)
    : false;

  if (currentSelectionStillExists) {
    // Selection is valid, no update needed
    return;
  }

  // Need to select first installation
  const firstInstall = installations[0];
  if (firstInstall) {
    // Only update if we're selecting a DIFFERENT installation
    if (selectedInstallation?.id !== firstInstall.id) {
      setSelectedInstallation(firstInstall);
    }
  }
}, [installations, selectedInstallation, setSelectedInstallation]);
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Navigate to `http://localhost:3024/new` - **NO infinite loop error**
- [ ] Navigate to `http://localhost:3024/new?teamSlug=lightfast` - page loads correctly
- [ ] GitHub installations dropdown appears and is functional
- [ ] Console shows no "Maximum update depth exceeded" warnings

**Implementation Note**: After completing this phase, the infinite loop should be fixed. Pause for manual verification before proceeding.

---

## Phase 3: Consolidate Effects (Optional Optimization)

### Overview
Merge the three effects into one consolidated effect to reduce re-render cascade. This is an optimization, not strictly necessary for fixing the loop.

### Changes Required

#### 1. Merge all three effects into one
**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
**Changes**: Replace three separate effects with one consolidated effect

**After** (replaces all three effects):
```typescript
// Track previous values to prevent unnecessary updates
const prevInstallationsRef = useRef<typeof installations>([]);

// Consolidated effect for GitHub source state management
useEffect(() => {
  // 1. Sync userSourceId
  const newUserSourceId = githubUserSource?.id ?? null;
  if (newUserSourceId !== userSourceId) {
    setUserSourceId(newUserSourceId);
  }

  // 2. Sync installations (with ID comparison)
  const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
  const newIds = installations.map((i) => i.id).join(",");

  if (prevIds !== newIds) {
    setInstallations(installations);
    prevInstallationsRef.current = installations;
  }

  // 3. Handle installation selection
  if (installations.length === 0) {
    if (selectedInstallation !== null) {
      setSelectedInstallation(null);
    }
    return;
  }

  const currentSelectionStillExists = selectedInstallation
    ? installations.some((inst) => inst.id === selectedInstallation.id)
    : false;

  if (!currentSelectionStillExists) {
    const firstInstall = installations[0];
    if (firstInstall && selectedInstallation?.id !== firstInstall.id) {
      setSelectedInstallation(firstInstall);
    }
  }
}, [
  githubUserSource?.id,
  installations,
  selectedInstallation,
  userSourceId,
  setUserSourceId,
  setInstallations,
  setSelectedInstallation,
]);
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @lightfast/console typecheck`
- [ ] Linting passes: `pnpm --filter @lightfast/console lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Navigate to `/new` - page loads without error
- [ ] Navigate to `/new?teamSlug=lightfast` - org pre-selected correctly
- [ ] GitHub connector works as before
- [ ] React DevTools shows fewer re-renders than before

**Implementation Note**: This phase is optional. If Phase 2 fixes the issue completely, this can be skipped or deferred.

---

## Testing Strategy

### Manual Testing Steps
1. **Basic load**: Navigate to `/new` - should load without error
2. **With URL param**: Navigate to `/new?teamSlug=lightfast` - org should be pre-selected
3. **Organization change**: Select different org - URL should update
4. **Workspace name**: Type name - URL should update after 500ms debounce
5. **GitHub flow**: Connect GitHub account - installations should load correctly
6. **Repository selection**: Select repos - should work without loops

### Edge Cases to Test
1. User with no GitHub connection - should show "Connect GitHub" button
2. User with GitHub but no installations - should show appropriate message
3. User with multiple installations - dropdown should work
4. Switching organizations mid-form - should reset GitHub state appropriately

### Performance Verification
- Open React DevTools Profiler
- Navigate to `/new?teamSlug=lightfast`
- Verify render count is reasonable (< 5 renders to stabilize)
- No continuous re-rendering visible in profiler

---

## Rollback Plan

If the fix causes issues:
1. Revert changes to `github-connector.tsx`
2. The component will return to previous (broken) state
3. Investigate logs/errors for what went wrong

---

## References

- Research document: `thoughts/shared/research/2025-12-12-new-route-infinite-loop.md`
- Component: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
- Context provider: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- URL state hook: `apps/console/src/app/(app)/(user)/new/_components/use-workspace-search-params.ts`
- Similar pattern: `apps/console/src/app/(app)/(user)/new/_components/workspace-name-input.tsx` (correct implementation)
