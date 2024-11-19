import { z } from "zod";

import { $Color, $Vec2, $Vec3 } from "@repo/webgl";

import {
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SCALE,
} from "~/components/constants";

// Node schema
export const $Node = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  shouldRenderInNode: z.boolean().default(true),
  inputPos: $Vec2,
  outputPos: $Vec2,
});

// MaterialType enum
export const $MaterialType = z.enum(["Phong"]);

// GeometryType enum
export const $GeometryType = z.enum([
  "Box",
  "Cylinder",
  "Tetrahedron",
  "Torus",
]);

// Material schema
export const $Material = z.object({
  type: $MaterialType,
  color: $Color.default(DEFAULT_MATERIAL_COLOR),
});

// Geometry schema
export const $Geometry = z.object({
  position: $Vec3.default(DEFAULT_POSITION),
  scale: $Vec3.default(DEFAULT_SCALE),
  rotation: $Vec3.default(DEFAULT_ROTATION),
  wireframe: z.boolean().default(false),
  type: $GeometryType,
  material: $Material.nullish(), // material or null
});

// Geometries
export const $Geometries = z.array($Geometry);
