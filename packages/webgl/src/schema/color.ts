import { z } from "zod";

import type { Value } from "./value";

export const $Color = z.string().regex(/^#([0-9a-f]{6})$/i);

export type Color = z.infer<typeof $Color>;

export function isColor(value: Value): value is Color {
  return $Color.safeParse(value).success;
}
