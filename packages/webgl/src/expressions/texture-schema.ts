import { z } from "zod";

/**
 * Schema for values that can be either a number or an expression string
 */
export const $ExpressionOrNumber = z.union([
  z.number(),
  z.string().describe("JavaScript expression that evaluates to a number"),
]);

/**
 * Schema for a vector2 with expression support
 */
export const $ExpressionVec2 = z.object({
  x: $ExpressionOrNumber,
  y: $ExpressionOrNumber,
});

/**
 * Schema for a vector3 with expression support
 */
export const $ExpressionVec3 = z.object({
  x: $ExpressionOrNumber,
  y: $ExpressionOrNumber,
  z: $ExpressionOrNumber,
});

/**
 * Schema for a color with expression support
 */
export const $ExpressionColor = z.object({
  r: $ExpressionOrNumber,
  g: $ExpressionOrNumber,
  b: $ExpressionOrNumber,
  a: $ExpressionOrNumber.optional(),
});

/**
 * Create a constrained numeric value that accepts expressions
 * @param constraints Min, max, and default values
 * @returns Zod schema for the constrained value
 */
export function createConstrainedExpression(constraints: {
  min?: number;
  max?: number;
  default: number | string;
}) {
  const schema = $ExpressionOrNumber;

  let description = "Numeric value or expression";
  if (constraints.min !== undefined)
    description += ` (min: ${constraints.min})`;
  if (constraints.max !== undefined)
    description += ` (max: ${constraints.max})`;

  return schema.describe(description).default(constraints.default);
}

/**
 * Create a constrained Vec2 that accepts expressions
 * @param constraints Min, max, and default values for each component
 * @returns Zod schema for the constrained Vec2
 */
export function createConstrainedExpressionVec2(constraints: {
  x: { min?: number; max?: number; default: number | string };
  y: { min?: number; max?: number; default: number | string };
}) {
  return $ExpressionVec2.extend({
    x: createConstrainedExpression(constraints.x),
    y: createConstrainedExpression(constraints.y),
  });
}

/**
 * Create a constrained Vec3 that accepts expressions
 * @param constraints Min, max, and default values for each component
 * @returns Zod schema for the constrained Vec3
 */
export function createConstrainedExpressionVec3(constraints: {
  x: { min?: number; max?: number; default: number | string };
  y: { min?: number; max?: number; default: number | string };
  z: { min?: number; max?: number; default: number | string };
}) {
  return $ExpressionVec3.extend({
    x: createConstrainedExpression(constraints.x),
    y: createConstrainedExpression(constraints.y),
    z: createConstrainedExpression(constraints.z),
  });
}
