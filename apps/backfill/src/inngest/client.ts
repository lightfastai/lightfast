import { createInngestClient } from "@repo/inngest/client";
import { env } from "../env.js";

export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  // No sentry middleware for backfill service
});
