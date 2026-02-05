#!/usr/bin/env npx tsx
/**
 * Reset Demo Environment
 *
 * Cleans workspace observations, entities, clusters, relationships,
 * and Pinecone vectors, then optionally injects demo dataset.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data reset-demo -- -w <workspaceId> [-i] [--dry-run]
 */

import { sql, eq } from "drizzle-orm";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  workspaceObservationRelationships,
  orgWorkspaces,
} from "@db/console/schema";
import { pineconeClient } from "@repo/console-pinecone";
import { loadDataset } from "../loader/index.js";
import { triggerObservationCapture } from "../trigger/trigger.js";

interface ResetOptions {
  workspaceId: string;
  inject: boolean;
  dryRun: boolean;
}

async function resetDemoEnvironment(options: ResetOptions) {
  const { workspaceId, inject, dryRun } = options;

  console.log(`\n🧹 Resetting demo environment for workspace: ${workspaceId}`);
  if (dryRun) console.log("   (DRY RUN - no changes will be made)\n");

  // Step 1: Count existing data
  const [obsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  const [entityResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));

  const [clusterResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));

  const [relResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceObservationRelationships)
    .where(eq(workspaceObservationRelationships.workspaceId, workspaceId));

  console.log(`📊 Found:`);
  console.log(`   - ${obsResult?.count ?? 0} observations`);
  console.log(`   - ${entityResult?.count ?? 0} entities`);
  console.log(`   - ${clusterResult?.count ?? 0} clusters`);
  console.log(`   - ${relResult?.count ?? 0} relationships`);

  if (dryRun) {
    console.log("\n🔍 Dry run complete. Would delete all of the above + Pinecone vectors.");
    return;
  }

  // Step 2: Get workspace settings for Pinecone
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    console.error(`❌ Workspace not found: ${workspaceId}`);
    process.exit(1);
  }

  // Step 3: Delete Pinecone vectors
  const settings = workspace.settings as { embedding?: { indexName: string; namespaceName: string } } | null;
  if (settings?.embedding) {
    console.log("\n🗑️  Clearing Pinecone vectors...");
    const { indexName, namespaceName } = settings.embedding;
    try {
      await pineconeClient.deleteByMetadata(
        indexName,
        { layer: { $eq: "observations" } },
        namespaceName
      );
      console.log(`   ✓ Cleared vectors from ${indexName}/${namespaceName}`);
    } catch (error) {
      console.log(`   ⚠ Could not clear Pinecone: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Step 4: Delete database records (order matters for FKs)
  console.log("\n🗑️  Clearing database records...");

  // Delete relationships first (FK to observations)
  await db
    .delete(workspaceObservationRelationships)
    .where(eq(workspaceObservationRelationships.workspaceId, workspaceId));
  console.log(`   ✓ Deleted relationships`);

  // Delete entities (FK to observations)
  await db
    .delete(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));
  console.log(`   ✓ Deleted entities`);

  // Delete observations
  await db
    .delete(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));
  console.log(`   ✓ Deleted observations`);

  // Delete clusters
  await db
    .delete(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));
  console.log(`   ✓ Deleted clusters`);

  console.log("\n✅ Cleanup complete!");

  // Step 5: Optionally inject demo data
  if (inject) {
    console.log("\n📥 Injecting demo-incident dataset...");
    const dataset = loadDataset("demo-incident");
    console.log(`   Found ${dataset.events.length} events to inject`);

    const result = await triggerObservationCapture(dataset.events, {
      workspaceId,
      batchSize: 5,
      delayMs: 500,
      onProgress: (completed, total) => {
        process.stdout.write(`\r   Progress: ${completed}/${total} events`);
      },
    });

    console.log(`\n\n✅ Injected ${result.triggered} events in ${result.duration}ms`);
    console.log("\n⏳ Wait 90-120 seconds for Inngest workflows to complete indexing.");
    console.log("   Check status at: http://localhost:8288 (Inngest Dev Server)");
    console.log("\n🎯 Demo ready! Try searching for: 'checkout TypeError'");
  }
}

// CLI parsing
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: ResetOptions = {
    workspaceId: "",
    inject: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] ?? "";
    } else if (arg === "-i" || arg === "--inject") {
      options.inject = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Usage: reset-demo -w <workspaceId> [-i] [--dry-run]

Options:
  -w, --workspace  Workspace ID to reset (required)
  -i, --inject     Inject demo-incident dataset after cleanup
  --dry-run        Show what would be deleted without executing
  -h, --help       Show this help message

Example:
  pnpm --filter @repo/console-test-data reset-demo -- -w ws_abc123 -i
`);
      process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();

if (!options.workspaceId) {
  console.error("Error: --workspace (-w) is required");
  console.error("Run with --help for usage information");
  process.exit(1);
}

resetDemoEnvironment(options).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
