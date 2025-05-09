import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, customProvider } from "ai";

import { env } from "~/env";

export const modelRegistry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  }),
  anthropic: createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  }),
});

export const modelProviders = customProvider({
  languageModels: {
    "title-model": modelRegistry.languageModel("openai:gpt-4-turbo-preview"),
    "chat-model": modelRegistry.languageModel(
      "anthropic:claude-3-7-sonnet-20250219",
    ),
    "artifact-model": modelRegistry.languageModel("openai:gpt-4-turbo-preview"),
  },
});
