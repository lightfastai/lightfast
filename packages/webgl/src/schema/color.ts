import { z } from "zod";

import type { Value } from "./value";

// Strict hex color regex that only allows 6-digit hex colors
export const $Color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Must be a valid 6-digit hex color");

export type Color = z.infer<typeof $Color>;

export function isColor(value: Value): value is Color {
  if (typeof value !== "string") return false;
  return /^#[0-9a-f]{6}$/i.test(value);
}
