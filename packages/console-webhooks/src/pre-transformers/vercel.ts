/**
 * Vercel Pre-Transform Types & Transformers
 *
 * PreTransform types: Self-defined.
 * Decision: No official @vercel/webhooks package exists. @vercel/sdk is a REST API client
 * for managing webhooks (create, list, delete) and does not export inbound webhook payload types.
 *
 * Fixture verified: apps/relay/src/__fixtures__/vercel-deployment.json
 * Last verified: 2026-03-04
 */

import type {
  PostTransformEvent,
  PostTransformReference,
} from "@repo/console-validation";
import type { TransformContext } from "../transform-context";
import { validatePostTransformEvent } from "../post-transformers/validation";
import { sanitizeTitle, sanitizeBody } from "../sanitize";

/**
 * Vercel deployment event types
 */
export type VercelWebhookEventType =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.ready"
  | "deployment.error"
  | "deployment.canceled"
  | "deployment.check-rerequested";

/**
 * Vercel webhook payload structure
 */
export interface PreTransformVercelWebhookPayload {
  id: string;
  type: string;
  createdAt: number;
  region?: string;
  payload: {
    deployment?: {
      id: string;
      name: string;
      url?: string;
      readyState?: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED";
      errorCode?: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubCommitAuthorLogin?: string;
        githubOrg?: string;
        githubRepo?: string;
        githubDeployment?: string;
        githubCommitOrg?: string;
        githubCommitRepo?: string;
        githubCommitRepoId?: string;
        githubPrId?: string;
        // Fields present in real payloads but not previously typed:
        githubRepoId?: string;
        githubRepoOwnerType?: string;
      };
    };
    project?: {
      id: string;
      name: string;
    };
    team?: {
      id: string;
      slug?: string;
      name?: string;
    };
    user?: {
      id: string;
    };
    // Fields present in real payloads but not previously typed:
    alias?: string[];
    links?: {
      deployment?: string;
      project?: string;
    };
    plan?: string;
    regions?: string[];
    [key: string]: unknown;
  };
}

/**
 * Transform Vercel deployment event to PostTransformEvent
 */
export function transformVercelDeployment(
  payload: PreTransformVercelWebhookPayload,
  eventType: VercelWebhookEventType,
  context: TransformContext
): PostTransformEvent {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!deployment || !project) {
    throw new Error("Missing deployment or project in Vercel webhook payload");
  }

  const gitMeta = deployment.meta;

  const refs: PostTransformReference[] = [];

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

  const event: PostTransformEvent = {
    source: "vercel",
    sourceType: eventType,
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
  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    console.error("[Transformer:transformVercelDeployment] Invalid PostTransformEvent:", {
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
