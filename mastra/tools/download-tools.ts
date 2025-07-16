import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { stagehandManager } from "../lib/stagehand-manager";

/**
 * Tool to download files from web pages using Browserbase download feature
 */
export const downloadFileTool = createTool({
	id: "download-file",
	description: "Download a file from a webpage using Browserbase's download feature",
	inputSchema: z.object({
		url: z.string().describe("URL to navigate to"),
		downloadAction: z
			.string()
			.describe('Action to trigger download (e.g., "click download button", "right-click on image and save")'),
		filename: z.string().optional().describe("Optional filename hint for the downloaded file"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		downloadUrl: z.string().optional().describe("Browserbase download URL"),
		filename: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to the URL
			console.log(`Navigating to: ${context.url}`);
			await stagehand.page.goto(context.url);

			// Configure download behavior using CDP
			const client = await stagehand.page.context().newCDPSession(stagehand.page);
			await client.send("Browser.setDownloadBehavior", {
				behavior: "allow",
				downloadPath: "downloads",
				eventsEnabled: true,
			});

			// Wait for download event and trigger the action
			console.log(`Performing download action: ${context.downloadAction}`);
			const [download] = await Promise.all([
				stagehand.page.waitForEvent("download"),
				stagehand.page.act({
					action: context.downloadAction,
				}),
			]);

			// Check for download errors
			const downloadError = await download.failure();
			if (downloadError !== null) {
				console.error("Download error:", downloadError);
				return {
					success: false,
					message: `Download failed: ${downloadError}`,
				};
			}

			// Get session ID from manager
			const sessionId = stagehandManager.getSessionId();
			if (!sessionId) {
				throw new Error("No active session ID available");
			}
			const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

			return {
				success: true,
				downloadUrl: browserbaseDownloadUrl,
				filename: context.filename || download.suggestedFilename(),
				message: `Download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Download failed:", errorMessage);
			return {
				success: false,
				filename: context.filename,
				message: `Failed to download file: ${errorMessage}`,
			};
		}
	},
});

/**
 * Tool to download files directly from URLs using browser navigation
 */
export const downloadDirectFileTool = createTool({
	id: "download-direct-file",
	description: "Download a file directly from a URL using browser navigation",
	inputSchema: z.object({
		fileUrl: z.string().describe("Direct URL to the file"),
		filename: z.string().optional().describe("Optional filename hint for the downloaded file"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		downloadUrl: z.string().optional().describe("Browserbase download URL"),
		filename: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Configure download behavior using CDP
			const client = await stagehand.page.context().newCDPSession(stagehand.page);
			await client.send("Browser.setDownloadBehavior", {
				behavior: "allow",
				downloadPath: "downloads",
				eventsEnabled: true,
			});

			// Set up download promise with timeout
			const downloadPromise = stagehand.page.waitForEvent("download", { timeout: 10000 });

			// Navigate to the file URL
			console.log(`Navigating to file URL: ${context.fileUrl}`);
			try {
				// Navigate but don't wait for 'load' event since PDFs/files might not trigger it
				await stagehand.page.goto(context.fileUrl, {
					waitUntil: "domcontentloaded",
					timeout: 10000,
				});
			} catch (navError) {
				// Navigation might fail for direct file downloads, but download might still work
				console.log("Navigation completed (possible direct download):", navError);
			}

			// Wait for download with timeout
			let download;
			try {
				download = await downloadPromise;
			} catch (timeoutError) {
				// If no download event was triggered, return with session info anyway
				const sessionId = stagehandManager.getSessionId();
				if (!sessionId) {
					throw new Error("No active session ID available");
				}
				const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

				return {
					success: true,
					downloadUrl: browserbaseDownloadUrl,
					filename: context.filename || "unknown",
					message: `Navigation completed. If a download was triggered, access it via Browserbase API: ${browserbaseDownloadUrl}`,
				};
			}

			// Check for download errors
			const downloadError = await download.failure();
			if (downloadError !== null) {
				console.error("Download error:", downloadError);
				return {
					success: false,
					message: `Download failed: ${downloadError}`,
				};
			}

			// Get session ID from manager
			const sessionId = stagehandManager.getSessionId();
			if (!sessionId) {
				throw new Error("No active session ID available");
			}
			const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

			return {
				success: true,
				downloadUrl: browserbaseDownloadUrl,
				filename: context.filename || download.suggestedFilename(),
				message: `Direct download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Direct download failed:", errorMessage);
			return {
				success: false,
				filename: context.filename,
				message: `Failed to download file directly: ${errorMessage}`,
			};
		}
	},
});

/**
 * Tool to list downloaded files from Browserbase session
 */
export const listDownloadsTool = createTool({
	id: "list-downloads",
	description: "List files downloaded in the current Browserbase session",
	inputSchema: z.object({}),
	outputSchema: z.object({
		success: z.boolean(),
		downloadUrl: z.string().optional().describe("Browserbase downloads API URL"),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			// Ensure we have an active Stagehand session first
			await stagehandManager.ensureStagehand();

			const sessionId = stagehandManager.getSessionId();
			if (!sessionId) {
				throw new Error("No active session ID available");
			}
			const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

			return {
				success: true,
				downloadUrl: browserbaseDownloadUrl,
				message: `Use this URL to access downloads: ${browserbaseDownloadUrl}. You'll need to authenticate with your Browserbase API key.`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("List downloads failed:", errorMessage);
			return {
				success: false,
				message: `Failed to get downloads URL: ${errorMessage}`,
			};
		}
	},
});

/**
 * Tool to download images from web pages using right-click save
 */
export const downloadImageTool = createTool({
	id: "download-image",
	description: "Download an image from a webpage using right-click save action",
	inputSchema: z.object({
		url: z.string().describe("URL to navigate to"),
		imageDescription: z
			.string()
			.describe('Description of image to download (e.g., "the main logo", "first product image", "profile picture")'),
		filename: z.string().optional().describe("Optional filename hint for the downloaded image"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		downloadUrl: z.string().optional().describe("Browserbase download URL"),
		filename: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Navigate to the URL
			console.log(`Navigating to: ${context.url}`);
			await stagehand.page.goto(context.url);

			// Configure download behavior using CDP
			const client = await stagehand.page.context().newCDPSession(stagehand.page);
			await client.send("Browser.setDownloadBehavior", {
				behavior: "allow",
				downloadPath: "downloads",
				eventsEnabled: true,
			});

			// Right-click on the image to save it
			const downloadAction = `right-click on ${context.imageDescription} and save image`;
			console.log(`Performing image download action: ${downloadAction}`);
			const [download] = await Promise.all([
				stagehand.page.waitForEvent("download"),
				stagehand.page.act({
					action: downloadAction,
				}),
			]);

			// Check for download errors
			const downloadError = await download.failure();
			if (downloadError !== null) {
				console.error("Download error:", downloadError);
				return {
					success: false,
					message: `Download failed: ${downloadError}`,
				};
			}

			// Get session ID from manager
			const sessionId = stagehandManager.getSessionId();
			if (!sessionId) {
				throw new Error("No active session ID available");
			}
			const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

			return {
				success: true,
				downloadUrl: browserbaseDownloadUrl,
				filename: context.filename || download.suggestedFilename(),
				message: `Image download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Image download failed:", errorMessage);
			return {
				success: false,
				filename: context.filename,
				message: `Failed to download image: ${errorMessage}`,
			};
		}
	},
});
