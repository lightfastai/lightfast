import type { RuntimeContext } from "lightfast/server/adapters/types";
import { createTool } from "lightfast/tool";
import { z } from "zod";
import type { AppRuntimeContext } from "~/ai/types";
import { uuidv4 as generateUUID } from '@repo/lib';
import { documentHandlersByArtifactKind, artifactKinds } from '../artifacts/server';

/**
 * Native Lightfast artifact tool for creating code documents
 * Uses the existing artifact system but integrates with Lightfast's createTool pattern
 */
export const createDocumentTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Create a document for coding, writing, or content creation activities. This tool will generate the contents of the document based on the title and kind.",
	inputSchema: z.object({
		title: z.string().describe("The title of the document (2-4 words maximum, be concise)"),
		kind: z.enum(artifactKinds).describe("The type of document to create"),
	}),
	execute: async ({ title, kind }, context) => {
		const { sessionId, dataStream } = context;

		if (!dataStream) {
			throw new Error("DataStream not available - artifact streaming not supported in this context");
		}

		const id = generateUUID();

		// Stream artifact metadata first (matching Vercel's pattern with data- prefix)
		dataStream.write({
			type: 'data-kind',
			data: kind,
			transient: true,
		});

		dataStream.write({
			type: 'data-id',
			data: id,
			transient: true,
		});

		dataStream.write({
			type: 'data-title',
			data: title,
			transient: true,
		});

		dataStream.write({
			type: 'data-clear',
			data: null,
			transient: true,
		});

		// Find the appropriate document handler
		const documentHandler = documentHandlersByArtifactKind.find(
			(handler) => handler.kind === kind,
		);

		if (!documentHandler) {
			throw new Error(`No document handler found for kind: ${kind}`);
		}

		// Execute the document handler
		await documentHandler.onCreateDocument({
			id,
			title,
			sessionId,
			dataStream: dataStream as any, // Type assertion for compatibility
		});

		// Signal completion
		dataStream.write({ 
			type: 'data-finish', 
			data: null, 
			transient: true 
		});

		return {
			id,
			title,
			kind,
			content: 'A document was created and is now visible to the user.',
		};
	},
});