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

            console.log("assistantId", assistantId);

            if (!assistantId) {
              throw new Error("No assistant message found");
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });

            console.log("assistantMessage", assistantMessage);

            if (!assistantMessage) {
              throw new Error("No assistant message found");
            }

            console.log("saving assistant message", {
              id: assistantId,
              sessionId,
              createdAt: new Date(),
              updatedAt: new Date(),
              parts: assistantMessage.parts,
              attachments: assistantMessage.experimental_attachments ?? [],
              role: assistantMessage.role,
              content: assistantMessage.content,
            });
            assistantMessage.parts?.forEach((part) => {
              console.log("part", part);
            });

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  sessionId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  parts: assistantMessage.parts,
                  attachments: assistantMessage.experimental_attachments ?? [],
                  role: assistantMessage.role,
                  content: assistantMessage.content,
                },
              ],
            });

            // note: there may be many assistant messages, we need to save all of them
            // await saveMessages({
            //   messages: appendResult.map((message) => ({
            //     sessionId,
            //     createdAt: new Date(),
            //     updatedAt: new Date(),
            //   })),
            // });

            // try {
            //   // Create the message to save
            //   const generatedMessages = [
            //     ...responseMessages.slice(0, -1),
            //     ...responseMessages.slice(-1),
            //   ];

            //   // Save chat with complete response and related questions
            //   await saveMessages({
            //     messages: generatedMessages.map((message) => ({
            //       sessionId,
            //       createdAt: new Date(),
            //       updatedAt: new Date(),
            //       id: nanoid(),
            //       parts: message.content,
            //       attachments: [],
            //       role: message.role,
            //       content: message.content,
            //     })),
            //   }).catch((error) => {
            //     console.error("Failed to save chat:", error);
            //     throw new Error("Failed to save chat history");
            //   });
            // } catch (error) {
            //   console.error("Error in handleStreamFinish:", error);
            //   throw error;
            // }
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
