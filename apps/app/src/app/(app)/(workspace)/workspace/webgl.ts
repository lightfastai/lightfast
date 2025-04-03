/**
 * This file exports all WebGL components directly from the @repo/webgl package.
 * Use these exports instead of the individual components in the components/webgl directory.
 */

// Export components
export {
  WebGLCanvas,
  WebGLView,
  createWebGLPortal,
  OrbitControls,
  PerspectiveCamera,
  DefaultCamera,
  DefaultControls,
  GeometryRenderer,
  GeometryViewer,
} from "@repo/webgl/components";

// Export performance components
export {
  GLStatsCard,
  PerformanceCard,
  PerformanceChart,
  SystemCard,
} from "@repo/webgl/performance";

// Export global components
export {
  GlobalOrbitControls,
  GlobalPerspectiveCamera,
  GlobalBoxGeometry,
  GlobalSphereGeometry,
  GlobalTetrahedronGeometry,
  GlobalTorusGeometry,
  GlobalPlaneGeometry,
} from "@repo/webgl/globals";

// Export all types from the package
export type {
  WebGLCanvasProps,
  WebGLRootState,
  CameraContextType,
  DefaultCameraProps,
  DefaultControlsProps,
  GeometryRendererProps,
  GeometryViewerProps,
} from "@repo/webgl/components";

// Export utilities
export {
  GeometryMap,
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
  $GeometryType,
} from "@repo/webgl/utils";

export type { GeometryType } from "@repo/webgl/utils";

// Export the render target pipeline adapter
export { useRenderTargetPipeline } from "./hooks/use-render-target-pipeline";
