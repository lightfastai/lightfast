import { db } from "@db/console/client";
import {
	docsDocuments,
	stores,
	vectorEntries,
} from "@db/console/schema";
import type { Store } from "@db/console/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { chunkText, parseMDX } from "@repo/console-chunking";
import type { Chunk } from "@repo/console-chunking";
import {
	createEmbeddingProvider,
	embedTextsInBatches,
} from "@repo/console-embed";
import {
	pineconeClient,
	type VectorMetadata,
} from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import {
	createGitHubApp,
	getThrottledInstallationOctokit,
	GitHubContentService,
} from "@repo/console-octokit-github";
import matter from "gray-matter";
import { env } from "../../../env";
import { PRIVATE_CONFIG } from "@repo/console-config";

type DocsDocument = InferSelectModel<typeof docsDocuments>;

export interface ProcessDocEvent {
	workspaceId: string;
	storeSlug: string;
	repoFullName: string;
	filePath: string;
	commitSha: string;
	committedAt: string;
	githubInstallationId: number;
}

type PreparedDocument = ReadyDocument | SkippedDocument;

interface BasePrepared {
	event: ProcessDocEvent;
	docId?: string;
}

interface ReadyDocument extends BasePrepared {
	status: "ready";
	store: Store;
	docId: string;
	indexName: string;
	slug: string;
	contentHash: string;
	title: string | null;
	description: string | null;
	frontmatter: Record<string, unknown> | null;
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

interface DocumentProcessingOptions {
	embeddingBatchSize?: number;
}

const DEFAULT_EMBED_BATCH_SIZE =
	PRIVATE_CONFIG.workflow.processDoc.embeddingBatchSize;

export async function processDocumentsBatch(
	events: ProcessDocEvent[],
	options: DocumentProcessingOptions = {},
): Promise<ProcessedDocumentResult[]> {
	if (events.length === 0) {
		return [];
	}

	const app = createGitHubApp({
		appId: env.GITHUB_APP_ID,
		privateKey: env.GITHUB_APP_PRIVATE_KEY,
	});

	const embeddingProvider = createEmbeddingProvider({
		inputType: "search_document",
	});

	const services = new Map<number, GitHubContentService>();
	const storeCache = new Map<string, Store>();

	const fetchService = async (
		installationId: number,
	): Promise<GitHubContentService> => {
		if (services.has(installationId)) {
			return services.get(installationId)!;
		}

		const octokit = await getThrottledInstallationOctokit(
			app,
			installationId,
		);
		const service = new GitHubContentService(octokit);
		services.set(installationId, service);
		return service;
	};

	const prepared: PreparedDocument[] = await Promise.all(
		events.map(async (event): Promise<PreparedDocument> => {
			try {
				const store = await getStore(
					storeCache,
					event.workspaceId,
					event.storeSlug,
				);

				const fileContent = await fetchRepositoryFile(
					await fetchService(event.githubInstallationId),
					event.repoFullName,
					event.filePath,
					event.commitSha,
				);

				const parsed = await parseMDX(event.filePath, fileContent);
				const docSlug = parsed.slug;

				const { content: body } = matter(fileContent);
				const chunks = chunkText(body, {
					maxTokens: store.chunkMaxTokens,
					overlap: store.chunkOverlap,
				});

				if (chunks.length === 0) {
					log.warn("No chunks generated for document", {
						filePath: event.filePath,
					});
						return {
							status: "skipped",
							event,
							docId: `${store.id}_${docSlug.replace(/\//g, "_")}`,
							reason: "no_chunks",
						};
				}

				const docId = `${store.id}_${docSlug.replace(/\//g, "_")}`;
				const existingDoc = await findExistingDocument(
					store.id,
					event.filePath,
				);

				if (
					existingDoc?.contentHash &&
					existingDoc.contentHash === parsed.contentHash
				) {
						return {
							status: "skipped",
							event,
							docId,
							reason: "content_unchanged",
						};
				}

					return {
						status: "ready",
						event,
						store,
						docId,
						indexName: store.indexName,
						slug: docSlug,
						contentHash: parsed.contentHash,
						title: parsed.title ?? null,
						description: parsed.description ?? null,
						frontmatter: parsed.frontmatter ?? null,
						chunks,
						existingDoc: existingDoc ?? null,
					};
			} catch (error) {
				log.error("Failed to prepare document", {
					error,
					filePath: event.filePath,
					store: event.storeSlug,
				});
				throw error;
			}
		}),
	);

	const readyDocs = prepared.filter(isReadyDocument);

	if (readyDocs.length > 0) {
			await generateEmbeddingsForDocuments(
				readyDocs,
				embeddingProvider,
				options.embeddingBatchSize ?? DEFAULT_EMBED_BATCH_SIZE,
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
}

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
		where: and(
			eq(stores.workspaceId, workspaceId),
			eq(stores.slug, storeSlug),
		),
	});

	if (!store) {
		throw new Error(
			`Store not found for workspace=${workspaceId}, store=${storeSlug}`,
		);
	}

	cache.set(key, store);
	return store;
}

async function fetchRepositoryFile(
	service: GitHubContentService,
	repoFullName: string,
	filePath: string,
	ref: string,
): Promise<string> {
	const [owner, repo] = repoFullName.split("/");

	if (!owner || !repo) {
		throw new Error(`Invalid repository full name: ${repoFullName}`);
	}

	const file = await service.fetchSingleFile(owner, repo, filePath, ref);

	if (!file) {
		throw new Error(`File not found: ${filePath} at ${ref}`);
	}

	return file.content;
}

async function findExistingDocument(
	storeId: string,
	filePath: string,
): Promise<DocsDocument | undefined> {
	const [existingDoc] = await db
		.select()
		.from(docsDocuments)
		.where(
			and(
				eq(docsDocuments.storeId, storeId),
				eq(docsDocuments.path, filePath),
			),
		)
		.limit(1);

	return existingDoc;
}

async function generateEmbeddingsForDocuments(
	docs: ReadyDocument[],
	embeddingProvider: ReturnType<typeof createEmbeddingProvider>,
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
	// TODO(observability): track Cohere request counts + latency per batch here.

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
					path: doc.event.filePath,
					text: chunk.text,
					title: doc.title ?? doc.event.filePath,
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
		// TODO(observability): capture Pinecone RU metrics after upsert once available.

		log.info("Upserted vectors to Pinecone", {
			indexName,
			count: ids.length,
		});
	}
}

async function persistDocuments(docs: ReadyDocument[]) {
	for (const doc of docs) {
		const committedAt = new Date(doc.event.committedAt);

		if (doc.existingDoc) {
			await db
				.update(docsDocuments)
				.set({
					slug: doc.slug,
					title: doc.title,
					description: doc.description,
					contentHash: doc.contentHash,
					commitSha: doc.event.commitSha,
					committedAt,
					frontmatter: doc.frontmatter,
					chunkCount: doc.chunks.length,
					updatedAt: new Date(),
				})
				.where(eq(docsDocuments.id, doc.existingDoc.id));
		} else {
			await db.insert(docsDocuments).values({
				id: doc.docId,
				storeId: doc.store.id,
				path: doc.event.filePath,
				slug: doc.slug,
				title: doc.title,
				description: doc.description,
				contentHash: doc.contentHash,
				commitSha: doc.event.commitSha,
				committedAt,
				frontmatter: doc.frontmatter,
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
