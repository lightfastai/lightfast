import { serve } from "inngest/next";

import { env } from "../env";
import { inngest } from "./client";
import { systemHealth } from "./workflow/system-health";

export { inngest };

function getProductionOnlyFunctions() {
  return env.VERCEL_ENV === "production" ? [systemHealth] : [];
}

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [...getProductionOnlyFunctions()],
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
    servePath: "/api/inngest",
  });
}
