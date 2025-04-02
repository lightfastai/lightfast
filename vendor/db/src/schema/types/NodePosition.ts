import { z } from "zod";

export const $NodePosition = z.object({
  x: z.number(),
  y: z.number(),
});

export type NodePosition = z.infer<typeof $NodePosition>;
