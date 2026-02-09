import type {
  SourceEvent,
  SourceReference,
  TransformContext,
} from "@repo/console-types";
import { toExternalVercelEventType } from "@repo/console-types";
import type {
  VercelWebhookPayload,
  VercelWebhookEventType,
} from "../vercel.js";
import { validateSourceEvent } from "../validation.js";
import { sanitizeTitle, sanitizeBody } from "../sanitize.js";

/**
 * Transform Vercel deployment event to SourceEvent
 */
export function transformVercelDeployment(
  payload: VercelWebhookPayload,
  eventType: VercelWebhookEventType,
  context: TransformContext
): SourceEvent {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!deployment || !project) {
    throw new Error("Missing deployment or project in Vercel webhook payload");
  }

  const gitMeta = deployment.meta;

  const refs: SourceReference[] = [];

  // Add commit reference
  if (gitMeta?.githubCommitSha) {
    refs.push({
      type: "commit",
      id: gitMeta.githubCommitSha,
      url:
        gitMeta.githubOrg && gitMeta.githubRepo
          ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`
          : undefined,
    });
  }

  // Add branch reference
  if (gitMeta?.githubCommitRef) {
    refs.push({
      type: "branch",
      id: gitMeta.githubCommitRef,
      url:
        gitMeta.githubOrg && gitMeta.githubRepo
          ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/tree/${gitMeta.githubCommitRef}`
          : undefined,
    });
  }

  // Add PR reference (best-effort - githubPrId may not always be present)
  if (gitMeta?.githubPrId && gitMeta?.githubOrg && gitMeta?.githubRepo) {
    refs.push({
      type: "pr",
      id: `#${gitMeta.githubPrId}`,
      url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/pull/${gitMeta.githubPrId}`,
    });
  }

  // Add deployment reference
  refs.push({
    type: "deployment",
    id: deployment.id,
    url: deployment.url ? `https://${deployment.url}` : undefined,
  });

  // Add project reference
  refs.push({
    type: "project",
    id: project.id,
  });

  const eventTitleMap: Record<VercelWebhookEventType, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.ready": "Deployment Ready",
    "deployment.canceled": "Deployment Canceled",
    "deployment.error": "Deployment Failed",
    "deployment.check-rerequested": "Deployment Check Re-requested",
  };

  const actionTitle = eventTitleMap[eventType] || "Deployment";
  const branch = gitMeta?.githubCommitRef || "unknown";
  const isProduction =
    deployment.url?.includes(project.name) && !deployment.url?.includes("-");

  const emoji =
    eventType === "deployment.succeeded" || eventType === "deployment.ready"
      ? "+"
      : eventType === "deployment.error"
        ? "x"
        : eventType === "deployment.canceled"
          ? "!"
          : ">";

  // SEMANTIC CONTENT ONLY (for embedding)
  // Structured fields stored in metadata
  const rawBody = [
    `${emoji} ${actionTitle}`,
    gitMeta?.githubCommitMessage ? gitMeta.githubCommitMessage : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sourceType = toExternalVercelEventType(eventType);

  const event: SourceEvent = {
    source: "vercel",
    sourceType: sourceType ?? eventType,
    sourceId: `deployment:${deployment.id}`,
    title: sanitizeTitle(`[${actionTitle}] ${project.name} from ${branch}`),
    body: sanitizeBody(rawBody),
    // Note: Vercel only provides username, not numeric GitHub ID
    // This creates username-based actor IDs (see Known Limitations in plan)
    actor: gitMeta?.githubCommitAuthorName
      ? {
          id: gitMeta.githubCommitAuthorName,
          name: gitMeta.githubCommitAuthorName,
        }
      : undefined,
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

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    console.error("[Transformer:transformVercelDeployment] Invalid SourceEvent:", {
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      errors: validation.errors,
    });
  }

  return event;
}

export const vercelTransformers = {
  deployment: transformVercelDeployment,
};
