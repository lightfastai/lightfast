/**
 * Event store workflow (fast path)
 *
 * Stores facts from PostTransformEvents: event row + entities + junction rows.
 * No LLM calls, no embeddings — completes in <2s.
 *
 * Workflow steps:
 * 1. Check for duplicate events (idempotency)
 * 2. Check if event is allowed by source config (filtering)
 * 3. Evaluate significance (GATE - return early if below threshold)
 * 4. Extract entities (structural categories from updated extractFromReferences)
 * 5. Store event row (null for interpretation columns)
 * 6. Upsert entities + create junction rows
 * 7. Emit event.stored (triggers interpretation slow path)
 * 8. Complete job
 */

import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceEntities,
  workspaceEntityEvents,
  workspaceEvents,
  workspaceIntegrations,
} from "@db/console/schema";
import {
  deriveObservationType,
  getBaseEventType,
} from "@repo/console-providers";
import type {
  EventCaptureInput,
  EventCaptureOutputFailure,
  EventCaptureOutputFiltered,
  EventCaptureOutputSuccess,
  ExtractedEntity,
} from "@repo/console-validation";
import { log } from "@vendor/observability/log";
import { and, eq, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { nanoid } from "nanoid";
import { completeJob, createJob, updateJobStatus } from "../../../lib/jobs";
import { inngest } from "../../client/client";
import {
  extractEntities,
  extractFromReferences,
} from "./entity-extraction-patterns";
import { createNeuralOnFailureHandler } from "./on-failure-handler";
import { SIGNIFICANCE_THRESHOLD, scoreSignificance } from "./scoring";

const STRUCTURAL_TYPES = new Set([
  "commit",
  "branch",
  "pr",
  "issue",
  "deployment",
]);

/**
 * Check if an event type is allowed for a source based on providerConfig.sync.events
 */
function isEventAllowed(
  providerConfig: { sync?: { events?: string[] } } | null | undefined,
  baseEventType: string
): boolean {
  const events = providerConfig?.sync?.events;
  if (!events || events.length === 0) {
    return false;
  }
  return events.includes(baseEventType);
}

/**
 * Resolve clerkOrgId from event data or database.
 *
 * New events include clerkOrgId from webhook handler.
 * Legacy events (or edge cases) fallback to database lookup.
 *
 * @returns clerkOrgId or empty string if workspace not found
 */
async function resolveClerkOrgId(
  eventClerkOrgId: string | undefined,
  workspaceId: string
): Promise<string> {
  if (eventClerkOrgId) {
    return eventClerkOrgId;
  }

  log.warn("clerkOrgId fallback to DB lookup", {
    workspaceId,
    reason: "event_missing_clerkOrgId",
  });

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });

  return workspace?.clerkOrgId ?? "";
}

/**
 * Event store workflow
 *
 * Fast path: stores facts only. No LLM, no embeddings.
 * Emits event.stored to trigger the interpret workflow.
 */
export const eventStore = inngest.createFunction(
  {
    id: "apps-console/event.store",
    name: "Event Store",
    description: "Stores engineering events (fast path)",
    retries: 3,

    // Idempotency by workspace + source ID to prevent duplicate observations per workspace
    idempotency:
      "event.data.workspaceId + '-' + event.data.sourceEvent.sourceId",

    // Concurrency limit per workspace
    concurrency: {
      limit: 10,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "1m",
      finish: "2m",
    },

    // Handle failures gracefully - complete job as failed
    onFailure: createNeuralOnFailureHandler("apps-console/event.capture", {
      logMessage: "Neural observation store failed",
      logContext: ({ workspaceId, sourceEvent }) => ({
        workspaceId,
        sourceId: sourceEvent.sourceId,
      }),
      buildOutput: ({ data: { sourceEvent }, error }) =>
        ({
          inngestFunctionId: "event.capture",
          status: "failure",
          sourceId: sourceEvent.sourceId,
          error,
        }) satisfies EventCaptureOutputFailure,
    }),
  },
  { event: "apps-console/event.capture" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId: eventClerkOrgId,
      sourceEvent,
    } = event.data;

    // Generate replay-safe values inside steps so they're memoized across retries.
    const { externalId, startTime } = await step.run(
      "generate-replay-safe-ids",
      () => ({
        externalId: nanoid(),
        startTime: Date.now(),
      })
    );

    const clerkOrgId = await step.run("resolve-clerk-org-id", async () => {
      return resolveClerkOrgId(eventClerkOrgId, workspaceId);
    });

    log.info("Storing neural observation", {
      workspaceId,
      clerkOrgId,
      externalId,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      sourceId: sourceEvent.sourceId,
    });

    // Step 0: Create job record for tracking
    const inngestRunId =
      event.id ?? `neural-obs-${sourceEvent.sourceId}-${startTime}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId,
        inngestFunctionId: "event.capture",
        name: `Capture ${sourceEvent.source}/${sourceEvent.sourceType}`,
        trigger: "webhook",
        input: {
          inngestFunctionId: "event.capture",
          sourceId: sourceEvent.sourceId,
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          title: sourceEvent.title,
        } satisfies EventCaptureInput,
      });
    });

    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 1: Check for duplicate
    const existing = await step.run("check-duplicate", async () => {
      const obs = await db.query.workspaceEvents.findFirst({
        where: and(
          eq(workspaceEvents.workspaceId, workspaceId),
          eq(workspaceEvents.sourceId, sourceEvent.sourceId)
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
      await step.run("complete-job-duplicate", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "event.capture",
            status: "filtered",
            reason: "duplicate",
            sourceId: sourceEvent.sourceId,
          } satisfies EventCaptureOutputFiltered,
        });
      });

      return {
        status: "duplicate",
        observationId: existing.id,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Check if event is allowed by source config
    const eventAllowed = await step.run("check-event-allowed", async () => {
      const metadata = sourceEvent.metadata;

      let resourceId: string | undefined;
      switch (sourceEvent.source) {
        case "github":
          resourceId = (metadata.repoId as string | undefined)?.toString();
          break;
        case "vercel":
          resourceId = (metadata.projectId as string | undefined)?.toString();
          break;
        case "sentry":
          resourceId = (metadata.projectId as string | undefined)?.toString();
          break;
        case "linear":
          resourceId = (metadata.teamId as string | undefined)?.toString();
          break;
        default:
          resourceId = undefined;
      }

      if (!resourceId) {
        log.info("No resource ID in metadata, rejecting event", {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
        });
        return false;
      }

      const integration = await db.query.workspaceIntegrations.findFirst({
        where: and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(workspaceIntegrations.providerResourceId, resourceId)
        ),
      });

      if (!integration) {
        log.info("Integration not found for resource, rejecting event", {
          workspaceId,
          resourceId,
          source: sourceEvent.source,
        });
        return false;
      }

      const baseEventType = getBaseEventType(
        sourceEvent.source,
        sourceEvent.sourceType
      );
      const providerConfig = integration.providerConfig as {
        sync?: { events?: string[] };
      };
      const allowed = isEventAllowed(providerConfig, baseEventType);

      if (!allowed) {
        log.info("Event filtered by provider config", {
          workspaceId,
          resourceId,
          sourceType: sourceEvent.sourceType,
          baseEventType,
          configuredEvents: providerConfig.sync?.events,
        });
      }

      return allowed;
    });

    if (!eventAllowed) {
      await step.run("complete-job-filtered", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "event.capture",
            status: "filtered",
            reason: "event_not_allowed",
            sourceId: sourceEvent.sourceId,
          } satisfies EventCaptureOutputFiltered,
        });
      });

      return {
        status: "filtered",
        reason: "Event type not enabled in source config",
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Evaluate significance (early gate)
    const significance = await step.run("evaluate-significance", () => {
      return scoreSignificance(sourceEvent);
    });

    if (significance.score < SIGNIFICANCE_THRESHOLD) {
      log.info("Observation below significance threshold, skipping", {
        workspaceId,
        sourceId: sourceEvent.sourceId,
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        factors: significance.factors,
      });

      await step.run("complete-job-below-threshold", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "event.capture",
            status: "filtered",
            reason: "below_threshold",
            sourceId: sourceEvent.sourceId,
            significanceScore: significance.score,
          } satisfies EventCaptureOutputFiltered,
        });
      });

      return {
        status: "below_threshold",
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        duration: Date.now() - startTime,
      };
    }

    // Step 4: Extract entities (structural categories from updated extractFromReferences)
    const extractedEntities = await step.run("extract-entities", () => {
      const textEntities = extractEntities(sourceEvent.title, sourceEvent.body);
      const references = sourceEvent.references as {
        type: string;
        id: string;
        label?: string;
      }[];
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

      const deduplicated = Array.from(entityMap.values());
      return deduplicated.slice(0, 50); // MAX_ENTITIES_PER_OBSERVATION
    });

    // Step 5: Store observation row (null for interpretation columns)
    const observation = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(
        sourceEvent.source,
        sourceEvent.sourceType
      );

      const [obs] = await db
        .insert(workspaceEvents)
        .values({
          externalId,
          workspaceId,
          occurredAt: sourceEvent.occurredAt,
          actor: sourceEvent.actor ?? null,
          observationType,
          title: sourceEvent.title,
          content: sourceEvent.body,
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          sourceId: sourceEvent.sourceId,
          sourceReferences: sourceEvent.references,
          metadata: sourceEvent.metadata,
          ingestionSource: event.data.ingestionSource ?? "webhook",
        })
        .returning();

      if (!obs) {
        throw new NonRetriableError("Failed to insert observation");
      }

      log.info("Observation stored", {
        observationId: obs.id,
        externalId: obs.externalId,
        observationType,
      });

      return obs;
    });

    // Step 6: Upsert entities and create junction rows
    const entitiesStored = await step.run(
      "upsert-entities-and-junctions",
      async () => {
        if (extractedEntities.length === 0) {
          return 0;
        }

        // Upsert each entity and get back its ID for junction inserts
        const entityResults = await Promise.all(
          extractedEntities.map((entity) =>
            db
              .insert(workspaceEntities)
              .values({
                workspaceId,
                category: entity.category,
                key: entity.key,
                value: entity.value,
                evidenceSnippet: entity.evidence,
                confidence: entity.confidence,
              })
              .onConflictDoUpdate({
                target: [
                  workspaceEntities.workspaceId,
                  workspaceEntities.category,
                  workspaceEntities.key,
                ],
                set: {
                  lastSeenAt: new Date().toISOString(),
                  occurrenceCount: sql`${workspaceEntities.occurrenceCount} + 1`,
                  updatedAt: new Date().toISOString(),
                },
              })
              .returning({ id: workspaceEntities.id })
          )
        );

        // Create junction rows mapping entities to this observation
        const junctionRows = entityResults
          .map((result, i) => {
            const entityId = result[0]?.id;
            if (entityId === undefined) {
              return null;
            }
            const entity = extractedEntities[i]!;
            return {
              entityId,
              eventId: observation.id,
              workspaceId,
              // Only structural ref entities carry a contextual label
              refLabel: STRUCTURAL_TYPES.has(entity.category)
                ? (entity.value ?? null)
                : null,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (junctionRows.length > 0) {
          await db
            .insert(workspaceEntityEvents)
            .values(junctionRows)
            .onConflictDoNothing();
        }

        log.info("Entities and junctions stored", {
          observationId: observation.id,
          entitiesStored: junctionRows.length,
        });

        return junctionRows.length;
      }
    );

    // Build structural entity refs for the event.stored event
    // (used by event-interpret for edge resolution)
    const entityRefs = extractedEntities
      .filter((e) => STRUCTURAL_TYPES.has(e.category))
      .map((e) => ({
        type: e.category,
        key: e.key,
        label: e.value ?? null,
      }));

    // Step 7: Emit event.stored to trigger the slow path
    await step.sendEvent("emit-event-stored", {
      name: "apps-console/event.stored" as const,
      data: {
        eventExternalId: observation.externalId,
        workspaceId,
        clerkOrgId,
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        significanceScore: significance.score,
        entityRefs,
        internalEventId: observation.id,
      },
    });

    // Step 8: Complete job with success output
    const finalDuration = Date.now() - startTime;
    await step.run("complete-job-success", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          inngestFunctionId: "event.capture",
          status: "success",
          observationId: observation.externalId,
          observationType: observation.observationType,
          significanceScore: significance.score,
          entitiesExtracted: entitiesStored,
        } satisfies EventCaptureOutputSuccess,
      });
    });

    return {
      status: "stored",
      observationId: observation.externalId,
      observationType: observation.observationType,
      duration: finalDuration,
    };
  }
);
