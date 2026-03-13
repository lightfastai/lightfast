import type {
  EntityRelation,
  PostTransformEvent,
} from "../../post-transform-event";
import { sanitizeBody, sanitizeTitle } from "../../sanitize";
import type { TransformContext } from "../../types";
import {
  logValidationErrors,
  validatePostTransformEvent,
} from "../../validation";
import type {
  PreTransformLinearCommentWebhook,
  PreTransformLinearCycleWebhook,
  PreTransformLinearIssueWebhook,
  PreTransformLinearProjectUpdateWebhook,
  PreTransformLinearProjectWebhook,
} from "./schemas";

const ACTION_SUFFIX: Record<string, string> = {
  create: "created",
  update: "updated",
  remove: "deleted",
};

function linearEventType(entity: string, action: string): string {
  return `${entity}.${ACTION_SUFFIX[action] ?? action}`;
}

export function transformLinearIssue(
  payload: PreTransformLinearIssueWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const issue = payload.data;
  const relations: EntityRelation[] = [];

  if (issue.project) {
    relations.push({
      provider: "linear",
      entityType: "project",
      entityId: issue.project.id,
      title: issue.project.name,
      url: issue.project.url ?? null,
      relationshipType: "belongs_to",
    });
  }

  if (issue.cycle) {
    relations.push({
      provider: "linear",
      entityType: "cycle",
      entityId: issue.cycle.id,
      title: issue.cycle.name ?? null,
      url: null,
      relationshipType: "in_cycle",
    });
  }

  if (issue.parent) {
    relations.push({
      provider: "linear",
      entityType: "issue",
      entityId: issue.parent.identifier,
      title: issue.parent.title,
      url: null,
      relationshipType: "parent",
    });
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
    issue.assignee
      ? `Assignee: ${issue.assignee.displayName ?? issue.assignee.name}`
      : "",
    issue.labels.length > 0
      ? `Labels: ${issue.labels.map((l) => l.name).join(", ")}`
      : "",
    issue.estimate ? `Estimate: ${issue.estimate} points` : "",
    issue.dueDate ? `Due: ${issue.dueDate}` : "",
  ].filter(Boolean);

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `linear:issue:${issue.identifier}:issue.${ACTION_SUFFIX[payload.action] ?? payload.action}`,
    provider: "linear",
    eventType: linearEventType("issue", payload.action),
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] ${issue.identifier}: ${issue.title.slice(0, 80)}`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: payload.createdAt,
    entity: {
      provider: "linear",
      entityType: "issue",
      entityId: issue.identifier,
      title: issue.title,
      url: issue.url,
      state: issue.state.name,
    },
    relations,
    attributes: {
      teamId: issue.team.id,
      teamKey: issue.team.key,
      teamName: issue.team.name,
      issueId: issue.id,
      identifier: issue.identifier,
      number: issue.number,
      stateId: issue.state.id,
      stateName: issue.state.name,
      stateType: issue.state.type,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      estimate: issue.estimate ?? null,
      projectId: issue.project?.id ?? null,
      projectName: issue.project?.name ?? null,
      cycleId: issue.cycle?.id ?? null,
      cycleName: issue.cycle?.name ?? null,
      branchName: issue.branchName ?? null,
      dueDate: issue.dueDate ?? null,
      action: payload.action,
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
  _eventType: string
): PostTransformEvent {
  const comment = payload.data;
  const relations: EntityRelation[] = [
    {
      provider: "linear",
      entityType: "issue",
      entityId: comment.issue.identifier,
      title: comment.issue.title,
      url: comment.issue.url ?? null,
      relationshipType: "belongs_to",
    },
  ];

  if (comment.parent) {
    relations.push({
      provider: "linear",
      entityType: "comment",
      entityId: comment.parent.id,
      title: null,
      url: null,
      relationshipType: "parent",
    });
  }

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
    deliveryId: context.deliveryId,
    sourceId: `linear:comment:${comment.id}:comment.${ACTION_SUFFIX[payload.action] ?? payload.action}`,
    provider: "linear",
    eventType: linearEventType("comment", payload.action),
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] ${comment.issue.identifier}: ${comment.body.slice(0, 60)}...`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: payload.createdAt,
    entity: {
      provider: "linear",
      entityType: "comment",
      entityId: comment.id,
      title: comment.body.slice(0, 100),
      url: null,
      state: null,
    },
    relations,
    attributes: {
      commentId: comment.id,
      issueId: comment.issue.id,
      issueIdentifier: comment.issue.identifier,
      issueTitle: comment.issue.title,
      parentCommentId: comment.parent?.id ?? null,
      action: payload.action,
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
  _eventType: string
): PostTransformEvent {
  const project = payload.data;

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
    project.lead
      ? `Lead: ${project.lead.displayName ?? project.lead.name}`
      : "",
    `Teams: ${project.teams.map((t) => t.name).join(", ")}`,
  ].filter(Boolean);

  const teamId = project.teams[0]?.id ?? null;

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `linear:project:${project.id}:project.${ACTION_SUFFIX[payload.action] ?? payload.action}`,
    provider: "linear",
    eventType: linearEventType("project", payload.action),
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] Project: ${project.name}`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: payload.createdAt,
    entity: {
      provider: "linear",
      entityType: "project",
      entityId: project.id,
      title: project.name,
      url: project.url ?? null,
      state: project.state,
    },
    relations: [],
    attributes: {
      teamId: teamId ?? "",
      projectName: project.name,
      slugId: project.slugId,
      state: project.state,
      progress: project.progress,
      scope: project.scope,
      targetDate: project.targetDate ?? null,
      action: payload.action,
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
  _eventType: string
): PostTransformEvent {
  const cycle = payload.data;

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
    deliveryId: context.deliveryId,
    sourceId: `linear:cycle:${cycle.id}:cycle.${ACTION_SUFFIX[payload.action] ?? payload.action}`,
    provider: "linear",
    eventType: linearEventType("cycle", payload.action),
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] ${cycleName} (${cycle.team.name})`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: payload.createdAt,
    entity: {
      provider: "linear",
      entityType: "cycle",
      entityId: cycle.id,
      title: cycleName,
      url: cycle.url ?? null,
      state: null,
    },
    relations: [],
    attributes: {
      teamId: cycle.team.id,
      teamKey: cycle.team.key,
      teamName: cycle.team.name,
      cycleNumber: cycle.number,
      cycleName: cycle.name ?? null,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      progress: cycle.progress,
      scope: cycle.scope,
      action: payload.action,
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
  _eventType: string
): PostTransformEvent {
  const update = payload.data;

  const relations: EntityRelation[] = [
    {
      provider: "linear",
      entityType: "project",
      entityId: update.project.id,
      title: update.project.name,
      url: update.project.url ?? null,
      relationshipType: "belongs_to",
    },
  ];

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
    deliveryId: context.deliveryId,
    sourceId: `linear:project-update:${update.id}:project-update.${ACTION_SUFFIX[payload.action] ?? payload.action}`,
    provider: "linear",
    eventType: linearEventType("project-update", payload.action),
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] ${update.project.name}: ${update.body.slice(0, 60)}...`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: payload.createdAt,
    entity: {
      provider: "linear",
      entityType: "project-update",
      entityId: update.id,
      title: update.body.slice(0, 100),
      url: null,
      state: update.health,
    },
    relations,
    attributes: {
      updateId: update.id,
      projectId: update.project.id,
      projectName: update.project.name,
      health: update.health,
      action: payload.action,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors(
      "transformLinearProjectUpdate",
      event,
      validation.errors
    );
  }

  return event;
}
