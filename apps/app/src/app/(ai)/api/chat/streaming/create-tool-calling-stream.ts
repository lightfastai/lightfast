import type { DataStreamWriter } from "ai";
import {
  appendResponseMessages,
  convertToCoreMessages,
  createDataStream,
  streamText,
} from "ai";

import { nanoid } from "@repo/lib";

import type { BaseStreamConfig } from "../schema";
import { saveMessages } from "../actions/save-messages";
import { blenderResearcher } from "../agents/blender-researcher";
import { getMaxAllowedTokens, truncateMessages } from "../utils/context-window";

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  const { userMessage, ...rest } = config;
  return createDataStream({
    execute: (dataStream: DataStreamWriter) => {
      // dataStream.writeData({
      //   type: "user-message-id",
      //   content: userMessageId,
      // });

      const { messages, sessionId, workspaceId } = rest;

      console.log("createToolCallingStreamResponse", {
        messages,
        sessionId,
        workspaceId,
      });

      try {
        const coreMessages = convertToCoreMessages(messages);
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(),
        );
        const result = streamText({
          ...blenderResearcher({
            messages: truncatedMessages,
          }),
          experimental_generateMessageId: () => nanoid(),
          onFinish: async (result) => {
            const { response } = result;

            // Get all assistant messages from the response
            const assistantMessages = response.messages.filter(
              (message) => message.role === "assistant",
            );

            console.log("assistantMessages", assistantMessages);

            if (assistantMessages.length === 0) {
              throw new Error("No assistant messages found");
            }

            // Append all response messages to the user message
            const appendResult = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });

            // Save all assistant messages
            const messagesToSave = assistantMessages.map((message) => ({
              id: message.id,
              sessionId,
              createdAt: new Date(),
              updatedAt: new Date(),
              parts: appendResult.find((m) => m.id === message.id)?.parts,
              attachments: appendResult.find((m) => m.id === message.id)
                ?.experimental_attachments,
              role: message.role,
              content: message.content,
            }));

            console.log("saving assistant messages", messagesToSave);

            await saveMessages({
              messages: messagesToSave,
            });
          },
        });

        void result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: false,
        });
      } catch (error) {
        console.error("Stream execution error:", error);
        throw error;
      }
    },
    onError: (error) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error);
    },
  });
}
