import { markSourceControlWebhookDeliveryStatus } from "@db/app";
import { db } from "@db/app/client";
import { matchesAnyWatchedPath } from "@repo/source-control-contract";

import { inngest } from "../client";
import { appEvents } from "../schemas/app";
import { createIdentityRefreshDedupeKey } from "./identity-refresh-event";
import { createSkillRefreshDedupeKey } from "./skill-refresh-event";

export function getLightfastRefreshTargetsFromPush(input: {
  changedPaths: string[];
  changedPathsComplete?: boolean;
  ref: string;
}): { identity: boolean; skills: boolean } {
  if (input.ref !== "refs/heads/main") {
    return { identity: false, skills: false };
  }

  if (!input.changedPathsComplete) {
    return { identity: true, skills: true };
  }

  return {
    identity: matchesAnyWatchedPath(input.changedPaths, [
      "IDENTITY.md",
      "SOUL.md",
    ]),
    skills: matchesAnyWatchedPath(input.changedPaths, ["skills/**"]),
  };
}

export const queueLightfastIndexRefreshesFromSourceControl =
  inngest.createFunction(
    {
      id: "queue-lightfast-index-refreshes-from-source-control",
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
      timeouts: {
        finish: "30s",
        start: "2m",
      },
      triggers: appEvents["app/github.repository.push.received"],
    },
    async ({ event, step }) => {
      const queued = getLightfastRefreshTargetsFromPush({
        changedPaths: event.data.changedPaths,
        changedPathsComplete: event.data.changedPathsComplete,
        ref: event.data.ref,
      });

      if (!(queued.skills || queued.identity)) {
        await step.run("mark source control delivery ignored", () =>
          markSourceControlWebhookDeliveryStatusOrThrow({
            deliveryId: event.data.deliveryId,
            status: "ignored",
          })
        );
        return { queued };
      }

      if (queued.skills) {
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
      }
      if (queued.identity) {
        await step.sendEvent("queue identity index refresh", {
          name: "app/identity.index.refresh.requested",
          data: {
            dedupeKey: createIdentityRefreshDedupeKey({
              reason: "webhook",
              sourceControlRepositoryId: event.data.repositoryWatchId,
              targetCommitSha: event.data.afterSha,
            }),
            reason: "webhook" as const,
            sourceControlRepositoryId: event.data.repositoryWatchId,
            targetCommitSha: event.data.afterSha,
          },
        });
      }
      await step.run("mark source control delivery processed", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId: event.data.deliveryId,
          status: "processed",
        })
      );

      return { queued };
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
