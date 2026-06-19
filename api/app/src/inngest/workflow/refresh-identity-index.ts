import { refreshIdentityIndexSource } from "../../services/identity/refresh";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

export const refreshIdentityIndex = inngest.createFunction(
  {
    id: "refresh-identity-index",
    idempotency: "event.data.dedupeKey",
    retries: 2,
    timeouts: {
      finish: "30s",
      start: "2m",
    },
    triggers: appEvents["app/identity.index.refresh.requested"],
  },
  async ({ event, step }) =>
    step.run("refresh identity index source", () =>
      refreshIdentityIndexSource({
        reason: event.data.reason,
        sourceControlRepositoryId: event.data.sourceControlRepositoryId,
        targetCommitSha: event.data.targetCommitSha,
      })
    )
);
