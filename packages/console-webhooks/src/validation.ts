/**
 * Webhook Validation Utilities
 *
 * Runtime validation for transformed webhook events using Zod schemas.
 */

import { sourceEventSchema } from "@repo/console-validation";
import type { SourceEvent } from "@repo/console-types";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate SourceEvent against Zod schema
 * Returns structured result with error details
 *
 * @param event - The SourceEvent to validate
 * @returns Validation result with parsed data or errors
 */
export function validateSourceEvent(
  event: SourceEvent
): ValidationResult<SourceEvent> {
  const result = sourceEventSchema.safeParse(event);

  if (result.success) {
    return { success: true, data: result.data as SourceEvent };
  }

  return {
    success: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}
