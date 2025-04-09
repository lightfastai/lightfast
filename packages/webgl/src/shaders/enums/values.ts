import { z } from "zod";

export const $ValueTypeValues = [
  "Numeric",
  "Vec2",
  "Vec3",
  "Boolean",
  "Color",
  "String",
  "Sampler2D",
] as const;

export const $ValueType = z.enum($ValueTypeValues);

export type ValueType = z.infer<typeof $ValueType>;
