"use client";

import type * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WebGLRenderTargetNode, WebGLRootState } from "@repo/threejs";
import type { Shaders } from "@repo/webgl";
import type { Texture } from "@vendor/db/types";
import { useShaderOrchestratorMap, useUnifiedUniforms } from "@repo/threejs";
import { getAllShaderTypes, shaderRegistry } from "@repo/webgl";

import type { BaseEdge } from "../types/node";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export interface UnifiedTextureOrchestratorProps {
  textureDataMap: Record<string, Texture>;
}

/**
 * Gets a texture from the targets map, with null-safety
 */
const getTextureFromTargets = (
  sourceId: string | null,
  targets: Record<string, { texture: THREE.Texture }>,
): THREE.Texture | null => {
  return sourceId && targets[sourceId] ? targets[sourceId].texture : null;
};

/**
 * Gets the source node ID connected to a target node
 */
const getSourceForTarget = (
  edges: BaseEdge[],
  targetId: string,
): string | null => {
  const edge = edges.find((edge) => edge.target === targetId);
  return edge?.source || null;
};

/**
 * Unified hook for managing multiple texture types with their shader orchestration
 */
export const useUnifiedTextureOrchestrator = ({
  textureDataMap,
}: UnifiedTextureOrchestratorProps): WebGLRenderTargetNode[] => {
  // External state
  const { targets } = useTextureRenderStore((state) => state);
  const { edges } = useEdgeStore((state) => state);
  const { updateAllUniforms } = useUnifiedUniforms();

  // Local state for tracking when we need to rebuild
  const [rebuildCounter, setRebuildCounter] = useState(0);

  // Get shader tools
  const shaderTypes = useMemo(() => getAllShaderTypes(), []);
  const orchestrators = useShaderOrchestratorMap();

  // Refs for storage
  const nodesRef = useRef<Record<string, WebGLRenderTargetNode>>({});
  const textureConfigsRef = useRef<Record<string, Texture>>({});

  // Previous state refs for comparison
  const prevEdgesRef = useRef(edges);
  const prevTargetsRef = useRef(targets);
  const prevTextureDataMapRef = useRef(textureDataMap);

  /**
   * Type guard for shader types
   */
  const isValidShaderType = useCallback(
    (type: string): type is Shaders => {
      return shaderTypes.includes(type as Shaders);
    },
    [shaderTypes],
  );

  /**
   * Create a texture resolver function for a specific node ID
   * This needs to be recreated when edges or targets change
   */
  const createTextureResolver = useCallback(
    (nodeId: string) => {
      return (_sampler: Record<string, unknown>): THREE.Texture | null => {
        const sourceId = getSourceForTarget(edges, nodeId);
        return getTextureFromTargets(sourceId, targets);
      };
    },
    [edges, targets],
  );

  /**
   * Clear all nodes and configs
   */
  const clearAll = useCallback(() => {
    nodesRef.current = {};
    textureConfigsRef.current = {};
  }, []);

  /**
   * Create a node for a texture
   */
  const createNode = useCallback(
    (id: string, texture: Texture): WebGLRenderTargetNode | null => {
      // Validate texture type
      if (!isValidShaderType(texture.type)) {
        console.error(`Invalid texture type: ${texture.type}`);
        return null;
      }

      // Store texture config
      textureConfigsRef.current[id] = texture;

      // Get orchestrator for this texture type
      const shaderType = texture.type;
      const orchestrator = orchestrators[shaderType];

      // Get shader definition
      const shaderDefinition = shaderRegistry.get(shaderType);
      if (!shaderDefinition) {
        console.error(`Shader definition not found for type: ${shaderType}`);
        return null;
      }

      // Create frame update handler
      const onEachFrame = (state: WebGLRootState) => {
        const config = textureConfigsRef.current[id];
        if (!config) return;

        const shader = orchestrator.getShader();
        const textureResolver = createTextureResolver(id);

        updateAllUniforms(
          state,
          shader,
          config.uniforms,
          shaderDefinition.constraints,
          textureResolver,
        );
      };

      // Create the node
      const node: WebGLRenderTargetNode = {
        id,
        get shader() {
          return orchestrator.getShader();
        },
        onEachFrame,
      };

      // Store the node
      nodesRef.current[id] = node;

      return node;
    },
    [
      createTextureResolver,
      orchestrators,
      isValidShaderType,
      updateAllUniforms,
    ],
  );

  /**
   * Force a rebuild of all nodes
   */
  const rebuildAllNodes = useCallback(() => {
    // Clear existing nodes
    clearAll();

    // Create new nodes for each texture
    Object.entries(textureDataMap).forEach(([id, texture]) => {
      createNode(id, texture);
    });

    // Update previous state refs
    prevEdgesRef.current = edges;
    prevTargetsRef.current = targets;
    prevTextureDataMapRef.current = textureDataMap;
  }, [textureDataMap, edges, targets, clearAll, createNode]);

  // Check for changes in dependencies that should trigger a rebuild
  useEffect(() => {
    const edgesChanged = prevEdgesRef.current !== edges;
    const targetsChanged = prevTargetsRef.current !== targets;
    const texturesChanged = prevTextureDataMapRef.current !== textureDataMap;

    if (edgesChanged || targetsChanged || texturesChanged) {
      // Force a rebuild by incrementing counter
      setRebuildCounter((count) => count + 1);
    }
  }, [edges, targets, textureDataMap]);

  // Rebuild nodes when necessary
  useEffect(() => {
    rebuildAllNodes();
  }, [rebuildCounter, rebuildAllNodes]);

  // Return current nodes
  return useMemo(() => {
    // Get all texture IDs
    const textureIds = Object.keys(textureDataMap);

    // Return empty array if no textures
    if (textureIds.length === 0) {
      return [];
    }

    // Map textures to nodes, creating any that don't exist
    return textureIds
      .map((id) => {
        // Check if node already exists
        if (nodesRef.current[id]) {
          return nodesRef.current[id];
        }

        // Create node if it doesn't exist
        const texture = textureDataMap[id];
        if (!texture) {
          // @TODO: Handle this better
          return null;
        }

        return createNode(id, texture);
      })
      .filter((node): node is WebGLRenderTargetNode => node !== null);
  }, [textureDataMap, createNode]);
};
