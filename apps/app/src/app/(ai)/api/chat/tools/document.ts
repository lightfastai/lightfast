import { tool } from "ai";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { getDocumentById } from "../actions/get-document-by-id";
import { documentHandlersByKind } from "../artifacts/handler";

const artifactKinds = ["code"] as const;

interface CreateDocumentProps {
  sessionId: string;
}

export const createDocument = ({ sessionId }: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.",
    parameters: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      const id = nanoid();

      //   dataStream.writeData({
      //     type: "kind",
      //     content: kind,
      //   });

      //   dataStream.writeData({
      //     type: "id",
      //     content: id,
      //   });

      //   dataStream.writeData({
      //     type: "title",
      //     content: title,
      //   });

      //   dataStream.writeData({
      //     type: "clear",
      //     content: "",
      //   });

      const documentHandler = documentHandlersByKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        sessionId,
      });

      //   dataStream.writeData({ type: "finish", content: "" });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });

interface UpdateDocumentProps {
  sessionId: string;
}

export const updateDocument = ({ sessionId }: UpdateDocumentProps) =>
  tool({
    description: "Update a document with the given description.",
    parameters: z.object({
      id: z.string().describe("The ID of the document to update"),
      description: z
        .string()
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      const documentHandler = documentHandlersByKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        sessionId,
      });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: "The document has been updated successfully.",
      };
    },
  });
