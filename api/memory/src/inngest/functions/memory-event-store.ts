/**
 * Event store workflow (fast path)
 *
 * Stores facts from PostTransformEvents: event row + entities + junction rows.
 * No LLM calls, no embeddings — completes in <2s.
 *
 * Workflow steps:
 * 1. Check for duplicate events (idempotency)
 * 2. Check if event is allowed by source config (filtering)
 * 3. Evaluate significance (stored as metadata, not a gate)
 * 4. Extract entities (structural categories from relations)
 * 5. Store event row
 * 6. Upsert entities + create junction rows
 * 7. Emit entity.upserted (triggers entity-graph -> entity-embed chain)
 * 8. Complete job
 */

import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceEntities,
  workspaceEventEntities,
  workspaceEvents,
  workspaceIntegrations,
} from "@db/console/schema";
import type { ProviderConfig } from "@repo/console-providers";
import {
  deriveObservationType,
  getBaseEventType,
} from "@repo/console-providers";
import type {
  EntityCategory,
  EventCaptureInput,
  EventCaptureOutputFailure,
  EventCaptureOutputFiltered,
  EventCaptureOutputSuccess,
  ExtractedEntity,
} from "@repo/console-validation";
import { NonRetriableError } from "@repo/inngest";
import { log } from "@vendor/observability/log/next";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { completeJob, createJob, updateJobStatus } from "../../lib/jobs";
import { inngest } from "../client";
import {
  extractEntities,
  extractFromRelations,
} from "../../lib/entity-extraction-patterns";
import { createNeuralOnFailureHandler } from "../on-failure-handler";
import { scoreSignificance } from "../../lib/scoring";

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
  providerConfig: ProviderConfig | null | undefined,
  baseEventType: string
): boolean {
  const events = providerConfig?.sync?.events;
  if (!events || events.length === 0) {
    return true;
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
 * Emits entity.upserted to trigger the entity-graph -> entity-embed chain.
 */
export const memoryEventStore = inngest.createFunction(
  {
    id: "memory/event.store",
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
    onFailure: createNeuralOnFailureHandler("memory/event.capture", {
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
  { event: "memory/event.capture" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId: eventClerkOrgId,
      sourceEvent,
      ingestLogId,
      correlationId,
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
      provider: sourceEvent.provider,
      eventType: sourceEvent.eventType,
      sourceId: sourceEvent.sourceId,
      ingestLogId,
      correlationId,
    });

    // Step 0: Create job record for tracking
    const inngestRunId =
      event.id ?? `neural-obs-${sourceEvent.sourceId}-${startTime}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId,
        inngestFunctionId: "memory/event.capture",
        name: `Capture ${sourceEvent.provider}/${sourceEvent.eventType}`,
        trigger: "webhook",
        input: {
          inngestFunctionId: "event.capture",
          sourceId: sourceEvent.sourceId,
          source: sourceEvent.provider,
          sourceType: sourceEvent.eventType,
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
    const gateResult = await step.run("check-event-allowed", async () => {
      const attributes = sourceEvent.attributes;

      let resourceId: string | undefined;
      switch (sourceEvent.provider) {
        case "github":
          resourceId =
            attributes.repoId != null ? String(attributes.repoId) : undefined;
          break;
        case "vercel":
          resourceId =
            attributes.projectId != null
              ? String(attributes.projectId)
              : undefined;
          break;
        case "sentry":
          resourceId =
            attributes.projectId != null
              ? String(attributes.projectId)
              : undefined;
          break;
        case "linear":
          resourceId =
            attributes.teamId != null ? String(attributes.teamId) : undefined;
          break;
        default:
          resourceId = undefined;
      }

      if (!resourceId) {
        log.info("No resource ID in attributes, rejecting event", {
          provider: sourceEvent.provider,
          eventType: sourceEvent.eventType,
        });
        return {
          allowed: false as const,
          reason: "event_not_allowed" as const,
        };
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
          provider: sourceEvent.provider,
        });
        return {
          allowed: false as const,
          reason: "event_not_allowed" as const,
        };
      }

      // Gate 2: check integration is active
      if (integration.status !== "active") {
        log.info("Integration is not active, rejecting event (Gate 2)", {
          workspaceId,
          resourceId,
          provider: sourceEvent.provider,
          integrationStatus: integration.status,
          statusReason: integration.statusReason,
        });
        return {
          allowed: false as const,
          reason: "inactive_connection" as const,
        };
      }

      const baseEventType = getBaseEventType(
        sourceEvent.provider,
        sourceEvent.eventType
      );
      const allowed = isEventAllowed(integration.providerConfig, baseEventType);

      if (!allowed) {
        log.info("Event filtered by provider config", {
          workspaceId,
          resourceId,
          eventType: sourceEvent.eventType,
          baseEventType,
          configuredEvents: integration.providerConfig?.sync?.events,
        });
      }

      return {
        allowed,
        reason: allowed ? ("allowed" as const) : ("event_not_allowed" as const),
      };
    });

    if (!gateResult.allowed) {
      const filteredReason =
        gateResult.reason === "inactive_connection"
          ? ("inactive_connection" as const)
          : ("event_not_allowed" as const);

      await step.run("complete-job-filtered", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "event.capture",
            status: "filtered",
            reason: filteredReason,
            sourceId: sourceEvent.sourceId,
          } satisfies EventCaptureOutputFiltered,
        });
      });

      return {
        status: "filtered",
        reason:
          filteredReason === "inactive_connection"
            ? "Integration is not active"
            : "Event type not enabled in source config",
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Evaluate significance (metadata annotation, not a gate)
    const significance = await step.run("evaluate-significance", () => {
      return scoreSignificance(sourceEvent);
    });

    // Step 4: Extract entities (structural categories from relations)
    const extractedEntities = await step.run("extract-entities", () => {
      const textEntities = extractEntities(sourceEvent.title, sourceEvent.body);
      const refEntities = extractFromRelations(sourceEvent.relations);

      // Primary entity from sourceEvent.entity — always upserted with highest
      // confidence so entity-embed can always find it by (workspaceId, category, key).
      // value is undefined so refLabel on the junction row stays null (it has no
      // relationship-type label — it IS the event's primary subject).
      const primaryEntityExtracted: ExtractedEntity = {
        category: sourceEvent.entity.entityType as EntityCategory,
        key: sourceEvent.entity.entityId,
        value: undefined,
        confidence: 1.0,
        evidence: `Primary entity: ${sourceEvent.entity.entityType}`,
        state: sourceEvent.entity.state ?? undefined,
        url: sourceEvent.entity.url ?? undefined,
      };

      // Primary entity first — Map insertion order preserved, so it is always
      // at index 0 of deduplicated (used to retrieve externalId after upsert).
      const allEntities = [
        primaryEntityExtracted,
        ...textEntities,
        ...refEntities,
      ];
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

    // Step 5: Store observation row
    const observation = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(
        sourceEvent.provider,
        sourceEvent.eventType
      );

      const [obs] = await db
        .insert(workspaceEvents)
        .values({
          externalId,
          workspaceId,
          occurredAt: sourceEvent.occurredAt,
          observationType,
          title: sourceEvent.title,
          content: sourceEvent.body,
          source: sourceEvent.provider,
          sourceType: sourceEvent.eventType,
          sourceId: sourceEvent.sourceId,
          sourceReferences: sourceEvent.relations,
          metadata: sourceEvent.attributes,
          ingestionSource: event.data.ingestionSource ?? "webhook",
          ingestLogId: ingestLogId ?? null,
          significanceScore: significance.score,
        })
        .returning();

      if (!obs) {
        throw new NonRetriableError("Failed to insert observation");
      }

      log.info("Observation stored", {
        observationId: obs.id,
        externalId: obs.externalId,
        observationType,
        ingestLogId,
        correlationId,
      });

      return obs;
    });

    // Step 6: Upsert entities and create junction rows
    const entityUpsertResult = await step.run(
      "upsert-entities-and-junctions",
      async () => {
        if (extractedEntities.length === 0) {
          return { count: 0, primaryEntityExternalId: null as string | null };
        }

        // Upsert each entity and get back its ID + externalId for junction inserts.
        // externalId is needed to emit entity.upserted with the stable Pinecone vector key.
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
                state: entity.state ?? null,
                url: entity.url ?? null,
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
                  state: sql`EXCLUDED.state`,
                  url: sql`COALESCE(EXCLUDED.url, ${workspaceEntities.url})`,
                },
              })
              .returning({
                id: workspaceEntities.id,
                externalId: workspaceEntities.externalId,
              })
          )
        );

        // Primary entity is always at index 0 (inserted first in extractedEntities,
        // Map insertion order preserved, and confidence 1.0 ensures it wins dedup).
        const primaryEntityExternalId =
          entityResults[0]?.[0]?.externalId ?? null;

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
              category: entity.category,
              // Only structural ref entities carry a contextual relationship label.
              // The primary entity (index 0) has value=undefined -> refLabel=null.
              refLabel: STRUCTURAL_TYPES.has(entity.category)
                ? (entity.value ?? null)
                : null,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (junctionRows.length > 0) {
          await db
            .insert(workspaceEventEntities)
            .values(junctionRows)
            .onConflictDoNothing();
        }

        log.info("Entities and junctions stored", {
          observationId: observation.id,
          entitiesStored: junctionRows.length,
          ingestLogId,
          correlationId,
        });

        return { count: junctionRows.length, primaryEntityExternalId };
      }
    );

    // Build entity refs for entity-graph downstream step.
    const entityRefs = [
      {
        type: sourceEvent.entity.entityType,
        key: sourceEvent.entity.entityId,
        label: null,
      },
      ...sourceEvent.relations.map((rel) => ({
        type: rel.entityType,
        key: rel.entityId,
        label: rel.relationshipType,
      })),
    ];

    // Step 7: Emit entity.upserted (triggers entity-graph -> entity-embed chain)
    if (entityUpsertResult.primaryEntityExternalId) {
      await step.sendEvent("emit-downstream-events", {
        name: "memory/entity.upserted" as const,
        data: {
          workspaceId,
          entityExternalId: entityUpsertResult.primaryEntityExternalId,
          entityType: sourceEvent.entity.entityType,
          provider: sourceEvent.provider,
          internalEventId: observation.id,
          entityRefs,
          occurredAt: sourceEvent.occurredAt,
          correlationId,
        },
      });
    }

    // Step 7b: Emit event.stored (triggers notification dispatch)
    await step.sendEvent("emit-event-stored", {
      name: "memory/event.stored" as const,
      data: {
        workspaceId,
        clerkOrgId,
        eventExternalId: observation.externalId,
        sourceType: sourceEvent.eventType,
        significanceScore: significance.score,
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
          entitiesExtracted: entityUpsertResult.count,
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
