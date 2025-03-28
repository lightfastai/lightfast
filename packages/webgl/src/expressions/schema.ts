import { z } from "zod";

/**
 * Schema for a value that can be either a number or an expression string
 */
export const $ExpressionOrNumber = z.union([
  z.number(),
  z.string().describe("JavaScript expression that evaluates to a number"),
]);

export type ExpressionOrNumber = z.infer<typeof $ExpressionOrNumber>;

/**
 * Schema for a vector 2D where each component can be a number or an expression
 */
export const $ExpressionVec2 = z.object({
  x: $ExpressionOrNumber,
  y: $ExpressionOrNumber,
});

export type ExpressionVec2 = z.infer<typeof $ExpressionVec2>;

/**
 * Create a constrained Vec2 schema that accepts expressions or numbers
 * @param constraints The min/max/default constraints for each component
 * @returns A Zod schema for a Vec2 with expression support
 */
export const createConstrainedExpressionVec2 = (constraints: {
  x: { min: number; max: number; default: number | string };
  y: { min: number; max: number; default: number | string };
}) => {
  return $ExpressionVec2.extend({
    x: $ExpressionOrNumber
      .describe(
        `X component (min: ${constraints.x.min}, max: ${constraints.x.max})`,
      )
      .default(constraints.x.default),
    y: $ExpressionOrNumber
      .describe(
        `Y component (min: ${constraints.y.min}, max: ${constraints.y.max})`,
      )
      .default(constraints.y.default),
  });
};

/**
 * Check if a value is a string expression
 * @param value Value to check
 * @returns True if the value is a string (expression)
 */
export function isExpression(value: any): value is string {
  return typeof value === "string";
}

/**
 * Check if a value is a numeric literal
 * @param value Value to check
 * @returns True if the value is a number
 */
export function isNumericLiteral(value: any): value is number {
  return typeof value === "number";
}
