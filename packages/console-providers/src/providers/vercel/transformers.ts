import type { PostTransformEvent, PostTransformReference } from "../../post-transform-event.js";
import type { TransformContext } from "../../types.js";
import { validatePostTransformEvent, logValidationErrors } from "../../validation.js";
import { sanitizeTitle, sanitizeBody } from "../../sanitize.js";
import type { PreTransformVercelWebhookPayload, VercelWebhookEventType } from "./schemas.js";

export function transformVercelDeployment(
  payload: PreTransformVercelWebhookPayload,
  context: TransformContext,
): PostTransformEvent {
  const eventType = context.eventType as VercelWebhookEventType;
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!deployment || !project) {
    throw new Error("Missing deployment or project in Vercel webhook payload");
  }

  const gitMeta = deployment.meta;
  const refs: PostTransformReference[] = [];

  if (gitMeta?.githubCommitSha) {
    refs.push({
      type: "commit",
      id: gitMeta.githubCommitSha,
      url:
        gitMeta.githubOrg && gitMeta.githubRepo
          ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`
          : null,
      label: null,
    });
  }

  if (gitMeta?.githubCommitRef) {
    refs.push({
      type: "branch",
      id: gitMeta.githubCommitRef,
      url:
        gitMeta.githubOrg && gitMeta.githubRepo
          ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/tree/${gitMeta.githubCommitRef}`
          : null,
      label: null,
    });
  }

  if (gitMeta?.githubPrId && gitMeta.githubOrg && gitMeta.githubRepo) {
    refs.push({
      type: "pr",
      id: `#${gitMeta.githubPrId}`,
      url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/pull/${gitMeta.githubPrId}`,
      label: null,
    });
  }

  refs.push({
    type: "deployment",
    id: deployment.id,
    url: deployment.url ? `https://${deployment.url}` : null,
    label: null,
  });

  refs.push({ type: "project", id: project.id, url: null, label: null });

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
  const branch = gitMeta?.githubCommitRef ?? "unknown";
  const target = payload.payload.target;
  const isProduction = target === "production";

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

  const event: PostTransformEvent = {
    source: "vercel",
    sourceType: eventType,
    sourceId: `deployment:${deployment.id}`,
    title: sanitizeTitle(`[${actionTitle}] ${project.name ?? project.id} from ${branch}`),
    body: sanitizeBody(rawBody),
    actor: gitMeta?.githubCommitAuthorName
      ? { id: gitMeta.githubCommitAuthorName, name: gitMeta.githubCommitAuthorName, email: null, avatarUrl: null }
      : null,
    occurredAt: new Date(payload.createdAt).toISOString(),
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      webhookId: payload.id,
      deploymentId: deployment.id,
      deploymentUrl: deployment.url,
      projectId: project.id,
      projectName: project.name,
      teamId: team?.id,
      environment: isProduction ? "production" : "preview",
      branch,
      region: payload.region,
      gitCommitSha: gitMeta?.githubCommitSha,
      gitCommitRef: gitMeta?.githubCommitRef,
      gitCommitMessage: gitMeta?.githubCommitMessage,
      gitCommitAuthor: gitMeta?.githubCommitAuthorName,
      gitRepo: gitMeta?.githubRepo,
      gitOrg: gitMeta?.githubOrg,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformVercelDeployment", event, validation.errors);
  }

  return event;
}
