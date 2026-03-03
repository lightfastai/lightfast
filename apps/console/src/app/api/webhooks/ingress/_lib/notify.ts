import { inngest } from "@api/console/inngest";
import { redis } from "@vendor/upstash";
import type { SourceEvent } from "@repo/console-types";

export interface ResolvedWorkspace {
  workspaceId: string;
  workspaceName: string;
  clerkOrgId: string;
}

export interface EventNotification {
  payloadId: number;
  sourceEvent: SourceEvent;
}

/**
 * Publish a SourceEvent to Inngest for observation capture.
 */
export async function publishInngestNotification(
  sourceEvent: SourceEvent,
  workspace: ResolvedWorkspace,
): Promise<void> {
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent,
      ingestionSource: "webhook",
    },
  });
}

/**
 * Publish a transformed SourceEvent to Redis Pub/Sub.
 * SSE consumers subscribe to the org's channel for real-time streaming.
 *
 * Note: publish() auto-serializes the object via @upstash/redis.
 * Do NOT JSON.stringify before publishing — it causes double-encoding.
 */
export async function publishEventNotification(params: {
  orgId: string;
  payloadId: number;
  sourceEvent: SourceEvent;
}): Promise<void> {
  const notification: EventNotification = {
    payloadId: params.payloadId,
    sourceEvent: params.sourceEvent,
  };

  await redis.publish(
    `events:org:${params.orgId}`,
    notification,
  );
}
