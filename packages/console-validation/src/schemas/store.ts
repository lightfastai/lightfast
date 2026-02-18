/**
 * Store Validation Schemas
 *
 * Domain-specific validation for vector store operations.
 * Used in tRPC procedures for store management.
 */

import { z } from "zod";
import { nanoidSchema } from "../primitives/ids";
import { storeNameSchema } from "../primitives/slugs";

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
  storeSlug: storeNameSchema,
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
  storeSlug: storeNameSchema,
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
 *
 * Defines supported embedding providers.
 * Values can be extended without database migration.
 */
export const embeddingProviderSchema = z.enum(["cohere", "openai", "anthropic"]);

export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;

/**
 * Cohere Embedding Models
 *
 * Supported Cohere embedding models with their dimensions.
 * See: https://docs.cohere.com/docs/cohere-embed
 */
export const cohereEmbeddingModelSchema = z.enum([
  "embed-english-v3.0",
  "embed-multilingual-v3.0",
  "embed-english-light-v3.0",
  "embed-multilingual-light-v3.0",
  "embed-english-v2.0",
  "embed-multilingual-v2.0",
]);

export type CohereEmbeddingModel = z.infer<typeof cohereEmbeddingModelSchema>;

/**
 * Pinecone Region Schema
 *
 * Validates Pinecone region format (provider-region-zone).
 * Examples: us-east-1, eu-west-1, gcp-starter
 *
 * Pattern allows for:
 * - Cloud provider prefix (aws, gcp, azure)
 * - Region name (east, west, central, etc.)
 * - Zone number (1, 2, etc.)
 * - Special regions (starter, free, etc.)
 */
export const pineconeRegionSchema = z
  .string()
  .min(1, "Pinecone region must not be empty")
  .regex(
    /^[a-z]+-[a-z]+-\d+$|^[a-z]+-[a-z]+$/,
    "Pinecone region must match format: provider-region-zone (e.g., us-east-1, gcp-starter)"
  );

export type PineconeRegion = z.infer<typeof pineconeRegionSchema>;

/**
 * Chunk Max Tokens Schema
 *
 * Maximum number of tokens per chunk for document processing.
 *
 * Constraints:
 * - Minimum: 64 tokens (practical lower bound for meaningful chunks)
 * - Maximum: 4096 tokens (common context window limit)
 * - Common values: 256, 512, 1024, 2048
 *
 * @example
 * ```typescript
 * const tokens = chunkMaxTokensSchema.parse(512); // ✅ Valid
 * const tokens = chunkMaxTokensSchema.parse(32);  // ❌ Too small
 * const tokens = chunkMaxTokensSchema.parse(8192); // ❌ Too large
 * ```
 */
export const chunkMaxTokensSchema = z
  .number()
  .int("Chunk max tokens must be an integer")
  .min(64, "Chunk max tokens must be at least 64")
  .max(4096, "Chunk max tokens must not exceed 4096");

export type ChunkMaxTokens = z.infer<typeof chunkMaxTokensSchema>;

/**
 * Chunk Overlap Schema
 *
 * Number of tokens to overlap between consecutive chunks.
 * Ensures context continuity across chunk boundaries.
 *
 * Constraints:
 * - Minimum: 0 tokens (no overlap)
 * - Maximum: 1024 tokens (reasonable upper bound)
 * - Should be less than chunkMaxTokens (validated at usage site)
 *
 * @example
 * ```typescript
 * const overlap = chunkOverlapSchema.parse(50); // ✅ Valid
 * const overlap = chunkOverlapSchema.parse(-10); // ❌ Negative not allowed
 * ```
 */
export const chunkOverlapSchema = z
  .number()
  .int("Chunk overlap must be an integer")
  .min(0, "Chunk overlap must be non-negative")
  .max(1024, "Chunk overlap must not exceed 1024");

export type ChunkOverlap = z.infer<typeof chunkOverlapSchema>;

/**
 * Pinecone Index Name Schema
 *
 * Validates Pinecone index names according to Pinecone naming constraints.
 *
 * Constraints:
 * - 1-45 characters (Pinecone limit)
 * - Lowercase alphanumeric + hyphens only
 * - Must not start or end with a hyphen
 * - No consecutive hyphens
 *
 * Format: ws-{workspaceSlug}-{storeSlug}
 *
 * @example
 * ```typescript
 * pineconeIndexNameSchema.parse("ws-my-workspace-docs"); // ✅ Valid
 * pineconeIndexNameSchema.parse("ws-robust-chicken-kb"); // ✅ Valid
 * pineconeIndexNameSchema.parse("UPPERCASE"); // ❌ Must be lowercase
 * pineconeIndexNameSchema.parse("-invalid"); // ❌ Cannot start with hyphen
 * pineconeIndexNameSchema.parse("test--index"); // ❌ No consecutive hyphens
 * ```
 */
export const pineconeIndexNameSchema = z
  .string()
  .min(1, "Pinecone index name must not be empty")
  .max(45, "Pinecone index name must be 45 characters or less")
  .regex(
    /^[a-z0-9-]+$/,
    "Pinecone index name must be lowercase alphanumeric with hyphens"
  )
  .refine(
    (name) => !/^-|-$|--/.test(name),
    "Pinecone index name cannot have leading/trailing/consecutive hyphens"
  );

export type PineconeIndexName = z.infer<typeof pineconeIndexNameSchema>;

/**
 * Store Configuration Schema
 *
 * Complete store configuration for creation/update with cross-field validation.
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
export const storeConfigurationSchema = z
  .object({
    slug: storeNameSchema,
    embeddingDim: z.number().int().positive(),
    pineconeMetric: pineconeMetricSchema,
    pineconeCloud: pineconeCloudSchema,
    pineconeRegion: pineconeRegionSchema,
    chunkMaxTokens: chunkMaxTokensSchema,
    chunkOverlap: chunkOverlapSchema,
    embeddingModel: cohereEmbeddingModelSchema,
    embeddingProvider: embeddingProviderSchema,
  })
  .refine((data) => data.chunkOverlap < data.chunkMaxTokens, {
    message: "Chunk overlap must be less than chunk max tokens",
    path: ["chunkOverlap"],
  });

export type StoreConfiguration = z.infer<typeof storeConfigurationSchema>;
