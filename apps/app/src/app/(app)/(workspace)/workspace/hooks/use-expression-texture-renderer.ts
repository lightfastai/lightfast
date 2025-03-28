import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  isExpression,
  useExpressionEvaluator,
} from "./use-expression-evaluator";

/**
 * Configuration for expression fields in a texture
 */
export interface ExpressionFieldConfig {
  // Name of the uniform
  uniformName: string;
  // Path to the value in nested objects (e.g., "value.x" for vector components)
  path?: string;
  // Default value to use if expression is not a number
  defaultValue: number;
}

/**
 * Creates a reusable expression renderer for any texture type
 * @param shaderType Type identifier for the texture
 * @param processUniforms Function to extract uniforms from the texture data
 * @param createShaderMaterial Function to create a shader material for this texture type
 * @param expressionFields Configuration for all expression-enabled fields
 */
export function createExpressionTextureRenderer<
  T extends { type: string; uniforms: any },
>(
  shaderType: string,
  processUniforms: (textureData: T) => Record<string, any>,
  createShaderMaterial: (uniforms: Record<string, any>) => THREE.ShaderMaterial,
  expressionFields: ExpressionFieldConfig[],
) {
  return function useExpressionTextureRenderer(
    textureData: Record<string, T>,
    textureTargets: Record<string, { texture: THREE.Texture | null }>,
  ) {
    // Cache expressions
    const expressionsRef = useRef<Record<string, Record<string, string>>>({});
    // Use the shared expression evaluator
    const { updateShaderUniforms } = useExpressionEvaluator();

    return useMemo(() => {
      return Object.entries(textureData)
        .filter(([_, texture]) => texture.type === shaderType)
        .map(([id, texture]) => {
          // Ensure expressions cache exists for this ID
          expressionsRef.current[id] = expressionsRef.current[id] || {};

          // Process uniforms for this texture
          const uniforms = processUniforms(texture);

          // Store expressions for all potential expression fields
          const storeExpression = (key: string, value: any) => {
            if (isExpression(value)) {
              expressionsRef.current[id][key] = value;
            }
          };

          // Store all possible expressions based on the configuration
          expressionFields.forEach((field) => {
            const value = field.path
              ? getNestedValue(texture.uniforms, field.path)
              : texture.uniforms[field.uniformName];

            storeExpression(
              field.path
                ? `${field.uniformName}.${field.path}`
                : field.uniformName,
              value,
            );
          });

          // Create the shader material
          const shader = createShaderMaterial(uniforms);

          // Create uniform path map for vector components
          const uniformPathMap: Record<string, { pathToValue: string }> = {};
          expressionFields.forEach((field) => {
            if (field.path) {
              uniformPathMap[`${field.uniformName}.${field.path}`] = {
                pathToValue: `${field.uniformName}.value.${field.path}`,
              };
            }
          });

          return {
            id,
            shader,
            onEachFrame: (state: THREE.WebGLRenderer) => {
              // Get expressions for this node
              const expressions = expressionsRef.current[id] || {};

              // Use the shared uniform update utility
              updateShaderUniforms(state, shader, expressions, uniformPathMap);
            },
          };
        });
    }, [textureData, textureTargets, updateShaderUniforms]);
  };
}

/**
 * Helper function to get a nested value from an object
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Helper function to initialize a uniform value that may be an expression
 */
export function initializeUniformValue(
  value: any,
  defaultValue: number,
): number {
  return typeof value === "number" ? value : defaultValue;
}

/**
 * Helper to initialize vector components that may contain expressions
 */
export function initializeVector2Uniform(
  vecValue: { x: any; y: any },
  defaults: { x: number; y: number },
): THREE.Vector2 {
  return new THREE.Vector2(
    typeof vecValue.x === "number" ? vecValue.x : defaults.x,
    typeof vecValue.y === "number" ? vecValue.y : defaults.y,
  );
}

/**
 * Helper to initialize vector components that may contain expressions
 */
export function initializeVector3Uniform(
  vecValue: { x: any; y: any; z: any },
  defaults: { x: number; y: number; z: number },
): THREE.Vector3 {
  return new THREE.Vector3(
    typeof vecValue.x === "number" ? vecValue.x : defaults.x,
    typeof vecValue.y === "number" ? vecValue.y : defaults.y,
    typeof vecValue.z === "number" ? vecValue.z : defaults.z,
  );
}
