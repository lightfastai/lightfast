import { serve } from "inngest/next";
import { inngest } from "./client";
import { classifyOpportunity } from "./workflow/classify-opportunity";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [classifyOpportunity],
    servePath: "/api/inngest",
  });
}
