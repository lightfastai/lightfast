import { findChangedSkillIndexSources } from "../../services/skills";
import { inngest } from "../client";

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
        limit: 100,
        totalLimit: 1000,
      })
    );

    for (const source of result.changed) {
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
      queued: result.changed.length,
    };
  }
);
