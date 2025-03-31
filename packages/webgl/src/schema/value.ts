import type { Color } from "./color";
import type { Vec2 } from "./vec2";
import type { Vec3 } from "./vec3";
import { isExpressionString } from "../expressions/schema";

export type Value = Color | Vec3 | Vec2 | number | boolean | null | undefined;

export function isString(value: Value): value is string {
  return typeof value === "string" && !isExpressionString(value);
}

export function isNumber(value: Value): value is number {
  return typeof value === "number";
}

export function isBoolean(value: Value): value is boolean {
  return typeof value === "boolean";
}

export function isExpressible(value: Value): boolean {
  return isNumber(value) || isExpressionString(value);
}
