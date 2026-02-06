/**
 * Linear Transformer for Production Webhooks
 *
 * Transforms official Linear webhook payloads to SourceEvent.
 * Based on Linear's webhook documentation and actual payload structures.
 *
 * @see https://developers.linear.app/docs/graphql/webhooks
 */

import type {
  SourceEvent,
  SourceReference,
  TransformContext,
} from "@repo/console-types";
import { validateSourceEvent } from "../validation.js";
import { sanitizeTitle, sanitizeBody } from "../sanitize.js";

// ============================================================================
// Official Linear Webhook Payload Types
// Based on Linear Webhook documentation
// ============================================================================

/**
 * Linear Webhook Base
 * All Linear webhooks follow this structure
 */
export interface LinearWebhookBase {
  action: "create" | "update" | "remove";
  type: LinearWebhookType;
  createdAt: string; // ISO timestamp
  organizationId: string;
  webhookId: string;
  webhookTimestamp: number;
}

/**
 * Linear webhook event types supported by our transformers.
 * Note: IssueLabel is omitted as it's not needed for demo scenarios.
 */
export type LinearWebhookType =
  | "Issue"
  | "Comment"
  | "Project"
  | "Cycle"
  | "ProjectUpdate";

/**
 * Linear Issue Webhook
 * Sent when issues are created, updated, or deleted
 */
export interface LinearIssueWebhook extends LinearWebhookBase {
  type: "Issue";
  data: LinearIssue;
  updatedFrom?: Partial<LinearIssue>;
}

/**
 * Linear Comment Webhook
 * Sent when comments are created, updated, or deleted
 */
export interface LinearCommentWebhook extends LinearWebhookBase {
  type: "Comment";
  data: LinearComment;
  updatedFrom?: Partial<LinearComment>;
}

/**
 * Linear Project Webhook
 * Sent when projects are created, updated, or deleted
 */
export interface LinearProjectWebhook extends LinearWebhookBase {
  type: "Project";
  data: LinearProject;
  updatedFrom?: Partial<LinearProject>;
}

/**
 * Linear Cycle Webhook
 * Sent when cycles (sprints) are created, updated, or deleted
 */
export interface LinearCycleWebhook extends LinearWebhookBase {
  type: "Cycle";
  data: LinearCycle;
  updatedFrom?: Partial<LinearCycle>;
}

/**
 * Linear Project Update Webhook
 * Sent when project updates are created, updated, or deleted
 */
export interface LinearProjectUpdateWebhook extends LinearWebhookBase {
  type: "ProjectUpdate";
  data: LinearProjectUpdate;
  updatedFrom?: Partial<LinearProjectUpdate>;
}

// ============================================================================
// Linear Data Types (Official GraphQL Schema)
// ============================================================================

/**
 * Linear Issue
 * @see https://developers.linear.app/docs/graphql/types/issue
 */
export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "LIGHT-123"
  title: string;
  description?: string;
  descriptionData?: string; // Prosemirror JSON
  priority: number; // 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  priorityLabel: string;
  estimate?: number;
  boardOrder: number;
  sortOrder: number;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  autoClosedAt?: string;
  autoArchivedAt?: string;
  dueDate?: string;
  slaStartedAt?: string;
  slaBreachesAt?: string;
  trashed?: boolean;
  snoozedUntilAt?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  number: number;
  url: string;
  branchName: string;
  customerTicketCount: number;
  previousIdentifiers: string[];
  subIssueSortOrder?: number;
  team: {
    id: string;
    key: string;
    name: string;
  };
  state: {
    id: string;
    name: string;
    color: string;
    type: "backlog" | "unstarted" | "started" | "completed" | "canceled";
  };
  creator?: LinearUser;
  assignee?: LinearUser;
  parent?: {
    id: string;
    identifier: string;
    title: string;
  };
  project?: {
    id: string;
    name: string;
    url: string;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
  };
  labels: LinearLabel[];
  subscriberIds: string[];
  /** Attachments linked to this issue (GitHub PRs, Sentry issues, etc.) */
  attachments?: {
    nodes?: LinearAttachment[];
  };
}

/**
 * Linear Attachment
 * External links attached to issues (GitHub PRs, Sentry issues, etc.)
 */
export interface LinearAttachment {
  id: string;
  title: string;
  url?: string;
  source?: string;
  sourceType?: string;
  metadata?: {
    state?: string;
    number?: number;
    shortId?: string;
  };
}

/**
 * Linear Comment
 */
export interface LinearComment {
  id: string;
  body: string;
  bodyData?: string; // Prosemirror JSON
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  editedAt?: string;
  url: string;
  reactionData: unknown[];
  user: LinearUser;
  issue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
  };
  parent?: {
    id: string;
  };
}

/**
 * Linear Project
 */
export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  state: "backlog" | "planned" | "started" | "paused" | "completed" | "canceled";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  canceledAt?: string;
  completedAt?: string;
  autoArchivedAt?: string;
  targetDate?: string;
  startDate?: string;
  startedAt?: string;
  progress: number; // 0-1
  scope: number;
  url: string;
  slugId: string;
  sortOrder: number;
  issueCountHistory: number[];
  completedIssueCountHistory: number[];
  scopeHistory: number[];
  completedScopeHistory: number[];
  inProgressScopeHistory: number[];
  slackNewIssue: boolean;
  slackIssueComments: boolean;
  slackIssueStatuses: boolean;
  lead?: LinearUser;
  members: LinearUser[];
  teams: Array<{
    id: string;
    key: string;
    name: string;
  }>;
}

/**
 * Linear Cycle (Sprint)
 */
export interface LinearCycle {
  id: string;
  number: number;
  name?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  completedAt?: string;
  autoArchivedAt?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  progress: number;
  scope: number;
  url: string;
  issueCountHistory: number[];
  completedIssueCountHistory: number[];
  scopeHistory: number[];
  completedScopeHistory: number[];
  inProgressScopeHistory: number[];
  team: {
    id: string;
    key: string;
    name: string;
  };
}

/**
 * Linear Project Update
 */
export interface LinearProjectUpdate {
  id: string;
  body: string;
  bodyData?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  archivedAt?: string;
  url: string;
  health: "onTrack" | "atRisk" | "offTrack";
  user: LinearUser;
  project: {
    id: string;
    name: string;
    url: string;
  };
}

/**
 * Linear User
 */
export interface LinearUser {
  id: string;
  name: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isMe: boolean;
  active: boolean;
}

/**
 * Linear Label
 */
export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

// ============================================================================
// Log validation errors helper
// ============================================================================

function logValidationErrors(
  transformerName: string,
  event: SourceEvent,
  errors: string[]
): void {
  console.error(`[Transformer:${transformerName}] Invalid SourceEvent:`, {
    sourceId: event.sourceId,
    sourceType: event.sourceType,
    errors,
  });
}

// ============================================================================
// Transformer Functions
// ============================================================================

/**
 * Transform Linear issue webhook to SourceEvent
 */
export function transformLinearIssue(
  payload: LinearIssueWebhook,
  context: TransformContext
): SourceEvent {
  const issue = payload.data;
  const refs: SourceReference[] = [];

  // Add issue reference
  refs.push({
    type: "issue",
    id: issue.identifier,
    url: issue.url,
  });

  // Add team reference
  refs.push({
    type: "team",
    id: issue.team.key,
    label: issue.team.name,
  });

  // Add project reference if present
  if (issue.project) {
    refs.push({
      type: "project",
      id: issue.project.name,
      url: issue.project.url,
    });
  }

  // Add cycle reference if present
  if (issue.cycle) {
    refs.push({
      type: "cycle",
      id: issue.cycle.name || `Cycle ${issue.cycle.number}`,
    });
  }

  // Add assignee if present
  if (issue.assignee) {
    refs.push({
      type: "assignee",
      id: issue.assignee.email || issue.assignee.name,
    });
  }

  // Add labels
  for (const label of issue.labels) {
    refs.push({
      type: "label",
      id: label.name,
    });
  }

  // Add branch reference for dev linkage
  if (issue.branchName) {
    refs.push({
      type: "branch",
      id: issue.branchName,
    });
  }

  // Extract references from attachments (GitHub PRs, Sentry issues, etc.)
  if (issue.attachments?.nodes) {
    for (const attachment of issue.attachments.nodes) {
      if (attachment.sourceType === "githubPr" && attachment.metadata?.number) {
        refs.push({
          type: "pr",
          id: `#${attachment.metadata.number}`,
          url: attachment.url,
          label: "tracked_in",
        });
      }
      if (attachment.sourceType === "sentryIssue" && attachment.metadata?.shortId) {
        refs.push({
          type: "issue",
          id: attachment.metadata.shortId,
          url: attachment.url,
          label: "linked",
        });
      }
    }
  }

  const actionTitles: Record<string, string> = {
    create: "Issue Created",
    update: "Issue Updated",
    remove: "Issue Deleted",
  };

  // Build semantic body for embedding
  const bodyParts = [
    issue.title,
    issue.description || "",
    `Team: ${issue.team.name}`,
    `State: ${issue.state.name}`,
    `Priority: ${issue.priorityLabel}`,
    issue.project ? `Project: ${issue.project.name}` : "",
    issue.cycle ? `Cycle: ${issue.cycle.name || `Cycle ${issue.cycle.number}`}` : "",
    issue.assignee ? `Assignee: ${issue.assignee.displayName}` : "",
    issue.labels.length > 0
      ? `Labels: ${issue.labels.map((l) => l.name).join(", ")}`
      : "",
    issue.estimate ? `Estimate: ${issue.estimate} points` : "",
    issue.dueDate ? `Due: ${issue.dueDate}` : "",
  ].filter(Boolean);

  const event: SourceEvent = {
    source: "linear",
    sourceType: `issue.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
    sourceId: `linear-issue:${issue.team.key}:${issue.identifier}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${issue.identifier}: ${issue.title.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: issue.creator
      ? {
          id: issue.creator.id,
          name: issue.creator.displayName,
          email: issue.creator.email,
          avatarUrl: issue.creator.avatarUrl,
        }
      : undefined,
    occurredAt: payload.createdAt,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      issueId: issue.id,
      identifier: issue.identifier,
      number: issue.number,
      teamId: issue.team.id,
      teamKey: issue.team.key,
      teamName: issue.team.name,
      stateId: issue.state.id,
      stateName: issue.state.name,
      stateType: issue.state.type,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      estimate: issue.estimate,
      projectId: issue.project?.id,
      projectName: issue.project?.name,
      cycleId: issue.cycle?.id,
      cycleName: issue.cycle?.name,
      assigneeId: issue.assignee?.id,
      assigneeName: issue.assignee?.displayName,
      labels: issue.labels.map((l) => l.name),
      branchName: issue.branchName,
      dueDate: issue.dueDate,
      startedAt: issue.startedAt,
      completedAt: issue.completedAt,
      canceledAt: issue.canceledAt,
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
      updatedFrom: payload.updatedFrom,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearIssue", event, validation.errors);
  }

  return event;
}

/**
 * Transform Linear comment webhook to SourceEvent
 */
export function transformLinearComment(
  payload: LinearCommentWebhook,
  context: TransformContext
): SourceEvent {
  const comment = payload.data;
  const refs: SourceReference[] = [];

  // Add parent issue reference
  refs.push({
    type: "issue",
    id: comment.issue.identifier,
    url: comment.issue.url,
  });

  const actionTitles: Record<string, string> = {
    create: "Comment Added",
    update: "Comment Updated",
    remove: "Comment Deleted",
  };

  const bodyParts = [
    comment.body,
    `On issue: ${comment.issue.identifier} - ${comment.issue.title}`,
  ];

  const event: SourceEvent = {
    source: "linear",
    sourceType: `comment.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
    sourceId: `linear-comment:${comment.issue.identifier}:${comment.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${comment.issue.identifier}: ${comment.body.slice(0, 60)}...`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: comment.user
      ? {
          id: comment.user.id,
          name: comment.user.displayName,
          email: comment.user.email,
          avatarUrl: comment.user.avatarUrl,
        }
      : undefined,
    occurredAt: payload.createdAt,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      commentId: comment.id,
      issueId: comment.issue.id,
      issueIdentifier: comment.issue.identifier,
      issueTitle: comment.issue.title,
      parentCommentId: comment.parent?.id,
      editedAt: comment.editedAt,
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearComment", event, validation.errors);
  }

  return event;
}

/**
 * Transform Linear project webhook to SourceEvent
 */
export function transformLinearProject(
  payload: LinearProjectWebhook,
  context: TransformContext
): SourceEvent {
  const project = payload.data;
  const refs: SourceReference[] = [];

  refs.push({
    type: "project",
    id: project.name,
    url: project.url,
  });

  // Add lead as assignee
  if (project.lead) {
    refs.push({
      type: "assignee",
      id: project.lead.email || project.lead.name,
      label: "lead",
    });
  }

  // Add team references
  for (const team of project.teams) {
    refs.push({
      type: "team",
      id: team.key,
      label: team.name,
    });
  }

  const actionTitles: Record<string, string> = {
    create: "Project Created",
    update: "Project Updated",
    remove: "Project Deleted",
  };

  const bodyParts = [
    project.name,
    project.description || "",
    `State: ${project.state}`,
    `Progress: ${Math.round(project.progress * 100)}%`,
    project.targetDate ? `Target: ${project.targetDate}` : "",
    project.lead ? `Lead: ${project.lead.displayName}` : "",
    `Teams: ${project.teams.map((t) => t.name).join(", ")}`,
  ].filter(Boolean);

  const event: SourceEvent = {
    source: "linear",
    sourceType: `project.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
    sourceId: `linear-project:${project.slugId}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] Project: ${project.name}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: project.lead
      ? {
          id: project.lead.id,
          name: project.lead.displayName,
          email: project.lead.email,
          avatarUrl: project.lead.avatarUrl,
        }
      : undefined,
    occurredAt: payload.createdAt,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      projectId: project.id,
      projectName: project.name,
      slugId: project.slugId,
      state: project.state,
      progress: project.progress,
      scope: project.scope,
      targetDate: project.targetDate,
      startDate: project.startDate,
      startedAt: project.startedAt,
      completedAt: project.completedAt,
      canceledAt: project.canceledAt,
      leadId: project.lead?.id,
      leadName: project.lead?.displayName,
      teamIds: project.teams.map((t) => t.id),
      memberIds: project.members.map((m) => m.id),
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearProject", event, validation.errors);
  }

  return event;
}

/**
 * Transform Linear cycle webhook to SourceEvent
 */
export function transformLinearCycle(
  payload: LinearCycleWebhook,
  context: TransformContext
): SourceEvent {
  const cycle = payload.data;
  const refs: SourceReference[] = [];

  refs.push({
    type: "cycle",
    id: cycle.name || `Cycle ${cycle.number}`,
    url: cycle.url,
  });

  refs.push({
    type: "team",
    id: cycle.team.key,
    label: cycle.team.name,
  });

  const actionTitles: Record<string, string> = {
    create: "Cycle Created",
    update: "Cycle Updated",
    remove: "Cycle Deleted",
  };

  const cycleName = cycle.name || `Cycle ${cycle.number}`;

  const bodyParts = [
    cycleName,
    cycle.description || "",
    `Team: ${cycle.team.name}`,
    `Starts: ${cycle.startsAt}`,
    `Ends: ${cycle.endsAt}`,
    `Progress: ${Math.round(cycle.progress * 100)}%`,
    `Scope: ${cycle.scope} points`,
  ].filter(Boolean);

  const event: SourceEvent = {
    source: "linear",
    sourceType: `cycle.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
    sourceId: `linear-cycle:${cycle.team.key}:${cycle.number}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${cycleName} (${cycle.team.name})`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: undefined,
    occurredAt: payload.createdAt,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      cycleId: cycle.id,
      cycleNumber: cycle.number,
      cycleName: cycle.name,
      teamId: cycle.team.id,
      teamKey: cycle.team.key,
      teamName: cycle.team.name,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      completedAt: cycle.completedAt,
      progress: cycle.progress,
      scope: cycle.scope,
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearCycle", event, validation.errors);
  }

  return event;
}

/**
 * Transform Linear project update webhook to SourceEvent
 */
export function transformLinearProjectUpdate(
  payload: LinearProjectUpdateWebhook,
  context: TransformContext
): SourceEvent {
  const update = payload.data;
  const refs: SourceReference[] = [];

  refs.push({
    type: "project",
    id: update.project.name,
    url: update.project.url,
  });

  const actionTitles: Record<string, string> = {
    create: "Project Update Posted",
    update: "Project Update Edited",
    remove: "Project Update Deleted",
  };

  const healthEmoji: Record<string, string> = {
    onTrack: "+",
    atRisk: "!",
    offTrack: "x",
  };

  const bodyParts = [
    update.body,
    `Project: ${update.project.name}`,
    `Health: ${healthEmoji[update.health] || ""} ${update.health}`,
  ];

  const event: SourceEvent = {
    source: "linear",
    sourceType: `project-update.${payload.action === "create" ? "created" : payload.action === "update" ? "updated" : "deleted"}`,
    sourceId: `linear-project-update:${update.project.id}:${update.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${update.project.name}: ${update.body.slice(0, 60)}...`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: update.user
      ? {
          id: update.user.id,
          name: update.user.displayName,
          email: update.user.email,
          avatarUrl: update.user.avatarUrl,
        }
      : undefined,
    occurredAt: payload.createdAt,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      updateId: update.id,
      projectId: update.project.id,
      projectName: update.project.name,
      health: update.health,
      editedAt: update.editedAt,
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearProjectUpdate", event, validation.errors);
  }

  return event;
}

// ============================================================================
// Exported Transformer Map
// ============================================================================

export const linearTransformers = {
  Issue: (payload: unknown, ctx: TransformContext) =>
    transformLinearIssue(payload as LinearIssueWebhook, ctx),
  Comment: (payload: unknown, ctx: TransformContext) =>
    transformLinearComment(payload as LinearCommentWebhook, ctx),
  Project: (payload: unknown, ctx: TransformContext) =>
    transformLinearProject(payload as LinearProjectWebhook, ctx),
  Cycle: (payload: unknown, ctx: TransformContext) =>
    transformLinearCycle(payload as LinearCycleWebhook, ctx),
  ProjectUpdate: (payload: unknown, ctx: TransformContext) =>
    transformLinearProjectUpdate(payload as LinearProjectUpdateWebhook, ctx),
};
