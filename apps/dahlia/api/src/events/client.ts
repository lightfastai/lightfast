import { EventSchemas, EventsService } from "@repo/events";

import { env } from "~/env";
import { Events } from "./types";

export const events = new EventsService({
  id: env.DAHLIA_INNGEST_APP_NAME,
  schemas: new EventSchemas().fromRecord<Events>(),
});
