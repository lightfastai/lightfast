import { z } from "zod";

import type { Value } from "./value";

export const $Vec2 = z.object({
  x: z.number(),
  y: z.number(),
});

export type Vec2 = z.infer<typeof $Vec2>;

interface ConstrainedVec2 {
  x: {
    min: number;
    max: number;
    default: number;
  };
  y: {
    min: number;
    max: number;
    default: number;
  };
}

export const createConstrainedVec2 = (constraints: ConstrainedVec2) => {
  return $Vec2.extend({
    x: z
      .number()
      .min(constraints.x.min)
      .max(constraints.x.max)
      .default(constraints.x.default),
    y: z
      .number()
      .min(constraints.y.min)
      .max(constraints.y.max)
      .default(constraints.y.default),
  });
};

export function isVec2(value: Value): value is Vec2 {
  return $Vec2.safeParse(value).success;
}
