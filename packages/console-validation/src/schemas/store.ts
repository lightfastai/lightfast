/**
 * Store Validation Schemas
 *
 * Domain-specific validation for vector store operations.
 * Used in tRPC procedures for store management.
 */

import { z } from "zod";
import { nanoidSchema } from "../primitives/ids";
import { storeNameSchema, storeSlugSchema } from "../primitives/slugs";

/**
 * Store Get or Create Input Schema
 *
 * Used in:
 * - tRPC stores.getOrCreate procedure
 *
 * @example
 * ```typescript
 * const input = storeGetOrCreateInputSchema.parse({
 *   workspaceId: "V1StGXR8_Z5jdHi6B-myT",
 *   storeSlug: "docs",
 *   embeddingDim: 1024,
 * });
 * ```
 */
export const storeGetOrCreateInputSchema = z.object({
  workspaceId: nanoidSchema,
  storeSlug: storeSlugSchema,
  embeddingDim: z.number().int().positive().default(1024),
});

export type StoreGetOrCreateInput = z.infer<typeof storeGetOrCreateInputSchema>;

/**
 * Store Get by Name Input Schema
 *
 * Used in:
 * - tRPC stores.getByName procedure
 *
 * @example
 * ```typescript
 * const input = storeGetByNameInputSchema.parse({
 *   storeSlug: "docs",
 * });
 * ```
 */
export const storeGetByNameInputSchema = z.object({
  storeSlug: storeSlugSchema,
});

export type StoreGetByNameInput = z.infer<typeof storeGetByNameInputSchema>;

/**
 * Store List by Workspace Input Schema
 *
 * Used in:
 * - tRPC stores.listByWorkspace procedure
 *
 * @example
 * ```typescript
 * const input = storeListByWorkspaceInputSchema.parse({
 *   workspaceId: "V1StGXR8_Z5jdHi6B-myT",
 * });
 * ```
 */
export const storeListByWorkspaceInputSchema = z.object({
  workspaceId: nanoidSchema,
});

export type StoreListByWorkspaceInput = z.infer<
  typeof storeListByWorkspaceInputSchema
>;

/**
 * Pinecone Metric Enum
 */
export const pineconeMetricSchema = z.enum(["cosine", "euclidean", "dotproduct"]);

export type PineconeMetric = z.infer<typeof pineconeMetricSchema>;

/**
 * Pinecone Cloud Enum
 */
export const pineconeCloudSchema = z.enum(["aws", "gcp", "azure"]);

export type PineconeCloud = z.infer<typeof pineconeCloudSchema>;

/**
 * Embedding Provider Enum
 */
export const embeddingProviderSchema = z.enum(["cohere", "openai", "anthropic"]);

export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;

/**
 * Store Configuration Schema
 *
 * Complete store configuration for creation/update
 *
 * @example
 * ```typescript
 * const config = storeConfigurationSchema.parse({
 *   slug: "docs",
 *   embeddingDim: 1024,
 *   pineconeMetric: "cosine",
 *   pineconeCloud: "aws",
 *   pineconeRegion: "us-east-1",
 *   chunkMaxTokens: 512,
 *   chunkOverlap: 50,
 *   embeddingModel: "embed-english-v3.0",
 *   embeddingProvider: "cohere",
 * });
 * ```
 */
export const storeConfigurationSchema = z.object({
  slug: storeSlugSchema,
  embeddingDim: z.number().int().positive(),
  pineconeMetric: pineconeMetricSchema,
  pineconeCloud: pineconeCloudSchema,
  pineconeRegion: z.string().min(1, "Pinecone region must not be empty"),
  chunkMaxTokens: z.number().int().positive(),
  chunkOverlap: z.number().int().nonnegative(),
  embeddingModel: z.string().min(1, "Embedding model must not be empty"),
  embeddingProvider: embeddingProviderSchema,
});

export type StoreConfiguration = z.infer<typeof storeConfigurationSchema>;
