import { serve } from "inngest/next";

import { inngest } from "./client/client";
import { deepResearchNetworkFunction } from "./workflow/handle-blender-agent";

export const createInngestRouteContext = () =>
  serve({
    client: inngest,
    functions: [deepResearchNetworkFunction],
    servePath: "/api/inngest",
  });
