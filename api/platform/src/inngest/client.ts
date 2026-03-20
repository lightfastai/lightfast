import { EventSchemas, Inngest } from "@vendor/inngest";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: "lightfast-memory",
  schemas: new EventSchemas().fromSchema(memoryEvents),
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
