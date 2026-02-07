import type { EvalInfraConfig } from "../context/eval-context";

/**
 * Configure the process environment for eval execution.
 * MUST be called before importing @repo/console-search or any pipeline module.
 *
 * The db singleton in @db/console/client reads env vars at import time:
 *   postgresql://{DATABASE_USERNAME}:{DATABASE_PASSWORD}@{DATABASE_HOST}:6432/postgres?sslmode=verify-full
 *
 * This function maps EVAL_* credentials to the runtime env vars that singletons read.
 */
export function configureEvalEnvironment(infra: EvalInfraConfig): void {
  // Database — points postgres-js singleton to eval branch
  process.env.DATABASE_HOST = infra.db.host;
  process.env.DATABASE_USERNAME = infra.db.username;
  process.env.DATABASE_PASSWORD = infra.db.password;

  // Pinecone — same API key, namespace isolation is per-call
  process.env.PINECONE_API_KEY = infra.pinecone.apiKey;

  // Cohere — embeddings and reranking
  process.env.COHERE_API_KEY = infra.cohere.apiKey;

  // Braintrust — optional
  if (infra.braintrust?.apiKey) {
    process.env.BRAINTRUST_API_KEY = infra.braintrust.apiKey;
  }

  // Skip env validation (we've set everything explicitly)
  process.env.SKIP_ENV_VALIDATION = "true";
}

/**
 * Dynamically import and create eval search function.
 * Uses dynamic import to ensure env vars are set before singletons initialize.
 */
export async function createEvalSearchFn(workspaceId: string) {
  // Dynamic import — singletons created NOW with eval env vars
  const { searchLogic } = await import("@repo/console-search");
  type V1AuthContext = import("@repo/console-search").V1AuthContext;

  const evalAuth: V1AuthContext = {
    workspaceId,
    userId: "eval-runner",
    authType: "api-key",
  };

  return async function evalSearch(
    query: string,
    mode: "fast" | "balanced" | "thorough" = "balanced",
    limit: number = 10,
  ) {
    return searchLogic(evalAuth, {
      query,
      limit,
      offset: 0,
      mode,
      includeContext: false,
      includeHighlights: false,
      requestId: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  };
}
