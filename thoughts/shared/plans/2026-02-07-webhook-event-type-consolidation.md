# Webhook Event Type Consolidation Implementation Plan

## Overview

Consolidate the fragmented webhook transformer and event type system across 4 packages into a single-source-of-truth architecture. Adopt source-prefixed internal event types (`github:push`, `sentry:issue.created`, `linear:issue.created`) to resolve namespace collisions, register all Sentry/Linear event types, add event mappings, and delete duplicate transformers from `console-test-data`.

## Current State Analysis

The webhook event type system spans 4 packages with inconsistent patterns:

- **`console-types`**: `INTERNAL_EVENT_TYPES` registry with 18 event types (GitHub + Vercel only). Keys use flat `entity.action` format with no source prefix, causing collision risk.
- **`console-webhooks`**: Production transformers for all 4 sources. GitHub/Vercel use `event-mapping.ts` mapping functions. Sentry/Linear hardcode `sourceType` strings directly. Only GitHub and Vercel have mapping objects.
- **`console-test-data`**: Contains duplicate Sentry/Linear transformers that lack validation/sanitization. The loader imports GitHub/Vercel from `console-webhooks` but Sentry/Linear from local duplicates.
- **Scoring**: `getEventWeight()` returns default 35 for all Sentry/Linear events since they're unregistered.

### Key Discoveries:
- `INTERNAL_EVENT_TYPES` at `packages/console-types/src/integrations/event-types.ts:25-87` — only 18 entries (13 GitHub + 5 Vercel)
- `event-mapping.ts` at `packages/console-webhooks/src/event-mapping.ts:12-47` — only `GITHUB_TO_INTERNAL` and `VERCEL_TO_INTERNAL`
- Sentry transformers hardcode `sourceType` at `sentry.ts:322,406,475,531`
- Linear transformers hardcode `sourceType` at `linear.ts:459,545,634,722,793`
- GitHub transformers use `toInternalGitHubEvent()` at `github.ts:72,211,303,368,438`
- `getEventWeight()` consumed at `api/console/src/inngest/workflow/neural/scoring.ts:83`
- `console-test-data/src/loader/transform.ts:27-29` — imports Sentry/Linear from local `../transformers/`

## Desired End State

After this plan is complete:

1. All `INTERNAL_EVENT_TYPES` keys use `source:entity.action` format (e.g., `github:push`, `sentry:issue.created`)
2. All 4 sources (GitHub, Vercel, Sentry, Linear) have registered event types with appropriate weights
3. All 4 sources have mapping objects in `event-mapping.ts` with `toInternal*Event()` functions
4. All transformers use mapping functions instead of hardcoding `sourceType`
5. Duplicate Sentry/Linear transformers deleted from `console-test-data`
6. Display metadata (`SENTRY_EVENTS`, `LINEAR_EVENTS`) added to `events.ts`
7. `getEventWeight()` returns meaningful weights for Sentry/Linear events
8. `isInternalEventType()` returns true for Sentry/Linear event types

### Verification:
- `pnpm typecheck` passes (no `InternalEventType` assignment errors)
- `pnpm lint` passes
- `pnpm build:console` succeeds
- Sentry/Linear event types return correct weights from `getEventWeight()`
- `isInternalEventType("sentry:issue.created")` returns `true`

## What We're NOT Doing

- **Backfill connectors for Sentry/Linear** — out of scope, existing GitHub/Vercel backfill is unaffected
- **Production webhook route handlers for Linear/Sentry** — separate future work
- **Changes to `console-validation`** — `SourceType` already includes all 4 sources
- **Database schema changes** — `sourceType` is stored as `string`, no migration needed
- **Changing the `SourceEvent.sourceType` field type** — remains `string` for backwards compatibility

## Implementation Approach

Three phases, each independently verifiable. Phase 1 updates the type registry and mappings (the "foundation"). Phase 2 updates all transformers to use the new mappings. Phase 3 deletes the duplicate code.

The source-prefix format `source:entity.action` was chosen because:
- Resolves `issue.created` collision between GitHub/Sentry/Linear
- Follows the Svix industry standard pattern
- Colon separator distinguishes source prefix from dot-separated entity.action
- Allows filtering by source prefix (`startsWith("sentry:")`)

---

## Phase 1: Source-Prefix the Registry and Add Event Mappings

### Overview
Update `INTERNAL_EVENT_TYPES` to use source-prefixed keys, add Sentry/Linear event types, add mapping objects, and add display metadata.

### Changes Required:

#### 1. Update INTERNAL_EVENT_TYPES registry
**File**: `packages/console-types/src/integrations/event-types.ts`
**Changes**: Rename all 18 existing keys with `github:`/`vercel:` prefixes. Add 7 Sentry and 15 Linear event types.

```typescript
export const INTERNAL_EVENT_TYPES = {
  // GitHub events
  "github:push": { source: "github", label: "Push", weight: 30 },
  "github:pull-request.opened": { source: "github", label: "PR Opened", weight: 50 },
  "github:pull-request.closed": { source: "github", label: "PR Closed", weight: 45 },
  "github:pull-request.merged": { source: "github", label: "PR Merged", weight: 60 },
  "github:pull-request.reopened": {
    source: "github",
    label: "PR Reopened",
    weight: 40,
  },
  "github:pull-request.ready-for-review": {
    source: "github",
    label: "Ready for Review",
    weight: 45,
  },
  "github:issue.opened": { source: "github", label: "Issue Opened", weight: 45 },
  "github:issue.closed": { source: "github", label: "Issue Closed", weight: 40 },
  "github:issue.reopened": { source: "github", label: "Issue Reopened", weight: 40 },
  "github:release.published": {
    source: "github",
    label: "Release Published",
    weight: 75,
  },
  "github:release.created": { source: "github", label: "Release Created", weight: 70 },
  "github:discussion.created": {
    source: "github",
    label: "Discussion Created",
    weight: 35,
  },
  "github:discussion.answered": {
    source: "github",
    label: "Discussion Answered",
    weight: 40,
  },

  // Vercel events
  "vercel:deployment.created": {
    source: "vercel",
    label: "Deployment Started",
    weight: 30,
  },
  "vercel:deployment.succeeded": {
    source: "vercel",
    label: "Deployment Succeeded",
    weight: 40,
  },
  "vercel:deployment.ready": {
    source: "vercel",
    label: "Deployment Ready",
    weight: 40,
  },
  "vercel:deployment.error": {
    source: "vercel",
    label: "Deployment Failed",
    weight: 70,
  },
  "vercel:deployment.canceled": {
    source: "vercel",
    label: "Deployment Canceled",
    weight: 65,
  },

  // Sentry events
  "sentry:issue.created": { source: "sentry", label: "Issue Created", weight: 55 },
  "sentry:issue.resolved": { source: "sentry", label: "Issue Resolved", weight: 50 },
  "sentry:issue.assigned": { source: "sentry", label: "Issue Assigned", weight: 30 },
  "sentry:issue.ignored": { source: "sentry", label: "Issue Ignored", weight: 25 },
  "sentry:error": { source: "sentry", label: "Error Captured", weight: 45 },
  "sentry:event-alert": { source: "sentry", label: "Event Alert", weight: 65 },
  "sentry:metric-alert": { source: "sentry", label: "Metric Alert", weight: 70 },

  // Linear events
  "linear:issue.created": { source: "linear", label: "Issue Created", weight: 50 },
  "linear:issue.updated": { source: "linear", label: "Issue Updated", weight: 35 },
  "linear:issue.deleted": { source: "linear", label: "Issue Deleted", weight: 40 },
  "linear:comment.created": { source: "linear", label: "Comment Created", weight: 25 },
  "linear:comment.updated": { source: "linear", label: "Comment Updated", weight: 20 },
  "linear:comment.deleted": { source: "linear", label: "Comment Deleted", weight: 20 },
  "linear:project.created": { source: "linear", label: "Project Created", weight: 45 },
  "linear:project.updated": { source: "linear", label: "Project Updated", weight: 35 },
  "linear:project.deleted": { source: "linear", label: "Project Deleted", weight: 40 },
  "linear:cycle.created": { source: "linear", label: "Cycle Created", weight: 40 },
  "linear:cycle.updated": { source: "linear", label: "Cycle Updated", weight: 30 },
  "linear:cycle.deleted": { source: "linear", label: "Cycle Deleted", weight: 35 },
  "linear:project-update.created": {
    source: "linear",
    label: "Project Update",
    weight: 45,
  },
  "linear:project-update.updated": {
    source: "linear",
    label: "Project Update Edited",
    weight: 30,
  },
  "linear:project-update.deleted": {
    source: "linear",
    label: "Project Update Deleted",
    weight: 25,
  },
} as const satisfies Record<string, EventTypeConfig>;
```

**Weight rationale for Sentry:**
- `issue.created` (55): New error group = significant, slightly above GitHub issue
- `issue.resolved` (50): Resolution is meaningful progress
- `issue.assigned` (30): Routine triage
- `issue.ignored` (25): Low-signal action
- `error` (45): Individual errors are medium significance
- `event-alert` (65): Alert triggers indicate important threshold breaches
- `metric-alert` (70): Performance alerts are high-impact, similar to deployment errors

**Weight rationale for Linear:**
- `issue.created` (50): New work item, same as GitHub PR opened
- `issue.updated` (35): Routine status changes
- `issue.deleted` (40): Slightly notable
- `comment.*` (20-25): Low signal, discussion noise
- `project.created` (45): New project is meaningful
- `project.updated` (35): Routine
- `project.deleted` (40): Notable
- `cycle.created` (40): Sprint planning
- `cycle.updated` (30): Routine progress
- `cycle.deleted` (35): Notable
- `project-update.created` (45): Status reports are meaningful
- `project-update.updated/deleted` (25-30): Edits are low signal

**Note on Sentry `sourceType` normalization**: The current Sentry transformers produce `event_alert` and `metric_alert` (with underscores). In the new registry these become `sentry:event-alert` and `sentry:metric-alert` (kebab-case) to match the codebase convention. The mapping layer handles this transformation.

#### 2. Add display metadata for Sentry and Linear
**File**: `packages/console-types/src/integrations/events.ts`
**Changes**: Add `SENTRY_EVENTS` and `LINEAR_EVENTS` following the existing pattern. Add derived types and arrays.

```typescript
// After VERCEL_EVENTS...

export const SENTRY_EVENTS = {
  issue: {
    label: "Issues",
    description: "Capture issue state changes (created, resolved, assigned, ignored)",
    type: "observation" as const,
  },
  error: {
    label: "Errors",
    description: "Capture individual error events",
    type: "observation" as const,
  },
  event_alert: {
    label: "Event Alerts",
    description: "Capture event alert rule triggers",
    type: "observation" as const,
  },
  metric_alert: {
    label: "Metric Alerts",
    description: "Capture metric alert triggers and resolutions",
    type: "observation" as const,
  },
} as const;

export const LINEAR_EVENTS = {
  Issue: {
    label: "Issues",
    description: "Capture issue creates, updates, and deletes",
    type: "observation" as const,
  },
  Comment: {
    label: "Comments",
    description: "Capture comment activity on issues",
    type: "observation" as const,
  },
  Project: {
    label: "Projects",
    description: "Capture project lifecycle events",
    type: "observation" as const,
  },
  Cycle: {
    label: "Cycles",
    description: "Capture sprint/cycle lifecycle events",
    type: "observation" as const,
  },
  ProjectUpdate: {
    label: "Project Updates",
    description: "Capture project status updates",
    type: "observation" as const,
  },
} as const;

// After existing type/array exports...
export type SentryEvent = keyof typeof SENTRY_EVENTS;
export type LinearEvent = keyof typeof LINEAR_EVENTS;

export const ALL_SENTRY_EVENTS = Object.keys(SENTRY_EVENTS) as SentryEvent[];
export const ALL_LINEAR_EVENTS = Object.keys(LINEAR_EVENTS) as LinearEvent[];
```

#### 3. Update event-mapping.ts with source-prefixed values and new mappings
**File**: `packages/console-webhooks/src/event-mapping.ts`
**Changes**: Update `GITHUB_TO_INTERNAL` and `VERCEL_TO_INTERNAL` values to use prefixed keys. Add `SENTRY_TO_INTERNAL` and `LINEAR_TO_INTERNAL` mappings with `toInternalSentryEvent()` and `toInternalLinearEvent()` functions.

Replace the entire file:

```typescript
/**
 * Bidirectional mapping between external webhook formats and internal event types.
 *
 * Internal format: {source}:{entity}.{action} (e.g., "github:pull-request.opened")
 * All event names use hyphens (kebab-case), not underscores.
 */

import type { InternalEventType } from "@repo/console-types";

/**
 * GitHub external format to internal format mapping.
 * External format: {event}_{action} (e.g., "pull_request_opened")
 * Internal format: github:{event}.{action} with hyphens (e.g., "github:pull-request.opened")
 */
export const GITHUB_TO_INTERNAL: Record<string, InternalEventType> = {
  // Push (no action)
  push: "github:push",

  // Pull requests
  pull_request_opened: "github:pull-request.opened",
  pull_request_closed: "github:pull-request.closed",
  pull_request_merged: "github:pull-request.merged",
  pull_request_reopened: "github:pull-request.reopened",
  pull_request_ready_for_review: "github:pull-request.ready-for-review",

  // Issues
  issue_opened: "github:issue.opened",
  issue_closed: "github:issue.closed",
  issue_reopened: "github:issue.reopened",

  // Releases
  release_published: "github:release.published",
  release_created: "github:release.created",

  // Discussions
  discussion_created: "github:discussion.created",
  discussion_answered: "github:discussion.answered",
};

/**
 * Vercel events are already in dot notation.
 * This mapping adds the source prefix and validates.
 */
export const VERCEL_TO_INTERNAL: Record<string, InternalEventType> = {
  "deployment.created": "vercel:deployment.created",
  "deployment.succeeded": "vercel:deployment.succeeded",
  "deployment.ready": "vercel:deployment.ready",
  "deployment.error": "vercel:deployment.error",
  "deployment.canceled": "vercel:deployment.canceled",
};

/**
 * Sentry external format to internal format mapping.
 * External format: "{eventType}" from SentryEventType (e.g., "issue.created", "error")
 * Internal format: sentry:{entity}.{action} (e.g., "sentry:issue.created", "sentry:error")
 *
 * Note: event_alert/metric_alert (underscores) are normalized to kebab-case.
 */
export const SENTRY_TO_INTERNAL: Record<string, InternalEventType> = {
  "issue.created": "sentry:issue.created",
  "issue.resolved": "sentry:issue.resolved",
  "issue.assigned": "sentry:issue.assigned",
  "issue.ignored": "sentry:issue.ignored",
  error: "sentry:error",
  event_alert: "sentry:event-alert",
  metric_alert: "sentry:metric-alert",
};

/**
 * Linear external format to internal format mapping.
 * External format: "{Type}:{action}" (e.g., "Issue:create")
 * Internal format: linear:{entity}.{action} (e.g., "linear:issue.created")
 *
 * Linear actions are normalized: create→created, update→updated, remove→deleted
 */
export const LINEAR_TO_INTERNAL: Record<string, InternalEventType> = {
  "Issue:create": "linear:issue.created",
  "Issue:update": "linear:issue.updated",
  "Issue:remove": "linear:issue.deleted",
  "Comment:create": "linear:comment.created",
  "Comment:update": "linear:comment.updated",
  "Comment:remove": "linear:comment.deleted",
  "Project:create": "linear:project.created",
  "Project:update": "linear:project.updated",
  "Project:remove": "linear:project.deleted",
  "Cycle:create": "linear:cycle.created",
  "Cycle:update": "linear:cycle.updated",
  "Cycle:remove": "linear:cycle.deleted",
  "ProjectUpdate:create": "linear:project-update.created",
  "ProjectUpdate:update": "linear:project-update.updated",
  "ProjectUpdate:remove": "linear:project-update.deleted",
};

/**
 * Convert GitHub external event format to internal format.
 *
 * @param event - GitHub event name (e.g., "pull_request")
 * @param action - GitHub action (e.g., "opened")
 * @returns Internal event type or undefined if not mapped
 *
 * @example
 * toInternalGitHubEvent("pull_request", "opened") // "github:pull-request.opened"
 * toInternalGitHubEvent("push") // "github:push"
 */
export function toInternalGitHubEvent(
  event: string,
  action?: string
): InternalEventType | undefined {
  const externalKey = action ? `${event}_${action}` : event;
  return GITHUB_TO_INTERNAL[externalKey];
}

/**
 * Convert Vercel event type to internal format.
 * Vercel events are already in dot notation, this adds source prefix and validates.
 *
 * @param eventType - Vercel event type (e.g., "deployment.succeeded")
 * @returns Internal event type or undefined if not mapped
 */
export function toInternalVercelEvent(
  eventType: string
): InternalEventType | undefined {
  return VERCEL_TO_INTERNAL[eventType];
}

/**
 * Convert Sentry event type to internal format.
 *
 * @param eventType - Sentry event type (e.g., "issue.created", "error", "metric_alert")
 * @returns Internal event type or undefined if not mapped
 *
 * @example
 * toInternalSentryEvent("issue.created") // "sentry:issue.created"
 * toInternalSentryEvent("metric_alert") // "sentry:metric-alert"
 */
export function toInternalSentryEvent(
  eventType: string
): InternalEventType | undefined {
  return SENTRY_TO_INTERNAL[eventType];
}

/**
 * Convert Linear webhook type and action to internal format.
 *
 * @param type - Linear webhook type (e.g., "Issue", "Comment")
 * @param action - Linear action (e.g., "create", "update", "remove")
 * @returns Internal event type or undefined if not mapped
 *
 * @example
 * toInternalLinearEvent("Issue", "create") // "linear:issue.created"
 * toInternalLinearEvent("ProjectUpdate", "remove") // "linear:project-update.deleted"
 */
export function toInternalLinearEvent(
  type: string,
  action: string
): InternalEventType | undefined {
  const key = `${type}:${action}`;
  return LINEAR_TO_INTERNAL[key];
}

/**
 * Internal format to external format mapping (for logging/debugging).
 */
export const INTERNAL_TO_GITHUB: Record<string, string> = Object.fromEntries(
  Object.entries(GITHUB_TO_INTERNAL).map(([ext, int]) => [int, ext])
);

/**
 * Convert internal event type to external GitHub format.
 * Useful for logging and debugging.
 */
export function toExternalGitHubEvent(
  internalType: InternalEventType
): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:console`
- [x] All `Record<string, InternalEventType>` type annotations in `event-mapping.ts` compile without errors (validates all mapping values exist in `INTERNAL_EVENT_TYPES`)

#### Manual Verification:
- [ ] Verify `INTERNAL_EVENT_TYPES` has 40 entries total (13 GitHub + 5 Vercel + 7 Sentry + 15 Linear)
- [ ] Verify all mapping values in `GITHUB_TO_INTERNAL`, `VERCEL_TO_INTERNAL`, `SENTRY_TO_INTERNAL`, `LINEAR_TO_INTERNAL` are valid `InternalEventType` keys (TypeScript enforces this)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Update Transformers to Use Mapping Functions

### Overview
Update all transformer files to use the mapping functions from `event-mapping.ts` instead of hardcoding `sourceType` strings. This ensures all `sourceType` values go through the canonical mapping layer.

### Changes Required:

#### 1. Update GitHub transformers
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Changes**: The fallback strings need `github:` prefix to match the new format.

Line 72 — change fallback:
```typescript
// Before:
sourceType: toInternalGitHubEvent("push") ?? "push",
// After:
sourceType: toInternalGitHubEvent("push") ?? "github:push",
```

Line 211 — change fallback:
```typescript
// Before:
sourceType: internalType ?? `pull-request.${effectiveAction}`,
// After:
sourceType: internalType ?? `github:pull-request.${effectiveAction}`,
```

Line 303 — change fallback:
```typescript
// Before:
sourceType: internalType ?? `issue.${payload.action}`,
// After:
sourceType: internalType ?? `github:issue.${payload.action}`,
```

Line 368 — change fallback:
```typescript
// Before:
sourceType: internalType ?? `release.${payload.action}`,
// After:
sourceType: internalType ?? `github:release.${payload.action}`,
```

Line 438 — change fallback:
```typescript
// Before:
sourceType: internalType ?? `discussion.${payload.action}`,
// After:
sourceType: internalType ?? `github:discussion.${payload.action}`,
```

#### 2. Update Vercel transformer
**File**: `packages/console-webhooks/src/transformers/vercel.ts`
**Changes**: Update fallback string at line 116.

```typescript
// Before:
sourceType: internalType ?? eventType,
// After:
sourceType: internalType ?? `vercel:${eventType}`,
```

#### 3. Update Sentry transformers
**File**: `packages/console-webhooks/src/transformers/sentry.ts`
**Changes**: Add import for `toInternalSentryEvent`, update all `sourceType` assignments to use the mapping function.

Add import after line 16:
```typescript
import { toInternalSentryEvent } from "../event-mapping.js";
```

Line 322 — update `transformSentryIssue`:
```typescript
// Before:
sourceType: `issue.${payload.action}`,
// After:
sourceType: toInternalSentryEvent(`issue.${payload.action}`) ?? `sentry:issue.${payload.action}`,
```

Line 406 — update `transformSentryError`:
```typescript
// Before:
sourceType: "error",
// After:
sourceType: toInternalSentryEvent("error") ?? "sentry:error",
```

Line 475 — update `transformSentryEventAlert`:
```typescript
// Before:
sourceType: "event_alert",
// After:
sourceType: toInternalSentryEvent("event_alert") ?? "sentry:event-alert",
```

Line 531 — update `transformSentryMetricAlert`:
```typescript
// Before:
sourceType: "metric_alert",
// After:
sourceType: toInternalSentryEvent("metric_alert") ?? "sentry:metric-alert",
```

#### 4. Update Linear transformers
**File**: `packages/console-webhooks/src/transformers/linear.ts`
**Changes**: Add import for `toInternalLinearEvent`, update all `sourceType` assignments to use the mapping function.

Add import after line 16:
```typescript
import { toInternalLinearEvent } from "../event-mapping.js";
```

Line 459 — update `transformLinearIssue`:
```typescript
// Before:
sourceType: `issue.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
// After:
sourceType: toInternalLinearEvent("Issue", payload.action) ?? `linear:issue.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
```

Line 545 — update `transformLinearComment`:
```typescript
// Before:
sourceType: `comment.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
// After:
sourceType: toInternalLinearEvent("Comment", payload.action) ?? `linear:comment.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
```

Line 634 — update `transformLinearProject`:
```typescript
// Before:
sourceType: `project.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
// After:
sourceType: toInternalLinearEvent("Project", payload.action) ?? `linear:project.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
```

Line 722 — update `transformLinearCycle`:
```typescript
// Before:
sourceType: `cycle.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
// After:
sourceType: toInternalLinearEvent("Cycle", payload.action) ?? `linear:cycle.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
```

Line 793 — update `transformLinearProjectUpdate`:
```typescript
// Before:
sourceType: `project-update.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
// After:
sourceType: toInternalLinearEvent("ProjectUpdate", payload.action) ?? `linear:project-update.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Verify all transformer `sourceType` values now go through `toInternal*Event()` functions
- [ ] Verify fallback strings all have the `source:` prefix

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Delete Duplicate Transformers

### Overview
Delete the duplicate Sentry/Linear transformers from `console-test-data` and update the loader to import from `@repo/console-webhooks/transformers`.

### Changes Required:

#### 1. Delete duplicate files
**Delete** the following files:
- `packages/console-test-data/src/transformers/sentry.ts`
- `packages/console-test-data/src/transformers/linear.ts`
- `packages/console-test-data/src/transformers/index.ts`

#### 2. Update test data loader imports
**File**: `packages/console-test-data/src/loader/transform.ts`
**Changes**: Replace local transformer imports with `@repo/console-webhooks/transformers`.

Replace lines 27-29:
```typescript
// Before:
import { sentryTransformers, linearTransformers } from "../transformers/index.js";
import type { SentryEventType } from "../transformers/sentry.js";
import type { LinearWebhookType } from "../transformers/linear.js";

// After:
import {
  sentryTransformers,
  linearTransformers,
} from "@repo/console-webhooks/transformers";
import type { SentryEventType } from "@repo/console-webhooks/transformers";
import type { LinearWebhookType } from "@repo/console-webhooks/transformers";
```

Note: `SentryEventType` is exported from `packages/console-webhooks/src/transformers/sentry.ts:220` and `LinearWebhookType` is exported from `packages/console-webhooks/src/transformers/linear.ts:40`. Both are re-exported via `packages/console-webhooks/src/transformers/index.ts`.

#### 3. Remove transformers directory if empty
After deleting the three files, check if the `packages/console-test-data/src/transformers/` directory is empty and delete it if so.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:console`
- [x] No remaining imports from `../transformers/` in console-test-data: `grep -r "../transformers" packages/console-test-data/src/`

#### Manual Verification:
- [ ] Verify `packages/console-test-data/src/transformers/` directory no longer exists
- [ ] Verify test data loading still works correctly (types match, no runtime errors)

---

## Testing Strategy

### Type-Level Tests:
- TypeScript compilation is the primary test — `Record<string, InternalEventType>` typing on all mapping objects ensures every mapping value is a valid registry key
- If any mapping value doesn't exist in `INTERNAL_EVENT_TYPES`, `pnpm typecheck` will fail

### Integration Verification:
- `pnpm build:console` exercises all packages in dependency order
- The scoring pipeline at `scoring.ts:83` will automatically pick up new weights since `getEventWeight()` does a runtime lookup

### Regression Check:
- GitHub/Vercel transformers still use the same mapping functions, just with updated values
- The `SourceEvent.sourceType` field is typed as `string`, so changing from `"push"` to `"github:push"` doesn't break any type contracts
- The `sourceEventSchema` Zod validation uses `z.string().min(1)` — no enum constraint, so new prefixed strings pass

## Performance Considerations

None. The mapping objects are const lookups (O(1)). Adding more entries to `INTERNAL_EVENT_TYPES` has negligible performance impact. The `getEventWeight()` function is already called once per event.

## Migration Notes

- **Stored data**: Any `sourceType` values already stored in the database will still have the old format (e.g., `"push"` instead of `"github:push"`). The `getEventWeight()` function returns 35 for unknown types, so old format strings will get the default weight. This is acceptable since `sourceType` is informational and not used as a join key.
- **No database migration needed**: `sourceType` is stored as a string column, no enum constraint.

## References

- Research document: `thoughts/shared/research/2026-02-07-webhook-transformer-event-type-fragmentation.md`
- Definitive Links plan: `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md`
- Event types registry: `packages/console-types/src/integrations/event-types.ts:25-87`
- Event mapping: `packages/console-webhooks/src/event-mapping.ts:12-47`
- Scoring consumer: `api/console/src/inngest/workflow/neural/scoring.ts:83`
- Test data loader: `packages/console-test-data/src/loader/transform.ts:27-29`
