import { z } from "zod";

/**
 * Embedding configuration within workspace settings
 */
export const workspaceEmbeddingConfigSchema = z.object({
  indexName: z.string().min(1),
  namespaceName: z.string().min(1),
  embeddingDim: z.number().int().positive().default(1024),
  embeddingModel: z.string().default("embed-english-v3.0"),
  embeddingProvider: z.string().default("cohere"),
  pineconeMetric: z.string().default("cosine"),
  pineconeCloud: z.string().default("aws"),
  pineconeRegion: z.string().default("us-east-1"),
  chunkMaxTokens: z.number().int().min(64).max(4096).default(512),
  chunkOverlap: z.number().int().min(0).max(1024).default(50),
});

export type WorkspaceEmbeddingConfig = z.infer<typeof workspaceEmbeddingConfigSchema>;

/**
 * Workspace settings schema V1
 *
 * Version field enables future schema migrations
 */
export const workspaceSettingsV1Schema = z.object({
  version: z.literal(1),
  embedding: workspaceEmbeddingConfigSchema,
  repositories: z
    .record(z.object({ enabled: z.boolean() }))
    .optional(),
  defaults: z
    .object({
      patterns: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
    })
    .optional(),
  features: z
    .object({
      codeIndexing: z.boolean().optional(),
      multiLanguage: z.boolean().optional(),
    })
    .optional(),
});

export type WorkspaceSettingsV1 = z.infer<typeof workspaceSettingsV1Schema>;

/**
 * Current workspace settings type (alias for latest version)
 */
export const workspaceSettingsSchema = workspaceSettingsV1Schema;
export type WorkspaceSettings = WorkspaceSettingsV1;
