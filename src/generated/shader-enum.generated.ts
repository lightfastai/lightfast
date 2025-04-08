import { z } from "zod";

export const $ShaderValues = ["Add", "Limit", "Displace", "Noise"] as const;

export const $Shaders = z.enum($ShaderValues);

export type Shaders = z.infer<typeof $Shaders>;

