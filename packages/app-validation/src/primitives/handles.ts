import { organization } from "@repo/app-reserved-names";
import { z } from "zod";

const LIGHTFAST_HANDLE = {
  END_PATTERN: /[a-z0-9]$/,
  MAX_LENGTH: 64,
  MIN_LENGTH: 4,
  NO_CONSECUTIVE_HYPHENS: /--/,
  PATTERN: /^[a-z0-9-]+$/,
  START_PATTERN: /^[a-z0-9]/,
} as const;

const HANDLE_ERRORS = {
  CONSECUTIVE: "Handle cannot contain consecutive hyphens",
  END: "Handle must end with a letter or number",
  MAX_LENGTH: `Handle must be less than ${LIGHTFAST_HANDLE.MAX_LENGTH + 1} characters`,
  MIN_LENGTH: `Handle must be at least ${LIGHTFAST_HANDLE.MIN_LENGTH} characters`,
  PATTERN: "Only lowercase letters, numbers, and hyphens are allowed",
  RESERVED:
    "This handle is reserved for system use. Please choose a different handle.",
  START: "Handle must start with a letter or number",
} as const;

export function normalizeLightfastHandle(value: string) {
  return value.trim().toLowerCase();
}

export const lightfastHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIGHTFAST_HANDLE.MIN_LENGTH, HANDLE_ERRORS.MIN_LENGTH)
  .max(LIGHTFAST_HANDLE.MAX_LENGTH, HANDLE_ERRORS.MAX_LENGTH)
  .regex(LIGHTFAST_HANDLE.PATTERN, HANDLE_ERRORS.PATTERN)
  .regex(LIGHTFAST_HANDLE.START_PATTERN, HANDLE_ERRORS.START)
  .regex(LIGHTFAST_HANDLE.END_PATTERN, HANDLE_ERRORS.END)
  .refine((handle) => !LIGHTFAST_HANDLE.NO_CONSECUTIVE_HYPHENS.test(handle), {
    message: HANDLE_ERRORS.CONSECUTIVE,
  })
  .refine((handle) => !organization.check(handle), {
    message: HANDLE_ERRORS.RESERVED,
  });

export type LightfastHandle = z.infer<typeof lightfastHandleSchema>;
