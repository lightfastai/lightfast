import type { GetEvents } from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";
import { env } from "@vendor/inngest/env";

/**
 * Inngest client for console application.
 * Schemas are sourced from @repo/inngest (all platform + console + backfill events).
 */
const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  withSentry: true,
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
