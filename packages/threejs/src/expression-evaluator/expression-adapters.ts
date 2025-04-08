"use client";

import type { IUniform } from "three";
import * as THREE from "three";

import type { NumericValue, Vec2, Vec3 } from "@repo/webgl";
import { isExpression, ValueType } from "@repo/webgl";

import type { R3FShaderUniformValue } from "../types/shader-uniforms";

/**
 * Interface for adapters that convert between expressions and shader uniform values
 */
export interface ExpressionAdapter<T, U extends R3FShaderUniformValue> {
  // Convert a value to an expression string if it contains expressions
  toExpression(value: T): Record<string, string | undefined>;

  // Check if a value contains expressions
  hasExpressions(value: T): boolean;

  // Create a uniform value from expressions and numeric values
  createUniformValue(
    value: T,
    expressionResults: Record<string, number>,
  ): IUniform<U>;
}

/**
 * Adapter for NumericValue (number or expression string)
 */
export class NumericExpressionAdapter
  implements ExpressionAdapter<NumericValue, number>
{
  toExpression(value: NumericValue): Record<string, string | undefined> {
    if (isExpression(value)) {
      return { value };
    }
    return { value: undefined };
  }

  hasExpressions(value: NumericValue): boolean {
    return isExpression(value);
  }

  createUniformValue(
    value: NumericValue,
    expressionResults: Record<string, number>,
  ): IUniform<number> {
    if (isExpression(value)) {
      return { value: expressionResults.value ?? 0 };
    }
    return { value: typeof value === "number" ? value : 0 };
  }
}

/**
 * Adapter for Vec2 (x, y numeric values or expressions)
 */
export class Vec2ExpressionAdapter
  implements ExpressionAdapter<Vec2, THREE.Vector2>
{
  toExpression(value: Vec2): Record<string, string | undefined> {
    return {
      x: isExpression(value.x) ? value.x : undefined,
      y: isExpression(value.y) ? value.y : undefined,
    };
  }

  hasExpressions(value: Vec2): boolean {
    return isExpression(value.x) || isExpression(value.y);
  }

  createUniformValue(
    value: Vec2,
    expressionResults: Record<string, number>,
  ): IUniform<THREE.Vector2> {
    const x = isExpression(value.x)
      ? (expressionResults.x ?? 0)
      : typeof value.x === "number"
        ? value.x
        : 0;

    const y = isExpression(value.y)
      ? (expressionResults.y ?? 0)
      : typeof value.y === "number"
        ? value.y
        : 0;

    return { value: new THREE.Vector2(x, y) };
  }
}

/**
 * Adapter for Vec3 (x, y, z numeric values or expressions)
 */
export class Vec3ExpressionAdapter
  implements ExpressionAdapter<Vec3, THREE.Vector3>
{
  toExpression(value: Vec3): Record<string, string | undefined> {
    return {
      x: isExpression(value.x) ? value.x : undefined,
      y: isExpression(value.y) ? value.y : undefined,
      z: isExpression(value.z) ? value.z : undefined,
    };
  }

  hasExpressions(value: Vec3): boolean {
    return (
      isExpression(value.x) || isExpression(value.y) || isExpression(value.z)
    );
  }

  createUniformValue(
    value: Vec3,
    expressionResults: Record<string, number>,
  ): IUniform<THREE.Vector3> {
    const x = isExpression(value.x)
      ? (expressionResults.x ?? 0)
      : typeof value.x === "number"
        ? value.x
        : 0;

    const y = isExpression(value.y)
      ? (expressionResults.y ?? 0)
      : typeof value.y === "number"
        ? value.y
        : 0;

    const z = isExpression(value.z)
      ? (expressionResults.z ?? 0)
      : typeof value.z === "number"
        ? value.z
        : 0;

    return { value: new THREE.Vector3(x, y, z) };
  }
}

/**
 * Factory to get the appropriate expression adapter
 */
export class ExpressionAdapterFactory {
  private static numericAdapter = new NumericExpressionAdapter();
  private static vec2Adapter = new Vec2ExpressionAdapter();
  private static vec3Adapter = new Vec3ExpressionAdapter();

  static getAdapter(
    uniformType: ValueType,
  ): ExpressionAdapter<unknown, R3FShaderUniformValue> {
    switch (uniformType) {
      case ValueType.Numeric:
        return this.numericAdapter;
      case ValueType.Vec2:
        return this.vec2Adapter;
      case ValueType.Vec3:
        return this.vec3Adapter;
      default:
        throw new Error(
          `No expression adapter found for uniform type: ${uniformType}`,
        );
    }
  }
}
