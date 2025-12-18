/**
 * Webhook Transformer Integration
 *
 * Routes raw webhook payloads through production transformers.
 */

import type { SourceEvent, TransformContext } from "@repo/console-types";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  transformVercelDeployment,
} from "@repo/console-webhooks/transformers";
import type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";
import type {
  VercelWebhookPayload,
  VercelDeploymentEvent,
} from "@repo/console-webhooks";

export type GitHubEventType =
  | "push"
  | "pull_request"
  | "issues"
  | "release"
  | "discussion";

export type VercelEventType =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.ready"
  | "deployment.canceled"
  | "deployment.error"
  | "deployment.check-rerequested";

export interface WebhookPayload {
  source: "github" | "vercel";
  eventType: string;
  payload: unknown;
}

export interface GitHubWebhookPayload extends WebhookPayload {
  source: "github";
  eventType: GitHubEventType;
  payload: PushEvent | PullRequestEvent | IssuesEvent | ReleaseEvent | DiscussionEvent;
}

export interface VercelWebhookPayloadWrapper extends WebhookPayload {
  source: "vercel";
  eventType: VercelEventType;
  payload: VercelWebhookPayload;
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
    webhook.eventType as VercelDeploymentEvent,
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
