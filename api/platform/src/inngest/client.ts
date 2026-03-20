import type { GetEvents } from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";

/**
 * Memory service Inngest client.
 *
 * App ID is "lightfast-memory". Uses the shared @repo/inngest client factory
 * which registers all event schemas.
 */
const inngest = createInngestClient({
  appName: "lightfast-memory",
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
