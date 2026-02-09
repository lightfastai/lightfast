---
date: 2026-02-08T16:45:00-08:00
researcher: Claude Code
git_commit: 612b0421657f6dbbdd861bf05baf16fb28f544b4
branch: main
repository: lightfast
topic: "Investigation: Seed Integrations & Search UI Filtering Bugs"
tags: [research, codebase, search, seed-integrations, form-controls, bugs, ui-filtering]
status: complete
last_updated: 2026-02-08
last_updated_by: Claude Code
---

# Research: Seed Integrations & Search UI Filtering Bugs

**Date**: 2026-02-08T16:45:00-08:00
**Researcher**: Claude Code
**Git Commit**: 612b0421657f6dbbdd861bf05baf16fb28f544b4
**Branch**: main
**Repository**: lightfast

## Research Question

Why is the search interface only showing Linear & Sentry issues when GitHub and Vercel sources should also be displayed? Why do the form controls (number of results input) stop at 1 and bug out when deleting? What's the role of the seed-integrations script in filtering events?

## Summary

There are **three separate but interconnected issues**:

1. **Missing UI Source Type Constants** - The search filter UI only exposes GitHub and Vercel as source options, but Linear and Sentry exist in the database schema and are created by the seed script. This creates an asymmetry between what can be queried and what the UI allows filtering on.

2. **Form Control Input Bug** - The "number of results" input field has a critical bug where deleting the value causes the input to jump to 1, then subsequent edits fail because React re-renders the input while the user is still typing. The bug is in the `onChange` handler logic that applies constraints immediately instead of on blur.

3. **Seed Integration Setup is Correct** - The seed-integrations.ts script properly creates all 4 source types (GitHub, Vercel, Sentry, Linear) with appropriate event configurations. The issue is NOT with what's being seeded, but with what the UI exposes to users for filtering.

The real search backend (Pinecone metadata filtering) is correctly implemented and supports all 4 sources. The problem is purely at the UI layer.

## Detailed Findings

### 1. Source Type Filtering Asymmetry

**Location**: `apps/console/src/components/search-constants.ts:4-7`

```typescript
export const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
] as const;
```

**Problem**: Only GitHub and Vercel are exposed in the UI filter dropdown. Linear and Sentry are missing.

**Database Schema Support**: `db/console/src/schema/tables/workspace-neural-observations.ts:142-144`
```typescript
source: varchar("source", { length: 50 }).notNull(),
// Supports: github, vercel, linear, sentry
```

**Seed Script Creates All 4**: `packages/console-test-data/src/cli/seed-integrations.ts:26-139`
```typescript
const DEMO_SOURCES = [
  { sourceType: "github", ... },
  { sourceType: "vercel", ... },
  { sourceType: "sentry", ... },      // ← Created but not in UI options
  { sourceType: "linear", ... },      // ← Created but not in UI options
]
```

**Search Backend Supports All 4**: `apps/console/src/lib/neural/four-path-search.ts:283-285`
```typescript
if (filters.sourceTypes?.length) {
  pineconeFilter.source = { $in: filters.sourceTypes };
}
// Can filter by any string value including "sentry", "linear"
```

**Impact**: If Pinecone has observations indexed with `source: "sentry"` and `source: "linear"`, but the UI only allows filtering by GitHub/Vercel, then users can't explicitly filter those sources. If those are the only sources that have been ingested/indexed, they'll appear as the only results.

### 2. "Number of Results" Form Control Bug

**Location**: `apps/console/src/components/search-filters.tsx:83-94`

```typescript
<Input
  type="number"
  min={1}
  max={100}
  value={limit}
  onChange={(e) =>
    onLimitChange(
      Math.min(100, Math.max(1, parseInt(e.target.value) || 1)),
    )
  }
  className="h-9 input-no-spinner"
/>
```

**The Bug**:

**Step 1: User types "10"**
- Input renders with value="10"
- User's cursor is at position 2 (after "10")
- Works fine

**Step 2: User deletes one character to get "1"**
- User presses backspace
- `e.target.value` becomes "1"
- `parseInt("1")` = 1
- `Math.min(100, Math.max(1, 1))` = 1
- `onLimitChange(1)` is called
- Parent component updates state
- Input re-renders with value="1"
- Works fine

**Step 3: User deletes again to clear the input**
- User presses backspace (trying to type a new number)
- `e.target.value` becomes "" (empty string)
- `parseInt("")` = `NaN` (not a number)
- `NaN || 1` = 1 (fallback kicks in)
- `Math.min(100, Math.max(1, 1))` = 1
- `onLimitChange(1)` is called
- Input re-renders with value="1"
- **Bug happens here**: User is mid-edit (cursor position 0), but the input re-renders with value="1", causing cursor position to shift and input handling to break

**Step 4: Subsequent typing fails**
- User expects to type a new number
- Input has already re-rendered to "1"
- React's input rendering conflicts with user's ongoing edit
- Results in buggy/broken behavior

**Root Cause**: The `onChange` handler applies constraints **during editing** rather than on blur. The HTML `min`/`max` attributes only work for up/down arrows and form submission validation, not for `onChange` events.

**The Solution**: Don't constrain on every keystroke. Let user type freely, then validate on blur or when submitting:

```typescript
// Better approach: constrain on blur or form submit
onChange={(e) => {
  // Allow any input while typing
  setInputValue(e.target.value);
}}
onBlur={(e) => {
  // Constrain when done editing
  const value = Math.min(100, Math.max(1, parseInt(e.target.value) || 10));
  onLimitChange(value);
}}
```

### 3. Seed Integration Script - Correct Implementation

**Location**: `packages/console-test-data/src/cli/seed-integrations.ts`

**What it does**:
- Creates `userSources` records (OAuth credentials table) - one per source type
- Creates `workspaceIntegrations` records (configuration table) - links user source to workspace
- Sets `sourceConfig.sync.events` array for each source type

**Event Configuration Created**:

```typescript
// GitHub: code-related events
sync: {
  events: ["push", "pull_request", "issues", "release", "discussion"],
  autoSync: true,
}

// Vercel: deployment lifecycle
sync: {
  events: ["deployment.created", "deployment.succeeded", "deployment.failed"],
  autoSync: true,
}

// Sentry: error/issue tracking
sync: {
  events: ["issue.created", "issue.resolved", "error.created", "alert.triggered"],
  autoSync: true,
}

// Linear: issue tracking
sync: {
  events: ["issue.created", "issue.updated", "issue.completed", "comment.created"],
  autoSync: true,
}
```

**How Event Filtering Works**:

1. Webhook arrives from provider (e.g., Linear webhook with `type: "Issue"`)
2. Webhook handler routes to transformer → creates `SourceEvent`
3. Inngest `observation-capture` workflow processes the event
4. **Filter check** at `api/console/src/inngest/workflow/neural/observation-capture.ts:189-198`:

```typescript
function isEventAllowed(
  sourceConfig: { sync?: { events?: string[] } },
  baseEventType: string
): boolean {
  const events = sourceConfig?.sync?.events;
  if (!events || events.length === 0) {
    return false;  // BLOCKS if empty
  }
  return events.includes(baseEventType);  // Check if event in allowed list
}
```

5. If event matches one in `sync.events`, it's ingested and indexed to Pinecone
6. If event not in `sync.events`, it's skipped with reason "event_not_allowed"

**Conclusion**: The seed script is setting this up correctly. If GitHub/Vercel events aren't showing up, either:
- They weren't injected into the database yet (inject script not run)
- The event types don't match what the `observation-capture` workflow expects
- The Pinecone indexing failed silently

### 4. Why Only Linear & Sentry Show

**Most Likely Reason**: One of these scenarios:

**Scenario A**: Only Linear and Sentry data was injected
- Test datasets may only contain Linear/Sentry webhook payloads
- Run: `pnpm inject -- -w <workspace-id> -s sandbox-1`
- This injects only the events from that dataset into the observation-capture workflow

**Scenario B**: GitHub/Vercel events weren't transformed correctly
- The `getBaseEventType()` function at `observation-capture.ts:155-184` transforms webhook event types to base types
- If GitHub/Vercel webhook event types don't match expected mappings, they get filtered as "unknown_event"
- Check Inngest logs for entries like: `"reason": "unknown_event"` for github/vercel sources

**Scenario C**: Pinecone indexing is incomplete
- Events were ingested but not successfully indexed to Pinecone
- Check: `SELECT COUNT(*) FROM lightfast_workspace_neural_observations WHERE source = 'github'`

**Scenario D**: User is looking at www demo, not console
- The `apps/www` search interface is frontend-only with hardcoded mock data
- But this wouldn't explain form control bugs or seed script references

### 5. Topic Display Issue

**User Reported**: "search only shows Topics: linear (linear, linear:issue.created)linear (linear, linear:issue.updated)"

**How Topics Are Generated**: `apps/console/src/lib/neural/cluster-search.ts`

Topics come from pre-computed observation clusters (NOT extracted at search time):
- Background workflows cluster related observations
- LLM generates topic labels and summaries
- Cluster centroids stored as vectors in Pinecone with `layer: "clusters"`
- Search context returns top 2 clusters

**Why Only Linear Topics Show**:

If only Linear and Sentry observations were indexed to Pinecone, then:
1. Cluster search only finds clusters made from Linear/Sentry observations
2. Topic extraction only works if observations exist to cluster
3. Result shows only Linear topics because those are the only clusters that exist

This is **cascading from the source data problem**, not a bug in topic extraction.

## Code References

### UI Source Type Constants
- `apps/console/src/components/search-constants.ts:4-7` - Missing Linear/Sentry
- `apps/console/src/components/search-filters.tsx:40-42` - sourceTypes prop passed to filter
- `apps/console/src/components/search-filters.tsx:148-189` - Source type filter UI

### Form Control Bug
- `apps/console/src/components/search-filters.tsx:78-94` - "Number of Results" input with buggy onChange
- Line 88-91: The problematic constraint logic

### Seed Integration Setup
- `packages/console-test-data/src/cli/seed-integrations.ts:26-139` - DEMO_SOURCES configuration
- `packages/console-test-data/src/cli/seed-integrations.ts:141-201` - seedIntegrations() function
- `db/console/src/schema/tables/workspace-integrations.ts` - workspaceIntegrations table schema
- `db/console/src/schema/tables/user-sources.ts` - userSources table schema

### Event Filtering Logic
- `api/console/src/inngest/workflow/neural/observation-capture.ts:155-184` - getBaseEventType() transformer
- `api/console/src/inngest/workflow/neural/observation-capture.ts:189-198` - isEventAllowed() filter
- `api/console/src/inngest/workflow/neural/observation-capture.ts:497-577` - Event filtering step in workflow

### Search Backend
- `apps/console/src/lib/neural/four-path-search.ts:272-307` - buildPineconeFilter() supports all sources
- `apps/console/src/lib/neural/cluster-search.ts:19-94` - Topic extraction logic
- `apps/console/src/components/search-results-list.tsx:46-57` - Topic display in results

### Database
- `db/console/src/schema/tables/workspace-neural-observations.ts:142-144` - source field supports all 4 types

## Root Cause Summary

| Issue | Root Cause | Location |
|-------|-----------|----------|
| **Only Linear/Sentry showing** | **observation-capture only filters GitHub/Vercel, Sentry/Linear always bypass** | observation-capture.ts:500 |
| Form control bugs out at 1 | onChange applies constraints mid-edit | search-filters.tsx:88-91 |
| Topics only show Linear | Only Linear/Sentry observations indexed to Pinecone (see above) | cluster-search.ts (symptom of data problem) |
| Seed script "filtering" | **Seed script correctly creates sync.events, but observation-capture doesn't enforce it for Sentry/Linear** | observation-capture.ts:500 |

## Recommended Diagnostics

**To identify which scenario is causing "only Linear/Sentry":**

1. Check Pinecone vector count by source:
```bash
# Via console - query observation counts
SELECT source, COUNT(*) as count
FROM lightfast_workspace_neural_observations
GROUP BY source;
```

2. Check Inngest logs for filtered events:
```bash
# Look for observation-capture runs with "event_not_allowed" or "unknown_event"
# This shows what events were skipped and why
```

3. Check if injection script was run:
```bash
# Run the inject script to populate test data
pnpm inject -- -w <workspace-id> -s sandbox-3
```

4. Check actual sourceConfig in database:
```sql
SELECT
  wi.id,
  us.sourceType,
  wi.sourceConfig
FROM workspaceIntegrations wi
JOIN userSources us ON wi.userSourceId = us.id
WHERE wi.workspaceId = '<workspace-id>';
```

## Recommended Fixes

### Fix 1: Add Linear & Sentry to UI (Short-term)
**File**: `apps/console/src/components/search-constants.ts`

```typescript
export const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "sentry", label: "Sentry" },      // Add
  { value: "linear", label: "Linear" },      // Add
] as const;
```

This lets users explicitly filter by all 4 sources even if current data only has some of them.

### Fix 2: Fix Form Control Input (Critical)
**File**: `apps/console/src/components/search-filters.tsx`

Replace the buggy onChange with:

```typescript
<Input
  type="number"
  min={1}
  max={100}
  value={limit}
  onChange={(e) => {
    // Allow any input while user is typing
    const val = e.target.value;
    // Only update if it looks like a number or empty
    if (val === "" || /^\d+$/.test(val)) {
      // Temporarily store as-is, don't constrain yet
      setTempLimit(val);
    }
  }}
  onBlur={(e) => {
    // Apply constraints when user done editing
    const value = Math.min(100, Math.max(1, parseInt(e.target.value) || 10));
    onLimitChange(value);
  }}
  className="h-9 input-no-spinner"
/>
```

Or simpler approach - just remove the onChange constraint:

```typescript
<Input
  type="number"
  min={1}
  max={100}
  value={limit}
  onChange={(e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      onLimitChange(val);
    }
  }}
  className="h-9 input-no-spinner"
/>
```

Let the HTML `min`/`max` attributes handle the validation instead of JavaScript.

### Fix 3: Verify Event Injection (Medium-term)
**Steps**:
1. Run seed-integrations script: `pnpm seed-integrations:prod -- -w <ws-id> -u <user-id>`
2. Run inject script: `pnpm inject -- -w <ws-id> -s sandbox-3`
3. Monitor Inngest logs for successful observation captures
4. Query Pinecone to verify vector indexing: `SELECT COUNT(*) FROM observations WHERE source != 'github'`

## Architecture Diagram

```
Seed Integrations Script
├─ Creates userSources + workspaceIntegrations
├─ Sets sourceConfig.sync.events for each source
└─ Does NOT create observations yet

Webhook Injection (inject script)
├─ Loads JSON webhook payloads
├─ Routes to transformers (github/linear/sentry/vercel)
├─ Creates SourceEvents
└─ Triggers Inngest observation-capture workflow

Observation Capture Workflow
├─ Step 1: Get sourceConfig.sync.events from DB
├─ Step 2: Check if event type in allowed list
├─ Step 3a: If allowed → transform & index to Pinecone
├─ Step 3b: If not allowed → skip with "event_not_allowed" reason
└─ Step 4: Pinecone indexes with metadata (source, eventType, etc)

Search Interface (apps/console)
├─ UI Filter Constants (search-constants.ts)
│  └─ Only exposes: github, vercel (missing: sentry, linear)
├─ Search Filters Component (search-filters.tsx)
│  ├─ Number input (buggy onChange)
│  └─ Source type dropdown (incomplete options)
├─ Search Query Builder (four-path-search.ts)
│  └─ Pinecone filter: { source: { $in: ["github", "vercel", ...] } }
└─ Results Display
   └─ Shows only sources that exist in Pinecone
```

## CRITICAL DISCOVERY: Observation Capture Resource ID Bug

After deep analysis of observation-capture.ts, I discovered the **actual root cause**:

### The Bug (observation-capture.ts:500)

```typescript
const metadata = sourceEvent.metadata as Record<string, unknown>;
const resourceId = metadata.repoId?.toString() || metadata.projectId?.toString();
```

**This only checks for `repoId` (GitHub) or `projectId` (Vercel).**

### How Events Are Actually Filtered

| Source | Metadata Check | Result |
|--------|---|---|
| **GitHub** | Has `repoId` ✓ | Looks up integration → Checks sync.events → **May be filtered** |
| **Vercel** | Has `projectId` ✓ | Looks up integration → Checks sync.events → **May be filtered** |
| **Sentry** | No `repoId`/`projectId` ✗ | Line 502 check fails → Returns `true` → **ALWAYS ALLOWED, sync.events IGNORED** |
| **Linear** | No `repoId`/`projectId` ✗ | Line 502 check fails → Returns `true` → **ALWAYS ALLOWED, sync.events IGNORED** |

### Why Only Linear & Sentry Show

1. Seed-integrations creates all 4 sources with proper sync.events configs
2. Inject script sends webhooks from all 4 sources
3. observation-capture processes them:
   - GitHub/Vercel: Filtered by sync.events (potentially blocked)
   - **Sentry: ALWAYS ALLOWED** (bypasses filtering)
   - **Linear: ALWAYS ALLOWED** (bypasses filtering)
4. Only Sentry and Linear observations get indexed to Pinecone
5. Search results only show Sentry and Linear

### The Real Problems

1. **observation-capture.ts Resource ID Extraction is Incomplete** (CRITICAL BUG)
   - File: `api/console/src/inngest/workflow/neural/observation-capture.ts:500`
   - Only handles GitHub (`repoId`) and Vercel (`projectId`)
   - Doesn't handle Sentry or Linear resource IDs
   - Result: Sentry/Linear events bypass sync.events filtering

2. **Form Control Input Bug** (User-facing)
   - File: `apps/console/src/components/search-filters.tsx:88-91`
   - onChange applies constraints mid-edit
   - Result: Input breaks when user deletes value

3. **UI Missing Source Options** (Secondary)
   - File: `apps/console/src/components/search-constants.ts:4-7`
   - Only shows GitHub/Vercel, not Sentry/Linear

### The Seed Script is NOT the Problem

The seed-integrations.ts script correctly creates sync.events for all 4 sources. **The bug is that observation-capture.ts doesn't use the Sentry and Linear configurations because it can't extract their resource IDs from webhook metadata.**

## Conclusion

**Fix Priority:**

1. **FIX IMMEDIATELY**: Update observation-capture.ts to extract Sentry and Linear resource IDs
   - Sentry: Extract from `organizationSlug`, `projectSlug`, or `projectId`
   - Linear: Extract from `teamId` or `organizationId`
   - Apply sync.events filtering to these sources

2. **FIX NEXT**: Form control input bug
   - Move constraint logic to onBlur instead of onChange

3. **FIX LAST**: Add Sentry/Linear to UI source options

