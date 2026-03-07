import { z } from "zod";

// ─── Shared sub-schemas ──────────────────────────────────────────────────────

export const linearActorSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "oauthClient", "integration"]).optional(),
  name: z.string(),
  email: z.string().optional(),
  url: z.string().optional(),
});

export const linearUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  isMe: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const linearLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const linearAttachmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  source: z.string().optional(),
  sourceType: z.string().optional(),
  metadata: z
    .object({
      state: z.string().optional(),
      number: z.number().optional(),
      shortId: z.string().optional(),
    })
    .optional(),
});

// ─── Entity schemas ───────────────────────────────────────────────────────────

export const linearIssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().optional(),
  descriptionData: z.string().optional(),
  priority: z.number(),
  priorityLabel: z.string(),
  estimate: z.number().optional(),
  boardOrder: z.number(),
  sortOrder: z.number(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  canceledAt: z.string().optional(),
  autoClosedAt: z.string().optional(),
  autoArchivedAt: z.string().optional(),
  dueDate: z.string().optional(),
  slaStartedAt: z.string().optional(),
  slaBreachesAt: z.string().optional(),
  trashed: z.boolean().optional(),
  snoozedUntilAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  number: z.number(),
  url: z.string(),
  branchName: z.string(),
  customerTicketCount: z.number(),
  previousIdentifiers: z.array(z.string()),
  subIssueSortOrder: z.number().optional(),
  reactionData: z.array(z.unknown()).optional(),
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }),
  state: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    type: z.enum(["backlog", "unstarted", "started", "completed", "canceled"]),
  }),
  creator: linearUserSchema.optional(),
  assignee: linearUserSchema.optional(),
  parent: z
    .object({ id: z.string(), identifier: z.string(), title: z.string() })
    .optional(),
  project: z
    .object({ id: z.string(), name: z.string(), url: z.string() })
    .optional(),
  cycle: z
    .object({ id: z.string(), name: z.string(), number: z.number() })
    .optional(),
  labels: z.array(linearLabelSchema),
  subscriberIds: z.array(z.string()),
  attachments: z
    .object({ nodes: z.array(linearAttachmentSchema).optional() })
    .optional(),
});

export const linearCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  bodyData: z.string().optional(),
  edited: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  editedAt: z.string().optional(),
  url: z.string(),
  reactionData: z.array(z.unknown()),
  user: linearUserSchema,
  issue: z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    url: z.string(),
  }),
  parent: z.object({ id: z.string() }).optional(),
});

export const linearProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string(),
  state: z.enum([
    "backlog",
    "planned",
    "started",
    "paused",
    "completed",
    "canceled",
  ]),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  canceledAt: z.string().optional(),
  completedAt: z.string().optional(),
  autoArchivedAt: z.string().optional(),
  targetDate: z.string().optional(),
  startDate: z.string().optional(),
  startedAt: z.string().optional(),
  progress: z.number(),
  scope: z.number(),
  url: z.string(),
  slugId: z.string(),
  sortOrder: z.number(),
  issueCountHistory: z.array(z.number()).optional(),
  completedIssueCountHistory: z.array(z.number()).optional(),
  scopeHistory: z.array(z.number()).optional(),
  completedScopeHistory: z.array(z.number()).optional(),
  inProgressScopeHistory: z.array(z.number()).optional(),
  slackNewIssue: z.boolean(),
  slackIssueComments: z.boolean(),
  slackIssueStatuses: z.boolean(),
  lead: linearUserSchema.optional(),
  members: z.array(linearUserSchema),
  teams: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
});

export const linearCycleSchema = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  completedAt: z.string().optional(),
  autoArchivedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  progress: z.number(),
  scope: z.number(),
  url: z.string(),
  issueCountHistory: z.array(z.number()).optional(),
  completedIssueCountHistory: z.array(z.number()).optional(),
  scopeHistory: z.array(z.number()).optional(),
  completedScopeHistory: z.array(z.number()).optional(),
  inProgressScopeHistory: z.array(z.number()).optional(),
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }),
});

export const linearProjectUpdateSchema = z.object({
  id: z.string(),
  body: z.string(),
  bodyData: z.string().optional(),
  diffMarkdown: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  editedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  url: z.string(),
  health: z.enum(["onTrack", "atRisk", "offTrack"]),
  user: linearUserSchema,
  project: z.object({ id: z.string(), name: z.string(), url: z.string() }),
});

// ─── Webhook base schema ──────────────────────────────────────────────────────

const linearWebhookBaseSchema = z.object({
  action: z.enum(["create", "update", "remove"]),
  createdAt: z.string(),
  organizationId: z.string(),
  webhookId: z.string(),
  webhookTimestamp: z.number(),
  url: z.string().optional(),
  actor: linearActorSchema.optional(),
});

// ─── Webhook envelope schemas ─────────────────────────────────────────────────

export const preTransformLinearIssueWebhookSchema = linearWebhookBaseSchema.extend({
  type: z.literal("Issue"),
  data: linearIssueSchema,
  updatedFrom: z.unknown().optional(),
});

export const preTransformLinearCommentWebhookSchema = linearWebhookBaseSchema.extend({
  type: z.literal("Comment"),
  data: linearCommentSchema,
  updatedFrom: z.unknown().optional(),
});

export const preTransformLinearProjectWebhookSchema = linearWebhookBaseSchema.extend({
  type: z.literal("Project"),
  data: linearProjectSchema,
  updatedFrom: z.unknown().optional(),
});

export const preTransformLinearCycleWebhookSchema = linearWebhookBaseSchema.extend({
  type: z.literal("Cycle"),
  data: linearCycleSchema,
  updatedFrom: z.unknown().optional(),
});

export const preTransformLinearProjectUpdateWebhookSchema =
  linearWebhookBaseSchema.extend({
    type: z.literal("ProjectUpdate"),
    data: linearProjectUpdateSchema,
    updatedFrom: z.unknown().optional(),
  });

// ── Relay-level loose webhook payload schema ──

export const linearWebhookPayloadSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    organizationId: z.string().optional(),
  })
  .passthrough();

// ─── Inferred types ───────────────────────────────────────────────────────────

export type LinearActor = z.infer<typeof linearActorSchema>;
export type LinearUser = z.infer<typeof linearUserSchema>;
export type LinearLabel = z.infer<typeof linearLabelSchema>;
export type LinearAttachment = z.infer<typeof linearAttachmentSchema>;
export type LinearIssue = z.infer<typeof linearIssueSchema>;
export type LinearComment = z.infer<typeof linearCommentSchema>;
export type LinearProject = z.infer<typeof linearProjectSchema>;
export type LinearCycle = z.infer<typeof linearCycleSchema>;
export type LinearProjectUpdate = z.infer<typeof linearProjectUpdateSchema>;

export type LinearWebhookBase = z.infer<typeof linearWebhookBaseSchema>;
export type LinearWebhookEventType =
  | "Issue"
  | "Comment"
  | "Project"
  | "Cycle"
  | "ProjectUpdate";

export type PreTransformLinearIssueWebhook = z.infer<typeof preTransformLinearIssueWebhookSchema>;
export type PreTransformLinearCommentWebhook = z.infer<typeof preTransformLinearCommentWebhookSchema>;
export type PreTransformLinearProjectWebhook = z.infer<typeof preTransformLinearProjectWebhookSchema>;
export type PreTransformLinearCycleWebhook = z.infer<typeof preTransformLinearCycleWebhookSchema>;
export type PreTransformLinearProjectUpdateWebhook = z.infer<typeof preTransformLinearProjectUpdateWebhookSchema>;
export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
