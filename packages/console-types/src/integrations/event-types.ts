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
 *
 * Internal format: {source}:{entity}.{action} with kebab-case
 * External formats vary by provider (see externalKeys on each entry).
 */

import type { SourceType } from "@repo/console-validation";

// ─── Schema ───────────────────────────────────────────────────────────────────

interface EventDef {
  source: SourceType;
  /** Action-level label for activity feeds (e.g., "PR Opened") */
  label: string;
  /** Base significance weight (0-100) for scoring */
  weight: number;
  /**
   * External webhook key(s) that map to this internal type.
   * GitHub: "{event}_{action}" or "{event}" (e.g., "pull_request_opened", "push")
   * Vercel: "{type}" (e.g., "deployment.created")
   * Sentry: "{eventType}" (e.g., "issue.created", "metric_alert")
   * Linear: "{Type}:{action}" (e.g., "Issue:create", "ProjectUpdate:remove")
   */
  externalKeys: readonly string[];
  /**
   * UI subscription category key (external format).
   * Multiple internal events share one category for coarse-grained UI toggles.
   */
  category: string;
}

interface CategoryDef {
  label: string;
  description: string;
  type: "observation" | "sync+observation";
}

// ─── Category Definitions (UI subscription metadata) ──────────────────────────

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
    "deployment.check-rerequested": {
      label: "Check Re-requested",
      description: "Capture deployment check re-request events",
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
  "vercel:deployment.check-rerequested": {
    source: "vercel",
    label: "Deployment Check Re-requested",
    weight: 25,
    externalKeys: ["deployment.check-rerequested"],
    category: "deployment.check-rerequested",
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
    label: "Error",
    weight: 45,
    externalKeys: ["error"],
    category: "error",
  },
  "sentry:event-alert": {
    source: "sentry",
    label: "Alert Triggered",
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
    label: "Comment Added",
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
    label: "Project Update Posted",
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
  EVENT_REGISTRY,
) as InternalEventType[];

// ─── Backward-Compatible Alias ────────────────────────────────────────────────

/** @deprecated Use EVENT_REGISTRY directly */
export const INTERNAL_EVENT_TYPES = EVENT_REGISTRY;

// ─── Lookup Functions ─────────────────────────────────────────────────────────

/** Get full event config by internal type */
export function getEventConfig(
  eventType: InternalEventType,
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
  value: string,
): value is InternalEventType {
  return value in EVENT_REGISTRY;
}

// ─── Auto-Derived Mapping Tables ──────────────────────────────────────────────

function buildExternalToInternalMap(
  source: SourceType,
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

export const GITHUB_TO_INTERNAL = buildExternalToInternalMap("github");
export const VERCEL_TO_INTERNAL = buildExternalToInternalMap("vercel");
export const SENTRY_TO_INTERNAL = buildExternalToInternalMap("sentry");
export const LINEAR_TO_INTERNAL = buildExternalToInternalMap("linear");

export const INTERNAL_TO_GITHUB: Record<string, string> = Object.fromEntries(
  Object.entries(GITHUB_TO_INTERNAL).map(([ext, int]) => [int, ext]),
);

// ─── Auto-Derived Mapping Functions ───────────────────────────────────────────

/**
 * GitHub: external event format -> internal event type.
 * @param event - GitHub event name (e.g., "pull_request")
 * @param action - GitHub action (e.g., "opened")
 */
export function toInternalGitHubEvent(
  event: string,
  action?: string,
): InternalEventType | undefined {
  const key = action ? `${event}_${action}` : event;
  return GITHUB_TO_INTERNAL[key];
}

/** Vercel: event type string -> internal event type */
export function toInternalVercelEvent(
  eventType: string,
): InternalEventType | undefined {
  return VERCEL_TO_INTERNAL[eventType];
}

/** Sentry: event type string -> internal event type */
export function toInternalSentryEvent(
  eventType: string,
): InternalEventType | undefined {
  return SENTRY_TO_INTERNAL[eventType];
}

/** Linear: webhook type + action -> internal event type */
export function toInternalLinearEvent(
  type: string,
  action: string,
): InternalEventType | undefined {
  return LINEAR_TO_INTERNAL[`${type}:${action}`];
}

/** Reverse: internal event type -> external GitHub format */
export function toExternalGitHubEvent(
  internalType: InternalEventType,
): string | undefined {
  return INTERNAL_TO_GITHUB[internalType];
}

// ─── Helper Function ──────────────────────────────────────────────────────────

/**
 * Strip source prefix from internal event type.
 * Converts "github:pull-request.opened" → "pull-request.opened"
 * @param internalType - Internal event type with source prefix
 */
function stripSourcePrefix(internalType: string): string {
  const colonIndex = internalType.indexOf(":");
  return colonIndex > 0 ? internalType.slice(colonIndex + 1) : internalType;
}

// ─── External Format Functions (SourceEvent.sourceType) ──────────────────────

/**
 * GitHub: external event format -> SourceEvent.sourceType (WITHOUT prefix).
 * Use this when creating SourceEvents in transformers.
 * @param event - GitHub event name (e.g., "pull_request")
 * @param action - GitHub action (e.g., "opened")
 */
export function toExternalGitHubEventType(
  event: string,
  action?: string,
): string | undefined {
  const internal = toInternalGitHubEvent(event, action);
  if (!internal) return undefined;
  return stripSourcePrefix(internal);
}

/**
 * Vercel: event type string -> SourceEvent.sourceType (WITHOUT prefix).
 * Use this when creating SourceEvents in transformers.
 */
export function toExternalVercelEventType(
  eventType: string,
): string | undefined {
  const internal = toInternalVercelEvent(eventType);
  if (!internal) return undefined;
  return stripSourcePrefix(internal);
}

/**
 * Sentry: event type string -> SourceEvent.sourceType (WITHOUT prefix).
 * Use this when creating SourceEvents in transformers.
 */
export function toExternalSentryEventType(
  eventType: string,
): string | undefined {
  const internal = toInternalSentryEvent(eventType);
  if (!internal) return undefined;
  return stripSourcePrefix(internal);
}

/**
 * Linear: webhook type + action -> SourceEvent.sourceType (WITHOUT prefix).
 * Use this when creating SourceEvents in transformers.
 */
export function toExternalLinearEventType(
  type: string,
  action: string,
): string | undefined {
  const internal = toInternalLinearEvent(type, action);
  if (!internal) return undefined;
  return stripSourcePrefix(internal);
}

// ─── Auto-Derived UI Display Events ───────────────────────────────────────────

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

// ─── Auto-Derived Webhook Dispatch Types ──────────────────────────────────────

/**
 * Valid webhook eventType values per source for test data and schema generation.
 *
 * These are the dispatch-level identifiers that arrive on the wire:
 * - GitHub/Linear: category-level (action comes from payload body)
 * - Vercel/Sentry: specific event types
 */
export const WEBHOOK_EVENT_TYPES = {
  github: ALL_GITHUB_EVENTS as string[],
  vercel: ALL_VERCEL_EVENTS as string[],
  sentry: Object.keys(SENTRY_TO_INTERNAL) as string[],
  linear: ALL_LINEAR_EVENTS as string[],
};
