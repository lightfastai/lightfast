import { workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import { createCohereEmbedding } from "@vendor/embed";
import { log } from "@vendor/observability/log";
import type { EvalInfraConfig, EvalWorkspaceConfig, SeedResult } from "../types";
import type { SeedCorpus } from "../schemas";
import { assertEvalSafety } from "../context/eval-context";
import { configurePineconeEnvironment, createEvalPineconeClient } from "../env-setup";
import { createEvalDbClient } from "./db";
import { ensureEvalWorkspace } from "./workspace-setup";
import { EmbeddingCache } from "./embedding-cache";

export type { SeedObservation, SeedCorpus } from "../schemas";
export type { SeedResult } from "../types";

/**
 * Seed eval data directly into DB + Pinecone.
 * Replicates what the Inngest observation-capture workflow does, but synchronously.
 *
 * Flow:
 * 1. Safety check (namespace prefix, workspace prefix)
 * 2. Create eval workspace record
 * 3. Insert observations into DB
 * 4. Insert entities into DB
 * 5. Generate/load embeddings
 * 6. Upsert vectors to Pinecone (eval namespace)
 */
export async function seedEvalData(
  infra: EvalInfraConfig,
  workspace: EvalWorkspaceConfig,
  corpus: SeedCorpus,
  options?: { embeddingCacheDir?: string },
): Promise<SeedResult> {
  const startTime = Date.now();

  // 1. Safety check
  assertEvalSafety(workspace);

  // 2. Configure Pinecone env before importing client
  configurePineconeEnvironment(infra);

  // 3. Create eval DB client
  const { db, close } = createEvalDbClient(infra);

  try {
    // 4. Ensure workspace record exists
    log.info("Creating eval workspace", { workspaceId: workspace.workspaceId });
    await ensureEvalWorkspace(db, workspace);

    // 5. Insert observations
    log.info("Inserting observations", { count: corpus.observations.length });
    const insertedObs: Array<{ externalId: string; id: number }> = [];

    for (const obs of corpus.observations) {
      const [inserted] = await db
        .insert(workspaceNeuralObservations)
        .values({
          externalId: obs.externalId,
          workspaceId: workspace.workspaceId,
          title: obs.title,
          content: obs.content,
          source: obs.source,
          sourceType: obs.sourceType,
          sourceId: obs.sourceId,
          observationType: obs.observationType,
          occurredAt: obs.occurredAt,
          metadata: obs.metadata,
        })
        .onConflictDoNothing()
        .returning({
          externalId: workspaceNeuralObservations.externalId,
          id: workspaceNeuralObservations.id,
        });

      if (inserted) {
        insertedObs.push(inserted);
      }
    }

    // 6. Insert entities
    let entitiesInserted = 0;
    for (const obs of corpus.observations) {
      if (!obs.entities?.length) continue;

      const obsRecord = insertedObs.find((o) => o.externalId === obs.externalId);
      if (!obsRecord) continue;

      for (const entity of obs.entities) {
        await db
          .insert(workspaceNeuralEntities)
          .values({
            workspaceId: workspace.workspaceId,
            category: entity.category as any,
            key: entity.key,
            value: entity.value,
            sourceObservationId: obsRecord.id,
          })
          .onConflictDoNothing();
        entitiesInserted++;
      }
    }

    // 7. Generate embeddings
    log.info("Generating embeddings", { count: corpus.observations.length });

    const corpusJson = JSON.stringify(corpus);
    const corpusHash = EmbeddingCache.hashCorpus(corpusJson);
    const cache = new EmbeddingCache(
      options?.embeddingCacheDir ?? "packages/console-eval/cache",
      corpusHash,
    );

    const embedder = createCohereEmbedding({
      apiKey: infra.cohere.apiKey,
      model: workspace.embeddingModel,
      inputType: "search_document",
      dimension: workspace.embeddingDim,
    });

    const vectorIds: string[] = [];
    const vectorValues: number[][] = [];
    const vectorMetadata: Record<string, string>[] = [];

    for (const obs of corpus.observations) {
      const text = `${obs.title}\n${obs.content}`;
      let embedding: number[];

      if (obs.embedding) {
        embedding = obs.embedding;
      } else if (cache.has(text)) {
        embedding = cache.get(text)!;
      } else {
        const result = await embedder.embed([text]);
        embedding = result.embeddings[0]!;
        cache.set(text, embedding);
      }

      // Use summary view ID format (matches production multi-view pattern)
      const vectorId = `obs_summary_${obs.externalId}`;

      vectorIds.push(vectorId);
      vectorValues.push(embedding);
      vectorMetadata.push({
        workspaceId: workspace.workspaceId,
        observationId: obs.externalId,
        source: obs.source,
        sourceType: obs.sourceType,
        observationType: obs.observationType,
        layer: "observations",
      });
    }

    cache.save();

    // 8. Upsert vectors to Pinecone
    log.info("Upserting vectors", {
      count: vectorIds.length,
      index: workspace.indexName,
      namespace: workspace.namespaceName,
    });

    const pinecone = await createEvalPineconeClient();
    await pinecone.upsertVectors(
      workspace.indexName,
      { ids: vectorIds, vectors: vectorValues, metadata: vectorMetadata },
      100,
      workspace.namespaceName,
    );

    const result: SeedResult = {
      observationsInserted: insertedObs.length,
      entitiesExtracted: entitiesInserted,
      vectorsUpserted: vectorIds.length,
      durationMs: Date.now() - startTime,
    };

    log.info("Seeding complete", result);
    return result;
  } finally {
    await close();
  }
}
