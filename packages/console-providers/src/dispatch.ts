import type { PostTransformEvent, SourceType } from "@repo/console-validation";
import type { TransformContext } from "./types.js";
import { PROVIDERS } from "./registry.js";

/**
 * Central webhook payload transformer.
 * Routes (provider, eventType) to the appropriate transformer.
 * Returns null for unsupported event types.
 *
 * Zero `as` casts — the defineEvent() pattern ensures schema<->transform consistency.
 * Each event's schema.parse() narrows the payload before the transform runs.
 */
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  const providerDef = PROVIDERS[provider];

  const category = providerDef.resolveCategory?.(eventType) ?? eventType;
  const eventDef = providerDef.events[category];
  if (!eventDef) return null;

  const parsed = eventDef.schema.parse(payload);
  return eventDef.transform(parsed, { ...context, eventType });
}
