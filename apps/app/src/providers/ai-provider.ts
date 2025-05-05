import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, customProvider } from "ai";

import { env } from "~/env";

export const registry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  }),
});

export const aiTextProviders = customProvider({
  languageModels: {
    "title-model": registry.languageModel("openai:gpt-4-turbo-preview"),
    "chat-model": registry.languageModel("openai:gpt-4-turbo-preview"),
  },
});
