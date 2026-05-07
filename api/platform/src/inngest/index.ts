import { serve } from "inngest/next";
import { inngest } from "./client";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [],
    servePath: "/api/inngest",
  });
}
