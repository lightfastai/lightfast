/**
 * Generic document deletion workflow
 * Deletes documents from any source (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
 *
 * Workflow steps:
 * 1. Find document in database
 * 2. Delete vectors from Pinecone via metadata filter
 * 3. Delete vector_entries rows
 * 4. Delete docs_documents row
 */

import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments, workspaceStores, workspaceKnowledgeVectorChunks } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { pineconeClient } from "@repo/console-pinecone";
import { PRIVATE_CONFIG } from "@repo/console-config";

/**
 * Generic document deletion event
 */
export interface DeleteDocumentEvent {
  workspaceId: string;
  storeSlug: string;
  documentId: string;
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
  sourceId: string;
}

/**
 * Delete document function (multi-source)
 *
 * Orchestrates the complete pipeline for deleting a document:
 * find → delete vectors → delete entries → delete document
 */
export const deleteDocuments = inngest.createFunction(
  {
    id: "apps-console/delete-documents",
    name: "Delete Documents (Multi-Source)",
    description: "Deletes documents and vectors from DB and Pinecone",
    retries: 2,

    // Prevent duplicate deletion work
    idempotency: 'event.data.documentId',

    // Allow per-store parallel deletions
    concurrency: [
      {
        key: 'event.data.workspaceId + "-" + event.data.storeSlug',
        limit: PRIVATE_CONFIG.workflow.deleteDoc.perStoreConcurrency,
      },
    ],

    timeouts: PRIVATE_CONFIG.workflow.deleteDoc.timeout,
  },
  { event: "apps-console/documents.delete" },
  async ({ event, step }) => {
    const { workspaceId, storeSlug, documentId, sourceType, sourceId } =
      event.data;

    log.info("Deleting document (multi-source)", {
      workspaceId,
      storeSlug,
      documentId,
      sourceType,
      sourceId,
    });

    // Step 1: Find document and store in database
    const docInfo = await step.run("find-document", async () => {
      try {
        // Get store
        const [store] = await db
          .select()
          .from(workspaceStores)
          .where(
            and(eq(workspaceStores.workspaceId, workspaceId), eq(workspaceStores.slug, storeSlug)),
          )
          .limit(1);

        if (!store) {
          log.warn("Store not found", { workspaceId, storeSlug });
          return null;
        }

        // Find document by documentId OR by sourceType+sourceId
        const [doc] = await db
          .select()
          .from(workspaceKnowledgeDocuments)
          .where(
            and(
              eq(workspaceKnowledgeDocuments.storeId, store.id),
              eq(workspaceKnowledgeDocuments.id, documentId),
            ),
          )
          .limit(1);

        if (!doc) {
          // Try finding by sourceType + sourceId as fallback
          const [docBySource] = await db
            .select()
            .from(workspaceKnowledgeDocuments)
            .where(
              and(
                eq(workspaceKnowledgeDocuments.storeId, store.id),
                eq(workspaceKnowledgeDocuments.sourceType, sourceType as any),
                eq(workspaceKnowledgeDocuments.sourceId, sourceId),
              ),
            )
            .limit(1);

          if (!docBySource) {
            log.warn("Document not found", {
              documentId,
              sourceType,
              sourceId,
              storeId: store.id,
            });
            return null;
          }

          log.info("Found document by source", {
            docId: docBySource.id,
            sourceType,
            sourceId,
          });

          return {
            docId: docBySource.id,
            storeId: store.id,
            indexName: store.indexName,
          };
        }

        log.info("Found document to delete", {
          docId: doc.id,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
        });

        return {
          docId: doc.id,
          storeId: store.id,
          indexName: store.indexName,
        };
      } catch (error) {
        log.error("Failed to find document", {
          error,
          documentId,
          sourceType,
          sourceId,
        });
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

        log.info("Deleted vectors from Pinecone via metadata (multi-source)", {
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
          .delete(workspaceKnowledgeVectorChunks)
          .where(
            and(
              eq(workspaceKnowledgeVectorChunks.storeId, docInfo.storeId),
              eq(workspaceKnowledgeVectorChunks.docId, docInfo.docId),
            ),
          );

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
        await db.delete(workspaceKnowledgeDocuments).where(eq(workspaceKnowledgeDocuments.id, docInfo.docId));

        log.info("Deleted document (multi-source)", {
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
