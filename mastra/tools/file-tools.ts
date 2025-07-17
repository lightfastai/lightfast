import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { put, del, head } from "@vercel/blob";
import { env } from "../../env";

/**
 * General purpose file write tool for agents
 */
export const fileWriteTool = createTool({
	id: "file-write",
	description: "Write content to a file in blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to save (e.g., 'analysis.md', 'config.json')"),
		content: z.string().describe("Content to write to the file"),
		contentType: z
			.string()
			.optional()
			.describe("MIME type (defaults based on extension: .md→text/markdown, .json→application/json, etc.)"),
		metadata: z
			.record(z.string())
			.optional()
			.describe("Optional metadata to attach to the file"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		url: z.string().optional(),
		path: z.string().optional(),
		size: z.number().optional(),
		threadId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		try {
			// Debug: Log what we're receiving
			console.log("[fileWriteTool] Debug - Received context:", {
				threadId,
				resourceId,
				filename: context.filename
			});
			
			// Always organize files by thread ID
			const fullPath = threadId 
				? `threads/${threadId}/${context.filename}`
				: `threads/no-thread/${context.filename}`;

			// Auto-detect content type if not provided
			const contentType =
				context.contentType ||
				getContentType(context.filename) ||
				"text/plain";

			// Prepare metadata
			const metadata = {
				...context.metadata,
				threadId: threadId || "none",
				resourceId: resourceId || "none",
				timestamp: new Date().toISOString(),
			};

			// Write to blob storage
			const blob = await put(fullPath, context.content, {
				access: "public",
				contentType,
				metadata,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				url: blob.url,
				path: fullPath,
				size: blob.size,
				threadId,
				message: `File written successfully to ${fullPath}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId,
				message: `Failed to write file: ${errorMessage}`,
			};
		}
	},
});

/**
 * General purpose file read tool for agents
 */
export const fileReadTool = createTool({
	id: "file-read",
	description: "Read content from a file in blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to read (e.g., 'analysis.md')"),
		url: z.string().optional().describe("Direct blob URL (alternative to path)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		content: z.string().optional(),
		metadata: z.record(z.string()).optional(),
		size: z.number().optional(),
		contentType: z.string().optional(),
		threadId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		try {
			let blobUrl = context.url;

			// If filename provided, construct the URL
			if (!blobUrl && context.filename) {
				// Build the full path based on thread ID
				const fullPath = threadId 
					? `threads/${threadId}/${context.filename}`
					: `threads/no-thread/${context.filename}`;

				// Get blob metadata to construct URL
				const blobMeta = await head(fullPath, {
					token: env.BLOB_READ_WRITE_TOKEN,
				});
				blobUrl = blobMeta.url;
			}

			if (!blobUrl) {
				throw new Error("No filename or URL provided");
			}

			// Fetch the content
			const response = await fetch(blobUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const content = await response.text();
			const contentType = response.headers.get("content-type") || "text/plain";

			// Extract metadata from headers if available
			const metadata: Record<string, string> = {};
			const metadataHeader = response.headers.get("x-vercel-blob-metadata");
			if (metadataHeader) {
				try {
					Object.assign(metadata, JSON.parse(metadataHeader));
				} catch {
					// Ignore parsing errors
				}
			}

			return {
				success: true,
				content,
				metadata,
				size: content.length,
				contentType,
				threadId,
				message: `File read successfully`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId,
				message: `Failed to read file: ${errorMessage}`,
			};
		}
	},
});

/**
 * File delete tool for cleanup
 */
export const fileDeleteTool = createTool({
	id: "file-delete",
	description: "Delete a file from blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to delete (e.g., 'analysis.md')"),
		url: z.string().optional().describe("Direct blob URL (alternative to path)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context, threadId }) => {
		try {
			if (context.url) {
				await del(context.url, {
					token: env.BLOB_READ_WRITE_TOKEN,
				});
			} else if (context.filename) {
				// Build the full path based on thread ID
				const fullPath = threadId 
					? `threads/${threadId}/${context.filename}`
					: `threads/no-thread/${context.filename}`;
				
				await del(fullPath, {
					token: env.BLOB_READ_WRITE_TOKEN,
				});
			} else {
				throw new Error("No filename or URL provided");
			}

			return {
				success: true,
				message: `File deleted successfully`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `Failed to delete file: ${errorMessage}`,
			};
		}
	},
});

/**
 * Helper to detect content type from file extension
 */
function getContentType(path: string): string | null {
	const ext = path.split(".").pop()?.toLowerCase();
	const contentTypes: Record<string, string> = {
		md: "text/markdown",
		txt: "text/plain",
		json: "application/json",
		js: "application/javascript",
		ts: "application/typescript",
		html: "text/html",
		css: "text/css",
		csv: "text/csv",
		xml: "application/xml",
		pdf: "application/pdf",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
	};
	return ext ? contentTypes[ext] || null : null;
}