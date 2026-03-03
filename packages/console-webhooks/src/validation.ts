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
