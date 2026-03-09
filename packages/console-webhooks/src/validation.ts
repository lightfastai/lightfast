/**
 * Webhook Validation Utilities
 *
 * Runtime validation for transformed webhook events using Zod schemas.
 */

import type { SourceEvent } from "@repo/console-types";
import { sourceEventSchema } from "@repo/console-validation";

export interface ValidationResult<T> {
  data?: T;
  errors?: string[];
  success: boolean;
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
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
