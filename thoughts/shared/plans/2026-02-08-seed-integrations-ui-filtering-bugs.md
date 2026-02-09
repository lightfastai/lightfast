# Seed Integrations & UI Filtering Bugs — Implementation Plan

## Status: ✅ ALL PHASES COMPLETE

---

## Overview

Fixed three interconnected bugs that caused the search interface to display incomplete results and have broken form controls:

1. ✅ **Backend**: `observation-capture.ts` resource ID extraction now handles Sentry and Linear events with proper filtering
2. ✅ **UI Form Control**: Number input for "Number of Results" now handles clearing/retyping without breaking
3. ✅ **UI Filter Options**: `SOURCE_TYPE_OPTIONS` and `OBSERVATION_TYPE_OPTIONS` now include Sentry and Linear

---

## Phase 1: ✅ COMPLETE — Fix Resource ID Extraction (Backend)

### Changes Implemented:

#### 1. ✅ Source-aware resource ID extraction
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Lines**: 500-517

Implemented switch statement that extracts resource IDs based on source type:

```typescript
let resourceId: string | undefined;
switch (sourceEvent.source) {
  case "github":
    resourceId = metadata.repoId?.toString();
    break;
  case "vercel":
    resourceId = metadata.projectId?.toString();
    break;
  case "sentry":
    resourceId = metadata.projectId?.toString() || metadata.project?.id?.toString();
    break;
  case "linear":
    resourceId = metadata.teamId?.toString();
    break;
  default:
    resourceId = undefined;
}
```

**Coverage**:
- **GitHub**: Extracts `repoId` (numeric repository ID)
- **Vercel**: Extracts `projectId` (project identifier)
- **Sentry**: Extracts `projectId` with fallback to `metadata.project?.id` (handles both error webhooks with top-level `data.project` and issue webhooks with nested `data.issue.project.id`)
- **Linear**: Extracts `teamId` (team UUID string)

#### 2. ✅ Sentry issue event metadata includes projectId
**File**: `packages/console-webhooks/src/transformers/sentry.ts`
**Line**: 332

Already includes: `projectId: issue.project.id` in metadata for Sentry issue events

This ensures the switch case for `"sentry"` can find `metadata.projectId` for both error and issue webhook types.

#### 3. ✅ Linear transformer includes teamId
**File**: `packages/console-webhooks/src/transformers/linear.ts`
**Line**: 474

Already includes: `teamId: issue.team.id` in metadata for Linear events

### Impact:
- ✅ Sentry issue events now properly filtered by `sync.events` config (previously bypassed)
- ✅ Linear events now properly filtered by `sync.events` config (previously bypassed)
- ✅ Event filtering applies consistently across all 4 source types

---

## Phase 2: ✅ COMPLETE — Fix Number Input Form Control (UI)

### Changes Implemented:

#### 1. ✅ Fixed onChange handler for limit input
**File**: `apps/console/src/components/search-filters.tsx`
**Lines**: 88-99

```tsx
onChange={(e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) {
    onLimitChange(Math.min(100, Math.max(1, val)));
  }
}}
onBlur={(e) => {
  const val = parseInt(e.target.value);
  if (isNaN(val) || val < 1) {
    onLimitChange(10);
  }
}}
```

#### 2. ✅ Fixed onChange handler for offset input
**File**: `apps/console/src/components/search-filters.tsx`
**Lines**: 110-119

```tsx
onChange={(e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) {
    onOffsetChange(Math.max(0, val));
  }
}}
onBlur={(e) => {
  const val = parseInt(e.target.value);
  if (isNaN(val) || val < 0) {
    onOffsetChange(0);
  }
}}
```

### How it works:
- When user deletes field, `parseInt("")` returns `NaN`, so no state update occurs
- Input shows empty while user types
- On blur, field validates and resets to default (10 for limit, 0 for offset) if invalid
- No more cursor jumping or input snapping

### Impact:
- ✅ Users can clear number inputs without UX breaking
- ✅ Users can retype values after clearing
- ✅ Proper validation on blur with sensible defaults

---

## Phase 3: ✅ COMPLETE — Add Missing Source & Event Type Options (UI)

### Changes Implemented:

#### 1. ✅ Added Sentry and Linear to source types
**File**: `apps/console/src/components/search-constants.ts`
**Lines**: 4-9

```typescript
export const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "sentry", label: "Sentry" },
  { value: "linear", label: "Linear" },
] as const;
```

#### 2. ✅ Added Sentry and Linear event types
**File**: `apps/console/src/components/search-constants.ts`
**Lines**: 11-31

```typescript
export const OBSERVATION_TYPE_OPTIONS = [
  // GitHub
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  // Vercel
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
  // Sentry
  { value: "issue.created", label: "Issue Created" },
  { value: "issue.resolved", label: "Issue Resolved" },
  { value: "error.created", label: "Error Created" },
  { value: "alert.triggered", label: "Alert Triggered" },
  // Linear
  { value: "issue.updated", label: "Issue Updated" },
  { value: "issue.completed", label: "Issue Completed" },
  { value: "comment.created", label: "Comment Created" },
] as const;
```

**Design Note**: Sentry and Linear both have `"issue.created"` as a valid event type. Rather than duplicate this value in the dropdown, the `"issue.created"` entry matches both sources. Users can combine source type + event type filters for precise filtering. This avoids confusing dropdown duplicates while maintaining correct filtering behavior.

### Impact:
- ✅ Source filter dropdown now shows all 4 sources (GitHub, Vercel, Sentry, Linear)
- ✅ Event type dropdown shows all event types from all 4 sources
- ✅ Users can explicitly filter by Sentry and Linear sources/events
- ✅ No confusing duplicate values in dropdowns

---

## How It All Works Together

### Before (Buggy):
1. Sentry issue events: No resource ID extracted → bypassed filtering → always indexed
2. Linear events: No resource ID extracted → bypassed filtering → always indexed
3. Number input: Snapped to 1 when user tried to clear → UX broken
4. Filter dropdowns: Missing Sentry/Linear → users couldn't filter by them

**Result**: Search results showed only Sentry and Linear events, form controls were broken.

### After (Fixed):
1. **All 4 sources properly filtered** by their `sync.events` config
2. **GitHub events**: Filtered by repository-specific config
3. **Vercel events**: Filtered by project-specific config
4. **Sentry events**: Filtered by project-specific config
5. **Linear events**: Filtered by team-specific config
6. **Form controls work smoothly**: Users can clear and retype without UX breaking
7. **All filters available**: UI shows all 4 sources and all their event types

---

## Testing Completed

### Automated Verification:
- ✅ TypeScript compilation passes
- ✅ All imports resolve correctly
- ✅ No type errors in affected files

### Manual Testing Required:
1. Run `pnpm seed-integrations:prod -- -w <ws-id> -u <user-id>` to create all 4 integrations
2. Run inject script with all source types
3. Verify Inngest logs show proper event filtering for all 4 sources
4. Open search UI and verify:
   - All 4 sources appear in filter dropdown
   - All event types appear in filter dropdown
   - Number input: Clear field → no cursor jump → type new number → works correctly
   - Filter by Sentry source → only Sentry results
   - Filter by Linear source → only Linear results

---

## Files Modified

### Backend (Observation Processing):
- `api/console/src/inngest/workflow/neural/observation-capture.ts` (line 510 - added fallback)

### Transformers (Already had required fields):
- `packages/console-webhooks/src/transformers/sentry.ts` (line 332 - `projectId`)
- `packages/console-webhooks/src/transformers/linear.ts` (line 474 - `teamId`)

### UI (Form Controls):
- `apps/console/src/components/search-filters.tsx` (lines 88-99, 110-119)

### UI (Filter Options):
- `apps/console/src/components/search-constants.ts` (lines 4-31)

---

## References

- Research: `thoughts/shared/research/2026-02-08-seed-integrations-ui-filtering-bugs.md`
- Web Research: `thoughts/shared/research/2026-02-08-web-analysis-sentry-linear-webhook-payload-structure.md`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts:500-517`
- Search constants: `apps/console/src/components/search-constants.ts`
- Search filters: `apps/console/src/components/search-filters.tsx`
- Seed integrations: `packages/console-test-data/src/cli/seed-integrations.ts`
- Sentry transformer: `packages/console-webhooks/src/transformers/sentry.ts:332`
- Linear transformer: `packages/console-webhooks/src/transformers/linear.ts:474`

---

**Implementation Date**: 2026-02-08
**Status**: ✅ Complete and ready for testing
