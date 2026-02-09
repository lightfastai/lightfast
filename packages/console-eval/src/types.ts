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
 * Complete eval configuration — combines all settings needed for a run.
 */
export interface EvalConfig {
  runId: string;
  infra: EvalInfraConfig;
  workspace: EvalWorkspaceConfig;
  braintrust: {
    project: string;
    experiment: string;
    sendLogs: boolean;
  };
  execution: {
    searchMode: "fast" | "balanced" | "thorough";
    maxConcurrency: number;
    timeout: number;
    kValues: number[];
  };
  dataset: {
    casesPath: string;
    corpusPath: string;
    embeddingCachePath: string;
  };
}

export interface SeedResult {
  observationsInserted: number;
  entitiesExtracted: number;
  vectorsUpserted: number;
  durationMs: number;
}
