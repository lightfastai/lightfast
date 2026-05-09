import { serve } from "inngest/next";
import { inngest } from "./client";
import { recordActivity } from "./workflow/record-activity";

export { inngest, recordActivity };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [recordActivity],
    servePath: "/api/inngest",
  });
}
