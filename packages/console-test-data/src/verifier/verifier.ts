/**
 * Test Data Verifier
 *
 * Verifies test data exists in database and Pinecone.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, orgWorkspaces } from "@db/console/schema";
import { eq, count, sql } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";

import type { WorkspaceTarget, VerificationResult } from "../types";

/**
 * Build namespace for workspace
 */
function buildWorkspaceNamespace(clerkOrgId: string, workspaceId: string): string {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Test Data Verifier
 */
export class TestDataVerifier {
  private target: WorkspaceTarget;

  constructor(target: WorkspaceTarget) {
    this.target = target;
  }

  /**
   * Verify test data exists in database and Pinecone
   */
  async verify(): Promise<VerificationResult> {
    const mismatches: string[] = [];

    // Get workspace config
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, this.target.workspaceId),
    });

    if (!workspace) {
      return {
        success: false,
        database: { count: 0, byType: {}, byActor: {}, bySource: {} },
        pinecone: { count: 0, byType: {} },
        mismatches: [`Workspace not found: ${this.target.workspaceId}`],
      };
    }

    // Verify database
    const dbResult = await this.verifyDatabase();

    // Verify Pinecone
    const pineconeResult = workspace.indexName
      ? await this.verifyPinecone(workspace.indexName)
      : { count: 0, byType: {} };

    // Check for mismatches
    if (dbResult.count !== pineconeResult.count) {
      mismatches.push(
        `Count mismatch: DB has ${dbResult.count}, Pinecone has ${pineconeResult.count}`
      );
    }

    return {
      success: mismatches.length === 0,
      database: dbResult,
      pinecone: pineconeResult,
      mismatches,
    };
  }

  /**
   * Verify database records
   */
  async verifyDatabase(): Promise<VerificationResult["database"]> {
    // Total count
    const [countResult] = await db
      .select({ count: count() })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, this.target.workspaceId));

    // Group by observation type
    const typeGroups = await db
      .select({
        type: workspaceNeuralObservations.observationType,
        count: count(),
      })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, this.target.workspaceId))
      .groupBy(workspaceNeuralObservations.observationType);

    // Group by source
    const sourceGroups = await db
      .select({
        source: workspaceNeuralObservations.source,
        count: count(),
      })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, this.target.workspaceId))
      .groupBy(workspaceNeuralObservations.source);

    // Group by actor (using JSON extraction)
    const actorGroups = await db
      .select({
        actor: sql<string>`${workspaceNeuralObservations.actor}->>'name'`,
        count: count(),
      })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, this.target.workspaceId))
      .groupBy(sql`${workspaceNeuralObservations.actor}->>'name'`);

    return {
      count: countResult?.count ?? 0,
      byType: Object.fromEntries(typeGroups.map((g) => [g.type, g.count])),
      byActor: Object.fromEntries(actorGroups.map((g) => [g.actor || "unknown", g.count])),
      bySource: Object.fromEntries(sourceGroups.map((g) => [g.source, g.count])),
    };
  }

  /**
   * Verify Pinecone vectors
   */
  async verifyPinecone(indexName: string): Promise<VerificationResult["pinecone"]> {
    const namespace = buildWorkspaceNamespace(this.target.clerkOrgId, this.target.workspaceId);

    try {
      // Query vectors to check count
      const dummyVector: number[] = Array.from({ length: 1024 }, () => 0.1);
      const queryResult = await consolePineconeClient.query(
        indexName,
        {
          vector: dummyVector,
          topK: 10000, // Get as many as possible
          includeMetadata: true,
          filter: { layer: { $eq: "observations" } },
        },
        namespace
      );

      // Group by observation type
      const byType: Record<string, number> = {};
      for (const match of queryResult.matches) {
        const type = (match.metadata as Record<string, unknown>).observationType as string;
        byType[type] = (byType[type] ?? 0) + 1;
      }

      return {
        count: queryResult.matches.length,
        byType,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Pinecone query failed: ${msg}`);
      return { count: 0, byType: {} };
    }
  }

  /**
   * Print verification report
   */
  async printReport(): Promise<void> {
    const result = await this.verify();

    console.log("=".repeat(60));
    console.log("Test Data Verification Report");
    console.log("=".repeat(60));
    console.log();

    console.log("DATABASE");
    console.log("-".repeat(40));
    console.log(`  Total: ${result.database.count}`);
    console.log(`  By Type:`);
    for (const [type, cnt] of Object.entries(result.database.byType)) {
      console.log(`    - ${type}: ${cnt}`);
    }
    console.log(`  By Actor:`);
    for (const [actor, cnt] of Object.entries(result.database.byActor)) {
      console.log(`    - ${actor}: ${cnt}`);
    }
    console.log(`  By Source:`);
    for (const [source, cnt] of Object.entries(result.database.bySource)) {
      console.log(`    - ${source}: ${cnt}`);
    }
    console.log();

    console.log("PINECONE");
    console.log("-".repeat(40));
    console.log(`  Total: ${result.pinecone.count}`);
    console.log(`  By Type:`);
    for (const [type, cnt] of Object.entries(result.pinecone.byType)) {
      console.log(`    - ${type}: ${cnt}`);
    }
    console.log();

    console.log("STATUS");
    console.log("-".repeat(40));
    if (result.success) {
      console.log("  ✓ Verification passed");
    } else {
      console.log("  ✗ Verification failed");
      for (const mismatch of result.mismatches) {
        console.log(`    - ${mismatch}`);
      }
    }
  }
}

/**
 * Create verifier for a workspace
 */
export function createVerifier(target: WorkspaceTarget): TestDataVerifier {
  return new TestDataVerifier(target);
}
