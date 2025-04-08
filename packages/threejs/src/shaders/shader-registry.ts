import type { R3FShaderUniforms, Shaders } from "@repo/webgl";
import {
  $Shaders,
  ADD_UNIFORM_CONSTRAINTS,
  addFragmentShader,
  baseVertexShader,
  createDefaultAdd,
  createDefaultDisplace,
  createDefaultLimit,
  createDefaultPerlinNoise2D,
  createUniformsFromSchema,
  DISPLACE_UNIFORM_CONSTRAINTS,
  displaceFragmentShader,
  LIMIT_UNIFORM_CONSTRAINTS,
  limitFragmentShader,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
} from "@repo/webgl";

import type { ShaderSingleton } from "./shader-singleton-factory";
import { createShaderSingleton } from "./shader-singleton-factory";

/**
 * Create default uniforms for a perlin noise shader
 */
const createDefaultNoiseUniforms = (): R3FShaderUniforms => {
  const defaultValues = createDefaultPerlinNoise2D();
  return createUniformsFromSchema(defaultValues, PNOISE_UNIFORM_CONSTRAINTS);
};

const createDefaultLimitUniforms = (): R3FShaderUniforms => {
  const defaultValues = createDefaultLimit();
  return createUniformsFromSchema(defaultValues, LIMIT_UNIFORM_CONSTRAINTS);
};

const createDefaultDisplaceUniforms = (): R3FShaderUniforms => {
  const defaultValues = createDefaultDisplace();
  return createUniformsFromSchema(defaultValues, DISPLACE_UNIFORM_CONSTRAINTS);
};

const createDefaultAddUniforms = (): R3FShaderUniforms => {
  const defaultValues = createDefaultAdd();
  return createUniformsFromSchema(defaultValues, ADD_UNIFORM_CONSTRAINTS);
};

// Initialize singleton instances for each shader type
// Each will be lazily created only when first requested

// Noise shader singleton
const noiseShaderSingleton = createShaderSingleton(
  baseVertexShader,
  pnoiseFragmentShader,
  createDefaultNoiseUniforms,
);

// Limit shader singleton
const limitShaderSingleton = createShaderSingleton(
  baseVertexShader,
  limitFragmentShader,
  createDefaultLimitUniforms,
);

// Displace shader singleton
const displaceShaderSingleton = createShaderSingleton(
  baseVertexShader,
  displaceFragmentShader,
  createDefaultDisplaceUniforms,
);

// Add shader singleton
const addShaderSingleton = createShaderSingleton(
  baseVertexShader,
  addFragmentShader,
  createDefaultAddUniforms,
);

// Map of all registered shader singletons
const shaderRegistry: Record<string, ShaderSingleton> = {
  [$Shaders.enum.Noise]: noiseShaderSingleton,
  [$Shaders.enum.Limit]: limitShaderSingleton,
  [$Shaders.enum.Displace]: displaceShaderSingleton,
  [$Shaders.enum.Add]: addShaderSingleton,
};

/**
 * Registry of shader singletons
 * Provides a central place to access all shader singletons
 */
export const ShaderSingletonRegistry = {
  /**
   * Get the singleton for a specific shader type
   * @param type - The shader type
   * @returns The singleton for that shader type
   * @throws Error if shader type is not registered
   */
  getSingleton(type: Shaders): ShaderSingleton {
    const singleton = shaderRegistry[type];

    if (!singleton) {
      throw new Error(`Shader singleton not registered for type: ${type}`);
    }

    return singleton;
  },

  /**
   * Register a new shader singleton
   * @param type - The shader type
   * @param singleton - The singleton to register
   */
  registerSingleton(type: string, singleton: ShaderSingleton): void {
    shaderRegistry[type] = singleton;
  },

  /**
   * Check if a singleton is registered for a shader type
   * @param type - The shader type
   * @returns True if registered, false otherwise
   */
  isRegistered(type: string): boolean {
    return type in shaderRegistry;
  },
};
