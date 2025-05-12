import type { DataStreamWriter, Message } from "ai";
import {
  appendResponseMessages,
  convertToCoreMessages,
  createDataStream,
  smoothStream,
  streamText,
} from "ai";

import { nanoid } from "@repo/lib";

import type { BaseStreamConfig } from "../schema";
import { saveMessages } from "../actions/save-messages";
import { blenderResearcher } from "../agents/blender-researcher";
import { getMaxAllowedTokens, truncateMessages } from "../utils/context-window";

// Helper function to ensure all tool invocations have results
function ensureToolInvocationsHaveResults(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (!message.parts) return message;

    const newParts = message.parts
      .map((part) => {
        if (part.type !== "tool-invocation") return part;

        const toolInvocation = part.toolInvocation;
        // Skip tool invocations that are in 'call' state without results
        if (toolInvocation.state === "call" && !("result" in toolInvocation)) {
          return null;
        }
        return part;
      })
      .filter((part): part is NonNullable<typeof part> => part !== null);

    return { ...message, parts: newParts };
  });
}

// Helper function to clean up user messages with duplicate tool results
function cleanupUserMessages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== "user" || !message.parts) return message;

    // Get unique tool invocations by toolCallId
    const seenToolCallIds = new Set<string>();
    const uniqueParts = message.parts.filter((part) => {
      if (part.type !== "tool-invocation") return true;

      const toolCallId = part.toolInvocation.toolCallId;
      if (seenToolCallIds.has(toolCallId)) {
        return false; // Skip duplicate tool invocations
      }
      seenToolCallIds.add(toolCallId);
      return true;
    });

    return { ...message, parts: uniqueParts };
  });
}

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
        // Clean up user messages to remove duplicate tool results
        const cleanedMessages = cleanupUserMessages(messages);

        // Filter out incomplete tool invocations before conversion
        const safeMessages = ensureToolInvocationsHaveResults(cleanedMessages);
        const coreMessages = convertToCoreMessages(safeMessages);
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(),
        );

        const result = streamText({
          ...blenderResearcher({
            messages: truncatedMessages,
            dataStream,
          }),
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_generateMessageId: () => nanoid(),
          onFinish: async (result) => {
            const { response } = result;

            // Find the last user message and all subsequent messages
            const lastUserMessageIndex = [...messages]
              .reverse()
              .findIndex((m) => m.role === "user");

            // If we found a user message, get all messages after it
            const relevantMessages =
              lastUserMessageIndex >= 0
                ? messages.slice(messages.length - lastUserMessageIndex - 1)
                : [userMessage];

            // Append the new assistant messages from the response
            const updatedMessages = appendResponseMessages({
              messages: relevantMessages,
              responseMessages: response.messages,
            });

            // Map all assistant messages to the DB format
            const assistantMessagesToSave = updatedMessages
              .filter((m) => m.role === "assistant")
              .map((message) => ({
                id: message.id || nanoid(),
                sessionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                content: message.content,
                role: "assistant",
                parts: message.parts,
                attachments: message.experimental_attachments,
              }));

            if (assistantMessagesToSave.length > 0) {
              console.log("saving assistant messages", assistantMessagesToSave);
              await saveMessages({
                messages: assistantMessagesToSave,
              });
            }
          },
        });

        void result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
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
