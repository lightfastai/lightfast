/**
 * Internal Event Type System
 *
 * Standardized event format using <event-name>.<action> convention.
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
  push: { source: "github", label: "Push", weight: 30 },
  "pull-request.opened": { source: "github", label: "PR Opened", weight: 50 },
  "pull-request.closed": { source: "github", label: "PR Closed", weight: 45 },
  "pull-request.merged": { source: "github", label: "PR Merged", weight: 60 },
  "pull-request.reopened": {
    source: "github",
    label: "PR Reopened",
    weight: 40,
  },
  "pull-request.ready-for-review": {
    source: "github",
    label: "Ready for Review",
    weight: 45,
  },
  "issue.opened": { source: "github", label: "Issue Opened", weight: 45 },
  "issue.closed": { source: "github", label: "Issue Closed", weight: 40 },
  "issue.reopened": { source: "github", label: "Issue Reopened", weight: 40 },
  "release.published": {
    source: "github",
    label: "Release Published",
    weight: 75,
  },
  "release.created": { source: "github", label: "Release Created", weight: 70 },
  "discussion.created": {
    source: "github",
    label: "Discussion Created",
    weight: 35,
  },
  "discussion.answered": {
    source: "github",
    label: "Discussion Answered",
    weight: 40,
  },

  // Vercel events (already in dot notation)
  "deployment.created": {
    source: "vercel",
    label: "Deployment Started",
    weight: 30,
  },
  "deployment.succeeded": {
    source: "vercel",
    label: "Deployment Succeeded",
    weight: 40,
  },
  "deployment.ready": {
    source: "vercel",
    label: "Deployment Ready",
    weight: 40,
  },
  "deployment.error": {
    source: "vercel",
    label: "Deployment Failed",
    weight: 70,
  },
  "deployment.canceled": {
    source: "vercel",
    label: "Deployment Canceled",
    weight: 65,
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
