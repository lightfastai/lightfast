import { z } from "zod";

export const $ShaderValues = [
  "Noise",
  "Limit",
  "Displace",
  "Add",
  "Blur",
] as const;

export const $Shaders = z.enum($ShaderValues);

export type Shaders = z.infer<typeof $Shaders>;
