/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 * This is the write path for the neural memory system.
 *
 * Workflow steps:
 * 1. Check for duplicate observations (idempotency)
 * 2. Check if event is allowed by source config (filtering)
 * 3. Evaluate significance (GATE - return early if below threshold)
 * 4. Fetch workspace context
 * 5. PARALLEL: Classification + Embedding + Entity Extraction
 * 6. Upsert vector to Pinecone
 * 7. Store observation + entities (transactional)
 * 8. Emit completion event
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  orgWorkspaces,
  workspaceIntegrations,
} from "@db/console/schema";
import { eq, and, sql } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { NonRetriableError } from "inngest";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { SourceEvent } from "@repo/console-types";
import { scoreSignificance, SIGNIFICANCE_THRESHOLD } from "./scoring";
import { classifyObservation } from "./classification";
import { extractEntities, extractFromReferences } from "./entity-extraction-patterns";
import type { ExtractedEntity } from "@repo/console-types";

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
 * Map detailed sourceType to base event type for config comparison.
 *
 * Internal format uses dot notation: "pull-request.opened", "issue.closed"
 * Config format uses underscores: "pull_request", "issues"
 *
 * @example
 * getBaseEventType("github", "pull-request.opened") // "pull_request"
 * getBaseEventType("github", "issue.closed") // "issues"
 * getBaseEventType("github", "push") // "push"
 * getBaseEventType("vercel", "deployment.created") // "deployment.created"
 */
function getBaseEventType(source: string, sourceType: string): string {
  if (source === "github") {
    // Internal format uses dot notation: "pull-request.opened"
    const dotIndex = sourceType.indexOf(".");
    if (dotIndex > 0) {
      const base = sourceType.substring(0, dotIndex);
      // Convert hyphens to underscores for config format
      const configBase = base.replace(/-/g, "_");
      // Special case: issue → issues (config uses plural)
      return configBase === "issue" ? "issues" : configBase;
    }
    // Handle simple events like "push"
    return sourceType;
  }

  if (source === "vercel") {
    // Vercel events are already in config format (e.g., "deployment.created")
    return sourceType;
  }

  return sourceType;
}

/**
 * Check if an event type is allowed for a source based on sourceConfig.sync.events
 */
function isEventAllowed(
  sourceConfig: { sync?: { events?: string[] } } | null | undefined,
  baseEventType: string,
): boolean {
  const events = sourceConfig?.sync?.events;
  if (!events || events.length === 0) {
    return false;
  }
  return events.includes(baseEventType);
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

    // Step 2: Check if event is allowed by source config
    const eventAllowed = await step.run("check-event-allowed", async () => {
      // Extract resource ID from metadata (repoId for GitHub, projectId for Vercel)
      const metadata = sourceEvent.metadata as Record<string, unknown>;
      const resourceId = metadata.repoId?.toString() || metadata.projectId?.toString();

      if (!resourceId) {
        // No resource ID in metadata - allow event (legacy or unknown source)
        log.info("No resource ID in metadata, allowing event", {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
        });
        return true;
      }

      // Look up the integration by workspaceId + providerResourceId
      const integration = await db.query.workspaceIntegrations.findFirst({
        where: and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(workspaceIntegrations.providerResourceId, resourceId),
        ),
      });

      if (!integration) {
        // Integration not found - allow event (may be processed differently)
        log.info("Integration not found for resource, allowing event", {
          workspaceId,
          resourceId,
        });
        return true;
      }

      // Check if event is allowed
      const baseEventType = getBaseEventType(sourceEvent.source, sourceEvent.sourceType);
      const sourceConfig = integration.sourceConfig as { sync?: { events?: string[] } };
      const allowed = isEventAllowed(sourceConfig, baseEventType);

      if (!allowed) {
        log.info("Event filtered by source config", {
          workspaceId,
          resourceId,
          sourceType: sourceEvent.sourceType,
          baseEventType,
          configuredEvents: sourceConfig?.sync?.events,
        });
      }

      return allowed;
    });

    if (!eventAllowed) {
      return {
        status: "filtered",
        reason: "Event type not enabled in source config",
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Evaluate significance (early gate)
    const significance = await step.run("evaluate-significance", async () => {
      return scoreSignificance(sourceEvent);
    });

    // Gate: Skip low-significance events
    if (significance.score < SIGNIFICANCE_THRESHOLD) {
      log.info("Observation below significance threshold, skipping", {
        workspaceId,
        sourceId: sourceEvent.sourceId,
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        factors: significance.factors,
      });

      return {
        status: "below_threshold",
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        duration: Date.now() - startTime,
      };
    }

    // Step 4: Fetch workspace context
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

    // Step 5: PARALLEL processing (no interdependencies)
    const [classificationResult, embeddingResult, extractedEntities] = await Promise.all([
      // Classification
      step.run("classify", async () => {
        const keywordTopics = extractTopics(sourceEvent);
        const classification = classifyObservation(sourceEvent);

        // Merge and deduplicate topics
        const topics = [
          ...keywordTopics,
          classification.primaryCategory,
          ...classification.secondaryCategories,
        ].filter((t, i, arr) => arr.indexOf(t) === i);

        return { topics, classification };
      }),

      // Embedding generation
      step.run("generate-embedding", async () => {
        const embeddingProvider = createEmbeddingProviderForWorkspace(
          {
            id: workspace.id,
            embeddingModel: workspace.embeddingModel,
            embeddingDim: workspace.embeddingDim,
          },
          { inputType: "search_document" }
        );

        const textToEmbed = `${sourceEvent.title}\n\n${sourceEvent.body}`;
        const result = await embeddingProvider.embed([textToEmbed]);

        if (!result.embeddings[0]) {
          throw new Error("Failed to generate embedding");
        }

        const vectorId = `obs_${sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_")}`;
        return { embeddingVector: result.embeddings[0], vectorId };
      }),

      // Entity extraction (inline, not fire-and-forget)
      step.run("extract-entities", async () => {
        const textEntities = extractEntities(sourceEvent.title, sourceEvent.body || "");
        const references = sourceEvent.references as Array<{ type: string; id: string; label?: string }>;
        const refEntities = extractFromReferences(references);

        // Combine and deduplicate
        const allEntities = [...textEntities, ...refEntities];
        const entityMap = new Map<string, ExtractedEntity>();

        for (const entity of allEntities) {
          const key = `${entity.category}:${entity.key.toLowerCase()}`;
          const existing = entityMap.get(key);
          if (!existing || existing.confidence < entity.confidence) {
            entityMap.set(key, entity);
          }
        }

        // Limit to prevent runaway extraction
        const deduplicated = Array.from(entityMap.values());
        return deduplicated.slice(0, 50); // MAX_ENTITIES_PER_OBSERVATION
      }),
    ]);

    const { topics } = classificationResult;
    const { embeddingVector, vectorId } = embeddingResult;

    // Step 6: Upsert to Pinecone
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

    // Step 7: Store observation + entities (transactional)
    // Note: Topics come from Step 5 (classify), significance from Step 3
    const { observation, entitiesStored } = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(sourceEvent);

      return await db.transaction(async (tx) => {
        // Insert observation
        const [obs] = await tx
          .insert(workspaceNeuralObservations)
          .values({
            workspaceId,
            occurredAt: sourceEvent.occurredAt,
            // TODO (Day 4): Replace passthrough with resolveActor() call
            actor: sourceEvent.actor || null,
            observationType,
            title: sourceEvent.title,
            content: sourceEvent.body,
            topics,
            significanceScore: significance.score,
            source: sourceEvent.source,
            sourceType: sourceEvent.sourceType,
            sourceId: sourceEvent.sourceId,
            sourceReferences: sourceEvent.references,
            metadata: sourceEvent.metadata,
            embeddingVectorId: vectorId,
            // TODO (Day 4): Add clusterId after cluster assignment
          })
          .returning();

        if (!obs) {
          throw new Error("Failed to insert observation");
        }

        // Insert entities with upsert (same transaction)
        let entitiesStored = 0;
        for (const entity of extractedEntities) {
          await tx
            .insert(workspaceNeuralEntities)
            .values({
              workspaceId,
              category: entity.category,
              key: entity.key,
              value: entity.value,
              sourceObservationId: obs.id,
              evidenceSnippet: entity.evidence,
              confidence: entity.confidence,
            })
            .onConflictDoUpdate({
              target: [
                workspaceNeuralEntities.workspaceId,
                workspaceNeuralEntities.category,
                workspaceNeuralEntities.key,
              ],
              set: {
                lastSeenAt: new Date().toISOString(),
                occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount} + 1`,
                updatedAt: new Date().toISOString(),
              },
            });
          entitiesStored++;
        }

        log.info("Observation and entities stored", {
          observationId: obs.id,
          observationType,
          entitiesExtracted: extractedEntities.length,
          entitiesStored,
        });

        return { observation: obs, entitiesStored };
      });
    });

    // Step 8: Emit completion event (for future cluster/profile systems)
    await step.sendEvent("emit-captured", {
      name: "apps-console/neural/observation.captured",
      data: {
        workspaceId,
        observationId: observation.id,
        sourceId: sourceEvent.sourceId,
        observationType: observation.observationType,
        // New fields for Day 4
        significanceScore: significance.score,
        topics,
        entitiesExtracted: extractedEntities.length,
        // TODO (Day 4): Add actorId, clusterId
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
