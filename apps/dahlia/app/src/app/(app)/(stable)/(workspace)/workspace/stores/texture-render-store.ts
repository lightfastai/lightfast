// a store to mantain texture states

import * as THREE from "three";
import { createStore } from "zustand";

import { BaseNode } from "../types/node";

interface TextureRenderState {
  targets: Record<string, THREE.WebGLRenderTarget>;
}

interface TextureRenderActions {
  addTarget: (id: string) => void;
  removeTarget: (id: string) => void;
}

export type TextureRenderStore = TextureRenderState & TextureRenderActions;

export const initTextureRenderState = (
  nodes: BaseNode[],
): TextureRenderState => ({
  targets: nodes.reduce(
    (acc, node) => {
      acc[node.id] = new THREE.WebGLRenderTarget(256, 256);
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
    addTarget: (id) =>
      set((state) => ({
        targets: {
          ...state.targets,
          [id]: new THREE.WebGLRenderTarget(256, 256),
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
