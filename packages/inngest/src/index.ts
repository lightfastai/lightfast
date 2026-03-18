export { NonRetriableError, RetryAfterError } from "@vendor/inngest";

import { backfillEvents } from "./schemas/backfill.js";
import { consoleEvents } from "./schemas/console.js";
import { platformEvents } from "./schemas/platform.js";

export { platformEvents, consoleEvents, backfillEvents };

// Merged map — useful for ad-hoc sends outside a typed client
export const allEvents = {
  ...platformEvents,
  ...consoleEvents,
  ...backfillEvents,
} as const;
