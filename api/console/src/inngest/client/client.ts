import { sentryMiddleware } from "@inngest/middleware-sentry";
import { sourceTypeSchema } from "@repo/console-providers";
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
    /** Actor type */
    actorType: z.enum(["user", "system", "webhook", "api"]),
    /** Actor user ID (if actorType is user) */
    actorUserId: z.string().optional(),
    /** Actor email (denormalized for privacy) */
    actorEmail: z.string().optional(),
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
  // NEURAL MEMORY EVENTS
  // ============================================================================

  "apps-console/neural/observation.capture": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (optional for backwards compat, resolved at webhook handler) */
    clerkOrgId: z.string().optional(),
    /** Standardized source event */
    sourceEvent: z.object({
      source: z.string(),
      sourceType: z.string(),
      sourceId: z.string(),
      title: z.string(),
      body: z.string(),
      actor: z
        .object({
          id: z.string(),
          name: z.string(),
          email: z.string().nullable(),
          avatarUrl: z.string().nullable(),
        })
        .nullable(),
      occurredAt: z.string(),
      references: z.array(
        z.object({
          type: z.enum([
            "commit",
            "branch",
            "pr",
            "issue",
            "deployment",
            "project",
            "cycle",
            "assignee",
            "reviewer",
            "team",
            "label",
          ]),
          id: z.string(),
          url: z.string().nullable(),
          label: z.string().nullable(),
        })
      ),
      metadata: z.record(z.string(), z.unknown()),
    }),
    /** How this event was ingested (webhook, backfill, manual, api). Defaults to "webhook" in the consumer. */
    ingestionSource: ingestionSourceSchema.optional(),
  }),

  "apps-console/neural/observation.captured": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Observation DB UUID */
    observationId: z.string(),
    /** Source ID for correlation */
    sourceId: z.string(),
    /** Observation type (e.g., "push", "pull_request_merged") */
    observationType: z.string(),
    /** Significance score (0-100) */
    significanceScore: z.number().optional(),
    /** Topics extracted */
    topics: z.array(z.string()).optional(),
    /** Number of entities extracted */
    entitiesExtracted: z.number().optional(),
    /** Assigned cluster ID */
    clusterId: z.string().optional(),
    /** Whether cluster was newly created */
    clusterIsNew: z.boolean().optional(),
  }),

  "apps-console/neural/profile.update": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Canonical actor ID (source:id format) */
    actorId: z.string(),
    /** Observation that triggered update */
    observationId: z.string(),
    /** Source actor data for profile enrichment */
    sourceActor: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
  }),

  "apps-console/neural/cluster.check-summary": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Cluster to check */
    clusterId: z.string(),
    /** Current observation count */
    observationCount: z.number(),
  }),

  "apps-console/neural/llm-entity-extraction.requested": z.object({
    /** Workspace DB UUID */
    workspaceId: z.string(),
    /** Clerk organization ID (passed from parent workflow) */
    clerkOrgId: z.string().optional(),
    /** Observation to extract entities from */
    observationId: z.string(),
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
