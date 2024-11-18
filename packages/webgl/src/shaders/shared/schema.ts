import { z } from "zod";

export const $Shared = z.object({
  u_texture: z.number().nullable(),
});
