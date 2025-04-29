import { z } from "zod";

export const $Window = z.object({
  type: z.literal("window"),
});

export type Window = z.infer<typeof $Window>;

export function createDefaultWindow(): Window {
  return {
    type: "window",
  };
}
