import { EventSchemas, Inngest } from "inngest";
import type { GetEvents } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { z } from "zod";

import { env } from "@vendor/inngest/env";
import { syncTriggerSchema } from "@repo/console-validation";

/**
 * Inngest event schemas for console application
 *
 * Organized by:
 * 1. Source Management Events (provider-agnostic)
 * 2. GitHub-Specific Events
 * 3. Generic Document Processing Events
 * 4. Infrastructure Events
 */
const eventsMap = {
  // ============================================================================
  // SOURCE MANAGEMENT EVENTS (Provider-agnostic)
  // ============================================================================

  /**
   * Triggered when ANY source is connected to a workspace
   * Initiates full sync for that source type
   *
   * Replaces: apps-console/repository.connected (now GitHub-specific via source.sync)
   */
  "apps-console/source.connected": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming (e.g., ws-<slug>) */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Source provider type */
      sourceType: z.enum(["github", "linear", "notion", "sentry"]),
      /** Provider-specific metadata (flexible for different source types) */
      sourceMetadata: z.record(z.unknown()),
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
   * Generic sync trigger for any source type
   * Supports both full and incremental sync modes
   *
   * Used by:
   * - Manual restart (user clicks "Restart" on job)
   * - Scheduled syncs
   * - Config change detection (triggers full re-sync)
   * - Webhook events (routed through provider-specific handlers)
   */
  "apps-console/source.sync": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming */
      workspaceKey: z.string(),
      /** workspaceSource.id */
      sourceId: z.string(),
      /** Source provider type */
      sourceType: z.enum(["github", "linear", "notion", "sentry"]),
      /** Sync mode: full = all documents, incremental = changed only */
      syncMode: z.enum(["full", "incremental"]),
      /** What triggered this sync */
      trigger: syncTriggerSchema,
      /** Provider-specific sync parameters (e.g., changedFiles for GitHub) */
      syncParams: z.record(z.unknown()).optional(),
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
      /** SHA after push */
      afterSha: z.string(),
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

  /**
   * Process a single GitHub file
   * Chunks text, generates embeddings, and upserts to Pinecone
   *
   * DEPRECATED: Will be replaced by apps-console/documents.process
   * Kept for backward compatibility during migration
   */
  "apps-console/docs.file.process": {
    data: z.object({
      /** Workspace identifier */
      workspaceId: z.string(),
      /** Store name */
      storeSlug: z.string(),
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
   *
   * DEPRECATED: Will be replaced by apps-console/documents.delete
   * Kept for backward compatibility during migration
   */
  "apps-console/docs.file.delete": {
    data: z.object({
      /** Workspace identifier */
      workspaceId: z.string(),
      /** Store name */
      storeSlug: z.string(),
      /** Repository full name (owner/repo) */
      repoFullName: z.string(),
      /** File path relative to repo root */
      filePath: z.string(),
    }),
  },

  // ============================================================================
  // GENERIC DOCUMENT PROCESSING EVENTS
  // ============================================================================

  /**
   * Generic document processing event
   * Works with any source type (GitHub, Linear, Notion, Sentry)
   *
   * This is the target event for all provider adapters to emit
   */
  "apps-console/documents.process": {
    data: z.object({
      /** Workspace identifier */
      workspaceId: z.string(),
      /** Store name */
      storeSlug: z.string(),
      /** Document ID */
      documentId: z.string(),
      /** Source type discriminator */
      sourceType: z.enum(["github", "linear", "notion", "sentry", "vercel", "zendesk"]),
      /** Source-specific identifier */
      sourceId: z.string(),
      /** Source-specific metadata */
      sourceMetadata: z.record(z.unknown()),
      /** Document title */
      title: z.string(),
      /** Document content */
      content: z.string(),
      /** Content hash (SHA-256) */
      contentHash: z.string(),
      /** Parent document ID (optional, for nested documents) */
      parentDocId: z.string().optional(),
      /** Additional metadata (optional) */
      metadata: z.record(z.unknown()).optional(),
      /** Cross-source relationships (optional) */
      relationships: z.record(z.unknown()).optional(),
    }),
  },

  /**
   * Generic document deletion event
   * Works with any source type
   *
   * This is the target event for all provider adapters to emit
   */
  "apps-console/documents.delete": {
    data: z.object({
      /** Workspace identifier */
      workspaceId: z.string(),
      /** Store name */
      storeSlug: z.string(),
      /** Document ID */
      documentId: z.string(),
      /** Source type discriminator */
      sourceType: z.enum(["github", "linear", "notion", "sentry", "vercel", "zendesk"]),
      /** Source-specific identifier */
      sourceId: z.string(),
    }),
  },

  /**
   * Relationship extraction event
   * Extracts cross-source relationships from documents
   */
  "apps-console/relationships.extract": {
    data: z.object({
      /** Document ID */
      documentId: z.string(),
      /** Store name */
      storeSlug: z.string(),
      /** Workspace identifier */
      workspaceId: z.string(),
      /** Source type */
      sourceType: z.enum(["github", "linear", "notion", "sentry", "vercel", "zendesk"]),
      /** Relationships to extract */
      relationships: z.record(z.unknown()),
    }),
  },

  // ============================================================================
  // INFRASTRUCTURE EVENTS
  // ============================================================================

  /**
   * Ensure store and Pinecone index exist
   * Idempotently provisions store infrastructure
   * Can be triggered by sync workflows, admin API, or reconciliation
   */
  "apps-console/store.ensure": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming (e.g., ws-<slug>) */
      workspaceKey: z.string().optional(),
      /** Store name */
      storeSlug: z.string(),
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
