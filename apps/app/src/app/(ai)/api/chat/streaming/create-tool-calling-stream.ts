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
  const { userMessage, sessionMode, ...rest } = config;

  // Determine if tools should be auto-approved based on session mode
  const autoApproveTools = sessionMode === "agent";

  return createDataStream({
    execute: (dataStream: DataStreamWriter) => {
      const { messages, sessionId } = rest;

      console.log("createToolCallingStreamResponse", {
        messages,
        sessionId,
        sessionMode,
        autoApproveTools,
      });

      try {
        const coreMessages = convertToCoreMessages(messages);
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(),
        );

        const result = streamText({
          ...blenderResearcher({
            sessionId,
            messages: truncatedMessages,
          }),
          experimental_generateMessageId: () => nanoid(),
          onFinish: async ({ response }) => {
            const assistantId = getTrailingMessageId({
              messages: response.messages.filter(
                (message) => message.role === "assistant",
              ),
            });

            if (!assistantId) {
              console.error("No assistant message found!");
              return;
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });

            if (!assistantMessage) {
              console.log("No assistant message found!");
              return;
            }

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  role: assistantMessage.role,
                  parts: assistantMessage.parts,
                  attachments: assistantMessage.experimental_attachments ?? [],
                  createdAt: new Date(),
                  sessionId,
                  updatedAt: new Date(),
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
      return error instanceof Error ? error.message : String(error);
    },
  });
}
