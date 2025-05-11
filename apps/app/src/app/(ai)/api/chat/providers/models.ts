import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, customProvider } from "ai";
import { z } from "zod";

import { env } from "~/env";

const $ReasoningModels = z.enum([
  "google/gemini-2.5-pro-preview",
  "anthropic/claude-3.7-sonnet",
]);

const $JSONSupportedModels = z.enum(["openai/gpt-4o-mini"]);

const $ArtifactSupportedModels = z.enum(["gpt-4-turbo-preview"]);

const $TitleSupportedModels = z.enum(["google/gemini-2.0-flash-001"]);

const $ModelUseCase = z.enum(["reasoning", "json", "artifact", "title"]);

export const modelRegistry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  }),
  anthropic: createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  }),
  openrouter: createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
  }),
});

export type ModelUseCase = z.infer<typeof $ModelUseCase>;

export const providers = customProvider({
  languageModels: {
    [$ModelUseCase.enum.artifact]: modelRegistry.languageModel(
      "openrouter:gpt-4o-mini",
    ),
    [$ModelUseCase.enum.reasoning]: modelRegistry.languageModel(
      "anthropic:claude-3-5-sonnet-20240620",
    ),
    [$ModelUseCase.enum.json]:
      modelRegistry.languageModel("openrouter:o4-mini"),
    [$ModelUseCase.enum.title]: modelRegistry.languageModel(
      "openrouter:gpt-4o-mini",
    ),
  },
});
