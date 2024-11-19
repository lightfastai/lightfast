import type { RootState } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";

/**
 * @description A wrapper for the View component from react-three/drei.
 * @example
 * <WebGLView>
 *   <mesh>
 *     <boxGeometry />
 *     <meshStandardMaterial />
 *   </mesh>
 * </WebGLView>
 */
const WebGLView = View;
export { WebGLView };

/**
 * @description A wrapper for the createPortal function from react-three/fiber.
 * It is used to render content outside the main scene.
 * @param children - The content to render.
 * @param scene - The scene to render the content to.
 * @returns The portal element.
 * @example
 * const portal = createWebGLPortal(<div>Hello, world!</div>, scene);
 */
const createWebGLPortal = createPortal;
export { createWebGLPortal };

export type { RootState as WebGLRootState };
