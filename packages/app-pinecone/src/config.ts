import type { PineconeCloud, PineconeMetric } from "@repo/app-validation";
import {
  EMBEDDING_MODEL_DEFAULTS,
  PINECONE_DEFAULTS,
} from "@repo/app-validation/constants";

export const PINECONE_CONFIG = {
  index: {
    name: PINECONE_DEFAULTS.indexName,
    embeddingDim: EMBEDDING_MODEL_DEFAULTS.dimension,
    embeddingModel: EMBEDDING_MODEL_DEFAULTS.model,
    embeddingProvider: EMBEDDING_MODEL_DEFAULTS.provider,
  },
  metric: PINECONE_DEFAULTS.metric as PineconeMetric,
  cloud: PINECONE_DEFAULTS.cloud as PineconeCloud,
  region: PINECONE_DEFAULTS.region,
  deletionProtection: "enabled" as const,
  upsertBatchSize: 100,
  deleteBatchSize: 100,
  maxIndexNameLength: 45,
} as const;
