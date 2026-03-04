import type { ZodType } from "zod";
import type { EventKey } from "@repo/console-types";
import {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  preTransformVercelWebhookPayloadSchema,
  preTransformLinearIssueWebhookSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearProjectWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  preTransformSentryIssueWebhookSchema,
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
} from "@repo/console-webhooks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = ZodType<any>;

/**
 * Flat lookup from "source:entity" → Zod schema.
 * Vercel uses "vercel:deployment" for all deployment.* event types.
 */
const SCHEMA_MAP: Record<string, Schema> = {
  "github:push": preTransformGitHubPushEventSchema,
  "github:pull-request": preTransformGitHubPullRequestEventSchema,
  "github:issue": preTransformGitHubIssuesEventSchema,
  "github:release": preTransformGitHubReleaseEventSchema,
  "github:discussion": preTransformGitHubDiscussionEventSchema,
  "vercel:deployment": preTransformVercelWebhookPayloadSchema,
  "linear:issue": preTransformLinearIssueWebhookSchema,
  "linear:comment": preTransformLinearCommentWebhookSchema,
  "linear:project-update": preTransformLinearProjectUpdateWebhookSchema,
  "linear:project": preTransformLinearProjectWebhookSchema,
  "linear:cycle": preTransformLinearCycleWebhookSchema,
  "sentry:issue": preTransformSentryIssueWebhookSchema,
  "sentry:error": preTransformSentryErrorWebhookSchema,
  "sentry:event-alert": preTransformSentryEventAlertWebhookSchema,
  "sentry:metric-alert": preTransformSentryMetricAlertWebhookSchema,
};

function extractSourceEntity(eventKey: EventKey): string {
  const [source, rest = ""] = eventKey.split(":");
  const dotIdx = rest.indexOf(".");
  const entity = dotIdx >= 0 ? rest.slice(0, dotIdx) : rest;
  return `${source}:${entity}`;
}

/** Maps EventKey → Zod schema for use with generateObject({ schema }) */
export function getSchemaForEvent(eventKey: EventKey): Schema {
  const key = extractSourceEntity(eventKey);
  const schema = SCHEMA_MAP[key];
  if (!schema) throw new Error(`No schema for event key: ${eventKey}`);
  return schema;
}
