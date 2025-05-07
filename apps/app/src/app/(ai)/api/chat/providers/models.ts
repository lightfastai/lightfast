import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, customProvider } from "ai";

import { env } from "~/env";

export const modelRegistry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  }),
});

export const modelProviders = customProvider({
  languageModels: {
    "title-model": modelRegistry.languageModel("openai:gpt-4-turbo-preview"),
    "chat-model": modelRegistry.languageModel("openai:gpt-4-turbo-preview"),
    "artifact-model": modelRegistry.languageModel("openai:gpt-4-turbo-preview"),
  },
});
