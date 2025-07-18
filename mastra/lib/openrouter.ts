import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../env";

export const openrouter = createOpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: env.OPENROUTER_API_KEY,
	headers: {
		"HTTP-Referer": "http://localhost:3000", // Update this to your production URL
		"X-Title": "HAL9000 AI Assistant", // Your app name
	},
});

// Model aliases for easy migration
export const models = {
	claude4Sonnet: "anthropic/claude-sonnet-4",
	claude35Sonnet: "anthropic/claude-3.5-sonnet",
	claude35SonnetLatest: "anthropic/claude-3.5-sonnet-20241022",
	gpt4o: "openai/gpt-4o",
	gpt4oMini: "openai/gpt-4o-mini",
} as const;
