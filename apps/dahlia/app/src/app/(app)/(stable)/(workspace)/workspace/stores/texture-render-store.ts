// a store to mantain texture states

import * as THREE from "three";
import { createStore } from "zustand";

import { BaseNode } from "../types/node";

interface TextureRenderState {
  targets: Record<string, THREE.WebGLRenderTarget>;
  meshes: Record<string, THREE.Mesh>;
}

interface TextureRenderActions {
  addTexture: (id: string) => void;
  addMesh: (id: string, mesh: THREE.Mesh) => void;
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
  meshes: {},
});

export const defaultTextureRenderState: TextureRenderState = {
  targets: {},
  meshes: {},
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
          [id]: new THREE.WebGLRenderTarget(256, 256),
        },
      })),
    addMesh: (id, mesh) =>
      set((state) => ({
        meshes: {
          ...state.meshes,
          [id]: mesh,
        },
      })),
  }));
};
