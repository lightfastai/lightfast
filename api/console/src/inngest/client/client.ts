import { EventSchemas, Inngest } from "inngest";
import type { GetEvents } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { z } from "zod";

import { env } from "@vendor/inngest/env";
import {
  syncTriggerSchema,
  githubSourceMetadataSchema,
  sourceTypeSchema,
} from "@repo/console-validation";

/**
 * Inngest event schemas for console application
 *
 * Currently GitHub-only. Events are organized by:
 * 1. Source Management Events (GitHub)
 * 2. GitHub-Specific Events (Push, Config)
 * 3. Infrastructure Events (Store provisioning)
 * 4. Activity Tracking Events
 * 5. Workflow Completion Events
 */
const eventsMap = {
  // ============================================================================
  // UNIFIED ORCHESTRATION EVENTS (NEW ARCHITECTURE)
  // ============================================================================

  /**
   * Unified sync request event
   * Single entry point for all sync operations
   * Replaces fragmented orchestration with single source of truth
   */
  "apps-console/sync.requested": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Source provider type */
      sourceType: sourceTypeSchema,
      /** Sync mode: full = all documents, incremental = changed only */
      syncMode: z.enum(["full", "incremental"]).default("full"),
      /** What triggered this sync */
      trigger: syncTriggerSchema.default("manual"),
      /** Provider-specific sync parameters */
      syncParams: z.record(z.unknown()).default({}),
      /** Parent job ID if this is a sub-job */
      parentJobId: z.string().optional(),
    }),
  },

  /**
   * Unified sync completion event
   * Emitted by sync.orchestrator when sync completes with real metrics
   */
  "apps-console/sync.completed": {
    data: z.object({
      /** workspaceSource.id that completed */
      sourceId: z.string(),
      /** Job ID from orchestration */
      jobId: z.string(),
      /** Whether sync succeeded */
      success: z.boolean(),
      /** Number of files actually processed */
      filesProcessed: z.number(),
      /** Number of files that failed */
      filesFailed: z.number(),
      /** Number of embeddings created */
      embeddingsCreated: z.number(),
      /** Sync mode that completed */
      syncMode: z.enum(["full", "incremental"]),
      /** Error message if failed */
      error: z.string().optional(),
    }),
  },

  // ============================================================================
  // BATCH PROCESSING EVENTS (NEW ARCHITECTURE)
  // ============================================================================

  /**
   * Process a batch of files
   * Emitted by sync.orchestrator for parallel processing
   */
  "apps-console/files.batch.process": {
    data: z.object({
      /** Unique batch ID for tracking */
      batchId: z.string(),
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Source ID */
      sourceId: z.string(),
      /** Files to process in this batch */
      files: z.array(z.object({
        path: z.string(),
        status: z.enum(["added", "modified", "removed"]),
      })),
      /** GitHub installation ID */
      githubInstallationId: z.number(),
      /** Repository full name */
      repoFullName: z.string(),
      /** Commit SHA */
      commitSha: z.string(),
      /** Commit timestamp */
      committedAt: z.string(),
    }),
  },

  /**
   * File batch processing completed
   * Emitted by file batch processor with real counts
   */
  "apps-console/files.batch.completed": {
    data: z.object({
      /** Batch ID for matching */
      batchId: z.string(),
      /** Whether batch succeeded */
      success: z.boolean(),
      /** Number of files processed */
      processed: z.number(),
      /** Number of files failed */
      failed: z.number(),
      /** Processing duration in ms */
      durationMs: z.number().optional(),
      /** Error details if failed */
      errors: z.array(z.string()).optional(),
    }),
  },

  // ============================================================================
  // SOURCE-SPECIFIC ORCHESTRATION EVENTS (NEW ARCHITECTURE)
  // ============================================================================

  /**
   * GitHub sync trigger event
   * Emitted by sync-orchestrator to trigger GitHub-specific sync
   */
  "apps-console/github.sync.trigger": {
    data: z.object({
      /** Job ID from main orchestrator */
      jobId: z.string(),
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key */
      workspaceKey: z.string(),
      /** Source ID */
      sourceId: z.string(),
      /** GitHub-specific source configuration */
      sourceConfig: z.record(z.unknown()),
      /** Sync mode */
      syncMode: z.enum(["full", "incremental"]),
      /** Sync parameters */
      syncParams: z.record(z.unknown()).optional(),
    }),
  },

  /**
   * GitHub sync completed event
   * Emitted by github-sync-orchestrator when sync completes
   */
  "apps-console/github.sync.completed": {
    data: z.object({
      /** Job ID for correlation */
      jobId: z.string(),
      /** Source ID */
      sourceId: z.string(),
      /** Whether sync succeeded */
      success: z.boolean(),
      /** Number of files processed */
      filesProcessed: z.number(),
      /** Number of files failed */
      filesFailed: z.number(),
    }),
  },

  // ============================================================================
  // SOURCE MANAGEMENT EVENTS (GitHub)
  // ============================================================================

  /**
   * GitHub source connected
   * Triggered when a GitHub repository is connected to a workspace
   * Initiates full sync for that repository
   */
  "apps-console/source.connected.github": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming (e.g., ws-<slug>) */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Source provider type */
      sourceType: z.literal("github"),
      /** GitHub-specific metadata */
      sourceMetadata: githubSourceMetadataSchema,
      /** How the connection was initiated */
      trigger: z.enum(["user", "api", "automation"]),
    }),
  },

  /**
   * Triggered when a source is disconnected from workspace
   * Cancels ongoing syncs and optionally deletes indexed data
   */
  "apps-console/source.disconnected": {
    data: z.object({
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Whether to delete all indexed data from this source */
      deleteData: z.boolean().default(false),
    }),
  },

  /**
   * GitHub source sync
   * Triggers sync workflow for a GitHub repository
   * Supports both full and incremental sync modes
   *
   * Used by:
   * - Manual restart (user clicks "Restart" on job)
   * - Scheduled syncs
   * - Config change detection (triggers full re-sync)
   * - Webhook events (GitHub push)
   */
  "apps-console/source.sync.github": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Source provider type */
      sourceType: z.literal("github"),
      /** Sync mode: full = all documents, incremental = changed only */
      syncMode: z.enum(["full", "incremental"]),
      /** What triggered this sync */
      trigger: syncTriggerSchema,
      /** Provider-specific sync parameters (e.g., changedFiles for GitHub) */
      syncParams: z.record(z.unknown()),
    }),
  },

  // ============================================================================
  // GITHUB-SPECIFIC EVENTS
  // ============================================================================

  /**
   * GitHub push webhook event
   * Triggers incremental sync for changed files
   *
   * Replaces: apps-console/docs.push (renamed for clarity)
   */
  "apps-console/github.push": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Repository full name (owner/repo) */
      repoFullName: z.string(),
      /** Immutable GitHub repository ID */
      githubRepoId: z.number(),
      /** GitHub installation ID */
      githubInstallationId: z.number(),
      /** SHA before push */
      beforeSha: z.string(),
      /** SHA after push (the commit SHA) */
      afterSha: z.string(),
      /** Commit message from head commit */
      commitMessage: z.string().optional(),
      /** Branch name (e.g., "main") */
      branch: z.string(),
      /** Unique delivery ID for idempotency */
      deliveryId: z.string(),
      /** ISO timestamp for the head commit */
      headCommitTimestamp: z.string().datetime().optional(),
      /** Changed files with their status */
      changedFiles: z.array(
        z.object({
          path: z.string(),
          status: z.enum(["added", "modified", "removed"]),
        }),
      ),
    }),
  },

  /**
   * GitHub config file (lightfast.yml) changed
   * Triggers full re-sync with new configuration
   *
   * NEW: Explicit handling for config changes
   */
  "apps-console/github.config-changed": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Repository full name (owner/repo) */
      repoFullName: z.string(),
      /** Path to config file that changed */
      configPath: z.string(),
      /** Commit SHA where config changed */
      commitSha: z.string(),
    }),
  },

  /**
   * GitHub-specific sync workflow
   * Handles both full and incremental repository sync
   *
   * Internal event (not exposed via webhook)
   */
  "apps-console/github.sync": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Sync mode */
      syncMode: z.enum(["full", "incremental"]),
      /** What triggered this sync */
      trigger: syncTriggerSchema,
      /** Job ID from orchestration layer */
      jobId: z.string(),
      /** Provider-specific sync parameters */
      syncParams: z.record(z.unknown()),
    }),
  },

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
  // GITHUB FILE EVENTS (Provider-Specific)
  // ============================================================================

  /**
   * Process a single GitHub file
   * Emitted by: GitHub sync workflow
   * Consumed by: githubProcessAdapter → documents.process
   *
   * The adapter fetches content from GitHub and transforms to generic format
   */
  "apps-console/docs.file.process": {
    data: z.object({
      /** Workspace identifier (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Repository full name (owner/repo) */
      repoFullName: z.string(),
      /** GitHub installation ID */
      githubInstallationId: z.number(),
      /** File path relative to repo root */
      filePath: z.string(),
      /** Git SHA of the commit */
      commitSha: z.string(),
      /** Commit timestamp (ISO 8601) */
      committedAt: z.string().datetime(),
    }),
  },

  /**
   * Delete a GitHub document and its vectors
   * Emitted by: GitHub sync workflow
   * Consumed by: githubDeleteAdapter → documents.delete
   */
  "apps-console/docs.file.delete": {
    data: z.object({
      /** Workspace identifier (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Repository full name (owner/repo) */
      repoFullName: z.string(),
      /** File path relative to repo root */
      filePath: z.string(),
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
  // WORKFLOW COMPLETION EVENTS
  // ============================================================================

  /**
   * Signal that GitHub sync has completed (all files processed)
   * Emitted by: github-sync workflow after all file processing completes
   * Consumed by: source-sync workflow (via step.waitForEvent)
   */
  "apps-console/github.sync-completed": {
    data: z.object({
      /** workspaceSource.id that completed */
      sourceId: z.string(),
      /** Job ID from orchestration layer */
      jobId: z.string(),
      /** Number of files processed successfully */
      filesProcessed: z.number(),
      /** Number of files that failed */
      filesFailed: z.number().default(0),
      /** Workspace ID (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Sync mode that completed */
      syncMode: z.enum(["full", "incremental"]),
      /** Whether the sync timed out */
      timedOut: z.boolean().default(false),
    }),
  },

  /**
   * Signal that document processing batch completed
   * Emitted by: documents.process workflow after batch finishes
   * Consumed by: github-sync workflow (via step.waitForEvent)
   *
   * NOTE: This is for future batch tracking implementation (Phase 2).
   * For now, we'll emit immediately after sendEvent() in github-sync.
   */
  "apps-console/documents.batch-completed": {
    data: z.object({
      /** Workspace identifier (also store ID, 1:1 relationship) */
      workspaceId: z.string(),
      /** Batch ID for tracking */
      batchId: z.string(),
      /** Number of documents in batch */
      documentCount: z.number(),
      /** Processing duration in milliseconds */
      durationMs: z.number(),
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
      /** Observation DB UUID */
      observationId: z.string(),
      /** Source ID for correlation */
      sourceId: z.string(),
      /** Observation type (e.g., "push", "pull_request_merged") */
      observationType: z.string(),
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
