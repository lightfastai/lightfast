import { sentryMiddleware } from "@inngest/middleware-sentry";
import { postTransformEventSchema } from "@repo/console-providers";
import { ingestionSourceSchema } from "@repo/console-validation";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";
import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

/**
 * Inngest event schemas for console application
 *
 * Events are organized by:
 * 1. Activity Tracking Events
 * 2. Event Pipeline (capture → store → entity graph → entity embed)
 * 3. Notification Events
 */
const eventsMap = {
  // ============================================================================
  // USER ACTIVITY TRACKING EVENTS
  // ============================================================================

  "apps-console/activity.record": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Activity category */
    category: z.enum([
      "auth",
      "workspace",
      "integration",
      "store",
      "job",
      "search",
      "document",
      "permission",
      "api_key",
      "settings",
    ]),
    /** Action performed */
    action: z.string(),
    /** Entity type (e.g., "workspace", "integration", "api_key") */
    entityType: z.string(),
    /** Entity ID */
    entityId: z.string(),
    /** Additional metadata */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Related activity ID (for grouping related actions) */
    relatedActivityId: z.string().optional(),
    /** Timestamp of the activity (ISO string) */
    timestamp: z.string().datetime(),
  }),

  // ============================================================================
  // EVENT PIPELINE
  // ============================================================================

  "apps-console/event.capture": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (optional for backwards compat, resolved at webhook handler) */
    clerkOrgId: z.string().optional(),
    /** Standardized source event */
    sourceEvent: postTransformEventSchema,
    /** How this event was ingested (webhook, backfill, manual, api). Defaults to "webhook" in the consumer. */
    ingestionSource: ingestionSourceSchema.optional(),
    /** FK back to workspaceIngestLogs.id — null for backfill and test-data paths */
    ingestLogId: z.number().optional(),
    /** Correlation ID from the upstream delivery — for log tracing */
    correlationId: z.string().optional(),
  }),

  /**
   * Emitted by event-store after an observation is stored successfully.
   * Consumed by notificationDispatch to trigger Knock notifications for
   * high-significance events (score >= 70).
   */
  "apps-console/event.stored": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    /** Event type string (e.g. "pull_request_merged") */
    sourceType: z.string(),
    significanceScore: z.number(),
  }),

  // ============================================================================
  // ENTITY PIPELINE (chained from event pipeline)
  // ============================================================================

  /**
   * Emitted by event-store after a primary entity is upserted.
   * Carries internalEventId + entityRefs so entity-graph can call resolveEdges()
   * without an extra DB lookup.
   */
  "apps-console/entity.upserted": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    /** Internal workspaceEvents.id — required by resolveEdges() */
    internalEventId: z.number(),
    /** Entity refs for edge resolution (primary entity + relations) */
    entityRefs: z.array(
      z.object({
        type: z.string(),
        key: z.string(),
        label: z.string().nullable(),
      })
    ),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),

  /**
   * Emitted by entity-graph after edge resolution completes.
   * entity-embed subscribes to THIS event (not entity.upserted) to guarantee
   * graph edges are written before the narrative is built.
   */
  "apps-console/entity.graphed": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};

/**
 * Inngest client for console application
 */
const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
  middleware: [sentryMiddleware()],
});

// Export properly typed events
export type Events = GetEvents<typeof inngest>;

export { inngest };
