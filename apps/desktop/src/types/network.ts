import { z } from "zod";

export const Networks = z.enum(["blender"]);
export type Networks = z.infer<typeof Networks>;
