import { sentryMiddleware } from "@inngest/middleware-sentry";
import {
  postTransformEventSchema,
  sourceTypeSchema,
} from "@repo/console-providers";
import { ingestionSourceSchema } from "@repo/console-validation";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";
import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

/**
 * Inngest event schemas for console application
 *
 * Events are organized by:
 * 1. Infrastructure Events (Store provisioning)
 * 2. Activity Tracking Events
 * 3. Document Processing Events
 * 4. Neural Memory Events
 * 5. Backfill Events
 * 6. Notification Events
 */
const eventsMap = {
  // ============================================================================
  // INFRASTRUCTURE EVENTS
  // ============================================================================

  "apps-console/store.ensure": z.object({
    /** Workspace DB UUID (also used as store ID) */
    workspaceId: z.string(),
    /** Canonical external workspace key for naming (e.g., ws-<slug>) */
    workspaceKey: z.string().optional(),
    /** Embedding dimension (defaults to provider's dimension) */
    embeddingDim: z.number().optional(),
    /** GitHub repository ID to link (optional) */
    githubRepoId: z.union([z.number(), z.string()]).optional(),
    /** Repository full name to link (optional) */
    repoFullName: z.string().optional(),
  }),

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
  // DOCUMENT PROCESSING EVENTS (Generic, Multi-Source)
  // ============================================================================

  "apps-console/documents.process": z.object({
    /** Workspace DB UUID (also store ID, 1:1 relationship) */
    workspaceId: z.string(),
    /** Deterministic document ID */
    documentId: z.string(),
    /** Source type (discriminated union) */
    sourceType: sourceTypeSchema,
    /** Source-specific identifier */
    sourceId: z.string(),
    /** Source-specific metadata */
    sourceMetadata: z.record(z.string(), z.unknown()),
    /** Document title */
    title: z.string(),
    /** Document content */
    content: z.string(),
    /** Content hash for idempotency */
    contentHash: z.string(),
    /** Optional parent document ID */
    parentDocId: z.string().optional(),
    /** Additional metadata */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Relationships to extract */
    relationships: z.record(z.string(), z.unknown()).optional(),
  }),

  "apps-console/documents.delete": z.object({
    /** Workspace DB UUID (also store ID, 1:1 relationship) */
    workspaceId: z.string(),
    /** Document ID to delete */
    documentId: z.string(),
    /** Source type */
    sourceType: sourceTypeSchema,
    /** Source-specific identifier */
    sourceId: z.string(),
  }),

  "apps-console/relationships.extract": z.object({
    /** Document ID */
    documentId: z.string(),
    /** Workspace ID (also store ID, 1:1 relationship) */
    workspaceId: z.string(),
    /** Source type */
    sourceType: sourceTypeSchema,
    /** Relationships to extract */
    relationships: z.record(z.string(), z.unknown()),
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
  }),

  "apps-console/event.stored": z.object({
    /** Event external ID (nanoid) */
    eventExternalId: z.string(),
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID */
    clerkOrgId: z.string().optional(),
    /** Source provider for routing */
    source: z.string(),
    /** Source event type for routing */
    sourceType: z.string(),
    /** Significance score (pre-computed in store step) */
    significanceScore: z.number(),
    /** Extracted L0 entity refs (small, needed by interpretation) */
    entityRefs: z.array(
      z.object({
        type: z.string(),
        key: z.string(),
        label: z.string().nullable(),
      })
    ),
    /** Internal event ID for DB queries */
    internalEventId: z.number(),
  }),

  "apps-console/event.interpreted": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Event external ID (nanoid) */
    eventExternalId: z.string(),
    /** Source ID for correlation */
    sourceId: z.string(),
    /** Event type (e.g., "push", "pull_request_merged") */
    eventType: z.string(),
    /** Significance score (0-100) */
    significanceScore: z.number().optional(),
    /** Topics extracted */
    topics: z.array(z.string()).optional(),
    /** Number of entities extracted */
    entitiesExtracted: z.number().optional(),
  }),

  // ============================================================================
  // NOTIFICATION EVENTS
  // ============================================================================

  "apps-console/notification.dispatch": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID */
    clerkOrgId: z.string().optional(),
    /** Knock workflow key */
    workflowKey: z.string(),
    /** Recipients (Clerk user IDs) */
    recipients: z.array(z.string()),
    /** Tenant ID for workspace scoping */
    tenant: z.string().optional(),
    /** Notification data payload */
    payload: z.record(z.string(), z.unknown()),
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
