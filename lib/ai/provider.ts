import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../env";

// Anthropic provider
export const anthropic = createAnthropic({
	apiKey: env.ANTHROPIC_API_KEY,
});

// OpenAI provider
export const openai = createOpenAI({
	apiKey: env.OPENAI_API_KEY ?? "",
});

// OpenRouter provider
export const openrouter = createOpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: env.OPENROUTER_API_KEY,
	headers: {
		"HTTP-Referer": "http://localhost:3000", // Update this to your production URL
		"X-Title": "HAL9000 AI Assistant", // Your app name
	},
});

// Model aliases for Anthropic
export const anthropicModels = {
	claude4Sonnet: "claude-sonnet-4-20250514",
} as const;

// Model aliases for OpenAI
export const openaiModels = {
	gpt4: "gpt-4",
	gpt4Turbo: "gpt-4-turbo",
	gpt35Turbo: "gpt-3.5-turbo",
	gpt4o: "gpt-4o",
	gpt4oMini: "gpt-4o-mini",
} as const;

// Model aliases for OpenRouter
export const openrouterModels = {
	claude4Sonnet: "anthropic/claude-sonnet-4",
	claude35Sonnet: "anthropic/claude-3.5-sonnet",
	claude35SonnetLatest: "anthropic/claude-3.5-sonnet-20241022",
	gpt4o: "openai/gpt-4o",
	gpt4oMini: "openai/gpt-4o-mini",
} as const;

// Re-export the models object for backward compatibility with openrouter
export const models = openrouterModels;