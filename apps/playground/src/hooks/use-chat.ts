"use client";

import { useChat as useVercelChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useChatTransport } from "~/hooks/use-chat-transport";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";

interface UseChatOptions {
  agentId: string;
  threadId: string;
  initialMessages?: PlaygroundUIMessage[];
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: PlaygroundUIMessage[];
  sendMessage: (message: string) => Promise<void>;
  status: ChatStatus;
  isLoading: boolean;
}

export function useChat({ agentId, threadId, initialMessages = [], onError }: UseChatOptions): UseChatReturn {
  // Create transport for AI SDK with agentId
  const transport = useChatTransport({ threadId, agentId });

  // Auto-resume interrupted streams if the last message was from user
  const shouldAutoResume = initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === "user";

  // Use the chat hook with transport and PlaygroundUIMessage type
  const {
    messages,
    sendMessage: vercelSendMessage,
    status,
  } = useVercelChat<PlaygroundUIMessage>({
    id: `${agentId}-${threadId}`,
    transport,
    messages: initialMessages,
    onError:
      onError ||
      ((error) => {
        console.error("Error streaming text:", error);
      }),
    resume: shouldAutoResume,
  });

  const sendMessage = async (message: string) => {
    if (!message.trim() || status === "streaming" || status === "submitted") {
      throw new Error("Cannot send message");
    }

    // Generate UUID for the user message
    const userMessageId = crypto.randomUUID();

    // Use vercelSendMessage with the correct AI SDK format
    await vercelSendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }],
        id: userMessageId,
      },
      {
        body: {
          userMessageId,
        },
      },
    );
  };

  return {
    messages,
    sendMessage,
    status,
    isLoading: status === "streaming" || status === "submitted",
  };
}