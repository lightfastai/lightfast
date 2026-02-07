import { Command } from "commander";
import { createDefaultEvalConfig } from "../config/eval-config";
import { runEvalInProcess } from "../runner/in-process";

const program = new Command();

program
  .name("eval-local")
  .description("Run evaluation in-process using direct searchLogic() invocation")
  .requiredOption("--run-id <id>", "Unique run identifier (must match seeded data)")
  .option("--dataset <path>", "Path to dataset JSON", "packages/console-eval/datasets/eval-dataset.json")
  .option("-m, --mode <mode>", "Search mode", "balanced")
  .option("-c, --concurrency <n>", "Max concurrency", "4")
  .option("--k-values <values>", "K values for @K metrics (comma-separated)", "3,5,10")
  .action(async (opts) => {
    const kValues = opts.kValues.split(",").map(Number);

    const config = createDefaultEvalConfig({
      runId: opts.runId,
      workspace: {
        workspaceId: `eval_ws_${opts.runId}`,
        indexName: "lightfast-v1",
        namespaceName: `eval:run_${opts.runId}`,
        embeddingModel: "embed-english-v3.0",
        embeddingDim: 1024,
        enableClusters: false,
        enableActors: false,
      },
      execution: {
        searchMode: opts.mode,
        maxConcurrency: parseInt(opts.concurrency, 10),
        timeout: 30_000,
        kValues,
      },
      dataset: {
        casesPath: opts.dataset,
        corpusPath: "packages/console-eval/datasets/eval-corpus.json",
        embeddingCachePath: "packages/console-eval/cache/",
      },
    });

    console.log(`Running in-process eval for run: ${opts.runId}`);
    console.log(`  Workspace: ${config.workspace.workspaceId}`);
    console.log(`  Namespace: ${config.workspace.namespaceName}`);
    console.log(`  Mode: ${config.execution.searchMode}`);
    console.log(`  Dataset: ${config.dataset.casesPath}`);

    await runEvalInProcess(config);
  });

program.parse();
