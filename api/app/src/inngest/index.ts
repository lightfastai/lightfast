/**
 * Inngest exports for console application
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { recordActivity } from "./workflow/infrastructure/record-activity";

export { inngest };
export { recordActivity };

/**
 * Create the route context for Next.js API routes
 *
 * Registered functions:
 * 1. recordActivity - Activity logging
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [recordActivity],
    servePath: "/api/inngest",
  });
}
