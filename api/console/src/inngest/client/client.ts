import { EventSchemas, Inngest } from "inngest";
import type { GetEvents } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { z } from "zod";

import { env } from "@vendor/inngest/env";

/**
 * Inngest event schemas for console application
 *
 * Defines typed events for docs ingestion workflows
 */
const eventsMap = {
  /**
   * Triggered when a push event occurs on a GitHub repository
   * Processes changed files according to lightfast.yml config
   */
  "apps-console/docs.push": {
    data: z.object({
      /** Workspace DB UUID */
      workspaceId: z.string(),
      /** Canonical external workspace key for naming (e.g., ws-<slug>) */
      workspaceKey: z.string(),
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
      /** Unique delivery/trigger ID for idempotency */
      deliveryId: z.string(),
      /** Ingestion source: github-webhook | manual | api | scheduled */
      source: z.enum(["github-webhook", "manual", "api", "scheduled"]),
      /** ISO timestamp for the head commit (if provided by GitHub) */
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
   * Process a single document file
   * Chunks text, generates embeddings, and upserts to Pinecone
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
   * Delete a document and its vectors
   * Removes from both database and Pinecone
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

  /**
   * Ensure store and Pinecone index exist
   * Idempotently provisions store infrastructure
   * Can be triggered by docs-ingestion, admin API, or reconciliation
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

  /**
   * Phase 1.5: Generic document processing event
   * Works with any source type (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
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
   * Phase 1.5: Generic document deletion event
   * Works with any source type
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
   * Phase 1.5: Relationship extraction event
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
