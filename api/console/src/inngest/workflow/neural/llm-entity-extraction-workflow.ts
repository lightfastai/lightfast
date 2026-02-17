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
  orgWorkspaces,
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
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { createNeuralOnFailureHandler } from "./on-failure-handler";
import type {
  NeuralLLMEntityExtractionInput,
  NeuralLLMEntityExtractionOutputSuccess,
  NeuralLLMEntityExtractionOutputSkipped,
  NeuralLLMEntityExtractionOutputFailure,
} from "@repo/console-validation";

export const llmEntityExtractionWorkflow = inngest.createFunction(
  {
    id: "apps-console/neural.llm-entity-extraction",
    name: "Neural: LLM Entity Extraction",
    retries: 2,
    debounce: {
      key: "event.data.observationId",
      period: "1m",
    },

    // Handle failures gracefully - complete job as failed
    onFailure: createNeuralOnFailureHandler(
      "apps-console/neural/llm-entity-extraction.requested",
      {
        logMessage: "Neural LLM entity extraction failed",
        logContext: ({ workspaceId, observationId }) => ({ workspaceId, observationId }),
        buildOutput: ({ data: { observationId }, error }) => ({
          inngestFunctionId: "neural.llm-entity-extraction",
          status: "failure",
          observationId,
          error,
        } satisfies NeuralLLMEntityExtractionOutputFailure),
      },
    ),
  },
  { event: "apps-console/neural/llm-entity-extraction.requested" },
  async ({ event, step }) => {
    const { workspaceId, observationId } = event.data;
    const config = LLM_ENTITY_EXTRACTION_CONFIG;

    // Resolve clerkOrgId from workspace (not in event data for this workflow)
    const clerkOrgId = await step.run("resolve-clerk-org-id", async () => {
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { clerkOrgId: true },
      });
      return workspace?.clerkOrgId ?? "";
    });

    // Create job record for tracking
    const inngestRunId = event.id ?? `neural-llm-entity-${observationId}-${Date.now()}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId,
        inngestFunctionId: "neural.llm-entity-extraction",
        name: `LLM entities: ${observationId}`,
        trigger: "webhook",
        input: {
          inngestFunctionId: "neural.llm-entity-extraction",
          observationId,
          contentLength: 0, // Will be determined after fetch
        } satisfies NeuralLLMEntityExtractionInput,
      });
    });

    // Update job status to running
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

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
      // Complete job as skipped (observation_not_found)
      await step.run("complete-job-skipped-not-found", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.llm-entity-extraction",
            status: "skipped",
            reason: "observation_not_found",
          } satisfies NeuralLLMEntityExtractionOutputSkipped,
        });
      });

      return { status: "skipped", reason: "observation_not_found" };
    }

    // Skip if content too short
    const content = observation.content;
    const contentLength = content.length;
    if (contentLength < config.minContentLength) {
      // Complete job as skipped (content_too_short)
      await step.run("complete-job-skipped-short", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.llm-entity-extraction",
            status: "skipped",
            observationId,
            reason: "content_too_short",
          } satisfies NeuralLLMEntityExtractionOutputSkipped,
        });
      });

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
      // Complete job with zero entities (success, but nothing to store)
      await step.run("complete-job-no-entities", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.llm-entity-extraction",
            status: "success",
            observationId,
            entitiesExtracted: 0,
            entitiesStored: 0,
          } satisfies NeuralLLMEntityExtractionOutputSuccess,
        });
      });

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

    // Complete job with success output
    await step.run("complete-job-success", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          inngestFunctionId: "neural.llm-entity-extraction",
          status: "success",
          observationId,
          entitiesExtracted: entities.length,
          entitiesStored: storedCount,
        } satisfies NeuralLLMEntityExtractionOutputSuccess,
      });
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
