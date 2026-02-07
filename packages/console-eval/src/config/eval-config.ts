import { evalEnv } from "../env";
import type { EvalConfig } from "../types";
import { loadEvalInfraConfig } from "./infra";

export type { EvalConfig } from "../types";

/**
 * Create eval config with sensible defaults.
 * All infrastructure credentials come from validated EVAL_* env vars.
 */
export function createDefaultEvalConfig(overrides?: Partial<EvalConfig>): EvalConfig {
  const runId = overrides?.runId ?? evalEnv.EVAL_RUN_ID ?? `local-${Date.now()}`;

  return {
    runId,
    infra: loadEvalInfraConfig(),
    workspace: {
      workspaceId: `eval_ws_${runId}`,
      indexName: "lightfast-v1",
      namespaceName: evalEnv.EVAL_PINECONE_NAMESPACE ?? `eval:run_${runId}`,
      embeddingModel: "embed-english-v3.0",
      embeddingDim: 1024,
      enableClusters: false,
      enableActors: false,
    },
    braintrust: {
      project: "neural-search-eval",
      experiment: `eval-${runId}`,
      sendLogs: !!evalEnv.EVAL_BRAINTRUST_API_KEY,
    },
    execution: {
      searchMode: evalEnv.EVAL_SEARCH_MODE,
      maxConcurrency: 4,
      timeout: 30_000,
      kValues: [3, 5, 10],
    },
    dataset: {
      casesPath: "packages/console-eval/datasets/eval-dataset.json",
      corpusPath: "packages/console-eval/datasets/eval-corpus.json",
      embeddingCachePath: "packages/console-eval/cache/",
    },
    ...overrides,
  };
}
