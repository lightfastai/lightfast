import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createVoyage } from "voyage-ai-provider";

import { llmEnv as env } from "../llm-env";

export { embedMany, embed as embedOne } from "ai";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const voyage = createVoyage({
  apiKey: env.VOYAGE_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export { openai, voyage, anthropic };

enum LLMProvider {
  OpenAI = "openai",
  Anthropic = "anthropic",
}

enum EmbeddingProvider {
  OpenAI = "openai",
  Voyage = "voyage",
}

enum EmbeddingModel {
  OpenAI = "text-embedding-ada-002",
  Voyage = "voyage-code-3",
}

export { EmbeddingModel, EmbeddingProvider, LLMProvider };

export { generateText } from "ai";
