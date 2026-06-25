import {
  getAutomationByPublicId,
  getAutomationRunByPublicId,
  markAutomationRunCompleted,
  markAutomationRunFailed,
  markAutomationRunRunning,
  markAutomationRunSkipped,
} from "@db/app";
import { db } from "@db/app/client";

import { env } from "../../env";
import { executeAutomationRunRequest } from "../../services/automations/run-executor";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const runAutomation = inngest.createFunction(
  {
    id: "run-automation",
    idempotency: "event.data.runId",
    retries: 2,
    timeouts: {
      finish: "5m",
      start: "5m",
    },
    triggers: appEvents["app/automation.run.requested"],
    onFailure: async ({ event, error, step }) => {
      const { clerkOrgId, runId } = event.data.event.data;
      await step.run("mark automation run failed after retries", () =>
        markAutomationRunFailed(db, {
          clerkOrgId,
          publicId: runId,
          errorCode: "AUTOMATION_RUN_FAILED",
          errorMessage: getErrorMessage(error),
        })
      );
      return { status: "failed" };
    },
  },
  async ({ event, step }) => {
    const { automationId, clerkOrgId, runId, scheduleVersion } = event.data;

    const run = await step.run("load automation run", () =>
      getAutomationRunByPublicId(db, {
        clerkOrgId,
        publicId: runId,
      })
    );
    if (!run) {
      return { status: "missing" };
    }
    if (run.status !== "pending") {
      return { status: run.status };
    }

    const automation = await step.run("load automation", () =>
      getAutomationByPublicId(db, {
        clerkOrgId,
        publicId: automationId,
      })
    );

    if (!automation || automation.status !== "active") {
      await step.run("mark automation run skipped", () =>
        markAutomationRunSkipped(db, {
          clerkOrgId,
          publicId: runId,
          errorCode: "AUTOMATION_INACTIVE",
          errorMessage: "Automation is no longer active.",
        })
      );
      return { status: "skipped" };
    }

    if (automation.scheduleVersion !== scheduleVersion) {
      await step.run("mark automation run skipped", () =>
        markAutomationRunSkipped(db, {
          clerkOrgId,
          publicId: runId,
          errorCode: "AUTOMATION_STALE_EVENT",
          errorMessage: "Automation changed before this run started.",
        })
      );
      return { status: "skipped" };
    }

    const claimed = await step.run("mark automation run running", () =>
      markAutomationRunRunning(db, {
        clerkOrgId,
        publicId: runId,
      })
    );
    if (!claimed) {
      return { status: "skipped" };
    }

    const execution = await step.ai.wrap(
      "execute automation",
      executeAutomationRunRequest,
      {
        automation,
        deploymentEnvironment: env.VERCEL_ENV,
        run,
      }
    );

    if (execution.status === "failed") {
      await step.run("mark automation run failed", () =>
        markAutomationRunFailed(db, {
          clerkOrgId,
          errorCode: execution.failure.errorCode,
          errorMessage: execution.failure.errorMessage,
          publicId: runId,
        })
      );
      return { status: "failed" };
    }

    await step.run("mark automation run completed", () =>
      markAutomationRunCompleted(db, {
        clerkOrgId,
        publicId: runId,
        output: execution.output,
      })
    );

    return { status: "completed" };
  }
);
