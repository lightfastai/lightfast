import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(memoryEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
