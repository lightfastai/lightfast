import * as THREE from "three";

import { WebGLRootState } from "../components/webgl/webgl-primitives";

/**
 * @description A node in the texture render pipeline.
 * @param id - The id of the node.
 * @param shader - The shader material to use for the node.
 * @param onEachFrame - A function to run on each frame.
 */
export interface TextureRenderNode {
  id: number;
  shader: THREE.ShaderMaterial;
  onEachFrame: (state: WebGLRootState) => void;
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
  onEachFrame: Record<number, (state: WebGLRootState) => void>;
  meshes: Record<number, THREE.Mesh>;
}
