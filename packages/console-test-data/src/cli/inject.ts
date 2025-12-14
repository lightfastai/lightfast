#!/usr/bin/env npx tsx
/**
 * Test Data Injection CLI
 *
 * Injects JSON dataset events via Inngest workflow.
 *
 * Usage:
 *   pnpm inject -- --workspace <id> --org <clerkOrgId> --index <name> [options]
 */

import { loadDataset, listDatasets, balancedScenario, stressScenario } from "../loader";
import { triggerObservationCapture } from "../trigger/trigger";
import { waitForCapture } from "../trigger/wait";
import { verify, printReport } from "../verifier/verifier";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--skip-wait") {
      parsed.skipWait = true;
    } else if (arg === "--skip-verify") {
      parsed.skipVerify = true;
    } else if (arg.startsWith("--") || arg.startsWith("-")) {
      const key = arg.replace(/^-+/, "");
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

function showHelp() {
  const datasets = listDatasets();
  console.log(`
Test Data Injection CLI

Usage:
  pnpm inject -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID
  --index, -i       Pinecone index name

Options:
  --scenario, -s    Dataset name or path (default: security)
                    Available: ${datasets.join(", ")}, balanced, stress
  --count, -c       Event count for balanced/stress (default: 6)
  --skip-wait       Don't wait for workflow completion
  --skip-verify     Don't run verification
  --help, -h        Show this help

Examples:
  pnpm inject -- -w <id> -o <orgId> -i <index>
  pnpm inject -- -w <id> -o <orgId> -i <index> -s performance
  pnpm inject -- -w <id> -o <orgId> -i <index> -s balanced -c 10
  pnpm inject -- -w <id> -o <orgId> -i <index> -s /path/to/custom.json
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const workspaceId = (args.workspace ?? args.w) as string;
  const clerkOrgId = (args.org ?? args.o) as string;
  const indexName = (args.index ?? args.i) as string;
  const scenarioName = (args.scenario ?? args.s ?? "security") as string;
  const count = parseInt((args.count ?? args.c ?? "6") as string, 10);
  const skipWait = !!args.skipWait;
  const skipVerify = !!args.skipVerify;

  if (!workspaceId || !clerkOrgId || !indexName) {
    console.error("Error: --workspace, --org, and --index are required");
    showHelp();
    process.exit(1);
  }

  // Load events based on scenario
  const events =
    scenarioName === "stress"
      ? stressScenario(count)
      : scenarioName === "balanced"
        ? balancedScenario(count)
        : loadDataset(scenarioName).events;

  console.log("=".repeat(60));
  console.log("Test Data Injection");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Org: ${clerkOrgId}`);
  console.log(`  Index: ${indexName}`);
  console.log(`  Scenario: ${scenarioName}`);
  console.log(`  Events: ${events.length}`);
  console.log();

  console.log(`Triggering ${events.length} events via Inngest workflow...\n`);

  const triggerResult = await triggerObservationCapture(events, {
    workspaceId,
    onProgress: (current, total) => {
      process.stdout.write(`\rTriggered: ${current}/${total}`);
    },
  });

  console.log(`\n\nTriggered ${triggerResult.triggered} events in ${triggerResult.duration}ms`);

  if (!skipWait) {
    console.log("\nWaiting for workflow completion...");
    const waitResult = await waitForCapture({
      workspaceId,
      sourceIds: triggerResult.sourceIds,
      timeoutMs: 120000,
    });

    console.log(`Completed: ${waitResult.completed}/${triggerResult.triggered}`);
    if (waitResult.pending > 0) {
      console.log(`Pending/Filtered: ${waitResult.pending}`);
    }
    if (waitResult.timedOut) {
      console.log("Warning: Wait timed out");
    }
  }

  if (!skipVerify) {
    console.log("\nVerifying results...");
    const verifyResult = await verify({ workspaceId, clerkOrgId, indexName });
    printReport(verifyResult);

    const allHealthy =
      verifyResult.health.multiViewComplete &&
      verifyResult.health.entitiesExtracted &&
      verifyResult.health.clustersAssigned;

    if (!allHealthy) {
      console.log("Warning: Some health checks failed");
    }
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
