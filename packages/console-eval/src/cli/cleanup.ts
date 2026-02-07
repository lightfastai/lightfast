import { Command } from "commander";
import { loadEvalInfraConfig } from "../config/infra";
import { cleanupEvalData } from "../seed/cleanup";

const program = new Command();

program
  .name("cleanup")
  .description("Clean up eval infrastructure (Pinecone namespace + DB records)")
  .requiredOption("--run-id <id>", "Run identifier to clean up")
  .action(async (opts) => {
    const infra = loadEvalInfraConfig();
    const workspace = {
      workspaceId: `eval_ws_${opts.runId}`,
      indexName: "lightfast-v1",
      namespaceName: `eval:run_${opts.runId}`,
      embeddingModel: "embed-english-v3.0",
      embeddingDim: 1024,
      enableClusters: false,
      enableActors: false,
    };

    console.log(`Cleaning up eval run: ${opts.runId}`);
    console.log(`  Workspace: ${workspace.workspaceId}`);
    console.log(`  Namespace: ${workspace.namespaceName}`);

    await cleanupEvalData(infra, workspace);
    console.log("Cleanup complete.");
  });

program.parse();
