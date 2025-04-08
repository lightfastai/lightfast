import { z } from "zod";

export const $VectorModeValues = ["Number", "Expression"] as const;

export const $VectorMode = z.enum($VectorModeValues);

export type VectorMode = z.infer<typeof $VectorMode>;
