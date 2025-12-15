/**
 * Cached workspace configuration for neural search operations.
 * Contains only the fields needed for Pinecone queries and embedding generation.
 */
export interface CachedWorkspaceConfig {
  indexName: string;
  namespaceName: string;
  embeddingModel: string;
  embeddingDim: number;
}
