import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "@vendor/observability/log";
import type { EvalConfig } from "../config/eval-config";
import type { EvalRunResult } from "../eval/runner";
import { assertEvalSafety } from "../context/eval-context";
import { configureEvalEnvironment, createEvalSearchFn } from "./entry";
import { validateDataset } from "../datasets/schema";
import { computeRetrievalMetrics, type RetrievalMetrics } from "../metrics/retrieval";

/**
 * Run evaluation in-process using direct searchLogic() invocation.
 *
 * Call chain:
 *   configureEvalEnvironment(infra)     -> Set env vars before singleton init
 *   createEvalSearchFn(workspaceId)     -> Dynamic import of @repo/console-search
 *   Eval(project, {                     -> Braintrust in-process
 *     task: evalSearch(query, mode)     -> Direct function call (no HTTP)
 *       -> searchLogic(auth, input)     -> Same production code
 *         -> fourPathParallelSearch()   -> Uses db/pinecone singletons with eval data
 *   })
 */
export async function runEvalInProcess(config: EvalConfig): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // 1. Safety check
  assertEvalSafety(config.workspace);

  // 2. Configure environment BEFORE any pipeline imports
  log.info("Configuring eval environment", {
    runId: config.runId,
    workspaceId: config.workspace.workspaceId,
    namespace: config.workspace.namespaceName,
  });
  configureEvalEnvironment(config.infra);

  // 3. Create eval search function (dynamic import)
  const evalSearch = await createEvalSearchFn(config.workspace.workspaceId);

  // 4. Load dataset
  console.log(`Loading dataset: ${config.dataset.casesPath}`);
  const raw = readFileSync(config.dataset.casesPath, "utf-8");
  const dataset = validateDataset(JSON.parse(raw));
  console.log(`Loaded ${dataset.cases.length} eval cases`);

  // 5. Dynamic import of Braintrust (env vars must be set before this)
  const { Eval, initLogger } = await import("@vendor/braintrust");

  if (config.braintrust.sendLogs && config.infra.braintrust?.apiKey) {
    initLogger({
      apiKey: config.infra.braintrust.apiKey,
      projectName: config.braintrust.project,
    });
  }

  // 6. Run eval
  console.log(`Running in-process eval with ${config.execution.searchMode} mode`);

  const perCaseResults: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }> = [];

  await Eval(config.braintrust.project, {
    experimentName: config.braintrust.experiment,
    data: dataset.cases.map((c) => ({
      input: {
        query: c.query,
        mode: config.execution.searchMode,
      },
      expected: {
        observationIds: c.expectedObservationIds,
        gradedRelevance: c.gradedRelevance,
      },
      metadata: {
        caseId: c.id,
        queryType: c.queryType,
        complexity: c.complexity,
      },
    })),
    task: async (input: { query: string; mode: string }) => {
      const caseStartTime = Date.now();

      // Direct function call — no HTTP, no auth middleware, no JSON serialization
      const response = await evalSearch(
        input.query,
        input.mode as "fast" | "balanced" | "thorough",
        10,
      );

      const latencyMs = Date.now() - caseStartTime;

      return {
        results: response.data.map((r, i) => ({
          id: r.id,
          score: r.score ?? 0,
          rank: i + 1,
        })),
        latencyMs,
        searchLatency: response.latency,
      };
    },
    scores: [
      async (args: any) => {
        const relevant = new Set(args.expected.observationIds as string[]);
        const metrics = computeRetrievalMetrics(
          args.output.results,
          relevant,
          config.execution.kValues,
          args.expected.gradedRelevance,
        );

        perCaseResults.push({
          caseId: args.metadata.caseId,
          metrics,
          latencyMs: args.output.latencyMs,
        });

        return {
          name: "mrr",
          score: metrics.mrr,
        };
      },
    ],
    maxConcurrency: config.execution.maxConcurrency,
    timeout: config.execution.timeout,
  });

  // 7. Compute aggregate metrics
  const n = perCaseResults.length;
  const avg = (fn: (r: (typeof perCaseResults)[0]) => number) =>
    n > 0 ? perCaseResults.reduce((sum, r) => sum + fn(r), 0) / n : 0;

  const aggregateMetrics: RetrievalMetrics = {
    mrr: avg((r) => r.metrics.mrr),
    recallAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.recallAtK[k] ?? 0)]),
    ),
    precisionAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.precisionAtK[k] ?? 0)]),
    ),
    ndcgAtK: Object.fromEntries(
      config.execution.kValues.map((k) => [k, avg((r) => r.metrics.ndcgAtK[k] ?? 0)]),
    ),
    totalRelevant: avg((r) => r.metrics.totalRelevant),
    totalRetrieved: avg((r) => r.metrics.totalRetrieved),
  };

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const result: EvalRunResult = {
    config: {
      datasetPath: config.dataset.casesPath,
      tier: "retrieval",
      searchMode: config.execution.searchMode,
      maxConcurrency: config.execution.maxConcurrency,
      braintrustProject: config.braintrust.project,
      experimentName: config.braintrust.experiment,
    },
    aggregateMetrics,
    perCase: perCaseResults,
    braintrustExperimentUrl: config.braintrust.sendLogs
      ? `https://www.braintrust.dev/app/${config.braintrust.project}/${config.braintrust.experiment}`
      : "local-only",
    startedAt,
    completedAt,
    durationMs,
  };

  // 8. Save result
  const resultPath = join(process.cwd(), `eval-result-${config.runId}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\nResult saved to: ${resultPath}`);

  // 9. Print summary
  console.log("\nAggregate Metrics:");
  console.log(`  MRR: ${aggregateMetrics.mrr.toFixed(4)}`);
  for (const k of config.execution.kValues) {
    console.log(`  Recall@${k}: ${(aggregateMetrics.recallAtK[k] ?? 0).toFixed(4)}`);
    console.log(`  Precision@${k}: ${(aggregateMetrics.precisionAtK[k] ?? 0).toFixed(4)}`);
    console.log(`  NDCG@${k}: ${(aggregateMetrics.ndcgAtK[k] ?? 0).toFixed(4)}`);
  }
  console.log(`  Duration: ${durationMs}ms (${(durationMs / dataset.cases.length).toFixed(0)}ms/case)`);

  return result;
}
