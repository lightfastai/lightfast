import { realtime } from "@repo/console-upstash-realtime";
import type { EventNotification } from "@repo/console-upstash-realtime";
import type { PostTransformEvent } from "@repo/console-providers";
import { inngest } from "@api/console/inngest";

export interface ResolvedWorkspace {
  workspaceId: string;
  workspaceName: string;
  clerkOrgId: string;
}

/**
 * Dispatch a PostTransformEvent to Inngest for observation capture.
 */
export async function publishInngestNotification(
  sourceEvent: PostTransformEvent,
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
 * Publish a transformed PostTransformEvent to Upstash Realtime.
 * SSE consumers subscribe to the org's channel for real-time streaming.
 *
 * Uses Realtime's channel-scoped emit with exactly-once delivery
 * (backed by Redis Streams). No manual JSON.stringify — Realtime
 * handles serialization via the Zod schema.
 */
export async function publishEventNotification(params: {
  orgId: string;
  workspaceId: string;
  eventId: number;
  sourceEvent: PostTransformEvent;
}): Promise<void> {
  const channel = realtime.channel(`org-${params.orgId}`);
  await channel.emit("workspace.event", {
    eventId: params.eventId,
    workspaceId: params.workspaceId,
    sourceEvent: params.sourceEvent,
  } satisfies EventNotification);
}
