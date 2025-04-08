import {
  $Add,
  ADD_UNIFORM_CONSTRAINTS,
  addFragmentShader,
  createDefaultAdd,
} from "../shaders/add";
import { baseVertexShader } from "../shaders/base-vert-shader";
import {
  $Blur,
  BLUR_UNIFORM_CONSTRAINTS,
  blurFragmentShader,
  createDefaultBlur,
} from "../shaders/blur";
import {
  $Displace,
  createDefaultDisplace,
  DISPLACE_UNIFORM_CONSTRAINTS,
  displaceFragmentShader,
} from "../shaders/displace";
import {
  $Limit,
  createDefaultLimit,
  LIMIT_UNIFORM_CONSTRAINTS,
  limitFragmentShader,
} from "../shaders/limit";
import {
  $PerlinNoise2D,
  createDefaultPerlinNoise2D,
  PNOISE_UNIFORM_CONSTRAINTS,
  pnoiseFragmentShader,
} from "../shaders/pnoise";
import { $Shaders } from "../types/shaders-types";
import { createShaderDefinition, registerShader } from "./shader-registry";

/**
 * Register all built-in shaders
 */
export function registerBuiltInShaders(): void {
  // Register Add shader
  registerShader(
    createShaderDefinition(
      $Shaders.enum.Add,
      baseVertexShader,
      addFragmentShader,
      $Add,
      ADD_UNIFORM_CONSTRAINTS,
      createDefaultAdd,
    ),
  );

  // Register Limit shader
  registerShader(
    createShaderDefinition(
      $Shaders.enum.Limit,
      baseVertexShader,
      limitFragmentShader,
      $Limit,
      LIMIT_UNIFORM_CONSTRAINTS,
      createDefaultLimit,
    ),
  );

  // Register Displace shader
  registerShader(
    createShaderDefinition(
      $Shaders.enum.Displace,
      baseVertexShader,
      displaceFragmentShader,
      $Displace,
      DISPLACE_UNIFORM_CONSTRAINTS,
      createDefaultDisplace,
    ),
  );

  // Register Noise shader
  registerShader(
    createShaderDefinition(
      $Shaders.enum.Noise,
      baseVertexShader,
      pnoiseFragmentShader,
      $PerlinNoise2D,
      PNOISE_UNIFORM_CONSTRAINTS,
      createDefaultPerlinNoise2D,
    ),
  );

  // Register Blur shader
  registerShader(
    createShaderDefinition(
      $Shaders.enum.Blur,
      baseVertexShader,
      blurFragmentShader,
      $Blur,
      BLUR_UNIFORM_CONSTRAINTS,
      createDefaultBlur,
    ),
  );
}

// Automatically register all built-in shaders
registerBuiltInShaders();
