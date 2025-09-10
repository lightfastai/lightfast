import { uuidv4 as generateUUID } from '@repo/lib';
import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import { documentHandlersByArtifactKind, artifactKinds } from '../artifacts/server';
import type { AppRuntimeContext } from '../types';
import type { LightfastAppChatUIMessage } from '../lightfast-app-chat-ui-messages';

interface CreateDocumentProps {
  sessionId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

export const createDocument = ({
  sessionId,
  dataStream,
}: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for coding, writing, or content creation activities. This tool will generate the contents of the document based on the title and kind.',
    inputSchema: z.object({
      title: z.string().describe('The title of the document'),
      kind: z.enum(artifactKinds).describe('The type of document to create'),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      // Stream artifact metadata first (with data- prefix per Vercel pattern)
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
        dataStream,
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