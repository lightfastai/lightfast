/**
 * Vercel API → webhook shape adapters
 *
 * Wrap Vercel deployment list API responses into webhook-compatible envelopes
 * so the existing transformer produces identical SourceEvent output.
 */
import type {
  VercelWebhookPayload,
  VercelWebhookEventType,
} from "@repo/console-webhooks";

/**
 * Map Vercel deployment readyState to the corresponding webhook event type string.
 *
 * readyState values from the list API:
 *   READY    → "deployment.succeeded"
 *   ERROR    → "deployment.error"
 *   CANCELED → "deployment.canceled"
 *   BUILDING / QUEUED / other → "deployment.created"
 */
function mapReadyStateToEventType(readyState?: string): VercelWebhookEventType {
  switch (readyState) {
    case "READY":
      return "deployment.succeeded";
    case "ERROR":
      return "deployment.error";
    case "CANCELED":
      return "deployment.canceled";
    default:
      return "deployment.created";
  }
}

/**
 * Adapt a Vercel deployment from the list API into a VercelWebhookPayload shape.
 *
 * The transformer expects:
 *   transformVercelDeployment(payload: VercelWebhookPayload, eventType: VercelWebhookEventType, context)
 *
 * Returns both the adapted payload and the event type string.
 */
export function adaptVercelDeploymentForTransformer(
  deployment: Record<string, unknown>,
  projectName: string,
): { webhookPayload: VercelWebhookPayload; eventType: VercelWebhookEventType } {
  const eventType = mapReadyStateToEventType(deployment.readyState as string | undefined);
  const createdAt = (deployment.created as number | undefined) ?? Date.now();

  const webhookPayload: VercelWebhookPayload = {
    id: `backfill-${deployment.uid as string}`,
    type: eventType,
    createdAt,
    payload: {
      deployment: {
        id: deployment.uid as string,
        name: deployment.name as string,
        url: deployment.url as string | undefined,
        readyState: deployment.readyState as
          | "READY"
          | "ERROR"
          | "BUILDING"
          | "QUEUED"
          | "CANCELED"
          | undefined,
        meta: deployment.meta as VercelWebhookPayload["payload"]["deployment"] extends { meta?: infer M } ? M : never,
      },
      project: {
        id: (deployment.projectId as string | undefined) ?? "",
        name: projectName,
      },
    },
  };

  return { webhookPayload, eventType };
}

/**
 * Parse Vercel rate limit info from response headers.
 */
export function parseVercelRateLimit(headers: Headers): {
  remaining: number;
  resetAt: Date;
  limit: number;
} | undefined {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");

  if (!remaining || !reset || !limit) return undefined;

  return {
    remaining: parseInt(remaining, 10),
    resetAt: new Date(parseInt(reset, 10) * 1000),
    limit: parseInt(limit, 10),
  };
}
