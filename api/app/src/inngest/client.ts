import { Inngest } from "@vendor/inngest";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";

import { env } from "../env";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  middleware: [createInngestObservabilityMiddleware()],
});

export { inngest };
