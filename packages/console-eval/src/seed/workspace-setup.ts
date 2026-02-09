import { eq } from "drizzle-orm";
import { orgWorkspaces } from "@db/console/schema";
import type { WorkspaceSettings } from "@repo/console-types";
import type { EvalWorkspaceConfig } from "../context/eval-context";
import type { createEvalDbClient } from "./db";

/**
 * Ensure eval workspace record exists in DB with correct settings.
 *
 * The workspace record is the control point for Pinecone routing:
 *   getCachedWorkspaceConfig(workspaceId) reads settings.embedding.namespaceName
 *   -> fourPathParallelSearch uses this namespace for all Pinecone queries
 *
 * @param db - Drizzle client connected to eval branch
 * @param config - Eval workspace config (workspaceId, indexName, namespaceName, etc.)
 */
export async function ensureEvalWorkspace(
  db: ReturnType<typeof createEvalDbClient>["db"],
  config: EvalWorkspaceConfig,
): Promise<void> {
  const settings: WorkspaceSettings = {
    version: 1,
    embedding: {
      indexName: config.indexName,
      namespaceName: config.namespaceName,
      embeddingModel: config.embeddingModel,
      embeddingDim: config.embeddingDim,
      embeddingProvider: "cohere",
      pineconeMetric: "cosine",
      pineconeCloud: "aws",
      pineconeRegion: "us-east-1",
      chunkMaxTokens: 512,
      chunkOverlap: 50,
    },
  };

  // Upsert: insert if not exists, update settings if exists
  const existing = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, config.workspaceId),
  });

  if (existing) {
    await db
      .update(orgWorkspaces)
      .set({ settings, updatedAt: new Date().toISOString() })
      .where(eq(orgWorkspaces.id, config.workspaceId));
  } else {
    await db.insert(orgWorkspaces).values({
      id: config.workspaceId,
      clerkOrgId: "org_eval" as any,
      name: `eval-${config.namespaceName}`,
      slug: `eval-${Date.now()}`,
      settings,
    });
  }
}
