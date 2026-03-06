import type { PostTransformEvent, PostTransformReference } from "../../post-transform-event.js";
import type { TransformContext } from "../../types.js";
import { validatePostTransformEvent, logValidationErrors } from "../../validation.js";
import { sanitizeTitle, sanitizeBody } from "../../sanitize.js";
import type {
  PreTransformLinearIssueWebhook,
  PreTransformLinearCommentWebhook,
  PreTransformLinearProjectWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearProjectUpdateWebhook,
} from "./schemas.js";

const ACTION_SUFFIX: Record<string, string> = {
  create: "created",
  update: "updated",
  remove: "deleted",
};

function linearSourceType(entity: string, action: string): string {
  return `${entity}.${ACTION_SUFFIX[action] ?? action}`;
}

export function transformLinearIssue(
  payload: PreTransformLinearIssueWebhook,
  context: TransformContext,
): PostTransformEvent {
  const issue = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "issue", id: issue.identifier, url: issue.url, label: null });
  refs.push({ type: "team", id: issue.team.key, url: null, label: issue.team.name });

  if (issue.project) {
    refs.push({ type: "project", id: issue.project.name, url: issue.project.url, label: null });
  }

  if (issue.cycle) {
    refs.push({ type: "cycle", id: issue.cycle.name, url: null, label: null });
  }

  if (issue.assignee) {
    refs.push({ type: "assignee", id: issue.assignee.email ?? issue.assignee.name, url: null, label: null });
  }

  for (const label of issue.labels) {
    refs.push({ type: "label", id: label.name, url: null, label: null });
  }

  if (issue.branchName) {
    refs.push({ type: "branch", id: issue.branchName, url: null, label: null });
  }

  if (issue.attachments?.nodes) {
    for (const attachment of issue.attachments.nodes) {
      if (attachment.sourceType === "githubPr" && attachment.metadata?.number) {
        refs.push({ type: "pr", id: `#${attachment.metadata.number}`, url: attachment.url ?? null, label: "tracked_in" });
      }
      if (attachment.sourceType === "sentryIssue" && attachment.metadata?.shortId) {
        refs.push({ type: "issue", id: attachment.metadata.shortId, url: attachment.url ?? null, label: "linked" });
      }
    }
  }

  const actionTitles: Record<string, string> = {
    create: "Issue Created",
    update: "Issue Updated",
    remove: "Issue Deleted",
  };

  const bodyParts = [
    issue.title,
    issue.description ?? "",
    `Team: ${issue.team.name}`,
    `State: ${issue.state.name}`,
    `Priority: ${issue.priorityLabel}`,
    issue.project ? `Project: ${issue.project.name}` : "",
    issue.cycle ? `Cycle: ${issue.cycle.name}` : "",
    issue.assignee ? `Assignee: ${issue.assignee.displayName ?? issue.assignee.name}` : "",
    issue.labels.length > 0 ? `Labels: ${issue.labels.map((l) => l.name).join(", ")}` : "",
    issue.estimate ? `Estimate: ${issue.estimate} points` : "",
    issue.dueDate ? `Due: ${issue.dueDate}` : "",
  ].filter(Boolean);

  const event: PostTransformEvent = {
    source: "linear",
    sourceType: linearSourceType("issue", payload.action),
    sourceId: `linear-issue:${issue.team.key}:${issue.identifier}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${issue.identifier}: ${issue.title.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: issue.creator
      ? {
          id: issue.creator.id,
          name: issue.creator.displayName ?? issue.creator.name,
          email: issue.creator.email ?? null,
          avatarUrl: issue.creator.avatarUrl ?? null,
        }
      : null,
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
      assigneeName: issue.assignee?.displayName ?? issue.assignee?.name,
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearIssue", event, validation.errors);
  }

  return event;
}

export function transformLinearComment(
  payload: PreTransformLinearCommentWebhook,
  context: TransformContext,
): PostTransformEvent {
  const comment = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "issue", id: comment.issue.identifier, url: comment.issue.url, label: null });

  const actionTitles: Record<string, string> = {
    create: "Comment Added",
    update: "Comment Updated",
    remove: "Comment Deleted",
  };

  const bodyParts = [
    comment.body,
    `On issue: ${comment.issue.identifier} - ${comment.issue.title}`,
  ];

  const event: PostTransformEvent = {
    source: "linear",
    sourceType: linearSourceType("comment", payload.action),
    sourceId: `linear-comment:${comment.issue.identifier}:${comment.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${comment.issue.identifier}: ${comment.body.slice(0, 60)}...`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: {
      id: comment.user.id,
      name: comment.user.displayName ?? comment.user.name,
      email: comment.user.email ?? null,
      avatarUrl: comment.user.avatarUrl ?? null,
    },
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearComment", event, validation.errors);
  }

  return event;
}

export function transformLinearProject(
  payload: PreTransformLinearProjectWebhook,
  context: TransformContext,
): PostTransformEvent {
  const project = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "project", id: project.name, url: project.url, label: null });

  if (project.lead) {
    refs.push({ type: "assignee", id: project.lead.email ?? project.lead.name, url: null, label: "lead" });
  }

  for (const team of project.teams) {
    refs.push({ type: "team", id: team.key, url: null, label: team.name });
  }

  const actionTitles: Record<string, string> = {
    create: "Project Created",
    update: "Project Updated",
    remove: "Project Deleted",
  };

  const bodyParts = [
    project.name,
    project.description ?? "",
    `State: ${project.state}`,
    `Progress: ${Math.round(project.progress * 100)}%`,
    project.targetDate ? `Target: ${project.targetDate}` : "",
    project.lead ? `Lead: ${project.lead.displayName ?? project.lead.name}` : "",
    `Teams: ${project.teams.map((t) => t.name).join(", ")}`,
  ].filter(Boolean);

  const event: PostTransformEvent = {
    source: "linear",
    sourceType: linearSourceType("project", payload.action),
    sourceId: `linear-project:${project.slugId}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] Project: ${project.name}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: project.lead
      ? {
          id: project.lead.id,
          name: project.lead.displayName ?? project.lead.name,
          email: project.lead.email ?? null,
          avatarUrl: project.lead.avatarUrl ?? null,
        }
      : null,
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
      leadName: project.lead?.displayName ?? project.lead?.name,
      teamIds: project.teams.map((t) => t.id),
      memberIds: project.members.map((m) => m.id),
      action: payload.action,
      organizationId: payload.organizationId,
      webhookId: payload.webhookId,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearProject", event, validation.errors);
  }

  return event;
}

export function transformLinearCycle(
  payload: PreTransformLinearCycleWebhook,
  context: TransformContext,
): PostTransformEvent {
  const cycle = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "cycle", id: cycle.name ?? `Cycle ${cycle.number}`, url: cycle.url, label: null });
  refs.push({ type: "team", id: cycle.team.key, url: null, label: cycle.team.name });

  const actionTitles: Record<string, string> = {
    create: "Cycle Created",
    update: "Cycle Updated",
    remove: "Cycle Deleted",
  };

  const cycleName = cycle.name ?? `Cycle ${cycle.number}`;

  const bodyParts = [
    cycleName,
    cycle.description ?? "",
    `Team: ${cycle.team.name}`,
    `Starts: ${cycle.startsAt}`,
    `Ends: ${cycle.endsAt}`,
    `Progress: ${Math.round(cycle.progress * 100)}%`,
    `Scope: ${cycle.scope} points`,
  ].filter(Boolean);

  const event: PostTransformEvent = {
    source: "linear",
    sourceType: linearSourceType("cycle", payload.action),
    sourceId: `linear-cycle:${cycle.team.key}:${cycle.number}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${cycleName} (${cycle.team.name})`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: null,
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearCycle", event, validation.errors);
  }

  return event;
}

export function transformLinearProjectUpdate(
  payload: PreTransformLinearProjectUpdateWebhook,
  context: TransformContext,
): PostTransformEvent {
  const update = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "project", id: update.project.name, url: update.project.url, label: null });

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
    `Health: ${healthEmoji[update.health] ?? ""} ${update.health}`,
  ];

  const event: PostTransformEvent = {
    source: "linear",
    sourceType: linearSourceType("project-update", payload.action),
    sourceId: `linear-project-update:${update.project.id}:${update.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${update.project.name}: ${update.body.slice(0, 60)}...`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: {
      id: update.user.id,
      name: update.user.displayName ?? update.user.name,
      email: update.user.email ?? null,
      avatarUrl: update.user.avatarUrl ?? null,
    },
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

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformLinearProjectUpdate", event, validation.errors);
  }

  return event;
}
