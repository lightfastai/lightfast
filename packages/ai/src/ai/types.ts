import { z } from "zod";

const $AITextModel = z.enum(["openai", "anthropic"]);
export type AITextModel = z.infer<typeof $AITextModel>;
