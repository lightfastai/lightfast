# Webhook Event Registry Unification — Implementation Plan

## Overview

Unify the three separate event type registries (`events.ts`, `event-types.ts`, `event-mapping.ts`) into a **single source of truth** in `console-types`. Every piece of metadata — labels, weights, display descriptions, external key mappings — will be defined **once** per event type. All derived data (UI display objects, mapping tables, type unions) will be auto-generated using TypeScript utility types and runtime helpers.

## Current State Analysis

Event type information is scattered across 3 files in 2 packages:

| File | Package | Concern | # Entries |
|------|---------|---------|-----------|
| `events.ts` | console-types | UI display metadata (label, description, type) | 19 categories |
| `event-types.ts` | console-types | Internal registry (label, weight, source) | 40 event types |
| `event-mapping.ts` | console-webhooks | External→internal key mapping | 40 mappings |

**Pain**: Adding a new event requires updating all 3 files. Labels are partially duplicated. Mapping tables are hand-written when they could be derived. No type-level link between the files.

### Key Discoveries:
- `events.ts` uses **external/provider** keys (`push`, `pull_request`, `Issue`) — these are category-level for UI subscription toggles
- `event-types.ts` uses **internal** keys (`github:push`, `github:pull-request.opened`) — action-level for processing
- `event-mapping.ts` bridges them with hand-written `Record<string, InternalEventType>` per provider
- UI component (`event-settings.tsx:45-46`) only uses GitHub and Vercel events currently
- `SourceEvent.sourceType` is typed as `string` for backward compat (`source-event.ts:19`)
- Scoring (`scoring.ts:83`) calls `getEventWeight()` which accepts `string` and falls back to 35

## Desired End State

**One const object** (`EVENT_REGISTRY`) defines all 40 event types with all their metadata. Everything else is derived:

```
EVENT_REGISTRY (single source of truth)
  ├── InternalEventType (union type, via keyof)
  ├── GITHUB_EVENTS / VERCEL_EVENTS / etc. (derived, for UI)
  ├── GITHUB_TO_INTERNAL / VERCEL_TO_INTERNAL / etc. (derived, for mapping)
  ├── toInternalGitHubEvent() / etc. (auto-generated lookup functions)
  ├── getEventWeight() (direct lookup)
  └── getEventConfig() (direct lookup)
```

**Verification**: After implementation:
- `pnpm typecheck` passes with no errors
- `pnpm lint` passes
- `pnpm build:console` succeeds
- All existing consumers import from the same paths (no import changes needed, or minimal)
- Adding a new event type requires editing only `EVENT_REGISTRY` in one file

## What We're NOT Doing

- **Not creating a new `console-webhooks-types` package** — keeping everything in `console-types`
- **Not changing `SourceEvent.sourceType` from `string` to `InternalEventType`** — backward compat concern stays
- **Not moving provider payload types** (Sentry/Linear inline types stay in their transformer files)
- **Not changing transformer function signatures** — transformers keep their current parameters
- **Not modifying database schemas** — `sourceType` column stays as varchar
- **Not changing the UI to per-event toggles** — keeping category-level subscription UI

## Implementation Approach

The core TypeScript trick: define each event entry with `externalKeys` (array of external format strings) and `category` metadata. Then use mapped types and runtime `Object.entries()` to generate all derived structures.

The approach is split into 3 phases:
1. Build the unified registry and all derived types/objects
2. Migrate consumers (event-mapping.ts, events.ts, UI)
3. Delete the old files and clean up

---

## Phase 1: Build the Unified Event Registry

### Overview
Create the single source of truth `EVENT_REGISTRY` in `event-types.ts`, extending it with external key mappings and category metadata. Derive all types and runtime objects from it.

### Changes Required:

#### 1. Rewrite `event-types.ts` with unified registry
**File**: `packages/console-types/src/integrations/event-types.ts`
**Changes**: Replace `INTERNAL_EVENT_TYPES` with `EVENT_REGISTRY` that includes all metadata

```typescript
/**
 * Unified Event Registry
 *
 * Single source of truth for all webhook event types.
 * Defines: internal keys, display metadata, weights, external key mappings, and UI categories.
 *
 * Format: {source}:{entity}.{action} with kebab-case
 *
 * To add a new event type: add one entry here. Everything else is auto-derived.
 */

import type { SourceType } from "@repo/console-validation";

// ─── Registry Schema ──────────────────────────────────────────────────────────

interface EventDef {
  source: SourceType;
  /** Action-level label for activity feeds (e.g., "PR Opened") */
  label: string;
  /** Base significance weight (0-100) for scoring */
  weight: number;
  /**
   * External webhook key(s) that map to this internal type.
   * These are the raw strings from provider payloads.
   *
   * GitHub: "{event}_{action}" or "{event}" (e.g., "pull_request_opened", "push")
   * Vercel: "{type}" (e.g., "deployment.created")
   * Sentry: "{eventType}" (e.g., "issue.created", "metric_alert")
   * Linear: "{Type}:{action}" (e.g., "Issue:create", "ProjectUpdate:remove")
   */
  externalKeys: readonly string[];
  /**
   * UI subscription category key (external format).
   * Multiple internal events share one category for coarse-grained UI toggles.
   * e.g., "pull_request" groups all PR events, "Issue" groups all Linear issue events.
   */
  category: string;
}

/**
 * Category display metadata for UI subscription toggles.
 * One entry per unique category per source.
 */
interface CategoryDef {
  label: string;
  description: string;
  type: "observation" | "sync+observation";
}

// ─── Category Definitions ─────────────────────────────────────────────────────

/**
 * UI category metadata per source. Keyed by the category string used in EVENT_REGISTRY.
 */
export const EVENT_CATEGORIES = {
  github: {
    push: {
      label: "Push",
      description: "Sync files and capture observations when code is pushed",
      type: "sync+observation",
    },
    pull_request: {
      label: "Pull Requests",
      description: "Capture PR opens, merges, closes, and reopens",
      type: "observation",
    },
    issues: {
      label: "Issues",
      description: "Capture issue opens, closes, and reopens",
      type: "observation",
    },
    release: {
      label: "Releases",
      description: "Capture published releases",
      type: "observation",
    },
    discussion: {
      label: "Discussions",
      description: "Capture discussion threads and answers",
      type: "observation",
    },
  },
  vercel: {
    "deployment.created": {
      label: "Deployment Started",
      description: "Capture when new deployments begin",
      type: "observation",
    },
    "deployment.succeeded": {
      label: "Deployment Succeeded",
      description: "Capture successful deployment completions",
      type: "observation",
    },
    "deployment.ready": {
      label: "Deployment Ready",
      description: "Capture when deployments are live",
      type: "observation",
    },
    "deployment.error": {
      label: "Deployment Failed",
      description: "Capture deployment failures",
      type: "observation",
    },
    "deployment.canceled": {
      label: "Deployment Canceled",
      description: "Capture canceled deployments",
      type: "observation",
    },
  },
  sentry: {
    issue: {
      label: "Issues",
      description:
        "Capture issue state changes (created, resolved, assigned, ignored)",
      type: "observation",
    },
    error: {
      label: "Errors",
      description: "Capture individual error events",
      type: "observation",
    },
    event_alert: {
      label: "Event Alerts",
      description: "Capture event alert rule triggers",
      type: "observation",
    },
    metric_alert: {
      label: "Metric Alerts",
      description: "Capture metric alert triggers and resolutions",
      type: "observation",
    },
  },
  linear: {
    Issue: {
      label: "Issues",
      description: "Capture issue creates, updates, and deletes",
      type: "observation",
    },
    Comment: {
      label: "Comments",
      description: "Capture comment activity on issues",
      type: "observation",
    },
    Project: {
      label: "Projects",
      description: "Capture project lifecycle events",
      type: "observation",
    },
    Cycle: {
      label: "Cycles",
      description: "Capture sprint/cycle lifecycle events",
      type: "observation",
    },
    ProjectUpdate: {
      label: "Project Updates",
      description: "Capture project status updates",
      type: "observation",
    },
  },
} as const satisfies Record<SourceType, Record<string, CategoryDef>>;

// ─── Event Registry ───────────────────────────────────────────────────────────

export const EVENT_REGISTRY = {
  // ── GitHub ────────────────────────────────────────────────────────────────
  "github:push": {
    source: "github",
    label: "Push",
    weight: 30,
    externalKeys: ["push"],
    category: "push",
  },
  "github:pull-request.opened": {
    source: "github",
    label: "PR Opened",
    weight: 50,
    externalKeys: ["pull_request_opened"],
    category: "pull_request",
  },
  "github:pull-request.closed": {
    source: "github",
    label: "PR Closed",
    weight: 45,
    externalKeys: ["pull_request_closed"],
    category: "pull_request",
  },
  "github:pull-request.merged": {
    source: "github",
    label: "PR Merged",
    weight: 60,
    externalKeys: ["pull_request_merged"],
    category: "pull_request",
  },
  "github:pull-request.reopened": {
    source: "github",
    label: "PR Reopened",
    weight: 40,
    externalKeys: ["pull_request_reopened"],
    category: "pull_request",
  },
  "github:pull-request.ready-for-review": {
    source: "github",
    label: "Ready for Review",
    weight: 45,
    externalKeys: ["pull_request_ready_for_review"],
    category: "pull_request",
  },
  "github:issue.opened": {
    source: "github",
    label: "Issue Opened",
    weight: 45,
    externalKeys: ["issue_opened"],
    category: "issues",
  },
  "github:issue.closed": {
    source: "github",
    label: "Issue Closed",
    weight: 40,
    externalKeys: ["issue_closed"],
    category: "issues",
  },
  "github:issue.reopened": {
    source: "github",
    label: "Issue Reopened",
    weight: 40,
    externalKeys: ["issue_reopened"],
    category: "issues",
  },
  "github:release.published": {
    source: "github",
    label: "Release Published",
    weight: 75,
    externalKeys: ["release_published"],
    category: "release",
  },
  "github:release.created": {
    source: "github",
    label: "Release Created",
    weight: 70,
    externalKeys: ["release_created"],
    category: "release",
  },
  "github:discussion.created": {
    source: "github",
    label: "Discussion Created",
    weight: 35,
    externalKeys: ["discussion_created"],
    category: "discussion",
  },
  "github:discussion.answered": {
    source: "github",
    label: "Discussion Answered",
    weight: 40,
    externalKeys: ["discussion_answered"],
    category: "discussion",
  },

  // ── Vercel ────────────────────────────────────────────────────────────────
  "vercel:deployment.created": {
    source: "vercel",
    label: "Deployment Started",
    weight: 30,
    externalKeys: ["deployment.created"],
    category: "deployment.created",
  },
  "vercel:deployment.succeeded": {
    source: "vercel",
    label: "Deployment Succeeded",
    weight: 40,
    externalKeys: ["deployment.succeeded"],
    category: "deployment.succeeded",
  },
  "vercel:deployment.ready": {
    source: "vercel",
    label: "Deployment Ready",
    weight: 40,
    externalKeys: ["deployment.ready"],
    category: "deployment.ready",
  },
  "vercel:deployment.error": {
    source: "vercel",
    label: "Deployment Failed",
    weight: 70,
    externalKeys: ["deployment.error"],
    category: "deployment.error",
  },
  "vercel:deployment.canceled": {
    source: "vercel",
    label: "Deployment Canceled",
    weight: 65,
    externalKeys: ["deployment.canceled"],
    category: "deployment.canceled",
  },

  // ── Sentry ────────────────────────────────────────────────────────────────
  "sentry:issue.created": {
    source: "sentry",
    label: "Issue Created",
    weight: 55,
    externalKeys: ["issue.created"],
    category: "issue",
  },
  "sentry:issue.resolved": {
    source: "sentry",
    label: "Issue Resolved",
    weight: 50,
    externalKeys: ["issue.resolved"],
    category: "issue",
  },
  "sentry:issue.assigned": {
    source: "sentry",
    label: "Issue Assigned",
    weight: 30,
    externalKeys: ["issue.assigned"],
    category: "issue",
  },
  "sentry:issue.ignored": {
    source: "sentry",
    label: "Issue Ignored",
    weight: 25,
    externalKeys: ["issue.ignored"],
    category: "issue",
  },
  "sentry:error": {
    source: "sentry",
    label: "Error Captured",
    weight: 45,
    externalKeys: ["error"],
    category: "error",
  },
  "sentry:event-alert": {
    source: "sentry",
    label: "Event Alert",
    weight: 65,
    externalKeys: ["event_alert"],
    category: "event_alert",
  },
  "sentry:metric-alert": {
    source: "sentry",
    label: "Metric Alert",
    weight: 70,
    externalKeys: ["metric_alert"],
    category: "metric_alert",
  },

  // ── Linear ────────────────────────────────────────────────────────────────
  "linear:issue.created": {
    source: "linear",
    label: "Issue Created",
    weight: 50,
    externalKeys: ["Issue:create"],
    category: "Issue",
  },
  "linear:issue.updated": {
    source: "linear",
    label: "Issue Updated",
    weight: 35,
    externalKeys: ["Issue:update"],
    category: "Issue",
  },
  "linear:issue.deleted": {
    source: "linear",
    label: "Issue Deleted",
    weight: 40,
    externalKeys: ["Issue:remove"],
    category: "Issue",
  },
  "linear:comment.created": {
    source: "linear",
    label: "Comment Created",
    weight: 25,
    externalKeys: ["Comment:create"],
    category: "Comment",
  },
  "linear:comment.updated": {
    source: "linear",
    label: "Comment Updated",
    weight: 20,
    externalKeys: ["Comment:update"],
    category: "Comment",
  },
  "linear:comment.deleted": {
    source: "linear",
    label: "Comment Deleted",
    weight: 20,
    externalKeys: ["Comment:remove"],
    category: "Comment",
  },
  "linear:project.created": {
    source: "linear",
    label: "Project Created",
    weight: 45,
    externalKeys: ["Project:create"],
    category: "Project",
  },
  "linear:project.updated": {
    source: "linear",
    label: "Project Updated",
    weight: 35,
    externalKeys: ["Project:update"],
    category: "Project",
  },
  "linear:project.deleted": {
    source: "linear",
    label: "Project Deleted",
    weight: 40,
    externalKeys: ["Project:remove"],
    category: "Project",
  },
  "linear:cycle.created": {
    source: "linear",
    label: "Cycle Created",
    weight: 40,
    externalKeys: ["Cycle:create"],
    category: "Cycle",
  },
  "linear:cycle.updated": {
    source: "linear",
    label: "Cycle Updated",
    weight: 30,
    externalKeys: ["Cycle:update"],
    category: "Cycle",
  },
  "linear:cycle.deleted": {
    source: "linear",
    label: "Cycle Deleted",
    weight: 35,
    externalKeys: ["Cycle:remove"],
    category: "Cycle",
  },
  "linear:project-update.created": {
    source: "linear",
    label: "Project Update",
    weight: 45,
    externalKeys: ["ProjectUpdate:create"],
    category: "ProjectUpdate",
  },
  "linear:project-update.updated": {
    source: "linear",
    label: "Project Update Edited",
    weight: 30,
    externalKeys: ["ProjectUpdate:update"],
    category: "ProjectUpdate",
  },
  "linear:project-update.deleted": {
    source: "linear",
    label: "Project Update Deleted",
    weight: 25,
    externalKeys: ["ProjectUpdate:remove"],
    category: "ProjectUpdate",
  },
} as const satisfies Record<string, EventDef>;

// ─── Derived Types ────────────────────────────────────────────────────────────

/** Union of all internal event type keys */
export type InternalEventType = keyof typeof EVENT_REGISTRY;

/** All internal event types as array */
export const ALL_INTERNAL_EVENT_TYPES = Object.keys(
  EVENT_REGISTRY
) as InternalEventType[];

// ─── Backward-Compatible Aliases ──────────────────────────────────────────────

/** @deprecated Use EVENT_REGISTRY directly */
export const INTERNAL_EVENT_TYPES = EVENT_REGISTRY;

// ─── Lookup Functions ─────────────────────────────────────────────────────────

/** Get full event config by internal type */
export function getEventConfig(
  eventType: InternalEventType
): (typeof EVENT_REGISTRY)[InternalEventType] {
  return EVENT_REGISTRY[eventType];
}

/** Get base weight for scoring. Returns 35 for unknown events. */
export function getEventWeight(eventType: string): number {
  if (!isInternalEventType(eventType)) return 35;
  return EVENT_REGISTRY[eventType].weight;
}

/** Type guard: check if string is valid internal event type */
export function isInternalEventType(
  value: string
): value is InternalEventType {
  return value in EVENT_REGISTRY;
}

// ─── Auto-Derived Mapping Tables ──────────────────────────────────────────────

/**
 * Build external→internal mapping for a given source.
 * Generated at module load from EVENT_REGISTRY.externalKeys.
 */
function buildExternalToInternalMap(
  source: SourceType
): Record<string, InternalEventType> {
  const map: Record<string, InternalEventType> = {};
  for (const [internalKey, def] of Object.entries(EVENT_REGISTRY)) {
    if (def.source === source) {
      for (const extKey of def.externalKeys) {
        map[extKey] = internalKey as InternalEventType;
      }
    }
  }
  return map;
}

/** GitHub external→internal mapping (auto-derived) */
export const GITHUB_TO_INTERNAL = buildExternalToInternalMap("github");

/** Vercel external→internal mapping (auto-derived) */
export const VERCEL_TO_INTERNAL = buildExternalToInternalMap("vercel");

/** Sentry external→internal mapping (auto-derived) */
export const SENTRY_TO_INTERNAL = buildExternalToInternalMap("sentry");

/** Linear external→internal mapping (auto-derived) */
export const LINEAR_TO_INTERNAL = buildExternalToInternalMap("linear");

/** GitHub internal→external reverse mapping (auto-derived) */
export const INTERNAL_TO_GITHUB: Record<string, string> = Object.fromEntries(
  Object.entries(GITHUB_TO_INTERNAL).map(([ext, int]) => [int, ext])
);

// ─── Auto-Derived Mapping Functions ───────────────────────────────────────────

/**
 * GitHub: external event format → internal event type.
 * @param event - GitHub event name (e.g., "pull_request")
 * @param action - GitHub action (e.g., "opened")
 */
export function toInternalGitHubEvent(
  event: string,
  action?: string
): InternalEventType | undefined {
  const key = action ? `${event}_${action}` : event;
  return GITHUB_TO_INTERNAL[key];
}

/** Vercel: event type string → internal event type */
export function toInternalVercelEvent(
  eventType: string
): InternalEventType | undefined {
  return VERCEL_TO_INTERNAL[eventType];
}

/** Sentry: event type string → internal event type */
export function toInternalSentryEvent(
  eventType: string
): InternalEventType | undefined {
  return SENTRY_TO_INTERNAL[eventType];
}

/** Linear: webhook type + action → internal event type */
export function toInternalLinearEvent(
  type: string,
  action: string
): InternalEventType | undefined {
  return LINEAR_TO_INTERNAL[`${type}:${action}`];
}

/** Reverse: internal event type → external GitHub format */
export function toExternalGitHubEvent(
  internalType: InternalEventType
): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}

// ─── Auto-Derived UI Display Events ───────────────────────────────────────────

type SourceCategories<S extends SourceType> = typeof EVENT_CATEGORIES[S];

/**
 * Get category display metadata for a source (for UI subscription toggles).
 * Returns the same shape as the old GITHUB_EVENTS, VERCEL_EVENTS, etc.
 */
export function getSourceEvents<S extends SourceType>(
  source: S
): SourceCategories<S> {
  return EVENT_CATEGORIES[source];
}

// Backward-compatible exports for existing UI consumers
export const GITHUB_EVENTS = EVENT_CATEGORIES.github;
export const VERCEL_EVENTS = EVENT_CATEGORIES.vercel;
export const SENTRY_EVENTS = EVENT_CATEGORIES.sentry;
export const LINEAR_EVENTS = EVENT_CATEGORIES.linear;

export type GitHubEvent = keyof typeof GITHUB_EVENTS;
export type VercelEvent = keyof typeof VERCEL_EVENTS;
export type SentryEvent = keyof typeof SENTRY_EVENTS;
export type LinearEvent = keyof typeof LINEAR_EVENTS;

export const ALL_GITHUB_EVENTS = Object.keys(GITHUB_EVENTS) as GitHubEvent[];
export const ALL_VERCEL_EVENTS = Object.keys(VERCEL_EVENTS) as VercelEvent[];
export const ALL_SENTRY_EVENTS = Object.keys(SENTRY_EVENTS) as SentryEvent[];
export const ALL_LINEAR_EVENTS = Object.keys(LINEAR_EVENTS) as LinearEvent[];
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] The file compiles and all types resolve correctly
- [ ] `InternalEventType` union still contains all 40 event type strings
- [ ] `GITHUB_TO_INTERNAL`, `VERCEL_TO_INTERNAL`, etc. produce identical runtime values to current hand-written tables

#### Manual Verification:
- [ ] Review that every event from the old `INTERNAL_EVENT_TYPES` exists in `EVENT_REGISTRY`
- [ ] Review that every mapping from old `event-mapping.ts` is represented by `externalKeys`
- [ ] Review that every category from old `events.ts` is represented in `EVENT_CATEGORIES`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Migrate Consumers and Delete Old Files

### Overview
Update all imports to use the unified file. Delete `events.ts` and `event-mapping.ts`. Update the barrel exports.

### Changes Required:

#### 1. Delete `events.ts`
**File**: `packages/console-types/src/integrations/events.ts`
**Changes**: Delete this file entirely. All its exports are now re-exported from `event-types.ts`.

#### 2. Delete `event-mapping.ts`
**File**: `packages/console-webhooks/src/event-mapping.ts`
**Changes**: Delete this file entirely. All mapping tables and functions are now in `event-types.ts` in `console-types`.

#### 3. Update barrel export in `console-types`
**File**: `packages/console-types/src/integrations/index.ts`
**Changes**: Remove the `events` re-export since everything is now in `event-types.ts`

```typescript
// Before:
export * from "./events";
export * from "./event-types";

// After:
export * from "./event-types";
```

#### 4. Update barrel export in `console-webhooks`
**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Remove the `event-mapping.js` re-export line

```typescript
// Remove this line:
export * from "./event-mapping.js";
```

#### 5. Update transformer imports
**Files**:
- `packages/console-webhooks/src/transformers/github.ts`
- `packages/console-webhooks/src/transformers/vercel.ts`
- `packages/console-webhooks/src/transformers/sentry.ts`
- `packages/console-webhooks/src/transformers/linear.ts`

**Changes**: Change mapping function imports from `../event-mapping.js` to `@repo/console-types`:

```typescript
// Before (in each transformer):
import { toInternalGitHubEvent } from "../event-mapping.js";

// After:
import { toInternalGitHubEvent } from "@repo/console-types";
```

Same pattern for all four providers.

#### 6. Update UI event-settings component
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/event-settings.tsx`
**Changes**: Update import path from `@repo/console-types/integrations/events` to `@repo/console-types/integrations/event-types` (or `@repo/console-types` if the barrel export works):

```typescript
// Before:
import {
  GITHUB_EVENTS,
  VERCEL_EVENTS,
  ALL_GITHUB_EVENTS,
  ALL_VERCEL_EVENTS,
} from "@repo/console-types/integrations/events";

// After:
import {
  GITHUB_EVENTS,
  VERCEL_EVENTS,
  ALL_GITHUB_EVENTS,
  ALL_VERCEL_EVENTS,
} from "@repo/console-types";
```

#### 7. Update test data transform imports
**File**: `packages/console-test-data/src/loader/transform.ts`
**Changes**: Remove the import of `VercelWebhookEventType` from `@repo/console-webhooks` if the event-mapping re-exports were the source. Verify all type imports still resolve.

#### 8. Update scoring import (if needed)
**File**: `api/console/src/inngest/workflow/neural/scoring.ts`
**Changes**: Verify `getEventWeight` import still resolves from `@repo/console-types`. This should work without changes since the function stays in the same package.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] No references to deleted files: `grep -r "event-mapping" packages/` returns nothing relevant
- [ ] No references to old events.ts: `grep -r "from.*events\"" packages/console-types/` returns nothing

#### Manual Verification:
- [ ] Event settings UI renders correctly in browser (GitHub and Vercel toggles)
- [ ] No console errors in browser dev tools

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Add Developer Documentation Comment

### Overview
Add a clear "how to add a new event" guide as a comment block in the registry file.

### Changes Required:

#### 1. Add documentation comment to `event-types.ts`
**File**: `packages/console-types/src/integrations/event-types.ts`
**Changes**: Add a JSDoc block at the top of the file:

```typescript
/**
 * Unified Event Registry — Single Source of Truth
 *
 * HOW TO ADD A NEW WEBHOOK EVENT TYPE:
 *
 * 1. Add an entry to EVENT_REGISTRY below:
 *    "source:entity.action": {
 *      source: "source",
 *      label: "Human Label",
 *      weight: 50,  // 0-100 significance
 *      externalKeys: ["external_format_key"],
 *      category: "categoryKey",
 *    }
 *
 * 2. If this is a new category, add it to EVENT_CATEGORIES[source]:
 *    categoryKey: {
 *      label: "Category Name",
 *      description: "What this category captures",
 *      type: "observation",
 *    }
 *
 * 3. Write the transformer in console-webhooks/src/transformers/{source}.ts
 *
 * That's it. Mapping tables, type unions, and UI exports are auto-derived.
 */
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking still passes: `pnpm typecheck`
- [ ] Build still passes: `pnpm build:console`

---

## Testing Strategy

### Type-Level Tests:
- Verify `InternalEventType` is a union of exactly 40 string literals
- Verify `GITHUB_TO_INTERNAL["push"]` resolves to `"github:push"` at type level
- Verify backward-compatible aliases compile correctly

### Integration Tests:
- The derived mapping tables must produce identical key→value pairs as the old hand-written tables
- Every `externalKey` must map to the correct `InternalEventType`
- `getEventWeight` returns same values for all known event types
- `getEventWeight` returns 35 for unknown strings

### Manual Testing Steps:
1. Open event settings UI, verify GitHub event toggles display correctly
2. Open event settings UI, verify Vercel event toggles display correctly
3. Trigger a test webhook and verify the transformer still assigns correct `sourceType`

## Performance Considerations

The `buildExternalToInternalMap()` function runs once at module load. It iterates over 40 entries and builds a flat lookup table — negligible cost (~0.01ms). The resulting `Record<string, InternalEventType>` has identical O(1) lookup performance as the old hand-written objects.

## Migration Notes

### Import Path Changes

| Consumer | Old Import | New Import |
|----------|-----------|------------|
| Transformers (4 files) | `from "../event-mapping.js"` | `from "@repo/console-types"` |
| UI event-settings.tsx | `from "@repo/console-types/integrations/events"` | `from "@repo/console-types"` |
| Scoring (scoring.ts) | `from "@repo/console-types"` | No change |
| Test data (transform.ts) | Verify only | Verify only |

### Backward Compatibility

- `INTERNAL_EVENT_TYPES` is aliased to `EVENT_REGISTRY` for any code that references it
- All `GITHUB_EVENTS`, `VERCEL_EVENTS`, etc. exports remain available with identical shape
- All mapping function signatures (`toInternalGitHubEvent`, etc.) remain identical
- `getEventWeight`, `getEventConfig`, `isInternalEventType` remain identical

## References

- Research: `thoughts/shared/research/2026-02-07-webhook-event-type-consolidation-analysis.md`
- Prior consolidation: commit `85b2646b` (source-prefixed key system)
- Prior research: `thoughts/shared/research/2026-02-07-webhook-transformer-event-type-fragmentation.md`
