import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { put } from "@vercel/blob";
import { env } from "../../env";

/**
 * Simplified tool for agents to save critical information
 * Automatically organizes by agent name and timestamp
 */
export const saveCriticalInfoTool = createTool({
	id: "save-critical-info",
	description: "Save critical or important information to persistent storage",
	inputSchema: z.object({
		title: z.string().describe("Brief title for this information"),
		content: z.string().describe("The critical information to save"),
		category: z
			.enum(["insight", "decision", "error", "result", "reference"])
			.describe("Type of critical information"),
		tags: z.array(z.string()).optional().describe("Optional tags for organization"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		path: z.string().optional(),
		url: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		try {
			// Generate organized path
			const timestamp = new Date().toISOString().split("T")[0];
			const safeTitle = context.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
			const agentName = resourceId || "unknown-agent";
			
			// Always organize by thread ID
			const filename = `${context.category}-${agentName}-${safeTitle}.md`;
			const path = threadId 
				? `threads/${threadId}/${filename}`
				: `threads/no-thread/${filename}`;
			
			// Format content with metadata
			const formattedContent = `---
title: ${context.title}
category: ${context.category}
agent: ${agentName}
thread: ${threadId || "none"}
timestamp: ${new Date().toISOString()}
tags: ${context.tags ? context.tags.join(", ") : "none"}
---

# ${context.title}

${context.content}
`;

			// Save to blob storage
			const blob = await put(path, formattedContent, {
				access: "public",
				contentType: "text/markdown",
				metadata: {
					category: context.category,
					agent: agentName,
					threadId: threadId || "none",
					tags: JSON.stringify(context.tags || []),
				},
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				path,
				url: blob.url,
				message: `Critical information saved: ${context.title}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `Failed to save critical information: ${errorMessage}`,
			};
		}
	},
});