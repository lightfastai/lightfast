import { EventSchemas, Inngest } from "@vendor/inngest";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";
import type { GetEvents } from "inngest";

import { env } from "../env";
import { appEvents } from "./schemas/app";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(appEvents),
  middleware: [createInngestObservabilityMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
