export { NonRetriableError, RetryAfterError } from "@vendor/inngest";

import { consoleEvents } from "./schemas/console";
import { memoryEvents } from "./schemas/memory";

export { consoleEvents, memoryEvents };

// Merged map — useful for ad-hoc sends outside a typed client
export const allEvents = {
  ...consoleEvents,
  ...memoryEvents,
} as const;
