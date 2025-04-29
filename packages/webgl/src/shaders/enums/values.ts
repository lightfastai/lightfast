import { z } from "zod";

export const $ValueType = z.enum([
  "Numeric",
  "Vec2",
  "Vec3",
  "Boolean",
  "Color",
  "String",
  "Sampler2D",
]);

export type ValueType = z.infer<typeof $ValueType>;
