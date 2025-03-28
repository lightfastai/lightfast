// a store to mantain texture states

import * as THREE from "three";
import { createStore } from "zustand";

import type { BaseNode } from "../types/node";

interface TextureRenderState {
  targets: Record<string, THREE.WebGLRenderTarget>;
}

export interface TextureRenderStore extends TextureRenderState {
  addTarget: (
    id: string,
    resolution: { width: number; height: number },
  ) => void;
  removeTarget: (id: string) => void;
}

export const initTextureRenderState = (
  nodes: BaseNode[],
): TextureRenderState => ({
  targets: nodes.reduce(
    (acc, node) => {
      acc[node.id] = new THREE.WebGLRenderTarget(1024, 1024);
      return acc;
    },
    {} as Record<string, THREE.WebGLRenderTarget>,
  ),
});

export const defaultTextureRenderState: TextureRenderState = {
  targets: {},
};

export const createTextureRenderStore = (
  initState: TextureRenderState = defaultTextureRenderState,
) => {
  return createStore<TextureRenderStore>()((set) => ({
    ...initState,
    addTarget: (id, resolution) =>
      set((state) => ({
        targets: {
          ...state.targets,
          [id]: new THREE.WebGLRenderTarget(
            resolution.width,
            resolution.height,
          ),
        },
      })),
    removeTarget: (id) =>
      set((state) => {
        // Dispose of the render target before removing it
        state.targets[id]?.dispose();

        return {
          targets: Object.fromEntries(
            Object.entries(state.targets).filter(([key]) => key !== id),
          ),
        };
      }),
  }));
};
