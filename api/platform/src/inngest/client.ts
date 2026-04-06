import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";
import type { GetEvents } from "inngest";

import { platformEvents } from "./schemas/platform";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(platformEvents),
  middleware: [createInngestObservabilityMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
