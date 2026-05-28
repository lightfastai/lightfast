import { claimDueAutomationRuns } from "@db/app";
import { db } from "@db/app/client";

import { inngest } from "../client";

export const automationScheduler = inngest.createFunction(
  {
    id: "automation-scheduler",
    idempotency: "event.id",
    retries: 2,
    triggers: { cron: "* * * * *" },
    timeouts: {
      finish: "2m",
      start: "1m",
    },
  },
  async ({ step }) => {
    const claimed = await step.run("claim due automation runs", () =>
      claimDueAutomationRuns(db, { limit: 25 })
    );

    for (const { automation, run } of claimed) {
      await step.sendEvent("queue automation run", {
        name: "app/automation.run.requested",
        data: {
          automationId: automation.publicId,
          clerkOrgId: automation.clerkOrgId,
          runId: run.publicId,
          scheduleVersion: automation.scheduleVersion,
        },
      });
    }

    return { queued: claimed.length };
  }
);
