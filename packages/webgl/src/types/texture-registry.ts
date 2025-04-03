import type { TextureFieldMetadata, UniformFieldValue } from "./field";
import { ADD_UNIFORM_CONSTRAINTS } from "../shaders/add";
import { DISPLACE_UNIFORM_CONSTRAINTS } from "../shaders/displace";
import { LIMIT_UNIFORM_CONSTRAINTS } from "../shaders/limit";
import { PNOISE_UNIFORM_CONSTRAINTS } from "../shaders/pnoise";
import { ValueType } from "./schema";

/**
 * Get all texture input metadata from the uniform constraints
 * for a specific texture type
 */
export function getTextureInputsForType(textureType: string): {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}[] {
  // Get the appropriate constraints object based on the texture type
  let constraints: Record<string, UniformFieldValue>;
  switch (textureType) {
    case "Add":
      constraints = ADD_UNIFORM_CONSTRAINTS;
      break;
    case "Displace":
      constraints = DISPLACE_UNIFORM_CONSTRAINTS;
      break;
    case "Limit":
      constraints = LIMIT_UNIFORM_CONSTRAINTS;
      break;
    case "Noise":
      constraints = PNOISE_UNIFORM_CONSTRAINTS;
      break;
    default:
      return [];
  }

  // Filter out just the texture fields and convert to the expected format
  return Object.entries(constraints)
    .filter(([_, value]) => value.type === ValueType.Texture)
    .map(([key, value]) => {
      const constraint = value.constraint as TextureFieldMetadata;
      return {
        id: getTextureHandleFromUniformName(key),
        uniformName: key,
        description: constraint.description || value.label,
        required: constraint.required || false,
      };
    });
}

/**
 * Get the maximum number of texture inputs for a specific texture type
 */
export function getMaxTextureInputs(textureType: string): number {
  return getTextureInputsForType(textureType).length;
}

/**
 * Get the maximum number of texture inputs for any texture type
 */
export function getMaxTextureInputsAcrossAllTypes(): number {
  return Math.max(
    getMaxTextureInputs("Add"),
    getMaxTextureInputs("Displace"),
    getMaxTextureInputs("Limit"),
    getMaxTextureInputs("Noise"),
  );
}

/**
 * Get a texture handle ID from a uniform name
 */
function getTextureHandleFromUniformName(uniformName: string): string {
  // If it's a format like u_texture1, extract the number
  const match = /^u_texture(\d+)$/.exec(uniformName);
  if (match?.[1]) {
    return `input-${match[1]}`;
  }

  // If it's a format like u_texture, use input-1
  if (uniformName === "u_texture") {
    return "input-1";
  }

  // Default fallback
  return "input-1";
}
