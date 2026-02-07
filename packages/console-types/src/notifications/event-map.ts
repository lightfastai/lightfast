import type { InternalEventType } from "../integrations/event-types";
import type { EventNotificationConfig } from "./rubric";

/**
 * The notification rubric — source of truth for dispatch decisions.
 * Maps event types to their notification configuration.
 *
 * Typed as Record<InternalEventType, ...> to enforce compile-time alignment
 * with the canonical event type system in integrations/event-types.ts.
 *
 * Categories:
 * - CRITICAL: Production impact, security, data loss risk -> immediate notification
 * - WORKFLOW: State changes in development workflow -> apply worthiness test
 * - AMBIENT: Routine activity, low information value -> digest only
 */
export const NOTIFICATION_RUBRIC: Record<
  InternalEventType,
  EventNotificationConfig
> = {
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
    condition:
      "Only if user is a requested reviewer or PR touches their owned files",
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
    condition:
      "Only if triggers cross-tool correlation or user authored a related PR",
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
