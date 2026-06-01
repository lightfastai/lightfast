import { matchesAnyWatchedPath } from "@repo/source-control-contract";

import { inngest } from "../client";
import { appEvents } from "../schemas/app";

export function shouldQueueSkillRefreshFromPush(input: {
  changedPaths: string[];
  ref: string;
}) {
  return (
    input.ref === "refs/heads/main" &&
    matchesAnyWatchedPath(input.changedPaths, ["skills/**"])
  );
}

export const queueSkillRefreshFromSourceControl = inngest.createFunction(
  {
    id: "queue-skill-refresh-from-source-control",
    idempotency: "event.data.deliveryId",
    retries: 1,
    triggers: appEvents["app/github.repository.push.received"],
  },
  async ({ event, step }) => {
    if (
      !shouldQueueSkillRefreshFromPush({
        changedPaths: event.data.changedPaths,
        ref: event.data.ref,
      })
    ) {
      return { queued: false as const };
    }

    await step.sendEvent("queue skill index refresh", {
      name: "app/skills.index.refresh.requested",
      data: {
        reason: "webhook" as const,
        sourceControlRepositoryId: event.data.repositoryWatchId,
        targetCommitSha: event.data.afterSha,
      },
    });

    return { queued: true as const };
  }
);
