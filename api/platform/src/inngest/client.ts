import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: "lightfast-memory",
  schemas: new EventSchemas().fromSchema(memoryEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
