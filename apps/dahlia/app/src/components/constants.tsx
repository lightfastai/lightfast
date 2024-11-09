import type { Vec2, Vec3 } from "@repo/webgl";

export const DEFAULT_POSITION: Vec3 = { x: 0, y: 0, z: 5 };
export const CENTER_OF_WORLD: Vec3 = { x: 0, y: 0, z: 0 };
export const WORLD_CAMERA_POSITION_FAR: Vec3 = { x: 12, y: 10, z: 12 };
export const WORLD_CAMERA_POSITION_CLOSE: Vec3 = { x: 5, y: 2, z: 5 };
export const DEFAULT_SCALE: Vec3 = { x: 1, y: 1, z: 1 };
export const DEFAULT_ROTATION: Vec3 = { x: 0, y: 0, z: 0 };
export const DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION: Vec3 = {
  x: 0.1,
  y: 0.1,
  z: 0,
};

export const TEXTURE_RESOLUTION: Vec2 = {
  x: 256,
  y: 256,
};

export const DEFAULT_MATERIAL_COLOR = "#ffffff";
export const DEFAULT_COLOR: Vec3 = { x: 1, y: 1, z: 1 };
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_START = 1;
export const ZOOM_SPEED = 0.005;
