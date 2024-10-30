import type { PerlinNoiseShaderUniforms } from "./noise/perlin-noise-material";
import {
  perlinNoiseFragmentShader,
  PerlinNoiseShaderMaterial,
  perlinNoiseVertexShader,
} from "./noise/perlin-noise-material";

export { PerlinNoiseShaderMaterial, type PerlinNoiseShaderUniforms };

export { perlinNoiseVertexShader, perlinNoiseFragmentShader };
