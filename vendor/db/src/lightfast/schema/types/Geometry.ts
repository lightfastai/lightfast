import { z } from "zod";

import type { Vec3 } from "@repo/webgl";
import { $Vec3 } from "@repo/webgl";

export const $GeometryType = z.enum([
  "box",
  "sphere",
  "tetrahedron",
  "torus",
  "plane",
]);

export type GeometryType = z.infer<typeof $GeometryType>;

export const $Geometry = z.object({
  type: $GeometryType,
  position: $Vec3.default({ x: 0, y: 0, z: 0 }),
  scale: $Vec3.default({ x: 1, y: 1, z: 1 }),
  rotation: $Vec3.default({ x: 0, y: 0, z: 0 }),
  wireframe: z.boolean().default(false),
  shouldRenderInNode: z.boolean().default(true),
});

export type Geometry = z.infer<typeof $Geometry>;

interface CreateDefaultGeometryOptions {
  type: GeometryType;
  position?: Vec3;
  scale?: Vec3;
  rotation?: Vec3;
}

export const createDefaultGeometry = ({
  type,
  position = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  rotation = { x: 0, y: 0, z: 0 },
}: CreateDefaultGeometryOptions): Geometry =>
  ({
    type,
    position,
    scale,
    rotation,
    wireframe: false,
    shouldRenderInNode: true,
  }) satisfies Geometry;
