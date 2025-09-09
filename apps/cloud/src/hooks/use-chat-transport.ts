"use client";

import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import type { CloudChatMessage } from "~/types/chat-messages";

interface UseChatTransportProps {
  sessionId: string;
  agentId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for our authenticated agents/execute API
 */
export function useChatTransport({ sessionId, agentId }: UseChatTransportProps): ChatTransport<CloudChatMessage> {
  const transport = useMemo(() => {
    // Use our authenticated agents/execute endpoint
    const apiEndpoint = `/api/agents/execute`;
    
    return new DefaultChatTransport<CloudChatMessage>({
      api: apiEndpoint,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
        return {
          api,
          headers,
          body: {
            agentId,
            sessionId,
            // Send only the latest user message
            // Server will validate and return 400 if no messages
            messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
            // Include any additional metadata from the body
            ...body,
          },
        };
      },
      prepareReconnectToStreamRequest: ({ api, headers }) => {
        // For reconnecting to streams, we can use the same endpoint
        return {
          api,
          headers,
          credentials: "include",
        };
      },
    });
  }, [sessionId, agentId]);

  return transport;
}