/**
 * Eval Runner
 *
 * Orchestrates: load dataset → execute searches → score → report
 */

import { Eval, initLogger } from "@vendor/braintrust";
import { braintrustEnv } from "@vendor/braintrust/env";
import type { EvalDataset } from "../datasets/schema";
import { validateDataset } from "../datasets/schema";
import { searchAPI, type SearchConfig } from "../clients/search-client";
import { computeRetrievalMetrics, type RetrievalMetrics } from "../metrics/retrieval";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface EvalRunConfig {
  datasetPath: string;
  tier: "retrieval" | "rag" | "full";
  searchMode: "fast" | "balanced" | "thorough";
  maxConcurrency: number;
  braintrustProject: string;
  experimentName: string;
}

export interface EvalRunResult {
  config: EvalRunConfig;
  aggregateMetrics: RetrievalMetrics;
  perCase: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }>;
  braintrustExperimentUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/**
 * Load and validate dataset
 */
function loadDataset(path: string): EvalDataset {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  return validateDataset(data);
}

/**
 * Run evaluation
 */
export async function runEval(
  config: EvalRunConfig,
  searchConfig: SearchConfig
): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // Load dataset
  console.log(`Loading dataset: ${config.datasetPath}`);
  const dataset = loadDataset(config.datasetPath);
  console.log(`Loaded ${dataset.cases.length} eval cases`);

  // Initialize Braintrust
  initLogger({
    apiKey: braintrustEnv.BRAINTRUST_API_KEY,
    projectName: config.braintrustProject,
  });

  // Run eval
  console.log(`Running ${config.tier} eval with ${config.searchMode} mode`);

  const perCaseResults: Array<{
    caseId: string;
    metrics: RetrievalMetrics;
    latencyMs: number;
  }> = [];

  await Eval(config.braintrustProject, {
    data: dataset.cases.map(c => ({
      input: {
        query: c.query,
        mode: config.searchMode,
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
      const response = await searchAPI(
        { query: input.query, mode: input.mode as "fast" | "balanced" | "thorough", limit: 10 },
        searchConfig
      );
      const latencyMs = Date.now() - caseStartTime;

      return {
        results: response.results.map((r, i) => ({
          id: r.externalId,
          score: r.score ?? 0,
          rank: i + 1,
        })),
        latencyMs,
      };
    },
    scores: [
      async (args: any) => {
        const relevant = new Set(args.expected.observationIds as string[]);
        const metrics = computeRetrievalMetrics(
          args.output.results,
          relevant,
          [3, 5, 10],
          args.expected.gradedRelevance
        );

        // Store per-case result
        perCaseResults.push({
          caseId: args.metadata.caseId,
          metrics,
          latencyMs: args.output.latencyMs,
        });

        // Return aggregate score for Braintrust
        return {
          name: "mrr",
          score: metrics.mrr,
        };
      },
    ],
  });

  // Compute aggregate metrics
  const aggregateMetrics: RetrievalMetrics = {
    mrr: perCaseResults.reduce((sum, r) => sum + r.metrics.mrr, 0) / perCaseResults.length,
    recallAtK: {
      3: perCaseResults.reduce((sum, r) => sum + (r.metrics.recallAtK[3] ?? 0), 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + (r.metrics.recallAtK[5] ?? 0), 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + (r.metrics.recallAtK[10] ?? 0), 0) / perCaseResults.length,
    },
    precisionAtK: {
      3: perCaseResults.reduce((sum, r) => sum + (r.metrics.precisionAtK[3] ?? 0), 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + (r.metrics.precisionAtK[5] ?? 0), 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + (r.metrics.precisionAtK[10] ?? 0), 0) / perCaseResults.length,
    },
    ndcgAtK: {
      3: perCaseResults.reduce((sum, r) => sum + (r.metrics.ndcgAtK[3] ?? 0), 0) / perCaseResults.length,
      5: perCaseResults.reduce((sum, r) => sum + (r.metrics.ndcgAtK[5] ?? 0), 0) / perCaseResults.length,
      10: perCaseResults.reduce((sum, r) => sum + (r.metrics.ndcgAtK[10] ?? 0), 0) / perCaseResults.length,
    },
    totalRelevant: perCaseResults.reduce((sum, r) => sum + r.metrics.totalRelevant, 0) / perCaseResults.length,
    totalRetrieved: perCaseResults.reduce((sum, r) => sum + r.metrics.totalRetrieved, 0) / perCaseResults.length,
  };

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const result: EvalRunResult = {
    config,
    aggregateMetrics,
    perCase: perCaseResults,
    braintrustExperimentUrl: "https://www.braintrust.dev/app/...", // TODO: Get from Braintrust SDK
    startedAt,
    completedAt,
    durationMs,
  };

  // Save result to file for comparison
  const resultPath = join(process.cwd(), `eval-result-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\nResult saved to: ${resultPath}`);

  return result;
}
