import { createTool } from "@mastra/core/tools";
import { put } from "@vercel/blob";
import { z } from "zod";

/**
 * Thread-aware tool that saves todo lists with threadId in blob storage
 */
export const saveThreadTodoTool = createTool({
	id: "save-thread-todo",
	description: "Saves a todo list to blob storage with thread context",
	inputSchema: z.object({
		todoContent: z.string().describe("The todo list content in markdown format"),
		filename: z.string().optional().describe("Optional filename (defaults to todo-{threadId}.md)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		url: z.string().optional(),
		threadId: z.string().optional(),
		resourceId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		try {
			// Access threadId and resourceId from the execution context
			if (!threadId) {
				return {
					success: false,
					message: "No threadId available - cannot save thread-specific todo",
				};
			}

			// Generate filename with threadId
			const filename = context.filename || `todo-${threadId}.md`;
			const blobPath = `todos/${resourceId || "shared"}/${filename}`;

			// Add metadata to the content
			const contentWithMetadata = `---
threadId: ${threadId}
resourceId: ${resourceId || "none"}
timestamp: ${new Date().toISOString()}
---

${context.todoContent}`;

			// Save to blob storage (requires BLOB_READ_WRITE_TOKEN env var)
			const blob = await put(blobPath, contentWithMetadata, {
				access: "public",
				contentType: "text/markdown",
			});

			return {
				success: true,
				url: blob.url,
				threadId,
				resourceId,
				message: `Todo saved to blob storage for thread ${threadId}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId,
				resourceId,
				message: `Failed to save todo: ${errorMessage}`,
			};
		}
	},
});

/**
 * Thread-aware tool that retrieves todo lists from blob storage
 */
export const getThreadTodoTool = createTool({
	id: "get-thread-todo",
	description: "Retrieves a todo list from blob storage for the current thread",
	inputSchema: z.object({
		filename: z.string().optional().describe("Optional filename (defaults to todo-{threadId}.md)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		content: z.string().optional(),
		threadId: z.string().optional(),
		resourceId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		try {
			if (!threadId) {
				return {
					success: false,
					message: "No threadId available - cannot retrieve thread-specific todo",
				};
			}

			// Generate blob path
			const filename = context.filename || `todo-${threadId}.md`;
			const blobPath = `todos/${resourceId || "shared"}/${filename}`;

			// In a real implementation, you would fetch from blob storage
			// For now, return a message about where the file would be stored
			return {
				success: true,
				content: `Would fetch from: ${blobPath}`,
				threadId,
				resourceId,
				message: `Todo location: ${blobPath}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				threadId,
				resourceId,
				message: `Failed to retrieve todo: ${errorMessage}`,
			};
		}
	},
});
