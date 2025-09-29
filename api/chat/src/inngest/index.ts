/**
 * Inngest exports for chat application
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { generateChatTitle } from "./workflow/generate-chat-title";
import { cleanupActiveStreams } from "./workflow/cleanup-active-streams";
import { backfillMessageCharMetrics } from "./workflow/backfill-message-char-metrics";

export { inngest };
export { generateChatTitle };
export { cleanupActiveStreams };
export { backfillMessageCharMetrics };

// Create the route context for Next.js API routes
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [generateChatTitle, cleanupActiveStreams, backfillMessageCharMetrics],
    servePath: "/api/inngest",
  });
}
