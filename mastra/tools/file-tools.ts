import { createTool } from "@mastra/core/tools";
import { del, head, list, put } from "@vercel/blob";
import { z } from "zod";
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
		metadata: z.record(z.string()).optional().describe("Optional metadata to attach to the file"),
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
				filename: context.filename,
			});

			// Always organize files by thread ID
			const fullPath = threadId ? `threads/${threadId}/${context.filename}` : `threads/no-thread/${context.filename}`;

			// Auto-detect content type if not provided
			const contentType = context.contentType || getContentType(context.filename) || "text/plain";

			// Write to blob storage
			const blob = await put(fullPath, context.content, {
				access: "public",
				contentType,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				url: blob.url,
				path: fullPath,
				size: blob.pathname ? blob.pathname.length : context.content.length,
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
				const fullPath = threadId ? `threads/${threadId}/${context.filename}` : `threads/no-thread/${context.filename}`;

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
				const fullPath = threadId ? `threads/${threadId}/${context.filename}` : `threads/no-thread/${context.filename}`;

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
 * String replacement tool for precise file editing
 */
export const fileStringReplaceTool = createTool({
	id: "file-string-replace",
	description: "Replace specified string in a file with new content",
	inputSchema: z.object({
		filename: z.string().describe("Filename to modify (e.g., 'config.json')"),
		oldString: z.string().describe("Exact string to find and replace"),
		newString: z.string().describe("New string to replace with"),
		replaceAll: z
			.boolean()
			.default(false)
			.describe("Whether to replace all occurrences (default: false, replaces first only)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		replacements: z.number().optional().describe("Number of replacements made"),
		threadId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId }) => {
		try {
			// Build the full path based on thread ID
			const fullPath = threadId ? `threads/${threadId}/${context.filename}` : `threads/no-thread/${context.filename}`;

			// First read the current file content
			const blobMeta = await head(fullPath, {
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			const response = await fetch(blobMeta.url);
			if (!response.ok) {
				throw new Error(`Failed to read file: HTTP ${response.status}`);
			}

			let content = await response.text();

			// Perform string replacement
			let replacements = 0;
			if (context.replaceAll) {
				const regex = new RegExp(context.oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
				const matches = content.match(regex);
				replacements = matches ? matches.length : 0;
				content = content.replace(regex, context.newString);
			} else {
				if (content.includes(context.oldString)) {
					content = content.replace(context.oldString, context.newString);
					replacements = 1;
				}
			}

			if (replacements === 0) {
				return {
					success: false,
					replacements: 0,
					threadId,
					message: `String "${context.oldString}" not found in file ${context.filename}`,
				};
			}

			// Write the modified content back
			const contentType = getContentType(context.filename) || "text/plain";
			const blob = await put(fullPath, content, {
				access: "public",
				contentType,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				replacements,
				threadId,
				message: `Successfully replaced ${replacements} occurrence(s) of "${context.oldString}" in ${context.filename}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				replacements: 0,
				threadId,
				message: `Failed to replace string in file: ${errorMessage}`,
			};
		}
	},
});

/**
 * Find text content within a file using regex
 */
export const fileFindInContentTool = createTool({
	id: "file-find-in-content",
	description: "Search for text patterns within file content using regex",
	inputSchema: z.object({
		filename: z.string().describe("Filename to search in (e.g., 'config.json')"),
		regex: z.string().describe("Regular expression pattern to search for"),
		caseSensitive: z.boolean().default(true).describe("Whether search should be case sensitive"),
		maxMatches: z.number().default(10).describe("Maximum number of matches to return"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		matches: z
			.array(
				z.object({
					match: z.string(),
					lineNumber: z.number(),
					lineContent: z.string(),
					index: z.number(),
				}),
			)
			.optional(),
		totalMatches: z.number(),
		threadId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId }) => {
		try {
			// Build the full path based on thread ID
			const fullPath = threadId ? `threads/${threadId}/${context.filename}` : `threads/no-thread/${context.filename}`;

			// Read file content
			const blobMeta = await head(fullPath, {
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			const response = await fetch(blobMeta.url);
			if (!response.ok) {
				throw new Error(`Failed to read file: HTTP ${response.status}`);
			}

			const content = await response.text();
			const lines = content.split("\n");

			// Create regex with appropriate flags
			const flags = context.caseSensitive ? "g" : "gi";
			const regex = new RegExp(context.regex, flags);

			const matches: Array<{
				match: string;
				lineNumber: number;
				lineContent: string;
				index: number;
			}> = [];

			// Search through each line
			lines.forEach((line, lineIndex) => {
				if (matches.length >= context.maxMatches) return;

				let match;
				const lineRegex = new RegExp(context.regex, flags);
				while ((match = lineRegex.exec(line)) !== null && matches.length < context.maxMatches) {
					matches.push({
						match: match[0],
						lineNumber: lineIndex + 1,
						lineContent: line,
						index: match.index,
					});

					// Prevent infinite loop on global regex
					if (!lineRegex.global) break;
				}
			});

			return {
				success: true,
				matches,
				totalMatches: matches.length,
				threadId,
				message: `Found ${matches.length} match(es) for pattern "${context.regex}" in ${context.filename}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				matches: [],
				totalMatches: 0,
				threadId,
				message: `Failed to search in file: ${errorMessage}`,
			};
		}
	},
});

/**
 * Find files by name pattern using glob syntax
 */
export const fileFindByNameTool = createTool({
	id: "file-find-by-name",
	description: "Find files by name pattern within the current thread's file storage",
	inputSchema: z.object({
		globPattern: z.string().describe("Glob pattern to match filenames (e.g., '*.md', 'config.*', 'data-*.json')"),
		includeContent: z.boolean().default(false).describe("Whether to include file content preview in results"),
		maxContentChars: z.number().default(200).describe("Maximum characters to include in content preview"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		files: z
			.array(
				z.object({
					filename: z.string(),
					path: z.string(),
					url: z.string(),
					size: z.number().optional(),
					uploadedAt: z.string().optional(),
					contentPreview: z.string().optional(),
				}),
			)
			.optional(),
		totalFiles: z.number(),
		threadId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId }) => {
		try {
			// Build the thread prefix to list all blobs in this thread
			const threadPrefix = threadId ? `threads/${threadId}/` : `threads/no-thread/`;

			// List all blobs with the thread prefix
			const { blobs } = await list({
				prefix: threadPrefix,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			// Extract filenames and filter by glob pattern
			const matchingFiles: Array<{
				filename: string;
				path: string;
				url: string;
				size?: number;
				uploadedAt?: string;
				contentPreview?: string;
			}> = [];

			for (const blob of blobs) {
				// Extract filename from the full path
				const filename = blob.pathname.replace(threadPrefix, "");

				// Skip if it's a nested path (contains additional slashes)
				if (filename.includes("/")) continue;

				// Check if filename matches the glob pattern
				if (matchesGlobPattern(filename, context.globPattern)) {
					const fileInfo: any = {
						filename,
						path: blob.pathname,
						url: blob.url,
						size: blob.size,
						uploadedAt: blob.uploadedAt?.toISOString(),
					};

					// Include content preview if requested
					if (context.includeContent) {
						try {
							const response = await fetch(blob.url);
							if (response.ok) {
								const content = await response.text();
								fileInfo.contentPreview =
									content.length > context.maxContentChars
										? content.substring(0, context.maxContentChars) + "..."
										: content;
							}
						} catch (contentError) {
							// Ignore content fetch errors, just skip the preview
							fileInfo.contentPreview = "[Content preview unavailable]";
						}
					}

					matchingFiles.push(fileInfo);
				}
			}

			return {
				success: true,
				files: matchingFiles,
				totalFiles: matchingFiles.length,
				threadId,
				message: `Found ${matchingFiles.length} file(s) matching pattern "${context.globPattern}" in thread storage`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				files: [],
				totalFiles: 0,
				threadId,
				message: `Failed to search files by pattern: ${errorMessage}`,
			};
		}
	},
});

/**
 * Helper function to match filenames against glob patterns
 */
function matchesGlobPattern(filename: string, pattern: string): boolean {
	// Convert glob pattern to regex
	// Escape special regex characters except * and ?
	const regexPattern = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
		.replace(/\*/g, ".*") // * matches any characters
		.replace(/\?/g, "."); // ? matches single character

	const regex = new RegExp(`^${regexPattern}$`, "i"); // Case insensitive
	return regex.test(filename);
}

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
