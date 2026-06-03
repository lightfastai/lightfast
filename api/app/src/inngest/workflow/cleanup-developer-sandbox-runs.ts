import { db } from "@db/app/client";
import { createDeveloperSandboxRunService } from "../../services/developer-sandbox-runs";
import { inngest } from "../client";

export const cleanupDeveloperSandboxRuns = inngest.createFunction(
  {
    id: "cleanup-developer-sandbox-runs",
    retries: 1,
    triggers: { cron: "*/5 * * * *" },
    timeouts: {
      finish: "2m",
      start: "1m",
    },
  },
  async ({ step }) =>
    step.run("cleanup expired developer sandbox runs", () =>
      createDeveloperSandboxRunService({
        db,
      }).cleanupExpiredDeveloperSandboxRuns({ limit: 25 })
    )
);
