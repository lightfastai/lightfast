import { gateway } from "@ai-sdk/gateway";

// Vercel AI Gateway Models
// All AI models are accessed through Vercel AI Gateway for unified management
export const gatewayModels = {
	claude4Sonnet: gateway("anthropic/claude-4-sonnet"),
	gpt4o: gateway("openai/gpt-4o"),
	gpt4oMini: gateway("openai/gpt-4o-mini"),
} as const;
