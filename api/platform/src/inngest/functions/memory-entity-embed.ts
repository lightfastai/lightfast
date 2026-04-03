/**
 * Entity embed workflow
 *
 * Subscribes to entity.graphed (NOT entity.upserted) so that graph edges are
 * committed before the narrative is built. This avoids the race condition where
 * concurrent entity-embed and entity-graph functions both start from the same
 * entity.upserted event and entity-embed reads stale edges.
 *
 * Debounced per entity: burst events collapse into a single embed call.
 */

import { buildOrgNamespace } from "@db/app";
import { db } from "@db/app/client";
import {
  orgEntities,
  orgEntityEdges,
  orgEventEntities,
  orgEvents,
} from "@db/app/schema";
import type { EntityVectorMetadata } from "@repo/app-validation";
import { EMBEDDING_DEFAULTS } from "@repo/app-validation";
import { NonRetriableError } from "@vendor/inngest";
import { log } from "@vendor/observability/log/next";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  buildEntityNarrative,
  narrativeHash,
} from "../../lib/narrative-builder";
import { inngest } from "../client";
import { createNeuralOnFailureHandler } from "../on-failure-handler";

/**
 * Hard character cap applied to the narrative before embedding.
 *
 * Cohere embed-english-v3.0 has a 512-token context window. English text
 * averages ~4 chars/token, so 512 tokens ~ 2,048 chars. We cap at 1,800
 * (~ 450 tokens) to leave a 62-token safety buffer and accommodate any
 * non-English content in entity keys or values.
 *
 * The narrative sections are ordered most-important-first (identity ->
 * genesis -> temporal span -> recent events -> graph edges), so if the cap
 * ever fires, it discards from the least-important tail.
 *
 * @see vendor/embed/src/provider/cohere.ts — truncate: "NONE" will surface
 * an error if this cap fails to hold (e.g. a very long entity.value in
 * Section 1).
 */
const NARRATIVE_CHAR_CAP = 1800;

export const memoryEntityEmbed = inngest.createFunction(
  {
    id: "memory/entity.embed",
    name: "Entity Embed",
    description:
      "Builds entity narrative and upserts to Pinecone (layer=entities)",
    debounce: {
      // Collapse burst events for the same entity into one embed call
      key: "event.data.entityExternalId",
      period: "30s",
    },
    retries: 3,
    timeouts: { finish: "2m" },
    onFailure: createNeuralOnFailureHandler("memory/entity.graphed"),
  },
  { event: "memory/entity.graphed" },
  async ({ event, step }) => {
    const { clerkOrgId, entityExternalId, provider, correlationId } =
      event.data;

    log.info("[entity-embed] starting", {
      clerkOrgId,
      entityExternalId,
      provider,
      correlationId,
    });

    // Step 1: Fetch all narrative inputs in a single step.
    // Throws NonRetriableError for missing rows so Inngest does not retry infinitely.
    const entity = await step.run("fetch-entity", async () => {
      const row = await db.query.orgEntities.findFirst({
        where: eq(orgEntities.externalId, entityExternalId),
        columns: {
          id: true,
          externalId: true,
          category: true,
          key: true,
          value: true,
          extractedAt: true,
          lastSeenAt: true,
          occurrenceCount: true,
        },
      });
      if (!row) {
        log.warn("[entity-embed] entity not found, aborting", {
          entityExternalId,
          correlationId,
        });
        throw new NonRetriableError(`Entity not found: ${entityExternalId}`);
      }
      return row;
    });

    const [genesisResults, recentEvents, edges, maxSignificanceResults] =
      await step.run("fetch-narrative-inputs", async () => {
        return Promise.all([
          // Genesis event (first ever — founding context, never lost)
          db
            .select({
              title: orgEvents.title,
              sourceType: orgEvents.sourceType,
              occurredAt: orgEvents.occurredAt,
            })
            .from(orgEventEntities)
            .innerJoin(orgEvents, eq(orgEventEntities.eventId, orgEvents.id))
            .where(eq(orgEventEntities.entityId, entity.id))
            .orderBy(asc(orgEvents.occurredAt))
            .limit(1),

          // Last 3 events (recency signal + current state)
          db
            .select({
              title: orgEvents.title,
              sourceType: orgEvents.sourceType,
              occurredAt: orgEvents.occurredAt,
            })
            .from(orgEventEntities)
            .innerJoin(orgEvents, eq(orgEventEntities.eventId, orgEvents.id))
            .where(eq(orgEventEntities.entityId, entity.id))
            .orderBy(desc(orgEvents.occurredAt))
            .limit(3),

          // Graph edges — both outgoing and incoming, mapped to "related entity".
          // LIMIT 3 per direction: each edge line is ~180 chars / ~45 tokens.
          // See NARRATIVE_CHAR_CAP for the full token budget reasoning.
          db
            .select({
              relationshipType: orgEntityEdges.relationshipType,
              targetCategory: orgEntities.category,
              targetKey: orgEntities.key,
            })
            .from(orgEntityEdges)
            .innerJoin(
              orgEntities,
              eq(orgEntityEdges.targetEntityId, orgEntities.id)
            )
            .where(eq(orgEntityEdges.sourceEntityId, entity.id))
            .limit(3)
            .union(
              db
                .select({
                  relationshipType: orgEntityEdges.relationshipType,
                  targetCategory: orgEntities.category,
                  targetKey: orgEntities.key,
                })
                .from(orgEntityEdges)
                .innerJoin(
                  orgEntities,
                  eq(orgEntityEdges.sourceEntityId, orgEntities.id)
                )
                .where(eq(orgEntityEdges.targetEntityId, entity.id))
                .limit(3)
            ),

          // Max significance score across all events for this entity
          db
            .select({
              max: sql<number>`MAX(${orgEvents.significanceScore})`,
            })
            .from(orgEventEntities)
            .innerJoin(orgEvents, eq(orgEventEntities.eventId, orgEvents.id))
            .where(eq(orgEventEntities.entityId, entity.id)),
        ]);
      });

    const genesisEvent = genesisResults[0] ?? null;
    const maxSignificanceScore = maxSignificanceResults[0]?.max ?? 0;

    // Build narrative text and hash outside of a step (CPU-only, no I/O)
    const narrative = buildEntityNarrative(
      entity,
      genesisEvent,
      recentEvents,
      edges
    );
    const hash = narrativeHash(narrative);
    const latestEvent = recentEvents[0];

    // Cap the narrative to NARRATIVE_CHAR_CAP characters before embedding.
    // Sections are ordered most-important-first; the cap discards from the tail.
    // truncate: "NONE" in the Cohere provider will surface an error if this cap
    // ever fails to hold (e.g. an unusually long entity.value in Section 1).
    const cappedNarrative = narrative.slice(0, NARRATIVE_CHAR_CAP);
    if (narrative.length > NARRATIVE_CHAR_CAP) {
      log.warn("[entity-embed] narrative capped", {
        entityExternalId,
        original: narrative.length,
        cap: NARRATIVE_CHAR_CAP,
        correlationId,
      });
    }

    // Step 2: Embed the narrative using constants
    const embedding = await step.run("embed-narrative", async () => {
      const { createEmbeddingProviderForOrg } = await import("@repo/app-embed");
      const embeddingProvider = createEmbeddingProviderForOrg(
        {
          id: clerkOrgId,
          embeddingModel: EMBEDDING_DEFAULTS.embeddingModel,
          embeddingDim: EMBEDDING_DEFAULTS.embeddingDim,
        },
        { inputType: "search_document" }
      );

      const { embeddings } = await embeddingProvider.embed([cappedNarrative]);
      const vector = embeddings[0];
      if (!vector) {
        log.error("[entity-embed] embedding provider returned no vector", {
          entityExternalId,
          correlationId,
        });
        throw new Error("Embedding provider returned no vector");
      }
      return vector;
    });

    // Step 3: UPSERT single entity vector to Pinecone
    await step.run("upsert-entity-vector", async () => {
      const { consolePineconeClient } = await import("@repo/app-pinecone");
      const indexName = EMBEDDING_DEFAULTS.indexName;
      const namespaceName = buildOrgNamespace(clerkOrgId);

      const metadata: EntityVectorMetadata = {
        layer: "entities",
        entityExternalId: entity.externalId,
        entityType: entity.category,
        provider,
        latestAction: latestEvent?.sourceType.split(".").pop() ?? "",
        title: narrative.split("\n")[0] ?? entity.key,
        snippet: narrative.slice(0, 500),
        // Unix ms timestamps — numeric for reliable Pinecone range filters
        occurredAt: latestEvent
          ? new Date(latestEvent.occurredAt).getTime()
          : Date.now(),
        createdAt: new Date(entity.extractedAt).getTime(),
        narrativeHash: hash,
        totalEvents: entity.occurrenceCount,
        significanceScore: maxSignificanceScore,
      };

      await consolePineconeClient.upsertVectors<EntityVectorMetadata>(
        indexName,
        {
          ids: [`ent_${entity.externalId}`],
          vectors: [embedding],
          metadata: [metadata],
        },
        namespaceName
      );

      log.info("[entity-embed] entity vector upserted", {
        entityExternalId: entity.externalId,
        entityType: entity.category,
        vectorId: `ent_${entity.externalId}`,
        totalEvents: entity.occurrenceCount,
        edgeCount: edges.length,
        narrativeHash: hash,
        correlationId,
      });
    });

    return {
      entityExternalId: entity.externalId,
      narrativeHash: hash,
      totalEvents: entity.occurrenceCount,
      edgeCount: edges.length,
    };
  }
);
