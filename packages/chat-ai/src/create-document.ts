import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { createTool } from "lightfast/tool";
import { z } from "zod";
import type { AppRuntimeContext, ArtifactKind } from "./types";
import { ARTIFACT_KINDS } from "./types";
import { uuidv4 as generateUUID } from '@repo/lib';

// Define proper types for dependencies
export interface SaveDocumentFunction {
  (input: {
    id: string;
    sessionId: string;
    kind: ArtifactKind;
    title: string;
    content: string;
    messageId: string;
  }): Promise<void>;
}

export interface DocumentHandler {
  kind: string;
  onCreateDocument: (props: {
    id: string;
    title: string;
    sessionId: string;
    messageId: string;
    dataStream: UIMessageStreamWriter<UIMessage>;
  }) => Promise<void>;
}

export interface CreateDocumentDependencies {
  saveDocument: SaveDocumentFunction;
  createDocumentHandlersByArtifactKind: (saveDocument: SaveDocumentFunction) => DocumentHandler[];
}

/**
 * Native Lightfast artifact tool for creating code documents
 * Uses the existing artifact system but integrates with Lightfast's createTool pattern
 */
export function createDocumentTool(deps: CreateDocumentDependencies) {
  return createTool<RuntimeContext<AppRuntimeContext>>({
    description: "Create a document for coding, writing, or content creation activities. This tool will generate the contents of the document based on the title and kind.",
    inputSchema: z.object({
      title: z.string().describe("The title of the document (2-4 words maximum, be concise)"),
      kind: z.enum(ARTIFACT_KINDS).describe("The type of document to create"),
    }),
    outputSchema: z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(ARTIFACT_KINDS),
      content: z.string(),
    }),
    execute: async ({ title, kind }: { title: string; kind: typeof ARTIFACT_KINDS[number] }, context: RuntimeContext<AppRuntimeContext>) => {
      const { sessionId } = context;
      const messageId = context.messageId;
      const dataStream = context.dataStream;

      if (!dataStream) {
        throw new Error("DataStream not available - artifact streaming not supported in this context");
      }

      if (!messageId) {
        throw new Error("MessageId not available - unable to link artifact to message");
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

      // Get the document handlers with service integration
      const documentHandlersByArtifactKind = deps.createDocumentHandlersByArtifactKind(deps.saveDocument);
      
      // Get the document handler for the specified kind
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
        messageId: messageId, // We've already checked this is not undefined
        dataStream: dataStream, // We've already checked this is not undefined
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
}