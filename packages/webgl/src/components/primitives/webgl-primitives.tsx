"use client";

import { memo } from "react";
import {
  OrbitControls as DreiOrbitControls,
  PerspectiveCamera as DreiPerspectiveCamera,
  View,
} from "@react-three/drei";
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

/**
 * @description A memoized version of the OrbitControls component from drei.
 */
export const OrbitControls = memo(DreiOrbitControls);

/**
 * @description A memoized version of the PerspectiveCamera component from drei.
 */
export const PerspectiveCamera = memo(DreiPerspectiveCamera);
