import type { Document, DocumentKind } from "@vendor/db/lightfast/schema";

import { saveDocument } from "../actions/save-document";

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: DocumentKind;
  content: string;
  sessionId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  sessionId: string;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  sessionId: string;
}

export interface DocumentHandler<T = DocumentKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends DocumentKind>(config: {
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
      });

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
      });

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
