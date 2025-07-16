import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../env";

export const openrouter = createOpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: env.OPENROUTER_API_KEY ?? "",
});

// Model aliases for easy migration
export const models = {
	claude4Sonnet: "anthropic/claude-sonnet-4",
} as const;
