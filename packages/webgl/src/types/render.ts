import type { RootState } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * @description A node in the texture render pipeline.
 * @param id - The id of the node.
 * @param shader - The shader material to use for the node.
 * @param onEachFrame - A function to run on each frame.
 */
export interface TextureRenderNode {
  id: string;
  shader: THREE.ShaderMaterial;
  onEachFrame: (state: RootState) => void;
}

/**
 * @description A pipeline for rendering textures to render targets.
 * @param onEachFrame - A record of functions to run on each frame.
 * @param meshes - A record of meshes to render to the render targets.
 * @example
 * const { scene, geometry } = useRenderTargetPipeline({
 *   onEachFrame: {
 *     0: (state) => {
 *       state.textures[0].uniforms.u_time.value = state.clock.elapsedTime;
 *     },
 *   },
 *   meshes: { 0: mesh },
 * });
 */
export interface TextureRenderPipeline {
  onEachFrame: Record<string, (state: RootState) => void>;
  meshes: Record<string, THREE.Mesh>;
}

/**
 * @description A store for texture render targets.
 */
export interface TextureRenderStore {
  targets: Record<string, THREE.WebGLRenderTarget>;
  addTarget: (id: string, width?: number, height?: number) => void;
  removeTarget: (id: string) => void;
}

/**
 * @description Options for creating a render target.
 */
export interface RenderTargetOptions {
  width?: number;
  height?: number;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  minFilter?: THREE.TextureFilter;
  magFilter?: THREE.TextureFilter;
  format?: THREE.PixelFormat;
  type?: THREE.TextureDataType;
  stencilBuffer?: boolean;
  depthBuffer?: boolean;
}
