/**
 * Cached workspace configuration for neural search operations.
 * Contains only the fields needed for Pinecone queries and embedding generation.
 */
export interface CachedWorkspaceConfig {
  embeddingDim: number;
  embeddingModel: string;
  hasActors: boolean;
  indexName: string;
  namespaceName: string;
}
