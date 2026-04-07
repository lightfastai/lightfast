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

import { db } from "@db/app/client";
import {
  orgEntities,
  orgEventEntities,
  orgEvents,
  orgIntegrations,
} from "@db/app/schema";
import type { ProviderConfig } from "@repo/app-providers";
import { deriveObservationType, getBaseEventType } from "@repo/app-providers";
import type {
  EntityCategory,
  EventCaptureInput,
  EventCaptureOutputFailure,
  EventCaptureOutputFiltered,
  EventCaptureOutputSuccess,
  ExtractedEntity,
} from "@repo/app-validation";
import { NonRetriableError } from "@vendor/inngest";
import { log } from "@vendor/observability/log/next";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  extractEntities,
  extractFromRelations,
} from "../../lib/entity-extraction-patterns";
import { completeJob, createJob, updateJobStatus } from "../../lib/jobs";
import { scoreSignificance } from "../../lib/scoring";
import { inngest } from "../client";
import { createNeuralOnFailureHandler } from "../on-failure-handler";

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
 * Event store workflow
 *
 * Fast path: stores facts only. No LLM, no embeddings.
 * Emits entity.upserted to trigger the entity-graph -> entity-embed chain.
 */
export const platformEventStore = inngest.createFunction(
  {
    id: "platform/event.store",
    name: "Event Store",
    description: "Stores engineering events (fast path)",
    retries: 3,

    // Idempotency by org + source ID to prevent duplicate observations per org
    idempotency:
      "event.data.clerkOrgId + '-' + event.data.sourceEvent.sourceId",

    // Concurrency limit per org
    concurrency: {
      limit: 10,
      key: "event.data.clerkOrgId",
    },

    timeouts: {
      start: "1m",
      finish: "2m",
    },

    // Handle failures gracefully - complete job as failed
    onFailure: createNeuralOnFailureHandler("platform/event.capture", {
      logMessage: "Neural observation store failed",
      logContext: ({ clerkOrgId, sourceEvent }) => ({
        clerkOrgId,
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
  { event: "platform/event.capture" },
  async ({ event, step }) => {
    const { clerkOrgId, sourceEvent, ingestLogId, correlationId } = event.data;

    // Generate replay-safe values inside steps so they're memoized across retries.
    const { externalId, startTime } = await step.run(
      "generate-replay-safe-ids",
      () => ({
        externalId: nanoid(),
        startTime: Date.now(),
      })
    );

    // Step 0: Create job record for tracking
    const inngestRunId =
      event.id ?? `neural-obs-${sourceEvent.sourceId}-${startTime}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        inngestRunId,
        inngestFunctionId: "platform/event.capture",
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
      const obs = await db.query.orgEvents.findFirst({
        where: and(
          eq(orgEvents.clerkOrgId, clerkOrgId),
          eq(orgEvents.sourceId, sourceEvent.sourceId)
        ),
      });

      if (obs) {
        log.info("observation already exists, skipping", {
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
        log.info("no resource ID, rejecting event", {
          eventType: sourceEvent.eventType,
        });
        return {
          allowed: false as const,
          reason: "event_not_allowed" as const,
        };
      }

      const integration = await db.query.orgIntegrations.findFirst({
        where: and(
          eq(orgIntegrations.clerkOrgId, clerkOrgId),
          eq(orgIntegrations.providerResourceId, resourceId)
        ),
      });

      if (!integration) {
        log.info("integration not found, rejecting event", {
          resourceId,
        });
        return {
          allowed: false as const,
          reason: "event_not_allowed" as const,
        };
      }

      // Gate 2: check integration is active
      if (integration.status !== "active") {
        log.info("integration not active, rejecting (Gate 2)", {
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
        log.info("event filtered by provider config", {
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
      // confidence so entity-embed can always find it by (clerkOrgId, category, key).
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
        const existingEntity = entityMap.get(key);
        if (!existingEntity || existingEntity.confidence < entity.confidence) {
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
        .insert(orgEvents)
        .values({
          externalId,
          clerkOrgId,
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

      log.info("observation stored", {
        observationId: obs.id,
        externalId: obs.externalId,
        observationType,
        ingestLogId,
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
              .insert(orgEntities)
              .values({
                clerkOrgId,
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
                  orgEntities.clerkOrgId,
                  orgEntities.category,
                  orgEntities.key,
                ],
                set: {
                  lastSeenAt: sql`GREATEST(${orgEntities.lastSeenAt}, excluded.${sql.identifier(orgEntities.lastSeenAt.name)})`,
                  occurrenceCount: sql`${orgEntities.occurrenceCount} + 1`,
                  updatedAt: new Date().toISOString(),
                  state: sql`CASE WHEN excluded.${sql.identifier(orgEntities.lastSeenAt.name)} > ${orgEntities.lastSeenAt} THEN excluded.${sql.identifier(orgEntities.state.name)} ELSE ${orgEntities.state} END`,
                  url: sql`COALESCE(excluded.${sql.identifier(orgEntities.url.name)}, ${orgEntities.url})`,
                },
              })
              .returning({
                id: orgEntities.id,
                externalId: orgEntities.externalId,
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
              clerkOrgId,
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
            .insert(orgEventEntities)
            .values(junctionRows)
            .onConflictDoNothing();
        }

        log.info("entities and junctions stored", {
          observationId: observation.id,
          entitiesStored: junctionRows.length,
          ingestLogId,
        });

        // Publish to Upstash Realtime for live entity list + entity detail pages
        if (primaryEntityExternalId) {
          const { realtime } = await import("@repo/app-upstash-realtime");
          const channel = realtime.channel(`org-${clerkOrgId}`);

          // 1. Entity list live prepend
          await channel.emit("org.entity", {
            entityExternalId: primaryEntityExternalId,
            clerkOrgId,
            category: sourceEvent.entity.entityType as EntityCategory,
            key: sourceEvent.entity.entityId,
            value: null,
            state: sourceEvent.entity.state ?? null,
            url: sourceEvent.entity.url ?? null,
            occurrenceCount: 1, // Approximate — real count is in DB
            lastSeenAt: sourceEvent.occurredAt,
          });

          // 2. Entity detail page live prepend
          await channel.emit("org.entityEvent", {
            entityExternalId: primaryEntityExternalId,
            clerkOrgId,
            eventId: observation.id,
            eventExternalId: observation.externalId,
            observationType: observation.observationType,
            title: observation.title,
            source: observation.source,
            sourceType: observation.sourceType,
            sourceId: observation.sourceId,
            significanceScore: observation.significanceScore,
            occurredAt: observation.occurredAt,
            refLabel: null,
          });

          log.info("entity realtime published", {
            entityExternalId: primaryEntityExternalId,
            observationId: observation.id,
          });
        }

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
        name: "platform/entity.upserted" as const,
        data: {
          clerkOrgId,
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
      name: "platform/event.stored" as const,
      data: {
        clerkOrgId,
        eventExternalId: observation.externalId,
        sourceType: sourceEvent.eventType,
        significanceScore: significance.score,
        correlationId,
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
