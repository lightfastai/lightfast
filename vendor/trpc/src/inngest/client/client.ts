import { EventSchemas, Inngest, type GetEvents } from "inngest";
import { z } from "zod";

import { env } from "@vendor/inngest/env";

// Define event schemas using Zod for type safety
const eventsMap = {
  "apps-chat/generate-title": {
    data: z.object({
      sessionId: z.string(),
      userId: z.string(),
      firstMessage: z.string(),
    }),
  },
};

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(eventsMap),
});

// Export properly typed events
export type Events = GetEvents<typeof inngest>;

export { inngest };
