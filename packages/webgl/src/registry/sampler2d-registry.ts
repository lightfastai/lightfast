/**
 * @deprecated Import from '../registry' instead
 * This file is maintained for backward compatibility
 */

// Re-export from registry
export {
  textureInputRegistry,
  getShaderSampler2DInputsForType,
  createSampler2DFieldMetadata,
} from "../registry";

// Export types
export type { ShaderSampler2DUniformRegistry } from "./interfaces/sampler2d-registry-def";
