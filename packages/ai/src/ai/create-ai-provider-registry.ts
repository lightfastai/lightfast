import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

import { anthropicEnv } from "../env/anthropic-env";
import { AITextModel } from "./types";

export const registry = createProviderRegistry({
  // register provider with prefix and default setup:
  anthropic: createAnthropic({
    apiKey: anthropicEnv.ANTHROPIC_API_KEY,
  }),

  // register provider with prefix and custom setup:
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
});

export const getAIProvider = (model: AITextModel) => {
  switch (model) {
    case "openai":
      return registry.languageModel("openai:gpt-4o");
    case "anthropic":
      return registry.languageModel("anthropic:claude-3-5-sonnet-latest");
    default:
      throw new Error(`Unknown model: ${model}`);
  }
};
