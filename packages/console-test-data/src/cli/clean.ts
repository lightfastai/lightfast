#!/usr/bin/env npx tsx
/**
 * Test Data Cleanup CLI
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data clean -- --workspace <id> --org <clerkOrgId>
 */

import { TestDataInjector } from "../injector/injector";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--confirm") {
      parsed.confirm = true;
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
Test Data Cleanup CLI

Usage:
  pnpm --filter @repo/console-test-data clean -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID
  --confirm         Confirm deletion (required for safety)

Options:
  --prefix, -p      Source ID prefix to clean (default: "test")
  --help, -h        Show this help message

Example:
  pnpm clean -- -w meh25w1hzinweyqrouqil -o org_35ztOhqBmqSScw67JwBYwlg2L51 --confirm
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
  const prefix = (args.prefix ?? args.p ?? "test") as string;
  const confirm = !!args.confirm;

  if (!workspaceId || !clerkOrgId) {
    console.error("Error: --workspace and --org are required");
    showHelp();
    process.exit(1);
  }

  if (!confirm) {
    console.error("Error: --confirm flag required for safety");
    console.log("This will delete all test data from the workspace.");
    console.log("Add --confirm to proceed.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Test Data Cleanup");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Org: ${clerkOrgId}`);
  console.log(`  Prefix: ${prefix}`);
  console.log();

  const injector = new TestDataInjector({ workspaceId, clerkOrgId });
  await injector.clearTestData(prefix);

  console.log("Done! Test data cleared.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
