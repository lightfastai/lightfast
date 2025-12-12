#!/usr/bin/env npx tsx
/**
 * Test Data Verification CLI
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data verify -- --workspace <id> --org <clerkOrgId>
 */

import { TestDataVerifier } from "../verifier/verifier";

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

Usage:
  pnpm --filter @repo/console-test-data verify -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID

Options:
  --help, -h        Show this help message

Example:
  pnpm verify -- -w meh25w1hzinweyqrouqil -o org_35ztOhqBmqSScw67JwBYwlg2L51
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

  if (!workspaceId || !clerkOrgId) {
    console.error("Error: --workspace and --org are required");
    showHelp();
    process.exit(1);
  }

  const verifier = new TestDataVerifier({ workspaceId, clerkOrgId });
  await verifier.printReport();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
