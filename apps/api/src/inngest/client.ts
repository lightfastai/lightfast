import { EventSchemas, Inngest } from "inngest";

import type { Events } from "./types";
import { env } from "~/env";

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  schemas: new EventSchemas().fromRecord<Events>(),
});
