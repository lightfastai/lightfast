import type { InternalEventType } from "../integrations/event-types";
import type { SourceType } from "@repo/console-validation";

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

/** Knock notification category keys — source of truth for preference categories */
export const NOTIFICATION_CATEGORY_KEYS = [
  "critical-alerts",
  "workflow-updates",
  "daily-digests",
  "weekly-summaries",
] as const;

export type NotificationCategoryKey =
  (typeof NOTIFICATION_CATEGORY_KEYS)[number];

/** Per-event-type notification configuration */
export interface EventNotificationConfig {
  eventType: InternalEventType;
  source: SourceType;
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
