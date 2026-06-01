import { reconcileSkillIndexSources } from "../../services/skills";
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
  async ({ step }) =>
    reconcileSkillIndexSources({
      deps: {
        enqueueRefresh: async (input) => {
          await step.sendEvent("queue skill index refresh", {
            name: "app/skills.index.refresh.requested",
            data: {
              reason: input.reason,
              sourceControlRepositoryId: input.sourceControlRepositoryId,
              targetCommitSha: input.targetCommitSha,
            },
          });
        },
      },
      limit: 100,
      totalLimit: 1000,
    })
);
