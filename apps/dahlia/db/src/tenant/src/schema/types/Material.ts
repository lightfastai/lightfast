import { z } from "zod";

import { $Color } from "@repo/webgl/schema/color";

export const $MaterialType = z.enum(["phong"]);

export type MaterialType = z.infer<typeof $MaterialType>;

export const $Material = z.object({
  type: $MaterialType,
  color: $Color.default("#000000"),
  shouldRenderInNode: z.boolean().default(true),
});

export type Material = z.infer<typeof $Material>;

export const createDefaultMaterial = ({
  type,
}: {
  type: MaterialType;
}): Material =>
  ({
    type,
    color: "#000000",
    shouldRenderInNode: true,
  }) satisfies Material;
