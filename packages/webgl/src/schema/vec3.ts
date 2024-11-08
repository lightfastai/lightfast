import { z } from "zod";

import type { Value } from "./value";

// Base Vec3 schema without constraints
export const $Vec3 = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type Vec3 = z.infer<typeof $Vec3>;

interface ConstrainedVec3 {
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
  z: {
    min: number;
    max: number;
    default: number;
  };
}

export const createConstrainedVec3 = (constraints: ConstrainedVec3) => {
  return $Vec3.extend({
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
    z: z
      .number()
      .min(constraints.z.min)
      .max(constraints.z.max)
      .default(constraints.z.default),
  });
};

export function isVec3(value: Value): value is Vec3 {
  return $Vec3.safeParse(value).success;
}
