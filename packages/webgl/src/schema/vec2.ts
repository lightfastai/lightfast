import { z } from "zod";

export const $Vec2 = z.object({
  x: z.number(),
  y: z.number(),
});

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
