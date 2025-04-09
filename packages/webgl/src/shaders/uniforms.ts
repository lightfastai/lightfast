import { z } from "zod";

import type { VectorMode } from "./enums/vector-mode";
import { $VectorMode } from "./enums/vector-mode";

// Expression prefix for serialization
export const EXPRESSION_PREFIX = "e.";

export const $Sampler2D = z.object({
  vuvID: z.number().nullable(),
});
export type Sampler2D = z.infer<typeof $Sampler2D>;

// Helper to check if a value is an expression string
export function isExpressionString(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(EXPRESSION_PREFIX);
}

// Helper to create an expression string
export function createExpressionString(expression: string): string {
  return `${EXPRESSION_PREFIX}{${expression}}`;
}

// Helper to convert an expression string to a numeric value
export function expressionToNumericValue(expression: string): NumericValue {
  return parseFloat(extractExpression(expression));
}

/**
 * Extracts an expression from the prefixed format
 * Handles expressions like "e.{time * 0.5}" by removing the prefix and braces
 */
export const extractExpression = (expression: string): string => {
  if (!expression.startsWith(EXPRESSION_PREFIX)) {
    return expression;
  }

  // Remove the "e." prefix and any braces
  let result = expression.slice(EXPRESSION_PREFIX.length);
  if (result.startsWith("{") && result.endsWith("}")) {
    result = result.slice(1, -1);
  }
  return result;
};

export const $String = z.string();
export type String = z.infer<typeof $String>;

// Base types
export const $Boolean = z.boolean();
export type Boolean = z.infer<typeof $Boolean>;

export const $Integer = z.number().int();
export type Integer = z.infer<typeof $Integer>;

export const $Float = z.number();
export type Float = z.infer<typeof $Float>;

export const $Number = z.number();
export type Number = z.infer<typeof $Number>;

export const $Expression = z
  .string()
  .refine(
    (val) => val.startsWith(EXPRESSION_PREFIX),
    "Expression must start with 'e.'",
  );
export type Expression = z.infer<typeof $Expression>;

// NumericValue is either a Float or Expression
export type NumericValue = Float | Expression;
export const $NumericValue = z.union([$Float, $Expression]);

// Vec2 schemas for each mode
export const $Vec2Number = z.object({
  x: $Float,
  y: $Float,
});

export const $Vec2Expression = z.object({
  x: $NumericValue,
  y: $NumericValue,
});

export const $Vec2 = z.union([$Vec2Number, $Vec2Expression]);
export type Vec2 = z.infer<typeof $Vec2>;

// Vec3 schemas for each mode
export const $Vec3Number = z.object({
  x: $Float,
  y: $Float,
  z: $Float,
});

export const $Vec3Expression = z.object({
  x: $NumericValue,
  y: $NumericValue,
  z: $NumericValue,
});

export const $Vec3 = z.union([$Vec3Number, $Vec3Expression]);
export type Vec3 = z.infer<typeof $Vec3>;

// Color schema (no expressions supported)
export const $Color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Must be a valid 6-digit hex color");
export type Color = z.infer<typeof $Color>;

// Value type union
export type Value = Color | NumericValue | Vec2 | Vec3 | Boolean;

// Sampler2D type guard
export function isSampler2D(value: unknown): value is Sampler2D {
  return typeof value === "object" && value !== null && "vuvID" in value;
}

// Type guards
export function isBoolean(value: unknown): value is Boolean {
  return typeof value === "boolean";
}

export function isInteger(value: unknown): value is Integer {
  return typeof value === "number" && Number.isInteger(value);
}

export function isFloat(value: unknown): value is Float {
  return typeof value === "number";
}

export function isNumber(value: unknown): value is Number {
  return typeof value === "number" && !isNaN(value);
}

export function isExpression(value: unknown): value is Expression {
  return isString(value) && isExpressionString(value);
}

export function isColor(value: unknown): value is Color {
  if (typeof value !== "string") return false;
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function isString(value: unknown): value is String {
  return typeof value === "string";
}

// Vector type guards
export function isNumericValue(value: unknown): value is NumericValue {
  return isFloat(value) || isExpression(value);
}

export function isVec2(value: unknown): value is Vec2 {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!("x" in obj && "y" in obj)) return false;

  // Both components must be of the same type
  return (
    (isFloat(obj.x) && isFloat(obj.y)) ||
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

export function getNumericValueMode(value: NumericValue): VectorMode {
  return isExpression(value)
    ? $VectorMode.enum.Expression
    : $VectorMode.enum.Number;
}

// Vector mode detection functions
export function getVec2Mode(vec: Vec2): VectorMode {
  // Since we enforce all components to be the same type, we only need to check one
  return isExpression(vec.x)
    ? $VectorMode.enum.Expression
    : $VectorMode.enum.Number;
}

export function getVec3Mode(vec: Vec3): VectorMode {
  // Since we enforce all components to be the same type, we only need to check one
  return isExpression(vec.x)
    ? $VectorMode.enum.Expression
    : $VectorMode.enum.Number;
}

// Helper functions to check specific modes
export function isVec2Expression(vec: Vec2): boolean {
  return getVec2Mode(vec) === $VectorMode.enum.Expression;
}

export function isVec3Expression(vec: Vec3): boolean {
  return getVec3Mode(vec) === $VectorMode.enum.Expression;
}

export function isVec2Number(vec: Vec2): boolean {
  return getVec2Mode(vec) === $VectorMode.enum.Number;
}

export function isVec3Number(vec: Vec3): boolean {
  return getVec3Mode(vec) === $VectorMode.enum.Number;
}

export const createDefaultVec3 = (): Vec3 => ({
  x: 0,
  y: 0,
  z: 0,
});

export const createDefaultVec2 = (): Vec2 => ({
  x: 0,
  y: 0,
});
