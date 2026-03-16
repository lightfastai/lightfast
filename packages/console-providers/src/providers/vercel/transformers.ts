import type { PostTransformEvent } from "../../post-transform-event";
import { sanitizeBody, sanitizeTitle } from "../../sanitize";
import type { TransformContext } from "../../types";
import {
  logValidationErrors,
  validatePostTransformEvent,
} from "../../validation";
import {
  type PreTransformVercelWebhookPayload,
  type VercelWebhookEventType,
  vercelWebhookEventTypeSchema,
} from "./schemas";

export function transformVercelDeployment(
  payload: PreTransformVercelWebhookPayload,
  context: TransformContext,
  rawEventType: string
): PostTransformEvent {
  const eventType = vercelWebhookEventTypeSchema.parse(rawEventType);
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!(deployment && project)) {
    throw new Error("Missing deployment or project in Vercel webhook payload");
  }

  const gitMeta = deployment.meta;
  const target = payload.payload.target;
  const isProduction = target === "production";
  const branch = gitMeta?.githubCommitRef ?? "unknown";

  const eventTitleMap: Record<VercelWebhookEventType, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.ready": "Deployment Ready",
    "deployment.canceled": "Deployment Canceled",
    "deployment.error": "Deployment Failed",
    "deployment.check-rerequested": "Deployment Check Re-requested",
    "deployment.promoted": "Deployment Promoted",
    "deployment.rollback": "Deployment Rollback",
    "deployment.cleanup": "Deployment Cleanup",
  };

  const actionTitle = eventTitleMap[eventType];

  const emoji =
    eventType === "deployment.succeeded" || eventType === "deployment.ready"
      ? "+"
      : eventType === "deployment.error"
        ? "x"
        : eventType === "deployment.canceled"
          ? "!"
          : ">";

  const rawBody = [
    `${emoji} ${actionTitle}`,
    gitMeta?.githubCommitMessage ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const deploymentState = deployment.readyState?.toLowerCase() ?? null;

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `vercel:deployment:${deployment.id}:${eventType}`,
    provider: "vercel",
    eventType,
    title: sanitizeTitle(
      `[${actionTitle}] ${project.name ?? project.id} from ${branch}`
    ),
    body: sanitizeBody(rawBody),
    occurredAt: new Date(payload.createdAt).toISOString(),
    entity: {
      provider: "vercel",
      entityType: "deployment",
      entityId: deployment.id,
      title: `${project.name ?? project.id} — ${branch}`,
      url: deployment.url ? `https://${deployment.url}` : null,
      state: deploymentState,
    },
    relations: [],
    attributes: {
      projectId: project.id,
      projectName: project.name ?? null,
      teamId: team?.id ?? null,
      deploymentId: deployment.id,
      deploymentUrl: deployment.url ?? null,
      environment: isProduction ? "production" : "preview",
      branch,
      region: payload.region ?? null,
      gitCommitSha: gitMeta?.githubCommitSha ?? null,
      gitCommitRef: gitMeta?.githubCommitRef ?? null,
      gitCommitMessage: gitMeta?.githubCommitMessage ?? null,
      gitRepo: gitMeta?.githubRepo ?? null,
      gitOrg: gitMeta?.githubOrg ?? null,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformVercelDeployment", event, validation.errors);
  }

  return event;
}
