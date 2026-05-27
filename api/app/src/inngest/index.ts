import { serve } from "inngest/next";
import { env } from "../env";
import { inngest } from "./client";
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [classifySignal, classifyPeople],
    serveHost: env.INNGEST_SERVE_HOST,
    servePath: "/api/inngest",
  });
}
