import type { RootState } from "@react-three/fiber";
import type * as THREE from "three";

export type WebGLRenderTargets = Record<string, THREE.WebGLRenderTarget>;

export interface WebGLRenderTargetNode {
  id: string;
  shader: THREE.ShaderMaterial;
  onEachFrame: (state: RootState) => void;
}
