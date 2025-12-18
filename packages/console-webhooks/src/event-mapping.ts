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
  push: "push",

  // Pull requests
  pull_request_opened: "pull-request.opened",
  pull_request_closed: "pull-request.closed",
  pull_request_merged: "pull-request.merged",
  pull_request_reopened: "pull-request.reopened",
  pull_request_ready_for_review: "pull-request.ready-for-review",

  // Issues
  issue_opened: "issue.opened",
  issue_closed: "issue.closed",
  issue_reopened: "issue.reopened",

  // Releases
  release_published: "release.published",
  release_created: "release.created",

  // Discussions
  discussion_created: "discussion.created",
  discussion_answered: "discussion.answered",
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
export function toExternalGitHubEvent(
  internalType: InternalEventType
): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}
