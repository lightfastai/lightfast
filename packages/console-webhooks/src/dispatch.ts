import type { PostTransformEvent, SourceType } from "@repo/console-validation";
import type { TransformContext } from "./transform-context";
import type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
} from "./pre-transformers/github";
import type { PreTransformVercelWebhookPayload } from "./pre-transformers/vercel";
import type {
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
} from "./pre-transformers/linear";
import type {
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
} from "./pre-transformers/sentry";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./pre-transformers/github";
import { transformVercelDeployment } from "./pre-transformers/vercel";
import {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "./pre-transformers/linear";
import {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "./pre-transformers/sentry";

type TransformerFn = (payload: unknown, context: TransformContext) => PostTransformEvent;

/**
 * Dispatch table: maps (source, category) → transformer function.
 *
 * Categories correspond to PROVIDER_REGISTRY event keys (entity-level).
 * The `resolveCategory()` function normalizes wire eventType formats
 * to these category keys before lookup.
 *
 * Safety: `payload` crosses a service boundary (relay → console via QStash).
 * Casts are safe because the relay verifies HMAC + runs Zod validation,
 * and each transformer validates output via validatePostTransformEvent().
 */
const DISPATCH_TABLE: Record<SourceType, Record<string, TransformerFn>> = {
  github: {
    push: (p, ctx) => transformGitHubPush(p as PreTransformGitHubPushEvent, ctx),
    pull_request: (p, ctx) => transformGitHubPullRequest(p as PreTransformGitHubPullRequestEvent, ctx),
    issues: (p, ctx) => transformGitHubIssue(p as PreTransformGitHubIssuesEvent, ctx),
    release: (p, ctx) => transformGitHubRelease(p as PreTransformGitHubReleaseEvent, ctx),
    discussion: (p, ctx) => transformGitHubDiscussion(p as PreTransformGitHubDiscussionEvent, ctx),
  },
  vercel: {
    deployment: (p, ctx) => transformVercelDeployment(p as PreTransformVercelWebhookPayload, ctx),
  },
  sentry: {
    issue: (p, ctx) => transformSentryIssue(p as PreTransformSentryIssueWebhook, ctx),
    error: (p, ctx) => transformSentryError(p as PreTransformSentryErrorWebhook, ctx),
    event_alert: (p, ctx) => transformSentryEventAlert(p as PreTransformSentryEventAlertWebhook, ctx),
    metric_alert: (p, ctx) => transformSentryMetricAlert(p as PreTransformSentryMetricAlertWebhook, ctx),
  },
  linear: {
    Issue: (p, ctx) => transformLinearIssue(p as PreTransformLinearIssueWebhook, ctx),
    Comment: (p, ctx) => transformLinearComment(p as PreTransformLinearCommentWebhook, ctx),
    Project: (p, ctx) => transformLinearProject(p as PreTransformLinearProjectWebhook, ctx),
    Cycle: (p, ctx) => transformLinearCycle(p as PreTransformLinearCycleWebhook, ctx),
    ProjectUpdate: (p, ctx) => transformLinearProjectUpdate(p as PreTransformLinearProjectUpdateWebhook, ctx),
  },
};

/**
 * Normalize wire eventType to dispatch category.
 *
 * Wire formats vary by provider:
 * - GitHub: eventType = category directly ("push", "pull_request")
 * - Vercel: "deployment.created" → "deployment" (all share one transformer)
 * - Sentry: "issue" = category; also handles compound "issue.created" from test data
 * - Linear: "Issue:create" → "Issue" (entity before colon)
 */
function resolveCategory(source: SourceType, eventType: string): string {
  switch (source) {
    case "linear":
      return eventType.split(":")[0] ?? "";
    case "vercel":
      return eventType.split(".")[0] ?? eventType;
    case "sentry":
      // Wire sends "issue", "error", "event_alert", "metric_alert"
      // Test data may send compound "issue.created" — normalize to entity
      return eventType.split(".")[0] ?? eventType;
    default:
      return eventType;
  }
}

/** Compile-time exhaustiveness check — errors if a union member is unhandled */
function assertNever(x: never): never {
  throw new Error(`Unhandled provider: ${String(x)}`);
}

/**
 * Central webhook payload transformer.
 * Routes (provider, eventType) to the appropriate transformer via DISPATCH_TABLE.
 * Returns null for unsupported event types.
 *
 * This is the SINGLE dispatch point for all webhook transformations.
 * Consumers should call this function, not reimplement routing.
 */
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  if (!(provider in DISPATCH_TABLE)) assertNever(provider as never);

  const category = resolveCategory(provider, eventType);
  const transformer = DISPATCH_TABLE[provider][category];
  if (!transformer) return null;

  return transformer(payload, { ...context, eventType });
}
