import type { V1AuthContext } from "@repo/console-search";

/**
 * Infrastructure credentials for eval execution.
 * All fields are explicit — no implicit env var usage.
 */
export interface EvalInfraConfig {
  /** PlanetScale eval branch credentials (postgres-js over TCP/PgBouncer) */
  db: {
    host: string;
    username: string;
    password: string;
  };
  /** Pinecone API key (same key, eval namespace isolation is per-call) */
  pinecone: {
    apiKey: string;
  };
  /** Cohere API key for embeddings + reranking */
  cohere: {
    apiKey: string;
  };
  /** Braintrust (optional — omit for noSendLogs mode) */
  braintrust?: {
    apiKey: string;
  };
}

/**
 * Eval-specific workspace configuration.
 * Controls which Pinecone namespace the pipeline queries.
 */
export interface EvalWorkspaceConfig {
  workspaceId: string;
  indexName: string;
  namespaceName: string;
  embeddingModel: string;
  embeddingDim: number;
  enableClusters: boolean;
  enableActors: boolean;
}

/**
 * Complete eval context — everything needed to run searchLogic() in isolation.
 */
export interface EvalContext {
  auth: V1AuthContext;
  workspaceConfig: EvalWorkspaceConfig;
  infra: EvalInfraConfig;
  runId: string;
}

/**
 * Safety guard: validate that eval config does NOT point to production.
 * Checks namespace prefix and workspace ID prefix.
 * Three layers of defense:
 *   1. PlanetScale branch-scoped passwords (physical isolation)
 *   2. Pinecone namespace prefix enforcement (this function)
 *   3. Workspace ID prefix enforcement (this function)
 */
export function assertEvalSafety(workspace: EvalWorkspaceConfig): void {
  if (!workspace.namespaceName.startsWith("eval:")) {
    throw new Error(
      `SAFETY: Eval namespace must start with "eval:" prefix. ` +
        `Got: "${workspace.namespaceName}". ` +
        `This prevents accidental writes to production Pinecone namespaces.`,
    );
  }

  if (!workspace.workspaceId.startsWith("eval_")) {
    throw new Error(
      `SAFETY: Eval workspaceId must start with "eval_" prefix. ` +
        `Got: "${workspace.workspaceId}". ` +
        `This prevents accidental queries against production workspace data.`,
    );
  }
}
