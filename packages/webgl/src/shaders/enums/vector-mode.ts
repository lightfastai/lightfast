import { z } from "zod";

export const $VectorMode = z.enum(["Number", "Expression"]);

export type VectorMode = z.infer<typeof $VectorMode>;
