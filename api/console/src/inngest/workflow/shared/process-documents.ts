/**
 * Generic document processing workflow
 * Processes documents from any source (GitHub, Linear, Notion, Sentry, Vercel, Zendesk)
 *
 * Workflow steps:
 * 1. Batch events by workspace + store
 * 2. Parse and chunk content
 * 3. Generate embeddings
 * 4. Upsert to Pinecone
 * 5. Persist to database
 * 6. Extract cross-source relationships
 */

import { db } from "@db/console/client";
import {
  docsDocuments,
  stores,
  vectorEntries,
  type DocsDocument,
  type Store,
  sourceTypeEnum,
} from "@db/console/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { chunkText, parseMDX } from "@repo/console-chunking";
import type { Chunk } from "@repo/console-chunking";
import {
  createEmbeddingProviderForStore,
  embedTextsInBatches,
} from "@repo/console-embed";
import {
  pineconeClient,
  type VectorMetadata,
} from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { createHash } from "node:crypto";
import { inngest } from "../../client/client";
import { PRIVATE_CONFIG } from "@repo/console-config";

/**
 * Generic document processing event
 * Works with any source type
 */
export interface ProcessDocumentEvent {
  workspaceId: string;
  storeSlug: string;
  documentId: string;

  // Source identification (discriminated union)
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
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
  store: Store;
  docId: string;
  indexName: string;
  slug: string;
  contentHash: string;
  configHash: string;
  chunks: Chunk[];
  embeddings?: number[][];
  existingDoc?: DocsDocument | null;
}

interface SkippedDocument extends BasePrepared {
  status: "skipped";
  reason: string;
}

export interface ProcessedDocumentResult {
  status: "processed" | "skipped";
  docId?: string;
  reason?: string;
  chunkCount?: number;
  contentHash?: string;
}

/**
 * Compute configuration hash for a store
 */
function computeConfigHash(store: Store): string {
  const configData = JSON.stringify({
    embeddingModel: store.embeddingModel,
    embeddingDim: store.embeddingDim,
    chunkMaxTokens: store.chunkMaxTokens,
    chunkOverlap: store.chunkOverlap,
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

    // Prevent reprocessing same document at same content hash
    idempotency: 'event.data.documentId + "-" + event.data.contentHash',

    // Batch events per workspace + store
    batchEvents: {
      maxSize: PRIVATE_CONFIG.workflow.processDoc.batchSize,
      timeout: PRIVATE_CONFIG.workflow.processDoc.batchTimeout,
      key: 'event.data.workspaceId + "-" + event.data.storeSlug',
    },

    // Limit per-store processing
    concurrency: [
      {
        key: 'event.data.workspaceId + "-" + event.data.storeSlug',
        limit: PRIVATE_CONFIG.workflow.processDoc.perStoreConcurrency,
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
      storeSlug: sample.data.storeSlug,
      workspaceId: sample.data.workspaceId,
      sourceType: sample.data.sourceType,
      count: events.length,
    });

    const results = await step.run("process-documents-batch", async () => {
      const storeCache = new Map<string, Store>();

      const prepared: PreparedDocument[] = await Promise.all(
        events.map(async (event): Promise<PreparedDocument> => {
          try {
            const store = await getStore(
              storeCache,
              event.data.workspaceId,
              event.data.storeSlug,
            );

            // Generate slug from title or sourceId
            const slug = generateSlug(event.data.title, event.data.sourceId);

            // Chunk the content
            const chunks = chunkText(event.data.content, {
              maxTokens: store.chunkMaxTokens,
              overlap: store.chunkOverlap,
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
              store.id,
              event.data.sourceType,
              event.data.sourceId,
            );

            const currentConfigHash = computeConfigHash(store);

            // Skip if both content and configuration are unchanged
            if (
              existingDoc?.contentHash &&
              existingDoc.contentHash === event.data.contentHash &&
              existingDoc.configHash === currentConfigHash
            ) {
              return {
                status: "skipped",
                event: event.data,
                docId: event.data.documentId,
                reason: "content_unchanged",
              };
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
              store,
              docId: event.data.documentId,
              indexName: store.indexName,
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
              store: event.data.storeSlug,
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

        const embeddingProvider = createEmbeddingProviderForStore(
          {
            id: firstDoc.store.id,
            embeddingModel: firstDoc.store.embeddingModel,
            embeddingDim: firstDoc.store.embeddingDim,
          },
          {
            inputType: "search_document",
          },
        );

        await generateEmbeddingsForDocuments(
          readyDocs,
          embeddingProvider,
          PRIVATE_CONFIG.workflow.processDoc.embeddingBatchSize,
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
      await step.run("trigger-relationship-extraction", async () => {
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
              storeSlug: e.data.storeSlug,
              workspaceId: e.data.workspaceId,
              sourceType: e.data.sourceType,
              relationships: e.data.relationships!,
            },
          }));

        if (eventsToSend.length > 0) {
          await inngest.send(eventsToSend);
          log.info("Triggered relationship extraction", {
            count: eventsToSend.length,
          });
        }
      });
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

async function getStore(
  cache: Map<string, Store>,
  workspaceId: string,
  storeSlug: string,
): Promise<Store> {
  const key = `${workspaceId}:${storeSlug}`;
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const store = await db.query.stores.findFirst({
    where: and(eq(stores.workspaceId, workspaceId), eq(stores.slug, storeSlug)),
  });

  if (!store) {
    throw new Error(
      `Store not found for workspace=${workspaceId}, store=${storeSlug}`,
    );
  }

  cache.set(key, store);
  return store;
}

async function findExistingDocument(
  storeId: string,
  sourceType: string,
  sourceId: string,
): Promise<DocsDocument | undefined> {
  const [existingDoc] = await db
    .select()
    .from(docsDocuments)
    .where(
      and(
        eq(docsDocuments.storeId, storeId),
        eq(docsDocuments.sourceType, sourceType as any),
        eq(docsDocuments.sourceId, sourceId),
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
  embeddingProvider: ReturnType<typeof createEmbeddingProviderForStore>,
  batchSize: number,
) {
  const queue: Array<{
    docIndex: number;
    chunkIndex: number;
    text: string;
  }> = [];

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
    if (!doc.embeddings) {
      doc.embeddings = Array(doc.chunks.length);
    }
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
    docsByIndex.get(doc.indexName)!.push(doc);
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

    await pineconeClient.upsertVectors(indexName, {
      ids,
      vectors,
      metadata,
    });

    log.info("Upserted vectors to Pinecone (multi-source)", {
      indexName,
      count: ids.length,
    });
  }
}

async function persistDocuments(docs: ReadyDocument[]) {
  for (const doc of docs) {
    if (doc.existingDoc) {
      await db
        .update(docsDocuments)
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
        .where(eq(docsDocuments.id, doc.existingDoc.id));
    } else {
      await db.insert(docsDocuments).values({
        id: doc.docId,
        storeId: doc.store.id,
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
    .delete(vectorEntries)
    .where(
      and(
        eq(vectorEntries.storeId, doc.store.id),
        eq(vectorEntries.docId, doc.docId),
      ),
    );

  const entries = doc.chunks.map((_, chunkIndex) => ({
    id: `${doc.docId}#${chunkIndex}`,
    storeId: doc.store.id,
    docId: doc.docId,
    chunkIndex,
    contentHash: doc.contentHash,
  }));

  if (entries.length > 0) {
    await db.insert(vectorEntries).values(entries);
  }
}

function isReadyDocument(doc: PreparedDocument): doc is ReadyDocument {
  return doc.status === "ready";
}
