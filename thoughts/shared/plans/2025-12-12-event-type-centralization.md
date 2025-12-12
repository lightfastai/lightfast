# Event Type System Centralization Plan

## Overview

Centralize and type-safe the event type system across the codebase. This involves:
1. Creating typed internal event format with `<event-name>.<action>` convention
2. Building bidirectional mapping between external webhook formats and internal format
3. Centralizing provider literals (`"github" | "vercel"`) from scattered inline usages

## Current State Analysis

### Event Naming Conventions (Before)
| Source | External Format | Internal Format (Current) |
|--------|-----------------|---------------------------|
| GitHub | `x-github-event: pull_request` + `action: opened` | `pull_request_opened` |
| GitHub | `x-github-event: release` + `action: published` | `release_published` |
| GitHub | `x-github-event: push` (no action) | `push` |
| Vercel | `type: deployment.succeeded` | `deployment.succeeded` |

### Event Naming Conventions (After)
| Source | External Format | Internal Format (New) |
|--------|-----------------|----------------------|
| GitHub | `pull_request` + `opened` | `pull-request.opened` |
| GitHub | `release` + `published` | `release.published` |
| GitHub | `push` (no action) | `push` |
| Vercel | `deployment.succeeded` | `deployment.succeeded` |

### Key Discovery: Mixed Naming
- `EVENT_TYPE_WEIGHTS` at `api/console/src/inngest/workflow/neural/scoring.ts:37-61` uses both conventions
- `SourceEvent.sourceType` at `packages/console-types/src/neural/source-event.ts:8` is typed as `string`
- No compile-time validation of event types

### Provider Literals Scope
- **Central definitions**: 2 locations
  - `packages/console-validation/src/schemas/sources.ts:19-22` - `integrationProviderSchema`
  - `packages/console-types/src/neural/source-event.ts:7` - SourceEvent.source
- **Inline usages**: ~100+ across 21 non-test files
- **Extended scope**: SourceEvent.source includes `"linear" | "sentry"` for future providers

## Desired End State

### 1. Typed Event System
```typescript
// packages/console-types/src/integrations/event-types.ts

// Internal event format (dot.notation with hyphens)
export const INTERNAL_EVENT_TYPES = {
  // GitHub events
  "push": { source: "github", label: "Push" },
  "pull-request.opened": { source: "github", label: "PR Opened" },
  "pull-request.closed": { source: "github", label: "PR Closed" },
  "pull-request.merged": { source: "github", label: "PR Merged" },
  "pull-request.reopened": { source: "github", label: "PR Reopened" },
  "issue.opened": { source: "github", label: "Issue Opened" },
  "issue.closed": { source: "github", label: "Issue Closed" },
  "issue.reopened": { source: "github", label: "Issue Reopened" },
  "release.published": { source: "github", label: "Release Published" },
  "release.created": { source: "github", label: "Release Created" },
  "discussion.created": { source: "github", label: "Discussion Created" },
  "discussion.answered": { source: "github", label: "Discussion Answered" },

  // Vercel events (already in dot notation)
  "deployment.created": { source: "vercel", label: "Deployment Started" },
  "deployment.succeeded": { source: "vercel", label: "Deployment Succeeded" },
  "deployment.ready": { source: "vercel", label: "Deployment Ready" },
  "deployment.error": { source: "vercel", label: "Deployment Failed" },
  "deployment.canceled": { source: "vercel", label: "Deployment Canceled" },
} as const;

export type InternalEventType = keyof typeof INTERNAL_EVENT_TYPES;
```

### 2. Bidirectional Mapping
```typescript
// Mapping from external format to internal
export const GITHUB_TO_INTERNAL: Record<string, InternalEventType> = {
  "push": "push",
  "pull_request_opened": "pull-request.opened",
  "pull_request_closed": "pull-request.closed",
  "pull_request_merged": "pull-request.merged",
  // ...
};

// Mapping from internal to external (for debugging/logging)
export const INTERNAL_TO_EXTERNAL: Record<InternalEventType, string> = {
  "push": "push",
  "pull-request.opened": "pull_request_opened",
  // ...
};
```

### 3. Centralized Provider Schema
```typescript
// packages/console-validation/src/schemas/sources.ts

// Current providers (OAuth integrations)
export const integrationProviderSchema = z.enum(["github", "vercel"]);

// Extended providers (neural pipeline - includes future sources)
export const sourceEventProviderSchema = z.enum([
  "github",
  "vercel",
  "linear",
  "sentry"
]);
```

### Verification
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm lint` passes with no new warnings
- [ ] All event types in `EVENT_TYPE_WEIGHTS` use internal format
- [ ] `SourceEvent.sourceType` is typed as `InternalEventType`
- [ ] All 21 files import provider literals from central schema
- [ ] Existing webhook handlers continue to work (transformation happens at boundary)

## What We're NOT Doing

1. **Not changing database stored values** - Events already stored remain unchanged
2. **Not modifying Vercel event names** - They already use dot notation
3. **Not breaking external API contracts** - Transformation happens internally
4. **Not adding new providers** - Just centralizing existing definitions
5. **Not refactoring UI components** - Only updating type imports

## Implementation Approach

**Strategy**: Transform at the boundary, store internal format.

1. Webhook handlers receive external format
2. Transformers convert to internal format before creating SourceEvent
3. All internal code uses typed internal format
4. Scoring, filtering, and storage use internal format

## Phase 1: Create Type Definitions

### Overview
Create the typed event system with internal format definitions and bidirectional mapping utilities.

### Changes Required:

#### 1. Create Event Type Definitions
**File**: `packages/console-types/src/integrations/event-types.ts` (new file)

```typescript
/**
 * Internal Event Type System
 *
 * Standardized event format using <event-name>.<action> convention.
 * All event names use hyphens (kebab-case), not underscores.
 *
 * External formats (from webhooks) are mapped to internal format at the boundary.
 */

import type { IntegrationProvider } from "@repo/console-validation";

/**
 * Internal event type configuration
 */
interface EventTypeConfig {
  source: IntegrationProvider | "linear" | "sentry";
  label: string;
  weight: number; // Base significance weight (0-100)
}

/**
 * All supported internal event types.
 * Source of truth for event type validation and scoring.
 */
export const INTERNAL_EVENT_TYPES = {
  // GitHub events
  "push": { source: "github", label: "Push", weight: 30 },
  "pull-request.opened": { source: "github", label: "PR Opened", weight: 50 },
  "pull-request.closed": { source: "github", label: "PR Closed", weight: 45 },
  "pull-request.merged": { source: "github", label: "PR Merged", weight: 60 },
  "pull-request.reopened": { source: "github", label: "PR Reopened", weight: 40 },
  "pull-request.ready-for-review": { source: "github", label: "Ready for Review", weight: 45 },
  "issue.opened": { source: "github", label: "Issue Opened", weight: 45 },
  "issue.closed": { source: "github", label: "Issue Closed", weight: 40 },
  "issue.reopened": { source: "github", label: "Issue Reopened", weight: 40 },
  "release.published": { source: "github", label: "Release Published", weight: 75 },
  "release.created": { source: "github", label: "Release Created", weight: 70 },
  "discussion.created": { source: "github", label: "Discussion Created", weight: 35 },
  "discussion.answered": { source: "github", label: "Discussion Answered", weight: 40 },

  // Vercel events (already in dot notation)
  "deployment.created": { source: "vercel", label: "Deployment Started", weight: 30 },
  "deployment.succeeded": { source: "vercel", label: "Deployment Succeeded", weight: 40 },
  "deployment.ready": { source: "vercel", label: "Deployment Ready", weight: 40 },
  "deployment.error": { source: "vercel", label: "Deployment Failed", weight: 70 },
  "deployment.canceled": { source: "vercel", label: "Deployment Canceled", weight: 65 },
} as const satisfies Record<string, EventTypeConfig>;

/**
 * Internal event type union derived from const object
 */
export type InternalEventType = keyof typeof INTERNAL_EVENT_TYPES;

/**
 * All internal event types as array (for iteration)
 */
export const ALL_INTERNAL_EVENT_TYPES = Object.keys(INTERNAL_EVENT_TYPES) as InternalEventType[];

/**
 * Get event config by internal type
 */
export function getEventConfig(eventType: InternalEventType): EventTypeConfig {
  return INTERNAL_EVENT_TYPES[eventType];
}

/**
 * Get base weight for event type (for scoring)
 */
export function getEventWeight(eventType: string): number {
  const config = INTERNAL_EVENT_TYPES[eventType as InternalEventType];
  return config?.weight ?? 35; // Default weight for unknown events
}

/**
 * Check if string is valid internal event type
 */
export function isInternalEventType(value: string): value is InternalEventType {
  return value in INTERNAL_EVENT_TYPES;
}
```

#### 2. Create Event Mapping Utilities
**File**: `packages/console-webhooks/src/event-mapping.ts` (new file)

```typescript
/**
 * Bidirectional mapping between external webhook formats and internal event types.
 */

import type { InternalEventType } from "@repo/console-types";

/**
 * GitHub external format to internal format mapping.
 * External format: {event}_{action} (e.g., "pull_request_opened")
 * Internal format: {event}.{action} with hyphens (e.g., "pull-request.opened")
 */
export const GITHUB_TO_INTERNAL: Record<string, InternalEventType> = {
  // Push (no action)
  "push": "push",

  // Pull requests
  "pull_request_opened": "pull-request.opened",
  "pull_request_closed": "pull-request.closed",
  "pull_request_merged": "pull-request.merged",
  "pull_request_reopened": "pull-request.reopened",
  "pull_request_ready_for_review": "pull-request.ready-for-review",

  // Issues
  "issue_opened": "issue.opened",
  "issue_closed": "issue.closed",
  "issue_reopened": "issue.reopened",

  // Releases
  "release_published": "release.published",
  "release_created": "release.created",

  // Discussions
  "discussion_created": "discussion.created",
  "discussion_answered": "discussion.answered",
};

/**
 * Vercel events are already in internal format.
 * This mapping exists for consistency and validation.
 */
export const VERCEL_TO_INTERNAL: Record<string, InternalEventType> = {
  "deployment.created": "deployment.created",
  "deployment.succeeded": "deployment.succeeded",
  "deployment.ready": "deployment.ready",
  "deployment.error": "deployment.error",
  "deployment.canceled": "deployment.canceled",
};

/**
 * Convert GitHub external event format to internal format.
 *
 * @param event - GitHub event name (e.g., "pull_request")
 * @param action - GitHub action (e.g., "opened")
 * @returns Internal event type or undefined if not mapped
 *
 * @example
 * toInternalGitHubEvent("pull_request", "opened") // "pull-request.opened"
 * toInternalGitHubEvent("push") // "push"
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
 * Vercel events are already in dot notation, this validates and returns.
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
 * Internal format to external format mapping (for logging/debugging).
 */
export const INTERNAL_TO_GITHUB: Record<string, string> = Object.fromEntries(
  Object.entries(GITHUB_TO_INTERNAL).map(([ext, int]) => [int, ext])
);

/**
 * Convert internal event type to external GitHub format.
 * Useful for logging and debugging.
 */
export function toExternalGitHubEvent(internalType: InternalEventType): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}
```

#### 3. Update SourceEvent Interface
**File**: `packages/console-types/src/neural/source-event.ts`
**Changes**: Update `sourceType` to use typed union

```typescript
import type { InternalEventType } from "../integrations/event-types";

export interface SourceEvent {
  // Source identification
  source: "github" | "vercel" | "linear" | "sentry";
  sourceType: InternalEventType; // Changed from string
  sourceId: string;
  // ... rest unchanged
}
```

#### 4. Update Package Exports
**File**: `packages/console-types/src/index.ts`
**Changes**: Add event-types export

```typescript
// Add to existing exports
export * from "./integrations/event-types";
```

**File**: `packages/console-types/src/integrations/index.ts`
**Changes**: Add event-types export

```typescript
export * from "./events";
export * from "./event-types"; // New
```

**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Add event-mapping export

```typescript
export * from "./event-mapping"; // New
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-types typecheck` passes
- [x] `pnpm --filter @repo/console-webhooks typecheck` passes
- [x] `pnpm --filter @repo/console-types lint` passes
- [x] `pnpm --filter @repo/console-webhooks lint` passes (no lint script, N/A)

#### Manual Verification:
- [ ] Verify event-types.ts exports are accessible from @repo/console-types
- [ ] Verify event-mapping.ts exports are accessible from @repo/console-webhooks

---

## Phase 2: Update Transformers

### Overview
Update GitHub and Vercel transformers to use internal event format and typed event mapping.

### Changes Required:

#### 1. Update GitHub Transformer
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Changes**: Use mapping utilities for sourceType

Current (line 53):
```typescript
source: "github",
sourceType: "push",
```

After:
```typescript
import { toInternalGitHubEvent } from "../event-mapping";

// In transformGitHubPush (line 51-53):
source: "github",
sourceType: toInternalGitHubEvent("push") ?? "push",

// In transformGitHubPullRequest (line 164-166):
const internalType = toInternalGitHubEvent("pull_request", effectiveAction);
return {
  source: "github",
  sourceType: internalType ?? `pull-request.${effectiveAction}`,
  // ...
}

// In transformGitHubIssue (line 246-248):
const internalType = toInternalGitHubEvent("issue", payload.action);
return {
  source: "github",
  sourceType: internalType ?? `issue.${payload.action}`,
  // ...
}

// In transformGitHubRelease (line 301-303):
const internalType = toInternalGitHubEvent("release", payload.action);
return {
  source: "github",
  sourceType: internalType ?? `release.${payload.action}`,
  // ...
}

// In transformGitHubDiscussion (line 361-363):
const internalType = toInternalGitHubEvent("discussion", payload.action);
return {
  source: "github",
  sourceType: internalType ?? `discussion.${payload.action}`,
  // ...
}
```

#### 2. Update Vercel Transformer
**File**: `packages/console-webhooks/src/transformers/vercel.ts`
**Changes**: Use mapping utilities for validation

Current (line 100-102):
```typescript
source: "vercel",
sourceType: eventType,
```

After:
```typescript
import { toInternalVercelEvent } from "../event-mapping";

// In transformVercelDeployment (line 100-102):
const internalType = toInternalVercelEvent(eventType);
return {
  source: "vercel",
  sourceType: internalType ?? eventType,
  // ...
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/console-webhooks typecheck` passes
- [x] `pnpm --filter @repo/console-webhooks lint` passes (no lint script, N/A)
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Test GitHub webhook with pull_request event produces `pull-request.opened` sourceType
- [ ] Test Vercel webhook produces `deployment.succeeded` sourceType

---

## Phase 3: Update Scoring System

### Overview
Refactor scoring.ts to use typed event weights from centralized definitions.

### Changes Required:

#### 1. Update Scoring Module
**File**: `api/console/src/inngest/workflow/neural/scoring.ts`
**Changes**: Remove inline EVENT_TYPE_WEIGHTS, use getEventWeight from console-types

Current (lines 37-61):
```typescript
const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  release_published: 75,
  // ... 15 more entries
};
```

After:
```typescript
import { getEventWeight, isInternalEventType } from "@repo/console-types";

// Remove EVENT_TYPE_WEIGHTS constant entirely

// Update scoreSignificance function (line 97-100):
export function scoreSignificance(sourceEvent: SourceEvent): SignificanceResult {
  const factors: string[] = [];

  // 1. Event type base weight (now from centralized source)
  const eventType = sourceEvent.sourceType;
  let score = getEventWeight(eventType);
  factors.push(`base:${eventType}`);

  // ... rest unchanged
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/console typecheck` passes
- [x] `pnpm --filter @api/console lint` passes (pre-existing errors, no new errors introduced)
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Verify significance scores match expected values for known event types
- [ ] Verify unknown event types fall back to default weight (35)

---

## Phase 4: Centralize Provider Literals

### Overview
Update all 21 files to import provider literals from central schema instead of inline definitions.

### Changes Required:

#### 1. Extend Provider Schema
**File**: `packages/console-validation/src/schemas/sources.ts`
**Changes**: Add sourceEventProviderSchema for neural pipeline

```typescript
/**
 * Source Event Provider Schema
 *
 * Extended provider list for neural memory pipeline.
 * Includes future providers (linear, sentry) for forward compatibility.
 */
export const sourceEventProviderSchema = z.enum([
  "github",
  "vercel",
  "linear",
  "sentry",
]);

export type SourceEventProvider = z.infer<typeof sourceEventProviderSchema>;

/**
 * Type guard for source event providers
 */
export function isSourceEventProvider(value: string): value is SourceEventProvider {
  return sourceEventProviderSchema.safeParse(value).success;
}
```

#### 2. Update SourceEvent Interface
**File**: `packages/console-types/src/neural/source-event.ts`
**Changes**: Import provider type from validation package

```typescript
import type { SourceEventProvider } from "@repo/console-validation";

export interface SourceEvent {
  source: SourceEventProvider; // Changed from inline union
  sourceType: InternalEventType;
  // ... rest unchanged
}
```

#### 3. Update Inngest Event Schemas
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Import from central schema (5 schemas to update)

```typescript
import { sourceTypeSchema, sourceEventProviderSchema } from "@repo/console-validation";

// Line 38: source/connected
sourceType: sourceTypeSchema,

// Line 471: source/sync/requested
sourceType: sourceTypeSchema,

// Line 503: processing/document/embed
sourceType: sourceTypeSchema,

// Line 521: processing/document/delete
sourceType: sourceTypeSchema,

// Line 590: neural/source-event
source: sourceEventProviderSchema,
```

#### 4. Update Remaining Files (16 files)
Files to update (import provider types from central schema):

**Database Schemas:**
- `db/console/src/schema/tables/user-sources.ts`
- `db/console/src/schema/tables/workspace-integrations.ts`

**tRPC Routers:**
- `api/console/src/router/user/user-sources.ts`
- `api/console/src/router/user/workspace.ts`
- `api/console/src/router/m2m/sources.ts`
- `api/console/src/router/org/workspace.ts`
- `api/console/src/router/org/jobs.ts`

**UI Components:**
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-form-provider.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-initializer.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/page.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/event-settings.tsx`

**Workflows:**
- `api/console/src/inngest/workflow/processing/delete-documents.ts`
- `api/console/src/inngest/workflow/processing/process-documents.ts`

**Webhook Handlers:**
- `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

**Storage:**
- `packages/console-webhooks/src/storage.ts`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (all packages)
- [x] `pnpm lint` passes (all packages) - pre-existing errors only
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Grep for inline `"github" | "vercel"` returns only expected results
- [ ] No TypeScript errors in IDE for updated files

**Note**: Phase 4 was simplified - using `IntegrationProvider` as single source of truth instead of creating separate `SourceEventProvider`. Linear/Sentry not added since they don't exist yet.

---

## Phase 5: Update Observation Capture

### Overview
Update observation-capture.ts to use typed event system for filtering and processing.

### Changes Required:

#### 1. Update Event Filtering
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Update getBaseEventType to return typed values

Current (lines 114-133):
```typescript
function getBaseEventType(sourceType: string): string {
  // Maps "pull_request_opened" → "pull_request"
  const underscoreIndex = sourceType.indexOf("_");
  if (underscoreIndex > 0) {
    const base = sourceType.substring(0, underscoreIndex);
    if (["pull_request", "issue", "release", "discussion"].includes(base)) {
      // Special case: issues → issues (plural for config)
      return base === "issue" ? "issues" : base;
    }
  }
  return sourceType;
}
```

After:
```typescript
import { isInternalEventType, INTERNAL_EVENT_TYPES } from "@repo/console-types";

/**
 * Extract base event type from internal format for config filtering.
 * Internal format: "pull-request.opened" → "pull_request" (config format)
 */
function getBaseEventType(sourceType: string): string {
  // Internal format uses dot notation: "pull-request.opened"
  const dotIndex = sourceType.indexOf(".");
  if (dotIndex > 0) {
    const base = sourceType.substring(0, dotIndex);
    // Convert internal format (hyphens) to config format (underscores)
    const configBase = base.replace(/-/g, "_");
    // Special case: issue → issues (plural for config)
    return configBase === "issue" ? "issues" : configBase;
  }
  return sourceType;
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/console typecheck` passes
- [x] `pnpm --filter @api/console lint` passes (pre-existing errors, no new errors)
- [x] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] Test webhook flow end-to-end with GitHub PR event
- [ ] Verify event filtering works correctly with new internal format
- [ ] Verify significance scoring produces expected scores

---

## Testing Strategy

### Unit Tests:
- Event mapping functions return correct internal types
- Unknown events handled gracefully with fallbacks
- Type guards validate correctly

### Integration Tests:
- Webhook handlers produce correct SourceEvent format
- Inngest events use typed sourceType
- Scoring uses correct weights from centralized config

### Manual Testing Steps:
1. Trigger GitHub PR opened webhook → verify `pull-request.opened` in observation
2. Trigger Vercel deployment succeeded → verify `deployment.succeeded` in observation
3. Check significance scores match expected weights
4. Verify event filtering respects source config

## Migration Notes

### Database Compatibility
- Existing observations stored with old format (`pull_request_opened`) remain unchanged
- New observations use internal format (`pull-request.opened`)
- Scoring function handles both formats via fallback to default weight

### Rollback Plan
- Revert transformer changes to restore external format storage
- Scoring will continue working (string-based lookup with fallback)

## References

- Original research: `thoughts/shared/research/2025-12-12-event-type-architecture-analysis.md`
- Event type definitions: `packages/console-types/src/integrations/events.ts`
- Provider schema: `packages/console-validation/src/schemas/sources.ts`
- Scoring system: `api/console/src/inngest/workflow/neural/scoring.ts`
- GitHub transformer: `packages/console-webhooks/src/transformers/github.ts:52,165,247,302,362`
- Vercel transformer: `packages/console-webhooks/src/transformers/vercel.ts:101`
