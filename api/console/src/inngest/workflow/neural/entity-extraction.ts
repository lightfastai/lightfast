/**
 * @deprecated Entity extraction is now inline in observation-capture.ts (Day 3.5)
 * This file is kept for reference but no longer registered with Inngest.
 *
 * The inline approach:
 * - Runs entity extraction in parallel with classification and embedding
 * - Stores entities in the same transaction as the observation
 * - Eliminates fire-and-forget async processing
 * - Enables future cluster assignment that needs entity data
 *
 * @see observation-capture.ts for current implementation
 */

import { sql, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  type ObservationReference,
} from "@db/console/schema";
import type { ExtractedEntity } from "@repo/console-types";
import { log } from "@vendor/observability/log";
import { inngest } from "../../client/client";
import { extractEntities, extractFromReferences } from "./entity-extraction-patterns";

/**
 * Maximum entities to extract per observation
 * Prevents runaway extraction from noisy content
 */
const MAX_ENTITIES_PER_OBSERVATION = 50;

/**
 * Entity Extraction Workflow
 *
 * Triggered by observation capture completion.
 * Extracts entities from observation content and stores them with deduplication.
 */
export const entityExtraction = inngest.createFunction(
  {
    id: "apps-console/neural.entity.extraction",
    name: "Neural Entity Extraction",
    description: "Extracts entities from captured observations",
    retries: 2,
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId",
    },
  },
  { event: "apps-console/neural/observation.captured" },
  async ({ event, step }) => {
    const { observationId, workspaceId } = event.data;
    const startTime = Date.now();

    log.info("Starting entity extraction", {
      observationId,
      workspaceId,
    });

    // Step 1: Fetch observation
    const observation = await step.run("fetch-observation", async () => {
      const result = await db.query.workspaceNeuralObservations.findFirst({
        where: eq(workspaceNeuralObservations.id, observationId),
      });

      if (!result) {
        throw new NonRetriableError(`Observation not found: ${observationId}`);
      }

      return result;
    });

    // Step 2: Extract entities
    const entities = await step.run("extract-entities", async () => {
      // Extract from text content
      const textEntities = extractEntities(
        observation.title,
        observation.content || ""
      );

      // Extract from structured references if available
      const references = observation.sourceReferences as ObservationReference[] | null;
      const refEntities = references ? extractFromReferences(references) : [];

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
      if (deduplicated.length > MAX_ENTITIES_PER_OBSERVATION) {
        log.warn("Entity extraction exceeded limit", {
          observationId,
          extracted: deduplicated.length,
          limit: MAX_ENTITIES_PER_OBSERVATION,
        });
        // Sort by confidence and take top N
        return deduplicated
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, MAX_ENTITIES_PER_OBSERVATION);
      }

      return deduplicated;
    });

    // Step 3: Store entities with upsert
    const stored = await step.run("store-entities", async () => {
      if (entities.length === 0) {
        return { stored: 0 };
      }

      let storedCount = 0;

      for (const entity of entities) {
        try {
          await db
            .insert(workspaceNeuralEntities)
            .values({
              workspaceId,
              category: entity.category,
              key: entity.key,
              value: entity.value,
              sourceObservationId: observationId,
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
          storedCount++;
        } catch (error) {
          // Log but don't fail the entire workflow
          log.error("Failed to store entity", {
            entity,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return { stored: storedCount };
    });

    const duration = Date.now() - startTime;

    log.info("Entity extraction completed", {
      observationId,
      workspaceId,
      entitiesExtracted: entities.length,
      entitiesStored: stored.stored,
      durationMs: duration,
    });

    return {
      status: "completed",
      observationId,
      entitiesExtracted: entities.length,
      entitiesStored: stored.stored,
      durationMs: duration,
    };
  }
);
