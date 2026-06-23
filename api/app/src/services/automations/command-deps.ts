import type { Database } from "@db/app";
import {
  createAutomation,
  createAutomationRun,
  deleteAutomation,
  getAutomationByPublicId,
  getAutomationRunByPublicId,
  listAutomationRuns,
  listAutomations,
  markAutomationRunFailed,
  setAutomationStatus,
  updateAutomation,
} from "@db/app";
import { log } from "@vendor/observability/log/next";

import type { AutomationCommandDeps } from "../../domain/automations";

const AUTOMATION_RUN_ENQUEUE_TIMEOUT_MS = 10_000;

type AutomationCommandDepOverrides = Partial<AutomationCommandDeps>;

export function createDefaultAutomationCommandDeps(
  input: { db: Database } & AutomationCommandDepOverrides
): AutomationCommandDeps {
  return {
    createAutomation:
      input.createAutomation ?? ((value) => createAutomation(input.db, value)),
    createAutomationRun:
      input.createAutomationRun ??
      ((value) => createAutomationRun(input.db, value)),
    deleteAutomation:
      input.deleteAutomation ?? ((value) => deleteAutomation(input.db, value)),
    getAutomationByPublicId:
      input.getAutomationByPublicId ??
      ((value) => getAutomationByPublicId(input.db, value)),
    getAutomationRunByPublicId:
      input.getAutomationRunByPublicId ??
      ((value) => getAutomationRunByPublicId(input.db, value)),
    listAutomationRuns:
      input.listAutomationRuns ??
      ((value) => listAutomationRuns(input.db, value)),
    listAutomations:
      input.listAutomations ?? ((value) => listAutomations(input.db, value)),
    log: input.log ?? log,
    markAutomationRunFailed:
      input.markAutomationRunFailed ??
      ((value) => markAutomationRunFailed(input.db, value)),
    now: input.now ?? (() => new Date()),
    sendAutomationRunRequested:
      input.sendAutomationRunRequested ?? sendAutomationRunRequested,
    sendAutomationRunRequestedTimeoutMs:
      input.sendAutomationRunRequestedTimeoutMs ??
      AUTOMATION_RUN_ENQUEUE_TIMEOUT_MS,
    setAutomationStatus:
      input.setAutomationStatus ??
      ((value) => setAutomationStatus(input.db, value)),
    updateAutomation:
      input.updateAutomation ?? ((value) => updateAutomation(input.db, value)),
  };
}

async function sendAutomationRunRequested(
  data: Parameters<AutomationCommandDeps["sendAutomationRunRequested"]>[0]
) {
  const { inngest } = await import("../../inngest/client");
  await inngest.send({
    name: "app/automation.run.requested",
    data,
  });
}
