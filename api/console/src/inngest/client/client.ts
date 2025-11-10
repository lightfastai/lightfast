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
            /** GitHub installation ID */
            githubInstallationId: z.number(),
            /** SHA before push */
            beforeSha: z.string(),
            /** SHA after push */
            afterSha: z.string(),
            /** GitHub webhook delivery ID for tracing */
            deliveryId: z.string(),
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
			storeName: z.string(),
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
			storeName: z.string(),
			/** Repository full name (owner/repo) */
			repoFullName: z.string(),
			/** File path relative to repo root */
			filePath: z.string(),
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
