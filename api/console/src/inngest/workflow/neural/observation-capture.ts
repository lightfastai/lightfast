/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 * This is the write path for the neural memory system.
 *
 * Workflow steps:
 * 1. Check for duplicate observations (idempotency)
 * 2. Fetch workspace and store context
 * 3. Generate embedding for observation content
 * 4. Upsert vector to Pinecone
 * 5. Store observation record in database
 * 6. Emit completion event
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  orgWorkspaces,
} from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { NonRetriableError } from "inngest";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { SourceEvent } from "@repo/console-types";

/**
 * Observation vector metadata stored in Pinecone
 * All values must be string, number, boolean, or string[] per Pinecone constraints
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
  // HACK: Index signature required to satisfy Pinecone's RecordMetadata constraint.
  // TODO: Re-export RecordMetadata from @repo/console-pinecone and extend it properly.
  [key: string]: string | number | boolean | string[];
}

/**
 * Map source event types to observation types
 */
function deriveObservationType(sourceEvent: SourceEvent): string {
  // For GitHub events, use sourceType directly
  // e.g., "push", "pull_request_merged", "issue_opened"
  if (sourceEvent.source === "github") {
    return sourceEvent.sourceType;
  }

  // For Vercel events, simplify the type
  // e.g., "deployment.succeeded" → "deployment_succeeded"
  if (sourceEvent.source === "vercel") {
    return sourceEvent.sourceType.replace(".", "_");
  }

  return sourceEvent.sourceType;
}

/**
 * Extract topics from source event
 * Simple keyword extraction for MVP
 */
function extractTopics(sourceEvent: SourceEvent): string[] {
  const topics: string[] = [];

  // Add source as topic
  topics.push(sourceEvent.source);

  // Add observation type
  topics.push(deriveObservationType(sourceEvent));

  // Extract from labels
  for (const ref of sourceEvent.references) {
    if (ref.type === "label") {
      topics.push(ref.id.toLowerCase());
    }
  }

  // Extract common keywords from title
  const keywords = ["fix", "feat", "refactor", "test", "docs", "chore", "ci", "perf"];
  const titleLower = sourceEvent.title.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return [...new Set(topics)]; // Deduplicate
}

/**
 * Build namespace for workspace (hybrid approach)
 * Use single namespace per workspace with layer as metadata field (not namespace suffix)
 * See: thoughts/shared/research/2025-12-11-web-analysis-neural-memory-architecture-implications.md
 */
function buildWorkspaceNamespace(clerkOrgId: string, workspaceId: string): string {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 */
export const observationCapture = inngest.createFunction(
  {
    id: "apps-console/neural.observation.capture",
    name: "Neural Observation Capture",
    description: "Captures engineering events as neural observations",
    retries: 3,

    // Idempotency by source ID to prevent duplicate observations
    idempotency: "event.data.sourceEvent.sourceId",

    // Concurrency limit per workspace
    concurrency: {
      limit: 10,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "1m",
      finish: "5m",
    },
  },
  { event: "apps-console/neural/observation.capture" },
  async ({ event, step }) => {
    const { workspaceId, sourceEvent } = event.data;
    const startTime = Date.now();

    log.info("Capturing neural observation", {
      workspaceId,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      sourceId: sourceEvent.sourceId,
    });

    // Step 1: Check for duplicate
    const existing = await step.run("check-duplicate", async () => {
      const obs = await db.query.workspaceNeuralObservations.findFirst({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.sourceId, sourceEvent.sourceId),
        ),
      });

      if (obs) {
        log.info("Observation already exists, skipping", {
          observationId: obs.id,
          sourceId: sourceEvent.sourceId,
        });
      }

      return obs ?? null;
    });

    if (existing) {
      return {
        status: "duplicate",
        observationId: existing.id,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Fetch workspace
    const workspace = await step.run("fetch-context", async () => {
      const ws = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!ws) {
        throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
      }

      if (!ws.indexName || !ws.embeddingModel) {
        throw new NonRetriableError(`Workspace ${workspaceId} is missing embedding configuration`);
      }

      return ws;
    });

    // Step 3: Generate embedding
    const { embeddingVector, vectorId } = await step.run("generate-embedding", async () => {
      const embeddingProvider = createEmbeddingProviderForWorkspace(
        {
          id: workspace.id,
          embeddingModel: workspace.embeddingModel,
          embeddingDim: workspace.embeddingDim,
        },
        {
          inputType: "search_document",
        }
      );

      // Combine title and body for embedding
      const textToEmbed = `${sourceEvent.title}\n\n${sourceEvent.body}`;
      const result = await embeddingProvider.embed([textToEmbed]);

      if (!result.embeddings[0]) {
        throw new Error("Failed to generate embedding");
      }

      // Generate vector ID
      const vectorId = `obs_${sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;

      return {
        embeddingVector: result.embeddings[0],
        vectorId,
      };
    });

    // Step 4: Upsert to Pinecone
    await step.run("upsert-vector", async () => {
      const namespace = buildWorkspaceNamespace(
        workspace.clerkOrgId,
        workspaceId
      );

      const metadata: ObservationVectorMetadata = {
        layer: "observations", // Hybrid approach: filter by layer in metadata
        observationType: deriveObservationType(sourceEvent),
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        sourceId: sourceEvent.sourceId,
        title: sourceEvent.title,
        snippet: sourceEvent.body.slice(0, 500),
        occurredAt: sourceEvent.occurredAt,
        actorName: sourceEvent.actor?.name || "unknown",
      };

      await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
        workspace.indexName!,
        {
          ids: [vectorId],
          vectors: [embeddingVector],
          metadata: [metadata],
        },
        namespace
      );

      log.info("Vector upserted to Pinecone", {
        vectorId,
        namespace,
        indexName: workspace.indexName,
      });
    });

    // Step 5: Store observation in database
    const observation = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(sourceEvent);
      const topics = extractTopics(sourceEvent);

      const [obs] = await db
        .insert(workspaceNeuralObservations)
        .values({
          workspaceId,
          occurredAt: sourceEvent.occurredAt,
          actor: sourceEvent.actor || null,
          observationType,
          title: sourceEvent.title,
          content: sourceEvent.body,
          topics,
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          sourceId: sourceEvent.sourceId,
          sourceReferences: sourceEvent.references,
          metadata: sourceEvent.metadata,
          embeddingVectorId: vectorId,
        })
        .returning();

      if (!obs) {
        throw new Error("Failed to insert observation");
      }

      log.info("Observation stored in database", {
        observationId: obs.id,
        observationType,
      });

      return obs;
    });

    // Step 6: Emit completion event
    await step.sendEvent("emit-captured", {
      name: "apps-console/neural/observation.captured",
      data: {
        workspaceId,
        observationId: observation.id,
        sourceId: sourceEvent.sourceId,
        observationType: observation.observationType,
      },
    });

    return {
      status: "captured",
      observationId: observation.id,
      observationType: observation.observationType,
      duration: Date.now() - startTime,
    };
  }
);
