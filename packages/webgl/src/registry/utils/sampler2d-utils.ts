import type { Sampler2DMetadata, UniformFieldValue } from "../../shaders/field";
import type { ShaderSchema } from "../../shaders/interfaces/shader-def";
import type { Sampler2DHandle } from "../../uniforms/handle";
import type { ShaderDefinition } from "../interfaces/registry-shader-def";
import type { ShaderSampler2DUniformRegistry } from "../interfaces/sampler2d-registry-def";
import { $ValueType } from "../../shaders/enums/values";

/**
 * Create sampler2D field metadata from uniform constraints
 */
export function createSampler2DFieldMetadata(
  handle: Sampler2DHandle,
  constraint: UniformFieldValue,
): Sampler2DMetadata {
  if (constraint.type !== $ValueType.enum.Sampler2D) {
    throw new Error(`Invalid constraint type for handle ${handle.handleId}`);
  }
  return {
    handle,
  };
}

/**
 * Extract texture registry data for a shader definition
 */
export function extractShaderSampler2DRegistry(
  definition: ShaderDefinition<ShaderSchema>,
): ShaderSampler2DUniformRegistry {
  // If the shader has defined texture handles, use those
  if (definition.textureHandles) {
    const { handles, defaultUniformMapping, validateConnection } =
      definition.textureHandles;

    // Create inputs array from defaultUniformMapping
    const inputs = Object.entries(defaultUniformMapping).map(
      ([uniformName, handle]) => {
        const constraint = definition.constraints[uniformName];
        if (!constraint) {
          throw new Error(`Missing constraint for uniform ${uniformName}`);
        }
        return createSampler2DFieldMetadata(handle, constraint);
      },
    );

    return {
      handles,
      defaultUniforms: defaultUniformMapping,
      inputs,
      validateConnection: validateConnection || (() => true),
    };
  }

  // Otherwise, extract texture handles from constraints
  const handles: Sampler2DHandle[] = [];
  const defaultUniforms: Record<string, Sampler2DHandle> = {};
  const inputs: Sampler2DMetadata[] = [];

  for (const [uniformName, constraint] of Object.entries(
    definition.constraints,
  )) {
    if (
      constraint.type === $ValueType.enum.Sampler2D &&
      constraint.constraint &&
      "handle" in constraint.constraint &&
      constraint.constraint.handle
    ) {
      const handle = constraint.constraint.handle;
      handles.push(handle);
      defaultUniforms[uniformName] = handle;
      inputs.push(createSampler2DFieldMetadata(handle, constraint));
    }
  }

  return {
    handles,
    defaultUniforms,
    inputs,
    validateConnection: () => true, // Default to accepting any texture type
  };
}
