/**
 * Type definitions for texture-related components
 */

/**
 * Represents a texture input metadata for nodes
 */
export interface TextureInput {
  id: string;
  uniformName: string;
  description: string;
  required: boolean;
}
