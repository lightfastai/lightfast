/**
 * Entity graph workflow
 *
 * Subscribes to entity.upserted, resolves entity↔entity edges via the
 * co-occurrence algorithm, then emits entity.graphed so entity-embed can
 * build its narrative with up-to-date graph context.
 *
 * Extracted from event-interpret.ts — graph resolution has no LLM dependency
 * and should not be blocked by classification latency.
 */

import { log } from "@vendor/observability/log/next";
import { inngest } from "../../client/client";
import { resolveEdges } from "./edge-resolver";

export const entityGraph = inngest.createFunction(
  {
    id: "apps-console/entity.graph",
    name: "Entity Graph",
    description: "Resolves entity edges after upsert (fast, pure SQL)",
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "apps-console/entity.upserted" },
  async ({ event, step }) => {
    const {
      workspaceId,
      internalEventId,
      provider,
      entityRefs,
      correlationId,
    } = event.data;

    const edgeCount = await step.run("resolve-edges", () =>
      resolveEdges(workspaceId, internalEventId, provider, entityRefs)
    );

    log.info("[entity-graph] edges resolved", {
      workspaceId,
      internalEventId,
      provider,
      entityExternalId: event.data.entityExternalId,
      edgeCount,
      correlationId,
    });

    await step.sendEvent("emit-entity-graphed", {
      name: "apps-console/entity.graphed" as const,
      data: {
        workspaceId,
        entityExternalId: event.data.entityExternalId,
        entityType: event.data.entityType,
        provider,
        occurredAt: event.data.occurredAt,
        correlationId,
      },
    });

    return { edgeCount };
  }
);
