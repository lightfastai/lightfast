import { serve } from "inngest/next";

import { env } from "../env";
import { inngest } from "./client";
import { systemHealth } from "./workflow/system-health";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [systemHealth],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
