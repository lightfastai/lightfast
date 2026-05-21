import { serve } from "inngest/next";
import { inngest } from "./client";
import { classifySignal } from "./workflow/classify-signal";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [classifySignal],
    servePath: "/api/inngest",
  });
}
