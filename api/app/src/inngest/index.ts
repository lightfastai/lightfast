import { serve } from "inngest/next";
import { env } from "../env";
import { inngest } from "./client";
import { automationScheduler } from "./workflow/automation-scheduler";
import { backfillSignalEntityLinks } from "./workflow/backfill-signal-entity-links";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";
import { cleanupDeveloperSandboxRuns } from "./workflow/cleanup-developer-sandbox-runs";
import { enrichSignalEntities } from "./workflow/enrich-signal-entities";
import { indexSignalEntities } from "./workflow/index-signal-entities";
import { queueLightfastIndexRefreshesFromSourceControl } from "./workflow/queue-skill-refresh-from-source-control";
import { reconcileIdentityIndexes } from "./workflow/reconcile-identity-indexes";
import { reconcileSkillIndexes } from "./workflow/reconcile-skill-indexes";
import { refreshIdentityIndex } from "./workflow/refresh-identity-index";
import { refreshSkillIndex } from "./workflow/refresh-skill-index";
import { runAutomation } from "./workflow/run-automation";
import { runEntityResolution } from "./workflow/run-entity-resolution";
import { systemHealth } from "./workflow/system-health";
import { teamMemberReconciler } from "./workflow/team-member-reconciler";

export { inngest };

function getProductionOnlyFunctions() {
  return env.VERCEL_ENV === "production" ? [systemHealth] : [];
}

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [
      ...getProductionOnlyFunctions(),
      classifySignal,
      indexSignalEntities,
      enrichSignalEntities,
      backfillSignalEntityLinks,
      classifyPeople,
      cleanupDeveloperSandboxRuns,
      automationScheduler,
      runAutomation,
      runEntityResolution,
      refreshSkillIndex,
      refreshIdentityIndex,
      reconcileSkillIndexes,
      reconcileIdentityIndexes,
      teamMemberReconciler,
      queueLightfastIndexRefreshesFromSourceControl,
    ],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
