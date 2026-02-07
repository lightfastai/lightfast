#!/usr/bin/env node

import { Command } from "commander";
import { runEval } from "../eval/runner";
import { join } from "node:path";

const program = new Command();

program
  .name("eval")
  .description("Run AI evaluation pipeline")
  .option("-d, --dataset <path>", "Path to dataset JSON", "src/datasets/golden-v1.json")
  .option("-t, --tier <tier>", "Eval tier: retrieval, rag, full", "retrieval")
  .option("-m, --mode <mode>", "Search mode: fast, balanced, thorough", "balanced")
  .option("-c, --concurrency <num>", "Max concurrency", "5")
  .option("-p, --project <name>", "Braintrust project name", "lightfast-console-eval")
  .option("-e, --experiment <name>", "Experiment name", `eval-${new Date().toISOString()}`)
  .action(async (options) => {
    const EVAL_WORKSPACE_ID = process.env.EVAL_WORKSPACE_ID;
    const EVAL_API_KEY = process.env.EVAL_API_KEY;
    const CONSOLE_API_URL = process.env.CONSOLE_API_URL ?? "http://localhost:3024";

    if (!EVAL_WORKSPACE_ID || !EVAL_API_KEY) {
      console.error("Error: EVAL_WORKSPACE_ID and EVAL_API_KEY must be set");
      process.exit(1);
    }

    const datasetPath = join(process.cwd(), options.dataset);

    const result = await runEval(
      {
        datasetPath,
        tier: options.tier,
        searchMode: options.mode,
        maxConcurrency: Number.parseInt(options.concurrency),
        braintrustProject: options.project,
        experimentName: options.experiment,
      },
      {
        apiUrl: CONSOLE_API_URL,
        apiKey: EVAL_API_KEY,
        workspaceId: EVAL_WORKSPACE_ID,
      }
    );

    console.log("\n=== Eval Results ===");
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Cases: ${result.perCase.length}`);
    console.log("\nAggregate Metrics:");
    console.log(`  MRR: ${result.aggregateMetrics.mrr.toFixed(3)}`);
    console.log(`  Recall@5: ${(result.aggregateMetrics.recallAtK[5] ?? 0).toFixed(3)}`);
    console.log(`  Recall@10: ${(result.aggregateMetrics.recallAtK[10] ?? 0).toFixed(3)}`);
    console.log(`  Precision@5: ${(result.aggregateMetrics.precisionAtK[5] ?? 0).toFixed(3)}`);
    console.log(`  NDCG@5: ${(result.aggregateMetrics.ndcgAtK[5] ?? 0).toFixed(3)}`);
    console.log(`\nBraintrust: ${result.braintrustExperimentUrl}`);
  });

program.parse();
