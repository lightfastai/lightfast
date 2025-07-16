import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";
import { createTool } from "@mastra/core";
import { generateObject } from "ai";
import { z } from "zod";

// Schema for vision analysis response
const visionAnalysisSchema = z.object({
	description: z.string().describe("General description of what is visible in the image"),
	objects: z.array(z.string()).describe("List of objects or elements detected in the image"),
	text: z.array(z.string()).optional().describe("Any text found in the image"),
	colors: z.array(z.string()).optional().describe("Dominant colors in the image"),
	composition: z.string().optional().describe("Description of the image composition and layout"),
	context: z.string().optional().describe("Contextual information or scene understanding"),
});

// Tool to analyze images or PDFs from URLs using Vercel AI SDK
const analyzeVisualContent = createTool({
	id: "analyzeVisualContent",
	description: "Analyzes images or PDFs from provided URLs using vision capabilities",
	inputSchema: z.object({
		url: z.string().url().describe("URL of the image or PDF to analyze"),
		analysisType: z
			.enum(["general", "detailed", "text-extraction"])
			.optional()
			.describe("Type of analysis to perform"),
	}),
	execute: async ({ context }) => {
		const { url, analysisType = "general" } = context;

		try {
			// Determine the prompt based on analysis type
			let systemPrompt = "You are a vision analysis expert. Analyze the provided image.";
			let userPrompt = "Analyze this image and provide structured information about what you see.";

			if (analysisType === "detailed") {
				userPrompt =
					"Provide a detailed analysis of this image, including all visible elements, colors, composition, and any text present.";
			} else if (analysisType === "text-extraction") {
				systemPrompt = "You are a text extraction expert. Focus on identifying and extracting all text from images.";
				userPrompt = "Extract and transcribe all text visible in this image or document. Focus primarily on text content.";
			}

			// Use generateObject with Vercel AI SDK
			const result = await generateObject({
				model: openai("gpt-4o-mini"),
				schema: visionAnalysisSchema,
				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					{
						role: "user",
						content: [
							{ type: "text", text: userPrompt },
							{ type: "image", image: new URL(url) },
						],
					},
				],
			});

			return {
				success: true,
				url,
				analysisType,
				analysis: result.object,
				model: "gpt-4o-mini",
			};
		} catch (error) {
			console.error("Vision analysis error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
				url,
			};
		}
	},
});

// Tool to fetch and validate URLs
const validateUrl = createTool({
	id: "validateUrl",
	description: "Validates if a URL points to an accessible image or PDF",
	inputSchema: z.object({
		url: z.string().url().describe("URL to validate"),
	}),
	execute: async ({ context }) => {
		const { url } = context;

		try {
			const response = await fetch(url, { method: "HEAD" });
			const contentType = response.headers.get("content-type") || "";

			const isImage = contentType.startsWith("image/");
			const isPdf = contentType.includes("application/pdf");

			return {
				valid: response.ok && (isImage || isPdf),
				contentType,
				isImage,
				isPdf,
				statusCode: response.status,
			};
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : "Failed to validate URL",
			};
		}
	},
});

// Create the vision analysis agent
export const visionAgent = new Agent({
	name: "Vision",
	description: "Analyzes images and PDFs from URLs using OpenAI GPT-4 mini vision capabilities",
	model: openai("gpt-4o-mini"),
	tools: {
		analyzeVisualContent,
		validateUrl,
	},
	instructions: `You are a vision analysis agent that helps users analyze images and PDFs from URLs.

Your capabilities:
1. Validate URLs to ensure they point to valid images or PDFs
2. Analyze visual content using OpenAI's vision capabilities with structured output
3. Extract text from images and documents
4. Provide detailed descriptions of visual content including objects, colors, and composition

When a user provides a URL:
1. First validate the URL using the validateUrl tool
2. If valid, analyze the content using analyzeVisualContent
3. Present the structured analysis in a clear, organized format
4. If the URL is invalid or inaccessible, explain the issue clearly

The analysis provides structured data including:
- General description
- Detected objects
- Extracted text (if any)
- Dominant colors
- Composition details
- Contextual understanding

Always be helpful and provide comprehensive analysis based on what you can see in the visual content.`,
});