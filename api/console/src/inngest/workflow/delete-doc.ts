/**
 * Delete document workflow
 *
 * Removes document and its vectors from both database and Pinecone.
 *
 * Workflow steps:
 * 1. Find document in database
 * 2. Get vector IDs from vector_entries
 * 3. Delete vectors from Pinecone
 * 4. Delete vector_entries rows
 * 5. Delete docs_documents row
 */

import { db } from "@db/console/client";
import { docsDocuments, stores, vectorEntries } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { pineconeClient } from "@repo/console-pinecone";

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
		retries: 3,
	},
	{ event: "apps-console/docs.file.delete" },
	async ({ event, step }) => {
		const { workspaceId, storeName, repoFullName, filePath } = event.data;

		log.info("Deleting document", {
			workspaceId,
			storeName,
			filePath,
		});

		// Step 1: Find document and store in database
		const docInfo = await step.run("find-document", async () => {
			try {
				// Get store
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					log.warn("Store not found", { workspaceId, storeName });
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

		// Step 2: Get vector IDs from vector_entries
		const vectorIds = await step.run("get-vector-ids", async () => {
			try {
				const entries = await db
					.select({ id: vectorEntries.id })
					.from(vectorEntries)
					.where(and(eq(vectorEntries.storeId, docInfo.storeId), eq(vectorEntries.docId, docInfo.docId)));

				const ids = entries.map((entry) => entry.id);

				log.info("Found vector entries", {
					docId: docInfo.docId,
					count: ids.length,
				});

				return ids;
			} catch (error) {
				log.error("Failed to get vector IDs", { error, docId: docInfo.docId });
				throw error;
			}
		});

		// Step 3: Delete vectors from Pinecone
		if (vectorIds.length > 0) {
			await step.run("delete-vectors", async () => {
				try {
					await pineconeClient.deleteVectors(docInfo.indexName, vectorIds);

					log.info("Deleted vectors from Pinecone", {
						indexName: docInfo.indexName,
						count: vectorIds.length,
					});
				} catch (error) {
					log.error("Failed to delete vectors", {
						error,
						indexName: docInfo.indexName,
						vectorIds,
					});
					throw error;
				}
			});
		}

		// Step 4: Delete vector_entries rows
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

		// Step 5: Delete docs_documents row
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
			vectorsDeleted: vectorIds.length,
		};
	},
);
