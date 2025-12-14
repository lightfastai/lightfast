#!/usr/bin/env npx tsx
/**
 * Test Data Injection CLI (Workflow-Driven)
 *
 * Triggers real Inngest workflow to process test data through production pipeline.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data inject -- --workspace <id> --org <clerkOrgId> --index <name> [options]
 *
 * Options:
 *   --workspace, -w   Workspace ID (required)
 *   --org, -o         Clerk Org ID (required)
 *   --index, -i       Pinecone index name (required)
 *   --scenario, -s    Scenario name: day2, balanced, stress (default: day2)
 *   --count, -c       Event count for balanced/stress scenarios
 *   --skip-wait       Don't wait for workflow completion
 *   --skip-verify     Don't run verification after injection
 *   --help, -h        Show help
 */

import { securityScenario, performanceScenario, balancedScenario, stressScenario } from "../scenarios";
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
  console.log(`
Test Data Injection CLI (Workflow-Driven)

Triggers real Inngest workflow to process test data through production pipeline.
This ensures tests exercise significance scoring, entity extraction, multi-view
embeddings, cluster assignment, and actor resolution.

Usage:
  pnpm --filter @repo/console-test-data inject -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID
  --index, -i       Pinecone index name

Options:
  --scenario, -s    Scenario name (default: security)
                    - security: Security-focused events (3 events)
                    - performance: Performance-focused events (3 events)
                    - balanced: Mixed set from all scenarios (use --count)
                    - stress: High volume test (use --count)
  --count, -c       Event count for balanced/stress scenarios (default: 6)
  --skip-wait       Don't wait for workflow completion
  --skip-verify     Don't run verification after injection
  --help, -h        Show this help message

Examples:
  # Inject security scenario (3 events)
  pnpm inject -- -w <id> -o <orgId> -i <indexName>

  # Inject performance scenario
  pnpm inject -- -w <id> -o <orgId> -i <indexName> -s performance

  # Inject balanced mix of events
  pnpm inject -- -w <id> -o <orgId> -i <indexName> -s balanced -c 6

  # Stress test with 100 events
  pnpm inject -- -w <id> -o <orgId> -i <indexName> -s stress -c 100 --skip-verify
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

  // Select scenario and get events
  const events =
    scenarioName === "security"
      ? securityScenario()
      : scenarioName === "performance"
        ? performanceScenario()
        : scenarioName === "stress"
          ? stressScenario(count)
          : balancedScenario(count);

  console.log("=".repeat(60));
  console.log("Test Data Injection (Workflow Mode)");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Org: ${clerkOrgId}`);
  console.log(`  Index: ${indexName}`);
  console.log(`  Scenario: ${scenarioName}`);
  console.log(`  Events: ${events.length}`);
  console.log();

  console.log(`Triggering ${events.length} events via Inngest workflow...\n`);

  // Trigger events
  const triggerResult = await triggerObservationCapture(events, {
    workspaceId,
    onProgress: (current, total) => {
      process.stdout.write(`\rTriggered: ${current}/${total}`);
    },
  });

  console.log(`\n\nTriggered ${triggerResult.triggered} events in ${triggerResult.duration}ms`);

  // Wait for completion
  if (!skipWait) {
    console.log("\nWaiting for workflow completion...");
    const waitResult = await waitForCapture({
      workspaceId,
      sourceIds: triggerResult.sourceIds,
      timeoutMs: 120000, // 2 minutes
    });

    console.log(`Completed: ${waitResult.completed}/${triggerResult.triggered}`);
    if (waitResult.pending > 0) {
      console.log(
        `Pending/Filtered: ${waitResult.pending} (some may be below significance threshold)`
      );
    }
    if (waitResult.timedOut) {
      console.log("Warning: Wait timed out, some events may still be processing");
    }
  }

  // Verify results
  if (!skipVerify) {
    console.log("\nVerifying results...");
    const verifyResult = await verify({ workspaceId, clerkOrgId, indexName });
    printReport(verifyResult);

    // Exit with error if health checks fail
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
