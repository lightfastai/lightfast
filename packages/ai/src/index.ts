export { embedMany, embed as embedOne } from "ai";

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

export { generateImageWithFal } from "./fal/generate-text-to-image";
export { generateVideoWithFal } from "./fal/generate-text-to-video";
export type { FalGenerateImageSuccessPayload } from "./fal/generate-text-to-image";
