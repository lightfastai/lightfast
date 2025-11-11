/**
 * Process single document workflow
 *
 * Fetches file content from GitHub, parses MDX, chunks text, generates
 * embeddings, and upserts to Pinecone.
 *
 * Workflow steps:
 * 1. Fetch file content from GitHub
 * 2. Parse MDX and extract metadata
 * 3. Chunk text (512 tokens, 50 overlap)
 * 4. Generate embeddings (char-hash)
 * 5. Upsert to Pinecone
 * 6. Update docs_documents table
 * 7. Update vector_entries table
 */

import { db } from "@db/console/client";
import { docsDocuments, stores, vectorEntries } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { chunkText, parseMDX, hashContent, deriveSlug } from "@repo/console-chunking";
import { createEmbeddingProvider } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import type { Chunk } from "@repo/console-chunking";

/**
 * Process document function
 *
 * Orchestrates the complete pipeline for ingesting a single document:
 * fetch → parse → chunk → embed → upsert → record
 */
export const processDoc = inngest.createFunction(
	{
		id: "apps-console/process-doc",
		name: "Process Document",
		retries: 3,
	},
	{ event: "apps-console/docs.file.process" },
	async ({ event, step }) => {
		const {
			workspaceId,
			storeName,
			repoFullName,
			filePath,
			commitSha,
			committedAt,
			githubInstallationId
		} = event.data;

		log.info("Processing document", {
			workspaceId,
			storeName,
			filePath,
			commitSha,
		});

		// Step 1: Fetch file content from GitHub
		const fileContent = await step.run("fetch-content", async () => {
			try {
				// Import GitHub utilities
				const { createGitHubApp, getThrottledInstallationOctokit, GitHubContentService } = await import("@repo/console-octokit-github");
				const { env } = await import("../../env");

				log.info("Fetching file content from GitHub", {
					filePath,
					repoFullName,
					commitSha,
					installationId: githubInstallationId
				});

				// Create GitHub App and get installation Octokit
				const app = createGitHubApp({
					appId: env.GITHUB_APP_ID,
					privateKey: env.GITHUB_APP_PRIVATE_KEY,
				});

				const octokit = await getThrottledInstallationOctokit(app, githubInstallationId);

				// Create content service and fetch file
				const contentService = new GitHubContentService(octokit);
				const [owner, repo] = repoFullName.split("/");

				if (!owner || !repo) {
					throw new Error(`Invalid repository full name: ${repoFullName}`);
				}

				const fetchedFile = await contentService.fetchSingleFile(
					owner,
					repo,
					filePath,
					commitSha
				);

				if (!fetchedFile) {
					throw new Error(`File not found: ${filePath} at commit ${commitSha}`);
				}

				log.info("Successfully fetched file content", {
					filePath,
					contentLength: fetchedFile.content.length,
					sha: fetchedFile.sha,
				});

				return fetchedFile.content;
			} catch (error) {
				log.error("Failed to fetch file content", { error, filePath });
				throw error;
			}
		});

		// Step 2: Parse MDX and extract metadata
		const parsed = await step.run("parse-mdx", async () => {
			try {
				const result = await parseMDX(filePath, fileContent);

				log.info("Parsed MDX", {
					filePath,
					hasTitle: !!result.title,
					hasFrontmatter: !!result.frontmatter,
				});

				return result;
			} catch (error) {
				log.error("Failed to parse MDX", { error, filePath });
				throw error;
			}
		});

		// Step 3: Chunk text using store configuration
		const chunks = await step.run("chunk-text", async () => {
			try {
				// Get store to read chunking configuration
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					throw new Error(`Store not found: ${workspaceId}/${storeName}`);
				}

				// Re-extract content from fileContent (parsed only has metadata)
				// We need to strip frontmatter and chunk the body
				const matter = await import("gray-matter");
				const { content: body } = matter.default(fileContent);

				// Use chunking config from store
				const chunked = chunkText(body, {
					maxTokens: store.chunkMaxTokens,
					overlap: store.chunkOverlap,
				});

				log.info("Chunked text", {
					filePath,
					chunkCount: chunked.length,
					maxTokens: store.chunkMaxTokens,
					overlap: store.chunkOverlap,
				});

				return chunked;
			} catch (error) {
				log.error("Failed to chunk text", { error, filePath });
				throw error;
			}
		});

		// Step 4: Generate embeddings (char-hash)
		const embeddings = await step.run("generate-embeddings", async () => {
			try {
				const embedding = createEmbeddingProvider({
					inputType: "search_document",
				});
				const texts = chunks.map((chunk: Chunk) => chunk.text);
				const response = await embedding.embed(texts);

				log.info("Generated embeddings", {
					filePath,
					count: response.embeddings.length,
					model: response.model,
				});

				return response.embeddings;
			} catch (error) {
				log.error("Failed to generate embeddings", { error, filePath });
				throw error;
			}
		});

		// Step 5: Get or create document ID and hash content
		const docInfo = await step.run("prepare-document", async () => {
			try {
				// Get store
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					throw new Error(`Store not found: ${workspaceId}/${storeName}`);
				}

				// Use contentHash from parsed metadata
				const contentHash = parsed.contentHash;
				const slug = parsed.slug;
				const docId = `${store.id}_${slug.replace(/\//g, "_")}`;

				// Check if document exists
				const [existingDoc] = await db
					.select()
					.from(docsDocuments)
					.where(and(eq(docsDocuments.storeId, store.id), eq(docsDocuments.path, filePath)))
					.limit(1);

				// If content hasn't changed, skip processing
				if (existingDoc?.contentHash === contentHash) {
					log.info("Content unchanged, skipping", {
						docId,
						contentHash,
					});
					return { docId, contentHash, slug, storeId: store.id, unchanged: true };
				}

				return {
					docId,
					contentHash,
					slug,
					storeId: store.id,
					indexName: store.indexName,
					unchanged: false,
				};
			} catch (error) {
				log.error("Failed to prepare document", { error, filePath });
				throw error;
			}
		});

		if (docInfo.unchanged) {
			return { status: "skipped", reason: "content_unchanged" };
		}

		// Step 6: Upsert to Pinecone
		await step.run("upsert-vectors", async () => {
			try {
				// Prepare vectors for upsert
				const vectorIds = chunks.map((chunk: Chunk, i: number) => `${docInfo.docId}#${i}`);
				const metadata: VectorMetadata[] = chunks.map((chunk: Chunk, i: number) => ({
					docId: docInfo.docId,
					chunkIndex: i,
					path: filePath,
					text: chunk.text,
					title: parsed.title || filePath,
					snippet: chunk.text.substring(0, 200),
					url: `/${docInfo.slug}`, // TODO: Generate proper URL
					slug: docInfo.slug,
					contentHash: docInfo.contentHash,
				}));

				// Upsert to Pinecone (only if indexName exists)
				if (docInfo.unchanged) {
					log.info("Skipping upsert - content unchanged");
					return;
				}

				const indexName = "indexName" in docInfo ? docInfo.indexName : undefined;
				if (!indexName) {
					throw new Error("Index name not available");
				}

				await pineconeClient.upsertVectors(indexName, {
					ids: vectorIds,
					vectors: embeddings,
					metadata,
				});

				log.info("Upserted vectors to Pinecone", {
					indexName,
					count: vectorIds.length,
				});
			} catch (error) {
				log.error("Failed to upsert vectors", { error, filePath });
				throw error;
			}
		});

		// Step 7: Update docs_documents table
		await step.run("update-document", async () => {
			try {
				// Check if document exists
				const [existingDoc] = await db
					.select()
					.from(docsDocuments)
					.where(and(eq(docsDocuments.storeId, docInfo.storeId), eq(docsDocuments.path, filePath)))
					.limit(1);

				if (existingDoc) {
					// Update existing
					await db
						.update(docsDocuments)
						.set({
							slug: docInfo.slug,
							title: parsed.title || null,
							description: parsed.description || null,
							contentHash: docInfo.contentHash,
							commitSha,
							committedAt: new Date(committedAt),
							frontmatter: parsed.frontmatter,
							chunkCount: chunks.length,
							updatedAt: new Date(),
						})
						.where(eq(docsDocuments.id, existingDoc.id));

					log.info("Updated document", { docId: existingDoc.id });
				} else {
					// Insert new
					await db.insert(docsDocuments).values({
						id: docInfo.docId,
						storeId: docInfo.storeId,
						path: filePath,
						slug: docInfo.slug,
						title: parsed.title || null,
						description: parsed.description || null,
						contentHash: docInfo.contentHash,
						commitSha,
						committedAt: new Date(committedAt),
						frontmatter: parsed.frontmatter,
						chunkCount: chunks.length,
					});

					log.info("Inserted document", { docId: docInfo.docId });
				}
			} catch (error) {
				log.error("Failed to update document", { error, filePath });
				throw error;
			}
		});

		// Step 8: Update vector_entries table
		await step.run("update-vector-entries", async () => {
			try {
				// Delete old entries for this document
				await db
					.delete(vectorEntries)
					.where(and(eq(vectorEntries.storeId, docInfo.storeId), eq(vectorEntries.docId, docInfo.docId)));

				// Insert new entries
				const entries = chunks.map((chunk: Chunk, i: number) => ({
					id: `${docInfo.docId}#${i}`,
					storeId: docInfo.storeId,
					docId: docInfo.docId,
					chunkIndex: i,
					contentHash: docInfo.contentHash,
				}));

				await db.insert(vectorEntries).values(entries);

				log.info("Updated vector entries", {
					docId: docInfo.docId,
					count: entries.length,
				});
			} catch (error) {
				log.error("Failed to update vector entries", { error, filePath });
				throw error;
			}
		});

		return {
			status: "processed",
			docId: docInfo.docId,
			chunkCount: chunks.length,
			contentHash: docInfo.contentHash,
		};
	},
);
