/**
 * Webhook Validation Utilities
 *
 * Runtime validation for transformed webhook events using Zod schemas.
 */

import { postTransformEventSchema } from "@repo/console-validation";
import type { PostTransformEvent } from "@repo/console-validation";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate PostTransformEvent against Zod schema.
 * Returns structured result with error details.
 */
/**
 * Log validation errors for PostTransformEvent.
 * Validation is for monitoring — events are still returned to avoid breaking existing flows.
 */
export function logValidationErrors(
  transformerName: string,
  event: PostTransformEvent,
  errors: string[]
): void {
  console.error(`[Transformer:${transformerName}] Invalid PostTransformEvent:`, {
    sourceId: event.sourceId,
    sourceType: event.sourceType,
    errors,
  });
}

export function validatePostTransformEvent(
  event: PostTransformEvent
): ValidationResult<PostTransformEvent> {
  const result = postTransformEventSchema.safeParse(event);

  if (result.success) {
    return { success: true, data: result.data as PostTransformEvent };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}

/**
 * Sanitize a PostTransformEvent by stripping invalid URL fields.
 * Ensures the event passes strict Zod .url() validation at emit time
 * (e.g. Upstash Realtime schema validation).
 *
 * Invalid URLs are set to undefined rather than blocking the pipeline.
 * This is a defensive measure for any source of bad URL data.
 */
export function sanitizePostTransformEvent(
  event: PostTransformEvent,
): PostTransformEvent {
  const isValidUrl = (u: string): boolean => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  };

  return {
    ...event,
    actor: event.actor
      ? {
          ...event.actor,
          avatarUrl:
            event.actor.avatarUrl && isValidUrl(event.actor.avatarUrl)
              ? event.actor.avatarUrl
              : undefined,
        }
      : undefined,
    references: event.references.map((ref) => ({
      ...ref,
      url: ref.url && isValidUrl(ref.url) ? ref.url : undefined,
    })),
  };
}
