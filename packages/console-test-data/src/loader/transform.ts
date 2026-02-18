/**
 * Webhook Transformer Integration
 *
 * Routes raw webhook payloads through production transformers.
 */

import type { SourceEvent, TransformContext } from "@repo/console-types";
import type { SourceType } from "@repo/console-validation";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  transformVercelDeployment,
  sentryTransformers,
  linearTransformers,
} from "@repo/console-webhooks/transformers";
import type {
  GitHubWebhookEventType,
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
  SentryWebhookEventType,
  SentryIssueWebhook,
  SentryErrorWebhook,
  SentryEventAlertWebhook,
  SentryMetricAlertWebhook,
  LinearWebhookEventType,
  LinearIssueWebhook,
  LinearCommentWebhook,
  LinearProjectWebhook,
  LinearCycleWebhook,
  LinearProjectUpdateWebhook,
} from "@repo/console-webhooks/transformers";
import type {
  VercelWebhookPayload,
  VercelWebhookEventType,
} from "@repo/console-webhooks";

export interface WebhookPayload {
  source: SourceType;
  eventType: string;
  payload: unknown;
}

interface GitHubWebhookPayload extends WebhookPayload {
  source: "github";
  eventType: GitHubWebhookEventType;
  payload: PushEvent | PullRequestEvent | IssuesEvent | ReleaseEvent | DiscussionEvent;
}

interface VercelWebhookPayloadWrapper extends WebhookPayload {
  source: "vercel";
  eventType: VercelWebhookEventType;
  payload: VercelWebhookPayload;
}

export interface SentryWebhookPayload extends WebhookPayload {
  source: "sentry";
  eventType: SentryWebhookEventType;
  payload: SentryIssueWebhook | SentryErrorWebhook | SentryEventAlertWebhook | SentryMetricAlertWebhook;
}

export interface LinearWebhookPayload extends WebhookPayload {
  source: "linear";
  eventType: LinearWebhookEventType;
  payload: LinearIssueWebhook | LinearCommentWebhook | LinearProjectWebhook | LinearCycleWebhook | LinearProjectUpdateWebhook;
}

/**
 * Generate a unique delivery ID for test webhooks
 */
const generateDeliveryId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Transform a raw webhook payload to SourceEvent using production transformers
 */
export function transformWebhook(
  webhook: WebhookPayload,
  index: number
): SourceEvent {
  const context: TransformContext = {
    deliveryId: generateDeliveryId(),
    receivedAt: new Date(),
  };

  switch (webhook.source) {
    case "github":
      return transformGitHubWebhook(
        webhook as GitHubWebhookPayload,
        context,
        index
      );
    case "vercel":
      return transformVercelWebhook(
        webhook as VercelWebhookPayloadWrapper,
        context,
        index
      );
    case "sentry":
      return transformSentryWebhookPayload(
        webhook as SentryWebhookPayload,
        context,
        index
      );
    case "linear":
      return transformLinearWebhookPayload(
        webhook as LinearWebhookPayload,
        context,
        index
      );
  }
}

function transformGitHubWebhook(
  webhook: GitHubWebhookPayload,
  context: TransformContext,
  index: number
): SourceEvent {
  let event: SourceEvent;

  switch (webhook.eventType) {
    case "push":
      event = transformGitHubPush(webhook.payload as PushEvent, context);
      break;
    case "pull_request":
      event = transformGitHubPullRequest(
        webhook.payload as PullRequestEvent,
        context
      );
      break;
    case "issues":
      event = transformGitHubIssue(webhook.payload as IssuesEvent, context);
      break;
    case "release":
      event = transformGitHubRelease(webhook.payload as ReleaseEvent, context);
      break;
    case "discussion":
      event = transformGitHubDiscussion(
        webhook.payload as DiscussionEvent,
        context
      );
      break;
    default:
      throw new Error(`Unsupported GitHub event type: ${String(webhook.eventType satisfies never)}`);
  }

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}

function transformVercelWebhook(
  webhook: VercelWebhookPayloadWrapper,
  context: TransformContext,
  index: number
): SourceEvent {
  const event = transformVercelDeployment(
    webhook.payload,
    webhook.eventType,
    context
  );

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}

function transformSentryWebhookPayload(
  webhook: SentryWebhookPayload,
  context: TransformContext,
  index: number
): SourceEvent {
  const transformer = sentryTransformers[webhook.eventType];
  const event = transformer(webhook.payload, context);

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}

function transformLinearWebhookPayload(
  webhook: LinearWebhookPayload,
  context: TransformContext,
  index: number
): SourceEvent {
  const transformer = linearTransformers[webhook.eventType];
  const event = transformer(webhook.payload, context);

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}
