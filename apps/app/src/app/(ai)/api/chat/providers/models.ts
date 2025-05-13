import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
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

const $ModelUseCase = z.enum([
  "reasoning",
  "json",
  "artifact",
  "title",
  "chat",
]);

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
  google: createVertex({
    project: env.GOOGLE_PROJECT_ID,
    location: "us-central1",
    googleAuthOptions: {
      credentials: {
        client_email: env.GOOGLE_AUTH_EMAIL,
        private_key: env.GOOGLE_AUTH_PRIVATE_KEY,
      },
    },
  }),
});

export type ModelUseCase = z.infer<typeof $ModelUseCase>;

export const providers = customProvider({
  languageModels: {
    [$ModelUseCase.enum.artifact]: modelRegistry.languageModel(
      "openrouter:gpt-4o-mini",
    ),
    [$ModelUseCase.enum.chat]: modelRegistry.languageModel(
      // "google:gemini-2.5-flash-preview-04-17",
      // "google:gemini-2.5-flash-preview-04-17",
      "openai:o4-mini-2025-04-16",
    ),
    [$ModelUseCase.enum.reasoning]: modelRegistry.languageModel(
      "google:gemini-2.5-pro-preview-05-06",
    ),
    [$ModelUseCase.enum.json]:
      modelRegistry.languageModel("openrouter:o4-mini"),
    [$ModelUseCase.enum.title]: modelRegistry.languageModel(
      "openrouter:gpt-4o-mini",
    ),
  },
});

// const middleware = extractReasoningMiddleware({
//   tagName: "think",
// });

// export const scira = customProvider({
//   languageModels: {
//     "scira-default": xai("grok-3-mini"),
//     "scira-grok-3": xai("grok-3-fast"),
//     "scira-vision": xai("grok-2-vision-1212"),
//     "scira-4o": openai("gpt-4o", {
//       structuredOutputs: true,
//     }),
//     "scira-o4-mini": openai.responses("o4-mini-2025-04-16"),
//     "scira-qwq": wrapLanguageModel({
//       model: groq("qwen-qwq-32b"),
//       middleware,
//     }),
//     "scira-google": google("gemini-2.5-flash-preview-04-17", {
//       structuredOutputs: true,
//     }),
//     "scira-google-pro": google("gemini-2.5-pro-preview-05-06", {
//       structuredOutputs: true,
//     }),
//     "scira-anthropic": anthropic("claude-3-7-sonnet-20250219"),
//     "scira-llama-4": groq("meta-llama/llama-4-maverick-17b-128e-instruct", {
//       parallelToolCalls: false,
//     }),
//   },
// });
