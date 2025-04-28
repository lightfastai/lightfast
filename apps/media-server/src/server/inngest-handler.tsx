import { serve } from "inngest/hono";

import { inngest } from "./inngest/v1/client/client";
import { handleCreateImage } from "./inngest/v1/workflow/handle-create-image";

// Export the Inngest client
export { inngest } from "./inngest/v1/client/client";
export { handleCreateImage } from "./inngest/v1/workflow/handle-create-image";
// Export a handler for Inngest functions

export const inngestHandler = serve({
  client: inngest,
  functions: [handleCreateImage],
});
