import { serve } from "inngest/next";
import { env } from "../env";
import { inngest } from "./client";
import { automationScheduler } from "./workflow/automation-scheduler";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";
import { cleanupDeveloperSandboxRuns } from "./workflow/cleanup-developer-sandbox-runs";
import { queueLightfastIndexRefreshesFromSourceControl } from "./workflow/queue-skill-refresh-from-source-control";
import { reconcileIdentityIndexes } from "./workflow/reconcile-identity-indexes";
import { reconcileSkillIndexes } from "./workflow/reconcile-skill-indexes";
import { refreshIdentityIndex } from "./workflow/refresh-identity-index";
import { refreshSkillIndex } from "./workflow/refresh-skill-index";
import { runAutomation } from "./workflow/run-automation";
import { systemHealth } from "./workflow/system-health";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      systemHealth,
      classifySignal,
      classifyPeople,
      cleanupDeveloperSandboxRuns,
      automationScheduler,
      runAutomation,
      refreshSkillIndex,
      refreshIdentityIndex,
      reconcileSkillIndexes,
      reconcileIdentityIndexes,
      queueLightfastIndexRefreshesFromSourceControl,
    ],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
