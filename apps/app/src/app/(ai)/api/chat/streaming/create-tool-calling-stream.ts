import type { DataStreamWriter } from "ai";
import {
  appendResponseMessages,
  convertToCoreMessages,
  createDataStream,
  streamText,
} from "ai";

import { nanoid } from "@repo/lib";

import type { BaseStreamConfig } from "../schema";
import { getTrailingMessageId } from "~/lib/utils";
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

            const assistantId = getTrailingMessageId({
              messages: response.messages.filter(
                (message) => message.role === "assistant",
              ),
            });

            if (!assistantId) {
              throw new Error("No assistant message found!");
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });

            if (!assistantMessage) {
              throw new Error("No assistant message found!");
            }

            console.log("saving assistant messages", assistantMessage);

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  sessionId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  content: assistantMessage.content,
                  role: assistantMessage.role,
                  parts: assistantMessage.parts,
                  attachments: assistantMessage.experimental_attachments ?? [],
                },
              ],
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
