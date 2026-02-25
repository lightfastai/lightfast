import { EventSchemas, Inngest } from "inngest";
import type { GetEvents } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { z } from "zod";

import { env } from "@vendor/inngest/env";
import {
  sourceTypeSchema,
  ingestionSourceSchema,
} from "@repo/console-validation";

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

  /**
   * Ensure store and Pinecone index exist
   * Idempotently provisions store infrastructure
   * Can be triggered by sync workflows, admin API, or reconciliation
   * Each workspace has exactly one store (1:1 relationship)
   */
  "apps-console/store.ensure": {
    data: z.object({
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
  },

  // ============================================================================
  // USER ACTIVITY TRACKING EVENTS
  // ============================================================================

  /**
   * Record user activity in batch
   * Batches multiple activity records for efficient insertion
   *
   * Triggered by: Tier 2 user actions (workspace edits, integration changes, etc.)
   * Processing: Batched inserts (up to 100 events, 10s timeout per workspace)
   */
  "apps-console/activity.record": {
    data: z.object({
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
      metadata: z.record(z.unknown()).optional(),
      /** Related activity ID (for grouping related actions) */
      relatedActivityId: z.string().optional(),
      /** Timestamp of the activity (ISO string) */
      timestamp: z.string().datetime(),
    }),
  },

  // ============================================================================
  // DOCUMENT PROCESSING EVENTS (Generic, Multi-Source)
  // ============================================================================

  /**
   * Process document (generic, multi-source)
   * Emitted by: Provider-specific adapters (future implementation)
   * Consumed by: Generic document processor workflow
   *
   * Handles: fetch content, parse, chunk, embed, upsert to Pinecone
   */
  "apps-console/documents.process": {
    data: z.object({
      /** Workspace DB UUID (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Deterministic document ID */
      documentId: z.string(),
      /** Source type (discriminated union) */
      sourceType: sourceTypeSchema,
      /** Source-specific identifier */
      sourceId: z.string(),
      /** Source-specific metadata */
      sourceMetadata: z.record(z.unknown()),
      /** Document title */
      title: z.string(),
      /** Document content */
      content: z.string(),
      /** Content hash for idempotency */
      contentHash: z.string(),
      /** Optional parent document ID */
      parentDocId: z.string().optional(),
      /** Additional metadata */
      metadata: z.record(z.unknown()).optional(),
      /** Relationships to extract */
      relationships: z.record(z.unknown()).optional(),
    }),
  },

  /**
   * Delete document (generic, multi-source)
   * Emitted by: Provider-specific adapters (future implementation)
   * Consumed by: Generic document deleter workflow
   */
  "apps-console/documents.delete": {
    data: z.object({
      /** Workspace DB UUID (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Document ID to delete */
      documentId: z.string(),
      /** Source type */
      sourceType: sourceTypeSchema,
      /** Source-specific identifier */
      sourceId: z.string(),
    }),
  },

  /**
   * Extract relationships from document
   * Emitted by: Document processor after successful processing
   * Consumed by: Relationship extraction workflow
   */
  "apps-console/relationships.extract": {
    data: z.object({
      /** Document ID */
      documentId: z.string(),
      /** Workspace ID (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Source type */
      sourceType: sourceTypeSchema,
      /** Relationships to extract */
      relationships: z.record(z.unknown()),
    }),
  },

  // ============================================================================
  // NEURAL MEMORY EVENTS
  // ============================================================================

  /**
   * Neural observation capture event
   * Triggered by webhook handlers to capture engineering events as observations
   */
  "apps-console/neural/observation.capture": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Clerk organization ID (optional for backwards compat, resolved at webhook handler) */
      clerkOrgId: z.string().optional(),
      /** Standardized source event */
      sourceEvent: z.object({
        source: sourceTypeSchema,
        sourceType: z.string(),
        sourceId: z.string(),
        title: z.string(),
        body: z.string(),
        actor: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().optional(),
          avatarUrl: z.string().optional(),
        }).optional(),
        occurredAt: z.string(),
        references: z.array(z.object({
          type: z.enum([
            "commit", "branch", "pr", "issue", "deployment", "project",
            "cycle", "assignee", "reviewer", "team", "label"
          ]),
          id: z.string(),
          url: z.string().optional(),
          label: z.string().optional(),
        })),
        metadata: z.record(z.unknown()),
      }),
      /** How this event was ingested (webhook, backfill, manual, api). Defaults to "webhook" in the consumer. */
      ingestionSource: ingestionSourceSchema.optional(),
    }),
  },

  /**
   * Neural observation captured (completion event)
   * Emitted after an observation is successfully captured
   */
  "apps-console/neural/observation.captured": {
    data: z.object({
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
  },

  /**
   * Profile update event (fire-and-forget)
   * Triggers async profile recalculation for actor
   */
  "apps-console/neural/profile.update": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Clerk organization ID (passed from parent workflow) */
      clerkOrgId: z.string().optional(),
      /** Canonical actor ID (source:id format) */
      actorId: z.string(),
      /** Observation that triggered update */
      observationId: z.string(),
      /** Source actor data for profile enrichment */
      sourceActor: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().optional(),
        avatarUrl: z.string().optional(),
      }).optional(),
    }),
  },

  /**
   * Cluster summary check event (fire-and-forget)
   * Triggers async summary generation if threshold met
   */
  "apps-console/neural/cluster.check-summary": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Clerk organization ID (passed from parent workflow) */
      clerkOrgId: z.string().optional(),
      /** Cluster to check */
      clusterId: z.string(),
      /** Current observation count */
      observationCount: z.number(),
    }),
  },

  /**
   * LLM entity extraction event (fire-and-forget)
   * Triggers async LLM-based entity extraction for observations with rich content
   */
  "apps-console/neural/llm-entity-extraction.requested": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Clerk organization ID (passed from parent workflow) */
      clerkOrgId: z.string().optional(),
      /** Observation to extract entities from */
      observationId: z.string(),
    }),
  },

  // ============================================================================
  // NOTIFICATION EVENTS
  // ============================================================================

  /**
   * Notification dispatch event
   * Triggers Knock notification workflow for user-facing events
   */
  "apps-console/notification.dispatch": {
    data: z.object({
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
      payload: z.record(z.unknown()),
    }),
  },

  // ============================================================================
  // FUTURE EXAMPLES (NOT IMPLEMENTED - COMMENTED FOR REFERENCE)
  // ============================================================================

  /*
   * Example: User approval response for sensitive operations
   * This shows how step.waitForEvent could be used for human-in-the-loop
   * workflows in the future (e.g., approving mass deletions).
   *
   * NOT IMPLEMENTED YET - just an example pattern.
   */
  // "apps-console/workflow.approval": {
  //   data: z.object({
  //     requestId: z.string(),
  //     runId: z.string(),
  //     approved: z.boolean(),
  //     approverUserId: z.string(),
  //     comment: z.string().optional(),
  //     timestamp: z.string().datetime(),
  //   }),
  // },
};

/**
 * Inngest client for console application
 */
const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(eventsMap),
  middleware: [sentryMiddleware()],
});

// Export properly typed events
export type Events = GetEvents<typeof inngest>;

export { inngest };
