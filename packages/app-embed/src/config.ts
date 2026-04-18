import type { EmbeddingProvider } from "@repo/app-validation";
import { EMBEDDING_MODEL_DEFAULTS } from "@repo/app-validation/constants";

export const EMBEDDING_CONFIG = {
  cohere: {
    provider: EMBEDDING_MODEL_DEFAULTS.provider,
    model: EMBEDDING_MODEL_DEFAULTS.model,
    dimension: EMBEDDING_MODEL_DEFAULTS.dimension,
  },
  batchSize: 96 as const,
} satisfies {
  cohere: {
    provider: EmbeddingProvider;
    model: string;
    dimension: number;
  };
  batchSize: number;
};
