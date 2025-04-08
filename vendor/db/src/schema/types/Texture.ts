import { z } from "zod";

import type { Shaders } from "@repo/webgl";
import {
  $Shaders,
  $ShaderValues,
  getShaderDefinition,
  isShaderRegistered,
} from "@repo/webgl";

export const $TextureTypes = $Shaders;

export type TextureTypes = Shaders;

export const $TextureResolution = z.object({
  width: z.number().min(1).max(2048).default(256),
  height: z.number().min(1).max(2048).default(256),
});

export type TextureResolution = z.infer<typeof $TextureResolution>;

// Define a type for texture schema objects to improve type safety
type TextureSchemaObject = z.ZodObject<
  {
    type: z.ZodLiteral<Shaders>;
    uniforms: z.ZodTypeAny;
    resolution: typeof $TextureResolution;
  },
  "strip",
  z.ZodTypeAny
>;

// Dynamically build the texture union based on shader types
const textureTypeObjects = $ShaderValues.map((shaderType) => {
  const type = shaderType;
  if (!isShaderRegistered(type)) {
    throw new Error(
      `Shader type "${type}" referenced in Texture.ts but not registered in shader registry. ` +
        `Make sure the shader implementation exists and is properly exported.`,
    );
  }

  return z.object({
    type: z.literal(type),
    uniforms: getShaderDefinition(type).schema,
    resolution: $TextureResolution,
  });
}) as unknown as [TextureSchemaObject, ...TextureSchemaObject[]];

// We need at least one discriminator for the union to be valid
export const $Texture = z.discriminatedUnion("type", textureTypeObjects);

// Create a merge of all possible uniform schemas by using a more type-safe approach
// Start with a base ZodObject that we can definitely merge and make passthrough
const baseSchema = z.object({});

// Combine all shader schemas
export const $TextureUniforms = $ShaderValues
  .reduce((schema, shaderType) => {
    const type = shaderType;
    if (isShaderRegistered(type)) {
      try {
        // Only merge if the schema is a ZodObject that can be merged
        const shaderSchema = getShaderDefinition(type).schema;
        if (typeof schema.merge === "function") {
          return schema.merge(shaderSchema);
        }
      } catch (error) {
        // If merging fails, just return the current schema
        console.warn(`Failed to merge schema for ${type}`, error);
        throw error;
      }
    }
    return schema;
  }, baseSchema)
  .passthrough();

export type TextureUniforms = z.infer<typeof $TextureUniforms>;
export type Texture = z.infer<typeof $Texture>;

// Create type helpers for each texture type
// These will be generated dynamically to avoid maintenance issues
type TextureTypeMap = {
  [K in Shaders]: Extract<Texture, { type: K }>;
};

export type PnoiseTexture = TextureTypeMap["Pnoise"];
export type LimitTexture = TextureTypeMap["Limit"];
export type DisplaceTexture = TextureTypeMap["Displace"];
export type AddTexture = TextureTypeMap["Add"];

export const createDefaultTexture = ({
  type,
}: {
  type: TextureTypes;
}): Texture => {
  // Get the shader definition from the registry, which contains createDefaultValues
  try {
    const shaderDef = getShaderDefinition(type);
    const defaultValues = shaderDef.createDefaultValues();

    return {
      type,
      uniforms: defaultValues,
      resolution: { width: 256, height: 256 },
    };
  } catch (error) {
    // This should never happen with proper registration
    console.error(`Failed to create default texture for type ${type}:`, error);
    throw new Error(`Unknown texture type: ${type}`);
  }
};
