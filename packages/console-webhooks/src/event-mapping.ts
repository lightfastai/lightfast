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
 * External format: "{eventType}" from SentryWebhookEventType (e.g., "issue.created", "error")
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
 * Linear actions are normalized: create->created, update->updated, remove->deleted
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
  action?: string,
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
  eventType: string,
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
  eventType: string,
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
  action: string,
): InternalEventType | undefined {
  const key = `${type}:${action}`;
  return LINEAR_TO_INTERNAL[key];
}

/**
 * Internal format to external format mapping (for logging/debugging).
 */
export const INTERNAL_TO_GITHUB: Record<string, string> = Object.fromEntries(
  Object.entries(GITHUB_TO_INTERNAL).map(([ext, int]) => [int, ext]),
);

/**
 * Convert internal event type to external GitHub format.
 * Useful for logging and debugging.
 */
export function toExternalGitHubEvent(
  internalType: InternalEventType,
): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}
