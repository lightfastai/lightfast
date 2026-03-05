import { z } from "zod/v3";

export const $AITextModel = z.enum(["openai", "anthropic"]);
export type AITextModel = z.infer<typeof $AITextModel>;
