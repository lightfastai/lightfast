import { promises as fs } from "node:fs";
import path from "node:path";
import { createTool } from "@mastra/core";
import { z } from "zod";

export const saveTodoTool = createTool({
	id: "save-todo",
	description: "Saves a todo plan as a markdown file to the local /tmp_content directory",
	inputSchema: z.object({
		filename: z.string().describe("The filename for the todo (without .md extension)"),
		title: z.string().describe("The title of the todo plan"),
		content: z.string().describe("The full markdown content of the todo plan"),
		metadata: z
			.object({
				createdAt: z.string().optional(),
				taskType: z.string().optional(),
				priority: z.string().optional(),
				tags: z.array(z.string()).optional(),
			})
			.optional()
			.describe("Optional metadata for the todo"),
	}),
	execute: async ({ context }) => {
		try {
			// Ensure /tmp_content directory exists
			const baseDir = "/tmp_content";
			await fs.mkdir(baseDir, { recursive: true });

			// Generate filename with timestamp if not provided
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filename = context.filename || `todo-${timestamp}`;
			const fullPath = path.join(baseDir, `${filename}.md`);

			// Build the markdown content
			let markdown = `# ${context.title}\n\n`;

			// Add metadata if provided
			if (context.metadata) {
				markdown += "---\n";
				if (context.metadata.createdAt) {
					markdown += `Created: ${context.metadata.createdAt}\n`;
				}
				if (context.metadata.taskType) {
					markdown += `Type: ${context.metadata.taskType}\n`;
				}
				if (context.metadata.priority) {
					markdown += `Priority: ${context.metadata.priority}\n`;
				}
				if (context.metadata.tags && context.metadata.tags.length > 0) {
					markdown += `Tags: ${context.metadata.tags.join(", ")}\n`;
				}
				markdown += "---\n\n";
			}

			// Add the main content
			markdown += context.content;

			// Write the file
			await fs.writeFile(fullPath, markdown, "utf-8");

			return {
				success: true,
				filepath: fullPath,
				message: `Todo saved successfully to ${fullPath}`,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
				message: "Failed to save todo file",
			};
		}
	},
});
