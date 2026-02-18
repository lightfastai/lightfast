/**
 * Generic document deletion workflow
 * Deletes documents from any source (GitHub, Vercel)
 *
 * Workflow steps:
 * 1. Find document in database
 * 2. Delete vectors from Pinecone via metadata filter
 * 3. Delete vector_entries rows
 * 4. Delete docs_documents row
 */

import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments, orgWorkspaces, workspaceKnowledgeVectorChunks } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { pineconeClient } from "@repo/console-pinecone";
import type { SourceType } from "@repo/console-validation";

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
    idempotency: "event.data.documentId",

    // Allow per-workspace parallel deletions (1:1 with store)
    concurrency: [
      {
        key: "event.data.workspaceId",
        limit: 10,
      },
    ],

    timeouts: {
      start: "30s",
      finish: "5m",
    },
  },
  { event: "apps-console/documents.delete" },
  async ({ event, step }) => {
    const { workspaceId, documentId, sourceType, sourceId } =
      event.data;

    log.info("Deleting document (multi-source)", {
      workspaceId,
      documentId,
      sourceType,
      sourceId,
    });

    // Step 1: Find document and workspace in database
    const docInfo = await step.run("document.find", async () => {
      try {
        // Get workspace
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        });

        if (!workspace) {
          log.warn("Workspace not found", { workspaceId });
          return null;
        }

        if ((workspace.settings.version as number) !== 1) {
          log.warn("Workspace has invalid settings version", { workspaceId });
          return null;
        }

        // Find document by documentId OR by sourceType+sourceId
        const [doc] = await db
          .select()
          .from(workspaceKnowledgeDocuments)
          .where(
            and(
              eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
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
                eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
                eq(workspaceKnowledgeDocuments.sourceType, sourceType as SourceType),
                eq(workspaceKnowledgeDocuments.sourceId, sourceId),
              ),
            )
            .limit(1);

          if (!docBySource) {
            log.warn("Document not found", {
              documentId,
              sourceType,
              sourceId,
              workspaceId,
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
            workspaceId,
            indexName: workspace.settings.embedding.indexName,
            namespaceName: workspace.settings.embedding.namespaceName,
          };
        }

        log.info("Found document to delete", {
          docId: doc.id,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
        });

        return {
          docId: doc.id,
          workspaceId,
          indexName: workspace.settings.embedding.indexName,
          namespaceName: workspace.settings.embedding.namespaceName,
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
    await step.run("vectors.delete", async () => {
      try {
        await pineconeClient.deleteByMetadata(
          docInfo.indexName,
          {
            docId: docInfo.docId,
          },
          docInfo.namespaceName,
        );

        log.info("Deleted vectors from Pinecone via metadata (multi-source)", {
          indexName: docInfo.indexName,
          namespaceName: docInfo.namespaceName,
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
    await step.run("vector-entries.delete", async () => {
      try {
        await db
          .delete(workspaceKnowledgeVectorChunks)
          .where(
            and(
              eq(workspaceKnowledgeVectorChunks.workspaceId, docInfo.workspaceId),
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
    await step.run("document.delete", async () => {
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
