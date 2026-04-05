#!/usr/bin/env npx tsx

/**
 * Reset Demo Environment
 *
 * Cleans org events, entities, edges, and optionally injects demo dataset.
 *
 * Usage:
 *   pnpm --filter @repo/app-test-data reset-demo -- -o <clerkOrgId> [-i] [--dry-run]
 */

import { parseArgs as nodeParseArgs } from "node:util";
import { db } from "@db/app/client";
import { orgEntities, orgEntityEdges, orgEvents } from "@db/app/schema";
import { eq, sql } from "drizzle-orm";
import { loadDataset } from "../loader/index.js";
import { triggerEventCapture } from "../trigger/trigger.js";

interface ResetOptions {
  clerkOrgId: string;
  dryRun: boolean;
  inject: boolean;
}

async function resetDemoEnvironment(options: ResetOptions) {
  const { clerkOrgId, inject, dryRun } = options;

  console.log(`\n🧹 Resetting demo environment for org: ${clerkOrgId}`);
  if (dryRun) {
    console.log("   (DRY RUN - no changes will be made)\n");
  }

  // Step 1: Count existing data
  const [obsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgEvents)
    .where(eq(orgEvents.clerkOrgId, clerkOrgId));

  const [entityResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgEntities)
    .where(eq(orgEntities.clerkOrgId, clerkOrgId));

  const [edgeResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgEntityEdges)
    .where(eq(orgEntityEdges.clerkOrgId, clerkOrgId));

  console.log("📊 Found:");
  console.log(`   - ${obsResult?.count ?? 0} observations`);
  console.log(`   - ${entityResult?.count ?? 0} entities`);
  console.log(`   - ${edgeResult?.count ?? 0} edges`);

  if (dryRun) {
    console.log(
      "\n🔍 Dry run complete. Would delete all of the above + Pinecone vectors."
    );
    return;
  }

  // Step 2: Delete database records (order matters for FKs)
  console.log("\n🗑️  Clearing database records...");

  // Delete entity edges first (FK to entities)
  await db
    .delete(orgEntityEdges)
    .where(eq(orgEntityEdges.clerkOrgId, clerkOrgId));
  console.log("   ✓ Deleted edges");

  // Delete entities
  await db.delete(orgEntities).where(eq(orgEntities.clerkOrgId, clerkOrgId));
  console.log("   ✓ Deleted entities");

  // Delete observations
  await db.delete(orgEvents).where(eq(orgEvents.clerkOrgId, clerkOrgId));
  console.log("   ✓ Deleted observations");

  console.log("\n✅ Cleanup complete!");

  // Step 3: Optionally inject demo data
  if (inject) {
    console.log("\n📥 Injecting sandbox-1 dataset...");
    const dataset = loadDataset("sandbox-1");
    console.log(`   Found ${dataset.events.length} events to inject`);

    const result = await triggerEventCapture(dataset.events, {
      clerkOrgId,
      batchSize: 5,
      delayMs: 500,
      onProgress: (completed, total) => {
        process.stdout.write(`\r   Progress: ${completed}/${total} events`);
      },
    });

    console.log(
      `\n\n✅ Injected ${result.triggered} events in ${result.duration}ms`
    );
    console.log(
      "\n⏳ Wait 90-120 seconds for Inngest workflows to complete indexing."
    );
    console.log(
      "   Check status at: http://localhost:8288 (Inngest Dev Server)"
    );
    console.log(
      "\n🎯 Demo ready! Try searching for: 'Pinecone dimension mismatch'"
    );
  }
}

// CLI parsing
function parseArgs(): ResetOptions {
  const { values } = nodeParseArgs({
    args: process.argv.slice(2),
    options: {
      org: { type: "string", short: "o" },
      inject: { type: "boolean", short: "i", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`
Usage: reset-demo -o <clerkOrgId> [-i] [--dry-run]

Options:
  -o, --org        Clerk Org ID to reset (required)
  -i, --inject     Inject sandbox-1 dataset after cleanup
  --dry-run        Show what would be deleted without executing
  -h, --help       Show this help message

Example:
  pnpm --filter @repo/app-test-data reset-demo -- -o org_abc123 -i
`);
    process.exit(0);
  }

  return {
    clerkOrgId: (values.org as string) ?? "",
    inject: (values.inject as boolean) ?? false,
    dryRun: (values["dry-run"] as boolean) ?? false,
  };
}

const options = parseArgs();

if (!options.clerkOrgId) {
  console.error("Error: --org (-o) is required");
  console.error("Run with --help for usage information");
  process.exit(1);
}

resetDemoEnvironment(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
