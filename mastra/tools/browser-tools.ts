import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { stagehandManager } from "../lib/stagehand-manager";

export const browserActTool = createTool({
	id: "web-act",
	description: "Take an action on a webpage using Stagehand",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field")'),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to URL if provided
			if (context.url) {
				console.log(`Navigating to: ${context.url}`);
				await stagehand.page.goto(context.url);
			}

			// Perform action
			if (context.action) {
				console.log(`Performing action: ${context.action}`);
				await stagehand.page.act({
					action: context.action,
				});
			}

			return {
				success: true,
				message: context.action ? `Successfully performed action: ${context.action}` : "Navigation successful",
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Browser action failed:", errorMessage);
			return {
				success: false,
				message: `Browser action failed: ${errorMessage}`,
			};
		}
	},
});

export const browserObserveTool = createTool({
	id: "web-observe",
	description: "Observe elements on a webpage using Stagehand to plan actions",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		instruction: z.string().describe('What to observe (e.g., "find the sign in button")'),
	}),
	outputSchema: z.array(z.any()).describe("Array of observable actions"),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to URL if provided
			if (context.url) {
				console.log(`Navigating to: ${context.url}`);
				await stagehand.page.goto(context.url);
			}

			// Observe elements
			if (context.instruction) {
				console.log(`Observing: ${context.instruction}`);
				return await stagehand.page.observe({
					instruction: context.instruction,
				});
			}

			return [];
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Browser observation failed:", errorMessage);
			throw new Error(`Browser observation failed: ${errorMessage}`);
		}
	},
});

export const browserExtractTool = createTool({
	id: "web-extract",
	description: "Extract data from a webpage using Stagehand",
	inputSchema: z.object({
		url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
		instruction: z.string().describe('What to extract (e.g., "extract all product prices")'),
		schema: z.record(z.any()).optional().describe("Zod schema definition for data extraction"),
		useTextExtract: z
			.boolean()
			.optional()
			.describe("Set true for larger-scale extractions, false for small extractions"),
	}),
	outputSchema: z.any().describe("Extracted data according to schema"),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to URL if provided
			if (context.url) {
				console.log(`Navigating to: ${context.url}`);
				await stagehand.page.goto(context.url);
			}

			// Extract data
			if (context.instruction) {
				console.log(`Extracting data: ${context.instruction}`);

				// Create a default schema if none is provided
				const defaultSchema = {
					content: z.string(),
				};

				const finalSchema = context.schema || defaultSchema;
				const schema = z.object(finalSchema);

				const result = await stagehand.page.extract({
					instruction: context.instruction,
					schema,
					useTextExtract: context.useTextExtract,
				});

				return result.extracted;
			}

			return null;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Browser extraction failed:", errorMessage);
			throw new Error(`Browser extraction failed: ${errorMessage}`);
		}
	},
});

// Add a navigation tool for convenience
export const browserNavigateTool = createTool({
	id: "web-navigate",
	description: "Navigate to a URL in the browser",
	inputSchema: z.object({
		url: z.string().describe("URL to navigate to"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		title: z.string().optional(),
		currentUrl: z.string().optional(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to the URL
			await stagehand.page.goto(context.url);

			// Get page title and current URL
			const title = await stagehand.page.evaluate(() => document.title);
			const currentUrl = await stagehand.page.evaluate(() => window.location.href);

			return {
				success: true,
				title,
				currentUrl,
			};
		} catch (error) {
			return {
				success: false,
				message: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});
