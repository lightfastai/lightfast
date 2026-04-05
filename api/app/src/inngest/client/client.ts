import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

import { appEvents } from "../schemas/app";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(appEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
