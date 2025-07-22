import { createAnthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
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
		"X-Title": "lightfast-experimental AI Assistant", // Your app name
	},
});

// Model aliases for Anthropic
export const anthropicModels = {
	claude4Sonnet: "claude-sonnet-4-20250514",
} as const;

// Model aliases for OpenAI
export const openaiModels = {
	gpt4oMini: "gpt-4o-mini",
} as const;

// Model aliases for OpenRouter
export const openrouterModels = {
	claude4Sonnet: "anthropic/claude-sonnet-4",
	gpt4oMini: "openai/gpt-4o-mini",
} as const;

// Re-export the models object for backward compatibility with openrouter
export const models = openrouterModels;

// Vercel AI Gateway Configuration
// Option 1: Direct gateway usage (recommended)
export const gatewayModels = {
	claude4Sonnet: gateway("anthropic/claude-4-sonnet"),
	gpt4o: gateway("openai/gpt-4o"),
	gpt4oMini: gateway("openai/gpt-4o-mini"),
} as const;

// Option 2: Configure Anthropic provider to use Vercel AI Gateway
export const anthropicViaGateway = createAnthropic({
	baseURL: "https://ai-gateway.vercel.sh/v1/ai/anthropic",
	apiKey: env.AI_GATEWAY_API_KEY || env.ANTHROPIC_API_KEY,
});

// Option 3: Configure OpenAI provider to use Vercel AI Gateway
export const openaiViaGateway = createOpenAI({
	baseURL: "https://ai-gateway.vercel.sh/v1/ai/openai",
	apiKey: env.AI_GATEWAY_API_KEY || env.OPENAI_API_KEY,
});
