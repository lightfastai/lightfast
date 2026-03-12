/**
 * Neural observation interpret workflow (slow path)
 *
 * Classifies, embeds, and stores interpretations for observations stored by
 * the fast path (observation-store.ts). Triggered by observation.stored.
 *
 * Workflow steps:
 * 1. Fetch observation from DB
 * 2. Fetch workspace for embedding config
 * 3. Classify observation with Claude Haiku
 * 4. Generate multi-view embeddings (title, content, summary)
 * 5. Upsert vectors to Pinecone
 * 6. Store interpretation row in workspace_observation_interpretations
 * 7. resolve-edges (Phase 3 - entity-mediated relationship detection)
 * 8. Emit observation.captured for downstream systems
 */

import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceNeuralObservations,
  workspaceObservationInterpretations,
} from "@db/console/schema";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { consolePineconeClient } from "@repo/console-pinecone";
import type { PostTransformEvent } from "@repo/console-providers";
import type {
  ClassificationResponse,
  MultiViewEmbeddingResult,
  ObservationVectorMetadata,
} from "@repo/console-validation";
import { classificationResponseSchema } from "@repo/console-validation";
import { log } from "@vendor/observability/log";
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngest } from "../../client/client";
import {
  buildNeuralTelemetry,
  createTracedModel,
  generateObject,
} from "./ai-helpers";
import {
  buildClassificationPrompt,
  classifyObservationFallback,
} from "./classification";
import { resolveEdges } from "./edge-resolver";

/**
 * Extract topics from stored observation data
 */
function extractTopics(obs: {
  source: string;
  observationType: string;
  title: string;
  sourceReferences:
    | { type: string; id: string; label?: string | null }[]
    | null
    | undefined;
}): string[] {
  const topics: string[] = [];

  // Add source as topic
  topics.push(obs.source);

  // Add observation type
  topics.push(obs.observationType);

  // Extract from labels
  for (const ref of obs.sourceReferences ?? []) {
    if (ref.type === "label") {
      topics.push(ref.id.toLowerCase());
    }
  }

  // Extract common keywords from title
  const keywords = [
    "fix",
    "feat",
    "refactor",
    "test",
    "docs",
    "chore",
    "ci",
    "perf",
  ];
  const titleLower = obs.title.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return [...new Set(topics)];
}

/**
 * Neural observation interpret workflow
 *
 * Slow path: LLM classification + embeddings + Pinecone.
 * Triggered by apps-console/neural/observation.stored.
 */
export const observationInterpret = inngest.createFunction(
  {
    id: "apps-console/neural.observation.interpret",
    name: "Neural Observation Interpret",
    description: "Classifies and embeds neural observations (slow path)",
    retries: 3,

    timeouts: {
      start: "2m",
      finish: "10m",
    },
  },
  { event: "apps-console/neural/observation.stored" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      internalObservationId,
      significanceScore,
      entityRefs,
      observationId,
    } = event.data;

    // Step 1: Fetch observation from DB
    const obs = await step.run("fetch-observation", async () => {
      const observation = await db.query.workspaceNeuralObservations.findFirst({
        where: eq(workspaceNeuralObservations.id, internalObservationId),
        columns: {
          id: true,
          externalId: true,
          title: true,
          content: true,
          source: true,
          sourceType: true,
          sourceId: true,
          actor: true,
          occurredAt: true,
          sourceReferences: true,
          observationType: true,
        },
      });

      if (!observation) {
        throw new NonRetriableError(
          `Observation not found: ${internalObservationId}`
        );
      }

      return observation;
    });

    // Step 2: Fetch workspace for embedding config
    const workspace = await step.run("fetch-workspace", async () => {
      const ws = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!ws) {
        throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
      }

      if ((ws.settings.version as number) !== 1) {
        throw new NonRetriableError(
          `Workspace ${workspaceId} has invalid settings version`
        );
      }

      return ws;
    });

    // Step 3: Classification with Claude Haiku (uses step.ai.wrap)
    const classificationResult = await (async () => {
      // Build a minimal PostTransformEvent-like object for the classification helpers
      const sourceEventLike = {
        source: obs.source,
        sourceType: obs.sourceType,
        title: obs.title,
        body: obs.content,
      } as unknown as PostTransformEvent;

      try {
        const llmResult = (await step.ai.wrap(
          "classify-observation",
          generateObject,
          {
            model: createTracedModel("anthropic/claude-3-5-haiku-latest"),
            schema: classificationResponseSchema,
            prompt: buildClassificationPrompt(sourceEventLike),
            temperature: 0.2,
            experimental_telemetry: buildNeuralTelemetry(
              "neural-classification",
              {
                workspaceId,
                sourceType: obs.sourceType,
                source: obs.source,
              }
            ),
          } as Parameters<typeof generateObject>[0]
        )) as { object: ClassificationResponse };

        const classification = llmResult.object;
        const keywordTopics = extractTopics(obs);

        // Merge and deduplicate topics
        const topics = [
          ...keywordTopics,
          classification.primaryCategory,
          ...classification.secondaryCategories,
          ...classification.topics,
        ].filter((t, i, arr) => arr.indexOf(t) === i);

        return { topics, classification };
      } catch (error) {
        // Fallback to regex-based classification on LLM failure
        log.warn("Classification LLM failed, using fallback", {
          error: String(error),
          observationId: internalObservationId,
        });
        const fallback = classifyObservationFallback(sourceEventLike);
        const keywordTopics = extractTopics(obs);
        const topics = [
          ...keywordTopics,
          fallback.primaryCategory,
          ...fallback.secondaryCategories,
        ].filter((t, i, arr) => arr.indexOf(t) === i);

        return {
          topics,
          classification: {
            primaryCategory: fallback.primaryCategory,
            secondaryCategories: fallback.secondaryCategories,
            topics: [],
            confidence: 0.5,
            reasoning: "Fallback regex classification",
          } as ClassificationResponse,
        };
      }
    })();

    const { topics, classification } = classificationResult;

    // Step 4: Generate multi-view embeddings (title, content, summary)
    const embeddingResult = await step.run(
      "generate-multi-view-embeddings",
      async (): Promise<MultiViewEmbeddingResult> => {
        const embeddingProvider = createEmbeddingProviderForWorkspace(
          {
            id: workspace.id,
            embeddingModel: workspace.settings.embedding.embeddingModel,
            embeddingDim: workspace.settings.embedding.embeddingDim,
          },
          { inputType: "search_document" }
        );

        const titleText = obs.title;
        const contentText = obs.content;
        const summaryText = `${obs.title}\n\n${obs.content.slice(0, 1000)}`;

        const result = await embeddingProvider.embed([
          titleText,
          contentText,
          summaryText,
        ]);

        if (
          !(
            result.embeddings[0] &&
            result.embeddings[1] &&
            result.embeddings[2]
          )
        ) {
          throw new Error("Failed to generate all multi-view embeddings");
        }

        const baseId = obs.sourceId.replace(/[^a-zA-Z0-9]/g, "_");

        return {
          title: {
            vectorId: `obs_title_${baseId}`,
            vector: result.embeddings[0],
          },
          content: {
            vectorId: `obs_content_${baseId}`,
            vector: result.embeddings[1],
          },
          summary: {
            vectorId: `obs_summary_${baseId}`,
            vector: result.embeddings[2],
          },
          // Keep legacy ID for backwards compatibility during migration
          legacyVectorId: `obs_${baseId}`,
        };
      }
    );

    // Step 5: Upsert multi-view vectors to Pinecone
    await step.run("upsert-multi-view-vectors", async () => {
      const namespace = workspace.settings.embedding.namespaceName;

      const baseMetadata = {
        layer: "observations",
        observationType: obs.observationType,
        source: obs.source,
        sourceType: obs.sourceType,
        sourceId: obs.sourceId,
        occurredAt: obs.occurredAt,
        actorName: obs.actor?.name ?? "unknown",
        observationId: obs.externalId,
      };

      const titleMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "title",
        title: obs.title,
        snippet: obs.title,
      };

      const contentMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "content",
        title: obs.title,
        snippet: obs.content.slice(0, 500),
      };

      const summaryMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "summary",
        title: obs.title,
        snippet: `${obs.title}\n${obs.content.slice(0, 300)}`,
      };

      await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
        workspace.settings.embedding.indexName,
        {
          ids: [
            embeddingResult.title.vectorId,
            embeddingResult.content.vectorId,
            embeddingResult.summary.vectorId,
          ],
          vectors: [
            embeddingResult.title.vector,
            embeddingResult.content.vector,
            embeddingResult.summary.vector,
          ],
          metadata: [titleMetadata, contentMetadata, summaryMetadata],
        },
        namespace
      );

      log.info("Multi-view vectors upserted to Pinecone", {
        titleVectorId: embeddingResult.title.vectorId,
        contentVectorId: embeddingResult.content.vectorId,
        summaryVectorId: embeddingResult.summary.vectorId,
        namespace,
        indexName: workspace.settings.embedding.indexName,
      });
    });

    // Step 6: Store interpretation row
    await step.run("store-interpretation", async () => {
      await db.insert(workspaceObservationInterpretations).values({
        observationId: internalObservationId,
        workspaceId,
        version: 1,
        primaryCategory: classification.primaryCategory,
        topics,
        significanceScore,
        embeddingTitleId: embeddingResult.title.vectorId,
        embeddingContentId: embeddingResult.content.vectorId,
        embeddingSummaryId: embeddingResult.summary.vectorId,
        modelVersion: "claude-3-5-haiku",
        processedAt: new Date().toISOString(),
      });

      log.info("Interpretation stored", {
        observationId: internalObservationId,
        primaryCategory: classification.primaryCategory,
        topicCount: topics.length,
      });
    });

    // Step 7: Resolve edges via entity-mediated relationship detection
    await step.run("resolve-edges", async () => {
      return resolveEdges(
        workspaceId,
        internalObservationId,
        obs.source,
        entityRefs
      );
    });

    // Step 8: Emit observation.captured for downstream systems (notifications, etc.)
    await step.sendEvent("emit-observation-captured", {
      name: "apps-console/neural/observation.captured" as const,
      data: {
        workspaceId,
        clerkOrgId,
        observationId,
        sourceId: obs.sourceId,
        observationType: obs.observationType,
        significanceScore,
        topics,
        entitiesExtracted: entityRefs.length,
      },
    });

    log.info("Observation interpreted", {
      observationId,
      topicCount: topics.length,
      source: obs.source,
    });

    return {
      status: "interpreted",
      observationId,
      topicCount: topics.length,
    };
  }
);
