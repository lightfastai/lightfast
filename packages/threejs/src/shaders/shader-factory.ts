import type { R3FShaderUniforms, Shaders } from "@repo/webgl";
import { baseVertexShader } from "@repo/webgl";

import type { ShaderSingleton } from "./shader-singleton-factory";
import { ShaderSingletonRegistry } from "./shader-registry";
import { createShaderSingleton } from "./shader-singleton-factory";

/**
 * Interface for shader creation parameters
 */
interface ShaderCreationParams {
  /**
   * The unique type identifier for this shader
   */
  type: Shaders;

  /**
   * The fragment shader code
   */
  fragmentShader: string;

  /**
   * The vertex shader code (defaults to baseVertexShader)
   */
  vertexShader?: string;

  /**
   * Function to create default uniforms for this shader
   */
  createDefaultUniforms: () => R3FShaderUniforms;
}

/**
 * Creates a shader singleton and registers it with the registry
 *
 * @param params - Shader creation parameters
 * @returns The created shader singleton
 */
export function createAndRegisterShader(
  params: ShaderCreationParams,
): ShaderSingleton {
  const {
    type,
    fragmentShader,
    vertexShader = baseVertexShader,
    createDefaultUniforms,
  } = params;

  // Create the singleton
  const singleton = createShaderSingleton(
    vertexShader,
    fragmentShader,
    createDefaultUniforms,
  );

  // Register it with the registry if it's not already registered
  if (!ShaderSingletonRegistry.isRegistered(type)) {
    ShaderSingletonRegistry.registerSingleton(type, singleton);
  }

  return singleton;
}
