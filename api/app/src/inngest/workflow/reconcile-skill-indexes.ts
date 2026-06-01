import { findChangedSkillIndexSources } from "../../services/skills";
import { inngest } from "../client";

const RECONCILE_REFRESH_LIMIT = 100;
const RECONCILE_TOTAL_LIMIT = 1000;

export const reconcileSkillIndexes = inngest.createFunction(
  {
    id: "reconcile-skill-indexes",
    retries: 1,
    timeouts: {
      finish: "5m",
      start: "2m",
    },
    triggers: { cron: "0 * * * *" },
  },
  async ({ step }) => {
    const result = await step.run("reconcile skill index sources", () =>
      findChangedSkillIndexSources({
        limit: RECONCILE_REFRESH_LIMIT,
        totalLimit: RECONCILE_TOTAL_LIMIT,
      })
    );
    const changed = result.changed.slice(0, RECONCILE_REFRESH_LIMIT);

    for (const source of changed) {
      await step.sendEvent(
        `queue skill index refresh ${source.sourceControlRepositoryId}`,
        {
          name: "app/skills.index.refresh.requested",
          data: {
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
