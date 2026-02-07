import { eq } from "drizzle-orm";
import {
  orgWorkspaces,
  workspaceNeuralObservations,
  workspaceNeuralEntities,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import type { EvalInfraConfig, EvalWorkspaceConfig } from "../context/eval-context";
import { assertEvalSafety } from "../context/eval-context";
import { createEvalDbClient } from "./db";

/**
 * Clean up eval infrastructure after a run.
 * Deletes Pinecone eval namespace vectors and DB records.
 */
export async function cleanupEvalData(
  infra: EvalInfraConfig,
  workspace: EvalWorkspaceConfig,
): Promise<void> {
  assertEvalSafety(workspace);

  // 1. Delete Pinecone namespace vectors by metadata filter
  log.info("Deleting Pinecone vectors", {
    index: workspace.indexName,
    namespace: workspace.namespaceName,
  });

  process.env.PINECONE_API_KEY = infra.pinecone.apiKey;
  process.env.SKIP_ENV_VALIDATION = "true";

  const { PineconeClient } = await import("@vendor/pinecone");
  const pinecone = new PineconeClient();
  await pinecone.deleteByMetadata(
    workspace.indexName,
    { workspaceId: workspace.workspaceId },
    workspace.namespaceName,
  );

  // 2. Delete DB records
  const { db, close } = createEvalDbClient(infra);
  try {
    log.info("Deleting eval DB records", { workspaceId: workspace.workspaceId });

    // Delete entities first (FK to observations)
    await db
      .delete(workspaceNeuralEntities)
      .where(eq(workspaceNeuralEntities.workspaceId, workspace.workspaceId));

    // Delete observations
    await db
      .delete(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspace.workspaceId));

    // Delete workspace record
    await db
      .delete(orgWorkspaces)
      .where(eq(orgWorkspaces.id, workspace.workspaceId));

    log.info("Cleanup complete", { workspaceId: workspace.workspaceId });
  } finally {
    await close();
  }
}
