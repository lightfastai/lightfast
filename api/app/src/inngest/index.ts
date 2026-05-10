import { serve } from "inngest/next";
import { inngest } from "./client";
import { platformHeartbeat } from "./workflow/platform-heartbeat";
import { recordActivity } from "./workflow/record-activity";

export { inngest, platformHeartbeat, recordActivity };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [recordActivity, platformHeartbeat],
    servePath: "/api/inngest",
  });
}
