import type { Shaders } from "@repo/webgl";

import { ShaderSingletonRegistry } from "../shaders/shader-registry";
import { useShaderMaterialOrchestrator } from "./use-shader-material-orchestrator";

export const useShaderOrchestrator = (shaderKey: Shaders) => {
  const shaderSingleton = ShaderSingletonRegistry.getSingleton(shaderKey);

  return useShaderMaterialOrchestrator(shaderKey, shaderSingleton);
};
