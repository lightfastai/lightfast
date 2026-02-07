/**
 * Notification classifier
 *
 * Pure function that applies the notification rubric to decide whether/how
 * to notify. Takes event data and returns a NotificationDecision.
 * No DB queries, no side effects.
 */

import type {
  EventCategory,
  EventNotificationConfig,
  NotificationDecision,
  WorthinessScore,
  WorkspaceMaturity,
} from "@repo/console-types";
import {
  NOTIFICATION_RUBRIC,
  KNOCK_WORKFLOW_KEYS,
  isInternalEventType,
} from "@repo/console-types";

export interface ClassifierInput {
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
  input: ClassifierInput,
): NotificationDecision {
  // Unknown event type -> store only, no notification
  if (!isInternalEventType(input.observationType)) {
    return suppressedDecision("unknown_event_type");
  }

  const rubricEntry = NOTIFICATION_RUBRIC[input.observationType];

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
    return suppressedDecision(
      "seed_workspace_suppressed",
      category,
      worthiness,
    );
  }

  if (input.workspaceMaturity === "growing" && worthiness.total < 3) {
    return suppressedDecision(
      "growing_workspace_below_threshold",
      category,
      worthiness,
    );
  }

  // Step 4: Determine channel tier and grouping from worthiness score
  const { channelTier, grouping } = resolveChannelTier(
    worthiness.total,
    input.workspaceMaturity,
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
  rubricEntry: EventNotificationConfig,
): WorthinessScore {
  // W1: Actionable?
  const actionable =
    rubricEntry.notify === true ||
    (rubricEntry.notify === "conditional" && input.significanceScore >= 60);

  // W2: Cross-tool?
  const crossTool = input.hasRelationships;

  // W3: Relevant? (simplified — full targeting happens in dispatch)
  const relevant =
    rubricEntry.targetingRule !== "all_members" ||
    input.significanceScore >= 50;

  // W4: Novel? (approximation — uses significance signals)
  const novel = input.significanceScore >= 40;

  // W5: Miss cost
  const missCost =
    input.significanceScore >= 70
      ? ("high" as const)
      : input.significanceScore >= 50
        ? ("medium" as const)
        : ("low" as const);

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

function resolveChannelTier(
  worthinessTotal: number,
  maturity: WorkspaceMaturity,
) {
  if (worthinessTotal >= 5) {
    return { channelTier: "interrupt" as const, grouping: "realtime" as const };
  }
  if (worthinessTotal >= 3) {
    return {
      channelTier: "aware" as const,
      grouping:
        maturity === "mature"
          ? ("realtime" as const)
          : ("batched_15m" as const),
    };
  }
  return { channelTier: "inform" as const, grouping: "daily_digest" as const };
}

function suppressedDecision(
  reason: string,
  category?: EventCategory,
  worthiness?: WorthinessScore,
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
