import type { DataStreamWriter } from "ai";
import { convertToCoreMessages, createDataStream, streamText } from "ai";

import type { BaseStreamConfig } from "../schema";
import { handleStreamFinish } from "../actions/handle-stream-finish";
// Function to check if a message contains ask_question tool invocation
import { researcher } from "../agents/researcher";
import { getMaxAllowedTokens, truncateMessages } from "../utils/context-window";

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStream({
    execute: (dataStream: DataStreamWriter) => {
      const { messages, sessionId, workspaceId } = config;

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
          ...researcher({
            messages: truncatedMessages,
          }),
          onFinish: async (result) => {
            await handleStreamFinish({
              responseMessages: result.response.messages,
              sessionId,
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
