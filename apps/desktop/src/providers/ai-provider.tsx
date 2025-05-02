import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

export const registry = createProviderRegistry({
  // register provider with prefix and default setup:
  // anthropic: createAnthropic({
  //   apiKey: anthropicApiKey,
  // }),

  // register provider with prefix and custom setup:
  openai: createOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  }),
});
