import { codeDocumentHandler } from './code/server';
import type { ArtifactKind } from '~/components/artifacts/artifact';
import type { LightfastChatArtifact } from '@db/chat';
import type { UIMessageStreamWriter } from 'ai';
import type { LightfastAppChatUIMessage } from '../lightfast-app-chat-ui-messages';
import { createCaller } from '~/trpc/server';
import { 
  isTRPCClientError, 
  getTRPCErrorCode, 
  getTRPCErrorMessage,
  isNotFound,
  isForbidden,
  isUnauthorized 
} from '~/lib/trpc-errors';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  sessionId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  sessionId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

export interface UpdateDocumentCallbackProps {
  document: LightfastChatArtifact;
  description: string;
  sessionId: string;
  dataStream: UIMessageStreamWriter<LightfastAppChatUIMessage>;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        sessionId: args.sessionId,
        dataStream: args.dataStream,
      });

      // Save document via tRPC
      await saveDocument({
        id: args.id,
        title: args.title,
        content: draftContent,
        kind: config.kind,
        sessionId: args.sessionId,
      });

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        sessionId: args.sessionId,
        dataStream: args.dataStream,
      });

      // Update document via tRPC
      await saveDocument({
        id: args.document.id,
        title: args.document.title,
        content: draftContent,
        kind: config.kind,
        sessionId: args.sessionId,
      });

      return;
    },
  };
}

async function saveDocument({
  id,
  title,
  kind,
  content,
  sessionId,
}: SaveDocumentProps): Promise<void> {
  try {
    const caller = await createCaller();
    await caller.artifact.create({
      id,
      title,
      kind,
      content,
      sessionId,
    });
  } catch (error) {
    console.error('[ArtifactServer] Failed to save document:', {
      id,
      title,
      kind,
      sessionId,
      error: isTRPCClientError(error) ? {
        code: getTRPCErrorCode(error),
        message: getTRPCErrorMessage(error)
      } : error
    });
    
    // Re-throw with descriptive error messages
    if (isUnauthorized(error)) {
      throw new Error('Unauthorized: User session expired or invalid');
    }
    if (isForbidden(error)) {
      throw new Error(`Session ${sessionId} access denied`);
    }
    
    throw new Error(`Failed to save artifact: ${getTRPCErrorMessage(error)}`);
  }
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: Array<DocumentHandler> = [
  codeDocumentHandler,
];

export const artifactKinds = ['code'] as const;