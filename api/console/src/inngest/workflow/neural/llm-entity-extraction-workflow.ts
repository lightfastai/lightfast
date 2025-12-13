/**
 * LLM Entity Extraction Workflow
 *
 * Fire-and-forget workflow that extracts contextual entities from observations
 * using LLM. Triggered after observation capture for qualifying observations.
 *
 * This complements rule-based extraction without blocking the main pipeline.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@db/console/client";
import {
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import { inngest } from "../../client/client";
import { extractEntitiesWithLLM } from "./llm-entity-extraction";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";

/**
 * LLM Entity Extraction Workflow
 *
 * Fire-and-forget workflow that extracts contextual entities from observations
 * using LLM. Triggered after observation capture for qualifying observations.
 *
 * This complements rule-based extraction without blocking the main pipeline.
 */
export const llmEntityExtractionWorkflow = inngest.createFunction(
  {
    id: "apps-console/neural.llm-entity-extraction",
    name: "Neural: LLM Entity Extraction",
    retries: 2,
    debounce: {
      key: "event.data.observationId",
      period: "1m", // LLM_ENTITY_EXTRACTION_CONFIG.debounceMs = 60_000
    },
  },
  { event: "apps-console/neural/llm-entity-extraction.requested" },
  async ({ event, step }) => {
    const { observationId, workspaceId } = event.data;
    const requestId = event.id;

    // Step 1: Fetch observation content
    const observation = await step.run("fetch-observation", async () => {
      const [obs] = await db
        .select({
          id: workspaceNeuralObservations.id,
          title: workspaceNeuralObservations.title,
          content: workspaceNeuralObservations.content,
        })
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.id, observationId))
        .limit(1);

      return obs ?? null;
    });

    if (!observation) {
      log.warn("LLM entity extraction skipped - observation not found", {
        requestId,
        observationId,
      });
      return { status: "skipped", reason: "observation_not_found" };
    }

    // Step 2: Extract entities with LLM
    const llmEntities = await step.run("extract-entities-llm", async () => {
      return await extractEntitiesWithLLM(
        observation.title,
        observation.content ?? "",
        { observationId, requestId }
      );
    });

    if (llmEntities.length === 0) {
      log.info("LLM entity extraction completed - no entities found", {
        requestId,
        observationId,
      });
      return { status: "completed", entitiesExtracted: 0 };
    }

    // Step 3: Store entities (upsert pattern)
    const storedCount = await step.run("store-entities", async () => {
      let count = 0;

      for (const entity of llmEntities) {
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
                // Update confidence if LLM is more confident
                confidence: sql`GREATEST(${workspaceNeuralEntities.confidence}, ${entity.confidence})`,
              },
            });
          count++;
        } catch (error) {
          log.error("Failed to store LLM entity", {
            requestId,
            observationId,
            entity,
            error,
          });
        }
      }

      return count;
    });

    log.info("LLM entity extraction workflow completed", {
      requestId,
      observationId,
      entitiesExtracted: llmEntities.length,
      entitiesStored: storedCount,
    });

    return {
      status: "completed",
      entitiesExtracted: llmEntities.length,
      entitiesStored: storedCount,
    };
  }
);
