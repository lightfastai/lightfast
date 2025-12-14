#!/usr/bin/env npx tsx
/**
 * Test Data Verification CLI
 *
 * Verifies test data was processed correctly by checking database state
 * and Pinecone vector counts.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data verify -- --workspace <id> --org <clerkOrgId> --index <name>
 */

import { verify, printReport } from "../verifier/verifier";

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
      }
    }
  }

  return parsed;
}

function showHelp() {
  console.log(`
Test Data Verification CLI

Verifies test data was processed correctly by the workflow. Checks:
- Observations in database
- Entities extracted
- Clusters assigned
- Multi-view embeddings in Pinecone
- Actor profiles resolved

Usage:
  pnpm --filter @repo/console-test-data verify -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID
  --index, -i       Pinecone index name

Options:
  --help, -h        Show this help message

Examples:
  pnpm verify -- -w <id> -o <orgId> -i <indexName>
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

  if (!workspaceId || !clerkOrgId || !indexName) {
    console.error("Error: --workspace, --org, and --index are required");
    showHelp();
    process.exit(1);
  }

  const result = await verify({ workspaceId, clerkOrgId, indexName });
  printReport(result);

  // Exit with error code if health checks fail
  const allHealthy =
    result.health.multiViewComplete &&
    result.health.entitiesExtracted &&
    result.health.clustersAssigned;

  if (!allHealthy && result.database.observations > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
