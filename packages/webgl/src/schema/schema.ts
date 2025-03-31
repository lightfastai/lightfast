import { z } from "zod";

// Expression prefix for serialization
export const EXPRESSION_PREFIX = "e.";

// Vector mode enum
export enum VectorMode {
  Number = "number",
  Expression = "expression",
}

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

// Base types
export const $Boolean = z.boolean();
export type Boolean = z.infer<typeof $Boolean>;

export const $Number = z.number();
export type Number = z.infer<typeof $Number>;

export const $Expression = z
  .string()
  .refine(
    (val) => val.startsWith(EXPRESSION_PREFIX),
    "Expression must start with 'e.'",
  );
export type Expression = z.infer<typeof $Expression>;

// Numeric types that can be either a number or an expression
export const $NumericValue = z.union([$Number, $Expression]);
export type NumericValue = z.infer<typeof $NumericValue>;

// Vec1 schemas for each mode
export const $Vec1Number = z.object({
  x: $Number,
});

export const $Vec1Expression = z.object({
  x: $Expression,
});

export const $Vec1 = z.union([$Vec1Number, $Vec1Expression]);
export type Vec1 = z.infer<typeof $Vec1>;

// Vec2 schemas for each mode
export const $Vec2Number = z.object({
  x: $Number,
  y: $Number,
});

export const $Vec2Expression = z.object({
  x: $Expression,
  y: $Expression,
});

export const $Vec2 = z.union([$Vec2Number, $Vec2Expression]);
export type Vec2 = z.infer<typeof $Vec2>;

// Vec3 schemas for each mode
export const $Vec3Number = z.object({
  x: $Number,
  y: $Number,
  z: $Number,
});

export const $Vec3Expression = z.object({
  x: $Expression,
  y: $Expression,
  z: $Expression,
});

export const $Vec3 = z.union([$Vec3Number, $Vec3Expression]);
export type Vec3 = z.infer<typeof $Vec3>;

// Color schema (no expressions supported)
export const $Color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Must be a valid 6-digit hex color");
export type Color = z.infer<typeof $Color>;

// Value type union
export type Value = Color | Vec1 | Vec2 | Vec3 | NumericValue | Boolean;

// Type guards
export function isBoolean(value: unknown): value is Boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is Number {
  return typeof value === "number";
}

export function isExpression(value: unknown): value is Expression {
  return isExpressionString(value);
}

export function isNumericValue(value: unknown): value is NumericValue {
  return isNumber(value) || isExpression(value);
}

export function isColor(value: unknown): value is Color {
  if (typeof value !== "string") return false;
  return /^#[0-9a-f]{6}$/i.test(value);
}

// Vector type guards
export function isVec1(value: unknown): value is Vec1 {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return "x" in obj && (isNumber(obj.x) || isExpression(obj.x));
}

export function isVec2(value: unknown): value is Vec2 {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!("x" in obj && "y" in obj)) return false;

  // Both components must be of the same type
  return (
    (isNumber(obj.x) && isNumber(obj.y)) ||
    (isExpression(obj.x) && isExpression(obj.y))
  );
}

export function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!("x" in obj && "y" in obj && "z" in obj)) return false;

  // All components must be of the same type
  return (
    (isNumber(obj.x) && isNumber(obj.y) && isNumber(obj.z)) ||
    (isExpression(obj.x) && isExpression(obj.y) && isExpression(obj.z))
  );
}

// Vector mode detection functions
export function getVec1Mode(vec: Vec1): VectorMode {
  return isExpression(vec.x) ? VectorMode.Expression : VectorMode.Number;
}

export function getVec2Mode(vec: Vec2): VectorMode {
  // Since we enforce all components to be the same type, we only need to check one
  return isExpression(vec.x) ? VectorMode.Expression : VectorMode.Number;
}

export function getVec3Mode(vec: Vec3): VectorMode {
  // Since we enforce all components to be the same type, we only need to check one
  return isExpression(vec.x) ? VectorMode.Expression : VectorMode.Number;
}

// Helper functions to check specific modes
export function isVec1Expression(vec: Vec1): boolean {
  return getVec1Mode(vec) === VectorMode.Expression;
}

export function isVec2Expression(vec: Vec2): boolean {
  return getVec2Mode(vec) === VectorMode.Expression;
}

export function isVec3Expression(vec: Vec3): boolean {
  return getVec3Mode(vec) === VectorMode.Expression;
}

export function isVec1Number(vec: Vec1): boolean {
  return getVec1Mode(vec) === VectorMode.Number;
}

export function isVec2Number(vec: Vec2): boolean {
  return getVec2Mode(vec) === VectorMode.Number;
}

export function isVec3Number(vec: Vec3): boolean {
  return getVec3Mode(vec) === VectorMode.Number;
}

// Constraint types
interface NumericConstraint {
  min: number;
  max: number;
  default: number | string;
}

interface VectorConstraints<T extends "vec1" | "vec2" | "vec3"> {
  mode: VectorMode;
  components: T extends "vec1"
    ? { x: NumericConstraint }
    : T extends "vec2"
      ? { x: NumericConstraint; y: NumericConstraint }
      : { x: NumericConstraint; y: NumericConstraint; z: NumericConstraint };
}

// Helper to validate expression values against constraints
function validateExpressionValue(
  value: string,
  constraint: NumericConstraint,
): string {
  // We can't validate the exact value at runtime since it's an expression,
  // but we can add the constraints as metadata in the expression
  return createExpressionString(
    `Math.max(${constraint.min}, Math.min(${constraint.max}, ${extractExpression(value)}))`,
  );
}

// Helper to validate numeric values against constraints
function validateNumericValue(
  value: number,
  constraint: NumericConstraint,
): number {
  return Math.max(constraint.min, Math.min(constraint.max, value));
}

export const createConstrainedVec1 = (
  constraints: VectorConstraints<"vec1">,
) => {
  if (constraints.mode === VectorMode.Expression) {
    return $Vec1Expression.extend({
      x: $Expression
        .describe(
          `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.x),
        )
        .default(
          createExpressionString(constraints.components.x.default as string),
        ),
    });
  }

  return $Vec1Number.extend({
    x: $Number
      .describe(
        `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.x))
      .default(constraints.components.x.default as number),
  });
};

export const createConstrainedVec2 = (
  constraints: VectorConstraints<"vec2">,
) => {
  if (constraints.mode === VectorMode.Expression) {
    return $Vec2Expression.extend({
      x: $Expression
        .describe(
          `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.x),
        )
        .default(
          createExpressionString(constraints.components.x.default as string),
        ),
      y: $Expression
        .describe(
          `Y component (min: ${constraints.components.y.min}, max: ${constraints.components.y.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.y),
        )
        .default(
          createExpressionString(constraints.components.y.default as string),
        ),
    });
  }

  return $Vec2Number.extend({
    x: $Number
      .describe(
        `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.x))
      .default(constraints.components.x.default as number),
    y: $Number
      .describe(
        `Y component (min: ${constraints.components.y.min}, max: ${constraints.components.y.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.y))
      .default(constraints.components.y.default as number),
  });
};

export const createConstrainedVec3 = (
  constraints: VectorConstraints<"vec3">,
) => {
  if (constraints.mode === VectorMode.Expression) {
    return $Vec3Expression.extend({
      x: $Expression
        .describe(
          `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.x),
        )
        .default(
          createExpressionString(constraints.components.x.default as string),
        ),
      y: $Expression
        .describe(
          `Y component (min: ${constraints.components.y.min}, max: ${constraints.components.y.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.y),
        )
        .default(
          createExpressionString(constraints.components.y.default as string),
        ),
      z: $Expression
        .describe(
          `Z component (min: ${constraints.components.z.min}, max: ${constraints.components.z.max})`,
        )
        .transform((val) =>
          validateExpressionValue(val, constraints.components.z),
        )
        .default(
          createExpressionString(constraints.components.z.default as string),
        ),
    });
  }

  return $Vec3Number.extend({
    x: $Number
      .describe(
        `X component (min: ${constraints.components.x.min}, max: ${constraints.components.x.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.x))
      .default(constraints.components.x.default as number),
    y: $Number
      .describe(
        `Y component (min: ${constraints.components.y.min}, max: ${constraints.components.y.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.y))
      .default(constraints.components.y.default as number),
    z: $Number
      .describe(
        `Z component (min: ${constraints.components.z.min}, max: ${constraints.components.z.max})`,
      )
      .transform((val) => validateNumericValue(val, constraints.components.z))
      .default(constraints.components.z.default as number),
  });
};
