// Canvas components
export { WebGLCanvas } from "./canvas/webgl-canvas";
export type { WebGLCanvasProps } from "./canvas/webgl-canvas";

// Primitive components
export {
  WebGLView,
  createWebGLPortal,
  OrbitControls,
  PerspectiveCamera,
} from "./primitives/webgl-primitives";
export type { WebGLRootState } from "./primitives/webgl-primitives";

// Camera and controls
export {
  DefaultCamera,
  DefaultControls,
  CameraContext,
  useCameraContext,
} from "./primitives/camera-controls";
export type {
  CameraContextType,
  DefaultCameraProps,
  DefaultControlsProps,
} from "./primitives/camera-controls";

// Geometry components
export { GeometryRenderer } from "./renderers/geometry-renderer";
export type { GeometryRendererProps } from "./renderers/geometry-renderer";

// Geometry viewers
export { GeometryViewer } from "./viewers/geometry-viewer";
export type { GeometryViewerProps } from "./viewers/geometry-viewer";

// Texture pipeline
export { TextureRenderPipeline } from "./renderers/texture-render-pipeline";
export type { TextureRenderPipelineProps } from "./renderers/texture-render-pipeline";

// Global components
export { GlobalOrbitControls, GlobalPerspectiveCamera } from "./globals";

// Performance components
export {
  GLStatsCard,
  PerformanceCard,
  PerformanceChart,
  SystemCard,
} from "./performance";
