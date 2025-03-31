import { z } from "zod";

import type { Value } from "./value";
import { isExpressionString } from "../expressions/schema";

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
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;
  return (
    "x" in obj &&
    "y" in obj &&
    (typeof obj.x === "number" || isExpressionString(obj.x)) &&
    (typeof obj.y === "number" || isExpressionString(obj.y))
  );
}

export function isExpressionVec2(value: Value): boolean {
  if (!isVec2(value)) return false;
  return isExpressionString(value.x) || isExpressionString(value.y);
}
