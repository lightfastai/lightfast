import type { ShaderDefinition, Shaders, ShaderSchema } from "@repo/webgl";
import { getAllShaderTypes, getShaderDefinition } from "@repo/webgl";

import type { R3FShaderUniforms } from "../types/shader-uniforms";
import type { ShaderSingleton } from "./shader-singleton-factory";
import { createUniformsFromSchema } from "../types/shader-uniforms";
import { createShaderSingleton } from "./shader-singleton-factory";

/**
 * Create default uniforms for a shader from its definition
 * @param definition - The shader definition
 * @returns The default uniforms
 */
const createDefaultUniformsFromDefinition = <TSchema extends ShaderSchema>(
  definition: ShaderDefinition<TSchema>,
): R3FShaderUniforms => {
  const defaultValues = definition.createDefaultValues();
  return createUniformsFromSchema(defaultValues, definition.constraints);
};

// Map of all registered shader singletons
const shaderRegistry: Record<Shaders, ShaderSingleton> = {} as Record<
  Shaders,
  ShaderSingleton
>;

// Dynamically build the shader registry from the webgl shader registry
getAllShaderTypes().forEach((shaderType) => {
  const definition = getShaderDefinition(shaderType);

  // Create a function to generate default uniforms for this shader type
  const createDefaultUniformsForType = () => {
    return createDefaultUniformsFromDefinition(definition);
  };

  // Create and register the shader singleton
  const shaderSingleton = createShaderSingleton(
    definition.vertexShader,
    definition.fragmentShader,
    createDefaultUniformsForType,
  );

  shaderRegistry[shaderType] = shaderSingleton;
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
    const singleton = shaderRegistry[type];
    return singleton;
  },

  /**
   * Register a new shader singleton
   * @param type - The shader type
   * @param singleton - The singleton to register
   */
  registerSingleton(type: Shaders, singleton: ShaderSingleton): void {
    shaderRegistry[type] = singleton;
  },

  /**
   * Check if a singleton is registered for a shader type
   * @param type - The shader type
   * @returns True if registered, false otherwise
   */
  isRegistered(type: Shaders): boolean {
    return type in shaderRegistry;
  },
};
