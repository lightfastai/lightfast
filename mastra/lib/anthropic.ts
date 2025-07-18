import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "../../env";

export const anthropic = createAnthropic({
	apiKey: env.ANTHROPIC_API_KEY,
});

// Model aliases for easy usage
export const anthropicModels = {
	claude4Sonnet: "claude-sonnet-4-20250514",
} as const;
