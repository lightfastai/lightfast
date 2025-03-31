import { z } from "zod";

// Expression prefix for serialization
export const EXPRESSION_PREFIX = "e.";

// Helper to check if a value is an expression string
export function isExpressionString(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(EXPRESSION_PREFIX);
}

// Helper to create an expression string
export function createExpressionString(expression: string): string {
  return `${EXPRESSION_PREFIX}${expression}`;
}

// Helper to extract expression from prefixed string
export function extractExpression(value: string): string {
  return value.slice(EXPRESSION_PREFIX.length);
}

/**
 * Schema for a value that can be either a number or an expression string
 */
export const $ExpressionOrNumber = z.union([
  z.number(),
  z
    .string()
    .refine(
      (val) => val.startsWith(EXPRESSION_PREFIX),
      "Expression must start with 'e.'",
    ),
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
 * Schema for a vector 3D where each component can be a number or an expression
 */
export const $ExpressionVec3 = z.object({
  x: $ExpressionOrNumber,
  y: $ExpressionOrNumber,
  z: $ExpressionOrNumber,
});

export type ExpressionVec3 = z.infer<typeof $ExpressionVec3>;

/**
 * Create a constrained Vec2 schema that accepts expressions or numbers
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
      .default(
        typeof constraints.x.default === "string"
          ? createExpressionString(constraints.x.default)
          : constraints.x.default,
      ),
    y: $ExpressionOrNumber
      .describe(
        `Y component (min: ${constraints.y.min}, max: ${constraints.y.max})`,
      )
      .default(
        typeof constraints.y.default === "string"
          ? createExpressionString(constraints.y.default)
          : constraints.y.default,
      ),
  });
};

/**
 * Create a constrained Vec3 schema that accepts expressions or numbers
 */
export const createConstrainedExpressionVec3 = (constraints: {
  x: { min: number; max: number; default: number | string };
  y: { min: number; max: number; default: number | string };
  z: { min: number; max: number; default: number | string };
}) => {
  return $ExpressionVec3.extend({
    x: $ExpressionOrNumber
      .describe(
        `X component (min: ${constraints.x.min}, max: ${constraints.x.max})`,
      )
      .default(
        typeof constraints.x.default === "string"
          ? createExpressionString(constraints.x.default)
          : constraints.x.default,
      ),
    y: $ExpressionOrNumber
      .describe(
        `Y component (min: ${constraints.y.min}, max: ${constraints.y.max})`,
      )
      .default(
        typeof constraints.y.default === "string"
          ? createExpressionString(constraints.y.default)
          : constraints.y.default,
      ),
    z: $ExpressionOrNumber
      .describe(
        `Z component (min: ${constraints.z.min}, max: ${constraints.z.max})`,
      )
      .default(
        typeof constraints.z.default === "string"
          ? createExpressionString(constraints.z.default)
          : constraints.z.default,
      ),
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
