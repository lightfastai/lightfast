import { EventSchemas, Inngest } from "@vendor/inngest";

import type { Events } from "./types";

const inngest = new Inngest({
  // id: env.INNGEST_APP_NAME,
  // eventKey: env.INNGEST_EVENT_KEY,
  // signingKey: env.INNGEST_SIGNING_KEY,
  id: "lightfast-media-server",
  schemas: new EventSchemas().fromRecord<Events>(),
});

export { inngest };
