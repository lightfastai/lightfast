import { createInngestClient } from "@repo/inngest/client";
import { env } from "@vendor/inngest/env";

/**
 * Gateway Inngest client.
 *
 * Uses the shared `@repo/inngest` client factory which registers all platform,
 * console, and backfill event schemas. This ensures the gateway can send typed
 * events (e.g. `platform/connection.lifecycle`) that other services consume.
 *
 * Inngest env vars are sourced directly from `@vendor/inngest/env` (not the
 * gateway's own env.ts) — same pattern as `api/console/src/inngest/client/client.ts`.
 */
export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
});
