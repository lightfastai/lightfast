import type { PostTransformEvent } from "../contracts/event";
import { postTransformEventSchema } from "../contracts/event";

interface ValidationResult<T> {
  data?: T;
  errors?: string[];
  success: boolean;
}

export function logValidationErrors(
  transformerName: string,
  event: PostTransformEvent,
  errors: string[]
): void {
  console.error(
    `[Transformer:${transformerName}] Invalid PostTransformEvent:`,
    {
      sourceId: event.sourceId,
      eventType: event.eventType,
      errors,
    }
  );
}

export function validatePostTransformEvent(
  event: PostTransformEvent
): ValidationResult<PostTransformEvent> {
  const result = postTransformEventSchema.safeParse(event);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Sanitize a PostTransformEvent by stripping invalid URL fields.
 */
export function sanitizePostTransformEvent(
  event: PostTransformEvent
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
    entity: {
      ...event.entity,
      url:
        event.entity.url && isValidUrl(event.entity.url)
          ? event.entity.url
          : null,
    },
    relations: event.relations.map((rel) => ({
      ...rel,
      url: rel.url && isValidUrl(rel.url) ? rel.url : null,
    })),
  };
}
