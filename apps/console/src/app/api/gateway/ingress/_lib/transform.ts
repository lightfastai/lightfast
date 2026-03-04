import type { WebhookEnvelope } from "@repo/gateway-types";
import type { PostTransformEvent } from "@repo/console-validation";
import type { TransformContext } from "@repo/console-webhooks";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  linearTransformers,
  sentryTransformers,
  transformVercelDeployment,
} from "@repo/console-webhooks";
import type { PreTransformVercelWebhookPayload, VercelWebhookEventType } from "@repo/console-webhooks";
import type { LinearWebhookEventType } from "@repo/console-webhooks";
import type { SentryWebhookEventType } from "@repo/console-webhooks";
import type { PreTransformGitHubPushEvent, PreTransformGitHubPullRequestEvent, PreTransformGitHubIssuesEvent, PreTransformGitHubReleaseEvent, PreTransformGitHubDiscussionEvent } from "@repo/console-webhooks";

/**
 * Route GitHub webhook events to the appropriate transformer.
 * Returns null for unsupported event types.
 *
 * Safety: `payload` is typed as `unknown` because `WebhookEnvelope.payload` is
 * a cross-service boundary type. The casts below are safe because:
 *  1. The relay verifies HMAC signatures (webhook authenticity) before accepting payloads
 *  2. The relay runs `provider.parsePayload()` (Zod) to validate structure — invalid
 *     payloads are rejected with 400 and never forwarded to Console
 *  3. Each transformer validates its output via `validatePostTransformEvent()` (Zod safeParse)
 *
 * Full runtime validation of every provider event shape (PushEvent, PullRequestEvent, etc.)
 * is intentionally omitted — these types mirror upstream provider API contracts which are
 * already enforced by HMAC-authenticated webhook delivery.
 */
function transformGitHubEvent(
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

/**
 * Route Linear webhook events to the appropriate transformer.
 * Relay encodes eventType as "Type:action" (e.g., "Issue:create", "Comment:update").
 * See transformGitHubEvent JSDoc for payload trust model.
 */
function transformLinearEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  // Extract entity type from "Type:action" format
  const entityType = eventType.split(":")[0] ?? "";
  if (!(entityType in linearTransformers)) return null;
  const transformer = linearTransformers[entityType as LinearWebhookEventType];
  return transformer(payload, context);
}

/**
 * Route Sentry webhook events to the appropriate transformer.
 * Relay uses the sentry-hook-resource header as eventType ("issue", "error", etc.).
 * See transformGitHubEvent JSDoc for payload trust model.
 */
function transformSentryEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  // For issue events, the payload action determines the sub-type
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

/**
 * Route Vercel webhook events to the appropriate transformer.
 * All Vercel events are deployment events.
 * See transformGitHubEvent JSDoc for payload trust model.
 */
function transformVercelEvent(
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

/**
 * Transform a webhook envelope into a PostTransformEvent.
 * Routes to the appropriate per-provider transformer.
 * Returns null for unsupported event types.
 */
export function transformEnvelope(
  envelope: WebhookEnvelope,
): PostTransformEvent | null {
  const { provider, eventType, payload, deliveryId, receivedAt } = envelope;
  const context: TransformContext = {
    deliveryId,
    receivedAt: new Date(receivedAt),
  };

  switch (provider) {
    case "github":
      return transformGitHubEvent(eventType, payload, context);
    case "vercel":
      return transformVercelEvent(eventType, payload, context);
    case "linear":
      return transformLinearEvent(eventType, payload, context);
    case "sentry":
      return transformSentryEvent(eventType, payload, context);
    default:
      return null;
  }
}
