import { inngest } from "@api/console/inngest";
import type { PostTransformEvent } from "@repo/console-providers/contracts";
import type { EventNotification } from "@repo/console-upstash-realtime";
import { realtime } from "@repo/console-upstash-realtime";

export interface ResolvedWorkspace {
  clerkOrgId: string;
  workspaceId: string;
  workspaceName: string;
}

/**
 * Dispatch a PostTransformEvent to Inngest for observation capture.
 */
export async function publishInngestNotification(
  sourceEvent: PostTransformEvent,
  workspace: ResolvedWorkspace,
  ingestLogId: number,
  correlationId?: string
): Promise<void> {
  await inngest.send({
    name: "console/event.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent,
      ingestionSource: "webhook",
      ingestLogId,
      correlationId,
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
