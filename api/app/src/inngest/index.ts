import { serve } from "inngest/next";
import { env } from "../env";
import { inngest } from "./client";
import { automationScheduler } from "./workflow/automation-scheduler";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";
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
      automationScheduler,
      runAutomation,
    ],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
