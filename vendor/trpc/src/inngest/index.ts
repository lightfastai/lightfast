import { serve } from "inngest/next";

import { inngest } from "./client/client";
import { generateChatTitle } from "./workflow/generate-chat-title";

export const createInngestRouteContext = () =>
  serve({
    client: inngest,
    functions: [generateChatTitle],
    servePath: "/api/inngest",
  });
