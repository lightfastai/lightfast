import type { PostTransformEvent } from "../contracts/event";
import type { EventDefinition } from "../provider/index";
import type { TransformContext } from "../provider/primitives";
import type { SourceType } from "../registry";
import { PROVIDERS } from "../registry";

/**
 * Central webhook payload transformer.
 * Routes (provider, eventType) to the appropriate transformer.
 * Returns null for unsupported event types.
 *
 * The defineEvent() pattern ensures schema<->transform consistency.
 * Each event's schema.parse() narrows the payload before the transform runs.
 */
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext
): PostTransformEvent | null {
  const providerDef = PROVIDERS[provider];

  const category = providerDef.resolveCategory(eventType);
  const events = providerDef.events as Record<string, EventDefinition>;
  const eventDef = events[category];
  if (!eventDef) {
    return null;
  }

  const parsed = eventDef.schema.parse(payload);
  return eventDef.transform(parsed, context, eventType);
}
