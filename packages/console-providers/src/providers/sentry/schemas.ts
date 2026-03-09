import { z } from "zod";

// ─── Shared sub-schemas ──────────────────────────────────────────────────────

const sentryActorSchema = z.object({
  type: z.enum(["user", "application"]),
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  email: z.string().optional(),
});

const sentryIssueMetadataSchema = z
  .object({
    type: z.string().optional(),
    value: z.string().optional(),
    filename: z.string().optional(),
    function: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

const sentryIssueSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  title: z.string(),
  culprit: z.string().nullable(),
  status: z.enum(["unresolved", "resolved", "ignored"]),
  level: z.enum(["fatal", "error", "warning", "info", "debug"]),
  platform: z.string(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  count: z.union([z.string(), z.number()]),
  userCount: z.number(),
  permalink: z.string().nullable(),
  metadata: sentryIssueMetadataSchema,
  project: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    platform: z.string().optional(),
  }),
  assignedTo: z
    .object({
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      email: z.string().optional(),
    })
    .nullable()
    .optional(),
  statusDetails: z
    .object({
      inCommit: z
        .object({
          repository: z.string().optional(),
          commit: z.string().optional(),
        })
        .optional(),
      inRelease: z.string().optional(),
      inNextRelease: z.boolean().optional(),
      ignoreDuration: z.number().optional(),
      ignoreCount: z.number().optional(),
      ignoreWindow: z.number().optional(),
      ignoreUserCount: z.number().optional(),
      ignoreUserWindow: z.number().optional(),
    })
    .passthrough()
    .optional(),
  logger: z.string().optional(),
  type: z.enum(["error", "default"]),
  annotations: z.array(z.string()),
  isPublic: z.boolean(),
  isBookmarked: z.boolean(),
  isSubscribed: z.boolean(),
  hasSeen: z.boolean(),
  numComments: z.number(),
  shareId: z.string().nullable().optional(),
  substatus: z.string().optional(),
  subscriptionDetails: z.record(z.string(), z.unknown()).nullable().optional(),
  issueType: z.string().optional(),
  issueCategory: z.string().optional(),
  priority: z.string().optional(),
  priorityLockedAt: z.string().nullable().optional(),
  isUnhandled: z.boolean().optional(),
  url: z.string().optional(),
  web_url: z.string().optional(),
  project_url: z.string().optional(),
});

const sentryStackFrameSchema = z.object({
  filename: z.string().nullable().optional(),
  function: z.string().nullable().optional(),
  lineno: z.number().nullable().optional(),
  colno: z.number().nullable().optional(),
  context_line: z.string().nullable().optional(),
  pre_context: z.array(z.string()).nullable().optional(),
  post_context: z.array(z.string()).nullable().optional(),
  abs_path: z.string().nullable().optional(),
  in_app: z.boolean().optional(),
  module: z.string().nullable().optional(),
});

const sentryErrorEventSchema = z.object({
  event_id: z.string(),
  project: z.number(),
  timestamp: z.union([z.string(), z.number()]),
  received: z.union([z.string(), z.number()]),
  platform: z.string(),
  message: z.string().optional(),
  title: z.string(),
  location: z.string().optional(),
  culprit: z.string().optional(),
  type: z.enum(["error", "default"]),
  metadata: z.object({
    type: z.string().optional(),
    value: z.string().optional(),
    filename: z.string().optional(),
    function: z.string().optional(),
  }),
  tags: z.array(
    z.union([
      z.tuple([z.string(), z.string()]),
      z.object({ key: z.string(), value: z.string() }),
    ])
  ),
  contexts: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  user: z
    .object({
      id: z.string().optional(),
      email: z.string().optional(),
      username: z.string().optional(),
      ip_address: z.string().optional(),
    })
    .optional(),
  sdk: z.object({ name: z.string(), version: z.string() }).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  exception: z
    .object({
      values: z.array(
        z.object({
          type: z.string(),
          value: z.string().optional(),
          stacktrace: z
            .object({ frames: z.array(sentryStackFrameSchema) })
            .optional(),
        })
      ),
    })
    .optional(),
  web_url: z.string().optional(),
  issue_url: z.string().optional(),
  issue_id: z.string().optional(),
});

// ─── Webhook envelope schemas ─────────────────────────────────────────────────

export const preTransformSentryIssueWebhookSchema = z.object({
  action: z.enum([
    "created",
    "resolved",
    "assigned",
    "ignored",
    "archived",
    "unresolved",
  ]),
  data: z.object({ issue: sentryIssueSchema }),
  installation: z.object({ uuid: z.string() }),
  actor: sentryActorSchema,
});

export const preTransformSentryErrorWebhookSchema = z.object({
  action: z.literal("created"),
  data: z.object({ error: sentryErrorEventSchema }),
  installation: z.object({ uuid: z.string() }),
  actor: sentryActorSchema.optional(),
});

export const preTransformSentryEventAlertWebhookSchema = z.object({
  action: z.literal("triggered"),
  data: z.object({
    event: sentryErrorEventSchema,
    triggered_rule: z.string(),
  }),
  installation: z.object({ uuid: z.string() }),
  actor: sentryActorSchema.optional(),
});

export const preTransformSentryMetricAlertWebhookSchema = z.object({
  action: z.enum(["critical", "warning", "resolved"]),
  data: z.object({
    metric_alert: z.object({
      id: z.string(),
      alert_rule: z.object({
        id: z.string(),
        name: z.string(),
        organization_id: z.string(),
        status: z.number(),
        query: z.string(),
        threshold_type: z.number(),
        resolve_threshold: z.number().nullable(),
        time_window: z.number(),
        aggregate: z.string(),
      }),
      date_started: z.string(),
      date_detected: z.string(),
      date_closed: z.string().nullable(),
    }),
    description_text: z.string().optional(),
    description_title: z.string().optional(),
    web_url: z.string().optional(),
  }),
  installation: z.object({ uuid: z.string() }),
  actor: sentryActorSchema.optional(),
});

// ── Relay-level loose webhook payload schema ──

export const sentryWebhookPayloadSchema = z
  .object({
    installation: z.object({ uuid: z.string() }).optional(),
  })
  .passthrough();

// ─── Inferred types ───────────────────────────────────────────────────────────

export type SentryActor = z.infer<typeof sentryActorSchema>;
export type SentryIssue = z.infer<typeof sentryIssueSchema>;
export type SentryErrorEvent = z.infer<typeof sentryErrorEventSchema>;

export type SentryWebhookEventType =
  | "issue"
  | "error"
  | "event_alert"
  | "metric_alert";

export type PreTransformSentryIssueWebhook = z.infer<
  typeof preTransformSentryIssueWebhookSchema
>;
export type PreTransformSentryErrorWebhook = z.infer<
  typeof preTransformSentryErrorWebhookSchema
>;
export type PreTransformSentryEventAlertWebhook = z.infer<
  typeof preTransformSentryEventAlertWebhookSchema
>;
export type PreTransformSentryMetricAlertWebhook = z.infer<
  typeof preTransformSentryMetricAlertWebhookSchema
>;
export type SentryWebhookPayload = z.infer<typeof sentryWebhookPayloadSchema>;
