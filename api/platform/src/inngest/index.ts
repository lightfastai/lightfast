/**
 * Inngest exports for platform application
 *
 * Registered functions:
 * 1. connectionLifecycle - Connection teardown (close gate, revoke, cleanup)
 * 2. healthCheck - 5m cron: probe all active installations
 * 3. tokenRefresh - 5m cron: refresh expiring OAuth tokens
 */

import { serve } from "inngest/next";
import { inngest } from "./client";
import { connectionLifecycle } from "./functions/connection-lifecycle";
import { healthCheck } from "./functions/health-check";
import { tokenRefresh } from "./functions/token-refresh";

export { connectionLifecycle, healthCheck, inngest, tokenRefresh };

/**
 * Create the Inngest route handler for Next.js
 */
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [connectionLifecycle, healthCheck, tokenRefresh],
    servePath: "/api/inngest",
  });
}
