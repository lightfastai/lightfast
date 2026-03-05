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
 *      externalKeys: ["wire_event_type"],  // must match real provider wire format
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
 * 3. If this is a new ENTITY (not just a new action on an existing entity),
 *    add a payload pattern line to EventPreTransformMap.
 *
 * 4. Write the transformer in console-webhooks/src/pre-transformers/{source}.ts
 *
 * That's it. UI exports and webhook dispatch types are auto-derived.
 *
 * Internal format: {source}:{entity}.{action} with kebab-case
 * External format (externalKeys): must match the real provider wire format exactly.
 * Multiple registry entries may share the same externalKey (e.g., all GitHub PR
 * actions share "pull_request" because the action comes from the payload body).
 */

import type { SourceType } from "@repo/console-validation";
import type {
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
  GitHubWebhookEventType,
  LinearWebhookEventType,
  SentryWebhookEventType,
} from "@repo/console-webhooks";

// ─── Schema ───────────────────────────────────────────────────────────────────

interface EventDef {
  source: SourceType;
  label: string;
  weight: number;
  externalKeys: readonly string[];
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

// ─── Type Utilities ──────────────────────────────────────────────────────────

/** Extract the source prefix from an event key: "github:push" → "github" */
type SourceFromKey<K extends string> = K extends `${infer S}:${string}` ? S : never;

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

// ─── Event Registry (single source of truth for event keys) ──────────────────

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
    externalKeys: ["pull_request"],
    category: "pull_request",
  },
  "github:pull-request.closed": {
    source: "github",
    label: "PR Closed",
    weight: 45,
    externalKeys: ["pull_request"],
    category: "pull_request",
  },
  "github:pull-request.merged": {
    source: "github",
    label: "PR Merged",
    weight: 60,
    externalKeys: ["pull_request"],
    category: "pull_request",
  },
  "github:pull-request.reopened": {
    source: "github",
    label: "PR Reopened",
    weight: 40,
    externalKeys: ["pull_request"],
    category: "pull_request",
  },
  "github:pull-request.ready-for-review": {
    source: "github",
    label: "Ready for Review",
    weight: 45,
    externalKeys: ["pull_request"],
    category: "pull_request",
  },
  "github:issue.opened": {
    source: "github",
    label: "Issue Opened",
    weight: 45,
    externalKeys: ["issues"],
    category: "issues",
  },
  "github:issue.closed": {
    source: "github",
    label: "Issue Closed",
    weight: 40,
    externalKeys: ["issues"],
    category: "issues",
  },
  "github:issue.reopened": {
    source: "github",
    label: "Issue Reopened",
    weight: 40,
    externalKeys: ["issues"],
    category: "issues",
  },
  "github:release.published": {
    source: "github",
    label: "Release Published",
    weight: 75,
    externalKeys: ["release"],
    category: "release",
  },
  "github:release.created": {
    source: "github",
    label: "Release Created",
    weight: 70,
    externalKeys: ["release"],
    category: "release",
  },
  "github:discussion.created": {
    source: "github",
    label: "Discussion Created",
    weight: 35,
    externalKeys: ["discussion"],
    category: "discussion",
  },
  "github:discussion.answered": {
    source: "github",
    label: "Discussion Answered",
    weight: 40,
    externalKeys: ["discussion"],
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
    externalKeys: ["issue"],
    category: "issue",
  },
  "sentry:issue.resolved": {
    source: "sentry",
    label: "Issue Resolved",
    weight: 50,
    externalKeys: ["issue"],
    category: "issue",
  },
  "sentry:issue.assigned": {
    source: "sentry",
    label: "Issue Assigned",
    weight: 30,
    externalKeys: ["issue"],
    category: "issue",
  },
  "sentry:issue.ignored": {
    source: "sentry",
    label: "Issue Ignored",
    weight: 25,
    externalKeys: ["issue"],
    category: "issue",
  },
  "sentry:issue.archived": {
    source: "sentry",
    label: "Issue Archived",
    weight: 25,
    externalKeys: ["issue"],
    category: "issue",
  },
  "sentry:issue.unresolved": {
    source: "sentry",
    label: "Issue Unresolved",
    weight: 45,
    externalKeys: ["issue"],
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
} as const satisfies Record<`${SourceType}:${string}`, EventDef>;

// ─── Derived Types ───────────────────────────────────────────────────────────

/** All valid internal event keys — derived from EVENT_REGISTRY */
export type EventKey = keyof typeof EVENT_REGISTRY;

/** All event keys for a specific source */
export type KeysForSource<S extends SourceType> = Extract<EventKey, `${S}:${string}`>;

/** Extract the sub-type: "github:pull-request.opened" → "pull-request.opened" */
export type EventSubType<K extends EventKey> = K extends `${string}:${infer Sub}` ? Sub : never;

/**
 * Maps event keys to their wire-level payload types via pattern matching.
 *
 * Adding a new ACTION on an existing entity (e.g., "github:pull-request.review-requested")
 * automatically gets the correct payload type — no edit needed here.
 *
 * Adding a new ENTITY requires one new pattern line below.
 */
export type EventPreTransformMap =
  // GitHub — 5 entity patterns
  & Record<Extract<EventKey, "github:push">, PreTransformGitHubPushEvent>
  & Record<Extract<EventKey, `github:pull-request.${string}`>, PreTransformGitHubPullRequestEvent>
  & Record<Extract<EventKey, `github:issue.${string}`>, PreTransformGitHubIssuesEvent>
  & Record<Extract<EventKey, `github:release.${string}`>, PreTransformGitHubReleaseEvent>
  & Record<Extract<EventKey, `github:discussion.${string}`>, PreTransformGitHubDiscussionEvent>
  // Vercel — single payload type for all deployment events
  & Record<Extract<EventKey, `vercel:${string}`>, PreTransformVercelWebhookPayload>
  // Sentry — 4 distinct payload types
  & Record<Extract<EventKey, `sentry:issue.${string}`>, PreTransformSentryIssueWebhook>
  & Record<Extract<EventKey, "sentry:error">, PreTransformSentryErrorWebhook>
  & Record<Extract<EventKey, "sentry:event-alert">, PreTransformSentryEventAlertWebhook>
  & Record<Extract<EventKey, "sentry:metric-alert">, PreTransformSentryMetricAlertWebhook>
  // Linear — 5 entity patterns
  & Record<Extract<EventKey, `linear:issue.${string}`>, PreTransformLinearIssueWebhook>
  & Record<Extract<EventKey, `linear:comment.${string}`>, PreTransformLinearCommentWebhook>
  & Record<Extract<EventKey, `linear:project-update.${string}`>, PreTransformLinearProjectUpdateWebhook>
  & Record<Extract<EventKey, `linear:project.${string}`>, PreTransformLinearProjectWebhook>
  & Record<Extract<EventKey, `linear:cycle.${string}`>, PreTransformLinearCycleWebhook>;

/** Get the pre-transform payload type for an event key at compile time */
export type PreTransformFor<K extends EventKey> = EventPreTransformMap[K];

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
export function getEventWeight(source: SourceType, sourceType: string): number {
  const key = `${source}:${sourceType}`;
  if (!(key in EVENT_REGISTRY)) return 35;
  return EVENT_REGISTRY[key as EventKey].weight;
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
 * All providers use category-level keys that match the real wire format:
 * - GitHub: X-GitHub-Event header ("push", "pull_request", "issues", etc.)
 * - Vercel: payload.type ("deployment.created", "deployment.ready", etc.)
 * - Sentry: sentry-hook-resource header ("issue", "error", "event_alert", "metric_alert")
 * - Linear: payload.type ("Issue", "Comment", "Project", etc.)
 */
export const WEBHOOK_EVENT_TYPES = {
  github: ALL_GITHUB_EVENTS as string[],
  vercel: ALL_VERCEL_EVENTS as string[],
  sentry: ALL_SENTRY_EVENTS as string[],
  linear: ALL_LINEAR_EVENTS as string[],
};

// ─── Compile-Time Assertions ──────────────────────────────────────────────────

/** @internal Assert T is a subtype of U — compile error if not */
type AssertExtends<T extends U, U> = T;

// Every entry's `source` must match its key prefix (e.g., "github:push" → source: "github")
type _AssertSources = AssertExtends<
  { [K in EventKey]: (typeof EVENT_REGISTRY)[K]["source"] },
  { [K in EventKey]: SourceFromKey<K> & SourceType }
>;

// Every entry's `category` must be a valid PROVIDER_REGISTRY category for its source
type _AssertCategories = AssertExtends<
  { [K in EventKey]: (typeof EVENT_REGISTRY)[K]["category"] },
  { [K in EventKey]: string & keyof (typeof PROVIDER_REGISTRY)[SourceFromKey<K> & SourceType]["events"] }
>;

// Payload map must cover exactly the same keys as EVENT_REGISTRY
type _AssertPayloadCoverage = AssertExtends<EventKey, keyof EventPreTransformMap>;
type _AssertPayloadExact = AssertExtends<keyof EventPreTransformMap, EventKey>;

// Transformer maps in @repo/console-webhooks must handle all dispatch categories
type GitHubDispatchKey = (typeof EVENT_REGISTRY)[Extract<EventKey, `github:${string}`>]["category"];
type LinearDispatchKey = (typeof EVENT_REGISTRY)[Extract<EventKey, `linear:${string}`>]["category"];
type SentryDispatchKey = (typeof EVENT_REGISTRY)[Extract<EventKey, `sentry:${string}`>]["category"];

type _AssertGitHubCoverage = AssertExtends<GitHubDispatchKey, GitHubWebhookEventType>;
type _AssertGitHubExact = AssertExtends<GitHubWebhookEventType, GitHubDispatchKey>;

type _AssertLinearCoverage = AssertExtends<LinearDispatchKey, LinearWebhookEventType>;
type _AssertLinearExact = AssertExtends<LinearWebhookEventType, LinearDispatchKey>;

type _AssertSentryCoverage = AssertExtends<SentryDispatchKey, SentryWebhookEventType>;
type _AssertSentryExact = AssertExtends<SentryWebhookEventType, SentryDispatchKey>;

// Vercel: single transformer handles all deployment events — no dispatch key assertion needed

// SourceType is the single canonical type for provider names (previously ProviderName in gateway-types)
