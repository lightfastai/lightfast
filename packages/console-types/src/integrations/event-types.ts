/**
 * Internal Event Type System
 *
 * Standardized event format using {source}:{entity}.{action} convention.
 * All event names use hyphens (kebab-case), not underscores.
 *
 * External formats (from webhooks) are mapped to internal format at the boundary.
 */

import type { SourceType } from "@repo/console-validation";

/**
 * Internal event type configuration
 */
interface EventTypeConfig {
  source: SourceType;
  label: string;
  weight: number; // Base significance weight (0-100)
}

/**
 * All supported internal event types.
 * Source of truth for event type validation and scoring.
 */
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

/**
 * Internal event type union derived from const object
 */
export type InternalEventType = keyof typeof INTERNAL_EVENT_TYPES;

/**
 * All internal event types as array (for iteration)
 */
export const ALL_INTERNAL_EVENT_TYPES = Object.keys(
  INTERNAL_EVENT_TYPES
) as InternalEventType[];

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
  if (!isInternalEventType(eventType)) {
    return 35; // Default weight for unknown events
  }
  return INTERNAL_EVENT_TYPES[eventType].weight;
}

/**
 * Check if string is valid internal event type
 */
export function isInternalEventType(value: string): value is InternalEventType {
  return value in INTERNAL_EVENT_TYPES;
}
