import { refreshSkillIndexSource } from "../../services/skills";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

export const refreshSkillIndex = inngest.createFunction(
  {
    id: "refresh-skill-index",
    idempotency:
      'event.data.targetCommitSha ? event.data.sourceControlRepositoryId + "-" + event.data.targetCommitSha : event.id',
    retries: 2,
    timeouts: {
      finish: "30s",
      start: "2m",
    },
    triggers: appEvents["app/skills.index.refresh.requested"],
  },
  async ({ event, step }) =>
    step.run("refresh skill index source", () =>
      refreshSkillIndexSource({
        reason: event.data.reason,
        sourceControlRepositoryId: event.data.sourceControlRepositoryId,
        targetCommitSha: event.data.targetCommitSha,
      })
    )
);
