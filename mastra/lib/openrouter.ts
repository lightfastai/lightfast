import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

// Model aliases for easy migration
export const models = {
  claude4Sonnet: "anthropic/claude-4-sonnet-20250514",
} as const;