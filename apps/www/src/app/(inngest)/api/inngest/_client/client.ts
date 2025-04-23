import { EventSchemas, Inngest } from "@vendor/inngest";

import type { Events } from "./types";
import { env } from "~/env";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  schemas: new EventSchemas().fromRecord<Events>(),
});

export { inngest };
