import { useMemo } from "react";

import type { Shaders } from "@repo/webgl";

import type { ShaderMaterialOrchestrator } from "./use-shader-material-orchestrator";
import { ShaderSingletonRegistry } from "../shaders/shader-registry";
import { useShaderMaterialOrchestrator } from "./use-shader-material-orchestrator";

/**
 * Hook to get a shader orchestrator for a specific shader type
 * @param shaderKey The shader type
 * @returns The shader orchestrator for the given type
 */
export const useShaderOrchestrator = (shaderKey: Shaders) => {
  const shaderSingleton = ShaderSingletonRegistry.getSingleton(shaderKey);

  return useShaderMaterialOrchestrator(shaderKey, shaderSingleton);
};

export type ShaderOrchestratorMap = Record<Shaders, ShaderMaterialOrchestrator>;

/**
 * Hook to get a map of shader orchestrators for all available shader types
 * This centralizes shader orchestrator creation and ensures proper React Hooks usage
 * @returns A map of shader orchestrators, with shader types as keys
 */
export const useShaderOrchestratorMap = (): ShaderOrchestratorMap => {
  // Get common shader types
  const noiseOrchestrator = useShaderOrchestrator("Noise");
  const limitOrchestrator = useShaderOrchestrator("Limit");
  const addOrchestrator = useShaderOrchestrator("Add");
  const displaceOrchestrator = useShaderOrchestrator("Displace");
  const blurOrchestrator = useShaderOrchestrator("Blur");

  // Map the orchestrators to their respective shader types
  return useMemo(() => {
    const map = {} as ShaderOrchestratorMap;

    // Add common types
    map.Noise = noiseOrchestrator;
    map.Limit = limitOrchestrator;
    map.Add = addOrchestrator;
    map.Displace = displaceOrchestrator;
    map.Blur = blurOrchestrator;

    return map;
  }, [
    noiseOrchestrator,
    limitOrchestrator,
    addOrchestrator,
    displaceOrchestrator,
    blurOrchestrator,
  ]);
};
