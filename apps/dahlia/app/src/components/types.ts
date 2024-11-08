import type { z } from "zod";

import type { $Geometry, $Material, $Node } from "./schema";
import type { Texture } from "./texture/types";
import { $GeometryType, $MaterialType } from "./schema";
import { $TextureTypes } from "./texture/schema";

/**
 * @note Used internally to determine if the geometry should be rendered in node-display.
 *
 * @todo
 *  1. Implement a method to convert node-display coordinates to canvas coordinates.
 *     We already have the logic for this in `bg-snap-canvas.tsx`
 *  2. Allow nodes to have names; re a decent implementation for this is TouchDesigner naming convention system.
 *  3. A more unique identifier for nodes (e.g. UUID).
 *  4. Distinction between static and dynamic properties.
 */

export type Node = z.infer<typeof $Node>;

export type Geometry = z.infer<typeof $Geometry> & Node;

export type Material = z.infer<typeof $Material> & Node;

export type GeometryType = z.infer<typeof $GeometryType>;

export type MaterialType = z.infer<typeof $MaterialType>;

// Generalized type guard function with expectedType
function isOfType<T extends { type: string }>(
  property: T | Material | Geometry | Texture | null,
  expectedType: z.ZodEnum<[string, ...string[]]>,
): property is T {
  return property !== null && expectedType.safeParse(property.type).success;
}

// Specialized functions using the generalized type guard
export const isGeometry = (
  property: Geometry | Material | Texture | null,
): property is Geometry => isOfType<Geometry>(property, $GeometryType);

export const isMaterial = (
  property: Geometry | Material | Texture | null,
): property is Material => isOfType<Material>(property, $MaterialType);

export const isTexture = (
  property: Geometry | Material | Texture | null,
): property is Texture => isOfType<Texture>(property, $TextureTypes);
