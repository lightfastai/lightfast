/**
 * Inngest exports for chat application
 */

import { serve } from "inngest/next";
import { inngest } from "./client/client";
import { generateChatTitle } from "./workflow/generate-chat-title";

export { inngest };
export { generateChatTitle };

// Create the route context for Next.js API routes
export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [generateChatTitle],
    servePath: "/api/inngest",
  });
}