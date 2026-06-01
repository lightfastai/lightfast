import { serve } from "inngest/next";
import { env } from "../env";
import { inngest } from "./client";
import { automationScheduler } from "./workflow/automation-scheduler";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";
import { queueSkillRefreshFromSourceControl } from "./workflow/queue-skill-refresh-from-source-control";
import { reconcileSkillIndexes } from "./workflow/reconcile-skill-indexes";
import { refreshSkillIndex } from "./workflow/refresh-skill-index";
import { runAutomation } from "./workflow/run-automation";
import { syncGitHubSourceControlRepository } from "./workflow/sync-source-control-repository";
import { systemHealth } from "./workflow/system-health";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      systemHealth,
      classifySignal,
      classifyPeople,
      automationScheduler,
      runAutomation,
      syncGitHubSourceControlRepository,
      refreshSkillIndex,
      reconcileSkillIndexes,
      queueSkillRefreshFromSourceControl,
    ],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
