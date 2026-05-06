import { resolveWorktreeRuntimeName } from "@lightfastai/dev-core";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";
import type { GetEvents } from "inngest";

import { platformEvents } from "./schemas/platform";

const appId =
  process.env.NODE_ENV === "development"
    ? resolveWorktreeRuntimeName(env.INNGEST_APP_NAME)
    : env.INNGEST_APP_NAME;

const inngest = new Inngest({
  id: appId,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(platformEvents),
  middleware: [createInngestObservabilityMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
