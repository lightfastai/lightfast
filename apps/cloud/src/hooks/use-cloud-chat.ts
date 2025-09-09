"use client";

import { useChat as useVercelChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useChatTransport } from "~/hooks/use-chat-transport";
import type { CloudChatMessage } from "~/types/chat-messages";

interface UseCloudChatOptions {
  agentId: string;
  sessionId: string;
  initialMessages?: CloudChatMessage[];
  onError?: (error: Error) => void;
}

interface UseCloudChatReturn {
  messages: CloudChatMessage[];
  sendMessage: (message: string) => Promise<void>;
  status: ChatStatus;
  isLoading: boolean;
}

export function useCloudChat({ 
  agentId, 
  sessionId, 
  initialMessages = [], 
  onError 
}: UseCloudChatOptions): UseCloudChatReturn {
  console.log("[useCloudChat] Initialize with:", {
    agentId,
    sessionId,
    initialMessagesCount: initialMessages.length,
  });

  // Create transport for our authenticated agents/execute API
  const transport = useChatTransport({ sessionId, agentId });

  // Auto-resume interrupted streams if the last message was from user
  const shouldAutoResume = initialMessages.length > 0 && 
    initialMessages[initialMessages.length - 1]?.role === "user";

  // Use the chat hook with transport and CloudChatMessage type
  const {
    messages,
    sendMessage: vercelSendMessage,
    status,
  } = useVercelChat<CloudChatMessage>({
    id: `${agentId}-${sessionId}`,
    transport,
    messages: initialMessages,
    onError: onError || ((error) => {
      console.error("[useCloudChat] Error streaming text:", error);
    }),
    resume: shouldAutoResume,
  });

  console.log("[useCloudChat] Current state:", {
    messagesCount: messages.length,
    status,
  });

  const sendMessage = async (message: string) => {
    console.log("[useCloudChat] sendMessage called with:", { message, status });

    if (!message.trim() || status === "streaming" || status === "submitted") {
      console.log("[useCloudChat] Message not sent - invalid state:", { 
        messageTrimmed: message.trim().length, 
        status 
      });
      return;
    }

    try {
      // Generate UUID for the user message
      const userMessageId = crypto.randomUUID();

      console.log("[useCloudChat] Sending message with ID:", userMessageId);

      // Use vercelSendMessage with the correct AI SDK v5 format
      await vercelSendMessage(
        {
          role: "user",
          parts: [{ type: "text", text: message }],
          id: userMessageId,
          metadata: {
            agentId,
            sessionId,
            createdAt: new Date().toISOString(),
          },
        },
        {
          body: {
            // Additional metadata for our API
            userMessageId,
          },
        }
      );
    } catch (error) {
      console.error("[useCloudChat] Error sending message:", error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  return {
    messages,
    sendMessage,
    status,
    isLoading: status === "streaming" || status === "submitted",
  };
}