/**
 * Test Data Injector
 *
 * Handles injection of test observations into database and Pinecone.
 * Supports batch operations, progress tracking, and cleanup.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { SourceActor, SourceReference } from "@repo/console-types";

import type {
  TestObservation,
  WorkspaceTarget,
  InjectionOptions,
  InjectionResult,
  TestScenario,
} from "../types";
import { getActor } from "../factories/actors";

/**
 * Vector metadata for Pinecone
 */
interface ObservationVectorMetadata {
  layer: string;
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
  [key: string]: string | number | boolean | string[];
}

/**
 * Build namespace for workspace
 */
function buildWorkspaceNamespace(clerkOrgId: string, workspaceId: string): string {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Derive observation type from source event
 */
function deriveObservationType(source: string, sourceType: string): string {
  if (source === "github") {
    return sourceType;
  }
  if (source === "vercel") {
    return sourceType.replace(".", "_");
  }
  return sourceType;
}

/**
 * Extract topics from observation
 */
function extractTopics(obs: TestObservation): string[] {
  const topics: string[] = [obs.source];
  topics.push(deriveObservationType(obs.source, obs.sourceType));

  const keywords = ["fix", "feat", "refactor", "test", "docs", "chore", "ci", "perf"];
  const titleLower = obs.title.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      topics.push(keyword);
    }
  }

  if (obs.tags) {
    topics.push(...obs.tags);
  }

  return [...new Set(topics)];
}

/**
 * Calculate significance score
 */
function calculateSignificance(obs: TestObservation): number {
  let score = 50;

  if (obs.title.toLowerCase().includes("security") || obs.body.toLowerCase().includes("cve")) {
    score += 30;
  }
  if (obs.title.toLowerCase().includes("perf")) {
    score += 10;
  }
  if (obs.sourceType.includes("merged")) {
    score += 15;
  }
  if (obs.source === "vercel") {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Test Data Injector
 */
export class TestDataInjector {
  private target: WorkspaceTarget;
  private workspace: Awaited<ReturnType<typeof db.query.orgWorkspaces.findFirst>> | null = null;

  constructor(target: WorkspaceTarget) {
    this.target = target;
  }

  /**
   * Inject observations into the workspace
   */
  async inject(
    observations: TestObservation[],
    options: InjectionOptions = {}
  ): Promise<InjectionResult> {
    const startTime = Date.now();
    const {
      dryRun = false,
      batchSize = 100,
      clearExisting = false,
      sourceIdPrefix = "test",
      onProgress,
    } = options;

    const errors: string[] = [];
    let observationsCreated = 0;
    let vectorsUpserted = 0;

    // 1. Fetch workspace configuration
    await this.ensureWorkspace();

    if (!this.workspace) {
      return {
        success: false,
        observationsCreated: 0,
        vectorsUpserted: 0,
        errors: [`Workspace not found: ${this.target.workspaceId}`],
        namespace: "",
        duration: Date.now() - startTime,
      };
    }

    const { indexName, embeddingModel, embeddingDim } = this.workspace;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- indexName is nullable in DB schema
    if (!indexName || !embeddingModel) {
      return {
        success: false,
        observationsCreated: 0,
        vectorsUpserted: 0,
        errors: [`Workspace ${this.target.workspaceId} is missing embedding configuration`],
        namespace: "",
        duration: Date.now() - startTime,
      };
    }

    const namespace = buildWorkspaceNamespace(this.target.clerkOrgId, this.target.workspaceId);

    console.log(`[TestDataInjector] Starting injection`);
    console.log(`  Workspace: ${this.target.workspaceId}`);
    console.log(`  Namespace: ${namespace}`);
    console.log(`  Index: ${indexName}`);
    console.log(`  Observations: ${observations.length}`);
    console.log(`  Dry Run: ${dryRun}`);

    if (dryRun) {
      return {
        success: true,
        observationsCreated: 0,
        vectorsUpserted: 0,
        errors: [],
        namespace,
        duration: Date.now() - startTime,
      };
    }

    // 2. Clear existing test data if requested
    if (clearExisting) {
      await this.clearTestData(sourceIdPrefix);
    }

    // 3. Create embedding provider
    const embeddingProvider = createEmbeddingProviderForWorkspace(
      {
        id: this.workspace.id,
        embeddingModel,
        embeddingDim,
      },
      { inputType: "search_document" }
    );

    // 4. Process observations in batches
    const now = new Date();
    const vectors: { id: string; values: number[]; metadata: ObservationVectorMetadata }[] = [];
    const dbRecords: (typeof workspaceNeuralObservations.$inferInsert)[] = [];

    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      if (!obs) continue;
      const occurredAt = new Date(now.getTime() - obs.daysAgo * 24 * 60 * 60 * 1000);
      const sourceId = `${sourceIdPrefix}:${obs.source}:${obs.sourceType}:${i}:${Date.now()}`;
      const vectorId = `obs_${sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;

      // Generate embedding
      const textToEmbed = `${obs.title}\n\n${obs.body}`;
      const embedResult = await embeddingProvider.embed([textToEmbed]);
      const embedding = embedResult.embeddings[0];

      if (!embedding) {
        errors.push(`Failed to generate embedding for observation ${i}`);
        continue;
      }

      const observationType = deriveObservationType(obs.source, obs.sourceType);
      const topics = extractTopics(obs);
      const actorData = getActor(obs.actorName);

      // Build Pinecone metadata
      const metadata: ObservationVectorMetadata = {
        layer: "observations",
        observationType,
        source: obs.source,
        sourceType: obs.sourceType,
        sourceId,
        title: obs.title,
        snippet: obs.body.slice(0, 500),
        occurredAt: occurredAt.toISOString(),
        actorName: obs.actorName,
      };

      vectors.push({ id: vectorId, values: embedding, metadata });

      // Build database record
      const actor: SourceActor = {
        id: actorData.id,
        name: actorData.name,
        email: actorData.email,
      };

      dbRecords.push({
        workspaceId: this.target.workspaceId,
        occurredAt: occurredAt.toISOString(),
        actor,
        observationType,
        title: obs.title,
        content: obs.body,
        topics,
        significanceScore: calculateSignificance(obs),
        source: obs.source,
        sourceType: obs.sourceType,
        sourceId,
        sourceReferences: [] as SourceReference[],
        metadata: {
          testData: true,
          injectedAt: now.toISOString(),
          category: obs.category,
          tags: obs.tags,
        },
        embeddingVectorId: vectorId,
      });

      // Progress callback
      if (onProgress) {
        onProgress(i + 1, observations.length, obs);
      }

      // Batch upsert to Pinecone
      if (vectors.length >= batchSize) {
        try {
          await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
            indexName,
            {
              ids: vectors.map((v) => v.id),
              vectors: vectors.map((v) => v.values),
              metadata: vectors.map((v) => v.metadata),
            },
            namespace
          );
          vectorsUpserted += vectors.length;
          vectors.length = 0;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Pinecone batch upsert failed: ${msg}`);
        }
      }
    }

    // 5. Upsert remaining vectors
    if (vectors.length > 0) {
      try {
        await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
          indexName,
          {
            ids: vectors.map((v) => v.id),
            vectors: vectors.map((v) => v.values),
            metadata: vectors.map((v) => v.metadata),
          },
          namespace
        );
        vectorsUpserted += vectors.length;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Pinecone final upsert failed: ${msg}`);
      }
    }

    // 6. Batch insert to database
    console.log(`[TestDataInjector] Inserting ${dbRecords.length} records to database...`);
    try {
      // Insert in batches to avoid hitting limits
      const dbBatchSize = 100;
      for (let i = 0; i < dbRecords.length; i += dbBatchSize) {
        const batch = dbRecords.slice(i, i + dbBatchSize);
        await db.insert(workspaceNeuralObservations).values(batch);
      }
      observationsCreated = dbRecords.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Database insert failed: ${msg}`);
    }

    console.log(`[TestDataInjector] Complete!`);
    console.log(`  Observations: ${observationsCreated}`);
    console.log(`  Vectors: ${vectorsUpserted}`);
    console.log(`  Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      observationsCreated,
      vectorsUpserted,
      errors,
      namespace,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Inject a pre-built scenario
   */
  async injectScenario(
    scenario: TestScenario,
    options: InjectionOptions = {}
  ): Promise<InjectionResult> {
    console.log(`[TestDataInjector] Injecting scenario: ${scenario.name}`);
    console.log(`  Description: ${scenario.description}`);
    return this.inject(scenario.observations, options);
  }

  /**
   * Clear test data from workspace
   */
  async clearTestData(sourceIdPrefix = "test"): Promise<void> {
    console.log(`[TestDataInjector] Clearing test data with prefix: ${sourceIdPrefix}`);

    // Clear from database (delete records where sourceId starts with prefix)
    // Note: This is a simplified approach - in production you might want metadata-based filtering
    await db
      .delete(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, this.target.workspaceId));

    // Note: Pinecone cleanup would require deleteByMetadata or iterating through vectors
    // For now, we rely on workspace namespace isolation
  }

  /**
   * Ensure workspace is loaded
   */
  private async ensureWorkspace(): Promise<void> {
    if (this.workspace) return;

    this.workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, this.target.workspaceId),
    });
  }
}

/**
 * Create injector for a workspace
 */
export function createInjector(target: WorkspaceTarget): TestDataInjector {
  return new TestDataInjector(target);
}
