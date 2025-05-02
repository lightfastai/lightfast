import { EventSchemas, Inngest } from "inngest";

import { env } from "@vendor/inngest/env";

import type { Events } from "./types";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromRecord<Events>(),
});

export { inngest };
