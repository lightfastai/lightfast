import type {
  EventDefinition,
  EventKey,
  ProviderName,
} from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import type { ZodType } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = ZodType<any>;

/** Maps EventKey → Zod schema derived from PROVIDERS definitions */
export function getSchemaForEvent(eventKey: EventKey): Schema {
  const [source, rest = ""] = (eventKey as string).split(":");
  const dotIdx = rest.indexOf(".");
  const category = dotIdx >= 0 ? rest.slice(0, dotIdx) : rest;

  const events = PROVIDERS[source as ProviderName].events as Record<
    string,
    EventDefinition
  >;
  const eventDef = events[category];
  if (!eventDef) {
    throw new Error(`No schema for event key: ${eventKey}`);
  }

  return eventDef.schema;
}
