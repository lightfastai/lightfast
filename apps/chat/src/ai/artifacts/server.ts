import type { ArtifactKind } from '@db/chat';
import type { LightfastChatArtifact } from '@db/chat';
import type { UIMessageStreamWriter } from 'ai';
import type { LightfastAppChatUIMessage } from '~/ai/lightfast-app-chat-ui-messages';
import { codeDocumentHandler } from './code/server';
import { diagramDocumentHandler } from './diagram/server';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  sessionId: string;
  messageId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  sessionId: string;
  messageId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

export interface UpdateDocumentCallbackProps {
  document: LightfastChatArtifact;
  description: string;
  sessionId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

export interface BaseDocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<string>;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(
  baseHandler: BaseDocumentHandler<T>,
  saveDocument: (props: SaveDocumentProps) => Promise<void>
): DocumentHandler<T> {
  return {
    kind: baseHandler.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await baseHandler.onCreateDocument({
        id: args.id,
        title: args.title,
        sessionId: args.sessionId,
        messageId: args.messageId,
        dataStream: args.dataStream,
      });

      // Save document via service
      await saveDocument({
        id: args.id,
        title: args.title,
        content: draftContent,
        kind: baseHandler.kind,
        sessionId: args.sessionId,
        messageId: args.messageId,
      });

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await baseHandler.onUpdateDocument({
        document: args.document,
        description: args.description,
        sessionId: args.sessionId,
        dataStream: args.dataStream,
      });

      // Update document via service
      await saveDocument({
        id: args.document.id,
        title: args.document.title,
        content: draftContent,
        kind: baseHandler.kind,
        sessionId: args.sessionId,
        messageId: args.document.messageId, // Use existing messageId from document
      });

      return;
    },
  };
}

/*
 * Create document handlers with service integration
 * This function should be called with the saveDocument function from the service layer
 */
export function createDocumentHandlersByArtifactKind(
  saveDocument: (props: SaveDocumentProps) => Promise<void>
): DocumentHandler<ArtifactKind>[] {
  return [
    createDocumentHandler(codeDocumentHandler, saveDocument),
    createDocumentHandler(diagramDocumentHandler, saveDocument),
  ];
}