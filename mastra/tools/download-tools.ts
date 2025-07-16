import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "@/env";
import { stagehandManager } from "../lib/stagehand-manager";

/**
 * Tool to download files from web pages using Browserbase download feature
 */
export const downloadFileTool = createTool({
	id: "download-file",
	description: "Download a file from a webpage using Browserbase's download feature",
	inputSchema: z.object({
		url: z.string().describe("URL to navigate to"),
		downloadAction: z.string().describe('Action to trigger download (e.g., "click download button", "right-click on image and save")'),
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

			// Set up download tracking
			let downloadDetected = false;
			let downloadId: string | null = null;

			// Monitor for downloads
			stagehand.page.on('download', (download: any) => {
				downloadDetected = true;
				downloadId = download.url(); // This should give us the download identifier
				console.log(`Download detected: ${downloadId}`);
			});

			// Trigger the download action
			console.log(`Performing download action: ${context.downloadAction}`);
			await stagehand.page.act({
				action: context.downloadAction,
			});

			// Wait a bit for download to be detected
			await new Promise(resolve => setTimeout(resolve, 2000));

			if (downloadDetected && downloadId) {
				// Get session ID from Stagehand
				const sessionId = stagehand.sessionId;
				const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

				return {
					success: true,
					downloadUrl: browserbaseDownloadUrl,
					filename: context.filename,
					message: `Download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
				};
			} else {
				return {
					success: false,
					message: "No download was detected. The action may not have triggered a download.",
				};
			}

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

			// Navigate to the file URL - this should trigger download automatically
			console.log(`Navigating to file URL: ${context.fileUrl}`);
			
			// Set up download tracking
			let downloadDetected = false;
			stagehand.page.on('download', (download: any) => {
				downloadDetected = true;
				console.log(`Download detected for: ${context.fileUrl}`);
			});

			await stagehand.page.goto(context.fileUrl);
			
			// Wait for download to be detected
			await new Promise(resolve => setTimeout(resolve, 3000));

			if (downloadDetected) {
				// Get session ID from Stagehand
				const sessionId = stagehand.sessionId;
				const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

				return {
					success: true,
					downloadUrl: browserbaseDownloadUrl,
					filename: context.filename,
					message: `Direct download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
				};
			} else {
				return {
					success: false,
					message: "No download was detected. The URL may not be a direct file link.",
				};
			}

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
			const stagehand = await stagehandManager.ensureStagehand();
			const sessionId = stagehand.sessionId;
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
		imageDescription: z.string().describe('Description of image to download (e.g., "the main logo", "first product image", "profile picture")'),
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

			// Set up download tracking
			let downloadDetected = false;
			stagehand.page.on('download', (download: any) => {
				downloadDetected = true;
				console.log(`Image download detected: ${context.imageDescription}`);
			});

			// Right-click on the image to save it
			const downloadAction = `right-click on ${context.imageDescription} and save image`;
			console.log(`Performing image download action: ${downloadAction}`);
			await stagehand.page.act({
				action: downloadAction,
			});

			// Wait for download to be detected
			await new Promise(resolve => setTimeout(resolve, 3000));

			if (downloadDetected) {
				// Get session ID from Stagehand
				const sessionId = stagehand.sessionId;
				const browserbaseDownloadUrl = `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`;

				return {
					success: true,
					downloadUrl: browserbaseDownloadUrl,
					filename: context.filename,
					message: `Image download initiated successfully. Access via Browserbase API: ${browserbaseDownloadUrl}`,
				};
			} else {
				return {
					success: false,
					message: `No download was detected. Could not find or download image: ${context.imageDescription}`,
				};
			}

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