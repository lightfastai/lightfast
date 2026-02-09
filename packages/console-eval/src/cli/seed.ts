import { Command } from "commander";
import { readFileSync } from "node:fs";
import { createDefaultEvalConfig } from "../config/eval-config";
import { seedEvalData } from "../seed/seeder";
import { seedCorpusSchema } from "../schemas";

const program = new Command();

program
  .name("seed")
  .description("Seed eval infrastructure with test data")
  .requiredOption("--run-id <id>", "Unique run identifier")
  .option("--corpus <path>", "Path to corpus JSON", "packages/console-eval/datasets/eval-corpus.json")
  .option("--cache-dir <dir>", "Embedding cache directory", "packages/console-eval/cache")
  .action(async (opts) => {
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
    });

    console.log(`Seeding eval data for run: ${opts.runId}`);
    console.log(`  Workspace: ${config.workspace.workspaceId}`);
    console.log(`  Namespace: ${config.workspace.namespaceName}`);

    // Load and validate corpus
    const corpusJson = readFileSync(opts.corpus, "utf-8");
    const corpus = seedCorpusSchema.parse(JSON.parse(corpusJson));
    console.log(`  Observations: ${corpus.observations.length}`);

    // Seed
    const result = await seedEvalData(config.infra, config.workspace, corpus, {
      embeddingCacheDir: opts.cacheDir,
    });

    console.log("\nSeed complete:");
    console.log(`  Observations inserted: ${result.observationsInserted}`);
    console.log(`  Entities extracted: ${result.entitiesExtracted}`);
    console.log(`  Vectors upserted: ${result.vectorsUpserted}`);
    console.log(`  Duration: ${result.durationMs}ms`);
  });

program.parse();
