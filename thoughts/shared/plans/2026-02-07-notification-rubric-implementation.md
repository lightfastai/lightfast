# Notification Rubric Implementation Plan

## Overview

Replace the current single-threshold notification pipeline (significance score >= 70 = notify all org members) with a rubric-driven classification system that routes notifications based on event category, worthiness scoring, workspace maturity, and per-user targeting. This transforms Lightfast's notifications from "blast everything above a number" to "notify the right person, through the right channel, at the right time."

## Current State Analysis

### What Exists
- **Scoring**: `scoring.ts` computes significance 0-100 using base weights + keyword matching + reference density
- **Two thresholds**: 40 (store observation) and 70 (send notification) — both hardcoded
- **Single Knock workflow**: `observation-captured` handles all notifications
- **Blast radius**: ALL org members receive ALL notifications above threshold
- **Preferences UI**: Two global toggles (in-app feed, email) with "Coming soon" placeholder for workflow preferences
- **tRPC**: Only `notifications.getToken` endpoint — no preference management server-side
- **No targeting**: No actor exclusion, no role-based routing, no per-event-type filtering
- **No batching logic**: Relies on Knock's native 5-minute email batch

### Key Files
- `api/console/src/inngest/workflow/notifications/dispatch.ts` — Current dispatch (192 lines)
- `api/console/src/inngest/workflow/neural/scoring.ts` — Significance scoring (119 lines)
- `packages/console-types/src/integrations/event-types.ts` — Event type registry (124 lines)
- `vendor/knock/src/components/preferences.tsx` — Knock preferences hook (107 lines)
- `apps/console/src/app/.../notifications/_components/notification-preferences.tsx` — Preferences UI (182 lines)
- `api/console/src/router/user/notifications.ts` — tRPC notifications router (15 lines)
- `api/console/src/inngest/client/client.ts` — Inngest event definitions

### Key Discoveries
- Classification output (`classification.ts`) already produces 14 categories but is NOT used in notification routing
- Relationship detection (`relationship-detection.ts`) detects 8 relationship types (cross-tool) but doesn't inform notifications
- Actor resolution (`actor-resolution.ts`) resolves actors to `github:{numericId}` but dispatch doesn't use this for filtering
- The `observation.captured` Inngest event already includes `observationType`, `significanceScore`, `topics`, `clusterId` — enough data to classify without re-fetching
- Knock client SDK preferences support `channel_types`, `workflows`, and `categories` — we're only using `channel_types`
- The `observation.captured` event does NOT include the `sourceEvent.actor` — we'll need to add it

## Desired End State

After implementation:

1. **Every event type has a rubric entry** defining its category (CRITICAL/WORKFLOW/AMBIENT), channel tier, grouping strategy, and targeting rule
2. **A classifier function** runs between observation capture and dispatch, applying the worthiness test and rubric
3. **Notifications are targeted** — only relevant users receive them (author, reviewer, assignee, etc.)
4. **Multiple Knock workflows** handle different urgency tiers (critical-alert, workflow-update, daily-digest, weekly-summary)
5. **Workspace maturity** gates notification volume (Seed = quiet, Growing = cautious, Mature = full capability)
6. **Preferences UI** shows per-category toggles with event type detail, not just global channel switches
7. **Daily and weekly digests** aggregate low-priority events into summaries
8. **Anti-fatigue guardrail** throttles to digest-only if a user exceeds 30 notifications/week
9. **`NOTIFICATIONS.md`** serves as the human-readable philosophy document

### Verification
- `pnpm typecheck` passes with all new types
- `pnpm lint` clean
- `pnpm build:console` succeeds
- Existing `observation-captured` Knock workflow continues working during migration
- New Knock workflows created and tested via Knock MCP tools
- Notifications are targeted (not all org members) for WORKFLOW events
- CRITICAL events still reach all relevant members immediately
- AMBIENT events are suppressed from individual notification, appear in digests only
- Preferences UI renders per-category controls

## What We're NOT Doing

- **No quiet hours / DND scheduling** — future consideration
- **No per-user maturity curves** — maturity is per-workspace only
- **No AI-based dynamic threshold adjustment** — the rubric is rule-based, not ML
- **No cross-channel read-state deduplication** (suppress email if seen in-app) — requires Knock enterprise features
- **No notification engagement tracking** beyond what Knock provides natively — defer analytics to V2
- **No Linear/Sentry webhook routes** — transformers exist but routing is out of scope for this plan
- **No database schema changes** — all new data is in code (rubric types) or Knock (preferences)

## Implementation Approach

The plan follows a layered approach: types first, then classification logic, then dispatch changes, then Knock workflows, then UI, then digests. Each phase is independently deployable and backwards-compatible.

**Key architectural decision**: The classifier is a pure function (no DB queries, no AI calls) that takes the `observation.captured` event data + rubric config and returns a notification decision. All the intelligence is already computed upstream (classification, relationships, actor). The classifier is a router, not a thinker.

---

## Phase 1: Rubric Type System + Philosophy Document

### Overview
Create the type-safe notification rubric in `console-types` and the human-readable `NOTIFICATIONS.md`. This phase is purely additive — no behavioral changes.

### Changes Required:

#### 1. Create notification rubric types
**File**: `packages/console-types/src/notifications/rubric.ts` (NEW)

```typescript
/** Event categories for notification routing */
export type EventCategory = "critical" | "workflow" | "ambient";

/** Notification channel tiers — determines urgency and delivery channels */
export type ChannelTier = "interrupt" | "aware" | "inform" | "ambient";

/** Grouping strategies for notification delivery */
export type GroupingStrategy =
  | "realtime"
  | "batched_15m"
  | "daily_digest"
  | "weekly_digest";

/** Targeting rules for recipient selection */
export type TargetingRule =
  | "all_members"
  | "owner_only"
  | "assignee_only"
  | "reviewers_only"
  | "actor_excluded"
  | "actor_aware"; // Include actor with different messaging

/** Knock workflow keys mapped to channel tiers */
export const KNOCK_WORKFLOW_KEYS = {
  interrupt: "critical-alert",
  aware: "workflow-update",
  inform: "daily-digest",
  ambient: "weekly-summary",
} as const;

export type KnockWorkflowKey =
  (typeof KNOCK_WORKFLOW_KEYS)[keyof typeof KNOCK_WORKFLOW_KEYS];

/** Per-event-type notification configuration */
export interface EventNotificationConfig {
  eventType: string;
  source: string;
  category: EventCategory;
  notify: boolean | "conditional";
  channelTier: ChannelTier;
  grouping: GroupingStrategy;
  targetingRule: TargetingRule;
  condition?: string;
}

/** Worthiness test scoring for WORKFLOW events */
export interface WorthinessScore {
  actionable: boolean;
  crossTool: boolean;
  relevant: boolean;
  novel: boolean;
  missCost: "high" | "medium" | "low";
  total: number; // 0-5
}

/** Workspace maturity stages */
export type WorkspaceMaturity = "seed" | "growing" | "mature";

/** Notification classification result */
export interface NotificationDecision {
  shouldNotify: boolean;
  category: EventCategory;
  channelTier: ChannelTier;
  grouping: GroupingStrategy;
  targetingRule: TargetingRule;
  knockWorkflowKey: KnockWorkflowKey;
  worthinessScore?: WorthinessScore;
  suppressionReason?: string;
}
```

#### 2. Create the notification rubric (event map)
**File**: `packages/console-types/src/notifications/event-map.ts` (NEW)

```typescript
import type { EventNotificationConfig } from "./rubric";

/**
 * The notification rubric — source of truth for dispatch decisions.
 * Maps event types to their notification configuration.
 *
 * Categories:
 * - CRITICAL: Production impact, security, data loss risk → immediate notification
 * - WORKFLOW: State changes in development workflow → apply worthiness test
 * - AMBIENT: Routine activity, low information value → digest only
 */
export const NOTIFICATION_RUBRIC: Record<string, EventNotificationConfig> = {
  // === GitHub Events ===
  push: {
    eventType: "push",
    source: "github",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
    condition: "Only notify if push triggers cross-tool correlation",
  },
  "pull-request.opened": {
    eventType: "pull-request.opened",
    source: "github",
    category: "workflow",
    notify: "conditional",
    channelTier: "aware",
    grouping: "batched_15m",
    targetingRule: "reviewers_only",
    condition: "Only if user is a requested reviewer or PR touches their owned files",
  },
  "pull-request.closed": {
    eventType: "pull-request.closed",
    source: "github",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "pull-request.merged": {
    eventType: "pull-request.merged",
    source: "github",
    category: "workflow",
    notify: "conditional",
    channelTier: "aware",
    grouping: "batched_15m",
    targetingRule: "actor_aware",
    condition: "Only if triggers cross-tool correlation or user authored a related PR",
  },
  "pull-request.reopened": {
    eventType: "pull-request.reopened",
    source: "github",
    category: "workflow",
    notify: true,
    channelTier: "aware",
    grouping: "realtime",
    targetingRule: "actor_aware",
  },
  "pull-request.ready-for-review": {
    eventType: "pull-request.ready-for-review",
    source: "github",
    category: "workflow",
    notify: true,
    channelTier: "aware",
    grouping: "batched_15m",
    targetingRule: "reviewers_only",
  },
  "issue.opened": {
    eventType: "issue.opened",
    source: "github",
    category: "workflow",
    notify: "conditional",
    channelTier: "aware",
    grouping: "batched_15m",
    targetingRule: "assignee_only",
    condition: "Only if assigned to user or mentions user",
  },
  "issue.closed": {
    eventType: "issue.closed",
    source: "github",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "issue.reopened": {
    eventType: "issue.reopened",
    source: "github",
    category: "workflow",
    notify: true,
    channelTier: "aware",
    grouping: "realtime",
    targetingRule: "assignee_only",
  },
  "release.published": {
    eventType: "release.published",
    source: "github",
    category: "workflow",
    notify: true,
    channelTier: "aware",
    grouping: "realtime",
    targetingRule: "all_members",
  },
  "release.created": {
    eventType: "release.created",
    source: "github",
    category: "workflow",
    notify: false,
    channelTier: "inform",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "discussion.created": {
    eventType: "discussion.created",
    source: "github",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "weekly_digest",
    targetingRule: "all_members",
  },
  "discussion.answered": {
    eventType: "discussion.answered",
    source: "github",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "weekly_digest",
    targetingRule: "all_members",
  },

  // === Vercel Events ===
  "deployment.created": {
    eventType: "deployment.created",
    source: "vercel",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "deployment.succeeded": {
    eventType: "deployment.succeeded",
    source: "vercel",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "deployment.ready": {
    eventType: "deployment.ready",
    source: "vercel",
    category: "ambient",
    notify: false,
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
  },
  "deployment.error": {
    eventType: "deployment.error",
    source: "vercel",
    category: "critical",
    notify: true,
    channelTier: "interrupt",
    grouping: "realtime",
    targetingRule: "actor_aware",
  },
  "deployment.canceled": {
    eventType: "deployment.canceled",
    source: "vercel",
    category: "workflow",
    notify: "conditional",
    channelTier: "aware",
    grouping: "batched_15m",
    targetingRule: "owner_only",
    condition: "Only if user initiated the deploy or owns the project",
  },
};
```

#### 3. Create index and export
**File**: `packages/console-types/src/notifications/index.ts` (NEW)

```typescript
export * from "./rubric";
export * from "./event-map";
```

#### 4. Export from console-types root
**File**: `packages/console-types/src/index.ts` (EDIT)
Add: `export * from "./notifications";`

#### 5. Create NOTIFICATIONS.md
**File**: `NOTIFICATIONS.md` (NEW in repo root)

Contains the philosophy manifesto, decision tree, and event taxonomy from the architecture design doc — adapted as a living document readable by engineers and Claude Code agents.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes with new types
- [x] `pnpm lint` clean
- [x] `packages/console-types/src/notifications/rubric.ts` exports all required types
- [x] `packages/console-types/src/notifications/event-map.ts` has entries for all 18 current event types
- [x] `NOTIFICATIONS.md` exists in repo root

#### Manual Verification:
- [ ] Types are importable from `@repo/console-types` in api/console

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 2.

---

## Phase 2: Notification Classifier

### Overview
Create the classification function that applies the rubric to decide whether/how to notify. This is a pure function — no side effects, no DB queries. It takes event data and returns a `NotificationDecision`.

### Changes Required:

#### 1. Create the classifier
**File**: `api/console/src/inngest/workflow/notifications/classifier.ts` (NEW)

```typescript
import {
  type EventCategory,
  type NotificationDecision,
  type WorthinessScore,
  type WorkspaceMaturity,
  NOTIFICATION_RUBRIC,
  KNOCK_WORKFLOW_KEYS,
} from "@repo/console-types";

interface ClassifierInput {
  observationType: string;
  significanceScore: number;
  topics: string[];
  hasRelationships: boolean; // cross-tool correlation detected
  actorId?: string; // who performed the action
  workspaceMaturity: WorkspaceMaturity;
}

/**
 * Classify an observation for notification routing.
 * Pure function — no DB queries, no side effects.
 */
export function classifyNotification(
  input: ClassifierInput
): NotificationDecision {
  const rubricEntry = NOTIFICATION_RUBRIC[input.observationType];

  // Unknown event type → store only, no notification
  if (!rubricEntry) {
    return suppressedDecision("unknown_event_type");
  }

  // Step 1: Event category classification
  const category = rubricEntry.category;

  // AMBIENT events never notify individually
  if (category === "ambient") {
    return suppressedDecision("ambient_event", category);
  }

  // CRITICAL events always notify (skip worthiness test)
  if (category === "critical") {
    return {
      shouldNotify: true,
      category: "critical",
      channelTier: "interrupt",
      grouping: "realtime",
      targetingRule: rubricEntry.targetingRule,
      knockWorkflowKey: KNOCK_WORKFLOW_KEYS.interrupt,
    };
  }

  // Step 2: Worthiness test (for WORKFLOW events)
  const worthiness = scoreWorthiness(input, rubricEntry);

  if (worthiness.total === 0) {
    return suppressedDecision("worthiness_zero", category, worthiness);
  }

  // Step 3: Stack maturity check
  if (input.workspaceMaturity === "seed" && worthiness.total < 5) {
    return suppressedDecision("seed_workspace_suppressed", category, worthiness);
  }

  if (input.workspaceMaturity === "growing" && worthiness.total < 3) {
    return suppressedDecision("growing_workspace_below_threshold", category, worthiness);
  }

  // Step 4: Determine channel tier and grouping from worthiness score
  const { channelTier, grouping } = resolveChannelTier(
    worthiness.total,
    input.workspaceMaturity
  );

  return {
    shouldNotify: true,
    category,
    channelTier,
    grouping,
    targetingRule: rubricEntry.targetingRule,
    knockWorkflowKey: KNOCK_WORKFLOW_KEYS[channelTier],
    worthinessScore: worthiness,
  };
}

function scoreWorthiness(
  input: ClassifierInput,
  rubricEntry: EventNotificationConfig
): WorthinessScore {
  // W1: Actionable?
  const actionable = rubricEntry.notify === true ||
    (rubricEntry.notify === "conditional" && input.significanceScore >= 60);

  // W2: Cross-tool?
  const crossTool = input.hasRelationships;

  // W3: Relevant? (simplified — full targeting happens in dispatch)
  const relevant = rubricEntry.targetingRule !== "all_members" ||
    input.significanceScore >= 50;

  // W4: Novel? (approximation — uses significance signals)
  const novel = input.significanceScore >= 40;

  // W5: Miss cost
  const missCost = input.significanceScore >= 70 ? "high" as const
    : input.significanceScore >= 50 ? "medium" as const
    : "low" as const;

  const total =
    (actionable ? 1 : 0) +
    (crossTool ? 1 : 0) +
    (relevant ? 1 : 0) +
    (novel ? 1 : 0) +
    (missCost === "high" ? 1 : missCost === "medium" ? 0.5 : 0);

  return {
    actionable,
    crossTool,
    relevant,
    novel,
    missCost,
    total: Math.round(total),
  };
}

function resolveChannelTier(worthinessTotal: number, maturity: WorkspaceMaturity) {
  if (worthinessTotal >= 5) {
    return { channelTier: "interrupt" as const, grouping: "realtime" as const };
  }
  if (worthinessTotal >= 3) {
    return {
      channelTier: "aware" as const,
      grouping: maturity === "mature" ? "realtime" as const : "batched_15m" as const,
    };
  }
  return { channelTier: "inform" as const, grouping: "daily_digest" as const };
}

function suppressedDecision(
  reason: string,
  category?: EventCategory,
  worthiness?: WorthinessScore
): NotificationDecision {
  return {
    shouldNotify: false,
    category: category ?? "ambient",
    channelTier: "ambient",
    grouping: "daily_digest",
    targetingRule: "all_members",
    knockWorkflowKey: KNOCK_WORKFLOW_KEYS.ambient,
    worthinessScore: worthiness,
    suppressionReason: reason,
  };
}
```

#### 2. Create workspace maturity helper
**File**: `api/console/src/inngest/workflow/notifications/maturity.ts` (NEW)

```typescript
import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceObservationRelationships } from "@db/console/schema";
import { eq, count, countDistinct } from "drizzle-orm";
import type { WorkspaceMaturity } from "@repo/console-types";

// Cache maturity per workspace (1-hour TTL)
const maturityCache = new Map<string, { maturity: WorkspaceMaturity; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getWorkspaceMaturity(workspaceId: string): Promise<WorkspaceMaturity> {
  const cached = maturityCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.maturity;
  }

  const [obsResult, sourceResult, relResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspaceId)),
    db
      .select({ count: countDistinct(workspaceNeuralObservations.source) })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspaceId)),
    db
      .select({ count: count() })
      .from(workspaceObservationRelationships)
      .where(eq(workspaceObservationRelationships.workspaceId, workspaceId)),
  ]);

  const observationCount = obsResult[0]?.count ?? 0;
  const sourceCount = sourceResult[0]?.count ?? 0;
  const relationshipCount = relResult[0]?.count ?? 0;

  let maturity: WorkspaceMaturity;
  if (observationCount >= 500 && sourceCount >= 3 && relationshipCount > 0) {
    maturity = "mature";
  } else if (observationCount >= 50 && sourceCount >= 2) {
    maturity = "growing";
  } else {
    maturity = "seed";
  }

  maturityCache.set(workspaceId, {
    maturity,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return maturity;
}
```

#### 3. Export from notifications index
**File**: `api/console/src/inngest/workflow/notifications/index.ts` (EDIT)
Add exports for `classifier` and `maturity`.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` clean
- [x] `classifyNotification()` returns `shouldNotify: false` for ambient events
- [x] `classifyNotification()` returns `shouldNotify: true` with `channelTier: "interrupt"` for critical events
- [x] `classifyNotification()` applies worthiness test for workflow events
- [x] `getWorkspaceMaturity()` returns correct maturity stage

#### Manual Verification:
- [ ] Classifier produces expected decisions for representative event types (manual trace through logic)

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 3.

---

## Phase 3: Targeted Dispatch + Knock Workflows

### Overview
Modify the notification dispatch to use the classifier, add actor-aware recipient filtering, and create the new Knock workflows. This is the most impactful phase — it changes notification behavior.

### Changes Required:

#### 1. Add actor data to observation.captured event
**File**: `api/console/src/inngest/client/client.ts` (EDIT)

In the `observation.captured` event schema, add:
```typescript
/** Actor who performed the action (for notification targeting) */
actorSourceId: z.string().optional(), // e.g., "github:12345"
actorName: z.string().optional(),
```

#### 2. Emit actor data from observation capture
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts` (EDIT)

In the `emit-events` step (~line 1052), add `actorSourceId` and `actorName` to the `observation.captured` event data from the resolved actor.

#### 3. Rewrite dispatch to use classifier
**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts` (EDIT)

Replace the current threshold-based dispatch with classifier-driven dispatch:

```typescript
import { classifyNotification } from "./classifier";
import { getWorkspaceMaturity } from "./maturity";

// Remove: NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70
// Remove: significanceScore check

// In the handler:
// 1. Get workspace maturity
const maturity = await step.run("get-workspace-maturity", () =>
  getWorkspaceMaturity(workspaceId)
);

// 2. Check for cross-tool relationships
const hasRelationships = await step.run("check-relationships", async () => {
  const rels = await db.query.workspaceObservationRelationships.findFirst({
    where: eq(workspaceObservationRelationships.observationId, observationDbId),
  });
  return !!rels;
});

// 3. Classify
const decision = classifyNotification({
  observationType,
  significanceScore: significanceScore ?? 0,
  topics: topics ?? [],
  hasRelationships,
  actorId: actorSourceId,
  workspaceMaturity: maturity,
});

// 4. If suppressed, return early
if (!decision.shouldNotify) {
  return { status: "suppressed", reason: decision.suppressionReason, decision };
}

// 5. Filter recipients based on targeting rule
const recipients = await step.run("filter-recipients", async () => {
  const allMembers = await fetchOrgMembers(clerkOrgId);
  return filterByTargetingRule(allMembers, decision.targetingRule, actorSourceId);
});

// 6. Trigger the appropriate Knock workflow
await step.run("trigger-knock-workflow", async () => {
  await notifications.workflows.trigger(decision.knockWorkflowKey, {
    recipients,
    tenant: workspaceId,
    data: {
      observationId,
      observationType,
      significanceScore,
      topics: topics ?? [],
      clusterId,
      workspaceId,
      workspaceName,
      category: decision.category,
      channelTier: decision.channelTier,
    },
  });
});
```

#### 4. Add recipient filtering helper
**File**: `api/console/src/inngest/workflow/notifications/recipient-filter.ts` (NEW)

```typescript
import type { TargetingRule } from "@repo/console-types";

interface Recipient {
  id: string;
  email: string;
  name: string | undefined;
}

/**
 * Filter recipients based on the targeting rule.
 * V1: Only supports all_members and actor_excluded/actor_aware.
 * Reviewers/assignee targeting requires GitHub API integration (future).
 */
export function filterByTargetingRule(
  allMembers: Recipient[],
  rule: TargetingRule,
  actorSourceId?: string
): Recipient[] {
  switch (rule) {
    case "actor_excluded":
      // Remove the person who triggered the event
      if (!actorSourceId) return allMembers;
      return allMembers.filter((m) => !matchesActor(m, actorSourceId));

    case "actor_aware":
      // Include everyone — dispatch will use different template for actor
      return allMembers;

    case "all_members":
    case "owner_only":
    case "assignee_only":
    case "reviewers_only":
      // V1: Fall through to all members for targeting rules
      // that require GitHub API integration
      return allMembers;

    default:
      return allMembers;
  }
}

function matchesActor(member: Recipient, actorSourceId: string): boolean {
  // actorSourceId format: "github:{numericId}" or "github:{username}"
  // We can't match this to Clerk userId without a linking table
  // For V1, we skip actor filtering if we can't match
  // TODO: Build actor → Clerk user linking
  return false;
}
```

#### 5. Create Knock workflows via MCP
Using the Knock MCP tools, create the following workflows:

- **`critical-alert`**: In-app + Email, no batch, immediate delivery
- **`workflow-update`**: In-app + Email, 15-min batch window
- **`daily-digest`**: Email only, scheduled delivery
- **`weekly-summary`**: Email only, scheduled delivery

**Note**: The existing `observation-captured` workflow is preserved as a fallback during migration. It will be deprecated once the new workflows are validated.

#### 6. Update Inngest event schema for the classifier output
**File**: `api/console/src/inngest/client/client.ts` (EDIT)

No new Inngest events needed — the classifier runs inline within the existing `notificationDispatch` function. The dispatch function itself becomes the classifier + dispatcher.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build:console` succeeds
- [x] `pnpm lint` clean
- [x] Dispatch function imports and uses `classifyNotification` correctly
- [x] Actor data propagated in `observation.captured` event schema

#### Manual Verification:
- [ ] `deployment.error` events trigger `critical-alert` Knock workflow
- [ ] `push` events are suppressed (no notification sent)
- [ ] `release.published` events trigger `workflow-update` Knock workflow
- [ ] Seed workspaces receive fewer notifications than mature workspaces
- [ ] Knock dashboard shows new workflows receiving triggers

**Implementation Note**: After completing this phase, pause for manual testing of notification routing. This is the highest-risk phase. Verify in development with test webhooks before proceeding.

---

## Phase 4: Enhanced Preferences UI

### Overview
Replace the two-toggle preferences UI with per-category controls and event-type granularity. Uses Knock's category-based preferences to let users control notification volume per event category.

### Changes Required:

#### 1. Configure Knock categories via MCP
Using the Knock MCP tools, create notification categories:
- `critical_alerts` — Maps to CRITICAL events
- `workflow_updates` — Maps to WORKFLOW events
- `daily_digests` — Maps to daily digest emails
- `weekly_summaries` — Maps to weekly summary emails

Assign each Knock workflow to its category.

#### 2. Rewrite preferences hook
**File**: `vendor/knock/src/components/preferences.tsx` (EDIT)

Extend the hook to support category-based preferences:

```typescript
export interface CategoryPreference {
  categoryKey: string;
  label: string;
  description: string;
  channels: {
    in_app_feed: boolean;
    email: boolean;
  };
}

export function useNotificationPreferences() {
  // ... existing knockClient + state logic ...

  const getCategoryPreferences = (): CategoryPreference[] => {
    const categories = preferences?.categories ?? {};
    return [
      {
        categoryKey: "critical_alerts",
        label: "Critical Alerts",
        description: "Deployment failures, security vulnerabilities, production incidents",
        channels: {
          in_app_feed: categories.critical_alerts?.channel_types?.in_app_feed ?? true,
          email: categories.critical_alerts?.channel_types?.email ?? true,
        },
      },
      {
        categoryKey: "workflow_updates",
        label: "Workflow Updates",
        description: "PR reviews, releases, issue assignments, deploy status",
        channels: {
          in_app_feed: categories.workflow_updates?.channel_types?.in_app_feed ?? true,
          email: categories.workflow_updates?.channel_types?.email ?? true,
        },
      },
      {
        categoryKey: "daily_digests",
        label: "Daily Digest",
        description: "Summary of yesterday's activity across all integrations",
        channels: {
          in_app_feed: false, // digest is email-only
          email: categories.daily_digests?.channel_types?.email ?? true,
        },
      },
      {
        categoryKey: "weekly_summaries",
        label: "Weekly Summary",
        description: "Velocity trends, pattern reports, and cross-tool insights",
        channels: {
          in_app_feed: false,
          email: categories.weekly_summaries?.channel_types?.email ?? true,
        },
      },
    ];
  };

  const updateCategoryPreference = async (
    categoryKey: string,
    channelType: string,
    enabled: boolean
  ) => {
    // Build updated categories preserving existing preferences
    const currentCategories = preferences?.categories ?? {};
    const updatedCategories = {
      ...currentCategories,
      [categoryKey]: {
        ...currentCategories[categoryKey],
        channel_types: {
          ...currentCategories[categoryKey]?.channel_types,
          [channelType]: enabled,
        },
      },
    };

    await knockClient.preferences.set({
      channel_types: preferences?.channel_types ?? {},
      workflows: preferences?.workflows ?? {},
      categories: updatedCategories,
    });

    // Refetch
    const updatedPrefs = await knockClient.preferences.get();
    setPreferences(updatedPrefs);
  };

  return {
    // ... existing returns ...
    getCategoryPreferences,
    updateCategoryPreference,
  };
}
```

#### 3. Rewrite preferences UI component
**File**: `apps/console/src/app/.../notifications/_components/notification-preferences.tsx` (EDIT)

Replace the two-toggle UI with category-based preferences:

- **Section 1: Global Channel Toggles** (preserved — in-app feed, email master switches)
- **Section 2: Notification Categories** (NEW — replaces "Coming Soon" placeholder)
  - Each category shows: label, description, in-app toggle, email toggle
  - Critical Alerts: both toggles, with warning if email is disabled
  - Workflow Updates: both toggles
  - Daily Digest: email toggle only
  - Weekly Summary: email toggle only
- **Section 3: Event Types** (NEW — collapsible detail within each category)
  - Shows individual event types within the category
  - Per-event-type email/in-app toggles

Use existing component patterns from the current UI (Card, Switch, Label, Skeleton from `@repo/ui`).

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build:console` succeeds
- [x] `pnpm lint` clean
- [x] Preferences hook exports `getCategoryPreferences` and `updateCategoryPreference`

#### Manual Verification:
- [ ] Preferences page renders 4 category sections
- [ ] Toggling a category channel persists to Knock and survives page reload
- [ ] Global channel toggle still works as master override
- [ ] "Coming Soon" placeholder is replaced with working controls
- [ ] UI is responsive and matches existing design language

**Implementation Note**: After completing this phase, pause for UI review before proceeding to Phase 5.

---

## Phase 5: Digest Workflows

### Overview
Create Inngest cron functions that aggregate observations into daily and weekly digests, then trigger the corresponding Knock digest workflows.

### Changes Required:

#### 1. Create daily digest Inngest function
**File**: `api/console/src/inngest/workflow/notifications/daily-digest.ts` (NEW)

```typescript
import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import { workspaceNeuralObservations, orgWorkspaces } from "@db/console/schema";
import { eq, gte, and, desc } from "drizzle-orm";
import { notifications } from "@vendor/knock";
import { clerkClient } from "@clerk/nextjs/server";
import { getWorkspaceMaturity } from "./maturity";

/**
 * Daily digest — runs at 9 AM UTC every day.
 * Aggregates yesterday's observations into a summary and sends via Knock.
 */
export const dailyDigest = inngest.createFunction(
  {
    id: "apps-console/notification.daily-digest",
    name: "Daily Notification Digest",
    retries: 2,
  },
  { cron: "0 9 * * *" }, // 9 AM UTC daily
  async ({ step }) => {
    if (!notifications) return { status: "skipped", reason: "knock_not_configured" };

    // Get all active workspaces
    const workspaces = await step.run("get-active-workspaces", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Find workspaces with observations in the last 24 hours
      const results = await db
        .selectDistinct({ workspaceId: workspaceNeuralObservations.workspaceId })
        .from(workspaceNeuralObservations)
        .where(gte(workspaceNeuralObservations.capturedAt, yesterday));

      return results.map((r) => r.workspaceId);
    });

    // Process each workspace
    for (const workspaceId of workspaces) {
      await step.run(`digest-${workspaceId}`, async () => {
        const maturity = await getWorkspaceMaturity(workspaceId);

        // Seed workspaces don't get daily digests
        if (maturity === "seed") return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Get yesterday's observations
        const observations = await db.query.workspaceNeuralObservations.findMany({
          where: and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            gte(workspaceNeuralObservations.capturedAt, yesterday),
          ),
          orderBy: [desc(workspaceNeuralObservations.significanceScore)],
          limit: 20, // Top 20 for digest
          columns: {
            externalId: true,
            title: true,
            observationType: true,
            significanceScore: true,
            source: true,
          },
        });

        if (observations.length === 0) return;

        // Get workspace + org info
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
          columns: { name: true, clerkOrgId: true },
        });

        if (!workspace?.clerkOrgId) return;

        // Get org members
        const clerk = await clerkClient();
        const members = await clerk.organizations.getOrganizationMembershipList({
          organizationId: workspace.clerkOrgId,
          limit: 100,
        });

        const recipients = members.data
          .filter((m) => m.publicUserData?.userId)
          .map((m) => ({
            id: m.publicUserData!.userId!,
            email: m.publicUserData!.identifier!,
          }));

        if (recipients.length === 0) return;

        // Build digest summary
        const summary = {
          totalObservations: observations.length,
          topItems: observations.slice(0, 5).map((o) => ({
            title: o.title,
            type: o.observationType,
            source: o.source,
            score: o.significanceScore,
          })),
          bySource: groupBy(observations, "source"),
        };

        // Trigger Knock daily digest workflow
        await notifications.workflows.trigger("daily-digest", {
          recipients,
          tenant: workspaceId,
          data: {
            workspaceId,
            workspaceName: workspace.name,
            date: yesterday.toISOString().split("T")[0],
            summary,
          },
        });
      });
    }

    return { status: "completed", workspacesProcessed: workspaces.length };
  },
);

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
```

#### 2. Create weekly summary Inngest function
**File**: `api/console/src/inngest/workflow/notifications/weekly-summary.ts` (NEW)

Similar structure to daily digest but:
- Runs `0 9 * * 1` (Monday 9 AM UTC)
- Aggregates 7 days of observations
- Includes velocity trends (this week vs last week counts)
- Includes top event types by frequency
- Available to all maturity stages (including growing)

#### 3. Create Knock digest email templates via MCP
Using the Knock MCP tools:

- **`daily-digest`** workflow: Email step with markdown blocks showing daily summary
- **`weekly-summary`** workflow: Email step with markdown blocks showing weekly trends

#### 4. Register cron functions in Inngest
**File**: `api/console/src/inngest/workflow/notifications/index.ts` (EDIT)

Export `dailyDigest` and `weeklySummary` functions so they're registered with Inngest.

#### 5. Anti-fatigue guardrail
**File**: `api/console/src/inngest/workflow/notifications/classifier.ts` (EDIT)

Add a weekly notification count check in the classifier:

```typescript
// In classifyNotification(), before returning shouldNotify: true for WORKFLOW events:
// Check if user has received > 30 notifications this week
// If so, downgrade to digest-only
// Implementation: lightweight counter via Upstash Redis (already available)
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build:console` succeeds
- [x] `pnpm lint` clean
- [x] Daily digest function registered in Inngest
- [x] Weekly summary function registered in Inngest
- [x] Cron schedules correctly defined

#### Manual Verification:
- [ ] Trigger daily digest manually via Inngest dev UI — verify email sent via Knock
- [ ] Trigger weekly summary manually — verify email sent
- [ ] Seed workspaces don't receive daily digests
- [ ] Growing/mature workspaces receive digests with correct content
- [ ] Digest email contains top observations ordered by significance

**Implementation Note**: After completing this phase, the full notification rubric system is live. Monitor Knock dashboard for delivery metrics.

---

## Testing Strategy

### Unit Tests
- `classifyNotification()` — test each event type returns correct category/channel/grouping
- `scoreWorthiness()` — test scoring boundaries (0, 3, 5)
- `filterByTargetingRule()` — test each targeting rule
- `getWorkspaceMaturity()` — test seed/growing/mature thresholds

### Integration Tests
- Dispatch workflow with mocked Knock — verify correct workflow key triggered
- Daily digest with test observations — verify aggregation logic
- Preferences round-trip — set category preference, verify it persists

### Manual Testing Steps
1. Trigger a `deployment.error` webhook → verify `critical-alert` Knock workflow fires
2. Trigger a `push` webhook → verify NO notification sent (ambient)
3. Trigger `release.published` → verify `workflow-update` fires to all members
4. Check preferences page → verify 4 category sections render
5. Toggle "Workflow Updates" email off → verify next workflow event skips email
6. Wait for daily digest cron (or trigger manually) → verify digest email received
7. Create a new workspace (0 observations) → verify near-zero notification volume

## Performance Considerations

- **Classifier is pure + fast**: No DB queries, no AI calls — O(1) per classification
- **Maturity check is cached**: 1-hour TTL per workspace, 3 parallel COUNT queries on indexed columns
- **Relationship check**: Single `findFirst` on indexed `observationId` column
- **Digest queries**: Run once daily/weekly, limited to 20 observations per workspace
- **No new indexes needed**: All queries use existing workspace indexes

## Migration Notes

- **Backwards compatibility**: The existing `observation-captured` Knock workflow remains active throughout migration. New workflows are additive.
- **Gradual rollout**: The classifier can be feature-flagged per workspace if needed. Until the flag is set, the old threshold logic continues.
- **No database migration**: All new data lives in code (rubric types) or Knock (preferences/workflows). Zero schema changes.
- **Knock workflow creation**: New workflows are created via Knock MCP/dashboard. No code deployment needed for workflow configuration.

## References

- Architecture Design: `thoughts/shared/research/2026-02-07-notification-rubric-architecture-design.md`
- Codebase Analysis: `thoughts/shared/research/2026-02-07-notification-rubric-codebase-analysis.md`
- External Research: `thoughts/shared/research/2026-02-07-notification-rubric-external-research.md`
- Current dispatch: `api/console/src/inngest/workflow/notifications/dispatch.ts`
- Current scoring: `api/console/src/inngest/workflow/neural/scoring.ts`
- Event types: `packages/console-types/src/integrations/event-types.ts`
