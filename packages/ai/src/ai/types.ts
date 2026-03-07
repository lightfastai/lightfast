import { z } from "zod";

export const $AITextModel = z.enum(["openai", "anthropic"]);
export type AITextModel = z.infer<typeof $AITextModel>;
