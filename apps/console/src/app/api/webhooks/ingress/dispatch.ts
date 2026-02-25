import { inngest } from "@api/console/inngest";
import type { WebhookEnvelope } from "@repo/gateway-types";
import type { TransformContext, SourceEvent } from "@repo/console-types";
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
import type { VercelWebhookPayload, VercelWebhookEventType } from "@repo/console-webhooks";
import type { LinearWebhookEventType } from "@repo/console-webhooks";
import type { SentryWebhookEventType } from "@repo/console-webhooks";
import type { PushEvent, PullRequestEvent, IssuesEvent, ReleaseEvent, DiscussionEvent } from "@repo/console-webhooks";
import type { ResolvedWorkspace } from "./resolve-workspace";

/**
 * Route GitHub webhook events to the appropriate transformer.
 * Returns null for unsupported event types.
 */
function transformGitHubEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): SourceEvent | null {
  switch (eventType) {
    case "push":
      return transformGitHubPush(payload as PushEvent, context);
    case "pull_request":
      return transformGitHubPullRequest(payload as PullRequestEvent, context);
    case "issues":
      return transformGitHubIssue(payload as IssuesEvent, context);
    case "release":
      return transformGitHubRelease(payload as ReleaseEvent, context);
    case "discussion":
      return transformGitHubDiscussion(payload as DiscussionEvent, context);
    default:
      return null;
  }
}

/**
 * Route Linear webhook events to the appropriate transformer.
 * Gateway encodes eventType as "Type:action" (e.g., "Issue:create", "Comment:update").
 */
function transformLinearEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): SourceEvent | null {
  // Extract entity type from "Type:action" format
  const entityType = eventType.split(":")[0] ?? "";
  if (!(entityType in linearTransformers)) return null;
  const transformer = linearTransformers[entityType as LinearWebhookEventType];
  return transformer(payload, context);
}

/**
 * Route Sentry webhook events to the appropriate transformer.
 * Gateway uses the sentry-hook-resource header as eventType ("issue", "error", etc.).
 */
function transformSentryEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): SourceEvent | null {
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
 */
function transformVercelEvent(
  eventType: string,
  payload: unknown,
  context: TransformContext,
): SourceEvent | null {
  if (!eventType.startsWith("deployment")) return null;
  return transformVercelDeployment(
    payload as VercelWebhookPayload,
    eventType as VercelWebhookEventType,
    context,
  );
}

/**
 * Dispatch a Gateway webhook envelope to Inngest.
 *
 * Routes:
 * - All supported events → observation.capture (neural memory)
 *
 * Note: github.push dispatch (for code indexing) requires sourceId from
 * workspaceIntegrations which is wired in Phase 6 (Connection Sync).
 */
export async function dispatchToInngest(
  envelope: WebhookEnvelope,
  workspace: ResolvedWorkspace,
): Promise<void> {
  const { provider, eventType, payload, deliveryId, receivedAt } = envelope;
  const context: TransformContext = {
    deliveryId,
    receivedAt: new Date(receivedAt),
  };

  let sourceEvent: SourceEvent | null = null;

  switch (provider) {
    case "github":
      sourceEvent = transformGitHubEvent(eventType, payload, context);
      break;
    case "vercel":
      sourceEvent = transformVercelEvent(eventType, payload, context);
      break;
    case "linear":
      sourceEvent = transformLinearEvent(eventType, payload, context);
      break;
    case "sentry":
      sourceEvent = transformSentryEvent(eventType, payload, context);
      break;
  }

  if (!sourceEvent) {
    console.log(
      `[ingress/dispatch] No transformer for ${envelope.provider}:${eventType}, skipping observation`,
    );
    return;
  }

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent,
      ingestionSource: "webhook",
    },
  });
}
