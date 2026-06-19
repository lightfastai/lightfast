import { findChangedIdentityIndexSources } from "../../services/identity/reconcile";
import { inngest } from "../client";
import { createIdentityRefreshDedupeKey } from "./identity-refresh-event";

const RECONCILE_REFRESH_LIMIT = 100;
const RECONCILE_TOTAL_LIMIT = 1000;

export const reconcileIdentityIndexes = inngest.createFunction(
  {
    id: "reconcile-identity-indexes",
    retries: 1,
    timeouts: {
      finish: "5m",
      start: "2m",
    },
    triggers: { cron: "15 * * * *" },
  },
  async ({ step }) => {
    const result = await step.run("reconcile identity index sources", () =>
      findChangedIdentityIndexSources({
        limit: RECONCILE_REFRESH_LIMIT,
        totalLimit: RECONCILE_TOTAL_LIMIT,
      })
    );
    const changed = result.changed.slice(0, RECONCILE_REFRESH_LIMIT);

    for (const source of changed) {
      await step.sendEvent(
        `queue identity index refresh ${source.sourceControlRepositoryId}`,
        {
          name: "app/identity.index.refresh.requested",
          data: {
            dedupeKey: createIdentityRefreshDedupeKey({
              reason: "schedule",
              sourceControlRepositoryId: source.sourceControlRepositoryId,
              targetCommitSha: source.targetCommitSha,
            }),
            reason: "schedule" as const,
            sourceControlRepositoryId: source.sourceControlRepositoryId,
            targetCommitSha: source.targetCommitSha,
          },
        }
      );
    }

    return {
      checked: result.checked,
      queued: changed.length,
    };
  }
);
