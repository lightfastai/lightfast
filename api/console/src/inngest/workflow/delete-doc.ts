/**
 * Delete document workflow
 *
 * Removes document and its vectors from both database and Pinecone.
 *
 * Workflow steps:
 * 1. Find document in database
 * 2. Delete vectors from Pinecone via metadata filter
 * 3. Delete vector_entries rows
 * 4. Delete docs_documents row
 */

import { db } from "@db/console/client";
import { docsDocuments, stores, vectorEntries } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { pineconeClient } from "@repo/console-pinecone";
import { PRIVATE_CONFIG } from "@repo/console-config";

/**
 * Delete document function
 *
 * Orchestrates the complete pipeline for deleting a document:
 * find → delete vectors → delete entries → delete document
 */
export const deleteDoc = inngest.createFunction(
	{
		id: "apps-console/delete-doc",
		name: "Delete Document",
		description: "Deletes document and vectors from DB and Pinecone",
		retries: 2, // Deletion is simpler, fewer retries needed

		// Prevent duplicate deletion work
		idempotency: 'event.data.storeSlug + "-" + event.data.filePath',

		// Allow per-store parallel deletions while preventing noisy neighbors
		concurrency: [
			{
				key: 'event.data.workspaceId + "-" + event.data.storeSlug',
				limit: PRIVATE_CONFIG.workflow.deleteDoc.perStoreConcurrency,
			},
		],

		// Timeout for Pinecone deletion
		timeouts: PRIVATE_CONFIG.workflow.deleteDoc.timeout,
	},
	{ event: "apps-console/docs.file.delete" },
	async ({ event, step }) => {
		const { workspaceId, storeSlug, filePath } = event.data;

		log.info("Deleting document", {
			workspaceId,
			storeSlug,
			filePath,
		});

		// Step 1: Find document and store in database
		const docInfo = await step.run("find-document", async () => {
			try {
				// Get store
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.slug, storeSlug)))
					.limit(1);

				if (!store) {
					log.warn("Store not found", { workspaceId, storeSlug });
					return null;
				}

				// Find document
				const [doc] = await db
					.select()
					.from(docsDocuments)
					.where(and(eq(docsDocuments.storeId, store.id), eq(docsDocuments.path, filePath)))
					.limit(1);

				if (!doc) {
					log.warn("Document not found", { filePath, storeId: store.id });
					return null;
				}

				log.info("Found document to delete", {
					docId: doc.id,
					path: doc.path,
				});

				return {
					docId: doc.id,
					storeId: store.id,
					indexName: store.indexName,
				};
			} catch (error) {
				log.error("Failed to find document", { error, filePath });
				throw error;
			}
		});

		if (!docInfo) {
			log.info("Document not found, nothing to delete");
			return { status: "skipped", reason: "not_found" };
		}

		// Step 2: Delete vectors from Pinecone via metadata filter
		await step.run("delete-vectors", async () => {
			try {
				await pineconeClient.deleteByMetadata(docInfo.indexName, {
					docId: docInfo.docId,
				});

				log.info("Deleted vectors from Pinecone via metadata", {
					indexName: docInfo.indexName,
					docId: docInfo.docId,
				});
			} catch (error) {
				log.error("Failed to delete vectors by metadata", {
					error,
					indexName: docInfo.indexName,
					docId: docInfo.docId,
				});
				throw error;
			}
		});

		// Step 3: Delete vector_entries rows
		await step.run("delete-vector-entries", async () => {
			try {
				await db
					.delete(vectorEntries)
					.where(and(eq(vectorEntries.storeId, docInfo.storeId), eq(vectorEntries.docId, docInfo.docId)));

				log.info("Deleted vector entries", {
					docId: docInfo.docId,
				});
			} catch (error) {
				log.error("Failed to delete vector entries", {
					error,
					docId: docInfo.docId,
				});
				throw error;
			}
		});

		// Step 4: Delete docs_documents row
		await step.run("delete-document", async () => {
			try {
				await db.delete(docsDocuments).where(eq(docsDocuments.id, docInfo.docId));

				log.info("Deleted document", {
					docId: docInfo.docId,
				});
			} catch (error) {
				log.error("Failed to delete document", {
					error,
					docId: docInfo.docId,
				});
				throw error;
			}
		});

		return {
			status: "deleted",
			docId: docInfo.docId,
		};
	},
);
