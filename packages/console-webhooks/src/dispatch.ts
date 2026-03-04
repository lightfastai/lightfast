import type { PostTransformEvent } from "@repo/console-validation";
import type { SourceType } from "@repo/console-validation";
import type { TransformContext } from "./transform-context";
import type {
  PreTransformGitHubPushEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
  PreTransformGitHubDiscussionEvent,
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
  LinearWebhookEventType,
  SentryWebhookEventType,
} from "./pre-transformers";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  linearTransformers,
  sentryTransformers,
  transformVercelDeployment,
} from "./pre-transformers";

/** Compile-time exhaustiveness check — errors if a union member is unhandled */
function assertNever(x: never): never {
  throw new Error(`Unhandled provider: ${String(x)}`);
}

/**
 * Central webhook payload transformer.
 * Routes (provider, eventType) to the appropriate per-provider transformer.
 * Returns null for unsupported event types.
 *
 * This is the SINGLE dispatch point for all webhook transformations.
 * Consumers should call this function, not reimplement routing.
 *
 * Safety: `payload` is typed as `unknown` because it crosses a service boundary
 * (relay → console via QStash). The casts are safe because:
 *  1. The relay verifies HMAC signatures before accepting payloads
 *  2. The relay runs provider.parsePayload() (Zod) to validate structure
 *  3. Each transformer validates its output via validatePostTransformEvent()
 */
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  switch (provider) {
    case "github":
      return transformGitHubPayload(eventType, payload, context);
    case "vercel":
      return transformVercelPayload(eventType, payload, context);
    case "linear":
      return transformLinearPayload(eventType, payload, context);
    case "sentry":
      return transformSentryPayload(eventType, payload, context);
    default:
      assertNever(provider);
  }
}

function transformGitHubPayload(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  switch (eventType) {
    case "push":
      return transformGitHubPush(payload as PreTransformGitHubPushEvent, context);
    case "pull_request":
      return transformGitHubPullRequest(payload as PreTransformGitHubPullRequestEvent, context);
    case "issues":
      return transformGitHubIssue(payload as PreTransformGitHubIssuesEvent, context);
    case "release":
      return transformGitHubRelease(payload as PreTransformGitHubReleaseEvent, context);
    case "discussion":
      return transformGitHubDiscussion(payload as PreTransformGitHubDiscussionEvent, context);
    default:
      return null;
  }
}

function transformLinearPayload(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  const entityType = eventType.split(":")[0] ?? "";
  if (!(entityType in linearTransformers)) return null;
  const transformer = linearTransformers[entityType as LinearWebhookEventType];
  return transformer(payload, context);
}

function transformSentryPayload(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  if (eventType === "issue") {
    const p = payload as { action?: string };
    const sentryKey = `issue.${p.action ?? "created"}`;
    if (!(sentryKey in sentryTransformers)) return null;
    const transformer = sentryTransformers[sentryKey as SentryWebhookEventType];
    return transformer(payload, context);
  }

  if (!(eventType in sentryTransformers)) return null;
  const transformer = sentryTransformers[eventType as SentryWebhookEventType];
  return transformer(payload, context);
}

function transformVercelPayload(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  if (!eventType.startsWith("deployment")) return null;
  return transformVercelDeployment(
    payload as PreTransformVercelWebhookPayload,
    eventType as VercelWebhookEventType,
    context,
  );
}
