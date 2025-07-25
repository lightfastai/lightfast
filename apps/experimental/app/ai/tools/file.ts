import { createTool } from "@lightfast/ai/tool";
import { del, head, list, put } from "@vercel/blob";
import { z } from "zod";
import { env } from "@/env";
import type { RuntimeContext } from "./types";

/**
 * Create file write tool with injected runtime context
 */
export const fileTool = createTool<RuntimeContext>((context) => ({
	description: "Write markdown content to a .md file in blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to save (must end with .md, e.g., 'analysis.md', 'report.md')"),
		content: z.string().describe("Markdown content to write to the file"),
		contentType: z.string().optional().describe("MIME type (defaults to text/markdown for .md files)"),
		metadata: z.record(z.string()).optional().describe("Optional metadata to attach to the file"),
	}),
	execute: async ({ filename, content, contentType, metadata }) => {
		try {
			// Always organize files by thread ID
			const fullPath = `threads/${context.threadId}/${filename}`;

			// Auto-detect content type if not provided
			const finalContentType = contentType || getContentType(filename) || "text/plain";

			// Write to blob storage
			const blob = await put(fullPath, content, {
				access: "public",
				contentType: finalContentType,
				token: env.BLOB_READ_WRITE_TOKEN,
				...(metadata && { metadata }),
			});

			return {
				success: true,
				url: blob.url,
				path: fullPath,
				size: blob.pathname ? blob.pathname.length : content.length,
				threadId: context.threadId,
				message: `File written successfully to ${fullPath}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId: context.threadId,
				message: `Failed to write file: ${errorMessage}`,
			};
		}
	},
}));

/**
 * Create file read tool with injected runtime context
 */
export const fileReadTool = createTool<RuntimeContext>((context) => ({
	description: "Read content from a file in blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to read (e.g., 'analysis.md')"),
		url: z.string().optional().describe("Direct blob URL (alternative to path)"),
	}),
	execute: async ({ filename, url: directUrl }) => {
		try {
			let blobUrl = directUrl;

			// If filename provided, construct the URL
			if (!blobUrl && filename) {
				// Build the full path based on thread ID
				const fullPath = `threads/${context.threadId}/${filename}`;

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
				threadId: context.threadId,
				message: `File read successfully`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId: context.threadId,
				message: `Failed to read file: ${errorMessage}`,
			};
		}
	},
}));

/**
 * Create file delete tool with injected runtime context
 */
export const fileDeleteTool = createTool<RuntimeContext>((context) => ({
	description: "Delete a file from blob storage",
	inputSchema: z.object({
		filename: z.string().describe("Filename to delete (e.g., 'analysis.md')"),
		url: z.string().optional().describe("Direct blob URL (alternative to path)"),
	}),
	execute: async ({ filename, url: directUrl }) => {
		try {
			if (directUrl) {
				await del(directUrl, {
					token: env.BLOB_READ_WRITE_TOKEN,
				});
			} else if (filename) {
				// Build the full path based on thread ID
				const fullPath = `threads/${context.threadId}/${filename}`;

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
}));

/**
 * Create string replacement tool with injected runtime context
 */
export const fileStringReplaceTool = createTool<RuntimeContext>((context) => ({
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
	execute: async ({ filename, oldString, newString, replaceAll }) => {
		try {
			// Build the full path based on thread ID
			const fullPath = `threads/${context.threadId}/${filename}`;

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
			if (replaceAll) {
				const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
				const matches = content.match(regex);
				replacements = matches ? matches.length : 0;
				content = content.replace(regex, newString);
			} else {
				if (content.includes(oldString)) {
					content = content.replace(oldString, newString);
					replacements = 1;
				}
			}

			if (replacements === 0) {
				return {
					success: false,
					replacements: 0,
					threadId: context.threadId,
					message: `String "${oldString}" not found in file ${filename}`,
				};
			}

			// Write the modified content back
			const contentType = getContentType(filename) || "text/plain";
			await put(fullPath, content, {
				access: "public",
				contentType,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				replacements,
				threadId: context.threadId,
				message: `Successfully replaced ${replacements} occurrence(s) of "${oldString}" in ${filename}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				replacements: 0,
				threadId: context.threadId,
				message: `Failed to replace string in file: ${errorMessage}`,
			};
		}
	},
}));

/**
 * Create find in content tool with injected runtime context
 */
export const fileFindInContentTool = createTool<RuntimeContext>((context) => ({
	description: "Search for text patterns within file content using regex",
	inputSchema: z.object({
		filename: z.string().describe("Filename to search in (e.g., 'config.json')"),
		regex: z.string().describe("Regular expression pattern to search for"),
		caseSensitive: z.boolean().default(true).describe("Whether search should be case sensitive"),
		maxMatches: z.number().default(10).describe("Maximum number of matches to return"),
	}),
	execute: async ({ filename, regex, caseSensitive, maxMatches }) => {
		try {
			// Build the full path based on thread ID
			const fullPath = `threads/${context.threadId}/${filename}`;

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
			const flags = caseSensitive ? "g" : "gi";
			const searchRegex = new RegExp(regex, flags);

			const matches: Array<{
				match: string;
				lineNumber: number;
				lineContent: string;
				index: number;
			}> = [];

			// Search through each line
			lines.forEach((line, lineIndex) => {
				if (matches.length >= maxMatches!) return;

				let match: RegExpExecArray | null;
				const lineRegex = new RegExp(regex, flags);
				match = lineRegex.exec(line);
				while (match !== null && matches.length < maxMatches!) {
					matches.push({
						match: match[0],
						lineNumber: lineIndex + 1,
						lineContent: line,
						index: match.index,
					});

					// Prevent infinite loop on global regex
					if (!lineRegex.global) break;
					match = lineRegex.exec(line);
				}
			});

			return {
				success: true,
				matches,
				totalMatches: matches.length,
				threadId: context.threadId,
				message: `Found ${matches.length} match(es) for pattern "${regex}" in ${filename}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				matches: [],
				totalMatches: 0,
				threadId: context.threadId,
				message: `Failed to search in file: ${errorMessage}`,
			};
		}
	},
}));

/**
 * Create find by name tool with injected runtime context
 */
export const fileFindByNameTool = createTool<RuntimeContext>((context) => ({
	description: "Find files by name pattern within the current thread's file storage",
	inputSchema: z.object({
		globPattern: z.string().describe("Glob pattern to match filenames (e.g., '*.md', 'config.*', 'data-*.json')"),
		includeContent: z.boolean().default(false).describe("Whether to include file content preview in results"),
		maxContentChars: z.number().default(200).describe("Maximum characters to include in content preview"),
	}),
	execute: async ({ globPattern, includeContent, maxContentChars }) => {
		try {
			// Build the thread prefix to list all blobs in this thread
			const threadPrefix = `threads/${context.threadId}/`;

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
				if (matchesGlobPattern(filename, globPattern)) {
					const fileInfo: {
						filename: string;
						path: string;
						url: string;
						size?: number;
						uploadedAt?: string;
						contentPreview?: string;
					} = {
						filename,
						path: blob.pathname,
						url: blob.url,
						size: blob.size,
						uploadedAt: blob.uploadedAt?.toISOString(),
					};

					// Include content preview if requested
					if (includeContent) {
						try {
							const response = await fetch(blob.url);
							if (response.ok) {
								const content = await response.text();
								fileInfo.contentPreview =
									content.length > maxContentChars! ? `${content.substring(0, maxContentChars!)}...` : content;
							}
						} catch {
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
				threadId: context.threadId,
				message: `Found ${matchingFiles.length} file(s) matching pattern "${globPattern}" in thread storage`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				files: [],
				totalFiles: 0,
				threadId: context.threadId,
				message: `Failed to search files by pattern: ${errorMessage}`,
			};
		}
	},
}));

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
