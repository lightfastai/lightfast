import type { R3FShaderUniforms } from "@/types";

import type { Shaders } from "@repo/webgl";
import { getAllShaderTypes, shaderRegistry } from "@repo/webgl";

import type { ShaderSingleton } from "./shader-singleton-factory";
import { createShaderSingleton } from "./shader-singleton-factory";

// Map of all registered shader singletons
const r3fShaderRegistry: Record<Shaders, ShaderSingleton> = {} as Record<
  Shaders,
  ShaderSingleton
>;

// Dynamically build the shader registry from the webgl shader registry
getAllShaderTypes().forEach((shaderType) => {
  const definition = shaderRegistry.get(shaderType);
  if (!definition) {
    throw new Error(`Shader definition not registered for type: ${shaderType}`);
  }

  // Create a function to generate default uniforms for this shader type
  const createDefaultUniformsForType = () => {
    const defaultUniforms = definition.schema.parse({}) as R3FShaderUniforms;
    return defaultUniforms;
  };

  // Create and register the shader singleton
  const shaderSingleton = createShaderSingleton(
    definition.vertexShader,
    definition.fragmentShader,
    createDefaultUniformsForType,
  );

  r3fShaderRegistry[shaderType] = shaderSingleton;
});

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
    const singleton = r3fShaderRegistry[type];
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
  registerSingleton(type: Shaders, singleton: ShaderSingleton): void {
    r3fShaderRegistry[type] = singleton;
  },

  /**
   * Check if a singleton is registered for a shader type
   * @param type - The shader type
   * @returns True if registered, false otherwise
   */
  isRegistered(type: Shaders): boolean {
    return type in r3fShaderRegistry;
  },
};
