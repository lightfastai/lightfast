import type { CoreMessage, DataStreamWriter } from "ai";
import { convertToCoreMessages, createDataStream, streamText } from "ai";

import type { BaseStreamConfig } from "../schema";
// Function to check if a message contains ask_question tool invocation
import { blender } from "../agents/blender";
import { getMaxAllowedTokens, truncateMessages } from "../utils/context-window";

function containsAskQuestionTool(message: CoreMessage) {
  // For CoreMessage format, we check the content array
  if (message.role !== "assistant" || !Array.isArray(message.content)) {
    return false;
  }

  // Check if any content item is a tool-call with ask_question tool
  return message.content.some(
    (item) => item.type === "tool-call" && item.toolName === "ask_question",
  );
}

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
          ...blender({
            messages: truncatedMessages,
          }),
          onFinish: (result) => {
            // Check if the last message contains an ask_question tool invocation
            const shouldSkipRelatedQuestions =
              result.response.messages.length > 0 &&
              containsAskQuestionTool(
                result.response.messages[
                  result.response.messages.length - 1
                ] as CoreMessage,
              );

            // await handleStreamFinish({
            //   responseMessages: result.response.messages,
            //   originalMessages: messages,
            //   model: modelId,
            //   chatId,
            //   dataStream,
            //   skipRelatedQuestions: shouldSkipRelatedQuestions,
            // });
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
