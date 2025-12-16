#!/usr/bin/env npx tsx
/**
 * Test Data Injection CLI
 *
 * Injects JSON dataset events via Inngest workflow.
 *
 * Usage:
 *   pnpm inject -- --workspace <id> [options]
 */

import { loadDataset, listDatasets, balancedScenario, stressScenario } from "../loader";
import { triggerObservationCapture } from "../trigger/trigger";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
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

Options:
  --scenario, -s    Dataset name or path (default: security)
                    Available: ${datasets.join(", ")}, balanced, stress
  --count, -c       Event count for balanced/stress (default: 6)
  --help, -h        Show this help

Examples:
  pnpm inject -- -w <workspaceId>
  pnpm inject -- -w <workspaceId> -s performance
  pnpm inject -- -w <workspaceId> -s balanced -c 10
  pnpm inject -- -w <workspaceId> -s /path/to/custom.json
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const workspaceId = (args.workspace ?? args.w) as string;
  const scenarioName = (args.scenario ?? args.s ?? "security") as string;
  const count = parseInt((args.count ?? args.c ?? "6") as string, 10);

  if (!workspaceId) {
    console.error("Error: --workspace is required");
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
  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
