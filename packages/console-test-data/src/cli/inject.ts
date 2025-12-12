#!/usr/bin/env npx tsx
/**
 * Test Data Injection CLI
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data inject -- --workspace <id> --org <clerkOrgId> [options]
 *
 * Options:
 *   --workspace, -w   Workspace ID (required)
 *   --org, -o         Clerk Org ID (required)
 *   --scenario, -s    Scenario name: day2, stress-small, stress-medium, stress-large
 *   --count, -c       Number of observations (for custom scenarios)
 *   --dry-run         Preview without inserting
 *   --clear           Clear existing data before injection
 *   --help, -h        Show help
 */

import { TestDataInjector } from "../injector/injector";
import { ObservationFactory } from "../factories/observation-factory";
import { scenarios } from "../scenarios";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--clear") {
      parsed.clear = true;
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
  console.log(`
Test Data Injection CLI

Usage:
  pnpm --filter @repo/console-test-data inject -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID

Options:
  --scenario, -s    Scenario name (default: day2)
                    - day2: 20 observations for retrieval testing
                    - stress-small: 100 observations
                    - stress-medium: 500 observations
                    - stress-large: 1000 observations
                    - balanced: Custom balanced set (use --count)
  --count, -c       Number of observations (for balanced scenario)
  --dry-run         Preview without inserting data
  --clear           Clear existing data before injection
  --help, -h        Show this help message

Examples:
  # Inject Day 2 retrieval test data
  pnpm inject -- -w meh25w1hzinweyqrouqil -o org_35ztOhqBmqSScw67JwBYwlg2L51

  # Inject 500 balanced observations
  pnpm inject -- -w <id> -o <orgId> -s balanced -c 500

  # Dry run to preview
  pnpm inject -- -w <id> -o <orgId> --dry-run
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
  const scenarioName = (args.scenario ?? args.s ?? "day2") as string;
  const count = parseInt((args.count ?? args.c ?? "20") as string, 10);
  const dryRun = !!args.dryRun;
  const clear = !!args.clear;

  if (!workspaceId || !clerkOrgId) {
    console.error("Error: --workspace and --org are required");
    showHelp();
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Test Data Injection");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Org: ${clerkOrgId}`);
  console.log(`  Scenario: ${scenarioName}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Clear Existing: ${clear}`);
  console.log();

  // Select scenario
  let scenario;
  switch (scenarioName) {
    case "day2":
      scenario = scenarios.day2Retrieval;
      break;
    case "stress-small":
      scenario = scenarios.stressSmall;
      break;
    case "stress-medium":
      scenario = scenarios.stressMedium;
      break;
    case "stress-large":
      scenario = scenarios.stressLarge;
      break;
    case "balanced":
      scenario = {
        name: `Balanced (${count})`,
        description: `Custom balanced set with ${count} observations`,
        observations: new ObservationFactory().balanced(count).buildShuffled(),
        expectedResults: [],
      };
      break;
    default:
      console.error(`Unknown scenario: ${scenarioName}`);
      process.exit(1);
  }

  console.log(`Scenario: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Observations: ${scenario.observations.length}`);
  console.log();

  // Inject
  const injector = new TestDataInjector({ workspaceId, clerkOrgId });
  const result = await injector.injectScenario(scenario, {
    dryRun,
    clearExisting: clear,
    onProgress: (current, total, obs) => {
      process.stdout.write(`\r  [${current}/${total}] ${obs.title.slice(0, 50)}...`);
    },
  });

  console.log("\n");
  console.log("=".repeat(60));
  console.log("Result");
  console.log("=".repeat(60));
  console.log(`  Success: ${result.success}`);
  console.log(`  Observations: ${result.observationsCreated}`);
  console.log(`  Vectors: ${result.vectorsUpserted}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Namespace: ${result.namespace}`);

  if (result.errors.length > 0) {
    console.log(`  Errors:`);
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
