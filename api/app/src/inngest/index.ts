import { serve } from "inngest/next";
import { inngest } from "./client";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [classifySignal, classifyPeople],
    servePath: "/api/inngest",
  });
}
