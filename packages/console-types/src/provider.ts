/**
 * Provider Registry — Single Source of Truth
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
 * 2. If this is a new category, add it to PROVIDER_REGISTRY[source].events:
 *    categoryKey: {
 *      label: "Category Name",
 *      description: "What this category captures",
 *      type: "observation",
 *    }
 *
 * 3. Write the transformer in console-webhooks/src/transformers/{source}.ts
 *
 * That's it. UI exports and webhook dispatch types are auto-derived.
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

interface ProviderDef {
  name: string;
  description: string;
  events: Record<string, CategoryDef>;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

export const PROVIDER_REGISTRY = {
  github: {
    name: "GitHub",
    description: "Connect your GitHub repositories",
    events: {
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
  },
  vercel: {
    name: "Vercel",
    description: "Connect your Vercel projects",
    events: {
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
  },
  sentry: {
    name: "Sentry",
    description: "Connect your Sentry projects",
    events: {
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
  },
  linear: {
    name: "Linear",
    description: "Connect your Linear workspace",
    events: {
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
  },
} as const satisfies Record<SourceType, ProviderDef>;

/** Backwards-compatible alias: per-provider event category definitions */
export const EVENT_CATEGORIES: {
  [K in SourceType]: (typeof PROVIDER_REGISTRY)[K]["events"];
} = {
  github: PROVIDER_REGISTRY.github.events,
  vercel: PROVIDER_REGISTRY.vercel.events,
  sentry: PROVIDER_REGISTRY.sentry.events,
  linear: PROVIDER_REGISTRY.linear.events,
};

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

// ─── Pipeline Type Re-exports ─────────────────────────────────────────────────

// PreTransform types (wire payload shapes as received from providers)
export type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  PreTransformVercelWebhookPayload,
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
} from "@repo/console-webhooks";

// PostTransform types (normalized event shapes after transformation)
export type {
  PostTransformEvent,
  PostTransformActor,
  PostTransformReference,
} from "@repo/console-validation";

// ─── Lookup Functions ─────────────────────────────────────────────────────────

/**
 * Get base weight for scoring. Returns 35 for unknown events.
 * Constructs internal key "{source}:{sourceType}" from PostTransformEvent fields.
 */
export function getEventWeight(source: string, sourceType: string): number {
  const key = `${source}:${sourceType}`;
  if (!(key in EVENT_REGISTRY)) return 35;
  return EVENT_REGISTRY[key as keyof typeof EVENT_REGISTRY].weight;
}

// ─── Derived UI Exports ───────────────────────────────────────────────────────

type GitHubEventKey = keyof (typeof PROVIDER_REGISTRY)["github"]["events"];
type VercelEventKey = keyof (typeof PROVIDER_REGISTRY)["vercel"]["events"];
type SentryEventKey = keyof (typeof PROVIDER_REGISTRY)["sentry"]["events"];
type LinearEventKey = keyof (typeof PROVIDER_REGISTRY)["linear"]["events"];

export const ALL_GITHUB_EVENTS = Object.keys(PROVIDER_REGISTRY.github.events) as GitHubEventKey[];
export const ALL_VERCEL_EVENTS = Object.keys(PROVIDER_REGISTRY.vercel.events) as VercelEventKey[];
export const ALL_SENTRY_EVENTS = Object.keys(PROVIDER_REGISTRY.sentry.events) as SentryEventKey[];
export const ALL_LINEAR_EVENTS = Object.keys(PROVIDER_REGISTRY.linear.events) as LinearEventKey[];

/**
 * Valid webhook eventType values per source for test data and schema generation.
 *
 * These are the dispatch-level identifiers that arrive on the wire:
 * - GitHub/Linear: category-level (action comes from payload body)
 * - Vercel: specific event types (same as categories)
 * - Sentry: specific event types from EVENT_REGISTRY externalKeys
 */
export const WEBHOOK_EVENT_TYPES = {
  github: ALL_GITHUB_EVENTS as string[],
  vercel: ALL_VERCEL_EVENTS as string[],
  sentry: [...new Set(
    Object.values(EVENT_REGISTRY)
      .filter((e) => e.source === "sentry")
      .flatMap((e) => [...e.externalKeys]),
  )],
  linear: ALL_LINEAR_EVENTS as string[],
};
