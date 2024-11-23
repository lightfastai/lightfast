// a store to mantain texture states

import * as THREE from "three";
import { createStore } from "zustand";

interface TextureRenderState {
  targets: Record<string, THREE.WebGLRenderTarget>;
}

interface TextureRenderActions {
  addTexture: (id: string) => void;
}

export type TextureRenderStore = TextureRenderState & TextureRenderActions;

export const initTextureRenderState = (): TextureRenderState => ({
  targets: {},
});

export const defaultTextureRenderState: TextureRenderState = {
  targets: {},
};

export const createTextureRenderStore = (
  initState: TextureRenderState = defaultTextureRenderState,
) => {
  return createStore<TextureRenderStore>()((set) => ({
    ...initState,
    addTexture: (id) =>
      set((state) => ({
        targets: {
          ...state.targets,
          [id]: new THREE.WebGLRenderTarget(2, 2),
        },
      })),
  }));
};
