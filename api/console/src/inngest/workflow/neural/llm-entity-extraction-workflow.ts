/**
 * LLM Entity Extraction Workflow
 *
 * Asynchronously extracts semantic entities from observation content
 * using LLM (GPT-5.1-instant) with Braintrust tracing and Inngest AI observability.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@db/console/client";
import {
  workspaceNeuralEntities,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import { llmEntityExtractionResponseSchema } from "@repo/console-validation";
import type { LLMEntityExtractionResponse } from "@repo/console-validation";
import type { ExtractedEntity } from "@repo/console-types";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";

import { inngest } from "../../client/client";
import {
  createTracedModel,
  generateObject,
  buildNeuralTelemetry,
} from "./ai-helpers";
import { buildExtractionPrompt } from "./llm-entity-extraction";

export const llmEntityExtractionWorkflow = inngest.createFunction(
  {
    id: "apps-console/neural.llm-entity-extraction",
    name: "Neural: LLM Entity Extraction",
    retries: 2,
    debounce: {
      key: "event.data.observationId",
      period: "1m",
    },
  },
  { event: "apps-console/neural/llm-entity-extraction.requested" },
  async ({ event, step }) => {
    const { workspaceId, observationId } = event.data;
    const config = LLM_ENTITY_EXTRACTION_CONFIG;

    // Step 1: Fetch observation
    const observation = await step.run("fetch-observation", async () => {
      const [obs] = await db
        .select({
          id: workspaceNeuralObservations.id,
          title: workspaceNeuralObservations.title,
          content: workspaceNeuralObservations.content,
        })
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.externalId, observationId))
        .limit(1);

      return obs ?? null;
    });

    if (!observation) {
      return { status: "skipped", reason: "observation_not_found" };
    }

    // Skip if content too short
    const content = observation.content;
    const contentLength = content.length;
    if (contentLength < config.minContentLength) {
      return { status: "skipped", reason: "content_too_short", contentLength };
    }

    // Step 2: Extract entities with LLM using step.ai.wrap()
    const extractionResult = (await step.ai.wrap(
      "extract-entities-llm",
      generateObject,
      {
        model: createTracedModel("openai/gpt-5.1-instant"),
        schema: llmEntityExtractionResponseSchema,
        prompt: buildExtractionPrompt(
          observation.title,
          content
        ),
        temperature: config.temperature,
        experimental_telemetry: buildNeuralTelemetry("neural-entity-extraction", {
          observationId,
          workspaceId,
          contentLength,
        }),
      } as Parameters<typeof generateObject>[0]
    )) as { object: LLMEntityExtractionResponse };

    // Filter by confidence threshold
    const entities: ExtractedEntity[] = extractionResult.object.entities
      .filter((e) => e.confidence >= config.minConfidence)
      .map((e) => ({
        category: e.category,
        key: e.key,
        value: e.value,
        confidence: e.confidence,
        evidence: e.reasoning ?? `LLM extracted: ${e.category}`,
      }));

    if (entities.length === 0) {
      return { status: "completed", entitiesExtracted: 0 };
    }

    // Step 3: Store entities
    const storedCount = await step.run("store-entities", async () => {
      let count = 0;

      for (const entity of entities) {
        try {
          await db
            .insert(workspaceNeuralEntities)
            .values({
              workspaceId,
              category: entity.category,
              key: entity.key,
              value: entity.value ?? null,
              sourceObservationId: observation.id,
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
                confidence: sql`GREATEST(${workspaceNeuralEntities.confidence}, ${entity.confidence})`,
              },
            });
          count++;
        } catch (error) {
          log.error("Failed to store LLM entity", {
            observationId,
            entity,
            error,
          });
        }
      }

      return count;
    });

    log.info("LLM entity extraction completed", {
      observationId,
      workspaceId,
      entitiesExtracted: entities.length,
      entitiesStored: storedCount,
    });

    return {
      status: "completed",
      entitiesExtracted: entities.length,
      entitiesStored: storedCount,
    };
  }
);
