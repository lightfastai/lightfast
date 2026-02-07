#!/usr/bin/env npx tsx
/**
 * Pinecone ExternalId Reconciliation Script
 *
 * Fixes mismatched observationId values in Pinecone vectors caused by the
 * replay-safety bug where nanoid() was generated outside step.run().
 *
 * Usage:
 *   pnpm with-env tsx src/cli/reconcile-pinecone-external-ids.ts --workspace <id>
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, orgWorkspaces } from "@db/console/schema";
import { consolePineconeClient } from "@repo/console-pinecone";
import { eq } from "drizzle-orm";

interface MismatchRecord {
  observationId: number;
  externalId: string;
  vectorId: string;
  pineconeObservationId: string;
  view: "title" | "content" | "summary";
}

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
  console.log(`
Pinecone ExternalId Reconciliation

Fixes mismatched observationId values in Pinecone vectors caused by
Inngest replay-safety bug (nanoid() generated outside step.run()).

Usage:
  pnpm with-env tsx src/cli/reconcile-pinecone-external-ids.ts [options]

Required:
  --workspace, -w   Workspace ID

Options:
  --dry-run         Show mismatches without fixing
  --help, -h        Show this help

Examples:
  pnpm with-env tsx src/cli/reconcile-pinecone-external-ids.ts -w <workspaceId>
  pnpm with-env tsx src/cli/reconcile-pinecone-external-ids.ts -w <workspaceId> --dry-run
`);
}

async function reconcile(workspaceId: string, dryRun: boolean) {
  // Fetch workspace settings
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const indexName = workspace.settings.embedding.indexName;
  const namespace = workspace.settings.embedding.namespaceName;

  console.log("=".repeat(60));
  console.log("Pinecone ExternalId Reconciliation");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Index: ${indexName}`);
  console.log(`  Namespace: ${namespace}`);
  console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE FIX"}`);
  console.log();

  // Fetch all observations from DB
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      externalId: workspaceNeuralObservations.externalId,
      embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
      embeddingContentId: workspaceNeuralObservations.embeddingContentId,
      embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
    })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  console.log(`Found ${observations.length} observations to check\n`);

  const mismatches: MismatchRecord[] = [];
  const batchSize = 100;

  // Check all observations in batches
  for (let i = 0; i < observations.length; i += batchSize) {
    const batch = observations.slice(i, i + batchSize);
    const vectorIds = batch.flatMap((obs) =>
      [obs.embeddingTitleId, obs.embeddingContentId, obs.embeddingSummaryId].filter(Boolean)
    ) as string[];

    if (vectorIds.length === 0) continue;

    // Fetch vectors from Pinecone
    const fetchResult = await consolePineconeClient.fetchVectors(indexName, vectorIds, namespace);

    for (const obs of batch) {
      const views = [
        { id: obs.embeddingTitleId, view: "title" as const },
        { id: obs.embeddingContentId, view: "content" as const },
        { id: obs.embeddingSummaryId, view: "summary" as const },
      ];

      for (const { id: vectorId, view } of views) {
        if (!vectorId) continue;
        const record = fetchResult.records[vectorId];
        if (!record?.metadata) continue;

        const pineconeObsId = (record.metadata as Record<string, unknown>).observationId as
          | string
          | undefined;
        if (pineconeObsId && pineconeObsId !== obs.externalId) {
          mismatches.push({
            observationId: obs.id,
            externalId: obs.externalId,
            vectorId,
            pineconeObservationId: pineconeObsId,
            view,
          });
        }
      }
    }

    const progress = Math.min(i + batchSize, observations.length);
    console.log(
      `Checked ${progress}/${observations.length} observations, found ${mismatches.length} mismatches`
    );
  }

  if (mismatches.length === 0) {
    console.log("\n✅ No mismatches found! All observationIds match.");
    return;
  }

  console.log(`\n⚠️  Found ${mismatches.length} mismatches:`);
  console.log();

  // Show sample mismatches
  const sampleSize = Math.min(5, mismatches.length);
  for (let i = 0; i < sampleSize; i++) {
    const m = mismatches[i]!;
    console.log(`  ${m.vectorId} (${m.view})`);
    console.log(`    Pinecone: ${m.pineconeObservationId}`);
    console.log(`    DB:       ${m.externalId}`);
    console.log();
  }

  if (mismatches.length > sampleSize) {
    console.log(`  ... and ${mismatches.length - sampleSize} more\n`);
  }

  if (dryRun) {
    console.log("DRY RUN: No changes made. Run without --dry-run to fix.");
    return;
  }

  // Fix mismatches by updating Pinecone metadata
  console.log("Fixing mismatches...\n");
  let fixed = 0;

  for (const mismatch of mismatches) {
    try {
      // Fetch the current vector to get existing metadata
      const fetchResult = await consolePineconeClient.fetchVectors(
        indexName,
        [mismatch.vectorId],
        namespace
      );

      const existing = fetchResult.records[mismatch.vectorId];
      if (!existing?.metadata) {
        console.warn(`  ⚠️  Vector not found: ${mismatch.vectorId}`);
        continue;
      }

      // Update with corrected observationId
      await consolePineconeClient.updateVectorMetadata(
        indexName,
        {
          id: mismatch.vectorId,
          metadata: {
            ...existing.metadata,
            observationId: mismatch.externalId,
          },
        },
        namespace
      );

      fixed++;
      console.log(
        `  ✓ Fixed: ${mismatch.vectorId} (${mismatch.view}) ${mismatch.pineconeObservationId} → ${mismatch.externalId}`
      );
    } catch (error) {
      console.error(`  ✗ Failed to fix ${mismatch.vectorId}:`, error);
    }
  }

  console.log(`\n✅ Reconciliation complete. Fixed ${fixed}/${mismatches.length} vectors.`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const workspaceId = (args.workspace ?? args.w) as string;
  const dryRun = !!args["dry-run"];

  if (!workspaceId) {
    console.error("Error: --workspace is required");
    showHelp();
    process.exit(1);
  }

  await reconcile(workspaceId, dryRun);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
