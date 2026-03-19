export { NonRetriableError, RetryAfterError } from "@vendor/inngest";

import { consoleEvents } from "./schemas/console.js";
import { memoryEvents } from "./schemas/memory.js";

export { consoleEvents, memoryEvents };

// Merged map — useful for ad-hoc sends outside a typed client
export const allEvents = {
  ...consoleEvents,
  ...memoryEvents,
} as const;
