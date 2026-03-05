import { postTransformEventSchema } from "./post-transform-event.js";
import type { PostTransformEvent } from "./post-transform-event.js";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export function logValidationErrors(
  transformerName: string,
  event: PostTransformEvent,
  errors: string[],
): void {
  console.error(`[Transformer:${transformerName}] Invalid PostTransformEvent:`, {
    sourceId: event.sourceId,
    sourceType: event.sourceType,
    errors,
  });
}

export function validatePostTransformEvent(
  event: PostTransformEvent,
): ValidationResult<PostTransformEvent> {
  const result = postTransformEventSchema.safeParse(event);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Sanitize a PostTransformEvent by stripping invalid URL fields.
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
              : null,
        }
      : null,
    references: event.references.map((ref) => ({
      ...ref,
      url: ref.url && isValidUrl(ref.url) ? ref.url : null,
    })),
  };
}
