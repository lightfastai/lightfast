import { EventSchemas, Inngest } from "inngest";

import { env } from "~/env";
import { Events } from "./types";

export const inngest = new Inngest({
  id: env.DAHLIA_INNGEST_APP_NAME,
  schemas: new EventSchemas().fromRecord<Events>(),
});
