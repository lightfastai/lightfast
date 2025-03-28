import type { Color } from "./color";
import type { Vec2 } from "./vec2";
import type { Vec3 } from "./vec3";

export type Value = Color | Vec3 | Vec2 | number | boolean | null | undefined;

export function isString(value: Value): value is string {
  return typeof value === "string";
}

export function isNumber(value: Value): value is number {
  return typeof value === "number";
}

export function isBoolean(value: Value): value is boolean {
  return typeof value === "boolean";
}
