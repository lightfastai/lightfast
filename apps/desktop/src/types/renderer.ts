import { z } from "zod";

export const Renderer = z.enum(["composer", "index"]);
export type Renderer = z.infer<typeof Renderer>;
