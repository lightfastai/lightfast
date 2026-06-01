import { markSourceControlWebhookDeliveryStatus } from "@db/app";
import { db } from "@db/app/client";
import { matchesAnyWatchedPath } from "@repo/source-control-contract";

import { inngest } from "../client";
import { appEvents } from "../schemas/app";
import { createSkillRefreshDedupeKey } from "./skill-refresh-event";

export function shouldQueueSkillRefreshFromPush(input: {
  changedPaths: string[];
  changedPathsComplete: boolean;
  ref: string;
}) {
  return (
    input.ref === "refs/heads/main" &&
    (!input.changedPathsComplete ||
      matchesAnyWatchedPath(input.changedPaths, ["skills/**"]))
  );
}

export const queueSkillRefreshFromSourceControl = inngest.createFunction(
  {
    id: "queue-skill-refresh-from-source-control",
    idempotency: "event.data.deliveryId",
    onFailure: async ({ event, step }) => {
      const { deliveryId } = event.data.event.data;
      await step.run("mark source control delivery failed", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId,
          status: "failed",
        })
      );
      return { status: "failed" as const };
    },
    retries: 1,
    triggers: appEvents["app/github.repository.push.received"],
  },
  async ({ event, step }) => {
    if (
      !shouldQueueSkillRefreshFromPush({
        changedPaths: event.data.changedPaths,
        changedPathsComplete: event.data.changedPathsComplete,
        ref: event.data.ref,
      })
    ) {
      await step.run("mark source control delivery ignored", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId: event.data.deliveryId,
          status: "ignored",
        })
      );
      return { queued: false as const };
    }

    await step.sendEvent("queue skill index refresh", {
      name: "app/skills.index.refresh.requested",
      data: {
        dedupeKey: createSkillRefreshDedupeKey({
          reason: "webhook",
          sourceControlRepositoryId: event.data.repositoryWatchId,
          targetCommitSha: event.data.afterSha,
        }),
        reason: "webhook" as const,
        sourceControlRepositoryId: event.data.repositoryWatchId,
        targetCommitSha: event.data.afterSha,
      },
    });
    await step.run("mark source control delivery processed", () =>
      markSourceControlWebhookDeliveryStatusOrThrow({
        deliveryId: event.data.deliveryId,
        status: "processed",
      })
    );

    return { queued: true as const };
  }
);

async function markSourceControlWebhookDeliveryStatusOrThrow(input: {
  deliveryId: string;
  status: "failed" | "ignored" | "processed";
}) {
  const updated = await markSourceControlWebhookDeliveryStatus(db, input);
  if (!updated) {
    throw new Error(
      `Failed to mark source control webhook delivery ${input.deliveryId} ${input.status}.`
    );
  }
}
