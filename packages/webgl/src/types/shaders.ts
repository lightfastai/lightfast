import { z } from "zod";

export const $ShaderValues = ["Noise", "Limit", "Displace", "Add"] as const;

export const $Shaders = z.enum($ShaderValues);

export type Shaders = z.infer<typeof $Shaders>;
