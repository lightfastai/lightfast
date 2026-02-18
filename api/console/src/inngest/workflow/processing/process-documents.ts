/**
 * Generic document processing workflow
 * Processes documents from any source (GitHub, Vercel)
 *
 * Workflow steps:
 * 1. Batch events by workspace + store
 * 2. Parse and chunk content
 * 3. Generate embeddings
 * 4. Upsert to Pinecone
 * 5. Persist to database
 */

import { db } from "@db/console/client";
import {
  workspaceKnowledgeDocuments,
  orgWorkspaces,
  workspaceKnowledgeVectorChunks
  
  
} from "@db/console/schema";
import type {WorkspaceKnowledgeDocument, OrgWorkspace} from "@db/console/schema";
import { and, eq } from "drizzle-orm";
import { chunkText } from "@repo/console-chunking";
import type { Chunk } from "@repo/console-chunking";
import {
  createEmbeddingProviderForWorkspace,
  embedTextsInBatches,
} from "@repo/console-embed";
import {
  pineconeClient
  
} from "@repo/console-pinecone";
import type {VectorMetadata} from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { createHash } from "node:crypto";
import { inngest } from "../../client/client";
import type { SourceType } from "@repo/console-validation";

/**
 * Generic document processing event
 * Works with any source type
 */
interface ProcessDocumentEvent {
  workspaceId: string;
  documentId: string;

  // Source identification (discriminated union)
  sourceType: SourceType;
  sourceId: string;
  sourceMetadata: Record<string, unknown>;

  // Document content
  title: string;
  content: string;
  contentHash: string;

  // Optional fields
  parentDocId?: string;
  metadata?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

type PreparedDocument = ReadyDocument | SkippedDocument;

interface BasePrepared {
  event: ProcessDocumentEvent;
  docId?: string;
}

interface ReadyDocument extends BasePrepared {
  status: "ready";
  workspace: OrgWorkspace;
  docId: string;
  indexName: string;
  slug: string;
  contentHash: string;
  configHash: string;
  chunks: Chunk[];
  embeddings?: number[][];
  existingDoc?: WorkspaceKnowledgeDocument | null;
}

interface SkippedDocument extends BasePrepared {
  status: "skipped";
  reason: string;
}

/**
 * Compute configuration hash for a workspace
 */
function computeConfigHash(workspace: OrgWorkspace): string {
  const configData = JSON.stringify({
    embeddingModel: workspace.settings.embedding.embeddingModel,
    embeddingDim: workspace.settings.embedding.embeddingDim,
    chunkMaxTokens: workspace.settings.embedding.chunkMaxTokens,
    chunkOverlap: workspace.settings.embedding.chunkOverlap,
  });

  return createHash("sha256").update(configData).digest("hex");
}

/**
 * Generic document processor workflow
 * Handles all source types in a unified way
 */
export const processDocuments = inngest.createFunction(
  {
    id: "apps-console/process-documents",
    name: "Process Documents (Multi-Source)",
    description:
      "Processes documents from any source: fetch, parse, chunk, embed, upsert",
    retries: 3,

    // Batch events per workspace (1:1 with store)
    // Note: Idempotency enforced in step.run via existingDoc.contentHash check
    batchEvents: {
      maxSize: 25,
      timeout: "5s",
      key: "event.data.workspaceId",
    },

    // Limit per-workspace processing (1:1 with store)
    concurrency: [
      {
        key: "event.data.workspaceId",
        limit: 5,
      },
    ],

    timeouts: {
      start: "1m",
      finish: "15m",
    },
  },
  { event: "apps-console/documents.process" },
  async ({ events, step }) => {
    if (!events.length) {
      return { processed: 0, skipped: 0, results: [] };
    }

    const sample = events[0];
    log.info("Processing document batch (multi-source)", {
      workspaceId: sample.data.workspaceId,
      sourceType: sample.data.sourceType,
      count: events.length,
    });

    // Process documents
    const results = await step.run("documents.process-batch", async () => {
      const workspaceCache = new Map<string, OrgWorkspace>();

      const prepared: PreparedDocument[] = await Promise.all(
        events.map(async (event): Promise<PreparedDocument> => {
          try {
            const workspace = await getWorkspace(
              workspaceCache,
              event.data.workspaceId,
            );

            // Generate slug from title or sourceId
            const slug = generateSlug(event.data.title, event.data.sourceId);

            // Chunk the content
            const chunks = chunkText(event.data.content, {
              maxTokens: workspace.settings.embedding.chunkMaxTokens,
              overlap: workspace.settings.embedding.chunkOverlap,
            });

            if (chunks.length === 0) {
              log.warn("No chunks generated for document", {
                documentId: event.data.documentId,
                sourceType: event.data.sourceType,
              });
              return {
                status: "skipped",
                event: event.data,
                docId: event.data.documentId,
                reason: "no_chunks",
              };
            }

            const existingDoc = await findExistingDocument(
              workspace.id,
              event.data.sourceType,
              event.data.sourceId,
            );

            const currentConfigHash = computeConfigHash(workspace);

            // Skip if both content and configuration are unchanged
            // BUT first verify that vector_entries exist (handles partial failure recovery)
            if (
              existingDoc?.contentHash &&
              existingDoc.contentHash === event.data.contentHash &&
              existingDoc.configHash === currentConfigHash
            ) {
              // Verify vector entries exist before skipping
              const vectorEntriesExist = await db
                .select({ id: workspaceKnowledgeVectorChunks.id })
                .from(workspaceKnowledgeVectorChunks)
                .where(
                  and(
                    eq(workspaceKnowledgeVectorChunks.workspaceId, workspace.id),
                    eq(workspaceKnowledgeVectorChunks.docId, event.data.documentId),
                  ),
                )
                .limit(1);

              if (vectorEntriesExist.length === 0) {
                log.warn(
                  "Document exists but vector entries missing - reprocessing for recovery",
                  {
                    docId: event.data.documentId,
                    workspaceId: workspace.id,
                    sourceType: event.data.sourceType,
                  },
                );
                // Don't skip - continue to reprocess and recreate vector entries
              } else {
                // All good - document and vectors exist, can safely skip
                return {
                  status: "skipped",
                  event: event.data,
                  docId: event.data.documentId,
                  reason: "content_unchanged",
                };
              }
            }

            // Log if re-processing due to config change
            if (
              existingDoc?.contentHash === event.data.contentHash &&
              existingDoc.configHash !== currentConfigHash
            ) {
              log.info("Re-processing document due to configuration change", {
                docId: event.data.documentId,
                sourceType: event.data.sourceType,
                oldConfigHash: existingDoc.configHash,
                newConfigHash: currentConfigHash,
              });
            }

            return {
              status: "ready",
              event: event.data,
              workspace,
              docId: event.data.documentId,
              indexName: workspace.settings.embedding.indexName,
              slug,
              contentHash: event.data.contentHash,
              configHash: currentConfigHash,
              chunks,
              existingDoc: existingDoc ?? null,
            };
          } catch (error) {
            log.error("Failed to prepare document", {
              error,
              documentId: event.data.documentId,
              sourceType: event.data.sourceType,
              workspaceId: event.data.workspaceId,
            });
            throw error;
          }
        }),
      );

      const readyDocs = prepared.filter(isReadyDocument);

      if (readyDocs.length > 0) {
        const firstDoc = readyDocs[0];
        if (!firstDoc) {
          throw new Error("No ready documents to process");
        }

        const embeddingProvider = createEmbeddingProviderForWorkspace(
          {
            id: firstDoc.workspace.id,
            embeddingModel: firstDoc.workspace.settings.embedding.embeddingModel,
            embeddingDim: firstDoc.workspace.settings.embedding.embeddingDim,
          },
          {
            inputType: "search_document",
          },
        );

        await generateEmbeddingsForDocuments(
          readyDocs,
          embeddingProvider,
          96, // Cohere API limit
        );
        await upsertDocumentsToPinecone(readyDocs);
        await persistDocuments(readyDocs);
      }

      return prepared.map((doc) => {
        if (!isReadyDocument(doc)) {
          return {
            status: "skipped",
            docId: doc.docId,
            reason: doc.reason,
          };
        }

        return {
          status: "processed",
          docId: doc.docId,
          contentHash: doc.contentHash,
          chunkCount: doc.chunks.length,
        };
      });
    });

    // Trigger relationship extraction for processed documents
    const processedDocs = results.filter((r) => r.status === "processed");
    if (processedDocs.length > 0) {
      const eventsToSend = events
        .filter((e) =>
          processedDocs.some(
            (p) => p.docId === e.data.documentId && e.data.relationships,
          ),
        )
        .map((e) => ({
          name: "apps-console/relationships.extract" as const,
          data: {
            documentId: e.data.documentId,
            workspaceId: e.data.workspaceId,
            sourceType: e.data.sourceType,
            // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- avoid conflicting no-non-null-assertion rule
            relationships: e.data.relationships as Record<string, unknown>,
          },
        }));

      if (eventsToSend.length > 0) {
        const eventIds = await step.sendEvent("relationships.trigger-extraction", eventsToSend);

        await step.run("relationships.log-extraction", () => {
          log.info("Triggered relationship extraction", {
            count: eventsToSend.length,
            eventIds: eventIds.ids.length,
          });
        });
      }
    }

    const processed = results.filter((r) => r.status === "processed");
    const skipped = results.filter((r) => r.status === "skipped");

    log.info("Completed document batch (multi-source)", {
      processed: processed.length,
      skipped: skipped.length,
    });

    return {
      processed: processed.length,
      skipped: skipped.length,
      results,
    };
  },
);

async function getWorkspace(
  cache: Map<string, OrgWorkspace>,
  workspaceId: string,
): Promise<OrgWorkspace> {
  const cached = cache.get(workspaceId);
  if (cached) {
    return cached;
  }

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if ((workspace.settings.version as number) !== 1) {
    throw new Error(`Workspace ${workspaceId} has invalid settings version`);
  }

  cache.set(workspaceId, workspace);
  return workspace;
}

async function findExistingDocument(
  workspaceId: string,
  sourceType: SourceType,
  sourceId: string,
): Promise<WorkspaceKnowledgeDocument | undefined> {
  const [existingDoc] = await db
    .select()
    .from(workspaceKnowledgeDocuments)
    .where(
      and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.sourceType, sourceType),
        eq(workspaceKnowledgeDocuments.sourceId, sourceId),
      ),
    )
    .limit(1);

  return existingDoc;
}

function generateSlug(title: string, sourceId: string): string {
  // Sanitize title or use sourceId as fallback
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return base || sourceId.replace(/[^a-z0-9]+/g, "-");
}

async function generateEmbeddingsForDocuments(
  docs: ReadyDocument[],
  embeddingProvider: ReturnType<typeof createEmbeddingProviderForWorkspace>,
  batchSize: number,
) {
  const queue: {
    docIndex: number;
    chunkIndex: number;
    text: string;
  }[] = [];

  docs.forEach((doc, docIndex) => {
    doc.chunks.forEach((chunk, chunkIndex) => {
      queue.push({
        docIndex,
        chunkIndex,
        text: chunk.text,
      });
    });
  });

  if (queue.length === 0) {
    return;
  }

  const embeddings = await embedTextsInBatches(embeddingProvider, queue, {
    batchSize,
  });

  embeddings.forEach((vector, idx) => {
    const target = queue[idx];
    if (!target) return;
    const doc = docs[target.docIndex];
    if (!doc) return;
    doc.embeddings ??= Array(doc.chunks.length);
    doc.embeddings[target.chunkIndex] = vector;
  });
}

async function upsertDocumentsToPinecone(docs: ReadyDocument[]) {
  const docsByIndex = new Map<string, ReadyDocument[]>();

  for (const doc of docs) {
    if (!doc.embeddings || doc.embeddings.length === 0) {
      log.warn("No embeddings generated for document", {
        docId: doc.docId,
      });
      continue;
    }

    if (!docsByIndex.has(doc.indexName)) {
      docsByIndex.set(doc.indexName, []);
    }
    docsByIndex.get(doc.indexName)?.push(doc);
  }

  for (const [indexName, bucket] of docsByIndex.entries()) {
    const ids: string[] = [];
    const vectors: number[][] = [];
    const metadata: VectorMetadata[] = [];

    for (const doc of bucket) {
      doc.chunks.forEach((chunk, chunkIndex) => {
        const vector = doc.embeddings?.[chunkIndex];
        if (!vector) {
          return;
        }

        ids.push(`${doc.docId}#${chunkIndex}`);
        vectors.push(vector);

        metadata.push({
          docId: doc.docId,
          chunkIndex,
          path: doc.event.sourceId,
          text: chunk.text,
          title: doc.event.title,
          snippet: chunk.text.substring(0, 200),
          url: `/${doc.slug}`,
          slug: doc.slug,
          contentHash: doc.contentHash,
        });
      });
    }

    if (ids.length === 0) {
      continue;
    }

    // Get namespace from first doc in bucket (all share same namespace)
    const firstBucketDoc = bucket[0];
    if (!firstBucketDoc) continue;
    const namespaceName = firstBucketDoc.workspace.settings.embedding.namespaceName;

    await pineconeClient.upsertVectors(
      indexName,
      {
        ids,
        vectors,
        metadata,
      },
      namespaceName,
    );

    log.info("Upserted vectors to Pinecone (multi-source)", {
      indexName,
      namespaceName,
      count: ids.length,
    });
  }
}

async function persistDocuments(docs: ReadyDocument[]) {
  for (const doc of docs) {
    if (doc.existingDoc) {
      await db
        .update(workspaceKnowledgeDocuments)
        .set({
          slug: doc.slug,
          contentHash: doc.contentHash,
          configHash: doc.configHash,
          sourceMetadata: doc.event.sourceMetadata,
          parentDocId: doc.event.parentDocId ?? null,
          relationships: doc.event.relationships ?? null,
          chunkCount: doc.chunks.length,
          updatedAt: new Date(),
        })
        .where(eq(workspaceKnowledgeDocuments.id, doc.existingDoc.id));
    } else {
      await db.insert(workspaceKnowledgeDocuments).values({
        id: doc.docId,
        workspaceId: doc.workspace.id,
        sourceType: doc.event.sourceType,
        sourceId: doc.event.sourceId,
        sourceMetadata: doc.event.sourceMetadata,
        parentDocId: doc.event.parentDocId ?? null,
        slug: doc.slug,
        contentHash: doc.contentHash,
        configHash: doc.configHash,
        relationships: doc.event.relationships ?? null,
        chunkCount: doc.chunks.length,
      });
    }

    await refreshVectorEntries(doc);
  }
}

async function refreshVectorEntries(doc: ReadyDocument) {
  await db
    .delete(workspaceKnowledgeVectorChunks)
    .where(
      and(
        eq(workspaceKnowledgeVectorChunks.workspaceId, doc.workspace.id),
        eq(workspaceKnowledgeVectorChunks.docId, doc.docId),
      ),
    );

  const entries = doc.chunks.map((_, chunkIndex) => ({
    id: `${doc.docId}#${chunkIndex}`,
    workspaceId: doc.workspace.id,
    docId: doc.docId,
    chunkIndex,
    contentHash: doc.contentHash,
  }));

  if (entries.length > 0) {
    await db.insert(workspaceKnowledgeVectorChunks).values(entries);
  }
}

function isReadyDocument(doc: PreparedDocument): doc is ReadyDocument {
  return doc.status === "ready";
}
